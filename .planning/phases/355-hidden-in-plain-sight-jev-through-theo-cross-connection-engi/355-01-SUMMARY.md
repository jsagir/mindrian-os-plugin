---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 01
subsystem: testing
tags: [direction-convention, phase-gate, doctor-baseline, hygiene-helper, run-all, tdd]

requires: []
provides:
  - "D-57 execution gate proven: Phase 354 CLOSED, six shared D-57 files carry no uncommitted peer diff"
  - "355-BASELINE.md: BASE_355 commit, post-354 anchors on the six D-57 files, doctor --acceptance baseline"
  - "tests/helpers/hygiene-355.cjs: scrubVendorKey, installNetGuard, makeChecker, isPureLineComment, nonCommentLines, listFilesRecursive"
  - "tests/run-all-355.sh: phase aggregator skeleton (run/run_if/strip_comments/doctor_acceptance_no_new_regression/emdash_scan), SKIPs cleanly until artifacts land"
  - "lib/core/direction-convention.cjs: the one module defining structural_transfer/semantic_implementation (HIPS-01, D-01, D-02)"
affects: [355-02, 355-03, 355-07, 355-15, 355-27]

tech-stack:
  added: []
  patterns:
    - "355 test hygiene: scrubVendorKey + installNetGuard before any repo require; attempts() === 0 as last check"
    - "Convention A direction classification isolated to one module, cited by source comment to its origin deck section"

key-files:
  created:
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-BASELINE.md
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - tests/helpers/hygiene-355.cjs
    - tests/run-all-355.sh
    - lib/core/direction-convention.cjs
    - tests/test-355-direction-convention.cjs
  modified: []

key-decisions:
  - "D-57 gate scoped to the six named shared files (gate.cjs, tool-router.cjs, brain-client.cjs, part8-egress-guard.cjs, doctor.cjs, jev-devtime-client.cjs); three peer-owned dirty files outside that list (eval-icm-writers.cjs, test-353-grader-agreement.cjs, test-353-ledger-shape.cjs) were left untouched per the Phase 356 peer contract and the shared_tree_rules briefing"
  - "DIRECTION_MEANING phrases render as 'same meaning in different words' / 'same words with different meaning' (the CONTEXT <specifics> wording), not the RESEARCH.md Code Examples' shorter comma-joined gist - the plan's own action text directs this exact wording"
  - "Three pre-existing tests/run-all-355.sh no-regression-leg failures (Phase 356's own em-dash guard on its own file, an @huggingface/transformers version gap in 272-cache-probe, PB8-03 in part8-egress-guard.cjs) logged to deferred-items.md, not fixed - all three predate this plan and sit outside its scope"

patterns-established:
  - "Pattern: every 355 test requires tests/helpers/hygiene-355.cjs first and calls scrubVendorKey()/installNetGuard() before any repo require"
  - "Pattern: tests/run-all-355.sh legs mirror tests/run-all-224.sh's run/run_if/strip_comments shape; doctor_acceptance_no_new_regression compares against BASE_355's baseline set"

requirements-completed: [HIPS-01, HIPS-10]

duration: 45min
completed: 2026-09-23
---

# Phase 355 Plan 01: D-57 Gate, Baseline, Hygiene Helper, Direction Convention Summary

**Proved Phase 354 closed and the shared tree clean on the six D-57 files, captured the doctor acceptance baseline, and landed the one module (`lib/core/direction-convention.cjs`) that defines `structural_transfer`/`semantic_implementation` for every later 355 plan, test-first.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-23T17:50:00Z (approx, session start)
- **Completed:** 2026-09-23T18:35:00Z (approx)
- **Tasks:** 2 completed (Task 2 is `tdd="true"`: RED then GREEN)
- **Files modified:** 6 created, 0 modified

## Accomplishments
- D-57 execution gate proven for the six shared files (`lib/mcp/tools/gate.cjs`, `lib/mcp/tool-router.cjs`, `lib/core/brain-client.cjs`, `lib/core/part8-egress-guard.cjs`, `scripts/doctor.cjs`, `scripts/jev-devtime-client.cjs`): Phase 354 CLOSED (18/18 plans checked, `354-16-SUMMARY.md` present), zero uncommitted diff this session made on any of the six
- `355-BASELINE.md` records `BASE_355 = 9458bf802` (2026-09-23), the post-354 grep anchors on all six D-57 files, and the `doctor --acceptance` baseline (20/21 points passed, only `verify-release-clean-tree` failing - a pre-existing environment gap)
- `tests/helpers/hygiene-355.cjs` ships the shared test hygiene helper (`scrubVendorKey`, `installNetGuard`, `makeChecker`, `isPureLineComment`, `nonCommentLines`, `listFilesRecursive`) every later 355 test will require
- `tests/run-all-355.sh` skeleton lands, mirroring `tests/run-all-224.sh`'s `run`/`run_if`/`strip_comments` shape across 9 legs, SKIPping cleanly on every not-yet-landed 355 artifact
- `lib/core/direction-convention.cjs` lands test-first (RED then GREEN): the one module owning `classify(lsa, semantic)`, `classifyDiff(signedDiff)`, `DIRECTIONS`, `DIRECTION_MEANING`, `NONE`, `NONE_MEANING`, `phraseHash()`, citing `355-ORIGIN-CONCEPT.md` section 3, zod-free, requiring only `node:crypto`

## Task Commits

Each task was committed atomically:

1. **Task 1: D-57 gate check, base commit, D-57 file anchors, doctor baseline, hygiene helper and run-all-355.sh skeleton** - `fc822619a` (feat)
2. **Task 2: lib/core/direction-convention.cjs, test first (D-01, D-02)** - RED `8e67c9c0d` (test), GREEN `bd61b6580` (feat)

