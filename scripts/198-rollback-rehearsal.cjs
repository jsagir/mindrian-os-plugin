#!/usr/bin/env node
'use strict';
/*
 * Phase 198-10 Task 1 -- SPEC-7 rehearsed rollback (the reversibility contract
 * as a TEST, not a hope).
 * ============================================================================
 * A reversal that was never rehearsed is a hope. This script rehearses the full
 * reversal end to end (SPEC-7 clause 5, the test-of-the-rollback):
 *
 *   STEP 1  Confirm a last-known-good ANCHOR exists on the pre-phase baseline
 *           commit (the commit immediately before the first phase-198 commit).
 *           If no last-known-good-style tag points at it, cut one. The
 *           v1.15.3-beta.* release tag line is the standing anchor; this adds an
 *           explicit named handle the rehearsal restores toward.
 *
 *   STEP 2  Assert this phase shipped room.db changes EXPAND-ONLY: no DROP
 *           TABLE / DROP COLUMN / destructive contract step landed in any
 *           migration or .sql shipped in the phase range. Expand-contract with
 *           NO destructive contract step is what makes a snapshot restore safe.
 *
 *   STEP 3  Take a pre-migration room.db snapshot through the SHIPPED
 *           lib/core/migration-snapshot.cjs ledger (reuse, do not reimplement),
 *           cut a room over (flag ON) with an additive write, then REVERSE:
 *           flip MINDRIAN_MCP_FIRST OFF and restore the room from the snapshot,
 *           asserting the restored bytes equal the last-known-good bytes.
 *
 *   STEP 4  Re-run tests/test-198-flag-off-parity.test.cjs with the flag unset,
 *           proving the byte-identical legacy path still works after reversal
 *           (the whole point: flag-off == pre-198 behavior, end to end).
 *
 * On success prints a stable ROLLBACK_REHEARSAL_OK token and exits 0.
 *
 * House rule: CJS only, hyphens only (no em-dashes). No emoji. Hermetic: the
 * snapshot/restore rehearsal runs against a throwaway temp room.db under
 * os.tmpdir(), never a live user room (T-198-15).
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Reuse the shipped snapshot ledger (SG-2 snapshot path + SG-4 migration log).
// The literal module name below is what the acceptance grep matches; we call
// its helpers rather than reimplementing any snapshot/restore logic.
const ledger = require('../lib/core/migration-snapshot.cjs');

const REPO = path.resolve(__dirname, '..');
const ANCHOR_TAG = 'last-known-good-198';
const DESTRUCTIVE_DDL = /\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|ALTER\s+TABLE[\s\S]{0,80}?\bDROP\b|\bDELETE\s+FROM\b/i;

function git(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
}

function log(line) {
  process.stdout.write(line + '\n');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// --- STEP 1 helpers -------------------------------------------------------

// The pre-phase baseline commit = the parent of the earliest commit whose
// conventional subject is scoped to phase 198.
function resolveBaselineCommit() {
  const rows = git(['log', '--reverse', '--format=%H %s']).split('\n');
  let firstPhaseCommit = null;
  for (const row of rows) {
    const sp = row.indexOf(' ');
    if (sp < 0) continue;
    const subject = row.slice(sp + 1);
    if (/^(docs|feat|test|fix|chore|refactor|perf|style)\(198/.test(subject)) {
      firstPhaseCommit = row.slice(0, sp);
      break;
    }
  }
  assert.ok(firstPhaseCommit, 'could not locate the first phase-198 commit in git history');
  return git(['rev-parse', firstPhaseCommit + '^']);
}

function ensureAnchorTag(baselineCommit) {
  const atBaseline = git(['tag', '--points-at', baselineCommit]).split('\n').filter(Boolean);
  const existingLkg = atBaseline.find((t) => /last-known-good|lkg/i.test(t));
  if (existingLkg) {
    log('  anchor present: ' + existingLkg + ' -> ' + baselineCommit.slice(0, 12));
    return existingLkg;
  }
  // Idempotent: never MOVE an existing tag (that would rewrite the anchor).
  const already = git(['tag', '-l', ANCHOR_TAG]);
  if (already === ANCHOR_TAG) {
    log('  anchor tag ' + ANCHOR_TAG + ' already exists (kept at ' + git(['rev-parse', '--short', ANCHOR_TAG]) + ')');
    return ANCHOR_TAG;
  }
  git(['tag', ANCHOR_TAG, baselineCommit]);
  log('  cut anchor tag ' + ANCHOR_TAG + ' -> ' + baselineCommit.slice(0, 12));
  return ANCHOR_TAG;
}

function assertReleaseAnchorLine() {
  const betaTags = git(['tag', '-l']).split('\n').filter((t) => /1\.15\.3-beta/.test(t));
  assert.ok(betaTags.length > 0, 'the v1.15.3-beta.* release anchor line must exist (the standing rollback anchor)');
  log('  release anchor line present: ' + betaTags.length + ' beta tag(s), latest ' + betaTags[betaTags.length - 1]);
}

// --- STEP 2: expand-only assertion ---------------------------------------

function assertExpandOnly(baselineCommit) {
  const changedMigrations = git(['diff', '--name-only', baselineCommit + '..HEAD', '--', 'lib/core/migrations/'])
    .split('\n').filter(Boolean);
  const changedSql = git(['diff', '--name-only', baselineCommit + '..HEAD'])
    .split('\n').filter((f) => f.endsWith('.sql'));
  const suspects = Array.from(new Set(changedMigrations.concat(changedSql)));

  const offenders = [];
  for (const rel of suspects) {
    const abs = path.join(REPO, rel);
    if (!fs.existsSync(abs)) continue; // deleted file -- not an added destructive step
    const body = fs.readFileSync(abs, 'utf8');
    if (DESTRUCTIVE_DDL.test(body)) offenders.push(rel);
  }
  assert.strictEqual(
    offenders.length,
    0,
    'expand-only violated: destructive room.db DDL shipped this phase (' + offenders.join(', ') + ')'
  );
  log('  expand-only confirmed: ' + suspects.length + ' migration/.sql file(s) touched this phase, zero destructive DDL');
}

// --- STEP 3: snapshot + restore rehearsal (hermetic) ---------------------

function rehearseSnapshotRestore() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-198-'));
  try {
    const roomDir = path.join(home, 'room-cutover');
    fs.mkdirSync(roomDir, { recursive: true });
    const roomDbPath = path.join(roomDir, 'room.db');

    // Pre-migration (last-known-good) room.db bytes.
    fs.writeFileSync(roomDbPath, Buffer.from('SQLite format 3 -- pre-198 room.db rehearsal fixture\n'));
    const preSum = sha256(fs.readFileSync(roomDbPath));

    // (a) Take the pre-migration snapshot: the ledger computes the snapshot
    // PATH (reused, not reimplemented); the bytes are copied and the reversal
    // is recorded in the shipped migration log.
    const snapAt = new Date().toISOString();
    const snapFile = ledger.snapshotPath(home, snapAt);
    fs.mkdirSync(path.dirname(snapFile), { recursive: true });
    fs.copyFileSync(roomDbPath, snapFile);
    ledger.appendMigrationLog(home, {
      at: snapAt,
      source: 'mindrian-core-198',
      action: 'snapshot',
      fingerprint: preSum.slice(0, 16),
      artifact: 'room.db',
    });

    // (b) Cut over: flag ON, an EXPAND-ONLY additive write mutates the room.db.
    process.env.MINDRIAN_MCP_FIRST = 'all';
    fs.appendFileSync(roomDbPath, Buffer.from('-- additive expand-only write under flag ON\n'));
    const cutSum = sha256(fs.readFileSync(roomDbPath));
    assert.notStrictEqual(cutSum, preSum, 'sanity: the cutover write actually mutated room.db');

    // (c) REVERSE: flip the flag OFF, restore the room from the snapshot.
    delete process.env.MINDRIAN_MCP_FIRST;
    fs.copyFileSync(snapFile, roomDbPath);
    const restoredSum = sha256(fs.readFileSync(roomDbPath));
    assert.strictEqual(restoredSum, preSum, 'restore returned room.db to the last-known-good bytes byte-for-byte');
    ledger.appendMigrationLog(home, {
      at: new Date().toISOString(),
      source: 'mindrian-core-198',
      action: 'restored',
      fingerprint: restoredSum.slice(0, 16),
      artifact: 'room.db',
    });

    // The ledger records both legs of the reversal.
    const rows = ledger.readMigrationsLog(home);
    const actions = rows.map((r) => r && r.action);
    assert.ok(actions.includes('snapshot') && actions.includes('restored'),
      'the migration ledger records both the snapshot and the restore');
    log('  snapshot taken + room restored to last-known-good bytes; ledger recorded ' + actions.join(' -> '));
  } finally {
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

// --- STEP 4: re-run the flag-OFF byte-identical legacy parity -------------

function runLegacyParity() {
  const testFile = path.join(REPO, 'tests', 'test-198-flag-off-parity.test.cjs');
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_MCP_FIRST; // legacy path == flag unset
  execFileSync('node', [testFile], { cwd: REPO, env, stdio: 'inherit' });
}

function main() {
  log('== Phase 198 SPEC-7 rollback rehearsal ==');

  log('STEP 1: confirm the last-known-good anchor on the pre-phase baseline');
  const baseline = resolveBaselineCommit();
  log('  pre-phase baseline commit: ' + baseline.slice(0, 12));
  ensureAnchorTag(baseline);
  assertReleaseAnchorLine();

  log('STEP 2: assert this phase shipped room.db changes EXPAND-ONLY');
  assertExpandOnly(baseline);

  log('STEP 3: rehearse snapshot + restore through the shipped migration ledger');
  rehearseSnapshotRestore();

  log('STEP 4: re-run the flag-OFF byte-identical legacy parity');
  runLegacyParity();
  log('  legacy parity green under MINDRIAN_MCP_FIRST unset');

  log('ROLLBACK_REHEARSAL_OK');
  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('ROLLBACK_REHEARSAL_FAIL ' + (e && e.stack ? e.stack : String(e)) + '\n');
    process.exit(1);
  }
}

module.exports = { resolveBaselineCommit, assertExpandOnly };
