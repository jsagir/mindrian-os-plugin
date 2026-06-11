'use strict';
// Phase 150-06 (D-08) -- THE RENDER UNLOCK.
// ========================================================================
// buildReachList -> dial-presenter has ZERO production callers today (the C2
// BLOCKED render arm). This suite proves the decide() render path surfaces the
// grounded one-move onto the LIVE response surface: the dial-presenter renderDial
// is INVOKED on the decide() render path when routing_source === 'engine', and
// its output reaches the rendered decision block.
//
// The seam: scripts/intent-classifier.cjs is made require-safe (Task 3 wraps its
// self-execution in require.main === module) and exports a render helper
// (renderEngineDecisionWithDial or formatEngineDecisionBlock) that the test drives
// directly. We spy on lib/hmi/dial-presenter.renderDial via the require cache to
// prove it is invoked on the engine arm.
//
// Honest-negative: with the cortex absent the path still renders the engine's
// one-move (does not crash) -- proving the wire, not a fixture.
//
// RED-by-design until Task 3 wires the render. NO em-dashes (CLAUDE.md HARD RULE);
// forbidden dash codepoints referenced via String.fromCharCode.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER_REL = 'scripts/intent-classifier.cjs';
const CLASSIFIER_ABS = path.join(REPO_ROOT, CLASSIFIER_REL);
const PRESENTER_ABS = path.join(REPO_ROOT, 'lib/hmi/dial-presenter.cjs');

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

let failures = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('PASS: ' + name + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('FAILED: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n');
  }
}

// Install a spy on dial-presenter.renderDial BEFORE requiring the classifier so
// the classifier's lazy-require resolves to the spied module (require cache).
function installPresenterSpy() {
  const real = require(PRESENTER_ABS);
  const calls = [];
  const origRender = real.renderDial;
  real.renderDial = function spyRenderDial(reachList, opts) {
    calls.push({ reachList: reachList, opts: opts });
    return origRender.call(real, reachList, opts);
  };
  return {
    calls: calls,
    restore: function () { real.renderDial = origRender; },
  };
}

function loadClassifier() {
  // Require-safe load: Task 3 guards the self-exec with require.main === module.
  // If the module still self-executes (RED) or throws, surface it as a failure.
  delete require.cache[CLASSIFIER_ABS];
  return require(CLASSIFIER_ABS);
}

// ---------------------------------------------------------------------------
// The classifier must be require-safe (Task 3 guards self-execution).
// ---------------------------------------------------------------------------
check('intent-classifier is require-safe and exports the render helper (D-08)', function () {
  const mod = loadClassifier();
  assert.ok(mod && typeof mod === 'object', 'classifier must export an object');
  const fn = mod.renderEngineDecisionWithDial || mod.formatEngineDecisionBlock;
  assert.equal(typeof fn, 'function',
    'classifier must export the engine-decision render helper');
});

// ---------------------------------------------------------------------------
// THE UNLOCK: dial-presenter.renderDial is invoked on the engine arm and its
// output reaches the rendered block.
// ---------------------------------------------------------------------------
check('engine-arm render invokes dial-presenter.renderDial (C2 unlock, D-08)', function () {
  const spy = installPresenterSpy();
  try {
    const mod = loadClassifier();
    const fn = mod.renderEngineDecisionWithDial || mod.formatEngineDecisionBlock;
    const decision = {
      fire_skill: 'context_block',
      suppress_skills: [],
      offer_next_step: null,
      decision_trace: { brain_md_tier_mode: 'mode_a', chosen_rationale: 'cortex says reach' },
    };
    const routing = { source: 'engine', activated_skills: ['context_block'] };
    const cortexNodes = [
      { id: 'contradiction:1', type: 'decision', review_status: 'proposed',
        properties: { kind: 'contradiction' } },
    ];
    const block = fn(decision, routing, null, { cortexNodes: cortexNodes });
    assert.equal(typeof block, 'string', 'render helper returns a string block');
    assert.ok(spy.calls.length > 0,
      'dial-presenter.renderDial must be invoked on the engine arm (C2 unlock)');
    // The grounded one-move must be PRESENTED onto the live surface.
    assert.ok(block.indexOf('Choose next reach:') !== -1,
      'the dial render (the F.7 Choose next reach: prompt; FIX-09 150.6-04) must be surfaced onto the live response block');
  } finally {
    spy.restore();
  }
});

// ---------------------------------------------------------------------------
// Honest-negative: cortex absent -> still renders the engine one-move, no crash.
// ---------------------------------------------------------------------------
check('honest-negative: cortex absent renders without crash (proves the wire)', function () {
  const spy = installPresenterSpy();
  try {
    const mod = loadClassifier();
    const fn = mod.renderEngineDecisionWithDial || mod.formatEngineDecisionBlock;
    const decision = {
      fire_skill: 'context_block',
      suppress_skills: [],
      offer_next_step: null,
      decision_trace: { brain_md_tier_mode: 'mode_a', chosen_rationale: 'no cortex' },
    };
    const routing = { source: 'engine', activated_skills: ['context_block'] };
    // No cortexNodes -> the adapter yields no priors; the dial still renders.
    const block = fn(decision, routing, null, { cortexNodes: [] });
    assert.equal(typeof block, 'string', 'returns a string even with no cortex');
    assert.ok(block.length > 0, 'non-empty block with no cortex');
  } finally {
    spy.restore();
  }
});

// ---------------------------------------------------------------------------
// Legacy arm: routing_source !== 'engine' must not require the dial (no regression).
// ---------------------------------------------------------------------------
check('legacy arm renders without requiring the dial (no regression)', function () {
  const mod = loadClassifier();
  const fn = mod.renderEngineDecisionWithDial || mod.formatEngineDecisionBlock;
  const decision = {
    fire_skill: null,
    suppress_skills: [],
    offer_next_step: null,
    decision_trace: { brain_md_tier_mode: 'tier_0', chosen_rationale: 'legacy' },
  };
  const routing = { source: 'legacy', activated_skills: [] };
  const block = fn(decision, routing, null, {});
  assert.equal(typeof block, 'string', 'legacy arm returns a string');
});

// ---------------------------------------------------------------------------
// No-em-dash sweep on the edited source.
// ---------------------------------------------------------------------------
check('no em-dash / en-dash in scripts/intent-classifier.cjs', function () {
  const src = fs.readFileSync(CLASSIFIER_ABS, 'utf8');
  assert.equal(src.indexOf(EM_DASH), -1, 'no em-dash in intent-classifier.cjs');
  assert.equal(src.indexOf(EN_DASH), -1, 'no en-dash in intent-classifier.cjs');
});

if (failures > 0) {
  process.stdout.write('\ntest-150-render-unlock.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\ntest-150-render-unlock.cjs: all assertions passed\n');
process.exit(0);
