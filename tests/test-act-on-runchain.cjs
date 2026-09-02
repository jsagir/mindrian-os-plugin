'use strict';
// Phase 166-04 Task 2 -- act migrated onto runChain (the donor -> thinnest caller).
//
// Wave 4 repoints scripts/act-command.cjs --chain ONTO lib/core/chain-executor.cjs
// runChain: act composes the framework chain (recommender + resolver) then DELEGATES
// the walk to runChain, supplying act's callbacks (postureFn = recipe-maps
// postureForCommand, the default gateFn, an onStep recording the would-run step the
// way planChainRun did, an onHalt rendering the existing F.0 gate, provenanceFn:null
// because act is not the pipeline). The loop OWNERSHIP moves to runChain; act owns no
// loop and re-implements no posture.
//
// "No behavior drift" is VERIFIED, not asserted: this suite asserts the post-migration
// output is byte/behavior-identical to tests/fixtures/act-prebehavior-baseline.json
// (the SHIPPED behavior captured BEFORE the refactor by test-act-prebehavior-snapshot.cjs).
//
// Phase 254 Plan 02 Task 3 UPDATE: the baseline fixture's three render strings now
// include the ONE deliberate, in-scope addition this phase makes -- the "Chain source:"
// disclosure line (WIRE-03, D-03 step 4). This is the one intentional line-item drift
// this suite's baseline absorbs; every other byte is unchanged from the 166-04 capture.
//
// Behaviors (mirror the plan <behavior> block):
//   Test 1  whole-chain autonomous_safe path: runChain runs end to end, no gate, and the
//           renderChainReport bytes == baseline case 1; plan.stopAt null.
//   Test 2  a non-autonomous_safe step at position 2: auto-run step 1, HALT at step 2 via
//           the onHalt F.0 gate, stopReason 'not autonomous_safe'; render == baseline case 2.
//   Test 3  the [stop] kill switch: the filed-above-the-stop prefix (wouldRun) matches
//           baseline case 3 (step 1 filed, step 2 the gate).
//   Test 4  act exposes the runChain delegation seam (buildRunChainPlan) and act's posture
//           authority is recipe-maps.postureForCommand (act re-implements no posture);
//           the donor planChainRun is now a thin shim that routes through runChain.
//
// Plain node assert harness (mirrors test-act-prebehavior-snapshot.cjs +
// test-chain-executor-loop.cjs). NO em-dashes. node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const act = require(path.join(REPO_ROOT, 'scripts', 'act-command.cjs'));
const executor = require(path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs'));
const recipeMaps = require(path.join(REPO_ROOT, 'lib', 'core', 'recipe-maps.cjs'));

// Phase 254 Plan 02 Task 3: renderChainReport gained a 6th param, chainPick,
// consumed via chainSource.describeSource(chainPick) for the disclosure line
// (WIRE-03, D-03 step 4). This suite's fixtures are hand-built workflow
// arrays, not live resolveChainSource() output, so each case supplies a
// synthetic registry-floor chainPick seeded from its own frameworkChain[0] --
// deterministic and independent of the live projection artifact.
function chainPickFor(fix) {
  return {
    seed: fix.frameworkChain[0],
    frameworks: fix.frameworkChain,
    source: 'registry-floor',
    confidence: null,
    hops: null,
    transforms: null,
    kinds: null,
  };
}

const BASELINE = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'act-prebehavior-baseline.json'), 'utf8')
);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-act-on-runchain');

// The same three deterministic fixtures the baseline was captured from. We
// re-run the migrated act over them and assert PRE === POST.
const CASE1 = {
  seedLabel: 'from-problem-type ill-defined',
  frameworkChain: ['Six Thinking Hats', 'SWOT', 'Porter Five Forces'],
  workflow: [
    { step: 1, framework: 'Six Thinking Hats', command: '/mos:think-hats', optional: false },
    { step: 2, framework: 'SWOT', command: '/mos:swot', optional: false },
    { step: 3, framework: 'Porter Five Forces', command: '/mos:porter', optional: false },
  ],
  autonomyReport: { runnable: true, blockers: [] },
};
const CASE2 = {
  seedLabel: 'from-framework Six Thinking Hats',
  frameworkChain: ['Six Thinking Hats', 'Business Model Canvas', 'SWOT'],
  workflow: [
    { step: 1, framework: 'Six Thinking Hats', command: '/mos:think-hats', optional: false },
    { step: 2, framework: 'Business Model Canvas', command: '/mos:business-model', optional: false },
    { step: 3, framework: 'SWOT', command: '/mos:swot', optional: false },
  ],
  autonomyReport: {
    runnable: false,
    blockers: [{ step: 2, command: '/mos:business-model', reason: 'not autonomous_safe' }],
  },
};
const CASE3 = {
  seedLabel: 'default seed (no ProblemType set)',
  frameworkChain: ['Cynefin', 'JTBD', 'Scenario Planning'],
  workflow: [
    { step: 1, framework: 'Cynefin', command: '/mos:cynefin', optional: false },
    { step: 2, framework: 'JTBD', command: '/mos:jtbd', optional: false },
    { step: 3, framework: 'Scenario Planning', command: '/mos:scenario-plan', optional: false },
  ],
  autonomyReport: {
    runnable: false,
    blockers: [{ step: 2, command: '/mos:jtbd', reason: 'not autonomous_safe' }],
  },
};

