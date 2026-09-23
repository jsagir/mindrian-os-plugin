---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 09
subsystem: hsi-classifier
tags: [direction-convention, hsi, rs-math, classifier, test-amendment, d-03, d-04]

requires:
  - phase: 355-01
    provides: "lib/core/direction-convention.cjs (classify, classifyDiff, DIRECTIONS, NONE)"
  - phase: 355-02
    provides: "tests/fixtures/355/direction-pairs.json, tests/test-355-direction-agreement.cjs (legs A-H)"
provides:
  - "lib/core/rs-math.cjs classifyDirection delegates to direction-convention.cjs classifyDiff (finite behavior unchanged)"
  - "lib/core/hsi-lsa.cjs classifyDirectionB retired as Convention B, delegates to direction-convention.cjs classify (name kept for importers)"
  - "lib/core/hsi-engine.cjs computeHsiMatrix classifies via direction-convention.cjs classify on the raw (pre-Number-coercion) matrix cells"
  - "lib/core/rs-innovation-classifier.cjs: 4th enum value 'none'; single-axis branches both come from classify(lsa, bert); BRIDGE_CONCEPT_BY_CLASSIFICATION.none = null"
  - "scripts/rs-discovery-engine.cjs: structural_transfer defaults replaced with 'none'; a 'none' pair is routed past thesis generation with skipped_reason 'no_direction', kept not dropped"
affects: [355-10, 355-11, 355-12, 355-27]

tech-stack:
  added: []
  patterns:
    - "One label rule, many delegates: rs-math.classifyDirection, hsi-lsa.classifyDirectionB (name kept for importers), hsi-engine's computeHsiMatrix call site, and rs-innovation-classifier's single-axis branch all now call lib/core/direction-convention.cjs directly instead of carrying their own copy of the comparison-to-label rule"
    - "Classify on raw values, not pre-coerced Numbers, when the caller's own arithmetic needs Number() coercion for other reasons but the direction-convention.cjs null-sentinel contract needs the original null/undefined to survive"
    - "'none' is classifier-only: never a D-01 wire id, routed around (not into) any consumer that only knows the two wire ids"

key-files:
  created: []
  modified:
    - lib/core/rs-math.cjs
    - lib/core/hsi-lsa.cjs
    - lib/core/hsi-engine.cjs
    - tests/272-hsi-lsa-algorithm.test.cjs
    - lib/core/rs-innovation-classifier.cjs
    - lib/core/rs-thesis-generator.cjs
    - scripts/rs-discovery-engine.cjs
    - lib/memory/test-rs-innovation-classifier.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "hsi-engine.cjs's computeHsiMatrix now captures lsaMatrix[i][j]/semanticMatrix[i][j] as lsaSimRaw/semSimRaw BEFORE the existing Number() coercion (kept, unchanged, for the arithmetic legs that need it) and passes the RAW values to classify(), not the coerced lsaSim/semSim -- Number(null) coerces to 0 (a finite number), which would silently swallow direction-convention.cjs's none sentinel for a missing lsa/semantic cell. Leg D's missing-null-lsa fixture pair caught this; not spelled out verbatim in the plan's action text but required by the plan's own must_haves truth (\"the two similarity ALGORITHMS stay separate\") and by Task 1's own acceptance line (zero FAIL: D). Weights (0.6/0.4/0.7/0.3) and thresholds are untouched -- verified via the plan's own git-diff grep."
  - "rs-innovation-classifier.cjs's two single-axis branches (previously separate 'lsaHigh && !bertHigh' -> structural_transfer, '!lsaHigh && bertHigh' -> semantic_implementation) collapse into one 'lsaHigh !== bertHigh' branch calling classifyDirection(lsa, bert) -- both former branches produced the module's own answer by construction once exactly one axis is high, so one call site is correct and matches the plan's D-04 must-have exactly"
  - "scripts/rs-discovery-engine.cjs: the :580 empty-discovery synthetic envelope and the :648 chain-metadata classification fallback both flip from a fabricated 'structural_transfer' default to 'none' -- neither site represents an actual classifier verdict (one is a zero-discoveries placeholder, one is a missing/malformed classification guard), so 'none' (no signal) is the honest label, not a fabricated direction. emitChainMetadata's own unknown-rs_type branch (falls back to feeds_into 'JTBD') already handles 'none' gracefully with no change needed to rs-chain-feeder.cjs"
  - "The Phase 4 Synthesis loop's thesis-skip check (classifiedPair.classification === 'none' -> push {skipped:true, skipped_reason:'no_direction'} instead of calling generateThesis) leaves the existing Phase 94-02 thesis-merge coercion (non-string thesis -> 'no_thesis' sentinel in breakthroughs[i].thesis) untouched -- the skip object is non-string, so it already flows through that existing coercion correctly with zero additional change needed there"

