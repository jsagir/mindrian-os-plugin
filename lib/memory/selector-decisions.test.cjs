/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 125-06 -- lib/workflow/selector-decisions.cjs test suite.
 *
 * Covers 16 acceptance behaviors from 125-06-PLAN.md <behavior> block:
 *   Tests 1-7   Decision writes (D7): recordSelectorDecision
 *   Tests 8-14  Decay weight (D7): applyDecayWeight + shouldExclude
 *   Tests 15-16 Integration with Plan 05 ranker (opts._applyDecayWeight)
 *
 * Three-surface compatibility: pure CJS + node:test. Uses fs.mkdtempSync +
 * openRoomDb fixture pattern from Plan 00's navigation-write-edge.test.cjs.
 * All writes route through the navigation.cjs chokepoint; tests verify both
 * the memory_event row AND the typed cascade edge row land in room.db.
 */

'use strict';

const { test } = require('node:test');
const { ok, equal, deepStrictEqual } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SELECTOR_DECISIONS_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'selector-decisions.cjs');
const RANKER_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const selectorDecisions = require(SELECTOR_DECISIONS_PATH);
const ranker = require(RANKER_PATH);

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p125-06-selector-decisions-'));
  const db = openRoomDb(dir);
  return { dir, db };
}

// FK fixture (mirrors Plan 00's seedAnchorNode pattern in
// lib/memory/navigation-write-edge.test.cjs). The shipped edges table has
// FK (source, target) -> nodes(id), so we must seed anchor nodes for the
// command + framework before writeEdge can succeed.
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p125-06-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}

function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

function fetchMemoryEvent(db, decisionId) {
  return db.prepare(
    "SELECT id, type, properties FROM nodes WHERE id = ?"
  ).get(decisionId);
}

function fetchEdge(db, source, target, type) {
  return db.prepare(
    "SELECT source, target, type, properties FROM edges WHERE source = ? AND target = ? AND type = ?"
  ).get(source, target, type);
}

// ---------------------------------------------------------------------------
// Tests 1-7: Decision writes (D7)
// ---------------------------------------------------------------------------

test('Test 1: recordSelectorDecision({decision: "defer"}) writes memory_event with decision="defer"', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, 'mos:beautiful-question', 'Beautiful Question Framework');
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'defer',
    command: 'mos:beautiful-question',
    framework: 'Beautiful Question Framework',
    reason: 'not now',
    roomState: { db, investment_level: 0.3 },
  });
  ok(r.ok, 'recordSelectorDecision should return ok: true; got reason=' + (r && r.reason));
  ok(typeof r.decision_id === 'string' && r.decision_id.length > 0, 'decision_id is non-empty string');
  ok(typeof r.edge_id === 'string' && r.edge_id.length > 0, 'edge_id is non-empty string');
  const row = fetchMemoryEvent(db, r.decision_id);
  ok(row, 'memory_event row present in nodes table');
  equal(row.type, 'memory_event');
  const props = JSON.parse(row.properties);
  equal(props.event_type, 'f_selector_decision');
  equal(props.decision, 'defer');
  equal(props.command, 'mos:beautiful-question');
});

test('Test 2: recordSelectorDecision with decision="reject" writes REJECTED edge', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, 'mos:swot', 'SWOT');
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: 'mos:swot',
    framework: 'SWOT',
    reason: 'wrong approach for our stage',
    roomState: { db, investment_level: 0.5 },
  });
  ok(r.ok);
  // memory_event has decision='reject'.
  const memRow = fetchMemoryEvent(db, r.decision_id);
  ok(memRow);
  const memProps = JSON.parse(memRow.properties);
  equal(memProps.decision, 'reject');
  equal(memProps.edge_semantic, 'REJECTED');
  // edge of type REJECTED is present.
  const edge = fetchEdge(db, 'cmd:mos:swot', 'framework:SWOT', 'REJECTED');
  ok(edge, 'REJECTED edge row should be present');
  equal(edge.type, 'REJECTED');
});

