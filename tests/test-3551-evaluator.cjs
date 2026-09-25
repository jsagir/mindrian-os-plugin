#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 06 Task 1 (RED) -- test-3551-evaluator: pins
 * lib/core/ambient-trigger.cjs's decision ladder, the single spawn site,
 * the self-bounded wall clock, the closed argv shape and the
 * three-seams-one-claim invariant (AMB-01, AMB-03, AMB-04).
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). Bare node script, no
 * framework, exits non-zero on any assertion failure. House rule: hyphens
 * only, no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

let DatabaseSyncCheck;
try {
  DatabaseSyncCheck = require('node:sqlite').DatabaseSync;
} catch (_e) {
  process.stdout.write('SKIP test-3551-evaluator.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}
void DatabaseSyncCheck;

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { buildDeltaRoom, MARKER_PREFIX } = require('./helpers/fixture-room-3551.cjs');
const guard = require('../scripts/scout-cadence-guard.cjs');
const sensorRoomDelta = require('../lib/core/sensors/sensor-room-delta.cjs');

let evaluator;
try {
  evaluator = require('../lib/core/ambient-trigger.cjs');
} catch (_e) {
  evaluator = null;
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-evaluator:');

assert.ok(evaluator, 'lib/core/ambient-trigger.cjs must exist and load (module missing)');
const {
  evaluateRoomDelta, evaluateAndClaim, evaluateAndMaybeSpawn,
  buildAmbientArgv, ambientIdFor, DECISIONS, AMBIENT_EVAL_BUDGET_MS,
  FIRE_SCRIPT_RELPATH, _internal,
} = evaluator;
assert.strictEqual(typeof evaluateRoomDelta, 'function', 'evaluateRoomDelta must be exported');
assert.strictEqual(typeof evaluateAndClaim, 'function', 'evaluateAndClaim must be exported');
assert.strictEqual(typeof evaluateAndMaybeSpawn, 'function', 'evaluateAndMaybeSpawn must be exported');
assert.strictEqual(typeof buildAmbientArgv, 'function', 'buildAmbientArgv must be exported');
assert.strictEqual(typeof ambientIdFor, 'function', 'ambientIdFor must be exported');
assert.ok(Array.isArray(DECISIONS) && DECISIONS.indexOf('due') !== -1, 'DECISIONS must be a frozen array carrying "due"');
assert.strictEqual(typeof AMBIENT_EVAL_BUDGET_MS, 'number', 'AMBIENT_EVAL_BUDGET_MS must be a number');
assert.strictEqual(typeof FIRE_SCRIPT_RELPATH, 'string', 'FIRE_SCRIPT_RELPATH must be a string');
assert.strictEqual(typeof _internal.setSpawnImpl, 'function', '_internal.setSpawnImpl must be exported');
assert.strictEqual(typeof _internal.resetSpawnImpl, 'function', '_internal.resetSpawnImpl must be exported');

// ---------- fake spawn double, capturing (cmd, args, opts) --------------

let spawnCalls = [];
let unrefCallCount = 0;
function fakeSpawn(cmd, args, opts) {
  spawnCalls.push({ cmd, args, opts });
  return { unref() { unrefCallCount += 1; } };
}
function fakeSpawnThrow() {
  throw new Error('fixture: forced spawn failure (test-3551-evaluator)');
}
function resetSpawnTracking() {
  spawnCalls = [];
  unrefCallCount = 0;
}

_internal.setSpawnImpl(fakeSpawn);

function hex(label, len) {
  return crypto.createHash('sha256').update(String(label)).digest('hex').slice(0, len);
}

const rooms = [];
function trackedRoom(label) {
  const r = buildDeltaRoom(label);
  rooms.push(r);
  return r;
}

try {
  // ---------------------------------------------------------------------
  // Leg: a due room spawns the one fire child with the closed argv shape
  // ---------------------------------------------------------------------
  let spawnedDeltaHash = null;
  (function test_dueRoomSpawns() {
    const room = trackedRoom('spawn');
    room.addClaims(5);
    resetSpawnTracking();

    const res = evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', sessionId: 's1', now: Date.now() });
    assert.strictEqual(res.decision, 'spawned', 'a due room with 5 claims must spawn');
    assert.deepStrictEqual(res.classes, ['a'], 'class a (claim floor) must be the sole fired class');
    assert.strictEqual(spawnCalls.length, 1, 'exactly one spawn call');

    const call = spawnCalls[0];
    assert.strictEqual(call.cmd, process.execPath, 'spawn cmd must be process.execPath');
    const expectedArgv = buildAmbientArgv(
      require('node:path').join(require('node:path').resolve(__dirname, '..'), FIRE_SCRIPT_RELPATH),
      room.roomDir,
      res.delta_hash,
      's1'
    );
    assert.deepStrictEqual(call.args, expectedArgv, 'spawn argv must match buildAmbientArgv exactly');
    assert.strictEqual(call.opts.detached, true, 'opts.detached must be true');
    assert.strictEqual(call.opts.stdio, 'ignore', 'opts.stdio must be ignore');
    assert.strictEqual(call.opts.windowsHide, true, 'opts.windowsHide must be true');
    assert.strictEqual(unrefCallCount, 1, 'unref must be called on the spawned child');

    spawnedDeltaHash = res.delta_hash;
    ok('a due room (class a, 5 claims) spawns the one fire child with the closed argv shape');

    // after that spawn: last-room-delta.json validates with run_state
    // 'started', seam 'stop_hook', classes ['a'], the same delta_hash
    const state = guard.readRoomDeltaState(room.roomDir);
    assert.ok(state, 'the delta-state side channel must exist after a spawn');
    assert.strictEqual(state.run_state, 'started', 'run_state must stay started after a successful spawn');
    assert.strictEqual(state.seam, 'stop_hook');
    assert.deepStrictEqual(state.classes, ['a']);
    assert.strictEqual(state.delta_hash, spawnedDeltaHash);
    ok('the delta-state side channel carries run_state started, the seam, classes and the same delta hash');

    const ledgerRead = guard.readAmbientLedger(room.roomDir);
    assert.ok(ledgerRead.ledger.in_flight, 'the ledger must carry an in_flight claim after a spawn');
    assert.strictEqual(ledgerRead.ledger.in_flight.delta_hash, spawnedDeltaHash, 'in_flight.delta_hash must equal the spawned delta hash');
    ok('the ledger in_flight.delta_hash equals the spawned delta hash');

    // ---------------------------------------------------------------------
    // second evaluateAndMaybeSpawn on the unchanged room: in_flight, no spawn
    // ---------------------------------------------------------------------
    resetSpawnTracking();
    const second = evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', now: Date.now() });
    assert.strictEqual(second.decision, 'in_flight', 'a second call on an unchanged, in-flight room must report in_flight');
    assert.strictEqual(spawnCalls.length, 0, 'in_flight must never spawn');
    ok('a second evaluateAndMaybeSpawn on the unchanged, in-flight room returns in_flight and spawns nothing');

    // after recordAmbientRun for that hash (simulating the child finishing),
    // the ledger's watermark absorbs the 5 claims (class a is an absolute
    // since-bound threshold, per plan 355.1-03's shipped classifyRoomDelta
    // contract), so a real re-evaluation against the SAME unmodified room
    // sees zero new facts and reports no_change, never same_hash -- same_hash
    // is the ladder's guard against a classifier that still detects a
    // delta whose hash matches the last recorded one, which the
    // dedicated stubbed-classifyFn leg below proves directly.
    guard.recordAmbientRun(room.roomDir, {
      deltaHash: spawnedDeltaHash,
      producers: {},
      tierCounts: { strong: 0, indirect: 0, unverified: 0 },
      surfacedVia: 'none',
      now: Date.now(),
    });
    const third = evaluateRoomDelta(room.roomDir, { now: Date.now() });
    assert.strictEqual(third.decision, 'no_change', 'after recordAmbientRun a real re-evaluation of the unmodified room must report no_change (class a is a since-bound threshold that the recorded watermark now absorbs)');
    ok('after recordAmbientRun for that hash, a real re-evaluation of the unmodified room returns no_change (the watermark absorbs the already-counted claims)');
  })();

  // ---------------------------------------------------------------------
  // Leg: same_hash -- the ladder's own guard when a classifier still
  // detects a delta whose hash matches the already-recorded one. Uses a
  // stubbed classifyFn (decoupled from the real since-bound classifier,
  // which structurally cannot reproduce the same hash twice once its own
  // watermark has absorbed the underlying facts) to prove the ladder maps
  // shouldRunAmbient's own same_hash reason straight through.
  // ---------------------------------------------------------------------
  (function test_sameHashLadderMapping() {
    const room = trackedRoom('same-hash');
    const fixedHash = hex('same-hash-fixture', 64);
    function fixedClassify() {
      return {
        changed: true,
        classes: ['a'],
        delta_hash: fixedHash,
        next_watermarks: { claims_created_at: 1, artifacts_created_at: null, contradicts_keys: [], stage: null, children: [] },
      };
    }
    resetSpawnTracking();
    const first = evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', classifyFn: fixedClassify, now: Date.now() });
    assert.strictEqual(first.decision, 'spawned');

    guard.recordAmbientRun(room.roomDir, {
      deltaHash: fixedHash,
      producers: {},
      tierCounts: { strong: 0, indirect: 0, unverified: 0 },
      surfacedVia: 'none',
      now: Date.now(),
    });

    const second = evaluateRoomDelta(room.roomDir, { classifyFn: fixedClassify, now: Date.now() });
    assert.strictEqual(second.decision, 'same_hash', 'a classifier that still detects the already-recorded hash must map to the same_hash decision');
    ok('a classifier still detecting the already-recorded delta hash maps to the same_hash decision via the ladder');
  })();

  // ---------------------------------------------------------------------
  // Leg: baseline on a first evaluation, then class c on a later stage change
  // ---------------------------------------------------------------------
  (function test_baselineThenStageChange() {
    const room = trackedRoom('baseline');
    const first = evaluateRoomDelta(room.roomDir, { now: Date.now() });
    assert.strictEqual(first.decision, 'no_change', 'a room with no claims and no artifacts must report no_change on a first evaluation');
    ok('a room with no claims and no artifacts reports no_change on a first evaluation');

    const ledgerAfterFirst = guard.readAmbientLedger(room.roomDir).ledger;
    assert.ok(Array.isArray(ledgerAfterFirst.watermarks.contradicts_keys), 'the baseline must set the contradicts_keys watermark');
    assert.ok(typeof ledgerAfterFirst.watermarks.stage === 'string', 'the baseline must set the stage watermark');
    assert.ok(Array.isArray(ledgerAfterFirst.watermarks.children), 'the baseline must set the children watermark');
    ok('the first evaluation records the stage, contradicts and children baselines via recordAmbientBaseline');

    room.setStage('Investment');
    const second = evaluateRoomDelta(room.roomDir, { now: Date.now() });
    assert.ok(second.classes.indexOf('c') !== -1, 'a later stage change must fire class c');
    ok('a later venture-stage change evaluates as class c (b, c and d are detectable in a room that has never run)');
  })();

  // ---------------------------------------------------------------------
  // Leg: three seams fired back to back on the same state produce exactly
  // one claim and one spawn (Pitfall 6)
  // ---------------------------------------------------------------------
  (function test_threeSeamsOneClaim() {
    const room = trackedRoom('three-seams');
    room.addClaims(5);
    resetSpawnTracking();

    const stopHook = evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', now: Date.now() });
    assert.strictEqual(stopHook.decision, 'spawned');

    const closeout = evaluateAndMaybeSpawn(room.roomDir, { seam: 'closeout', now: Date.now() });
    assert.notStrictEqual(closeout.decision, 'spawned', 'the closeout seam on the same state must never spawn a second time');

    const material = evaluateAndClaim(room.roomDir, { seam: 'material', materialId: hex('mat-three-seams', 12), now: Date.now() });
    assert.notStrictEqual(material.decision, 'claimed', 'the material seam on the same in-flight state must never claim a second time');

    assert.strictEqual(spawnCalls.length, 1, 'three seams on one state must produce exactly one spawn call');
    ok('three seams (stop_hook, closeout, material) fired back to back on the same state produce exactly one claim and one spawn');
  })();

  // ---------------------------------------------------------------------
  // Leg: throttle, then locked
  // ---------------------------------------------------------------------
  (function test_throttleThenLocked() {
    const room = trackedRoom('throttle');
    room.addClaims(5);
    const t0 = Date.now();
    const claimed = evaluateAndClaim(room.roomDir, { seam: 'stop_hook', now: t0 });
    assert.strictEqual(claimed.decision, 'claimed');
    guard.recordAmbientRun(room.roomDir, {
      deltaHash: claimed.delta_hash,
      producers: {},
      tierCounts: { strong: 0, indirect: 0, unverified: 0 },
      surfacedVia: 'none',
      now: t0,
    });
    room.addClaims(5);
    const throttled = evaluateRoomDelta(room.roomDir, { now: t0 + 10 * 60 * 1000 });
    assert.strictEqual(throttled.decision, 'throttled', 'a completed run in the same hour plus a new delta must report throttled');
    ok('after a completed run in the same hour and a new delta, the decision is throttled');

    const lockedRoom = trackedRoom('locked');
    lockedRoom.addClaims(5);
    const lockNow = Date.now();
    guard.acquireAmbientLock(lockedRoom.roomDir, { now: lockNow });
    const locked = evaluateRoomDelta(lockedRoom.roomDir, { now: lockNow });
    assert.strictEqual(locked.decision, 'locked', 'a fresh lock file must report locked');
    guard.releaseAmbientLock(lockedRoom.roomDir);
    ok('a fresh lock file produces the locked decision');
  })();

  // ---------------------------------------------------------------------
  // Leg: computeDeltaHash / classifyFn is invoked exactly once per evaluation
  // ---------------------------------------------------------------------
  (function test_hashOnce() {
    const room = trackedRoom('hash-once');
    room.addClaims(5);
    let classifyCallCount = 0;
    function countingClassify(facts, watermarks, opts) {
      classifyCallCount += 1;
      return sensorRoomDelta.classifyRoomDelta(facts, watermarks, opts);
    }
    const res = evaluateRoomDelta(room.roomDir, { classifyFn: countingClassify, now: Date.now() });
    assert.strictEqual(res.decision, 'due');
    assert.strictEqual(classifyCallCount, 1, 'the classifier (which computes the delta hash) must run exactly once per evaluation');
    ok('the classifier, and so the delta hash, is computed exactly once per evaluation');
  })();

  // ---------------------------------------------------------------------
  // Leg: budget_exceeded, never claims, never spawns, returns within budget
  // ---------------------------------------------------------------------
  (function test_budgetExceeded() {
    const room = trackedRoom('budget');
    room.addClaims(5);
    resetSpawnTracking();

    const budgetMs = 50;
    function busyReadFacts() {
      const until = Date.now() + budgetMs + 150;
      while (Date.now() < until) { /* busy-wait past the budget on purpose */ }
      return { claims: { count: 0, max_created_at: null }, artifacts: null, contradicts_keys: [], stage_hash: null, children: [] };
    }

    const wallStart = Date.now();
    const res = evaluateAndMaybeSpawn(room.roomDir, { budgetMs, readFacts: busyReadFacts, now: wallStart });
    const elapsed = Date.now() - wallStart;

    assert.strictEqual(res.decision, 'budget_exceeded', 'an over-budget read must report budget_exceeded');
    assert.strictEqual(spawnCalls.length, 0, 'an over-budget evaluation must never spawn');
    assert.ok(elapsed <= budgetMs + 500, 'the whole call must return within budget plus 500 ms, took ' + elapsed + 'ms');

    const ledgerRead = guard.readAmbientLedger(room.roomDir);
    assert.strictEqual(ledgerRead.ledger.in_flight, null, 'an over-budget evaluation must never write a claim');
    ok('an over-budget evaluation reports budget_exceeded, claims nothing, spawns nothing, and returns within budget plus 500 ms');
  })();

  // ---------------------------------------------------------------------
  // Leg: spawn failure rewrites run_state spawn_failed; SENS-21 then fires
  // ---------------------------------------------------------------------
  (function test_spawnFailure() {
    const room = trackedRoom('spawn-failure');
    room.addClaims(5);
    _internal.setSpawnImpl(fakeSpawnThrow);
    try {
      const res = evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', now: Date.now() });
      assert.strictEqual(res.decision, 'spawn_failed', 'a throwing spawn must report spawn_failed');

      const state = guard.readRoomDeltaState(room.roomDir);
      assert.ok(state, 'the delta-state side channel must exist after a spawn failure');
      assert.strictEqual(state.run_state, 'spawn_failed', 'run_state must be rewritten to spawn_failed');
      ok('a throwing spawn rewrites the delta-state side channel to run_state spawn_failed');

      const reach = sensorRoomDelta.sensorRoomDelta({}, {}, { roomDir: room.roomDir });
      assert.ok(reach, 'SENS-21 must fire the honest-fallback reach once run_state is spawn_failed');
      ok('SENS-21 fires the honest-fallback reach once the delta-state side channel shows spawn_failed');
    } finally {
      _internal.setSpawnImpl(fakeSpawn);
    }
  })();

  // ---------------------------------------------------------------------
  // Leg: invalid roomDir always reports no_room and writes nothing
  // ---------------------------------------------------------------------
  (function test_invalidRoomDir() {
    const invalidRoomDirs = [
      'not/an/absolute/path',
      '/tmp/mos-3551-evaluator-definitely-missing-' + crypto.randomBytes(6).toString('hex'),
      '__no_room__',
      '/tmp/mos-3551\nnewline-room',
    ];
    resetSpawnTracking();
    for (const bad of invalidRoomDirs) {
      const res = evaluateRoomDelta(bad, { now: Date.now() });
      assert.strictEqual(res.decision, 'no_room', 'an invalid roomDir (' + JSON.stringify(bad) + ') must report no_room');
      const spawnRes = evaluateAndMaybeSpawn(bad, { now: Date.now() });
      assert.strictEqual(spawnRes.decision, 'no_room', 'evaluateAndMaybeSpawn on an invalid roomDir must also report no_room');
    }
    assert.strictEqual(spawnCalls.length, 0, 'an invalid roomDir must never spawn');
    ok('a relative path, a missing directory, the reserved no-room sentinel and a newline-carrying path all report no_room and write nothing');
  })();

  // ---------------------------------------------------------------------
  // Leg: Part 8 -- no argv element or written file carries the marker; the
  // standard output channel is never touched during an evaluation
  // ---------------------------------------------------------------------
  (function test_part8Clean() {
    const room = trackedRoom('part8');
    room.addClaims(5);
    resetSpawnTracking();

    const originalWrite = process.stdout.write;
    let stdoutCalls = 0;
    process.stdout.write = function () {
      stdoutCalls += 1;
      return true;
    };
    let res;
    try {
      res = evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', sessionId: 's1', now: Date.now() });
    } finally {
      process.stdout.write = originalWrite;
    }
    assert.strictEqual(res.decision, 'spawned');
    assert.strictEqual(stdoutCalls, 0, 'evaluateAndMaybeSpawn must never write to the standard output channel');

    const call = spawnCalls[spawnCalls.length - 1];
    const argvJoined = call.args.join('\u0001');
    assert.strictEqual(argvJoined.indexOf(MARKER_PREFIX), -1, 'no argv element may contain the ' + MARKER_PREFIX + ' marker');

    const fs = require('node:fs');
    const path = require('node:path');
    const stateRaw = fs.readFileSync(path.join(room.roomDir, '.mindrian', 'last-room-delta.json'), 'utf8');
    assert.strictEqual(stateRaw.indexOf(MARKER_PREFIX), -1, 'the delta-state side channel must not contain the ' + MARKER_PREFIX + ' marker');
    const ledgerRaw = fs.readFileSync(path.join(room.roomDir, '.mindrian', 'ambient-run-ledger.json'), 'utf8');
    assert.strictEqual(ledgerRaw.indexOf(MARKER_PREFIX), -1, 'the ambient run ledger must not contain the ' + MARKER_PREFIX + ' marker');
    ok('no argv element and no written file carries the SECRET-3551 marker; the standard output channel is never touched during an evaluation');
  })();

  // ---------------------------------------------------------------------
  // Leg: evaluateAndClaim never spawns
  // ---------------------------------------------------------------------
  (function test_claimNeverSpawns() {
    const room = trackedRoom('claim-only');
    room.addClaims(5);
    resetSpawnTracking();
    const res = evaluateAndClaim(room.roomDir, { seam: 'stop_hook', now: Date.now() });
    assert.strictEqual(res.decision, 'claimed');
    assert.strictEqual(typeof res.delta_hash, 'string');
    assert.deepStrictEqual(res.classes, ['a']);
    assert.strictEqual(spawnCalls.length, 0, 'evaluateAndClaim must never call spawn');
    ok('evaluateAndClaim never spawns and returns claimed with the delta hash and classes when due');
  })();
} finally {
  _internal.resetSpawnImpl();
  for (const room of rooms) room.cleanup();
}

console.log('');
console.log('PASS test-3551-evaluator.cjs (' + checks + ' checks)');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
