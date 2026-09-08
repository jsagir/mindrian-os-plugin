---
phase: 318-seed-061-skillopt-smoke-calibration-reconciliation
plan: 01
subsystem: testing
tags: [skillopt, funnel, reconciliation, zod, harness, seed-061]

# Dependency graph
requires:
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    provides: skillopt-funnel.cjs (enumerateQueries, classifySkills, runFunnel, runSelftest), the funnel harness this plan extends
provides:
  - normalizeQueryText/buildPositiveIndex/reconcileNullNegatives pure functions in scripts/skillopt-funnel.cjs
  - runFunnel wired to reconcile null-negative labels roster-wide before judging, and to force the reconciled label onto resumed verdicts
  - --reconcile-audit CLI reporting mode (spawns nothing, writes nothing)
  - tests/fixtures/318/ tracked proving-case fixtures
  - tests/test-skillopt-null-negative-reconciliation-318.cjs (five-leg end-to-end proof)
  - a new run_if leg in tests/run-all-230.sh
affects: [SEED-061 step 2 (human relabeling), SEED-061 step 3-4 (smoke re-run + D7 re-check)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exact normalized-text-match reconciliation (whitespace/case only) as the offline, zero-spend guard against harness null-negative labeling bugs"
    - "Roster-wide index construction ahead of any --skills scope filter, so a scoped run never loses collision visibility"
    - "In-memory verdict override on the resume path, mirroring judgeOneQuery's existing force-the-expected-label invariant, never rewriting persisted unit JSON"

key-files:
  created:
    - tests/test-skillopt-null-negative-reconciliation-318.cjs
    - tests/fixtures/318/queries/skill-a.json
    - tests/fixtures/318/queries/skill-b.json
    - tests/fixtures/318/queries/skill-c.json
    - tests/fixtures/318/queries-nocollision/skill-a.json
    - tests/fixtures/318/queries-nocollision/skill-b.json
    - tests/fixtures/318/queries-nocollision/skill-c.json
  modified:
    - scripts/skillopt-funnel.cjs
    - tests/run-all-230.sh

key-decisions:
  - "Fix landed in skillopt-funnel.cjs, not skillopt-genqueries.cjs (CONTEXT.md D-01, honored as designed)"
  - "reconcileNullNegatives is exact-match only (whitespace/case normalized), never fuzzy or semantic (CONTEXT.md D-02)"
  - "Positive index built from the FULL unfiltered roster, applied before any --skills scope filter (Finding 3, a deviation the plan itself anticipated and required)"
  - "Resume-path verdict override added in onSettle (Finding 5, a real hole found and closed during implementation, not anticipated by the seed's original text)"
  - "No new tests/run-all-318.sh; the proof runs as a leg inside tests/run-all-230.sh instead (plan-recorded deliberate reuse)"

requirements-completed: [SEED-061-STEP-1]

# Metrics
duration: ~35min
completed: 2026-09-08
---

# Phase 318 Plan 01: Skillopt Funnel Null-Negative Reconciliation Summary

**Deterministic, offline, exact-match reconciliation pass added to `scripts/skillopt-funnel.cjs` that stops SEED-061's disclosed false-alarm bug, including a resume-path staleness hole found during implementation, with the fix's real-world impact honestly measured at 0 of 23 corrections on the current Phase 230 corpus.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-08
- **Tasks:** 3 (all `type="auto" tdd="true"`)
- **Files modified:** 2 (`scripts/skillopt-funnel.cjs`, `tests/run-all-230.sh`)
- **Files created:** 7 (1 test file, 6 tracked fixture files)

## Accomplishments

- Added three pure, synchronous functions (`normalizeQueryText`, `buildPositiveIndex`, `reconcileNullNegatives`) to `scripts/skillopt-funnel.cjs`, exported, zero spawn/fs/network in their source.
- Wired `runFunnel` to enumerate the query corpus UNFILTERED, build the positive index roster-wide, apply the caller's `--skills` scope afterward, and reconcile before the first judge spawn (Finding 3: closes the blind spot a `--skills`-scoped smoke run would otherwise have).
- Closed the resume-path staleness hole (Finding 5): a resumed unit's verdict now has the CURRENT reconciled `item.expected_skill` forced onto it in memory, mirroring the invariant `judgeOneQuery` already documents for fresh judge calls. The persisted unit JSON on disk is never rewritten.
- Added an additive `funnelResults.label_reconciliation` key (corrections/corrected_count/ambiguous_count/remaining_null_count), deliberately not named `reconciliation` (that key is the existing D5 spawned/ok/not_evaluated identity).
- Extended `runSelftest` with nine offline cases (A-I): exact-match correction, no-match retention, already-labeled immunity, the REAL Phase 230 near-miss pair staying null (the fuzzy-matching tripwire), same-skill immunity, ambiguity handling, function purity, `--skills`-scoped full-roster visibility, and resume-path correctness with on-disk byte-identity proof.
- Added a `--reconcile-audit` CLI mode: reports total/positive/negative/null-negative/corrected/ambiguous/residual counts plus the correction and residual rows, spawns nothing, writes nothing, exits 2 with a named reason on a missing/empty corpus.
- Shipped six tracked fixture files (`tests/fixtures/318/queries/` and `queries-nocollision/`) reproducing the Phase 230 defect shape, all validated against `EvalQuerySetSchema`.
- Shipped `tests/test-skillopt-null-negative-reconciliation-318.cjs`, a five-leg standalone proof (flag-rule arithmetic, corpus A/B, no-write-back byte-identity, zero-spawn, opportunistic real-corpus audit).
- Wired the new test as a `run_if` leg into `tests/run-all-230.sh`, immediately after the `230-02b funnel` leg.
- Confirmed `scripts/skillopt-genqueries.cjs` has zero diff throughout (`git diff --stat` empty) - proves the CONTEXT.md D-01 "better fix site" decision actually held in the implementation, not just in the design doc.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the deterministic null-negative reconciliation pass and wire it into runFunnel** - `c84b9d2f` (feat)
2. **Task 2: Extend runSelftest with the nine offline reconciliation cases** - `0d1101d5` (test)
3. **Task 3: Ship the end-to-end proving-case test, the audit mode, and the phase gates** - `d8a4def3` (test)

_Note: this plan's `tdd="true"` tasks build directly on the existing `runFunnel`/`runSelftest` test surface rather than a fresh RED/GREEN cycle per task; each task's own commit bundles its behavior + its own offline proof (Task 1's inline verification, Task 2's nine selftest cases, Task 3's five-leg standalone test), matching this repo's `runSelftest`-extension convention (Canon Part 7, reuse before build) rather than a separate test-then-implement commit pair per task._

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/skillopt-funnel.cjs` - `normalizeQueryText`, `buildPositiveIndex`, `reconcileNullNegatives` (pure, exported); `runFunnel` rewired for roster-wide indexing + resume-path label force; `funnelResults.label_reconciliation`; `runSelftest` cases A-I; `--reconcile-audit` CLI mode
- `tests/run-all-230.sh` - one new `run_if` leg for the 318 proving case, after `230-02b`
- `tests/test-skillopt-null-negative-reconciliation-318.cjs` - standalone five-leg proof
- `tests/fixtures/318/queries/{skill-a,skill-b,skill-c}.json` - the collision corpus
- `tests/fixtures/318/queries-nocollision/{skill-a,skill-b,skill-c}.json` - the A-side control (skill-a's colliding positive replaced with an unrelated query; skill-b and skill-c byte-identical copies)

## Decisions Made

- **Fix site stayed `skillopt-funnel.cjs`, not `skillopt-genqueries.cjs`** (CONTEXT.md D-01). Verified, not just declared: `git diff --stat -- scripts/skillopt-genqueries.cjs` is empty after all three tasks.
- **Exact-match only, whitespace/case normalized, no fuzzy or semantic matching** (CONTEXT.md D-02). Case D of the selftest and the near-miss control in the proving-case fixtures both assert the REAL Phase 230 near-miss pair (jtbd's negative "what's the status of my room" vs status's positive "show me the current status of my room") stays null forever - this is a permanent tripwire against fuzzy matching creeping in later.
- **Positive index built roster-wide, before `--skills` scope filtering** (Finding 3, a deviation from a naive "filter then reconcile" implementation that the plan itself flagged as required). Without this, a 13-skill smoke run would be blind to collisions owned by the other ~111 skills, which is where most of the real collision surface lives at fleet scale.
- **Resume-path label force added in `onSettle`** (Finding 5, a real gap found and closed during implementation, not present in the seed's original problem statement). Without this fix, a resumed smoke re-run over an existing `out/funnel/units/` directory would keep false-alarming even after the reconciliation pass was live, because `classifySkills` reads `u.verdict.expected_skill`, and the resumed verdict came straight from the (possibly stale) persisted unit JSON. The persisted file itself is never rewritten; the override exists only for scoring in the current run.
- **No new `tests/run-all-318.sh`** (plan-recorded deliberate reuse, Canon Part 7). The fix lives inside the Phase 230 harness family, so its proof runs inside `tests/run-all-230.sh` where it cannot silently stop running, rather than in a separate aggregator nobody remembers to invoke.

## Deviations from Plan

**None beyond what the plan itself already anticipated and required** (Finding 3's roster-wide indexing, Finding 5's resume-path fix, and D-01/D-02's fix-site and match-precision decisions were all locked in the plan/CONTEXT.md before execution started, not discovered mid-task). No Rule 1-4 deviations were needed during execution; the implementation followed the plan's rule table, action steps, and read_first guidance directly.

One test-authoring correction, not a deviation from the plan's substance: the test file's own doc comment and an assertion message originally contained the literal substring the file's own zero-spawn grep check searches for (a self-referential false positive - the file asserting "no forbidden token" while containing that very token in its own explanatory prose). Fixed by rephrasing the comment/message to avoid the literal substring while keeping the same meaning; caught and fixed before any commit, verified by re-running the test and the plan's own grep-based verification command.

## Issues Encountered

**Two pre-existing, out-of-scope `tests/run-all-230.sh` failures, unrelated to this plan's changes, confirmed present before Task 3 started and unrelated to any Phase 318 code path:**

1. **`230-01b inventory: --check reports 124 skills`** - the live skill roster has grown from 124 (frozen when Phase 230 closed) to 126 skills, a genuine fleet drift from roughly 90 unrelated phases landing since. Nothing in Phase 318 touches `scripts/skillopt-inventory.cjs` or the skill count; this failure is out of this plan's scope entirely and predates it.
2. **`230-06b eval: smoke-replay` (30.0% agreement)** - this is the EXACT disclosed, documented 30% D7 number from `230-07-CALIBRATION.md`, the number SEED-061 exists to investigate. Fixing it requires re-labeling `smoke-labels.json` (SEED-061 step 2, a human-judgment pass) and re-running the paid 13-skill smoke (SEED-061 step 3, real subscription spend), both explicitly deferred by CONTEXT.md's Locked Scope and explicitly forbidden as in-scope edits ("Do not touch `smoke-labels.json`... Do not re-run the 13-skill smoke").

Confirmed via `git stash` that both failures are present identically in the Task-1+Task-2-only state (before any Task 3 change), and both are structurally impossible to close within this plan's Locked Scope (one requires unrelated inventory work, the other requires deferred paid spend + human relabeling). `tests/run-all-230.sh` reports `PASS=8 FAIL=2 SKIP=0` after this plan lands (`PASS=7 FAIL=2` before the new 318 leg was added) - the new leg passes cleanly; the two pre-existing failures are unchanged and out of this plan's remit.

## Findings Carried From Planning (Findings 1, 2, 5)

**Finding 1 (headline).** The real Phase 230 corpus at `.planning/phases/230-.../out/queries/*.json` holds 105 queries across 14 skill sets; every query text is distinct (confirmed independently this session: 105 unique texts, 0 duplicates). There are 23 null-labeled `should_not_trigger` negatives and the exact-match rule corrects **0 of 23** on this corpus - re-measured live via `--reconcile-audit --out .planning/phases/230-.../out`:

```
reconcile-audit: total=105 should_trigger=58 should_not_trigger=47 null_negatives=23
reconcile-audit: corrected=0 ambiguous=0 residual_null=23
```

This is not a bug in the implementation - it is the real, disclosed shape of the current data, matching the plan's own plan-time measurement exactly. It is the correct guard for the case regardless (duplicate probability rises sharply at 124-skill fleet scale, a corpus roughly ten times larger), but it does NOT by itself move the 30% D7 number. **The load-bearing follow-up for D7 is SEED-061 step 2, the human relabeling pass, not this code fix.**

**Finding 2.** The 23 residual null negatives include 4 near-miss wordings of a foreign positive (for example `jtbd`'s "what's the status of my room" against `status`'s "show me the current status of my room"). These are the actual false-alarm generators in the smoke run. D-02 deliberately refuses to touch them - catching them needs either a live judge call (deferred spend) or a similarity heuristic only a human should arbitrate. This phase does not ship a similarity scorer; the `--reconcile-audit` residual list is raw material for step 2, printed with no score and no ranking.

**Finding 5.** The correction only reached scoring through the verdict object for a fresh judge call automatically (`judgeOneQuery` already force-writes `expected_skill` onto the parsed verdict). The RESUME path did not: `onSettle`'s prior code pushed `verdict: unit.payload` straight from the persisted unit JSON, whose `expected_skill` is whatever label the PRIOR run used - the stale null. Without a fix, any resumed unit (a smoke re-run over an existing `out/funnel/units/` directory is exactly that) would keep false-alarming while the fix looked present but stayed inert. This was closed in Task 1 by forcing the current reconciled item label onto the resumed verdict in memory, and proven in Task 2's Case I with a byte-identity assertion that the persisted unit JSON on disk is never touched.

## Explicitly Not Done (SEED-061 Steps 2-4 Remain Open)

Per CONTEXT.md's Locked Scope, this plan implements ONLY SEED-061 step 1. `smoke-labels.json` was not touched. `checkSmokeAgreement` was not touched. The 13-skill smoke was not re-run. The D7 gate was not re-checked. **This plan spent zero subscription quota** - every verification, every test, every audit run in this session was offline, deterministic, and zero-spawn.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 318 is the only plan in its phase; once this SUMMARY lands, verification should confirm all `<success_criteria>` from `318-01-PLAN.md`. SEED-061 steps 2-4 (human relabeling of `smoke-labels.json` against the now-visible full-roster collisions, the paid 13-skill smoke re-run, and the D7 re-check) remain open follow-up work, gated behind explicit navigator go-ahead on subscription spend, exactly as CONTEXT.md scoped them. No blockers for closing Phase 318 itself.

---
*Phase: 318-seed-061-skillopt-smoke-calibration-reconciliation*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 3 task commits
(`c84b9d2f`, `0d1101d5`, `d8a4def3`) confirmed present in `git log --oneline --all`.