patterns-established:
  - "Amended-test header convention: every test file this plan touched for a label flip carries an explicit 'Amended Phase 355 D-0N' header naming exactly which pinned expectations changed and why, per the plan's own D-06/D-58 must-have (never a silent rewrite)"

requirements-completed: []

duration: 90min
completed: 2026-09-24
---

# Phase 355 Plan 09: First Producer Flip (D-03, D-04) -- hsi-lsa, hsi-engine, rs-math, Innovation Classifier Summary

**Four producers now take their structural_transfer/semantic_implementation label from the one `lib/core/direction-convention.cjs` module instead of each carrying its own copy of the rule; the innovation classifier's below-floor pairs emit an explicit `'none'` sentinel instead of silently defaulting to `structural_transfer`, and the discovery engine routes a `'none'` pair past thesis generation (kept, never dropped) -- legs B, C, D and F of the RED cross-producer agreement test all turn green.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-09-24 (session start, sequential executor on the shared main tree)
- **Completed:** 2026-09-24
- **Tasks:** 2 completed
- **Files modified:** 0 created, 10 modified (8 code/test files + deferred-items.md + ROADMAP.md)

## Accomplishments

- `lib/core/rs-math.cjs`'s `classifyDirection` is now a one-line delegate to `direction-convention.cjs`'s `classifyDiff`; finite-input behavior byte-identical to before (verified: `tests/272-direction-convention.test.cjs`, `tests/272-rs-engine-contract.test.cjs` stay green)
- `lib/core/hsi-lsa.cjs`'s `classifyDirectionB` is retired as a separate Convention B computation -- the name is kept (existing importers do not break) but the body now delegates to `direction-convention.cjs`'s `classify`; the file's MUST-NOT-unify warning is re-scoped to the two SIMILARITY ALGORITHMS only (never unified, still separate), since the label rule was never algorithmic and is now deliberately unified
- `lib/core/hsi-engine.cjs`'s `computeHsiMatrix` calls `direction-convention.cjs`'s `classify` directly at the pair-label site, on the RAW (pre-`Number()`-coercion) matrix cell values so the `none` sentinel survives a missing/null lsa or semantic cell (a correctness gap the plan's action text did not spell out; caught by leg D's `missing-null-lsa` fixture pair, fixed under Rule 1 before the commit); both weight pairs (0.6/0.4, 0.7/0.3) and the threshold are byte-unchanged (grep-verified)
- `tests/272-hsi-lsa-algorithm.test.cjs` amended in place with a "Amended Phase 355 D-03" header and its two pinned `classifyDirectionB` label expectations flipped to match the delegated rule; the similarity-algorithm assertions (diagonal, max_features parametrization) are untouched
- `lib/core/rs-innovation-classifier.cjs` grows a 4th enum value `'none'`; the two single-axis branches collapse into one call to `direction-convention.cjs`'s `classify(lsa, bert)`; `hybrid` is unchanged; `BRIDGE_CONCEPT_BY_CLASSIFICATION.none` is `null`
- `scripts/rs-discovery-engine.cjs`: the `:580` empty-discovery synthetic envelope and the `:648` chain-metadata fallback both drop their fabricated `structural_transfer` default for `'none'`; the Phase 4 Synthesis loop routes a `'none'`-classified pair past `thesisGenerator.generateThesis` with `{skipped: true, skipped_reason: 'no_direction'}`, kept in `theses[]`, never dropped
- `lib/core/rs-thesis-generator.cjs` gains a doc-only note that `'none'` pairs never reach it (routed around by the discovery engine); no new mechanism added, its existing `invalid_classification` envelope is unchanged
- `lib/memory/test-rs-innovation-classifier.cjs` amended in place ("Amended Phase 355 D-04" header): Test 1 (lsa=0.5 bert=0.1) flips to `semantic_implementation`, Test 2 (lsa=0.1 bert=0.5) flips to `structural_transfer`, Test 4 and Test 5 (both below floor, including the exact-0.3 boundary) flip to `'none'` with `null` bridge_concept; Test 3 (hybrid) unchanged; 8/8 scenarios pass
- Legs B, C, D and F of `tests/test-355-direction-agreement.cjs` all turn green (confirmed: zero `FAIL:` lines starting with `B `, `C `, `D `, or `F `); legs E, G, H remain red exactly as designed, owned by 355-10 and 355-11

