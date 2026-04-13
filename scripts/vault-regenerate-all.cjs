#!/usr/bin/env node
'use strict';

/**
 * MindrianOS Plugin -- vault-regenerate-all (Phase 81-04)
 *
 * Migration helper wired by the /mos:reason --regenerate-all slash command.
 *
 * Behavior:
 *  1. Walk every section of the active room that contains at least one
 *     artifact (the same set walkAllSections produces for the generator).
 *  2. Create a timestamped backup directory
 *       <roomDir>/.migration-backup/YYYY-MM-DD-HHMMSS/
 *     and copy every pre-existing MINTO.md into it, preserving the section
 *     sub-path relative to the room.
 *  3. Call runTier0 for each section so every section has a readable
 *     MINTO.md after the script returns. This is the belt-and-suspenders
 *     safety net: if the tier-1 loop (driven by the slash command in the
 *     same session) aborts midway, the user still has a valid file on disk.
 *  4. Write a report file
 *       <backup>/report.md
 *     with one row per section: name, old size, new size, tier, warnings.
 *
 * Pure CJS, zero new dependencies, node built-ins only.
 *
 * Usage:
 *   node scripts/vault-regenerate-all.cjs <roomDir>
 *
 * MINTO_FROZEN_DATE env var overrides the real clock for determinism
 * (used by the test suite and by any caller that wants a reproducible
 * backup directory name).
 */

const fs = require('fs');
const path = require('path');

const {
  scanRoom,
} = require('../lib/vault/room-scanner.cjs');
const {
  walkAllSections,
} = require('./vault-section-state-generator.cjs');
const {
  runTier0,
} = require('./vault-section-minto-generator.cjs');

function usage() {
  process.stderr.write(
    'Usage: node scripts/vault-regenerate-all.cjs <roomDir>\n'
  );
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function backupStamp() {
  const frozen = process.env.MINTO_FROZEN_DATE;
  if (frozen && /^\d{4}-\d{2}-\d{2}$/.test(frozen)) {
    // Deterministic stamp for tests: fixed date + fixed time-of-day.
    return frozen + '-000000';
  }
  const d = new Date();
  return (
    d.getUTCFullYear() +
    '-' +
    pad2(d.getUTCMonth() + 1) +
    '-' +
    pad2(d.getUTCDate()) +
    '-' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds())
  );
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyMintoBackup(roomDir, mintoPath, backupDir) {
  const rel = path.relative(roomDir, mintoPath);
  const target = path.join(backupDir, rel);
  ensureDir(path.dirname(target));
  fs.copyFileSync(mintoPath, target);
  return target;
}

function safeSize(p) {
  try {
    return fs.statSync(p).size;
  } catch (_e) {
    return 0;
  }
}

function regenerateAll(roomDir) {
  if (!roomDir || !fs.existsSync(roomDir)) {
    throw new Error('room directory not found: ' + String(roomDir));
  }
  const absRoom = path.resolve(roomDir);

  const stamp = backupStamp();
  const backupDir = path.join(absRoom, '.migration-backup', stamp);
  ensureDir(backupDir);

  const room = scanRoom(absRoom);
  const sections = walkAllSections(room).filter(function (s) {
    // Only sections that actually have at least one artifact are candidates.
    // Same filter runTier0 will apply internally via resolveSection.
    const anyArtifact = room.contentFiles.some(function (f) {
      return f && f.section === s.name;
    });
    return anyArtifact;
  });

  const rows = [];
  for (const section of sections) {
    const mintoPath = path.join(section.dir, 'MINTO.md');
    const oldSize = safeSize(mintoPath);
    let backedUpTo = null;
    if (oldSize > 0) {
      backedUpTo = copyMintoBackup(absRoom, mintoPath, backupDir);
    }

    let result;
    const warnings = [];
    try {
      result = runTier0({
        roomDir: absRoom,
        sectionName: section.name,
        dryRun: false,
      });
    } catch (err) {
      warnings.push('runTier0 failed: ' + (err && err.message ? err.message : String(err)));
      result = { tier: 'tier-0', path: mintoPath, size: 0, warnings: warnings };
    }

    const newSize = result && typeof result.size === 'number' ? result.size : safeSize(mintoPath);
    rows.push({
      section: section.name,
      sectionPath: path.relative(absRoom, section.dir),
      oldSize: oldSize,
      newSize: newSize,
      tier: (result && result.tier) || 'tier-0',
      backedUp: backedUpTo ? path.relative(absRoom, backedUpTo) : '(none)',
      warnings: warnings.concat((result && result.warnings) || []),
    });
  }

  // Write the report.
  const reportPath = path.join(backupDir, 'report.md');
  const lines = [];
  lines.push('# MINTO Regeneration Report');
  lines.push('');
  lines.push('Room: ' + absRoom);
  lines.push('Backup directory: ' + backupDir);
  lines.push('Timestamp: ' + stamp);
  lines.push('Sections processed: ' + rows.length);
  lines.push('');
  lines.push('| Section | Path | Old Size | New Size | Tier | Backup | Warnings |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const w = r.warnings.length ? r.warnings.join('; ') : '(none)';
    lines.push(
      '| ' + r.section +
      ' | ' + r.sectionPath +
      ' | ' + r.oldSize +
      ' | ' + r.newSize +
      ' | ' + r.tier +
      ' | ' + r.backedUp +
      ' | ' + w + ' |'
    );
  }
  lines.push('');
  lines.push('Notes: tier-0 pass is the safety net. The slash command /mos:reason');
  lines.push('--regenerate-all follows this with a tier-1 loop in the same Claude');
  lines.push('session that overwrites each MINTO.md with Feynman-MINTO narrative.');
  lines.push('');
  fs.writeFileSync(reportPath, lines.join('\n'));

  return { backupDir: backupDir, reportPath: reportPath, rows: rows };
}

function main() {
  const argv = process.argv.slice(2);
  const roomDir = argv.find(function (a) { return !a.startsWith('--'); });
  if (!roomDir) {
    usage();
    process.exit(2);
  }
  let summary;
  try {
    summary = regenerateAll(roomDir);
  } catch (err) {
    process.stderr.write('ERROR: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }
  process.stdout.write(
    'vault-regenerate-all: ' + summary.rows.length +
    ' section(s) regenerated, backup at ' + summary.backupDir + '\n'
  );
  process.stdout.write('report: ' + summary.reportPath + '\n');
  for (const r of summary.rows) {
    process.stdout.write(
      '  ' + r.section +
      ': ' + r.oldSize + ' -> ' + r.newSize + ' bytes, ' + r.tier + '\n'
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = { regenerateAll: regenerateAll, backupStamp: backupStamp };
