'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-04 (SFS-09) -- consumeF4ScopePick: the F.4 scope-pick shared-core
 * consumer. Mirrors the F.3 depth consumer (validate -> deterministic resolve ->
 * delegate the write over the caller-supplied roomState) but with F.4's
 * load-bearing property: each rung ACCUMULATES onto the prior scope via
 * harvest-scope-state.addScope (not a replace). 'Create artifact draft' hands
 * the accumulated scope to the synthesis path; every pick re-enters the caller.
 *
 * The consumer SETS state and RE-ENTERS the calling command; it does NOT itself
 * pick the canonical verb (F.4 wraps Synthesize; the calling command owns it).
 *
 * Canon binding:
 *   Part 3: degrade-never-block. A cold / absent / unmatched / malformed turn is
 *           a structured no-op ({ ok:false, reason }); nothing throws.
 *   Part 8: only the closed scope-rung enum crosses into per-room state. Raw text
 *           stays on the LOCAL sentence lane at the capture adapter.
 *   Part 9: this module NEVER opens room.db. Per-room scope is JSON state (the
 *           local mind), written via harvest-scope-state's atomic writer. NO
 *           better-sqlite3 / node:sqlite require here. The caller owns any db
 *           handle (roomState.db); typed-edge writes (none here) route through
 *           lib/core/navigation.cjs, never from this consumer.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). No em-dashes.
 *
 * API: consumeF4ScopePick({ pick, roomState })
 *        -> { ok, reenter?, synthesize?, scope?, reason? }
 */

const path = require('node:path');

function _safeRequire(p) {
  try { return require(p); } catch (_e) { return null; }
}

// ---------------------------------------------------------------------------
// consumeF4ScopePick({ pick, roomState })
//
// pick:      the captured F.4 pick. Either { scope } (a ladder rung), a bare
//            rung string, { terminal:true } (Create artifact draft), or
//            { back:true } (return to the previous shape; no state write).
// roomState: the caller-owned room state. roomState.roomDir MUST be populated by
//            the caller; the consumer opens NO room.db (Part 9).
//
// A rung pick ACCUMULATES the scope and re-enters ({ ok:true, reenter:true }).
// The terminal 'Create artifact draft' hands the accumulated scope to synthesis
// ({ ok:true, synthesize:true, scope }). Everything else is a structured no-op.
// ---------------------------------------------------------------------------
function consumeF4ScopePick(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const roomState = (a.roomState && typeof a.roomState === 'object') ? a.roomState : {};
  const roomDir = (typeof roomState.roomDir === 'string' && roomState.roomDir.length > 0)
    ? roomState.roomDir : null;
  if (roomDir === null) {
    return { ok: false, reason: 'no_room_dir' };
  }

  const pick = a.pick;

  // Control picks first (no rung).
  if (pick && typeof pick === 'object' && pick.back === true) {
    return { ok: false, reason: 'back' };
  }

  const scopeState = _safeRequire(path.join(__dirname, '..', 'hmi', 'harvest-scope-state.cjs'));
  if (!scopeState || typeof scopeState.addScope !== 'function' || typeof scopeState.getScope !== 'function') {
    return { ok: false, reason: 'scope_state_unavailable' };
  }

  // Terminal: hand the ACCUMULATED scope to the synthesis path, re-enter caller.
  if (pick && typeof pick === 'object' && pick.terminal === true) {
    let accumulated;
    try {
      accumulated = scopeState.getScope(roomDir);
    } catch (_e) {
      return { ok: false, reason: 'state_read_threw' };
    }
    return { ok: true, synthesize: true, reenter: true, scope: accumulated };
  }

  // Resolve the rung from the captured pick (deterministic; no fuzzy NLP).
  let rung = null;
  if (pick && typeof pick === 'object') {
    rung = (typeof pick.scope === 'string' && pick.scope.length > 0) ? pick.scope : null;
  } else if (typeof pick === 'string' && pick.length > 0) {
    rung = pick;
  }
  if (rung === null) {
    return { ok: false, reason: 'unmatched' };
  }

  // ACCUMULATE the rung onto the prior scope (the load-bearing F.4 property).
  let nextScope;
  try {
    nextScope = scopeState.addScope(roomDir, rung);
  } catch (_e) {
    return { ok: false, reason: 'state_write_threw' };
  }
  // An out-of-ladder rung is dropped by addScope: detect a no-op via membership.
  if (!Array.isArray(nextScope) || nextScope.indexOf(rung) === -1) {
    return { ok: false, reason: 'unmatched' };
  }

  // SET state -> RE-ENTER the calling command (which owns the Synthesize verb).
  return { ok: true, reenter: true, scope: nextScope };
}

module.exports = {
  consumeF4ScopePick: consumeF4ScopePick,
};
