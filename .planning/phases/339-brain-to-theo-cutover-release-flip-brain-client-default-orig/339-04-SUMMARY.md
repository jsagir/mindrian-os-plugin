---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 04
subsystem: brain-client
tags: [brain-client, theo, alias-table, origin-keyed, schema-memo, enrichment-log, wave-1-green]

# Dependency graph
requires:
  - phase: 339-01
    provides: tests/run-all-339.sh (glob discovery), tests/test-339-origin-single-source.cjs
  - phase: 339-02
    provides: tests/test-339-schema-memo-origin-keyed.cjs
  - phase: 339-03
    provides: tests/test-254-normalize-roundtrip-probe.cjs Arms 4-5 (extended for the two-table selector)
provides:
  - lib/core/brain-client.cjs THEO_ORIGINS (frozen array, exported), BRAIN_PROBLEM_TYPE_ALIASES_INCUMBENT, BRAIN_PROBLEM_TYPE_ALIASES_THEO, _brainProblemTypeAliases() (origin-keyed selector)
  - lib/core/brain-client.cjs _schemaCacheOrigin (origin-keyed brain_schema memo)
  - lib/core/brain-client.cjs enrichment_queue_captured log line reading result.score alongside result.readiness_score
affects: [339-05, 339-06, 339-07, 339-09, 339-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Origin-keyed selector function (_brainProblemTypeAliases) reading a module-scope const, mirroring the already-shipped brain_query dual-shape branch: guard on shape/origin, both cases in one adjacent block, comment naming the Theo source file, conservative default last"
    - "A frozen array constant (THEO_ORIGINS) instead of a bare string literal for a set that may grow by one staging origin later, exported so a sibling module (class-m-brain-smoke.cjs, plan 339-12) can key off the SAME set rather than minting a second copy"
    - "A comment that must state a forbidden identifier's absence (no exported flush) without literally spelling that identifier, because the negative-assertion test greps the whole file for the literal string -- same self-tripping trap 339-03's SUMMARY documented for a different file"

key-files:
  created: []
  modified:
    - lib/core/brain-client.cjs

key-decisions:
  - "FLIP-03 is only PARTIALLY satisfied by this plan (the enrichment_queue_captured log line's readiness_score expression, one of the requirement's two Theo-shape legs); the requirement's other leg -- _maybeCaptureEnrichmentMiss / captureReadinessMiss actually CAPTURING both Theo payload shapes (scored and refusal-only) in lib/core/enrichment-queue.cjs -- is plan 339-05's territory per this plan's own objective ('part of FLIP-03'). REQUIREMENTS.md FLIP-03 is therefore left UNCHECKED by this plan; only FLIP-02 and FLIP-05 (fully satisfied here) are marked complete. Checking FLIP-03 now would be a false-complete claim ahead of 339-05 landing."
  - "The D-13 corrected deviation (no flush mechanism, defense-in-depth key-by-origin only) is recorded verbatim in the code comment above _schemaCache's declaration block, per the plan's own instruction to state the correction in-code rather than only in 339-CONTEXT.md."

patterns-established:
  - "The comment-as-contract block for a new module-scope declaration is placed BEFORE the group of sibling declarations it documents (not wedged between two adjacent declarations the structural test requires to stay within N lines of each other), so a structural adjacency test and a house-style long-form comment do not fight over the same few lines."

requirements-completed: [FLIP-02, FLIP-05]

# Metrics
duration: 35min
completed: 2026-09-03
---

# Phase 339 Plan 04: brain-client.cjs PREP Cut (alias tables, schema memo, enrichment log) Summary

**Three additive, incumbent-inert changes to `lib/core/brain-client.cjs` land in one wave: the single problem-type alias table is replaced by two origin-selected frozen tables plus a `THEO_ORIGINS`-keyed selector (FLIP-02), the `brain_schema` memo is keyed on the resolved origin as defense-in-depth with no flush mechanism (FLIP-05, D-13 corrected), and the enrichment capture log line recognizes Theo's `score` field alongside the incumbent's `readiness_score` (part of FLIP-03) -- every change proven inert against the incumbent by the plan's own pre-existing RED tests turning GREEN.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-03T20:44:39Z (immediately after 339-03's plan-completion commit)
- **Completed:** 2026-09-03T20:50:11Z (Task 3 commit) plus SUMMARY/state work
- **Tasks:** 3 completed
- **Files modified:** 1 (`lib/core/brain-client.cjs`), plus this SUMMARY

