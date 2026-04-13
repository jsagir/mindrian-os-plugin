#!/usr/bin/env node
'use strict';

/**
 * Phase 81-04 test for scripts/vault-regenerate-all.cjs
 *
 * Copies the fixture-small room to a scratch directory, seeds a pre-81
 * MINTO.md, runs the regenerator, asserts:
 *   - backup directory exists with a timestamped name
 *   - pre-existing MINTO.md copied into the backup tree
 *   - new MINTO.md written in place
 *   - report.md exists, parses, contains per-section row with numeric
 *     old-size, numeric new-size, and tier label
 *   - no em-dashes (U+2014) anywhere in the regenerated MINTO.md
 *
 * Uses MINTO_FROZEN_DATE=2026-04-14 for deterministic stamp.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_SRC = path.join(
  REPO_ROOT,
  'test-fixtures',
  'feynman',
  'sections',
  'fixture-small'
);

const { regenerateAll } = require('./vault-regenerate-all.cjs');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function mkScratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-regen-test-'));
  copyDirSync(FIXTURE_SRC, dir);
  return dir;
}

const prior = process.env.MINTO_FROZEN_DATE;
process.env.MINTO_FROZEN_DATE = '2026-04-14';

const scratch = mkScratch();
try {
  // Seed a pre-81 MINTO.md into the problem-definition section so we have
  // something to back up.
  const sectionDir = path.join(scratch, 'problem-definition');
  assert.ok(fs.existsSync(sectionDir), 'fixture section must exist');
  const seededMinto = path.join(sectionDir, 'MINTO.md');
  const seedBody =
    '# SEEDED PRE-81 MINTO\n\nThis is the pre-migration body used as the backup fixture.\n';
  fs.writeFileSync(seededMinto, seedBody);
  const seedSize = fs.statSync(seededMinto).size;
  assert.ok(seedSize > 0, 'seeded MINTO must be non-empty');

  // Run the regenerator.
  const summary = regenerateAll(scratch);

  // Backup directory exists and has deterministic stamp.
  assert.ok(
    /\.migration-backup\/2026-04-14-000000$/.test(summary.backupDir),
    'backup dir stamp should be 2026-04-14-000000, got: ' + summary.backupDir
  );
  assert.ok(fs.existsSync(summary.backupDir), 'backup dir must exist on disk');

  // Backup must contain the original seeded MINTO.md.
  const backedUpMinto = path.join(
    summary.backupDir,
    'problem-definition',
    'MINTO.md'
  );
  assert.ok(fs.existsSync(backedUpMinto), 'backup must contain original MINTO.md');
  const backedUpBody = fs.readFileSync(backedUpMinto, 'utf-8');
  assert.equal(backedUpBody, seedBody, 'backup body must match seed');

  // A new MINTO.md must exist in the original section location.
  assert.ok(fs.existsSync(seededMinto), 'new MINTO.md must be written in place');
  const newBody = fs.readFileSync(seededMinto, 'utf-8');
  assert.notEqual(newBody, seedBody, 'new body must differ from seed');
  assert.ok(newBody.length > 0, 'new body must be non-empty');

  // No em-dashes in regenerated output.
  assert.equal(
    newBody.indexOf('\u2014'),
    -1,
    'new MINTO.md must contain zero em-dashes'
  );

  // Report file exists and parses.
  assert.ok(fs.existsSync(summary.reportPath), 'report.md must exist');
  const report = fs.readFileSync(summary.reportPath, 'utf-8');
  assert.ok(
    report.indexOf('MINTO Regeneration Report') !== -1,
    'report must have title'
  );
  assert.ok(
    report.indexOf('problem-definition') !== -1,
    'report must mention fixture section name'
  );
  // At least one row has numeric old and new sizes.
  const rowMatch = report.match(
    /\| problem-definition \|[^|]+\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(tier-[01])\s*\|/
  );
  assert.ok(rowMatch, 'report row must have numeric sizes and tier label');
  const reportedOld = Number(rowMatch[1]);
  const reportedNew = Number(rowMatch[2]);
  assert.equal(reportedOld, seedSize, 'report old size must match seed size');
  assert.ok(reportedNew > 0, 'report new size must be positive');

  // Summary rows sanity.
  assert.ok(summary.rows.length >= 1, 'at least one section processed');
  const pdRow = summary.rows.find(function (r) {
    return r.section === 'problem-definition';
  });
  assert.ok(pdRow, 'summary must contain problem-definition row');
  assert.equal(pdRow.tier, 'tier-0', 'tier must be tier-0');
  assert.equal(pdRow.oldSize, seedSize, 'summary old size must match seed');

  process.stdout.write('vault-regenerate-all.test.cjs: all assertions passed\n');
} finally {
  if (prior === undefined) delete process.env.MINTO_FROZEN_DATE;
  else process.env.MINTO_FROZEN_DATE = prior;
  // Leave scratch on failure for debugging; clean on success.
  try {
    fs.rmSync(scratch, { recursive: true, force: true });
  } catch (_e) {}
}
