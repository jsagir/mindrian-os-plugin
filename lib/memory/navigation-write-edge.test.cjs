'use strict';
// Phase 125-00 -- writeEdge chokepoint primitive tests.
// Adds the writeEdge edge-write surface to lib/core/navigation.cjs (the closed
// chokepoint per Phase 109). Mirrors the Phase 110-03 logMemoryEvent additive
// re-export precedent.
//
// Per Plan 125-00 frontmatter <behavior>: 9 scenarios -- happy-path (DEFERRED),
// allowlist enforcement, REJECTED edge shape, missing source_id, missing
// target_id, non-serializable properties, UPSERT idempotency, write-isolation
// across handles, and the extensibility-Set membership check.
//
// CRITICAL: this test REQUIRES navigation.cjs (the chokepoint) -- NOT the
// internal edges.cjs -- to prove the Task 2 re-export wiring is intact.

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const edgesInternal = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p125-00-writeedge-'));
  const db = openRoomDb(dir);
  return { dir, db };
}

// The shipped edges table has FK constraints on (source, target) -> nodes(id),
// per lib/core/lazygraph-ops.cjs initSchema(). Tests must insert anchor nodes
// before writeEdge, mirroring the fixture pattern in
// tests/test-navigation-packet-builder.cjs (Phase 109-07).
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p125-00-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}

test('Test 1: happy-path DEFERRED edge writes row with full properties', () => {
  const { db } = freshDb();
  seedAnchorNode(db, 'cmd:beautiful-question', 'command');
  seedAnchorNode(db, 'framework:Beautiful Question Framework', 'framework');
  const r = navigation.writeEdge(db, {
    source_id: 'cmd:beautiful-question',
    target_id: 'framework:Beautiful Question Framework',
    edge_type: 'DEFERRED',
    properties: {
      reason: 'not now',
      decision_id: 'memory_event:xyz',
      expires_at: '2026-06-12T00:00:00Z',
    },
  });
  ok(r.ok, 'writeEdge should return ok:true on valid input');
  equal(r.type, 'DEFERRED');
  equal(r.source, 'cmd:beautiful-question');
  equal(r.target, 'framework:Beautiful Question Framework');
  ok(typeof r.edge_id === 'string' && r.edge_id.startsWith('edge:DEFERRED:'), 'edge_id should be a non-empty string with edge:DEFERRED: prefix');

  const row = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = ?"
  ).get('cmd:beautiful-question', 'framework:Beautiful Question Framework', 'DEFERRED');
  ok(row, 'row should be present after writeEdge');
  const props = JSON.parse(row.properties);
  equal(props.reason, 'not now');
  equal(props.decision_id, 'memory_event:xyz');
  equal(props.expires_at, '2026-06-12T00:00:00Z');
});

test('Test 2: edge_type allowlist enforcement rejects unknown types', () => {
  const { db } = freshDb();
  const r = navigation.writeEdge(db, {
    source_id: 'cmd:x',
    target_id: 'framework:Y',
    edge_type: 'NOT_A_REAL_TYPE',
    properties: {},
  });
  equal(r.ok, false);
  equal(r.reason, 'invalid_edge_type');
  equal(r.detail, 'NOT_A_REAL_TYPE');
  // Verify no row was inserted.
  const row = db.prepare(
    "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = ?"
  ).get('cmd:x', 'framework:Y', 'NOT_A_REAL_TYPE');
  equal(row, undefined, 'no row should be inserted on rejected edge_type');
});

test('Test 3: REJECTED edge writes row without expires_at', () => {
  const { db } = freshDb();
  seedAnchorNode(db, 'cmd:beautiful-question', 'command');
  seedAnchorNode(db, 'framework:Beautiful Question Framework', 'framework');
  const r = navigation.writeEdge(db, {
    source_id: 'cmd:beautiful-question',
    target_id: 'framework:Beautiful Question Framework',
    edge_type: 'REJECTED',
    properties: { reason: 'wrong approach', decision_id: 'memory_event:abc' },
  });
  ok(r.ok);
  equal(r.type, 'REJECTED');
  const row = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = ?"
  ).get('cmd:beautiful-question', 'framework:Beautiful Question Framework', 'REJECTED');
  ok(row);
  const props = JSON.parse(row.properties);
  equal(props.reason, 'wrong approach');
  equal(props.decision_id, 'memory_event:abc');
  equal(Object.prototype.hasOwnProperty.call(props, 'expires_at'), false, 'REJECTED edge should not carry expires_at');
});

