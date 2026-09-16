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

const GATE_VERDICT_APPROVE = 'approve';

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
  'reified_shape_out_of_scope',
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

// _checkEndpointsAndShape(db, oldNodeId, newNodeId) -- Task 2 (D-08 / D-04,
// SUPER-19) fills this body in. Task 1 leaves it a no-op so the ordering
// below is fixed before the check's own body lands, per 348-07-PLAN.md's
// own instruction: "leave a clearly named private helper call here so task
// 2 fills it rather than restructuring the flow."
function _checkEndpointsAndShape(_db, _oldNodeId, _newNodeId) {
  return null;
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

    // Step 2: endpoint + shape validation (Task 2's own body, D-08 / D-04).
    const shapeRefusal = _checkEndpointsAndShape(db, oldNodeId, newNodeId);
    if (shapeRefusal) return shapeRefusal;

    // Step 3: identity resolution. params.byUser is NEVER read (SUPER-03).
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

    // Step 4: the proposed pre-check. The reason token is copied VERBATIM
    // from lib/core/navigation/transitions.cjs's own closed TRANSITIONS
    // set ('invalid_transition') and must stay identical to it -- a
    // renamed reason would break every caller that switches on it. Only
    // the `alternative` key is this module's own addition.
    let oldStatusRow;
    try {
      oldStatusRow = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(oldNodeId);
    } catch (_e) {
      oldStatusRow = null;
    }
    if (oldStatusRow && oldStatusRow.review_status === 'proposed') {
      return { ok: false, reason: 'invalid_transition', alternative: 'proposed->rejected' };
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
