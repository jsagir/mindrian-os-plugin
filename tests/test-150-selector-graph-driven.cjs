'use strict';
// Phase 150-06 (MEM-06) -- the 148 selector becomes graph-driven.
// ========================================================================
// Three behaviors, RED-by-design until Tasks 2-3 land:
//
//   A. Graph-driven ranking (MEM-06): a roomState whose reachScores were built
//      by cortex-reach-adapter.buildReachScoresFromCortex(cortexNodes) ranks a
//      DIFFERENT one-move (buildReachList reaches[0]) than the same call with an
//      empty/flat reachScores. The projected cortex shifts the ranking. AND the
//      three frozen 148 contracts are byte-unchanged: MAX_K=3, the 0.70 floor +
//      0.15 margin recommend gate, DIAL_REACH_K=6 (read the constants, assert
//      their values).
//
//   B. Archetype escalation (D-02): resolveArchetype(reachKey) with no second
//      arg returns the static-map archetype byte-stable (the floor); the same
//      call with a cortexState carrying contradiction node-type presence
//      ESCALATES the archetype above its static default; the static map is never
//      lowered.
//
//   C. The adapter retires the flat-file side-channel to fallback only: when
//      cortexNodes are present the adapter's scores win; the new caller is
//      cortex-reach-adapter.cjs, NOT an edit to the pure dial-reach-orchestrator.
//
// RED-by-design: lib/hmi/cortex-reach-adapter.cjs is absent and resolveArchetype
// has no second arg yet, so this suite FAILS until Task 2 lands.
//
// Any forbidden dash codepoint is referenced via String.fromCharCode so THIS
// file stays greppably clean. NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ADAPTER_REL = 'lib/hmi/cortex-reach-adapter.cjs';
const ADAPTER_ABS = path.join(REPO_ROOT, ADAPTER_REL);
const ORCH_ABS = path.join(REPO_ROOT, 'lib/hmi/dial-reach-orchestrator.cjs');
const DISPATCH_ABS = path.join(REPO_ROOT, 'lib/hmi/selector-dispatcher.cjs');

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

// ---------------------------------------------------------------------------
// Frozen-contract assertions (T-150-06-01). Read the orchestrator constants and
// the ranker MAX_K; assert byte-unchanged. These hold REGARDLESS of Task 2/3.
// ---------------------------------------------------------------------------
check('frozen contracts byte-unchanged (MAX_K=3, 0.70/0.15, DIAL_REACH_K=6)', function () {
  const orch = require(ORCH_ABS);
  assert.equal(orch.DIAL_REACH_K, 6, 'DIAL_REACH_K must be frozen at 6');
  assert.equal(orch.RECOMMEND_FLOOR, 0.70, 'RECOMMEND_FLOOR must be frozen at 0.70');
  assert.equal(orch.MARGIN_THRESHOLD, 0.15, 'MARGIN_THRESHOLD must be frozen at 0.15');
  const ranker = require(path.join(REPO_ROOT, 'lib/workflow/f-selector-ranker.cjs'));
  assert.equal(ranker.MAX_K, 3, 'ranker MAX_K must be frozen at 3');
});

// ---------------------------------------------------------------------------
// Behavior A: graph-driven ranking. The adapter folds cortexNodes into a
// reachScores prior map; buildReachList ranks a different one-move than flat.
// ---------------------------------------------------------------------------
check('adapter folds cortexNodes -> reachScores prior map (MEM-06)', function () {
  assert.ok(fs.existsSync(ADAPTER_ABS), ADAPTER_REL + ' must exist');
  const adapter = require(ADAPTER_ABS);
  assert.equal(typeof adapter.buildReachScoresFromCortex, 'function',
    'adapter must export buildReachScoresFromCortex');

  // A cortex carrying a contradiction node + a fresh governing_thought. The
  // adapter should produce a normalized 0..1 prior map keyed by reach_id.
  const cortexNodes = [
    { id: 'contradiction:1', type: 'decision', review_status: 'proposed',
      properties: { kind: 'contradiction' } },
    { id: 'gt:1', type: 'governing_thought', review_status: 'confirmed',
      properties: { freshness: 'fresh' } },
  ];
  const scores = adapter.buildReachScoresFromCortex(cortexNodes);
  assert.ok(scores && typeof scores === 'object', 'scores must be an object map');
  const vals = Object.values(scores);
  assert.ok(vals.length > 0, 'scores map must be non-empty when cortex present');
  for (const v of vals) {
    assert.equal(typeof v, 'number', 'each score is a number');
    assert.ok(v >= 0 && v <= 1, 'each score is normalized 0..1');
  }
});