## Accomplishments

- **Task 1 (FLIP-02, D-03 consumer 1):** `BRAIN_PROBLEM_TYPE_ALIASES` (the single table at the old `:1713`) is replaced by `BRAIN_PROBLEM_TYPE_ALIASES_INCUMBENT` and `BRAIN_PROBLEM_TYPE_ALIASES_THEO`, both frozen, carrying the identical 8 keys (`undefined`, `udp`, `ill-defined`, `ill_defined`, `idp`, `well-defined`, `well_defined`, `wdp`) projected onto the incumbent's 3 values (`Undefined Problem` / `Ill-Defined Problem` / `Well-Defined Problem`) and Theo's 3 ids (`UnDefined` / `IllDefined` / `WellDefined`) respectively. `THEO_ORIGINS`, a frozen array containing `https://theo-mcp.onrender.com`, is exported from `module.exports` for plan 339-12's re-use. `_brainProblemTypeAliases()` selects the Theo table when `THEO_ORIGINS.indexOf(BRAIN_URL) !== -1`, the incumbent table otherwise. `_normalizeBrainProblemType` now reads `const table = _brainProblemTypeAliases();` and looks up/returns via `table`; `PROBLEM_TYPE_HANDLE_RE` and the final `return trimmed;` are byte-identical (verified via `git diff`, both lines appear only as unchanged context). `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4 and 5 are GREEN.
- **Task 2 (FLIP-05, D-13 corrected):** `_schemaCacheOrigin` is declared adjacent to `_schemaCache`/`_schemaCacheAt` (all three now sit together, with the long comment-as-contract block placed BEFORE the trio rather than wedged between two of them, so the structural "declared within three lines" test and the house-style comment do not collide -- see Deviations). `schema()`'s cache-hit guard now requires `_schemaCache && _schemaCacheOrigin === getBrainUrl() && (Date.now() - _schemaCacheAt) < SCHEMA_CACHE_TTL_MS`, origin checked before the memo can ever be served. The success block assigns `_schemaCacheOrigin = getBrainUrl();` alongside the existing `_schemaCacheAt = Date.now();` assignment, same guard block. The 30-minute TTL and the Phase 247-02 sentinel guard (`result.error`) are unchanged. No flush function is created or exported; `tests/test-339-schema-memo-origin-keyed.cjs` (all 7 arms) is GREEN.
- **Task 3 (part of FLIP-03):** The `enrichment_queue_captured` log payload's `readiness_score` expression now checks `result.readiness_score` (incumbent) first, then `result.score` (Theo's `orchestration_readiness` shape, integer 0-4, practical ceiling 3), each guarded by `typeof === 'number'`; `null` remains the final fallback. `_isCapturableResult` (`:1642`, unchanged) requires `!result.error` -- **verified** against Theo's `orchestration-readiness.ts:92-101` and `:480-487`: the honest-empty refusal branch carries a `refusal` block and never sets `error`, so it passes the capturability gate unchanged; no code change was needed there. `node tests/test-247-contract-client.cjs` still passes (4/4).

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the single alias table with two origin-selected tables (FLIP-02, D-03 consumer 1)** - `7a46d66c` (feat)
2. **Task 2: Key the brain_schema memo on the resolved origin (FLIP-05, D-13 as corrected)** - `f97e977f` (feat)
3. **Task 3: Teach the enrichment capture log line Theo's score field (FLIP-03)** - `48db8772` (feat)

**Plan metadata:** this commit (docs: complete plan) - recorded after this SUMMARY and STATE.md/ROADMAP.md updates land.

## Files Created/Modified

