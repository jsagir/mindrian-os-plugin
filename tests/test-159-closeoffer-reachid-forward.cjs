'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-01 Task 1 -- closeOffer reach_id forward suite (DCW-02 / DCW-08).
 * ===========================================================================
 * Proves closeOffer additively forwards an OPTIONAL reach_id into decisionArgs,
 * enum-gated downstream by the Phase 158-01 recordSelectorDecision REACH_IDS
 * gate. Mirrors tests/test-158-reach-id-keying.cjs check()/PASS-line/exit idiom
 * and the lib/memory/offer-closer.test.cjs temp-room.db fixture (opened through
 * the shipped room-db / navigation chokepoint).
 *
 * Four behaviors (159-01-PLAN Task 1 <behavior>):
 *   Test 1 (keyed): closeOffer({pick:'reject', reach_id:'deep_research', ...})
 *           -> the f_selector_decision row has properties.reach_id === 'deep_research'.
 *   Test 2 (off-set dropped): closeOffer({..., reach_id:'not_a_reach'})
 *           -> the stored row has NO reach_id property (the enum-gate dropped it).
 *   Test 3 (absent): closeOffer with NO reach_id arg
 *           -> the stored row has NO reach_id property (byte-stable pre-159 shape).
 *   Test 4 (sibling untouched): dial-close-reach.cjs::closeReach signature is
 *           unchanged (HOW-1 sibling-not-re-routed).
 *
 * Reads back via navigation.findRecentChanges({eventType:'f_selector_decision'})
 * (the Part 9 chokepoint) and inspects parsed properties.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const closer = require(path.join(REPO_ROOT, 'lib', 'workflow', 'offer-closer.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// Fresh temp room.db opened through the shipped opener (mirrors
// test-158-reach-id-keying.cjs freshDb). Each test gets an isolated db so the
// most-recent f_selector_decision read-back is unambiguous.
function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p159-01-closeoffer-reachid-'));
  return { db: openRoomDb(dir), dir };
}

// The shipped edges table has FK (source, target) -> nodes(id). Seed the command
// + framework anchor nodes so writeEdge inside recordSelectorDecision succeeds
// (mirrors test-158 seedAnchorsFor).
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'p159-01-fixture', 'system', NULL, 'confirmed', ?, ?)"
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
  return rows[0].properties;
}

const CMD = 'mos:beautiful-question';
const FW = 'Beautiful Question Framework';

function offerFor() {
  return {
    command: CMD,
    framework: FW,
    jtbd: 'reframe the problem',
    confidence: 0.71,
    reason: '[[problem-definition]] reframe',
  };
}

console.log('test-159-closeoffer-reachid-forward.cjs (DCW-02 / DCW-08): closeOffer reach_id forward');

// ---------------------------------------------------------------------------
// Test 1 (keyed): a frozen-set reach_id rides the f_selector_decision row.
// ---------------------------------------------------------------------------
check('closeOffer reject with reach_id="deep_research" stores properties.reach_id === "deep_research"', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, CMD, FW);
  const r = closer.closeOffer({
    pick: 'reject',
    offer: offerFor(),
    reason: 'not the right move now',
    reach_id: 'deep_research',
    roomState: { db },
  });
  assert.ok(r && r.ok, 'closeOffer ok; got reason=' + (r && r.reason));
  const props = lastDecisionProps(db);
  assert.strictEqual(props.reach_id, 'deep_research', 'reach_id enum must ride the payload');
  assert.strictEqual(props.decision, 'reject');
  assert.strictEqual(props.edge_semantic, 'REJECTED');
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 2 (off-set dropped): an off-enum reach_id is dropped by the enum-gate.
// ---------------------------------------------------------------------------
check('closeOffer reject with off-set reach_id="not_a_reach" stores NO reach_id property (DCW-08 never mis-keyed)', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, CMD, FW);
  const r = closer.closeOffer({
    pick: 'reject',
    offer: offerFor(),
    reason: 'still not now',
    reach_id: 'not_a_reach',
    roomState: { db },
  });
  assert.ok(r && r.ok, 'closeOffer ok; got reason=' + (r && r.reason));
  const props = lastDecisionProps(db);
  assert.ok(
    !Object.prototype.hasOwnProperty.call(props, 'reach_id'),
    'off-set reach_id must NOT be stored (the downstream enum-gate drops it)'
  );
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 3 (absent): NO reach_id arg -> NO reach_id property (pre-159 byte-stable).
// ---------------------------------------------------------------------------
check('closeOffer reject with no reach_id arg stores NO reach_id property (byte-stable pre-159)', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, CMD, FW);
  const r = closer.closeOffer({
    pick: 'reject',
    offer: offerFor(),
    reason: 'pass',
    roomState: { db },
  });
  assert.ok(r && r.ok, 'closeOffer ok; got reason=' + (r && r.reason));
  const props = lastDecisionProps(db);
  assert.ok(
    !Object.prototype.hasOwnProperty.call(props, 'reach_id'),
    'no-arg path must NOT add a reach_id key (pre-159 byte-stability)'
  );
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 4 (sibling untouched): closeReach signature unchanged (HOW-1).
// ---------------------------------------------------------------------------
check('dial-close-reach.cjs::closeReach exports/signature unchanged (HOW-1 sibling untouched)', () => {
  const closeReachMod = require(path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs'));
  assert.strictEqual(typeof closeReachMod.closeReach, 'function', 'closeReach must still be exported');
  // closeReach is a single-arg function (args object). Assert arity is unchanged.
  assert.strictEqual(closeReachMod.closeReach.length, 1, 'closeReach must remain a single-arg (args) function');
  // The PIVOT_PENALTY_FLOOR symbolic export still exists (module shape intact).
  assert.strictEqual(typeof closeReachMod.PIVOT_PENALTY_FLOOR, 'number', 'PIVOT_PENALTY_FLOOR export must be intact');
});

console.log('');
console.log('PASS test-159-closeoffer-reachid-forward.cjs (' + passed + ' checks)');
process.exit(0);
