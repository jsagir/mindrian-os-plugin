/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 121.5-08 (Sub-plan J) -- /mos:mos state-aware router.
 *
 * D-10 LOCKED: /mos:mos picks the right surface based on the navigator's
 * current room state. The user types /mos:mos and the router meets them
 * where they are.
 *
 *   No room exists                           -> /mos:onboard
 *   Room exists but mostly empty             -> /mos:status (+ suggest next move)
 *     ("mostly empty" = sectionsCount == 0 OR stage matches /Pre-Opportunity/i)
 *   Room populated (sections >= 1, stage past Pre-Opportunity)
 *                                            -> /mos:suggest-next
 *
 * The router is a PURE function. Reading STATE.md / the registry is done
 * upstream by commands/mos.md; the router operates on the resolved
 * roomState object only. This keeps the routing logic hermetic and
 * unit-testable without any fs / spawn.
 *
 * Canon Part 3: /mos:mos is itself a Decision Gate at the meta level --
 * the router writes a typed (navigator) -[ROUTED_VIA {target, reason}]->
 * (next-surface) edge upstream when the routing decision is committed
 * by commands/mos.md. The router function here only RESOLVES the target;
 * edge emission is the caller's responsibility.
 *
 * Canon Part 7: ONE function replaces the prior "pick the right /mos:*
 * surface for me" mental load on the user. NO new command behaviors
 * are added -- /mos:mos delegates to /mos:onboard / /mos:status /
 * /mos:suggest-next which already exist.
 *
 * Canon Part 8: zero Brain calls, zero network, zero side-channel writes.
 */
'use strict';

/**
 * Resolve which canonical surface to route to given the current room state.
 *
 * @param {{
 *   roomState?: {
 *     exists?: boolean,            // does the room directory exist?
 *     sectionsCount?: number,      // how many section folders are populated?
 *     stage?: string,              // venture stage from STATE.md (or empty)
 *   }
 * }} opts
 * @returns {{
 *   route: string,                 // '/mos:onboard' | '/mos:status' | '/mos:suggest-next'
 *   reason: string,                // 'no_room' | 'mostly_empty' | 'populated'
 *   addendum: string | null,       // optional follow-on hint (e.g. 'suggest next move')
 * }}
 */
function resolveNextSurface(opts) {
  const rs = (opts && opts.roomState) || {};

  // Branch 1: no room exists at all -- the new navigator path.
  if (!rs.exists) {
    return { route: '/mos:onboard', reason: 'no_room', addendum: null };
  }

  // Branch 2: room exists but is mostly empty. Two signals:
  //   (a) sectionsCount == 0 -- the navigator has not populated any section.
  //   (b) stage matches Pre-Opportunity (case-insensitive) -- the venture
  //       has not even crossed the Opportunity threshold yet.
  // Either signal routes to /mos:status with a next-move addendum.
  const sections = typeof rs.sectionsCount === 'number' ? rs.sectionsCount : 0;
  const stage = typeof rs.stage === 'string' ? rs.stage : '';
  if (sections === 0 || /Pre-Opportunity/i.test(stage)) {
    return {
      route: '/mos:status',
      reason: 'mostly_empty',
      addendum: 'suggest next move',
    };
  }

  // Branch 3: room is populated -- the navigator wants the next move.
  return { route: '/mos:suggest-next', reason: 'populated', addendum: null };
}

module.exports = { resolveNextSurface };