- `lib/core/brain-client.cjs` - all three tasks landed in this one file per the plan's `files_modified` scope: the two-table alias selector + `THEO_ORIGINS` export (Task 1), the origin-keyed schema memo (Task 2), and the dual-shape enrichment log line (Task 3)

## Decisions Made

- **The D-13 deviation statement, verbatim (per this plan's own instruction to record it):** D-13 as originally written asked for a `flushSchemaMemo()`-style flush mechanism to ride the FLIP cut. Research corrected the premise: `BRAIN_URL` is a module-scope const resolved once at require time, and `_schemaCache` is in-memory and process-local, so no running process can ever OBSERVE an origin change -- the key-by-origin guard added in Task 2 is therefore provably inert against the incumbent today (the comparison is always true within one process). It ships anyway as defense in depth, becoming load-bearing the day anything makes the origin mutable per process. No flush function was created; the code comment states this correction directly (without spelling the forbidden identifier literally, to avoid self-tripping `tests/test-339-schema-memo-origin-keyed.cjs` Arm 7's negative grep -- the same class of self-trip 339-03's SUMMARY documented for a different file), and Arm 7 asserts its absence. Flip-day answer for `09-MOS-LEARNING`'s addendum field, verbatim: "no flush needed: memo is process-local, keyed by origin since beta.17".
- **The verified answer on `_isCapturableResult` (Task 3), with line number:** `_isCapturableResult` at `lib/core/brain-client.cjs:1642` (`return result !== null && typeof result === 'object' && !result.error;`) DOES admit a payload carrying `refusal` but no `error` -- confirmed by reading Theo's `orchestration-readiness.ts:92-101` (the resolution-refusal convention: "a resolution refusal rides INSIDE the success response and never sets the transport's error flag") and `:480-487` (the actual `refusal: { code: 'FRAMEWORK_NOT_FOUND', detail: ... }` object literal, which carries no `error` key). Yes, it passes the gate unchanged.
- **FLIP-03 left unchecked in REQUIREMENTS.md**, see key-decisions above: this plan lands only the log-line leg; the capture-arm leg (`_maybeCaptureEnrichmentMiss` / `captureReadinessMiss` actually recognizing both Theo payload shapes in `lib/core/enrichment-queue.cjs`) is plan 339-05's scope.
- **Structural placement fix (found live, not a plan deviation):** the plan's own comment-as-contract instruction for Task 2 initially produced a ~16-line comment wedged between `let _schemaCacheAt = 0;` and the new `let _schemaCacheOrigin = null;`, which broke `tests/test-339-schema-memo-origin-keyed.cjs` Arm 4's "declared within three lines" structural check. Moved the comment block to sit before all three sibling declarations instead, restoring the required adjacency. See Deviations (Rule 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment placement broke the schema-memo declaration-adjacency structural test**
- **Found during:** Task 2, first live run of `tests/test-339-schema-memo-origin-keyed.cjs`
- **Issue:** The plan's own instruction ("Comment-as-contract, house style, on the three new lines") was first satisfied by writing the long D-13-correction comment directly above `let _schemaCacheOrigin = null;`, i.e. between the pre-existing `let _schemaCacheAt = 0;` and the new declaration. Arm 4 of `tests/test-339-schema-memo-origin-keyed.cjs` requires `let _schemaCacheOrigin` to be declared within three LINES of `let _schemaCacheAt` (a line-count window, not a token-count window); the ~16-line comment blew that window and Arm 4 failed.
- **Fix:** Moved the entire comment block to sit before `let _schemaCache = null;` (the first of the three sibling declarations), so all three declarations (`_schemaCache`, `_schemaCacheAt`, `_schemaCacheOrigin`) now sit on three consecutive lines with the comment entirely above them. No content was removed or shortened.
- **Files modified:** `lib/core/brain-client.cjs` (before the Task 2 commit; the committed version already carries the fix)
- **Verification:** Re-ran `node tests/test-339-schema-memo-origin-keyed.cjs`: all 7 arms PASS.
- **Committed in:** `f97e977f` (Task 2 commit; fixed before committing, no separate commit needed)

**2. [Rule 1 - Bug] The D-13-correction comment self-tripped its own governing negative-assertion test**
- **Found during:** Task 2, same live run, after fixing Deviation 1
- **Issue:** The comment's first draft named the intentionally-absent function literally as `flushSchemaMemo()` (matching the plan's own action-spec prose, which also uses that literal identifier). `tests/test-339-schema-memo-origin-keyed.cjs` Arm 7 negatively greps the ENTIRE file for the literal string `flushSchemaMemo` to prove no such export exists -- the comment's own mention of the forbidden name as a negative example tripped that same check, exactly the class of self-trip `339-03-SUMMARY.md` documented for `tests/test-339-gate-zero-write.sh`'s header comment.
- **Fix:** Reworded the comment to describe the absent mechanism in prose ("no exported flush-the-memo function exists here BY DECISION") without literally spelling `flushSchemaMemo` anywhere in the file.
- **Files modified:** `lib/core/brain-client.cjs` (before the Task 2 commit; the committed version already carries the fix)
- **Verification:** Re-ran `node tests/test-339-schema-memo-origin-keyed.cjs`: Arm 7 now PASSES (`flushSchemaMemo does not exist anywhere in lib/core/brain-client.cjs`).
- **Committed in:** `f97e977f` (Task 2 commit; fixed before committing, no separate commit needed)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs in this plan's own new comment text, both found and fixed before Task 2's commit).
**Impact on plan:** No scope creep. Both fixes correct this plan's own new comment placement/wording before its governing commit; the code logic itself (the guard condition, the assignment block, the alias-table selector, the log-line expression) was correct on first write in every task.