test('Test 3: DEFERRED edge has expires_at ~30 days from now; REJECTED edge does NOT', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, 'mos:c1', 'F1');
  seedAnchorsFor(db, 'mos:c2', 'F2');

  // Defer: expires_at present and within 5min of now+30 days.
  const r1 = selectorDecisions.recordSelectorDecision({
    decision: 'defer',
    command: 'mos:c1',
    framework: 'F1',
    reason: null,
    roomState: { db },
  });
  ok(r1.ok);
  const e1 = fetchEdge(db, 'cmd:mos:c1', 'framework:F1', 'DEFERRED');
  ok(e1);
  const props1 = JSON.parse(e1.properties);
  ok(typeof props1.expires_at === 'string' && props1.expires_at.length > 0, 'expires_at present on DEFERRED');
  const expiresMs = Date.parse(props1.expires_at);
  const expectedMs = Date.now() + 30 * 24 * 3600 * 1000;
  const deltaMs = Math.abs(expiresMs - expectedMs);
  ok(deltaMs < 5 * 60 * 1000, 'expires_at ~30 days from now (within 5 min tolerance); delta=' + deltaMs);

  // Reject: expires_at absent.
  const r2 = selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: 'mos:c2',
    framework: 'F2',
    reason: null,
    roomState: { db },
  });
  ok(r2.ok);
  const e2 = fetchEdge(db, 'cmd:mos:c2', 'framework:F2', 'REJECTED');
  ok(e2);
  const props2 = JSON.parse(e2.properties);
  equal(Object.prototype.hasOwnProperty.call(props2, 'expires_at'), false, 'REJECTED edge has no expires_at');
});

test('Test 4: edge properties include reason verbatim and decision_id', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, 'mos:c4', 'F4');
  const reasonText = 'team is split; defer until next milestone';
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'defer',
    command: 'mos:c4',
    framework: 'F4',
    reason: reasonText,
    roomState: { db },
  });
  ok(r.ok);
  const edge = fetchEdge(db, 'cmd:mos:c4', 'framework:F4', 'DEFERRED');
  ok(edge);
  const props = JSON.parse(edge.properties);
  equal(props.reason, reasonText);
  equal(props.decision_id, r.decision_id);
});

test('Test 5: invalid decision (e.g. "maybe") returns ok:false; no writes', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, 'mos:c5', 'F5');
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'maybe',
    command: 'mos:c5',
    framework: 'F5',
    roomState: { db },
  });
  equal(r.ok, false);
  equal(r.reason, 'invalid_decision');
  // No edges of any type for this command.
  const edges = db.prepare("SELECT 1 FROM edges WHERE source = ?").all('cmd:mos:c5');
  equal(edges.length, 0, 'no edges should be written on invalid decision');
  // No memory_event for f_selector_decision tied to this command.
  const mems = db.prepare(
    "SELECT 1 FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.command') = ?"
  ).all('mos:c5');
  equal(mems.length, 0, 'no memory_event should be written on invalid decision');
});

test('Test 6: reason is optional -- when omitted, payload.reason is null AND edge.properties.reason is null', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, 'mos:c6', 'F6');
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'defer',
    command: 'mos:c6',
    framework: 'F6',
    // reason omitted intentionally
    roomState: { db },
  });
  ok(r.ok);
  const mem = fetchMemoryEvent(db, r.decision_id);
  const memProps = JSON.parse(mem.properties);
  equal(memProps.reason, null, 'payload.reason is null when omitted');
  const edge = fetchEdge(db, 'cmd:mos:c6', 'framework:F6', 'DEFERRED');
  const edgeProps = JSON.parse(edge.properties);
  equal(edgeProps.reason, null, 'edge.properties.reason is null when omitted');
});

