#!/usr/bin/env node
// Phase 237-04 (REACH-03) -- the two-process session-scope fence for turn
// signals. Proves, with TWO REAL OS PROCESSES on one machine, that a fresh
// marker written by session A does not produce an artifact_filed / first_
// material turn signal for session B, that session B's OWN fresh marker
// still fires (the fix scopes, it does not silence), and that the fence
// actually bites (a mutation that neutralizes the ownership check makes the
// bleed reappear).
//
// Four legs, run against lib/core/insight-sensors.cjs::dispatchSensors /
// normalizeTurn / deriveTurnSignals:
//   Leg 1 BLEED CLOSED       -- session A's fresh cascade marker does NOT
//                                surface artifact_filed for session B.
//   Leg 2 NOT SILENCED       -- session B's OWN fresh cascade marker DOES
//                                surface artifact_filed for session B.
//   Leg 3 FIRST_MATERIAL     -- legs 1 and 2 repeated against the
//         PARITY               auto-explore-*.json marker / first_material
//                                signal, since deriveTurnSignals derives two
//                                signals from two different marker shapes.
//   Leg 4 MUTATION            -- a tmp copy of insight-sensors.cjs with the
//                                ownership check textually neutralized makes
//                                Leg 1's assertion fail, proving the fence
//                                bites rather than merely existing.
//
// Harness sources (precedent this file follows):
//   - lib/memory/write-lock-atomic.test.cjs + .worker.cjs -- the
//     child_process.fork two-process pattern (true OS-level concurrency,
//     never a mocked in-process fan-out of writes).
//   - tests/test-198-concurrency-mcp.test.cjs:31-45 -- the hermetic env
//     save/delete/restore block.
//   - tests/test-241-guardian-tripolar-parity.cjs:160-215 -- the mutated-
//     tmp-copy harness (pin relative requires to absolute repo paths, apply
//     a textual mutation, require() the mutated copy fresh, never touch the
//     working tree).
//
// Plain node:assert. No test framework. No em-dashes.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const WORKER_SCRIPT = path.join(__dirname, 'test-237-session-scope.worker.cjs');
const INSIGHT_SENSORS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs');

const insightSensors = require(INSIGHT_SENSORS_PATH);

// ---------------------------------------------------------------------------
// Hermetic env block (tests/test-198-concurrency-mcp.test.cjs:31-45): a host
// session id or an active-room override must never leak into this fence and
// silently change what it proves.
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

// ---------------------------------------------------------------------------
// fork() harness -- true OS-level concurrency, not mocked in-event-loop
// "parallelism" (the file this worker contract copies says explicitly that
// mocked in-process fan-out writes do not prove this).
// ---------------------------------------------------------------------------
function runWorker(args) {
  return new Promise((resolve) => {
    const child = fork(WORKER_SCRIPT, args, { silent: true });
    let stderrBuf = '';
    if (child.stderr) {
      child.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });
    }
    child.on('exit', (code) => resolve({ code: code, stderr: stderrBuf }));
  });
}

// ---------------------------------------------------------------------------
// Leg 4 mutation harness (tests/test-241-guardian-tripolar-parity.cjs:160-215
// pattern): pin every relative require in insight-sensors.cjs to its
// absolute repo path so a tmp-directory copy still resolves its 16
// lib/core/sensors/*.cjs siblings, apply the textual mutation, write to a
// real temp path, require() it fresh. The real working-tree file is never
// touched.
// ---------------------------------------------------------------------------
const SENSOR_REQUIRE_FILES = [
  'sensor-types.cjs',
  'sensor-lagging-component.cjs',
  'sensor-methodology-decision.cjs',
  'sensor-gate-approach.cjs',
  'sensor-external-fact.cjs',
  'sensor-jtbd-reweight.cjs',
  'sensor-memory-cortex.cjs',
  'sensor-recency.cjs',
  'sensor-diffusion-adoption.cjs',
  'sensor-show-share.cjs',
  'sensor-circularity.cjs',
  'sensor-expert-skill.cjs',
  'sensor-room-pick.cjs',
  'sensor-eureka.cjs',
  'sensor-opportunity-harvest.cjs',
  'sensor-url-ingest.cjs',
];

