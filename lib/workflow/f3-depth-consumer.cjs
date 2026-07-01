'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-04 (SFS-08) -- consumeF3DepthPick: the F.3 depth-pick shared-core
 * consumer. Clones the f1-pick-consumer.cjs STRUCTURE (validate -> deterministic
 * resolve -> delegate the write over the caller-supplied roomState) MINUS the
 * reach/outcome/edge channel -- F.3 is a single closed depth scalar. On a
 * captured depth pick it calls depth-state.setCurrent over the caller-supplied
 * room, then signals RE-ENTRY to the calling command.
 *
 * The consumer SETS state and RE-ENTERS; it does NOT itself pick the canonical
 * verb that follows F.3 (SKILL.md:175 -- the calling command chooses that verb).
 *
 * Canon binding:
 *   Part 3: degrade-never-block. A cold / absent / unmatched / malformed turn
 *           is a structured no-op ({ ok:false, reason }); nothing throws.
 *   Part 8: only the closed depth enum crosses into per-room state. Raw text
 *           stays on the LOCAL sentence lane at the capture adapter.
 *   Part 9: this module NEVER opens room.db. Per-room depth is JSON state (the
 *           local mind), written via depth-state's atomic writer. There is NO
 *           better-sqlite3 / node:sqlite require here. The caller owns any db
 *           handle (roomState.db); typed-edge writes (none here) would route
 *           through lib/core/navigation.cjs, never from this consumer.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). No em-dashes.
 *
 * API: consumeF3DepthPick({ pick, roomState }) -> { ok, reenter?, depth?, reason? }
 */

const path = require('node:path');

function _safeRequire(p) {
  try { return require(p); } catch (_e) { return null; }
}

// ---------------------------------------------------------------------------
// consumeF3DepthPick({ pick, roomState })
//
// pick:      the captured F.3 pick. Either { depth } (the capture adapter shape)
//            or a bare depth string. A { back:true } pick is a no-op (return to
//            the previous shape; no state write).
// roomState: the caller-owned room state. roomState.roomDir MUST be populated by
//            the caller; the consumer opens NO room.db (Part 9).
//
// Returns { ok:true, reenter:true, depth } on a written pick; a structured
// no-op ({ ok:false, reason }) on any cold / unmatched / malformed turn.
// ---------------------------------------------------------------------------
function consumeF3DepthPick(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const roomState = (a.roomState && typeof a.roomState === 'object') ? a.roomState : {};
  const roomDir = (typeof roomState.roomDir === 'string' && roomState.roomDir.length > 0)
    ? roomState.roomDir : null;
  if (roomDir === null) {
    return { ok: false, reason: 'no_room_dir' };
  }

  // Resolve the depth from the captured pick (deterministic; no fuzzy NLP).
  const pick = a.pick;
  if (pick && typeof pick === 'object' && pick.back === true) {
    // Back control: return to the previous shape, no state write.
    return { ok: false, reason: 'back' };
  }
  let depth = null;
  if (pick && typeof pick === 'object') {
    depth = (typeof pick.depth === 'string' && pick.depth.length > 0) ? pick.depth : null;
  } else if (typeof pick === 'string' && pick.length > 0) {
    depth = pick;
  }
  if (depth === null) {
    return { ok: false, reason: 'unmatched' };
  }

  // Lazy + tolerant require of the state module (a load failure degrades to a
  // no-op rather than crashing the turn).
  const depthState = _safeRequire(path.join(__dirname, '..', 'hmi', 'depth-state.cjs'));
  if (!depthState || typeof depthState.setCurrent !== 'function') {
    return { ok: false, reason: 'depth_state_unavailable' };
  }

  // The state module enforces the closed axis; an out-of-axis value returns null.
  let written;
  try {
    written = depthState.setCurrent(roomDir, depth);
  } catch (_e) {
    return { ok: false, reason: 'state_write_threw' };
  }
  if (!written || typeof written.depth !== 'string') {
    return { ok: false, reason: 'unmatched' };
  }

  // SET state -> RE-ENTER the calling command (which owns the following verb).
  return { ok: true, reenter: true, depth: written.depth };
}

module.exports = {
  consumeF3DepthPick: consumeF3DepthPick,
};