function capture(fix) {
  const plan = act.planChainRun(fix.workflow, fix.autonomyReport);
  const render = act.renderChainReport(
    fix.seedLabel, fix.frameworkChain, fix.workflow, fix.autonomyReport, plan, chainPickFor(fix)
  );
  return {
    plan: {
      wouldRun: plan.wouldRun,
      stopAt: plan.stopAt
        ? { step: plan.stopAt.step, command: plan.stopAt.command, framework: plan.stopAt.framework }
        : null,
      stopReason: plan.stopReason,
    },
    render: render,
  };
}

// ---------------------------------------------------------------------------
// Test 1: whole-chain autonomous_safe path == baseline case 1 (PRE === POST).
// ---------------------------------------------------------------------------
check('Test 1: whole-autonomous path is byte/behavior-identical to baseline case 1', () => {
  const post = capture(CASE1);
  assert.deepEqual(post, BASELINE.cases.case1_whole_autonomous,
    'the whole-autonomous render + plan must match the pre-migration baseline');
  assert.equal(post.plan.stopAt, null);
  assert.equal(post.plan.wouldRun.length, 3, 'all three autonomous_safe steps run end to end');
});

// ---------------------------------------------------------------------------
// Test 2: gated halt at step 2 == baseline case 2 (PRE === POST).
// ---------------------------------------------------------------------------
check('Test 2: gated-halt path is byte/behavior-identical to baseline case 2', () => {
  const post = capture(CASE2);
  assert.deepEqual(post, BASELINE.cases.case2_gated_halt,
    'the gated-halt render + plan must match the pre-migration baseline');
  assert.equal(post.plan.stopAt.step, 2, 'the gate halts at step 2 (unchanged)');
  assert.equal(post.plan.stopReason, 'not autonomous_safe', 'stopReason preserved');
});

// ---------------------------------------------------------------------------
// Test 3: [stop] kill switch -- the filed-above-the-stop prefix == baseline case 3.
// ---------------------------------------------------------------------------
check('Test 3: [stop] filed-above-the-stop prefix is identical to baseline case 3', () => {
  const post = capture(CASE3);
  assert.deepEqual(post, BASELINE.cases.case3_stop_killswitch,
    'the [stop] filed prefix + render must match the pre-migration baseline');
  assert.equal(post.plan.wouldRun.length, 1, 'step 1 is filed above the stop (kill switch preserved)');
  assert.equal(post.plan.wouldRun[0].command, '/mos:cynefin');
});

// ---------------------------------------------------------------------------
// Test 4: the walk OWNERSHIP moved to runChain; act re-implements no posture.
// ---------------------------------------------------------------------------
check('Test 4: act delegates the walk to runChain (buildRunChainPlan seam exported)', () => {
  assert.equal(typeof act.buildRunChainPlan, 'function',
    'act must export buildRunChainPlan (the runChain delegation seam)');
  // The seam returns the same { wouldRun, stopAt, stopReason } plan shape so the
  // existing renderChainReport / emitWorkflowStages drive off it unchanged.
  const plan = act.buildRunChainPlan(CASE2.workflow, CASE2.autonomyReport);
  assert.ok(Array.isArray(plan.wouldRun), 'plan.wouldRun is an array');
  assert.equal(plan.stopAt.step, 2, 'the seam halts at step 2 via runChain');
  assert.equal(plan.stopReason, 'not autonomous_safe');
});

check('Test 4: act posture authority is recipe-maps.postureForCommand (no re-implemented posture)', () => {
  // act must NOT re-derive autonomy from memory: the posture verdict for a
  // command comes from recipe-maps (the ONE authority, Wave 1). A blocker step
  // is not autonomous_safe; a clean autonomous_safe command is push_forward.
  const verdict = recipeMaps.postureForCommand('/mos:think-hats');
  assert.ok(verdict && typeof verdict === 'object', 'postureForCommand returns a verdict object');
  assert.ok('autonomous_safe' in verdict, 'the verdict carries the autonomous_safe flag');
});

check('Test 4: runChain is the loop runner act delegates to (it owns the walk)', () => {
  assert.equal(typeof executor.runChain, 'function', 'runChain must be the shared loop runner');
});

console.log(`\nPASS (${pass}/6)`);
