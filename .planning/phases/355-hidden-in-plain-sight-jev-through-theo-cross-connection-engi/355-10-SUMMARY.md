---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 10
subsystem: eureka-scoring
tags: [direction-convention, eureka, scoreMeasured, ranking-pin, atomic, d-47]

requires:
  - phase: 355-01
    provides: "lib/core/direction-convention.cjs (classify, classifyDiff, DIRECTIONS, DIRECTION_MEANING, NONE, NONE_MEANING, phraseHash)"
  - phase: 355-02
    provides: "tests/fixtures/355/direction-pairs.json, tests/test-355-direction-agreement.cjs (legs A-H, leg E scoped to this plan)"
  - phase: 355-09
    provides: "the delegation pattern (rs-math, hsi-lsa, hsi-engine, rs-innovation-classifier all call direction-convention.cjs) this plan extends to the fifth site"
provides:
  - "lib/core/rs-differential-scorer.cjs scoreMeasured delegates its direction label to direction-convention.cjs classify(lexical, semantic) instead of carrying its own inverted local rule"
  - "lib/core/eureka/portfolio-dimensions.cjs feasibilityFromRs's two label branches swapped in the SAME commit, so the meaning-to-feasibility map (and eureka's ranking) is unchanged"
  - "tests/fixtures/355/eureka-ranking-pin.json + tests/test-355-eureka-ranking-pin.cjs: a 14-pair, pre-flip-recorded proof that the flip did not silently reorder /mos:eureka"
  - "leg E of tests/test-355-direction-agreement.cjs turns green"
affects: [355-11, 355-12, 355-19, 355-25]

tech-stack:
  added: []
  patterns:
    - "Ranking-pin-before-flip: when a label flip feeds a live ranking, freeze the CURRENT ranking output into a fixture (via a --record generator mode, run once, pre-flip) before touching the label, then prove the same fixture stays green after the flip -- the pin, not a hand-written assertion, is the honesty proof"
    - "Swap-in-the-same-commit: a label rule flip and its downstream meaning-preserving branch swap land in ONE commit, never two, so there is no intermediate commit where the label is honest but the ranking is silently wrong"
    - "--record generator mode inside a test file: the SAME test file both generates (writes the fixture, once, behind a flag) and verifies (the default, read-only run) -- one source of truth for how the expected values were computed, no separate throwaway script"

key-files:
  created:
    - tests/fixtures/355/eureka-ranking-pin.json
    - tests/test-355-eureka-ranking-pin.cjs
  modified:
    - lib/core/rs-differential-scorer.cjs
    - lib/core/eureka/portfolio-dimensions.cjs
    - tests/test-211-measured-differential.cjs
    - tests/test-215-score.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "The BRIDGE_BAND (0.16-0.25) sits entirely below the production EUREKA_DIFF_FLOOR default (0.3), so no default-floor pair can ever have both abs_diff inside the band AND passes:true -- a genuine pre-existing tension in the shipped floors, not introduced or fixed by this plan (Rule 4 territory, out of scope). The ranking-pin test reaches the FEASIBILITY.bridge branch only via a per-pair EUREKA_DIFF_FLOOR override, a test-only seam that never touches the shipped EUREKA_DIFF_FLOOR_DEFAULT."
  - "The ranking-pin fixture's expected_feasibility/expected_score/expected_rank values are machine-recorded (node tests/test-355-eureka-ranking-pin.cjs --record run once against unflipped code), never hand-typed -- floating-point boundary effects at the exact BRIDGE_BAND edges (e.g. 0.66-0.5 not landing exactly on 0.16 in IEEE 754) surfaced during recording and are captured faithfully rather than rounded away by hand arithmetic."
  - "Composite score and rank in the ranking-pin test are computed through the SAME two functions scripts/eureka-portfolio-report.cjs's own scoring loop calls (pdims.scorePairDimensions + ahp.composeScore, weights from ahp.loadAhpConfig()'s committed all-1 matrix) plus the identical score-descending stable sort + 1-based rank assignment -- no re-derived math, so the pin proves the actual production ranking path, not an approximation of it."
  - "Every scoreMeasured consumer named in the plan's read_first (eureka-reach-runner.cjs, lateral-engine-adapter.cjs, graph-derive-classifier.cjs, intel-pipeline.cjs, graph-backfill.cjs) was re-read: none branches on the direction label's VALUE (eureka-reach-runner.cjs only checks SET membership via SURPRISE_TYPES.indexOf, both labels pass; lateral-engine-adapter.cjs and graph-derive-classifier.cjs pass the label through or ignore it, reading .semantic instead). No second label-keyed consumer needed swapping beyond portfolio-dimensions.cjs."

patterns-established:
  - "Ranking-pin fixture pattern (tests/fixtures/355/eureka-ranking-pin.json): input fields (lexical, semantic, optional floor override, dimsA/dimsB) plus machine-recorded expected_feasibility/expected_score/expected_rank, guarded by a --record/verify dual-mode test so the fixture is never hand-edited"

requirements-completed: [HIPS-01]

duration: 70min
completed: 2026-09-24
---

