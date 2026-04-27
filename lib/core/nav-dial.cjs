/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-06 -- Larry dial: pure resolver + formatter for the statusline
 * navigation indicator
 * =======================================================================
 * Pure-function module. Zero I/O. Caller (scripts/context-monitor) reads
 * the latest decision-trace entry from .mindrian/decision-traces/<session>
 * .json and passes it in as a plain object. This module returns the dial
 * position and a formatted segment string for the statusline.
 *
 * Three positions: Investigate | Blend | Insight. The active position
 * carries a glyph (check / warn / low / --) drawn from the Canon Part 2
 * UI vocabulary, byte-identical with Plan 88.1-04 statusline-cache
 * classifyHealth (mirrored here, not require'd, to keep lib/core/ self-
 * contained and lib/memory/ <-> lib/core/ decoupled).
 *
 * Position mapping (engine-state-derived):
 *   - tier_0                                       -> Investigate / -- / null
 *   - mode_b OR weight < 0.3                       -> Investigate / warn / active
 *   - mode_a + weight 0.3..0.7                     -> Blend / warn / active
 *   - mode_a + weight 0.7..0.9                     -> Blend / check / active
 *   - mode_a + weight >= 0.9 + insight rationale   -> Insight / check / active
 *   - mode_a + weight >= 0.9 + non-insight         -> Blend / check / active
 *   - null trace OR malformed                      -> Investigate / -- / null
 *
 * Insight markers: 'synthesize' | 'insight' | 'converge' (case-insensitive)
 * appearing anywhere in chosen_rationale promote weight >= 0.9 from Blend
 * to Insight. The keyword set is canonical to Phase 91 and matches the
 * Canon Part 3 verb 'Synthesize' (collapse branches back to insight).
 *
 * Canon references:
 *   Part 2  UI glyph vocabulary -- check / warn / low / --, byte-identical
 *     to lib/core/statusline-cache.cjs classifyHealth (see line 94 of that
 *     file). Mirrored here as a 4-line function to keep this module
 *     dependency-free.
 *   Part 3  Tri-Context Decision Gate -- dial position reflects the
 *     triangulated tier_mode + weight_applied result; never an arbitrary
 *     scrollwheel state. Updates per turn as new traces land.
 *   Part 8  Graph Boundary -- this module performs ZERO I/O. Caller does
 *     all reads from .mindrian/decision-traces/<session>.json (LOCAL only).
 *     No fetch, no Brain client, no shell-out, no network surface.
 *
 * Tyler meeting quote (Canon Appendix D / Phase 91-CONTEXT R4):
 *   "my students almost unanimously said, 'We love the slider.'"
 * The dial is pedagogically meaningful (tied to engine state), not a
 * gimmick. The reason field is the audit trail; /mos:explain-decision
 * surfaces the same chosen_rationale that drove the dial.
 *
 * API:
 *   resolveDialPosition(trace) -> {label, glyph, highlight, reason}
 *     - trace: a decision-trace entry (the last element of traces[] in
 *       a .mindrian/decision-traces/<session>.json file). null is allowed.
 *     - label: 'Investigate' | 'Blend' | 'Insight'
 *     - glyph: 'check' | 'warn' | 'low' | '--'
 *     - highlight: 'active' | null
 *     - reason: human-readable string explaining why this position
 *
 *   formatDialSegment(position) -> string
 *     - position: object returned by resolveDialPosition
 *     - returns: 'Larry: Investigate | Blend | Insight' with the active
 *       position visually emphasized via De Stijl ANSI color codes
 *       (mirrors visual-ops.cjs ANSI palette without requiring it)
 *     - byte-budget: visible chars (ANSI-stripped) <= 60
 *
 *   classifyHealth(score) -> 'check' | 'warn' | 'low' | '--'
 *     - mirror of lib/core/statusline-cache.cjs classifyHealth
 *     - 0.7 -> check; 0.4 -> warn; 0.0 -> low; null/NaN/string -> '--'
 *
 * Three-surface compatible: pure CJS, node built-ins not even used (the
 * module imports nothing). Works the same on CLI + Desktop MCP + Cowork.
 */

'use strict';

// ---------- Frozen constants ----------

