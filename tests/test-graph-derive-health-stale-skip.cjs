#!/usr/bin/env node
'use strict';

/*
 * Quick 260917-o1e Task 1 -- the five-leg RED-to-GREEN proof for the
 * self-locking encoder_unavailable verdict in graph-derive-health.
 *
 * WHY THIS FILE EXISTS AS GROUND TRUTH, NOT CODE-SHAPE (mirrors the
 * tests/test-233-graph-derive-health.cjs precedent this file copies its
 * fixture helpers from, verbatim, per that suite's own phase-frozen-gate
 * rule -- this task edits ONLY this new file and tests/run-all-233.sh):
 * every assertion below reads REAL state: a real `.mindrian/room.db` seeded
 * through the repo's own openRoomDb + navigation writeEdge/logMemoryEvent
 * chokepoints, and a real `.mindrian/graph-derive-queue.json` /
 * `.mindrian/graph-derive-heal-attempts.json` read back off disk. There is
 * not one mocked return value in the heal path.
 *
 * Legs:
 *   a. GREEN from the start (today's baseline): a room with BELONGS_TO edges,
 *      a stale derivation_skipped(encoder_unavailable) event, and NO marker
 *      file reports encoderUnavailable===true, status==='warn'.
 *   b. RED: the same room PLUS a derivation_completed event 60s AFTER the
 *      skip reports encoderUnavailable===false, needsHeal===false, and no
 *      encoder-not-installed sentence in reasons[].
 *   c. RED: fix() with a present-probe on a leg-a-shaped room writes the
 *      heal-attempt marker, grows the real queue file, and returns a
 *      recovery with status 'ok'.
 *   d. RED: fix() with an absent-probe on a leg-a-shaped room returns a
 *      recovery with status 'warn' and writes NO marker file.
 *   e. RED (completion half): an in-process drain over a room with an
 *      available encoder writes exactly one derivation_completed event
 *      carrying integer pairs_scored/edges_written; the same drain forced
 *      unavailable writes derivation_skipped and NO derivation_completed.
 *
 * Hermetic: MOS_NO_DETACHED_DERIVE=1 set at the top before any require
 * (precedent tests/test-224-per-write-derive.cjs:24). MINDRIAN_ROOMS_HOME and
 * HOME are overridden onto scratch dirs around every in-process check()/fix()
 * call so the developer's real ~/MindrianRooms is never read or written.
 * tests/ is on the check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so
 * requiring room-db.cjs here is sanctioned.
 *
 * No em-dashes (CLAUDE.md HARD RULE). CJS only.
 */

// Disable the real detached drain spawn BEFORE requiring anything that could
// touch it, so the in-process drain in leg e is the only writer (race-free).
process.env.MOS_NO_DETACHED_DERIVE = '1';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const healthMod = require(path.join(REPO, 'lib', 'core', 'doctor', 'graph-derive-health-module.cjs'));
const memoryEvents = require(path.join(REPO, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const sweep = require(path.join(REPO, 'scripts', 'gsd-graph-derive-sweep.cjs'));
const drain = require(path.join(REPO, 'scripts', 'gsd-graph-derive-drain.cjs'));
const classifier = require(path.join(REPO, 'lib', 'core', 'graph-derive-classifier.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-224.cjs'));

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

async function asyncScenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

// ---------- Sandbox helpers (copied from tests/test-233-graph-derive-health.cjs;
// that suite is a phase-frozen gate and must not be edited by this task) ----------

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-o1e-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function queueFilePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'graph-derive-queue.json');
}

function readQueueFile(roomDir) {
  try { return JSON.parse(fs.readFileSync(queueFilePath(roomDir), 'utf8')); } catch (_) { return null; }
}

function healAttemptFilePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'graph-derive-heal-attempts.json');
}

