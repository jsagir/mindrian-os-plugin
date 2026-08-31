/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 272 -- the D-04 backend-dispatch chokepoint (CJS vs Python).
 *
 * This is the ONLY module in the repo that decides whether a reverse-salient
 * / HSI computation runs through the new CJS port or falls back to the
 * existing Python scripts (rs-engine.py, compute-hsi.py). Every real caller
 * named in RESEARCH.md Finding F-8 (reverse-salient-agent.cjs,
 * intelligence-cascade.cjs, futures/orchestrator.cjs) must route its
 * backend selection through resolveBackend() -- no module outside this file
 * may decide directly (mirrors the connector-spine "dispatchSensors ->
 * decide() -> resolver; no second selection brain" rule, CLAUDE.md
 * "Connector Spine" section).
 *
 * D-09 (rule-6 amendment): this dispatch chokepoint IS the rule-6 update.
 * reverse-salient-agent.cjs's rule 6 changes from "NEVER reimplement
 * rs-math in Node -- shell out to scripts/rs-engine.py" to "shell out to
 * whichever backend the active flag selects (rs-engine.py or
 * rs-engine.cjs) -- never inline rs-math logic directly in this agent."
 * Callers stay thin orchestrators either way; neither branch inlines
 * rs-math logic.
 *
 * MINDRIAN_RS_BACKEND env var (documented in docs/ENV-TUNING.md):
 *   'python' -> use the Python fallback (rs-engine.py / compute-hsi.py)
 *   'cjs'    -> use the new CJS port (the D-04 default)
 *   unset / anything else -> 'cjs' (D-04: CJS is the default, Python is
 *     the retained fallback -- an env flag is the only real rollback
 *     mechanism for a marketplace-distributed plugin)
 *
 * Intentionally the ENTIRE file. F-8's spawn-site table and Pitfall 6 both
 * name "ONE dispatch chokepoint" as the load-bearing property -- no
 * speculative options, no per-caller override, no second selection surface.
 * Pure function, no I/O, synchronous, no lazy-require needed (nothing heavy
 * to load here).
 *
 * NOTE (Wave 2, plan 272-04): this module exists and is fully correct, but
 * no caller requires it yet -- that wiring lands in a later wave (272-10),
 * since a chokepoint nobody calls through does not satisfy "no module
 * outside the chokepoint spawns Python directly." tests/272-dispatch-
 * chokepoint.sh and tests/272-rule6-amended.sh stay RED until that wiring
 * lands; only their dispatch-module-exists-and-exports sub-check passes
 * today.
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

// ---------- resolveBackend ----------
//
// Reads MINDRIAN_RS_BACKEND from process.env, trims and lowercases.
// Returns 'python' only for the exact string 'python'; returns 'cjs' for
// the exact string 'cjs' OR when unset/anything else (CJS is the D-04
// default). Never throws.

function resolveBackend() {
  const raw = String(process.env.MINDRIAN_RS_BACKEND || '').trim().toLowerCase();
  if (raw === 'python') return 'python';
  if (raw === 'cjs') return 'cjs';
  return 'cjs'; // D-04: CJS is the default; python is the retained fallback
}

module.exports = {
  resolveBackend: resolveBackend,
};
