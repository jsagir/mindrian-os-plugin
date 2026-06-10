'use strict';
// Phase 150.5-02 (DIAL-ATOM-01) -- ATOMIC DIAL RENDER COUPLING.
// ========================================================================
// 150.5-RESEARCH.md Finding B: dial-presenter.renderDial returns contract
// { shape:'F.1', keyboard:'askuserquestion' } and the ONLY production caller
// DISCARDS it -- renderEngineDecisionWithDial appends rendered.text alone
// (intent-classifier.cjs:896-899), so a navigator sees triangles that accept
// no keys. The catch at :900-903 drops any render fault silently (the Phase
// 140 D-03 silent-failure class).
//
// This suite is RED-BY-DESIGN on pre-fix main. The arms:
//   1. Engine-arm atomicity: dial TEXT and the AskUserQuestion CONTRACT
//      TRAILER emit together -- one emission site, never text-only.
//   2. Legacy-arm honest negative: neither text nor trailer (the :869
//      engine-only gate unchanged; Phase 144 honest-negative unamended).
//   3. D-01 sensor-fired tier-0 cold-card arm: S4 framing + '--' confidence
//      render WITH the trailer (the trailer rides EVERY engine arm).
//   4. Fault arm: a forced renderDial throw never blocks the turn AND writes
//      a dial_render_fault note through ctx.onRenderNote (scalars only).
//   5. Single-construction-door fence: the trailer is minted ONLY by
//      selector-dispatcher.appendAskUserQuestionTrailer (SEED-020); the
//      test-148 CONSTRUCTION_MARKER regex matches NEITHER edited source.
//   6. Trailer shape fence (threat T-150.5-05): scalars only --
//      /\[AskUserQuestion contract: shape=F\.1 verbs=\d+\]/ exactly.
//   7. Trace-note merge fence: the caller merges dial_render_note into the
//      persisted decision trace (the shipped Phase-91 surface).
//   8. Frozen constants: MAX_K=3, DIAL_REACH_K=6, RECOMMEND_FLOOR=0.70,
//      MARGIN_THRESHOLD=0.15 (byte-unchanged or this phase fails).
//
// Spy patterns reused from tests/test-150-render-unlock.cjs (require-cache
// spies + loadClassifier). NO em-dashes (CLAUDE.md HARD RULE); forbidden dash
// codepoints referenced via String.fromCharCode.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER_ABS = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const PRESENTER_ABS = path.join(REPO_ROOT, 'lib', 'hmi', 'dial-presenter.cjs');
const DISPATCHER_ABS = path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs');
const ORCHESTRATOR_ABS = path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs');
const RANKER_ABS = path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs');

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

// The S4 cold-room framing line (dial-presenter.cjs FRAMING_TIER_0) + the
// tier-0 no-signal confidence sentinel (NO_SIGNAL).
const S4_FRAMING = 'New room - nothing to rank yet. Start anywhere.';
const NO_SIGNAL = '--';

// The trailer assertion targets (the dispatcher's single construction door,
// selector-dispatcher.cjs appendAskUserQuestionTrailer).
const TRAILER_PREFIX = '[AskUserQuestion contract:';
const TRAILER_SHAPE_RE = /\[AskUserQuestion contract: shape=F\.1 verbs=\d+\]/;

