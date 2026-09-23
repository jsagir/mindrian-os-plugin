---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 10
subsystem: brain-integration
tags: [theo, taxonomy-ladder, vocabulary, contract, rung-vocabulary, egress-guard, tier-3]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "354-05/06/07/08 (this plan's declared wave-4 depends_on); 354-09 (classification round trip, executable-chain validation, ranked-candidate provenance -- unrelated file scope, brain-router.cjs/brain-client.cjs changes there don't overlap this plan's rung-vocabulary/taxonomy-climb scope)"
provides:
  - "lib/core/strategy/rung-vocabulary.cjs::LADDER_RUNG_BY_THEO_ID -- now the identity mapping onto Theo's own PROBLEM_TYPE_IDS casing"
  - "lib/core/part8-egress-guard.cjs::TAXONOMY_RUNGS -- now Theo-cased ('UnDefined'/'IllDefined'/'WellDefined'/'Wicked'), the exact set Theo's z.enum accepts"
  - "tests/test-354-taxonomy-ladder-casing.cjs -- provider-compatibility regression reading /home/jsagi/Theo/src/mcp/content/vocabulary.ts read-only, T1-T4"
affects: [354-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider-compatibility regression: read the actual remote schema (read-only, off a local checkout) instead of re-asserting the plugin's own vocabulary against itself, which is how the CTX-TAXO defect shipped green in the first place"

key-files:
  created:
    - tests/test-354-taxonomy-ladder-casing.cjs
  modified:
    - lib/core/strategy/rung-vocabulary.cjs
    - lib/core/part8-egress-guard.cjs
    - tests/test-345-rung-mapping.cjs
    - tests/test-345-climb.cjs
    - tests/test-260906-fda-known-tool-shapes.cjs

key-decisions:
  - "toLadderRung stays a named, exported function (not inlined as a pass-through) even though the mapping is now the identity function -- it remains the ONE place a future rung, or a future provider whose casing differs again, gets projected; the fail-closed contract (unmapped input returns null) is unchanged"
  - "T4's scope-pin leg mirrors 354-09's own technique (tests/test-354-theo-router-contract.cjs): point MINDRIAN_BRAIN_URL at the real Theo origin string while stubbing global.fetch directly, so brain-client.cjs's origin-keyed alias-table selector picks BRAIN_PROBLEM_TYPE_ALIASES_THEO exactly as production does, without ever requiring an export change to brain-client.cjs (which this plan's files_modified list does not include)"
  - "lib/core/strategy/taxonomy-climb.cjs is listed in the plan's files_modified but was left byte-unchanged: it holds no lowercase/hyphenated ladder-value literals (it composes entirely through rungVocabulary.toLadderRung), so there was nothing to update per the plan's own instruction to touch only comments or human-readable strings that describe ladder values as lowercase"

patterns-established: []

requirements-completed: [THEO-01]

# Metrics
duration: ~25min
completed: 2026-09-23
---

# Phase 354 Plan 10: Taxonomy Ladder Casing Summary

**Fixed the P2 taxonomy-ladder casing mismatch (THEO-01, CTX-TAXO): `rung-vocabulary.cjs`'s `LADDER_RUNG_BY_THEO_ID` and `part8-egress-guard.cjs`'s `TAXONOMY_RUNGS` now use Theo's own `PROBLEM_TYPE_IDS` casing (`UnDefined`/`IllDefined`/`WellDefined`/`Wicked`) instead of an independently-invented lowercase/hyphenated vocabulary that only agreed with itself.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-23
- **Tasks:** 2 (`type="auto"`, test-first: Task 1 red, Task 2 green)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- Root cause (CTX-TAXO, P2): `lib/core/strategy/rung-vocabulary.cjs`'s `LADDER_RUNG_BY_THEO_ID` mapped Theo's four rung ids to a lowercase/hyphenated ladder vocabulary (`'wicked'`, `'undefined'`, `'well-defined'`, `'ill-defined'`), and `lib/core/part8-egress-guard.cjs`'s `TAXONOMY_RUNGS` declared that SAME lowercase set as its `taxonomy_ladder` known-shape enum. The two layers agreed with each other -- which is exactly why the existing local test suite (`tests/test-345-rung-mapping.cjs`, `tests/test-260906-fda-known-tool-shapes.cjs`) stayed green -- but neither agreed with the one layer that actually validates the value: Theo's real `taxonomy_ladder` input schema, `z.enum([...PROBLEM_TYPE_IDS])` with `PROBLEM_TYPE_IDS = ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']` (`/home/jsagi/Theo/src/mcp/content/vocabulary.ts:53-58`, `taxonomy-ladder.ts:285-286`, inspected read-only at commit `881e147`). A correctly-shaped local call would fail at Theo's own schema validation.
- New regression `tests/test-354-taxonomy-ladder-casing.cjs` proves this against the PROVIDER's real enum rather than the plugin's own vocabulary: it reads `vocabulary.ts` with `fs.readFileSync` (read-only; `MINDRIAN_THEO_CHECKOUT` env override, `ENV GAP` fallback to the pinned literal if the checkout is absent) and records the compared Theo commit hash. T1 (`toLadderRung` output is a provider-enum member for all four rungs), T2 (through the real client call path -- `taxonomy-climb.cjs`'s `renderLadder` against the shared SSE capture server -- all four captured `taxonomy_ladder` requests carry a provider-set rung, no call dropped), T3 (the egress guard's `classify()` allows a Theo-cased rung for `taxonomy_ladder` and does NOT allow the old lowercase form), T4 (scope pin: `brain-client.cjs`'s own `recommendChain` Theo alias table, reached only through the real Theo origin + a stubbed `global.fetch`, mirroring 354-09's own technique, is untouched). Run against unfixed code: T1, T2 and T3 failed as required; T4 was green from the start (proving `recommendChain`'s path was already correct and out of scope).
- Fix: `LADDER_RUNG_BY_THEO_ID` is now the identity mapping (`Wicked -> 'Wicked'`, `UnDefined -> 'UnDefined'`, `WellDefined -> 'WellDefined'`, `IllDefined -> 'IllDefined'`); `TAXONOMY_RUNGS` is now `Object.freeze(new Set(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']))`. `toLadderRung`'s fail-closed contract (an unmapped value returns `null` without a network call) is byte-unchanged. `lib/core/strategy/taxonomy-climb.cjs`'s `renderLadder` logic is byte-unchanged (it already sent `toLadderRung`'s value verbatim) and the file itself needed no comment edits, since it holds no lowercase ladder-value literals of its own.
- Updated the pre-existing lowercase-pinned assertions in three sibling test files to the new casing (each change listed below by file:line, old value, new value).

## Task Commits

1. **Task 1: Failing provider-compatibility regression for the taxonomy ladder** - `6aac5bc6d` (test)
2. **Task 2: Map ladder rungs to Theo's enum and align the guard's known-shape vocabulary** - `98b6f7bb9` (feat)

## Files Created/Modified

- `tests/test-354-taxonomy-ladder-casing.cjs` - New provider-compatibility regression (T1-T4), reads `/home/jsagi/Theo/src/mcp/content/vocabulary.ts` read-only
- `lib/core/strategy/rung-vocabulary.cjs` - `LADDER_RUNG_BY_THEO_ID` set to the identity mapping onto Theo's casing; header and `toLadderRung` JSDoc updated to name the provider source and commit
- `lib/core/part8-egress-guard.cjs` - `TAXONOMY_RUNGS` set to Theo's own casing; comment names the provider source (`vocabulary.ts`/`taxonomy-ladder.ts`, commit `881e147`) and the bidirectional-equality test that pins it against `rung-vocabulary.cjs`
- `tests/test-345-rung-mapping.cjs` - `EXPECTED_LADDER_MAP` (lines 79-84) updated to the identity mapping; the `toLadderRung(IllDefined)` single-case assertion (lines 92-95) updated from `'ill-defined'` to `'IllDefined'`
- `tests/test-345-climb.cjs` - Two `renderLadder` wire-argument assertions updated: line 115 `{ rung: 'ill-defined', question_label: 'explore' }` -> `{ rung: 'IllDefined', question_label: 'explore' }`; line 156 `{ rung: 'ill-defined' }` -> `{ rung: 'IllDefined' }`
- `tests/test-260906-fda-known-tool-shapes.cjs` - Arm A's four `allow` cases (lines 94/97/98/99) updated from lowercase (`'wicked'`/`'undefined'`/`'ill-defined'`/`'well-defined'`) to Theo casing (`'Wicked'`/`'UnDefined'`/`'IllDefined'`/`'WellDefined'`); Arm F's `TAXONOMY_RUNGS` membership list (lines 223-224) updated from `['undefined', 'ill-defined', 'well-defined', 'wicked']` to `['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']`. Every other lowercase `rung: 'wicked'` literal in this file (Arm B's wrong-tool-name negative, Arm C's content-block negative, Arm D's off-enum/extra-key/numeric/missing-rung/empty-question_label negatives) was left unchanged on purpose: each of those assertions' outcome (`ambiguous`/`unknown`, `block`/`content_set`, or `expectNotAllow`) is determined by a check that runs BEFORE or independently of the rung-enum membership check (wrong tool name, step-1 content scan, `_hasExactKeys`, `typeof`), so the literal's casing does not participate in what each assertion actually proves; verified by running the full file green with these left as-is.

## Decisions Made

- `toLadderRung` stays a named, exported function rather than being inlined as a pass-through, even though the mapping is now the identity function -- see key-decisions in frontmatter.
- T4's scope-pin technique mirrors 354-09's `tests/test-354-theo-router-contract.cjs` C1-C4 approach exactly (real Theo origin + stubbed `global.fetch`) rather than requiring a new export from `brain-client.cjs`, which stays outside this plan's `files_modified` list and untouched (`git show --stat` of both this plan's commits confirms no `brain-client.cjs` entry; `git diff` between the commit immediately before Task 1 and the commit after Task 2, scoped to that file, is empty).

## Deviations from Plan

None beyond the acceptance-criteria self-correction below.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file's own acceptance-criteria comment self-matched the grep it was documenting**
- **Found during:** Task 1, immediately after writing the initial draft of `tests/test-354-taxonomy-ladder-casing.cjs`
- **Issue:** The file's header docblock quoted the plan's own acceptance-criteria grep pattern (`` `grep -cE "writeFileSync|git (add|commit|push)"` ``) verbatim as documentation, which made the file match its own acceptance check (`grep -cE ... tests/test-354-taxonomy-ladder-casing.cjs` printed `1`, not the required `0`).
- **Fix:** Reworded the comment to describe the read-only contract in prose instead of quoting the literal grep pattern.
- **Files modified:** `tests/test-354-taxonomy-ladder-casing.cjs`
- **Verification:** `grep -cE "writeFileSync|git (add|commit|push)" tests/test-354-taxonomy-ladder-casing.cjs` now prints `0`.
- **Commit:** `6aac5bc6d` (folded into the Task 1 commit; caught before the RED run, not a post-commit fix)

---

**Total deviations:** 1 auto-fixed (Rule 1, self-inflicted documentation bug in the test file itself, caught and fixed before the Task 1 commit)
**Impact on plan:** Zero production-behavior scope creep. The fix is confined to the new test file's own comment text.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- THEO-01's taxonomy-casing sub-finding (CTX-TAXO) is closed. **THEO-01 as a whole is NOT complete**: this requirement's `REQUIREMENTS.md` row is co-owned by 354-09 (landed), 354-10 (this plan, landed) and 354-12 (not yet landed) -- per this plan's explicit instruction, its checkbox was deliberately left unchecked (`requirements.mark-complete` was NOT called for THEO-01 in this plan's state-update step) and stays open until 354-12 lands.
- `tests/run-all-354.sh` reports 11 passed / 0 failed / 7 skipped (the 7 skips are sibling plans' not-yet-landed test files -- `354-poc-room-journey`, `354-theo-journey`, `354-theo-live-contract`, `354-acceptance-diagnostics`, `354-registration-diagnostics`, `354-extract-shallow-contract`, `354-concurrency-surfaces` -- unrelated to this plan).
- No blockers for 354-11 through 354-18 from this plan's changes.
- `git -C /home/jsagi/Theo status --short` was checked before and after this plan's work (both read-only `git log`/`git status` calls only); the checkout's pre-existing dirty state (unrelated files from other sessions against that separate repository) was neither caused nor touched by this plan.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files confirmed present on disk (tests/test-354-taxonomy-ladder-casing.cjs,
lib/core/strategy/rung-vocabulary.cjs, lib/core/part8-egress-guard.cjs,
tests/test-345-rung-mapping.cjs, tests/test-345-climb.cjs,
tests/test-260906-fda-known-tool-shapes.cjs, this SUMMARY.md). Both task commits
(6aac5bc6d, 98b6f7bb9) confirmed present in git log.
