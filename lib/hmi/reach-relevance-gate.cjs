'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * reach-sensor-relevance-gap B1 -- the structural relevance gate for the reach dial.
 * =============================================================================
 * Root cause B (proven in .planning/debug/resolved/reach-sensor-relevance-gap.md):
 * the reach-dial render seam had NO structural check that a candidate reach is
 * actually relevant to the live conversation. `cross_room` is a permanent
 * registry_only member of the 6-reach bank (dial-reach-orchestrator REACH_DEFS,
 * default 0.5), so in a cold/tier_0 room it is always offered; its {room_name}/
 * {topic} slots were filled from the CURRENT room and the top graph node, never
 * compared to the live turn -- so it surfaced a topically-disconnected room+claim
 * (the observed "Borrow what iris2026 learned about claim:derive:5c15cde4" case
 * during an unrelated Windows-update conversation). Relevance was delegated
 * entirely to advisory model text.
 *
 * THIS MODULE is the machine-enforced relevance check. It is PURE + synchronous:
 * given the live turn text and the resolved slot content, it returns the set of
 * reach_ids to SUPPRESS. The caller (renderEngineDecisionWithDial) merges that set
 * into the existing suppressedReachIds drop path that buildReachList already
 * honors -- so the render SEAM stays pure (buildReachList does the drop; this
 * module never touches the reach bank, the frozen 0.70/0.15 gate, or renderDial).
 *
 * SCOPE (the "starting with cross_room" scope from the approved fix decision):
 * only the CROSS-ROOM class of reach is turn-relevance-gated. A within-room reach
 * (context_block / contradiction / hats / deep_research / brain_consult) operates
 * on the CURRENT room's own content and its {topic} is the room's own focus node,
 * so "off-topic to this one turn" does NOT make it irrelevant -- suppressing it
 * would be over-enforcement. cross_room is the one reach whose entire value is
 * reaching into a DIFFERENT room, so it is relevant ONLY when that different room
 * relates to what is being discussed. RELEVANCE_GATED_REACHES is the extension
 * point if a future cross-room-class reach is minted.
 *
 * NO-OP CONTRACT: when there is no live turn text (empty), the gate returns [] --
 * byte-identical to the pre-B1 render (the classifier always has a live turn in
 * production; a unit test that drives the render seam without a turn is unchanged).
 *
 * Canon Part 8: LOCAL-only. Zero Brain calls, zero network, zero fs, zero db.
 * Pure CJS, node built-ins only, zero deps. No em-dashes. Hyphens only.
 *
 * Public API:
 *   computeOffTopicReachIds({ slotContext, liveTurnText, currentRoomName }) -> string[]
 *   RELEVANCE_GATED_REACHES
 *
 * License: BSL 1.1.
 */

// The reach classes whose relevance genuinely depends on the live-turn topic.
// Only cross_room today: the one reach that reaches into a DIFFERENT room.
const RELEVANCE_GATED_REACHES = Object.freeze(['cross_room']);

// Local stopword set (mirrors scripts/intent-classifier.cjs tokenize so the gate
// tokenizes the live turn the same way the room scorer does -- no shared import to
// keep this module dependency-free and pure).
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at',
  'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
]);

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const rough = text.toLowerCase().split(/[^a-z0-9]+/);
  const out = [];
  for (const t of rough) {
    if (!t) continue;
    if (t.length < 2) continue;
    if (STOP_WORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

// Any single shared token counts as topical overlap (a deliberately LOW floor:
// the goal is to drop the ZERO-overlap off-topic case the bug produced, not to
// second-guess a genuinely related reach).
function hasOverlap(liveTokenSet, contentTokens) {
  for (const t of contentTokens) {
    if (liveTokenSet.has(t)) return true;
  }
  return false;
}

/**
 * computeOffTopicReachIds({ slotContext, liveTurnText, currentRoomName }) -> string[]
 *
 * slotContext:     the resolved dial slot map (buildDialSlotContext output). For
 *                  cross_room the relevant slots are `room_name` (the resolved
 *                  cross-room TARGET room) and `topic`.
 * liveTurnText:    the current user turn (STDIN_MESSAGE on the live hook).
 * currentRoomName: the current room's basename, used to catch borrow-from-self.
 *
 * Returns the reach_ids to suppress. Never throws (a malformed input yields []).
 */
function computeOffTopicReachIds(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const slotContext = (a.slotContext && typeof a.slotContext === 'object') ? a.slotContext : {};
    const liveTurnText = (typeof a.liveTurnText === 'string') ? a.liveTurnText : '';
    const currentRoomName = (typeof a.currentRoomName === 'string' && a.currentRoomName.length > 0)
      ? a.currentRoomName
      : null;

    const liveTokens = new Set(tokenize(liveTurnText));
    // No live turn -> no basis to judge relevance -> no-op (NO-OP CONTRACT above).
    if (liveTokens.size === 0) return [];

    const suppressed = [];
    for (const reachId of RELEVANCE_GATED_REACHES) {
      if (reachId === 'cross_room') {
        const room = (typeof slotContext.room_name === 'string') ? slotContext.room_name.trim() : '';
        // No genuinely different target room was resolved -> cross_room has nowhere
        // to reach -> suppress (this is the cold-room case that produced the bug;
        // buildDialSlotContext no longer borrows the current room into room_name).
        if (room.length === 0) { suppressed.push(reachId); continue; }
        // Borrow-from-self guard: a target equal to the current room is not a
        // cross-room reach at all.
        if (currentRoomName && room.toLowerCase() === currentRoomName.toLowerCase()) {
          suppressed.push(reachId);
          continue;
        }
        // Off-topic: the target room name + topic share ZERO tokens with the live
        // turn -> the navigator is not talking about anything that room covers.
        const topic = (typeof slotContext.topic === 'string') ? slotContext.topic : '';
        const contentTokens = tokenize(room + ' ' + topic);
        if (!hasOverlap(liveTokens, contentTokens)) {
          suppressed.push(reachId);
        }
      }
    }
    return suppressed;
  } catch (_e) {
    // Fail-open: a gate fault never blocks or distorts the render (it degrades to
    // the pre-B1 no-suppression behavior).
    return [];
  }
}

module.exports = {
  computeOffTopicReachIds: computeOffTopicReachIds,
  RELEVANCE_GATED_REACHES: RELEVANCE_GATED_REACHES,
  // Exposed for direct unit testing (never buried as closures).
  _test: Object.freeze({
    tokenize: tokenize,
    hasOverlap: hasOverlap,
  }),
};
