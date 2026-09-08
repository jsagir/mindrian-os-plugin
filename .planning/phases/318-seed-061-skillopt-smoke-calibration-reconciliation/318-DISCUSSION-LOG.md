# Phase 318 Discussion Log

**Date:** 2026-09-08
**Mode:** compressed (architecture traced by direct code reading; no genuine multi-way fork
remained once the trace was complete)

## Area: where the fix belongs

Traced `skillopt-genqueries.cjs` (per-family generation, no roster visibility by design),
`skillopt-funnel.cjs` (`enumerateQueries` already reads the full roster before judging;
`classifySkills` applies the flag rule this bug false-alarms), and `skillopt-eval.cjs`
(`checkSmokeAgreement`, the D7 gate, operates on human labels not generated queries - not the
fix site). Decision: `enumerateQueries`'s output in `skillopt-funnel.cjs`, not
`skillopt-genqueries.cjs` as the seed's own text names - a deviation from the literal file
pointer, same bug, better fix point, recorded in CONTEXT.md rather than silently substituted.

## Area: reconciliation strictness

Considered fuzzy/semantic cross-roster matching (closer to what a live judge would catch) versus
exact-text matching only (conservative, deterministic, offline-testable). Decided exact-match
only - no live model call available or wanted for this phase, and a fragile heuristic risks
worse errors than leaving an unmatched negative as null.

## Scope boundary decided without a question (not a fork - a spend-avoidance default)

Steps 2-4 of SEED-061 (re-label smoke set, re-run smoke at ~$23-equivalent subscription usage,
re-check D7) require real subscription-quota spend and human calibration judgment. Deferred by
default, consistent with this repo's own established pattern of never spending real API/model
budget without explicit navigator opt-in framing (SEED-061's own cost note insists on this for
the fleet run; the same logic applies to the smaller smoke re-run).
