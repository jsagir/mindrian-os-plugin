---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 15
subsystem: testing
tags: [jev, dev-time, hsi, thinking-mode, measurement, adoption-bar, not-adopted]

# Dependency graph
requires:
  - phase: 355-03
    provides: "scripts/label-355-gold.cjs emit --partial; tests/fixtures/355-hsi-thinking-mode-sentences.json, the navigator's blind gold, partial at n=45 (floor ruling, 87 items still open)"
  - phase: 355-07
    provides: "scripts/jev-devtime-client.cjs, scripts/jev-question-ceilings.cjs (THINKING_MODE_QUESTIONS/LABELS, makeSentenceCeiling, composeGuard, questionSha256, PINNED_MODEL), scripts/jev-response-schema.cjs"
provides:
  - "scripts/measure-hsi-thinking-mode.cjs: dev-time measurement CLI (live / --repeats / --jev-fixture / --check / --regex-only / --help); exports computeMetrics, applyAdoptionBar, buildBody, main"
  - "tests/fixtures/355-jev-hsi-responses.json: sha256-keyed recorded Jev responses (135 calls, 3 repeats x 45 gold sentences), offline-replayable"
  - "tests/fixtures/355-hsi-measurement-record.json: the machine record, decision SIGNED not_adopted"
  - "lib/core/hsi-spectral.cjs: anolog -> analog typo fix (D-58) in the integrative MODE_PATTERNS entry"
  - "355-JEV-MEASUREMENT.md: full measurement writeup, Decision section signed"
