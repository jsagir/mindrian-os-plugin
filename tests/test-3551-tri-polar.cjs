#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 14 Task 1 (RED then GREEN) -- test-3551-tri-polar: pins
 * the AMB-06 go-live wiring on all three surfaces (CLI, Desktop, Cowork)
 * plus PRD AC1 end to end, after the single checkpoint approved it.
 *
 * CLI leg: scripts/ambient-stop.cjs, spawned for real (--dry-run and real),
 * against an isolated HOME with MINDRIAN_ROOMS_HOME pointed at the fixture
 * room's own roomsHome (the SAME files this test's own process wrote via
 * bindSession/addClaims, so the child resolves the real session binding and
 * the real room). Desktop/Cowork legs: in process, driving
 * lib/mcp/stop-gate-handler.cjs's real handleStopEvent/closeOutRoom with the
 * module-level spawn seam captured (lib/core/ambient-trigger.cjs's own
 * _internal.setSpawnImpl). AC1 end to end: a real evaluateAndMaybeSpawn
 * claim, a real runAmbientInChild composition with injected adapters (the
 * SAME real production code path tests/test-3551-mcp-fire-once.cjs's
 * seedIndirectComposition idiom uses, never a hand-rolled stub), a real
 * dispatchCandidateReaches pull, a real closeOutRoom mark.
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). House rule: hyphens only,
 * no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-3551-tri-polar.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const ambientTrigger = require('../lib/core/ambient-trigger.cjs');
const ambientRun = require('../lib/core/ambient-run.cjs');
const guard = require('../scripts/scout-cadence-guard.cjs');
const stopGateHandler = require('../lib/mcp/stop-gate-handler.cjs');
const sensorsTool = require('../lib/mcp/tools/sensors.cjs');
const surfacedOffers = require('../lib/mcp/surfaced-offers.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-tri-polar:');

const REPO_ROOT = path.resolve(__dirname, '..');
const AMBIENT_STOP_PATH = path.join(REPO_ROOT, 'scripts', 'ambient-stop.cjs');
const HOOKS_JSON_PATH = path.join(REPO_ROOT, 'hooks', 'hooks.json');
// 355.1-BASELINE.md's own BASE_3551 sha. `git log 2f5109bef..HEAD --
// hooks/hooks.json` was empty at the time this test was written, so every
// non-Stop array in the current file must still deep-equal this tree.
const BASE_3551 = '2f5109bef';

// ---------------------------------------------------------------------------
// Env isolation for every spawned CLI child process.
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

const rooms = [];
function trackedRoom(label) {
  const r = buildDeltaRoom(label);
  rooms.push(r);
  return r;
}

