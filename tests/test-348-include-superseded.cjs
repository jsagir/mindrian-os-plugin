'use strict';
/*
 * tests/test-348-include-superseded.cjs -- Phase 348-04 Task 1 (SUPER-04/05).
 *
 * Proves the includeSuperseded behavior: a superseded endpoint is absent by
 * default and present on request, on EITHER side of the CONTRADICTS edge
 * (not only when the target is superseded), and a NULL review_status is
 * KEPT (SQLite's null-safe IS NOT), never silently dropped by a naive <>.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require('./helpers/fixture-room-348.cjs');
const navigation = require('../lib/core/navigation.cjs');
const { writeEdge } = require('../lib/core/navigation/edges.cjs');

// The fixture's own 'wide' schema pins review_status NOT NULL + CHECK'd
// (the real production shape), so it cannot express a NULL review_status
// row. A partially migrated room (Phase 109 columns present, review_status
// column NULLABLE, no CHECK) is legal per T-348-21; build that shape
// directly here, mirroring 348-03's own local 'mid' schema precedent
// (tests/test-348-schema-variants.cjs), but WITHOUT the NOT NULL/CHECK
// constraint on review_status specifically, since that constraint is the
// one thing this test needs to NOT hold.
const NODES_DDL_NULLABLE_STATUS =
  'CREATE TABLE nodes (' +
  '  id TEXT PRIMARY KEY, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  source_path TEXT NOT NULL, ' +
  "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
  '  confidence REAL, ' +
  '  review_status TEXT, ' +
  '  created_at INTEGER NOT NULL, ' +
  '  last_seen_at INTEGER NOT NULL, ' +
  '  source_section TEXT, ' +
  '  confirmed_by TEXT, ' +
  '  confirmed_at INTEGER' +
  ')';

const EDGES_DDL =
  'CREATE TABLE edges (' +
  '  source TEXT NOT NULL, ' +
  '  target TEXT NOT NULL, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  review_status TEXT DEFAULT NULL, ' +
  '  PRIMARY KEY (source, target, type)' +
  ')';

function buildNullableStatusFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-348-nullstatus-'));
  const dbPath = path.join(tmpDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(NODES_DDL_NULLABLE_STATUS);
  db.exec(EDGES_DDL);
  const now = Date.now();
  const claimAId = 'claim:348-nullstatus:a';
  const claimBId = 'claim:348-nullstatus:b';
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(claimAId, 'claim', '{}', 'fixture', 'user', 'confirmed', now, now);
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(claimBId, 'claim', '{}', 'fixture', 'user', null, now, now);
  const edgeRes = writeEdge(db, {
    source_id: claimAId,
    target_id: claimBId,
    edge_type: 'CONTRADICTS',
    properties: { relation: 'contradicts' },
  });
  if (!edgeRes.ok) throw new Error('buildNullableStatusFixture: CONTRADICTS writeEdge failed: ' + edgeRes.reason);
  return { db, dbPath, tmpDir, claimAId, claimBId };
}

function closeNullableStatusFixture(fx) {
  if (!fx) return;
  try { fx.db.close(); } catch (_e) { /* best-effort */ }
  try { fs.rmSync(fx.tmpDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

let assertions = 0;
function check(cond, msg) {
  assertions++;
  assert.ok(cond, msg);
}

// --- 1. Target (claim B) superseded: absent by default, present on request

(function testTargetSuperseded() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const off = navigation.findContradictions(fx.db, fx.claimAId);
    check(off.length === 0, 'default call must exclude the pair when claimB is superseded');
    const on = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: true });
    check(on.length === 1, 'includeSuperseded:true must return the pair');
    check(on[0].claimB.id === fx.claimBId, 'the returned pair claimB.id must be the superseded node');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 2. Source (claim A) superseded: also excluded (both-endpoints filter)

(function testSourceSuperseded() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const off = navigation.findContradictions(fx.db, fx.claimAId);
    check(off.length === 0, 'default call must exclude the pair when claimA (the source/edge origin) is superseded');
    const on = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: true });
    check(on.length === 1, 'includeSuperseded:true must return the pair even when claimA is superseded');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 3. NULL review_status is KEPT, never dropped (null-safe IS NOT) -----

(function testNullStatusKept() {
  const fx = buildNullableStatusFixture();
  try {
    const result = navigation.findContradictions(fx.db, fx.claimAId);
    check(result.length === 1, 'a NULL review_status row must be KEPT by the default filter, not dropped');
  } finally {
    closeNullableStatusFixture(fx);
  }
})();

// --- 4. Strict === true coercion: truthy string / 1 do not opt in --------

(function testStrictTrueCoercion() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const truthyString = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: 'yes' });
    check(truthyString.length === 0, 'a truthy string must NOT opt the caller in (strict === true)');
    const numericOne = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: 1 });
    check(numericOne.length === 0, 'a numeric 1 must NOT opt the caller in (strict === true)');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 5. The node row and its edges are intact either way (not truncated) -

(function testNodeRowAndEdgesIntact() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const stillThere = fx.db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(fx.claimBId);
    check(!!stillThere, 'superseded node row must still exist (invalidated-not-deleted, per SUPERSESSION-CONTRACT)');
    const edgeStillThere = fx.db.prepare(
      "SELECT 1 AS x FROM edges WHERE source = ? AND target = ? AND type = 'CONTRADICTS'"
    ).get(fx.claimAId, fx.claimBId);
    check(!!edgeStillThere, 'the CONTRADICTS edge must still exist regardless of the exclusion filter');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

console.log(assertions + ' assertions passed.');
console.log('>>> test-348-include-superseded.cjs: PASSED');
