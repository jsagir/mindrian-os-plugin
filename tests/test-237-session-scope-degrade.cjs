#!/usr/bin/env node
// Phase 237-04 (REACH-03) -- prove the session-scope filter fails OPEN on
// every non-mismatch state, including the second reader.
//
// This test exists because Pitfall 4 in the phase research is the dangerous
// outcome of this plan: a session-scoping fix that returns an empty signal
// list for every caller, going quiet everywhere and being far harder to
// notice than the bleed it replaced. Every leg below is a GREEN assertion
// that the signal STILL fires (lib/core/session-binding.cjs:115-130's own
// "a false block is worse than a false allow" precedent, applied here to a
// filter rather than a gate).
//
// Four layers, same truth table, so a helper that is correct in isolation
// but wired wrong at a call site is still caught:
//   1. isMarkerOwnedByCaller(markerSessionId, callerSessionId) directly.
//   2. deriveTurnSignals(ctx, sessionId) end to end against a real seeded
//      room, plus a legacy (no session_id at all) leg and a one-argument
//      backward-compatibility leg.
//   3. sensorArtifactFiled(turn, tuple, ctx) directly -- the second
//      independent reader of last-cascade.json, proven scoped rather than
//      assumed to be.
//
// Hermetic env block (tests/test-198-concurrency-mcp.test.cjs:31-45) and an
// explicit assertion-count guard (tests/test-recipe-maps-authority.cjs:
// 31-36, 105-109) so this suite cannot pass having run zero assertions.
//
// Plain node:assert. No test framework. No em-dashes.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const INSIGHT_SENSORS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs');
const insightSensors = require(INSIGHT_SENSORS_PATH);

// ---------------------------------------------------------------------------
// Hermetic env block.
// ---------------------------------------------------------------------------
const savedRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
const savedMcpFirst = process.env.MINDRIAN_MCP_FIRST;
const savedActiveRoom = process.env.CLAUDE_ACTIVE_ROOM;
const savedSessionId = process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

