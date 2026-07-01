'use strict';
/*
 * Phase 205-06 -- Pipelining (SCOPE-6). The SENS-10 exits COMPOSE, they are not a
 * menu. composeWorkflow(cause) builds an ordered chain from the recipe-maps
 * (recon prefix -> material gate -> TELL synthesis); every step's autonomous_safe
 * is SOURCED from the registry via postureForCommand (never fabricated, T-166-02 /
 * T-205-06-E); chain-executor.runChain auto-runs the leading autonomous_safe recon
 * steps and HALTS at the first material gate (bono), preserving the GUIDED safe-
 * halt (Reach rule 8 / Phase 166) -- the TELL synthesis never auto-runs before it.
 *
 * Task 1 (compose): four causes -> four ordered chains; each ends in a TELL
 * synthesis step; every recon-prefix step's autonomous_safe is sourced from
 * postureForCommand; a recipe command with no registry flag degrades to a halt
 * step; stuck_unlocated leads with find-bottlenecks, wrong_frame with
 * beautiful-question; no fabricated autonomous_safe literal in the recipe.
 *
 * Task 2 (execute): runChain on a SENS-10 chain auto-runs the safe recon prefix
 * and returns a halt at the first material (bono) gate; the TELL synthesis is NOT
 * auto-run; the forced-material always-halt is unchanged.
 *
 * House rule: hyphens only, no em-dashes. node built-ins only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const recipeMaps = require(path.join(REPO_ROOT, 'lib/core/recipe-maps.cjs'));
const composer = require(path.join(REPO_ROOT, 'lib/core/framework-chain-composer.cjs'));
const { runChain, makeGateFn } = require(path.join(REPO_ROOT, 'lib/core/chain-executor.cjs'));
const { CAUSES } = require(path.join(REPO_ROOT, 'lib/core/sensors/sensor-circularity.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok - ' + label);
}

console.log('test-205-pipelining');

const FOUR_CAUSES = ['answer_unheard', 'assertion_unvalidated', 'stuck_unlocated', 'wrong_frame'];
const TELL = '/mos:tell-synthesis';
const BONO = '/mos:bono';

// ---------------------------------------------------------------------------
// TASK 1 -- the exits COMPOSE (recon prefix -> material gate -> TELL synthesis).
// ---------------------------------------------------------------------------

// (1) The recipe keys MIRROR the sensor-circularity CAUSES enum (drift guard):
// the compose layer can never route a cause the sensor does not emit, and vice
// versa.
check('recipe keys equal the sensor-circularity CAUSES enum (no drift)', () => {
  const recipeKeys = Object.keys(recipeMaps.SENS10_CAUSE_RECIPES).sort();
  const sensorCauses = Object.values(CAUSES).sort();
  assert.deepEqual(recipeKeys, sensorCauses, 'recipe keys === sensor CAUSES values');
  assert.deepEqual(recipeKeys, FOUR_CAUSES.slice().sort(), 'exactly the four closed causes');
});

// (2) composeWorkflow(cause) returns an ordered chain for each of the four causes,
// each ENDING in a TELL synthesis step.
check('composeWorkflow returns an ordered chain per cause, each ending in a TELL synthesis step', () => {
  for (const cause of FOUR_CAUSES) {
    const chain = composer.composeWorkflow(cause);
    assert.ok(Array.isArray(chain) && chain.length >= 1, cause + ' composes a non-empty chain');
    // step numbering is 1..N in order
    chain.forEach((s, i) => assert.equal(s.step, i + 1, cause + ' step ' + (i + 1) + ' is ordered'));
    // ends in the TELL synthesis terminal
    assert.equal(chain[chain.length - 1].command, TELL, cause + ' ends in the TELL synthesis step');
  }
});

// (3) The chain for stuck_unlocated LEADS with find-bottlenecks; wrong_frame LEADS
// with beautiful-question (the SENS-02 reuse + the REFRAME lead, per the plan).
check('stuck_unlocated leads with find-bottlenecks; wrong_frame leads with beautiful-question', () => {
  const stuck = composer.composeWorkflow('stuck_unlocated');
  assert.equal(stuck[0].command, '/mos:find-bottlenecks', 'stuck_unlocated leads with find-bottlenecks');
  const frame = composer.composeWorkflow('wrong_frame');
  assert.equal(frame[0].command, '/mos:beautiful-question', 'wrong_frame leads with beautiful-question');
});

// (4) Every step's autonomous_safe is SOURCED from postureForCommand -- the
// compose layer never fabricates the flag (T-166-02 / T-205-06-E).
check('every step autonomous_safe is sourced from postureForCommand (never fabricated)', () => {
  for (const cause of FOUR_CAUSES) {
    const chain = composer.composeWorkflow(cause);
    for (const s of chain) {
      const authoritative = recipeMaps.postureForCommand(s.command);
      assert.equal(s.autonomous_safe, authoritative.autonomous_safe === true,
        cause + '/' + s.command + ' autonomous_safe matches the registry authority');
      assert.equal(s.posture, authoritative.posture,
        cause + '/' + s.command + ' posture matches the registry authority');
      // gate is the derived run/halt: a non-run posture is the material gate.
      assert.equal(s.gate, authoritative.posture !== 'run',
        cause + '/' + s.command + ' gate flag is derived from the sourced posture');
    }
  }
});

// (5) The recipe carries NO fabricated autonomous_safe literal -- recipeForCause
// returns bare command strings only (the flag lives in the registry, not here).
check('recipe entries are bare command strings; no fabricated autonomous_safe literal in the recipe', () => {
  for (const cause of FOUR_CAUSES) {
    const recipe = recipeMaps.recipeForCause(cause);
    assert.ok(Array.isArray(recipe) && recipe.length >= 1, cause + ' recipe is a non-empty array');
    for (const cmd of recipe) {
      assert.equal(typeof cmd, 'string', cause + ' recipe entry is a bare command string');
      assert.ok(cmd.indexOf('autonomous_safe') === -1, cause + ' recipe entry carries no autonomous_safe literal');
    }
  }
  // Source-level grep: the SENS10_CAUSE_RECIPES block has no autonomous_safe:true
  // fabrication (comment lines that mention the token do not count -- we scan the
  // recipe object literal's value lines, which are quoted command strings only).
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/recipe-maps.cjs'), 'utf8');
  const block = src.slice(src.indexOf('const SENS10_CAUSE_RECIPES'), src.indexOf('function recipeForCause'));
  assert.ok(block.indexOf('autonomous_safe:') === -1 && block.indexOf('autonomous_safe :') === -1,
    'the SENS10_CAUSE_RECIPES object literal fabricates no autonomous_safe key');
});

// (6) A recipe command with no registry autonomous_safe flag (the TELL synthesis
// handle) degrades to a HALT step (withhold-default), never a fabricated run.
check('the TELL synthesis handle degrades to a withhold-default halt step (never a fabricated run)', () => {
  const chain = composer.composeWorkflow('stuck_unlocated');
  const tell = chain[chain.length - 1];
  assert.equal(tell.command, TELL, 'terminal step is the TELL synthesis');
  assert.equal(tell.autonomous_safe, false, 'no registry flag -> not autonomous_safe');
  assert.equal(tell.posture, 'halt', 'withhold-default posture is halt');
  assert.equal(tell.gate, true, 'the TELL synthesis is a material gate step');
  // The bono material gate is likewise a halt (the first material gate).
  const bono = chain.find((s) => s.command === BONO);
  assert.ok(bono, 'the chain carries the bono material gate');
  assert.equal(bono.autonomous_safe, false, 'bono is not autonomous_safe (the material gate)');
  assert.equal(bono.posture, 'halt', 'bono halts (GUIDED safe-halt point)');
});

// ---------------------------------------------------------------------------
// TASK 2 -- runChain auto-runs the safe recon prefix and HALTS at the first
// material gate (GUIDED safe-halt preserved; TELL synthesis never auto-runs).
// ---------------------------------------------------------------------------

// (7) runChain on the stuck_unlocated SENS-10 chain auto-runs the leading
// autonomous_safe recon steps (find-bottlenecks, find-analogies) and HALTS at the
// first material gate (bono). The default postureFn (recipe-maps, real registry)
// drives the run/halt decision -- this is the SHIPPED Phase 166 spine unchanged.
check('runChain auto-runs the safe recon prefix and halts at the first material (bono) gate', () => {
  const chain = composer.composeWorkflow('stuck_unlocated');
  const dispatched = [];
  const res = runChain(chain, {
    decideFn: function () { return { decision_trace: {} }; },
    onStep: function (step) { dispatched.push(step.command); return { chain_output: 'out', quality: 'high' }; },
    onHalt: function () { return 'defer'; },
  });

  // the two autonomous_safe recon steps auto-ran, in order
  assert.deepEqual(dispatched, ['/mos:find-bottlenecks', '/mos:find-analogies'],
    'exactly the two safe recon steps auto-ran, in order');
  // the chain HALTED (GUIDED safe-halt), not completed
  assert.equal(res.completed, false, 'the chain halts at the material gate (not completed)');
  assert.ok(res.haltedAt, 'haltedAt is set');
  assert.equal(res.haltedAt.step.command, BONO, 'the halt is at the first material gate (bono)');
  assert.equal(res.haltedAt.reason, 'gate_halt', 'the halt reason is the posture gate_halt');
  // the trace carries only the two recon steps that ran
  assert.equal(res.trace.length, 2, 'only the two recon steps landed in the trace');
});

// (8) The TELL synthesis is NOT auto-run before the material halt (the halt gates
// it). Neither bono nor the TELL synthesis was ever dispatched.
check('the TELL synthesis is NOT auto-run before the material halt', () => {
  const chain = composer.composeWorkflow('wrong_frame');
  const dispatched = [];
  const res = runChain(chain, {
    decideFn: function () { return { decision_trace: {} }; },
    onStep: function (step) { dispatched.push(step.command); return { chain_output: 'out', quality: 'high' }; },
    onHalt: function () { return 'defer'; },
  });
  assert.ok(dispatched.indexOf(BONO) === -1, 'bono was never auto-run (it is the gate)');
  assert.ok(dispatched.indexOf(TELL) === -1, 'the TELL synthesis was never auto-run before the gate');
  // wrong_frame leads with beautiful-question then find-analogies (both safe).
  assert.deepEqual(dispatched, ['/mos:beautiful-question', '/mos:find-analogies'],
    'only the safe recon prefix auto-ran for wrong_frame');
  assert.equal(res.haltedAt.step.command, BONO, 'wrong_frame halts at the bono material gate');
});

// (9) answer_unheard is a SHORT TELL-synthesis chain: the synthesis is the
// terminal material delivery, so runChain HALTS immediately -- a material step
// never auto-runs without a halt (GUIDED default).
check('answer_unheard: the material TELL synthesis never auto-runs (halts at step 1)', () => {
  const chain = composer.composeWorkflow('answer_unheard');
  assert.deepEqual(chain.map((s) => s.command), [TELL], 'answer_unheard is a single TELL-synthesis step');
  const dispatched = [];
  const res = runChain(chain, {
    decideFn: function () { return { decision_trace: {} }; },
    onStep: function (step) { dispatched.push(step.command); return { chain_output: 'out', quality: 'high' }; },
    onHalt: function () { return 'defer'; },
  });
  assert.equal(dispatched.length, 0, 'the material TELL synthesis was never auto-run');
  assert.equal(res.completed, false, 'the chain halts at the material deliver');
  assert.equal(res.haltedAt.step.command, TELL, 'the halt is at the TELL synthesis');
});

// (10) The forced-material always-halt is UNCHANGED (a material / irreversible
// step never push-forwards, even when tagged autonomous_safe). This asserts the
// shipped Phase 166 gate is not weakened by the SENS-10 wiring.
check('the forced-material always-halt is unchanged (an irreversible step never push-forwards)', () => {
  // Tag EVERYTHING autonomous_safe so ONLY the irreversibility can force a halt.
  const alwaysSafe = function () { return { autonomous_safe: true, posture: 'run' }; };
  const gate = makeGateFn({ postureFn: alwaysSafe });
  const high = { quality: 'high' };
  assert.equal(gate({ step: 1, command: '/mos:anything', irreversible: true }, null, high), 'halt',
    'explicit irreversible step halts even when autonomous_safe');
  assert.equal(gate({ step: 2, command: '/mos:send-email' }, null, high), 'halt',
    'a send/email command is forced-material');
  assert.equal(gate({ step: 3, command: '/mos:deploy' }, null, high), 'halt',
    'a deploy command is forced-material');
  // control: a reversible autonomous_safe recon command still runs.
  assert.equal(gate({ step: 4, command: '/mos:find-bottlenecks' }, null, high), 'run',
    'a reversible autonomous_safe recon command runs');
});

console.log('');
console.log('PIPELINING_OK ' + pass + '/10');
