'use strict';
/*
 * lib/core/temporal/supersession-gate.cjs -- Phase 348-07 (SUPER-17). The
 * wire between a human-approved gate answer on a surfaced contradiction and
 * the shipped supersession mechanism (lib/core/temporal/supersession.cjs).
 *
 * ONE DOOR (SUPER-01, Canon Part 7): this module makes exactly one call to
 * supersede() and returns its result VERBATIM. It is not a second
 * supersession writer; it is the caller that finally exercises the one
 * writer that has shipped since Phase 160-04 with zero live invokers.
 *
 * WHY THIS IS NOT ON navigation.cjs'S RE-EXPORT SURFACE (348-RESEARCH.md
 * Finding 8, the require cycle): supersession.cjs:33 already requires
 * ../navigation.cjs. Adding this module to navigation.cjs's own re-export
 * list would close the loop navigation.cjs -> supersession-gate.cjs ->
 * supersession.cjs -> navigation.cjs. lib/core/close-loop-writer.cjs sets
 * the precedent this module follows instead: require ../navigation.cjs and
 * ./supersession.cjs directly, never through the chokepoint's own
 * re-export surface.
 *
 * CALLER-OWNED HANDLE (supersession.cjs:18-23's own contract, held here
 * too): db is a handle the caller opened through room-db.cjs::openRoomDb.
 * This module never requires node:sqlite and never opens room.db itself.
 *
 * NOT A REGISTERED INVOCABLE SURFACE (WD-348-3): no MCP tool, no command,
 * no agent, no pipeline, no hook registers this function in this phase.
 * D-01/D-02 leave the trigger to Phase 350, which registers this module
 * together with the writer that feeds it. A registered surface with no
 * live trigger would be a Part 11 declaration for a fork nothing can
 * reach.
 *
 * params.byUser IS DELIBERATELY IGNORED (SUPER-03, T-348-31): the human
 * identity comes ONLY from resolveByUser(params.roomDir), reading the
 * room's own USER.md. A caller (poisoned or malicious) cannot choose its
 * own attribution by passing byUser -- that property is never read off
 * the params object. An unresolvable roomDir is a refusal, never a
 * default identity guess.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const navigation = require('../navigation.cjs');
const { supersede } = require('./supersession.cjs');
// Task 2 (D-08 / SUPER-19). Read live, never re-typed: the module-load
// self-check right below fails LOUDLY if a future edges.cjs edit ever
// drops CONTRADICTS from the frozen allow-list, mirroring the
// lib/core/navigation/insights.cjs SUPPORT_EDGE_TYPES self-check idiom
// (insights.cjs:253-262) verbatim.
const { ALLOWED_EDGE_TYPES } = require('../navigation/edges.cjs');

const GATE_VERDICT_APPROVE = 'approve';
const CONTRADICTS_EDGE_TYPE = 'CONTRADICTS';

if (!ALLOWED_EDGE_TYPES.has(CONTRADICTS_EDGE_TYPE)) {
  throw new Error(
    'lib/core/temporal/supersession-gate.cjs: ' + CONTRADICTS_EDGE_TYPE
    + ' is no longer a member of ALLOWED_EDGE_TYPES (lib/core/navigation/edges.cjs). '
    + 'This gate reads that allow-list LIVE at require time and refuses to guess.'
  );
}

// The D-04 reified-shape skip reason. Kept as a literal constant here
// (not re-exported from lib/core/navigation/insights.cjs) so this task
// stays inside its own declared files_modified. The two tokens are kept
// from drifting by construction of this literal matching insights.cjs's
// own REIFIED_SHAPE_SKIP_REASON literal exactly, and by this file's own
// acceptance check + this test file's task 2 assertion, both of which
// read BOTH source files and would fail loudly on a rename either side.
const REIFIED_SHAPE_SKIP_REASON = 'reified_shape_out_of_scope';

// The closed set of refusal reasons THIS module can emit. supersede()'s own
// failure reasons (unknown_new_node, cannot_supersede_self,
// agent_attribution_forbidden, edge_write_failed:..., etc.) pass through
// verbatim on the happy path and are a DIFFERENT module's closed
// vocabulary -- they are not members of this set.
const GATE_REFUSAL_REASONS = Object.freeze([
  'gate_not_approved',
  'invalid_params',
  'unknown_node',
  'missing_contradicts_edge',
  'unvalidated_edge_endpoints',
  REIFIED_SHAPE_SKIP_REASON,
  'invalid_transition',
  'unresolvable_identity',
  'gate_fault',
]);

// safeGet -- a throwing getter on a hostile params object stays LOCAL to
// the one property read instead of collapsing the whole call (T-348-38).
function safeGet(obj, key) {
  try { return obj[key]; } catch (_e) { return undefined; }
}

function isPlainObject(v) {
  try {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  } catch (_e) {
    return false;
  }
}

// _checkEndpointsAndShape(db, oldNodeId, newNodeId) -- the D-08 defensive
// endpoint-existence check and the D-04 reified-shape guard (Task 2,
// SUPER-19). Returns null when the pair is legal to act on, or a
// { ok:false, reason } refusal object naming exactly why not. Runs BEFORE
// any write.
//
// D-08 scope, stated here rather than assumed: the Phase 347 edge-
// chokepoint bypass (raw INSERT INTO edges at lib/core/graph-ops.cjs:196,
// 250,262 and in scripts/build-ecosystem-graph.cjs) is still open and this
// phase does NOT close it. lib/core/navigation/CONTEXT.md declares a
// dangling edge endpoint LEGAL, not a defect, at the folder-contract
// level. The measured hazard (348-RESEARCH.md Open Question 6) is that a
// bypassed writer makes an unvalidated edge APPEAR -- and findContradictions
// reads the edges table directly, so it would see such a row. This check
// refuses to let an unvalidated edge drive a truth-state change; it does
// not attempt to close the bypass itself.
//
// Order, each step named, each returning before any write:
//   1. Look up ANY edge between the exact (oldNodeId, newNodeId) pair, in
//      either direction, BEFORE checking node existence. A bypass-written
//      edge can name ids the fixture never minted as node rows at all
//      (the dangling-endpoint case D-08 names as fleet-legal), and that
//      edge's own presence is what distinguishes "nothing to act on"
//      (unknown_node) from "something to act on, but it fails validation"
//      (unvalidated_edge_endpoints).
//   2. If a CONTRADICTS-typed edge links the pair: its own endpoints must
//      ALSO resolve to real `nodes` rows (a dangling endpoint refuses
//      unvalidated_edge_endpoints), and neither endpoint's node type may
//      equal the reified ContradictionEvent label (read live off
//      navigation.REIFIED_EVENT_TYPES, never re-typed) -- refuses
//      reified_shape_out_of_scope, D-03/D-04's scope line.
//   3. If no CONTRADICTS-typed edge links the pair: both node ids
//      resolving to real rows but no edge at all is missing_contradicts_edge
//      (the gate consequence acts on a surfaced contradiction; without one
//      there is nothing to approve). Either id missing, with nothing else
//      to act on, is unknown_node. Both real but the ONLY edge(s) present
//      never passed writeEdge's own ALLOWED_EDGE_TYPES gate is
//      unvalidated_edge_endpoints (the bypass-writer case, simulated in
//      the test with a direct insert into a throwaway fixture).
function _checkEndpointsAndShape(db, oldNodeId, newNodeId) {
  if (typeof oldNodeId !== 'string' || oldNodeId.length === 0) {
    return { ok: false, reason: 'unknown_node' };
  }
  if (typeof newNodeId !== 'string' || newNodeId.length === 0) {
    return { ok: false, reason: 'unknown_node' };
  }

  let edgeRows;
  try {
    edgeRows = db.prepare(
      'SELECT source, target, type FROM edges WHERE '
      + '(source = ? AND target = ?) OR (source = ? AND target = ?)'
    ).all(oldNodeId, newNodeId, newNodeId, oldNodeId);
  } catch (_e) {
    edgeRows = [];
  }
  if (!Array.isArray(edgeRows)) edgeRows = [];

  const contradictsEdge = edgeRows.find(function (r) { return r && r.type === CONTRADICTS_EDGE_TYPE; });

  let oldRow;
  let newRow;
  try {
    oldRow = db.prepare('SELECT id, type FROM nodes WHERE id = ?').get(oldNodeId);
    newRow = db.prepare('SELECT id, type FROM nodes WHERE id = ?').get(newNodeId);
  } catch (_e) {
    oldRow = null;
    newRow = null;
  }

  if (contradictsEdge) {
    // A CONTRADICTS edge nominally links these two ids. Its own recorded
    // endpoints must ALSO resolve to real node rows: a dangling endpoint
    // is legal at the folder-contract level but cannot drive a
    // truth-state change.
    if (!oldRow || !newRow) {
      return { ok: false, reason: 'unvalidated_edge_endpoints' };
    }
    const reifiedLabel = navigation.REIFIED_EVENT_TYPES
      && navigation.REIFIED_EVENT_TYPES.ContradictionEvent
      && navigation.REIFIED_EVENT_TYPES.ContradictionEvent.label;
    if (reifiedLabel && (oldRow.type === reifiedLabel || newRow.type === reifiedLabel)) {
      return { ok: false, reason: REIFIED_SHAPE_SKIP_REASON };
    }
    return null;
  }

  // No CONTRADICTS-typed edge links this exact pair.
  if (!oldRow || !newRow) {
    return { ok: false, reason: 'unknown_node' };
  }
  // Both nodes are real, but the only edge(s) between them (if any) never
  // passed writeEdge's own ALLOWED_EDGE_TYPES gate -- the Phase 347
  // raw-INSERT bypass this phase does not close (D-08).
  const bypassEdge = edgeRows.find(function (r) { return r && !ALLOWED_EDGE_TYPES.has(r.type); });
  if (bypassEdge) {
    return { ok: false, reason: 'unvalidated_edge_endpoints' };
  }
  return { ok: false, reason: 'missing_contradicts_edge' };
}

/**
 * supersedeOnGateAnswer(db, params) -- the pure function this module ships.
 * See tests/test-348-supersession-e2e.cjs's own header for the contract
 * this implements against verbatim (fixed in 348-02, not redesigned here).
 *
 * @param {import('node:sqlite').DatabaseSync} db  caller-owned room.db handle
 * @param {{oldNodeId:string,newNodeId:string,roomDir:string,verdict:string,
 *   now?:function,readVersion?:*,room?:string,home?:string,sessionId?:string}} params
 * @returns {{ok:true,...} | {ok:false,reason:string,alternative?:string}}
 */
