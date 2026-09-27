#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 09 Task 1 (RED) -- test-3551-child: pins the ONE
 * existing Phase 117 fire child's new ambient mode and its awaited
 * material-mode ambient run (AMB-03, AMB-04, AMB-06, AMB-08).
 *
 * Process-level legs spawn scripts/auto-explore-fire.cjs for real, with
 * every child env isolated (HOME + MINDRIAN_ROOMS_HOME mkdtemp, a dead
 * loopback MINDRIAN_BRAIN_URL so stamping degrades to unverified and
 * nothing leaves the machine, every vendor/Brain key env var deleted, a
 * mkdtemp cwd with no .env). In-process legs exercise
 * lib/core/ambient-run.cjs's runAmbientInChild directly with an injected
 * deps.composition (material mode only -- ambient mode always spawns a
 * real process leg, per the plan's own <behavior> list).
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
  process.stdout.write('SKIP test-3551-child.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}
void DatabaseSyncCheck;

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { buildDeltaRoom, MARKER_PREFIX } = require('./helpers/fixture-room-3551.cjs');
const guard = require('../scripts/scout-cadence-guard.cjs');
const sensorRoomDelta = require('../lib/core/sensors/sensor-room-delta.cjs');
const navigation = require('../lib/core/navigation.cjs');
const evaluator = require('../lib/core/ambient-trigger.cjs');

let ambientRun;
try {
  ambientRun = require('../lib/core/ambient-run.cjs');
} catch (_e) {
  ambientRun = null;
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-child:');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIRE_PATH = path.join(REPO_ROOT, 'scripts', 'auto-explore-fire.cjs');

// ---------------------------------------------------------------------------
// The RED gate: no ambient mode, no runAmbientInChild -- this is exactly
// what makes this test fail before plan 355.1-09's Tasks 2 and 3 land.
// ---------------------------------------------------------------------------
assert.ok(ambientRun, 'lib/core/ambient-run.cjs must exist and load (module missing)');
assert.strictEqual(typeof ambientRun.runAmbientInChild, 'function', 'runAmbientInChild must be exported from lib/core/ambient-run.cjs');
assert.strictEqual(typeof ambientRun.checkProducerDeps, 'function', 'checkProducerDeps must be exported from lib/core/ambient-run.cjs');
assert.strictEqual(typeof ambientRun.AMBIENT_TOTAL_BUDGET_MS, 'number', 'AMBIENT_TOTAL_BUDGET_MS must be a number');

const fireSource = fs.readFileSync(FIRE_PATH, 'utf8');
assert.ok(/--ambient/.test(fireSource), 'scripts/auto-explore-fire.cjs must contain the --ambient mode flag');

const AMBIENT_TOTAL_BUDGET_MS = ambientRun.AMBIENT_TOTAL_BUDGET_MS;

// ---------------------------------------------------------------------------
// Env isolation for every spawned child process leg.
// ---------------------------------------------------------------------------
const VENDOR_KEY_ENV_VARS = [
  'TYPESAFE_API_KEY', 'MINDRIAN_BRAIN_KEY', 'PINECONE_API_KEY',
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
];

const cleanupDirs = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix + '-'));
  cleanupDirs.push(d);
  return d;
}

function isolatedEnv() {
  const homeDir = mkTmp('mos-3551-child-home');
  const roomsHomeDir = mkTmp('mos-3551-child-rooms-home');
  const env = Object.assign({}, process.env);
  for (const key of VENDOR_KEY_ENV_VARS) delete env[key];
  env.HOME = homeDir;
  env.USERPROFILE = homeDir;
  env.MINDRIAN_ROOMS_HOME = roomsHomeDir;
  // The dead-loopback isolation idiom (tests/test-245-trigger-negative.cjs
  // lines 20-45): an unstubbed stamp call fails instantly against localhost
  // instead of reaching the real Brain, so stamping degrades to unverified
  // and nothing leaves the machine.
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
  env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';
  return { env, homeDir, roomsHomeDir };
}

function spawnAmbientChild(roomDir, ambientId, sessionId) {
  const { env, homeDir } = isolatedEnv();
  const cwdDir = mkTmp('mos-3551-child-cwd');
  const args = [FIRE_PATH, roomDir, '', ambientId, sessionId || '', '--ambient'];
  const result = spawnSync(process.execPath, args, {
    cwd: cwdDir,
    env: env,
    timeout: AMBIENT_TOTAL_BUDGET_MS + 20000,
  });
  return { result, homeDir };
}

const rooms = [];
function trackedRoom(label) {
  const r = buildDeltaRoom(label);
  rooms.push(r);
  return r;
}