function restoreEnv() {
  if (savedRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = savedRoomsHome;
  if (savedMcpFirst === undefined) delete process.env.MINDRIAN_MCP_FIRST; else process.env.MINDRIAN_MCP_FIRST = savedMcpFirst;
  if (savedActiveRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = savedActiveRoom;
  if (savedSessionId === undefined) delete process.env.CLAUDE_CODE_SESSION_ID; else process.env.CLAUDE_CODE_SESSION_ID = savedSessionId;
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reach03-degrade-'));

// ---------------------------------------------------------------------------
// Fixture helpers -- seed a REAL last-cascade.json marker in a tmp room, the
// same shape scripts/post-write writes (Phase 237-06 adds the session_id key
// to the real writer; this fixture seeds both the pre-fix legacy shape and
// the post-fix session-stamped shape so both are exercised).
// ---------------------------------------------------------------------------
function seedRoom() {
  return fs.mkdtempSync(path.join(tmpRoot, 'room-'));
}

function seedCascadeMarker(roomDir, sessionId) {
  const sideDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(sideDir, { recursive: true });
  const payload = {
    timestamp: new Date().toISOString(),
    file_path: 'tests/fixtures/237-04-degrade.md',
    section: 'fence',
    cascade_status: 'complete',
    proactive_intelligence: {
      newFindings: [{ type: 'CROSS_ROOM', target: '237-04-degrade' }],
    },
  };
  // Only add session_id when explicitly asked to -- omitting the key
  // entirely (not even present as undefined) is the REAL shape of every
  // marker written before Plan 06 lands (every existing room on disk today).
  if (sessionId !== undefined) payload.session_id = sessionId;
  fs.writeFileSync(path.join(sideDir, 'last-cascade.json'), JSON.stringify(payload));
}

function callSensorArtifactFiled(roomDir, callerSessionId) {
  const turn = { signals: ['artifact_filed'], sessionId: callerSessionId };
  const ctx = { roomDir: roomDir };
  return insightSensors.sensorArtifactFiled(turn, {}, ctx);
}

// ---------------------------------------------------------------------------
// Assertion-count guard (tests/test-recipe-maps-authority.cjs:31-36, 105-109
// pattern): the suite cannot pass having run zero assertions.
// ---------------------------------------------------------------------------
let pass = 0;
const EXPECTED_TOTAL = 19;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-237-session-scope-degrade');

try {
  // ---------------------------------------------------------------------
  // Layer 1: isMarkerOwnedByCaller directly.
  // ---------------------------------------------------------------------
  check('isMarkerOwnedByCaller: marker A / caller B -> false (the ONLY suppression: a positive mismatch)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller('A', 'B'), false);
  });
  check('isMarkerOwnedByCaller: marker absent / caller B -> true (legacy marker keeps firing)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller(undefined, 'B'), true);
  });
  check('isMarkerOwnedByCaller: marker A / caller null -> true (an unknown caller cannot prove ownership either way)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller('A', null), true);
  });
  check('isMarkerOwnedByCaller: marker A / caller A -> true (matching ids)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller('A', 'A'), true);
  });
  check('isMarkerOwnedByCaller: marker "" (empty string) / caller B -> true (non-string edge)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller('', 'B'), true);
  });
  check('isMarkerOwnedByCaller: marker undefined / caller B -> true (non-string edge)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller(undefined, 'B'), true);
  });
  check('isMarkerOwnedByCaller: marker 123 (number) / caller B -> true (non-string edge)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller(123, 'B'), true);
  });
  check('isMarkerOwnedByCaller: marker A / caller "" (empty string) -> true (non-string edge)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller('A', ''), true);
  });
  check('isMarkerOwnedByCaller: marker A / caller undefined -> true (non-string edge)', () => {
    assert.strictEqual(insightSensors.isMarkerOwnedByCaller('A', undefined), true);
  });

  // ---------------------------------------------------------------------
  // Layer 2: deriveTurnSignals(ctx, sessionId) end to end against a real
  // seeded room.
  // ---------------------------------------------------------------------
  check('deriveTurnSignals: marker A / caller B -> artifact_filed suppressed (positive mismatch)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, 'A');
    const signals = insightSensors.deriveTurnSignals({ roomDir: roomDir }, 'B');
    assert.ok(signals.indexOf('artifact_filed') === -1);
  });
  check('deriveTurnSignals: marker with NO session_id at all / caller B -> artifact_filed still fires (every existing room on disk today)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, undefined);
    const signals = insightSensors.deriveTurnSignals({ roomDir: roomDir }, 'B');
    assert.ok(signals.indexOf('artifact_filed') !== -1);
  });
  check('deriveTurnSignals: marker A / caller null -> artifact_filed still fires (unknown caller)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, 'A');
    const signals = insightSensors.deriveTurnSignals({ roomDir: roomDir }, null);
    assert.ok(signals.indexOf('artifact_filed') !== -1);
  });
  check('deriveTurnSignals: marker A / caller A -> artifact_filed still fires (matching ids)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, 'A');
    const signals = insightSensors.deriveTurnSignals({ roomDir: roomDir }, 'A');
    assert.ok(signals.indexOf('artifact_filed') !== -1);
  });
  check('deriveTurnSignals: legacy marker (no session_id) / caller with a real session id -> artifact_filed still fires', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, undefined);
    const signals = insightSensors.deriveTurnSignals({ roomDir: roomDir }, '237-degrade-caller');
    assert.ok(signals.indexOf('artifact_filed') !== -1);
  });

  // One-argument backward-compatibility leg (grep target: deriveTurnSignals(ctx) ).
  check('deriveTurnSignals(ctx): single-argument call against a session-stamped marker still fires artifact_filed', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, 'some-other-session');
    const signals = insightSensors.deriveTurnSignals({ roomDir: roomDir });
    assert.ok(signals.indexOf('artifact_filed') !== -1);
  });

  // ---------------------------------------------------------------------
  // Layer 3: sensorArtifactFiled directly -- the second independent reader.
  // ---------------------------------------------------------------------
  check('sensorArtifactFiled: marker A / caller B -> null (suppressed, second reader agrees with the derived signal)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, 'A');
    const reach = callSensorArtifactFiled(roomDir, 'B');
    assert.strictEqual(reach, null);
  });
  check('sensorArtifactFiled: marker absent session_id / caller B -> fires (legacy marker, second reader agrees)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, undefined);
    const reach = callSensorArtifactFiled(roomDir, 'B');
    assert.ok(reach && typeof reach === 'object');
  });
  check('sensorArtifactFiled: marker A / caller null -> fires (unknown caller, second reader agrees)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, 'A');
    const reach = callSensorArtifactFiled(roomDir, null);
    assert.ok(reach && typeof reach === 'object');
  });
  check('sensorArtifactFiled: marker A / caller A -> fires (matching ids, second reader agrees)', () => {
    const roomDir = seedRoom();
    seedCascadeMarker(roomDir, 'A');
    const reach = callSensorArtifactFiled(roomDir, 'A');
    assert.ok(reach && typeof reach === 'object');
  });

  console.log('');
  console.log(`${pass}/${EXPECTED_TOTAL} assertions passed`);
  if (pass !== EXPECTED_TOTAL) {
    console.error('FAIL: expected exactly ' + EXPECTED_TOTAL + ' assertions, got ' + pass);
    process.exitCode = 1;
  }
} catch (e) {
  console.error('FAIL: ' + ((e && e.message) || e));
  if (e && e.stack) console.error(e.stack);
  process.exitCode = 1;
} finally {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) { /* best-effort teardown */ }
  restoreEnv();
}

process.exit(process.exitCode || 0);
