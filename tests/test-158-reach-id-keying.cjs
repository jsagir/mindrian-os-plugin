'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-01 -- deterministic reach_id keying suite (RJP-06 / RJP-07 / SC-02).
 * ============================================================================
 * Proves the optional, enum-gated reach_id keying on recordSelectorDecision end
 * to end, with NO RNG and NO live Brain. Mirrors the test-148-frozen-contracts.cjs
 * check()/PASS-line/non-zero-exit idiom and the lib/memory/selector-decisions.test
 * temp-room.db fixture (opened through the shipped room-db / navigation chokepoint).
 *
 * Four behaviors (158-01-PLAN <behavior>):
 *   Test 1: reject with reach_id='deep_research' (a frozen-set member)
 *           -> the f_selector_decision row has properties.reach_id === 'deep_research'.
 *   Test 2: reject with reach_id='not_a_reach' (off-enum)
 *           -> the stored row has NO reach_id property (the enum-gate dropped it).
 *   Test 3: reject with NO reach_id arg
 *           -> the stored row has NO reach_id property (byte-stable pre-158 shape).
 *   Test 4: properties.reason behavior is unchanged from today (the reach_id
 *           addition does not perturb the reason handling).
 *
 * Reads back via navigation.findRecentChanges({eventType:'f_selector_decision'})
 * (the Part 9 chokepoint) and inspects parsed properties.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const selectorDecisions = require(path.join(REPO_ROOT, 'lib', 'workflow', 'selector-decisions.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// Fresh temp room.db opened through the shipped opener (mirrors
// selector-decisions.test.cjs freshDb). Each test gets an isolated db so the
// most-recent f_selector_decision read-back is unambiguous.
function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p158-01-reach-id-keying-'));
  return openRoomDb(dir);
}

// The shipped edges table has FK (source, target) -> nodes(id). Seed the command
// + framework anchor nodes so writeEdge inside recordSelectorDecision succeeds
// (mirrors selector-decisions.test.cjs seedAnchorsFor).
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p158-01-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

// Read back the most-recent f_selector_decision payload via the chokepoint.
function lastDecisionProps(db) {
  const rows = navigation.findRecentChanges(db, 0, {
    eventType: 'f_selector_decision',
    limit: 10,
  });
  assert.ok(rows.length > 0, 'at least one f_selector_decision row must be present');
  // findRecentChanges returns DESC by created_at; the first row is the newest.
  return rows[0].properties;
}

const CMD = 'mos:beautiful-question';
const FW = 'Beautiful Question Framework';

console.log('test-158-reach-id-keying.cjs (RJP-06/07 / SC-02): optional enum-gated reach_id keying');

// ---------------------------------------------------------------------------
// Test 1: a frozen-set reach_id is WRITTEN as the scalar enum.
// ---------------------------------------------------------------------------
check('reject with reach_id="deep_research" stores properties.reach_id === "deep_research"', () => {
  const db = freshDb();
  seedAnchorsFor(db, CMD, FW);
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: CMD,
    framework: FW,
    reason: 'not the right move now',
    reach_id: 'deep_research',
    roomState: { db },
  });
  assert.ok(r && r.ok, 'recordSelectorDecision ok; got reason=' + (r && r.reason));
  const props = lastDecisionProps(db);
  assert.strictEqual(props.reach_id, 'deep_research', 'reach_id enum must ride the payload');
  assert.strictEqual(props.decision, 'reject');
  assert.strictEqual(props.edge_semantic, 'REJECTED');
});

// ---------------------------------------------------------------------------
// Test 2: an off-enum reach_id is IGNORED (the enum-gate drops it).
// ---------------------------------------------------------------------------
check('reject with off-enum reach_id="not_a_reach" stores NO reach_id property', () => {
  const db = freshDb();
  seedAnchorsFor(db, CMD, FW);
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: CMD,
    framework: FW,
    reason: 'still not now',
    reach_id: 'not_a_reach',
    roomState: { db },
  });
  assert.ok(r && r.ok, 'recordSelectorDecision ok; got reason=' + (r && r.reason));
  const props = lastDecisionProps(db);
  assert.ok(
    !Object.prototype.hasOwnProperty.call(props, 'reach_id'),
    'off-enum reach_id must NOT be stored (the enum-gate drops it)'
  );
});

// ---------------------------------------------------------------------------
// Test 3: NO reach_id arg -> NO reach_id property (byte-stable pre-158 shape).
// ---------------------------------------------------------------------------
check('reject with no reach_id arg stores NO reach_id property (byte-stable)', () => {
  const db = freshDb();
  seedAnchorsFor(db, CMD, FW);
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: CMD,
    framework: FW,
    reason: 'pass',
    roomState: { db },
  });
  assert.ok(r && r.ok, 'recordSelectorDecision ok; got reason=' + (r && r.reason));
  const props = lastDecisionProps(db);
  assert.ok(
    !Object.prototype.hasOwnProperty.call(props, 'reach_id'),
    'no-arg path must NOT add a reach_id key (RJP-02 byte-stability)'
  );
});

// ---------------------------------------------------------------------------
// Test 4: reason behavior is unchanged by the reach_id addition.
// ---------------------------------------------------------------------------
check('reason handling is unperturbed by the reach_id addition', () => {
  // 4a: a present reason still rides verbatim alongside a valid reach_id.
  const db1 = freshDb();
  seedAnchorsFor(db1, CMD, FW);
  selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: CMD,
    framework: FW,
    reason: 'concrete reason text',
    reach_id: 'contradiction',
    roomState: { db: db1 },
  });
  const p1 = lastDecisionProps(db1);
  assert.strictEqual(p1.reason, 'concrete reason text', 'reason must ride verbatim');
  assert.strictEqual(p1.reach_id, 'contradiction', 'a valid reach_id co-exists with reason');

  // 4b: an omitted reason is null today and stays null with a valid reach_id.
  const db2 = freshDb();
  seedAnchorsFor(db2, CMD, FW);
  selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: CMD,
    framework: FW,
    reach_id: 'hats',
    roomState: { db: db2 },
  });
  const p2 = lastDecisionProps(db2);
  assert.strictEqual(p2.reason, null, 'omitted reason stays null (unchanged from pre-158)');
  assert.strictEqual(p2.reach_id, 'hats', 'reach_id rides even with no reason');
});

// ---------------------------------------------------------------------------
// Done.
// ---------------------------------------------------------------------------
console.log('');
console.log('PASS test-158-reach-id-keying.cjs (' + passed + ' checks)');
process.exit(0);