## Task Commits

Each task was committed atomically (`git commit --only`, sequential executor on the shared main tree):

1. **Task 1: rs-math delegates; hsi-lsa and hsi-engine flip to classify (D-03)** - `abe64f19b` (fix)
2. **Task 2: The classifier emits 'none' below floor; consumers amended (D-04)** - `5372e664e` (fix)

## Files Created/Modified

- `lib/core/rs-math.cjs` - `classifyDirection` delegates to `direction-convention.cjs`'s `classifyDiff`
- `lib/core/hsi-lsa.cjs` - `classifyDirectionB` retired, delegates to `direction-convention.cjs`'s `classify`; header re-scoped
- `lib/core/hsi-engine.cjs` - `computeHsiMatrix`'s pair-label call site uses `direction-convention.cjs`'s `classify` on raw matrix cells
- `tests/272-hsi-lsa-algorithm.test.cjs` - amended, D-03 header, two pinned labels flipped
- `lib/core/rs-innovation-classifier.cjs` - 4th enum `'none'`, single-axis branches unified via `classifyDirection(lsa, bert)`
- `lib/core/rs-thesis-generator.cjs` - doc-only D-04 routing note
- `scripts/rs-discovery-engine.cjs` - two `structural_transfer` defaults -> `'none'`; `'none'` pairs routed past thesis generation with `skipped_reason: 'no_direction'`
- `lib/memory/test-rs-innovation-classifier.cjs` - amended, D-04 header, Tests 1/2/4/5 flipped
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - four pre-existing, unrelated `lib/memory/test-rs-*.cjs` failures logged
- `.planning/ROADMAP.md` - 355-09 row checked, Plans counter 7/28 -> 8/28

## Decisions Made

