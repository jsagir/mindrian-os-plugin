# Quick Task Summary: statusline-context-aware

**One-liner:** The four-tier navigator cockpit goes context-aware -- static "persona" chip dropped, a binary brain chip (on/omitted), a live per-turn "Next:" cue with an honest "--" fallback (never the lying "continue"), and the NATIVE Claude Code context percentage with an estimate fallback.

**Date:** 2026-07-02
**Type:** GSD quick task (navigator co-design, Phase 121.5 rule satisfied).
**Branch:** main (main tree, no worktree).

## Commits

| SHA | What |
|-----|------|
| 51b7eb4d | Rulings 1-2: drop static persona chip + binary brain chip (cockpit-renderer.cjs) |
| a222a654 | Ruling 3: context-aware Next -- honest "--" + per-turn decision cue + gate/CSV parity |
| fb8d6af6 | Bucket-1d: native context percentage with estimate fallback (ctx-window.cjs + context-monitor) |
| aab6af3b | Tests: new context-aware suite + regression updates |

## Per-ruling confirmation

- **Ruling 1 -- persona DROPPED.** The steady Larry agentSeg is now empty; identity only appends agentSeg when non-empty. The hexagon carries brand identity alone. Kept (dynamic): the host marker on a non-Larry turn + the passive voice-switch announcements.
- **Ruling 2 -- brain BINARY.** New BRAIN_ON constant. Connected -> labeled ON state; offline/unconfigured -> chip OMITTED (off-form chosen: OMIT, documented in-code, consistent with Ruling 1 + the JTBD render-nothing-when-absent rule). Reuses the shipped brainConnected / brain_tier signal.
- **Ruling 3 -- Next context-aware + JTBD.**
  - (a) Per-turn decision cue persisted: next-move-cache.persistFromDecision(decision) prefers offer_next_step.command, else fire_skill, else clears (no stale pin). Wired at the finalized-decision seam in scripts/intent-classifier.cjs (engine path, never the hot statusline path). Reuses persistNextMove -- no second cache (Part 7).
  - (b) JTBD chip confirmed: renders when set, nothing when absent -- already wired by 106-D02 in context-monitor (the allowed glyph carve-out surface); left intact. Building it in the cockpit renderer would trip the glyph-isolation fence.
  - (c) Resolution order routed offer -> per-turn decision cue -> jtbd -> honest "Next: --". The lying "continue" is gone from deriveNextMove and the renderer default.
- **Bucket-1d -- DONE.** Native context_window.used_percentage (and exceeds_200k_tokens -> hard cliff) preferred; estimate kept as fallback; null-after-/compact guarded (falls through to estimate); stable percentage fields only. E2e verified all four paths.
- **Bucket-1e -- SKIPPED (documented).** No CC-version-detection helper exists to express the CC>=2.1.97 guard at settings-write time (statusLine block written by session-start + doctor via bash/node, no version probe). An unguarded refreshInterval would violate the "guarded" requirement. The ruling's own escape clause applies.
- **Bucket-1f -- SKIPPED (documented).** Statusline re-spawns per render, so an in-memory session cache buys nothing across ticks; a file cache keyed on session_id for the room NAME would reintroduce the stale-room bug the context-monitor:650 no-cache-across-calls contract fixed after the Lawrence 2026-04-28 incident. Room-health is already a single small read.

## Test results

| Suite | Result |
|-------|--------|
| tests/test-statusline-context-aware.cjs (NEW) | 19/19 |
| 187 cockpit suite (run-all-187.sh) | 124/124 + D-02 broadcast fence PASS |
| 192-04 stance chip | 27/27 |
| quick(statusline-live) live-signals | 10/10 |
| liveness gate + CSV parity | 5/5 |
| doctor prefix validator | 8/8 |

Plurai eval: rows EXTENDED (5 new rows in 12-statusline-liveness-fidelity.csv) for the honest "--" placeholder + jtbd-derived-cue cases; liveness gate kept in parity ("--" added to PLACEHOLDER_NEXT); gate matches the label on every row.

Byte-stable degrade: YES (empty stdin + all caches absent renders a safe line, no crash).

## Deviations / deferred

- Ruling 3b was already implemented (106-D02); confirmed, not rebuilt (rebuilding in the renderer would trip the glyph fence).
- Buckets 1e + 1f skipped with documented wiring-based reasons.
- Pre-existing (deferred-items.md): hmi-compliance Test 11 hooks.json Stop-entry drift (hooks.json untouched by this task); glyph-isolation fails in THIS tree only via a gitignored runtime cache (.mindrian/brain-substrate-cache.json), clean in CI, all touched source files clean.

## Self-Check: PASSED

- Created files exist: lib/statusline/ctx-window.cjs, tests/test-statusline-context-aware.cjs, PLAN + SUMMARY + deferred-items -- all present.
- Commits exist: 51b7eb4d, a222a654, fb8d6af6, aab6af3b -- all in git log.
