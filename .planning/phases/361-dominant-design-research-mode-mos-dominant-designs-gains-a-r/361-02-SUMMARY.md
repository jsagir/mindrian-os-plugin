---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
plan: 02
subsystem: part8-egress-guard
tags: [part8, egress-guard, known-tool-shape, theo, dominant-design]

# Dependency graph
requires: [361-01]
provides:
  - "Three new _proveKnownToolShape arms in lib/core/part8-egress-guard.cjs: framework_step, framework_techniques, case_story"
  - "_isKnownFrameworkHandle helper (+ FRAMEWORK_NAME_RE, PROCESS_STEP_ID_RE) proving a generic canonical-framework handle, exact membership in CANONICAL_PHRASES"
  - "tests/test-361-egress-shapes.cjs: unit legs, hook legs, find_connections byte-parity legs (working tree vs HEAD, per-361-commit), arm-order leg"
  - "tests/test-361-theo-parity.cjs: read-only key-set and regex-literal parity against the live Theo checkout, D-15 case_story recheck trigger"
affects: [361-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generic-handle proof stricter than a safe-short-label proof: exact lowercase membership in a frozen, sorted vocabulary array, never a substring or prefix match"
    - "Function declarations placed after a module-level const they reference: safe because the const finishes initializing before the function is ever CALLED (not when it is defined), and function declarations hoist"
    - "Plain-text brace-matching + regex-literal-slice parsing to pin a plugin arm's shape against a sibling repo's real TypeScript source, with zero TypeScript tooling and zero child-process spawn"

key-files:
  created:
    - tests/test-361-egress-shapes.cjs
    - tests/test-361-theo-parity.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - .planning/ROADMAP.md

key-decisions:
  - "D-14 pre-check (grep + git log -S) confirmed no peer had already landed any of the three arms; all three are wholly new in this plan's commit, so no arm was adapted rather than added."
  - "Did NOT flip DDR361-10's checkbox in .planning/REQUIREMENTS.md. The requirement row itself scopes to 'Plans 361-02, 361-08' -- this plan closes the arms/proof/parity-test half, but full closure (the live Theo probe) is 361-08's job. Checking the box now would misreport the requirement as done before it is. Left REQUIREMENTS.md untouched; ROADMAP.md's 361-02 checkbox and progress count were updated instead (git diff -U0 confirms exactly those two lines changed)."
  - "case_story arm ships ahead of Theo 20.1 publishing the real tool, per plan direction and D-15: the {framework} shape is stated as an assumption in both the guard source comment and the parity test's leg 4 message, and the parity test is written so a future case-story*.ts file in the Theo checkout auto-triggers the recheck instead of silently drifting."

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-09-23
---

# Phase 361 Plan 02: Part 8 known-shape arms for framework_step, framework_techniques, case_story Summary

**Taught `_proveKnownToolShape` three new arms (framework_step, framework_techniques, case_story) that admit only an exact, lowercase-normalized canonical-framework handle like `{framework: "Dominant Design"}`, stricter than the existing find_connections/taxonomy_ladder/recommend_chain arms on purpose (D-10), plus a read-only test that pins the new arms to Theo's actual TypeScript input schemas so a future Theo-side change is caught rather than silently drifted from.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-23 (session start, after reading 361-01-SUMMARY and the plan)
- **Completed:** 2026-09-23
- **Tasks:** 2 (both completed)
- **Files modified:** 4 (1 modified guard file, 2 new test files, 1 modified ROADMAP checkbox)

## Accomplishments

- `lib/core/part8-egress-guard.cjs`: three new arms inside `_proveKnownToolShape`, placed after the `recommend_chain` arm and before the function's terminal `return null;` (verified by an arm-order test leg using brace-matching, not a fragile line-number guess). `framework_step` admits `{framework}` with an optional `step_id` matching Theo's `PROCESS_STEP_ID_PATTERN`; `framework_techniques` and `case_story` admit `{framework}` only. A new helper `_isKnownFrameworkHandle`, plus module constants `FRAMEWORK_NAME_RE` and `PROCESS_STEP_ID_RE` (byte-for-byte copies of Theo's `vocabulary.ts` patterns), sit directly after `_proveKnownToolShape`'s closing brace; the helper fails closed (returns `false`) when `CANONICAL_PHRASES` is empty (a vocabulary-load failure), mirroring the existing `_TYPED_QUESTION_DATA_LOADED` posture. `find_connections`, `taxonomy_ladder` and `recommend_chain` are untouched -- `git diff <PLAN_BASE> -- lib/core/part8-egress-guard.cjs` shows zero removed lines across both commits.
- `tests/test-361-egress-shapes.cjs` (80 assertions): happy-path legs for all three tools including the optional `step_id` and the lowercase-handle case; not-allow legs for extra keys, a `step_id` on the two tools that do not admit it, a malformed `step_id`, a missing/numeric/multi-line/129-char `framework`, and an off-vocabulary framework name (falls to `ambiguous`, never `allow`); block legs for an email and a financial-idiom `framework` value (the content scan fires first, independently of arm ordering); a hook-process leg proving `scripts/part8-egress-guard-hook.cjs` exits 0 clean and 2 dirty for `framework_step`; a find_connections byte-parity leg comparing the working-tree slice to HEAD; a per-361-commit find_connections parity leg walking every `361-*` commit in `<base_sha>..HEAD` (currently 0 prior 361 commits touch the guard file, so this leg reports its own SKIP note and still counts as green); and an arm-order leg proving `recommend_chain`'s index precedes each new arm's index, which precedes the function's terminal `return null;`.
- `tests/test-361-theo-parity.cjs` (5 checks): brace-matches `inputShape: { ... }` in `framework-step.ts` and `framework-techniques.ts`, plain-text-parses the plugin's `_hasExactKeys(payload, [...], [...])` call inside each corresponding arm, and asserts the two key sets union-equal; slices Theo's `FRAMEWORK_NAME_PATTERN` and `PROCESS_STEP_ID_PATTERN` regex-literal source text and the plugin's `FRAMEWORK_NAME_RE`/`PROCESS_STEP_ID_RE` and asserts byte-for-byte equality; for `case_story`, since no `*case-story*` file exists yet under the Theo checkout's `src/mcp/content/`, prints the D-15 assumption note and passes -- the moment such a file lands, this leg starts comparing its `inputShape` keys against the plugin arm and will FAIL on any drift, which is the intended D-15 recheck trigger. The checkout's HEAD commit is read for the record straight off `.git/HEAD` and the ref chain (no child process). Absent/unreadable checkout: `ENV GAP: Theo checkout not found`, exit 77 (verified against `MINDRIAN_THEO_CHECKOUT=/nonexistent`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Three known-shape arms + `_isKnownFrameworkHandle` + `tests/test-361-egress-shapes.cjs`** - `68111c594` (feat)
2. **Task 2: `tests/test-361-theo-parity.cjs`** - `99d86076e` (test)

_Base commit at plan start (`PLAN_BASE`): `41a26e540030136823d80b9b4c3382a5c307b026`_
_HEAD had advanced to `92aa8f624c37e8e1fd15482afb116980c962be7b` (one peer commit) by the time Task 1's target files were confirmed clean; the peer commit touched neither `lib/core/part8-egress-guard.cjs` nor either new test file._

## Files Created/Modified

- `lib/core/part8-egress-guard.cjs` - three new arms + `_isKnownFrameworkHandle` helper + two copied regex constants + one docblock note appended; zero lines removed
- `tests/test-361-egress-shapes.cjs` - new, 80-assertion behavior test (unit + hook + find_connections parity + arm order)
- `tests/test-361-theo-parity.cjs` - new, 5-check read-only Theo input-shape parity test
- `.planning/ROADMAP.md` - Phase 361's `361-02-PLAN.md` checkbox flipped to `[x]`; Progress line bumped `1/8` -> `2/8` (verified via `git diff -U0`, exactly those two lines)

## Decisions Made

- D-14 pre-check (the plan's mandated `grep -n "framework_step\|framework_techniques\|case_story" lib/core/part8-egress-guard.cjs` plus `git log --oneline -S"framework_techniques" -- lib/core/part8-egress-guard.cjs`) returned empty before this plan's edit: no peer had landed any of the three arms. All three are wholly new in this plan's own commit; nothing was adapted from a pre-existing partial arm.
- Left `.planning/REQUIREMENTS.md`'s `DDR361-10` checkbox unchecked. That row's own text scopes to "Plans 361-02, 361-08" -- this plan supplies the arms, the helper, and the read-only Theo parity test, but the row is not fully satisfied until 361-08's live Theo probe closes the loop. Checking it now would overstate progress; the SUMMARY records the plan's actual share instead.
- The `pluginArmKeys` helper in `test-361-theo-parity.cjs` anchors on the arm's own `toolName.indexOf('<name>')` guard-line text rather than a bare substring search for `<name>`. A bare-substring anchor would have matched this plan's own docblock comment (which names all three tools by their bare names, ahead of the function body) before it ever reached the real arm, producing a false key-set mismatch against the `find_connections` arm's keys. Caught and fixed during RED/GREEN iteration on Task 2, before any commit.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' verify commands and acceptance criteria passed as specified; the two adjustments above (D-14 pre-check outcome, REQUIREMENTS.md scope call) are decisions the plan explicitly anticipated (D-14's own instruction to check first; the requirement row's own text naming both plans), not departures from it.

## Issues Encountered

**Pre-existing, unrelated failures in the shared tree (classified, not touched, per the plan's own instruction and the 361-01-SUMMARY precedent):**
- `node lib/core/part8-egress-guard.test.cjs` exits 1 on assertion `pb8_03` (expected `allow`, got `ambiguous`). Confirmed via a clean run of this exact command BEFORE either of this plan's commits landed -- the failure predates this plan's edit and is the same PB8-03 failure 361-01-SUMMARY already recorded as pre-existing/peer-diff. Not caused by, and not fixed by, this plan's arms (which sit at the very end of `_proveKnownToolShape` and cannot change an earlier arm's behavior).
- `node tests/test-209-declared-implies-wired.cjs` fails on a skills/commands exemption-list `deepStrictEqual` diff naming only `skills/*` and unrelated files this plan never touched. Same classification as 361-01-SUMMARY: pre-existing/peer-diff from concurrent Phase 355/358/359/360 sessions.
- `bash tests/run-all-361.sh` (observed only, never edited per the plan's own aggregator-ownership rule) reports `PASSED=20 FAILED=2 SKIPPED=7`: the 2 failures are exactly the two above; the 7 skips are the not-yet-landed `361-03`..`361-07` test files, correctly SKIPPED rather than PASSED. This plan's own two legs ("Part 8 known-shape arms (361-02, D-10)" and "Theo input-shape parity (361-02, D-10/D-14)") both report PASSED.

## Known Stubs

None. This plan's artifacts are a guard-logic addition, a helper, and two test files -- no UI or data-flow stubs are in scope.

## Threat Flags

None beyond what the plan's own threat model already names and mitigates (T-361-04 through T-361-08, all disposed `mitigate`/`accept` in the plan and verified by this plan's own test legs: exact-key-set + exact-vocabulary-membership proof, arm-order pinning, per-commit find_connections byte-parity, the explicit fail-closed `CANONICAL_PHRASES.length === 0` guard, and read-only-only access to the Theo checkout). No new network endpoint, auth path, or schema change was introduced; the guard remains pure LOCAL with zero network calls.

## User Setup Required

None - no external service configuration required. The three arms activate automatically once Theo Phase 20 deploys `framework_step`/`framework_techniques` live (currently still serving the pre-deploy 34-tool catalog per the 2026-09-23 handoff doc); until then they simply sit ready and untriggered, and the read-only parity test continues to validate the arms' shape against the Theo checkout's committed source regardless of what is deployed live.

## Next Phase Readiness

- The three arms and `_isKnownFrameworkHandle` are ready for 361-08's live Theo probe to exercise against the deployed catalog.
- `tests/test-361-theo-parity.cjs` will auto-fire its D-15 recheck the moment a `*case-story*` file lands in the Theo checkout's `src/mcp/content/`, so no later plan needs to remember to re-derive the case_story shape by hand.
- The find_connections byte-parity legs (working tree vs HEAD, per-361-commit) are in place and will catch any future 361 commit that accidentally touches Phase 355's arm.
- DDR361-10 remains open (by design) for 361-08 to close.

## Self-Check: PASSED

All created files verified present on disk; both task commit hashes (`68111c594`, `99d86076e`) verified present in `git log --oneline --all`; `git diff -U0 -- .planning/ROADMAP.md` confirmed exactly the two intended line changes.

---
*Phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r*
*Completed: 2026-09-23*
