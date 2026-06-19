'use strict';

/*
 * Phase 164 Wave 5 (Task 1) -- incremental per-step filing + crash-resume (D-164-S5).
 *
 * Asserts (164-05-PLAN Test 6):
 *   - each debate step journals via pipeline-state.cjs BEFORE the next runs (the
 *     SOLE chain-state truth, D-166-02), so the journal records each completed step
 *     in order with the chain initialized to the debate step sequence.
 *   - killing the chain at step 2 and resuming does NOT re-run step 1 (the
 *     checkPosition isNext HARD gate, B1 / D-166-02): a completed step's gate is
 *     'run' only when it is the next expected step, never a re-run of a past step.
 *   - provenanceFn stamps each step (the pipeline-state makeProvenanceFn idiom).
 *
 * Runs against a real tmp roomDir (real pipeline-state.json journaling) with an
 * injected runChainFn that drives onStep per step so the journal writes are real.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const dc = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'debate-composition.cjs'));
const pipelineState = require(path.join(REPO_ROOT, 'lib', 'mcp', 'pipeline-state.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-bono-incremental-filing (Wave 5 Task 1, Test 6)');

const HATS = ['White', 'Black'];
const CELLS = [
  { subdomain: 'sd1', hat: 'White', stance: 'supports', evidence: ['e'], confidence: 0.7 },
  { subdomain: 'sd1', hat: 'Black', stance: 'challenges', evidence: ['e'], confidence: 0.6 },
];

// A runChainFn that runs onStep for EVERY step (no gate halt) so the journal records
// the full sequence -- this isolates the incremental-filing behavior (the journal
// write rides onStep, BEFORE the next step's onStep runs).
function runAllStepsRunChain(steps, opts) {
  let prev = opts.seedPreviousOutput || null;
  const provStamps = [];
  for (const step of steps) {
    const result = opts.onStep(step, prev);
    if (typeof opts.provenanceFn === 'function') {
      const stamp = opts.provenanceFn(step, result);
      provStamps.push(stamp);
    }
    prev = result.chain_output;
  }
  // Expose the provenance stamps through a module-level capture.
  runAllStepsRunChain.__lastProvStamps = provStamps;
  return { trace: [], completed: true, haltedAt: null };
}

let tmp;
check('Test 6a -- each step journals via pipeline-state BEFORE the next runs', () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bono-debate-164-'));
  fs.writeFileSync(path.join(tmp, '.room-root'), JSON.stringify({ slug: 'debate-room' }));

  const res = dc.runDebate({
    cells: CELLS,
    hypothesis: 'what if',
    hats: HATS,
    roomDir: tmp,
    runChainFn: runAllStepsRunChain,
    runDerivationFn: function () { return { proposedNodes: [], edges: [], trace: [] }; },
  });
  assert.ok(res.journaled === true, 'the chain was journaled (initChain seeded the sole chain-state truth)');

  const state = pipelineState.read(tmp);
  assert.ok(state && Array.isArray(state.chain), 'pipeline-state.json carries the chain');
  // The chain is the full debate step sequence (hypothesis + per-hat + ruling + tension).
  const expected = dc.buildSteps(HATS).map((s) => s.command);
  assert.deepEqual(state.chain, expected, 'the journal chain IS the debate step sequence');
  // Every step was recorded in history (journaled BEFORE the next ran).
  const recordedTools = state.history.map((h) => h.tool);
  assert.deepEqual(recordedTools, expected, 'every step is journaled in order (recordStep before next)');
  // The cursor advanced through the whole chain (all steps completed in order).
  assert.equal(state.chain_position, expected.length - 1, 'the journal cursor advanced through every completed step');
});

check('Test 6b -- a crash-resume does NOT re-run a completed step (the isNext HARD gate)', () => {
  // Simulate a crash AFTER step 1 (hypothesis-confirm) completed: re-seed a fresh
  // journal then record only step 1, leaving the cursor at position 0.
  const expected = dc.buildSteps(HATS).map((s) => s.command);
  pipelineState.initChain(tmp, expected, 'bono-debate');
  pipelineState.recordStep(tmp, expected[0], 'chain-output:' + expected[0]);

  // The HARD gate: re-running the COMPLETED step 1 is withheld (not the next step);
  // the NEXT expected step (step 2) runs.
  const reRunStep1 = pipelineState.checkPosition(tmp, expected[0]);
  assert.equal(reRunStep1.gate, 'withhold', 'a completed step is withheld on resume (the isNext HARD gate prevents the re-run)');
  assert.equal(reRunStep1.reason, 'not_next', 'the withhold reason is not_next');

  const nextStep = pipelineState.checkPosition(tmp, expected[1]);
  assert.equal(nextStep.gate, 'run', 'the NEXT expected step is the resume re-entry point');
  assert.equal(nextStep.isNext, true, 'isNext is true for the next expected step only');
});

check('Test 6c -- provenanceFn stamps each step (the pipeline-state makeProvenanceFn idiom)', () => {
  const stamps = runAllStepsRunChain.__lastProvStamps || [];
  const expected = dc.buildSteps(HATS);
  assert.equal(stamps.length, expected.length, 'a provenance stamp was produced for every step');
  for (let i = 0; i < stamps.length; i += 1) {
    assert.ok(stamps[i] && typeof stamps[i] === 'object', 'each stamp is an object');
    assert.equal(stamps[i].pipeline, 'bono-debate', 'the stamp carries the debate chain name (generic, Part 8)');
    assert.equal(stamps[i].pipeline_stage, i, 'the stamp carries the stage index (generic, never the body)');
  }
});

// Cleanup.
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

console.log('\nPASS (' + pass + ' checks)');