// The test-148 construction-marker regex, mirrored verbatim
// (tests/test-148-frozen-contracts.cjs:95) and extended to the two files this
// plan touches: the trailer string must exist ONLY in the dispatcher.
const CONSTRUCTION_MARKER = /askuserquestion_marker\s*=|\[AskUserQuestion contract:|new\s+AskUserQuestion|AskUserQuestion\s*\(/;

let passed = 0;
let failures = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('PASS: ' + name + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('FAILED: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n');
  }
}

// Install a spy on dial-presenter.renderDial BEFORE requiring the classifier
// so the classifier's lazy-require resolves to the spied module (require
// cache). Pattern reused verbatim from tests/test-150-render-unlock.cjs.
function installPresenterSpy(impl) {
  const real = require(PRESENTER_ABS);
  const calls = [];
  const origRender = real.renderDial;
  real.renderDial = function spyRenderDial(reachList, opts) {
    calls.push({ reachList: reachList, opts: opts });
    if (typeof impl === 'function') return impl(reachList, opts);
    return origRender.call(real, reachList, opts);
  };
  return {
    calls: calls,
    restore: function () { real.renderDial = origRender; },
  };
}

// Spy on selector-dispatcher.appendAskUserQuestionTrailer (the SEED-020
// single construction door) via the same require-cache pattern.
function installDispatcherSpy() {
  const real = require(DISPATCHER_ABS);
  const calls = [];
  const orig = real.appendAskUserQuestionTrailer;
  real.appendAskUserQuestionTrailer = function spyTrailer(rendered, subShape) {
    calls.push({ rendered: rendered, subShape: subShape });
    return orig.call(real, rendered, subShape);
  };
  return {
    calls: calls,
    restore: function () { real.appendAskUserQuestionTrailer = orig; },
  };
}

function loadClassifier() {
  delete require.cache[CLASSIFIER_ABS];
  return require(CLASSIFIER_ABS);
}

function engineDecision(tierMode) {
  return {
    fire_skill: 'context_block',
    suppress_skills: [],
    offer_next_step: null,
    decision_trace: {
      brain_md_tier_mode: tierMode,
      chosen_rationale: 'cortex says reach',
    },
  };
}

const ENGINE_ROUTING = { source: 'engine', activated_skills: ['context_block'] };
const CORTEX_NODES = [
  { id: 'contradiction:1', type: 'decision', review_status: 'proposed',
    properties: { kind: 'contradiction' } },
];

// ---------------------------------------------------------------------------
// Arm 1: engine-arm atomicity -- text AND trailer emit together (RED today).
// ---------------------------------------------------------------------------
check('engine arm emits dial text AND the AskUserQuestion contract trailer together (DIAL-ATOM-01, RED on pre-fix main)', function () {
  const mod = loadClassifier();
  const fn = mod.renderEngineDecisionWithDial;
  assert.equal(typeof fn, 'function', 'classifier must export renderEngineDecisionWithDial');
  const block = fn(engineDecision('mode_a'), ENGINE_ROUTING, null, { cortexNodes: CORTEX_NODES });
  assert.equal(typeof block, 'string', 'render helper returns a string block');
  assert.ok(block.indexOf('Larry can reach for:') !== -1,
    'the dial text half must be on the block');
  assert.ok(block.indexOf(TRAILER_PREFIX + ' shape=F.1') !== -1,
    'the contract trailer must ride the same emission as the text (never text-only)');
});

// ---------------------------------------------------------------------------
// Arm 2: legacy honest negative -- NEITHER text NOR trailer (the :869 gate).
// ---------------------------------------------------------------------------
check('legacy arm renders NEITHER dial text NOR trailer (the :869 engine-only gate STAYS; Phase 144 honest-negative unamended)', function () {
  const mod = loadClassifier();
  const fn = mod.renderEngineDecisionWithDial;
  const decision = {
    fire_skill: null, suppress_skills: [], offer_next_step: null,
    decision_trace: { brain_md_tier_mode: 'tier_0', chosen_rationale: 'legacy' },
  };
  const routing = { source: 'legacy', activated_skills: [] };
  const block = fn(decision, routing, null, {});
  assert.equal(typeof block, 'string', 'legacy arm returns a string');
  assert.equal(block.indexOf('Larry can reach for:'), -1,
    'no dial chrome on the legacy arm');
  assert.equal(block.indexOf(TRAILER_PREFIX), -1,
    'no contract trailer on the legacy arm');
});

// ---------------------------------------------------------------------------
// Arm 3: D-01 sensor-fired tier-0 cold card (RED today on the trailer half).
// ---------------------------------------------------------------------------
check('D-01 (LOCKED 2026-06-09) sensor-fired tier-0 cold card: S4 framing + no-signal confidence WITH the contract trailer', function () {
  const mod = loadClassifier();
  const fn = mod.renderEngineDecisionWithDial;
  const block = fn(engineDecision('tier_0'), ENGINE_ROUTING, null, { cortexNodes: [] });
  assert.equal(typeof block, 'string', 'tier-0 engine arm returns a string');
  assert.ok(block.indexOf(S4_FRAMING) !== -1,
    'the S4 framing line must render on the sensor-fired tier-0 engine arm');
  assert.ok(block.indexOf(NO_SIGNAL) !== -1,
    'the tier-0 no-signal confidence sentinel must render');
  assert.ok(block.indexOf(TRAILER_PREFIX) !== -1,
    'the trailer rides EVERY engine arm including tier_0 (the D-01 hybrid cold card)');
});

// ---------------------------------------------------------------------------
// Arm 4: fault arm -- a renderDial throw never blocks the turn AND the fault
// classifies into a dial_render_fault note (scalars only, no prose).
// ---------------------------------------------------------------------------
check('fault arm: a forced renderDial throw returns the base block AND writes exactly one scalar dial_render_fault note', function () {
  const spy = installPresenterSpy(function () {
    throw new Error('synthetic dial render fault (test-only)');
  });
  try {
    const mod = loadClassifier();
    const fn = mod.renderEngineDecisionWithDial;
    const baseFn = mod.formatEngineDecisionBlock;
    assert.equal(typeof baseFn, 'function', 'classifier must export formatEngineDecisionBlock');
    const decision = engineDecision('mode_a');
    const routing = ENGINE_ROUTING;
    const notes = [];
    const block = fn(decision, routing, null, {
      cortexNodes: [],
      onRenderNote: function (note) { notes.push(note); },
    });
    const base = baseFn(decision, routing, null);
    assert.equal(block, base,
      'the turn is never blocked: a render fault returns the base block unchanged');
    assert.equal(notes.length, 1, 'exactly one fault note must be collected');
    const note = notes[0];
    assert.ok(note && typeof note === 'object', 'the note is an object');
    assert.equal(note.event, 'dial_render_fault', 'the note event classifier');
    assert.equal(typeof note.error_name, 'string', 'error_name is a string scalar');
    const keys = Object.keys(note).sort();
    assert.deepEqual(keys, ['error_name', 'event'],
      'scalars only: no message/stack/prose fields ride the note (threat T-150.5-06)');
  } finally {
    spy.restore();
  }
});

// ---------------------------------------------------------------------------
// Arm 5: single-construction-door fence (SEED-020). The dispatcher's
// appendAskUserQuestionTrailer is INVOKED on the engine arm, and the
// construction marker matches NEITHER edited source file.
// ---------------------------------------------------------------------------
check('SEED-020 single door: selector-dispatcher.appendAskUserQuestionTrailer is invoked on the engine arm', function () {
  const spy = installDispatcherSpy();
  try {
    const mod = loadClassifier();
    const fn = mod.renderEngineDecisionWithDial;
    fn(engineDecision('mode_a'), ENGINE_ROUTING, null, { cortexNodes: CORTEX_NODES });
    assert.ok(spy.calls.length > 0,
      'the trailer must be minted by the dispatcher (the SEED-020 single construction door), not composed inline');
  } finally {
    spy.restore();
  }
});

check('SEED-020 source fence: the construction marker matches NEITHER intent-classifier.cjs NOR dial-presenter.cjs', function () {
  const classifierSrc = fs.readFileSync(CLASSIFIER_ABS, 'utf8');
  const presenterSrc = fs.readFileSync(PRESENTER_ABS, 'utf8');
  assert.ok(!CONSTRUCTION_MARKER.test(classifierSrc),
    'AskUserQuestion construction found in scripts/intent-classifier.cjs (must stay dispatcher-only)');
  assert.ok(!CONSTRUCTION_MARKER.test(presenterSrc),
    'AskUserQuestion construction found in lib/hmi/dial-presenter.cjs (must stay dispatcher-only)');
});

// ---------------------------------------------------------------------------
// Arm 6: trailer shape fence (threat T-150.5-05) -- scalars only, no room
// content beyond what the text half already carries.
// ---------------------------------------------------------------------------
check('trailer shape fence: the trailer matches [AskUserQuestion contract: shape=F.1 verbs=N] exactly (scalars only, threat T2)', function () {
  const mod = loadClassifier();
  const fn = mod.renderEngineDecisionWithDial;
  const block = fn(engineDecision('mode_a'), ENGINE_ROUTING, null, { cortexNodes: CORTEX_NODES });
  const start = block.indexOf(TRAILER_PREFIX);
  assert.ok(start !== -1, 'the trailer must be present on the engine-arm block');
  const end = block.indexOf(']', start);
  assert.ok(end !== -1, 'the trailer must be a closed bracket form');
  const trailer = block.slice(start, end + 1);
  assert.ok(TRAILER_SHAPE_RE.test(trailer),
    'the trailer carries shape + verbs COUNT only, got: ' + trailer);
});

// ---------------------------------------------------------------------------
// Arm 7: trace-note merge fence -- the caller merges dial_render_note into
// the persisted decision trace (the shipped Phase-91 surface; zero new write
// paths, threat T-150.5-07).
// ---------------------------------------------------------------------------
check('trace-note merge fence: intent-classifier.cjs source merges dial_render_note into the decision trace', function () {
  const src = fs.readFileSync(CLASSIFIER_ABS, 'utf8');
  assert.ok(src.indexOf('dial_render_note') !== -1,
    'the caller must merge the fault note into traceEntry before persistDecisionTrace');
});

// ---------------------------------------------------------------------------
// Arm 8: frozen constants (byte-unchanged or this phase fails).
// ---------------------------------------------------------------------------
check('frozen contracts: MAX_K=3, DIAL_REACH_K=6, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15', function () {
  const orchestrator = require(ORCHESTRATOR_ABS);
  const ranker = require(RANKER_ABS);
  assert.equal(ranker.MAX_K, 3, 'MAX_K must stay 3');
  assert.equal(orchestrator.DIAL_REACH_K, 6, 'DIAL_REACH_K must stay 6');
  assert.equal(orchestrator.RECOMMEND_FLOOR, 0.70, 'RECOMMEND_FLOOR must stay 0.70');
  assert.equal(orchestrator.MARGIN_THRESHOLD, 0.15, 'MARGIN_THRESHOLD must stay 0.15');
});

// ---------------------------------------------------------------------------
// Arm 9: no em-dash / en-dash in the edited sources (CLAUDE.md HARD RULE).
// ---------------------------------------------------------------------------
check('no em-dash / en-dash in the edited sources (intent-classifier.cjs, dial-presenter.cjs, this suite)', function () {
  const files = [CLASSIFIER_ABS, PRESENTER_ABS, __filename];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.equal(src.indexOf(EM_DASH), -1, 'em-dash found in ' + path.basename(f));
    assert.equal(src.indexOf(EN_DASH), -1, 'en-dash found in ' + path.basename(f));
  }
});

// ---------------------------------------------------------------------------
process.stdout.write('\ntest-150-5-render-atomicity.cjs: ' + passed + ' passed, '
  + failures + ' failed\n');
if (failures > 0) {
  process.exit(1);
}
process.exit(0);