// Insight markers in chosen_rationale (case-insensitive).
// Synthesize: Canon Part 3 verb 7 (collapse branches back to insight).
// Converge:   Canon Part 4 cross-relationship signal (3+ sections agree).
// Insight:    plain English; the engine signals when it has reached one.
const INSIGHT_MARKERS = ['synthesize', 'insight', 'converge'];

// Canon Part 2 thresholds. Byte-identical to Plan 88.1-04
// statusline-cache.cjs classifyHealth (lines 94-99 of that file).
const HEALTH_CHECK_THRESHOLD = 0.7;
const HEALTH_WARN_THRESHOLD = 0.4;

// Tier-mode weight bands (Phase 91 D-04 mapping).
// weight < BLEND_FLOOR             -> Investigate (low confidence band)
// BLEND_FLOOR <= weight < BLEND_STRONG  -> Blend / warn
// BLEND_STRONG <= weight < INSIGHT_FLOOR -> Blend / check
// weight >= INSIGHT_FLOOR + insight markers -> Insight / check
const BLEND_FLOOR = 0.3;
const BLEND_STRONG = 0.7;
const INSIGHT_FLOOR = 0.9;

// ---------- classifyHealth (Canon Part 2 mirror) ----------
//
// Mirrors lib/core/statusline-cache.cjs classifyHealth byte-identically.
// This is the canonical glyph vocabulary across L3 surfaces (statusline,
// hook systemMessage, /mos:status, the dial). Re-mirrored instead of
// require'd so this module stays dependency-free and three-surface.
function classifyHealth(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '--';
  if (score >= HEALTH_CHECK_THRESHOLD) return 'check';
  if (score >= HEALTH_WARN_THRESHOLD) return 'warn';
  return 'low';
}

// ---------- resolveDialPosition ----------

/**
 * Map a decision-trace entry to a dial position.
 *
 * The trace shape is the same one Plan 91-02 writes and Plan 91-05 reads.
 * The function never throws; every malformed input falls through to the
 * Investigate / -- / null default ('no_trace_available' or 'malformed').
 *
 * @param {object|null} trace - decision-trace entry (last of traces[])
 * @returns {{label: string, glyph: string, highlight: string|null, reason: string}}
 */
function resolveDialPosition(trace) {
  // Null / non-object trace -> default.
  if (!trace || typeof trace !== 'object') {
    return {
      label: 'Investigate',
      glyph: '--',
      highlight: null,
      reason: 'no_trace_available'
    };
  }

  const tierMode = trace.brain_md_tier_mode;
  const weight = trace.brain_md_weight_applied;
  const rationale = typeof trace.chosen_rationale === 'string'
    ? trace.chosen_rationale
    : '';

  // Tier 0: pre-engine, default investigate state. No highlight (the dial
  // shows three positions but none is active until the engine has spoken).
  if (tierMode === 'tier_0') {
    return {
      label: 'Investigate',
      glyph: '--',
      highlight: null,
      reason: 'tier_0_fallback'
    };
  }

  // Mode B: Brain offline. Engine running on local triple only. Investigate
  // with a warn glyph -- the engine has spoken, but the signal is partial.
  if (tierMode === 'mode_b') {
    return {
      label: 'Investigate',
      glyph: 'warn',
      highlight: 'active',
      reason: 'Brain offline; investigating locally with MINTO + SQL only'
    };
  }

  // Mode A: full triangulation. Weight band picks the position.
  if (tierMode === 'mode_a') {
    if (typeof weight !== 'number' || !Number.isFinite(weight)) {
      // Missing weight on a mode_a trace is malformed; soft-fail to default.
      return {
        label: 'Investigate',
        glyph: '--',
        highlight: null,
        reason: 'malformed_trace_missing_weight'
      };
    }

    // Low-confidence band: still in investigate territory.
    if (weight < BLEND_FLOOR) {
      return {
        label: 'Investigate',
        glyph: 'warn',
        highlight: 'active',
        reason: 'low_confidence_or_offline'
      };
    }

    // Mid blend band: Blend with warn glyph.
    if (weight < BLEND_STRONG) {
      return {
        label: 'Blend',
        glyph: 'warn',
        highlight: 'active',
        reason: 'Blending MINTO + Brain at ' + weight.toFixed(2) + ' weight'
      };
    }

    // Strong blend band: Blend with check glyph.
    if (weight < INSIGHT_FLOOR) {
      return {
        label: 'Blend',
        glyph: 'check',
        highlight: 'active',
        reason: 'Strong MINTO + Brain agreement, blending'
      };
    }

    // Insight band: weight >= 0.9. Promote to Insight only when rationale
    // carries insight markers. Otherwise stay in Blend / check (high
    // confidence routine framework lookup, not a synthesis moment).
    const lower = rationale.toLowerCase();
    let isInsight = false;
    for (const marker of INSIGHT_MARKERS) {
      if (lower.indexOf(marker) !== -1) {
        isInsight = true;
        break;
      }
    }
    if (isInsight) {
      return {
        label: 'Insight',
        glyph: 'check',
        highlight: 'active',
        reason: 'Converging signals, insight mode'
      };
    }
    return {
      label: 'Blend',
      glyph: 'check',
      highlight: 'active',
      reason: 'High confidence, blending without explicit insight marker'
    };
  }

  // Unknown tier_mode (forward-compat with future engine modes) -> default.
  return {
    label: 'Investigate',
    glyph: '--',
    highlight: null,
    reason: 'unknown_tier_mode'
  };
}

