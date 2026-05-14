/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 125-07 -- lib/workflow/selector-decisions.cjs::recordSelectorMiss test suite (D8).
 *
 * Covers 10 acceptance behaviors from 125-07-PLAN.md <behavior> block:
 *   Test 1   recordSelectorMiss writes memory_event with event_type='f_selector_miss'
 *   Test 2   Payload preserves top_k_offered array verbatim ({command, score} pairs)
 *   Test 3   Payload preserves user_intent verbatim
 *   Test 4   Payload includes investment_level_at_decision (roomState or 0 default)
 *   Test 5   NO cascade edge written (count(*) FROM edges unchanged)
 *   Test 6   No external routing: source body has zero mos:do/invoke/exec/spawn matches
 *   Test 7   Invalid top_k_offered (not array) -> {ok:false, reason:'invalid_top_k_offered'}
 *   Test 8   Empty user_intent ('') -> {ok:false, reason:'invalid_user_intent'}
 *   Test 9   Missing db -> {ok:false, reason:'invalid_db'}
 *   Test 10  top_k_offered objects with extra fields are sanitized to {command, score} only
 *
 * Three-surface compatibility: pure CJS + node:test. Uses fs.mkdtempSync +
 * openRoomDb fixture pattern from Plan 06 / Plan 00. All writes route through
 * the navigation.cjs chokepoint; the test asserts the memory_event row lands
 * AND that NO edge row is written (D8 temporal-only invariant).
 */

'use strict';

const { test } = require('node:test');
const { ok, equal, deepStrictEqual } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SELECTOR_DECISIONS_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'selector-decisions.cjs');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const selectorDecisions = require(SELECTOR_DECISIONS_PATH);

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p125-07-selector-miss-'));
  const db = openRoomDb(dir);
  return { dir, db };
}

function fetchMemoryEvent(db, missId) {
  return db.prepare(
    "SELECT id, type, properties FROM nodes WHERE id = ?"
  ).get(missId);
}

function countMemoryMissEvents(db) {
  return db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' " +
    "AND json_extract(properties, '$.event_type') = 'f_selector_miss'"
  ).get().c;
}

function countAllEdges(db) {
  return db.prepare("SELECT COUNT(*) AS c FROM edges").get().c;
}

// ---------------------------------------------------------------------------
// Test 1: recordSelectorMiss writes memory_event with event_type='f_selector_miss'.
// ---------------------------------------------------------------------------
test('Test 1: recordSelectorMiss writes memory_event(event_type=f_selector_miss)', () => {
  const { db } = freshDb();
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:bq', score: 0.7 }],
    user_intent: 'I need to validate my pricing strategy',
    roomState: { db, investment_level: 0.3 },
  });
  ok(r.ok, 'recordSelectorMiss should return ok: true; got reason=' + (r && r.reason));
  ok(typeof r.miss_id === 'string' && r.miss_id.length > 0, 'miss_id is non-empty string');
  const row = fetchMemoryEvent(db, r.miss_id);
  ok(row, 'memory_event row present in nodes table');
  equal(row.type, 'memory_event');
  const props = JSON.parse(row.properties);
  equal(props.event_type, 'f_selector_miss');
  equal(countMemoryMissEvents(db), 1, 'exactly one f_selector_miss row exists');
});

// ---------------------------------------------------------------------------
// Test 2: Payload preserves top_k_offered array verbatim with all {command, score} pairs.
// ---------------------------------------------------------------------------
test('Test 2: payload preserves top_k_offered array verbatim ({command, score} pairs)', () => {
  const { db } = freshDb();
  const offered = [
    { command: 'mos:bq', score: 0.91 },
    { command: 'mos:swot', score: 0.74 },
    { command: 'mos:jtbd', score: 0.55 },
  ];
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: offered,
    user_intent: 'something else entirely',
    roomState: { db },
  });
  ok(r.ok);
  const row = fetchMemoryEvent(db, r.miss_id);
  const props = JSON.parse(row.properties);
  ok(Array.isArray(props.top_k_offered), 'top_k_offered is array');
  equal(props.top_k_offered.length, 3, '3 offered items preserved');
  deepStrictEqual(props.top_k_offered, offered, 'top_k_offered preserved verbatim');
});

// ---------------------------------------------------------------------------
// Test 3: Payload preserves user_intent verbatim.
// ---------------------------------------------------------------------------
test('Test 3: payload preserves user_intent verbatim', () => {
  const { db } = freshDb();
  const intent = 'help me think about board governance for a translational lab';
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:bq', score: 0.5 }],
    user_intent: intent,
    roomState: { db },
  });
  ok(r.ok);
  const row = fetchMemoryEvent(db, r.miss_id);
  const props = JSON.parse(row.properties);
  equal(props.user_intent, intent, 'user_intent verbatim in payload');
});

// ---------------------------------------------------------------------------
// Test 4: Payload includes investment_level_at_decision (matches roomState or 0 default).
// ---------------------------------------------------------------------------
test('Test 4: payload includes investment_level_at_decision (roomState.investment_level)', () => {
  const { db } = freshDb();
  const r1 = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:a', score: 0.5 }],
    user_intent: 'x',
    roomState: { db, investment_level: 0.42 },
  });
  ok(r1.ok);
  const props1 = JSON.parse(fetchMemoryEvent(db, r1.miss_id).properties);
  equal(props1.investment_level_at_decision, 0.42, 'investment_level_at_decision matches roomState');

  // Default 0 when not supplied.
  const r2 = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:b', score: 0.5 }],
    user_intent: 'y',
    roomState: { db },
  });
  ok(r2.ok);
  const props2 = JSON.parse(fetchMemoryEvent(db, r2.miss_id).properties);
  equal(props2.investment_level_at_decision, 0, 'default 0 when roomState.investment_level absent');
});

