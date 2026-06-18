'use strict';
// Phase 166-04 Task 1 -- act PRE-migration behavior snapshot (the drift net).
//
// act (scripts/act-command.cjs) was the DONOR the runChain spine was extracted
// from in Wave 2. Wave 4 repoints act ONTO runChain. act has NO pre-existing
// regression suite (confirmed: tests/ carries none), so "no behavior drift"
// cannot be claimed by fiat -- it must be VERIFIED by instrumentation. This
// suite captures the SHIPPED behavior FIRST, BEFORE Task 2 mutates act, as a
// committed baseline fixture. Task 2's test-act-on-runchain.cjs then asserts
// the post-runChain output is byte/behavior-identical to this baseline.
//
// What is captured over three deterministic fixtures (no Brain, no room I/O --
// the workflow + autonomyReport are constructed in-test so the capture is
// fully deterministic and re-runnable):
//   case 1  whole-chain-autonomous_safe  -> renderChainReport bytes
//           (the "Whole chain is autonomous_safe ..." render at
//            act-command.cjs:218-224) + plan.wouldRun.
//   case 2  a non-autonomous_safe step at position 2 -> the gated-halt render
//           (the F.0 gate block + plan.stopAt + plan.stopReason
//            'not autonomous_safe' at act-command.cjs:142) bytes + plan.
//   case 3  the [stop]/kill-switch path outcome -> what is recorded as "filed"
//           above the stop (the wouldRun prefix that survives the halt).
//
// Idempotent: if tests/fixtures/act-prebehavior-baseline.json does not exist,
// WRITE it (the pre-migration record). If it exists, ASSERT the shipped
// behavior still matches it. NO em-dashes. Mirrors the plain node assert
// harness of tests/test-edges-domain-taxonomy-floor.cjs.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'act-prebehavior-baseline.json');

// Require the SHIPPED donor (BEFORE Task 2's refactor). We exercise its pure
// exported functions -- planChainRun (act-command.cjs:131-147) and
// renderChainReport (act-command.cjs:151-226) -- which carry the user-visible
// behavior the migration must preserve.
const act = require(path.join(REPO_ROOT, 'scripts', 'act-command.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-act-prebehavior-snapshot');

// ---------------------------------------------------------------------------
// Deterministic fixtures. Each is a { seedLabel, frameworkChain, workflow,
// autonomyReport } tuple constructed in-test (no registry read, no Brain, no
// room) so the capture is byte-stable across machines and runs.
// ---------------------------------------------------------------------------

// Case 1: whole chain autonomous_safe (no blockers -> runnable, stopAt null).
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

// Case 2: a non-autonomous_safe step at position 2 (the gate halts there).
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

// Case 3: the [stop]/kill-switch path. The chain gates at step 2 (a blocker);
// the prefix above the stop (step 1) is what is "filed" when the user picks
// [stop]. We reuse the same shape as case 2 but isolate the "filed above the
// stop" outcome -- the wouldRun prefix that survives a halt/stop.
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

// ---------------------------------------------------------------------------
// Capture the SHIPPED behavior for a fixture: plan (planChainRun) + render
// (renderChainReport) bytes. This is the function the migration must preserve.
// ---------------------------------------------------------------------------
function capture(fix) {
  const plan = act.planChainRun(fix.workflow, fix.autonomyReport);
  const render = act.renderChainReport(
    fix.seedLabel, fix.frameworkChain, fix.workflow, fix.autonomyReport, plan
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

const live = {
  case1_whole_autonomous: capture(CASE1),
  case2_gated_halt: capture(CASE2),
  case3_stop_killswitch: capture(CASE3),
};

// ---------------------------------------------------------------------------
// Behavior sanity (these must hold for the SHIPPED act regardless of the
// fixture file -- they prove the capture is meaningful before it is frozen).
// ---------------------------------------------------------------------------
check('case 1 is whole-chain autonomous_safe (stopAt null, 3 steps would run)', () => {
  const c = live.case1_whole_autonomous;
  assert.equal(c.plan.stopAt, null, 'stopAt must be null for a whole-autonomous chain');
  assert.equal(c.plan.stopReason, null);
  assert.equal(c.plan.wouldRun.length, 3, 'all three steps would run');
  assert.ok(c.render.indexOf('Whole chain is autonomous_safe') !== -1,
    'the autonomous render line must be present');
});

check('case 2 halts at step 2 with stopReason "not autonomous_safe"', () => {
  const c = live.case2_gated_halt;
  assert.ok(c.plan.stopAt, 'stopAt must be set for a gated chain');
  assert.equal(c.plan.stopAt.step, 2, 'the gate halts at step 2');
  assert.equal(c.plan.stopReason, 'not autonomous_safe');
  assert.equal(c.plan.wouldRun.length, 1, 'only step 1 is greenlit above the gate');
  assert.ok(c.render.indexOf('[GATE]') !== -1 || c.render.indexOf('GATE') !== -1,
    'the gate render must carry a GATE marker');
});

check('case 3 [stop] outcome: step 1 is filed above the stop, step 2 is the gate', () => {
  const c = live.case3_stop_killswitch;
  assert.ok(c.plan.stopAt, 'stopAt must be set');
  assert.equal(c.plan.stopAt.step, 2, 'the chain gates at step 2');
  // "filed above the stop" == the wouldRun prefix that survives a [stop].
  assert.equal(c.plan.wouldRun.length, 1, 'step 1 is the filed prefix');
  assert.equal(c.plan.wouldRun[0].step, 1);
  assert.equal(c.plan.wouldRun[0].command, '/mos:cynefin');
});

// ---------------------------------------------------------------------------
// Idempotent baseline: WRITE on first run, ASSERT identity thereafter.
// ---------------------------------------------------------------------------
if (!fs.existsSync(FIXTURE_PATH)) {
  const baseline = {
    _meta: {
      phase: '166-04',
      task: 'Task 1 -- pre-migration behavior capture (the drift net)',
      captured_from: 'scripts/act-command.cjs (SHIPPED, pre-Wave-4-refactor)',
      functions: ['planChainRun (act-command.cjs:131-147)', 'renderChainReport (act-command.cjs:151-226)'],
      note: 'PRE === POST is asserted by tests/test-act-on-runchain.cjs after the migration.',
    },
    cases: live,
  };
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  check('baseline fixture WRITTEN (first run -- pre-migration record)', () => {
    assert.ok(fs.existsSync(FIXTURE_PATH), 'the baseline fixture must exist after write');
  });
} else {
  const baseline = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  check('baseline fixture matches the SHIPPED act behavior (idempotent assert)', () => {
    assert.deepEqual(live, baseline.cases,
      'the SHIPPED act behavior drifted from the committed pre-migration baseline');
  });
}

console.log(`\nPASS (${pass}/5)`);
