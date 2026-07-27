#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 233 Plan 01 Task 2 -- the heal-on-update auto-retrofit (RCA item 4c)
 * plus the Tri-Polar Desktop/Cowork nudge.
 *
 * WHAT 4c IS, IN PLAIN LANGUAGE. Phase 224-02 stopped NEW rot: a derivation that
 * fails now keeps its retry signal instead of silently deleting it. That fix is
 * forward-only. Roughly 16 rooms were already damaged before it shipped -- their
 * queues had been cleared, so nothing was left to retry, and they still carry
 * zero semantic cascade edges today. A user should not have to know that
 * happened in order to get it repaired, so the repair is a cadence:'once'
 * module: it fires by itself the first time doctor runs after the update,
 * inside its version window, and never again.
 *
 * GROUND TRUTH, NOT CODE SHAPE (T-233-04). Every heal assertion below reads the
 * damaged room's REAL `.mindrian/graph-derive-queue.json` off disk with
 * fs.readFileSync. The healthy room's queue is compared by CONTENT before and
 * after, so "we only touched what was broken" is proven, not asserted.
 *
 * Scenarios:
 *   1. check() on a 2-room registry (one healthy, one damaged) writes a REAL
 *      queue entry for the damaged room and leaves the healthy room untouched.
 *   2. a SECOND check() call does not grow the damaged room's queue (the
 *      dedup-by-roomDir contract of the sweep enqueue, inherited not rebuilt).
 *   3. ctx.dryRun counts without writing anything.
 *   4. no registry -> status 'skip' with a non-empty detail.
 *   5. the module exports check() and NOT fix() (fix_supported:false parity --
 *      the contract gate fails a fix_supported:false module that exports one).
 *   6. preflight-doctor contribute(): a 'fail' graph-derive-health status yields
 *      a plain-language re-derive nudge with NO JSON or table characters.
 *   7. contribute(): a 'warn' status also nudges.
 *   8. contribute(): an 'ok' status with no install drift yields an empty
 *      fragment (zero noise on healthy installs).
 *
 * Hermetic: MINDRIAN_ROOMS_HOME is overridden for every in-process call, so the
 * developer's real ~/MindrianRooms is never read or written. contribute() is
 * driven through an injected runDoctor stub, so no doctor subprocess is spawned.
 * tests/ is on the check-substrate.cjs ALLOWED_DIRECT_IMPORT list.
 *
 * No em-dashes (CLAUDE.md hard rule).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const retrofit = require(path.join(REPO, 'lib', 'core', 'doctor', 'graph-derive-heal-retrofit-module.cjs'));
const preflight = require(path.join(REPO, 'scripts', 'preflight-doctor.cjs'));

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

// ---------- Sandbox helpers (mirrored from test-233-graph-derive-health.cjs) ----------

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-233r-' + suffix + '-'));
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

function readQueueBytes(roomDir) {
  try { return fs.readFileSync(queueFilePath(roomDir), 'utf8'); } catch (_) { return null; }
}

// BELONGS_TO is written by the raw structural upsert lazygraph-ops.cjs uses
// (it is deliberately NOT in the navigation chokepoint's frozen edge set);
// cascade edges go through the chokepoint exactly as runDerivation writes them.
function seedRoomWithEdges(roomDir, edgeTypes) {
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDb.openRoomDb(roomDir);
  try {
    let i = 0;
    for (const t of edgeTypes) {
      if (t === 'BELONGS_TO') {
        db.prepare('INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
          .run('n' + i, 'section' + i, 'BELONGS_TO');
      } else {
        const r = navigation.writeEdge(db, {
          source_id: 'n' + i,
          target_id: 'n' + (i + 1),
          edge_type: t,
          properties: {},
        });
        assert.equal(r.ok, true, 'fixture seed writeEdge(' + t + ') must succeed: ' + JSON.stringify(r));
      }
      i += 1;
    }
  } finally {
    roomDb.closeRoomDb(db);
  }
}

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

function withRoomsHome(scratch, fn) {
  const prev = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = scratch;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prev;
  }
}

// Build the exact ~16-room RCA shape: one healthy room (has a cascade edge) and
// one damaged room (BELONGS_TO only, zero cascade edges).
function makeTwoRoomFixture(scratch) {
  makeScratchRegistry(scratch, ['healthy', 'damaged'], 'healthy');
  const healthy = path.join(scratch, 'healthy');
  const damaged = path.join(scratch, 'damaged');
  seedRoomWithEdges(healthy, ['BELONGS_TO', 'INFORMS']);
  seedRoomWithEdges(damaged, ['BELONGS_TO', 'BELONGS_TO']);
  return { healthy, damaged };
}

// ---------- Scenario 1: the retrofit repairs only what is broken ----------

