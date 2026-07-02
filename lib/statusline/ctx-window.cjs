// lib/statusline/ctx-window.cjs -- Quick task 20260702-statusline-context-aware
//
// Bucket-1(d): resolve the context-budget percentage from Claude Code's native
// statusline stdin JSON (data.context_window) instead of the local estimate,
// with the estimate kept as the FALLBACK for older CC (native fields absent).
//
// Why native beats the estimate: the estimate re-derives "used" from
// remaining_percentage through the AUTO_COMPACT_BUFFER (16.5%) reservation math.
// CC now exposes the real usage directly (used_percentage) plus the hard cliff
// flag (exceeds_200k_tokens). Reading the native number removes an entire
// modeling layer and tracks the host's own gauge.
//
// GOTCHAS honored (from the CC statusline JSON contract):
//   - Token fields changed MEANING in CC v2.1.132: we read the stable
//     PERCENTAGE fields (used_percentage / remaining_percentage), never raw token
//     counts, so the meaning-shift does not reach us.
//   - current_usage can be null right after /compact -- in which case
//     used_percentage is absent/null. We guard that (isFiniteNum) and FALL
//     THROUGH to the remaining-based estimate rather than rendering a wrong 0.
//   - Older CC exposes neither -> we return { pct: null } and the renderer
//     suppresses the gauge (the shipped "no data = no bar" contract).
//
// Pure + LOCAL (Canon Part 8): a plain object in, a { pct, source } out. Zero
// network, zero Brain, zero side effects, never throws.
//
// House rule: hyphens only, no em-dashes.

'use strict';

// The auto-compact headroom the host reserves before compaction fires. The
// legacy estimate treats "usable remaining" as the fraction of the window left
// AFTER this reservation, so a room at 16.5% raw-remaining reads as 0% usable.
// Kept byte-identical to scripts/context-monitor's historical constant so the
// estimate fallback matches the pre-quick-task render exactly.
const AUTO_COMPACT_BUFFER = 16.5;

function isFiniteNum(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function clampPct(x) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

/**
 * The legacy estimate: derive "used toward the cliff" from remaining_percentage
 * through the AUTO_COMPACT_BUFFER reservation. Returns null when remaining is not
 * a finite number.
 * @param {number|null|undefined} remaining - context_window.remaining_percentage
 * @returns {number|null}
 */
function estimateFromRemaining(remaining) {
  if (!isFiniteNum(remaining)) return null;
  const usableRemaining = Math.max(
    0,
    ((remaining - AUTO_COMPACT_BUFFER) / (100 - AUTO_COMPACT_BUFFER)) * 100
  );
  return clampPct(100 - usableRemaining);
}

/**
 * Resolve the context-budget percentage from the native context_window object.
 *
 * Priority:
 *   1. exceeds_200k_tokens === true    -> { pct: 100, source: 'native' } (hard cliff)
 *   2. used_percentage finite          -> { pct: clamp(used), source: 'native' }
 *   3. remaining_percentage finite     -> { pct: estimate, source: 'estimate' }
 *   4. neither                         -> { pct: null, source: 'none' }
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

  // Fallback estimate from remaining_percentage (older CC, or null-after-compact).
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
