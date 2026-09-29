---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
plan: 09
subsystem: part8-egress-guard
tags: [part8, egress-guard, known-tool-shape, case_story, theo, gap-closure]

# Dependency graph
requires:
  - phase: 361-02
    provides: "framework_step / framework_techniques / case_story known-shape arms and the Theo parity tripwire"
provides:
  - "case_story Part 8 arm matching Theo 20.1-04's exactly-one-of {case_name | framework_name} input"
  - "Theo parity Leg 4a-4d: full pin of case_story keys, optionality, handle schema and exactly-one-of"
affects: [361-10, theo-20.1-16-registration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exactly-one-of at a Part 8 arm: exact key set with an empty required list, then a hasOwnProperty equality check that sends neither/both to the terminal ambiguous"
    - "Free-label key without a local closed vocabulary gets the find_connections proof (_isSafeShortLabel) plus the provider's own charset regex"
    - "Parity tripwire proven by mutating a mkdtemp COPY of the provider source, never the provider checkout"

key-files:
  created: []
  modified:
    - "lib/core/part8-egress-guard.cjs"
    - "tests/test-361-egress-shapes.cjs"
    - "tests/test-361-theo-parity.cjs"

key-decisions:
  - "Followed Theo's source over the UAT diagnosis: both keys are optional and sending both is refused, so the arm proves exactly {framework_name} or {case_name}, never the both-keys shape (planner correction, not re-derived)"
  - "framework_name is canonical-strict (D-10, _isKnownFrameworkHandle); case_name is the find_connections free-label proof plus FRAMEWORK_NAME_RE, with the 120-char cap stricter than Theo's 128"
  - "D-15 {framework} guess retired; it now falls to ambiguous, never allow"

patterns-established:
  - "When a provider tool enforces exactly-one-of in its handler, the Part 8 arm mirrors it and declines the refused shapes rather than allowing a superset"

requirements-completed: [DDR361-10]

# Metrics
duration: 20min
completed: 2026-09-29
---

# Phase 361 Plan 09: case_story Part 8 arm matches Theo 20.1-04 Summary

The case_story egress arm now proves exactly the two shapes Theo 20.1-04 serves (`{framework_name: <canonical framework>}` and `{case_name: <safe free label>}`), declines the retired D-15 `{framework}` guess and the both-keys shape Theo refuses with EXACTLY_ONE_OF, and the Theo parity test pins all four aspects of that contract.

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-09-29
- **Tasks:** 2/2
- **Files modified:** 3

## Parallel-session record

- PLAN_BASE: `cb978ae5224b960360e8fe79477c26c011dae3b0`
- Owned files were clean at plan start (`git status --short` on all three printed nothing).
- A peer diff on `.planning/REQUIREMENTS.md` appeared during execution; not mine, left untouched and never staged.
- Theo checkout moved from e501bbe to d28f4ee during execution (a docs-only commit adding Phase 20.4); `git diff --stat e501bbe HEAD -- src/mcp/content/` is empty, so the case-story.ts contract this plan pins is unchanged.

## Accomplishments

- `lib/core/part8-egress-guard.cjs` case_story arm: `_hasExactKeys(payload, [], ['case_name', 'framework_name'])`, then neither/both returns null, then framework_name via `_isKnownFrameworkHandle` (reason `case_story canonical framework handle`) or case_name via `_isSafeShortLabel` plus `FRAMEWORK_NAME_RE` (reason `case_story case_name label`). Docblock item 9 and the FRAMEWORK_NAME_RE comment block updated in place. No other arm, classify(), `_isKnownFrameworkHandle`'s body, regex literal or export changed.
- `tests/test-361-egress-shapes.cjs`: allow legs for framework_name (both casings) and case_name; not-allow legs for the retired {framework} key, both keys, extra keys, step_id, off-vocabulary framework_name, numeric / empty / multi-line / 121-char / colon case_name, and tool-name isolation; block legs (email case_name, email framework_name, venture proper noun case_name) with direct `_proveKnownToolShape === null` checks; hook legs C (clean, exit 0, no ambiguous text) and D (content, exit 2). 121 assertions, PASS.
- `tests/test-361-theo-parity.cjs`: `pluginArmKeyLists` returns `{required, optional}`, `pluginArmKeys` is a thin union wrapper (Legs 1-3 unchanged in behavior); Leg 4 split into 4a keys, 4b optionality, 4c handle schema, 4d exactly-one-of, plus the informational `case_story registered on this Theo checkout: no` line. 8 checks, PASS; ENV GAP exit 77 path intact; zero writeFileSync / execSync / spawnSync.

## Task Commits

1. **Task 1: case_story arm rewrite (TDD RED then GREEN in one commit)** - `a8ef4df8e` (fix) - ancestor of HEAD verified
2. **Task 2: parity Leg 4a-4d** - `7a685fc24` (test) - ancestor of HEAD verified

RED was observed before GREEN (`case_story by framework_name: expected verdict "allow", got ambiguous`), but the plan's action text prescribes a single commit for Task 1 covering both files, so no separate `test(...)` RED commit exists. This is per plan, not a gate skip.

## Tripwire mutation runs (Task 2)

Both ran against a mkdtemp copy under the session scratchpad holding framework-step.ts, framework-techniques.ts, vocabulary.ts and case-story.ts copied read-only from /home/jsagi/Theo; the copies were deleted afterward.

| Mutation on the COPY | Exit | Failing leg |
|----------------------|------|-------------|
| `EXACTLY_ONE_OF` removed from case-story.ts | 1 | `Leg 4d ... theoExactlyOneOf=false` (PASSED=7 FAILED=1) |
| `.optional()` removed from handle() | 1 | `Leg 4b ... handle().optional():false` (PASSED=7 FAILED=1) |

`git -C /home/jsagi/Theo status --short -- src/mcp/content` was identical before and after.

## Pre-existing non-361 failures (before and after, unchanged)

| Suite | Before | After |
|-------|--------|-------|
| `tests/test-260906-fda-known-tool-shapes.cjs` | one `FAIL:` line: `shipped brain_ask methodology question (unproven free-form tokens): expected verdict "ambiguous"` | identical |
| `lib/core/part8-egress-guard.test.cjs` | first AssertionError `PB8-03: generic framework question must ALLOW` | identical |
| `tests/test-209-declared-implies-wired.cjs` | `if this list changed: ...`, diff `-   'commands/brain-derive.md',` and `-   'skills/brain-derive/SKILL.md',`, no `+   '` lines | identical |

## Acceptance checks

- `node tests/test-361-egress-shapes.cjs` exit 0 (LEG 3, LEG 4 including a8ef4df8e, LEG 5, hook C and D)
- Inline `node -e` classify check exit 0
- `node tests/test-361-theo-parity.cjs` exit 0; `MINDRIAN_THEO_CHECKOUT=/nonexistent` exit 77 with ENV GAP
- `grep -c "_hasExactKeys(payload, \[\], \['case_name', 'framework_name'\])"` = 1
- non-comment `_hasExactKeys(payload, ['framework'], [])` count = 1 (framework_techniques only)
- `git diff PLAN_BASE -- lib/core/part8-egress-guard.cjs` removed lines only in the old case_story arm, its D-15 comment, docblock item 9 and the FRAMEWORK_NAME_RE comment

## Planner correction to the UAT fix direction

The UAT diagnosis said "both required" and "stop calling case_story from theo-structure". Theo's source (case-story.ts, 20.1-04-SUMMARY lines 47-50) says both keys are optional at the wire and the handler refuses neither-or-both with EXACTLY_ONE_OF. A both-required arm would allow the one shape Theo refuses and decline the two it serves, and dropping the call would drop locked D-09 behavior. This plan followed Theo's source and D-09; the theo-structure half is 361-10.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Next Phase Readiness

361-10 (theo-structure half: send `{framework_name}` to case_story) can proceed; the guard now allows that exact shape. The full `bash tests/run-all-361.sh` gate runs in 361-10.

## Self-Check: PASSED

- FOUND: lib/core/part8-egress-guard.cjs, tests/test-361-egress-shapes.cjs, tests/test-361-theo-parity.cjs
- FOUND: a8ef4df8e, 7a685fc24 (both ancestors of HEAD)
