#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-write-lock-ownership.cjs -- Phase 354-04 (SYS-02).
 *
 * Pins the P1 lock-ownership seam named in 354-CONTEXT.md (CTX-LOCK):
 * lib/core/write-lock.cjs's acquireLock deletes a lock by AGE before ever
 * checking whether its owner is alive, and releaseLock unlinks by path with
 * no ownership token at all. The two layers that disagree: lock AGE (the
 * recovery rule the old code used) versus owner LIVENESS (the actual truth
 * about whether a write is in flight, per docs/reviews/phase-354-probes/
 * persistence.cjs locks() -- the seed for cases A and E below, which seeds a
 * six-second-old lock owned by a live pid, then a non-owner release).
 *
 * Multi-process by design (child_process.fork, never an in-process fake):
 * PID liveness is an OS-level fact a mocked "concurrent" promise inside one
 * event loop cannot prove, the same rationale lib/memory/write-lock-atomic.
 * test.cjs already established for the 87-02 atomic-create fence this test
 * extends.
 *
 * RED-PROOF (against the pre-fix write-lock.cjs): case A fails because the
 * old code takes over any lock older than STALE_THRESHOLD_MS (5000ms)
 * regardless of the owning pid's liveness; case B fails for the same reason
 * against a real graph-ops-held lock past that threshold; case E fails
 * because the old releaseLock(roomDir) unlinks unconditionally, with no
 * token check, so a non-owner (or a stale-token) caller can remove a live
 * owner's lock.
 *
 * Plain-Node harness (tests/test-354-chain-resume-identity.cjs shape):
 * assert, a local ok(desc)/fail(desc, err) counter pair, a leading log of
 * the test name, a trailing PASS/FAIL line, process.exitCode = 1 on any
 * failure. No framework. Hyphens only, no em-dashes (CLAUDE.md).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const { acquireLock, releaseLock } = require(path.join(REPO, 'lib', 'core', 'write-lock.cjs'));

const HOLDER = path.join(__dirname, 'helpers', 'write-lock-holder-354.cjs');

console.log('test-354-write-lock-ownership');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}

function lockPathFor(room) {
  return path.join(room, '.mindrian', 'write.lock');
}

function readLockFile(room) {
  return JSON.parse(fs.readFileSync(lockPathFor(room), 'utf-8'));
}

function onceMessage(child) {
  return new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
  });
}