test('Test 7: all writes route through navigation.cjs chokepoint (grep audit)', () => {
  const src = fs.readFileSync(SELECTOR_DECISIONS_PATH, 'utf8');
  ok(/require\(['"]\.\.\/core\/navigation\.cjs['"]\)/.test(src),
    "source must require('../core/navigation.cjs')");
  ok(src.indexOf('navigation.writeEdge') !== -1, 'must call navigation.writeEdge');
  ok(src.indexOf('navigation.logMemoryEvent') !== -1, 'must call navigation.logMemoryEvent');
  // No direct room-db.cjs require allowed.
  ok(!/require\([^)]*room-db/.test(src),
    'must NOT require room-db.cjs directly (Canon Part 8 chokepoint invariant)');
  // No direct internal memory-events module require.
  ok(!/require\([^)]*navigation\/memory-events/.test(src),
    'must NOT require navigation/memory-events.cjs directly; route via navigation.cjs');
  // No direct better-sqlite3 / sqlite3 require.
  ok(!/require\(['"]better-sqlite3['"]\)/.test(src),
    'must NOT require better-sqlite3 directly');
  ok(!/require\(['"]sqlite3['"]\)/.test(src),
    'must NOT require sqlite3 directly');
});

// ---------------------------------------------------------------------------
// Tests 8-14: Decay weight (D7) + shouldExclude helper
// ---------------------------------------------------------------------------

test('Test 8: applyDecayWeight at invocation 0 since decision returns 0 (factor = 0)', () => {
  const roomState = { invocationsSinceDecision: { 'mos:x': 0 } };
  const out = selectorDecisions.applyDecayWeight(0.8, 'mos:x', roomState);
  ok(typeof out === 'number' && isFinite(out), 'returns finite number');
  ok(Math.abs(out - 0) < 1e-9, 'at invocation 0, factor = 0; got ' + out);
});

test('Test 9: applyDecayWeight at invocation 5 returns ~0.632 * base (within 0.05)', () => {
  // factor = 1 - exp(-5/5) = 1 - 1/e ~= 0.6321...
  const roomState = { invocationsSinceDecision: { 'mos:x': 5 } };
  const out = selectorDecisions.applyDecayWeight(0.8, 'mos:x', roomState);
  const expected = 0.8 * (1 - Math.exp(-1));
  ok(Math.abs(out - expected) < 0.05, 'invocation 5 -> ~0.5057; got ' + out);
});

test('Test 10: applyDecayWeight at invocation 10 returns factor ~0.865 (within 0.05)', () => {
  // factor = 1 - exp(-10/5) = 1 - exp(-2) ~= 0.8647
  const roomState = { invocationsSinceDecision: { 'mos:x': 10 } };
  const out = selectorDecisions.applyDecayWeight(1.0, 'mos:x', roomState);
  const expected = 1 - Math.exp(-2);
  ok(Math.abs(out - expected) < 0.05, 'invocation 10 -> ~0.865; got ' + out);
});

test('Test 11: applyDecayWeight at invocation 15 returns >= 0.95 of base (effectively expired)', () => {
  const roomState = { invocationsSinceDecision: { 'mos:x': 15 } };
  const out = selectorDecisions.applyDecayWeight(1.0, 'mos:x', roomState);
  ok(out >= 0.95, 'at invocation 15, factor >= 0.95 of base; got ' + out);
});

test('Test 12: shouldExclude returns true when decay factor < 0.1; false when >= 0.1', () => {
  // factor < 0.1 means 1 - exp(-n/5) < 0.1 => exp(-n/5) > 0.9 => n/5 < ln(1/0.9) ~ 0.1054
  // => n < 0.527. So at n=0 -> exclude; at n=1 -> factor ~= 0.181 -> include.
  const exclude0 = selectorDecisions.shouldExclude('mos:x', { invocationsSinceDecision: { 'mos:x': 0 } });
  equal(exclude0, true, 'at invocation 0 (freshly deferred), shouldExclude=true');
  const include1 = selectorDecisions.shouldExclude('mos:x', { invocationsSinceDecision: { 'mos:x': 1 } });
  equal(include1, false, 'at invocation 1, factor ~= 0.181, shouldExclude=false');
  const include5 = selectorDecisions.shouldExclude('mos:x', { invocationsSinceDecision: { 'mos:x': 5 } });
  equal(include5, false, 'at invocation 5, factor ~= 0.632, shouldExclude=false');
});

test('Test 13: applyDecayWeight is pure -- same inputs produce same output', () => {
  const roomState = { invocationsSinceDecision: { 'mos:x': 3 } };
  const a = selectorDecisions.applyDecayWeight(0.7, 'mos:x', roomState);
  const b = selectorDecisions.applyDecayWeight(0.7, 'mos:x', roomState);
  const c = selectorDecisions.applyDecayWeight(0.7, 'mos:x', roomState);
  equal(a, b);
  equal(b, c);
});

test('Test 14: applyDecayWeight gracefully handles roomState without decision history -- returns base_score unchanged', () => {
  // No invocationsSinceDecision counter; no db; no decision recorded => no decay.
  const out1 = selectorDecisions.applyDecayWeight(0.65, 'mos:never-deferred', {});
  equal(out1, 0.65, 'returns base_score when no history');
  // Counter present but missing this command key -> no decay.
  const out2 = selectorDecisions.applyDecayWeight(0.65, 'mos:never-deferred', { invocationsSinceDecision: {} });
  equal(out2, 0.65);
  // Null/undefined roomState -> returns base_score gracefully.
  const out3 = selectorDecisions.applyDecayWeight(0.65, 'mos:never-deferred', null);
  equal(out3, 0.65);
  const out4 = selectorDecisions.applyDecayWeight(0.65, 'mos:never-deferred', undefined);
  equal(out4, 0.65);
});

// ---------------------------------------------------------------------------
// Tests 15-16: Integration with Plan 05 ranker (opts._applyDecayWeight)
// ---------------------------------------------------------------------------

test('Test 15: ranker with opts._applyDecayWeight applies decay; freshly-deferred command ranks at bottom (or filtered)', () => {
  // Use the ranker's fake-registry seam to inject a deterministic 2-command set.
  ranker._test._resetCaches();
  ranker._test._setRegistry({
    commands: [
      {
        command: '/mos:beautiful-question',
        kind: 'methodology',
        frameworks: ['Beautiful Question Framework'],
        serves_jtbd: ['find-problem'],
        jtbd_label: 'Find root problem',
        jtbd_summary: 'BQ surfaces real problems under the symptom.',
        teaching: 'Widen before narrowing.',
      },
      {
        command: '/mos:swot',
        kind: 'methodology',
        frameworks: ['SWOT'],
        serves_jtbd: ['validate-thesis'],
        jtbd_label: 'Audit S/W/O/T',
        jtbd_summary: 'SWOT structures internal vs external.',
        teaching: 'SWOT after JTBD.',
      },
    ],
  });
  // Mark beautiful-question as freshly deferred (invocation 0 since decision).
  const roomState = {
    invocationsSinceDecision: { '/mos:beautiful-question': 0 },
  };
  const out = ranker.rankForSelector({
    roomState,
    k: 3,
    _applyDecayWeight: selectorDecisions.applyDecayWeight,
  });
  // BQ is at invocation 0 => factor 0 => score multiplied by 0 => 0. SWOT untouched.
  ok(out.length >= 1, 'returns at least one ranked command');
  const bq = out.find((x) => x.command === '/mos:beautiful-question');
  const swot = out.find((x) => x.command === '/mos:swot');
  ok(bq, 'BQ should still appear in the result (decay does not filter from ranker output)');
  ok(swot, 'SWOT should appear');
  ok(bq.score === 0, 'freshly-deferred BQ has score 0 after decay; got ' + bq.score);
  // SWOT outranks BQ when BQ score = 0.
  ok(swot.score >= bq.score, 'SWOT ranks at least as high as decayed BQ');
  // Reset for downstream tests.
  ranker._test._resetCaches();
});

test('Test 16: after 15 invocations since decision, decayed score ~= un-decayed score (decision effectively expired)', () => {
  ranker._test._resetCaches();
  ranker._test._setRegistry({
    commands: [
      {
        command: '/mos:beautiful-question',
        kind: 'methodology',
        frameworks: ['Beautiful Question Framework'],
        serves_jtbd: ['find-problem'],
        jtbd_label: 'Find root problem',
        jtbd_summary: 'BQ surfaces real problems.',
        teaching: 'Widen before narrowing.',
      },
    ],
  });
  // Un-decayed baseline (no decay hook).
  const baseline = ranker.rankForSelector({
    roomState: {},
    k: 3,
  });
  // After 15 invocations since decision, factor ~= 0.9502, effectively expired.
  const decayed = ranker.rankForSelector({
    roomState: { invocationsSinceDecision: { '/mos:beautiful-question': 15 } },
    k: 3,
    _applyDecayWeight: selectorDecisions.applyDecayWeight,
  });
  const baseBq = baseline.find((x) => x.command === '/mos:beautiful-question');
  const decayBq = decayed.find((x) => x.command === '/mos:beautiful-question');
  ok(baseBq);
  ok(decayBq);
  // Decayed score should be within ~5% of baseline (decay factor >= 0.95 at n=15).
  const ratio = decayBq.score / Math.max(baseBq.score, 1e-9);
  ok(ratio >= 0.94, 'decayed score is at least 94% of baseline at n=15; got ratio=' + ratio);
  ranker._test._resetCaches();
});

// ---------------------------------------------------------------------------
// Bonus regression: db-backed _invocationsSinceDecision counts framework_invoked
// events newer than the most recent f_selector_decision for the command.
// ---------------------------------------------------------------------------

test('Bonus: _invocationsSinceDecision counts framework_invoked events after the last decision', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, 'mos:bonus-decay', 'BonusFramework');
  // Record a decision at t0.
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'defer',
    command: 'mos:bonus-decay',
    framework: 'BonusFramework',
    reason: null,
    roomState: { db },
  });
  ok(r.ok);
  // Sleep at least 2 ms so the framework_invoked rows land strictly after the
  // memory_event row (createdAt > lastDecisionAt). Phase 109's findRecentChanges
  // uses strict '>' on created_at.
  const target = Date.now() + 3;
  while (Date.now() < target) { /* busy-wait <= 3ms */ }
  // Log a few framework_invoked events via the chokepoint.
  const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
  navigation.logMemoryEvent(db, 'framework_invoked', { command: 'mos:bonus-decay', framework: 'BonusFramework' });
  navigation.logMemoryEvent(db, 'framework_invoked', { command: 'mos:bonus-decay', framework: 'BonusFramework' });
  // Now applyDecayWeight should compute decay relative to 2 invocations since decision.
  // factor = 1 - exp(-2/5) ~= 0.3297; 0.5 * 0.3297 ~= 0.1648.
  const decayed = selectorDecisions.applyDecayWeight(0.5, 'mos:bonus-decay', { db });
  const expected = 0.5 * (1 - Math.exp(-2 / 5));
  ok(Math.abs(decayed - expected) < 0.1, 'db-backed decay factor with 2 framework_invoked events; got ' + decayed + ' expected ~' + expected);
});
