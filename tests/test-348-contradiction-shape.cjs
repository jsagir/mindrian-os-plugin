'use strict';
/*
 * tests/test-348-contradiction-shape.cjs -- Phase 348-04 Task 2 (SUPER-08 /
 * D-04).
 *
 * The reified-shape guard: a ContradictionEvent endpoint (the shape
 * lib/core/navigation/reified-claim.cjs::writeContradictionEvent writes,
 * ContradictionEvent --CONTRADICTS--> rivalClaim) must never be misread as
 * "claim A" by findContradictions. D-03 rules the reified shape out of
 * scope for this phase; D-04 requires the guard to fail closed: skip the
 * row, never fabricate a claim identity, and never follow the CONCERNS hop
 * back to the real claim (that would implement the out-of-scope shape under
 * a different name).
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
const { insertNode } = require('../lib/core/node-insert.cjs');
const { writeEdge } = require('../lib/core/navigation/edges.cjs');
const { REIFIED_EVENT_TYPES } = require('../lib/core/navigation/reified-claim.cjs');

const CONTRADICTION_EVENT_LABEL = REIFIED_EVENT_TYPES.ContradictionEvent.label;

let assertions = 0;
function check(cond, msg) {
  assertions++;
  assert.ok(cond, msg);
}

// --- 1. The reified CONTRADICTS edge is never returned, at either includeSuperseded setting

(function testReifiedEdgeNeverReturned() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', reified: true });
  try {
    check(!!fx.eventId, 'fixture must have minted a ContradictionEvent node');
    const off = navigation.findContradictions(fx.db, fx.eventId);
    const on = navigation.findContradictions(fx.db, fx.eventId, { includeSuperseded: true });
    for (const r of off.concat(on)) {
      check(r.claimA.id !== fx.eventId, 'the reified event node must never appear as claimA');
      check(r.claimA.type !== CONTRADICTION_EVENT_LABEL, 'claimA.type must never equal the ContradictionEvent label');
      check(r.claimB.type !== CONTRADICTION_EVENT_LABEL, 'claimB.type must never equal the ContradictionEvent label');
    }
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 2. The direct claim-to-claim edge on the same fixture IS still returned

(function testDirectEdgeStillReturned() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', reified: true });
  try {
    const result = navigation.findContradictions(fx.db, fx.claimAId);
    const directPair = result.find((r) => r.claimA.id === fx.claimAId && r.claimB.id === fx.claimBId);
    check(!!directPair, 'the direct claim-to-claim CONTRADICTS edge must still be returned; the guard skips one row, not the whole result');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 3. The skip sink receives exactly one entry with the named reason ---

(function testSkipSinkReceivesEntry() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', reified: true });
  try {
    // Focus on eventId: getNeighborhood walks OUTGOING edges only, and the
    // reified edge (eventId -CONTRADICTS-> claimBId) is only reachable
    // walking outgoing from the event node itself (claimA's own outgoing
    // walk never reaches the event node, which only points AT claimA via
    // CONCERNS, an incoming edge from claimA's perspective).
    const skipped = [];
    navigation.findContradictions(fx.db, fx.eventId, { skipped });
    check(skipped.length === 1, 'expected exactly one skipped entry for the reified edge, got ' + skipped.length);
    check(skipped[0].reason === 'reified_shape_out_of_scope', 'skip reason must be the named token reified_shape_out_of_scope');
    check(typeof skipped[0].source === 'string' && typeof skipped[0].target === 'string', 'skip entry must carry the edge endpoints');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 4. A call WITHOUT a skipped array is deep-equal to a call with one --

(function testWithoutSinkDeepEqualToWithSink() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', reified: true });
  try {
    const without = navigation.findContradictions(fx.db, fx.eventId);
    const skipped = [];
    const withSink = navigation.findContradictions(fx.db, fx.eventId, { skipped });
    check(JSON.stringify(without) === JSON.stringify(withSink), 'result must be identical with or without the skipped sink');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 5. A non-array skipped (string, object, null) is ignored, never throws

(function testNonArraySkippedIgnored() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', reified: true });
  try {
    for (const bad of ['x', {}, null]) {
      let threw = false;
      let result;
      try {
        result = navigation.findContradictions(fx.db, fx.eventId, { skipped: bad });
      } catch (_e) {
        threw = true;
      }
      check(!threw, 'a non-array skipped (' + JSON.stringify(bad) + ') must not throw');
      check(Array.isArray(result), 'result must still be an array with a bad skipped value');
    }
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 6. The guard fires on node TYPE, not id prefix -----------------------

(function testGuardFiresOnTypeNotIdPrefix() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-348-typeguard-'));
  const dbPath = path.join(tmpDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT' +
    ')'
  );
  db.exec(
    'CREATE TABLE edges (' +
    '  source TEXT NOT NULL, ' +
    '  target TEXT NOT NULL, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  review_status TEXT DEFAULT NULL, ' +
    '  PRIMARY KEY (source, target, type)' +
    ')'
  );
  try {
    // Node whose id does NOT start with 'event:' but whose TYPE is the
    // ContradictionEvent label -- must still be skipped.
    const notEventPrefixButEventType = 'weird-id-no-prefix';
    insertNode(db, notEventPrefixButEventType, CONTRADICTION_EVENT_LABEL, JSON.stringify({}), {
      epistemic_type: 'observation', review_status: 'confirmed',
    });
    const claimTarget1 = 'claim:typeguard:target1';
    insertNode(db, claimTarget1, 'claim', JSON.stringify({}), {
      epistemic_type: 'extracted_fact', review_status: 'confirmed',
    });
    const e1 = writeEdge(db, { source_id: notEventPrefixButEventType, target_id: claimTarget1, edge_type: 'CONTRADICTS', properties: {} });
    check(e1.ok, 'writeEdge (event-typed, non-event-id-prefix source) must succeed');

    // Node whose id STARTS with 'event:' but whose TYPE is 'claim' -- must
    // NOT be skipped.
    const eventPrefixButClaimType = 'event:typeguard:looks-like-event';
    insertNode(db, eventPrefixButClaimType, 'claim', JSON.stringify({}), {
      epistemic_type: 'extracted_fact', review_status: 'confirmed',
    });
    const claimTarget2 = 'claim:typeguard:target2';
    insertNode(db, claimTarget2, 'claim', JSON.stringify({}), {
      epistemic_type: 'extracted_fact', review_status: 'confirmed',
    });
    const e2 = writeEdge(db, { source_id: eventPrefixButClaimType, target_id: claimTarget2, edge_type: 'CONTRADICTS', properties: {} });
    check(e2.ok, 'writeEdge (claim-typed, event-id-prefix source) must succeed');

    const result1 = navigation.findContradictions(db, claimTarget1);
    check(result1.length === 0, 'the event-TYPED node (non-event-id-prefix) must be skipped by TYPE, proving the guard is not id-prefix-based');

    const result2 = navigation.findContradictions(db, eventPrefixButClaimType);
    check(result2.length === 1, 'the claim-TYPED node (event-id-prefix) must NOT be skipped, proving the guard is not id-prefix-based');
  } finally {
    try { db.close(); } catch (_e) { /* best-effort */ }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
})();

console.log(assertions + ' assertions passed.');
console.log('>>> test-348-contradiction-shape.cjs: PASSED');
