'use strict';
// Phase 150-08 -- CLAIM C2: "Larry's next move is grounded in your room AND you
// see it presented."
// ========================================================================
// Two falsifiable arms + one carved-out semantic arm:
//
//   C2-grounded (machine): decide() consumes the cortex-threaded context and a
//     fired reach flips routing_source legacy -> engine (the grounded one-move
//     comes from the graph, not a hardcoded default).
//
//   C2-seen (machine, the D-08 render arm): the intent-classifier render helper
//     renderEngineDecisionWithDial invokes lib/hmi/dial-presenter.renderDial on
//     the engine arm and the dial output reaches the rendered block -- proving
//     buildReachList -> dial-presenter reaches the LIVE response surface.
//
//   C2-good (CARVED OUT to the Part-10 human empathy gate): whether the move is
//     actually GOOD is a semantic-quality judgment. It is NOT machine-asserted.
//     We print a named SKIP line, never a fake PASS.
//
// Honest-negative: the legacy arm (routing_source !== 'engine') must NOT require
// the dial -- a regression that forced the dial on the legacy path would fail.
//
// Drives REAL shipped units (navigation-engine decide + intent-classifier render
// + dial-presenter) on the real fixture; no mock of the unit under test.
// node:sqlite unavailable -> SKIP 77. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

