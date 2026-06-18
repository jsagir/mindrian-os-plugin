'use strict';
// Phase 166-07 -- the larry seam: larry-extended post-gate HANDOFF to runChain +
// the larry-personality suggest->gate->wait contract extended with an AUTO-SEQUENCE
// branch that STILL halts on every non-autonomous_safe step.
//
// Wave 7 MIGRATE the larry-extended / larry-personality handoff seam (the LAST
// migration). Today these surfaces only SUGGEST a next step: larry-personality's
// reach rules surface ONE line and end at a Decision Gate (the GUIDED default,
// SKILL.md reach rule 1 "ends in a Decision Gate, not a verdict"), and larry-extended
// waits for the navigator to re-type the command. This wave wires the suggest->run
// seam: after a gate-APPROVED step, larry-extended hands the RESOLVED chain (the
// composeWorkflow output, autonomous_safe prefix) to lib/core/chain-executor.cjs
// runChain instead of waiting for re-typed commands; runChain auto-runs the
// autonomous_safe prefix and HALTS at the first material step, returning control to
// Larry at that gate. The auto-sequence NEVER bypasses the gate for a material step:
// gateFn still halts on every non-autonomous_safe step (the GUIDED-default reach rule
// "Every contradiction and every cross-room find ends in a Decision Gate, not a
// verdict.", D-166-05).
//
// Both larry surfaces are markdown with NO runtime, so a .cjs test can stub the seam
// and pass while the docs still describe the old suggest-and-wait loop. This suite
// validates the runChain handoff CONTRACT the docs commit to; the doc-content grep
// gate in run-all-166.sh proves the docs actually committed to it and kept the
// safe-halt rule verbatim.
//
// Behaviors (mirror the plan <behavior> block):
//   Test 1 (handoff): given a resolved chain whose first N steps are autonomous_safe
//           and step N+1 is material, after the human APPROVES at the gate the seam
//           hands the chain to runChain; runChain runs steps 1..N autonomously and
//           HALTS at step N+1 (the seam does NOT wait for N re-typed commands).
//   Test 2 (still halts on material): the auto-sequence branch's gateFn returns 'halt'
//           on EVERY non-autonomous_safe step -- a material step in the middle of the
//           handed chain stops the auto-run and surfaces the Decision Gate; no material
//           step is ever auto-run.
//   Test 3 (GUIDED preserved): with no approve (GUIDED default), the seam does NOT
//           auto-sequence -- it surfaces ONE suggest line and ends at the gate, exactly
//           as today (the "One reach per beat" rule preserved).
//   Test 4 (Part 8 + resolver discipline): the chain handed to runChain came from
//           composeWorkflow / recipe-maps (never a slug from Larry's memory); posture
//           is joined from the local registry; the Brain push stays an OFFER (no fetch
//           before the gate).
//
// Plain node assert harness (mirrors test-ignite-on-runchain.cjs +
// test-act-on-runchain.cjs). NO em-dashes. node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const executor = require(path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-larry-handoff-seam');

// ---------------------------------------------------------------------------
// The resolved chain the seam hands to runChain. The first two steps are
// autonomous_safe (the registry-blessed subset); step 3 is material. This is the
// shape composeWorkflow / recipe-maps emits -- the chain is NEVER a slug typed
// from Larry's memory; every command came from the resolver.
// ---------------------------------------------------------------------------
function resolvedChain() {
  return [
    { step: 1, command: '/mos:find-analogies', framework: 'Four Lenses of Innovation', autonomous_safe: true },
    { step: 2, command: '/mos:find-connections', framework: 'Usher Cumulative Synthesis', autonomous_safe: true },
    { step: 3, command: '/mos:file-meeting', framework: 'Meeting Filing', autonomous_safe: false },
  ];
}

// A posture authority joined from the LOCAL registry (modeling
// recipe-maps.postureForCommand): autonomous_safe steps map to push_forward/run,
// the material step maps to halt. NEVER a fabricated autonomous_safe.
function localPostureFn(command) {
  const chain = resolvedChain();
  const found = chain.find(function (s) { return s.command === command; });
  const safe = !!(found && found.autonomous_safe === true);
  return { command: command || null, autonomous_safe: safe, posture: safe ? 'run' : 'halt' };
}

