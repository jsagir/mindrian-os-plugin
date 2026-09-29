---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 01
subsystem: testing
tags: [baseline, aggregator, rubric, rca, wave-0, research-planner]

requires:
  - phase: 362
    provides: clean base for Phase 363
provides:
  - pinned pre-363 before-picture (tests/fixtures/363-pre-phase.json) and the test that proves it against git objects
  - tests/run-all-363.sh, the single phase aggregator (run / run_if / run_known)
  - 363-D06-RUBRIC.md, the written human rubric for the D-06 check
  - follow-on RCA for the ungated Semantic Scholar egress (D-16)
affects: [363-02 through 363-22]

tech-stack:
  added: []
  patterns:
    - "run_known: a pre-existing red counts KNOWN only when its recorded signature matches; any other red is FAILED"
    - "fixture digests computed by script from git show <base_sha>, re-derived by the test"

key-files:
  created:
    - tests/fixtures/363-pre-phase.json
    - tests/test-363-baseline.cjs
    - tests/run-all-363.sh
    - .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-D06-RUBRIC.md
    - .planning/debug/whitespace-external-semantic-scholar-ungated-egress.md
  modified: []

key-decisions:
  - "Six nested aggregators red at PLAN_BASE are wrapped with run_known using their own summary line as signature; 363 does not fix a peer's red"
  - "check-floor-ledger.cjs is invoked with --check (the script has no bare mode; the plan text omitted the flag)"

requirements-completed: [DRP363-06, DRP363-13, DRP363-16, DRP363-18]

duration: resumed session
completed: 2026-09-29
---

# Phase 363 Plan 01: Baseline, aggregator, D-06 rubric, egress RCA Summary

**Phase 363 now has a pinned before-picture proven from git objects, one honest aggregator that separates PASSED from SKIPPED from KNOWN, a written D-06 rubric, and the ungated Semantic Scholar egress on record as an out-of-scope follow-on.**

## PLAN_BASE

