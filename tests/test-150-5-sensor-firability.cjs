'use strict';
/*
 * Phase 150.5-01 Task 1 -- the 16-arm sensor firability suite (SENS-FIX-02).
 * =========================================================================
 *
 * THE PROOF this suite exists to make: every one of the 8 registered sensors
 * has a GREEN fire arm driven through the REAL dispatchSensors with the EXACT
 * production turn shape the hook builds at scripts/intent-classifier.cjs:1351:
 *
 *   turn = { userText, sectionPath, sessionId }
 *
 * NEVER a hand-shaped text/signals key on the turn object itself (the entire
 * 2026-06-09 dead-sensor bug class survived because every existing test
 * hand-shaped the turn). The suite is RED-by-design on pre-seam main: the 5
 * structurally-dead sensors (lagging_component, external_fact, first_material,
 * artifact_filed, methodology_decision via the signals lane) cannot fire from
 * the production shape until dispatchSensors normalizes its input at entry
 * (Task 2: normalizeTurn + deriveTurnSignals + SIGNAL_FRESHNESS_MS).
 *
 * Arms:
 *   - 8 FIRE arms (one per registered sensor), asserted by reach.signal
 *     membership in the dispatchSensors result -- the dispatch chokepoint is
 *     the unit under test, never per-sensor direct calls.
 *   - 8 HONEST-NEGATIVE arms: absent fuel means no fire; a STALE side-channel
 *     (mtime backdated beyond SIGNAL_FRESHNESS_MS) does NOT derive a signal.
 *   - The turn-builder DRIFT FENCE: the production builder source still
 *     constructs exactly { userText, sectionPath, sessionId } and nothing else.
 *   - The NO-MUTATION fence: the caller's turn object gains zero keys across
 *     dispatch (the D-03a structural guarantee -- the enriched text/signals
 *     exist only on the in-dispatch copy, never on the object that flows
 *     toward buildBrainPacket).
 *   - The SEAM-EXPORT arm: normalizeTurn / deriveTurnSignals /
 *     SIGNAL_FRESHNESS_MS are exported (guarded require -- a missing export
 *     reports FAILED, not a crash).
 *
 * Fixtures: tmp roomDirs under os.tmpdir(), obviously-fictional content only,
 * cleaned in finally. Mirrors tests/test-acpt-01-engine-fires.cjs structure.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const sensors = require(path.join(ROOT, 'lib', 'core', 'insight-sensors.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAILED ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// The freshness window. Post-seam this is the exported SIGNAL_FRESHNESS_MS;
// pre-seam (RED) the export is absent and the 30-minute contract value is the
// fallback so the stale arms still backdate far enough either way.
const FRESHNESS_MS = (typeof sensors.SIGNAL_FRESHNESS_MS === 'number')
  ? sensors.SIGNAL_FRESHNESS_MS
  : 30 * 60 * 1000;

/**
 * Build the production turn EXACTLY as the hook does at
 * scripts/intent-classifier.cjs:1351. Three keys, nothing else. The suite
 * NEVER sets turn.text, turn.utterance, or turn.signals on this shape except
 * in the methodology-lane arms (where caller-supplied signals prove the
 * additive merge lane).
 */
function makeTurn(fixtureText) {
  return {
    userText: typeof fixtureText === 'string' ? fixtureText : '',
    sectionPath: null,
    sessionId: 'test-150-5',
  };
}

/** The signal kinds the dispatched reaches carry. */
function firedSignals(reaches) {
  return (Array.isArray(reaches) ? reaches : [])
    .map(function (r) { return r && r.signal; })
    .filter(function (s) { return typeof s === 'string'; });
}

/** Make a tmp fictional roomDir with a .mindrian side-channel dir. */
function makeTmpRoom(tag) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-150-5-' + tag + '-'));
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  return roomDir;
}

function rmTmpRoom(roomDir) {
  if (roomDir) { try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ } }
}