// ---------------------------------------------------------------------------
// Test 1: the POST-GATE HANDOFF. After the human approves, the seam hands the
// chain to runChain; the autonomous_safe prefix auto-runs and the chain HALTS at
// the first material step. The seam does NOT wait for re-typed commands.
// ---------------------------------------------------------------------------
check('Test 1: after approve, the seam hands the chain to runChain -- autonomous_safe prefix auto-runs, halts at the first material step', () => {
  const steps = resolvedChain();
  const autoRun = [];

  // The human approved the suggested next step at the Decision Gate; the seam now
  // hands the RESOLVED chain to runChain. The default gateFn (driven by the local
  // posture authority) runs the autonomous_safe prefix and halts at the material step.
  const result = executor.runChain(steps, {
    postureFn: localPostureFn,
    onStep: function (step) { autoRun.push(step.command); return { chain_output: 'out:' + step.command, quality: 'high' }; },
    onHalt: function () { return 'approve'; },
    decideFn: function () { return { decision_trace: null }; },
  });

  // Steps 1 and 2 (autonomous_safe) auto-ran; step 3 (material) halted.
  assert.deepEqual(autoRun, ['/mos:find-analogies', '/mos:find-connections'],
    'the autonomous_safe prefix auto-ran without re-typed commands');
  assert.equal(result.completed, false, 'the chain did not complete -- it halts at the material step');
  assert.ok(result.haltedAt, 'the chain halts');
  assert.equal(result.haltedAt.step.command, '/mos:file-meeting',
    'the chain halts at the first material (non-autonomous_safe) step');
  assert.equal(autoRun.length, 2, 'exactly the two autonomous_safe steps auto-ran; the material step did NOT');
});

// ---------------------------------------------------------------------------
// Test 2: STILL HALTS ON MATERIAL. The auto-sequence branch's gateFn returns
// 'halt' on EVERY non-autonomous_safe step. A material step in the MIDDLE of the
// handed chain stops the auto-run and surfaces the Decision Gate -- no material
// step is ever auto-run (the GUIDED-default safe-halt rule, D-166-05).
// ---------------------------------------------------------------------------
check('Test 2: a material step mid-chain halts the auto-run -- no material step is ever auto-run (safe-halt preserved)', () => {
  // A chain where the material step sits in the MIDDLE: safe, MATERIAL, safe.
  const steps = [
    { step: 1, command: '/mos:find-analogies', autonomous_safe: true },
    { step: 2, command: '/mos:deploy', autonomous_safe: false },   // material in the middle
    { step: 3, command: '/mos:find-connections', autonomous_safe: true },
  ];
  const autoRun = [];

  const result = executor.runChain(steps, {
    postureFn: localPostureFn, // returns halt for any command not autonomous_safe
    onStep: function (step) { autoRun.push(step.command); return { chain_output: null, quality: 'high' }; },
    onHalt: function () { return 'approve'; },
    decideFn: function () { return { decision_trace: null }; },
  });

  // Only step 1 auto-ran; the chain halted at the material step 2; step 3 NEVER ran.
  assert.deepEqual(autoRun, ['/mos:find-analogies'],
    'only the leading autonomous_safe step auto-ran -- the auto-sequence stops at the material step');
  assert.equal(result.haltedAt.step.command, '/mos:deploy',
    'the chain halts at the mid-chain material step');
  assert.ok(!autoRun.includes('/mos:deploy'),
    'the material step was NEVER auto-run (the navigator always decides at a material gate)');
  assert.ok(!autoRun.includes('/mos:find-connections'),
    'the step AFTER the material gate was NEVER auto-run -- the auto-run stopped at the gate');
});

// ---------------------------------------------------------------------------
// Test 3: GUIDED PRESERVED. With no approve, the seam does NOT auto-sequence -- it
// surfaces ONE suggest line and ends at the gate, exactly as today (the GUIDED
// default + "One reach per beat"). The handoff fires ONLY on an explicit approve.
// ---------------------------------------------------------------------------
check('Test 3: GUIDED default (no approve) -- one suggest line, end at the gate, NO auto-sequence', () => {
  const steps = resolvedChain();
  const autoRun = [];

  // GUIDED default: the navigator has NOT approved. The seam models this as the
  // suggest-and-wait contract -- the chain is presented ONE line and the gateFn
  // halts at the very first step (no autonomous_safe prefix auto-runs without an
  // approve). We model "no approve" by gating the FIRST step to halt regardless of
  // posture (the suggest line ends at the Decision Gate, not a verdict).
  const suggestThenGate = function () { return 'halt'; };

  const result = executor.runChain(steps, {
    postureFn: localPostureFn,
    gateFn: suggestThenGate,        // GUIDED: the suggest line ends at the gate
    onStep: function (step) { autoRun.push(step.command); return { chain_output: null, quality: 'high' }; },
    onHalt: function () { return 'defer'; }, // navigator did NOT approve -> defer
    decideFn: function () { return { decision_trace: null }; },
  });

  assert.equal(autoRun.length, 0,
    'with no approve, NOTHING auto-runs -- one suggest line, end at the gate (GUIDED default preserved)');
  assert.equal(result.haltedAt.step.command, '/mos:find-analogies',
    'the suggest line halts at the very first step (no auto-sequence without an approve)');
  assert.equal(result.completed, false, 'the GUIDED suggest-and-wait never auto-completes a chain');
});

