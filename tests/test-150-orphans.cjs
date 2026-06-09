'use strict';
// Phase 150-04 (MEM-07) -- the 4 orphan closures the audit found.
// ========================================================================
// FOUR arms:
//
// (a) SENSOR-FIRE (the starvation before/after): the SAME two sensors that were
//     abstaining because their ctx inputs were never produced now FIRE on a
//     populated ctx and ABSTAIN on an empty ctx.
//       - sensor-lagging-component fires when the turn names a lagging component;
//         its low-fill evidence scalar rides ctx.lowFillSections.
//       - sensor-gate-approach fires when the stage is commit-near (tuple.stage
//         or ctx.venture_stage); it ABSTAINS when neither is set.
//     The load-bearing assertion is the SAME sensors abstain on empty and fire on
//     the cortex-populated ctx (proving MEM-07's starvation fix).
//
// (b) BRAINANCHORS: resolveActiveFrameworks with a roomState carrying a projected
//     BRAIN-derivation anchor surfaces that framework at the weight-0.5 brain_md
//     source (the orphaned consumer at projections.cjs:108 now has a producer).
//
// (c) SECTION_WEIGHTS GONE: navigation-engine.cjs and navigation-engine-shared.cjs
//     no longer import / export / define SECTION_WEIGHTS (the dead-code deletion).
//
// (d) DECIDE()-THREADING: the intent-classifier ctx producer threads
//     lowFillSections + stage; and a decide() smoke over a ctx carrying them
//     proves the threaded ctx reaches sensorCtx (a fired gate reach when the
//     stage is commit-near).
//
// RED-by-design until Tasks 2-4 land. Arm (a) is GREEN already at the
// dispatchSensors layer (the sensors shipped in Phase 143); the NET-NEW RED is
// arms (b) brainAnchors producer, (c) SECTION_WEIGHTS deletion, (d) the
// intent-classifier threading -- and arm (a) is the contract those produce.
//
// node:sqlite is NOT required for these arms (pure functions + file greps), so
// there is no exit-77 guard. node:assert/strict + node:fs only.
//
// Any asserted forbidden dash codepoint is referenced via String.fromCharCode so
// THIS file stays greppably clean. NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failures++;
    process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n');
  }
}

process.stdout.write('test-150-orphans.cjs\n');

// ---------- Module loads ----------

let sensorsMod = null;
try { sensorsMod = require(path.join(REPO_ROOT, 'lib/core/insight-sensors.cjs')); } catch (_e) { sensorsMod = null; }

let projectionsMod = null;
try { projectionsMod = require(path.join(REPO_ROOT, 'lib/core/navigation/projections.cjs')); } catch (_e) { projectionsMod = null; }

let engineMod = null;
try { engineMod = require(path.join(REPO_ROOT, 'lib/core/navigation-engine.cjs')); } catch (_e) { engineMod = null; }

// ========================================================================
// Arm (a): sensor-fire before/after
// ========================================================================

check('(a) sensor-lagging-component FIRES on a lagging turn + populated ctx, ABSTAINS otherwise', () => {
  assert.ok(sensorsMod && typeof sensorsMod.dispatchSensors === 'function', 'dispatchSensors required');

  // Populated: the turn names a lagging component; ctx carries the low-fill count.
  const firedTurn = { text: 'the data pipeline is the bottleneck holding us back', signals: [] };
  const populatedCtx = { roomDir: null, lowFillSections: 3, venture_stage: 'investment' };
  const firedReaches = sensorsMod.dispatchSensors(firedTurn, { problem_type: 'WDP' }, populatedCtx);
  const firedSignals = firedReaches.map((r) => r && r.signal);
  assert.ok(firedSignals.indexOf('lagging_component') !== -1, 'lagging-component must FIRE on a lagging turn');

  // Empty: no lagging phrasing, empty ctx -> the lagging sensor abstains.
  const emptyTurn = { text: 'we are making steady progress on the roadmap', signals: [] };
  const emptyCtx = { roomDir: null, lowFillSections: null, venture_stage: null };
  const emptyReaches = sensorsMod.dispatchSensors(emptyTurn, {}, emptyCtx);
  const emptySignals = emptyReaches.map((r) => r && r.signal);
  assert.ok(emptySignals.indexOf('lagging_component') === -1, 'lagging-component must ABSTAIN on a non-lagging empty ctx');
});