// ---------------------------------------------------------------------------
// Test 5: NO cascade edge written -- count(*) FROM edges before == after.
// ---------------------------------------------------------------------------
test('Test 5: no cascade edge written (D8 temporal-only invariant)', () => {
  const { db } = freshDb();
  const before = countAllEdges(db);
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:bq', score: 0.7 }, { command: 'mos:swot', score: 0.5 }],
    user_intent: 'I want grant funding strategy',
    roomState: { db, investment_level: 0.6 },
  });
  ok(r.ok);
  const after = countAllEdges(db);
  equal(after, before, 'edges row count unchanged (zero new edges from miss capture)');
});

// ---------------------------------------------------------------------------
// Test 6: Source-grep audit -- recordSelectorMiss body has zero external routing.
// Per D8: recordSelectorMiss does NOT invoke /mos:do; consumer is responsible.
// ---------------------------------------------------------------------------
test('Test 6: source-grep audit: no mos:do/invoke/exec/spawn in recordSelectorMiss body', () => {
  const src = fs.readFileSync(SELECTOR_DECISIONS_PATH, 'utf8');
  // Extract the recordSelectorMiss function body. Scan from declaration to the
  // closing brace at column 0 (matches the existing module style).
  const startIdx = src.indexOf('function recordSelectorMiss');
  ok(startIdx >= 0, 'recordSelectorMiss declaration present in source');
  // Capture roughly the next ~3000 chars (function is ~50 lines per Plan 07 spec).
  const slice = src.slice(startIdx, startIdx + 3000);
  // Find the function-closing brace (first `^}` at line start after the declaration).
  const lines = slice.split('\n');
  let body = '';
  let depth = 0;
  let started = false;
  for (const line of lines) {
    body += line + '\n';
    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; }
    }
    if (started && depth === 0) break;
  }
  // Now assert no external-routing tokens.
  ok(!/mos:do/.test(body), 'no mos:do invocation in recordSelectorMiss body');
  ok(!/\bspawn\s*\(/.test(body), 'no spawn() in recordSelectorMiss body');
  ok(!/\bexec\s*\(/.test(body), 'no exec() in recordSelectorMiss body');
  ok(!/child_process/.test(body), 'no child_process in recordSelectorMiss body');
});

// ---------------------------------------------------------------------------
// Test 7: Invalid top_k_offered (not an array) returns {ok:false, reason:'invalid_top_k_offered'}.
// ---------------------------------------------------------------------------
test('Test 7: invalid top_k_offered returns {ok:false, reason:invalid_top_k_offered}', () => {
  const { db } = freshDb();
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: 'not-an-array',
    user_intent: 'x',
    roomState: { db },
  });
  equal(r.ok, false);
  equal(r.reason, 'invalid_top_k_offered');
});

// ---------------------------------------------------------------------------
// Test 8: Empty user_intent ('') returns {ok:false, reason:'invalid_user_intent'}.
// ---------------------------------------------------------------------------
test('Test 8: empty user_intent returns {ok:false, reason:invalid_user_intent}', () => {
  const { db } = freshDb();
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:bq', score: 0.5 }],
    user_intent: '',
    roomState: { db },
  });
  equal(r.ok, false);
  equal(r.reason, 'invalid_user_intent');

  // Non-string also invalid.
  const r2 = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:bq', score: 0.5 }],
    user_intent: null,
    roomState: { db },
  });
  equal(r2.ok, false);
  equal(r2.reason, 'invalid_user_intent');
});

// ---------------------------------------------------------------------------
// Test 9: Missing db returns {ok:false, reason:'invalid_db'}.
// ---------------------------------------------------------------------------
test('Test 9: missing db on roomState returns {ok:false, reason:invalid_db}', () => {
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:bq', score: 0.5 }],
    user_intent: 'something',
    roomState: {},
  });
  equal(r.ok, false);
  equal(r.reason, 'invalid_db');

  // Also when roomState entirely absent.
  const r2 = selectorDecisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:bq', score: 0.5 }],
    user_intent: 'something',
  });
  equal(r2.ok, false);
  equal(r2.reason, 'invalid_db');
});

// ---------------------------------------------------------------------------
// Test 10: top_k_offered objects with extra fields are sanitized to {command, score} only.
// ---------------------------------------------------------------------------
test('Test 10: extra fields on top_k_offered items are sanitized away in payload', () => {
  const { db } = freshDb();
  const offeredWithExtras = [
    {
      command: 'mos:bq',
      score: 0.91,
      teaching: 'long teaching prose that should NOT land in the payload',
      jtbd_summary: 'a summary that should NOT land either',
      framework: 'Beautiful Question Framework',
      why: 'should NOT land',
    },
    {
      command: 'mos:swot',
      score: 0.74,
      teaching: 'more teaching prose',
      source: 'packet',
    },
  ];
  const r = selectorDecisions.recordSelectorMiss({
    top_k_offered: offeredWithExtras,
    user_intent: 'sanitize this',
    roomState: { db },
  });
  ok(r.ok);
  const props = JSON.parse(fetchMemoryEvent(db, r.miss_id).properties);
  ok(Array.isArray(props.top_k_offered));
  equal(props.top_k_offered.length, 2);
  // Each item must carry ONLY command + score (no teaching, no jtbd_summary, no extras).
  for (const item of props.top_k_offered) {
    const keys = Object.keys(item).sort();
    deepStrictEqual(keys, ['command', 'score'], 'sanitized to exactly command + score keys');
  }
  equal(props.top_k_offered[0].command, 'mos:bq');
  equal(props.top_k_offered[0].score, 0.91);
  equal(props.top_k_offered[1].command, 'mos:swot');
  equal(props.top_k_offered[1].score, 0.74);
});