// Seed a room.db through the repo's OWN doors: openRoomDb for the handle, then
// the raw BELONGS_TO structural upsert production actually uses
// (lib/core/lazygraph-ops.cjs::indexArtifact, line 397-401), reproduced here
// verbatim per the 233 suite's own fixture (BELONGS_TO is deliberately NOT a
// navigation.writeEdge chokepoint type).
function seedRoomWithBelongsTo(roomDir, count) {
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDb.openRoomDb(roomDir);
  try {
    for (let i = 0; i < count; i += 1) {
      db.prepare('INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
        .run('n' + i, 'section' + i, 'BELONGS_TO');
    }
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// Seed a derivation_skipped(encoder_unavailable) memory_event through the
// production door with the clock seam (verified fact 4: logEvent's opts.now),
// so ordering is deterministic and never depends on a sleep.
function seedSkipEvent(roomDir, atMs) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    const res = navigation.logMemoryEvent(db, 'derivation_skipped', {
      reason: 'encoder_unavailable',
      trigger: 'room-sweep',
      pairs_skipped: 4,
      dedupe_key: 'derivation_skipped:' + path.resolve(roomDir),
      source_path: 'derivation:skip',
      created_by: 'system',
    }, { now: () => atMs });
    assert.equal(res.ok, true, 'fixture seed logMemoryEvent(derivation_skipped) must succeed: ' + JSON.stringify(res));
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// Seed a derivation_completed memory_event (R1 field set) through the same
// production door. Returns the raw logMemoryEvent result so leg b can assert
// on it directly (rather than assuming success).
function seedCompletionEvent(roomDir, atMs) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    return navigation.logMemoryEvent(db, 'derivation_completed', {
      pairs_scored: 3,
      edges_written: 1,
      trigger: 'room-sweep',
      dedupe_key: 'derivation_completed:' + path.resolve(roomDir),
      source_path: 'derivation:complete',
      created_by: 'system',
    }, { now: () => atMs });
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// Build a scratch registry. `rooms` is an array of names; the first is active
// unless `active` is given.
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

// Run fn with MINDRIAN_ROOMS_HOME and HOME pointed at scratch dirs, restoring
// the previous values in a finally, so the developer's real ~/MindrianRooms is
// never read or written by an in-process check()/fix() call.
function withHomes(scratch, fn) {
  const prevRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
  const prevHome = process.env.HOME;
  process.env.MINDRIAN_ROOMS_HOME = scratch;
  process.env.HOME = scratch;
  try { return fn(); } finally {
    if (prevRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prevRoomsHome;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
  }
}

// T0 in the past so both the skip and (for leg b) the completion event never
// collide with a live Date.now(), and both are strictly ordered.
const T0 = Date.now() - 3600000;

// Deterministic semantic encoder for leg e's "available" room (verbatim
// precedent from tests/test-224-per-write-derive.cjs::encodeFn).
function encodeFn(texts) {
  return texts.map((t) => {
    const s = String(t);
    if (/meal-kit|home cooking delivery|recurring parcel/i.test(s)) {
      return [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    const crypto = require('node:crypto');
    const h = crypto.createHash('md5').update(s).digest();
    const slot = 1 + (h[0] % 9);
    const v = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    v[slot] = 1;
    return v;
  });
}

const injectedDeriveFn = (step) => classifier.scoreBasedDeriveFn(step, { scoreOpts: { encodeFn } });

// ---------- Leg a: GREEN from the start (today's baseline) ----------

scenario('leg a - stale skip, no marker -> encoderUnavailable true, status warn', () => {
  const scratch = makeScratchDir('lega');
  try {
    const roomDir = path.join(scratch, 'stale');
    seedRoomWithBelongsTo(roomDir, 2);
    seedSkipEvent(roomDir, T0);
    const h = healthMod.detectRoomHealth(roomDir);
    assert.equal(h.encoderUnavailable, true, 'encoderUnavailable');
    assert.equal(h.status, 'warn', 'status');
  } finally { rmrf(scratch); }
});

// ---------- Leg b: a later derivation_completed clears the verdict ----------

scenario('leg b - a later derivation_completed clears encoderUnavailable', () => {
  assert.ok(
    memoryEvents.EVENT_TYPES.has('derivation_completed'),
    'EVENT_TYPES must carry derivation_completed (R1a) before this leg can pass; '
    + 'without it logMemoryEvent returns invalid_event_type and the read silently widens'
  );
  const scratch = makeScratchDir('legb');
  try {
    const roomDir = path.join(scratch, 'recovered');
    seedRoomWithBelongsTo(roomDir, 2);
    seedSkipEvent(roomDir, T0);
    const completionRes = seedCompletionEvent(roomDir, T0 + 60000);
    assert.equal(completionRes.ok, true, 'seeding the completion event must succeed: ' + JSON.stringify(completionRes));

    const h = healthMod.detectRoomHealth(roomDir);
    assert.equal(h.encoderUnavailable, false, 'encoderUnavailable');
    assert.equal(h.needsHeal, false, 'needsHeal');
    assert.ok(
      !h.reasons.some((r) => /encoder/i.test(r) && /not installed/i.test(r)),
      'reasons must not carry an encoder-not-installed sentence, got: ' + JSON.stringify(h.reasons)
    );
  } finally { rmrf(scratch); }
});

// ---------- Leg c: fix() with a present probe heals the stale skip ----------

scenario('leg c - fix() with a present probe writes the marker, grows the queue, status ok', () => {
  const scratch = makeScratchDir('legc');
  try {
    const roomDir = path.join(scratch, 'stale-fix');
    seedRoomWithBelongsTo(roomDir, 2);
    seedSkipEvent(roomDir, T0);
    makeScratchRegistry(scratch, ['stale-fix'], 'stale-fix');

    withHomes(scratch, () => {
      const checkRes = healthMod.check({ flags: {} });
      assert.equal(checkRes.rooms.length, 1, 'one room in scope');
      assert.equal(checkRes.rooms[0].encoderUnavailable, true, 'precondition: encoderUnavailable true');

      assert.equal(readQueueFile(roomDir), null, 'precondition: no queue file yet');
      assert.equal(fs.existsSync(healAttemptFilePath(roomDir)), false, 'precondition: no marker file yet');

      const fixRes = healthMod.fix({ check_result: checkRes, dryRun: false, probeEncoderPresence: () => true });

      assert.equal(fs.existsSync(healAttemptFilePath(roomDir)), true, 'marker file written on a present probe');
      const q = readQueueFile(roomDir);
      assert.ok(q && Array.isArray(q.entries) && q.entries.length >= 1, 'the real queue file grew on disk');
      const rec = fixRes.recoveries.find((r) => r.room === 'stale-fix');
      assert.ok(rec, 'a recovery was pushed for the room');
      assert.equal(rec.status, 'ok', 'recovery status is ok on a present probe');
    });
  } finally { rmrf(scratch); }
});

// ---------- Leg d: fix() with an absent probe keeps today's warn ----------

scenario('leg d - fix() with an absent probe keeps warn and writes no marker', () => {
  const scratch = makeScratchDir('legd');
  try {
    const roomDir = path.join(scratch, 'stale-fix');
    seedRoomWithBelongsTo(roomDir, 2);
    seedSkipEvent(roomDir, T0);
    makeScratchRegistry(scratch, ['stale-fix'], 'stale-fix');

    withHomes(scratch, () => {
      const checkRes = healthMod.check({ flags: {} });
      assert.equal(checkRes.rooms[0].encoderUnavailable, true, 'precondition: encoderUnavailable true');

      const fixRes = healthMod.fix({ check_result: checkRes, dryRun: false, probeEncoderPresence: () => false });

      assert.equal(fs.existsSync(healAttemptFilePath(roomDir)), false, 'no marker file written on an absent probe');
      const rec = fixRes.recoveries.find((r) => r.room === 'stale-fix');
      assert.ok(rec, 'a recovery was pushed for the room');
      assert.equal(rec.status, 'warn', 'recovery status stays warn on an absent probe');
    });
  } finally { rmrf(scratch); }
});

// ---------- Leg e: the drain's completion-side memory ----------

async function legECompletionSide() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-o1e-lege-ok-'));
  try {
    const fixture = await buildFixtureRoom224(tmp, { artifactCount: 3 });
    const roomDir = fixture.roomDir;

    sweep.enqueueDerive(roomDir);
    await drain.drainDerive(roomDir, { deriveFn: injectedDeriveFn, probeOpts: { encodeFn } });

    const db = roomDb.openRoomDb(roomDir);
    let rows;
    try {
      rows = memoryEvents.findRecentChanges(db, 0, { eventType: 'derivation_completed', limit: 5 });
    } finally {
      roomDb.closeRoomDb(db);
    }
    assert.equal(rows.length, 1, 'exactly one derivation_completed row, got ' + rows.length);
    assert.ok(Number.isInteger(rows[0].properties.pairs_scored), 'pairs_scored is an integer');
    assert.ok(Number.isInteger(rows[0].properties.edges_written), 'edges_written is an integer');
  } finally {
    rmrf(tmp);
  }
}

async function legEForcedUnavailableSide() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-o1e-lege-skip-'));
  try {
    const fixture = await buildFixtureRoom224(tmp, { artifactCount: 3 });
    const roomDir = fixture.roomDir;

    sweep.enqueueDerive(roomDir);
    await drain.drainDerive(roomDir, { probeOpts: { _forceUnavailable: true } });

    const db = roomDb.openRoomDb(roomDir);
    let skippedRows;
    let completedRows;
    try {
      skippedRows = memoryEvents.findRecentChanges(db, 0, { eventType: 'derivation_skipped', limit: 5 });
      completedRows = memoryEvents.findRecentChanges(db, 0, { eventType: 'derivation_completed', limit: 5 });
    } finally {
      roomDb.closeRoomDb(db);
    }
    assert.equal(skippedRows.length, 1, 'exactly one derivation_skipped row, got ' + skippedRows.length);
    assert.equal(completedRows.length, 0, 'zero derivation_completed rows, got ' + completedRows.length);
  } finally {
    rmrf(tmp);
  }
}

// ---------- Run + summarize ----------

async function main() {
  await asyncScenario('leg e - available encoder writes exactly one derivation_completed row', legECompletionSide);
  await asyncScenario('leg e - forced-unavailable encoder writes derivation_skipped, never derivation_completed', legEForcedUnavailableSide);

  process.stdout.write('\n');
  if (failed > 0) {
    process.stdout.write('FAIL: ' + failed + ' scenario(s) failed, ' + passed + ' passed\n');
    process.exit(1);
  }
  process.stdout.write('ALL PASS (' + passed + ' scenarios)\n');
}

main();
