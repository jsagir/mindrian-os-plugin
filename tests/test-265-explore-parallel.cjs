#!/usr/bin/env node
'use strict';
/*
 * Phase 265 Plan 18 (RADAR-26) -- probe-first cost guard + concurrent tail.
 *
 * This plan is the build authorized by 265-04 Task 3's `build-now-in-265`
 * decision: the four explore-chain analysis legs run probe-first and
 * concurrently instead of sequentially, WITHOUT dropping the cost property
 * chain-executor.cjs's quality_early_stop provided (a cold deep_research leg
 * spends only itself, never the other three).
 *
 * Task 1 arms: resolveExploreCostPolicy and probeClears, both pure functions
 * -- no fs, no network, no clock, no room, no chain dispatch.
 * Task 2 arms: the runtime concurrency, order, cost-guard, all-legs,
 * fallback, engine-absent and zero-diff arms. All with a stubbed onStep and
 * no network and no real room (a fake roomDir string that chain-executor.cjs's
 * resilient path never touches, since journal/resume stay false/unset).
 *
 * Pure Node.js built-ins only. NO em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const exploreChain = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'explore-chain.cjs'));

const {
  resolveExploreCostPolicy, probeClears, FRAMEWORK_LEGS,
  runAnalysisLegsParallel, runExploreDispatch, OFFER_VERB, MANUAL_ENGINE_MODE,
} = exploreChain;

let pass = 0;
let total = 0;
const failures = [];

async function check(label, fn) {
  total += 1;
  try {
    await fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A minimal FRAMEWORK_LEGS-shaped analysis step (no filing step). Built from
// the SHIPPED FRAMEWORK_LEGS constant so the leg names / order / web flags
// stay in sync with the real chain, never hand-typed.
function makeStep(leg) {
  const fw = FRAMEWORK_LEGS.find((f) => f.leg === leg);
  return {
    step: 0, leg: leg, framework: fw ? fw.framework : null,
    command: 'stub-' + leg, web: fw ? fw.web : false, optional: false,
  };
}
const ANALYSIS_STEPS = FRAMEWORK_LEGS.map((f) => makeStep(f.leg));
const FILING_STEP_STUB = {
  step: 5, leg: 'file_explored', command: 'file-explored-artifact',
  material: true, framework: null, web: false, optional: false,
};
const ALL_STEPS_STUB = ANALYSIS_STEPS.concat([FILING_STEP_STUB]);
// A fake roomDir string, never touched by the filesystem: journal defaults
// false and resume is never set, so chain-executor.cjs's resilient path
// never opens the pipeline-state journal for it. Satisfies "no real room".
const FAKE_ROOM_DIR = 'fixture-not-a-real-room';

const OTHER_THREE_LEGS = FRAMEWORK_LEGS.filter((f) => f.leg !== 'deep_research').map((f) => f.leg);
const ALL_FOUR_LEGS = FRAMEWORK_LEGS.map((f) => f.leg);

async function main() {
  // ---------------------------------------------------------------------
  // Task 1: resolveExploreCostPolicy + probeClears (pure, no room, no
  // network).
  // ---------------------------------------------------------------------

  await check('policy: no env and no opts defaults to cost-conscious probe-first', () => {
    const policy = resolveExploreCostPolicy({}, {});
    assert.equal(policy.mode, 'cost-conscious');
    assert.equal(policy.parallel, true);
    assert.equal(policy.probeLeg, 'deep_research');
    assert.deepEqual(policy.fanLegs, OTHER_THREE_LEGS);
    assert.equal(typeof policy.reason, 'string');
    assert.ok(policy.reason.length > 0);
  });

  await check('policy: EXPLORE_COST_MODE=all-legs fans all four with no probe', () => {
    const policy = resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legs' }, {});
    assert.equal(policy.mode, 'all-legs');
    assert.equal(policy.probeLeg, null);
    assert.deepEqual(policy.fanLegs, ALL_FOUR_LEGS);
  });

  await check('policy: opts.costMode beats the env var', () => {
    const policy = resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legs' }, { costMode: 'cost-conscious' });
    assert.equal(policy.mode, 'cost-conscious');
    assert.equal(policy.probeLeg, 'deep_research');
  });

  await check('policy: an unrecognized EXPLORE_COST_MODE falls back to cost-conscious and says so', () => {
    const policy = resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'nonsense' }, {});
    assert.equal(policy.mode, 'cost-conscious');
    assert.match(policy.reason, /not recognized/i);
  });

  await check('policy: EXPLORE_PARALLEL=0 forces parallel:false regardless of mode', () => {
    const p1 = resolveExploreCostPolicy({ EXPLORE_PARALLEL: '0' }, {});
    assert.equal(p1.parallel, false);
    const p2 = resolveExploreCostPolicy({ EXPLORE_PARALLEL: '0', EXPLORE_COST_MODE: 'all-legs' }, {});
    assert.equal(p2.parallel, false);
  });

  await check('probeClears: false for the cold-corpus quality:low shape, true for medium', () => {
    // The exact shape wrappedOnStep produces for a cold corpus (explore-chain.cjs,
    // the forceOffline branch: `quality: corpus.results.length > 0 ? 'medium' : 'low'`).
    assert.equal(probeClears({ chain_output: { results: [] }, quality: 'low' }), false);
    assert.equal(probeClears({ chain_output: { results: [{ path: 'x' }] }, quality: 'medium' }), true);
    // Defensive: a missing/non-string quality does not spuriously match 'low'.
    assert.equal(probeClears({}), true);
    assert.equal(probeClears(null), true);
  });

  // ---------------------------------------------------------------------
  // Task 2: the runtime arms (runAnalysisLegsParallel + runExploreDispatch).
  // ---------------------------------------------------------------------

  await check('concurrency: three post-probe legs overlap and beat the serial sum', async () => {
    const delays = { deep_research: 5, diffusion_timing: 60, analogies: 40, web_validation: 20 };
    const timeline = {};
    async function stubOnStep(step) {
      const start = Date.now();
      await delay(delays[step.leg]);
      timeline[step.leg] = { start: start, end: Date.now() };
      return { chain_output: { leg: step.leg }, quality: step.leg === 'deep_research' ? 'medium' : 'high' };
    }
    const policy = resolveExploreCostPolicy({}, {});
    const wallStart = Date.now();
    await runAnalysisLegsParallel(ANALYSIS_STEPS, { wrappedOnStep: stubOnStep, policy: policy });
    const wallClock = Date.now() - wallStart;
    const serialSum = delays.diffusion_timing + delays.analogies + delays.web_validation; // 120ms
    assert.ok(wallClock < serialSum - 20, `wall clock ${wallClock}ms should beat the serial sum ${serialSum}ms`);

    const postProbeLegs = ['diffusion_timing', 'analogies', 'web_validation'];
    let overlapFound = false;
    for (let i = 0; i < postProbeLegs.length && !overlapFound; i += 1) {
      for (let j = i + 1; j < postProbeLegs.length && !overlapFound; j += 1) {
        const a = timeline[postProbeLegs[i]];
        const b = timeline[postProbeLegs[j]];
        if (a.start < b.end && b.start < a.end) overlapFound = true;
      }
    }
    assert.ok(overlapFound, 'expected at least two post-probe legs to have overlapping start/end intervals');
  });

  await check('order: the trace is in FRAMEWORK_LEGS order, not completion order', async () => {
    // diffusion_timing takes longest, web_validation shortest -- completion
    // order would be deep_research, web_validation, analogies, diffusion_timing.
    const delays = { deep_research: 5, diffusion_timing: 30, analogies: 15, web_validation: 5 };
    async function stubOnStep(step) {
      await delay(delays[step.leg]);
      return { chain_output: { leg: step.leg }, quality: step.leg === 'deep_research' ? 'medium' : 'high' };
    }
    const policy = resolveExploreCostPolicy({}, {});
    const result = await runAnalysisLegsParallel(ANALYSIS_STEPS, { wrappedOnStep: stubOnStep, policy: policy });
    const legOrder = result.trace.map((t) => t.step.leg);
    assert.deepEqual(legOrder, ALL_FOUR_LEGS);
  });

  await check('cost guard: a cold probe never calls the other three legs (the load-bearing arm)', async () => {
    const callCount = { deep_research: 0, diffusion_timing: 0, analogies: 0, web_validation: 0 };
    async function stubOnStep(step) {
      callCount[step.leg] += 1;
      if (step.leg === 'deep_research') return { chain_output: { results: [] }, quality: 'low' };
      return { chain_output: { leg: step.leg }, quality: 'high' };
    }
    const policy = resolveExploreCostPolicy({}, {});
    let onHaltCalled = false;
    const { run, dispatch } = await runExploreDispatch(
      ALL_STEPS_STUB, ANALYSIS_STEPS, [FILING_STEP_STUB],
      {
        wrappedOnStep: stubOnStep,
        gateFn: () => 'run',
        onHalt: async () => { onHaltCalled = true; return 'defer'; },
        roomDir: FAKE_ROOM_DIR,
        journal: false,
        retries: 0,
        sleep: undefined,
        maxSteps: undefined,
        policy: policy,
        absent: false,
        manual: false,
        offer: null,
      }
    );
    assert.equal(callCount.diffusion_timing, 0, 'diffusion_timing must NEVER be dispatched on a cold probe');
    assert.equal(callCount.analogies, 0, 'analogies must NEVER be dispatched on a cold probe');
    assert.equal(callCount.web_validation, 0, 'web_validation must NEVER be dispatched on a cold probe');
    assert.equal(dispatch.mode, 'parallel');
    assert.equal(dispatch.short_circuited, true);
    assert.equal(run.completed, false);
    assert.equal(run.haltedAt.reason, 'quality_early_stop');
    assert.equal(onHaltCalled, false, 'filing must never run when the pre-pass short-circuited');
  });

  await check('all-legs: EXPLORE_COST_MODE=all-legs calls all four stubs even on a cold probe', async () => {
    const callCount = { deep_research: 0, diffusion_timing: 0, analogies: 0, web_validation: 0 };
    async function stubOnStep(step) {
      callCount[step.leg] += 1;
      if (step.leg === 'deep_research') return { chain_output: { results: [] }, quality: 'low' };
      return { chain_output: { leg: step.leg }, quality: 'high' };
    }
    const policy = resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legs' }, {});
    const result = await runAnalysisLegsParallel(ANALYSIS_STEPS, { wrappedOnStep: stubOnStep, policy: policy });
    assert.equal(callCount.deep_research, 1);
    assert.equal(callCount.diffusion_timing, 1);
    assert.equal(callCount.analogies, 1);
    assert.equal(callCount.web_validation, 1);
    assert.equal(result.short_circuited, null);
    assert.equal(result.trace.length, 4);
  });

  await check('fallback: a thrown leg falls back to sequential with a parallel_failed reason', async () => {
    let diffusionCalls = 0;
    async function stubOnStep(step) {
      if (step.leg === 'deep_research') return { chain_output: { leg: step.leg }, quality: 'medium' };
      if (step.leg === 'diffusion_timing') {
        diffusionCalls += 1;
        if (diffusionCalls === 1) throw new Error('transient fan-out fault');
        return { chain_output: { leg: step.leg }, quality: 'high' };
      }
      return { chain_output: { leg: step.leg }, quality: 'high' };
    }
    const policy = resolveExploreCostPolicy({}, {});
    const gateFn = (step) => (step.leg === 'file_explored' ? 'halt' : 'run');
    const { run, dispatch } = await runExploreDispatch(
      ALL_STEPS_STUB, ANALYSIS_STEPS, [FILING_STEP_STUB],
      {
        wrappedOnStep: stubOnStep,
        gateFn: gateFn,
        onHalt: async () => 'defer',
        roomDir: FAKE_ROOM_DIR,
        journal: false,
        retries: 0,
        sleep: undefined,
        maxSteps: undefined,
        policy: policy,
        absent: false,
        manual: false,
        offer: null,
      }
    );
    assert.equal(dispatch.mode, 'sequential');
    assert.match(dispatch.reason, /^parallel_failed:/);
    assert.ok(Array.isArray(run.trace));
    assert.ok(run.haltedAt, 'the sequential fallback still reaches the material filing gate and halts');
  });

  await check('engine-absent: sequential dispatch with the OFFER preserved on the halt', async () => {
    const offer = { verb: OFFER_VERB, engine_mode: MANUAL_ENGINE_MODE, note: 'test offer' };
    let onStepCalled = false;
    async function stubOnStep() { onStepCalled = true; return { chain_output: {}, quality: 'high' }; }
    // Mirrors exploreOpportunity's own gateFn: absent && !manual halts the
    // FIRST engine-backed step before anything executes.
    const gateFn = (step) => 'halt';
    const policy = resolveExploreCostPolicy({}, {});
    const { run, dispatch } = await runExploreDispatch(
      ALL_STEPS_STUB, ANALYSIS_STEPS, [FILING_STEP_STUB],
      {
        wrappedOnStep: stubOnStep,
        gateFn: gateFn,
        onHalt: async () => 'defer',
        roomDir: FAKE_ROOM_DIR,
        journal: false,
        retries: 0,
        sleep: undefined,
        maxSteps: undefined,
        policy: policy,
        absent: true,
        manual: false,
        offer: offer,
      }
    );
    assert.equal(dispatch.mode, 'sequential');
    assert.equal(dispatch.reason, 'engine_absent');
    assert.equal(onStepCalled, false, 'nothing executes before the engine-absent OFFER halt');
    assert.ok(run.haltedAt);
    assert.ok(run.haltedAt.offer, 'the OFFER must ride the halt exactly as before 265-18');
    assert.equal(run.haltedAt.offer.verb, OFFER_VERB);
    assert.equal(run.haltedAt.offer.engine_mode, MANUAL_ENGINE_MODE);
  });

  await check('zero diff: lib/core/chain-executor.cjs is untouched by this plan', () => {
    const out = execSync('git diff --stat lib/core/chain-executor.cjs', { cwd: REPO_ROOT }).toString();
    assert.equal(out.trim(), '', 'lib/core/chain-executor.cjs must have zero diff (Phase 264 zero-diff gate)');
  });

  console.log('');
  console.log(`${pass}/${total} passed`);
  if (failures.length > 0) {
    console.error('\nFailures:');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  process.exit(0);
}

main();