test('Test 4: missing source_id rejected with invalid_source_id', () => {
  const { db } = freshDb();
  const r = navigation.writeEdge(db, {
    source_id: '',
    target_id: 'framework:X',
    edge_type: 'DEFERRED',
    properties: {},
  });
  equal(r.ok, false);
  equal(r.reason, 'invalid_source_id');
});

test('Test 5: missing target_id rejected with invalid_target_id', () => {
  const { db } = freshDb();
  const r = navigation.writeEdge(db, {
    source_id: 'cmd:x',
    target_id: null,
    edge_type: 'DEFERRED',
    properties: {},
  });
  equal(r.ok, false);
  equal(r.reason, 'invalid_target_id');
});

test('Test 6: non-serializable properties rejected with properties_serialize_failed', () => {
  const { db } = freshDb();
  const circular = {};
  circular.self = circular;
  const r = navigation.writeEdge(db, {
    source_id: 'cmd:x',
    target_id: 'framework:Y',
    edge_type: 'DEFERRED',
    properties: circular,
  });
  equal(r.ok, false);
  equal(r.reason, 'properties_serialize_failed');
});

test('Test 7: UPSERT idempotency -- second write with different props replaces row', () => {
  const { db } = freshDb();
  seedAnchorNode(db, 'cmd:same', 'command');
  seedAnchorNode(db, 'framework:Same', 'framework');
  const r1 = navigation.writeEdge(db, {
    source_id: 'cmd:same',
    target_id: 'framework:Same',
    edge_type: 'DEFERRED',
    properties: { reason: 'first', decision_id: 'memory_event:1' },
  });
  ok(r1.ok);
  const r2 = navigation.writeEdge(db, {
    source_id: 'cmd:same',
    target_id: 'framework:Same',
    edge_type: 'DEFERRED',
    properties: { reason: 'second', decision_id: 'memory_event:2' },
  });
  ok(r2.ok);
  const rows = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = ?"
  ).all('cmd:same', 'framework:Same', 'DEFERRED');
  equal(rows.length, 1, 'UPSERT must keep exactly one row for (source, target, type)');
  const props = JSON.parse(rows[0].properties);
  equal(props.reason, 'second');
  equal(props.decision_id, 'memory_event:2');
});

test('Test 8: write-isolation -- second handle to same path sees the row', () => {
  const { dir, db } = freshDb();
  seedAnchorNode(db, 'cmd:iso', 'command');
  seedAnchorNode(db, 'framework:Iso', 'framework');
  const r = navigation.writeEdge(db, {
    source_id: 'cmd:iso',
    target_id: 'framework:Iso',
    edge_type: 'DEFERRED',
    properties: { reason: 'isolation-test', decision_id: 'memory_event:iso' },
  });
  ok(r.ok);
  // Open a second handle to the same room dir; the WAL-mode DB must surface the row.
  const db2 = openRoomDb(dir);
  const row = db2.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = ?"
  ).get('cmd:iso', 'framework:Iso', 'DEFERRED');
  ok(row, 'second handle must see the row -- no stuck transaction');
});

test('Test 9: ALLOWED_EDGE_TYPES Set membership (extensibility check)', () => {
  // Plan 125-00 ships DEFERRED + REJECTED for v1. Future Phases 116/117/118
  // extend this Set additively (mirrors EVENT_TYPES Set precedent in
  // memory-events.cjs). Test asserts a FLOOR -- present-and-additive -- not
  // an exact size, so a future phase extension cannot regress this baseline.
  ok(edgesInternal.ALLOWED_EDGE_TYPES instanceof Set, 'ALLOWED_EDGE_TYPES must be a Set');
  ok(edgesInternal.ALLOWED_EDGE_TYPES.has('DEFERRED'), 'DEFERRED must be in v1 allowlist');
  ok(edgesInternal.ALLOWED_EDGE_TYPES.has('REJECTED'), 'REJECTED must be in v1 allowlist');
});
