#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 233 Plan 01 Task 1 -- the graph-derive-health doctor class (RCA item 4d).
 *
 * WHY THIS FILE EXISTS AS GROUND TRUTH, NOT CODE-SHAPE. The whole phase exists
 * because a prior fix's own status nearly shipped unverified (T-233-04, the
 * check-card-fire.cjs lesson). So every assertion below reads REAL state: a real
 * `.mindrian/room.db` seeded through the repo's own openRoomDb + navigation
 * writeEdge chokepoint, and a real `.mindrian/graph-derive-queue.json` read back
 * off disk with fs.readFileSync. There is not one mocked return value in the
 * heal path: a status:'ok' claim can never mask a real zero-cascade-edge room.
 *
 * Scenarios:
 *   1. detectRoomHealth: BELONGS_TO present + ZERO cascade edges (the exact
 *      ~16-damaged-room shape) -> needsHeal true, status 'fail'.
 *   2. detectRoomHealth: same room WITH a cascade edge -> needsHeal false, 'ok'.
 *   3. detectRoomHealth: queue entry older than QUEUE_STUCK_DAYS -> 'warn' with
 *      a queue-stuck reason.
 *   4. detectRoomHealth: no `.mindrian/room.db` at all -> 'skip' (Tier 0 normal,
 *      never an error -- the D-05 convention).
 *   5. detectRoomHealth: failure log present -> 'warn'.
 *   6. check(ctx) with no flags -> scopes to the registry ACTIVE room only.
 *   7. check(ctx) with flags.cascadeRooms -> scopes to every registered room.
 *   8. check(ctx) survives a corrupt registry entry (T-233-01 self-DoS guard).
 *   9. fix(ctx) writes a REAL queue entry; ctx.dryRun writes nothing.
 *  10. spawn `doctor.cjs --graph-derive-health --json` -> rooms[0].status 'fail'.
 *  11. spawn `doctor.cjs --heal-room` -> the room's queue file on disk gains an
 *      entry; a SECOND spawn does not grow it (idempotent, byte-compared).
 *  12. reasons[] are scalar and capped (T-233-02): no reason exceeds 200 chars.
 *
 * Hermetic: MINDRIAN_ROOMS_HOME + HOME are overridden onto scratch dirs for
 * every spawn AND for every in-process check() call, so the developer's real
 * ~/MindrianRooms is never read or written. tests/ is on the check-substrate.cjs
 * ALLOWED_DIRECT_IMPORT list, so requiring room-db.cjs here is sanctioned.
 *
 * IIFE harness pattern from tests/test-232.1-room-graph-density.cjs.
 * No em-dashes (CLAUDE.md hard rule).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const healthMod = require(path.join(REPO, 'lib', 'core', 'doctor', 'graph-derive-health-module.cjs'));

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

// ---------- Sandbox helpers ----------

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-233-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function queueFilePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'graph-derive-queue.json');
}

function readQueueFile(roomDir) {
  // A REAL disk read, never a mocked return value. Absent file -> null so the
  // caller can distinguish "never written" from "written empty".
  try { return JSON.parse(fs.readFileSync(queueFilePath(roomDir), 'utf8')); } catch (_) { return null; }
}