**Plan metadata:** committed separately below (docs: complete plan)

_Note: Task 2 is a TDD task (RED then GREEN, two commits)._

## Files Created/Modified
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-BASELINE.md` - BASE_355 commit, D-57 anchors, doctor acceptance baseline
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - three pre-existing out-of-scope no-regression-leg failures, logged not fixed
- `tests/helpers/hygiene-355.cjs` - shared test hygiene helper (scrub key, net guard, checker, comment/file scan helpers)
- `tests/run-all-355.sh` - phase aggregator skeleton, 9 legs
- `lib/core/direction-convention.cjs` - the one direction-convention module (HIPS-01, D-01, D-02)
- `tests/test-355-direction-convention.cjs` - pinned test table for the module (28 assertions)

## Decisions Made
- Scoped the D-57 "authoritative" gate to exactly the six named shared files per the plan's own `<must_haves><truths>` block and the orchestrator's `<shared_tree_rules>`; the three extra peer-owned files the plan's literal `git status --short` command also swept (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`) are documented known peer state (Phase 356/353 territory, explicitly named in `docs/2026-09-23-HANDOFF-phase-355-planned-continue.md`'s "Peer contract from Phase 356" section as "never stage those") rather than a gate failure
- Rendered `DIRECTION_MEANING` with the exact phrasing the plan's `<action>` text and `355-CONTEXT.md <specifics>` both specify ("same meaning in different words" / "same words with different meaning"), not the shorter comma-joined gist shown in `355-RESEARCH.md`'s illustrative Code Examples snippet - the plan text explicitly says the specifics wording wins and the PWS author confirms it in plan 355-02
- Logged three pre-existing `tests/run-all-355.sh` no-regression-leg failures to `deferred-items.md` instead of fixing them: Phase 356's own em-dash guard failing on its own `356-VERIFICATION.md` (peer file), an `@huggingface/transformers` version gap in `272-cache-probe.test.cjs` (environmental), and `PB8-03` in `lib/core/part8-egress-guard.cjs` (one of the six clean D-57 files, so the failure predates this plan). None of the three touches a file this plan created or the plan asked this task to fix

## Deviations from Plan

### Auto-fixed Issues

None - the plan's own action steps were followed exactly for both tasks. No Rule 1/2/3 auto-fixes were needed.

### Scope-boundary items (documented, not auto-fixed)

**1. [Scope Boundary] Three pre-existing `tests/run-all-355.sh` no-regression-leg failures**
- **Found during:** Task 1's own verification (`bash tests/run-all-355.sh`) and re-confirmed after Task 2 landed
- **Issue:** `bash tests/run-all-356.sh` fails (its internal em-dash guard finds an em-dash in Phase 356's own `356-VERIFICATION.md`); `bash tests/run-all-272.sh` fails (`272-cache-probe.test.cjs` needs an `@huggingface/transformers` API surface `is_pipeline_cached` the installed dependency version does not expose); `node lib/core/part8-egress-guard.test.cjs` fails (`PB8-03` expects `'allow'`, gets `'ambiguous'`)
- **Why not fixed:** none of the three files (`356-VERIFICATION.md`, the transformers dependency, `part8-egress-guard.cjs`) was touched by this plan; `part8-egress-guard.cjs` is one of the six D-57 gate files and was confirmed clean (zero uncommitted diff) before this plan started, so the failure predates Phase 355 entirely. Fixing any of the three would mean editing a peer's file, bumping a dependency, or patching production Part 8 guard classification logic - all out of this plan's stated scope (D-57 gate + direction-convention module only)
- **Files modified:** none (logged only)
- **Verification:** `bash tests/run-all-355.sh` currently reports `PASS=16 FAIL=3 SKIP=14`; the three failures are exactly and only the three named above, confirmed by running each command standalone
- **Committed in:** documented in `deferred-items.md`, part of the `fc822619a` Task 1 commit

---

**Total deviations:** 0 auto-fixed; 1 scope-boundary item (3 pre-existing failures) logged to `deferred-items.md`.
**Impact on plan:** None on this plan's own deliverables - all Task 1 and Task 2 acceptance criteria that depend only on this plan's own files pass cleanly (direction-convention test 28/28, Part 8/9 sweeps on the new module, structural gates, doctor no-new-regression, em-dash leg). The literal "`bash tests/run-all-355.sh` exits 0`" acceptance line does not hold in this concurrent multi-session tree because of the three logged external failures; it is expected to hold once those clear.

## Issues Encountered
- `bash tests/run-all-355.sh` does not currently exit 0 (see Deviations above) - not a defect in the script or in this plan's files; the script correctly surfaces three real, pre-existing, out-of-scope failures rather than masking them. Re-run after Phase 356 closes its own em-dash guard, the `@huggingface/transformers` version gap is resolved, and `PB8-03` is root-caused.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/core/direction-convention.cjs` is ready for plan 355-02 (the PWS author's confirmation of the two direction phrases) and every later plan that classifies a wording-difference direction
- `tests/helpers/hygiene-355.cjs` and `tests/run-all-355.sh` are ready for every subsequent 355 plan's own tests to plug into
- `355-BASELINE.md` gives every later D-57-file-touching plan its post-354 anchors and the doctor no-new-regression baseline
- Blocker/concern carried forward: the three logged pre-existing failures in `deferred-items.md` will keep `tests/run-all-355.sh` red on those three legs until Phase 356 and the `@huggingface/transformers` dependency issue are resolved elsewhere, and until `PB8-03` is root-caused - none of this blocks 355-02 or later 355 plans from proceeding, since those legs are external to this phase's own artifacts

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-23*