// ---------- formatDialSegment ----------

// De Stijl ANSI palette (mirror of lib/core/visual-ops.cjs ANSI struct;
// duplicated here so this module imports nothing). The five colors used
// by the dial are dim/muted (inactive label), green (check), yellow
// (warn), red (low), and bold (highlight).
const ANSI = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[38;2;45;107;74m',   // ds-green
  yellow: '\x1b[38;2;200;164;60m',  // ds-yellow
  red:    '\x1b[38;2;166;61;47m',   // ds-red
  muted:  '\x1b[38;2;160;154;144m'  // ds-muted
};

const DIAL_LABELS = ['Investigate', 'Blend', 'Insight'];

function glyphColor(glyph) {
  if (glyph === 'check') return ANSI.green;
  if (glyph === 'warn')  return ANSI.yellow;
  if (glyph === 'low')   return ANSI.red;
  return ANSI.muted;
}

/**
 * Render the dial segment string for the statusline.
 *
 * Format (no highlight):  'Larry: Investigate | Blend | Insight'
 * Format (highlighted):   'Larry: Investigate | [bold]Blend[/bold] | Insight'
 *   plus a leading colored glyph indicator on the active label.
 *
 * Visible byte-length stripped of ANSI is <= 60 chars (Test 10 contract).
 * The longest variant is 'Larry: Investigate | Blend | Insight' = 36 chars,
 * well under the budget. Highlight does not add visible chars.
 *
 * @param {{label: string, glyph: string, highlight: string|null}} position
 * @returns {string} the formatted segment string ('' on null/invalid input)
 */
function formatDialSegment(position) {
  if (!position || typeof position !== 'object') return '';
  if (typeof position.label !== 'string') return '';

  const labels = DIAL_LABELS.map((label) => {
    if (label === position.label && position.highlight === 'active') {
      // Active label: bold + glyph color so the eye lands here.
      return ANSI.bold + glyphColor(position.glyph) + label + ANSI.reset;
    }
    // Inactive label: dim/muted.
    return ANSI.dim + ANSI.muted + label + ANSI.reset;
  });

  // Separator between labels.
  const sep = ' ' + ANSI.muted + '|' + ANSI.reset + ' ';

  // 'Larry:' prefix in dim white so it doesn't compete with the active
  // label for attention.
  const prefix = ANSI.dim + 'Larry:' + ANSI.reset + ' ';

  return prefix + labels.join(sep);
}

// ---------- Exports ----------

module.exports = {
  // Pure functions.
  resolveDialPosition: resolveDialPosition,
  formatDialSegment: formatDialSegment,
  classifyHealth: classifyHealth,
  // Frozen constants (exposed for tests + future composition).
  INSIGHT_MARKERS: INSIGHT_MARKERS,
  HEALTH_CHECK_THRESHOLD: HEALTH_CHECK_THRESHOLD,
  HEALTH_WARN_THRESHOLD: HEALTH_WARN_THRESHOLD,
  BLEND_FLOOR: BLEND_FLOOR,
  BLEND_STRONG: BLEND_STRONG,
  INSIGHT_FLOOR: INSIGHT_FLOOR
};
