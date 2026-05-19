#!/usr/bin/env node
'use strict';

/*
 * Phase 127-01 Task 1 -- RED tests for lib/core/migration-snapshot.cjs
 *
 * 9 tests covering BRAIN-MCP-127-06 (SG-2 snapshot path helper) +
 * BRAIN-MCP-127-07 (SG-4 idempotency log + sha256 fingerprint + raw-identifier
 * scrub).
 *
 * Pure-module suite: zero network surface, zero process spawning, zero
 * external state writes outside hermetic os.tmpdir() fixtures (mkdtempSync +
 * rmSync recursive cleanup per Phase 87 pattern).
 *
 * Tests:
 *   1. fingerprintEntry returns 16 hex chars (sha256 truncated)
 *   2. fingerprintEntry distinguishes inputs by args[0]
 *   3. fingerprintEntry uses source-name "mindrian-brain:" prefix (TELEMETRY-121-02 pattern)
 *   4. snapshotPath replaces colons with dashes (Windows filesystem safety)
 *   5. readMigrationsLog returns [] when log file does not exist
 *   6. appendMigrationLog creates log with mode 0600 (POSIX) + subsequent read returns the record
 *   7. isAlreadyMigrated returns true after matching record appended, false for different fingerprint
 *   8. appendMigrationLog rejects a record containing Bearer-shaped string (SG-4 raw-identifier guard)
 *   9. appendMigrationLog rejects a record containing UUID-shaped value (SG-4 raw-identifier guard)
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const snap = require('./migration-snapshot.cjs');

function mkHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mig-snap-'));
}

function rmHome(h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (_) {}
}

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('PASS: ' + name);
  } catch (e) {
    fail++;
    console.error('FAIL: ' + name);
    console.error('  ' + (e && e.message ? e.message : String(e)));
    if (e && e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  }
}

// ---- Test 1: 16-hex-char fingerprint ----
t('T1 fingerprintEntry returns 16 hex chars', () => {
  const fp = snap.fingerprintEntry({ command: 'node', args: ['x'], env: { K: 'v' }, type: 'http' });
  assert.match(fp, /^[a-f0-9]{16}$/);
});

// ---- Test 2: distinguishes by args[0] + deterministic ----
t('T2 fingerprintEntry distinguishes by args[0] and is deterministic', () => {
  const a = { command: 'node', args: ['x'], env: {}, type: 'http' };
  const b = { command: 'node', args: ['y'], env: {}, type: 'http' };
  const fpA1 = snap.fingerprintEntry(a);
  const fpA2 = snap.fingerprintEntry(a);
  const fpB = snap.fingerprintEntry(b);
  assert.equal(fpA1, fpA2, 'identical inputs must produce identical outputs');
  assert.notEqual(fpA1, fpB, 'different args[0] must produce different fingerprints');
});

// ---- Test 3: source-name prefix ----
t('T3 fingerprintEntry uses source-name "mindrian-brain:" prefix per TELEMETRY-121-02', () => {
  const e = { command: 'node', args: ['x'], env: { K: 'v' }, type: 'http' };
  const expectedInput = 'mindrian-brain:' + JSON.stringify({ command: e.command, args: e.args, env: e.env, type: e.type });
  const expectedFp = crypto.createHash('sha256').update(expectedInput).digest('hex').slice(0, 16);
  assert.equal(snap.fingerprintEntry(e), expectedFp);
});

// ---- Test 4: snapshotPath colon replacement ----
t('T4 snapshotPath replaces colons with dashes for Windows filesystem safety', () => {
  const p = snap.snapshotPath('/tmp/home', '2026-05-19T20:30:00Z');
  assert.equal(p, path.join('/tmp/home', '.mindrian', 'pre-migration-snapshots', '2026-05-19T20-30-00Z.json'));
});

// ---- Test 5: readMigrationsLog graceful on missing ----
t('T5 readMigrationsLog returns [] when log file does not exist', () => {
  const h = mkHome();
  try {
    const r = snap.readMigrationsLog(h);
    assert.ok(Array.isArray(r));
    assert.equal(r.length, 0);
  } finally {
    rmHome(h);
  }
});

// ---- Test 6: appendMigrationLog creates log with mode 0600 + readback ----
t('T6 appendMigrationLog creates log with mode 0600 and round-trips via readMigrationsLog', () => {
  const h = mkHome();
  try {
    const rec = { ts: '2026-05-19T00:00:00Z', source: 'mindrian-brain', fingerprint: 'abc1234567890def', action: 'removed' };
    snap.appendMigrationLog(h, rec);
    const logPath = path.join(h, '.mindrian', 'migrations.jsonl');
    assert.ok(fs.existsSync(logPath), 'log file must exist after append');
    if (process.platform !== 'win32') {
      const mode = fs.statSync(logPath).mode & 0o777;
      assert.equal(mode, 0o600, 'log mode must be 0600 on POSIX, got 0' + mode.toString(8));
    }
    const rows = snap.readMigrationsLog(h);
    assert.ok(rows.length >= 1);
    const found = rows.find((r) => r.fingerprint === 'abc1234567890def');
    assert.ok(found, 'appended record must be readable');
    assert.equal(found.action, 'removed');
  } finally {
    rmHome(h);
  }
});

// ---- Test 7: isAlreadyMigrated ----
t('T7 isAlreadyMigrated returns true after matching record appended, false for different fingerprint', () => {
  const h = mkHome();
  try {
    const fp = 'abc1234567890def';
    snap.appendMigrationLog(h, { ts: '2026-05-19T00:00:00Z', source: 'mindrian-brain', fingerprint: fp, action: 'removed' });
    assert.equal(snap.isAlreadyMigrated(h, 'mindrian-brain', fp), true);
    assert.equal(snap.isAlreadyMigrated(h, 'mindrian-brain', '0000000000000000'), false);
  } finally {
    rmHome(h);
  }
});

// ---- Test 8: SG-4 raw-identifier guard rejects Bearer-shaped string ----
t('T8 appendMigrationLog rejects record containing Bearer-shaped string (SG-4 invariant)', () => {
  const h = mkHome();
  try {
    const badRec = {
      ts: '2026-05-19T00:00:00Z',
      source: 'mindrian-brain',
      fingerprint: 'abc1234567890def',
      action: 'removed',
      bearer: 'Bearer abcdefghijklmnopqrstuv',
    };
    assert.throws(() => snap.appendMigrationLog(h, badRec), /raw user identifier/);
  } finally {
    rmHome(h);
  }
});

// ---- Test 9: SG-4 raw-identifier guard rejects UUID-shaped value ----
t('T9 appendMigrationLog rejects record containing UUID-shaped value (SG-4 invariant)', () => {
  const h = mkHome();
  try {
    const badRec = {
      ts: '2026-05-19T00:00:00Z',
      source: 'mindrian-brain',
      fingerprint: 'abc1234567890def',
      action: 'removed',
      key: 'c859eb6d-1234-5678-9abc-def012345678',
    };
    assert.throws(() => snap.appendMigrationLog(h, badRec), /raw user identifier/);
  } finally {
    rmHome(h);
  }
});

console.log('');
console.log('==== RESULTS ====');
console.log('PASS: ' + pass);
console.log('FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