function cleanupAll() {
  for (const room of rooms) {
    try { room.cleanup(); } catch (_e) { /* best effort */ }
  }
  for (const d of cleanupDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// isolatedEnv(room) -- an isolated HOME/cwd for the CLI child process, with
// MINDRIAN_ROOMS_HOME pointed at the fixture room's OWN roomsHome (so the
// child resolves the SAME session binding + registry this test's own
// process wrote), a dead-loopback Brain URL (nothing leaves the machine)
// and every vendor key deleted.
function isolatedEnv(room) {
  const homeDir = mkTmp('mos-3551-tripolar-home');
  const env = Object.assign({}, process.env);
  for (const key of VENDOR_KEY_ENV_VARS) delete env[key];
  env.HOME = homeDir;
  env.USERPROFILE = homeDir;
  env.MINDRIAN_ROOMS_HOME = room.roomsHome;
  // The dead-loopback isolation idiom (tests/test-3551-child.cjs): an
  // unstubbed stamp call fails instantly against localhost instead of
  // reaching the real Brain, so stamping degrades to unverified and
  // nothing leaves the machine.
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
  env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';
  return env;
}

function spawnAmbientStop(room, stdinObj, extraArgv) {
  const cwdDir = mkTmp('mos-3551-tripolar-cwd');
  const args = ['--stop'].concat(Array.isArray(extraArgv) ? extraArgv : []);
  return spawnSync(process.execPath, [AMBIENT_STOP_PATH].concat(args), {
    cwd: cwdDir,
    env: isolatedEnv(room),
    input: JSON.stringify(stdinObj || {}),
    timeout: 15000,
  });
}

// resetBetween() -- reset the handler, surfaced-offers and the spawn seam
// between legs (a required per-leg discipline: several legs share
// process-level state).
function resetBetween() {
  try { stopGateHandler._resetForTest(); } catch (_e) { /* best effort */ }
  try { surfacedOffers._resetForTest(); } catch (_e) { /* best effort */ }
  try { ambientTrigger._internal.resetSpawnImpl(); } catch (_e) { /* best effort */ }
}

// ---------------------------------------------------------------------------
// seedIndirectComposition -- the SAME real production code path
// tests/test-3551-mcp-fire-once.cjs's own helper uses: the REAL
// runAmbientComposition (lib/core/ambient-run.cjs) with an injected adapter
// returning ONE finding carrying an indirect stamp, and an injected
// measureAndGuard that always clears, so the resulting last-eureka.json side
// channel + opportunity node are the SAME shape production writes.
// ---------------------------------------------------------------------------
const INDIRECT_STAMP = Object.freeze({
  verification: 'indirect', backend: 'theo', direction: 'structural_transfer', judge: 'none',
  path: Object.freeze({
    nodes: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    labels: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    edges: ['EXTENDS'],
  }),
});

function eurekaReachesOf(reaches) {
  return (Array.isArray(reaches) ? reaches : []).filter((r) => r && r.signal === 'eureka_bridge');
}

async function seedIndirectComposition(roomDir, stamp, seed) {
  const suffix = (typeof seed === 'string' && seed) ? seed : '';
  const finding = {
    producer: 'eureka',
    a: { handle: 'nodeA' + suffix, text: 'alpha finding text' + suffix },
    b: { handle: 'nodeB' + suffix, text: 'omega finding text' + suffix },
    stamp: stamp,
    rank: 0,
  };
  const adapters = {
    eureka: async () => ({ outcome: 'no_candidate', findings: [finding] }),
    'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
    'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
    hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
    whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
  };
  const measureAndGuard = async () => ({
    ok: true,
    score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'opportunity', passes: true, semantic: 0.1, lexical: 0.1 },
    guard: { cleared: true, verdict: 'transferable', confidence: 'high', tags: [] },
  });
  const res = await ambientRun.runAmbientComposition(roomDir, { deps: { adapters: adapters, measureAndGuard: measureAndGuard } });
  if (!res || !res.card) throw new Error('seedIndirectComposition: expected a card, got: ' + JSON.stringify(res));
  return res;
}

// ---------------------------------------------------------------------------
// CLI leg, dry run.
// ---------------------------------------------------------------------------
function legCliDryRun() {
  process.stdout.write('\n-- CLI leg, dry run --\n');
  resetBetween();
  const room = trackedRoom('cli-dry-run');
  room.addClaims(5);
  const sessionId = 'sess-cli-dry-run';
  room.bindSession(sessionId);

  const start = Date.now();
  const res = spawnAmbientStop(room, { session_id: sessionId, cwd: room.roomDir }, ['--dry-run']);
  const elapsed = Date.now() - start;
  const stderrText = (res.stderr || Buffer.alloc(0)).toString();

  assert.strictEqual(res.status, 0, 'a dry-run ambient-stop.cjs must exit 0; stderr=' + stderrText.slice(0, 800));
  assert.ok(elapsed <= 8000, 'a dry-run ambient-stop.cjs must exit well within its 5s hook timeout, took ' + elapsed + 'ms');
  ok('CLI dry-run: exits 0 within budget');

  const stdoutText = (res.stdout || Buffer.alloc(0)).toString().trim();
  let parsed = null;
  try { parsed = JSON.parse(stdoutText); } catch (_e) { parsed = null; }
  assert.ok(parsed, 'dry-run must print exactly one JSON line, got: ' + stdoutText);
  assert.strictEqual(parsed.decision, 'spawned', 'a due room (5 claims) must decide spawned in dry-run');
  assert.ok(Array.isArray(parsed.argv), 'the printed line must carry an argv array');
  assert.strictEqual(parsed.argv[parsed.argv.length - 1], '--ambient', 'argv must end with --ambient');
  assert.ok(/^ambient-[0-9a-f]{12}$/.test(parsed.argv[3]), 'argv[3] must be ambient- plus 12 hex, got ' + parsed.argv[3]);
  ok('CLI dry-run: prints one JSON line { decision: spawned, argv } ending with --ambient and an ambient- id');

  const state = guard.readRoomDeltaState(room.roomDir);
  assert.ok(state, 'last-room-delta.json must exist after the dry-run claim');
  assert.strictEqual(state.run_state, 'started', 'run_state must be started after the dry-run claim');
  assert.strictEqual(state.seam, 'stop_hook', 'seam must be stop_hook');
  ok('CLI dry-run: last-room-delta.json run_state started, seam stop_hook');

  console.log('PASS CLI (dry-run)');
}

// ---------------------------------------------------------------------------
// CLI leg, real (no --dry-run): exits 0 with empty stdout, the detached
// child then completes.
// ---------------------------------------------------------------------------
function legCliReal() {
  process.stdout.write('\n-- CLI leg, real --\n');
  resetBetween();
  const room = trackedRoom('cli-real');
  room.addClaims(5);
  const sessionId = 'sess-cli-real';
  room.bindSession(sessionId);

  const start = Date.now();
  const res = spawnAmbientStop(room, { session_id: sessionId, cwd: room.roomDir });
  const elapsed = Date.now() - start;
  const stderrText = (res.stderr || Buffer.alloc(0)).toString();

  assert.strictEqual(res.status, 0, 'a real ambient-stop.cjs must exit 0; stderr=' + stderrText.slice(0, 800));
  assert.ok(elapsed <= 8000, 'a real ambient-stop.cjs must exit within budget, took ' + elapsed + 'ms');
  const stdoutText = (res.stdout || Buffer.alloc(0)).toString();
  assert.strictEqual(stdoutText, '', 'a real (non-dry-run) ambient-stop.cjs must print nothing to stdout');
  ok('CLI real: exits 0 within budget with empty stdout');

  const deadline = Date.now() + ambientRun.AMBIENT_TOTAL_BUDGET_MS + 10000;
  let completed = false;
  while (Date.now() < deadline) {
    const ledgerRead = guard.readAmbientLedger(room.roomDir);
    if (ledgerRead.ledger && ledgerRead.ledger.in_flight === null) {
      completed = true;
      break;
    }
    // Synchronous poll wait (no setTimeout callback needed in this
    // synchronous function): a private SharedArrayBuffer used purely as an
    // Atomics.wait sleep timer, never shared with anything else.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.ok(completed, 'the detached ambient child must clear in_flight within budget');
  const state = guard.readRoomDeltaState(room.roomDir);
  assert.ok(state && (state.run_state === 'completed' || state.run_state === 'deps_missing'),
    'the detached child must complete or report deps_missing, got ' + (state && state.run_state));
  ok('CLI real: the detached child completes (run_state completed or deps_missing)');

  console.log('PASS CLI (real)');
}

// ---------------------------------------------------------------------------
// CLI leg, no-ops: stop_hook_active true, no bound room, malformed stdin.
// ---------------------------------------------------------------------------
function legCliNoOps() {
  process.stdout.write('\n-- CLI leg, no-ops --\n');
  resetBetween();

  const roomA = trackedRoom('cli-noop-active');
  roomA.addClaims(5);
  const sessA = 'sess-cli-noop-active';
  roomA.bindSession(sessA);
  const resA = spawnAmbientStop(roomA, { session_id: sessA, stop_hook_active: true });
  assert.strictEqual(resA.status, 0, 'stop_hook_active true must still exit 0');
  assert.strictEqual((resA.stdout || Buffer.alloc(0)).toString(), '', 'stop_hook_active true must print nothing');
  assert.strictEqual(guard.readRoomDeltaState(roomA.roomDir), null, 'stop_hook_active true must write nothing');
  ok('CLI no-op: stop_hook_active true exits 0 and writes nothing');

  const roomB = trackedRoom('cli-noop-unbound');
  const resB = spawnAmbientStop(roomB, { session_id: 'sess-cli-noop-unbound-' + Date.now() });
  assert.strictEqual(resB.status, 0, 'an unbound session must still exit 0');
  assert.strictEqual((resB.stdout || Buffer.alloc(0)).toString(), '', 'an unbound session must print nothing');
  ok('CLI no-op: a session with no bound room exits 0 and writes nothing');

  const roomC = trackedRoom('cli-noop-malformed');
  const cwdDir = mkTmp('mos-3551-tripolar-cwd');
  const resC = spawnSync(process.execPath, [AMBIENT_STOP_PATH, '--stop'], {
    cwd: cwdDir,
    env: isolatedEnv(roomC),
    input: 'not json at all {{{',
    timeout: 15000,
  });
  assert.strictEqual(resC.status, 0, 'malformed stdin must still exit 0');
  ok('CLI no-op: malformed stdin exits 0');

  console.log('PASS CLI (no-ops)');
}

// ---------------------------------------------------------------------------
// hooks.json: exactly one async Stop entry; every other entry unchanged.
// ---------------------------------------------------------------------------
function legHooksJson() {
  process.stdout.write('\n-- hooks.json: exactly one async Stop entry, everything else unchanged --\n');
  const cur = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf8'));
  const baseRaw = execFileSync('git', ['show', BASE_3551 + ':hooks/hooks.json'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const base = JSON.parse(baseRaw);

  for (const key of Object.keys(base.hooks)) {
    if (key === 'Stop') continue;
    assert.deepStrictEqual(cur.hooks[key], base.hooks[key], 'hooks.json[' + key + '] must be unchanged from BASE_3551');
  }
  ok('hooks.json: every non-Stop array is byte-identical to BASE_3551');

  assert.strictEqual(cur.hooks.Stop.length, base.hooks.Stop.length + 1, 'exactly one new Stop entry beyond BASE_3551');
  for (const entry of base.hooks.Stop) {
    const stillPresent = cur.hooks.Stop.some((e) => JSON.stringify(e) === JSON.stringify(entry));
    assert.ok(stillPresent, 'every BASE_3551 Stop entry must survive unchanged: ' + JSON.stringify(entry));
  }
  ok('hooks.json: every BASE_3551 Stop entry survives unchanged, plus exactly one new entry');

  const newEntries = cur.hooks.Stop.filter((group) =>
    Array.isArray(group.hooks) && group.hooks.some((h) => typeof h.command === 'string' && h.command.indexOf('ambient-stop.cjs') !== -1));
  assert.strictEqual(newEntries.length, 1, 'exactly one Stop entry references ambient-stop.cjs');
  const newHook = newEntries[0].hooks[0];
  assert.strictEqual(newHook.async, true, 'the new entry must be async: true');
  assert.strictEqual(newHook.timeout, 5, 'the new entry must have timeout: 5 (seconds)');
  assert.ok(newHook.command.indexOf('--stop') !== -1, 'the new entry must pass --stop');
  assert.ok(newHook.command.indexOf('--dry-run') === -1, 'the new entry must never pass --dry-run');
  ok('hooks.json: the new entry is async, timeout 5, passes --stop, never --dry-run');

  const flat = JSON.stringify(cur.hooks.PostToolUse);
  assert.ok(flat.indexOf('auto-explore-fingerprint.cjs') !== -1, 'the PostToolUse fingerprint entry (class e) must still be present');
  ok('hooks.json: the PostToolUse fingerprint entry (class e) is still present');

  console.log('PASS hooks.json');
}

// ---------------------------------------------------------------------------
// Desktop leg: in process, handleStopEvent spawns exactly once.
// ---------------------------------------------------------------------------
async function legDesktop() {
  process.stdout.write('\n-- Desktop leg: handleStopEvent spawns exactly once --\n');
  resetBetween();

  const room = trackedRoom('desktop');
  room.addClaims(5);
  const sessionId = 'sess-desktop';
  process.env.MINDRIAN_ROOMS_HOME = room.roomsHome;
  room.bindSession(sessionId);

  let spawnCount = 0;
  let lastArgv = null;
  ambientTrigger._internal.setSpawnImpl(function (_cmd, args) {
    spawnCount += 1;
    lastArgv = args;
    return { unref: function () {} };
  });

  let stdoutCalled = false;
  const originalWrite = process.stdout.write;
  process.stdout.write = function () {
    stdoutCalled = true;
    return true;
  };
  let result;
  try {
    result = await stopGateHandler.handleStopEvent(sessionId, {});
  } finally {
    process.stdout.write = originalWrite;
    ambientTrigger._internal.resetSpawnImpl();
    delete process.env.MINDRIAN_ROOMS_HOME;
  }

  assert.strictEqual(spawnCount, 1, 'handleStopEvent must spawn the ambient child exactly once, got ' + spawnCount);
  assert.ok(Array.isArray(lastArgv) && lastArgv[lastArgv.length - 1] === '--ambient', 'the spawned argv must end with --ambient');
  assert.strictEqual(stdoutCalled, false, 'handleStopEvent must never write to process.stdout (MCP stdio safety)');
  ok('Desktop: handleStopEvent (claims room) spawns exactly once with the --ambient argv, no stdout write');

  assert.ok(result && result.business && typeof result.business === 'object', 'handleStopEvent must return a business close-out object');
  const businessKeys = Object.keys(result.business).sort();
  assert.deepStrictEqual(businessKeys, ['guardian_sm', 'minto_pending', 'room_dir', 'sections', 'stale'].sort(),
    "closeOutRoom's return keys must be unchanged: " + JSON.stringify(businessKeys));
  ok("Desktop: closeOutRoom's return keys are unchanged");

  console.log('PASS Desktop');
}

// ---------------------------------------------------------------------------
// Cowork leg: the same handler under CLAUDE_SURFACE=cowork.
// ---------------------------------------------------------------------------
async function legCowork() {
  process.stdout.write('\n-- Cowork leg: the same handler under CLAUDE_SURFACE=cowork --\n');
  resetBetween();

  const room = trackedRoom('cowork');
  room.addClaims(5);
  const sessionId = 'sess-cowork';
  process.env.MINDRIAN_ROOMS_HOME = room.roomsHome;
  room.bindSession(sessionId);

  const originalSurface = process.env.CLAUDE_SURFACE;
  process.env.CLAUDE_SURFACE = 'cowork';

  let spawnCount = 0;
  ambientTrigger._internal.setSpawnImpl(function () {
    spawnCount += 1;
    return { unref: function () {} };
  });

  let result;
  try {
    result = await stopGateHandler.handleStopEvent(sessionId, {});
  } finally {
    ambientTrigger._internal.resetSpawnImpl();
    if (originalSurface === undefined) delete process.env.CLAUDE_SURFACE; else process.env.CLAUDE_SURFACE = originalSurface;
    delete process.env.MINDRIAN_ROOMS_HOME;
  }

  assert.strictEqual(spawnCount, 1, 'the Cowork surface must also spawn exactly once, got ' + spawnCount);
  assert.ok(result && result.business, 'handleStopEvent must return a business close-out object under CLAUDE_SURFACE=cowork');
  ok('Cowork: under CLAUDE_SURFACE=cowork, handleStopEvent spawns exactly once');
  console.log('Cowork runs the same local MCP server in its VM (research A1)');

  console.log('PASS Cowork');
}

// ---------------------------------------------------------------------------
// AC1 end to end: claims room -> closeOutRoom (capture) -> runAmbientInChild
// in process (injected composition) -> side channel + delta state written
// -> a pull returns SENS-13 as the winner -> closeOutRoom marks it and
// spawns nothing new -> the next pull returns no SENS-13; re-evaluating the
// identical, already-consumed delta also spawns nothing.
// ---------------------------------------------------------------------------
async function legAC1() {
  process.stdout.write('\n-- AC1 end to end: one background run, one card, no second run for the same delta --\n');
  resetBetween();

  const room = trackedRoom('ac1');
  room.addClaims(5);
  const sessionId = 'sess-ac1';

  let capturedArgv1 = null;
  ambientTrigger._internal.setSpawnImpl(function (_cmd, args) {
    capturedArgv1 = args;
    return { unref: function () {} };
  });
  let business1;
  try {
    business1 = stopGateHandler.closeOutRoom(room.roomDir, sessionId);
  } finally {
    ambientTrigger._internal.resetSpawnImpl();
  }
  assert.ok(business1 && business1.room_dir === room.roomDir, 'the first closeOutRoom must return the normal shape');
  assert.ok(Array.isArray(capturedArgv1), 'the first closeOutRoom must claim and spawn the ambient child');
  const ambientId = capturedArgv1[3];
  assert.ok(/^ambient-[0-9a-f]{12}$/.test(ambientId), 'the captured argv must carry an ambient- id, got ' + ambientId);
  ok('AC1: closeOutRoom (capture) claims and spawns the ambient child once');

  async function compositionForAc1(roomDirArg) {
    return seedIndirectComposition(roomDirArg, INDIRECT_STAMP);
  }
  const runResult = await ambientRun.runAmbientInChild(room.roomDir, {
    ambientId: ambientId,
    sessionId: sessionId,
    deps: { composition: compositionForAc1 },
    now: Date.now(),
  });
  assert.strictEqual(runResult.state, 'completed', 'the in-process ambient run must complete, got ' + runResult.state);
  assert.strictEqual(runResult.surfaced_via, 'sens13', 'the in-process ambient run must surface via sens13, got ' + runResult.surfaced_via);
  ok('AC1: runAmbientInChild (in process, injected composition) completes and surfaces via sens13');

  const sideChannelPath = path.join(room.roomDir, '.mindrian', 'last-eureka.json');
  assert.ok(fs.existsSync(sideChannelPath), 'the stamped side channel (last-eureka.json) must exist after the run');
  const deltaStateAfterRun = guard.readRoomDeltaState(room.roomDir);
  assert.ok(deltaStateAfterRun, 'the delta state must exist after the run');
  assert.strictEqual(deltaStateAfterRun.run_state, 'completed', 'the delta state must be completed after the run');
  assert.ok(deltaStateAfterRun.opportunity_handle, 'the delta state must carry the opportunity_handle after the run');
  ok('AC1: the side channel and the delta state are written');

  const pull1 = sensorsTool._internal.dispatchCandidateReaches(sessionId, room.roomDir, {});
  const eureka1 = eurekaReachesOf(pull1.reaches);
  assert.strictEqual(eureka1.length, 1, 'the pull must fire exactly one eureka_bridge reach');
  assert.strictEqual(pull1.reaches[0].signal, 'eureka_bridge', 'the eureka_bridge reach must be the winner (reaches[0])');
  ok('AC1: a dispatchCandidateReaches pull returns SENS-13 as the winner');

  let capturedArgv2 = null;
  ambientTrigger._internal.setSpawnImpl(function (_cmd, args) {
    capturedArgv2 = args;
    return { unref: function () {} };
  });
  let business2;
  try {
    business2 = stopGateHandler.closeOutRoom(room.roomDir, sessionId);
  } finally {
    ambientTrigger._internal.resetSpawnImpl();
  }
  assert.ok(business2 && business2.room_dir === room.roomDir, 'the second closeOutRoom must return the normal shape');
  assert.strictEqual(capturedArgv2, null, 'the second closeOutRoom must spawn nothing new (the watermarks already advanced at completion)');
  ok('AC1: closeOutRoom marks the winning handle and spawns nothing new (decision no_change or same_hash)');

  const pull2 = sensorsTool._internal.dispatchCandidateReaches(sessionId, room.roomDir, {});
  const eureka2 = eurekaReachesOf(pull2.reaches);
  assert.strictEqual(eureka2.length, 0, 'the next pull must return no SENS-13 (already surfaced)');
  ok('AC1: the next pull returns no SENS-13');

  // Re-evaluating the IDENTICAL, already-consumed delta facts (no new room
  // activity since business2) must also spawn nothing -- the ledger's
  // last_delta_hash already matches, so a repeat evaluation is a no-op.
  let capturedArgv3 = null;
  ambientTrigger._internal.setSpawnImpl(function (_cmd, args) {
    capturedArgv3 = args;
    return { unref: function () {} };
  });
  try {
    stopGateHandler.closeOutRoom(room.roomDir, sessionId);
  } finally {
    ambientTrigger._internal.resetSpawnImpl();
  }
  assert.strictEqual(capturedArgv3, null, 're-evaluating the identical delta facts the ledger already consumed must also spawn nothing');
  ok('AC1: re-evaluating the identical delta facts the ledger already consumed also spawns nothing');

  console.log('PASS AC1');
}

// ---------------------------------------------------------------------------
// Three seams, one run: ambient-stop.cjs --stop --dry-run (process), then
// closeOutRoom (in process), then evaluateAndClaim seam 'material' (in
// process), on the SAME state -> exactly one claim, zero in-process spawns.
// ---------------------------------------------------------------------------
function legThreeSeams() {
  process.stdout.write("\n-- three seams: dry-run process, then closeOutRoom, then evaluateAndClaim(material) -> exactly one claim --\n");
  resetBetween();

  const room = trackedRoom('three-seams');
  room.addClaims(5);
  const sessionId = 'sess-three-seams';
  room.bindSession(sessionId);

  // Seam 1: the CLI dry-run process claims the delta for real (writes
  // run_state 'started', sets ledger.in_flight) even though the spawn
  // itself is stubbed by --dry-run.
  const res1 = spawnAmbientStop(room, { session_id: sessionId, cwd: room.roomDir }, ['--dry-run']);
  assert.strictEqual(res1.status, 0, 'seam 1 (CLI dry-run) must exit 0');
  let parsed1 = null;
  try { parsed1 = JSON.parse((res1.stdout || Buffer.alloc(0)).toString().trim()); } catch (_e) { parsed1 = null; }
  assert.ok(parsed1 && parsed1.decision === 'spawned', 'seam 1 (CLI dry-run) must claim (decision spawned in dry-run)');

  const ledgerAfter1 = guard.readAmbientLedger(room.roomDir);
  assert.ok(ledgerAfter1.ledger && ledgerAfter1.ledger.in_flight, "seam 1 must leave the ledger's in_flight set (a real claim)");

  // Seam 2: closeOutRoom in process on the SAME room -- already in_flight,
  // so it must not claim again nor spawn.
  let spawnCount2 = 0;
  ambientTrigger._internal.setSpawnImpl(function () {
    spawnCount2 += 1;
    return { unref: function () {} };
  });
  try {
    stopGateHandler.closeOutRoom(room.roomDir, sessionId);
  } finally {
    ambientTrigger._internal.resetSpawnImpl();
  }
  assert.strictEqual(spawnCount2, 0, "seam 2 (closeOutRoom) must spawn nothing while seam 1's claim is in flight");

  // Seam 3: evaluateAndClaim under seam 'material' on the same state --
  // never spawns by design, and must not claim again either.
  const claim3 = ambientTrigger.evaluateAndClaim(room.roomDir, { seam: 'material', now: Date.now() });
  assert.notStrictEqual(claim3.decision, 'claimed', "seam 3 (material) must not claim again while seam 1's claim is in flight, got " + claim3.decision);

  ok("three seams: exactly one claim (seam 1's dry-run record), zero in-process spawns (seams 2 and 3)");
  console.log('PASS three-seams-one-run');
}

// ---------------------------------------------------------------------------
// Static: scripts/ambient-stop.cjs contains no spawn / child_process / zod /
// fetch on a non-comment line.
// ---------------------------------------------------------------------------
function legStatic() {
  process.stdout.write('\n-- static: scripts/ambient-stop.cjs contains no spawn / child_process / zod / fetch --\n');
  const src = fs.readFileSync(AMBIENT_STOP_PATH, 'utf8');
  const nonComment = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.strictEqual(/spawn\(/.test(nonComment), false, 'ambient-stop.cjs must never call spawn( directly');
  assert.strictEqual(/child_process/.test(nonComment), false, 'ambient-stop.cjs must never reference child_process directly');
  assert.strictEqual(/require\('zod'\)/.test(nonComment), false, 'ambient-stop.cjs must never require zod');
  assert.strictEqual(/fetch\(/.test(nonComment), false, 'ambient-stop.cjs must never call fetch( directly');
  ok('static: ambient-stop.cjs has no spawn/child_process/zod/fetch on a non-comment line');

  console.log('PASS static');
}

// ---------------------------------------------------------------------------
// Run every leg; a single async main so a rejection anywhere still exits
// non-zero.
// ---------------------------------------------------------------------------
async function main() {
  legCliDryRun();
  legCliReal();
  legCliNoOps();
  legHooksJson();
  await legDesktop();
  await legCowork();
  await legAC1();
  legThreeSeams();
  legStatic();
}

main()
  .then(function () {
    cleanupAll();
    console.log('');
    console.log('PASS: ' + checks + ' FAIL: 0');
    console.log('PASS test-3551-tri-polar.cjs (' + checks + ' checks)');
    assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
    netGuard.restore();
  })
  .catch(function (e) {
    cleanupAll();
    console.log('');
    console.log('PASS: ' + checks + ' FAIL: 1');
    console.log('FAIL: ' + (e && e.stack ? e.stack : (e && e.message ? e.message : String(e))));
    console.log('FAIL test-3551-tri-polar.cjs (' + checks + ' checks passed before the failure)');
    process.exitCode = 1;
  });
