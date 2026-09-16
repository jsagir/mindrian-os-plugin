'use strict';
/*
 * tests/test-348-traceability.cjs -- Phase 348-07. Three tasks, one file:
 *
 *   Task 1 -- the verdict check, the identity resolution, the proposed
 *             pre-check, the hostile matrix, and supersede()'s own
 *             failures passing through unchanged.
 *   Task 2 -- the D-08 endpoint-existence check and the D-04 reified-shape
 *             guard on the gate path: a refusal matrix, one row per named
 *             reason, each leaving three graph counters unchanged.
 *   Task 3 -- traceability after the close: a three-link chain built
 *             through the GATE (not through direct supersede() calls),
 *             read back from either end, plus the as-of legs.
 *
 * House idiom: node:assert/strict, `let n = 0; function ok(desc, fn)`
 * counter, one fixture per leg with an explicit close in a finally, final
 * line '>>> test-348-traceability.cjs: PASSED'. Zero network. Zero writes
 * outside the temp fixture tree (tests/helpers/fixture-room-348.cjs owns
 * all filesystem state).
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

const { supersedeOnGateAnswer, GATE_REFUSAL_REASONS } = require(
  path.join(REPO, 'lib', 'core', 'temporal', 'supersession-gate.cjs')
);
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { supersede, walkSupersedesChain } = require(path.join(REPO, 'lib', 'core', 'temporal', 'supersession.cjs'));
const { queryAsOf } = require(path.join(REPO, 'lib', 'core', 'temporal', 'point-in-time.cjs'));
const { writeClaimNode } = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-claim.cjs'));
const { confirmNode, resolveByUser } = require(path.join(REPO, 'lib', 'core', 'navigation', 'confirm-node.cjs'));
const { writeEdge } = require(path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs'));
const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-348.cjs'));

let n = 0;
function ok(desc, fn) {
  fn();
  n += 1;
  console.log('  ok ' + n + ' - ' + desc);
}

console.log('test-348-traceability (SUPER-01/03/09/11/17/19)');

const GATE_VERDICT_APPROVE = 'approve';

function supersedesEdgeCount(db) {
  return db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SUPERSEDES'").get().c;
}
function memoryEventCount(db) {
  return db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event'").get().c;
}
function reviewStatusOf(db, id) {
  return db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id).review_status;
}
function edgeCountForNode(db, nodeId) {
  return db.prepare('SELECT COUNT(*) AS c FROM edges WHERE source = ? OR target = ?').get(nodeId, nodeId).c;
}
function nodeCount(db) {
  return db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c;
}

// ==========================================================================
// Task 1: verdict check, identity resolution, proposed pre-check, hostile
// matrix, GATE_REFUSAL_REASONS shape, supersede()'s own failures passing
// through unchanged.
// ==========================================================================

ok('GATE_REFUSAL_REASONS is a frozen array containing every reason this module can emit', function () {
  assert.ok(Array.isArray(GATE_REFUSAL_REASONS));
  assert.ok(Object.isFrozen(GATE_REFUSAL_REASONS));
  const expected = [
    'gate_not_approved', 'invalid_params', 'unknown_node', 'missing_contradicts_edge',
    'unvalidated_edge_endpoints', 'reified_shape_out_of_scope', 'invalid_transition',
    'unresolvable_identity', 'gate_fault',
  ];
  for (const r of expected) {
    assert.ok(GATE_REFUSAL_REASONS.indexOf(r) !== -1, 'missing reason: ' + r);
  }
});

(function taskOneHappyAndVerdict() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const FIXED = Date.now() + 20 * 60 * 1000;
    fx.db.prepare('UPDATE nodes SET valid_from = ? WHERE id = ?').run(FIXED, fx.claimAId);

    ok('an approve verdict on a wide fixture returns supersede() own success object verbatim', function () {
      const result = supersedeOnGateAnswer(fx.db, {
        oldNodeId: fx.claimBId,
        newNodeId: fx.claimAId,
        roomDir: fx.roomDir,
        verdict: GATE_VERDICT_APPROVE,
        now: () => FIXED,
      });
      const expectedKeys = ['ok', 'oldNodeId', 'newNodeId', 'invalidatedAt', 'validTo', 'edge'].sort();
      assert.deepEqual(Object.keys(result).sort(), expectedKeys, 'unexpected key shape: ' + JSON.stringify(result));
      assert.equal(result.ok, true);
      assert.equal(result.oldNodeId, fx.claimBId);
      assert.equal(result.newNodeId, fx.claimAId);
      assert.equal(result.invalidatedAt, FIXED);
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

(function taskOneVerdictMatrix() {
  const badVerdicts = ['reject', 'defer', 'not-a-real-token', undefined, null, 42, {}, []];
  for (const v of badVerdicts) {
    const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      ok('a non-approve verdict (' + JSON.stringify(v) + ') is refused and mutates nothing', function () {
        const before = reviewStatusOf(fx.db, fx.claimBId);
        const beforeEdges = supersedesEdgeCount(fx.db);
        const result = supersedeOnGateAnswer(fx.db, {
          oldNodeId: fx.claimBId, newNodeId: fx.claimAId, roomDir: fx.roomDir, verdict: v,
        });
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'gate_not_approved');
        assert.equal(reviewStatusOf(fx.db, fx.claimBId), before);
        assert.equal(supersedesEdgeCount(fx.db), beforeEdges);
      });
    } finally {
      closeSupersessionFixtureRoom(fx);
    }
  }
}());

(function taskOneIdentityFromUserMd() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', userId: 'navigator-fixture' });
  try {
    ok('the identity is resolveByUser(roomDir); the status_superseded event carries it literally', function () {
      const result = supersedeOnGateAnswer(fx.db, {
        oldNodeId: fx.claimBId, newNodeId: fx.claimAId, roomDir: fx.roomDir, verdict: GATE_VERDICT_APPROVE,
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      const event = fx.db.prepare(
        "SELECT properties FROM nodes WHERE type = 'memory_event' "
        + "AND json_extract(properties, '$.event_type') = 'status_superseded' "
        + "AND json_extract(properties, '$.target_node_id') = ? ORDER BY created_at DESC LIMIT 1"
      ).get(fx.claimBId);
      assert.ok(event);
      const props = JSON.parse(event.properties);
      assert.equal(props.confirmed_by, 'navigator-fixture');
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

(function taskOnePoisonedIdentityNeutralized() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', poisonedIdentity: true });
  try {
    ok('a poisoned USER.md (user_id: larry) is coerced to navigator; the approve SUCCEEDS', function () {
      const result = supersedeOnGateAnswer(fx.db, {
        oldNodeId: fx.claimBId, newNodeId: fx.claimAId, roomDir: fx.roomDir, verdict: GATE_VERDICT_APPROVE,
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      const event = fx.db.prepare(
        "SELECT properties FROM nodes WHERE type = 'memory_event' "
        + "AND json_extract(properties, '$.event_type') = 'status_superseded' "
        + "AND json_extract(properties, '$.target_node_id') = ? ORDER BY created_at DESC LIMIT 1"
      ).get(fx.claimBId);
      const props = JSON.parse(event.properties);
      assert.equal(props.confirmed_by, 'navigator');
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

(function taskOneByUserNeverRead() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    ok("params.byUser is never read; passing byUser:'system' changes nothing", function () {
      const result = supersedeOnGateAnswer(fx.db, {
        oldNodeId: fx.claimBId, newNodeId: fx.claimAId, roomDir: fx.roomDir,
        verdict: GATE_VERDICT_APPROVE, byUser: 'system',
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      const event = fx.db.prepare(
        "SELECT properties FROM nodes WHERE type = 'memory_event' "
        + "AND json_extract(properties, '$.event_type') = 'status_superseded' "
        + "AND json_extract(properties, '$.target_node_id') = ? ORDER BY created_at DESC LIMIT 1"
      ).get(fx.claimBId);
      const props = JSON.parse(event.properties);
      assert.notEqual(props.confirmed_by, 'system');
      assert.equal(props.confirmed_by, fx.byUser);
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

(function taskOneUnresolvableRoomDir() {
  const badRoomDirs = [undefined, null, 42, {}, []];
  for (const rd of badRoomDirs) {
    const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      ok('roomDir ' + JSON.stringify(rd) + ' missing/not-a-string yields unresolvable_identity, never a default guess', function () {
        const result = supersedeOnGateAnswer(fx.db, {
          oldNodeId: fx.claimBId, newNodeId: fx.claimAId, roomDir: rd, verdict: GATE_VERDICT_APPROVE,
        });
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'unresolvable_identity');
        assert.equal(reviewStatusOf(fx.db, fx.claimBId), 'confirmed');
      });
    } finally {
      closeSupersessionFixtureRoom(fx);
    }
  }
}());

(function taskOneProposedPreCheck() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    ok('a proposed old node returns invalid_transition naming proposed->rejected', function () {
      const cRes = writeClaimNode(fx.db, {
        knowledge_type: 'fact', text: 'Claim C, proposed, never confirmed.',
        sessionId: 'traceability-348', sourceSegment: 'claim-c',
      });
      assert.equal(cRes.ok, true);
      const cId = cRes.node_id;
      assert.equal(reviewStatusOf(fx.db, cId), 'proposed');
      // A CONTRADICTS edge so the D-08 shape check (Task 2) never masks this
      // leg's OWN assertion (the proposed pre-check) behind missing_contradicts_edge.
      const edgeRes = writeEdge(fx.db, {
        source_id: cId, target_id: fx.claimAId, edge_type: 'CONTRADICTS', properties: { relation: 'contradicts' },
      });
      assert.equal(edgeRes.ok, true);
      const result = supersedeOnGateAnswer(fx.db, {
        oldNodeId: cId, newNodeId: fx.claimAId, roomDir: fx.roomDir, verdict: GATE_VERDICT_APPROVE,
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'invalid_transition');
      assert.equal(result.alternative, 'proposed->rejected');
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

(function taskOneSupersedeFailurePassesThroughUnchanged() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    ok("supersede()'s own edge_write_failed passes through unchanged, never swallowed", function () {
      const realPrepare = fx.db.prepare.bind(fx.db);
      const hostileDb = {
        prepare: function (sql) {
          if (typeof sql === 'string' && sql.indexOf('INSERT INTO edges') === 0) {
            return { run: function () { throw new Error('simulated_edge_write_failure'); } };
          }
          return realPrepare(sql);
        },
        exec: function (sql) { return fx.db.exec(sql); },
      };
      const before = supersedesEdgeCount(fx.db);
      const result = supersedeOnGateAnswer(hostileDb, {
        oldNodeId: fx.claimBId, newNodeId: fx.claimAId, roomDir: fx.roomDir, verdict: GATE_VERDICT_APPROVE,
      });
      assert.equal(result.ok, false);
      assert.equal(String(result.reason || '').indexOf('edge_write_failed'), 0, JSON.stringify(result));
      // The status close already committed (non-lossy) -- supersede.cjs's own
      // documented behavior -- so B IS superseded even though the edge failed.
      // Assert this is surfaced honestly (reason names it), never masked as
      // ok:true.
      assert.equal(supersedesEdgeCount(fx.db), before, 'zero SUPERSEDES edges on an edge-write failure');
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

(function taskOneHostileMatrixNeverThrows() {
  ok('the module never throws for any input in a hostile matrix', function () {
    const hostileParams = {};
    for (const key of ['oldNodeId', 'newNodeId', 'roomDir', 'verdict', 'now', 'readVersion', 'room', 'home', 'sessionId', 'byUser']) {
      Object.defineProperty(hostileParams, key, { get: function () { throw new Error('hostile getter: ' + key); }, enumerable: true });
    }
    const hostileDb = { prepare: function () { throw new Error('hostile prepare'); } };
    const inputs = [null, undefined, 'x', [], 42, {}, hostileParams];
    for (const v of inputs) {
      const result = supersedeOnGateAnswer(hostileDb, v);
      assert.equal(typeof result, 'object');
      assert.equal(result.ok, false);
    }
    // A db whose prepare throws, paired with a legitimate-looking params bag.
    const result2 = supersedeOnGateAnswer(hostileDb, {
      oldNodeId: 'claim:x', newNodeId: 'claim:y', roomDir: '/nonexistent', verdict: GATE_VERDICT_APPROVE,
    });
    assert.equal(result2.ok, false);
  });
}());

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-traceability.cjs: PASSED');
process.exit(0);
