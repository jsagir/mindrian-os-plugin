// lib/statusline/ctx-window.cjs -- Quick task 20260702-statusline-context-aware
//
// Bucket-1(d): resolve the context-budget percentage from Claude Code's native
// statusline stdin JSON (data.context_window) instead of the local estimate,
// with the estimate kept as the FALLBACK for older CC (native fields absent).
//
// Why native beats the estimate: CC exposes the real usage directly
// (used_percentage) plus the hard cliff flag (exceeds_200k_tokens). Reading the
// native number removes an entire modeling layer and tracks the host's own gauge.
//
// GOTCHAS honored (from the CC statusline JSON contract):
//   - Token fields changed MEANING in CC v2.1.132: we read the stable
//     PERCENTAGE fields (used_percentage / remaining_percentage), never raw token
//     counts, so the meaning-shift does not reach us.
//   - current_usage can be null right after /compact -- in which case
//     used_percentage is absent/null. We guard that (isFiniteNum) and FALL
//     THROUGH to the remaining-based derivation rather than rendering a wrong 0.
//   - Older CC exposes neither -> we return { pct: null } and the renderer
//     suppresses the gauge (the shipped "no data = no bar" contract).
//
// RCA statusline-context-pct-stale-post-compact (2026-07-28) -- THE SCALE RULE:
// both branches MUST answer the same question ("what percent of the context
// window is used"), because the second is a FALLBACK for the first, and a
// fallback that changes the meaning of the number is a wrong number.
//
// The fallback used to re-derive "used" from remaining_percentage through the
// AUTO_COMPACT_BUFFER reservation, which answers a DIFFERENT question ("what
// percent of the way to the auto-compact trigger"). Measured against 787 real
// captured host payloads spanning 11 model ids (Apr-Jul 2026),
// `used_percentage + remaining_percentage === 100` EXACTLY, in every single one:
// the two fields are exact arithmetic complements carrying the same information,
// and remaining_percentage is raw window-remaining that does NOT already encode
// the reservation. So the old buffer transform DOUBLE-COUNTED it and inflated the
// gauge by up to +16.5 points (true 50 -> 60, true 70 -> 84, true 78 -> 93,
// true 83.5 -> 100). Since the fallback fires precisely on the post-/compact turn
// (used_percentage null), the gauge JUMPED UP right after a compact -- read by the
// navigator as a stale/frozen number that ignored the compact.
//
// The correct derivation needs no modeling layer at all: pct = 100 - remaining.
// It needs no compact-detection heuristic and no stdin field the host does not
// actually send. AUTO_COMPACT_BUFFER is retained below as documentation of the
// real host threshold, but it MUST NOT be used to rescale the gauge.
//
// Pure + LOCAL (Canon Part 8): a plain object in, a { pct, source } out. Zero
// network, zero Brain, zero side effects, never throws.
//
// House rule: hyphens only, no em-dashes.

'use strict';

// The auto-compact headroom the host reserves before compaction fires, i.e. the
// used-percentage at which auto-compact is expected to trigger is roughly
// (100 - AUTO_COMPACT_BUFFER). DOCUMENTATION ONLY as of the 2026-07-28 RCA: it
// describes a host threshold, it is NOT a scale factor for the gauge. Applying it
// to the percentage is what produced the post-/compact inflation (see the header).
const AUTO_COMPACT_BUFFER = 16.5;

function isFiniteNum(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function clampPct(x) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

/**
 * Derive percent-of-window-USED from remaining_percentage, on the SAME scale the
 * native used_percentage branch reports (the scale rule in the header).
 *
 * The host emits these two fields as exact complements (verified across 787 real
 * captured payloads, 11 model ids: used + remaining === 100, always), so this is
 * an exact recovery of used_percentage, not a lossy estimate. The name is kept
 * for the module's existing public surface.
 *
 * Returns null when remaining is not a finite number.
 *
 * @param {number|null|undefined} remaining - context_window.remaining_percentage
 * @returns {number|null}
 */
function estimateFromRemaining(remaining) {
  if (!isFiniteNum(remaining)) return null;
  return clampPct(100 - remaining);
}

/**
 * Resolve the context-budget percentage from the native context_window object.
 *
 * Priority:
 *   1. exceeds_200k_tokens === true    -> { pct: 100, source: 'native' } (hard cliff)
 *   2. used_percentage finite          -> { pct: clamp(used), source: 'native' }
 *   3. remaining_percentage finite     -> { pct: 100 - remaining, source: 'estimate' }
 *   4. neither                         -> { pct: null, source: 'none' }
 *
 * Branches 2 and 3 return the SAME quantity on the SAME scale (the scale rule in
 * the header); `source` reports provenance only, never a change of meaning.
 *
 * A null / non-object context_window degrades to { pct: null, source: 'none' }.
 * Never throws.
 *
 * @param {Object|null|undefined} cw - data.context_window from the CC stdin JSON
 * @returns {{ pct: number|null, source: 'native'|'estimate'|'none' }}
 */
function resolveCtxPct(cw) {
  const c = (cw && typeof cw === 'object') ? cw : null;
  if (!c) return { pct: null, source: 'none' };

  // Hard cliff: the host says the 200k window is exceeded. That is the cliff
  // regardless of any (possibly stale/null) percentage field.
  if (c.exceeds_200k_tokens === true) {
    return { pct: 100, source: 'native' };
  }

  // Native used percentage (preferred). Guards the post-/compact null: when
  // current_usage is null the host omits / nulls used_percentage, so isFiniteNum
  // fails and we fall through to the estimate rather than rendering a wrong 0.
  if (isFiniteNum(c.used_percentage)) {
    return { pct: clampPct(c.used_percentage), source: 'native' };
  }

  // Fallback from remaining_percentage (older CC, or null-after-/compact). Same
  // scale as the native branch above -- see the scale rule in the header.
  const est = estimateFromRemaining(c.remaining_percentage);
  if (est !== null) {
    return { pct: est, source: 'estimate' };
  }

  return { pct: null, source: 'none' };
}

module.exports = {
  resolveCtxPct,
  estimateFromRemaining,
  clampPct,
  AUTO_COMPACT_BUFFER,
};