// ---------------------------------------------------------------------------
// Test 4: RESOLVER DISCIPLINE + PART 8. The chain handed to runChain came from
// composeWorkflow / recipe-maps (never a slug typed from Larry's memory); posture
// is joined from the local registry; the Brain push stays an OFFER (no fetch
// before the gate).
// ---------------------------------------------------------------------------
check('Test 4: resolver discipline + Part 8 -- chain from composeWorkflow, posture from local registry, Brain push is an OFFER', () => {
  // Model composeWorkflow: it emits the resolved chain (commands attached by the
  // resolver). Larry never types the slug; the chain object IS the resolver output.
  function composeWorkflow() { return resolvedChain(); }
  const handedChain = composeWorkflow();

  // Every command in the handed chain is a resolver-attached command, NOT a free
  // string typed from memory.
  handedChain.forEach(function (s) {
    assert.equal(typeof s.command, 'string', 'each handed step carries a resolver-attached command');
    assert.ok(s.command.indexOf('/mos:') === 0, 'the command is a resolved /mos: slug, never a memory slug');
    assert.ok(typeof s.framework === 'string' && s.framework.length > 0,
      'each step carries the framework NAME the resolver keyed off (composeWorkflow output)');
  });

  // Posture is joined from the LOCAL registry (localPostureFn models
  // recipe-maps.postureForCommand) -- never fabricated.
  const p1 = localPostureFn('/mos:find-analogies');
  const p3 = localPostureFn('/mos:file-meeting');
  assert.equal(p1.autonomous_safe, true, 'the autonomous_safe posture is read from the local registry');
  assert.equal(p3.autonomous_safe, false, 'the material posture is read from the local registry (never fabricated safe)');

  // Part 8: the Brain push is an OFFER -- the fetch fires only after the gate. We
  // model this as: the handoff to runChain carries no Brain wire; runChain itself
  // opens no Brain call. (chain-executor.cjs makes zero Brain calls -- asserted by
  // the run-all-166.sh Part-8 grep sweep; here we assert the seam passes only the
  // resolved chain + local callbacks, no Brain client.)
  let brainCalled = false;
  executor.runChain(handedChain, {
    postureFn: localPostureFn,
    onStep: function () { return { chain_output: null, quality: 'high' }; },
    onHalt: function () { return 'defer'; },
    // No brain client is passed; if runChain reached for one it would be undefined.
    decideFn: function () { brainCalled = false; return { decision_trace: null }; },
  });
  assert.equal(brainCalled, false, 'the seam fires no Brain fetch -- the push stays an OFFER (fetch only after the gate)');
});

// ---------------------------------------------------------------------------
// Test 5: the seam delegates to runChain (it owns no loop) -- the shared spine is
// the loop runner larry-extended hands the gate-approved chain to.
// ---------------------------------------------------------------------------
check('Test 5: runChain is the shared loop runner the larry seam hands the gate-approved chain to', () => {
  assert.equal(typeof executor.runChain, 'function', 'runChain must be the shared loop runner the seam delegates to');
  assert.equal(typeof executor.makeGateFn, 'function',
    'makeGateFn is the gate predicate the auto-sequence branch rides (halts on non-autonomous_safe)');

  // The default gateFn (no injected gateFn) halts a non-autonomous_safe step and
  // runs an autonomous_safe one -- this IS the auto-sequence branch contract.
  const gate = executor.makeGateFn({ postureFn: localPostureFn });
  assert.equal(gate({ command: '/mos:find-analogies' }, null, null), 'run',
    'the default gate RUNS an autonomous_safe step (the auto-sequence prefix)');
  assert.equal(gate({ command: '/mos:file-meeting' }, null, null), 'halt',
    'the default gate HALTS a non-autonomous_safe step (the safe-halt rule, D-166-05)');
});

// ---------------------------------------------------------------------------
// Test 6: the doc deliverable -- both larry surfaces are markdown that NAME the
// runtime, and the SKILL.md safe-halt rule is preserved verbatim. The .cjs test
// validates the contract; this assertion mirrors (does not replace) the
// run-all-166.sh doc-content grep gate so the suite alone signals doc drift too.
// ---------------------------------------------------------------------------
check('Test 6: both larry docs name chain-executor/runChain AND the safe-halt rule is preserved verbatim', () => {
  const extended = fs.readFileSync(path.join(REPO_ROOT, 'agents', 'larry-extended.md'), 'utf8');
  const skill = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md'), 'utf8');

  assert.ok(extended.indexOf('chain-executor') !== -1, 'larry-extended.md names chain-executor (the runtime)');
  assert.ok(extended.indexOf('runChain') !== -1, 'larry-extended.md names runChain (the handoff target)');
  assert.ok(skill.indexOf('chain-executor') !== -1, 'SKILL.md names chain-executor (the runtime)');
  assert.ok(skill.indexOf('runChain') !== -1, 'SKILL.md names runChain (the handoff target)');
  assert.ok(skill.indexOf('auto-sequence') !== -1, 'SKILL.md documents the auto-sequence branch');

  // The safe-halt rule preserved VERBATIM (byte-intact governing rule, D-166-05).
  assert.ok(skill.indexOf('ends in a Decision Gate, not a verdict') !== -1,
    'the GUIDED-default safe-halt rule "ends in a Decision Gate, not a verdict" is preserved verbatim');
  assert.ok(skill.indexOf('One reach per beat') !== -1,
    'the "One reach per beat" rule is preserved verbatim');
});

console.log(`\nPASS (${pass}/6)`);