function onceExit(child) {
  return new Promise((resolve) => {
    child.once('exit', (code) => resolve(code));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------------
// Case A: live holder with an old timestamp. A real forked child acquires
// and holds the lock; its lock file's timestamp is then rewritten to look
// 60 seconds old (pid/token untouched). Age must never win over liveness --
// the parent's acquireLock must throw the held-by-PID error, and the lock
// file must still carry the child's pid afterward.
// -----------------------------------------------------------------------
async function testCaseA() {
  const { room, cleanup } = makeScratchRoom('lockownership-a');
  let child;
  try {
    child = fork(HOLDER, [room, 'hold', '4000']);
    const msg = await onceMessage(child);
    assert.ok(msg.acquired, 'child A acquired the lock');
    const childPid = msg.pid;

    const onDisk = readLockFile(room);
    onDisk.timestamp = Date.now() - 60000;
    fs.writeFileSync(lockPathFor(room), JSON.stringify(onDisk));

    let threw = null;
    try {
      acquireLock(room);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'parent acquireLock throws when a live foreign owner holds an old-timestamped lock');
    ok('Case A.1: acquireLock throws for a live foreign owner regardless of lock age');

    const pattern = new RegExp('SQLite write lock held by PID ' + childPid + '\\b');
    assert.ok(pattern.test(threw.message), 'error message names the live child pid: ' + threw.message);
    ok('Case A.2: error message names PID ' + childPid);

    const afterAttempt = readLockFile(room);
    assert.equal(afterAttempt.pid, childPid, 'lock file still carries the live child pid after the failed takeover attempt');
    ok('Case A.3: lock file pid unchanged after the failed takeover attempt');
  } finally {
    if (child) child.kill();
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case B: real long write. A real forked child holds the lock across an
// awaited operation through lib/core/graph-ops.cjs enqueueWrite (the exact
// hold-across-await pattern the fix must keep working) for 5600ms, longer
// than STALE_THRESHOLD_MS (5000ms). At 5300ms into that hold the parent's
// acquireLock must still throw held, never taking over on age alone.
// -----------------------------------------------------------------------
async function testCaseB() {
  const { room, cleanup } = makeScratchRoom('lockownership-b');
  let child;
  try {
    child = fork(HOLDER, [room, 'graph-ops', '5600']);
    const msg = await onceMessage(child);
    assert.ok(msg.acquired, 'graph-ops child acquired the lock via enqueueWrite');

    await sleep(5300);

    let threw = null;
    try {
      acquireLock(room);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'parent acquireLock still throws at 5300ms into a 5600ms graph-ops hold, past the 5000ms STALE_THRESHOLD_MS');
    ok('Case B.1: acquireLock throws for a live graph-ops holder past the stale-age threshold');

    assert.ok(/SQLite write lock held by PID/.test(threw.message), 'error message is the held-by-PID message, not a takeover: ' + threw.message);
    ok('Case B.2: error message reports held, not takeover');
  } finally {
    if (child) child.kill();
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case C: crashed owner. A real forked child acquires then exits without
// releasing (process.exit(0), no finally). Once it is confirmed dead, the
// parent's acquireLock must succeed (recover), and stderr must report the
// dead-owner recovery.
// -----------------------------------------------------------------------
async function testCaseC() {
  const { room, cleanup } = makeScratchRoom('lockownership-c');
  try {
    const child = fork(HOLDER, [room, 'crash', '0']);
    const msg = await onceMessage(child);
    assert.ok(msg.acquired, 'crash-mode child acquired the lock before exiting');
    await onceExit(child);

    const original = process.stderr.write.bind(process.stderr);
    let stderrBuf = '';
    process.stderr.write = function capturedWrite(chunk, encoding, cb) {
      stderrBuf += chunk.toString();
      return original(chunk, encoding, cb);
    };
    let handle;
    let threw = null;
    try {
      handle = acquireLock(room);
    } catch (e) {
      threw = e;
    } finally {
      process.stderr.write = original;
    }

    assert.equal(threw, null, 'parent acquireLock succeeds once the owning pid is confirmed dead: ' + (threw && threw.message));
    ok('Case C.1: acquireLock succeeds after the owning pid exits');

    assert.ok(stderrBuf.includes('Recovered write lock from dead owner'), 'stderr reports the dead-owner recovery: ' + stderrBuf);
    ok('Case C.2: stderr contains "Recovered write lock from dead owner"');

    releaseLock(room, handle);
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case D: recovery race. A seeded lock file owned by an already-exited
// process's pid; 10 real forked contenders race to acquireLock at once.
// Exactly one may recover and win; the rest must report the held error.
// -----------------------------------------------------------------------
async function testCaseD() {
  const { room, cleanup } = makeScratchRoom('lockownership-d');
  try {
    const seedChild = fork(HOLDER, [room, 'crash', '0']);
    const seedMsg = await onceMessage(seedChild);
    assert.ok(seedMsg.acquired, 'seed child acquired the lock before exiting (so its pid is on disk, then dies)');
    await onceExit(seedChild);
    assert.ok(fs.existsSync(lockPathFor(room)), 'seeded dead-owner lock file exists on disk before the race');

    const N = 10;
    const contenders = [];
    for (let i = 0; i < N; i++) {
      contenders.push(fork(HOLDER, [room, 'hold', '300']));
    }
    const outcomes = await Promise.all(contenders.map((child) => new Promise((resolve) => {
      let outcome = 'unknown';
      child.on('message', (m) => {
        if (m && m.acquired) outcome = 'success';
        if (m && m.error) outcome = 'held';
      });
      child.on('exit', (code) => resolve({ outcome, code }));
    })));

    const successes = outcomes.filter((o) => o.outcome === 'success').length;
    const named = outcomes.filter((o) => o.outcome === 'success' || o.outcome === 'held').length;

    assert.equal(successes, 1, 'exactly one of ' + N + ' racing contenders recovers the dead-owner lock, got ' + successes + ' (' + JSON.stringify(outcomes) + ')');
    ok('Case D.1: exactly 1 of ' + N + ' racing contenders recovers the dead-owner lock');

    assert.equal(named, N, 'every contender reports either success or the held error, got ' + JSON.stringify(outcomes));
    ok('Case D.2: all ' + N + ' contenders report success or the held error, no unexplained outcome');
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case E: old-owner release. The parent recovers a dead owner (A) and
// becomes the new owner (handle hB). Releasing with A's stale captured
// token must be a no-op (the lock file and its token stay hB's). A
// separate non-owner child process calling the legacy no-handle
// releaseLock() against the same lock must also be a no-op.
// -----------------------------------------------------------------------
async function testCaseE() {
  const { room, cleanup } = makeScratchRoom('lockownership-e');
  try {
    const childA = fork(HOLDER, [room, 'crash', '0']);
    const msgA = await onceMessage(childA);
    assert.ok(msgA.acquired, 'child A acquired the lock before exiting');
    const tokenA = msgA.lockFile && msgA.lockFile.token;
    await onceExit(childA);

    const handleB = acquireLock(room); // recovers dead A, parent becomes owner B
    ok('Case E.1: parent recovers the dead owner and becomes the new owner (B)');

    const beforeStaleRelease = readLockFile(room);

    releaseLock(room, { roomDir: room, token: tokenA });
    assert.ok(fs.existsSync(lockPathFor(room)), 'releasing with A\'s stale (old-owner) token leaves the lock file in place');
    ok('Case E.2: releaseLock with A\'s stale token is a no-op (file still exists)');

    const afterStaleRelease = readLockFile(room);
    assert.equal(afterStaleRelease.token, beforeStaleRelease.token, 'lock file token is unchanged (still B\'s) after the stale-token release attempt');
    ok('Case E.3: lock file token unchanged after the stale-token release attempt');

    const childC = fork(HOLDER, [room, 'release-without-acquire', '0']);
    const msgC = await onceMessage(childC);
    assert.ok(msgC.done, 'non-owner child C completed its release-without-acquire call');
    await onceExit(childC);

    assert.ok(fs.existsSync(lockPathFor(room)), 'a non-owner process release-without-acquire is a no-op, lock file still exists');
    ok('Case E.4: non-owner release-without-acquire leaves the lock file in place');

    const afterNonOwnerRelease = readLockFile(room);
    assert.equal(afterNonOwnerRelease.token, beforeStaleRelease.token, 'lock file token still unchanged after the non-owner child\'s release attempt');
    ok('Case E.5: lock file token still B\'s after the non-owner child\'s release attempt');

    releaseLock(room, handleB); // cleanup, owner B releasing its own lock
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case F: nesting. Two acquireLock calls in the SAME process on the SAME
// room must nest: releasing the inner handle leaves the file in place;
// releasing the outermost handle removes it.
// -----------------------------------------------------------------------
async function testCaseF() {
  const { room, cleanup } = makeScratchRoom('lockownership-f');
  try {
    const h1 = acquireLock(room);
    const h2 = acquireLock(room);

    releaseLock(room, h2);
    assert.ok(fs.existsSync(lockPathFor(room)), 'releasing the inner nested handle (h2) leaves the lock file in place');
    ok('Case F.1: nested release (h2) does not remove the lock file');

    releaseLock(room, h1);
    assert.ok(!fs.existsSync(lockPathFor(room)), 'releasing the outermost handle (h1) removes the lock file');
    ok('Case F.2: outermost release (h1) removes the lock file');
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case G: legacy floor. Same-process legacy callers that never touch a
// handle -- acquireLock(room) then releaseLock(room) with no argument --
// must keep working exactly as before.
// -----------------------------------------------------------------------
async function testCaseG() {
  const { room, cleanup } = makeScratchRoom('lockownership-g');
  try {
    acquireLock(room);
    assert.ok(fs.existsSync(lockPathFor(room)), 'legacy no-handle acquireLock(room) creates the lock file');
    ok('Case G.1: legacy no-handle acquireLock(room) creates the lock file');

    releaseLock(room);
    assert.ok(!fs.existsSync(lockPathFor(room)), 'legacy no-handle releaseLock(room) removes the lock file for the same-process owner');
    ok('Case G.2: legacy no-handle releaseLock(room) removes the lock file');
  } finally {
    cleanup();
  }
}

(async () => {
  try {
    await testCaseA();
  } catch (e) { fail('Case A: live holder with an old timestamp', e); }

  try {
    await testCaseB();
  } catch (e) { fail('Case B: real long write via graph-ops past the stale threshold', e); }

  try {
    await testCaseC();
  } catch (e) { fail('Case C: crashed owner is recovered', e); }

  try {
    await testCaseD();
  } catch (e) { fail('Case D: recovery race, exactly one winner', e); }

  try {
    await testCaseE();
  } catch (e) { fail('Case E: old-owner and non-owner release are no-ops', e); }

  try {
    await testCaseF();
  } catch (e) { fail('Case F: nesting in one process', e); }

  try {
    await testCaseG();
  } catch (e) { fail('Case G: legacy no-handle acquire/release floor', e); }

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})();
