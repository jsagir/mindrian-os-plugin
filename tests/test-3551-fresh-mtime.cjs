#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 12 -- orchestrator-assigned root-cause fix regression
 * test: isFreshFile's sub-millisecond mtime-ahead-of-Date.now() flake.
 *
 * Root cause (measured on the orchestrator's machine): Date.now() returns
 * an integer millisecond value while fs.Stats#mtimeMs carries sub-
 * millisecond fractions. A file written and then stat'ed within the same
 * millisecond can therefore yield a small NEGATIVE age (measured: 336 of
 * 20,000 immediate write-then-stat pairs, minimum -0.41 ms) -- not clock
 * skew, not a test bug. Every isFreshFile copy required `age >= 0`, so
 * that file read as NOT fresh, the transient behind the flakes in
 * tests/test-3551-double-card.cjs (355.1-10) and
 * tests/test-3551-surfacing.cjs (355.1-11).
 *
 * The fix: one named constant, MTIME_FUTURE_TOLERANCE_MS = 1000, replicated
 * in each of the four isFreshFile copies this phase touches or relies on:
 *   - lib/core/sensors/sensor-room-delta.cjs
 *   - lib/core/sensors/sensor-eureka.cjs
 *   - lib/core/insight-sensors.cjs
 *   - lib/core/sensors/sensor-opportunity-harvest.cjs
 * `age >= -MTIME_FUTURE_TOLERANCE_MS && age <= WINDOW` tolerates the
 * sub-millisecond slop while keeping the WR-01 intent: a GENUINELY
 * future-dated mtime (seconds to years ahead) must still never read as
 * fresh.
 *
 * scripts/scout-cadence-guard.cjs's in-flight-lock staleness check
 * (shouldRunAmbient, line ~612) also has an `age >= 0` literal, but its age
 * is `nowMs - Date.parse(ledger.in_flight.started_at)` -- Date.parse on an
 * ISO string written via `new Date(nowMs).toISOString()` returns an
 * INTEGER millisecond value (ISO-8601 carries millisecond precision, no
 * sub-ms fraction), so both operands are integers and the sub-millisecond
 * race this fix addresses cannot occur there. Its sibling lock-freshness
 * check (line ~634, `(nowMs - st.mtimeMs) <= AMBIENT_LOCK_STALE_MS`) has no
 * `>= 0` floor at all, so a small negative diff still satisfies `<=` and
 * reads correctly as fresh. Neither site is touched by this fix; this
 * reasoning is recorded here rather than in a code comment on a file this
 * plan does not otherwise modify.
 *
 * Four sections:
 *   1. Direct boundary proof against the two copies that export isFreshFile
 *      (sensor-eureka.cjs, sensor-opportunity-harvest.cjs): fs.statSync and
 *      Date.now both stubbed for exact sub-millisecond control.
 *   2. Indirect boundary proof against the two copies that do NOT export
 *      isFreshFile (sensor-room-delta.cjs via sensorRoomDelta(),
 *      insight-sensors.cjs via deriveTurnSignals()): same stub technique,
 *      observed through the public fire/no-fire behavior.
 *   3. Real write-then-check loops (no stubbing) proving zero false
 *      negatives under actual filesystem timing across all four copies.
 *   4. A real, coarse future-mtime negative control (fs.utimesSync, no
 *      stubbing) proving the WR-01 guard still holds against a genuinely
 *      future-dated file on the real filesystem, not just the mock.
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). Bare node script, no
 * framework, exits non-zero on any assertion failure (assert throws).
 * House rule: hyphens only, no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const sensorEureka = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'));
const sensorHarvest = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-opportunity-harvest.cjs'));
const sensorRoomDelta = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-room-delta.cjs'));
const guard = require(path.join(REPO_ROOT, 'scripts', 'scout-cadence-guard.cjs'));
const insightSensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-fresh-mtime:');

assert.strictEqual(typeof sensorEureka.isFreshFile, 'function', 'sensor-eureka.cjs must export isFreshFile');
assert.strictEqual(typeof sensorHarvest.isFreshFile, 'function', 'sensor-opportunity-harvest.cjs must export isFreshFile');
assert.strictEqual(typeof sensorRoomDelta.sensorRoomDelta, 'function', 'sensor-room-delta.cjs must export sensorRoomDelta');
assert.strictEqual(typeof insightSensors.deriveTurnSignals, 'function', 'insight-sensors.cjs must export deriveTurnSignals');