// Seed a room.db through the repo's OWN doors: openRoomDb for the handle,
// navigation.writeEdge for every edge. Setup only. `edgeTypes` is the literal
// list of edge_type values written, so a caller controls the BELONGS_TO /
// cascade mix exactly.
function seedRoomWithEdges(roomDir, edgeTypes) {
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDb.openRoomDb(roomDir);
  try {
    let i = 0;
    for (const t of edgeTypes) {
      const r = navigation.writeEdge(db, {
        source_id: 'n' + i,
        target_id: 'n' + (i + 1),
        edge_type: t,
        properties: {},
      });
      assert.equal(r.ok, true, 'fixture seed writeEdge(' + t + ') must succeed: ' + JSON.stringify(r));
      i += 1;
    }
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// Build a scratch registry. `rooms` is an array of names; the first is active
// unless `active` is given. Every room dir is created (a room dir with no
// room.db is the Tier 0 case scenario 4 needs).
function makeScratchRegistry(scratch, rooms, active) {
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registry = { active: active || rooms[0] || null, rooms: {} };
  for (const name of rooms) {
    fs.mkdirSync(path.join(scratch, name), { recursive: true });
    registry.rooms[name] = { path: name };
  }
  fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify(registry, null, 2));
  return registry;
}

function writeRegistry(scratch, registry) {
  fs.writeFileSync(
    path.join(scratch, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
}

// Run fn with MINDRIAN_ROOMS_HOME pointed at the scratch registry. readRegistry
// reads the env var at CALL time, so this is the in-process equivalent of the
// spawn-time override below.
function withRoomsHome(scratch, fn) {
  const prev = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = scratch;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prev;
  }
}

// A hermetic scratch HOME carrying a plugin install + marketplace cache stamped
// with THIS repo's version, so the accumulative engine's running version of
// record is the version this code ships in. Without it the deferred-guard parks
// a module whose introduced_version is newer than the dev box's installed
// plugin, and no row would ever appear -- a silent no-op that looks like
// success (the Pitfall-5 trap tests/test-232.1-room-graph-density.cjs names).
function makeScratchPluginHome(scratch) {
  const version = JSON.parse(
    fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')
  ).version;
  const home = path.join(scratch, '.scratch-home');
  const stamp = JSON.stringify({ name: 'mindrian-os', version });
  const installDir = path.join(home, '.claude', 'plugins', 'mindrian-os', '.claude-plugin');
  const cacheDir = path.join(
    home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version, '.claude-plugin'
  );
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(installDir, 'plugin.json'), stamp);
  fs.writeFileSync(path.join(cacheDir, 'plugin.json'), stamp);
  return home;
}

function runDoctor(scratch, args) {
  const scratchHome = makeScratchPluginHome(scratch);
  const res = spawnSync('node', [DOCTOR].concat(args), {
    encoding: 'utf8',
    timeout: 30000,
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: scratch,
      HOME: scratchHome,
      MOS_NO_COLOR: '1',
    }),
  });
  // stdout ONLY: node:sqlite prints an ExperimentalWarning to stderr on first
  // load, so stdout + stderr would not parse as JSON.
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: res.status };
}

// ---------- Scenario 1: the damaged-room shape ----------

