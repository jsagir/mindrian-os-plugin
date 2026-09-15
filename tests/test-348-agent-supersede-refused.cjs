'use strict';
/*
 * tests/test-348-agent-supersede-refused.cjs -- Phase 348-03 Task 2: the
 * SUPER-02 refusal suite over the widened human-attribution guard.
 *
 * docs/SUPERSESSION-CONTRACT.md ("The human gate", SUPER-02/SUPER-03): a
 * supersession of a truth-claim node attributed to an agent identity is
 * REFUSED with agent_attribution_forbidden, before any mutation. This file
 * proves that refusal for every AGENT_IDENTITIES member (in any case) and
 * every TRUTH_CLAIM_TYPES member (both iterated live from the exported sets,
 * never hand-listed, so a future additive member is automatically covered),
 * proves the human path still succeeds with the bitemporal close intact,
 * proves reject/stale by an agent are untouched, and proves the three
 * chokepoint UPDATE branches plus TRANSITIONS / EVENT_FOR_TRANSITION are
 * byte-identical to their pre-plan text (WD-348-5: setsSuperseded is a
 * SEPARATE predicate, setsConfirmed is never widened).
 *
 * House idiom: node:assert/strict, an `ok(desc, fn)` counter, fixtures from
 * tests/helpers/fixture-room-348.cjs with an explicit close in a finally,
 * final line '>>> test-348-agent-supersede-refused.cjs: PASSED'. Mirrors
 * tests/test-348-one-supersession-door.cjs's own idiom verbatim.
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

const {
  promoteNodeStatus,
  TRANSITIONS,
  EVENT_FOR_TRANSITION,
  AGENT_IDENTITIES,
  TRUTH_CLAIM_TYPES,
} = require('../lib/core/navigation/transitions.cjs');

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

console.log('test-348-agent-supersede-refused (SUPER-02 / SUPER-03)');

function build() {
  return buildSupersessionFixtureRoom({ variant: 'wide' });
}

function close(fx) {
  closeSupersessionFixtureRoom(fx);
}

// Test-only setup helper: a raw INSERT to seed an arbitrary-typed node at a
// given review_status, mirroring lib/core/temporal/supersession.test.cjs's
// own setupRoom idiom. This is test fixture arrangement, not a production
// writer -- promoteNodeStatus is the only thing under test here.
function insertNodeAtStatus(db, id, type, reviewStatus) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', ?, 'system', ?, ?, ?)"
  ).run(id, type, 'unknown:' + type + ':' + id, reviewStatus, now, now);
}

function countTargetedEvents(db, nodeId) {
  return db.prepare(
    "SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event' " +
    "AND json_extract(properties, '$.target_node_id') = ?"
  ).get(nodeId).n;
}

function upperCase(s) {
  return s.toUpperCase();
}

function titleCase(s) {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

// ---- Assertion 1: system (default agent identity) refused, zero mutation --

ok('an agent (system) supersession of a claim node is refused with agent_attribution_forbidden, before any mutation', function () {
  const fx = build();
  try {
    const before = fx.db.prepare('SELECT review_status, last_modified_at FROM nodes WHERE id = ?').get(fx.claimAId);
    const evBefore = countTargetedEvents(fx.db, fx.claimAId);
    const res = promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', 'system', 'test-refusal');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'agent_attribution_forbidden');
    const after = fx.db.prepare('SELECT review_status, last_modified_at FROM nodes WHERE id = ?').get(fx.claimAId);
    assert.deepEqual(after, before, 'node review_status / last_modified_at unchanged');
    assert.equal(countTargetedEvents(fx.db, fx.claimAId), evBefore, 'no memory_event row written on refusal');
  } finally { close(fx); }
});

// ---- Assertion 2: every AGENT_IDENTITIES member, every case spelling ------

ok('every AGENT_IDENTITIES member, in every case spelling, is refused for a claim node superseded target', function () {
  for (const identity of AGENT_IDENTITIES) {
    for (const spelling of [identity, upperCase(identity), titleCase(identity)]) {
      const fx = build();
      try {
        const res = promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', spelling, 'r');
        assert.equal(res.ok, false, 'identity spelling ' + JSON.stringify(spelling));
        assert.equal(res.reason, 'agent_attribution_forbidden', 'identity spelling ' + JSON.stringify(spelling));
      } finally { close(fx); }
    }
  }
});

// ---- Assertion 3: every TRUTH_CLAIM_TYPES member is gated -----------------

ok('every TRUTH_CLAIM_TYPES member is refused when an agent supersedes a confirmed node of that type', function () {
  for (const type of TRUTH_CLAIM_TYPES) {
    const fx = build();
    try {
      const nodeId = 'node:348-truth-claim-type:' + type;
      insertNodeAtStatus(fx.db, nodeId, type, 'confirmed');
      const res = promoteNodeStatus(fx.db, nodeId, 'confirmed', 'superseded', 'larry', 'r');
      assert.equal(res.ok, false, 'type ' + type);
      assert.equal(res.reason, 'agent_attribution_forbidden', 'type ' + type);
    } finally { close(fx); }
  }
});

// ---- Assertion 4: the audit-node carve-out is unchanged -------------------

ok('a NON-truth-claim node type (memory_event) confirmed->superseded by system is still PERMITTED', function () {
  const fx = build();
  try {
    const nodeId = 'node:348-non-truth-claim:memory_event';
    insertNodeAtStatus(fx.db, nodeId, 'memory_event', 'confirmed');
    const res = promoteNodeStatus(fx.db, nodeId, 'confirmed', 'superseded', 'system', 'r');
    assert.equal(res.ok, true, JSON.stringify(res));
  } finally { close(fx); }
});

// ---- Assertion 5: the human path still succeeds, bitemporal close intact --

ok("a human identity ('navigator') supersession of a claim SUCCEEDS and sets invalidated_at / valid_to from opts in the same UPDATE", function () {
  const fx = build();
  try {
    const res = promoteNodeStatus(fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 'r', { invalidatedAt: 111, validTo: 222 });
    assert.equal(res.ok, true, JSON.stringify(res));
    const row = fx.db.prepare('SELECT review_status, invalidated_at, valid_to FROM nodes WHERE id = ?').get(fx.claimAId);
    assert.equal(row.review_status, 'superseded');
    assert.equal(row.invalidated_at, 111);
    assert.equal(row.valid_to, 222);
  } finally { close(fx); }
});

// ---- Assertion 6: reject and stale by an agent are UNTOUCHED --------------

ok('an agent (system) may still reject a proposed node and stale a confirmed node -- only the path into superseded is newly gated', function () {
  const fx = build();
  try {
    const proposedId = 'node:348-reject-untouched:claim';
    insertNodeAtStatus(fx.db, proposedId, 'claim', 'proposed');
    const rejectRes = promoteNodeStatus(fx.db, proposedId, 'proposed', 'rejected', 'system', 'r');
    assert.equal(rejectRes.ok, true, JSON.stringify(rejectRes));

    const staleRes = promoteNodeStatus(fx.db, fx.claimBId, 'confirmed', 'stale', 'system', 'r');
    assert.equal(staleRes.ok, true, JSON.stringify(staleRes));
  } finally { close(fx); }
});

// ---- Assertion 7: proposed->confirmed by an agent stays refused (regression) --

ok('proposed->confirmed by an agent (larry) still returns agent_attribution_forbidden, unchanged', function () {
  const fx = build();
  try {
    const proposedId = 'node:348-confirm-still-refused:claim';
    insertNodeAtStatus(fx.db, proposedId, 'claim', 'proposed');
    const res = promoteNodeStatus(fx.db, proposedId, 'proposed', 'confirmed', 'larry', 'r');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'agent_attribution_forbidden');
  } finally { close(fx); }
});

// ---- Assertion 8: the three UPDATE branches are byte-identical (WD-348-5) --

ok('the three UPDATE nodes SET statements in transitions.cjs are byte-identical to their pre-plan text', function () {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'navigation', 'transitions.cjs'), 'utf8');
  const matches = src.match(/UPDATE nodes SET [^']+/g) || [];
  const EXPECTED = [
    'UPDATE nodes SET review_status = ?, confirmed_by = ?, confirmed_at = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?',
    'UPDATE nodes SET review_status = ?, last_seen_at = ?, last_modified_at = ?, invalidated_at = ?, valid_to = ? WHERE id = ?',
    'UPDATE nodes SET review_status = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?',
  ];
  assert.deepEqual(matches, EXPECTED, 'the three UPDATE branches must not move: found ' + JSON.stringify(matches));
});

// ---- Assertion 9: TRANSITIONS / EVENT_FOR_TRANSITION byte-unchanged -------

ok('TRANSITIONS and EVENT_FOR_TRANSITION carry all eight pre-plan keys, named membership only (never an exact .size)', function () {
  const keys = [
    'proposed->confirmed',
    'proposed->needs_evidence',
    'needs_evidence->validated',
    'confirmed->validated',
    'validated->invalidated',
    'proposed->rejected',
    'confirmed->superseded',
    'confirmed->stale',
  ];
  for (const k of keys) {
    assert.ok(TRANSITIONS.has(k), 'TRANSITIONS missing ' + k);
    assert.ok(EVENT_FOR_TRANSITION[k], 'EVENT_FOR_TRANSITION missing ' + k);
  }
});

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-agent-supersede-refused.cjs: PASSED');
process.exit(0);