const EUREKA_WINDOW = sensorEureka.EUREKA_SIGNAL_FRESHNESS_MS;
const HARVEST_WINDOW = sensorHarvest.HARVEST_SIGNAL_FRESHNESS_MS;
const ROOM_DELTA_WINDOW = sensorRoomDelta.ROOM_DELTA_FRESHNESS_MS;
const SIGNAL_WINDOW = insightSensors.SIGNAL_FRESHNESS_MS;
assert.strictEqual(EUREKA_WINDOW, 30 * 60 * 1000, 'EUREKA_SIGNAL_FRESHNESS_MS sanity');
assert.strictEqual(HARVEST_WINDOW, 30 * 60 * 1000, 'HARVEST_SIGNAL_FRESHNESS_MS sanity');
assert.strictEqual(ROOM_DELTA_WINDOW, 30 * 60 * 1000, 'ROOM_DELTA_FRESHNESS_MS sanity');
assert.strictEqual(SIGNAL_WINDOW, 30 * 60 * 1000, 'SIGNAL_FRESHNESS_MS sanity');

const MTIME_FUTURE_TOLERANCE_MS = 1000; // pinned equal to each source file's own constant

// ---------------------------------------------------------------------------
// Stub helpers -- fs.statSync is the ONLY fs.statSync call site inside each
// of the four isFreshFile copies (confirmed at plan-execution time via
// `grep -c fs.statSync` against each file), so a path-scoped override never
// disturbs any other read in the same call (readJsonSafe uses existsSync +
// readFileSync, both real).
// ---------------------------------------------------------------------------
function overrideStatSyncForPath(targetPathAbs, mtimeMs) {
  const original = fs.statSync;
  fs.statSync = function (p, opts) {
    if (typeof p === 'string' && path.resolve(p) === targetPathAbs) {
      return { mtimeMs: mtimeMs };
    }
    return original.call(fs, p, opts);
  };
  return function restore() {
    fs.statSync = original;
  };
}

function overrideDateNow(fixedNowMs) {
  const original = Date.now;
  Date.now = function () {
    return fixedNowMs;
  };
  return function restore() {
    Date.now = original;
  };
}

const FIXED_NOW = 1700000000000; // arbitrary fixed epoch ms, exact control

// boundaryCases(windowMs) -> the shared case table every copy is checked
// against: the two literal scenarios the orchestrator named plus the four
// tolerance/window boundary edges.
function boundaryCases(windowMs) {
  return [
    { name: 'age = -0.4ms (sub-ms write-then-stat race) must read fresh', mtimeMs: FIXED_NOW + 0.4, expected: true },
    { name: 'age = -5000ms (genuinely 5s future mtime) must NOT read fresh (WR-01 kept)', mtimeMs: FIXED_NOW + 5000, expected: false },
    { name: 'age = -' + MTIME_FUTURE_TOLERANCE_MS + 'ms exactly at the tolerance boundary must read fresh', mtimeMs: FIXED_NOW + MTIME_FUTURE_TOLERANCE_MS, expected: true },
    { name: 'age = -' + (MTIME_FUTURE_TOLERANCE_MS + 1) + 'ms one past the tolerance boundary must NOT read fresh', mtimeMs: FIXED_NOW + MTIME_FUTURE_TOLERANCE_MS + 1, expected: false },
    { name: 'age = 0 (same instant) must read fresh', mtimeMs: FIXED_NOW, expected: true },
    { name: 'age = window - 1 (just inside the freshness window) must read fresh', mtimeMs: FIXED_NOW - (windowMs - 1), expected: true },
    { name: 'age = window (exactly at the freshness window boundary) must read fresh', mtimeMs: FIXED_NOW - windowMs, expected: true },
    { name: 'age = window + 1 (just outside the freshness window) must NOT read fresh', mtimeMs: FIXED_NOW - (windowMs + 1), expected: false },
  ];
}

// =============================================================================
// SECTION 1 -- direct boundary proof (isFreshFile exported: eureka, harvest).
// =============================================================================

function runDirectBoundary(label, isFreshFileFn, windowMs, probePathAbs) {
  for (const c of boundaryCases(windowMs)) {
    const restoreDate = overrideDateNow(FIXED_NOW);
    const restoreStat = overrideStatSyncForPath(probePathAbs, c.mtimeMs);
    let result;
    try {
      result = isFreshFileFn(probePathAbs);
    } finally {
      restoreStat();
      restoreDate();
    }
    assert.strictEqual(result, c.expected, label + ': ' + c.name + ' (got ' + result + ')');
    ok(label + ': ' + c.name);
  }
}

runDirectBoundary('sensor-eureka.cjs isFreshFile', sensorEureka.isFreshFile, EUREKA_WINDOW,
  path.join(os.tmpdir(), 'mos-3551-fresh-mtime-probe-eureka.json'));
runDirectBoundary('sensor-opportunity-harvest.cjs isFreshFile', sensorHarvest.isFreshFile, HARVEST_WINDOW,
  path.join(os.tmpdir(), 'mos-3551-fresh-mtime-probe-harvest.json'));

