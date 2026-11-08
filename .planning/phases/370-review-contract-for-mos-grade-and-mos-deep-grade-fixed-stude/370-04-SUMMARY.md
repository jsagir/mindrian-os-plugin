---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 04
subsystem: review-contract
tags: [review-contract, owner-answers, data-only, tdd]
requires: [370-02, 370-03]
provides:
  - data/review-contract.json with the owner answers applied (owner_answers, enforcement block)
  - tests/test-370-answers.cjs (data agrees with the gate resolve output)
affects: [370-05, 370-06, 370-07, 370-09, 370-10]
key-files:
  created:
    - tests/test-370-answers.cjs
  modified:
    - data/review-contract.json
key-decisions:
  - "O1 WITHHOLD: the fixed shape carries no score table, score heading, letter-grade line or percentile."
  - "O2 KEEP: limits stays the empty object. No number was invented."
  - "O4A DROP: a Professor Perspective heading is a forbidden heading."
  - "O4B ANONYMIZE: no data change; recorded in owner_answers, acted on in plans 370-07 and 370-09."
  - "O3 EXEMPT-IF-IN-SOURCE, O6A BLOCKER, O6B LOG-ONLY, O8 FRONTMATTER recorded as data."
requirements-completed: [REV370-06]
completed: 2026-11-08
---

# Phase 370 Plan 04: Owner answers applied to the contract data Summary

The contract data now states what the owner decided, and a test ties each value to the output of 370-gate.cjs resolve. No code changed (lib/core/review-contract.cjs is untouched).

## Gate (PROVEN)

`370-gate.cjs gate-group` for G1, G2, G3: exit 0 each (ANSWERED-ACTION). `resolve` rows: O1=WITHHOLD, O2=KEEP, O4A=DROP, O4B=ANONYMIZE, O3=EXEMPT-IF-IN-SOURCE, O6A=BLOCKER, O6B=LOG-ONLY, O8=FRONTMATTER. The three O2-VALUE lines stay PENDING because O2 is KEEP.

## Commits

| Commit | Files |
|--------|-------|
| ca7d92de3 | data/review-contract.json |
| 239b0bb47 | tests/test-370-answers.cjs |

Not pushed. No tag, no version change, no dist regeneration.

## Data edits (mapping table)

- forbidden_headings: added `score_heading` (O1) and `persona_perspective` (O4A), each with a why that names the item.
- forbidden_body_patterns: added `score_table`, `letter_grade_line`, `percentile` (O1).
- soft_terms.policy: `exempt_if_in_source` (O3). The why text of soft_terms now records the answer.
- applies_to.classify: `frontmatter` (O8).
- enforcement: source `370-DECISION.md`, doctor_severity `blocker`, hook_mode `log-only`, door `frontmatter`.
- owner_answers: all eight items. limits: `{}`, no limits_source.
- Non-ASCII bytes in the file: 0.

## TDD record

RED: the new test ran against the contract of the commit before ca7d92de3 (env TEST_370_ANSWERS_CONTRACT):

```
FAIL A1 ... owner_answers missing
FAIL A2a ... forbidden_body_patterns ids for O1 WITHHOLD (got "", want "letter_grade_line,percentile,score_table")
FAIL A2b ... soft_terms.policy for O3 EXEMPT-IF-IN-SOURCE (got "strict", want "exempt_if_in_source")
FAIL A4a ... score table row must fail
FAIL A4b ... Professor Perspective heading must fail
PASS: 3 FAIL: 5
```

GREEN against the final data: `PASS: 8 FAIL: 0` (arms A1, A2a, A2b, A3, A4a, A4b, A4c, A5).

Order note: Task 1 (data) was committed before the test, as the plan orders the tasks. The RED proof used the earlier contract version, so it is a real failing run, not a mock.

## Verification (PROVEN)

- `node tests/test-370-contract-schema.cjs`: PASS 9 FAIL 0 (S6 limits guard included).
- `bash tests/run-all-370.sh`: Phase 370 PASS=7 FAIL=0 SKIP=0, exit 0 (checked by tail of the output; the scripts/check-review-contract.cjs target is MISSING by design until a later plan, the hook is OPTIONAL).
- `node tests/test-3696-reply-checks.cjs`: PASS 143 FAIL 0 (same as the baseline of 370-02).
- `node tests/test-265-deep-grade-rubric.cjs`: 8 passed, 0 failed.
- Part 11 gates: `build-connector-registry --check` OK, `build-orchestration-projection --check` OK, `check-render-coverage` 0 gap. `skill mirrors --check`: 112 match.
- post-fix fixture unchanged and still passes; pre-fix fixture still fails (A5, with and without source text).

## Deviations from Plan

None to the plan scope. One small addition: the answers test accepts an optional env var TEST_370_ANSWERS_CONTRACT (a path to a contract file). It exists to show the RED run. It has no effect when unset.

The worktree is a linked worktree on `main` by design (as in plans 370-01 and 370-02). Commits used `git add -f` on exact paths and `git commit --only`. The staged set held only the intended path before each commit.

## Notes for later plans

- Plan 370-05, 370-06 and 370-10 read `enforcement.door` (frontmatter), `enforcement.hook_mode` (log-only) and `enforcement.doctor_severity` (blocker).
- Plan 370-07 and 370-09 act on O4A DROP (no persona quote with a name) and O4B ANONYMIZE (other cohort projects named in calibration lines are anonymised). The contract data holds no rule for O4B.
- If the owner later sets O2 to SET-CAPS, the three O2-VALUE lines must hold numbers; test A3 then compares them with limits.

## Known Stubs

None.

## Threat Flags

None. Local files only, no network, no Brain call.

## Self-Check: PASSED

Files exist: data/review-contract.json, tests/test-370-answers.cjs. Commit ca7d92de3 exists. Test commit exists (git log).
