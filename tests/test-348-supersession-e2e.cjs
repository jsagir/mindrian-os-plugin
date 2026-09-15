'use strict';
/*
 * tests/test-348-supersession-e2e.cjs -- Phase 348-02 Task 2: the SUPER-17
 * load-bearing end-to-end loop proof, plus three negative legs. RED until
 * 348-07 lands lib/core/temporal/supersession-gate.cjs.
 *
 * 348-RESEARCH.md's Validation Architecture names SUPER-17 as this phase's
 * load-bearing proof and says outright "write this before the wiring". This
 * file is written against the gate module's contract as FIXED by
 * 348-02-PLAN.md's own "The gate module contract this plan FIXES for 348-07"
 * section:
 *
 *   supersedeOnGateAnswer(db, params) where params is
 *     { oldNodeId, newNodeId, roomDir, verdict, now, readVersion, room,
 *       home, sessionId }.
 *   - db is a caller-owned handle; the module never opens room.db itself.
 *   - verdict is the gate answer token. Anything other than an approve
 *     verdict returns { ok:false, reason:'gate_not_approved' }. This test
 *     fixes the literal token: GATE_VERDICT_APPROVE = 'approve'.
 *   - The human identity is resolved from roomDir through resolveByUser.
 *     params.byUser is NEVER read; supplying one changes nothing.
 *   - On success it returns supersede()'s own result object verbatim.
 *   - On refusal it returns { ok:false, reason:<named> } from the closed set
 *     { gate_not_approved, unknown_node, missing_contradicts_edge,
 *       unvalidated_edge_endpoints, reified_shape_out_of_scope,
 *       invalid_transition, plus anything supersede() itself returns
 *       unchanged }. On the invalid_transition refusal for a proposed old
 *     node it additionally carries alternative: 'proposed->rejected'.
 *
 * T-348-06 (Spoofing: a proof that passes without its subject): the require
 * below is UNGUARDED and sits at the top of the file, before any fixture is
 * built or any assertion runs. Today lib/core/temporal/supersession-gate.cjs
 * does not exist, so this require THROWS here, the process exits non-zero,
 * and the failure output names the missing module -- not an assertion.
 * tests/run-all-348.sh's run_red_until helper reports this leg EXPECTED-RED
 * for exactly that reason, and would report it FAILED if this ever passed
 * while the guard file is still absent. Do NOT wrap this require in a
 * try/catch that degrades to a pass: a proof that succeeds without its
 * subject module is precisely the failure mode this file exists to catch.
 *
 * House idiom: node:assert/strict, `let n = 0; function ok(desc, fn)`
 * counter, one fixture per leg with an explicit close in a finally, final
 * line '>>> test-348-supersession-e2e.cjs: PASSED'. Zero network. Zero
 * writes outside the temp fixture tree (tests/helpers/fixture-room-348.cjs
 * owns all filesystem state).
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

// UNGUARDED. See the header note above: this line is the entire tripwire.
const { supersedeOnGateAnswer } = require(path.join(REPO, 'lib', 'core', 'temporal', 'supersession-gate.cjs'));

const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { supersede } = require(path.join(REPO, 'lib', 'core', 'temporal', 'supersession.cjs'));
const { queryAsOf } = require(path.join(REPO, 'lib', 'core', 'temporal', 'point-in-time.cjs'));
const { writeClaimNode } = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-claim.cjs'));
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

console.log('test-348-supersession-e2e (SUPER-17)');

// The gate's own verdict vocabulary, fixed HERE for 348-07 to implement
// against (348-02-PLAN.md's contract section: "verdict is the gate answer
// token"). Any token other than GATE_VERDICT_APPROVE must refuse.
const GATE_VERDICT_APPROVE = 'approve';
const GATE_VERDICT_REJECT = 'reject';

function edgeCountForNode(db, nodeId) {
  return db.prepare('SELECT COUNT(*) AS c FROM edges WHERE source = ? OR target = ?').get(nodeId, nodeId).c;
}

function supersedesEdgeCount(db) {
  return db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SUPERSEDES'").get().c;
}

// ---- Steps 1-9: the happy-path loop, one fixture, one shared FIXED clock -

(function stepsOneThroughNine() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    ok('step 1: A and B both exist confirmed with a human confirmed_by', function () {
      const a = fx.db.prepare('SELECT review_status, confirmed_by FROM nodes WHERE id = ?').get(fx.claimAId);
      const b = fx.db.prepare('SELECT review_status, confirmed_by FROM nodes WHERE id = ?').get(fx.claimBId);
      assert.equal(a.review_status, 'confirmed');
      assert.equal(b.review_status, 'confirmed');
      assert.ok(typeof a.confirmed_by === 'string' && a.confirmed_by.length > 0);
      assert.ok(typeof b.confirmed_by === 'string' && b.confirmed_by.length > 0);
    });

    ok('step 2: a CONTRADICTS edge A->B exists, written through writeEdge', function () {
      const row = fx.db.prepare("SELECT source, target FROM edges WHERE type = 'CONTRADICTS'").get();
      assert.ok(row, 'no CONTRADICTS edge found');
      assert.equal(row.source, fx.claimAId);
      assert.equal(row.target, fx.claimBId);
    });

    ok('step 3: findContradictions(db, claimAId) surfaces the pair', function () {
      const pairs = navigation.findContradictions(fx.db, fx.claimAId);
      assert.equal(pairs.length, 1, 'expected exactly one contradiction pair');
      assert.equal(pairs[0].claimA.id, fx.claimAId);
      assert.equal(pairs[0].claimB.id, fx.claimBId);
    });

    // Step 9's own clock: a fixed reference "now" this test owns end to end,
    // never Date.now() at assertion time -- a wall-clock comparison would
    // eventually go red for the wrong reason. A supersedes B, so A's
    // valid_from (the close boundary supersede() reads off the NEW node) is
    // pinned to FIXED here, deterministically, rather than left to whatever
    // order writeClaimNode's own Date.now() calls happened to land in.
    const FIXED = Date.now() + 10 * 60 * 1000;
    fx.db.prepare('UPDATE nodes SET valid_from = ? WHERE id = ?').run(FIXED, fx.claimAId);

    // Taken BEFORE step 4, and again after (step 8): a supersession ADDS the
    // SUPERSEDES edge, so the after-count must be the before-count plus one,
    // never fewer. Asserting only "B still has edges" would pass even if the
    // CONTRADICTS edge were deleted and replaced -- the erasure-disguised-
    // as-supersession threat (T-348-07).
    const edgeCountBefore = edgeCountForNode(fx.db, fx.claimBId);

    let gateResult;
    ok('step 4: supersedeOnGateAnswer(oldNodeId:B, newNodeId:A, verdict:approve) returns ok:true', function () {
      gateResult = supersedeOnGateAnswer(fx.db, {
        oldNodeId: fx.claimBId,
        newNodeId: fx.claimAId,
        roomDir: fx.roomDir,
        verdict: GATE_VERDICT_APPROVE,
        now: () => FIXED,
      });
      assert.equal(gateResult.ok, true, 'gate refused the happy path: ' + JSON.stringify(gateResult));
    });

    ok('step 5: B is closed non-lossily, the SUPERSEDES edge lands, the audit event is logged', function () {
      const b = fx.db.prepare('SELECT review_status, invalidated_at, valid_to FROM nodes WHERE id = ?').get(fx.claimBId);
      assert.equal(b.review_status, 'superseded');
      assert.ok(Number.isFinite(b.invalidated_at), 'invalidated_at must be a finite number');
      const a = fx.db.prepare('SELECT valid_from FROM nodes WHERE id = ?').get(fx.claimAId);
      assert.equal(b.valid_to, a.valid_from, "B.valid_to must equal A's valid_from column value");
      const edge = fx.db.prepare("SELECT source, target FROM edges WHERE type = 'SUPERSEDES'").get();
      assert.ok(edge, 'no SUPERSEDES edge found');
      assert.equal(edge.source, fx.claimAId, 'SUPERSEDES edge must run A->B (new supersedes old)');
      assert.equal(edge.target, fx.claimBId);
      const event = fx.db.prepare(
        "SELECT properties FROM nodes WHERE type = 'memory_event' "
        + "AND json_extract(properties, '$.event_type') = 'status_superseded' "
        + "AND json_extract(properties, '$.target_node_id') = ? "
        + "ORDER BY created_at DESC LIMIT 1"
      ).get(fx.claimBId);
      assert.ok(event, 'no status_superseded memory_event found targeting B');
      const props = JSON.parse(event.properties);
      assert.equal(props.created_by, 'user', "the audit event's created_by must map to 'user'");
      assert.ok(
        typeof props.confirmed_by === 'string' && props.confirmed_by.length > 0,
        "the audit event's confirmed_by must carry the literal human identity"
      );
    });

    ok('step 6: findContradictions(db, claimAId) with no options excludes B once superseded', function () {
      const pairs = navigation.findContradictions(fx.db, fx.claimAId);
      const hitsB = pairs.filter(function (p) { return p.claimB.id === fx.claimBId || p.claimA.id === fx.claimBId; });
      assert.equal(hitsB.length, 0, 'a superseded claim must not surface by default');
    });

    ok('step 7: findContradictions(db, claimAId, { includeSuperseded: true }) still returns the pair', function () {
      const pairs = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: true });
      const hitsB = pairs.filter(function (p) { return p.claimB.id === fx.claimBId; });
      assert.equal(hitsB.length, 1, 'includeSuperseded:true must still surface the closed pair');
    });

    ok('step 8: the SUPERSEDES edge write means after-count is before-count plus one, never fewer', function () {
      const edgeCountAfter = edgeCountForNode(fx.db, fx.claimBId);
      assert.equal(edgeCountAfter, edgeCountBefore + 1, 'edge count on B must grow by exactly one');
    });

    ok('step 9: queryAsOf strictly before the supersession still returns B as live', function () {
      const bRow = fx.db.prepare('SELECT source_path FROM nodes WHERE id = ?').get(fx.claimBId);
      const asOf = queryAsOf(fx.db, bRow.source_path, FIXED - 1, FIXED - 1);
      assert.ok(asOf, 'queryAsOf returned nothing for B as-of a moment before the supersession');
      assert.equal(asOf.id, fx.claimBId);
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

// ---- Step 10: the negative leg -- a refusal never silently succeeds -----
// T-348-09 (Spoofing: a refusal that silently returns success). A
// non-approved verdict, on a FRESH poisoned-identity fixture (proving the
// refusal path holds even when USER.md carries an agent identity that
// resolveByUser would otherwise neutralize), must refuse and must leave the
// graph untouched. Assert the STATE, never only the return value: a stub
// that returned { ok:false } without actually refusing the write would pass
// a return-value-only check and fail this one.

(function stepTenNegativeLeg() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide', poisonedIdentity: true });
  try {
    ok('step 10: a non-approved verdict is refused; B unchanged, zero SUPERSEDES edges', function () {
      const before = supersedesEdgeCount(fx.db);
      const result = supersedeOnGateAnswer(fx.db, {
        oldNodeId: fx.claimBId,
        newNodeId: fx.claimAId,
        roomDir: fx.roomDir,
        verdict: GATE_VERDICT_REJECT,
      });
      assert.equal(result.ok, false, 'a non-approved verdict must never return ok:true');
      assert.equal(result.reason, 'gate_not_approved');
      const b = fx.db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(fx.claimBId);
      assert.equal(b.review_status, 'confirmed', 'B must remain confirmed, never silently closed');
      assert.equal(supersedesEdgeCount(fx.db), before, 'zero SUPERSEDES edges must be written on a refusal');
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

// ---- The direct-call negative leg: the chokepoint itself, not just the --
// gate wrapper. Proves the human-attribution guard (348-03's widened
// setsSuperseded predicate, WD-348-5) sits INSIDE transitions.cjs, reachable
// by any caller of supersede() directly, not only through the gate.

(function directCallNegativeLeg() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    ok('direct supersede(byUser: system) is refused with agent_attribution_forbidden', function () {
      const before = supersedesEdgeCount(fx.db);
      const result = supersede(fx.db, fx.claimBId, fx.claimAId, { byUser: 'system' });
      assert.equal(result.ok, false, 'an agent-attributed direct supersede must never succeed');
      assert.ok(
        String(result.reason || '').indexOf('agent_attribution_forbidden') !== -1,
        'expected a reason naming agent_attribution_forbidden, got: ' + JSON.stringify(result)
      );
      const b = fx.db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(fx.claimBId);
      assert.equal(b.review_status, 'confirmed');
      assert.equal(supersedesEdgeCount(fx.db), before);
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

// ---- The proposed leg: a claim nobody ever confirmed is not a stale fact -
// (Ruling 3 / D-05: TRANSITIONS stays byte-unchanged, confirmed->superseded
// is the only entry into superseded; a proposed rival routes through
// proposed->rejected instead, never a new proposed->superseded member.)

(function proposedLeg() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    ok('a claim C left at proposed cannot be superseded; the gate names proposed->rejected', function () {
      const cRes = writeClaimNode(fx.db, {
        knowledge_type: 'fact',
        text: 'Claim C is left proposed, never confirmed by any human.',
        sessionId: 'e2e-348',
        sourceSegment: 'claim-c',
      });
      assert.equal(cRes.ok, true, 'fixture setup: writing claim C failed: ' + cRes.reason);
      const cId = cRes.node_id;
      const cRow = fx.db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(cId);
      assert.equal(cRow.review_status, 'proposed', 'fixture setup: C must be proposed, never auto-confirmed');

      const result = supersedeOnGateAnswer(fx.db, {
        oldNodeId: cId,
        newNodeId: fx.claimAId,
        roomDir: fx.roomDir,
        verdict: GATE_VERDICT_APPROVE,
      });
      assert.equal(result.ok, false, 'a proposed old node must never be supersedable');
      assert.equal(result.reason, 'invalid_transition');
      assert.equal(result.alternative, 'proposed->rejected');
    });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}());

console.log('');
console.log(n + ' assertions passed');
console.log('>>> test-348-supersession-e2e.cjs: PASSED');
process.exit(0);
