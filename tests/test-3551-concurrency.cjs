#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Review fix (355.1-REVIEW.md CR-01, CR-02, CR-03, CR-04) -- the four
 * concurrency/atomicity legs the criticals themselves required, so a future
 * regression on any of the four gets caught by tests/run-all-3551.sh, not
 * just by a code-reading review:
 *
 *   1. CR-01 (claim race, raw): N real node processes call
 *      scripts/scout-cadence-guard.cjs's claimAmbientRun directly against
 *      the SAME room and the SAME delta_hash, released from a shared
 *      barrier file so the race is genuine (not sequential) -- exactly one
 *      process gets claimed:true.
 *   2. CR-01 (claim race, through the evaluator): N real node processes
 *      call lib/core/ambient-trigger.cjs's evaluateAndMaybeSpawn against a
 *      real fixture room with real claims (the SAME room, the SAME delta),
 *      each with its own module-level spawn seam stubbed to append to a
 *      shared spawn-log file instead of really spawning -- exactly one
 *      spawn-log line, exactly one 'spawned' decision.
 *   3. CR-02 (spawn-failure release): a stubbed spawn throw leaves
 *      ledger.in_flight null (released), and a later evaluation (past the
 *      hourly throttle window) can claim and spawn again.
 *   4. CR-03 (lock owner token): a stale reclaim while the first holder is
 *      still "alive" mints a new token; the first holder's own release
 *      (its now-stale token) must fail closed and leave the second holder's
 *      lock intact.
 *   5. CR-04 (single owner per Stop event): with MINDRIAN_MCP_FIRST=cli set,
 *      scripts/ambient-stop.cjs stands down (no claim, no evaluator call)
 *      while lib/mcp/stop-gate-handler.cjs's closeOutRoom (the daemon-side
 *      close-out) is the one that actually claims and spawns; with the flag
 *      unset, ambient-stop.cjs is the one that acts, exactly as before.
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
  process.stdout.write('SKIP test-3551-concurrency.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const guard = require('../scripts/scout-cadence-guard.cjs');
const ambientTrigger = require('../lib/core/ambient-trigger.cjs');
const stopGateHandler = require('../lib/mcp/stop-gate-handler.cjs');

const { check, summary } = hygiene.makeChecker('test-3551-concurrency');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'scripts', 'scout-cadence-guard.cjs');
const AMBIENT_TRIGGER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'ambient-trigger.cjs');
const AMBIENT_STOP_PATH = path.join(REPO_ROOT, 'scripts', 'ambient-stop.cjs');
const AMBIENT_THROTTLE_WINDOW_MS = guard.AMBIENT_THROTTLE_WINDOW_MS;

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

function hex(label, len) {
  return crypto.createHash('sha256').update(String(label)).digest('hex').slice(0, len);
}

function isolatedChildEnv(extra) {
  const homeDir = mkTmp('mos-3551-conc-home');
  const env = Object.assign({}, process.env);
  for (const key of VENDOR_KEY_ENV_VARS) delete env[key];
  env.HOME = homeDir;
  env.USERPROFILE = homeDir;
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
  env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';
  return Object.assign(env, extra || {});
}

// spawnWorker(scriptPath, argv, env) -> Promise<{status}>. A real, async
// child_process.spawn (not spawnSync) so N workers genuinely overlap on the
// OS scheduler rather than running one after another.
function spawnWorker(scriptPath, argv, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath].concat(argv), {
      cwd: mkTmp('mos-3551-conc-cwd'),
      env: env,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.on('close', (code) => resolve({ status: code }));
    child.on('error', () => resolve({ status: -1 }));
  });
}

// releaseBarrier(barrierFile) -- creates the barrier file every worker
// busy-polls for before doing its timed work, so all N workers begin their
// racy section as close to simultaneously as the OS scheduler allows.
function releaseBarrierSoon(barrierFile, delayMs) {
  return new Promise((resolve) => {
    setTimeout(() => {
      fs.writeFileSync(barrierFile, '1');
      resolve();
    }, delayMs);
  });
}

