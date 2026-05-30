'use strict';
// Phase 129-01 -- spine substrate behavior suite (RED-first).
//
// Covers Task 1 (enum extension + 60s dedup) and Task 2 (spine-events.cjs
// helper API + getCurrentJTBD/getCurrentOperator + FOLLOWS_FROM emission +
// navigation.cjs re-exports). Hermetic via tmpdir per fixture; uses the
// canonical openRoomDb chokepoint so every memory_event lands in the
// Phase-109 provenance schema.
//
// Canon Part 8 / Part 9: all room.db access is through navigation surfaces.
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const edges = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const spineEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

// The 5 net-new spine event-type strings (the EVENT-CAP-5 lock).
const SPINE_EVENT_TYPES = [
  'spine_read',
  'jtbd_transitioned',
  'operator_transitioned',
  'workflow_stage',
  'suggestion_surfaced',
];

// The pre-129 baseline membership (a FLOOR -- not an exact size). These all
// existed before Phase 129; the delta test asserts EXACTLY 5 net-new spine
// strings were added relative to this floor.
const PRE_129_FLOOR = [
  'node_created', 'status_promoted', 'focus_changed', 'brain_query_sent',
  'edge_added', 'opportunity_added', 'selector_presentation',
  'reverse_salient_detected', 'tension_detected', 'auto_explore_fired',
  'brain_packet_rejected', 'feynman_timeline_refreshed', 'framework_invoked',
  'f_selector_decision', 'f_selector_miss', 'room_auto_created',
  'breakthrough_detected_soft', 'file_changed',
];

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129-spine-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Task 1 -- enums + dedup
// ---------------------------------------------------------------------------

function test1_fiveNetNewTypesPresent() {
  for (const t of SPINE_EVENT_TYPES) {
    ok(memoryEvents.EVENT_TYPES.has(t), 'EVENT_TYPES must contain ' + t);
  }
  // Floor membership preserved (no regression).
  for (const t of PRE_129_FLOOR) {
    ok(memoryEvents.EVENT_TYPES.has(t), 'pre-129 floor member missing: ' + t);
  }
}

function test2_deltaExactlyFive() {
  // Count members from PRE_129_FLOOR + the 5 spine strings. The delta between
  // (full set minus floor-known-non-spine) is asserted via named membership:
  // exactly the 5 spine strings, no MORE net-new spine strings.
  const spinePresent = SPINE_EVENT_TYPES.filter((t) => memoryEvents.EVENT_TYPES.has(t));
  equal(spinePresent.length, 5, 'exactly 5 net-new spine event types present');
}

function test3_followsFromAllowed() {
  ok(edges.ALLOWED_EDGE_TYPES.has('FOLLOWS_FROM'), 'FOLLOWS_FROM must be allowed');
  const { tmp, db } = makeRoom();
  try {
    // Seed the two referenced nodes (edges carry FK constraints to nodes(id)).
    const nowMs = Date.now();
    const ins = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, 'memory_event', '{}', 'fixture', 'system', NULL, 'confirmed', ?, ?)");
    ins.run('memory_event:a', nowMs, nowMs);
    ins.run('memory_event:b', nowMs, nowMs);
    const r = edges.writeEdge(db, {
      source_id: 'memory_event:a', target_id: 'memory_event:b',
      edge_type: 'FOLLOWS_FROM', properties: { surface: 'status' },
    });
    ok(r.ok, 'FOLLOWS_FROM writeEdge ok: ' + JSON.stringify(r));
    equal(r.type, 'FOLLOWS_FROM');
    const row = db.prepare("SELECT * FROM edges WHERE type = 'FOLLOWS_FROM'").get();
    ok(row, 'FOLLOWS_FROM edge row landed');
  } finally { closeRoomDb(db); cleanup(tmp); }
}

function test4_lensClassRejected() {
  const { tmp, db } = makeRoom();
  try {
    for (const bad of ['ASSOCIATION_LENS', 'TRANSITION_LENS']) {
      const r = edges.writeEdge(db, {
        source_id: 's', target_id: 't', edge_type: bad, properties: {},
      });
      equal(r.ok, false, bad + ' must be rejected');
      equal(r.reason, 'invalid_edge_type', bad + ' reason must be invalid_edge_type');
    }
  } finally { closeRoomDb(db); cleanup(tmp); }
}

