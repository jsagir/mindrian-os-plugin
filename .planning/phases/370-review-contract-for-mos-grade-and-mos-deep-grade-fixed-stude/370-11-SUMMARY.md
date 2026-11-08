---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 11
subsystem: review-contract
tags: [review-contract, tri-polar, acceptance, release-gate]
requires: [370-04, 370-05, 370-06, 370-07, 370-08, 370-09, 370-10]
provides:
  - "tests/test-370-tripolar.cjs (arms T1 to T6): one fixture through the module, wrapper, filing door and hook"
  - "370-ACCEPTANCE.md: Tri-Polar table, Lawrence rubric record, before and after, carry-over list"
  - "tests/run-all-370.sh registered as a hard run line in tests/run-all-366.sh"
affects: []
key-files:
  created:
    - tests/test-370-tripolar.cjs
    - .planning/phases/370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude/370-ACCEPTANCE.md
  modified:
    - tests/run-all-366.sh
key-decisions:
  - "The hook is in LOG-ONLY mode by owner answer O6B. The parity test proves the enforce path on a temp contract copy and the shipped mode on the real contract."
  - "Cowork is reported PASS on the shared code path and UNVERIFIED for live behavior (no Cowork host)."
requirements-completed: [REV370-12, REV370-04]
completed: 2026-11-08
---

# Phase 370 Plan 11: Phase close (Tri-Polar parity, acceptance record, release-suite line)

STATUS: DONE. All gates in this plan pass. The person-judged rubric items are marked UNVERIFIED by code.

## Result in five lines

1. One parity test shows the same (rule, class, line) triples through the module, the CLI wrapper, the MCP filing door and the Write hook.
2. No door was declined. The door is on (O8 FRONTMATTER), the hook is on in LOG-ONLY (O6B), the doctor gate is a BLOCKER (O6A).
3. `TEST_370_REQUIRE_ALL=1 bash tests/run-all-370.sh` gives PASS=14 FAIL=0 SKIP=0.
4. `tests/run-all-370.sh` is a hard run line in `tests/run-all-366.sh`.
5. Open: the carry-over list in 370-ACCEPTANCE.md (filing folder, dist rebuild at release, hook limits, no-frontmatter escape, human rubric items).

## Gate (owner answers)

Owner answers of 2026-11-08 were already applied by plan 370-04: G1 O1=WITHHOLD O2=KEEP O4A=DROP O4B=ANONYMIZE; G2 O3=EXEMPT-IF-IN-SOURCE; G3 O6A=BLOCKER O6B=LOG-ONLY O8=FRONTMATTER. No gate declined this plan. BASE = adf5939cc9831001f53b1ca7e31883ec412d7373 (written to 370-11-BASE.txt, ignored, untracked).

## Commits

| Commit | Files |
|--------|-------|
| 4e542d907 | tests/test-370-tripolar.cjs |
| see below (Task 2 commit) | 370-ACCEPTANCE.md, 370-11-SUMMARY.md, tests/run-all-366.sh |

Not pushed. No tag, no version change, no dist regeneration.

## TDD note

This plan adds no production code, so a classic RED run does not exist. The RED proof is a mutation check: a copy of the new test with one wrapper triple dropped and the hook wiring name changed failed arms T1 and T3 (PASS 4, FAIL 2, exit 1). The copy was deleted. The real test passes 6 of 6.

## Gate results (PROVEN, run in this session)

| Command | Result |
|---------|--------|
| node tests/test-370-tripolar.cjs | PASS 6 FAIL 0 |
| TEST_370_REQUIRE_ALL=1 bash tests/run-all-370.sh | PASS=14 FAIL=0 SKIP=0 |
| check-review-contract.cjs check pre-fix.md | exit 1, RESULT FAIL 13 |
| check-review-contract.cjs check post-fix.md | exit 0, OK review-contract v1 |
| node tests/test-3696-reply-checks.cjs | PASS 143 FAIL 0 |
| node tests/test-265-deep-grade-rubric.cjs | 8 passed, 0 failed |
| node tests/test-383-sourced-number.cjs | FAIL on U1 only: baseline, hit in commands/file-meeting.md line 1197 (not a Phase 370 file) |
| build-skill-mirrors --check | OK (112 mirrors) |
| build-connector-registry --check | OK |
| build-orchestration-projection --check | OK |
| check-render-coverage | 0 gap |
| check-plugin-path-anchoring | 0 violations |
| doctor --acceptance --only=coverage-gate | PASS 1/1 (baseline PASS 1/1, not worse) |
| bash -n tests/run-all-366.sh | OK |
| dist guard | BASE non-empty; git diff --name-only BASE HEAD -- dist empty; git log --grep='(370-' -- dist empty; no status on the four dist skill folders |

## Baselines

The three baselines of the plan: test-3696-reply-checks (143/0), test-265-deep-grade-rubric (8/0) and test-383-sourced-number (U1 fails as before; not caused by Phase 370). Doctor coverage-gate point: not worse.

## Declined plans

None.

## Carry-overs

Full list with next steps: 370-ACCEPTANCE.md section 5. In short: dist copies stale on purpose until the release rebuild; filing folder and `produces` differ between the two commands (owner question); --full roll-up has no scores (O1); the rewording of a teaching-backend query may change its answer (UNVERIFIED, no backend call); hook skips parent-folder cases (H10e) and does not cover Edit or MultiEdit; a review with no frontmatter escapes door and hook (O8); command-picker text "100+ student calibration"; the other review writers; no taught-terms list.

## Deviations from Plan

None. The registration was made because `git status --short tests/run-all-366.sh` was empty before the edit.

## Unverified

- Live Cowork and Desktop behavior (no host here). The door is the shared code path.
- The person-judged Lawrence items: short, taught terms only, plain-word definitions, anonymized named projects (O4B).
- Full `doctor --acceptance` and the whole of run-all-366.sh were not run (long); only the coverage-gate point and run-all-370.sh.
- A live Larry run against a real student team; the fixture is built, not a live review.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, no network, no file written outside tests and .planning.

## Self-Check

- tests/test-370-tripolar.cjs, 370-ACCEPTANCE.md present; commit 4e542d907 exists on main.
- No U+2013 or U+2014 in the touched files.
- STATE.md, ROADMAP.md and REQUIREMENTS.md not touched.