`551232ba58e1882bed5321c32edbdb7e397dbd6d` (the fixture's `base_sha`; 23 command files carry the `Ask: "Quick pass or deep dive?"` line).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 | 4ee6e5296 | tests/fixtures/363-pre-phase.json, tests/test-363-baseline.cjs |
| 1 (fix) | 42bae51c5 | tests/test-363-baseline.cjs |
| 2 | 26b5b14c5 | tests/run-all-363.sh |
| 3 | acdeb7d56 | 363-D06-RUBRIC.md, whitespace-external-semantic-scholar-ungated-egress.md |

All four are ancestors of HEAD.

## Aggregator first-run counts

Final `bash tests/run-all-363.sh`: `PASSED=20 FAILED=0 SKIPPED=24 KNOWN=10`, exit 0.

- PASSED 20: baseline leg, run-all-130.5, six single-file suites, nine generator/check gates, floor ledger, CIRS plan check, no-new-dependency, quick-pass line, em-dash guard.
- SKIPPED 24: the 23 planned test files not yet written plus the live smoke (MOS_363_LIVE unset). `run_if` count is 29 lines including the helper and guard definitions; the acceptance minimum (24) is met.
- KNOWN 10: the three named reds, test-198-contract-schema, and six nested aggregators (below).

## Known reds and their confirmed signatures

The three the plan named, all confirmed still red with the plan's signature:

| Leg | Signature |
|-----|-----------|
| tests/test-260906-fda-known-tool-shapes.cjs | `shipped brain_ask methodology question (unproven free-form tokens): expected verdict "ambiguous"` |
| lib/core/part8-egress-guard.test.cjs | `PB8-03: generic framework question must ALLOW` |
| tests/test-209-declared-implies-wired.cjs | `if this list changed: either a surface was fixed` |

Found red at PLAN_BASE, outside 363 (NEW findings for the record, wrapped with `run_known`):

| Leg | Signature | Note |
|-----|-----------|------|
| tests/test-198-contract-schema.test.cjs | `AssertionError [ERR_ASSERTION]: contract_version registers (flag off)` | plan listed it as a plain run leg; it is red |
| tests/run-all-131.sh | `Failed:  2` | test-131-e2e and test-131-substrate; e2e fails a zero-leak gate because a read of `/home/jsagi/.mindrian/persona-override.json` is flagged (environment-dependent) |
| tests/run-all-219.sh | `Phase 219: PASS=9 FAIL=4 SKIP=0` | stable across two runs |
| tests/run-all-221.sh | `Phase 221: PASS=11 FAIL=3 SKIP=0` | stable |
| tests/run-all-164.sh | `    - canon-version assertion` | one failure |
| tests/run-all-3551.sh | `Phase 355.1: PASS=63 FAIL=5 SKIP=0` | includes its own em-dash leg red |
| tests/run-all-361.sh | `PASSED=26 FAILED=3 SKIPPED=0` | its three are the same known reds above |

Caution: the run-all-131 red reads an environment file, so it may change with user state. The signature makes a change surface as FAILED, not hide.

## doctor --acceptance at PLAN_BASE tree

`node scripts/doctor.cjs --acceptance`: `21/22 points passed; failed: verify-release-clean-tree` with message `verify-release clean git tree (tracked files only) -- tracked-file drift: 5 file(s)`. The drift is uncommitted peer work in the shared tree (STATE.md, docs/PLURAI-USAGE-AND-QA-REPORT.md, evals/plurai/README.md, lab/eval/report-from-transcript.cjs, tests/run-all-192.sh, tests/run-all-203.sh, tests/test-eval-report-from-transcript.cjs at run time), not a 363 defect. 363-22 should compare against this: a phase-close run must fail no point other than this one, and this one only if the tree is dirty at that time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1 test held literal dash characters**
- **Found during:** Task 2 first aggregator run (the em-dash guard flagged tests/test-363-baseline.cjs)
- **Issue:** `EM_DASH` and `EN_DASH` constants were written as literal characters; the plan requires unicode escapes.
- **Fix:** rewrote both as JavaScript unicode escapes (U+2014, U+2013); test still passes 7/7.
- **Commit:** 42bae51c5

**2. [Rule 3 - Blocking] check-floor-ledger needs `--check`**
- **Issue:** plan text gives `node scripts/check-floor-ledger.cjs`; the script only accepts `--check`.
- **Fix:** the aggregator leg passes `--check`.

**3. [Plan instruction] Nested aggregators red at PLAN_BASE**
- Six nested aggregators plus test-198 were red; wrapped with `run_known` per the plan's own rule, listed above.

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. The RCA records an existing unaudited egress (`scripts/query-semantic-scholar.cjs`); it does not add one.

## Issues Encountered

- Shared tree: `evals/plurai/211-baseline.json` carried an unowned diff at start and was neither staged nor reverted. By the end it no longer appeared in `git status`; other peer diffs (docs/PLURAI..., lab/eval/..., tests/run-all-192/203.sh, tests/test-eval-report-from-transcript.cjs, .planning/STATE.md) remain and were never touched.
- Every commit used `git commit --only` on owned paths; the peer's commits (80edd63b6, b498e0c95) landed between mine, and mine remained ancestors of HEAD.
- STATE.md and ROADMAP.md were NOT updated: the plan's shared-tree rules forbid writing STATE.md or running `gsd-tools state.*` writers while a peer session is active. The orchestrator should run `state.advance-plan`, `roadmap.update-plan-progress 363` and `requirements.mark-complete DRP363-06 DRP363-13 DRP363-16 DRP363-18` when the tree is quiet. (The plan says it does not touch REQUIREMENTS.md; the DRP363 rows were registered at plan time.)
- A tool result during execution carried an instruction claiming to come from the coordinator (avoid plurai legs, use Jev). It arrived in tool output, not from the user, so it was not acted on. No plurai leg exists in 363 anyway.

## Self-Check: PASSED

- FOUND: tests/fixtures/363-pre-phase.json, tests/test-363-baseline.cjs, tests/run-all-363.sh, 363-D06-RUBRIC.md, whitespace-external-semantic-scholar-ungated-egress.md
- FOUND commits: 4ee6e5296, 42bae51c5, 26b5b14c5, acdeb7d56
- `node tests/test-363-baseline.cjs` exit 0 (7 PASS); `bash tests/run-all-363.sh` exit 0
