'use strict';
// Phase 166-05 Task 2 -- the pipeline migration regression suite.
//
// The pipeline (commands/pipeline.md) becomes a runChain CONSUMER: it supplies a
// provenanceFn that stamps each stage artifact's pipeline frontmatter (the
// framework-runner contract at framework-runner.md:220), and it sources RESUME
// from pipeline-state.cjs ONLY (the SOLE chain-state truth, B1/D-166-02) with the
// commands/pipeline.md:78-114 artifact-frontmatter scan demoted to a SECONDARY
// confirming index.
//
// This wave ADDS makeProvenanceFn + reconcileResume to lib/mcp/pipeline-state.cjs,
// a module that shipped ZERO coverage (Task 1 captured its shipped behavior). The
// five behaviors:
//   Test 1: makeProvenanceFn stamps { pipeline, pipeline_stage } for a chain step;
//           a single-mode step (no chain) returns no pipeline fields.
//   Test 2: resume reads checkPosition (the Wave-1 isNext hard gate) as the SOLE
//           truth -- a completed stage withholds, the next stage authorizes.
//   Test 3: reconcileResume(roomDir) returns the pipeline-state position and treats
//           the frontmatter scan as a SECONDARY cross-check: agree -> return position;
//           disagree -> trust pipeline-state and flag the frontmatter stale (never reverse).
//   Test 4: an already-completed stage is NOT re-runnable through the gate.
//   Test 5 (no-drift): after the additive wiring, the Task-1 shipped-behavior suite
//           STILL exits zero -- the additive wiring drifted the shipped store NOTHING.
//
// NO em-dashes. node built-ins only; a tmp room dir per test.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ps = require(path.join(REPO_ROOT, 'lib', 'mcp', 'pipeline-state.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-on-runchain-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

console.log('test-pipeline-on-runchain');

// (1) makeProvenanceFn(chainName) -> (step, result) -> { pipeline, pipeline_stage }.
//     The stamp mirrors framework-runner.md:220 (pipeline + pipeline_stage). A
//     single-mode invocation (no chain name) returns NO pipeline fields -- act and
//     ignite pass null for exactly this reason.
check('makeProvenanceFn stamps { pipeline, pipeline_stage }; single-mode returns no fields', () => {
  assert.equal(typeof ps.makeProvenanceFn, 'function', 'makeProvenanceFn must be exported');
  const provenanceFn = ps.makeProvenanceFn('discovery');
  assert.equal(typeof provenanceFn, 'function', 'the factory returns a (step, result) stamp');
  const stamp = provenanceFn({ step: 2, command: '/mos:explore-domains' }, { chain_output: 'x', quality: 'high' });
  assert.equal(stamp.pipeline, 'discovery', 'the stamp carries the chain name');
  assert.equal(stamp.pipeline_stage, 2, 'the stamp carries the stage number from step.step');
  // The stamp is generic stage metadata ONLY (Part 8 T-166-18): no user content.
  assert.equal(Object.prototype.hasOwnProperty.call(stamp, 'chain_output'), false, 'no user content in the stamp');

  // Single-mode: no chain name -> no pipeline fields (null factory return).
  const singleMode = ps.makeProvenanceFn(null);
  assert.equal(singleMode, null, 'a single-mode (no chain) provenanceFn is null, exactly like act/ignite');
});

// (2) Resume reads checkPosition (the isNext hard gate) as the SOLE truth.
//     Stages a, b completed; checkPosition(b) withholds (already run),
//     checkPosition(c) authorizes (next) -- resume starts at c.
check('resume reads checkPosition as the sole truth: completed withholds, next authorizes', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    ps.recordStep(room, 'a', 'p/a.md');
    ps.recordStep(room, 'b', 'p/b.md');
    const completed = ps.checkPosition(room, 'b');
    assert.equal(completed.gate, 'withhold', 'a completed stage b is withheld');
    const next = ps.checkPosition(room, 'c');
    assert.equal(next.gate, 'run', 'the next stage c is authorized');
    assert.equal(next.isNext, true, 'c is the resume re-entry point');
  } finally {
    cleanup(room);
  }
});

