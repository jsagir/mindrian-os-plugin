# Phase 140: Sentinel & Instrumentation Hardening - Discussion Log

**Date:** 2026-06-04
**Mode:** discuss (default)

Human-reference record only. Not consumed by downstream agents (CONTEXT.md is the canonical output).

## Gray areas presented

Domain: make the scout suite safe to auto-fire on a cadence by fixing 5 instrumentation bugs (HARD-01..05); HARD prerequisite for Phase 145. Fix strategies are the planner's job; the 4 areas below are user-facing decisions (behavior/scope, not code).

User selected ALL FOUR areas to discuss.

## Area 1: HARD-04 telemetry gate

- Options: (A, recommended) instrument /mos: surfaces so the hook fires on /mos: usage; (B) relax the gate to measure all turns.
- **User selected: B -- Relax the gate (measure all turns).**
- Note: went against recommendation. Captured implication D-01a -- relaxing changes what the published "up to 57x" claim measures; planner must reconcile, do not silently redefine the number.

## Area 2: HARD-02 scope (instance vs class)

- Options: (A, recommended) fix the whole bug-class via one shared NOT-NULL-safe insert helper (hsi-to-graph.cjs + 3 latent siblings in lazygraph-ops.cjs); (B) fix only the scout path.
- **User selected: A -- Fix the class via shared helper.** Both-schema safety locked (D-02a).

## Area 3: Scout error visibility

- Options: (A, recommended) unmask scout errors (remove 2>/dev/null||true); (B) keep quiet-by-default.
- **User selected: A -- Unmask scout errors.** Driving principle: a silent scout is how HARD-02 hid for weeks.

## Area 4: HARD-03 backup-dir exclusion scope

- Options: (A, recommended) general ignore-list (.heal-backup, .snapshots, .tmp-*, dot-dirs); (B) just .heal-backup/.
- **User selected: B -- Just .heal-backup/.**
- Note: went against recommendation (minimal fix). Captured general ignore-list as a Deferred Idea; flagged likely near-term recurrence (.snapshots already exists in the room).

## Deferred ideas captured

- General backup/cache ignore-list for the scanners (from Area 4).
- 57x claim language reconciliation (from Area 1 implication).

## Claude's discretion (handed to planner/researcher)

- HARD-01 arithmetic-guard mechanism.
- HARD-05 exact STATE.md phase-deadline field name.
- Regression test structure (extend existing query-efficiency-telemetry.test.cjs).
