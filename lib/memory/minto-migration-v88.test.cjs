#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 88-00 Task 2 tests: idempotent migration of existing Feynman-MINTO
 * files to the v88 schema.
 *
 * Covers:
 *   Test 1: migration backfills five v88 fields with sentinel defaults
 *   Test 2: second migration run produces byte-identical output (idempotent)
 *   Test 3: narrative body unchanged across migration
 *   Test 4: existing structural keys (schema_version, governing_thought) unchanged
 *   Test 5: pre-migrated file with all v88 fields is detected + skipped
 *   Test 6: --dry-run lists but writes nothing (mtime stable)
 *
 * Node built-in assert + child_process for subprocess invocation so the
 * whole CLI surface is exercised end-to-end.
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATOR = path.join(REPO_ROOT, 'scripts', 'migrate-minto-schema-v88.cjs');

// Fixture workspace.
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'minto-migrate-v88-'));
process.on('exit', function cleanup() {
  try {
    fs.rmSync(WORK, { recursive: true, force: true });
  } catch (_) {
    /* best effort */
  }
});

function buildFixtureRoom(sectionFiles) {
  const root = fs.mkdtempSync(path.join(WORK, 'room-'));
  fs.writeFileSync(path.join(root, '.room-root'), '');
  for (const sf of sectionFiles) {
    const sdir = path.join(root, sf.section);
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, 'MINTO.md'), sf.content);
  }
  return root;
}

