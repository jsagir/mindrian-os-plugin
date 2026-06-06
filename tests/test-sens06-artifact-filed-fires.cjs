'use strict';
/*
 * Phase 143-01 Task 2 -- SENS-06 artifact-filed loop-fires test.
 *
 * SENS-06 is VERIFY over the shipped CASC-01 cascade (Phase 142/95). It does
 * NOT re-implement the cascade. It READS the room-local side-channel that
 * scripts/post-write::write_cascade_side_channel writes
 * (<roomDir>/.mindrian/last-cascade.json) and SURFACES the candidate reach when
 * proactive_intelligence.newFindings is non-empty. The side-channel read mirrors
 * skills/room-proactive/SKILL.md exactly. LOCAL only (Canon Part 8).
 *
 * Loop-fires assertions:
 *   1. Given a last-cascade.json fixture with proactive_intelligence.newFindings
 *      non-empty (a CONTRADICT finding), sensorArtifactFiled returns a reach with
 *      reach_id='contradiction', posture 'pull_back', dispatch referencing the
 *      cascade surface -- the LOOP FIRES.
 *   2. A non-contradiction finding (CONVERGE/cross-section) surfaces reach_id
 *      'cross_room'.
 *   3. Given a missing or empty side-channel, sensorArtifactFiled returns null
 *      (soft-fail, mirrors room-proactive's "do nothing").
 *   4. Dispatch-level: with the artifact-filed signal + a populated side-channel,
 *      dispatchSensors INCLUDES the SENS-06 reach.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------- fixture helpers ----------

function makeRoomWithCascade(newFindings) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sens06-room-'));
  const sideDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(sideDir, { recursive: true });
  const payload = {
    timestamp: '2026-06-06T00:00:00Z',
    file_path: 'problem-definition/claim-1.md',
    section: 'problem-definition',
    cascade_status: 'complete',
    proactive_intelligence: {
      status: 'ok',
      newFindings: newFindings,
    },
  };
  fs.writeFileSync(path.join(sideDir, 'last-cascade.json'), JSON.stringify(payload, null, 2), 'utf8');
  return roomDir;
}

function cleanup(roomDir) {
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

(function test_firesOnContradictFinding() {
  const label = 'SENS-06 fires on artifact-filed with a CONTRADICT finding -> contradiction reach (LOOP FIRES)';
  let roomDir;
  try {
    roomDir = makeRoomWithCascade([
      { type: 'CONTRADICT', section: 'financial-model', confidence: 'high', message: 'x', isNew: true },
    ]);
    const reach = sensors.sensorArtifactFiled(
      { signals: ['artifact_filed'] },
      { problem_type: 'wicked' },
      { roomDir: roomDir }
    );
    assert.ok(reach, label + ': must fire');
    assert.equal(reach.reach_id, 'contradiction', label + ": reach_id is 'contradiction'");
    assert.equal(reach.posture, 'pull_back', label + ": posture is 'pull_back' for contradictions");
    assert.match(reach.dispatch, /cascade|cross-relationship|proactive/,
      label + ': dispatch references the shipped cascade surface');
    ok(label);
  } catch (e) { fail(label, e); } finally { if (roomDir) cleanup(roomDir); }
})();

(function test_crossRoomForNonContradiction() {
  const label = 'SENS-06 surfaces cross_room for a non-contradiction (CONVERGE) finding';
  let roomDir;
  try {
    roomDir = makeRoomWithCascade([
      { type: 'CONVERGE', term: 'regulatory', confidence: 'medium', message: 'x', isNew: true },
    ]);
    const reach = sensors.sensorArtifactFiled(
      { signals: ['artifact_filed'] },
      { problem_type: 'complex' },
      { roomDir: roomDir }
    );
    assert.ok(reach, label + ': must fire');
    assert.equal(reach.reach_id, 'cross_room', label + ": reach_id is 'cross_room' for a non-contradiction edge");
    ok(label);
  } catch (e) { fail(label, e); } finally { if (roomDir) cleanup(roomDir); }
})();

(function test_nullOnEmptyOrMissing() {
  const label = 'SENS-06 returns null on a missing or empty side-channel (soft-fail, mirrors room-proactive)';
  try {
    // Missing roomDir / file.
    assert.equal(
      sensors.sensorArtifactFiled({ signals: ['artifact_filed'] }, {}, { roomDir: '/tmp/no-such-room-xyz' }),
      null, label + ': missing side-channel -> null'
    );
    // Empty newFindings.
    const roomDir = makeRoomWithCascade([]);
    try {
      assert.equal(
        sensors.sensorArtifactFiled({ signals: ['artifact_filed'] }, {}, { roomDir: roomDir }),
        null, label + ': empty newFindings -> null'
      );
    } finally { cleanup(roomDir); }
    // Never throws on null input.
    assert.equal(sensors.sensorArtifactFiled(null, null, null), null, label + ': null input -> null');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchIncludesSens06() {
  const label = 'dispatchSensors includes the SENS-06 reach with the artifact-filed signal + populated side-channel';
  let roomDir;
  try {
    roomDir = makeRoomWithCascade([
      { type: 'CONTRADICT', section: 'market', confidence: 'high', message: 'x', isNew: true },
    ]);
    const out = sensors.dispatchSensors(
      { signals: ['artifact_filed'] },
      { problem_type: 'wicked' },
      { roomDir: roomDir }
    );
    assert.ok(Array.isArray(out), label + ': array');
    const sens06 = out.find(function (r) { return r.reach_id === 'contradiction'; });
    assert.ok(sens06, label + ': a contradiction reach is in the dispatch output');
    ok(label);
  } catch (e) { fail(label, e); } finally { if (roomDir) cleanup(roomDir); }
})();

process.stdout.write('\n');
process.stdout.write('SENS-06 artifact-filed loop-fires: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
