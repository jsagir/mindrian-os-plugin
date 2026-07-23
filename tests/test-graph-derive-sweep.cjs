'use strict';
// Phase 169-05 (GDH-02 trigger / D-169-08 / MEDIUM-5) -- the enqueue-then-drain
// round-trip assertion.
//
// IFACE (169-01 shared_iface_contract): the Stop sweep hook
//   (scripts/gsd-graph-derive-sweep.cjs) ENQUEUES a derive request; the
//   SessionStart drain (scripts/gsd-graph-derive-drain.cjs, mirroring the SHIPPED
//   brain-derivation-drain.cjs) DRAINS it -- reads the queue, runs runDerivation,
//   and clears the entry.
//
// This proves the FULL round-trip (MEDIUM-5 / T-169-19), NOT merely that the
// hook file loads: a sweep-enqueued request is actually drained by the drain (the
// drain reads the entry, CALLS runDerivation via an injected spy, and CLEARS the
// queue entry). No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sweep = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs'));
const drain = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-drain.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-graph-derive-sweep (enqueue-then-drain round-trip)');

// A synthetic room with a `.room-root` sentinel.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-sweep-169-'));
const room = path.join(tmp, 'a-room');
fs.mkdirSync(room, { recursive: true });
fs.writeFileSync(path.join(room, '.room-root'), JSON.stringify({ slug: 'a-room' }));

check('the sweep ENQUEUES a derive request into the room-local queue file', () => {
  const res = sweep.enqueueDerive(room);
  assert.ok(res && res.ok, 'enqueueDerive must succeed');
  assert.ok(fs.existsSync(sweep.queuePath(room)), 'the queue file must be written');
  const q = sweep.readQueue(room);
  assert.equal(q.entries.length, 1, 'one entry must be enqueued');
  assert.equal(path.resolve(q.entries[0].roomDir), path.resolve(room), 'the entry must name the room');
});

check('the enqueue is idempotent (a second sweep does not duplicate the entry)', () => {
  sweep.enqueueDerive(room);
  const q = sweep.readQueue(room);
  assert.equal(q.entries.length, 1, 'a re-enqueue of the same room must not duplicate');
});

check('the drain READS the entry, CALLS runDerivation, and CLEARS the queue', () => {
  // Inject a spy runDerivation so the round-trip is asserted WITHOUT a real
  // composer (the drain must actually invoke it -- not merely load).
  const calledWith = [];
  function spyRunDerivation(argObj) {
    calledWith.push(argObj && argObj.roomDir);
    return { proposedNodes: [], edges: [] };
  }
  const res = drain.drainDerive(room, { deriveRunner: spyRunDerivation });
  assert.ok(res && res.ok, 'drainDerive must succeed');
  // The drain must have called runDerivation for the enqueued room.
  assert.ok(calledWith.some(r => path.resolve(r || '') === path.resolve(room)),
    'the drain must CALL runDerivation for the enqueued room (not merely load)');
  // The drained entry must be CLEARED.
  assert.ok(res.drained.some(r => path.resolve(r) === path.resolve(room)),
    'the drain must report the room as drained');
  const q = sweep.readQueue(room);
  assert.equal(q.entries.length, 0, 'the drained entry must be cleared from the queue');
});

check('a second drain on the cleared queue is a no-op (nothing left to derive)', () => {
  let calls = 0;
  function spy() { calls += 1; return { proposedNodes: [], edges: [] }; }
  drain.drainDerive(room, { deriveRunner: spy });
  assert.equal(calls, 0, 'an empty queue drains to a no-op (no runDerivation call)');
});

// --- RCA graph-derive-silent-clear Defect 4a: keep-on-failure + failure log. ---
// The old drain pushed a THROWN room to `drained` and cleared its queue entry
// silently, destroying the retry signal. These cases prove the fix: a failing
// derive KEEPS the entry, records result.failed, writes a failure log, retries
// on the next drain, and only drops after MAX_DERIVE_ATTEMPTS.

// A fresh room so the failure state does not bleed into the round-trip checks.
const failRoom = path.join(tmp, 'fail-room');
fs.mkdirSync(failRoom, { recursive: true });
fs.writeFileSync(path.join(failRoom, '.room-root'), JSON.stringify({ slug: 'fail-room' }));

check('a THROWING deriveRunner KEEPS the queue entry (retry signal survives)', () => {
  sweep.enqueueDerive(failRoom);
  const res = drain.drainDerive(failRoom, {
    deriveRunner() { throw new Error('boom: encoder cold-load failed'); },
  });
  assert.ok(res && res.ok, 'the drain still returns ok (soft-fail, never blocks)');
  assert.ok(Array.isArray(res.failed) && res.failed.some(r => path.resolve(r) === path.resolve(failRoom)),
    'the failed room must be reported in result.failed');
  const q = sweep.readQueue(failRoom);
  assert.equal(q.entries.length, 1, 'the failed entry must NOT be cleared (kept for retry)');
  assert.equal(q.entries[0].failures, 1, 'the kept entry carries a bumped failures counter');
});

check('the failure is written to the room-local failure log (never silent)', () => {
  const logPath = drain.failureLogPath(failRoom);
  assert.ok(fs.existsSync(logPath), 'the failure log file must exist');
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  assert.ok(log && Array.isArray(log.failures) && log.failures.length >= 1, 'the log carries a failure record');
  const rec = log.failures[log.failures.length - 1];
  assert.equal(rec.failures, 1, 'the record shows attempt 1');
  assert.equal(rec.permanent, false, 'attempt 1 is not permanent');
  assert.ok(typeof rec.error === 'string' && rec.error.includes('boom'), 'the record carries the (scalar) error');
});

check('a subsequent SUCCEEDING drain clears the kept entry (retry works)', () => {
  const res = drain.drainDerive(failRoom, {
    deriveRunner() { return { proposedNodes: [], edges: [] }; },
  });
  assert.ok(res && res.ok, 'the retry drain succeeds');
  const q = sweep.readQueue(failRoom);
  assert.equal(q.entries.length, 0, 'a successful retry clears the entry');
});

check('the retry cap drops a permanently-failing entry after MAX_DERIVE_ATTEMPTS', () => {
  const capRoom = path.join(tmp, 'cap-room');
  fs.mkdirSync(capRoom, { recursive: true });
  fs.writeFileSync(path.join(capRoom, '.room-root'), JSON.stringify({ slug: 'cap-room' }));
  // Seed an entry already at the last allowed attempt (MAX - 1). The next failing
  // drain reaches MAX and must DROP the entry with a permanent-failure record.
  const seeded = {
    roomDir: path.resolve(capRoom),
    enqueued_at: new Date().toISOString(),
    failures: drain.MAX_DERIVE_ATTEMPTS - 1,
  };
  sweep.writeQueue(capRoom, { entries: [seeded] });
  drain.drainDerive(capRoom, { deriveRunner() { throw new Error('still broken'); } });
  const q = sweep.readQueue(capRoom);
  assert.equal(q.entries.length, 0, 'a capped entry is dropped (no infinite retry)');
  const log = JSON.parse(fs.readFileSync(drain.failureLogPath(capRoom), 'utf8'));
  const rec = log.failures[log.failures.length - 1];
  assert.equal(rec.failures, drain.MAX_DERIVE_ATTEMPTS, 'the final record shows MAX_DERIVE_ATTEMPTS');
  assert.equal(rec.permanent, true, 'the final record is marked permanent');
});

console.log(`\nPASS (${pass}/${pass})`);
