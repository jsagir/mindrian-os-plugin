'use strict';
// Phase 166-05 Task 1 -- the FIRST-EVER coverage for lib/mcp/pipeline-state.cjs.
//
// pipeline-state.cjs ships UNTESTED (confirmed: tests/ carried no pipeline-state
// suite before this wave). Wave 5 ADDS new behavior (reconcileResume +
// makeProvenanceFn) to that zero-coverage module, so the additive wiring could
// silently reshape the shipped store with nothing to catch it. Therefore the
// module's FIRST test must capture its SHIPPED behavior -- the
// initChain / checkPosition / recordStep / chain_position / getPreviousOutput
// round-trip -- as a baseline BEFORE the new wiring lands.
//
// These assertions ARE the shipped contract. Task 2's migration suite re-runs
// them (Test 5) to prove PRE === POST: the additive wiring must drift NOTHING.
// Captured against the CURRENTLY SHIPPED store at:
//   initChain        pipeline-state.cjs:120-134 (initial chain_position = -1)
//   recordStep       pipeline-state.cjs:148-190 (advance + suggested_next logic)
//   checkPosition    pipeline-state.cjs:210-239 (the shipped return shape)
//   getPreviousOutput pipeline-state.cjs:248-252
//
// Mirrors the plain node:assert harness of tests/test-edges-domain-taxonomy-floor.cjs.
// NO em-dashes. node built-ins only; a tmp room dir per test, cleaned up after.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const ps = require(path.join(REPO_ROOT, 'lib', 'mcp', 'pipeline-state.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// A fresh tmp room dir per run; the state file lands at <room>/.mindrian/pipeline-state.json.
function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-state-shipped-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

console.log('test-pipeline-state-shipped-behavior');

// (1) initChain seeds chain_position = -1 and the ordered chain (pipeline-state.cjs:120-134).
check('initChain seeds chain_position = -1, chain preserved, suggested_next = first', () => {
  const room = freshRoom();
  try {
    const initState = ps.initChain(room, ['a', 'b', 'c'], 'local');
    assert.equal(initState.chain_position, -1, 'initial chain_position must be -1');
    assert.deepEqual(initState.chain, ['a', 'b', 'c'], 'chain must be preserved as given');
    assert.equal(initState.suggested_next, 'a', 'suggested_next must be the first tool');
    assert.equal(initState.chain_source, 'local', 'chain_source must round-trip');
    // The read-back from disk is identical (the store, not just the return).
    const onDisk = ps.read(room);
    assert.equal(onDisk.chain_position, -1, 'read-back chain_position must be -1');
    assert.deepEqual(onDisk.chain, ['a', 'b', 'c'], 'read-back chain must match');
  } finally {
    cleanup(room);
  }
});

// (2) checkPosition for the first tool returns the shipped run-gate shape
//     (pipeline-state.cjs:210-239).
check('checkPosition(a) before any step: inPipeline true, isNext true, gate run', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    const cp = ps.checkPosition(room, 'a');
    assert.equal(cp.inPipeline, true, 'a chain is active');
    assert.equal(cp.isNext, true, 'a is the next expected step');
    assert.equal(cp.gate, 'run', 'the hard gate authorizes a');
    assert.equal(cp.reason, null, 'no withhold reason when the gate runs');
    assert.equal(cp.expectedNext, 'a', 'expectedNext names a');
    assert.deepEqual(cp.chain, ['a', 'b', 'c'], 'the chain is surfaced');
    assert.equal(cp.previousOutput, null, 'no previous output before any step');
  } finally {
    cleanup(room);
  }
});

// (3) recordStep('a') advances chain_position to 0 and re-points suggested_next
//     to b (pipeline-state.cjs:148-190).
check('recordStep(a) advances chain_position 0, suggested_next b, history grows', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    const after = ps.recordStep(room, 'a', 'problem-definition/a.md');
    assert.equal(after.chain_position, 0, 'recording the matching next tool advances to 0');
    assert.equal(after.suggested_next, 'b', 'suggested_next advances to b');
    assert.equal(after.last_tool, 'a', 'last_tool is a');
    assert.equal(after.output_path, 'problem-definition/a.md', 'output_path is recorded');
    assert.equal(after.history.length, 1, 'history has one entry');
    assert.equal(after.history[0].tool, 'a', 'history entry names the tool');
    assert.equal(after.history[0].output_path, 'problem-definition/a.md', 'history entry carries the path');
  } finally {
    cleanup(room);
  }
});

// (4) After recordStep('a'): checkPosition(b) authorizes (isNext) and
//     checkPosition(a) withholds (already run). The isNext hard gate prevents a
//     completed stage from re-running.
check('after recordStep(a): checkPosition(b) gate run, checkPosition(a) gate withhold', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    ps.recordStep(room, 'a', 'problem-definition/a.md');
    const next = ps.checkPosition(room, 'b');
    assert.equal(next.isNext, true, 'b is now the next expected step');
    assert.equal(next.gate, 'run', 'the gate authorizes b');
    const done = ps.checkPosition(room, 'a');
    assert.equal(done.isNext, false, 'a already ran, it is not next');
    assert.equal(done.gate, 'withhold', 'the hard gate withholds the completed step a');
    assert.equal(done.reason, 'not_next', 'the withhold reason names not_next');
    assert.equal(done.expectedNext, 'b', 'the withhold names what should run instead');
  } finally {
    cleanup(room);
  }
});

// (5) getPreviousOutput round-trips the recorded output path (pipeline-state.cjs:248-252).
check('getPreviousOutput round-trips the last recorded output path', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    assert.equal(ps.getPreviousOutput(room), null, 'no previous output before any step');
    ps.recordStep(room, 'a', 'problem-definition/a.md');
    assert.equal(ps.getPreviousOutput(room), 'problem-definition/a.md', 'a output path round-trips');
    ps.recordStep(room, 'b', 'market-analysis/b.md');
    assert.equal(ps.getPreviousOutput(room), 'market-analysis/b.md', 'b output path round-trips');
  } finally {
    cleanup(room);
  }
});

// (6) The full walk: chain_position advances 0 -> 1 -> 2 across the three stages,
//     and a completed chain surfaces suggested_next null (pipeline complete).
check('full a->b->c walk: chain_position 0->1->2, then suggested_next null', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    assert.equal(ps.recordStep(room, 'a', 'p/a.md').chain_position, 0);
    assert.equal(ps.recordStep(room, 'b', 'p/b.md').chain_position, 1);
    const last = ps.recordStep(room, 'c', 'p/c.md');
    assert.equal(last.chain_position, 2, 'final stage advances chain_position to 2');
    assert.equal(last.suggested_next, null, 'no tool remains; suggested_next is null');
    const cp = ps.checkPosition(room, 'c');
    assert.equal(cp.isNext, false, 'c already ran; nothing is next');
    assert.equal(cp.gate, 'withhold', 'a completed chain withholds re-running c');
  } finally {
    cleanup(room);
  }
});

console.log(`\nPASS (${pass}/6)`);
