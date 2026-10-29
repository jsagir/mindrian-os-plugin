---
phase: 314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command
plan: 08
subsystem: eureka
tags: [aggregator, acceptance, changelog, canon-ledger, shared-files, last-plan]

requires:
  - phase: 314-01 to 314-07
    provides: every 314 test, the command, the registries, the calibration record
provides:
  - "tests/run-all-314.sh: the phase gate (PASSED=43 FAILED=0 SKIPPED=0 KNOWN=3)"
  - "One CHANGELOG Added bullet for /mos:eureka-portfolio"
  - "One Part 7 row and one Part 11 row in docs/CANON-PHASE-MAP.md"
affects: []

key-files:
  created:
    - tests/run-all-314.sh
  modified:
    - CHANGELOG.md
    - docs/CANON-PHASE-MAP.md
    - data/render-coverage-registry.json
    - .planning/phases/314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command/314-05-PLAN.md

key-decisions:
  - "The aggregator moves only reds that were already red at the phase base into run_known_if, each with its literal signature. No new red was moved."
  - "The CHANGELOG bullet states that the top-of-list change is not announced yet and why (no room met the calibration bar)."

requirements-completed: [PM314-11, PM314-01, PM314-03, PM314-08, PM314-09]

completed: 2026-10-29
---

# Phase 314 Plan 08: Aggregator, Acceptance and Shared-File Close Summary

**One aggregator proves the phase (PASSED=43 FAILED=0 KNOWN=3), and the CHANGELOG bullet plus two canon map rows are committed with --only after the shared-file check.**

## Task Commits

| Task | Commit | Type |
|------|--------|------|
| 1 (fix found by the sweep) | f42e4709d | fix(314-08): regenerate the render coverage registry |
| 1 (fix found by the sweep) | 1affb37aa | docs(314-05): declare the cirs_relationship block |
| 1 | 3ead636ef | feat(314-08): tests/run-all-314.sh |
| 2 | none | checkpoint: shared-file check, cleared by the main session |
| 3 | 08f6eacc0 | docs(314-08): CHANGELOG bullet and canon map rows |

## Baseline taken before the aggregator (PROVEN)

- run-all-213: PASS=8 FAIL=0. run-all-215: PASS=6 FAIL=0.
- run-all-216: PASS=8 FAIL=1 (216-03 shape declaration strict, signature "strict mode: exiting 1"). Old red from 366-22.
- run-all-364, first run: PASSED=57 FAILED=4 KNOWN=3. Four of these reds were new and came from this phase (deviation 1). After the fix: PASSED=61 FAILED=0 KNOWN=3.
- doctor --acceptance with temp HOME: 18/24. Failed set: install-state, deployment-surfaces, version-of-record-published, session-start-active-version, verify-release-clean-tree, activation-reached-the-wire. The set is identical before and after this plan. Cause: temp HOME and a dirty shared tree. No new blocker.

## Aggregator result (PROVEN, final run after the shared-file commit)

`bash tests/run-all-314.sh` exits 0: PASSED=43 FAILED=0 SKIPPED=0 KNOWN=3. About 13 seconds. Legs: 13 phase tests, 19 regression guards, 9 governance gates, a shape-declaration name check, CIRS over the 314 plans, a dash fence over the phase files.

The 3 known reds, with their old signatures:

1. connector part8 boundary: `connector mcp:artifact_file carries off-schema field "layer"`
2. 267 mcpv2 zod4 contract: `observed zod-4 diff set equals pinned accepted set` (25 eureka_* and rs_* membership extras). The Check (b) output is byte-identical at base 7699ebdb4 (extracted to a scratch folder) and at HEAD. No 314 plan caused it.
3. shape declaration strict: `strict mode: exiting 1`

## Deviations from Plan

**1. [Rule 1 - Bug] data/render-coverage-registry.json was stale**
- **Found during:** Task 1 baseline of run-all-364.
- **Issue:** Plan 314-05 added commands/eureka-portfolio.md and skills/eureka-portfolio/SKILL.md without regenerating the render coverage registry. The in-memory diff was exactly those 2 entries (md_declared_wired 96 to 97, skill_declared_wired 102 to 103).
- **Fix:** `node scripts/build-render-coverage.cjs`. This cleared "364 registry gates G1", "364 entry points P4", "b1 reconcile canonical" and "render coverage --check".
- **Files modified:** data/render-coverage-registry.json
- **Commit:** f42e4709d

