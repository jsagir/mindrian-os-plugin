'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-03 Task 1 -- recency-decay: the APP-SIDE decay blend (R5 / D-03).
 * ===========================================================================
 *
 * D-03 (160-CONTEXT.md). Recency decay is computed APP-SIDE in JS AFTER a
 * recency-ordered SQL fetch (SELECT the date columns + ORDER BY created_at DESC,
 * then blend the Generative-Agents 0.995^(delta-hours) score here). The decay
 * constant is a VISIBLE named export (DECAY_BASE) so the Leg D hot-path ranking
 * is frozen-testable -- a decay constant buried in a SQL string cannot be
 * frozen-tested. This module is the "name your analog" reuse of the Generative
 * Agents (Park et al. 2023) recency-retrieval decay, expressed in plain CJS.
 *
 * Anchoring: deltaHours = (referenceMs - createdAtMs) / 3600000, where referenceMs
 * is the authoritative reference clock from getReferenceNow() (Phase 160-01). The
 * caller passes referenceMs in; this module makes NO clock read of its own, so it
 * stays a pure deterministic function (the determinism the golden-file guard
 * depends on).
 *
 * Part 8 (LOCAL -> BRAIN: NO): this is a pure in-process numeric function over
 * LOCAL date scalars. Zero network, zero filesystem, zero Brain surface. It
 * carries no node content -- only epoch-ms scalars and a stable id tiebreak.
 *
 * Pure / sync / zero-I/O. node built-ins only, zero new runtime dependencies.
 * House rule: hyphens only, no em-dashes.
 */

// The visible Generative-Agents recency decay constant (Park et al. 2023). D-03
// requires this live as a named export so the Leg D ranking stays frozen-testable.
const DECAY_BASE = 0.995;

const MS_PER_HOUR = 60 * 60 * 1000;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * recencyScore(createdAtMs, referenceMs) -> DECAY_BASE ^ deltaHours.
 *
 * deltaHours = max(0, (referenceMs - createdAtMs) / MS_PER_HOUR). The max(0, ..)
 * clamp means a future-dated node (local clock skew, restored backup) is treated
 * as zero-age and scores 1 -- never > 1. Monotonic decreasing with age: a more
 * recent node always scores strictly higher than an older one.
 *
 * Degrades to 0 (never throws) on any non-finite input, so a malformed row
 * sinks to the bottom of the ranking rather than poisoning the sort.
 *
 * @param {number} createdAtMs epoch ms the node was created/last-seen
 * @param {number} referenceMs the authoritative reference clock (getReferenceNow)
 * @returns {number} the decay score in (0, 1]
 */
function recencyScore(createdAtMs, referenceMs) {
  if (!isFiniteNumber(createdAtMs) || !isFiniteNumber(referenceMs)) return 0;
  let deltaHours = (referenceMs - createdAtMs) / MS_PER_HOUR;
  if (deltaHours < 0) deltaHours = 0; // clamp future-dated nodes to zero age
  const score = Math.pow(DECAY_BASE, deltaHours);
  return Number.isFinite(score) ? score : 0;
}

/**
 * Pick the recency anchor epoch-ms off a node row. Prefers created_at, falls
 * back to last_seen_at (the Leg D projection SELECTs both). Returns null when
 * neither is a finite number, so the node sorts last.
 */
function nodeAnchorMs(node) {
  if (!node || typeof node !== 'object') return null;
  if (isFiniteNumber(node.created_at)) return node.created_at;
  if (isFiniteNumber(node.last_seen_at)) return node.last_seen_at;
  return null;
}

/**
 * Stable id-key for the deterministic tiebreak. Equal-score rows MUST keep a
 * fixed ascending-id order so the golden-file guard byte-matches regardless of
 * the input row order. A missing/non-string id sorts as '' (still deterministic).
 */
function idKey(node) {
  return node && typeof node.id === 'string' ? node.id : '';
}

/**
 * rankByRecency(nodes, referenceMs) -> a NEW array sorted by recency score
 * DESCENDING (more-recent-first), with a stable ascending-id tiebreak on equal
 * scores (the determinism the D-03 golden-file guard depends on).
 *
 * Never mutates the caller's array (returns a fresh sorted copy). Degrades to []
 * on non-array input; never throws.
 *
 * @param {Array<object>} nodes  rows carrying created_at / last_seen_at + id
 * @param {number} referenceMs   the authoritative reference clock
 * @returns {Array<object>} a fresh array, recency-ranked + id-stable
 */
function rankByRecency(nodes, referenceMs) {
  if (!Array.isArray(nodes)) return [];
  // Decorate once so the score is computed a single time per node (stable +
  // O(n log n) on the tiny cortex set, the D-03 perf rationale), then sort the
  // decorated copy and strip back to the original node objects.
  const decorated = nodes.map((node, i) => {
    const anchor = nodeAnchorMs(node);
    const score = anchor == null ? -Infinity : recencyScore(anchor, referenceMs);
    return { node, score, id: idKey(node), i };
  });
  decorated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score; // recency DESC
    if (a.id < b.id) return -1;                        // stable ascending-id tiebreak
    if (a.id > b.id) return 1;
    return a.i - b.i;                                  // final fallback: input order
  });
  return decorated.map((d) => d.node);
}

module.exports = {
  DECAY_BASE,
  recencyScore,
  rankByRecency,
};
