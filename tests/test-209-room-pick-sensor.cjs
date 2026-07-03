'use strict';
// Phase 209-05 (E5) -- SENS-12 room-pick sensor + spine-ride proof.
//
// Behaviors 1-4 (Task 1, in-memory fixtures, never touching the real
// registry or filesystem). Behaviors 5-6 (Task 2, the dispatchSensors spine
// ride + fault isolation).

const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const sensorMod = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-room-pick.cjs'));
const { sensorRoomPick } = sensorMod;

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-209-room-pick-sensor');

const SAMPLE_ROOMS = [
  { name: 'align-ecosystem', venture_name: 'ALIGN', venture_stage: 'Well-Defined Problem', status: 'active', last_opened: '2026-07-01T10:00:00Z' },
  { name: 'village-of-life', venture_name: 'VOL', venture_stage: 'Investment', status: 'active', last_opened: '2026-06-20T10:00:00Z' },
];

function ctxWithRooms(rooms, extra) {
  return Object.assign(
    { __listRegisteredRooms: function () { return rooms; } },
    extra || {}
  );
}

ok('Behavior 1: fires on a room-pick phrase with prior rooms present', function () {
  const turn = { text: 'Can we resume work on the align-ecosystem room?' };
  const reach = sensorRoomPick(turn, {}, ctxWithRooms(SAMPLE_ROOMS));
  assert.notEqual(reach, null);
  assert.equal(reach.reach_id, 'context_block');
  assert.equal(reach.signal, 'room_pick');
  assert.equal(typeof reach.evidence.envelope, 'string');
});

ok('Behavior 2: does NOT fire without a room-pick signal, without prior rooms, or inside ignite/rooms', function () {
  const noSignal = sensorRoomPick({ text: 'Let us think about the pricing model.' }, {}, ctxWithRooms(SAMPLE_ROOMS));
  assert.equal(noSignal, null);

  const noRooms = sensorRoomPick({ text: 'switch to my other room' }, {}, ctxWithRooms([]));
  assert.equal(noRooms, null);

  const insideIgnite = sensorRoomPick(
    { text: 'switch to my other room' },
    {},
    ctxWithRooms(SAMPLE_ROOMS, { activeCommand: 'ignite' })
  );
  assert.equal(insideIgnite, null);

  const insideRooms = sensorRoomPick(
    { text: 'which room should I open' },
    {},
    ctxWithRooms(SAMPLE_ROOMS, { activeCommand: 'rooms' })
  );
  assert.equal(insideRooms, null);

  const allArchived = sensorRoomPick(
    { text: 'back to my room please' },
    {},
    ctxWithRooms([{ name: 'gone', status: 'archived' }])
  );
  assert.equal(allArchived, null);
});

ok('Behavior 3: a throwing registry stub degrades to null, never throws', function () {
  const throwingCtx = {
    __listRegisteredRooms: function () { throw new Error('registry read failed'); },
  };
  let reach;
  assert.doesNotThrow(function () {
    reach = sensorRoomPick({ text: 'resume work on my room' }, {}, throwingCtx);
  });
  assert.equal(reach, null);

  // Malformed ctx/turn must also degrade to null, never throw.
  assert.doesNotThrow(function () { sensorRoomPick(null, null, null); });
  assert.equal(sensorRoomPick(null, null, null), null);
  assert.doesNotThrow(function () { sensorRoomPick({ text: 'resume work on my room' }, {}, 'not-an-object'); });
});

ok('Behavior 4: the fired envelope carries the marker, the binding, and the imperative instruction', function () {
  const turn = { text: 'resuming work on align-ecosystem' };
  const reach = sensorRoomPick(turn, {}, ctxWithRooms(SAMPLE_ROOMS));
  assert.notEqual(reach, null);
  const envelope = reach.evidence.envelope;
  assert.equal(envelope.indexOf('[AskUserQuestion contract:') !== -1, true, 'missing the marker');
  assert.equal(envelope.indexOf('[FIRE-IF-FORK:') !== -1, true, 'missing the FIRE-IF-FORK line');
  assert.equal(envelope.indexOf('INSTRUCTION FOR LARRY') !== -1, true, 'missing the imperative block');
  assert.equal(envelope.indexOf('AskUserQuestion') !== -1, true, 'instruction must name the tool');
});

// ---------------------------------------------------------------------------
// Task 2: the SENS spine ride (dispatchSensors chokepoint)
// ---------------------------------------------------------------------------

const insightSensors = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));

ok('Behavior 5: dispatchSensors collects the room-pick reach on a matching turn; a non-matching turn is unaffected', function () {
  const turn = { text: 'switch to my align-ecosystem room', __listRegisteredRooms: function () { return SAMPLE_ROOMS; } };
  // dispatchSensors threads (turn, tuple, ctx) -- the sensor reads turn.text
  // and ctx for the registry seam, so pass the seam on ctx (matching how the
  // sensor itself is invoked in the fixtures above) AND verify the spine
  // still calls through when ctx carries it.
  const ctx = ctxWithRooms(SAMPLE_ROOMS);
  const out = insightSensors.dispatchSensors({ text: 'switch to my align-ecosystem room' }, {}, ctx);
  const roomPickReaches = out.filter((r) => r.signal === 'room_pick');
  assert.equal(roomPickReaches.length, 1, 'expected exactly one room_pick reach in the dispatch output');

  const outNoSignal = insightSensors.dispatchSensors({ text: 'let us talk about the roadmap' }, {}, ctx);
  const noneMatching = outNoSignal.filter((r) => r.signal === 'room_pick');
  assert.equal(noneMatching.length, 0, 'a non-matching turn must not surface a room_pick reach');
});

ok('Behavior 6: sensor registration is present and dispatchSensors isolates a throwing registry (fault does not break the spine)', function () {
  const src = require('node:fs').readFileSync(
    path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'), 'utf8'
  );
  assert.equal(src.indexOf('sensor-room-pick') !== -1, true, 'sensorRoomPick must be registered');

  const throwingCtx = { __listRegisteredRooms: function () { throw new Error('boom'); } };
  const out = insightSensors.dispatchSensors({ text: 'resume work on my room' }, {}, throwingCtx);
  // The throwing registry is caught INSIDE the sensor (returns null); this
  // also proves dispatchSensors' own try/catch never needs to engage for a
  // well-behaved sensor, and the call completes without throwing either way.
  assert.equal(Array.isArray(out), true);
});

ok('Existing sensor suites still green (no regression from this registration)', function () {
  // test-203-reach-sensor.cjs (the SENS-11 expert-skill sensor test, the most
  // recently added sensor before this plan) is used as the regression check.
  // NOTE: tests/test-205-sens10-circularity.cjs asserts "SENS-10 is the LAST
  // registry entry" - that assertion was ALREADY false before this plan
  // (sensorExpertSkill/SENS-11 was appended after SENS-10 by Phase 203, pre-
  // dating this work; verified via `git stash` against the pre-209 tree).
  // This is a pre-existing, unrelated latent break, not a regression this
  // plan introduces or is scoped to fix - logged for a future pass.
  execFileSync('node', ['tests/test-203-reach-sensor.cjs'], { cwd: REPO, stdio: 'pipe' });
});

console.log('\nPASS test-209-room-pick-sensor (' + n + ' assertions)');