function pinRequiresToRealRepo(src) {
  let out = src;
  for (const file of SENSOR_REQUIRE_FILES) {
    const needle = "require('./sensors/" + file + "')";
    const absTarget = path.join(REPO_ROOT, 'lib', 'core', 'sensors', file);
    assert.ok(out.indexOf(needle) !== -1, 'expected relative require not found in insight-sensors.cjs: ' + needle);
    out = out.split(needle).join('require(' + JSON.stringify(absTarget) + ')');
  }
  return out;
}

// The mutation under test: neutralizes isMarkerOwnedByCaller's final
// comparison so it always answers "owned", regardless of the marker/caller
// session ids. This is what "textually neutralizing the ownership check"
// means operationally -- it reintroduces the bleed Leg 1 closes.
function mutateNeutralizeOwnershipCheck(src) {
  const needle = 'return markerSessionId === callerSessionId;';
  const replacement = 'return true; /* MUTATION (test-237-04 fence): ownership check neutralized */';
  assert.ok(
    src.indexOf(needle) !== -1,
    'expected ownership-check needle not found in insight-sensors.cjs (Task 2 has not landed yet, or the source drifted)'
  );
  return src.split(needle).join(replacement);
}

function loadMutatedInsightSensors(tmpDirRoot) {
  const src = fs.readFileSync(INSIGHT_SENSORS_PATH, 'utf8');
  const pinned = pinRequiresToRealRepo(src);
  const mutated = mutateNeutralizeOwnershipCheck(pinned);
  assert.notEqual(mutated, src, 'mutation must actually change the source');
  const dest = path.join(tmpDirRoot, 'insight-sensors-mutated-' + process.pid + '.cjs');
  fs.writeFileSync(dest, mutated);
  return require(dest);
}

// ---------------------------------------------------------------------------
// Leg bodies
// ---------------------------------------------------------------------------

async function legBleedClosedAndNotSilenced(tmpRoom) {
  // --- Leg 1: BLEED CLOSED ---
  const seedA = await runWorker([tmpRoom, '237-session-A', 'cascade']);
  assert.strictEqual(seedA.code, 0, 'worker (session A, cascade) must exit 0 before any signal assertion; stderr: ' + seedA.stderr);

  const ctx = { roomDir: tmpRoom, lowFillSections: null };
  const turnForB = { userText: '', sectionPath: null, sessionId: '237-session-B' };

  const normalizedForB = insightSensors.normalizeTurn(turnForB, ctx, {});
  assert.ok(
    normalizedForB.signals.indexOf('artifact_filed') === -1,
    'LEG 1 (BLEED CLOSED): session B normalized signals must not contain artifact_filed from a marker seeded by session A'
  );

  const directSignalsForB = insightSensors.deriveTurnSignals(ctx, '237-session-B');
  assert.ok(
    directSignalsForB.indexOf('artifact_filed') === -1,
    'LEG 1 (BLEED CLOSED, direct): deriveTurnSignals(ctx, session-B) must not contain artifact_filed from a marker seeded by session A'
  );

  const reachesForB = insightSensors.dispatchSensors(turnForB, {}, ctx);
  assert.ok(
    !reachesForB.some((r) => r && r.signal === 'artifact_filed'),
    'LEG 1 (BLEED CLOSED, candidate): session B must not receive an artifact_filed candidate reach from a marker seeded by session A'
  );

  // --- Leg 2: NOT SILENCED ---
  const seedB = await runWorker([tmpRoom, '237-session-B', 'cascade']);
  assert.strictEqual(seedB.code, 0, 'worker (session B, cascade) must exit 0 before any signal assertion; stderr: ' + seedB.stderr);

  const normalizedForBOwn = insightSensors.normalizeTurn(turnForB, ctx, {});
  assert.ok(
    normalizedForBOwn.signals.indexOf('artifact_filed') !== -1,
    'LEG 2 (NOT SILENCED): session B own fresh marker must still produce artifact_filed'
  );

  const reachesForBOwn = insightSensors.dispatchSensors(turnForB, {}, ctx);
  assert.ok(
    reachesForBOwn.some((r) => r && r.signal === 'artifact_filed'),
    'LEG 2 (NOT SILENCED, candidate): session B own fresh marker must still produce an artifact_filed candidate reach'
  );
}

