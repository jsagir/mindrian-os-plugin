'use strict';
/*
 * Phase 150.8-03 Task 3 (DIKW-11) -- the any-transcript DIKW trigger-invariant
 * ASSERTION. This is a regression FENCE over SHIPPED behavior, NOT a rebuild.
 *
 * RESEARCH finding 6 / TRIG-01: SENS-06 (artifact_filed) ALREADY fires on every
 * filed artifact through the last-cascade.json side-channel that scripts/post-write
 * writes (the 150.6 GATE-0 cascade verdict seam). A filed MEETING transcript
 * artifact is an artifact_filed event like any other, so the DIKW ladder triggers
 * on ANY transcript that lands -- the trigger invariant is already wired.
 *
 * This suite ASSERTS that invariant through the REAL dispatchSensors with the
 * EXACT production turn shape {userText, sectionPath, sessionId} (mirrors the
 * 150.5 sensor-firability harness). It does NOT construct or rebuild the trigger;
 * it drives the shipped chokepoint and checks SENS-06 appears.
 *
 * Arms:
 *   1. FIRE (the invariant): a fixture filing writes a FRESH last-cascade.json
 *      (the artifact_filed side-channel for a filed transcript artifact);
 *      dispatchSensors fed the production turn shape returns a candidate reach
 *      carrying signal 'artifact_filed'. The test FAILS if SENS-06 stops firing
 *      on a filed artifact (the regression fence -- proving the trigger is wired,
 *      not assumed).
 *   2. HONEST NEGATIVE: with NO filed-artifact side-channel, SENS-06 does not
 *      fire -- the assertion has teeth (it is not vacuously true).
 *
 * Fixtures: tmp roomDirs under os.tmpdir(), fictional content only, cleaned in
 * finally. NO em-dashes. NO emoji.
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

// The production turn shape EXACTLY as the hook builds it
// (scripts/intent-classifier.cjs ~:1351): three keys, nothing else. We never
// hand-shape turn.text or turn.signals -- the trigger must fire from the shipped
// side-channel derivation, not a pre-cooked signal bag.
function makeTurn(fixtureText) {
  return {
    userText: typeof fixtureText === 'string' ? fixtureText : '',
    sectionPath: null,
    sessionId: 'test-trigger-invariant',
  };
}

function firedSignals(reaches) {
  return (Array.isArray(reaches) ? reaches : [])
    .map(function (r) { return r && r.signal; })
    .filter(function (s) { return typeof s === 'string'; });
}

function makeTmpRoom(tag) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-trig-' + tag + '-'));
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  return roomDir;
}

function rmTmpRoom(roomDir) {
  if (roomDir) { try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {} }
}

// Write a FRESH last-cascade.json representing a FILED MEETING TRANSCRIPT
// artifact (the artifact_filed side-channel; the post-write contract shape, same
// as the 150.5 harness). A filed transcript is an artifact_filed event like any
// other -- that is the any-transcript invariant under test.
function writeFiledTranscriptCascade(roomDir, newFindings) {
  const payload = {
    timestamp: new Date().toISOString(),
    file_path: 'meetings/2026-06-11-fictional-standup/transcript.md',
    section: 'meetings',
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

// Neutral text: matches no other sensor pattern, so any fire must come from the
// filed-artifact side-channel, never from the userText.
const NEUTRAL_TEXT = 'we filed a fictional meeting transcript about the garden schedule today';

// =====================================================================
// FIRE arm -- THE INVARIANT: a filed transcript artifact fires SENS-06
// =====================================================================
(function armTriggerInvariantFires() {
  const label =
    'TRIGGER INVARIANT: a filed transcript artifact (fresh last-cascade.json) fires SENS-06 artifact_filed through dispatchSensors (any-transcript trigger is wired, ASSERTED)';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('filed');
    writeFiledTranscriptCascade(roomDir, [{ type: 'INFORMS', confidence: 0.85 }]);
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('artifact_filed') !== -1,
      label + ': dispatchSensors must surface a reach with signal artifact_filed for a filed transcript artifact');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// FIRE arm 2 -- a CONTRADICT finding on the filed transcript still fires
// SENS-06 (the invariant holds regardless of the finding edge type)
// =====================================================================
(function armTriggerInvariantFiresContradict() {
  const label =
    'TRIGGER INVARIANT (contradict): a filed transcript whose cascade surfaced a CONTRADICT finding still fires SENS-06 artifact_filed';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('filedcon');
    writeFiledTranscriptCascade(roomDir, [{ type: 'CONTRADICT', confidence: 0.9 }]);
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('artifact_filed') !== -1,
      label + ': artifact_filed must fire on a filed transcript regardless of the finding edge type');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// HONEST-NEGATIVE arm -- no filed-artifact signal, SENS-06 does NOT fire.
// Proves the assertion has teeth (it is not vacuously true).
// =====================================================================
(function armTriggerInvariantHonestNegative() {
  const label =
    'HONEST NEGATIVE: with NO filed-artifact side-channel, SENS-06 artifact_filed does not fire (the assertion has teeth)';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('nofile');
    // No last-cascade.json at all.
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('artifact_filed') === -1,
      label + ': artifact_filed must not fire without a filed-artifact side-channel');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

// =====================================================================
// HONEST-NEGATIVE arm 2 -- a fresh cascade with EMPTY newFindings stays
// silent (a filing that produced nothing new is not a trigger).
// =====================================================================
(function armTriggerInvariantEmptyFindings() {
  const label =
    'HONEST NEGATIVE (empty findings): a filed transcript whose cascade produced an EMPTY newFindings array does not fire SENS-06';
  let roomDir = null;
  try {
    roomDir = makeTmpRoom('emptyfind');
    writeFiledTranscriptCascade(roomDir, []);
    const turn = makeTurn(NEUTRAL_TEXT);
    const reaches = sensors.dispatchSensors(turn, {}, { roomDir: roomDir });
    assert.ok(firedSignals(reaches).indexOf('artifact_filed') === -1,
      label + ': an empty newFindings array must not fire artifact_filed');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmTmpRoom(roomDir); }
})();

process.stdout.write('\n');
process.stdout.write(
  '150.8-03 trigger invariant (DIKW-11): ' +
  passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
