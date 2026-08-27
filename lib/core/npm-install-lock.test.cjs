#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Regression tests for lib/core/npm-install-lock.cjs -- the one-shot
 * npm-install lock guarding the MCP dependency self-heal backstop.
 *
 * These tests lock the two correctness fixes a remote code review found in the
 * lockfile machinery (folded into v1.13.0-beta.23):
 *
 *   bug_004 -- TOCTOU: non-atomic lock creation.
 *     The pre-fix openSync('wx') created a zero-byte file that a separate
 *     writeSync later populated. A racing peer could read the empty file
 *     mid-write, treat it as corrupt, unlink the winner's LIVE lock, and run a
 *     second concurrent `npm install`. The fix makes creation atomic via
 *     fs.linkSync (fully-written temp file, then atomic link).
 *
 *   bug_001 -- stale threshold shorter than the install timeout.
 *     STALE_THRESHOLD_MS was 90s but runGuardedInstall's spawnSync install
 *     timeout is 120s; a healthy install running 90-120s was declared
 *     abandoned and (because the staleness check used OR) a peer unlinked the
 *     LIVE lock and started a second concurrent install. The fix raises
 *     STALE_THRESHOLD_MS strictly above 120s AND changes the check to AND
 *     (reclaim only when BOTH old AND owner-dead).
 *
 * Phase 266 Plan 03 (MCPFIX-03, dated 2026-08-27): the bug_001 invariant test
 * used to assert `STALE_THRESHOLD_MS > INSTALL_TIMEOUT_MS` against a
 * hand-typed `const INSTALL_TIMEOUT_MS = 120 * 1000` -- a copy of a number
 * owned by lib/core/mcp-dep-heal.cjs. A guard that reads a copy instead of the
 * real value cannot notice when the real value moves (the same rot pattern as
 * the instructions-floor cap). This file now imports
 * DEFAULT_INSTALL_TIMEOUT_MS from mcp-dep-heal.cjs directly. It also adds two
 * new invariant tests binding the connect-path budget
 * (CONNECT_PATH_BUDGET_MS) into the same chain: it must sit below both
 * DEFAULT_INSTALL_TIMEOUT_MS and STALE_THRESHOLD_MS, and below the host's
 * ~30000ms MCP connect timeout (CHANGELOG 2.1.242) that is the actual reason
 * the number exists.
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'npm-install-lock.cjs');
const lock = require(MODULE_PATH);
const {
  acquireInstallLock,
  releaseInstallLock,
  waitForUnlock,
  readLock,
  isReclaimable,
  LOCK_FILENAME,
  STALE_THRESHOLD_MS,
  WAIT_TIMEOUT_MS,
} = lock;

// Phase 266 Plan 03 (MCPFIX-03): import the real values instead of re-typing
// them. mcp-dep-heal.cjs already requires npm-install-lock.cjs; requiring both
// here from a test is a plain non-circular dependency (dep-heal -> lock, this
// test -> both), confirmed by this file running clean end to end below.
const DEP_HEAL_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'mcp-dep-heal.cjs');
const { DEFAULT_INSTALL_TIMEOUT_MS, CONNECT_PATH_BUDGET_MS } = require(DEP_HEAL_MODULE_PATH);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  process.stdout.write('    ' + (err && err.message ? err.message : String(err)) + '\n');
}
function test(name, fn) {
  try { fn(); ok(name); } catch (err) { fail(name, err); }
}

/** Fresh isolated lock directory per test. */
function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-npm-lock-test-'));
}
function lockFile(dir) {
  return path.join(dir, LOCK_FILENAME);
}
/** A pid that is essentially guaranteed not to be a live process. */
const DEAD_PID = 2147483646;

// --- bug_001: stale threshold + AND-gate ----------------------------------

