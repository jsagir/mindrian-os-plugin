'use strict';

/*
 * Phase 120-02 Wave 2 Task 3 -- The LOAD-BEARING D-20 end-to-end integration test.
 *
 * CONSTITUTIONAL acceptance criterion of Phase 120: every Breakthrough node in
 * room.db has at least one DERIVED_FROM edge to an Artifact node. This test
 * proves the invariant end-to-end through the scanner -> writeBreakthrough ->
 * surfaceBreakthrough chain.
 *
 * The canonical D-20 Cypher invariant:
 *   MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact) RETURN count(a)
 *
 * Verified via the SQLite SQL form:
 *   SELECT COUNT(*) FROM edges e
 *   WHERE e.source = $breakthroughId AND e.type = 'DERIVED_FROM'
 *
 * The batch invariant (no orphan-provenance Breakthroughs):
 *   SELECT b.id FROM nodes b
 *   WHERE b.type = 'breakthrough'
 *     AND NOT EXISTS (
 *       SELECT 1 FROM edges e
 *       WHERE e.source = b.id AND e.type = 'DERIVED_FROM'
 *     )
 * MUST return ZERO rows.
 *
 * The surface/provenance pairing invariant:
 *   For every breakthrough_surfaced memory_event emitted, the corresponding
 *   Breakthrough node has at least one DERIVED_FROM edge.
 *
 * Canon Part 8 + D-20: this test failing = the phase ships a constitutional
 * violation; it must NEVER fail.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const scanner = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'scanner.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function seedArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

function seedTwoConvergenceGaps(roomDir) {
  const payload = {
    gaps: [
      {
        theme: 'd20-theme-A',
        artifacts: ['a1', 'a2', 'a3', 'a4'],
        differential: 0.7,
        sections: ['s1', 's2'],
        detected_at: Date.now(),
      },
      {
        theme: 'd20-theme-B',
        artifacts: ['a5', 'a6', 'a7', 'a8'],
        differential: 0.6,
        sections: ['s2', 's3'],
        detected_at: Date.now(),
      },
    ],
  };
  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'whitespace-results.json'),
    JSON.stringify(payload)
  );
}

test('120-02 D-20 Test 15: LOAD-BEARING -- every Breakthrough has >= 1 DERIVED_FROM edge end-to-end', () => {
  const roomDir = makeTmpRoom('p120-02-d20-t15-');
  const db = openRoomDb(roomDir);
  // Seed 8 artifacts so writeBreakthrough's DERIVED_FROM edges have valid FK targets.
  for (let i = 1; i <= 8; i++) seedArtifact(db, 'a' + i);
  db.close();

  seedTwoConvergenceGaps(roomDir);

  const result = scanner.scanForBreakthroughs(roomDir);
  assert.ok(result.top, 'scanner must return a top candidate');
  const targetId = result.top.id;

  // Re-open db to verify the D-20 invariant by SQL.
  const db2 = openRoomDb(roomDir);
  const bkRow = db2.prepare(
    "SELECT id, type FROM nodes WHERE id = ? AND type = 'breakthrough'"
  ).get(targetId);
  assert.ok(bkRow, 'Breakthrough node must exist after scanForBreakthroughs');

  const edgeRow = db2.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE source = ? AND type = 'DERIVED_FROM'"
  ).get(targetId);
  assert.ok(edgeRow.c >= 1,
    'D-20 LOAD-BEARING invariant: Breakthrough must have >= 1 DERIVED_FROM edge; got c=' + edgeRow.c);
  db2.close();
});

test('120-02 D-20 Test 16: BATCH invariant -- zero orphan-provenance Breakthroughs across full pipeline', () => {
  const roomDir = makeTmpRoom('p120-02-d20-t16-');
  const db = openRoomDb(roomDir);
  for (let i = 1; i <= 8; i++) seedArtifact(db, 'a' + i);
  db.close();

  seedTwoConvergenceGaps(roomDir);

  // Two scans: first persists one Breakthrough; second (with the same gaps)
  // would normally persist another (deterministic id depends on nowMs, so the
  // 2nd scan generates a fresh id). The BATCH invariant must hold across both.
  scanner.scanForBreakthroughs(roomDir);
  scanner.scanForBreakthroughs(roomDir);

  const db2 = openRoomDb(roomDir);
  // Canonical batch SQL form of the D-20 Cypher invariant.
  const orphans = db2.prepare(
    "SELECT b.id FROM nodes b " +
    "WHERE b.type = 'breakthrough' AND NOT EXISTS (" +
    "  SELECT 1 FROM edges e WHERE e.source = b.id AND e.type = 'DERIVED_FROM'" +
    ")"
  ).all();
  assert.equal(orphans.length, 0,
    'D-20 BATCH invariant: zero orphan-provenance Breakthroughs; found=' + orphans.length);
  db2.close();
});

test('120-02 D-20 Test 17: SURFACE/PROVENANCE pairing -- every breakthrough_surfaced has provenance', () => {
  const roomDir = makeTmpRoom('p120-02-d20-t17-');
  const db = openRoomDb(roomDir);
  for (let i = 1; i <= 8; i++) seedArtifact(db, 'a' + i);
  db.close();

  seedTwoConvergenceGaps(roomDir);

  const scanResult = scanner.scanForBreakthroughs(roomDir);
  assert.ok(scanResult.top);

  // Drive the surface side effect through the canonical chokepoint.
  const db2 = openRoomDb(roomDir);
  const surface = scanner.surfaceBreakthrough(scanResult.top, {
    db: db2, roomDir: roomDir, tier: 1, more_count: scanResult.more_count || 0,
  });
  assert.equal(surface.ok, true);

  // Read recent breakthrough_surfaced events; for each, assert the corresponding
  // Breakthrough node has >= 1 DERIVED_FROM edge. This is the CONSTITUTIONAL
  // acceptance criterion of Phase 120.
  const surfacedEvents = navigation.findRecentChanges(db2, 0, {
    eventType: 'breakthrough_surfaced', limit: 100,
  });
  assert.ok(surfacedEvents.length >= 1, 'at least one breakthrough_surfaced event must exist');

  for (const event of surfacedEvents) {
    const breakthroughId = event && event.properties && event.properties.breakthrough_id;
    assert.equal(typeof breakthroughId, 'string',
      'every breakthrough_surfaced event must carry a breakthrough_id');
    const provenanceRow = db2.prepare(
      "SELECT COUNT(*) AS c FROM edges WHERE source = ? AND type = 'DERIVED_FROM'"
    ).get(breakthroughId);
    assert.ok(provenanceRow.c >= 1,
      'D-20 SURFACE/PROVENANCE invariant: breakthrough_surfaced[' + breakthroughId + '] must have >= 1 DERIVED_FROM edge; got c=' + provenanceRow.c);
  }
  db2.close();
});

test('120-02 D-20 Test 18: surfaceBreakthrough refuses provenance-less candidate end-to-end', () => {
  const roomDir = makeTmpRoom('p120-02-d20-t18-');
  const db = openRoomDb(roomDir);
  // Insert a "constitutional bypass attempt": Breakthrough node with no edges.
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES ('bk:bypass', 'breakthrough', '{}', 'test', 'system', 'proposed', ?, ?)"
  ).run(nowMs, nowMs);

  const surface = scanner.surfaceBreakthrough(
    { id: 'bk:bypass', kind: 'convergence', artifact_ids: [], confidence: 0.6 },
    { db: db, roomDir: roomDir, tier: 1, more_count: 0 }
  );
  assert.equal(surface.ok, false);
  assert.equal(surface.reason, 'provenance_required');

  // The breakthrough_surface_blocked event MUST land for /mos:doctor traceability.
  const blocked = navigation.findRecentChanges(db, 0, {
    eventType: 'breakthrough_surface_blocked', limit: 10,
  });
  assert.equal(blocked.length, 1,
    'D-20 surface refusal must emit breakthrough_surface_blocked telemetry');
  db.close();
});