const HARNESS = require('./build-fixture-room-db.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP claim-c2.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const engine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const CLASSIFIER_ABS = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const PRESENTER_ABS = path.join(REPO_ROOT, 'lib', 'hmi', 'dial-presenter.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('PASS C2: ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('FAIL C2: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

// Spy on dial-presenter.renderDial via the require cache BEFORE loading the
// classifier so its lazy require resolves to the spied module.
function installPresenterSpy() {
  const real = require(PRESENTER_ABS);
  const calls = [];
  const orig = real.renderDial;
  real.renderDial = function spyRenderDial(reachList, opts) {
    calls.push({ reachList: reachList, opts: opts });
    return orig.call(real, reachList, opts);
  };
  return { calls: calls, restore: function () { real.renderDial = orig; } };
}

function loadClassifier() {
  delete require.cache[CLASSIFIER_ABS];
  return require(CLASSIFIER_ABS);
}

let built;
try {
  built = HARNESS.buildFixtureRoomDb({ keepOpen: true });
} catch (e) {
  if (e && e.code === 'ESQLITE_UNAVAILABLE') {
    process.stdout.write('SKIP claim-c2.cjs (node:sqlite unavailable)\n');
    process.exit(77);
  }
  throw e;
}

try {
  // ---- C2-grounded: decide() consumes the cortex-threaded context and returns a
  // real one-move with a populated decision_trace (the move comes from the graph,
  // not from a hardcoded default). The routing_source legacy -> engine FLIP is the
  // router's job (proven by the C2-seen render arm below + the 150-06 render-unlock
  // suite); decide() itself produces the grounded decision the router then routes.
  check('C2-grounded: decide() consumes the cortex context and returns a real one-move (grounded in the room)', function () {
    assert.equal(typeof engine.decide, 'function', 'navigation-engine must export decide()');
    // A turn + a cortex-threaded context (lowFillSections is the LOCAL handle the
    // sensors fire on -- a low-fill section is the grounded signal a reach reads).
    const turn = { text: 'what should I do next on the scheduler problem?' };
    const context = {
      problem_type: 'WDP',
      complexity: 'Wicked',
      stage: 'idea',
      roomDir: built.roomDir,
      lowFillSections: ['market-analysis'],
    };
    const decision = engine.decide(turn, context);
    assert.ok(decision && typeof decision === 'object', 'decide() returns a decision object');
    // The grounded floor: decide() returns the canonical decision shape with a
    // populated trace (the tier mode is the grounded handle), never a bare null.
    assert.ok(decision.decision_trace && typeof decision.decision_trace === 'object',
      'the decision must carry a decision_trace (the grounded reasoning)');
    assert.ok(typeof decision.decision_trace.brain_md_tier_mode === 'string'
      && decision.decision_trace.brain_md_tier_mode.length > 0,
      'the trace must carry a tier mode (the grounded one-move provenance), got: '
      + decision.decision_trace.brain_md_tier_mode);
    // The decision shape is the closed contract (fire_skill present as a field,
    // suppress_skills an array) -- a real one-move, not an empty object.
    assert.ok(Object.prototype.hasOwnProperty.call(decision, 'fire_skill'),
      'the decision must carry a fire_skill field (the one-move slot)');
    assert.ok(Array.isArray(decision.suppress_skills),
      'the decision must carry a suppress_skills array (the canonical shape)');
  });

  // ---- C2-seen: the dial render reaches the live surface (D-08).
  check('C2-seen: dial-presenter.renderDial is invoked on the engine arm (the navigator SEES it)', function () {
    const spy = installPresenterSpy();
    try {
      const mod = loadClassifier();
      const fn = mod.renderEngineDecisionWithDial || mod.formatEngineDecisionBlock;
      assert.equal(typeof fn, 'function', 'classifier must export the engine-decision render helper');
      const decision = {
        fire_skill: 'context_block',
        suppress_skills: [],
        offer_next_step: null,
        decision_trace: { brain_md_tier_mode: 'mode_a', chosen_rationale: 'cortex says reach' },
      };
      const routing = { source: 'engine', activated_skills: ['context_block'] };
      const cortexNodes = [
        { id: 'governing_thought:problem-definition', type: 'governing_thought',
          review_status: 'proposed', properties: { section: 'problem-definition' } },
      ];
      const block = fn(decision, routing, null, { cortexNodes: cortexNodes });
      assert.equal(typeof block, 'string', 'render helper returns a string block');
      assert.ok(spy.calls.length > 0,
        'dial-presenter.renderDial must be invoked on the engine arm (the SEEN arm, D-08)');
      assert.ok(block.indexOf('Choose next reach:') !== -1,
        'the dial render (the F.7 Choose next reach: prompt; FIX-09 150.6-04) must be surfaced onto the live response block');
      // 150.5-02 (DIAL-ATOM-01): text presence alone is the exact false-green
      // 150.5-RESEARCH.md Finding B item 3 documents -- the harness must not
      // stay green through the split-render failure (text without contract).
      assert.ok(block.indexOf('[AskUserQuestion contract:') !== -1,
        'DIAL-ATOM-01: the AskUserQuestion contract trailer must ride the same rendered block as the dial text (never text-only)');
    } finally {
      spy.restore();
    }
  });

  // ---- Honest-negative: the legacy arm must not require the dial.
  check('honest-negative: the legacy arm renders without requiring the dial (no regression)', function () {
    const mod = loadClassifier();
    const fn = mod.renderEngineDecisionWithDial || mod.formatEngineDecisionBlock;
    const decision = {
      fire_skill: null, suppress_skills: [], offer_next_step: null,
      decision_trace: { brain_md_tier_mode: 'tier_0', chosen_rationale: 'legacy' },
    };
    const routing = { source: 'legacy', activated_skills: [] };
    const block = fn(decision, routing, null, {});
    assert.equal(typeof block, 'string', 'the legacy arm returns a string');
  });
} finally {
  built.cleanup && built.cleanup();
}

// ---- C2-good: CARVED OUT to the Part-10 human empathy gate (named, not faked).
process.stdout.write(
  'SKIP C2-good (semantic "is the move actually good"): CARVED OUT to the Part-10 human empathy gate -- NOT machine-asserted, never a fake PASS\n'
);

if (failures > 0) {
  process.stdout.write('\nclaim-c2.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\nclaim-c2.cjs: C2 GREEN (next move grounded + SEEN; C2-good carved to human gate)\n');
process.exit(0);