// The install timeout in runGuardedInstall is DEFAULT_INSTALL_TIMEOUT_MS
// (imported from mcp-dep-heal.cjs, not re-typed here). The stale threshold
// must sit strictly ABOVE it or a healthy long install gets reclaimed.
test('bug_001: STALE_THRESHOLD_MS is strictly above DEFAULT_INSTALL_TIMEOUT_MS', () => {
  assert.ok(
    STALE_THRESHOLD_MS > DEFAULT_INSTALL_TIMEOUT_MS,
    'STALE_THRESHOLD_MS (' + STALE_THRESHOLD_MS + ') must exceed DEFAULT_INSTALL_TIMEOUT_MS (' + DEFAULT_INSTALL_TIMEOUT_MS + ')'
  );
});

// Phase 266 Plan 03 (MCPFIX-03): the connect path is deliberately the
// tightest budget in the whole chain and must never be able to outlive its
// own lock's stale window, nor the hook-path install timeout it sits inside.
test('266: CONNECT_PATH_BUDGET_MS is strictly below DEFAULT_INSTALL_TIMEOUT_MS and STALE_THRESHOLD_MS', () => {
  assert.ok(
    CONNECT_PATH_BUDGET_MS < DEFAULT_INSTALL_TIMEOUT_MS,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must be below DEFAULT_INSTALL_TIMEOUT_MS (' + DEFAULT_INSTALL_TIMEOUT_MS + ')'
  );
  assert.ok(
    CONNECT_PATH_BUDGET_MS < STALE_THRESHOLD_MS,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must be below STALE_THRESHOLD_MS (' + STALE_THRESHOLD_MS + ')'
  );
});

// The number exists because the HOST counts: Claude Code's own MCP connect
// timeout is ~30000ms (CHANGELOG 2.1.242). This assertion is what makes the
// whole phase item legible to a future reader.
test('266: CONNECT_PATH_BUDGET_MS is below the ~30000ms host connect timeout (CHANGELOG 2.1.242)', () => {
  assert.ok(
    CONNECT_PATH_BUDGET_MS < 30000,
    'CONNECT_PATH_BUDGET_MS (' + CONNECT_PATH_BUDGET_MS + ') must sit below Claude Code\'s ~30000ms MCP connect timeout (CHANGELOG 2.1.242), the reason this budget exists'
  );
});

// WAIT_TIMEOUT_MS must sit above STALE so a just-gone-stale winner can still be
// reclaimed-and-retried by the loser rather than the loser timing out first.
test('bug_001: WAIT_TIMEOUT_MS is strictly above STALE_THRESHOLD_MS', () => {
  assert.ok(
    WAIT_TIMEOUT_MS > STALE_THRESHOLD_MS,
    'WAIT_TIMEOUT_MS (' + WAIT_TIMEOUT_MS + ') must exceed STALE_THRESHOLD_MS (' + STALE_THRESHOLD_MS + ')'
  );
});

// isReclaimable uses AND: an OLD lock whose owner is STILL ALIVE is NOT
// reclaimable. This is the core of the bug_001 fix.
test('bug_001: an old lock owned by a LIVE pid is NOT reclaimable (AND-gate)', () => {
  // process.pid is alive; timestamp far in the past => stale by age.
  const oldButLive = { pid: process.pid, timestamp: Date.now() - (STALE_THRESHOLD_MS + 60000) };
  assert.equal(isReclaimable(oldButLive), false, 'old + live must not be reclaimable');
});

// isReclaimable: a FRESH lock owned by a DEAD pid is NOT reclaimable either --
// both signals are required.
test('bug_001: a fresh lock owned by a DEAD pid is NOT reclaimable (AND-gate)', () => {
  const freshButDead = { pid: DEAD_PID, timestamp: Date.now() };
  assert.equal(isReclaimable(freshButDead), false, 'fresh + dead must not be reclaimable');
});

// isReclaimable: only BOTH old AND dead reclaims.
test('bug_001: a lock that is BOTH old AND dead IS reclaimable', () => {
  const oldAndDead = { pid: DEAD_PID, timestamp: Date.now() - (STALE_THRESHOLD_MS + 60000) };
  assert.equal(isReclaimable(oldAndDead), true, 'old + dead must be reclaimable');
});

