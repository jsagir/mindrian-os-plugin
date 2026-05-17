'use strict';

/*
 * Phase 120-00 Wave 1 Task 3 -- the Breakthrough graph schema + the D-20 HARD FLOOR
 * structural enforcement test surface.
 *
 * 12 tests covering:
 *   1. validateProvenance happy path
 *   2. validateProvenance rejects empty artifact_ids (D-20 HARD FLOOR)
 *   3. validateProvenance rejects empty-string artifact ids
 *   4. validateProvenance rejects missing breakthrough.id
 *   5. writeBreakthrough happy path -- node + edges land via atomic transaction
 *   6. writeBreakthrough rejects provenance-less input
 *   7. D-20 CONSTITUTIONAL TEST: post-write SQL invariant
 *      SELECT COUNT(*) FROM edges WHERE source=$bk AND type='DERIVED_FROM' >= 1
 *   8. Atomic rollback on writeEdge failure (FK violation -- target missing)
 *   9. Initial surfaced flag is false
 *   10. D-20 BATCH INVARIANT: zero orphaned breakthroughs after all writes
 *   11. Canon Part 8 source-grep (zero brain-client require)
 *   12. writeBreakthrough does NOT emit breakthrough_surfaced (scanner does that)
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const schema = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'schema.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpDb(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  return { dir, db };
}

function seedArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

test('120-00 Task 3 Test 1: validateProvenance happy path', () => {
  const r = schema.validateProvenance({ id: 'bk:1', artifact_ids: ['a1', 'a2'] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.sanitized_artifact_ids, ['a1', 'a2']);
});

test('120-00 Task 3 Test 2: validateProvenance D-20 HARD FLOOR rejects empty artifact_ids', () => {
  const r = schema.validateProvenance({ id: 'bk:1', artifact_ids: [] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'provenance_required');
});

test('120-00 Task 3 Test 3: validateProvenance rejects empty-string artifact ids', () => {
  const r = schema.validateProvenance({ id: 'bk:1', artifact_ids: ['', null, undefined] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'provenance_required');
});

test('120-00 Task 3 Test 4: validateProvenance rejects missing breakthrough.id', () => {
  const r = schema.validateProvenance({ artifact_ids: ['a1'] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'breakthrough_id_required');
});

test('120-00 Task 3 Test 4b: validateProvenance rejects non-object input', () => {
  assert.equal(schema.validateProvenance(null).ok, false);
  assert.equal(schema.validateProvenance(undefined).ok, false);
  assert.equal(schema.validateProvenance('string').ok, false);
});

test('120-00 Task 3 Test 5: writeBreakthrough happy path -- node + edges land atomically', () => {
  const { dir, db } = makeTmpDb('p120-bk-happy-');
  seedArtifact(db, 'a1');
  seedArtifact(db, 'a2');
  const nowMs = Date.now();
  const candidate = {
    id: 'bk:happy',
    kind: 'convergence',
    confidence: 0.55,
    artifact_ids: ['a1', 'a2'],
    theme: 'X',
    differential: 0.6,
    cross_section_linked: false,
    detected_at: nowMs,
    window_start: nowMs - 14 * 86400000,
    window_end: nowMs,
  };
  const r = schema.writeBreakthrough(db, candidate);
  assert.equal(r.ok, true, 'writeBreakthrough should succeed; got reason=' + (r.reason || ''));
  assert.equal(r.breakthroughId, 'bk:happy');
  assert.equal(r.edgeIds.length, 2);

  // Verify the breakthrough node landed.
  const bkRow = db.prepare("SELECT id, type, properties FROM nodes WHERE id = 'bk:happy'").get();
  assert.equal(bkRow.type, 'breakthrough');
  const bkProps = JSON.parse(bkRow.properties);
  assert.equal(bkProps.kind, 'convergence');
  assert.equal(bkProps.confidence, 0.55);

  // Verify both DERIVED_FROM edges landed.
  const edgeCount = db.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE source = 'bk:happy' AND type = 'DERIVED_FROM'"
  ).get().c;
  assert.equal(edgeCount, 2, 'two DERIVED_FROM edges expected');

  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 Task 3 Test 6: writeBreakthrough rejects provenance-less input', () => {
  const { dir, db } = makeTmpDb('p120-bk-bad-');
  const r = schema.writeBreakthrough(db, { id: 'bk:bad', artifact_ids: [] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'provenance_required');

  // Verify NO breakthrough node landed.
  const bkRow = db.prepare("SELECT id FROM nodes WHERE id = 'bk:bad'").get();
  assert.equal(bkRow, undefined, 'no breakthrough node should land');

  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 Task 3 Test 7: D-20 CONSTITUTIONAL TEST -- Cypher invariant SQL query', () => {
  const { dir, db } = makeTmpDb('p120-bk-d20-');
  seedArtifact(db, 'a1');
  seedArtifact(db, 'a2');
  const r = schema.writeBreakthrough(db, {
    id: 'bk:d20',
    kind: 'convergence',
    confidence: 0.55,
    artifact_ids: ['a1', 'a2'],
  });
  assert.equal(r.ok, true);
  // The SQL equivalent of:
  //   MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact) WHERE b.id = 'bk:d20'
  //   RETURN count(a)
  // -- must return >= 1.
  const count = db.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE source = 'bk:d20' AND type = 'DERIVED_FROM'"
  ).get().c;
  assert.equal(count >= 1, true, 'D-20 invariant: count=' + count + ', expected >= 1');

  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 Task 3 Test 8: atomic rollback on writeEdge failure -- partial state cannot land', () => {
  const { dir, db } = makeTmpDb('p120-bk-rb-');
  seedArtifact(db, 'a-exists');
  // a-missing intentionally NOT seeded -- FK constraint will fail on the second edge insert.
  const r = schema.writeBreakthrough(db, {
    id: 'bk:partial',
    kind: 'convergence',
    confidence: 0.55,
    artifact_ids: ['a-exists', 'a-missing'],
  });
  assert.equal(r.ok, false, 'writeBreakthrough should fail when second edge target missing');
  assert.match(r.reason, /writeEdge_failed|edge_write_failed/, 'reason should reference edge failure');

  // Verify NO breakthrough node landed (ROLLBACK).
  const bkRow = db.prepare("SELECT id FROM nodes WHERE id = 'bk:partial'").get();
  assert.equal(bkRow, undefined, 'transaction rolled back -- no node landed');

  // Verify NO DERIVED_FROM edges landed.
  const edgeCount = db.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE source = 'bk:partial'"
  ).get().c;
  assert.equal(edgeCount, 0, 'transaction rolled back -- zero edges landed');

  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 Task 3 Test 9: initial surfaced flag is false', () => {
  const { dir, db } = makeTmpDb('p120-bk-sfc-');
  seedArtifact(db, 'a1');
  const r = schema.writeBreakthrough(db, {
    id: 'bk:surf',
    kind: 'convergence',
    confidence: 0.55,
    artifact_ids: ['a1'],
  });
  assert.equal(r.ok, true);
  const row = db.prepare("SELECT properties FROM nodes WHERE id = 'bk:surf'").get();
  const props = JSON.parse(row.properties);
  assert.equal(props.surfaced, false, 'surfaced flag initially false; flipped by Plan 120-02 scanner');

  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 Task 3 Test 10: D-20 BATCH INVARIANT -- zero orphaned breakthroughs', () => {
  const { dir, db } = makeTmpDb('p120-bk-batch-');
  seedArtifact(db, 'a1');
  seedArtifact(db, 'a2');
  seedArtifact(db, 'a3');
  // Two successful writes.
  assert.equal(schema.writeBreakthrough(db, { id: 'bk:1', kind: 'convergence', confidence: 0.55, artifact_ids: ['a1', 'a2'] }).ok, true);
  assert.equal(schema.writeBreakthrough(db, { id: 'bk:2', kind: 'convergence', confidence: 0.55, artifact_ids: ['a3'] }).ok, true);
  // One failed write (provenance-less).
  assert.equal(schema.writeBreakthrough(db, { id: 'bk:3', artifact_ids: [] }).ok, false);
  // One failed write (FK violation).
  assert.equal(schema.writeBreakthrough(db, { id: 'bk:4', kind: 'convergence', confidence: 0.55, artifact_ids: ['a-missing'] }).ok, false);

  // The batch invariant: every breakthrough node has >= 1 DERIVED_FROM edge.
  const orphans = db.prepare(
    "SELECT b.id FROM nodes b WHERE b.type = 'breakthrough' " +
    "AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.source = b.id AND e.type = 'DERIVED_FROM')"
  ).all();
  assert.equal(orphans.length, 0, 'D-20 batch invariant: orphaned breakthroughs=' + JSON.stringify(orphans));

  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 Task 3 Test 11: Canon Part 8 invariant -- zero Brain client require', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'schema.cjs'), 'utf8');
  assert.equal(/require\([^)]*brain-client/.test(src), false);
  assert.equal(/fetch\([^)]*brain\.mindrian/.test(src), false);
});

test('120-00 Task 3 Test 12: writeBreakthrough does NOT emit breakthrough_surfaced', () => {
  const { dir, db } = makeTmpDb('p120-bk-no-surf-');
  seedArtifact(db, 'a1');
  const r = schema.writeBreakthrough(db, {
    id: 'bk:no-surf',
    kind: 'convergence',
    confidence: 0.55,
    artifact_ids: ['a1'],
  });
  assert.equal(r.ok, true);
  // Verify no memory_event with event_type='breakthrough_surfaced' landed.
  const surfacedRows = db.prepare(
    "SELECT id FROM nodes WHERE type = 'memory_event' " +
    "AND json_extract(properties, '$.event_type') = 'breakthrough_surfaced'"
  ).all();
  assert.equal(surfacedRows.length, 0, 'writeBreakthrough must NOT emit breakthrough_surfaced; Plan 120-02 scanner does that');

  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 Task 3 Test 13 bonus: writeBreakthrough validates db handle', () => {
  const r = schema.writeBreakthrough(null, { id: 'bk:x', artifact_ids: ['a1'] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_db');
});

test('120-00 Task 3 Test 14 bonus: BREAKTHROUGH_KIND constants', () => {
  assert.equal(schema.BREAKTHROUGH_KIND.CONVERGENCE, 'convergence');
  assert.equal(schema.BREAKTHROUGH_KIND.CONTRADICTION_RESOLVED, 'contradiction_resolved');
  assert.equal(schema.BREAKTHROUGH_KIND.CROSS_DOMAIN_ANALOGY, 'cross_domain_analogy');
  assert.equal(schema.BREAKTHROUGH_KIND.REVERSE_SALIENT_CLOSED, 'reverse_salient_closed');
  assert.equal(schema.BREAKTHROUGH_NODE_TYPE, 'breakthrough');
});