/** Write a fresh last-cascade.json side-channel (the post-write contract shape). */
function writeCascadeSideChannel(roomDir, newFindings) {
  const payload = {
    timestamp: new Date().toISOString(),
    file_path: 'fictional/garden-notes.md',
    section: 'fictional-section',
    cascade_status: 'complete',
    classification: null,
    git_commit: null,
    graph_index: null,
    proactive_intelligence: { newFindings: newFindings },
  };
  const p = path.join(roomDir, '.mindrian', 'last-cascade.json');
  fs.writeFileSync(p, JSON.stringify(payload), 'utf8');
  return p;
}

/** Write a fresh auto-explore fire marker (the Phase 117 contract shape). */
function writeAutoExploreMarker(roomDir) {
  const p = path.join(roomDir, '.mindrian', 'auto-explore-fixture.json');
  fs.writeFileSync(p, JSON.stringify({
    material_id: 'fictional-fixture-material',
    fired_at: new Date().toISOString(),
  }), 'utf8');
  return p;
}

/** Backdate a file's mtime beyond the freshness window (the stale arms). */
function backdateBeyondFreshness(filePath) {
  const staleSec = (Date.now() - (FRESHNESS_MS * 2)) / 1000;
  fs.utimesSync(filePath, staleSec, staleSec);
}

/** Write a jtbd-state.json with a REAL transition (priorSlug !== currentSlug). */
function writeJtbdTransition(roomDir, fromSlug, toSlug) {
  const nowIso = new Date().toISOString();
  const state = {
    version: 1,
    current: {
      jtbd: toSlug,
      confidence: 0.9,
      entered_at: nowIso,
      evidence: [],
      expires_at: null,
    },
    history: [
      { from: fromSlug, to: toSlug, trigger: 'test-fixture', at: nowIso, evidence: [] },
    ],
  };
  fs.writeFileSync(path.join(roomDir, '.mindrian', 'jtbd-state.json'), JSON.stringify(state), 'utf8');
}

// Neutral fixture text: matches NO lagging pattern and NO external-fact pattern.
const NEUTRAL_TEXT = 'we filed three fictional notes about the garden schedule today';