See key-decisions in frontmatter: the raw-vs-coerced values fix in `hsi-engine.cjs` (Rule 1, a genuine bug the plan's literal text did not spell out but its own acceptance line required), the single-call-site unification in the classifier, the honest-`'none'`-over-fabricated-default choice at both `rs-discovery-engine.cjs` sites, and leaving the Phase 94-02 thesis-merge coercion untouched (already handles a non-string thesis correctly).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] hsi-engine.cjs's computeHsiMatrix swallowed the none sentinel via premature Number() coercion**
- **Found during:** Task 1's own verification (`node tests/test-355-direction-agreement.cjs`, leg D)
- **Issue:** The plan's action text says to call `classify(lsaSim, semSim)` where `lsaSim`/`semSim` were already `Number()`-coerced for the file's own arithmetic (`semanticSurprise`, `integrativeFactor` weighting). `Number(null)` is `0`, a finite number -- so a crafted pair with `lsa: null` (leg D's `missing-null-lsa` fixture) would have its `none` expectation silently lost, since `classify(0, semantic)` sees two finite numbers and returns a direction, not the sentinel.
- **Fix:** Captured the raw matrix cell values (`lsaSimRaw`, `semSimRaw`) before coercion; the existing `Number()` coercion into `lsaSim`/`semSim` stays for the arithmetic legs (byte-unchanged per the weights acceptance grep), but the `classify()` call now uses the raw values so `direction-convention.cjs`'s own null/non-finite gate runs on the real input.
- **Files modified:** `lib/core/hsi-engine.cjs` (this is the implementation, not a later patch -- fixed before the commit)
- **Verification:** `node tests/test-355-direction-agreement.cjs 2>&1 | grep -E "^FAIL: (B|C|D) "` -- zero matches after the fix (one `D` failure, `missing-null-lsa`, before it)
- **Committed in:** `abe64f19b` (Task 1 commit, no separate fix commit needed)

### Scope-boundary items (documented, not auto-fixed)

**1. [Scope Boundary] Four pre-existing `lib/memory/test-rs-*.cjs` failures, unrelated to this plan's files**
- **Found during:** Task 2's own verification (`for f in lib/memory/test-rs-*.cjs; do node "$f"; done`)
- **Issue:** `test-rs-chain-feeder-core.cjs` (2/10 fail, a Brain-client call-shape mismatch in `lookupUpstream`), `test-rs-fetcher-industry.cjs` (6 fail, a Canon Part 8 audit rejecting the test's own fixture query text), `test-rs-nl-to-query.cjs` (2/16 fail, allow-list intent handling returning null `brain_query`), `test-rs-sqlite-mirror.cjs` (3/12 fail, `writeDiscovery` writing 4 nodes instead of 3 on a fresh randomly-named tmp room, stable across two consecutive runs, not a concurrency artifact)
- **Why not fixed:** none of the four failing test files requires (directly or transitively) any file this plan touched -- confirmed by grepping every failing test's `require(` lines against this plan's `files_modified` list. `lib/memory/test-rs-discovery-engine.cjs` (the one test that DOES require `scripts/rs-discovery-engine.cjs` directly) passes cleanly (9/9), as does `lib/memory/test-rs-thesis-generator.cjs`. Fixing any of the four would mean editing `rs-chain-feeder.cjs`, `rs-fetcher-industry.cjs`, `rs-nl-to-query.cjs`, or `rs-sqlite-mirror.cjs` -- none in this plan's `files_modified` list, all out of scope per the Scope Boundary rule.
- **Files modified:** none (logged only)
- **Verification:** re-ran `test-rs-sqlite-mirror.cjs` a second time -- identical failure (4 !== 3), confirming stability, not a shared-tree concurrency flake (the test uses `crypto.randomUUID()`-named tmp rooms, no fixed shared path)
- **Committed in:** documented in `deferred-items.md`, part of the `5372e664e` Task 2 commit

---

**Total deviations:** 1 auto-fixed (Rule 1, hsi-engine.cjs raw-vs-coerced classify() input); 1 scope-boundary item (4 pre-existing unrelated test failures) logged to `deferred-items.md`.
**Impact on plan:** None on this plan's own deliverables -- all Task 1 and Task 2 acceptance criteria that depend on this plan's own files pass cleanly. The literal "every `lib/memory/test-rs-*.cjs` exits 0" verify line in Task 2 does not hold in this concurrent, multi-phase shared tree because of the four logged external failures; none of the four is caused by or fixable within this plan's scope.

## Issues Encountered

- `bash tests/run-all-355.sh` reports `PASS=33 FAIL=3 SKIP=6` after this plan -- identical PASS/FAIL/SKIP counts to the pre-plan baseline the orchestrator's briefing quoted. The 3 FAILs are exactly the three already-documented pre-existing ones (`test-355-direction-agreement.cjs` -- RED by design, now only legs E/G/H remain, owned by 355-10/355-11; `run-all-272.sh` -- the `@huggingface/transformers` version gap; `part8-egress-guard.test.cjs` -- PB8-03). No new regression introduced by this plan.
- `node scripts/doctor.cjs --acceptance` leg inside `run-all-355.sh` (`doctor --acceptance (no-new-regression vs BASE_355 baseline)`) reports PASSED -- no new doctor regression.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Legs C, D, F of `tests/test-355-direction-agreement.cjs` are green; **leg E** (rs-differential-scorer.scoreMeasured -- 355-10), **leg G** (Python detector still live in 4 callers -- 355-11), and **leg H** (comparison-to-label rule still duplicated in `lib/core/rs-chain-feeder.cjs`, `lib/core/rs-differential-scorer.cjs`, `lib/memory/test-rs-discovery-engine.cjs` -- 355-10 + 355-11) remain for those two plans to turn green
- `lib/core/rs-innovation-classifier.cjs`'s new `'none'` value and `scripts/rs-discovery-engine.cjs`'s `skipped_reason: 'no_direction'` routing are ready for 355-12 (stored-label readers, duplicate `SURPRISE_TYPES` enums, `eureka_critic` zod enum pinning) to build on -- `'none'` must stay classifier-only and never enter that enum, per this plan's own D-04 must-have
- Blocker/concern carried forward: four pre-existing, unrelated `lib/memory/test-rs-*.cjs` failures (chain-feeder-core, fetcher-industry, nl-to-query, sqlite-mirror) logged to `deferred-items.md` -- none blocks 355-10, 355-11, or any other 355 plan, since none is in any later 355 plan's stated file scope either, but flagged for the navigator to root-cause
- STATE.md intentionally NOT touched this run, per the orchestrator's shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here). `.planning/ROADMAP.md`'s phase-355 checklist row (355-09 checked, Plans counter 8/28) is the durable progress record instead.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 8 modified code/test files verified present on disk with the expected
content (`lib/core/rs-math.cjs`, `lib/core/hsi-lsa.cjs`, `lib/core/hsi-engine.cjs`,
`tests/272-hsi-lsa-algorithm.test.cjs`, `lib/core/rs-innovation-classifier.cjs`,
`lib/core/rs-thesis-generator.cjs`, `scripts/rs-discovery-engine.cjs`,
`lib/memory/test-rs-innovation-classifier.cjs`); both task commits
(`abe64f19b`, `5372e664e`) verified present in `git log`.
