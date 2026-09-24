---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 26
subsystem: testing
tags: [jev, dev-time, citation-check, usefulness-judge, calibration, offline-replay]

# Dependency graph
requires:
  - phase: 355-14
    provides: "tests/fixtures/355-citation-pairs.items.json (43 templated items, 5 strata, 8 no_path), tests/fixtures/355-citation-pairs.json (machine-labeled citation gold, claude-opus-5.5, labeler_kind external_model, 35 says_nothing / 8 contradicts / 0 supports)"
  - phase: 355-15
    provides: "scripts/measure-hsi-thinking-mode.cjs's live/--jev-fixture/--check/response-keying skeleton, copied as this plan's own structure (not its response fixture, which this plan never reads)"
  - phase: 355-25
    provides: "tests/fixtures/355-rooms/stamps.json (Task 1 only, commit c06156693: strong 13, indirect 1, unverified 82, not_called 77) and tests/fixtures/355-rooms/judgments.json (355-24's navigator blind sitting-1 gold, 96 items)"
  - phase: 355-28
    provides: "wave-ordering dependency only (355-28's not_adopted decision has no gating effect on this plan, which is unconditional)"
provides:
  - "scripts/calibrate-citation-check.cjs: stated-vs-withheld citation_check calibration CLI (live / --jev-fixture / --check / --help); exports runCalibration, summarizeVariant, bandFromMeasured"
  - "scripts/judge-355-usefulness.cjs: D18 usefulness-judge-vs-navigator CLI (live / --jev-fixture / --check / --help); exports runJudge, agreement"
  - "tests/fixtures/355-jev-citation-responses.json, tests/fixtures/355-jev-usefulness-responses.json: sha256-keyed recorded Jev responses, offline-replayable"
  - "tests/fixtures/355-jev-calibration-record.json: the shared machine record (citation + usefulness sections, each script touching only its own)"
  - "355-JEV-MEASUREMENT.md: two new sections appended (Citation-check calibration; Usefulness judge vs navigator), 355-15's prior sections byte-unchanged"