// =============================================================================
// SECTION 2 -- indirect boundary proof (isFreshFile NOT exported:
// sensor-room-delta.cjs via sensorRoomDelta(), insight-sensors.cjs via
// deriveTurnSignals()). Same stub technique, observed through public
// fire/no-fire behavior. A real file is written ONCE per module (valid
// content, DEGRADE_STATES / non-empty newFindings) so the freshness gate is
// the only thing the stub varies; the parse-and-classify path after the
// gate runs against real fs reads.
// =============================================================================

const cleanupDirs = [];
function mkRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-fresh-' + label + '-'));
  cleanupDirs.push(root);
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  return roomDir;
}
function cleanupAll() {
  for (const d of cleanupDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

try {
  // -- sensor-room-delta.cjs, via sensorRoomDelta() -----------------------
  (function roomDeltaIndirect() {
    const roomDir = mkRoom('room-delta');
    const sideChannel = path.join(roomDir, sensorRoomDelta.DELTA_STATE_RELPATH);
    const validPayload = {
      schema_version: sensorRoomDelta.DELTA_STATE_SCHEMA_VERSION,
      evaluated_at: new Date().toISOString(),
      seam: 'material',
      classes: ['e'],
      delta_hash: 'a'.repeat(64),
      run_state: 'spawn_failed', // a DEGRADE_STATES member -- the only run_state this sensor fires on
      material_id: 'aa11bb22cc33',
      opportunity_handle: null,
      surfaced_via: null,
      framing: null,
    };
    const res = guard.writeRoomDeltaState(roomDir, validPayload);
    assert.strictEqual(res.ok, true, 'writeRoomDeltaState must accept the fixture state: ' + JSON.stringify(res));

    const probePathAbs = path.resolve(sideChannel);
    for (const c of boundaryCases(ROOM_DELTA_WINDOW)) {
      const restoreDate = overrideDateNow(FIXED_NOW);
      const restoreStat = overrideStatSyncForPath(probePathAbs, c.mtimeMs);
      let fired;
      try {
        fired = !!sensorRoomDelta.sensorRoomDelta({}, {}, { roomDir: roomDir });
      } finally {
        restoreStat();
        restoreDate();
      }
      assert.strictEqual(fired, c.expected, 'sensor-room-delta.cjs sensorRoomDelta: ' + c.name + ' (got ' + fired + ')');
      ok('sensor-room-delta.cjs sensorRoomDelta: ' + c.name);
    }
  })();

  // -- insight-sensors.cjs, via deriveTurnSignals() ------------------------
  (function insightSensorsIndirect() {
    const roomDir = mkRoom('insight-sensors');
    const cascadePath = path.join(roomDir, '.mindrian', 'last-cascade.json');
    fs.writeFileSync(cascadePath, JSON.stringify({
      proactive_intelligence: { newFindings: [{ id: 'fict-001' }] },
      // session_id intentionally omitted: isMarkerOwnedByCaller fails OPEN
      // (fires) when either side cannot prove a mismatch.
    }));

    const probePathAbs = path.resolve(cascadePath);
    for (const c of boundaryCases(SIGNAL_WINDOW)) {
      const restoreDate = overrideDateNow(FIXED_NOW);
      const restoreStat = overrideStatSyncForPath(probePathAbs, c.mtimeMs);
      let fired;
      try {
        fired = insightSensors.deriveTurnSignals({ roomDir: roomDir }, null).indexOf('artifact_filed') !== -1;
      } finally {
        restoreStat();
        restoreDate();
      }
      assert.strictEqual(fired, c.expected, 'insight-sensors.cjs deriveTurnSignals: ' + c.name + ' (got ' + fired + ')');
      ok('insight-sensors.cjs deriveTurnSignals: ' + c.name);
    }
  })();
} finally {
  cleanupAll();
}

// =============================================================================
// SECTION 3 -- real write-then-check loops (NO stubbing): proves the fix
// holds under actual filesystem timing, not just the mock. Each iteration
// overwrites the same probe file (faster than create+unlink) and checks
// immediately; the pre-fix `age >= 0` code measured ~1.68% false negatives
// (336/20000) on this exact write-then-stat pattern.
// =============================================================================

function realWriteThenCheckLoop(label, isFreshFileFn, iterations) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-fresh-real-'));
  cleanupDirs.push(dir);
  const probePath = path.join(dir, 'probe.json');
  let falseNegatives = 0;
  for (let i = 0; i < iterations; i++) {
    fs.writeFileSync(probePath, JSON.stringify({ i: i }));
    if (!isFreshFileFn(probePath)) falseNegatives += 1;
  }
  assert.strictEqual(falseNegatives, 0,
    label + ': ' + falseNegatives + ' of ' + iterations + ' immediate write-then-stat pairs read as NOT fresh (regression of the 355.1-12 root-cause fix)');
  ok(label + ': 0/' + iterations + ' false negatives across real immediate write-then-stat pairs');
}

try {
  realWriteThenCheckLoop('sensor-eureka.cjs isFreshFile (real fs)', sensorEureka.isFreshFile, 5000);
  realWriteThenCheckLoop('sensor-opportunity-harvest.cjs isFreshFile (real fs)', sensorHarvest.isFreshFile, 1000);

  // sensor-room-delta.cjs and insight-sensors.cjs go through their full
  // public entry points (parse + classify on every iteration), so a smaller
  // iteration count keeps this section's wall-clock reasonable while still
  // proving the fix holds end to end, not just at the isFreshFile unit.
  (function realLoopRoomDelta() {
    const roomDir = mkRoom('real-room-delta');
    const sideChannel = path.join(roomDir, sensorRoomDelta.DELTA_STATE_RELPATH);
    const iterations = 200;
    let falseNegatives = 0;
    for (let i = 0; i < iterations; i++) {
      const res = guard.writeRoomDeltaState(roomDir, {
        schema_version: sensorRoomDelta.DELTA_STATE_SCHEMA_VERSION,
        evaluated_at: new Date().toISOString(),
        seam: 'material',
        classes: ['e'],
        delta_hash: 'a'.repeat(64),
        run_state: 'spawn_failed',
        material_id: 'aa11bb22cc33',
        opportunity_handle: null,
        surfaced_via: null,
        framing: null,
      });
      assert.strictEqual(res.ok, true, 'writeRoomDeltaState must accept the fixture state on iteration ' + i);
      if (!sensorRoomDelta.sensorRoomDelta({}, {}, { roomDir: roomDir })) falseNegatives += 1;
    }
    assert.strictEqual(falseNegatives, 0,
      'sensor-room-delta.cjs sensorRoomDelta (real fs): ' + falseNegatives + ' of ' + iterations + ' immediate write-then-fire checks read as NOT fresh');
    ok('sensor-room-delta.cjs sensorRoomDelta (real fs): 0/' + iterations + ' false negatives across real immediate write-then-fire checks');
  })();

  (function realLoopInsightSensors() {
    const roomDir = mkRoom('real-insight-sensors');
    const cascadePath = path.join(roomDir, '.mindrian', 'last-cascade.json');
    const iterations = 200;
    let falseNegatives = 0;
    for (let i = 0; i < iterations; i++) {
      fs.writeFileSync(cascadePath, JSON.stringify({ proactive_intelligence: { newFindings: [{ id: 'fict-' + i }] } }));
      const signals = insightSensors.deriveTurnSignals({ roomDir: roomDir }, null);
      if (signals.indexOf('artifact_filed') === -1) falseNegatives += 1;
    }
    assert.strictEqual(falseNegatives, 0,
      'insight-sensors.cjs deriveTurnSignals (real fs): ' + falseNegatives + ' of ' + iterations + ' immediate write-then-fire checks read as NOT fresh');
    ok('insight-sensors.cjs deriveTurnSignals (real fs): 0/' + iterations + ' false negatives across real immediate write-then-fire checks');
  })();
} finally {
  cleanupAll();
}

// =============================================================================
// SECTION 4 -- real, coarse future-mtime negative control (fs.utimesSync,
// NO stubbing): the WR-01 guard must still hold against a genuinely
// future-dated file on the real filesystem, not just the mocked stat.
// =============================================================================

(function realFutureMtimeNegativeControl() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-fresh-future-'));
  cleanupDirs.push(dir);
  const probePath = path.join(dir, 'future-probe.json');
  fs.writeFileSync(probePath, JSON.stringify({ ok: true }));

  const oneHourAheadSec = (Date.now() / 1000) + 3600; // whole seconds, far past any sub-ms tolerance
  fs.utimesSync(probePath, oneHourAheadSec, oneHourAheadSec);

  assert.strictEqual(sensorEureka.isFreshFile(probePath), false,
    'a real file dated one hour in the future must NOT read as fresh (WR-01 kept, sensor-eureka.cjs)');
  ok('real future-mtime negative control: sensor-eureka.cjs isFreshFile rejects a real file dated 1 hour ahead');

  assert.strictEqual(sensorHarvest.isFreshFile(probePath), false,
    'a real file dated one hour in the future must NOT read as fresh (WR-01 kept, sensor-opportunity-harvest.cjs)');
  ok('real future-mtime negative control: sensor-opportunity-harvest.cjs isFreshFile rejects a real file dated 1 hour ahead');

  cleanupAll();
})();

console.log('');
console.log('PASS test-3551-fresh-mtime.cjs (' + checks + ' checks)');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