# Phase 355 Plan 10: D-47 Atomic Flip -- scoreMeasured + Feasibility Branch Swap Summary

**The fifth and last live-eureka direction site (`rs-differential-scorer.cjs`'s `scoreMeasured`) now delegates to `direction-convention.cjs`'s `classify()` instead of carrying its own inverted copy of the rule, and `portfolio-dimensions.cjs`'s `feasibilityFromRs` had its two label branches swapped in the SAME commit -- proven by a 14-pair ranking-pin fixture recorded on unflipped code that stays 45/45 green, byte-unchanged, after the flip.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-09-24 (sequential executor on the shared main tree)
- **Completed:** 2026-09-24
- **Tasks:** 2 completed
- **Files modified:** 2 created, 6 modified

## Accomplishments

- `lib/core/rs-differential-scorer.cjs`'s `scoreMeasured` no longer carries an inverted local ternary (`signed_diff > 0 ? 'semantic_implementation' : 'structural_transfer'`, the mirror image of every other producer per 355-RESEARCH.md correction C1); it now calls `direction-convention.cjs`'s `classify(lexical, semantic)`. `signed_diff`, `abs_diff`, `highLeg` (still sign-keyed, byte-unchanged), `passes`, `band` and every floor line are untouched (grep-verified: zero remaining occurrences of the inverted ternary pattern).
- `lib/core/eureka/portfolio-dimensions.cjs`'s `feasibilityFromRs` swapped its two label branches in the exact same commit (correction C2): `'semantic_implementation'` now reaches the in-band-bridge (1.0) / out-of-band-transfer (0.7) check; `'structural_transfer'` now reaches the paraphrase-risk floor (0.4). The pair-to-feasibility MAP is unchanged, so eureka's ranking is unchanged -- only the label's own meaning became honest.
- `tests/fixtures/355/eureka-ranking-pin.json` (14 pairs) + `tests/test-355-eureka-ranking-pin.cjs` (dual-mode `--record`/verify): recorded today's feasibility/composite-score/rank on UNFLIPPED code (Task 1, committed before the flip), then re-run unchanged after Task 2's flip -- 45/45 assertions still pass, fixture byte-identical on disk. Coverage spans lexical-high/semantic-low inside and outside `BRIDGE_BAND`, semantic-high/lexical-low, an exact tie, a `passes:false` pair, and a deliberate 3-way composite-score tie (ranks 5/6/7) proving Node's stable sort preserves original fixture order on ties.
- `tests/test-211-measured-differential.cjs` Tests 5-6 and `tests/test-215-score.cjs` Tests 3-4 amended with "Amended Phase 355 D-47" header lines; only the expected `direction` strings changed, every numeric expectation (semantic, lexical, signed_diff, passes, band, and every feasibility number 1.0/0.7/0.4/0.1) is byte-identical to before.
- Leg E of `tests/test-355-direction-agreement.cjs` turns green (zero `FAIL: E ` lines); legs G and H remain red exactly as designed, owned by 355-11.
- The BRIDGE_BAND-vs-EUREKA_DIFF_FLOOR tension noted in `key-decisions` above is left exactly as documented in 355-RESEARCH.md Open Question 1 -- this plan preserves today's ranking byte-for-byte, it does not change what eureka rewards.

## Task Commits

Each task was committed atomically (`git commit --only`, sequential executor on the shared main tree):

1. **Task 1: Pin today's eureka feasibility and rank order on UNCHANGED code** - `dd6d7c08a` (test)
2. **Task 2: ATOMIC - flip scoreMeasured and swap the feasibility branches in one commit; amend 211 and 215 (D-47)** - `522b2d6b8` (fix)

**Plan metadata:** `2e3fadd18` (docs: ROADMAP checkbox + Plans counter, staged via targeted `git add -p` hunks to avoid a peer session's concurrent unrelated edits elsewhere in the file)

## Files Created/Modified

- `tests/fixtures/355/eureka-ranking-pin.json` - 14 (lexical, semantic) pairs with machine-recorded pre-flip feasibility/score/rank
- `tests/test-355-eureka-ranking-pin.cjs` - dual-mode ranking-pin test (`--record` generator / default verifier)
- `lib/core/rs-differential-scorer.cjs` - `scoreMeasured` direction now delegates to `direction-convention.cjs` classify
- `lib/core/eureka/portfolio-dimensions.cjs` - `feasibilityFromRs`'s two label branches swapped
- `tests/test-211-measured-differential.cjs` - Tests 5-6 `direction` expectations flipped
- `tests/test-215-score.cjs` - Tests 3-4 `direction` fixtures swapped (feasibility numbers unchanged)
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - one pre-existing, unrelated `test-218-cohort-stratification.cjs` failure logged
- `.planning/ROADMAP.md` - 355-10 row checked, Plans counter 8/28 -> 9/28

## Decisions Made

See key-decisions in frontmatter: the BRIDGE_BAND-vs-EUREKA_DIFF_FLOOR pre-existing tension (test-seam floor override, not a shipped-code change), the machine-recorded (never hand-typed) ranking-pin fixture, reusing the exact production scoring/ranking functions in the pin test, and the consumer re-read confirming no second label-keyed branch existed.

## Deviations from Plan

### Auto-fixed Issues

None - both tasks' action steps were followed as written. No Rule 1/2/3 auto-fixes were needed to `lib/core/rs-differential-scorer.cjs` or `lib/core/eureka/portfolio-dimensions.cjs` themselves.

### Scope-boundary items (documented, not auto-fixed)

**1. [Scope Boundary] `tests/test-218-cohort-stratification.cjs` pre-existing failure, unrelated to the D-47 flip**
- **Found during:** Task 2's own cross-check for regressions beyond the plan's required verify list
- **Issue:** `node tests/test-218-cohort-stratification.cjs` fails with `insertNode: invalid epistemic_type "undefined"`.
- **Why not fixed:** Confirmed pre-existing by temporarily restoring `lib/core/rs-differential-scorer.cjs` and `lib/core/eureka/portfolio-dimensions.cjs` to their pre-Task-2 (`HEAD`) content and re-running -- the identical failure reproduces on unmodified code. The test file itself contains zero references to `direction`, `structural_transfer`, `semantic_implementation`, or `epistemic_type`; the failure originates in a navigation/`insertNode` call path this plan's `files_modified` list does not touch.
- **Files modified:** none (logged only, then the two source files were restored to their Task-2 edited state and re-verified green before committing)
- **Verification:** re-ran the full Task 2 verify chain after restoring the edits; all green
- **Committed in:** documented in `deferred-items.md`, part of the `522b2d6b8` Task 2 commit

**2. [Documented deviation, no functional impact] Task 2 commit includes `deferred-items.md` as a 5th file**
- **Found during:** Preparing the Task 2 commit
- **Issue:** The plan's acceptance criterion literally lists 4 files (`rs-differential-scorer.cjs`, `portfolio-dimensions.cjs`, `test-211-measured-differential.cjs`, `test-215-score.cjs`) "plus any consumer swapped under the read_first rule." `deferred-items.md` is documentation, not a swapped consumer.
- **Why not restructured:** Matches the 355-09 precedent (that plan's Task 2 commit also bundled its deferred-items.md entry into the task commit rather than a separate commit). Bundling avoids an orphan intermediate commit state and keeps the "what changed and why" reasoning together with the code that prompted it.
- **Files modified:** `.planning/phases/.../deferred-items.md`
- **Committed in:** `522b2d6b8` (Task 2 commit)

---

**Total deviations:** 0 auto-fixed; 2 documented (1 scope-boundary logged failure, 1 commit-composition note). No functional impact on this plan's own deliverables.
**Impact on plan:** None on this plan's own acceptance criteria -- all Task 1 and Task 2 acceptance lines pass exactly as specified.

## Issues Encountered

- `git commit --only -- <path>` (the shared-tree rules' documented idiom) fails with "pathspec did not match any file(s) known to git" for a brand-new UNTRACKED file -- confirmed this is standard git behavior (pathspec-limited commit requires the path already be staged via `git add` first for a wholly new file; `--only` then restricts to exactly the staged path's content). Task 1's two new files were `git add`-ed first, then `git commit --only -- <paths>` worked as expected.
- Mid-plan, `.planning/ROADMAP.md` on disk carried a peer session's concurrent, unrelated edit (two blank-line removals near Phase 267 and Phase 355.1, neither touching Phase 355's own section) alongside my two intended edits (Plans counter, 355-10 checkbox). A blanket `git commit --only -- .planning/ROADMAP.md` would have pulled the peer's unrelated hunks into my commit (the shared-tree "never commit unowned diffs" rule). Resolved via `git add -p` to stage only my two hunks into the index, then a plain `git commit` (no `--only`, no `-a`) committing exactly the staged index -- the peer's two hunks remain unstaged on disk, untouched, theirs to commit.
- `tests/run-all-355.sh` was not re-run in full this session (per the orchestrator's shared-tree briefing precedent from 355-02/355-09, a full run is expensive and the individual leg commands specified in the plan's own `<verify>` blocks were run directly and confirmed green instead).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Leg E of `tests/test-355-direction-agreement.cjs` is green; legs G (Python detector still live) and H (comparison-to-label rule still duplicated outside the module, in the files 355-11 owns) remain for 355-11.
- `tests/fixtures/355/eureka-ranking-pin.json` and `tests/test-355-eureka-ranking-pin.cjs` are committed and available as a regression guard for any future eureka-scoring change: re-running the test after any future edit to `scoreMeasured` or `feasibilityFromRs` proves whether the ranking moved.
- Blocker/concern carried forward: `test-218-cohort-stratification.cjs`'s pre-existing `insertNode: invalid epistemic_type "undefined"` failure (confirmed unrelated to this plan, reproduces on unmodified `HEAD` code) logged to `deferred-items.md` for the navigator/a future phase to root-cause. Does not block 355-11 or any other 355 plan.
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..09 precedent). `.planning/ROADMAP.md`'s phase-355 checklist row (355-10 checked, Plans counter 9/28) is the durable progress record instead.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*