affects: ["355-28 (its Task 1 gate reads this record and skips all 3 tasks on not_adopted)", "355-26 (depends_on 355-15 for wave ordering and copies scripts/measure-hsi-thinking-mode.cjs's live/--check/response-keying structure; does not read tests/fixtures/355-jev-hsi-responses.json itself -- its own citation/usefulness fixtures are separate)", "355-21 (lib/hooks tripwire grep against this script)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-bar-before-results adoption gate (D-45): applyAdoptionBar is pure, tested before any live call, and the record's decision is mechanically forced to not_adopted when the bar does not clear on all 3 repeats -- the checkpoint only asks the navigator to sign what the numbers already determined, not to relitigate the bar"
    - "regex_prefix / regex_postfix split: a regex-affecting code fix (D-58 typo) is measured both before and after, so the adoption bar is always applied against the baseline users actually ship with, never a stale pre-fix number"

key-files:
  created:
    - scripts/measure-hsi-thinking-mode.cjs
    - tests/test-355-hsi-measurement-record.cjs
    - tests/fixtures/355-jev-hsi-responses.json
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-JEV-MEASUREMENT.md
  modified:
    - lib/core/hsi-spectral.cjs
    - tests/fixtures/355-hsi-measurement-record.json

key-decisions:
  - "Navigator ruling (2026-09-24, Task 3 checkpoint): not_adopted. The D-45 bar (>= 10 point full-set accuracy gap, none counted, no mode dropping more than 5 points below regex recall, on all 3 repeats) failed on every repeat, in the wrong direction -- Jev's full-set accuracy was 4.45 to 6.67 points BELOW the regex's (42.22%/42.22%/44.44% vs 48.89%), not above it, and descriptive/creative recall dropped 10-20 points past tolerance every repeat. Per D-45 the bar is never relaxed after results, so not_adopted was the only valid selection."
  - "Sample-size deviation, ruled at plan level not this checkpoint: this whole measurement runs on the navigator's partial gold (n=45 of the originally intended >= 120), per the 355-03 floor ruling. The navigator's own added reading (recorded verbatim in substance in the Decision section) names the gold itself as under-tested at this n (7-11 examples per mode; one sentence moves a mode's recall 9-14 points), and names the regex's zero-match-fallback share (10 of 19 descriptive answers, 22% of the whole set) as the specific blind spot this measurement could not fully test because zero none-labeled sentences exist in the partial gold."
  - "Next step, stated in the record per the checkpoint's explicit resume instruction: resume the labeling sitting to the full 132 sentences, re-emit the gold without --partial, and re-measure. Nothing in this plan attempted to relabel or supplement the 87 open items -- gold stays human-labeled only (355-03 ruling)."

patterns-established:
  - "Checkpoint-signs-a-mechanical-result: when a decision gate's outcome is fully determined by code run before the checkpoint (applyAdoptionBar here), the checkpoint's job is recording sign-off and the qualitative reading, not re-deriving the verdict"

requirements-completed: [HIPS-08]

# Metrics
duration: ~10min (this resumed session; Task 3 only, after Tasks 1-2 in prior sessions)
completed: 2026-09-24
---

# Phase 355 Plan 15: HSI Thinking-Mode Measurement (Jev vs Regex) Summary

**One unaided Jev Choice measured against the existing HSI thinking-mode regex on the navigator's blind gold (n=45, partial): the regex won on every repeat, so the navigator signed not_adopted -- the D-58 typo fix shipped regardless, and the adoption question is deferred to a future full-132 re-measure.**

## Performance

- **Duration:** ~10 min (this resumed session, Task 3 only; Tasks 1-2 completed in prior sessions per the completed-tasks table)
- **Completed:** 2026-09-24
- **Tasks:** 3 of 3 (Tasks 1-2 in prior sessions, Task 3 this session)
- **Files modified this session:** 2 (`tests/fixtures/355-hsi-measurement-record.json`, `355-JEV-MEASUREMENT.md`)

## Accomplishments

- Task 3 (this session): the record's `decision` field set to `not_adopted`, `signed_off_by: "navigator"`, `signed_off_at: "2026-09-24T06:09:36.000Z"`.
- 355-JEV-MEASUREMENT.md's `## Decision` section rewritten from "pending navigator sign-off" to the full ruling: the bar result per repeat, the navigator's reading on gold reliability at this sample size and the regex's structural `none`-blindness, and the one-line next step (complete the sitting to n=132, re-emit, re-measure).
- `node tests/test-355-hsi-measurement-record.cjs` green, 101/101 PASS including the decision leg.
- `node scripts/measure-hsi-thinking-mode.cjs --check` exit 0 (`3 repeats, 45 gold items, model jev-1.13.0, decision not_adopted`), confirming the signed record still replays byte-identical to the recorded responses.

Prior sessions (Tasks 1-2, for completeness): built `scripts/measure-hsi-thinking-mode.cjs` and its offline-replay test (RED/GREEN); ran 3 live repeats against the 45-item partial gold (135 calls, `non_200: 0`); fixed the D-58 `anolog` -> `analog` typo in `lib/core/hsi-spectral.cjs`; recomputed `regex_postfix` via `--regex-only`; wrote the full `355-JEV-MEASUREMENT.md` writeup with the bar left pending sign-off.

## Task Commits

1. **Task 1: scripts/measure-hsi-thinking-mode.cjs and its offline record test** - `9b1db66d1` (feat)
2. **Task 2: Three live repeats, D-58 typo fix, 355-JEV-MEASUREMENT.md** - `99c103b9e` (data)
3. **Task 3: navigator decision on HSI thinking-mode adoption** - `a52fba423` (docs)

No separate plan-metadata commit issued yet; this SUMMARY.md and STATE.md/ROADMAP.md updates are committed next per the standard flow.

## Files Created/Modified

- `scripts/measure-hsi-thinking-mode.cjs` - Dev-time measurement CLI (Task 1, unchanged this session)
- `tests/test-355-hsi-measurement-record.cjs` - Offline replay test (Task 1, unchanged this session)
- `tests/fixtures/355-jev-hsi-responses.json` - 135 recorded live responses (Task 2, unchanged this session)
- `lib/core/hsi-spectral.cjs` - D-58 typo fix (Task 2, unchanged this session)
- `tests/fixtures/355-hsi-measurement-record.json` - THIS SESSION: `decision` -> `not_adopted`, `signed_off_by` -> `"navigator"`, `signed_off_at` -> `"2026-09-24T06:09:36.000Z"`
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-JEV-MEASUREMENT.md` - THIS SESSION: `## Decision` section rewritten with the signed ruling, the navigator's reading, and the next-step line

## Decisions Made

See `key-decisions` in frontmatter above (navigator ruling verbatim in substance, sample-size deviation ruled at 355-03, next step). No additional executor-level decisions this session -- Task 3 was a mechanical record-and-rewrite of an already-computed, already-checkpointed decision.

## Deviations from Plan

**None this session — Task 3 executed exactly as the plan and checkpoint resolution specified.**

The plan-level deviation (measuring at n=45 instead of the originally intended >= 120) was already ruled and documented in 355-03-SUMMARY.md and carried into 355-JEV-MEASUREMENT.md's "Sample size ruling" section by Task 2, prior to this session. Task 3 did not introduce a new deviation; it recorded the navigator's checkpoint answer against the fixed bar exactly as computed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **355-28** (the adoption/distillation branch): its Task 1 gate reads `tests/fixtures/355-hsi-measurement-record.json`, sees `decision: "not_adopted"`, and writes "SKIPPED: navigator decision not_adopted (355-15)" for Tasks 1-3, creating no file under `data/` and leaving `lib/core/hsi-spectral.cjs` untouched beyond this plan's own D-58 typo fix. Confirmed against 355-28-PLAN.md's own conditional gate wording (`must_haves` truth: "CONDITIONAL (D-45): this plan does work ONLY if ... decision 'adopted'").
- **355-26**: depends on 355-15 (`depends_on: ["355-14", "355-15", "355-25", "355-28"]`) for wave ordering and copies `scripts/measure-hsi-thinking-mode.cjs`'s live/`--check`/response-keying structure as its own `read_first` reference. It does NOT read `tests/fixtures/355-jev-hsi-responses.json` at runtime -- its own two scripts (`calibrate-citation-check.cjs`, `judge-355-usefulness.cjs`) write and consume separate fixtures (`355-jev-citation-responses.json`, `355-jev-usefulness-responses.json`, `355-jev-calibration-record.json`) per its own plan frontmatter. This plan's `not_adopted` decision has no gating effect on 355-26 (355-26 is unconditional, `autonomous: true`, no D-45 gate reference in its `must_haves`).
- **STATE.md**: intentionally NOT updated this session, per the 355-06..23 precedent recorded in `<shared_tree_rules>` -- this working tree is shared with parallel executors on Phases 357/358/360/361, and `state.*` writes are reserved to avoid collision. STATE.md's Current Position / decisions ledger for 355-15 remains to be reconciled in a later, non-concurrent session.
- **REQUIREMENTS.md**: intentionally NOT updated this session, same reason. HIPS-08 (this plan's requirement) is not marked complete in REQUIREMENTS.md yet; that reconciliation, and the HIPS rows generally, are 355-27's responsibility per the same precedent this plan follows.
- **ROADMAP.md**: updated this session (355-15 row checked, Plans counter bumped 20/28 -> 21/28) via the patch-and-verify procedure (see below), following the 355-17..23 / 355-03 pattern for a shared tree.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*
