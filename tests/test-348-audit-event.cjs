'use strict';
/*
 * tests/test-348-audit-event.cjs -- Phase 348-03 Task 2: the status_superseded
 * audit event assertion.
 *
 * Two behaviors this file proves, both quoting the plan's own <behavior>
 * block:
 *   1. The audit event for a successful human supersession carries
 *      confirmed_by equal to the LITERAL human identity passed in
 *      ('navigator', not 'user') and created_by equal to 'user', and its
 *      event_type is status_superseded -- the memory-events.cjs CHECK
 *      constraint mapping (transitions.cjs:206-218).
 *   2. When the audit event write fails, the whole transaction rolls back:
 *      the node's review_status is unchanged and no partial close survives.
 *      The failure is forced with a fixture whose memory_event INSERT cannot
 *      succeed (a nodes table CHECK constraint that forbids type =
 *      'memory_event'), not by mocking the return value -- so the assertion
 *      is on real node state after a real rollback, not on a stubbed result.
 *
 * House idiom: node:assert/strict, an `ok(desc, fn)` counter, fixtures from
 * tests/helpers/fixture-room-348.cjs with an explicit close in a finally,
 * final line '>>> test-348-audit-event.cjs: PASSED'. Mirrors
 * tests/test-348-one-supersession-door.cjs's own idiom verbatim.
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { promoteNodeStatus } = require('../lib/core/navigation/transitions.cjs');
const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require('./helpers/fixture-room-348.cjs');

let n = 0;
function ok(desc, fn) {
  fn();
  n += 1;
  console.log('  ok ' + n + ' - ' + desc);
}

console.log('test-348-audit-event (SUPER-02 audit trail)');

// ---- Assertion 1: a successful human supersession's audit event ----------

ok("a successful human ('navigator') supersession's audit event carries the literal confirmed_by, created_by mapped to 'user', and event_type status_superseded", function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const res = promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 'r', { invalidatedAt: 1, validTo: 2 });
    assert.equal(res.ok, true, JSON.stringify(res));
    const ev = fx.db.prepare(
      "SELECT json_extract(properties, '$.event_type') AS event_type, " +
      "json_extract(properties, '$.confirmed_by') AS confirmed_by, created_by " +
      "FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.target_node_id') = ? " +
      "AND json_extract(properties, '$.event_type') = 'status_superseded'"
    ).get(fx.claimAId);
    assert.ok(ev, 'a status_superseded memory_event targeting the node was logged');
    assert.equal(ev.event_type, 'status_superseded');
    assert.equal(ev.confirmed_by, 'navigator', 'confirmed_by carries the LITERAL human identity, not the mapped user marker');
    assert.equal(ev.created_by, 'user', "created_by is mapped to the canonical 'user' marker for the CHECK-constrained column");
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ---- Assertion 2: an audit event write failure rolls back the whole close --
//
// A dedicated fixture (not tests/helpers/fixture-room-348.cjs, out of this
// task's files_modified) whose nodes table CHECK constraint forbids
// type = 'memory_event' -- the bitemporal-close UPDATE succeeds (it never
// touches type), then logEvent's own INSERT throws on the CHECK violation,
// forcing promoteNodeStatus's own db.exec('ROLLBACK') branch (transitions.cjs
// :228-231) for real, never mocked.

const NODES_DDL_WIDE_BLOCK_EVENTS =
  'CREATE TABLE nodes (' +
  '  id TEXT PRIMARY KEY, ' +
  "  type TEXT NOT NULL CHECK(type <> 'memory_event'), " +
  "  properties TEXT DEFAULT '{}', " +
  '  source_path TEXT NOT NULL, ' +
  "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
  '  confidence REAL, ' +
  "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
  "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
  '  created_at INTEGER NOT NULL, ' +
  '  last_seen_at INTEGER NOT NULL, ' +
  '  source_section TEXT, ' +
  '  confirmed_by TEXT, ' +
  '  confirmed_at INTEGER, ' +
  '  valid_from INTEGER, ' +
  '  valid_to INTEGER, ' +
  '  invalidated_at INTEGER, ' +
  '  last_modified_at INTEGER' +
  ')';

function buildEventBlockedFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-348-audit-event-block-'));
  const dbPath = path.join(tmpDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(NODES_DDL_WIDE_BLOCK_EVENTS);
  const nodeId = 'claim:348-audit-event-block:a';
  const now = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'claim', '{}', ?, 'system', 'confirmed', ?, ?)"
  ).run(nodeId, 'unknown:claim:' + nodeId, now, now);
  return { tmpDir, db, nodeId };
}

function closeEventBlockedFixture(fx) {
  try { fx.db.close(); } catch (_e) { /* best-effort */ }
  try { fs.rmSync(fx.tmpDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

ok('when the audit event write fails, the whole transaction rolls back: review_status is unchanged and no bitemporal close survives', function () {
  const fx = buildEventBlockedFixture();
  try {
    // Sanity: the fixture's own CHECK constraint genuinely blocks a
    // memory_event INSERT, so this test is exercising a real failure, not an
    // assumed one.
    assert.throws(function () {
      fx.db.prepare(
        "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
        "VALUES ('memory_event:sanity', 'memory_event', '{}', 'sanity', 'system', 'confirmed', 0, 0)"
      ).run();
    }, /CHECK|constraint/i, 'fixture sanity: a memory_event INSERT must genuinely violate the CHECK constraint');

    const before = fx.db.prepare('SELECT review_status, invalidated_at, valid_to FROM nodes WHERE id = ?').get(fx.nodeId);
    assert.equal(before.review_status, 'confirmed');
    assert.equal(before.invalidated_at, null);
    assert.equal(before.valid_to, null);

    const res = promoteNodeStatus(fx.db, fx.nodeId, 'confirmed', 'superseded', 'navigator', 'r', { invalidatedAt: 999, validTo: 998 });
    assert.equal(res.ok, false, 'the write must not report success when its own audit event failed');
    assert.ok(typeof res.reason === 'string' && res.reason.indexOf('event_log_failed:') === 0, 'reason: ' + JSON.stringify(res));

    const after = fx.db.prepare('SELECT review_status, invalidated_at, valid_to FROM nodes WHERE id = ?').get(fx.nodeId);
    assert.equal(after.review_status, 'confirmed', 'review_status rolled back to its pre-close value -- no partial close');
    assert.equal(after.invalidated_at, null, 'invalidated_at rolled back -- the bitemporal close did not partially survive');
    assert.equal(after.valid_to, null, 'valid_to rolled back -- the bitemporal close did not partially survive');

    // No transaction left dangling: a fresh BEGIN/ROLLBACK round trip must
    // succeed on this same handle.
    fx.db.exec('BEGIN');
    fx.db.exec('ROLLBACK');
  } finally { closeEventBlockedFixture(fx); }
});

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-audit-event.cjs: PASSED');
process.exit(0);
