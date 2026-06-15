# Phase 158: bounded rejection-penalty (SEED-009-minimal) - Discussion Log

**Date:** 2026-06-15
**Mode:** discuss (with Larry; red-teaming + bias control requested by navigator)

> Human-reference record of the discussion. NOT consumed by downstream agents (they read 158-CONTEXT.md + 158-SPEC.md).

## Seam trace (pre-discussion grounding)

Traced where reject edges attach before presenting gray areas. Finding: ONE sink. `closeReach` (dial-close-reach.cjs:236) delegates a reach reject to `recordSelectorDecision` keyed by `reach.command`; `applyDecayWeight` (selector-decisions.cjs) reads `f_selector_decision` per command and feeds the `_applyDecay` seam in f-selector-ranker.cjs. Reaches collapse to command keys -> the commands-vs-reaches fork dissolves toward the command seam. Also found: the shipped recency factor `1-exp(-(n/DECAY_WINDOW))` recovers fully and counts only the LAST decision -> it forgets prior rejections (the "turn six re-surface" bug).

## Gray areas presented (navigator selected ALL four)

| Area | Question | Decision locked |
|------|----------|-----------------|
| Surface confirmation | Hook command seam vs reach seam? | Command-level `_applyDecay` seam; reaches collapse to cmd keys (D-01); no-command guard (D-01a) |
| Extend vs replace recency decay | Layer or rewrite `applyDecayWeight`? | LAYER: `base * recencyFactor * (1 - countPenalty)`; combined-suppression floor (D-02, D-02a) |
| Outcome differentiation | Does REJECT accumulate harder than DEFER/PIVOT? | REJECT-only accumulation; DEFER keeps transient+30d, PIVOT single-term; read enum not reason (D-03) |
| Hard-suppression guardrails | Which bias fences ship? | ALL four: M floor, W aging, periodic parole, per-room scope (D-05); deterministic parole (D-06) |

## Forks put to the navigator

| Fork | Options | Choice |
|------|---------|--------|
| Decay strategy (Area 2) | Layer (recommended) / Replace | **Layer** |
| Bias fences (Area 4, multi) | M floor / W window / periodic parole / per-room scope | **ALL FOUR** |

## Memory shape (spec-deferred) resolved

Deferred from SPEC as rate-vs-count; resolved in discussion to count-WITHIN-recency-window W (a rate in disguise), which both the accumulation and the aging fence consume (D-04).

## Red-team / bias-control ledger

Seven attacks named + the fence that defuses each (see 158-CONTEXT.md "Red-Team / Bias-Control Ledger"). Central risk = the confirmation-bias loop (suppressed -> never shown -> never recovers); double-fenced by recency aging + periodic parole. Larry-added constraint: parole must be deterministic (counter, not RNG) to keep ranking testable.

## Deferred

Full SEED-009 refit (dormant trigger); BOG-07 dial legibility of the suppression reason (Phase 157); cross-navigator pattern detection (Part 8 separate product); N/M/W/P re-tuning from telemetry.

---

*Phase: 158-bounded-rejection-penalty-seed-009-minimal*
