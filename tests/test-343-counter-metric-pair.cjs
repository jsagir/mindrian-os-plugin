#!/usr/bin/env node
'use strict';

/*
 * tests/test-343-counter-metric-pair.cjs -- Phase 343 Plan 05.
 *
 * Pins the first counter-metric pair (WD-9): claims filed, claims filed
 * past the citation lag, claims carrying a CONTRADICTS edge, claims past
 * the lag that are no edge's target, and the tri-state divergence boolean.
 *
 * Task 1 scenarios pin lib/core/navigation/claim-counter-metric.cjs alone.
 * Task 2 scenarios (appended below the Task 1 block) pin the doctor organ's
 * extended payload (lib/core/doctor/room-graph-integrity-module.cjs).
 *
 * Fixture-seeding approach reused verbatim from
 * tests/test-343-room-graph-integrity.cjs (its own file does not export
 * helpers -- it is a standalone runnable script -- so this file copies the
 * same two seeding paths rather than inventing a third): (1) the mutating
 * door (room-db.cjs::openRoomDb) for a real migrated schema, then raw
 * node:sqlite inserts on top to pin exact fixture data; (2) a raw
 * node:sqlite handle for the legacy three-column fixture.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const {
  countClaimCounterMetric,
  CITATION_LAG_DAYS,
} = require(path.join(REPO, 'lib', 'core', 'navigation', 'claim-counter-metric.cjs'));

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
  try {
    fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-343-05-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function rawInsertNode(db, id, type, opts) {
  const o = opts || {};
  const now = Date.now();
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) '
    + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id, type, '{}', 'test:fixture', 'system', null,
    o.reviewStatus || 'confirmed',
    typeof o.createdAt === 'number' ? o.createdAt : now,
    typeof o.createdAt === 'number' ? o.createdAt : now,
  );
}

function rawInsertEdge(db, source, target, type) {
  db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
    .run(source, target, type, '{}');
}

function rawInsertLegacyNode(db, id, type) {
  db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(id, type, '{}');
}

function rawInsertLegacyEdge(db, source, target, type) {
  db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
    .run(source, target, type, '{}');
}

const openFixtures = [];

// ================= Task 1: the pair's statement home =================

scenario('constants: CITATION_LAG_DAYS is 30', () => {
  assert.equal(CITATION_LAG_DAYS, 30);
});

scenario('countClaimCounterMetric: 10 claims, 6 past lag, 2 contradicted, 4 uncited -> divergence false', () => {
  const roomDir = makeScratchDir('pair-a');
  const db = roomDb.openRoomDb(roomDir);
  openFixtures.push({ db, roomDir, close: () => roomDb.closeRoomDb(db) });
  const now = Date.now();
  const fortyDaysAgo = now - (40 * 86400000);

  rawInsertNode(db, 'valid_a', 'artifact');
  rawInsertNode(db, 'valid_b', 'artifact');

  // 6 old claims (past the citation lag), 4 new claims (not past it).
  for (let i = 1; i <= 6; i += 1) {
    rawInsertNode(db, 'claim_' + i, 'claim', { createdAt: fortyDaysAgo });
  }
  for (let i = 7; i <= 10; i += 1) {
    rawInsertNode(db, 'claim_' + i, 'claim', { createdAt: now });
  }

  // 2 of the 6 old claims are targeted by a CONTRADICTS edge (claim_1,
  // claim_2): each both carries a CONTRADICTS edge AND has an incoming
  // edge, so it is excluded from the no-incoming-edge count. The remaining
  // 4 old claims (claim_3..claim_6) carry no edge at all.
  rawInsertEdge(db, 'valid_a', 'claim_1', 'CONTRADICTS');
  rawInsertEdge(db, 'valid_b', 'claim_2', 'CONTRADICTS');

  const r = countClaimCounterMetric(db);
  assert.equal(r.claims_filed, 10);
  assert.equal(r.claims_filed_past_citation_lag, 6);
  assert.equal(r.claims_with_contradicts_edge, 2);
  assert.equal(r.claims_no_incoming_edge_past_citation_lag, 4);
  assert.strictEqual(r.divergence, false);
});

scenario('countClaimCounterMetric: zero contradicted, every past-lag claim uncited -> divergence true', () => {
  const roomDir = makeScratchDir('pair-b');
  const db = roomDb.openRoomDb(roomDir);
  openFixtures.push({ db, roomDir, close: () => roomDb.closeRoomDb(db) });
  const now = Date.now();
  const fortyDaysAgo = now - (40 * 86400000);

  for (let i = 1; i <= 5; i += 1) {
    rawInsertNode(db, 'claim_' + i, 'claim', { createdAt: fortyDaysAgo });
  }

  const r = countClaimCounterMetric(db);
  assert.equal(r.claims_filed, 5);
  assert.equal(r.claims_filed_past_citation_lag, 5);
  assert.equal(r.claims_with_contradicts_edge, 0);
  assert.equal(r.claims_no_incoming_edge_past_citation_lag, 5);
  assert.strictEqual(r.divergence, true);
});

scenario('countClaimCounterMetric: zero claim nodes -> every count 0, divergence false never true', () => {
  const roomDir = makeScratchDir('pair-c');
  const db = roomDb.openRoomDb(roomDir);
  openFixtures.push({ db, roomDir, close: () => roomDb.closeRoomDb(db) });
  rawInsertNode(db, 'valid_a', 'artifact');

  const r = countClaimCounterMetric(db);
  assert.equal(r.claims_filed, 0);
  assert.equal(r.claims_filed_past_citation_lag, 0);
  assert.equal(r.claims_with_contradicts_edge, 0);
  assert.equal(r.claims_no_incoming_edge_past_citation_lag, 0);
  assert.strictEqual(r.divergence, false);
});

scenario('countClaimCounterMetric: legacy three-column schema reports strict null, never false', () => {
  const roomDir = makeScratchDir('pair-legacy');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'));
  openFixtures.push({ db, roomDir, close: () => db.close() });
  db.exec(
    'CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\');'
    + 'CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL,'
    + ' properties TEXT DEFAULT \'{}\', PRIMARY KEY (source, target, type));'
  );
  rawInsertLegacyNode(db, 'claim_1', 'claim');
  rawInsertLegacyNode(db, 'claim_2', 'claim');
  rawInsertLegacyNode(db, 'valid_a', 'artifact');
  rawInsertLegacyEdge(db, 'valid_a', 'claim_1', 'CONTRADICTS');

  const r = countClaimCounterMetric(db);
  assert.equal(typeof r.claims_filed, 'number');
  assert.equal(r.claims_filed, 2);
  assert.equal(typeof r.claims_with_contradicts_edge, 'number');
  assert.equal(r.claims_with_contradicts_edge, 1);
  assert.strictEqual(r.claims_filed_past_citation_lag, null, 'strict null, not falsy 0');
  assert.strictEqual(r.claims_no_incoming_edge_past_citation_lag, null, 'strict null, not falsy 0');
  assert.strictEqual(r.divergence, null, 'strict null, never false');
});

scenario('countClaimCounterMetric: no nodes/edges table returns zeros and false, never throws', () => {
  const db = new DatabaseSync(':memory:');
  const r = countClaimCounterMetric(db);
  assert.equal(r.claims_filed, 0);
  assert.equal(r.claims_filed_past_citation_lag, 0);
  assert.equal(r.claims_with_contradicts_edge, 0);
  assert.equal(r.claims_no_incoming_edge_past_citation_lag, 0);
  assert.strictEqual(r.divergence, false);
});

scenario('no direct node:sqlite require in the statement home', () => {
  const src = fs.readFileSync(
    path.join(REPO, 'lib', 'core', 'navigation', 'claim-counter-metric.cjs'), 'utf8'
  );
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false);
});

const BANNED_ADJECTIVES = [
  'orphan', 'orphaned', 'dangling', 'broken', 'corrupt', 'stale', 'unhealthy',
  'degraded', 'dense', 'sparse', 'density', 'risk', 'healthy',
];
const BANNED_RE = new RegExp('\\b(' + BANNED_ADJECTIVES.join('|') + ')\\b', 'i');

function walkForBannedWords(value, pathLabel, hits) {
  if (typeof value === 'string') {
    if (BANNED_RE.test(value)) hits.push(pathLabel + ' -> ' + JSON.stringify(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkForBannedWords(v, pathLabel + '[' + i + ']', hits));
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (BANNED_RE.test(key)) hits.push(pathLabel + '.' + key + ' (key)');
      walkForBannedWords(value[key], pathLabel + '.' + key, hits);
    }
  }
}

scenario('no key or string in the returned object carries a banned adjective or a float', () => {
  const roomDir = makeScratchDir('pair-banned');
  const db = roomDb.openRoomDb(roomDir);
  openFixtures.push({ db, roomDir, close: () => roomDb.closeRoomDb(db) });
  rawInsertNode(db, 'claim_1', 'claim');
  const r = countClaimCounterMetric(db);
  const hits = [];
  walkForBannedWords(r, 'countClaimCounterMetric', hits);
  assert.deepEqual(hits, [], 'banned adjective found: ' + JSON.stringify(hits));
  for (const key of Object.keys(r)) {
    if (typeof r[key] === 'number') {
      assert.equal(Number.isInteger(r[key]), true, key + ' is not an integer: ' + r[key]);
    }
  }
});

// ================= Task 2: the doctor organ's extended payload =================

const DOCTOR_MODULE_PATH = path.join(REPO, 'lib', 'core', 'doctor', 'room-graph-integrity-module.cjs');

function makeScratchRegistry(scratch, rooms, activeName) {
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registryRooms = {};
  for (const name of Object.keys(rooms)) {
    registryRooms[name] = rooms[name];
  }
  const registry = { active: activeName || null, rooms: registryRooms };
  fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify(registry, null, 2));
  return scratch;
}

function withScratchRoomsHome(scratch, fn) {
  const prior = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = scratch;
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prior;
  }
}

// Two fleet fixtures: one that diverges (past-lag claims, zero contradicted,
// all uncited), one that does not (a contradicted past-lag claim present).
function makeRoomDir(scratch, name, seedFn) {
  const roomDir = path.join(scratch, name);
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDb.openRoomDb(roomDir);
  seedFn(db);
  roomDb.closeRoomDb(db);
  return roomDir;
}

scenario('doctor organ: fleet sweep reports per-room claim_counter_metric and three-integer totals', () => {
  const scratch = makeScratchDir('organ-ccm');
  const now = Date.now();
  const fortyDaysAgo = now - (40 * 86400000);

  makeRoomDir(scratch, 'room-diverged', (db) => {
    rawInsertNode(db, 'claim_1', 'claim', { createdAt: fortyDaysAgo });
    rawInsertNode(db, 'claim_2', 'claim', { createdAt: fortyDaysAgo });
  });
  makeRoomDir(scratch, 'room-not-diverged', (db) => {
    rawInsertNode(db, 'valid_a', 'artifact');
    rawInsertNode(db, 'claim_1', 'claim', { createdAt: fortyDaysAgo });
    rawInsertEdge(db, 'valid_a', 'claim_1', 'CONTRADICTS');
  });
  makeScratchRegistry(
    scratch,
    { 'room-diverged': { path: 'room-diverged' }, 'room-not-diverged': { path: 'room-not-diverged' } },
    'room-diverged'
  );

  withScratchRoomsHome(scratch, () => {
    delete require.cache[DOCTOR_MODULE_PATH];
    const mod = require(DOCTOR_MODULE_PATH);
    const r = mod.check({ flags: { cascadeRooms: true } });
    assert.equal(r.status, 'ok');
    assert.equal(r.rooms.length, 2);

    const diverged = r.rooms.find((room) => room.room === 'room-diverged');
    const notDiverged = r.rooms.find((room) => room.room === 'room-not-diverged');
    assert.ok(diverged.claim_counter_metric);
    assert.ok(notDiverged.claim_counter_metric);
    assert.strictEqual(diverged.claim_counter_metric.divergence, true);
    assert.strictEqual(notDiverged.claim_counter_metric.divergence, false);

    assert.ok(r.totals.claim_counter_metric);
    const t = r.totals.claim_counter_metric;
    assert.equal(typeof t.rooms_diverged, 'number');
    assert.equal(typeof t.rooms_not_diverged, 'number');
    assert.equal(typeof t.rooms_not_measurable, 'number');
    assert.equal(t.rooms_diverged, 1);
    assert.equal(t.rooms_not_diverged, 1);
    assert.equal(t.rooms_not_measurable, 0);
    assert.equal(t.claims_filed, 3);
    assert.equal(t.claims_with_contradicts_edge, 1);

    // No absolute path and no node id leaked anywhere in the payload.
    const strings = [];
    (function collect(v) {
      if (typeof v === 'string') { strings.push(v); return; }
      if (Array.isArray(v)) { v.forEach(collect); return; }
      if (v && typeof v === 'object') { Object.values(v).forEach(collect); }
    })(r);
    for (const s of strings) {
      assert.equal(path.isAbsolute(s), false, 'payload string looks like an absolute path: ' + s);
      assert.equal(s.indexOf('claim_1') === -1, true, 'payload string leaks a node id: ' + s);
    }
  });
  rmrf(scratch);
});

for (const f of openFixtures) {
  try { f.close(); } catch (_) { /* best-effort */ }
  rmrf(f.roomDir);
}

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
