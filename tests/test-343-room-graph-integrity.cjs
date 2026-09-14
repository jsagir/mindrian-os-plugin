#!/usr/bin/env node
'use strict';

/*
 * tests/test-343-room-graph-integrity.cjs -- Phase 343 Plan 02.
 *
 * Fixture scenarios pinning the exact counts, the null-not-zero rule, the
 * never-warn rule and the mutation regression for the room-graph integrity
 * organ (lib/core/navigation/graph-integrity-counts.cjs, the statement home,
 * and lib/core/doctor/room-graph-integrity-module.cjs, the doctor organ).
 *
 * Two deliberate fixture-seeding paths, both test SETUP only, never the code
 * under test:
 *   (1) the MUTATING door (room-db.cjs::openRoomDb) to get a real, fully
 *       migrated 16-column schema, then raw node:sqlite inserts on top of it
 *       to pin exact fixture data (setup only -- the code under test never
 *       opens a database itself);
 *   (2) a raw node:sqlite handle for the legacy three-column fixture, since
 *       a fully migrated fixture would pass the null-not-zero assertion even
 *       with the wrong code.
 * tests/ is on scripts/check-substrate.cjs's ALLOWED_DIRECT_IMPORT list, so
 * both node:sqlite and room-db.cjs are sanctioned here.
 *
 * Task 2 (the doctor organ) scenarios spawn NOTHING: they require the module
 * directly and call check(ctx) in-process against a scratch
 * MINDRIAN_ROOMS_HOME registry, mirroring graph-derive-health-module.cjs's
 * own test convention.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const {
  schemaVariant,
  countGraphIntegrity,
  NOT_MEASURABLE,
  STALE_PROPOSED_DAYS,
  ANCHOR_GRACE_DAYS,
  WRITER_NOTE,
} = require(path.join(REPO, 'lib', 'core', 'navigation', 'graph-integrity-counts.cjs'));
const { ALLOWED_EDGE_TYPES } = require(path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs'));

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

// ---------- Banned-adjective walk (rule 3 of the behavior list) -----------

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

// ---------- Fixture helpers ----------

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-343-' + suffix + '-'));
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

// Legacy three-column raw insert (no provenance/review_status/created_at columns).
function rawInsertLegacyNode(db, id, type) {
  db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(id, type, '{}');
}

function rawInsertLegacyEdge(db, source, target, type) {
  db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
    .run(source, target, type, '{}');
}

// Seed the migrated fixture: real 16-column schema via the mutating door
// (setup only), then raw inserts on top to pin exact fixture shape.
//
// Dangling population (WD-2, DISTINCT rows, the both-endpoints-missing edge
// is the load-bearing row): 3 edges with a missing source (ghost1/2/3 ->
// valid_a), 2 with a missing target (valid_b -> ghost4/5), 1 missing both
// (ghost6 -> ghost7). Under a naive endpoint-sum definition (a separate
// "source missing" count plus a separate "target missing" count, each
// counting the both-missing row again) this population would NOT collapse
// to a single figure of 6; the DISTINCT-rows definition (WD-2) is what pins
// it at 6, once per edge row, never twice for the row missing both.
//
// Anchor population (WD-1): 4 claim nodes, exactly 1 (claim_1) carries a
// SOURCED_FROM out-edge to an existing node.
//
// Window population (WD-10): 5 review_status='proposed' nodes, 3 with
// created_at 40 days in the past (past STALE_PROPOSED_DAYS=30), 2 at now.
//
// Plus 2 CONTRADICTS edges and 1 self-referencing edge, all with existing
// endpoints.
function seedMigratedFixture() {
  const roomDir = makeScratchDir('migrated');
  const db = roomDb.openRoomDb(roomDir);
  const now = Date.now();
  const fortyDaysAgo = now - (40 * 86400000);

  rawInsertNode(db, 'valid_a', 'artifact');
  rawInsertNode(db, 'valid_b', 'artifact');
  rawInsertNode(db, 'valid_c', 'artifact');
  rawInsertNode(db, 'valid_d', 'artifact');

  rawInsertNode(db, 'claim_1', 'claim');
  rawInsertNode(db, 'claim_2', 'claim');
  rawInsertNode(db, 'claim_3', 'claim');
  rawInsertNode(db, 'claim_4', 'claim');

  rawInsertNode(db, 'prop_1', 'observation', { reviewStatus: 'proposed', createdAt: fortyDaysAgo });
  rawInsertNode(db, 'prop_2', 'observation', { reviewStatus: 'proposed', createdAt: fortyDaysAgo });
  rawInsertNode(db, 'prop_3', 'observation', { reviewStatus: 'proposed', createdAt: fortyDaysAgo });
  rawInsertNode(db, 'prop_4', 'observation', { reviewStatus: 'proposed', createdAt: now });
  rawInsertNode(db, 'prop_5', 'observation', { reviewStatus: 'proposed', createdAt: now });

  // Dangling: 3 missing source.
  rawInsertEdge(db, 'ghost1', 'valid_a', 'INFORMS');
  rawInsertEdge(db, 'ghost2', 'valid_a', 'CONVERGES');
  rawInsertEdge(db, 'ghost3', 'valid_a', 'ENABLES');
  // Dangling: 2 missing target.
  rawInsertEdge(db, 'valid_b', 'ghost4', 'REFINES');
  rawInsertEdge(db, 'valid_b', 'ghost5', 'ROOT_CAUSES');
  // Dangling: 1 missing both (the load-bearing row).
  rawInsertEdge(db, 'ghost6', 'ghost7', 'DECOMPOSED_INTO');
  // Anchor for claim_1.
  rawInsertEdge(db, 'claim_1', 'valid_a', 'SOURCED_FROM');
  // 2 CONTRADICTS, both endpoints existing.
  rawInsertEdge(db, 'valid_c', 'valid_d', 'CONTRADICTS');
  rawInsertEdge(db, 'valid_a', 'valid_b', 'CONTRADICTS');
  // 1 self-referencing edge, endpoint existing.
  rawInsertEdge(db, 'valid_c', 'valid_c', 'RELATED_TO');

  return { db, roomDir };
}

function seedTypeOutsideAllowlistEdges(db) {
  // 4 BELONGS_TO rows, distinct (source, target) pairs; 1 malformed
  // (lowercase, spaced) type. All endpoints already exist in the migrated
  // fixture, so none of these add to edge_rows_missing_endpoint.
  rawInsertEdge(db, 'valid_a', 'valid_b', 'BELONGS_TO');
  rawInsertEdge(db, 'valid_b', 'valid_c', 'BELONGS_TO');
  rawInsertEdge(db, 'valid_c', 'valid_d', 'BELONGS_TO');
  rawInsertEdge(db, 'valid_d', 'valid_a', 'BELONGS_TO');
  rawInsertEdge(db, 'valid_a', 'valid_c', 'not a type');
}

function seedLegacyFixture() {
  const roomDir = makeScratchDir('legacy');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'));
  db.exec(
    'CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\');'
    + 'CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL,'
    + ' properties TEXT DEFAULT \'{}\', PRIMARY KEY (source, target, type));'
  );
  rawInsertLegacyNode(db, 'valid_a', 'artifact');
  rawInsertLegacyNode(db, 'valid_b', 'artifact');
  rawInsertLegacyNode(db, 'claim_1', 'claim');
  rawInsertLegacyNode(db, 'claim_2', 'claim');
  rawInsertLegacyNode(db, 'claim_3', 'claim');
  rawInsertLegacyNode(db, 'claim_4', 'claim');

  rawInsertLegacyEdge(db, 'ghost1', 'valid_a', 'INFORMS');
  rawInsertLegacyEdge(db, 'ghost2', 'valid_a', 'CONVERGES');
  rawInsertLegacyEdge(db, 'ghost3', 'valid_a', 'ENABLES');
  rawInsertLegacyEdge(db, 'valid_b', 'ghost4', 'REFINES');
  rawInsertLegacyEdge(db, 'valid_b', 'ghost5', 'ROOT_CAUSES');
  rawInsertLegacyEdge(db, 'ghost6', 'ghost7', 'DECOMPOSED_INTO');
  rawInsertLegacyEdge(db, 'claim_1', 'valid_a', 'SOURCED_FROM');

  return { db, roomDir };
}

// ================= Task 1: the statement home =================

let migratedFixture = null;
let legacyFixture = null;

scenario('schemaVariant: migrated fixture reports migrated', () => {
  migratedFixture = seedMigratedFixture();
  assert.equal(schemaVariant(migratedFixture.db), 'migrated');
});

scenario('countGraphIntegrity: migrated fixture returns the exact pinned counts', () => {
  const r = countGraphIntegrity(migratedFixture.db);
  assert.equal(
    r.edge_rows_missing_endpoint, 6,
    'DISTINCT rows per WD-2: the one edge missing BOTH endpoints counts once, '
    + 'not twice, so the total is 6 (3 missing-source + 2 missing-target + '
    + '1 missing-both), never the endpoint-sum figure a naive two-query '
    + 'add would produce'
  );
  assert.equal(r.claim_nodes_no_anchor_total, 3);
  assert.equal(r.proposed_nodes_past_window, 3);
  assert.equal(r.contradicts_edges, 2);
  assert.equal(r.self_referencing_edges, 1);
  assert.equal(r.schema_variant, 'migrated');
});

scenario('countGraphIntegrity: type-outside-allowlist statement on the migrated fixture', () => {
  seedTypeOutsideAllowlistEdges(migratedFixture.db);
  const r = countGraphIntegrity(migratedFixture.db);
  assert.equal(r.edge_rows_missing_endpoint, 6, 'unaffected by the new, endpoint-valid edges');
  assert.equal(r.edge_rows_type_outside_allowlist, 5);
  assert.deepEqual(r.edge_types_outside_allowlist, ['BELONGS_TO']);
  assert.equal(r.edge_types_outside_allowlist_unnameable, 1);
  assert.equal(ALLOWED_EDGE_TYPES.has('BELONGS_TO'), false, 'BELONGS_TO must not be a member of the live export');
  assert.equal(ALLOWED_EDGE_TYPES.has('not a type'), false);
});

scenario('countGraphIntegrity: legacy fixture reports null where the schema cannot answer', () => {
  legacyFixture = seedLegacyFixture();
  assert.equal(schemaVariant(legacyFixture.db), 'legacy');
  const r = countGraphIntegrity(legacyFixture.db);
  assert.strictEqual(r.proposed_nodes_past_window, null, 'strict null, not falsy 0');
  assert.strictEqual(r.claim_nodes_no_anchor_legacy, null);
  assert.strictEqual(r.claim_nodes_no_anchor_new, null);
  assert.strictEqual(r.claim_nodes_within_grace_window, null);
  assert.equal(r.edge_rows_missing_endpoint, 6);
  assert.equal(r.claim_nodes_no_anchor_total, 3);
  assert.equal(r.schema_variant, 'legacy');
  // The fourth statement is never null, even on a legacy three-column schema.
  assert.equal(typeof r.edge_rows_type_outside_allowlist, 'number');
  assert.notStrictEqual(r.edge_rows_type_outside_allowlist, null);
});

scenario('countGraphIntegrity: a room.db with no nodes/edges table returns zeros, never throws', () => {
  const db = new DatabaseSync(':memory:');
  assert.equal(schemaVariant(db), 'unreadable');
  const r = countGraphIntegrity(db);
  assert.equal(r.edge_rows_missing_endpoint, 0);
  assert.equal(r.claim_nodes_no_anchor_total, 0);
  assert.equal(r.contradicts_edges, 0);
  assert.equal(r.self_referencing_edges, 0);
  assert.equal(r.edge_rows_type_outside_allowlist, 0);
  assert.deepEqual(r.edge_types_outside_allowlist, []);
  assert.equal(r.edge_types_outside_allowlist_unnameable, 0);
  assert.strictEqual(r.proposed_nodes_past_window, null);
  assert.strictEqual(r.claim_nodes_no_anchor_legacy, null);
  assert.strictEqual(r.claim_nodes_no_anchor_new, null);
  assert.strictEqual(r.claim_nodes_within_grace_window, null);
  assert.equal(r.schema_variant, 'unreadable');
});

scenario('NOT_MEASURABLE: frozen, exactly two records, neither term is a count key', () => {
  assert.equal(Object.isFrozen(NOT_MEASURABLE), true);
  assert.equal(NOT_MEASURABLE.length, 2);
  const terms = NOT_MEASURABLE.map((r) => r.term);
  assert.deepEqual(terms.sort(), ['memory_event_provenance_edge', 'stub_or_placeholder_node']);
  for (const rec of NOT_MEASURABLE) {
    assert.equal(typeof rec.term, 'string');
    assert.equal(typeof rec.reason, 'string');
    assert.ok(rec.reason.length > 0);
  }
  const sampleResult = countGraphIntegrity(migratedFixture.db);
  for (const term of terms) {
    assert.equal(Object.prototype.hasOwnProperty.call(sampleResult, term), false);
  }
});

scenario('constants: STALE_PROPOSED_DAYS=30, ANCHOR_GRACE_DAYS=7', () => {
  assert.equal(STALE_PROPOSED_DAYS, 30);
  assert.equal(ANCHOR_GRACE_DAYS, 7);
});

scenario('WRITER_NOTE: names both writer gaps, cites graph-ops.cjs and Phase 273', () => {
  assert.equal(typeof WRITER_NOTE, 'string');
  assert.ok(WRITER_NOTE.indexOf('graph-ops.cjs') !== -1);
  assert.ok(WRITER_NOTE.indexOf('273') !== -1);
  assert.ok(WRITER_NOTE.indexOf('typed-claim.cjs') !== -1);
});

scenario('banned-adjective walk: no exported string or key carries a banned adjective', () => {
  const hits = [];
  walkForBannedWords(NOT_MEASURABLE, 'NOT_MEASURABLE', hits);
  walkForBannedWords(WRITER_NOTE, 'WRITER_NOTE', hits);
  walkForBannedWords(countGraphIntegrity(migratedFixture.db), 'countGraphIntegrity(migrated)', hits);
  walkForBannedWords(countGraphIntegrity(legacyFixture.db), 'countGraphIntegrity(legacy)', hits);
  assert.deepEqual(hits, [], 'banned adjective found: ' + JSON.stringify(hits));
});

scenario('no direct node:sqlite require in the statement home', () => {
  const src = fs.readFileSync(
    path.join(REPO, 'lib', 'core', 'navigation', 'graph-integrity-counts.cjs'), 'utf8'
  );
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false);
});

// ---------------------------------------------------------------------

if (migratedFixture) roomDb.closeRoomDb(migratedFixture.db);
if (legacyFixture) legacyFixture.db.close();
if (migratedFixture) rmrf(migratedFixture.roomDir);
if (legacyFixture) rmrf(legacyFixture.roomDir);

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