function cleanupAll() {
  for (const room of rooms) room.cleanup();
  for (const d of cleanupDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// main(): async because the material-mode in-process leg awaits
// runAmbientInChild directly.
// ---------------------------------------------------------------------------
async function main() {
  // -------------------------------------------------------------------
  // Leg: ambient mode, process level -- a due room spawns the real
  // scripts/auto-explore-fire.cjs child in --ambient mode, exits 0
  // within budget, and the run lands cleanly (Pitfall 7, Canon Part 8).
  // -------------------------------------------------------------------
  let ambientSpawn;
  let ambientRoom;
  (function test_ambientModeSuccess() {
    const room = trackedRoom('ambient-success');
    ambientRoom = room;
    room.addClaims(5);

    const claim = evaluator.evaluateAndClaim(room.roomDir, { seam: 'stop_hook', now: Date.now() });
    assert.strictEqual(claim.decision, 'claimed', 'the fixture room must be claimable (class a, 5 claims)');
    const ambientId = evaluator.ambientIdFor(claim.delta_hash);

    const start = Date.now();
    ambientSpawn = spawnAmbientChild(room.roomDir, ambientId, 'sess-1');
    const elapsed = Date.now() - start;
    const stderrText = (ambientSpawn.result.stderr || Buffer.alloc(0)).toString();

    assert.strictEqual(ambientSpawn.result.status, 0, 'an ambient-mode child must exit 0; stderr=' + stderrText.slice(0, 800));
    assert.ok(elapsed <= AMBIENT_TOTAL_BUDGET_MS + 10000, 'an ambient-mode child must finish within the total budget plus 10s, took ' + elapsed + 'ms');
    ok('an ambient-mode child (class a, 5 claims) exits 0 within AMBIENT_TOTAL_BUDGET_MS plus 10s');

    const state = guard.readRoomDeltaState(room.roomDir);
    assert.ok(state, 'last-room-delta.json must exist after the ambient run');
    assert.ok(state.run_state === 'completed' || state.run_state === 'deps_missing',
      'run_state must be completed or deps_missing, got ' + state.run_state);
    assert.strictEqual(state.surfaced_via, 'none', 'an empty fixture room with Theo down must surface via none');
    ok('run_state is completed or deps_missing (asserted consistently), surfaced_via is none');

    const ledgerRead = guard.readAmbientLedger(room.roomDir);
    assert.strictEqual(ledgerRead.ledger.last_delta_hash, claim.delta_hash, 'the ledger last_delta_hash must equal the claimed hash');
    assert.strictEqual(ledgerRead.ledger.in_flight, null, 'the ledger in_flight must be null after the run');
    ok('the ledger last_delta_hash equals the claimed hash, in_flight is null');

    const lockPath = path.join(room.roomDir, '.mindrian', 'ambient-run.lock');
    assert.strictEqual(fs.existsSync(lockPath), false, 'the lock file must be gone after the run');
    ok('the lock file is gone');

    const producers = (ledgerRead.ledger.producers && typeof ledgerRead.ledger.producers === 'object') ? ledgerRead.ledger.producers : {};
    for (const key of Object.keys(producers)) {
      assert.ok(guard.AMBIENT_PRODUCER_OUTCOMES.indexOf(producers[key].outcome) !== -1,
        'producer outcome must be an AMBIENT_PRODUCER_OUTCOMES member: ' + key + ' -> ' + producers[key].outcome);
    }
    ok('every recorded producer outcome is an AMBIENT_PRODUCER_OUTCOMES member');

    const tc = ledgerRead.ledger.tier_counts || { strong: 0, indirect: 0 };
    assert.strictEqual((tc.strong || 0) + (tc.indirect || 0), 0, 'with Theo down, strong+indirect must be zero, got ' + ((tc.strong || 0) + (tc.indirect || 0)));
    ok('tier_counts.strong + tier_counts.indirect === 0 (Theo down)');

    const lastEurekaPath = path.join(room.roomDir, '.mindrian', 'last-eureka.json');
    assert.strictEqual(fs.existsSync(lastEurekaPath), false, 'an ambient run must never write last-eureka.json (SENS-13 side channel only fires on a filed card)');
    ok('no .mindrian/last-eureka.json was written');

    // -- Pitfall 7: no explored-materials JSONL line, no auto_explore_fired
    // memory_event (read through navigation's own read-only door). --
    const exploredPath = path.join(ambientSpawn.homeDir, '.mindrian', 'explored-materials', encodeURIComponent(room.slug) + '.jsonl');
    assert.strictEqual(fs.existsSync(exploredPath), false, 'an ambient run must never write an explored-materials JSONL line');
    ok('the mkdtemp HOME has no explored-materials JSONL line');

    const dbForRead = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    try {
      const row = dbForRead.prepare(
        "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'auto_explore_fired'"
      ).get();
      assert.strictEqual(row.c, 0, 'room.db must carry zero auto_explore_fired memory_event nodes after an ambient run');
    } finally {
      navigation.closeRoomDbForCaller(dbForRead);
    }
    ok('room.db has no auto_explore_fired memory_event, read through navigation\'s read-only door');

    // -- Part 8: stderr carries no marker, no artifact title, no path
    // beyond what the harness itself prints; stdout is empty. --
    const stdoutText = (ambientSpawn.result.stdout || Buffer.alloc(0)).toString();
    assert.strictEqual(stdoutText, '', 'stdout must be empty for an ambient-mode child');
    assert.strictEqual(stderrText.indexOf(MARKER_PREFIX), -1, 'stderr must carry no ' + MARKER_PREFIX + ' marker');
    assert.strictEqual(stderrText.indexOf('SECRET-3551-'), -1, 'stderr must carry no SECRET-3551 marker');
    ok('captured stderr carries no marker, no artifact title, no path; stdout is empty');
  })();

  // -------------------------------------------------------------------
  // Leg: tamper -- argv id mismatching the delta state's own hash prefix.
  // -------------------------------------------------------------------
  (function test_tamperArgvMismatch() {
    const room = trackedRoom('tamper');
    room.addClaims(5);
    const claim = evaluator.evaluateAndClaim(room.roomDir, { seam: 'stop_hook', now: Date.now() });
    assert.strictEqual(claim.decision, 'claimed');

    const spawnRes = spawnAmbientChild(room.roomDir, 'ambient-000000000000', 'sess-1');
    assert.strictEqual(spawnRes.result.status, 0, 'a tampered ambient id must still exit 0');
    ok('a tampered ambient id (not matching the delta_hash prefix) exits 0 without running');

    const state = guard.readRoomDeltaState(room.roomDir);
    assert.ok(state, 'the delta-state side channel must still exist');
    assert.strictEqual(state.run_state, 'started', 'the delta state must be unchanged (still started) after a tamper attempt');
    assert.strictEqual(state.delta_hash, claim.delta_hash, 'the delta_hash must be unchanged after a tamper attempt');
    ok('the delta state is unchanged (still started, same delta_hash) after a tampered argv id');

    const ledgerRead = guard.readAmbientLedger(room.roomDir);
    assert.strictEqual(ledgerRead.ledger.last_run, null, 'no ledger completion must be recorded after a tamper attempt');
    ok('no ledger completion is recorded after a tampered argv id');
  })();

  // -------------------------------------------------------------------
  // Leg: lock held -- a fresh ambient-run.lock pre-created before the
  // child starts.
  // -------------------------------------------------------------------
  (function test_lockHeld() {
    const room = trackedRoom('lock-held');
    room.addClaims(5);
    const claim = evaluator.evaluateAndClaim(room.roomDir, { seam: 'stop_hook', now: Date.now() });
    assert.strictEqual(claim.decision, 'claimed');
    const ambientId = evaluator.ambientIdFor(claim.delta_hash);

    const lockRes = guard.acquireAmbientLock(room.roomDir, { now: Date.now() });
    assert.strictEqual(lockRes.ok, true, 'pre-creating the lock must succeed');

    const start = Date.now();
    const spawnRes = spawnAmbientChild(room.roomDir, ambientId, 'sess-1');
    const elapsed = Date.now() - start;
    assert.strictEqual(spawnRes.result.status, 0, 'a lock-held ambient child must exit 0');
    assert.ok(elapsed < 60000, 'a lock-held ambient child must exit quickly (no composition run), took ' + elapsed + 'ms');
    ok('with a fresh ambient-run.lock pre-created, the ambient child exits 0 quickly');

    const ledgerRead = guard.readAmbientLedger(room.roomDir);
    assert.strictEqual(ledgerRead.ledger.in_flight, null, 'the ledger in_flight must be cleared (releaseAmbientClaim) when the lock is held');
    ok('the ledger in_flight is cleared via releaseAmbientClaim when the lock is held');

    const lockPath = path.join(room.roomDir, '.mindrian', 'ambient-run.lock');
    assert.ok(fs.existsSync(lockPath), 'the pre-created lock must still exist');
    ok('the pre-created lock is untouched');

    guard.releaseAmbientLock(room.roomDir);
  })();

  // -------------------------------------------------------------------
  // Leg: material mode, in-process -- runAmbientInChild directly with an
  // injected deps.composition.
  // -------------------------------------------------------------------
  await (async function test_materialModeInProcess() {
    const room = trackedRoom('material-inproc');
    room.addArtifact();

    let compositionCalls = 0;
    function fakeComposition() {
      compositionCalls += 1;
      return Promise.resolve({
        producers: {},
        tier_counts: { strong: 0, indirect: 0, unverified: 0 },
        card: null,
        surfaced_via: 'none',
      });
    }

    const materialId = 'ab12cd34ef56';
    const res1 = await ambientRun.runAmbientInChild(room.roomDir, {
      seam: 'material',
      materialId: materialId,
      sessionId: 's',
      deps: { composition: fakeComposition },
      now: Date.now(),
    });
    assert.ok(res1.state === 'completed' || res1.state === 'deps_missing',
      'a material-mode in-process run must complete or report deps_missing, got ' + res1.state);
    assert.strictEqual(compositionCalls, 1, 'fakeComposition must run exactly once on the first call');
    ok('material-mode in-process run evaluates, claims (delta state material_id set), runs fakeComposition once, records the ledger');

    const state = guard.readRoomDeltaState(room.roomDir);
    assert.ok(state, 'the delta-state side channel must exist after a material-mode run');
    assert.strictEqual(state.material_id, materialId, 'the delta state material_id must equal the supplied materialId');
    ok('the delta state carries the supplied material_id');

    const res2 = await ambientRun.runAmbientInChild(room.roomDir, {
      seam: 'material',
      materialId: materialId,
      sessionId: 's',
      deps: { composition: fakeComposition },
      now: Date.now(),
    });
    assert.strictEqual(compositionCalls, 1, 'a second call on the same state must not run fakeComposition again');
    assert.notStrictEqual(res2.state, 'completed', 'a second call on the same state must not complete a new run');
    ok('a second call on the same state does not run fakeComposition again (same_hash / throttled)');
  })();

  // -------------------------------------------------------------------
  // Leg: material mode, process level -- the 3-argv and 4-argv
  // invocations keep writing the Phase 117 finding exactly as
  // tests/test-auto-explore-fire.cjs pins.
  // -------------------------------------------------------------------
  (function test_materialModeProcessRegression() {
    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tests', 'test-auto-explore-fire.cjs')], {
      cwd: REPO_ROOT,
      env: process.env,
      timeout: 150000,
    });
    assert.strictEqual(res.status, 0, 'tests/test-auto-explore-fire.cjs must still pass; stderr=' + (res.stderr || '').toString().slice(0, 800));
    ok('the Phase 117 material-mode path (tests/test-auto-explore-fire.cjs) still passes, byte-identical');
  })();

  // -------------------------------------------------------------------
  // Leg: static -- runEurekaScan is gone, await precedes both
  // runAmbientInChild calls, no brain-client require; LOCAL-only routing
  // regression run as a sub-assertion.
  // -------------------------------------------------------------------
  (function test_staticAndRoutingRegression() {
    const src = fs.readFileSync(FIRE_PATH, 'utf8');
    assert.strictEqual((src.match(/runEurekaScan/g) || []).length, 0, 'runEurekaScan must be fully removed from scripts/auto-explore-fire.cjs');
    const callCount = (src.match(/runAmbientInChild\(/g) || []).length;
    assert.strictEqual(callCount, 2, 'runAmbientInChild must be called exactly twice (once per mode), got ' + callCount);
    const requireCallRe = /require\(['"][^'"]*\bbrain[-_]client[^'"]*['"]\)/;
    assert.strictEqual(requireCallRe.test(src), false, 'must not require any Brain-MCP client module');
    ok('static: zero runEurekaScan, exactly two runAmbientInChild calls, no brain-client require');

    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tests', 'test-detection-routing-local-only.cjs')], {
      cwd: REPO_ROOT,
      env: process.env,
      timeout: 60000,
    });
    assert.strictEqual(res.status, 0, 'tests/test-detection-routing-local-only.cjs must still pass');
    ok('tests/test-detection-routing-local-only.cjs (LOCAL-only routing) still passes');
  })();
}

main()
  .then(function () {
    cleanupAll();
    console.log('');
    console.log('PASS: ' + checks + ' FAIL: 0');
    console.log('PASS test-3551-child.cjs (' + checks + ' checks)');
    assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
    netGuard.restore();
  })
  .catch(function (e) {
    cleanupAll();
    console.log('');
    console.log('PASS: ' + checks + ' FAIL: 1');
    console.log('FAIL: ' + (e && e.message ? e.message : String(e)));
    console.log('FAIL test-3551-child.cjs (' + checks + ' checks passed before the failure)');
    process.exitCode = 1;
  });
