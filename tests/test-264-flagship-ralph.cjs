#!/usr/bin/env node
'use strict';

/*
 * Phase 264 Plan 04, Task 1 -- tests/test-264-flagship-ralph.cjs
 * ================================================================
 * Behaviors covered:
 *   1. The real Technical Roadmap chain (data/roadmap-type-chains.json,
 *      composed through command-resolver.cjs's composeWorkflow, exactly like
 *      a real navigator would) runs its find-bottlenecks step under
 *      ralph_verify with a real adversarial critic (salient-governance.cjs).
 *   2. A weak first candidate that self-corrects triggers exactly ONE bounded
 *      retry (the shipped RALPH_RETRY_CAP_DEFAULT = 2), then a passing verdict.
 *   3. A candidate that NEVER passes critique halts with retry_exhausted after
 *      exactly cap+1 onStep calls -- it never silently proceeds.
 *   4. A composed chain with NO ralph_verify grafted anywhere is byte-identical
 *      to the shipped default-off token economy (a step still runs once).
 *   5. A material step carrying ralph_verify: true is never retried -- the
 *      Canon Part 3 gate halts it BEFORE onStep is ever dispatched.
 *   6. An irreversible step carrying ralph_verify: true is never retried --
 *      the forced_material halt fires before onStep, unconditionally.
 *   7. The EXEC-06 budget brake is distinguishable from cap exhaustion:
 *      budget_brake and retry_exhausted are two DIFFERENT halt reasons.
 *   8. The adversarial critic is genuinely engaged, never bypassed: it is
 *      invoked at least twice on the retried step and every verdict it
 *      returns is a plain, non-thenable object (a Promise verdict would make
 *      _critiqueFailed silently return false and pass every candidate).
 *
 * D-11 -- THE HONEST CONSEQUENCE (copied verbatim from 264-04-PLAN.md's own
 * "The honest consequence, stated plainly (D-11)" section):
 *
 * `lib/mcp/tools/chain.cjs::chainRun` is INERT for `ralph_verify` today, for TWO independent
 * reasons, both confirmed by direct code read:
 * 1. `chain.cjs:269` sets `roomDir` to `process.cwd()` when no roomDir is supplied, so `roomDir`
 *    is ALWAYS a non-empty string and is passed unconditionally at `:290`. That trips
 *    `runChain`'s async dispatch at `chain-executor.cjs:448-456` into `_runChainResilient`,
 *    where `_ralphSafeRetry` does not exist.
 * 2. `chainRun` never passes a `selfCritiqueFn` at all; its opts object carries only
 *    `postureFn`, `onStep`, `maxSteps`, `roomDir`, `onHalt`.
 *
 * Therefore: a navigator running the Technical Roadmap chain through the LIVE
 * `chain_resolve -> chain_run` flow will NOT get `ralph_verify` benefits from this phase alone.
 * Requirement 4's acceptance is proven via a scoped direct `runChain()` call, mirroring the
 * shipped precedent at `lib/core/bono/debate-composition.cjs:367-375`. This is not a workaround
 * hidden in a test; it is the navigator-confirmed resolution recorded in D-11, and both reasons
 * above are restated verbatim here so a future reader is not misled about what is live.
 *
 * "Make `chain_run`'s async path honor `ralph_verify`" is a NAMED FOLLOW-ON PHASE. Do not do it
 * here: it would touch `chain-executor.cjs`'s core logic, which SPEC.md's Boundaries forbid.
 *
 * This file changes ZERO production code. It exercises the shipped runChain seam
 * (lib/core/chain-executor.cjs), the shipped critic (lib/core/salient-governance.cjs,
 * plan 264-02), and the shipped chain table (data/roadmap-type-chains.json, plan 264-01)
 * exactly as they ship today.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { runChain } = require(path.join(__dirname, '..', 'lib', 'core', 'chain-executor.cjs'));
const { composeWorkflow } = require(path.join(__dirname, '..', 'lib', 'workflow', 'command-resolver.cjs'));
const { makeSalientSelfCritiqueFn } = require(path.join(__dirname, '..', 'lib', 'core', 'salient-governance.cjs'));

const CHAIN_TABLE_PATH = path.join(__dirname, '..', 'data', 'roadmap-type-chains.json');
const FIND_BOTTLENECKS_CMD = '/mos:find-bottlenecks';

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-264-flagship-ralph');

// ---------------------------------------------------------------------------
// FIXTURE HELPERS
// ---------------------------------------------------------------------------

// safePosture -- required, not cosmetic: _isMaterialStep treats an ABSENT
// posture as material (withhold-default), so a step without a resolvable
// posture: 'run' never retries. The three Technical Roadmap commands are all
// autonomous_safe: true in data/command-registry.json, and find-bottlenecks
// contains none of the frozen IRREVERSIBLE_HINTS, so the opt-in branch fires.
const safePosture = function () { return { command: 'c', autonomous_safe: true, posture: 'run' }; };
const materialPosture = function () { return { command: 'c', autonomous_safe: false, posture: 'halt' }; };
const onHalt = function () { return 'defer'; };

// The critic that governs ONLY the find-bottlenecks step; every other
// Technical Roadmap step abstains (never failed by an RS-shaped rule set it
// was never meant to satisfy).
const selfCritiqueFn = makeSalientSelfCritiqueFn({ commandFilter: FIND_BOTTLENECKS_CMD });

// makeRsOnStep(passAt) -- the donor's (tests/test-201-bounded-retry.cjs)
// attempt-counting factory, adapted to emit an RS-shaped finding on
// chain_output. Synchronous -- it is called inside chain-executor's sync
// retry loop. Attempts before passAt emit a finding whose source and target
// artifact ids are IDENTICAL, tripping rs_self_referential on the adversarial
// pass while the neutral pass stays clean (a two-pass DISAGREEMENT, not a
// plain neutral failure). Attempts at or after passAt emit a clean,
// non-self-referential finding that both passes accept.
function makeRsOnStep(passAt) {
  let attempt = 0;
  const fn = function (_step, _previousOutput) {
    attempt += 1;
    if (attempt >= passAt) {
      return {
        chain_output: {
          id: 'rs-finding-pass-' + attempt,
          source_artifact_id: 'artifact-source-1',
          target_artifact_id: 'artifact-target-1',
          direction: 'whitespace',
          signed_diff: 4,
          abs_diff: 4,
          body_text: 'The target artifact is lagging relative to the source artifact.',
          brain_chain_text: '',
        },
        quality: 'high',
      };
    }
    return {
      chain_output: {
        id: 'rs-finding-weak-' + attempt,
        source_artifact_id: 'artifact-self-1',
        target_artifact_id: 'artifact-self-1',
        direction: 'whitespace',
        signed_diff: 4,
        abs_diff: 4,
        body_text: 'A self-referential finding the adversarial pass must reject.',
        brain_chain_text: '',
      },
      quality: 'low',
    };
  };
  fn.count = function () { return attempt; };
  return fn;
}

// Dispatcher: routes the find-bottlenecks step to the RS onStep under test;
// every other Technical Roadmap step (diagnose, map-unknowns) gets a generic
// high-quality passthrough so the chain proceeds past them without exercising
// ralph_verify (only find-bottlenecks carries that opt-in).
function makeDispatchOnStep(rsFn) {
  return function (step, previousOutput) {
    if (step && step.command === FIND_BOTTLENECKS_CMD) {
      return rsFn(step, previousOutput);
    }
    return { chain_output: { ok: true, from: step && step.command }, quality: 'high' };
  };
}

function findTraceEntry(res, command) {
  return (res.trace || []).find(function (t) { return t.step && t.step.command === command; }) || null;
}

// ---------------------------------------------------------------------------
// STEP COMPOSITION (RESEARCH F-10): composeWorkflow never emits ralph_verify,
// so graft it onto find-bottlenecks explicitly.
// ---------------------------------------------------------------------------
const chainTable = JSON.parse(fs.readFileSync(CHAIN_TABLE_PATH, 'utf8'));
const technicalRoadmapChain = chainTable['technical-roadmap'];
const baseWorkflow = composeWorkflow(technicalRoadmapChain);
const graftedWorkflow = baseWorkflow.map(function (s) {
  return (s.command === FIND_BOTTLENECKS_CMD) ? Object.assign({}, s, { ralph_verify: true }) : s;
});

ok('lib/core/chain-executor.cjs exports runChain as a function', function () {
  assert.equal(typeof runChain, 'function');
});

ok('the grafted Technical Roadmap chain carries exactly one ralph_verify step', function () {
  const flagged = graftedWorkflow.filter(function (s) { return s.ralph_verify === true; });
  assert.equal(flagged.length, 1, 'expected exactly one ralph_verify step, got ' + flagged.length);
  assert.equal(flagged[0].command, FIND_BOTTLENECKS_CMD, 'the flagged step must be find-bottlenecks');
});

ok('that one ralph_verify step targets ' + FIND_BOTTLENECKS_CMD, function () {
  const step = graftedWorkflow.find(function (s) { return s.command === FIND_BOTTLENECKS_CMD; });
  assert.ok(step, 'find-bottlenecks step must exist in the composed chain');
  assert.equal(step.ralph_verify, true);
});

// ---------------------------------------------------------------------------
// CASE 1 -- R4: exactly one retry (cap honored), then a passing verdict.
// The default cap (RALPH_RETRY_CAP_DEFAULT = 2) is left untouched -- lowering
// ralphRetryCap to 1 would change the tested contract.
//
// CALL SHAPE (debate-composition.cjs:367-375 precedent): the load-bearing
// property is what is ABSENT. This opts object carries none of a room
// directory handle, a journal flag, a bounded-retry-count knob, a resume
// flag, or an injectable sleeper -- any one of those five would route the
// call to the ASYNC _runChainResilient path, where _ralphSafeRetry does not
// exist. This is the single easiest thing for a later editor to break by
// "helpfully" adding one of those five.
// ---------------------------------------------------------------------------
const case1RsFn = makeRsOnStep(2); // passes on the 2nd attempt
const case1Result = runChain(graftedWorkflow, {
  onStep: makeDispatchOnStep(case1RsFn),
  postureFn: safePosture,
  selfCritiqueFn: selfCritiqueFn,
  onHalt: onHalt,
});

ok('case 1: onStep runs the find-bottlenecks step exactly twice (one retry, cap honored)', function () {
  assert.equal(case1RsFn.count(), 2, 'expected exactly 2 onStep calls, got ' + case1RsFn.count());
});

ok('case 1: the passing retry candidate is recorded with high quality', function () {
  const entry = findTraceEntry(case1Result, FIND_BOTTLENECKS_CMD);
  assert.ok(entry, 'find-bottlenecks must appear in the trace');
  assert.equal(entry.quality, 'high');
});

ok('case 1: the runChain return value is a plain object, not a Promise (stayed on the sync path)', function () {
  assert.equal(typeof case1Result, 'object');
  assert.notEqual(case1Result, null);
  assert.notEqual(typeof case1Result.then, 'function');
});

// ---------------------------------------------------------------------------
// CASE 2 -- R4/R5: a candidate that never passes forces a LOW_QUALITY halt,
// never a silent pass. ralphRetryCap is pinned at 2 explicitly here.
// ---------------------------------------------------------------------------
const case2RsFn = makeRsOnStep(99); // never passes
const case2Result = runChain(graftedWorkflow, {
  onStep: makeDispatchOnStep(case2RsFn),
  postureFn: safePosture,
  selfCritiqueFn: selfCritiqueFn,
  onHalt: onHalt,
  ralphRetryCap: 2,
});

ok('case 2: the chain does not complete when find-bottlenecks never passes', function () {
  assert.equal(case2Result.completed, false);
});

ok('case 2: the halt reason is retry_exhausted', function () {
  assert.ok(case2Result.haltedAt, 'haltedAt must be set');
  assert.equal(case2Result.haltedAt.reason, 'retry_exhausted');
});

ok('case 2: onStep ran exactly cap+1 = 3 times (1 initial + 2 retries, cap honored)', function () {
  assert.equal(case2RsFn.count(), 3, 'expected exactly 3 onStep calls, got ' + case2RsFn.count());
});

ok('case 2: the find-bottlenecks trace entry is recorded with low quality (falls through to the gate)', function () {
  const entry = findTraceEntry(case2Result, FIND_BOTTLENECKS_CMD);
  assert.ok(entry, 'find-bottlenecks must still appear in the trace (never silently dropped)');
  assert.equal(entry.quality, 'low');
});

// ---------------------------------------------------------------------------
// CASE 3 -- R5: non-opted-in steps are byte-identical to the shipped
// default-off token economy. Run the SAME base composed chain with NO
// ralph_verify grafted anywhere, and a never-passing onStep.
// ---------------------------------------------------------------------------
let case3Calls = 0;
const case3OnStep = function () {
  case3Calls += 1;
  return { chain_output: { attempt: case3Calls }, quality: 'low' };
};
const case3Result = runChain(baseWorkflow, {
  onStep: case3OnStep,
  postureFn: safePosture,
  selfCritiqueFn: selfCritiqueFn,
  onHalt: onHalt,
});

ok('case 3: a non-opted-in composed chain never retries -- the step runs exactly once', function () {
  assert.equal(case3Calls, 1, 'expected exactly 1 onStep call (no ralph_verify anywhere), got ' + case3Calls);
  assert.equal(case3Result.completed, false, 'the low-quality first step still halts the chain via quality carry');
});

// ---------------------------------------------------------------------------
// CASE 4 -- R5 B3 proof, material step. A material step carrying
// ralph_verify: true must never be retried: the Canon Part 3 gate halts it
// BEFORE onStep is ever dispatched.
// ---------------------------------------------------------------------------
let case4Calls = 0;
const case4OnStep = function () { case4Calls += 1; return { chain_output: {}, quality: 'high' }; };
const case4Result = runChain(
  [{ step: 1, command: FIND_BOTTLENECKS_CMD, ralph_verify: true, material: true }],
  { onStep: case4OnStep, postureFn: materialPosture, selfCritiqueFn: selfCritiqueFn, onHalt: onHalt }
);

ok('case 4: a material step carrying ralph_verify halts before onStep -- zero dispatches', function () {
  assert.equal(case4Calls, 0, 'onStep must never be called for a material step, got ' + case4Calls + ' calls');
});

ok('case 4: the chain does not complete on a material halt', function () {
  assert.equal(case4Result.completed, false);
});

// ---------------------------------------------------------------------------
// CASE 5 -- R5 B3 proof, irreversible step. An irreversible step with
// ralph_verify: true never retries (forced-material halt fires unconditionally,
// even with an autonomous_safe-looking posture).
// ---------------------------------------------------------------------------
let case5Calls = 0;
const case5OnStep = function () { case5Calls += 1; return { chain_output: {}, quality: 'high' }; };
const case5Result = runChain(
  [{ step: 1, command: 'deploy-thing', ralph_verify: true }],
  { onStep: case5OnStep, postureFn: safePosture, selfCritiqueFn: selfCritiqueFn, onHalt: onHalt }
);

ok('case 5: an irreversible step with ralph_verify halts as forced_material before onStep', function () {
  assert.ok(case5Result.haltedAt, 'haltedAt must be set');
  assert.equal(case5Result.haltedAt.reason, 'forced_material');
});

ok('case 5: zero onStep dispatches on the irreversible halt', function () {
  assert.equal(case5Calls, 0, 'onStep must never be called for an irreversible step, got ' + case5Calls + ' calls');
});

// ---------------------------------------------------------------------------
// CASE 6 -- the budget brake is distinguishable from cap exhaustion. A large
// cap (10) with a tight maxSteps (2) must halt as budget_brake, NOT
// retry_exhausted -- proving this phase did not collapse the two halt reasons.
// ---------------------------------------------------------------------------
const case6RsFn = makeRsOnStep(99); // never passes
const case6Result = runChain(
  [{ step: 1, command: FIND_BOTTLENECKS_CMD, ralph_verify: true }],
  {
    onStep: makeDispatchOnStep(case6RsFn),
    postureFn: safePosture,
    selfCritiqueFn: selfCritiqueFn,
    onHalt: onHalt,
    ralphRetryCap: 10,
    maxSteps: 2,
  }
);

ok('case 6: the EXEC-06 budget halts the chain before the chain completes', function () {
  assert.equal(case6Result.completed, false);
});

ok('case 6: the halt reason is budget_brake, not retry_exhausted', function () {
  assert.ok(case6Result.haltedAt, 'haltedAt must be set');
  assert.equal(case6Result.haltedAt.reason, 'budget_brake', 'got ' + case6Result.haltedAt.reason);
});

// ---------------------------------------------------------------------------
// CASE 7 -- the critic is genuinely engaged, not bypassed. Wrap selfCritiqueFn
// in a counting proxy over the SAME case-1 setup and assert it was called at
// least twice (once on the initial candidate, once on the retried candidate),
// and that every verdict it returned satisfies typeof verdict.then !==
// 'function'. Absence of an error proves nothing on this seam: a Promise
// verdict would make _critiqueFailed return false and every candidate would
// pass silently with no log -- the positive is what must be asserted.
// ---------------------------------------------------------------------------
let case7CritiqueCalls = 0;
let case7AllNonThenable = true;
const case7WrappedCritic = function (step, result) {
  const verdict = selfCritiqueFn(step, result);
  case7CritiqueCalls += 1;
  if (verdict && typeof verdict.then === 'function') case7AllNonThenable = false;
  return verdict;
};
const case7RsFn = makeRsOnStep(2); // fails once, passes on the 2nd attempt (mirrors case 1)
runChain(graftedWorkflow, {
  onStep: makeDispatchOnStep(case7RsFn),
  postureFn: safePosture,
  selfCritiqueFn: case7WrappedCritic,
  onHalt: onHalt,
});

ok('case 7: the wrapped critic was invoked at least twice for the retried step', function () {
  assert.ok(case7CritiqueCalls >= 2, 'expected at least 2 critique calls, got ' + case7CritiqueCalls);
});

ok('case 7: every verdict the critic returned was a non-thenable plain object', function () {
  assert.equal(case7AllNonThenable, true, 'a Promise verdict would silently pass every candidate');
});

console.log('\nPASS test-264-flagship-ralph (' + n + ' assertions)');
