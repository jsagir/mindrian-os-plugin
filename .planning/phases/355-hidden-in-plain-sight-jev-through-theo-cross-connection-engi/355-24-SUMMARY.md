---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 24
subsystem: measurement
tags: [hit-rate, fixture-rooms, blind-judging, baseline, checkpoint]

requires:
  - phase: 355-03
    provides: "direction-convention.cjs (DIRECTION_MEANING / NONE_MEANING) consumed by exportUnstamped's direction_phrase"
  - phase: 355-13
    provides: "hsi-engine / hsi-to-graph producer surface exportUnstamped runs"
  - phase: 355-14
    provides: "find-connections / Theo capture precedent for pair export shape"
  - phase: 355-23
    provides: "the render-gate baseline this plan's measurement sits downstream of"

provides:
  - "scripts/measure-355-hit-rate.cjs: guardRoomPath, exportUnstamped, wilson95, joinJudgments, computeRates, CLI (export --unstamped / --check / --help; stamp and record are 355-25's own scope)"
  - "tests/fixtures/355-rooms/pairings.items.json: 96 unstamped shown pairings across the three fixture rooms (room-ill-defined 32, room-extend 26, room-control 38), encoder MongoDB/mdbr-leaf-ir, top_k 30"
  - "tests/fixtures/355-rooms/judgments.json: the navigator's blind sitting-1 judgments, 96 items, labeler 'navigator', fixture_sha256-pinned to pairings.items.json"
  - ".planning/phases/.../labeling-session-pairings-unstamped.json: the raw label-355-gold session file behind the emitted judgments"

affects: [355-25, 355-26, 355-27, 355.1]

tech-stack:
  added: []
  patterns:
    - "Blind-before-stamped ordering as a git-order proof: the unstamped export and the navigator's sitting-1 judgments are committed while zero pairings-stamped file exists anywhere in tests/fixtures/355-rooms (D-32/D-33), so the baseline the navigator judged cannot have been anchored by seeing which pairs the engine itself marked verified"
    - "judgments.json's own key is items, not judgments -- the plan's inline Task 3 <verify> one-liner names j.judgments (a stale key in the plan text), but scripts/label-355-gold.cjs emit and scripts/measure-355-hit-rate.cjs's own joinJudgments both read judgmentsPayload.items; the file on disk and every consumer agree with each other, only the plan's inline verify string is out of sync"

key-files:
  created:
    - tests/fixtures/355-rooms/judgments.json
  modified:
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/labeling-session-pairings-unstamped.json
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "Verified the gold with the judgments.json items key (matching scripts/measure-355-hit-rate.cjs's joinJudgments and scripts/label-355-gold.cjs emit), not the plan's inline Task 3 <verify> string which names j.judgments -- the file, the CLI that wrote it, and the measurement script that reads it all agree with each other; only the plan's own inline verify text is stale. Recorded here rather than silently treated as a defect in judgments.json."
  - "Committed the gold as two separate task groups per the plan's own task boundaries: Task 3's judgments.json + session file first (docs(355-24): navigator blind sitting-1 judgments), then this SUMMARY + deferred-items.md as a second docs commit, then the ROADMAP row as a third -- matching the 355-10..23 precedent of never sweeping a peer's concurrent ROADMAP hunk near Phase 267 via a hand-built git apply --cached patch."

patterns-established: []

requirements-completed: []