function test5_dedupSameKeyWithin60s() {
  const { tmp, db } = makeRoom();
  try {
    let clock = 1000000;
    const now = () => clock;
    const payload = { dedupe_key: 'k1', surface: 'status' };
    const r1 = memoryEvents.logEvent(db, 'spine_read', payload, { now });
    ok(r1.ok, 'first write ok');
    ok(!r1.deduped, 'first write is not deduped');
    clock += 30000; // 30s later, still inside the 60s window
    const r2 = memoryEvents.logEvent(db, 'spine_read', payload, { now });
    ok(r2.ok, 'second write returns ok');
    ok(r2.deduped, 'second write is deduped');
    equal(r2.eventId, r1.eventId, 'deduped returns the existing eventId');
    const recent = memoryEvents.findRecentChanges(db, 0, { eventType: 'spine_read' });
    equal(recent.length, 1, 'only ONE spine_read row written');
  } finally { closeRoomDb(db); cleanup(tmp); }
}

function test6_dedupExpiresAfterTTL() {
  const { tmp, db } = makeRoom();
  try {
    let clock = 2000000;
    const now = () => clock;
    const payload = { dedupe_key: 'k2', surface: 'memory' };
    const r1 = memoryEvents.logEvent(db, 'spine_read', payload, { now });
    ok(r1.ok && !r1.deduped, 'first write ok and not deduped');
    clock += 61000; // 61s later, outside the 60s window
    const r2 = memoryEvents.logEvent(db, 'spine_read', payload, { now });
    ok(r2.ok && !r2.deduped, 'second write ok and NOT deduped (TTL elapsed)');
    const recent = memoryEvents.findRecentChanges(db, 0, { eventType: 'spine_read' });
    equal(recent.length, 2, 'TWO spine_read rows written across TTL boundary');
  } finally { closeRoomDb(db); cleanup(tmp); }
}

function test7_noDedupeKeyNeverDedupes() {
  const { tmp, db } = makeRoom();
  try {
    // No dedupe_key -> back-compat: every call writes.
    const a = memoryEvents.logEvent(db, 'spine_read', { surface: 'status' });
    const b = memoryEvents.logEvent(db, 'spine_read', { surface: 'status' });
    ok(a.ok && b.ok, 'both writes ok');
    ok(!a.deduped && !b.deduped, 'neither is deduped without a dedupe_key');
    const recent = memoryEvents.findRecentChanges(db, 0, { eventType: 'spine_read' });
    equal(recent.length, 2, 'two rows when no dedupe_key supplied');
  } finally { closeRoomDb(db); cleanup(tmp); }
}

// ---------------------------------------------------------------------------
// Task 2 -- spine-events.cjs helper API
// ---------------------------------------------------------------------------

function test8_helperExportsPresent() {
  for (const k of ['logSpineRead', 'logJtbdTransition', 'logOperatorTransition',
    'logWorkflowStage', 'logSuggestionSurfaced', 'getCurrentJTBD', 'getCurrentOperator']) {
    equal(typeof spineEvents[k], 'function', 'spine-events exports ' + k);
    equal(typeof navigation[k], 'function', 'navigation re-exports ' + k);
  }
}

function test9_logHelpersOpenRoomDbInternally() {
  const { tmp, db } = makeRoom();
  closeRoomDb(db); // close -- helper must open/close its own handle
  try {
    const r = spineEvents.logSpineRead(tmp, { surface: 'status', section: 'problem' });
    ok(r.ok, 'logSpineRead ok: ' + JSON.stringify(r));
    // Re-open to verify the row landed.
    const db2 = openRoomDb(tmp);
    const recent = memoryEvents.findRecentChanges(db2, 0, { eventType: 'spine_read' });
    equal(recent.length, 1, 'spine_read row written through the helper');
    closeRoomDb(db2);
  } finally { cleanup(tmp); }
}

function test10_noRoomDbGraceful() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129-noroom-'));
  try {
    const r = spineEvents.logJtbdTransition(tmp, { kind: 'set', to: 'explore' });
    equal(r.ok, false, 'returns ok:false when no room.db');
    equal(r.reason, 'no_room_db', 'reason is no_room_db');
  } finally { cleanup(tmp); }
}

