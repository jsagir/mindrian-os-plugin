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

console.log(`\nPASS (${pass}/4)`);
