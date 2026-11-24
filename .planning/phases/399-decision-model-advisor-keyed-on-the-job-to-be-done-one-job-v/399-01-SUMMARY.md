---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 01
subsystem: decision-advisor-vocabularies
tags: [job-vocabulary, problem-axes, drift-test, additive]
requires: []
provides:
  - data/job-vocabulary.json (20 job ids with summaries, schema mos.job-vocabulary/1)
  - lib/core/problem-axes.cjs (two-axis problem type, derived four-value view)
  - ambient-framing export extractExplicitProblemType
  - problem-type-router export axesFromSections
affects: [399-04, 399-06]
tech-stack:
  added: []
  patterns: [closed vocabulary pinned by drift test with mutation control, derived compatibility view]
key-files:
  created:
    - data/job-vocabulary.json
    - lib/core/problem-axes.cjs
    - tests/test-399-job-vocabulary.cjs
    - tests/test-399-problem-axes.cjs
    - tests/run-all-399.sh
  modified:
    - lib/core/ambient-framing.cjs
    - lib/core/problem-type-router.cjs
decisions:
  - "Wicked maps to ill-defined in fromFourValue (book ruling: Wicked is the sharpest edge of Ill-Defined); the Cynefin rating stays null."
  - "A missing wicked signal is null, never false (wicked can sit on any definition level)."
  - "readRoomAxes returns the all-null shape when STATE.md has no explicit field, not source 'state'."
  - "problem-type-router implements the type to level map locally to stay pure (no require of ambient-framing)."
metrics:
  tasks: 2
  files: 7
  completed: 2026-11-24
---

# Phase 399 Plan 01: Job vocabulary and two-axis problem type Summary

One closed list of 20 job ids (with summaries) pinned by a drift test, plus an additive two-axis problem type whose derived four-value view matches today's precedence on the full grid.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | One job vocabulary file and drift test (D-01, I-01) | 4a804d1ff |
| 2 | Two-axis problem type, additive (D-06, I-10) | cbcc01913 |

## What was built

- `data/job-vocabulary.json`: 20 sorted ids; 13 taxonomy summaries copied verbatim; 7 new summaries (temporal-correction, build, navigate from phase 399; 4 section-canon jobs). Each job carries origins.
- `tests/test-399-job-vocabulary.cjs`: legs V1-V9 pin the registry, taxonomy, section canon, ledger, selection eval cases and section-registry JOB_VOCABULARY to the file. V8 mutates an in-memory registry and the membership check reports the bad id.
- `lib/core/problem-axes.cjs`: definition_level and wickedness axes, plus fromExplicitClassification, fromFourValue, fromPersonaType, toFourValue, readRoomAxes.
- `tests/test-399-problem-axes.cjs`: legs A1-A8. A3 compares toFourValue against a copy of the ambient-framing precedence on all 20 grid cells. A7 compares router outputs for 12 fixed inputs against a baseline taken before the change.
- `tests/run-all-399.sh`: phase runner, two tests.

## Deviations from Plan

None. Plan executed as written.

Note: the plan acceptance line for `tests/test-392-vocabulary-drift.cjs` does not apply; the file does not exist in this tree.

## Verification

- `bash tests/run-all-399.sh`: both tests PASSED.
- Brain wire vocabulary, Part 8 guard, brain-router, brain-shape-packet, jtbd-taxonomy, registry builder and command registry: no diff against base 24d5ccb6a.
- ambient-framing diff is one added export line.
- Regression: test-3551-framing, test-3551-part8-egress, test-3551-chokepoint, test-355-part8-egress exit 0.
- lib/memory/problem-type-router.test.cjs: 21/24 both with and without this change (tests 22-24 fail at base; pre-existing, out of scope, deferred).

## Known Stubs

None.

## Threat Flags

None. No new network surface; readRoomAxes returns enums or null only.

## Self-Check: PASSED

- data/job-vocabulary.json, lib/core/problem-axes.cjs, both tests and the runner exist.
- Commits 4a804d1ff and cbcc01913 exist on work/399-decision-advisor.