**2. [Rule 2 - Missing critical functionality] 314-05-PLAN.md had no cirs_relationship block**
- **Found during:** first run of the aggregator (CIRS leg). The plan adds a command and a skill, so the R12 gate (check-cirs-declaration) requires the block.
- **Fix:** frontmatter block only. No task text changed. The gate now gives OK for 8 plans.
- **Files modified:** 314-05-PLAN.md
- **Commit:** 1affb37aa

**3. [Info] The 267 zod4 contract leg is KNOWN, not PASSED.** It was first written as a normal leg and failed. Proven old (see above), then moved to run_known_if with its signature.

## Must-have checks (PROVEN)

- SENSOR_REGISTRY_IDS length is 23. SENS-13 appears once.
- `git diff --name-only 7699ebdb4..HEAD -- lib/core/insight-sensors.cjs lib/core/navigation-engine.cjs lib/mcp/tools/sensors.cjs` prints nothing.
- scripts/eureka-portfolio-report.cjs and scripts/eureka-command.cjs are absent.
- Dash scan: 0 hits in every file this phase created and in the 3 added lines of Task 3.
- `check-shape-declaration.cjs --check` exits 0 and no line names eureka-portfolio.

## Shared-file check (Task 2)

Before the edit, `git status --porcelain CHANGELOG.md docs/CANON-PHASE-MAP.md` printed nothing, checked by the main session and again by this executor. The other running executors (359 batch, 341-06) do not edit these files. Commit used `git commit --only` on the two files. The commit adds 3 lines and deletes none.

## Outcome of the thresholds degrade

The navigator accepted the degrade on 2026-10-28 (314-07-SUMMARY.md sign-off line, filled). Thresholds stay calibrated false with reason no_qualifying_room; the bar was not lowered. The CHANGELOG bullet says in one plain sentence that changes in the order of the top of the list are not announced yet, because no real room was large enough to set a fair limit, and that the trigger stays off until a room qualifies for calibration.

## Canon guards after the edit

- tests/test-canon-part-9-ratification.cjs: 9/9 passed.
- tests/test-canon-crossref-completeness.cjs: exits 1 with 2 FAIL lines: it wants a "### Part 9 (proposed)" heading in CANON-PHASE-MAP.md and wants MINDRIAN-CANON.md unedited for Part 9. Both are Phase 108 expectations that Part 9 ratification made stale. PROVEN pre-existing: the HEAD version of CANON-PHASE-MAP.md before this edit has 0 matches for that heading, and my 2 added rows do not touch Part 9. Not fixed here (out of scope). The plan wording "fix the text, not the guard" does not apply, because the text under test is not text this plan wrote.
- No tests/test-*changelog* file exists.
- `grep -c eureka-portfolio CHANGELOG.md` gives 2.

## Deferred Issues

- tests/test-canon-crossref-completeness.cjs holds stale Phase 108 checks (above).
- tests/test-check-render-coverage.cjs was red before this phase (expects 15 entries, tree has 17) and crashed with a Node error on one run. Not triaged.
- tests/test-347-visualize-real-chain.cjs Test 7 (from the 314-05 note). Not run here, not an aggregator leg.

## Known Stubs

None.

## Threat Flags

None. T-314-33 (shared files) is mitigated by the clean-status check, the human step and `git commit --only`. T-314-34 (known reds) is mitigated: each known leg quotes its old signature and one was proven old against the phase base. T-314-35: the bullet has product words only, no room name and no count from a real room.

## Self-Check: PASSED

- Files exist: tests/run-all-314.sh, this SUMMARY (PROVEN).
- Commits f42e4709d, 1affb37aa, 3ead636ef and 08f6eacc0 are in the branch log of feat/eureka-adapter-rebased (PROVEN by `git log`).
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.
