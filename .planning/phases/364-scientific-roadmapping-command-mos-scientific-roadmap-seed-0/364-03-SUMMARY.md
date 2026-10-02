---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 03
subsystem: theo-wire-door, honest-refusal
tags: [theo, framework-step, honest-refusal, part8, refusal-messaging, tdd]
requires: [364-01]
provides:
  - "lib/core/research-planner/sr-steps.cjs: HANDLE, REFUSAL_TEXT, NON_RUNNABLE, STEP_FIELDS, COVERAGE_PROBLEM_TYPE, readSrSteps, readCoverage, renderStatus"
  - "kindForTheoRefusal / THEO_REFUSAL_TO_KIND in lib/core/refusal-messaging.cjs (not_scored -> not_ready)"
  - "tests/helpers/fake-brain-364.cjs installFakeBrain (in-process and --require preload)"
  - "seven Theo fixtures under tests/fixtures/364-theo/"
affects: [364-05, 364-08, 364-09]
key-files:
  created:
    - lib/core/research-planner/sr-steps.cjs
    - tests/helpers/fake-brain-364.cjs
    - tests/test-364-refusal-not-scored.cjs
    - tests/test-364-sr-steps.cjs
    - tests/fixtures/364-theo/framework-step-all-null.json
    - tests/fixtures/364-theo/framework-step-authored.json
    - tests/fixtures/364-theo/framework-step-one-null.json
    - tests/fixtures/364-theo/framework-step-unlabelled-seven.json
    - tests/fixtures/364-theo/framework-step-eight-unlabelled.json
    - tests/fixtures/364-theo/recommend-chain-thin.json
    - tests/fixtures/364-theo/recommend-chain-covered.json
  modified:
    - lib/core/refusal-messaging.cjs
decisions:
  - "readSrSteps checks result.refusal.code BEFORE classifyCallResult, because the shared classifier looks for a plural refusals key and would call a singular refusal no_steps_in_canon"
  - "Null label or runIt refuses at the first unauthored runnable row; the module has no fallback branch and never names the local template"
  - "readCoverage walks name, framework, frameworkName and title strings (500 node cap) and returns only status; the chain is never returned"
requirements: [SRM364-06, SRM364-11, SRM364-19]
metrics:
  tasks: 3
  files: 12
  completed: 2026-10-02
---

# Phase 364 Plan 03: Theo step reader, honest refusal, coverage read Summary

One small module is the command's whole contact with Theo: it reads Scientific Roadmapping steps exactly as Theo serves them, refuses with "Theo has not authored this step yet" on the measured all-NULL state, and states thin WellDefined coverage as "uncovered" without ever returning a chain.

PLAN_BASE: `e32b1bdbb685e1aa61e9711b853e313b088cfb33`

## Commits

| Task | Phase | Commit | Files |
|------|-------|--------|-------|
| 1 | RED | 4c5477841 | tests/test-364-refusal-not-scored.cjs |
| 1 | GREEN | ae936bf00 | lib/core/refusal-messaging.cjs (+23) |
| 2 | RED | 3c3414bc1 | 7 fixtures, tests/helpers/fake-brain-364.cjs, tests/test-364-sr-steps.cjs |
| 3 | GREEN | a934f84cd | lib/core/research-planner/sr-steps.cjs |

All four made with `git commit --only <paths>` and verified as ancestors of HEAD. TDD gate order holds: `test(...)` RED commit precedes each `feat(...)` GREEN commit.

## What was built

- Task 1: `THEO_REFUSAL_TO_KIND` (frozen, one key) and `kindForTheoRefusal` below the REFUSAL_KINDS line; `REFUSAL_KINDS` untouched (still the six kinds, test-250 green). Own-property check, so `constructor` and `__proto__` return null.
- Task 2: fixtures. The all-null fixture is the measured 2026-10-02 payload (seven null steps, verdict `ambiguous` as measured). The authored fixture has nine rows with DEFINITION at index 1, ASIDE at index 6, one null-stepKind runnable row, and descending sourceOrder so a sort would reverse the list. All runIt text is plainly `FIXTURE ..., not canon`. The fake brain swaps `require.cache` exports in-process and has a `--require` preload mode logging `{calls, net_attempts}`.
- Task 3: `sr-steps.cjs` per the published contract. Only `{framework:'Scientific Roadmapping'}` is sent; recommend_chain gets `('WellDefined', 6)`; the brain client is a lazy require inside a function or `opts.brainClient`; classification reuses `classifyCallResult` from theo-structure (not edited).

## Verification (measured)

- `node tests/test-364-refusal-not-scored.cjs`: PASS 7 FAIL 0
- `node tests/test-364-sr-steps.cjs`: PASS 37 FAIL 0 (S1-S13 plus a preload-mode leg and zero network attempts)
- `node tests/test-250-refusal-shapes.cjs` and `node tests/test-361-theo-structure.cjs`: exit 0
- Acceptance greps: forbidden-word count 0, dash-byte count 0, no top-level brain-client require, REFUSAL text present.

## Deviations from Plan

None - plan executed exactly as written. (A stray empty-variable shell redirect in one scratch command failed harmlessly and created no file.)

## Known Stubs

None. Fixture strings are deliberately marked `not canon` and live only under tests/.

## Threat Flags

None. T-364-08 (MARKER-364 never reaches a call, S6), T-364-09 (seven-field whitelist, 200/4000/2000 caps, 50-row cap, no step_id input, S8), T-364-10 (typed refusal, no fallback, S11), T-364-11 (membership-only, chain never returned, S9) are mitigated and tested.

## Notes for the orchestrator

STATE.md and ROADMAP.md were not touched. No peer-owned file was staged or modified. The new files are `.planning`-independent and were added with `git add -f` only where the repo ignore rules required it.

## Self-Check: PASSED

- FOUND: lib/core/research-planner/sr-steps.cjs, tests/helpers/fake-brain-364.cjs, both 364 tests, seven fixtures
- FOUND commits: 4c5477841, ae936bf00, 3c3414bc1, a934f84cd (all ancestors of HEAD)