function sha256(filePath) {
  const raw = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function runMigrate(args) {
  const res = spawnSync(process.execPath, [MIGRATOR].concat(args), {
    encoding: 'utf-8',
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

const PHASE81_MINTO = [
  '---',
  'type: section-minto',
  'schema_version: "1"',
  'section: problem-definition',
  'created: 2026-04-14',
  'room: fx-room',
  'methodology: feynman-minto',
  'governing_thought: "Problem definition is the anchor for this venture."',
  'status: active',
  '---',
  '',
  '# Problem Definition -- Feynman-MINTO Reasoning',
  '',
  'Body content line one.',
  'Body content line two.',
  '',
].join('\n');

let pass = 0;
let fail = 0;

function t(name, fn) {
  try {
    fn();
    pass += 1;
    process.stdout.write('  OK ' + name + '\n');
  } catch (e) {
    fail += 1;
    process.stderr.write('  FAIL ' + name + ': ' + e.message + '\n');
    if (e.stack) {
      process.stderr.write(e.stack.split('\n').slice(0, 5).join('\n') + '\n');
    }
  }
}

// Test 1: backfill defaults
t('Test 1: backfills five v88 fields with sentinel defaults', function () {
  const room = buildFixtureRoom([
    { section: 'problem-definition', content: PHASE81_MINTO },
  ]);
  const res = runMigrate([room]);
  assert.strictEqual(res.status, 0, 'non-zero exit: ' + res.stderr);
  const after = fs.readFileSync(
    path.join(room, 'problem-definition', 'MINTO.md'),
    'utf-8'
  );
  assert.ok(
    /last_generated_at:\s*"1970-01-01T00:00:00Z"/.test(after),
    'missing last_generated_at sentinel; output:\n' + after
  );
  assert.ok(
    /last_artifact_write_seen_at:\s*null/.test(after),
    'missing last_artifact_write_seen_at null'
  );
  assert.ok(
    /reasoning_health_score:\s*null/.test(after),
    'missing reasoning_health_score null'
  );
  assert.ok(
    /flagged_weaknesses:\s*\[\]/.test(after),
    'missing flagged_weaknesses []'
  );
  assert.ok(
    /decision_log:\s*\[\]/.test(after),
    'missing decision_log []'
  );
});

// Test 2: idempotency
t('Test 2: second migration run produces byte-identical file', function () {
  const room = buildFixtureRoom([
    { section: 'market-analysis', content: PHASE81_MINTO.replace('problem-definition', 'market-analysis') },
  ]);
  const target = path.join(room, 'market-analysis', 'MINTO.md');
  let r = runMigrate([room]);
  assert.strictEqual(r.status, 0, 'first run failed: ' + r.stderr);
  const hash1 = sha256(target);
  r = runMigrate([room]);
  assert.strictEqual(r.status, 0, 'second run failed: ' + r.stderr);
  const hash2 = sha256(target);
  assert.strictEqual(hash1, hash2, 'second run changed bytes');
});

// Test 3: body unchanged
t('Test 3: narrative body unchanged across migration', function () {
  const room = buildFixtureRoom([
    { section: 'solution-design', content: PHASE81_MINTO.replace('problem-definition', 'solution-design') },
  ]);
  const target = path.join(room, 'solution-design', 'MINTO.md');
  const before = fs.readFileSync(target, 'utf-8');
  runMigrate([room]);
  const after = fs.readFileSync(target, 'utf-8');
  // Extract body after second --- delimiter.
  const extractBody = function (src) {
    const m = src.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    return m ? m[1] : null;
  };
  const bodyBefore = extractBody(before);
  const bodyAfter = extractBody(after);
  assert.ok(bodyBefore !== null, 'cannot locate body in before');
  assert.ok(bodyAfter !== null, 'cannot locate body in after');
  assert.strictEqual(
    bodyBefore,
    bodyAfter,
    'narrative body changed:\n--- before ---\n' +
      bodyBefore +
      '\n--- after ---\n' +
      bodyAfter
  );
});

// Test 4: existing structural keys unchanged
t('Test 4: existing structural keys preserved', function () {
  const room = buildFixtureRoom([
    { section: 'team', content: PHASE81_MINTO.replace('problem-definition', 'team') },
  ]);
  runMigrate([room]);
  const after = fs.readFileSync(
    path.join(room, 'team', 'MINTO.md'),
    'utf-8'
  );
  assert.ok(/schema_version:\s*"1"/.test(after), 'schema_version lost');
  assert.ok(
    /governing_thought:\s*"Problem definition is the anchor for this venture."/.test(
      after
    ),
    'governing_thought lost'
  );
  assert.ok(/section:\s*team/.test(after), 'section lost');
});

// Test 5: already-v88 file skipped
t('Test 5: already-v88 file detected as already v88 and skipped', function () {
  const alreadyV88 = [
    '---',
    'type: section-minto',
    'schema_version: "1"',
    'section: legal-ip',
    'created: 2026-04-14',
    'room: fx-room',
    'governing_thought: "Legal IP clarifies ownership."',
    'status: active',
    'last_generated_at: "2026-04-19T10:00:00Z"',
    'last_artifact_write_seen_at: null',
    'reasoning_health_score: null',
    'flagged_weaknesses: []',
    'decision_log: []',
    '---',
    '',
    '# body',
    '',
  ].join('\n');
  const room = buildFixtureRoom([
    { section: 'legal-ip', content: alreadyV88 },
  ]);
  const target = path.join(room, 'legal-ip', 'MINTO.md');
  const hashBefore = sha256(target);
  const res = runMigrate([room]);
  assert.strictEqual(res.status, 0, 'non-zero exit: ' + res.stderr);
  const combined = res.stdout + '\n' + res.stderr;
  assert.ok(
    /already v88/.test(combined),
    'no "already v88" message in output:\n' + combined
  );
  const hashAfter = sha256(target);
  assert.strictEqual(hashBefore, hashAfter, 'already-v88 file was rewritten');
});

// Test 6: --dry-run writes nothing
t('Test 6: --dry-run lists affected files but writes nothing', function () {
  const room = buildFixtureRoom([
    { section: 'financial-model', content: PHASE81_MINTO.replace('problem-definition', 'financial-model') },
  ]);
  const target = path.join(room, 'financial-model', 'MINTO.md');
  const hashBefore = sha256(target);
  const statBefore = fs.statSync(target);
  const res = runMigrate([room, '--dry-run']);
  assert.strictEqual(res.status, 0, 'non-zero exit: ' + res.stderr);
  const combined = res.stdout + '\n' + res.stderr;
  assert.ok(
    /financial-model/.test(combined),
    'dry-run did not report file in output:\n' + combined
  );
  const hashAfter = sha256(target);
  const statAfter = fs.statSync(target);
  assert.strictEqual(hashBefore, hashAfter, 'dry-run wrote bytes');
  assert.strictEqual(
    statBefore.mtimeMs,
    statAfter.mtimeMs,
    'dry-run changed mtime'
  );
});

process.stdout.write(
  '\nminto-migration-v88.test.cjs: ' + pass + ' passed, ' + fail + ' failed\n'
);
process.exit(fail === 0 ? 0 : 1);