async function legFirstMaterialParity(tmpRoom) {
  const seedA = await runWorker([tmpRoom, '237-session-A', 'auto-explore']);
  assert.strictEqual(seedA.code, 0, 'worker (session A, auto-explore) must exit 0 before any signal assertion; stderr: ' + seedA.stderr);

  const ctx = { roomDir: tmpRoom, lowFillSections: null };
  const turnForB = { userText: '', sectionPath: null, sessionId: '237-session-B' };

  const normalizedForB = insightSensors.normalizeTurn(turnForB, ctx, {});
  assert.ok(
    normalizedForB.signals.indexOf('first_material') === -1,
    'LEG 3 (FIRST_MATERIAL PARITY, bleed closed): session B normalized signals must not contain first_material from a marker seeded by session A'
  );

  const reachesForB = insightSensors.dispatchSensors(turnForB, {}, ctx);
  assert.ok(
    !reachesForB.some((r) => r && r.signal === 'first_material'),
    'LEG 3 (candidate): session B must not receive a first_material candidate reach from a marker seeded by session A'
  );

  const seedB = await runWorker([tmpRoom, '237-session-B', 'auto-explore']);
  assert.strictEqual(seedB.code, 0, 'worker (session B, auto-explore) must exit 0 before any signal assertion; stderr: ' + seedB.stderr);

  const normalizedForBOwn = insightSensors.normalizeTurn(turnForB, ctx, {});
  assert.ok(
    normalizedForBOwn.signals.indexOf('first_material') !== -1,
    'LEG 3 (not silenced): session B own marker must still produce first_material'
  );

  const reachesForBOwn = insightSensors.dispatchSensors(turnForB, {}, ctx);
  assert.ok(
    reachesForBOwn.some((r) => r && r.signal === 'first_material'),
    'LEG 3 (not silenced, candidate): session B own marker must still produce a first_material candidate reach'
  );
}

async function legMutation(tmpDirRoot) {
  const tmpRoom = fs.mkdtempSync(path.join(tmpDirRoot, 'mut-room-'));
  const seedA = await runWorker([tmpRoom, '237-session-A', 'cascade']);
  assert.strictEqual(seedA.code, 0, 'worker (session A, cascade, mutation fixture) must exit 0; stderr: ' + seedA.stderr);

  const mutated = loadMutatedInsightSensors(tmpDirRoot);
  const ctx = { roomDir: tmpRoom, lowFillSections: null };
  const turnForB = { userText: '', sectionPath: null, sessionId: '237-session-B' };

  const reachesForB = mutated.dispatchSensors(turnForB, {}, ctx);
  assert.ok(
    reachesForB.some((r) => r && r.signal === 'artifact_filed'),
    'LEG 4 (MUTATION): with the ownership check textually neutralized, session B must see the marker seeded by session A as artifact_filed again -- the fence must actually bite'
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  assert.ok(fs.existsSync(WORKER_SCRIPT), 'worker script missing: ' + WORKER_SCRIPT);

  const tmpDirRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reach03-fence-'));
  const legRoom1And2 = fs.mkdtempSync(path.join(tmpDirRoot, 'room-1-2-'));
  const legRoom3 = fs.mkdtempSync(path.join(tmpDirRoot, 'room-3-'));

  const results = [];
  async function leg(name, fn) {
    try {
      await fn();
      results.push({ name: name, passed: true });
      console.log('LEG PASS: ' + name);
    } catch (e) {
      results.push({ name: name, passed: false, error: (e && e.message) || String(e) });
      console.log('LEG FAIL: ' + name + ' -- ' + ((e && e.message) || e));
    }
  }

  try {
    await leg('Leg 1 (BLEED CLOSED) + Leg 2 (NOT SILENCED) -- artifact_filed', () => legBleedClosedAndNotSilenced(legRoom1And2));
    await leg('Leg 3 (FIRST_MATERIAL PARITY) -- first_material', () => legFirstMaterialParity(legRoom3));
    await leg('Leg 4 (MUTATION) -- neutralized ownership check reopens the bleed', () => legMutation(tmpDirRoot));
  } finally {
    try { fs.rmSync(tmpDirRoot, { recursive: true, force: true }); } catch (_e) { /* best-effort teardown */ }
    restoreEnv();
  }

  const failed = results.filter((r) => !r.passed);
  console.log('');
  console.log('========================================');
  console.log('  test-237-session-scope: ' + (results.length - failed.length) + '/' + results.length + ' legs passed');
  console.log('========================================');
  if (failed.length > 0) {
    console.log('FAILED LEGS:');
    for (const f of failed) {
      console.log('  - ' + f.name + ': ' + f.error);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  restoreEnv();
  process.stderr.write('test-237-session-scope FATAL: ' + ((err && err.message) || err) + '\n');
  if (err && err.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
});
