---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
plan: 10
subsystem: dominant-design
tags: [theo, case_story, degrade, command-contract, sens-09, gap-closure, dominant-design]

# Dependency graph
requires:
  - phase: 361-09
    provides: "Part 8 case_story arm proving {framework_name: <canonical>} as known_tool_shape"
  - phase: 361-05
    provides: "theo-structure reader and its degrade logic"
  - phase: 361-07
    provides: "command-contract test for commands/dominant-designs.md"
provides:
  - "theo-structure sends {framework_name: 'Dominant Design'} to case_story via a frozen CALL_ARG_KEY map"
  - "honest no_case_in_canon outcome for a case_story answer with no case (cases [] never [{}])"
  - "command-contract sensor_triggers pin tracking quick-260923-u8v ([SENS-06, SENS-09])"
affects: [theo-20.1-16-registration, docs-open-handoffs-item-4, requirements-ddr361-09-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-tool arg key map (frozen) with a constant value: the only thing that varies per call is the key name, never the value source"
    - "A served payload with no content is its own named outcome (no_case_in_canon), sibling of no_steps_in_canon"

key-files:
  created: []
  modified:
    - "lib/core/dominant-design/theo-structure.cjs"
    - "tests/test-361-theo-structure.cjs"
    - "tests/test-361-cli.cjs"
    - "tests/test-361-command-contract.cjs"

key-decisions:
  - "Kept the case_story call and corrected its key (planner correction to the UAT): Theo's by-framework path is the D-09 worked-case read, so dropping the call would silently drop locked behavior"
  - "DDR361-09/10 amendment deferred: .planning/REQUIREMENTS.md held a peer's uncommitted Phase 362 diff for the whole plan, so per the plan's own STOP-and-defer rule the test fix was committed alone"

patterns-established:
  - "When a shared planning file carries a peer's uncommitted diff, commit owned code alone and record the planning edit as owed rather than sweeping the peer's work"

requirements-completed: [DDR361-09, DDR361-10, DDR361-11]

# Metrics
duration: 25min
completed: 2026-09-29
---

# Phase 361 Plan 10: theo-structure case_story by framework_name, SENS-09 pin, suite gate Summary

theo-structure now asks Theo for Dominant Design's worked case exactly the way Theo 20.1-04 accepts it (`{framework_name: 'Dominant Design'}`, never a case name, never room content), reports a missing case as `no_case_in_canon` instead of presenting an empty object as a case, and the command-contract test follows the SENS-09 ruling; the full 361 suite measures PASSED=26 FAILED=3 SKIPPED=0 with only the three pre-existing non-361 legs failing.

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-09-29
- **Tasks:** 2/2 (Task 2's REQUIREMENTS.md half deferred, see below)
- **Files modified:** 4

## Parallel-session record

- PLAN_BASE: `b9cf19a939366696769f48b243a8c65d84d2dc9e` (361-09 SUMMARY commit)
- Pre-flight: `grep -c "case_story case_name label" lib/core/part8-egress-guard.cjs` = 1 (361-09 landed); Task 1 and Task 2 test files were clean.
- `.planning/REQUIREMENTS.md` carried a peer's uncommitted diff (+53/-4, new "Phase 362 - Card gate text-dependent relevance false block (CARD362 family)" section) at plan start and was still dirty after the suite gate. Not mine; never edited, staged, or committed.

## Accomplishments

- `lib/core/dominant-design/theo-structure.cjs`: frozen `CALL_ARG_KEY` (framework_step and framework_techniques -> `framework`, case_story -> `framework_name`), exported; the loop builds a fresh one-key object `{[CALL_ARG_KEY[tool]]: HANDLE}` per call with nothing from opts; `classifyCallResult` gains the case_story rule (not a non-array object, `grounded === false`, or no non-empty string title -> `no_case_in_canon`), after the framework_step no-steps check and after the earlier refused / not_served / shape_refused checks; header PART 8 LINE and D-15 paragraphs and `_caseSource`'s comment updated. HANDLE, TOOLS, NOT_FOUND_RE, SHAPE_REFUSED_RE, parseReferencePhases, `_pickCase`'s whitelist and the lazy brain-client require are unchanged.
- `tests/test-361-theo-structure.cjs`: Legs 1+2 and 8 assert per-tool args and no case_name; Leg 7 uses Theo 20.1-04's grounded shape and proves lesson/domain/framework/grounded/coverage are dropped; Leg 10 pins CALL_ARG_KEY; new Legs 12 (grounded:false), 13 (EXACTLY_ONE_OF and FRAMEWORK_NOT_FOUND refusals) and 14 (titleless payload, rows-wrapped case). 13 legs pass.
- `tests/test-361-cli.cjs`: offline leg asserts per-tool args and no case_name. All legs pass.
- `tests/test-361-command-contract.cjs`: Leg 2 pins `[SENS-06, SENS-09]` with a comment citing quick-260923-u8v (8c6771ef5); leg renamed. PASSED=20 FAILED=0.
- Belt check: `classify({framework_name: 'Dominant Design'}, {toolName: 'case_story'})` = `allow / known_tool_shape / case_story canonical framework handle`.

## Task Commits

1. **Task 1: theo-structure case_story by framework_name + no_case_in_canon** - `e4131a5b9` (fix) - ancestor of HEAD verified. RED observed first (`Leg 1: args is exactly the per-tool generic handle for case_story`, CLI args leg FAIL), then GREEN; one commit per the plan's action text.
2. **Task 2: SENS-09 pin** - `e42120564` (fix) - ancestor of HEAD verified. Subject shortened to `fix(361-10): SENS-09 pin per quick-260923-u8v` because the REQUIREMENTS.md half was not in the commit.

## Suite gate

`bash tests/run-all-361.sh` -> `PASSED=26 FAILED=3 SKIPPED=0`.

- `>>> 361: Theo input-shape parity (361-02, D-10/D-14): PASSED`
- `>>> 361: command contract (361-07, D-11/D-12/D-13): PASSED`
- `>>> 361: CIRS plan-declaration check: PASSED` (`check-cirs-declaration: OK (10 plan(s))`)
- `>>> 361: em-dash guard: PASSED`
- FAILED legs, exactly: `361: existing FDA known-tool-shapes`, `361: existing part8-egress-guard self-test`, `361: existing 209 declared-implies-wired`

Baseline before 361-09 was PASSED=24 FAILED=5 (parity and command contract now pass).

## Pre-existing non-361 failures (before and after, unchanged)

| Suite | Before (361-09 pre-flight) | After (re-run directly post-gate) |
|-------|----------------------------|-----------------------------------|
| FDA known-tool-shapes | one `FAIL:` line: `shipped brain_ask methodology question (unproven free-form tokens): expected verdict "ambiguous"` | identical |
| part8-egress-guard self-test | first AssertionError `PB8-03: generic framework question must ALLOW` | identical |
| 209 declared-implies-wired | `if this list changed: either a surface was fixed ...`, `-   'commands/brain-derive.md',` and `-   'skills/brain-derive/SKILL.md',`, no `+   '` lines | identical |

No peer drift on any of the three.

## Deviations from Plan

### Deferred (plan's own contingency, not an auto-fix)

**1. DDR361-09 / DDR361-10 amendment NOT written to .planning/REQUIREMENTS.md**
- **Found during:** Task 2 pre-flight
- **Issue:** `git status --short -- .planning/REQUIREMENTS.md` printed ` M` (a peer session's uncommitted Phase 362 CARD362 section). `git commit --only` on that path would have swept the peer's work into a 361 commit.
- **Action:** per the plan ("if a peer holds an uncommitted edit there, commit the test fix alone and record the amendment as owed in the SUMMARY"), committed `tests/test-361-command-contract.cjs` alone. The Task 2 automated verify's two `grep -q "Amended 2026-09-29 ..."` checks therefore do not pass yet; everything else in that verify (contract test, suite line) passes.
- **Owed text** (append to the end of each row, keep `[x]` and indentation):
  - DDR361-09: "Amended 2026-09-29 (UAT gap closure 361-09/361-10): Theo 20.1-04 published case_story as exactly one of `case_name` or `framework_name`, so the case_story call sends `{framework_name: "Dominant Design"}` (framework_step and framework_techniques still send `{framework: "Dominant Design"}`), never a case name; a case_story answer with no case is reason `no_case_in_canon` with no cases."
  - DDR361-10: "Amended 2026-09-29 (UAT gap closure 361-09): the case_story arm now matches Theo 20.1-04's exactly-one-of input, `framework_name` proven as a canonical framework handle and `case_name` proven as a safe free label (the find_connections rule) within Theo's name charset; both keys together, or the retired `{framework}` key, are not allowed; tests/test-361-theo-parity.cjs Leg 4a-4d pins the contract."

## Carry-forward

- docs/OPEN-HANDOFFS.md item (4) (the D-15 case_story shape recheck) is resolved by 361-09/361-10; left for the orchestrator or the next close-out to mark, since that file is shared.
- DDR361-09/10 amendment owed (text above) once the peer's REQUIREMENTS.md diff is committed.
- Live: case_story stays `not_served` until Theo 20.1-16 registers it and the hosted service redeploys; the plugin side is ready for that shape. 361-LIVE-EVIDENCE.md (2026-09-23 probe with `{framework}` args) is a dated historical record and was not edited or re-probed.
- Theo checkout advanced e501bbe -> d28f4ee during this session (docs only; `src/mcp/content` unchanged).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/core/dominant-design/theo-structure.cjs, tests/test-361-theo-structure.cjs, tests/test-361-cli.cjs, tests/test-361-command-contract.cjs
- FOUND: e4131a5b9, e42120564 (both ancestors of HEAD)
