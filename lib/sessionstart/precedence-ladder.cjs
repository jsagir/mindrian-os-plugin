/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-00 -- SessionStart Coordinator: precedence ladder (D-13).
 *
 * The 11-entry LOCKED ordering for additionalContext composition. Top wins;
 * bottom degrades first under budget pressure (D-15 iterative compression).
 *
 * Position 0 (index) = highest priority (1 in human-facing notation).
 * Position 10 (index) = lowest priority (11 in human-facing notation).
 *
 * Canon Part 3 (Decision Gate): tri-context surface must compose deterministically.
 * Canon Part 7 (Reuse Before Build): this consolidates 11 independently-shipped
 * SessionStart injectors into one ordered contract.
 *
 * The ladder is FROZEN. Adding/removing/reordering requires a canon amendment.
 *
 * Pure CJS, node built-ins only. Zero new runtime dependencies.
 */
'use strict';

const PRECEDENCE_LADDER = Object.freeze([
  'install-drift',       // priority 1 (top -- blocking warnings; preflight-doctor)
  'sealed-room',         // priority 2 (blocking guardrail; check-onboard-statusline sealed branch)
  'tension-hook',        // priority 3 (continuity; preflight-tension-surface)
  'memory-resume',       // priority 4 (continuity; memory-resume-nudge)
  'auto-explore',        // priority 5 (novelty; preflight-auto-explore or auto-explore-fire)
  'onboarding',          // priority 6 (novelty; check-onboard-statusline onboard branch)
  'minto',               // priority 7 (ambient context; statusline-fallback minto segment)
  'jtbd',                // priority 8 (ambient context; operator-update JTBD side-effect)
  'operator',            // priority 9 (ambient state; operator-update)
  'post-compact',        // priority 10 (ambient continuity; restore-post-compact-context)
  'statusline-fallback', // priority 11 (bottom -- surface fallback; statusline-fallback-echo)
]);

/**
 * priorityOf(id) -- return 1-indexed priority slot (1..11) or null if not in ladder.
 * @param {string} id
 * @returns {number|null}
 */
function priorityOf(id) {
  if (typeof id !== 'string') return null;
  const i = PRECEDENCE_LADDER.indexOf(id);
  return i < 0 ? null : i + 1;
}

module.exports = { PRECEDENCE_LADDER, priorityOf };
