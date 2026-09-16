'use strict';
/*
 * tests/test-348-proposed-not-supersedable.cjs -- Phase 348-05 Task 2: the
 * D-05 / SUPER-09 pin. TRANSITIONS stays byte-unchanged after 348-03's guard
 * edit (asserted by named membership AND named absence, never by size), a
 * proposed claim's refusal to supersede is verbatim and side-effect-free for
 * both a human and an agent identity, and the already-legal
 * proposed->rejected alternative works for both.
 *
 * This file is green the moment it lands: it asserts EXISTING behavior
 * (TRANSITIONS was never widened to admit proposed->superseded; the
 * invalid_transition refusal already fires before any mutation) plus the
 * fact that 348-03's human-attribution-guard edit did not disturb it.
 *
 * D-05, in one sentence, carried here as well as in the contract: a claim
 * nobody ever confirmed was never a believed fact, so it cannot become a
 * stale fact, and rejecting it is the honest transition, not superseding it.
 *
 * House test idiom: node:assert/strict, an `ok(desc, fn)` counter, fixtures
 * from tests/helpers/fixture-room-348.cjs, final line
 * '>>> test-348-proposed-not-supersedable.cjs: PASSED'.
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');

const {
  promoteNodeStatus, TRANSITIONS, EVENT_FOR_TRANSITION,
} = require('../lib/core/navigation/transitions.cjs');
const { supersede } = require('../lib/core/temporal/supersession.cjs');
const { writeClaimNode } = require('../lib/core/navigation/typed-claim.cjs');
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

console.log('test-348-proposed-not-supersedable (SUPER-09 / D-05)');

function freshProposedClaim(db, sessionId) {
  const res = writeClaimNode(db, {
    knowledge_type: 'fact',
    text: 'pin: a claim nobody has confirmed yet',
    sessionId: sessionId,
    sourceSegment: sessionId + '-seg',
  });
  assert.equal(res.ok, true, JSON.stringify(res));
  return res.node_id;
}

// ===========================================================================
// GROUP 1: the closed set did not move.
// ===========================================================================

// The additive-floor idiom (edges.cjs:812-816) pins named MEMBERSHIP, never
// an exact .size: a legitimate future addition to TRANSITIONS must not fail
// this test for the wrong reason (a size mismatch), while an illegitimate
// proposed->superseded addition still fails the named-ABSENCE leg below.
// Size is deliberately never asserted anywhere in this file.

const EXPECTED_MEMBERS = [
  'proposed->confirmed',
  'proposed->needs_evidence',
  'needs_evidence->validated',
  'confirmed->validated',
  'validated->invalidated',
  'proposed->rejected',
  'confirmed->superseded',
  'confirmed->stale',
];

const EXPECTED_ABSENT = [
  'proposed->superseded',
  'needs_evidence->superseded',
  'rejected->superseded',
  'stale->superseded',
  'validated->superseded',
];

ok('TRANSITIONS contains all eight named members (named membership, never a size assertion)', function () {
  for (const key of EXPECTED_MEMBERS) {
    assert.ok(TRANSITIONS.has(key), 'expected TRANSITIONS to contain ' + key);
  }
});

ok('TRANSITIONS does NOT contain any of the five plausible proposed/rejected/stale/validated->superseded additions (named absence)', function () {
  for (const key of EXPECTED_ABSENT) {
    assert.ok(!TRANSITIONS.has(key), 'TRANSITIONS must NOT contain ' + key);
  }
});

ok('EVENT_FOR_TRANSITION has an entry for every TRANSITIONS member and no entry for a non-member (two-directional correspondence)', function () {
  const transitionKeys = Array.from(TRANSITIONS);
  const eventKeys = Object.keys(EVENT_FOR_TRANSITION);
  for (const key of transitionKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(EVENT_FOR_TRANSITION, key), 'EVENT_FOR_TRANSITION missing entry for ' + key);
  }
  for (const key of eventKeys) {
    assert.ok(TRANSITIONS.has(key), 'EVENT_FOR_TRANSITION carries a non-member key: ' + key);
  }
  assert.equal(eventKeys.length, transitionKeys.length, 'the two sets must correspond 1-to-1');
});

// ===========================================================================
// GROUP 2: the refusal is verbatim and side-effect-free.
// ===========================================================================

ok('promoteNodeStatus(proposed->superseded, human) returns {ok:false, reason:"invalid_transition"} verbatim, no extra key', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const claimId = freshProposedClaim(fx.db, 'g2-human');
    const res = promoteNodeStatus(fx.db, claimId, 'proposed', 'superseded', 'navigator', 't');
    assert.deepEqual(res, { ok: false, reason: 'invalid_transition' });
  } finally { closeSupersessionFixtureRoom(fx); }
});

ok('the refusal is IDENTICAL for a human identity and an agent identity: invalid_transition fires before the attribution guard', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const humanClaimId = freshProposedClaim(fx.db, 'g2-human2');
    const agentClaimId = freshProposedClaim(fx.db, 'g2-agent2');
    const humanRes = promoteNodeStatus(fx.db, humanClaimId, 'proposed', 'superseded', 'navigator', 't');
    const agentRes = promoteNodeStatus(fx.db, agentClaimId, 'proposed', 'superseded', 'larry', 't');
    assert.deepEqual(humanRes, { ok: false, reason: 'invalid_transition' });
    assert.deepEqual(agentRes, { ok: false, reason: 'invalid_transition' });
  } finally { closeSupersessionFixtureRoom(fx); }
});

ok('the refusal is side-effect-free: review_status, last_seen_at, last_modified_at and the memory_event row count are all unchanged', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const claimId = freshProposedClaim(fx.db, 'g2-sideeffect');
    const before = fx.db.prepare('SELECT review_status, last_seen_at, last_modified_at FROM nodes WHERE id = ?').get(claimId);
    const evBefore = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;

    const res = promoteNodeStatus(fx.db, claimId, 'proposed', 'superseded', 'navigator', 't');
    assert.equal(res.ok, false);

    const after = fx.db.prepare('SELECT review_status, last_seen_at, last_modified_at FROM nodes WHERE id = ?').get(claimId);
    const evAfter = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;

    assert.equal(after.review_status, before.review_status, 'review_status unchanged');
    assert.equal(after.last_seen_at, before.last_seen_at, 'last_seen_at unchanged');
    assert.equal(after.last_modified_at, before.last_modified_at, 'last_modified_at unchanged');
    assert.equal(evAfter, evBefore, 'memory_event row count unchanged');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ===========================================================================
// GROUP 3: the alternative is real.
// ===========================================================================

ok('the alternative route works for a HUMAN: proposed->rejected succeeds, the node reads rejected, a status_rejected memory_event is logged', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const claimId = freshProposedClaim(fx.db, 'g3-human');
    const evBefore = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;
    const res = promoteNodeStatus(fx.db, claimId, 'proposed', 'rejected', 'navigator', 'D-05: never confirmed, so honestly rejected rather than superseded');
    assert.equal(res.ok, true, JSON.stringify(res));
    const row = fx.db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claimId);
    assert.equal(row.review_status, 'rejected');
    const evAfter = fx.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;
    assert.equal(evAfter, evBefore + 1, 'exactly one new memory_event row');
    const evRow = fx.db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ).get();
    const evProps = JSON.parse(evRow.properties);
    assert.equal(evProps.event_type, 'status_rejected');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// Only the path INTO superseded was gated in 348-03; an agent may still
// reject a proposed claim, unchanged.
ok('the alternative route ALSO works for an AGENT: proposed->rejected succeeds unchanged, only the path into superseded was gated in 348-03', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const claimId = freshProposedClaim(fx.db, 'g3-agent');
    const res = promoteNodeStatus(fx.db, claimId, 'proposed', 'rejected', 'system', 'agent-attributed reject stays legal');
    assert.equal(res.ok, true, JSON.stringify(res));
    const row = fx.db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claimId);
    assert.equal(row.review_status, 'rejected');
  } finally { closeSupersessionFixtureRoom(fx); }
});

// ===========================================================================
// GROUP 4: the measurement that motivates the ruling.
// ===========================================================================

ok('typed-claim.cjs::writeClaimNode lands a claim at review_status = "proposed", driven through the real writer (behavioral, not a source read)', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const claimId = freshProposedClaim(fx.db, 'g4-measurement');
    const row = fx.db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claimId);
    assert.equal(row.review_status, 'proposed');
  } finally { closeSupersessionFixtureRoom(fx); }
});

ok('supersede(proposed old node) returns {ok:false, reason:"status_close_failed:invalid_transition"}: the reason travels out through the wrapper unflattened', function () {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const proposedId = freshProposedClaim(fx.db, 'g4-wrapper');
    const res = supersede(fx.db, proposedId, fx.claimBId, { byUser: fx.byUser });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'status_close_failed:invalid_transition');
  } finally { closeSupersessionFixtureRoom(fx); }
});

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-proposed-not-supersedable.cjs: PASSED');
process.exit(0);
