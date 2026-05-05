'use strict';
// Phase 109-02 test: Focus Node Model. NAV-109-01 acceptance harness.
// Hermetic via tmpdir per test; module-injection mock pattern for jtbd-state and operator.

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const focus = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'focus.cjs'));

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-focus-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  // Seed a few node ids that setFocus + computeAutoFocus need.
  const nowMs = Date.now();
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('room:test', 'room', '{}', 'fixture', 'system', 1.0, 'confirmed', nowMs, nowMs);
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('jtbd:find-bottleneck', 'jtbd', '{}', 'fixture', 'system', 1.0, 'confirmed', nowMs, nowMs);
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('decision:open-1', 'decision', '{}', 'fixture', 'user', 0.6, 'proposed', nowMs - 1000, nowMs - 1000);
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('decision:open-2', 'decision', '{}', 'fixture', 'user', 0.6, 'proposed', nowMs - 500, nowMs - 500);
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('decision:closed-1', 'decision', '{}', 'fixture', 'user', 0.9, 'confirmed', nowMs - 2000, nowMs - 2000);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function test1_tableCreated() {
  const { tmp, db } = makeRoom();
  try {
    const cols = db.prepare("PRAGMA table_info(session_focus)").all().map((c) => c.name).sort();
    deepEqual(cols, ['focus_node_id', 'focus_type', 'session_id', 'set_at', 'set_by']);
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_session_focus_set_at'").get();
    ok(idx, 'idx_session_focus_set_at exists');
    // FK enforcement check: PRAGMA foreign_key_list returns non-empty for session_focus.
    const fks = db.prepare("PRAGMA foreign_key_list(session_focus)").all();
    equal(fks.length, 1);
    equal(fks[0].table, 'nodes');
    equal(fks[0].from, 'focus_node_id');
    db.close();
  } finally { cleanup(tmp); }
}

function test2_setAndGetRoundtrip() {
  const { tmp, db } = makeRoom();
  try {
    const r = focus.setFocus(db, 'sess-1', 'decision:open-1', 'user');
    ok(r.ok, 'setFocus succeeded: ' + JSON.stringify(r));
    const f = focus.getActiveFocus(db, 'sess-1');
    ok(f, 'getActiveFocus returned non-null');
    equal(f.focusNodeId, 'decision:open-1');
    equal(f.focusType, 'decision');
    equal(f.setBy, 'user');
    ok(typeof f.setAt === 'number' && f.setAt > 0);
    db.close();
  } finally { cleanup(tmp); }
}

function test3_invalidSetBy() {
  const { tmp, db } = makeRoom();
  try {
    const r = focus.setFocus(db, 'sess-2', 'decision:open-1', 'evil-bot');
    ok(!r.ok);
    equal(r.reason, 'invalid_set_by');
    const f = focus.getActiveFocus(db, 'sess-2');
    ok(f === null, 'no focus row inserted on rejection');
    db.close();
  } finally { cleanup(tmp); }
}

function test4_unknownNode() {
  const { tmp, db } = makeRoom();
  try {
    const r = focus.setFocus(db, 'sess-3', 'decision:does-not-exist', 'user');
    ok(!r.ok);
    equal(r.reason, 'unknown_node');
    const f = focus.getActiveFocus(db, 'sess-3');
    ok(f === null);
    db.close();
  } finally { cleanup(tmp); }
}

function test5_focusChangedEvent() {
  const { tmp, db } = makeRoom();
  try {
    const eventsBefore = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='memory_event' AND json_extract(properties, '$.event_type') = 'focus_changed'").get().n;
    focus.setFocus(db, 'sess-4', 'decision:open-1', 'user');
    focus.setFocus(db, 'sess-4', 'decision:open-2', 'larry');
    const eventsAfter = db.prepare("SELECT id, properties FROM nodes WHERE type='memory_event' AND json_extract(properties, '$.event_type') = 'focus_changed' ORDER BY created_at").all();
    equal(eventsAfter.length, eventsBefore + 2, 'two focus_changed events written');
    const second = JSON.parse(eventsAfter[eventsAfter.length - 1].properties);
    equal(second.event_type, 'focus_changed');
    equal(second.session_id, 'sess-4');
    equal(second.new_focus_node_id, 'decision:open-2');
    equal(second.previous_focus_node_id, 'decision:open-1');
    equal(second.set_by, 'larry');
    db.close();
  } finally { cleanup(tmp); }
}

function test6_autoFocusRule1Jtbd() {
  const { tmp, db } = makeRoom();
  try {
    const mocks = {
      jtbd: { getCurrent: () => ({ current: { id: 'find-bottleneck', tags: ['ops'] } }) },
      operator: { getCurrent: () => ({ current: 'JUST_TALK' }) },
    };
    const r = focus.computeAutoFocus(db, tmp, 'sess-rule1', { _mocks: mocks });
    ok(r, 'rule 1 returns non-null');
    equal(r.focusNodeId, 'jtbd:find-bottleneck');
    equal(r.setBy, 'auto-from-jtbd');
    db.close();
  } finally { cleanup(tmp); }
}

function test7_autoFocusRule2DecisionGate() {
  const { tmp, db } = makeRoom();
  try {
    const mocks = {
      jtbd: { getCurrent: () => ({ current: null }) },
      operator: { getCurrent: () => ({ current: 'DECISION_GATE' }) },
    };
    const r = focus.computeAutoFocus(db, tmp, 'sess-rule2', { _mocks: mocks });
    ok(r, 'rule 2 returns non-null');
    // Most recent unconfirmed decision is decision:open-2 (created_at later than open-1).
    equal(r.focusNodeId, 'decision:open-2');
    equal(r.setBy, 'auto-from-operator');
    db.close();
  } finally { cleanup(tmp); }
}

function test8_autoFocusRule3RoomRoot() {
  const { tmp, db } = makeRoom();
  try {
    const mocks = {
      jtbd: { getCurrent: () => ({ current: null }) },
      operator: { getCurrent: () => ({ current: 'JUST_TALK' }) },
    };
    // Set roomId so computeAutoFocus can resolve to room:<roomId>.
    const r = focus.computeAutoFocus(db, tmp, 'sess-rule3', { _mocks: mocks, roomId: 'test' });
    ok(r, 'rule 3 returns non-null');
    equal(r.focusNodeId, 'room:test');
    equal(r.setBy, 'auto-from-state');
    db.close();
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_tableCreated, test2_setAndGetRoundtrip, test3_invalidSetBy, test4_unknownNode, test5_focusChangedEvent, test6_autoFocusRule1Jtbd, test7_autoFocusRule2DecisionGate, test8_autoFocusRule3RoomRoot];
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
  process.stdout.write('test-navigation-focus: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
