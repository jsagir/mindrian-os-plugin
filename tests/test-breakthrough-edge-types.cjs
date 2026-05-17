'use strict';

/*
 * Phase 120-00 Wave 1 -- ALLOWED_EDGE_TYPES Set-level acceptance for DERIVED_FROM.
 *
 * Mirrors lib/memory/edges-write.test.cjs (the Phase 125-00 writeEdge precedent).
 *
 * Asserts:
 *   1. Size floor (>= 3 -- baseline {DEFERRED, REJECTED} + DERIVED_FROM;
 *      floor-not-exact-count idiom preserved per Phase 109 invariant).
 *   2. Named membership: DERIVED_FROM.
 *   3. Prior-phase strings preserved (DEFERRED + REJECTED).
 *   4. writeEdge round-trip for DERIVED_FROM with seeded room.db (two nodes).
 *   5. writeEdge rejection for unknown edge_type returns {ok:false,
 *      reason:'invalid_edge_type'}.
 *   6. Object.freeze-on-Set behavior (documentation-only) preserved.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { ALLOWED_EDGE_TYPES, writeEdge } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

test('120-00 ALLOWED_EDGE_TYPES floor: size >= 3 (baseline 2 + 1 new)', () => {
  assert.equal(ALLOWED_EDGE_TYPES.size >= 3, true, 'size=' + ALLOWED_EDGE_TYPES.size + '; expected >= 3');
});

test('120-00 ALLOWED_EDGE_TYPES: DERIVED_FROM present', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('DERIVED_FROM'), true);
});

test('120-00 ALLOWED_EDGE_TYPES: prior-phase strings preserved (no regression)', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('DEFERRED'), true);
  assert.equal(ALLOWED_EDGE_TYPES.has('REJECTED'), true);
});

test('120-00 ALLOWED_EDGE_TYPES: Object.freeze documentation invariant; runtime guard is writeEdge rejection', () => {
  const before = ALLOWED_EDGE_TYPES.size;
  try {
    ALLOWED_EDGE_TYPES.add('PHASE_120_TEST_ONLY');
    ALLOWED_EDGE_TYPES.delete('PHASE_120_TEST_ONLY');
  } catch (_e) { /* graceful */ }
  assert.equal(ALLOWED_EDGE_TYPES.size, before, 'after add+delete the Set size returns to baseline');
});

test('120-00 writeEdge round-trip: DERIVED_FROM accepted with seeded room.db', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-00-edge-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  // Seed two nodes (the FK targets for the edge insert).
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES ('bk:1', 'breakthrough', '{}', 'test', 'system', 'proposed', ?, ?)"
  ).run(nowMs, nowMs);
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES ('art:1', 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(nowMs, nowMs);

  const result = navigation.writeEdge(db, {
    source_id: 'bk:1',
    target_id: 'art:1',
    edge_type: 'DERIVED_FROM',
    properties: { detected_at: nowMs, detector_kind: 'convergence' },
  });
  assert.equal(result.ok, true, 'writeEdge should accept DERIVED_FROM; got reason=' + (result.reason || ''));
  assert.match(result.edge_id, /^edge:DERIVED_FROM:\d+:[0-9a-f]{8}$/);
  assert.equal(result.type, 'DERIVED_FROM');
  assert.equal(result.source, 'bk:1');
  assert.equal(result.target, 'art:1');

  // Verify the row landed in edges.
  const row = db.prepare("SELECT source, target, type FROM edges WHERE source='bk:1' AND target='art:1' AND type='DERIVED_FROM'").get();
  assert.equal(row.type, 'DERIVED_FROM');
  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 writeEdge rejection: unknown edge_type returns invalid_edge_type', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-00-edge-rej-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const result = navigation.writeEdge(db, {
    source_id: 'x:1',
    target_id: 'x:2',
    edge_type: 'UNKNOWN_EDGE_TYPE_NOT_IN_SET',
    properties: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_edge_type');
  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 writeEdge validation: missing source_id returns invalid_source_id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-00-edge-srcid-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const result = navigation.writeEdge(db, {
    target_id: 'x:2',
    edge_type: 'DERIVED_FROM',
    properties: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_source_id');
  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});
