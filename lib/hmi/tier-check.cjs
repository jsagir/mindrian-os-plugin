/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-05 Task 1 -- tier-check helper (v1 stub).
 *
 * Per Canon Part 3 (docs/MINDRIAN-CANON.md "Option generation tier-awareness"):
 *
 *   Tier 0  (no Brain, no usable local graph)  -> hardcoded minimal option set
 *   Tier 1  (Local Only / Mode B)              -> Navigation Engine; no RECOMMENDED
 *   Tier >= 2 (Full Loop / Mode A)             -> Brain-derived options + RECOMMENDED >= 0.7
 *
 * docs/CANON-PHASE-MAP.md Part 3 row "Option generation tier-awareness shipped"
 * points at Phase 90 Plan 90-09 + .planning/research/navigation-engine-brain-interface.md.
 * No standalone tier-check helper landed in main as of 2026-05-01; the contract
 * is currently inferred from `lib/core/brain-client.cjs#isAvailable()` plus
 * BRAIN.md presence checks scattered across `scripts/brain-derive-command.cjs`
 * and `lib/memory/*`.
 *
 * v1 stub semantics (PLAN 101-05 Task 1, autonomous execution, no Phase 90
 * follow-on hard-blocking us):
 *   - tier 2  if `process.env.MINDRIAN_BRAIN_KEY` is set (Brain reachable)
 *   - tier 1  otherwise (Local Only)
 *   - tier 0  is currently never returned by getTier(); callers may pass
 *             `tier: 0` explicitly to exercise the dispatcher refuse path.
 *
 * Real Phase 90 wiring (Brain ping + reachability cache + BRAIN.md presence
 * audit) is deferred. When Phase 90's full helper lands, this stub becomes
 * the back-compat shim.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */

'use strict';

/**
 * Return current tier based on Brain key presence.
 *
 * @returns {0|1|2|3} tier
 */
function getTier() {
  // v1 stub: env var is the only signal. Phase 90 follow-on will replace
  // with a Brain-ping + cache + BRAIN.md presence audit.
  if (process.env.MINDRIAN_BRAIN_KEY) return 2;
  return 1;
}

/**
 * Map a tier integer to a Mode A / Mode B / Tier 0 string per Canon Part 3.
 *
 * @param {number} tier
 * @returns {'A'|'B'|'0'}
 */
function modeForTier(tier) {
  const t = (typeof tier === 'number' && Number.isFinite(tier)) ? tier : 0;
  if (t >= 2) return 'A';
  if (t === 1) return 'B';
  return '0';
}

module.exports = {
  getTier: getTier,
  modeForTier: modeForTier,
};