function supersedeOnGateAnswer(db, params) {
  try {
    const p = isPlainObject(params) ? params : null;
    if (!p) {
      return { ok: false, reason: 'invalid_params' };
    }

    // Step 1: verdict check, BEFORE any read. Refusing here costs no
    // database access, the cheapest correct place to refuse.
    const verdict = safeGet(p, 'verdict');
    if (verdict !== GATE_VERDICT_APPROVE) {
      return { ok: false, reason: 'gate_not_approved' };
    }

    const oldNodeId = safeGet(p, 'oldNodeId');
    const newNodeId = safeGet(p, 'newNodeId');

    // Step 2: the proposed pre-check, BEFORE the D-08 shape check. A claim
    // nobody ever confirmed was never a believed fact, so refusing it is a
    // fact about the OLD node alone (Ruling 3 / D-05) -- it must fire even
    // when no CONTRADICTS edge exists yet to justify the supersession the
    // caller is attempting, which is exactly what
    // tests/test-348-supersession-e2e.cjs's own "proposed leg" proves (a
    // proposed C with zero edges still reaches invalid_transition, never
    // missing_contradicts_edge). The reason token is copied VERBATIM from
    // lib/core/navigation/transitions.cjs's own closed TRANSITIONS set
    // ('invalid_transition') and must stay identical to it -- a renamed
    // reason would break every caller that switches on it. Only the
    // `alternative` key is this module's own addition. A missing/unknown
    // oldNodeId simply fails this lookup and falls through to the shape
    // check below, which owns unknown_node.
    let oldStatusRow;
    try {
      oldStatusRow = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(oldNodeId);
    } catch (_e) {
      oldStatusRow = null;
    }
    if (oldStatusRow && oldStatusRow.review_status === 'proposed') {
      return { ok: false, reason: 'invalid_transition', alternative: 'proposed->rejected' };
    }

    // Step 3: endpoint + shape validation (Task 2's own body, D-08 / D-04).
    const shapeRefusal = _checkEndpointsAndShape(db, oldNodeId, newNodeId);
    if (shapeRefusal) return shapeRefusal;

    // Step 4: identity resolution. params.byUser is NEVER read (SUPER-03).
    const roomDir = safeGet(p, 'roomDir');
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { ok: false, reason: 'unresolvable_identity' };
    }
    let resolvedByUser;
    try {
      resolvedByUser = navigation.resolveByUser(roomDir);
    } catch (_e) {
      resolvedByUser = null;
    }
    if (typeof resolvedByUser !== 'string' || resolvedByUser.length === 0) {
      return { ok: false, reason: 'unresolvable_identity' };
    }

    // Step 5: the one call to supersede(), unmodified. Returned VERBATIM:
    // no wrapping, no re-keying, no converting a falsy ok into anything
    // else.
    return supersede(db, oldNodeId, newNodeId, {
      byUser: resolvedByUser,
      now: safeGet(p, 'now'),
      readVersion: safeGet(p, 'readVersion'),
      roomDir: roomDir,
      room: safeGet(p, 'room'),
      home: safeGet(p, 'home'),
      sessionId: safeGet(p, 'sessionId'),
    });
  } catch (_e) {
    return { ok: false, reason: 'gate_fault' };
  }
}

module.exports = { supersedeOnGateAnswer, GATE_REFUSAL_REASONS };