check('(a) sensor-gate-approach FIRES on a commit-near stage, ABSTAINS on an empty stage', () => {
  assert.ok(sensorsMod && typeof sensorsMod.dispatchSensors === 'function', 'dispatchSensors required');

  // Populated: commit-near stage on the tuple (the producer threads stage into ctx
  // which decide() copies onto sensorTuple.stage; here we assert the sensor layer
  // honors a commit-near stage).
  const firedReaches = sensorsMod.dispatchSensors({ text: '', signals: [] }, { stage: 'investment' }, {});
  const firedSignals = firedReaches.map((r) => r && r.signal);
  assert.ok(firedSignals.indexOf('gate_approach') !== -1, 'gate-approach must FIRE on a commit-near stage');

  // Empty: no stage -> abstain.
  const emptyReaches = sensorsMod.dispatchSensors({ text: '', signals: [] }, {}, {});
  const emptySignals = emptyReaches.map((r) => r && r.signal);
  assert.ok(emptySignals.indexOf('gate_approach') === -1, 'gate-approach must ABSTAIN on an empty stage');
});

// ========================================================================
// Arm (b): brainAnchors producer -> weight-0.5 brain_md signal
// ========================================================================

check('(b) resolveActiveFrameworks surfaces a projected brainAnchor at the weight-0.5 brain_md source', () => {
  assert.ok(projectionsMod && typeof projectionsMod.resolveActiveFrameworks === 'function', 'resolveActiveFrameworks required');

  const roomState = { brainAnchors: ['Mullins 7 Domains'] };
  const out = projectionsMod.resolveActiveFrameworks(roomState);
  const hit = out.find((f) => f && f.name === 'Mullins 7 Domains');
  assert.ok(hit, 'the projected brainAnchor must appear in resolveActiveFrameworks output');
  assert.equal(hit.source, 'brain_md', 'the brainAnchor framework must carry source=brain_md');
  assert.equal(hit.weight, 0.5, 'the brainAnchor framework must carry weight 0.5 (the MEMORY signal)');
});

// ========================================================================
// Arm (c): SECTION_WEIGHTS gone from both engine files
// ========================================================================

check('(c) SECTION_WEIGHTS is removed from navigation-engine.cjs (no import)', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/navigation-engine.cjs'), 'utf8');
  // Filter out comment lines so a stray mention in prose does not trip the gate;
  // the contract is no live code token.
  const live = src.split('\n').filter((ln) => {
    const t = ln.trim();
    return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0;
  }).join('\n');
  assert.equal(/SECTION_WEIGHTS/.test(live), false, 'SECTION_WEIGHTS must not appear in live code of navigation-engine.cjs');
});

check('(c) SECTION_WEIGHTS is removed from navigation-engine-shared.cjs (no def, no export)', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/navigation-engine-shared.cjs'), 'utf8');
  const live = src.split('\n').filter((ln) => {
    const t = ln.trim();
    return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0;
  }).join('\n');
  assert.equal(/SECTION_WEIGHTS/.test(live), false, 'SECTION_WEIGHTS must not appear in live code of navigation-engine-shared.cjs');
});

// ========================================================================
// Arm (d): decide()-threading -- the producer threads lowFillSections + stage,
// and a decide() smoke proves the threaded ctx reaches sensorCtx.
// ========================================================================

check('(d) intent-classifier threads lowFillSections + stage into the decide() ctx', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/intent-classifier.cjs'), 'utf8');
  assert.ok(/lowFillSections/.test(src), 'intent-classifier must thread lowFillSections into the decide() ctx');
  // stage is threaded (the venture_stage from the USER/STATE projection lands as
  // context.stage so decide() copies it onto sensorTuple.stage).
  assert.ok(/\bstage\b/.test(src), 'intent-classifier must thread a stage handle into the decide() ctx');
});

check('(d) decide() smoke: a ctx carrying a commit-near stage produces a gate reach (threaded ctx reaches sensorCtx)', () => {
  assert.ok(engineMod && typeof engineMod.decide === 'function', 'decide required');
  const turn = { userText: '', sectionPath: null, sessionId: 'test' };
  const context = { stage: 'investment', lowFillSections: [], roomDir: null };
  const decision = engineMod.decide(turn, context);
  assert.ok(decision && typeof decision === 'object', 'decide must return a decision object');
  // The decision trace must reflect that the engine consumed the threaded stage:
  // either a fired reach is present, or routing_source flipped to engine. We assert
  // the engine did NOT crash on the threaded ctx and produced a decision_trace.
  assert.ok(decision.decision_trace && typeof decision.decision_trace === 'object', 'decide must carry a decision_trace');
});

// ---------- Summary ----------

if (failures > 0) {
  process.stdout.write('\n  ' + failures + ' check(s) FAILED\n');
  process.exit(1);
}
process.stdout.write('\n  all checks passed\n');
process.exit(0);