## Issues Encountered

None beyond the two auto-fixed issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This plan's three deliverables are now GREEN against every test named in the plan's own `<verification>` block:

- `node tests/test-254-normalize-roundtrip-probe.cjs`: PASS (0 failures), Arms 4-5 green.
- `node tests/test-339-schema-memo-origin-keyed.cjs`: PASS (0 failures), all 7 arms green.
- `node tests/test-247-contract-client.cjs`: PASS (4/4), untouched.
- `node tests/test-339-origin-single-source.cjs`: unchanged in outcome by this plan (still FAILs Arm 3 with the same 6 un-allowlisted literals named in 339-01's SUMMARY -- `class-m-brain-smoke.test.cjs` x3, `build-brain-census.cjs`, `probe-brain-contract.cjs`, `session-start`; `brain-client.cjs` itself is allowlisted and clean). Plan 339-07's territory, not this plan's.
- `bash tests/run-all-339.sh`: `PASS=5 FAIL=7` (up from `PASS=3 FAIL=9` at the end of wave 1 -- exactly the two more green arms this plan's own `<verification>` block calls for). The em-dash fence's only failures are the two not-yet-created files (`lib/core/update-path.cjs`, `docs/339-NOTE-theo-desktop-connector-key.md`), both plan 339-06/339-09 territory; `lib/core/brain-client.cjs` itself reports `clean`.
- `node scripts/build-connector-registry.cjs --check`: OK.
- `node scripts/build-orchestration-projection.cjs --check`: OK.
- `node scripts/check-render-coverage.cjs`: 16 covered / 0 gap; 202 wired / 0 unwired.

**For plan 339-05** (the two additive enrichment-queue arms, the other leg of FLIP-03): this plan's Task 3 change means the log line is already able to read a genuine `score` once `captureReadinessMiss` starts queuing Theo-shaped misses -- 339-05 does not need to touch `lib/core/brain-client.cjs` again for the log line itself, only `lib/core/enrichment-queue.cjs`.

**For plan 339-12** (`class-m-brain-smoke.cjs` per-origin node floor): `THEO_ORIGINS` is exported and importable today via `require('./lib/core/brain-client.cjs').THEO_ORIGINS`.

No blockers.

---
*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: lib/core/brain-client.cjs
- FOUND: .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-04-SUMMARY.md
- FOUND: 7a46d66c (Task 1 commit)
- FOUND: f97e977f (Task 2 commit)
- FOUND: 48db8772 (Task 3 commit)