scenario('1. check() enqueues the damaged room and leaves the healthy room untouched', () => {
  const scratch = makeScratchDir('s1');
  try {
    const { healthy, damaged } = makeTwoRoomFixture(scratch);
    // Give the healthy room a pre-existing queue file so "untouched" is a real
    // byte comparison, not just an absence check.
    fs.writeFileSync(queueFilePath(healthy), JSON.stringify({ entries: [] }, null, 2));
    const healthyBefore = readQueueBytes(healthy);

    const res = withRoomsHome(scratch, () => retrofit.check({ home: os.homedir(), running: '99.99.99', dryRun: false }));

    assert.equal(res.status, 'ok', 'status');
    assert.equal(res.healed, 1, 'exactly one room healed');
    assert.equal(res.rooms_scanned, 2, 'both rooms scanned');
    assert.ok(typeof res.detail === 'string' && res.detail.length > 0, 'non-empty detail');

    const q = readQueueFile(damaged);
    assert.ok(q && Array.isArray(q.entries), 'damaged room queue file exists on disk');
    assert.equal(q.entries.length, 1, 'exactly one entry for the damaged room');
    assert.equal(path.resolve(q.entries[0].roomDir), path.resolve(damaged), 'entry names the damaged room');

    assert.equal(readQueueBytes(healthy), healthyBefore, 'the healthy room queue file is byte-identical');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 2: idempotent ----------

scenario('2. a second check() does not grow the damaged room queue', () => {
  const scratch = makeScratchDir('s2');
  try {
    const { damaged } = makeTwoRoomFixture(scratch);
    withRoomsHome(scratch, () => retrofit.check({ running: '99.99.99', dryRun: false }));
    const bytes1 = readQueueBytes(damaged);
    assert.equal(readQueueFile(damaged).entries.length, 1, 'one entry after the first pass');

    withRoomsHome(scratch, () => retrofit.check({ running: '99.99.99', dryRun: false }));
    assert.equal(readQueueFile(damaged).entries.length, 1, 'still one entry after the second pass');
    assert.equal(readQueueBytes(damaged), bytes1, 'queue file bytes unchanged by the second pass');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 3: dry run ----------

scenario('3. ctx.dryRun counts without writing anything', () => {
  const scratch = makeScratchDir('s3');
  try {
    const { damaged } = makeTwoRoomFixture(scratch);
    const res = withRoomsHome(scratch, () => retrofit.check({ running: '99.99.99', dryRun: true }));
    assert.equal(res.healed, 1, 'dry run still counts the room it would heal');
    assert.equal(readQueueFile(damaged), null, 'dry run wrote NO queue file');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 4: no registry ----------

scenario('4. no registry -> skip with a non-empty detail', () => {
  const scratch = makeScratchDir('s4');
  try {
    const res = withRoomsHome(scratch, () => retrofit.check({ running: '99.99.99', dryRun: false }));
    assert.equal(res.status, 'skip', 'status');
    assert.equal(res.healed, 0, 'healed');
    assert.equal(res.rooms_scanned, 0, 'rooms_scanned');
    assert.ok(typeof res.detail === 'string' && res.detail.length > 0, 'non-empty detail');
  } finally { rmrf(scratch); }
});

// ---------- Scenario 5: fix_supported:false export parity ----------

scenario('5. the module exports check() and NOT fix() (fix_supported:false parity)', () => {
  assert.equal(typeof retrofit.check, 'function', 'exports check()');
  assert.equal(typeof retrofit.fix, 'undefined', 'does NOT export fix()');
});

// ---------- Tri-Polar: the Desktop/Cowork conversational nudge ----------

// A doctor --json report shaped exactly as doctor.cjs emits it, with the
// graph-derive-health class status under caller control.
function stubReport(graphStatus, driftDetected) {
  return {
    install: { status: 'ok', version: '1.0.0' },
    cache: { status: 'ok' },
    drift: { detected: !!driftDetected },
    checks: {
      'graph-derive-health': {
        status: graphStatus,
        detail: '1 of 2 room(s) need a derive re-enqueue',
        scope: 'all',
        rooms: [],
      },
    },
  };
}

const TABLE_OR_JSON_CHARS = /[{}|]/;

scenario('6. contribute(): a fail status yields a plain-language nudge, no JSON or table chars', () => {
  const frag = preflight.contribute({ runDoctor: () => stubReport('fail', false) });
  assert.equal(frag.has_payload, true, 'fragment carries a payload');
  assert.equal(frag.id, 'install-drift', 'rides the EXISTING frozen-ladder slot, no new entry');
  assert.ok(/re-derive/i.test(frag.full_payload), 'payload mentions a re-derive');
  assert.ok(/heal-room/.test(frag.full_payload), 'payload names the recovery command');
  assert.ok(!TABLE_OR_JSON_CHARS.test(frag.full_payload),
    'payload carries no JSON or table characters: ' + JSON.stringify(frag.full_payload));
  assert.ok(frag.one_line_pointer.length > 0, 'non-empty one-line pointer');
  assert.ok(!TABLE_OR_JSON_CHARS.test(frag.one_line_pointer), 'pointer carries no JSON or table characters');
});

scenario('7. contribute(): a warn status also nudges', () => {
  const frag = preflight.contribute({ runDoctor: () => stubReport('warn', false) });
  assert.equal(frag.has_payload, true, 'fragment carries a payload');
  assert.ok(/re-derive/i.test(frag.full_payload), 'payload mentions a re-derive');
});

scenario('8. contribute(): an ok status with no install drift stays silent', () => {
  const frag = preflight.contribute({ runDoctor: () => stubReport('ok', false) });
  assert.equal(frag.has_payload, false, 'no payload on a healthy install');
});

// ---------- Summary ----------

process.stdout.write('\n');
if (failed > 0) {
  process.stdout.write('FAIL: ' + failed + ' scenario(s) failed, ' + passed + ' passed\n');
  process.exit(1);
}
process.stdout.write('ALL PASS (' + passed + ' scenarios)\n');