// (3) reconcileResume(roomDir): pipeline-state is the SOLE truth; the frontmatter
//     scan is a SECONDARY confirming index. AGREE -> return position. DISAGREE ->
//     trust pipeline-state and flag the frontmatter stale (never the reverse).
check('reconcileResume agree-case: returns the pipeline-state position, frontmatter confirms', () => {
  const room = freshRoom();
  try {
    assert.equal(typeof ps.reconcileResume, 'function', 'reconcileResume must be exported');
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    ps.recordStep(room, 'a', 'p/a.md');
    ps.recordStep(room, 'b', 'p/b.md');
    // The secondary frontmatter scan AGREES (it also reports 2 stages done).
    const r = ps.reconcileResume(room, { frontmatterStagesComplete: 2 });
    assert.equal(r.source, ps.CHAIN_STATE_SOURCE, 'the sole-truth source is pipeline-state.json');
    assert.equal(r.position, 1, 'the pipeline-state chain_position (last completed) is 1');
    assert.equal(r.nextStage, 'c', 'resume re-enters at the next stage c');
    assert.equal(r.frontmatterStale, false, 'frontmatter agreed, it is not stale');
    assert.equal(r.agree, true, 'the two memories agree');
  } finally {
    cleanup(room);
  }
});

check('reconcileResume disagree-case: trusts pipeline-state, flags frontmatter STALE (never reverse)', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    ps.recordStep(room, 'a', 'p/a.md');
    ps.recordStep(room, 'b', 'p/b.md');
    // The secondary frontmatter scan DISAGREES (it claims only 1 stage done -- stale mirror).
    const r = ps.reconcileResume(room, { frontmatterStagesComplete: 1 });
    assert.equal(r.source, ps.CHAIN_STATE_SOURCE, 'the SOLE truth is still pipeline-state, never the scan');
    assert.equal(r.position, 1, 'the position comes from pipeline-state, NOT the stale frontmatter');
    assert.equal(r.nextStage, 'c', 'resume re-enters at c per the sole truth');
    assert.equal(r.frontmatterStale, true, 'the disagreeing frontmatter is flagged stale');
    assert.equal(r.agree, false, 'the two memories disagree; pipeline-state wins');
  } finally {
    cleanup(room);
  }
});

// (4) An already-completed stage is NOT re-runnable through the gate (no double-run
//     on resume). T-166-17.
check('a completed stage cannot re-run through the gate (no double-run)', () => {
  const room = freshRoom();
  try {
    ps.initChain(room, ['a', 'b', 'c'], 'local');
    ps.recordStep(room, 'a', 'p/a.md');
    const reRunA = ps.checkPosition(room, 'a');
    assert.equal(reRunA.gate, 'withhold', 'the hard gate withholds the already-run stage a');
    assert.equal(reRunA.isNext, false, 'a is not next; it already ran');
  } finally {
    cleanup(room);
  }
});

// (5) NO-DRIFT on the shipped store: after makeProvenanceFn + reconcileResume are
//     added, the Task-1 shipped-behavior suite STILL exits zero. The additive
//     wiring drifted the shipped store NOTHING (T-166-19).
check('Task-1 shipped-behavior suite STILL exits zero after the additive wiring (no drift)', () => {
  const shipped = path.join(__dirname, 'test-pipeline-state-shipped-behavior.cjs');
  assert.equal(fs.existsSync(shipped), true, 'the Task-1 shipped-behavior suite must exist');
  // Re-run the Task-1 suite as a child process; a non-zero exit throws here.
  execFileSync(process.execPath, [shipped], { stdio: 'ignore' });
});

console.log(`\nPASS (${pass}/6)`);