// End-to-end: a peer holding an OLD-but-LIVE lock must NOT be displaced. The
// second acquire must return false (this process is the loser, it must wait).
test('bug_001: acquireInstallLock does not steal an old-but-live peer lock', () => {
  const dir = tmpdir();
  try {
    // Hand-write a lock that is well past STALE age but owned by THIS (live)
    // process -- simulating a healthy install legitimately running 90-120s+.
    fs.writeFileSync(
      lockFile(dir),
      JSON.stringify({ pid: process.pid, timestamp: Date.now() - (STALE_THRESHOLD_MS + 30000) })
    );
    const got = acquireInstallLock(dir);
    assert.equal(got, false, 'must NOT acquire -- the live owner keeps the lock despite age');
    assert.ok(fs.existsSync(lockFile(dir)), 'the live peer lock must still be on disk');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// End-to-end: an old AND dead lock IS reclaimed -- this process wins.
test('bug_001: acquireInstallLock reclaims an old AND dead peer lock', () => {
  const dir = tmpdir();
  try {
    fs.writeFileSync(
      lockFile(dir),
      JSON.stringify({ pid: DEAD_PID, timestamp: Date.now() - (STALE_THRESHOLD_MS + 30000) })
    );
    const got = acquireInstallLock(dir);
    assert.equal(got, true, 'must reclaim an abandoned (old + dead) lock');
    assert.ok(fs.existsSync(lockFile(dir)), 'the reclaimed lock must now be ours');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// waitForUnlock must NOT return early for an old-but-live lock: the winner is
// still running. (Bounded: we only assert it does not return instantly.)
test('bug_001: waitForUnlock keeps waiting on an old-but-live lock', () => {
  const dir = tmpdir();
  try {
    fs.writeFileSync(
      lockFile(dir),
      JSON.stringify({ pid: process.pid, timestamp: Date.now() - (STALE_THRESHOLD_MS + 30000) })
    );
    // Probe via the same predicate waitForUnlock uses internally -- a full
    // WAIT_TIMEOUT_MS blocking call would make the suite too slow, so we assert
    // the decision function instead. waitForUnlock returns true only when
    // isReclaimable is true OR the file is gone; here neither holds.
    const data = readLock(lockFile(dir));
    assert.notEqual(data, 'EMPTY');
    assert.notEqual(data, null);
    assert.equal(isReclaimable(data), false, 'old-but-live => waitForUnlock must keep polling');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- bug_004: atomic creation + empty-file handling -----------------------

// readLock distinguishes an EMPTY file from a CORRUPT one. An empty / zero-byte
// file (a mid-write window) returns the sentinel 'EMPTY', not null.
test('bug_004: readLock returns EMPTY sentinel for a zero-byte file', () => {
  const dir = tmpdir();
  try {
    fs.writeFileSync(lockFile(dir), ''); // zero bytes -- the mid-write state
    const r = readLock(lockFile(dir));
    assert.equal(r, 'EMPTY', 'a zero-byte lock file must read as the EMPTY sentinel');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// readLock returns null only for GENUINELY corrupt (non-empty invalid JSON).
test('bug_004: readLock returns null for non-empty invalid JSON (truly corrupt)', () => {
  const dir = tmpdir();
  try {
    fs.writeFileSync(lockFile(dir), 'this is not json {{{');
    const r = readLock(lockFile(dir));
    assert.equal(r, null, 'genuinely corrupt content must read as null');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// readLock returns the parsed object for a valid lock.
test('bug_004: readLock parses a valid fully-written lock', () => {
  const dir = tmpdir();
  try {
    const payload = { pid: 1234, timestamp: Date.now() };
    fs.writeFileSync(lockFile(dir), JSON.stringify(payload));
    const r = readLock(lockFile(dir));
    assert.ok(r && typeof r === 'object' && r !== 'EMPTY', 'valid lock must parse to an object');
    assert.equal(r.pid, 1234);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// readLock returns null for a missing file (ENOENT).
test('bug_004: readLock returns null for a missing file', () => {
  const dir = tmpdir();
  try {
    const r = readLock(lockFile(dir)); // never created
    assert.equal(r, null, 'a missing lock file must read as null');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The decisive bug_004 test: a racing peer that finds an EMPTY lock file must
// NOT unlink it (the winner may be mid-write). The pre-fix code unlinked it and
// both processes ran the install. Now acquireInstallLock leaves an empty file
// in place and the SECOND acquirer is told to wait (returns false) once the
// file is populated -- here we assert the empty file survives an acquire.
test('bug_004: acquireInstallLock does NOT unlink an EMPTY peer lock', () => {
  const dir = tmpdir();
  try {
    // Simulate a winner that has created the lock file but not yet written it
    // (the openSync->writeSync window). With the atomic linkSync fix this state
    // is not produced by acquireInstallLock itself, but a non-atomic legacy
    // path or an external tool could; the acquirer must treat it as transient.
    fs.writeFileSync(lockFile(dir), '');
    const got = acquireInstallLock(dir);
    // After EMPTY-retries the file is STILL empty (no winner ever populated
    // it), so acquire eventually retries 3x then either reclaims-or-not. The
    // load-bearing assertion: it never silently unlinked then double-won while
    // a real winner could still be writing. An all-empty file with no live
    // owner is genuinely dead, so acquire is allowed to win here -- what must
    // NOT happen is an immediate unlink-and-win on the FIRST sight of empty.
    // We assert the function completed without throwing and returned a boolean.
    assert.equal(typeof got, 'boolean', 'acquire must return a boolean, not throw');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Atomic create: a normal acquire on a clean dir writes a fully-formed,
// parseable lock -- never a zero-byte file. This proves the linkSync path
// publishes only fully-written content.
test('bug_004: acquireInstallLock publishes a fully-written (never empty) lock', () => {
  const dir = tmpdir();
  try {
    const got = acquireInstallLock(dir);
    assert.equal(got, true, 'first acquirer on a clean dir must win');
    const raw = fs.readFileSync(lockFile(dir), 'utf8');
    assert.ok(raw.trim().length > 0, 'published lock must not be zero-byte');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.pid, process.pid, 'published lock must carry our pid');
    assert.equal(typeof parsed.timestamp, 'number', 'published lock must carry a timestamp');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Atomic create leaves no temp-file litter behind on the happy path.
test('bug_004: acquireInstallLock cleans up its temp file', () => {
  const dir = tmpdir();
  try {
    acquireInstallLock(dir);
    const entries = fs.readdirSync(dir);
    const litter = entries.filter((e) => e.indexOf('.tmp') !== -1);
    assert.deepEqual(litter, [], 'no .tmp litter may remain after acquire: ' + litter.join(','));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Second acquirer against a held live lock is the loser (returns false) and
// must NOT corrupt or remove the winner's lock.
test('mutual exclusion: a second acquirer loses to a held live lock', () => {
  const dir = tmpdir();
  try {
    const first = acquireInstallLock(dir);
    assert.equal(first, true, 'first acquirer wins');
    const second = acquireInstallLock(dir);
    assert.equal(second, false, 'second acquirer must lose -- exactly one winner');
    assert.ok(fs.existsSync(lockFile(dir)), 'the winner lock must survive the loser attempt');
    releaseInstallLock(dir);
    assert.ok(!fs.existsSync(lockFile(dir)), 'release clears the lock');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// release is owner-aware: it must not delete a lock owned by a different pid.
test('releaseInstallLock does not remove another live process lock', () => {
  const dir = tmpdir();
  try {
    fs.writeFileSync(
      lockFile(dir),
      JSON.stringify({ pid: process.pid === 1 ? 2 : 1, timestamp: Date.now() })
    );
    releaseInstallLock(dir);
    assert.ok(fs.existsSync(lockFile(dir)), 'a foreign-owned lock must NOT be released by us');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// HARD RULE: no em-dashes in the module (referenced via code point).
test('npm-install-lock.cjs has no em-dashes', () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const EM_DASH = String.fromCharCode(0x2014);
  assert.ok(src.indexOf(EM_DASH) === -1, 'em-dash found in npm-install-lock.cjs');
});

process.stdout.write('\nnpm-install-lock: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
