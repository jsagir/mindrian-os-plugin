---
phase: 237-reach-mechanism
plan: 01
subsystem: testing
tags: [bash, node-assert, test-aggregator, canon-part-8, em-dash-sweep]

# Dependency graph
requires: []
provides:
  - "tests/run-all-237.sh: SKIP-safe verification aggregator for the whole Phase 237 Reach Mechanism cluster, 9 run_if module legs + 3 regression legs + 3 hard floors"
  - "tests/test-198-local-only.test.cjs: extended Canon Part 8 floor now names lib/core/chain-step-dispatcher.cjs (absence-tolerant until Plan 07 lands it)"
affects: [237-02, 237-03, 237-04, 237-05, 237-06, 237-07, 237-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "run/run_if SKIP-safe aggregator helpers (cloned byte-identical from tests/run-all-198.sh)"
    - "em-dash sweep via bash ANSI-C codepoint escape ($'\\u2014'), never a literal glyph, so the sweep cannot trip itself"
    - "absence-tolerant Part 8 floor target list (a not-yet-landed module SKIPs the grep, never fails it)"

key-files:
  created:
    - tests/run-all-237.sh
  modified:
    - tests/test-198-local-only.test.cjs

key-decisions:
  - "Wired the em-dash sweep as a bash function (em_dash_sweep) called through the existing run helper, not an inline bash -c string, to avoid fragile nested-quote escaping around the ANSI-C codepoint literal"
  - "Left the pre-existing tests/test-act-on-runchain.cjs failure un-fixed and logged it to deferred-items.md: it is outside this plan's files_modified scope and predates Phase 237 (stale baseline vs. the FIRE-IF-FORK block lib/hmi/selector-dispatcher.cjs now injects)"

patterns-established:
  - "Every future Phase 237 test file gates a run_if leg on its own existence per 237-VALIDATION.md's Per-Task Verification Map; no glob discovery (tests/run-all-241.sh's found-eq-0-exit-1 pattern was deliberately not copied)"

requirements-completed: [REACH-01, REACH-02, REACH-03]

# Metrics
duration: 35min
completed: 2026-07-28
---

# Phase 237 Plan 01: Reach Mechanism Verification Aggregator Summary

**SKIP-safe `tests/run-all-237.sh` aggregator (9 run_if module legs + 3 regression legs + 3 hard floors) authored before any Phase 237 behavior change lands, plus the Canon Part 8 local-only floor extended to the not-yet-existing dispatcher module.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-28T22:50:00Z (approx, per session context)
- **Completed:** 2026-07-28T23:25:00Z (approx)
- **Tasks:** 2
- **Files modified:** 2 (tests/run-all-237.sh created, tests/test-198-local-only.test.cjs extended)

## Accomplishments

- Authored `tests/run-all-237.sh`: nine `run_if` module legs (REACH-01/02/03), each gated on its own `tests/test-237-*.cjs` file per 237-VALIDATION.md's Per-Task Verification Map, so the aggregator is Wave-0 green-with-SKIPs before any Phase 237 code lands
- Wired three pre-existing regression legs as plain `run` (chain_run halt, act-command adapted decideFn, recipe-maps authority)
- Added three ALWAYS-RUN hard floors ahead of the summary tail: aggregator self-check, Canon Part 8 local-only floor, and an inline em-dash sweep over every file Phase 237 touches or creates
- Extended `tests/test-198-local-only.test.cjs` to name `lib/core/chain-step-dispatcher.cjs` (Plan 07's net-new module) using the file's existing absence-tolerant shape, so it contributes no assertion today and will be scanned the moment that file exists
- Demonstrated the em-dash sweep RED against a real injected em-dash, restored the file byte-identically, and re-verified green (see Mutation Proof below)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author tests/run-all-237.sh as a SKIP-safe aggregator with all twelve legs pre-wired** - `0b96264c` (test)
2. **Task 2: Add the three hard floors and extend the Part 8 floor to the dispatcher module** - `fbf76604` (test)

_No plan-metadata commit required beyond this SUMMARY (STATE.md/ROADMAP.md are owned by the orchestrator for this session per the corruption-avoidance instruction in `.planning/debug/gsd-phase-complete-cross-phase-corruption.md`)._

## Files Created/Modified

- `tests/run-all-237.sh` - new SKIP-safe verification aggregator: run/run_if helpers, 9 module legs, 3 regression legs, 3 hard floors, summary tail
- `tests/test-198-local-only.test.cjs` - added `lib/core/chain-step-dispatcher.cjs` to the existing `NEW_198_MODULES` absence-tolerant target list

## Decisions Made

- **Em-dash sweep as a bash function, not an inline `bash -c` string.** The plan's pattern reference (`237-PATTERNS.md`) shows the sweep as a top-level loop; wrapping it in `run "label" bash -c '...'` required nesting the ANSI-C `$'—'` literal inside an already-single-quoted outer string, which is exactly the kind of fragile quote-escaping this milestone exists to eliminate. Defined `em_dash_sweep()` as a normal shell function in the script body instead, and call it through the existing `run "label" em_dash_sweep` idiom used for every other leg. Behaviorally identical, structurally simpler, easier to audit.
- **Left the pre-existing `tests/test-act-on-runchain.cjs` failure unfixed.** See Deviations below.

## Deviations from Plan

### Auto-fixed Issues

None - no auto-fixes were required in the files this plan actually modifies. (One self-inflicted mistake during Task 2 authoring was corrected before commit; see "Issues Encountered" below, since it was caught and fixed pre-commit rather than shipped.)

### Out-of-scope pre-existing failure (documented, not auto-fixed)

**1. [Scope boundary - pre-existing, unrelated] `tests/test-act-on-runchain.cjs` fails on a clean tree**

- **Found during:** Task 1, first run of `bash tests/run-all-237.sh`
- **Issue:** `node tests/test-act-on-runchain.cjs` fails a `deepStrictEqual` assertion comparing the rendered gated-halt card against a hardcoded baseline string. The baseline predates the `[FIRE-IF-FORK: ...]` block that `lib/hmi/selector-dispatcher.cjs` (SEED-021, Phase 210 era) now injects into every rendered gate card. Reproduced on a fully clean tree (`git stash -u`, back to commit `045bf132`, before this plan touched anything) to confirm it is not caused by this plan's work.
- **Why not fixed here:** `lib/hmi/selector-dispatcher.cjs` and `tests/test-act-on-runchain.cjs` are not in 237-01-PLAN.md's `files_modified` list (`tests/run-all-237.sh`, `tests/test-198-local-only.test.cjs` only), and the bug is unrelated to REACH-01/02/03. Per the executor SCOPE BOUNDARY rule, pre-existing failures in unrelated files are logged, not auto-fixed.
- **Logged:** `.planning/phases/237-reach-mechanism/deferred-items.md`
- **Effect on this plan's numbers:** the plan's stated acceptance criteria assumed all three regression legs currently pass, producing `Passed: 3 Failed: 0 Skipped: 9` (Task 1) and `Passed: 6 Failed: 0 Skipped: 9` (Task 2). The actual, honestly-reported aggregator output is `Passed: 2 Failed: 1 Skipped: 9` (Task 1) and `Passed: 5 Failed: 1 Skipped: 9` (Task 2) — one regression leg genuinely fails. All other Task 1 and Task 2 acceptance criteria (grep counts, SKIPPED substring, Summary line, `set -e` absence, executable bit, em-dash escape form, Part 8 floor absence-tolerance, mutation-proof RED/restore) verified exactly as specified.
- **Assessment:** the aggregator reporting this real, previously-invisible failure honestly, rather than a hand-picked leg list hiding it, is consistent with this plan's own stated purpose ("the whole v1.16.0 milestone exists because gates that could not fail were reading green"). Suppressing or skipping this leg to force a green Task-1/Task-2 acceptance number would have recreated exactly the failure class this milestone exists to close.

---

**Total deviations:** 1 documented-and-deferred (pre-existing, out of scope), 0 auto-fixed in-scope.
**Impact on plan:** No scope creep. The two files this plan owns are exactly as specified and pass every acceptance criterion that does not depend on the pre-existing regression leg's pass/fail state.

## Issues Encountered

- **Self-caught quoting mistake (pre-commit).** While first drafting the em-dash sweep, an early attempt at `EMDASH=$'—'` inline inside a `bash -c '...'` string accidentally rendered as a literal em-dash glyph rather than the codepoint escape, which would have violated the plan's explicit "never a literal glyph" requirement and (ironically) tripped the sweep's own no-self-trip contract. Caught before committing by re-deriving the sweep as a plain shell function (`em_dash_sweep()`) with the escape applied via a scripted substitution and grep-verified (`grep -c "u2014"` returns 1, `grep -Pc '\x{2014}'` outside comments returns 0) before Task 2 was committed. No literal em-dash ever landed in a commit.

## Mutation Proof (Task 2 required demonstration)

Followed the plan's exact recipe: temporarily appended an em-dash comment line to the live `tests/run-all-237.sh`, re-ran the aggregator, captured the RED, restored the file byte-identically, re-verified green.

**RED capture (mutation applied):**
```
--- 237 em-dash sweep (Phase 237 artifacts) ---
    FORBIDDEN em-dash in: tests/run-all-237.sh
>>> 237 em-dash sweep (Phase 237 artifacts): FAILED

========================================
  Summary (237 verification)
  Passed: 4   Failed: 2   Skipped: 9
========================================
```
(Failed: 2 because the injected em-dash also tripped the FAIL count while the pre-existing `test-act-on-runchain.cjs` failure was already contributing 1.)

**Restore verification:**
```
$ git diff --stat tests/run-all-237.sh
tests/run-all-237.sh | 56 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 56 insertions(+)
```
(The diff shown is the intentional Task 2 delta versus the Task 1 commit, not mutation residue — the mutation line itself was removed by restoring from a pre-mutation backup copy taken before the injection.)

**Re-run after restore (clean):**
```
--- 237 em-dash sweep (Phase 237 artifacts) ---
>>> 237 em-dash sweep (Phase 237 artifacts): PASSED

========================================
  Summary (237 verification)
  Passed: 5   Failed: 1   Skipped: 9
========================================
```
`git status --porcelain` after restore showed only the two intended files (`tests/run-all-237.sh`, `tests/test-198-local-only.test.cjs`), confirming no mutation residue.

## Verification Results

Ran the plan's full verification block, in order:

1. `bash tests/run-all-237.sh` -> exit 1 (not 0) — `Passed: 5   Failed: 1   Skipped: 9`. The single FAIL is the pre-existing, out-of-scope `test-act-on-runchain.cjs` regression documented above; every other leg (all 9 SKIPs, both other regression legs, all 3 hard floors) passed exactly as specified.
2. `node tests/test-198-local-only.test.cjs` -> exit 0. `PASS: test-198-local-only (Part 8 floor) -- 19 of 20 198 modules present, zero Brain-egress token` (the 20th, `lib/core/chain-step-dispatcher.cjs`, correctly skipped as absent).
3. `node tests/test-sensors-part8-sweep.cjs` -> exit 0, unchanged, confirms no collateral damage to the sibling Part 8 sweep.
4. `git status --porcelain` -> shows only `tests/run-all-237.sh` and `tests/test-198-local-only.test.cjs`.

## Zero Phase 236 Scope Touches

Confirmed no reads or writes under `.planning/phases/236-room-db-data-loss-fixes/`, `lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`, or `tests/test-236-*` at any point in this execution. All file operations were scoped to `tests/run-all-237.sh`, `tests/test-198-local-only.test.cjs`, and this plan's own `.planning/phases/237-reach-mechanism/` artifacts (SUMMARY.md, deferred-items.md).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/run-all-237.sh` is live and correctly SKIP-safe: every subsequent Phase 237 plan (02 through 08) now has a real place to report as its `tests/test-237-*.cjs` files land — each SKIP will flip to a real PASS/FAIL leg without any further edits to the aggregator.
- The Part 8 floor is pre-wired for Plan 07's `lib/core/chain-step-dispatcher.cjs` and will start scanning it automatically once that file exists.
- **Blocker for a future cleanup pass (not this plan's scope):** the pre-existing `tests/test-act-on-runchain.cjs` failure will keep this aggregator's overall exit code nonzero (`Failed: 1`) through every subsequent Phase 237 plan until it is separately fixed. This does not block Phase 237's own work (each new leg is independently readable in the aggregator's per-leg PASS/FAIL/SKIP output), but the orchestrator/verifier should not treat aggregator exit-code-nonzero alone as a Phase-237 regression without checking which specific leg failed. See `.planning/phases/237-reach-mechanism/deferred-items.md`.

---
*Phase: 237-reach-mechanism*
*Completed: 2026-07-28*

## Self-Check: PASSED

All created files verified present on disk; both task commit hashes verified present in git log.