affects: ["355-27 (Theo T-2 outbound note draws on both new sections; HIPS-09 requirement row)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closure-ceiling-without-makeCitationCeiling: the citation item file already carries each item's pre-rendered claim/hop-shaped path (built by 355-14 via renderClaim/hopsFromTheoPath from a live Theo capture), so calibrate-citation-check.cjs composes composeGuard(makeEgressGuard(EGRESS_PROFILES.citation_check), closure) directly, asserting byte/deep equality against the item's own claim and path, rather than reconstructing a raw {path, pathLabels, edges} Theo shape to feed jev-question-ceilings.cjs's makeCitationCeiling"
    - "Shared-record section-touching: both scripts read/write the SAME tests/fixtures/355-jev-calibration-record.json, each merging only its own top-level key (citation / usefulness) via Object.assign over the existing file, proved by a dedicated section-touching test leg"
    - "Denominator guard via hard abort, not shrink: unlike 355-15's per-item failed-row collection, both new scripts abort the WHOLE run (throw) on any item that is still failed after one retry, rather than reporting on a partially-succeeded set -- a stricter policy fitting a one-shot dev-time calibration run"

key-files:
  created:
    - scripts/calibrate-citation-check.cjs
    - scripts/judge-355-usefulness.cjs
    - tests/test-355-jev-calibration-record.cjs
    - tests/fixtures/355-jev-citation-responses.json
    - tests/fixtures/355-jev-usefulness-responses.json
    - tests/fixtures/355-jev-calibration-record.json
  modified:
    - tests/test-353-tripwires.cjs
    - lib/core/eureka-critic.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-JEV-MEASUREMENT.md
    - .planning/ROADMAP.md

key-decisions:
  - "[Rule 3 - blocking issue] lib/core/eureka-critic.cjs defines confidenceFromBucket but never exported it. bandFromMeasured (this plan's own required export, D-46) must call the exact same function eureka-critic.cjs uses internally so a band is never computed from a second, drifted copy of the calibration bands. Added one export line, zero logic change; commit 8dc2e4db5."
  - "The citation gold's two structural limitations from 355-14-SUMMARY.md are stated plainly in 355-JEV-MEASUREMENT.md, not glossed over: supports is unreachable in this item set (no ALIAS_OF path was sampled, so this calibration is really a two-class says_nothing-vs-contradicts measurement), and all 8 contradicts gold items are the synthetic contradicting stratum (Theo's canon returned none naturally)."
  - "already_known rate per tier (share of Jev's OWN answers that were already_known) and already_known_agreement (Jev's already_known choice vs the navigator's own already_known boolean) are reported as two distinct figures, per the execution notes -- conflating them would have hidden that Jev almost never says already_known (2 of 96) against a navigator who marked 45 of 96 already_known."
  - "direction_ok was deliberately never sent to Jev and carries no agreement figure in this record -- out of scope for AI-SPEC D18, which asks about usefulness, not direction correctness."

patterns-established:
  - "ENV-GAP-then-77 test structure for cross-task git-ancestry legs: a test file whose final legs depend on artifacts a LATER task in the same plan will create checks fs.existsSync first, logs ENV GAP and sets a skip flag rather than failing, and the run() driver exits 77 (not 0, not 1) when every other leg passed but the ENV-GAP flag is set -- mirrors tests/test-356-answer-key.cjs's D-16 leg, reused here across Task 1 (record absent) and Task 2 (record present, full ancestry proof)."

requirements-completed: [HIPS-09]

# Metrics
duration: ~25min
completed: 2026-09-24
---

# Phase 355 Plan 26: Citation-Check Calibration and Usefulness Judge vs Navigator Summary

**Two dev-time Jev measurements, both offline-replayable: stated-vs-withheld citation-check calibration lands at 95.35% exact agreement (stated) vs 58.14% (withheld) against the 355-14 machine-labeled gold, with the stated-rule auto-verdict slice's measured band coming out `high` (23/23 correct); a usefulness Choice judged against the 355-24 navigator's blind sitting-1 gold (96 pairings) agrees 76.04% overall, worse on `strong`-tier pairings (53.85%) than on `unverified` ones (79.27%), and is far more reluctant than the navigator to call anything already-known (2 of 96 vs the navigator's 45 of 96).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-24
- **Tasks:** 2 of 2
- **Files created/modified:** 10

## Accomplishments

- **Task 1 (TDD):** Wrote `tests/test-355-jev-calibration-record.cjs` (18 legs, 104 checks at RED-with-real-record-absent time) alongside `scripts/calibrate-citation-check.cjs` and `scripts/judge-355-usefulness.cjs`, both copying `scripts/measure-hsi-thinking-mode.cjs`'s live / `--jev-fixture` / `--check` skeleton and reusing `scripts/jev-question-ceilings.cjs`'s `CITATION_QUESTIONS_STATED/WITHHELD`, `USEFULNESS_QUESTIONS` and `makeUsefulnessCeiling` directly. `calibrate-citation-check.cjs` composes its own closure over `EGRESS_PROFILES.citation_check` rather than `makeCitationCeiling` (the item file already carries pre-rendered claim/path, so no raw-Theo-path reconstruction is needed). Both scripts refuse without a labeled, sha256-matched gold (D-32); the citation script's `no_path` array (8 of 51 total citation entries) makes zero Jev calls, proved directly against the real fixture file (43 items x 2 variants = 86 calls, 0 extra for the 8 no-path entries). Appended `calibrate-citation-check` and `judge-355-usefulness` to `tests/test-353-tripwires.cjs`'s `HOOKS_BANNED_LEDGER_SCRIPTS` in the same commit. Fixed a Rule 3 blocking gap: `lib/core/eureka-critic.cjs` defined `confidenceFromBucket` but never exported it; added the one-line export. `node tests/test-355-jev-calibration-record.cjs` exits 77 at this point (104/104 PASS, the real git-ancestry legs ENV-GAP-skip since the real record does not exist yet). `node tests/test-353-tripwires.cjs` PASS=5 FAIL=0.
- **Task 2:** Ran both scripts live, once each, using the dev-time key already present on this machine (`loadKey()`, never printed): `calibrate-citation-check.cjs` (86 calls, 45,275 input tokens, ~$0.0019) and `judge-355-usefulness.cjs` (96 calls, 79,231 input tokens, ~$0.0033). Both `--check` modes and the full record test (now with the real response fixtures present) pass with zero SKIP: 110/110 checks, including the two real D-32/D-33 git-ancestry legs (355-14's citation gold commit is an ancestor of the commit that first added `355-jev-citation-responses.json`; 355-24's judgments commit is an ancestor of the commit that first added `355-jev-usefulness-responses.json`). Appended the two required sections to `355-JEV-MEASUREMENT.md`; the append-only acceptance check (`git diff HEAD~1 -- <file> | grep '^-' | grep -v '^---' | wc -l`) prints 0.

## Task Commits

1. **Task 1: Both calibration scripts with offline replay, and the record test** - `8dc2e4db5` (feat)
2. **Task 2: Live runs, the machine record and the 355-JEV-MEASUREMENT.md sections** - `cab1afd2c` (data)
3. **Plan-level roadmap row** - `6e9273a83` (docs)

All three commits confirmed ancestors of HEAD (`git merge-base --is-ancestor <sha> HEAD`, each exits 0). `git log --oneline -6` at write time:

```
6e9273a83 docs(355-26): roadmap row
cab1afd2c data(355-26): citation-check calibration + usefulness-judge agreement recorded (HIPS-09)
8dc2e4db5 feat(355-26): citation-check calibration and usefulness judge, dev-time with offline replay (HIPS-09, D-46)
c06156693 data(355-25): stamps for the judged fixture pairings via one live Theo capture (HIPS-04, HIPS-07)
500ab03e6 docs(355-24): roadmap row
677feb1c2 docs(355-24): summary and deferred items
```

## Files Created/Modified

- `scripts/calibrate-citation-check.cjs` - Stated-vs-withheld citation_check calibration CLI
- `scripts/judge-355-usefulness.cjs` - D18 usefulness-judge-vs-navigator CLI
- `tests/test-355-jev-calibration-record.cjs` - Offline replay + refusal + zero-call + git-ancestry record test, 110 checks green
- `tests/fixtures/355-jev-citation-responses.json` - 86 recorded live citation-check responses
- `tests/fixtures/355-jev-usefulness-responses.json` - 96 recorded live usefulness-judge responses
- `tests/fixtures/355-jev-calibration-record.json` - The shared machine record (citation + usefulness sections)
- `tests/test-353-tripwires.cjs` - `HOOKS_BANNED_LEDGER_SCRIPTS` gains `calibrate-citation-check`, `judge-355-usefulness`
- `lib/core/eureka-critic.cjs` - Exported `confidenceFromBucket` (Rule 3 fix)
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-JEV-MEASUREMENT.md` - Two new sections appended (append-only, 355-15's content byte-unchanged)
- `.planning/ROADMAP.md` - 355-26 row checked, Plans counter 25/28 -> 26/28

## The Numbers (data, not a grade)

### Citation-check calibration (D-46, AI-SPEC D15)

| Variant | n | Exact agreement | Auto-verdict slice (confidence >= 0.8) | Coverage | Human-routed |
|---|---|---|---|---|---|
| stated | 43 | 41/43 (95.35%) | 23/23 (100.00%) | 53.49% | 46.51% |
| withheld | 43 | 25/43 (58.14%) | 10/12 (83.33%) | 27.91% | 72.09% |

`band_stated` = `confidenceFromBucket({correct: 23, n: 23})` = **high**. Seam rule recorded: high -> auto-verdict at >= 0.8; medium -> every verdict to a human; low or unknown -> rewrite the question first. No verdict from this calibration reaches a runtime stamp this phase (`judge` stays `'none'`).

**Two limitations that apply to every citation number above** (both already flagged in 355-14-SUMMARY.md, restated here per the plan's own execution notes): `supports` is structurally unreachable in this 43-item set (no `ALIAS_OF` path was sampled, so this is effectively a two-class `says_nothing`-vs-`contradicts` measurement, not the full three-class schema); all 8 `contradicts` gold items are the synthetic `contradicting` stratum 355-14 constructed itself, since Theo's canon returned zero naturally-occurring `CONTRASTS_WITH` edges among the sampled pairs.

### Usefulness judge vs navigator (AI-SPEC D18)

| | n | Agree | Rate |
|---|---|---|---|
| overall | 96 | 73 | 76.04% |
| unverified tier | 82 | 65 | 79.27% |
| strong tier | 13 | 7 | 53.85% |
| indirect tier | 1 | 1 | 100.00% (n=1, not a meaningful rate) |

`already_known` rate per tier (share of Jev's own answers): unverified 2/82 (2.44%), strong 0/13 (0%), indirect 0/1 (0%). Separately, agreement on the navigator's own `already_known` label (Jev's `already_known` choice vs the navigator's boolean, overall): 53/96 (55.21%) -- the navigator marked 45 of 96 already_known while Jev's choice landed there only twice, so the two figures diverge sharply and must be read as answering different questions. `direction_ok` was never sent to Jev; no agreement figure for it exists. Jev's answers never enter the hit rate -- 355-VERIFICATION.md's D16 rate (355-25) is computed from `judgments.json` (human labels) alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] `lib/core/eureka-critic.cjs` defined `confidenceFromBucket` but never exported it**

- **Found during:** Task 1, while implementing `bandFromMeasured` in `scripts/calibrate-citation-check.cjs`
- **Issue:** `require('.../eureka-critic.cjs').confidenceFromBucket` was `undefined` -- the function exists at module scope (used internally by `criticRule`) but `module.exports` never listed it. D-46 requires `bandFromMeasured` to equal `confidenceFromBucket`'s own answer exactly, so this plan cannot supply its own copy without risking drift from the canonical bands.
- **Fix:** Added one export line (`confidenceFromBucket: confidenceFromBucket`) to `eureka-critic.cjs`'s existing `module.exports` block, zero logic change.
- **Files modified:** `lib/core/eureka-critic.cjs`
- **Verification:** `node tests/test-355-jev-calibration-record.cjs`'s `bandFromMeasured === confidenceFromBucket` leg (5 buckets including `null` and an empty bucket) passes; no other test in the repo asserts on `eureka-critic.cjs`'s export shape, so this is additive-only.
- **Committed in:** `8dc2e4db5` (feat, same commit as the two new scripts)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking issue)
**Impact on plan:** Necessary for `bandFromMeasured` to exist at all without duplicating the calibration-band logic; no scope creep (a one-line additive export, found and fixed while directly implementing this plan's own D-46 requirement).

## Issues Encountered

None beyond the Rule 3 fix above.

## User Setup Required

None. The dev-time vendor key was already present on this machine (`TYPESAFE_API_KEY` or `~/.secrets/typesafe.env`, resolved via `loadKey()`); Task 2's live runs used it without any setup step, and the key was never printed, logged, or written to any committed file.

## Attribution Note

Every commit this session used the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`, per this session's own attribution instructions (which supersede the plan's generic "whatever trailer your environment gives you" guidance -- no deviation to note; the trailer used is exactly the one specified).

## Next Phase Readiness

- **355-27** (close-out): both new `355-JEV-MEASUREMENT.md` sections and `tests/fixtures/355-jev-calibration-record.json` are ready inputs for the Theo T-2 outbound note and for registering HIPS-09 in `REQUIREMENTS.md`.
- **STATE.md**: intentionally NOT touched this session, per the 355-06..355-25 precedent recorded in every prior 355 plan's own SUMMARY (this working tree may be shared with parallel executors on other phases; `state.*` writes are reserved to avoid collision).
- **REQUIREMENTS.md**: intentionally NOT touched this session, same reason -- HIPS-09 registration is 355-27's job.
- **ROADMAP.md**: updated this session (355-26 row checked, Plans counter 25/28 -> 26/28) via the index-patch procedure (build against `git show HEAD:...`, `git apply --cached` a two-hunk patch, verify `git diff --cached` shows only those two hunks, commit the index, then apply the identical edits to the on-disk file with the Edit tool -- confirmed zero diff between the two afterward).

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All created files confirmed present on disk: `scripts/calibrate-citation-check.cjs`, `scripts/judge-355-usefulness.cjs`, `tests/test-355-jev-calibration-record.cjs`, `tests/fixtures/355-jev-citation-responses.json`, `tests/fixtures/355-jev-usefulness-responses.json`, `tests/fixtures/355-jev-calibration-record.json`, this SUMMARY. All three commits (`8dc2e4db5`, `cab1afd2c`, `6e9273a83`) confirmed present in `git log --oneline --all` and confirmed ancestors of `HEAD` via `git merge-base --is-ancestor`. `node scripts/calibrate-citation-check.cjs --check`, `node scripts/judge-355-usefulness.cjs --check` and `node tests/test-355-jev-calibration-record.cjs` all re-ran clean (exit 0, 110/110) at write time.