scenario('1. detectRoomHealth: BELONGS_TO + zero cascade edges -> needsHeal, status fail', () => {
  const scratch = makeScratchDir('s1');
  try {
    const roomDir = path.join(scratch, 'damaged');
    seedRoomWithEdges(roomDir, ['BELONGS_TO', 'BELONGS_TO']);
    const h = healthMod.detectRoomHealth(roomDir);
    assert.equal(h.hasDb, true, 'hasDb');
    assert.equal(h.hasBelongsTo, true, 'hasBelongsTo');
    assert.equal(h.cascadeEdgeCount, 0, 'cascadeEdgeCount');
    assert.equal(h.needsHeal, true, 'needsHeal');
    assert.equal(h.status, 'fail', 'status');
    assert.ok(Array.isArray(h.reasons) && h.reasons.length > 0, 'reasons non-empty');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 2: the healed shape ----------

scenario('2. detectRoomHealth: at least one cascade edge -> needsHeal false, status ok', () => {
  const scratch = makeScratchDir('s2');
  try {
    const roomDir = path.join(scratch, 'healthy');
    seedRoomWithEdges(roomDir, ['BELONGS_TO', 'INFORMS']);
    const h = healthMod.detectRoomHealth(roomDir);
    assert.equal(h.hasBelongsTo, true, 'hasBelongsTo');
    assert.equal(h.cascadeEdgeCount, 1, 'cascadeEdgeCount');
    assert.equal(h.needsHeal, false, 'needsHeal');
    assert.equal(h.status, 'ok', 'status');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 3: queue stuck ----------

scenario('3. detectRoomHealth: queue entry older than the stuck window -> warn', () => {
  const scratch = makeScratchDir('s3');
  try {
    const roomDir = path.join(scratch, 'stuck');
    seedRoomWithEdges(roomDir, ['BELONGS_TO', 'INFORMS']);
    const old = new Date(Date.now() - (healthMod.QUEUE_STUCK_DAYS + 4) * 86400000).toISOString();
    fs.writeFileSync(
      queueFilePath(roomDir),
      JSON.stringify({ entries: [{ roomDir, enqueued_at: old }] }, null, 2)
    );
    const h = healthMod.detectRoomHealth(roomDir);
    assert.equal(h.needsHeal, false, 'a room with cascade edges does not need heal');
    assert.equal(h.queueStuckCount, 1, 'queueStuckCount');
    assert.equal(h.status, 'warn', 'status');
    assert.ok(h.reasons.some((r) => /stuck/i.test(r)), 'reasons carries a queue-stuck note');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 4: Tier 0 ----------

scenario('4. detectRoomHealth: no room.db at all -> skip (Tier 0 normal, never an error)', () => {
  const scratch = makeScratchDir('s4');
  try {
    const roomDir = path.join(scratch, 'tier0');
    fs.mkdirSync(roomDir, { recursive: true });
    const h = healthMod.detectRoomHealth(roomDir);
    assert.equal(h.hasDb, false, 'hasDb');
    assert.equal(h.status, 'skip', 'status');
    assert.equal(h.needsHeal, false, 'a Tier 0 room is never a heal candidate');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 5: failure log present ----------

scenario('5. detectRoomHealth: failure log present -> warn with a failure-log reason', () => {
  const scratch = makeScratchDir('s5');
  try {
    const roomDir = path.join(scratch, 'failing');
    seedRoomWithEdges(roomDir, ['BELONGS_TO', 'INFORMS']);
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'graph-derive-failures.json'),
      JSON.stringify({ failures: [{ error: 'boom', at: new Date().toISOString() }] }, null, 2)
    );
    const h = healthMod.detectRoomHealth(roomDir);
    assert.equal(h.failureLogCount, 1, 'failureLogCount');
    assert.equal(h.status, 'warn', 'status');
    assert.ok(h.reasons.some((r) => /fail/i.test(r)), 'reasons carries a failure-log note');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 6: default scope is the ACTIVE room ----------

scenario('6. check(ctx) with no cascadeRooms flag -> scopes to the active room only', () => {
  const scratch = makeScratchDir('s6');
  try {
    makeScratchRegistry(scratch, ['alpha', 'beta'], 'alpha');
    seedRoomWithEdges(path.join(scratch, 'alpha'), ['BELONGS_TO']);
    seedRoomWithEdges(path.join(scratch, 'beta'), ['BELONGS_TO']);
    const res = withRoomsHome(scratch, () => healthMod.check({ flags: {} }));
    assert.equal(res.scope, 'active', 'scope');
    assert.equal(res.rooms.length, 1, 'exactly one room in scope');
    assert.equal(res.rooms[0].room, 'alpha', 'the active room');
    assert.equal(res.status, 'fail', 'worst-of status');
    assert.ok(typeof res.detail === 'string' && res.detail.length > 0, 'non-empty detail');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 7: --cascade-rooms widens the scope ----------

scenario('7. check(ctx) with flags.cascadeRooms -> scopes to every registered room', () => {
  const scratch = makeScratchDir('s7');
  try {
    makeScratchRegistry(scratch, ['alpha', 'beta'], 'alpha');
    seedRoomWithEdges(path.join(scratch, 'alpha'), ['BELONGS_TO', 'INFORMS']);
    seedRoomWithEdges(path.join(scratch, 'beta'), ['BELONGS_TO']);
    const res = withRoomsHome(scratch, () => healthMod.check({ flags: { cascadeRooms: true } }));
    assert.equal(res.scope, 'all', 'scope');
    assert.equal(res.rooms.length, 2, 'both rooms in scope');
    assert.equal(res.status, 'fail', 'worst-of status is the damaged room');
    const beta = res.rooms.find((r) => r.room === 'beta');
    assert.equal(beta.needsHeal, true, 'beta needs heal');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 8: self-DoS guard ----------

scenario('8. check(ctx): a corrupt registry entry soft-fails that one room only (T-233-01)', () => {
  const scratch = makeScratchDir('s8');
  try {
    const registry = makeScratchRegistry(scratch, ['alpha', 'beta'], 'alpha');
    seedRoomWithEdges(path.join(scratch, 'alpha'), ['BELONGS_TO', 'INFORMS']);
    seedRoomWithEdges(path.join(scratch, 'beta'), ['BELONGS_TO']);
    registry.rooms.corrupt = { path: 12345 }; // not a string
    writeRegistry(scratch, registry);
    const res = withRoomsHome(scratch, () => healthMod.check({ flags: { cascadeRooms: true } }));
    // The sweep COMPLETED: the healthy and damaged rooms are both still reported.
    const names = res.rooms.map((r) => r.room);
    assert.ok(names.includes('alpha'), 'alpha still reported');
    assert.ok(names.includes('beta'), 'beta still reported');
    assert.equal(res.status, 'fail', 'beta still drives the worst-of status');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 9: fix(ctx) writes a real queue entry ----------

scenario('9. fix(ctx): writes a REAL queue entry; dryRun writes nothing', () => {
  const scratch = makeScratchDir('s9');
  try {
    makeScratchRegistry(scratch, ['damaged'], 'damaged');
    const roomDir = path.join(scratch, 'damaged');
    seedRoomWithEdges(roomDir, ['BELONGS_TO']);

    withRoomsHome(scratch, () => {
      const checkRes = healthMod.check({ flags: {} });
      assert.equal(checkRes.status, 'fail', 'precondition: the room reports fail');

      // Dry run first: nothing on disk.
      const dry = healthMod.fix({ flags: {}, dryRun: true, check_result: checkRes });
      assert.equal(readQueueFile(roomDir), null, 'dryRun wrote NO queue file');
      assert.ok(dry.projected >= 1, 'dryRun projected at least one heal');

      // Real fix: a real file appears with a real entry.
      const res = healthMod.fix({ flags: {}, dryRun: false, check_result: checkRes });
      assert.equal(res.healed, 1, 'healed count');
      assert.ok(Array.isArray(res.recoveries) && res.recoveries.length === 1, 'recoveries');
      const q = readQueueFile(roomDir);
      assert.ok(q && Array.isArray(q.entries), 'queue file exists on disk');
      assert.equal(q.entries.length, 1, 'exactly one entry');
      assert.equal(path.resolve(q.entries[0].roomDir), path.resolve(roomDir), 'entry names the room');
    });
  } finally { rmrf(scratch); }
});

// ---------- Scenario 10: the CLI report ----------

scenario('10. doctor.cjs --graph-derive-health --json reports the damaged room as fail', () => {
  const scratch = makeScratchDir('s10');
  try {
    makeScratchRegistry(scratch, ['damaged'], 'damaged');
    seedRoomWithEdges(path.join(scratch, 'damaged'), ['BELONGS_TO']);
    const res = runDoctor(scratch, ['--graph-derive-health', '--json']);
    let report;
    try { report = JSON.parse(res.stdout); } catch (e) {
      throw new Error('doctor --json stdout did not parse: ' + res.stdout.slice(0, 400)
        + '\nstderr: ' + res.stderr.slice(0, 400));
    }
    const check = report.checks && report.checks['graph-derive-health'];
    assert.ok(check, 'report.checks[graph-derive-health] present');
    assert.ok(Array.isArray(check.rooms) && check.rooms.length === 1, 'one room reported');
    assert.equal(check.rooms[0].status, 'fail', 'the damaged room reports fail');
    assert.equal(check.status, 'fail', 'the class status is fail');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 11: --heal-room end to end + idempotence ----------

scenario('11. doctor.cjs --heal-room writes a real queue entry and is idempotent', () => {
  const scratch = makeScratchDir('s11');
  try {
    makeScratchRegistry(scratch, ['damaged'], 'damaged');
    const roomDir = path.join(scratch, 'damaged');
    seedRoomWithEdges(roomDir, ['BELONGS_TO']);

    assert.equal(readQueueFile(roomDir), null, 'precondition: no queue file yet');

    runDoctor(scratch, ['--heal-room']);
    const after1 = readQueueFile(roomDir);
    assert.ok(after1 && Array.isArray(after1.entries), 'queue file written by --heal-room');
    assert.equal(after1.entries.length, 1, 'exactly one entry after the first heal');
    assert.equal(path.resolve(after1.entries[0].roomDir), path.resolve(roomDir), 'entry names the room');

    const bytes1 = fs.readFileSync(queueFilePath(roomDir), 'utf8');
    runDoctor(scratch, ['--heal-room']);
    const after2 = readQueueFile(roomDir);
    assert.equal(after2.entries.length, 1, 'a second heal does NOT duplicate the entry');
    assert.equal(fs.readFileSync(queueFilePath(roomDir), 'utf8'), bytes1, 'queue file bytes unchanged');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 12: scalar, capped reasons ----------

scenario('12. reasons[] stay scalar and capped at 200 chars (T-233-02)', () => {
  const scratch = makeScratchDir('s12');
  try {
    const roomDir = path.join(scratch, 'noisy');
    seedRoomWithEdges(roomDir, ['BELONGS_TO', 'INFORMS']);
    // A deliberately oversized, corrupt failure log: the reader must not throw
    // and must not leak the body into reasons[].
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'graph-derive-failures.json'),
      'X'.repeat(50000)
    );
    const h = healthMod.detectRoomHealth(roomDir);
    assert.ok(Array.isArray(h.reasons), 'reasons is an array');
    for (const r of h.reasons) {
      assert.equal(typeof r, 'string', 'every reason is a string');
      assert.ok(r.length <= 200, 'reason capped at 200 chars, got ' + r.length);
      assert.ok(!/XXXXXXXXXX/.test(r), 'no artifact body text leaked into a reason');
    }
    assert.equal(h.failureLogCount, 0, 'an unparseable failure log defaults to 0 (T-233-05)');
  } finally { rmrf(scratch); }
});

// ---------- Summary ----------

process.stdout.write('\n');
if (failed > 0) {
  process.stdout.write('FAIL: ' + failed + ' scenario(s) failed, ' + passed + ' passed\n');
  process.exit(1);
}
process.stdout.write('ALL PASS (' + passed + ' scenarios)\n');
