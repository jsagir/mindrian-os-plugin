#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 88-00 Task 2: idempotent migration of existing Phase 81 Feynman-MINTO
 * files to the v88 schema.
 *
 * Backfills five new frontmatter fields on every MINTO.md under a room tree:
 *   - last_generated_at:          "1970-01-01T00:00:00Z" (sentinel zero)
 *   - last_artifact_write_seen_at: null
 *   - reasoning_health_score:      null
 *   - flagged_weaknesses:          []
 *   - decision_log:                []
 *
 * Files that already have all five fields are detected and skipped; running
 * the script twice on the same room produces byte-identical output. Atomic
 * write (openSync 'wx' tmp + fsync + rename) matches the Phase 87-02 pattern
 * so concurrent session-start invocations cannot corrupt the file.
 *
 * The narrative body and every pre-existing structural key are preserved
 * byte-for-byte; only the frontmatter YAML grows the five new lines.
 *
 * Usage:
 *   node scripts/migrate-minto-schema-v88.cjs <roomDir> [--dry-run]
 *   node scripts/migrate-minto-schema-v88.cjs --help
 *
 * Exit codes: 0 = success (zero or many files migrated), 1 = usage error,
 * 2 = runtime error (at least one file could not be migrated). Forward
 * wiring: Phase 88-05 session-start will invoke this at first run after
 * v1.10.13 rollout; see TODO marker below.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------- CLI ----------

const argv = process.argv.slice(2);

if (argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1) {
  process.stdout.write(
    'Usage: node scripts/migrate-minto-schema-v88.cjs <roomDir> [--dry-run]\n' +
      '\n' +
      'Backfills the five Phase 88 frontmatter fields on every MINTO.md under\n' +
      '<roomDir>. Idempotent: re-running produces byte-identical output. Files\n' +
      'that already carry all five fields are detected and skipped.\n' +
      '\n' +
      'Flags:\n' +
      '  --dry-run    List affected files; write nothing.\n' +
      '  --help, -h   Show this usage block.\n'
  );
  process.exit(0);
}

const DRY_RUN = argv.indexOf('--dry-run') !== -1;
const positional = argv.filter(function (a) {
  return !a.startsWith('--');
});

let ROOM_DIR;
if (positional.length >= 1) {
  ROOM_DIR = path.resolve(positional[0]);
} else {
  // Default: walk up from cwd looking for a .room-root sentinel (Phase
  // 87-01a walker pattern). Fall back to cwd if no sentinel is found.
  ROOM_DIR = findRoomRoot(process.cwd()) || process.cwd();
}

if (!fs.existsSync(ROOM_DIR) || !fs.statSync(ROOM_DIR).isDirectory()) {
  process.stderr.write(
    'ERROR: room dir does not exist or is not a directory: ' + ROOM_DIR + '\n'
  );
  process.exit(1);
}

// ---------- Helpers ----------

const V88_FIELDS = [
  'last_generated_at',
  'last_artifact_write_seen_at',
  'reasoning_health_score',
  'flagged_weaknesses',
  'decision_log',
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.mindrian',
  '.lazygraph',
  '.obsidian',
  '.mos-vault-cache',
]);

function findRoomRoot(start) {
  let dir = path.resolve(start);
  const fsRoot = path.parse(dir).root;
  while (dir && dir !== fsRoot) {
    if (fs.existsSync(path.join(dir, '.room-root'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function walkMintoFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && SKIP_DIRS.has(ent.name)) continue;
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile() && ent.name === 'MINTO.md') {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const fm = m[1];
  const body = raw.slice(m[0].length);
  return { fm: fm, body: body, full: m[0] };
}

function hasAllV88Fields(fmText) {
  // A line-prefix match (anchored at start of line) is sufficient: the
  // generator emits each field as a top-level YAML key. If any is absent,
  // the file needs migration.
  for (const f of V88_FIELDS) {
    const re = new RegExp('^' + f + ':', 'm');
    if (!re.test(fmText)) return false;
  }
  return true;
}

function buildBackfillLines() {
  // Sentinel zero timestamp flags the file as "never regenerated under v88"
  // so 88-13 guardian can enqueue a regen at next session-start.
  return [
    'last_generated_at: "1970-01-01T00:00:00Z"',
    'last_artifact_write_seen_at: null',
    'reasoning_health_score: null',
    'flagged_weaknesses: []',
    'decision_log: []',
  ];
}

function backfillFrontmatter(raw) {
  const parsed = parseFrontmatter(raw);
  if (!parsed) {
    throw new Error('no frontmatter delimiters');
  }
  const existingLines = parsed.fm.split(/\r?\n/);
  // Only add missing fields; leave existing values untouched.
  const present = new Set();
  for (const f of V88_FIELDS) {
    const re = new RegExp('^' + f + ':');
    for (const line of existingLines) {
      if (re.test(line)) {
        present.add(f);
        break;
      }
    }
  }
  const toAdd = buildBackfillLines().filter(function (line) {
    const key = line.split(':')[0];
    return !present.has(key);
  });
  if (toAdd.length === 0) return null; // nothing to do

  const newFm = existingLines.concat(toAdd).join('\n');
  return '---\n' + newFm + '\n---\n' + parsed.body;
}

function atomicWrite(targetPath, content) {
  const tmpPath = targetPath + '.v88-migrate.tmp';
  // Concurrency guard: openSync with 'wx' fails if tmp path already exists.
  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') {
      throw new Error(
        'concurrent migration detected (tmp exists): ' + tmpPath
      );
    }
    throw e;
  }
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    try {
      fs.closeSync(fd);
    } catch (_) {
      /* already closed */
    }
  }
  fs.renameSync(tmpPath, targetPath);
}

// ---------- Main ----------

function main() {
  const files = walkMintoFiles(ROOM_DIR);
  let scanned = 0;
  let migrated = 0;
  let alreadyV88 = 0;
  const errors = [];

  for (const f of files) {
    scanned += 1;
    let raw;
    try {
      raw = fs.readFileSync(f, 'utf8');
    } catch (e) {
      errors.push({ path: f, error: e.message });
      continue;
    }
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      errors.push({ path: f, error: 'no frontmatter' });
      continue;
    }
    if (hasAllV88Fields(parsed.fm)) {
      alreadyV88 += 1;
      process.stderr.write('already v88: ' + f + '\n');
      continue;
    }

    if (DRY_RUN) {
      process.stdout.write('would migrate: ' + f + '\n');
      migrated += 1;
      continue;
    }

    let next;
    try {
      next = backfillFrontmatter(raw);
    } catch (e) {
      errors.push({ path: f, error: e.message });
      continue;
    }
    if (next === null) {
      alreadyV88 += 1;
      continue;
    }
    try {
      atomicWrite(f, next);
      migrated += 1;
      process.stdout.write('migrated: ' + f + '\n');
    } catch (e) {
      errors.push({ path: f, error: e.message });
    }
  }

  // Report.
  const report = [
    '',
    'Scanned: ' + scanned + ' files',
    'Migrated: ' + migrated + ' files',
    'Already v88: ' + alreadyV88 + ' files',
    'Errors: ' + errors.length + ' files',
  ];
  if (errors.length > 0) {
    report.push('');
    for (const err of errors) {
      report.push('  ' + err.path + ' :: ' + err.error);
    }
  }
  process.stdout.write(report.join('\n') + '\n');

  // TODO(88-05): session-start will invoke this migration once per user on
  // first run after v1.10.13 to backfill pre-existing MINTO files.

  process.exit(errors.length === 0 ? 0 : 2);
}

main();
