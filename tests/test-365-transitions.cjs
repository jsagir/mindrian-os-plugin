'use strict';
/*
 * tests/test-365-transitions.cjs -- Phase 365 Plan 05 (V365-06, D-20, D-06).
 *
 * Proves the one additive transition needs_evidence->confirmed, its human-only
 * guard, the holdForEvidence sibling in confirm-node.cjs, the widened (listed)
 * reach of confirmNode, and that confirmNode's own body is byte-unchanged.
 *
 *   T1 TRANSITIONS carries the new member and all eight earlier members, named
 *      membership only (never a size); EVENT_FOR_TRANSITION maps it to
 *      status_promoted; the test-348 named-absent members are still absent;
 *      the three UPDATE statements are byte-identical.
 *   T2 an agent-attributed needs_evidence->confirmed on a truth-claim node is
 *      refused with no write; a human byUser succeeds with one status_promoted
 *      memory_event.
 *   T3 holdForEvidence: proposed -> needs_evidence (one event); a confirmed node
 *      -> not_proposed and no write; an EvidenceClaim -> refused.
 *   T4 confirmNode on a needs_evidence claim by a human now succeeds, and
 *      confirmNode's body digest equals the phase-base pin.
 *   T5 navigation.cjs exposes holdForEvidence as a function.
 *
 * Hyphens only. The two dash characters are never written literally here.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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
const { confirmNode, holdForEvidence } = require('../lib/core/navigation/confirm-node.cjs');
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

console.log('test-365-transitions (V365-06 / D-20 / D-06)');

function build() { return buildSupersessionFixtureRoom({ variant: 'wide' }); }
function close(fx) { closeSupersessionFixtureRoom(fx); }

// Test-only arrangement: seed a node of any type at any review_status.
function seed(db, id, type, status) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', ?, 'system', ?, ?, ?)"
  ).run(id, type, 'unknown:' + type + ':' + id, status, now, now);
}

function status(db, id) {
  return db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id).review_status;
}

function promotedEvents(db, id) {
  return db.prepare(
    "SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event' " +
    "AND json_extract(properties, '$.event_type') = 'status_promoted' " +
    "AND json_extract(properties, '$.target_node_id') = ?"
  ).get(id).n;
}

function allEvents(db, id) {
  return db.prepare(
    "SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event' " +
    "AND json_extract(properties, '$.target_node_id') = ?"
  ).get(id).n;
}

// ---- T1: the closed set -----------------------------------------------------

ok('T1 TRANSITIONS has needs_evidence->confirmed and all eight earlier members (named membership, never a size)', function () {
  const keys = [
    'proposed->confirmed', 'proposed->needs_evidence', 'needs_evidence->validated',
    'confirmed->validated', 'validated->invalidated', 'proposed->rejected',
    'confirmed->superseded', 'confirmed->stale',
    'needs_evidence->confirmed',
  ];
  for (const k of keys) {
    assert.ok(TRANSITIONS.has(k), 'TRANSITIONS missing ' + k);
    assert.ok(EVENT_FOR_TRANSITION[k], 'EVENT_FOR_TRANSITION missing ' + k);
  }
  assert.equal(EVENT_FOR_TRANSITION['needs_evidence->confirmed'], 'status_promoted');
});

ok('T1 the test-348 named-absent members are still absent and forbidden pairs stay refused', function () {
  for (const k of ['proposed->superseded', 'needs_evidence->superseded', 'rejected->superseded',
    'stale->superseded', 'validated->superseded', 'needs_evidence->invalidated',
    'stale->confirmed', 'rejected->confirmed']) {
    assert.ok(!TRANSITIONS.has(k), 'TRANSITIONS must NOT contain ' + k);
  }
});

ok('T1 the three UPDATE statements in transitions.cjs are byte-identical (no new UPDATE)', function () {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'navigation', 'transitions.cjs'), 'utf8');
  const matches = src.match(/UPDATE nodes SET [^']+/g) || [];
  assert.deepEqual(matches, [
    'UPDATE nodes SET review_status = ?, confirmed_by = ?, confirmed_at = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?',
    'UPDATE nodes SET review_status = ?, last_seen_at = ?, last_modified_at = ?, invalidated_at = ?, valid_to = ? WHERE id = ?',
    'UPDATE nodes SET review_status = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?',
  ]);
});

// ---- T2: the human guard ----------------------------------------------------

ok('T2 an agent-attributed needs_evidence->confirmed on a claim is refused, every identity, no write', function () {
  for (const identity of AGENT_IDENTITIES) {
    const fx = build();
    try {
      seed(fx.db, 'held-claim', 'claim', 'needs_evidence');
      const before = allEvents(fx.db, 'held-claim');
      const res = promoteNodeStatus(fx.db, 'held-claim', 'needs_evidence', 'confirmed', identity, 'agent attempt');
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'agent_attribution_forbidden');
      assert.equal(status(fx.db, 'held-claim'), 'needs_evidence');
      assert.equal(allEvents(fx.db, 'held-claim'), before, 'no event on refusal');
    } finally { close(fx); }
  }
});

ok('T2 every truth-claim type refuses the agent exit (iterated live from TRUTH_CLAIM_TYPES)', function () {
  const fx = build();
  try {
    let i = 0;
    for (const type of TRUTH_CLAIM_TYPES) {
      const id = 'held-' + (i++);
      seed(fx.db, id, type, 'needs_evidence');
      const res = promoteNodeStatus(fx.db, id, 'needs_evidence', 'confirmed', 'larry', 'agent attempt');
      assert.equal(res.reason, 'agent_attribution_forbidden', type);
      assert.equal(status(fx.db, id), 'needs_evidence', type);
    }
  } finally { close(fx); }
});

ok('T2 a human byUser succeeds and logs exactly one status_promoted memory_event', function () {
  const fx = build();
  try {
    seed(fx.db, 'held-claim', 'claim', 'needs_evidence');
    const res = promoteNodeStatus(fx.db, 'held-claim', 'needs_evidence', 'confirmed', 'navigator-fixture', 'floor met');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(status(fx.db, 'held-claim'), 'confirmed');
    const row = fx.db.prepare('SELECT confirmed_by FROM nodes WHERE id = ?').get('held-claim');
    assert.equal(row.confirmed_by, 'navigator-fixture');
    assert.equal(promotedEvents(fx.db, 'held-claim'), 1);
  } finally { close(fx); }
});

// ---- T3: holdForEvidence ----------------------------------------------------

ok('T3 holdForEvidence on a proposed claim moves it to needs_evidence with one status_promoted event', function () {
  const fx = build();
  try {
    seed(fx.db, 'p-claim', 'claim', 'proposed');
    const res = holdForEvidence(fx.db, 'p-claim', 'navigator-fixture', 'below floor');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(status(fx.db, 'p-claim'), 'needs_evidence');
    assert.equal(promotedEvents(fx.db, 'p-claim'), 1);
  } finally { close(fx); }
});

ok('T3 holdForEvidence on a confirmed claim returns not_proposed and writes nothing', function () {
  const fx = build();
  try {
    seed(fx.db, 'c-claim', 'claim', 'confirmed');
    const before = allEvents(fx.db, 'c-claim');
    const res = holdForEvidence(fx.db, 'c-claim', 'navigator-fixture', 'x');
    assert.deepEqual(res, { ok: false, reason: 'not_proposed', from: 'confirmed' });
    assert.equal(status(fx.db, 'c-claim'), 'confirmed');
    assert.equal(allEvents(fx.db, 'c-claim'), before);
  } finally { close(fx); }
});

ok('T3 holdForEvidence on every non-proposed status refuses; an unknown id returns unknown_node', function () {
  const fx = build();
  try {
    let i = 0;
    for (const st of ['needs_evidence', 'validated', 'rejected', 'stale', 'superseded', 'invalidated']) {
      const id = 'np-' + (i++);
      seed(fx.db, id, 'claim', st);
      const res = holdForEvidence(fx.db, id, 'navigator-fixture', 'x');
      assert.equal(res.ok, false, st);
      assert.equal(res.reason, 'not_proposed', st);
      assert.equal(status(fx.db, id), st);
    }
    assert.equal(holdForEvidence(fx.db, 'no-such-node', 'navigator-fixture', 'x').reason, 'unknown_node');
  } finally { close(fx); }
});

ok('T3 holdForEvidence on an EvidenceClaim is refused as non-promotable and the node stays proposed', function () {
  const fx = build();
  try {
    seed(fx.db, 'ev-claim', 'EvidenceClaim', 'proposed');
    const res = holdForEvidence(fx.db, 'ev-claim', 'navigator-fixture', 'x');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'evidence_claim_non_promotable');
    assert.equal(status(fx.db, 'ev-claim'), 'proposed');
  } finally { close(fx); }
});

// ---- T4: confirmNode reach and its byte pin ---------------------------------

ok('T4 confirmNode on a needs_evidence claim by a human now succeeds (the widened reach the audit listed); an agent is still refused', function () {
  const fx = build();
  try {
    seed(fx.db, 'held-1', 'claim', 'needs_evidence');
    seed(fx.db, 'held-2', 'claim', 'needs_evidence');
    const agent = confirmNode(fx.db, 'held-1', 'larry', 'x');
    assert.equal(agent.ok, false);
    assert.equal(agent.reason, 'agent_attribution_forbidden');
    const human = confirmNode(fx.db, 'held-2', 'navigator-fixture', 'x');
    assert.equal(human.ok, true, JSON.stringify(human));
    assert.equal(status(fx.db, 'held-2'), 'confirmed');
  } finally { close(fx); }
});

ok('T4 confirmNode body digest equals the phase-base pin (D-06: byte-unchanged)', function () {
  const pre = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '365-pre-phase.json'), 'utf8'));
  const lines = fs.readFileSync(path.join(REPO, 'lib', 'core', 'navigation', 'confirm-node.cjs'), 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith('function confirmNode('));
  assert.ok(start >= 0, 'confirmNode not found');
  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) { if (lines[i] === '}') { end = i; break; } }
  assert.ok(end > start, 'confirmNode end not found');
  const body = lines.slice(start, end + 1).join('\n');
  assert.equal(crypto.createHash('sha256').update(body).digest('hex'), pre.confirm_node_body_sha256);
});

// ---- T5: the navigation.cjs re-export 365-04 added --------------------------

ok('T5 require(navigation.cjs).holdForEvidence is the function from confirm-node.cjs', function () {
  const nav = require('../lib/core/navigation.cjs');
  assert.equal(typeof nav.holdForEvidence, 'function');
  assert.equal(nav.holdForEvidence, holdForEvidence);
});

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-365-transitions.cjs: PASSED');
process.exit(0);