check('cortex shifts the one-move vs flat reachScores (MEM-06)', function () {
  const adapter = require(ADAPTER_ABS);
  const orch = require(ORCH_ABS);

  const cortexNodes = [
    { id: 'contradiction:1', type: 'decision', review_status: 'proposed',
      properties: { kind: 'contradiction' } },
  ];
  const cortexScores = adapter.buildReachScoresFromCortex(cortexNodes);

  const grounded = orch.buildReachList({
    tierMode: 'mode_a',
    reachScores: cortexScores,
  });
  const flat = orch.buildReachList({
    tierMode: 'mode_a',
    reachScores: {},
  });

  assert.ok(grounded && Array.isArray(grounded.reaches), 'grounded reaches');
  assert.ok(flat && Array.isArray(flat.reaches), 'flat reaches');
  // The cortex-built priors should change the top-ranked reach (or its score).
  const gTop = grounded.reaches[0];
  const fTop = flat.reaches[0];
  const shifted = (gTop.reach_id !== fTop.reach_id) || (gTop.score !== fTop.score);
  assert.ok(shifted, 'cortex priors must shift the ranked one-move');

  // The frozen offered_count stays MAX_K=3.
  assert.equal(grounded.offered_count, Math.min(grounded.total_count, 3),
    'offered_count clamped at MAX_K=3');
});

check('empty cortex -> empty/neutral priors (flat-file fallback path) (D-02)', function () {
  const adapter = require(ADAPTER_ABS);
  const scores = adapter.buildReachScoresFromCortex([]);
  assert.ok(scores && typeof scores === 'object', 'empty cortex returns an object');
  // No cortex priors -> the orchestrator falls back to its existing path.
  assert.equal(Object.keys(scores).length, 0,
    'empty cortex yields no priors so the flat-file path is the fallback');
});

// ---------------------------------------------------------------------------
// Behavior B: resolveArchetype optional cortexState escalation.
// ---------------------------------------------------------------------------
check('resolveArchetype no-arg is byte-stable (the static floor) (D-02)', function () {
  const disp = require(DISPATCH_ABS);
  assert.equal(typeof disp.resolveArchetype, 'function', 'resolveArchetype exported');
  // From reach-component-map.json: context_block -> 'select', hats -> 'confirm'.
  assert.equal(disp.resolveArchetype('context_block'), 'select',
    'static floor for context_block is select');
  assert.equal(disp.resolveArchetype('hats'), 'confirm',
    'static floor for hats is confirm');
  // A miss still defaults to select.
  assert.equal(disp.resolveArchetype('no-such-reach'), 'select',
    'miss defaults to select');
});

check('resolveArchetype with cortexState escalates above the static floor (D-02)', function () {
  const disp = require(DISPATCH_ABS);
  // context_block statically resolves to 'select'. With contradiction node-type
  // presence in the cortex, it must ESCALATE to 'confirm' (a higher-friction
  // gate before acting). The static map is never lowered.
  const cortexState = {
    cortexNodes: [
      { id: 'contradiction:1', type: 'decision', review_status: 'proposed',
        properties: { kind: 'contradiction' } },
    ],
  };
  const escalated = disp.resolveArchetype('context_block', cortexState);
  assert.equal(escalated, 'confirm',
    'contradiction presence escalates context_block select -> confirm');

  // No escalation signal -> back to the static floor.
  const noSignal = disp.resolveArchetype('context_block', { cortexNodes: [] });
  assert.equal(noSignal, 'select',
    'no contradiction signal keeps the static floor');
});

check('resolveArchetype never lowers below the static default (D-02, T-150-06-04)', function () {
  const disp = require(DISPATCH_ABS);
  // hats is statically 'confirm'. An empty cortexState must NOT lower it to
  // 'select' -- the static map is the floor; cortex only escalates.
  const lowered = disp.resolveArchetype('hats', { cortexNodes: [] });
  assert.equal(lowered, 'confirm', 'hats stays confirm; cortex never lowers the floor');
});

// ---------------------------------------------------------------------------
// No-em-dash sweep on the new + edited sources.
// ---------------------------------------------------------------------------
check('no em-dash / en-dash in edited sources', function () {
  const targets = [ADAPTER_ABS, DISPATCH_ABS, ORCH_ABS];
  for (const t of targets) {
    if (!fs.existsSync(t)) continue;
    const src = fs.readFileSync(t, 'utf8');
    assert.equal(src.indexOf(EM_DASH), -1, 'no em-dash in ' + path.basename(t));
    assert.equal(src.indexOf(EN_DASH), -1, 'no en-dash in ' + path.basename(t));
  }
});

if (failures > 0) {
  process.stdout.write('\ntest-150-selector-graph-driven.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\ntest-150-selector-graph-driven.cjs: all assertions passed\n');
process.exit(0);