duration: ~20min (Task 3 executor half only; navigator's own sitting-1 judging time is not executor duration)
completed: 2026-09-24
---

# Phase 355 Plan 24: Sitting 1 - The Navigator Judges the Unstamped Pairings Blind Summary

**96 unstamped shown pairings across three fixture rooms (32/26/38) were judged blind by the navigator in one continuous take before any stamped pairing file ever existed; the gold verifies clean against pairings.items.json's own sha256 and is now committed as the first human-judged baseline in the engine's history.**

## What Shipped

### Tasks 1-2 (already committed, this session's own executor half starts at Task 3)

Recorded here for a complete plan-level record, not re-executed:

1. **Task 1 - `feat(355-24): fixture-only hit-rate measurement script (HIPS-07)`** (`7aaefc600`): built `scripts/measure-355-hit-rate.cjs` test-first (RED then GREEN, `tests/test-355-hit-rate-record.cjs`). `guardRoomPath` refuses any `--room` that does not resolve (realpath + `path.sep` prefix containment) inside `tests/fixtures/355-rooms/`, so a tmp dir outside the tree, a sibling-prefix path, a symlink pointing outside, or anything under `os.homedir() + '/MindrianRooms'` all throw and the CLI exits non-zero. `exportUnstamped` copies each fixture room into an `os.tmpdir()` mkdtemp, runs the producers there only, dedupes pairs across producers, and throws `"fewer than 20 shown pairings in <room>"` instead of padding. `wilson95` computes the 95% Wilson score interval with no dependency. `joinJudgments`/`computeRates` join a blind judgments file against the items file and an optional stamps lookup, returning per-room/pooled/per-tier rates, unverified share, reason mix, not-called share, `already_known x tier` cross-tab, and false-friend counts per tier. CLI surface: `export --unstamped [--top n] [--room path]`, `--check` (exits 77 while `hit-rate-record.json` is absent), `--help`; `stamp`/`record` are 355-25's own scope.
2. **Task 2 - `data(355-24): unstamped shown pairings for the three fixture rooms (HIPS-07, D-32)`** (`e7b47a400`): ran `node scripts/measure-355-hit-rate.cjs export --unstamped --top 30 --threshold 0.2` once against the three fixture rooms using the real local encoder (`MongoDB/mdbr-leaf-ir`, dev machine). Wrote `tests/fixtures/355-rooms/pairings.items.json`: `room-ill-defined` 32 shown pairings (hsi, rs; eureka `substrate_unavailable` -- no entity-extract has run on these markdown-only fixture rooms), `room-extend` 26, `room-control` 38. 96 items total, no `stamp`/`stamp_lines`/`verification` field anywhere (unstamped baseline, D-32). `git status` on the fixture room trees was empty after the run (engines ran only on temp copies).

### Task 3 executor half (this session)

The navigator judged all 96 unstamped pairings blind in the CLI (`scripts/label-355-gold.cjs`, `start --set pairings-unstamped`) on 2026-09-24, in one clean take from 0 to 96 between 18:07 and 19:23 local time (Israel, UTC+3). An earlier partial take of 11 items was reset by a `start` re-run at 18:06 local and is not part of the gold that was emitted. `tests/fixtures/355-rooms/planted-cases.json` was never opened by anyone during the sitting (and this executor did not open it either, per the hard rule for this task). Mid-sitting, quick task `260924-ohd` (commit `d4dc94154`) added key echo and a `[n/96]` counter to the CLI; per its own SUMMARY this changed no entry, save, or emit behavior -- a documented byte-identical resume of a copy of the same session.

`node scripts/label-355-gold.cjs emit --set pairings-unstamped` had already been run by the orchestrator before this executor started, writing `tests/fixtures/355-rooms/judgments.json` (untracked at handoff). This executor:

1. Verified the gold with a node one-liner against `pairings.items.json`: `fixture_sha256` matches the file's own recomputed sha256 (`1fb0c813fcdb...`), `items.length === 96 === pairings items.length`, every `pair_id` present exactly once in both files with zero mismatch either direction, and all three judgment booleans (`useful`, `direction_ok`, `already_known`) present and correctly typed on every item. `labeler: "navigator"`, `labeled_at: 2026-09-24T16:23:28.824Z` (UTC), which is `19:23:28` local -- consistent with the sitting's own stated end time.
2. Ran `node tests/test-355-hit-rate-record.cjs`: **exit 0**, `PASS: 52 FAIL: 0` (all Task 1 legs: `guardRoomPath`, the static source scan, `exportUnstamped`, `wilson95`, `computeRates`/`joinJudgments`, `--check`, the CLI outside-room refusal, `--help`).
3. Confirmed `git ls-files tests/fixtures/355-rooms | grep -c pairings-stamped` prints `0` and `git status --porcelain -- tests/fixtures/355-rooms` showed only the untracked `judgments.json` before staging.
4. Committed `tests/fixtures/355-rooms/judgments.json` and the phase-dir session file `labeling-session-pairings-unstamped.json` (`git add -f`, gitignored under `.planning/`) together as `docs(355-24): navigator blind sitting-1 judgments (unstamped baseline)` (`e4bdb4354`), then verified `e4bdb4354` is an ancestor of `HEAD`.

## The Tallies (data, not a grade)

Computed directly from `judgments.json` joined to `pairings.items.json` by `pair_id`:

| | n | useful | direction_ok | already_known | novel-useful (useful AND NOT already_known) |
|---|---|---|---|---|---|
| **overall** | 96 | 43 | 16 | 45 | 18 |
| room-ill-defined | 32 | 21 | 4 | 13 | 8 |
| room-extend | 26 | 15 | 1 | 10 | 10 |
| room-control | 38 | 7 | 11 | 22 | 0 |

`direction_phrase` distribution across all 96 items in `pairings.items.json` (the phrase shown to the navigator at judging time, independent of whether he marked it correct):

| direction_phrase | count |
|---|---|
| "same meaning in different words" | 75 |
| "same words with different meaning" | 21 |

The `direction_ok` rate (16/96) is well below the raw phrase distribution's own 75/21 split -- the low count is the navigator's own judgment that the shown phrase was frequently NOT the right characterization of the pair, not an artifact of the export skewing toward one phrase label. Every `room-control` `useful` item was also `already_known` (novel-useful = 0 there); `room-extend` has the highest novel-useful rate (10 of 26).

## Plan-Verify Key Drift (documented, not a defect)

The plan's inline Task 3 `<verify>` one-liner names `j.judgments.length` and iterates `j.judgments.some(...)`. `judgments.json` on disk, `scripts/label-355-gold.cjs emit`, and `scripts/measure-355-hit-rate.cjs`'s own `joinJudgments` all use the key `items`, not `judgments` -- confirmed by reading `scripts/measure-355-hit-rate.cjs` lines 358-390 (`joinJudgments` destructures `judgmentsPayload.items`) and by running the verification one-liner above with the `items` key, which passes cleanly. This is a stale key name in the plan's own inline verify text, not a defect in the shipped file or the CLI that wrote it; every actual consumer of `judgments.json` agrees on `items`.

## Follow-ups

- **Navigator remark, ruling pending (logged to `deferred-items.md`, 355-24 Task 3, 2026-09-24):** during the sitting the navigator observed that all three fixture rooms are business/operations ventures and the only science-flavored content is `room-control`'s planted null material; he asked for "more scientific-style pairs, as we want to drive scientific breakthroughs." Orchestrator recommendation given, ruling pending: a fourth fixture room of type `research` with planted known cross-field transfers, so recall can be measured alongside this phase's precision-only baseline. Candidate scope for a later phase, not 355-24 (building a new fixture room is Rule 4 territory, outside this plan's declared `files_modified`).
- **The eureka `--stamp` gap** named in 355-18/355-20/355-23's own summaries stays open: `scripts/eureka-command.cjs` still does not build `--stamp` into its argv (`grep -n "eureka-portfolio-report\|--stamp" scripts/eureka-command.cjs` shows nothing). Unchanged by this plan; still named here per the shared-tree briefing's running-open-items convention.
- Plan 355-25 stamps the same 96 pairings, runs sitting 2 (stamped judging) and writes `355-VERIFICATION.md`, joining this sitting's blind judgments against the stamped tier/path data via `joinJudgments`/`computeRates`.

## Deviations from Plan

None against this executor's own scope (Task 3's executor half: verify, commit, deferred-items.md, SUMMARY, ROADMAP). No Rule 1/2/3 auto-fixes were needed. The plan-verify key drift above is a documentation finding, not a code deviation -- no file behavior was changed to accommodate it.

## STATE.md

Intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/359/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..23 precedent already recorded in every prior 355 plan's own SUMMARY). `.planning/ROADMAP.md`'s phase-355 checklist row (355-24 checked, Plans counter bumped) is the durable progress record instead.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

`tests/fixtures/355-rooms/judgments.json` and
`.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/labeling-session-pairings-unstamped.json`
both verified present on disk; commit `e4bdb4354` verified present in
`git log` and confirmed an ancestor of `HEAD`
(`git merge-base --is-ancestor e4bdb4354 HEAD`); Task 1 (`7aaefc600`) and
Task 2 (`e7b47a400`) commits verified present in `git log`; the gold
verification one-liner and `node tests/test-355-hit-rate-record.cjs`
(`PASS: 52 FAIL: 0`, exit 0) both re-ran clean at write time.