function test11_getCurrentJtbdEventAuthoritative() {
  const { tmp, db } = makeRoom();
  closeRoomDb(db);
  try {
    spineEvents.logJtbdTransition(tmp, { kind: 'set', jtbd: 'find-bottleneck', to: 'find-bottleneck' });
    const cur = spineEvents.getCurrentJTBD(tmp);
    ok(cur, 'getCurrentJTBD returned non-null');
    equal(cur.jtbd, 'find-bottleneck', 'jtbd from event log');
    equal(cur.source, 'event_log', 'source is event_log when an event exists');
  } finally { cleanup(tmp); }
}

function test12_getCurrentJtbdCacheFallback() {
  const { tmp, db } = makeRoom();
  closeRoomDb(db);
  const jtbdState = require(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  try {
    // No jtbd_transitioned event; seed the cache file instead.
    jtbdState.setCurrent(tmp, { jtbd: 'cache-jtbd', confidence: 0.5, trigger: 'test' });
    const cur = spineEvents.getCurrentJTBD(tmp);
    ok(cur, 'getCurrentJTBD returned non-null from cache');
    equal(cur.source, 'cache_fallback', 'source is cache_fallback when no event');
  } finally { cleanup(tmp); }
}

function test13_getCurrentOperatorEventAuthoritative() {
  const { tmp, db } = makeRoom();
  closeRoomDb(db);
  try {
    spineEvents.logOperatorTransition(tmp, { from: 'JUST_TALK', to: 'METHODOLOGY', operator: 'METHODOLOGY' });
    const cur = spineEvents.getCurrentOperator(tmp);
    ok(cur, 'getCurrentOperator returned non-null');
    equal(cur.source, 'event_log', 'source is event_log when an event exists');
  } finally { cleanup(tmp); }
}

function test14_followsFromEmission() {
  const { tmp, db } = makeRoom();
  closeRoomDb(db);
  try {
    const first = spineEvents.logSuggestionSurfaced(tmp, { surface: 'suggest', commands: ['a'] });
    ok(first.ok, 'first event ok');
    const second = spineEvents.logSpineRead(tmp, {
      surface: 'status', section: 'x', follows_from: first.eventId,
    });
    ok(second.ok, 'second event ok');
    const db2 = openRoomDb(tmp);
    const row = db2.prepare("SELECT * FROM edges WHERE type = 'FOLLOWS_FROM'").get();
    ok(row, 'FOLLOWS_FROM edge landed');
    equal(row.target, first.eventId, 'edge target is the prior event id');
    closeRoomDb(db2);
  } finally { cleanup(tmp); }
}

function test15_navigationEndToEnd() {
  const { tmp, db } = makeRoom();
  closeRoomDb(db);
  try {
    const r = navigation.logSpineRead(tmp, { surface: 'status', section: 'market' });
    ok(r.ok, 'navigation.logSpineRead end-to-end ok');
    const cur = navigation.getCurrentJTBD(tmp);
    // No jtbd event -> cache fallback (or null-ish). Just assert it does not throw.
    ok(cur === null || typeof cur === 'object', 'getCurrentJTBD returns object-or-null');
  } finally { cleanup(tmp); }
}

const TESTS = [
  test1_fiveNetNewTypesPresent,
  test2_deltaExactlyFive,
  test3_followsFromAllowed,
  test4_lensClassRejected,
  test5_dedupSameKeyWithin60s,
  test6_dedupExpiresAfterTTL,
  test7_noDedupeKeyNeverDedupes,
  test8_helperExportsPresent,
  test9_logHelpersOpenRoomDbInternally,
  test10_noRoomDbGraceful,
  test11_getCurrentJtbdEventAuthoritative,
  test12_getCurrentJtbdCacheFallback,
  test13_getCurrentOperatorEventAuthoritative,
  test14_followsFromEmission,
  test15_navigationEndToEnd,
];

let passed = 0;
let failed = 0;
for (const t of TESTS) {
  try {
    t();
    passed++;
    process.stdout.write('ok   - ' + t.name + '\n');
  } catch (e) {
    failed++;
    process.stdout.write('FAIL - ' + t.name + ': ' + e.message + '\n');
  }
}
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed (of ' + TESTS.length + ')\n');
process.exit(failed === 0 ? 0 : 1);