// =====================================================================
// SEAM-EXPORT arm -- guarded: missing exports report FAILED, never crash
// =====================================================================
(function armSeamExports() {
  const label =
    'SEAM EXPORTS: insight-sensors exports normalizeTurn (function) + deriveTurnSignals (function) + SIGNAL_FRESHNESS_MS (number)';
  try {
    assert.equal(typeof sensors.normalizeTurn, 'function',
      label + ': normalizeTurn must be an exported function');
    assert.equal(typeof sensors.deriveTurnSignals, 'function',
      label + ': deriveTurnSignals must be an exported function');
    assert.equal(typeof sensors.SIGNAL_FRESHNESS_MS, 'number',
      label + ': SIGNAL_FRESHNESS_MS must be an exported number');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// DRIFT FENCE -- the production turn builder still constructs EXACTLY
// { userText, sectionPath, sessionId } (scripts/intent-classifier.cjs ~:1351)
// =====================================================================
(function armTurnBuilderDriftFence() {
  const label =
    'DRIFT FENCE: the production turn builder constructs exactly {userText, sectionPath, sessionId} with no text/signals keys';
  try {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'intent-classifier.cjs'), 'utf8');
    const blocks = src.match(/const turn = \{[^}]*\}/g) || [];
    const builderBlock = blocks.find(function (b) {
      return /userText:\s*conversationSeed/.test(b);
    }) || '';
    assert.ok(builderBlock.length > 0,
      label + ': the turn-builder block matching /userText:\\s*conversationSeed/ must exist in the classifier source');
    assert.ok(/userText:\s*conversationSeed/.test(builderBlock),
      label + ': builder must carry userText: conversationSeed');
    assert.ok(/sectionPath:\s*sectionPath/.test(builderBlock),
      label + ': builder must carry sectionPath: sectionPath');
    assert.ok(/sessionId:\s*sessionId/.test(builderBlock),
      label + ': builder must carry sessionId: sessionId');
    assert.ok(!/\btext:/.test(builderBlock),
      label + ': builder must NOT contain a bare text: key (if the hook ever enriches the turn, re-derive this suite)');
    assert.ok(!/\bsignals:/.test(builderBlock),
      label + ': builder must NOT contain a signals: key (if the hook ever enriches the turn, re-derive this suite)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// NO-MUTATION FENCE -- the caller turn object gains zero keys (D-03a)
// =====================================================================
(function armNoMutationFence() {
  const label =
    'NO-MUTATION FENCE: dispatchSensors never mutates the caller turn (keys + bytes identical after dispatch)';
  let roomDir = null;
  try {
    // Force the derivation path (side-channels present) so normalization has
    // every reason to want to enrich -- the copy, never the original.
    roomDir = makeTmpRoom('nomut');
    writeCascadeSideChannel(roomDir, [{ type: 'CONTRADICT', confidence: 0.9 }]);
    writeAutoExploreMarker(roomDir);

    const turn = makeTurn('the data pipeline is the bottleneck');
    const keysBefore = Object.keys(turn).slice().sort().join(',');
    const jsonBefore = JSON.stringify(turn);

    sensors.dispatchSensors(turn, {}, { roomDir: roomDir });

    const keysAfter = Object.keys(turn).slice().sort().join(',');
    const jsonAfter = JSON.stringify(turn);
    assert.equal(keysAfter, keysBefore,
      label + ': the turn must have exactly the same keys after dispatch (no text/signals appear on the original)');
    assert.equal(jsonAfter, jsonBefore,
      label + ': the turn must be byte-identical after dispatch');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// FIRE arm 1 -- lagging_component (production turn shape, userText only)
// =====================================================================
(function armFireLaggingComponent() {
  const label =
    'FIRE lagging_component: production turn {userText: "...the bottleneck"} fires sensor-lagging-component through dispatchSensors';
  try {
    const turn = makeTurn('the data pipeline is the bottleneck');
    const reaches = sensors.dispatchSensors(turn, {}, {});
    assert.ok(firedSignals(reaches).indexOf('lagging_component') !== -1,
      label + ': the dispatch result must contain a reach with signal lagging_component');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// FIRE arm 2 -- external_fact (production turn shape, ACPT-02-style text)
// =====================================================================
(function armFireExternalFact() {
  const label =
    'FIRE external_fact: production turn {userText: "...our competitor...market leader?"} fires sensor-external-fact through dispatchSensors';
  try {
    const turn = makeTurn('how does our competitor position against the market leader?');
    const reaches = sensors.dispatchSensors(turn, {}, {});
    assert.ok(firedSignals(reaches).indexOf('external_fact') !== -1,
      label + ': the dispatch result must contain a reach with signal external_fact');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// FIRE arm 3 -- first_material (fresh auto-explore marker derives the signal)
// =====================================================================
(function armFireFirstMaterial() {
  const label =
    'FIRE first_material: a FRESH .mindrian/auto-explore-fixture.json marker (via ctx.roomDir) fires sensorFirstMaterial through dispatchSensors';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('firstmat');
    writeAutoExploreMarker(roomDir);
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('first_material') !== -1,
      label + ': the dispatch result must contain a reach with signal first_material');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// FIRE arm 4 -- artifact_filed (fresh last-cascade.json derives the signal)
// =====================================================================
(function armFireArtifactFiled() {
  const label =
    'FIRE artifact_filed: a FRESH .mindrian/last-cascade.json with non-empty proactive_intelligence.newFindings fires sensorArtifactFiled through dispatchSensors';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('artfiled');
    writeCascadeSideChannel(roomDir, [{ type: 'CONTRADICT', confidence: 0.9 }]);
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('artifact_filed') !== -1,
      label + ': the dispatch result must contain a reach with signal artifact_filed');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// FIRE arm 5 -- methodology_decision (the MERGE LANE: caller-supplied signals
// on the production-shaped turn are delivered through the seam untouched).
// This arm passes on pre-seam main via passthrough -- asserted anyway as the
// merge-lane regression fence.
// =====================================================================
(function armFireMethodologyDecisionMergeLane() {
  const label =
    'FIRE methodology_decision (merge lane): production turn PLUS caller-supplied signals:["methodology_completed"] fires sensorMethodologyDecision through dispatchSensors';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    turn.signals = ['methodology_completed']; // the ONE sanctioned signals supply (merge-lane proof)
    const reaches = sensors.dispatchSensors(turn, { problem_type: 'wicked' }, {});
    assert.ok(firedSignals(reaches).indexOf('methodology_decision') !== -1,
      label + ': caller-supplied signals must be delivered through the dispatch lane');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// FIRE arm 5b -- the ADDITIVE merge: caller-supplied signals AND derived
// side-channel signals coexist in one dispatch (neither starves the other).
// =====================================================================
(function armFireAdditiveMerge() {
  const label =
    'FIRE additive merge: caller-supplied signals:["methodology_completed"] AND a fresh last-cascade.json both fire in ONE dispatch (the merge is additive)';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('merge');
    writeCascadeSideChannel(roomDir, [{ type: 'INFORMS', confidence: 0.8 }]);
    const turn = makeTurn(NEUTRAL_TEXT);
    turn.signals = ['methodology_completed']; // the merge-lane supply
    const reaches = sensors.dispatchSensors(turn, { problem_type: 'wicked' }, { roomDir: roomDir });
    const signals = firedSignals(reaches);
    assert.ok(signals.indexOf('methodology_decision') !== -1,
      label + ': the caller-supplied methodology signal must survive the merge');
    assert.ok(signals.indexOf('artifact_filed') !== -1,
      label + ': the derived artifact_filed signal must ride alongside the caller signal');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// FIRE arm 6 -- gate_approach (tuple.stage in the commit-near set)
// =====================================================================
(function armFireGateApproach() {
  const label =
    'FIRE gate_approach: tuple {stage: "ready to build"} fires sensorGateApproach through dispatchSensors';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, { stage: 'ready to build' }, {});
    assert.ok(firedSignals(reaches).indexOf('gate_approach') !== -1,
      label + ': the dispatch result must contain a reach with signal gate_approach');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// FIRE arm 7 -- jtbd_changed (a REAL transition in .mindrian/jtbd-state.json)
// =====================================================================
(function armFireJtbdChanged() {
  const label =
    'FIRE jtbd_changed: a REAL jtbd transition (priorSlug !== currentSlug) in .mindrian/jtbd-state.json fires sensorJtbdReweight through dispatchSensors';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('jtbd');
    writeJtbdTransition(roomDir, 'explore', 'fictional-validate-assumption');
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('jtbd_changed') !== -1,
      label + ': the dispatch result must contain a reach with signal jtbd_changed');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// FIRE arm 8 -- memory_cortex (ctx.staleGoverningThought === true)
// =====================================================================
(function armFireMemoryCortex() {
  const label =
    'FIRE memory_cortex: ctx {staleGoverningThought: true} fires sensorMemoryCortex through dispatchSensors';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { staleGoverningThought: true });
    assert.ok(firedSignals(reaches).indexOf('memory_cortex') !== -1,
      label + ': the dispatch result must contain a reach with signal memory_cortex');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 1 -- lagging_component: neutral text, no fire
// =====================================================================
(function armNegLaggingComponent() {
  const label =
    'NEGATIVE lagging_component: neutral text fires no lagging-pattern sensor';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, {});
    assert.ok(firedSignals(reaches).indexOf('lagging_component') === -1,
      label + ': no lagging_component reach on neutral text');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 2 -- external_fact: neutral text, no fire
// =====================================================================
(function armNegExternalFact() {
  const label =
    'NEGATIVE external_fact: neutral text fires no external-fact sensor';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, {});
    assert.ok(firedSignals(reaches).indexOf('external_fact') === -1,
      label + ': no external_fact reach on neutral text');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 3 -- first_material: a STALE auto-explore marker
// (mtime backdated beyond SIGNAL_FRESHNESS_MS) does NOT derive the signal
// =====================================================================
(function armNegFirstMaterialStale() {
  const label =
    'NEGATIVE first_material (stale): a backdated auto-explore marker beyond SIGNAL_FRESHNESS_MS does not fire';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('stalemat');
    const marker = writeAutoExploreMarker(roomDir);
    backdateBeyondFreshness(marker);
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('first_material') === -1,
      label + ': a stale marker must not re-fire the engine arm');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 4 -- artifact_filed: a STALE last-cascade.json
// (mtime backdated beyond SIGNAL_FRESHNESS_MS) does NOT derive the signal
// =====================================================================
(function armNegArtifactFiledStale() {
  const label =
    'NEGATIVE artifact_filed (stale): a backdated last-cascade.json beyond SIGNAL_FRESHNESS_MS does not fire';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('stalecasc');
    const sideChannel = writeCascadeSideChannel(roomDir, [{ type: 'CONTRADICT', confidence: 0.9 }]);
    backdateBeyondFreshness(sideChannel);
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('artifact_filed') === -1,
      label + ': a stale side-channel must not re-fire the engine arm on every later session');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 4b -- artifact_filed: empty newFindings, no fire
// (and NO side-channel at all fires neither file-fuel sensor)
// =====================================================================
(function armNegArtifactFiledEmptyAndAbsent() {
  const label =
    'NEGATIVE file-fuel (absent/empty): no side-channel fires neither file-fuel sensor; a fresh cascade with EMPTY newFindings stays silent';
  let bareRoom = null;
  let emptyRoom = null;
  try {
    // No side-channel at all.
    bareRoom = makeTmpRoom('bare');
    const turnA = makeTurn(NEUTRAL_TEXT);
    const reachesA = sensors.dispatchSensors(turnA, {}, { roomDir: bareRoom });
    const signalsA = firedSignals(reachesA);
    assert.ok(signalsA.indexOf('artifact_filed') === -1 && signalsA.indexOf('first_material') === -1,
      label + ': absent fuel means no file-fuel fire');

    // Fresh cascade, but newFindings is empty.
    emptyRoom = makeTmpRoom('empty');
    writeCascadeSideChannel(emptyRoom, []);
    const turnB = makeTurn(NEUTRAL_TEXT);
    const reachesB = sensors.dispatchSensors(turnB, {}, { roomDir: emptyRoom });
    assert.ok(firedSignals(reachesB).indexOf('artifact_filed') === -1,
      label + ': an empty newFindings array must not fire artifact_filed');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(bareRoom); rmTmpRoom(emptyRoom); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 5 -- methodology_decision: no decision signal, silent
// =====================================================================
(function armNegMethodologyDecision() {
  const label =
    'NEGATIVE methodology_decision: no decision signal on the turn -> methodology sensor silent';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, { problem_type: 'wicked' }, {});
    assert.ok(firedSignals(reaches).indexOf('methodology_decision') === -1,
      label + ': no methodology_decision reach without a decision signal');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 6 -- gate_approach: stage "exploring" is not commit-near
// =====================================================================
(function armNegGateApproach() {
  const label =
    'NEGATIVE gate_approach: tuple {stage: "exploring"} is not commit-near -> gate sensor silent';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, { stage: 'exploring' }, {});
    assert.ok(firedSignals(reaches).indexOf('gate_approach') === -1,
      label + ': no gate_approach reach for a non-commit-near stage');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 7 -- jtbd_changed: no transition (prior === current)
// =====================================================================
(function armNegJtbdChanged() {
  const label =
    'NEGATIVE jtbd_changed: a re-set to the SAME slug (priorSlug === currentSlug) -> reweight sensor silent';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('jtbdsame');
    writeJtbdTransition(roomDir, 'fictional-validate-assumption', 'fictional-validate-assumption');
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('jtbd_changed') === -1,
      label + ': no jtbd_changed reach without a real transition');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 8 -- memory_cortex: no cortex scalars, silent
// =====================================================================
(function armNegMemoryCortex() {
  const label =
    'NEGATIVE memory_cortex: no cortex scalars on ctx -> cortex sensor silent';
  try {
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, {});
    assert.ok(firedSignals(reaches).indexOf('memory_cortex') === -1,
      label + ': no memory_cortex reach without a cortex signal');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  '150.5-01 sensor firability (SENS-FIX-02): ' +
  passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