(async function main() {
  try {
    // -----------------------------------------------------------------
    // Leg 1 (CR-01, raw): N real processes race claimAmbientRun directly
    // against the SAME room and delta_hash. No fixture DB needed -- a
    // plain tmp directory is enough, since claimAmbientRun only touches
    // .mindrian/ under roomDir.
    // -----------------------------------------------------------------
    {
      const roomDir = mkTmp('mos-3551-conc-claimroom');
      const deltaHash = hex('conc-claim-delta', 64);
      const barrierFile = path.join(mkTmp('mos-3551-conc-barrier-a'), 'go');
      const resultsDir = mkTmp('mos-3551-conc-results-a');
      const workerScript = path.join(mkTmp('mos-3551-conc-worker-a'), 'claim-worker.cjs');
      fs.writeFileSync(workerScript, [
        "'use strict';",
        "const fs = require('node:fs');",
        "const guard = require(" + JSON.stringify(GUARD_PATH) + ");",
        "const [roomDir, deltaHash, resultFile, barrierFile, nowStr] = process.argv.slice(2);",
        "const deadline = Date.now() + 8000;",
        "while (!fs.existsSync(barrierFile) && Date.now() < deadline) { /* busy-wait for the barrier */ }",
        "let res;",
        "try {",
        "  res = guard.claimAmbientRun(roomDir, { deltaHash: deltaHash, watermarks: {}, seam: 'stop_hook', now: Number(nowStr) });",
        "} catch (_e) {",
        "  res = { claimed: false };",
        "}",
        "fs.writeFileSync(resultFile, JSON.stringify({ claimed: !!res.claimed, pid: process.pid }));",
      ].join('\n'), 'utf8');

      const N = 10;
      const nowMs = Date.now();
      const resultFiles = [];
      const workerPromises = [];
      for (let i = 0; i < N; i += 1) {
        const resultFile = path.join(resultsDir, 'r' + i + '.json');
        resultFiles.push(resultFile);
        workerPromises.push(spawnWorker(workerScript, [roomDir, deltaHash, resultFile, barrierFile, String(nowMs)], isolatedChildEnv()));
      }
      await releaseBarrierSoon(barrierFile, 200);
      await Promise.all(workerPromises);

      const results = resultFiles.map((f) => {
        try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_e) { return { claimed: false }; }
      });
      const claimedCount = results.filter((r) => r.claimed === true).length;
      check('CR-01 raw claim race: all ' + N + ' workers produced a result file', results.length === N);
      check('CR-01 raw claim race: exactly one of ' + N + ' concurrent claimAmbientRun calls got claimed:true', claimedCount === 1, 'claimedCount=' + claimedCount);

      const ledgerRead = guard.readAmbientLedger(roomDir);
      check('CR-01 raw claim race: the ledger in_flight carries the raced delta_hash', !!ledgerRead.ledger.in_flight && ledgerRead.ledger.in_flight.delta_hash === deltaHash);
    }

    // -----------------------------------------------------------------
    // Leg 2 (CR-01, through the evaluator): N real processes race
    // evaluateAndMaybeSpawn against a real fixture room, each with its own
    // spawn seam stubbed to append to a shared spawn-log file. Exactly one
    // spawn-log line, exactly one 'spawned' decision.
    // -----------------------------------------------------------------
    {
      const room = trackedRoom('conc-evaluator');
      room.addClaims(5);

      const barrierFile = path.join(mkTmp('mos-3551-conc-barrier-b'), 'go');
      const resultsDir = mkTmp('mos-3551-conc-results-b');
      const spawnLogFile = path.join(mkTmp('mos-3551-conc-spawnlog'), 'spawn-log.txt');
      fs.writeFileSync(spawnLogFile, '');
      const workerScript = path.join(mkTmp('mos-3551-conc-worker-b'), 'eval-worker.cjs');
      fs.writeFileSync(workerScript, [
        "'use strict';",
        "const fs = require('node:fs');",
        "const ambientTrigger = require(" + JSON.stringify(AMBIENT_TRIGGER_PATH) + ");",
        "const [roomDir, spawnLogFile, resultFile, barrierFile, nowStr] = process.argv.slice(2);",
        "ambientTrigger._internal.setSpawnImpl(function fakeSpawn() {",
        "  try { fs.appendFileSync(spawnLogFile, String(process.pid) + '\\n'); } catch (_e) { /* best effort */ }",
        "  return { unref: function () {} };",
        "});",
        "const deadline = Date.now() + 8000;",
        "while (!fs.existsSync(barrierFile) && Date.now() < deadline) { /* busy-wait for the barrier */ }",
        "let res;",
        "try {",
        "  res = ambientTrigger.evaluateAndMaybeSpawn(roomDir, { seam: 'stop_hook', now: Number(nowStr) });",
        "} catch (_e) {",
        "  res = { decision: 'error' };",
        "}",
        "fs.writeFileSync(resultFile, JSON.stringify({ decision: res.decision, pid: process.pid }));",
      ].join('\n'), 'utf8');

      const N = 8;
      const nowMs = Date.now();
      const resultFiles = [];
      const workerPromises = [];
      for (let i = 0; i < N; i += 1) {
        const resultFile = path.join(resultsDir, 'r' + i + '.json');
        resultFiles.push(resultFile);
        workerPromises.push(spawnWorker(workerScript, [room.roomDir, spawnLogFile, resultFile, barrierFile, String(nowMs)], isolatedChildEnv()));
      }
      await releaseBarrierSoon(barrierFile, 300);
      await Promise.all(workerPromises);

      const results = resultFiles.map((f) => {
        try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_e) { return { decision: 'missing' }; }
      });
      check('CR-01 evaluator race: all ' + N + ' workers produced a result file', results.length === N);
      const spawnedCount = results.filter((r) => r.decision === 'spawned').length;
      check('CR-01 evaluator race: exactly one of ' + N + ' concurrent evaluateAndMaybeSpawn calls decided spawned', spawnedCount === 1, 'spawnedCount=' + spawnedCount + ' decisions=' + JSON.stringify(results.map((r) => r.decision)));

      const spawnLogLines = fs.readFileSync(spawnLogFile, 'utf8').split('\n').filter((l) => l.length > 0);
      check('CR-01 evaluator race: exactly one process actually reached the spawn seam', spawnLogLines.length === 1, 'spawnLogLines=' + spawnLogLines.length);

      const ledgerRead = guard.readAmbientLedger(room.roomDir);
      check('CR-01 evaluator race: the ledger in_flight is set (the one winner\'s claim, never released since the spawn was stubbed)', !!ledgerRead.ledger.in_flight);
    }

    // -----------------------------------------------------------------
    // Leg 3 (CR-02): a stubbed spawn throw releases in_flight; a later
    // evaluation (past the hourly throttle window) can claim and spawn.
    // -----------------------------------------------------------------
    {
      const room = trackedRoom('conc-spawn-failure');
      room.addClaims(5);
      const t0 = Date.now();

      ambientTrigger._internal.setSpawnImpl(function throwingSpawn() {
        throw new Error('simulated spawn failure (EAGAIN-like)');
      });
      let firstResult;
      try {
        firstResult = ambientTrigger.evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', now: t0 });
      } finally {
        ambientTrigger._internal.resetSpawnImpl();
      }
      check('CR-02 spawn failure: decision is spawn_failed', firstResult.decision === 'spawn_failed', 'decision=' + firstResult.decision);

      const afterFailure = guard.readAmbientLedger(room.roomDir);
      check('CR-02 spawn failure: ledger in_flight is released (null), not leaked', afterFailure.ledger.in_flight === null);

      // Past the hourly throttle window so the earlier claim's runs_window
      // bump (WR-03, out of scope) does not itself block this leg.
      const t1 = t0 + AMBIENT_THROTTLE_WINDOW_MS + 60000;
      let spawnedOk = false;
      ambientTrigger._internal.setSpawnImpl(function workingSpawn() {
        spawnedOk = true;
        return { unref: function () {} };
      });
      let secondResult;
      try {
        secondResult = ambientTrigger.evaluateAndMaybeSpawn(room.roomDir, { seam: 'stop_hook', now: t1 });
      } finally {
        ambientTrigger._internal.resetSpawnImpl();
      }
      check('CR-02 spawn failure: the next evaluation can run (decision spawned)', secondResult.decision === 'spawned', 'decision=' + secondResult.decision);
      check('CR-02 spawn failure: the next evaluation actually reached the spawn seam', spawnedOk === true);
    }

    // -----------------------------------------------------------------
    // Leg 4 (CR-03): a stale reclaim while the first holder is alive mints
    // a new token; the first holder's own release (its stale token) must
    // fail closed and leave the second holder's lock intact.
    // -----------------------------------------------------------------
    {
      const roomDir = mkTmp('mos-3551-conc-lockroom');
      const lockPath = path.join(roomDir, '.mindrian', 'ambient-run.lock');
      const t0 = Date.now();

      const holderA = guard.acquireAmbientLock(roomDir, { now: t0 });
      check('CR-03 lock owner: holder A acquires cleanly', holderA.ok === true && typeof holderA.token === 'string' && holderA.token.length > 0);

      // Backdate the lock's real mtime past AMBIENT_LOCK_STALE_MS (the one
      // legitimate real-clock leg, tests/test-3551-ledger.cjs's own idiom)
      // while holder A is still "alive" (never released).
      const realNow = Date.now();
      const staleAgo = new Date(realNow - guard.AMBIENT_LOCK_STALE_MS - 60000);
      fs.utimesSync(lockPath, staleAgo, staleAgo);

      const holderB = guard.acquireAmbientLock(roomDir, { now: realNow });
      check('CR-03 lock owner: holder B reclaims the stale lock', holderB.ok === true && holderB.reclaimed === true);
      check('CR-03 lock owner: holder B mints a DIFFERENT token from holder A', holderB.token !== holderA.token);

      const staleReleaseByA = guard.releaseAmbientLock(roomDir, holderA.token);
      check('CR-03 lock owner: holder A\'s own release fails closed (token_mismatch)', staleReleaseByA.ok === false && staleReleaseByA.reason === 'token_mismatch');
      check('CR-03 lock owner: the lock file still exists after holder A\'s stale release attempt', fs.existsSync(lockPath) === true);
      const onDiskAfterA = fs.readFileSync(lockPath, 'utf8');
      check('CR-03 lock owner: holder B\'s token is still the one on disk (untouched by A\'s release)', onDiskAfterA === holderB.token);

      const releaseByB = guard.releaseAmbientLock(roomDir, holderB.token);
      check('CR-03 lock owner: holder B releases its own lock cleanly', releaseByB.ok === true);
      check('CR-03 lock owner: the lock file is gone after holder B\'s own release', fs.existsSync(lockPath) === false);
    }

    // -----------------------------------------------------------------
    // Leg 5 (CR-04): one Stop event, one owner. MINDRIAN_MCP_FIRST=cli ->
    // scripts/ambient-stop.cjs stands down (no claim); the daemon-side
    // closeOutRoom is the sole actor. Flag unset -> ambient-stop.cjs is the
    // sole actor, exactly as before.
    // -----------------------------------------------------------------
    {
      // -- 5a: flag OFF (default) -- ambient-stop.cjs remains the owner --
      const roomOff = trackedRoom('conc-cr04-flag-off');
      roomOff.addClaims(5);
      const sessionOff = 'sess-cr04-off';
      roomOff.bindSession(sessionOff);
      const envOff = isolatedChildEnv({ MINDRIAN_ROOMS_HOME: roomOff.roomsHome });
      delete envOff.MINDRIAN_MCP_FIRST;
      const resOff = spawnSync(process.execPath, [AMBIENT_STOP_PATH, '--stop', '--dry-run'], {
        cwd: mkTmp('mos-3551-conc-cr04-off-cwd'),
        env: envOff,
        input: JSON.stringify({ session_id: sessionOff, cwd: roomOff.roomDir }),
        timeout: 15000,
      });
      check('CR-04 flag off: ambient-stop.cjs exits 0', resOff.status === 0);
      let parsedOff = null;
      try { parsedOff = JSON.parse((resOff.stdout || Buffer.alloc(0)).toString().trim()); } catch (_e) { parsedOff = null; }
      check('CR-04 flag off: ambient-stop.cjs still owns the evaluator (decision spawned)', !!parsedOff && parsedOff.decision === 'spawned', 'stdout=' + (resOff.stdout || ''));

      // -- 5b: flag ON -- ambient-stop.cjs stands down, no claim at all --
      const roomOn = trackedRoom('conc-cr04-flag-on');
      roomOn.addClaims(5);
      const sessionOn = 'sess-cr04-on';
      roomOn.bindSession(sessionOn);
      const envOn = isolatedChildEnv({ MINDRIAN_ROOMS_HOME: roomOn.roomsHome, MINDRIAN_MCP_FIRST: 'cli', MINDRIAN_AMBIENT_DEBUG: '1' });
      const resOn = spawnSync(process.execPath, [AMBIENT_STOP_PATH, '--stop', '--dry-run'], {
        cwd: mkTmp('mos-3551-conc-cr04-on-cwd'),
        env: envOn,
        input: JSON.stringify({ session_id: sessionOn, cwd: roomOn.roomDir }),
        timeout: 15000,
      });
      check('CR-04 flag on: ambient-stop.cjs exits 0', resOn.status === 0);
      const stdoutOn = (resOn.stdout || Buffer.alloc(0)).toString();
      const stderrOn = (resOn.stderr || Buffer.alloc(0)).toString();
      check('CR-04 flag on: ambient-stop.cjs prints nothing (stands down before the dry-run capture)', stdoutOn === '');
      check('CR-04 flag on: ambient-stop.cjs logs the stand-down decision', /mcp_first_standdown/.test(stderrOn));
      const deltaStateOn = guard.readRoomDeltaState(roomOn.roomDir);
      check('CR-04 flag on: no claim was made by ambient-stop.cjs (no delta-state side channel written)', deltaStateOn === null);
      const ledgerOn = guard.readAmbientLedger(roomOn.roomDir);
      check('CR-04 flag on: no in_flight claim was made by ambient-stop.cjs', ledgerOn.ledger.in_flight === null);

      // Now the daemon-side path: closeOutRoom (what scripts/on-stop's
      // MINDRIAN_MCP_FIRST branch reaches through stop_gate_check) is the
      // sole remaining owner for this Stop event, and it DOES claim/spawn.
      let closeOutSpawned = false;
      ambientTrigger._internal.setSpawnImpl(function closeOutFakeSpawn() {
        closeOutSpawned = true;
        return { unref: function () {} };
      });
      try {
        stopGateHandler.closeOutRoom(roomOn.roomDir, sessionOn);
      } finally {
        ambientTrigger._internal.resetSpawnImpl();
      }
      check('CR-04 flag on: closeOutRoom is the sole owner and DOES reach the spawn seam', closeOutSpawned === true);
      const deltaStateAfterCloseOut = guard.readRoomDeltaState(roomOn.roomDir);
      check('CR-04 flag on: closeOutRoom actually claimed (delta-state side channel written)', !!deltaStateAfterCloseOut && deltaStateAfterCloseOut.run_state === 'started');
    }

    check('no network attempted (hygiene-355 installNetGuard)', netGuard.attempts() === 0);
  } finally {
    delete process.env.MINDRIAN_MCP_FIRST;
    cleanupAll();
    netGuard.restore();
  }

  process.exit(summary());
})();
