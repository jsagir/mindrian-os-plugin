'use strict';
// Phase 109-03 test: Memory Event Log. NAV-109-03 acceptance harness.
// Hermetic via tmpdir per test; uses real openRoomDb so the migrations + indices apply.

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const events = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-events-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  // Seed a target node for events that reference one.
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('claim:target-1', 'claim', '{}', 'fixture', 'user', 0.7, 'confirmed', Date.now(), Date.now());
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function test1_enumCount() {
  ok(events.EVENT_TYPES instanceof Set, 'EVENT_TYPES is a Set');
  equal(events.EVENT_TYPES.size, 15, 'exactly 15 event types');
  const required = ['node_created', 'status_promoted', 'status_rejected', 'status_stale', 'status_superseded', 'focus_changed', 'brain_query_sent', 'brain_suggestion_received', 'edge_added', 'edge_removed', 'opportunity_added', 'opportunity_reacted', 'opportunity_reflected', 'opportunity_answered', 'state_alias_migration'];
  for (const t of required) ok(events.EVENT_TYPES.has(t), 'EVENT_TYPES contains: ' + t);
}

function test2_validEnumAcceptance() {
  const { tmp, db } = makeRoom();
  try {
    for (const t of events.EVENT_TYPES) {
      const r = events.logEvent(db, t, { source_path: 'test:enum-acceptance' });
      ok(r.ok, 'logEvent accepted valid type: ' + t + ': ' + JSON.stringify(r));
      ok(typeof r.eventId === 'string' && r.eventId.startsWith('memory_event:' + t + ':'));
    }
    db.close();
  } finally { cleanup(tmp); }
}

function test3_invalidEnumRejection() {
  const { tmp, db } = makeRoom();
  try {
    const r = events.logEvent(db, 'invented_event_type', { source_path: 'test' });
    ok(!r.ok);
    equal(r.reason, 'invalid_event_type');
    // No row inserted.
    const cnt = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'invented_event_type'").get().n;
    equal(cnt, 0);
    db.close();
  } finally { cleanup(tmp); }
}

function test4_invalidPayload() {
  const { tmp, db } = makeRoom();
  try {
    equal(events.logEvent(db, 'node_created', null).reason, 'invalid_payload');
    equal(events.logEvent(db, 'node_created', 'string-not-object').reason, 'invalid_payload');
    equal(events.logEvent(db, 'node_created', 42).reason, 'invalid_payload');
    equal(events.logEvent(db, 'node_created', true).reason, 'invalid_payload');
    // Empty object IS valid (caller did not supply optional payload fields).
    ok(events.logEvent(db, 'node_created', {}).ok);
    db.close();
  } finally { cleanup(tmp); }
}

function test5_propertiesMerge() {
  const { tmp, db } = makeRoom();
  try {
    const r = events.logEvent(db, 'status_promoted', {
      target_node_id: 'claim:target-1',
      previous_status: 'proposed',
      new_status: 'confirmed',
      reason: 'evidence sufficient',
      session_id: 'sess-merge-test',
    });
    ok(r.ok);
    const row = db.prepare("SELECT properties FROM nodes WHERE id = ?").get(r.eventId);
    const props = JSON.parse(row.properties);
    equal(props.event_type, 'status_promoted', 'event_type appears as top-level key');
    equal(props.target_node_id, 'claim:target-1');
    equal(props.previous_status, 'proposed');
    equal(props.new_status, 'confirmed');
    equal(props.reason, 'evidence sufficient');
    equal(props.session_id, 'sess-merge-test');
    db.close();
  } finally { cleanup(tmp); }
}

function test6_idCollisionResistance() {
  const { tmp, db } = makeRoom();
  try {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const r = events.logEvent(db, 'node_created', { source_path: 'test:collision-' + i });
      ok(r.ok);
      ids.add(r.eventId);
    }
    equal(ids.size, 100, '100 distinct event ids generated');
    db.close();
  } finally { cleanup(tmp); }
}

function test7_findRecentChangesTimeRange() {
  const { tmp, db } = makeRoom();
  try {
    const baseMs = Date.now();
    // Manually insert two events at known timestamps.
    db.prepare("INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, 'memory_event', ?, 'test', 'system', NULL, 'confirmed', ?, ?)")
      .run('memory_event:old:1', JSON.stringify({ event_type: 'node_created' }), baseMs - 10000, baseMs - 10000);
    db.prepare("INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, 'memory_event', ?, 'test', 'system', NULL, 'confirmed', ?, ?)")
      .run('memory_event:new:1', JSON.stringify({ event_type: 'node_created' }), baseMs + 1000, baseMs + 1000);
    const since = baseMs - 5000;
    const results = events.findRecentChanges(db, since);
    const ids = results.map((r) => r.id);
    ok(ids.includes('memory_event:new:1'), 'newer event included');
    ok(!ids.includes('memory_event:old:1'), 'older event excluded');
    db.close();
  } finally { cleanup(tmp); }
}

function test8_findRecentChangesEventTypeFilter() {
  const { tmp, db } = makeRoom();
  try {
    events.logEvent(db, 'node_created', { source_path: 'test' });
    events.logEvent(db, 'edge_added', { source_path: 'test' });
    events.logEvent(db, 'edge_added', { source_path: 'test' });
    events.logEvent(db, 'brain_query_sent', { source_path: 'test' });
    const filtered = events.findRecentChanges(db, 0, { eventType: 'edge_added' });
    equal(filtered.length, 2, 'two edge_added events returned');
    for (const r of filtered) equal(r.eventType, 'edge_added');
    db.close();
  } finally { cleanup(tmp); }
}

function test9_findRecentChangesLimitAndOrdering() {
  const { tmp, db } = makeRoom();
  try {
    for (let i = 0; i < 20; i++) {
      events.logEvent(db, 'node_created', { source_path: 'test:order-' + i, _seq: i });
    }
    const results = events.findRecentChanges(db, 0, { limit: 5 });
    equal(results.length, 5, 'limit honored');
    for (let i = 1; i < results.length; i++) {
      ok(results[i - 1].createdAt >= results[i].createdAt, 'ordering DESC at index ' + i);
    }
    db.close();
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_enumCount, test2_validEnumAcceptance, test3_invalidEnumRejection, test4_invalidPayload, test5_propertiesMerge, test6_idCollisionResistance, test7_findRecentChangesTimeRange, test8_findRecentChangesEventTypeFilter, test9_findRecentChangesLimitAndOrdering];
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      t();
      pass++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      fail++;
      process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n');
    }
  }
  process.stdout.write('test-navigation-memory-events: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
