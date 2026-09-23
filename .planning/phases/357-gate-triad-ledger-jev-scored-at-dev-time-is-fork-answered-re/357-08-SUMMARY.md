---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 08
subsystem: testing
tags: [dogfood, jev, part8, navigator-checkpoint, card-fire, known-false-block]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 04)
    provides: scripts/label-card-fire-replay.cjs (the dev-time labeler, dogfood refusal)
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 06)
    provides: scripts/extract-dogfood-stop-events.cjs, tests/fixtures/card-fire-replay/dogfood.json (24 local-labeled entries), 357-DOGFOOD-LABELS.md
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 07)
    provides: the D-07/D-08a runtime fixes that took HEAD to 0 false_blocks before this plan's ruling
provides:
  - 357-JEV-LABEL-REPORT.md (36 rows, sources 238/debug/live only, 0 dogfood rows, 13 disagreements, 2 uncertain)
  - tests/fixtures/card-fire-replay/dogfood.json, all 24 entries label_origin human, ratified_at 2026-09-23
  - the R-C case (dogfood-0f86dd63-092046) ruled known_false_block, excluded from the 0-false-block bar
  - 357-DOGFOOD-LABELS.md stamped with HEAD verdicts, the Jev disagreements section, and the Ratified section
affects: [357-09, 357-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Navigator checkpoint stamping: a review sheet grows a dated ## Ratified section carrying the verbatim reply, never a paraphrase, so the SUMMARY and the sheet agree on record"
    - "known_false_block is a first-class fixture state (card-fire-replay-corpus.cjs validateEntry): expected_verdict_class pass plus a reason object naming the text dependence, counted separately from false_blocks by the replay harness"

key-files:
  created: []
  modified:
    - tests/fixtures/card-fire-replay/dogfood.json
    - .planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-DOGFOOD-LABELS.md
    - .planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-JEV-LABEL-REPORT.md

key-decisions:
  - "All 24 dogfood rows ratified as proposed (navigator: approved); label_origin flipped local -> human on every entry"
  - "R-C (dogfood-0f86dd63-092046) ruled known_false_block: the surviving overlap is a single content token (\"governance\") on a short human continuity turn about \"a prior thread\"; engagement with the specific pending F.1 reach vs. coincidental phrasing is text-dependent and not deterministically separable. expected_verdict_class flipped block -> pass, known_false_block.reason records the navigator's exact wording, excluded from the phase's 0-false-block bar per the SPEC R4 amendment; a follow-on phase is opened for text-understanding disambiguation"
  - "All 13 Jev disagreements ruled keep-hand: 8 are the load-bearing ASCII-box/backstop anti-vacuity fixtures (explicitly must-still-fire-today by design, 4 of them RCA-grounded), 5 are the deliberately-authored V3 carve-out and intern-w1 fork cases this phase exists to protect. Jev's fixture-only view has no conversational context, so its pass verdicts on these are expected dissent, not evidence of mislabeling. No fixture other than dogfood.json changed"
  - "Jev token/cost counts are not reportable: neither scripts/label-card-fire-replay.cjs nor scripts/jev-devtime-client.cjs captures or logs usage/cost data; the report and client expose only the thresholded yes/no/uncertain Noul mappings, no raw probabilities"

requirements-completed: [GATE357-09, GATE357-03, GATE357-04]

# Metrics
duration: 9min active (Task 1 ~7min, Task 3 ~8min, separated by the navigator checkpoint wait)
completed: 2026-09-23
---

# Phase 357 Plan 08: Navigator checkpoint (dogfood ratification, R-C ruling, Jev disagreements) Summary

**Ran the dev-time Jev labeler once over sources 238/debug/live (36 rows, 0 dogfood, 13 disagreements), then applied the navigator's checkpoint ruling: all 24 dogfood labels ratified to human, the R-C 09:20 case recorded as known_false_block (excluded from the 0-false-block bar), and all 13 Jev disagreements kept on hand-label.**

## Performance

- **Duration:** ~9 min of active execution (Task 1 labeler run + sheet build, then Task 3 fixture ruling), navigator checkpoint wait excluded
- **PLAN_BASE:** `0ddd4fa75`
- **Tasks:** 3/3 complete (Task 2 was the human checkpoint itself)
- **Files modified:** 3 (`357-JEV-LABEL-REPORT.md` new, `357-DOGFOOD-LABELS.md`, `tests/fixtures/card-fire-replay/dogfood.json`)

## Accomplishments

- `node scripts/label-card-fire-replay.cjs --dry-run`: 36 rows built and guarded, 0 refused, exit 0
- Keyed run (`TYPESAFE_API_KEY` present): `labeled: 36 rows written`, exit 0. Agreement: yes=21, no=13 (disagreements), unlabeled=2 (Jev's own verdict uncertain, not a disagreement). No dogfood row reached the client; report contains `never auto-applied`, no key-pattern leak, no em-dashes
- `357-DOGFOOD-LABELS.md` regenerated with `--with-head-verdicts` (HEAD verdict column added), then extended with a `## Jev disagreements (sources a, b, c)` section (13 rows, all hand=block/Jev=pass) and a `## Replay on HEAD before ruling` section (`false_blocks=0 known_misses=1 parity_mismatches=0`)
- Navigator ruling applied verbatim: 24/24 dogfood rows `label_origin: human`; R-C flipped to `expected_verdict_class: pass` with `known_false_block.reason` naming the text dependence; `meta.ratified_at: 2026-09-23` added; all 13 Jev rulings `keep-hand` (zero fixture bytes changed in `debug-cases.json`/`live-2026-09-23.json`)
- Post-ruling replay: `entries=60 false_blocks=0 missed_forks=0 known_misses=1 known_false_blocks=1 new_misses=0 parity_mismatches=0 errors=0` -- the R-C case now correctly reports as a counted, excluded `known_false_block` rather than an uncounted `block` proposal
- `357-DOGFOOD-LABELS.md` stamped with `## Ratified` carrying the navigator's verbatim reply and the resulting counts

## Task Commits

1. **Task 1: Run the labeler once and refresh the review sheet with post-fix verdicts** - `09c71b2d8` (docs)
2. **Task 2: Navigator review checkpoint** - no commit (human-verify gate, no files edited)
3. **Task 3: Apply the rulings to the fixtures and stamp the sheet** - `716783148` (test)

**Plan metadata:** this commit (docs: complete plan) -- note: per the objective, STATE.md/ROADMAP.md/REQUIREMENTS.md were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-JEV-LABEL-REPORT.md` - new, the Jev label report over sources 238/debug/live (36 rows, 13 disagreements)
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-DOGFOOD-LABELS.md` - HEAD verdict column, Jev disagreements section, HEAD replay section, Ratified section
- `tests/fixtures/card-fire-replay/dogfood.json` - all 24 entries `label_origin: human`, `meta.ratified_at: 2026-09-23`, R-C entry (`dogfood-0f86dd63-092046`) carries `expected_verdict_class: pass` and `known_false_block.reason`

## Decisions Made

See `key-decisions` in the frontmatter for the full navigator ruling and rationale. In addition:

- The navigator's rulings were applied via a short one-shot Node transform script (`/tmp/.../apply-ruling.cjs`, never committed) rather than 24 manual JSON edits, to guarantee every non-R-C row changed only its `label_origin` field and nothing else -- verified programmatically (`d.entries.every(e=>e.label_origin==='human')`) before committing.

## Deviations from Plan

None (Rule 1-4 sense) -- plan executed exactly as written for both Task 1 and Task 3. The navigator's rulings (approved-as-proposed on all dogfood rows, `known_false_block` on R-C, `keep-hand` on all 13 Jev disagreements) were applied literally with no interpretation gaps: the plan's own acceptance criteria state exactly what each ruling shape produces in the fixture, and every produced value matches.

## Issues Encountered

None.

## Stub Tracking

No stubs. Every dogfood entry stays fully populated (envelope, counters, why); the R-C entry's `known_false_block.reason` is a real, non-empty, text-dependence-naming string, not a placeholder.

## Threat Flags

None. This plan's own `<threat_model>` (T-357-01, T-357-07, T-357-21, T-357-22) covers every surface touched; no new surface was introduced. `T-357-21` (auto-applied vendor labels) is directly disproven by this plan's own diff: `git diff $PLAN_BASE -- tests/fixtures/card-fire-replay/debug-cases.json tests/fixtures/card-fire-replay/live-2026-09-23.json` is empty, confirming no Jev label was applied without an explicit navigator `accept-jev` ruling (there were none).

## Verification Results

- `node tests/test-357-corpus-loader.cjs --dogfood-strict` - PASS (14 legs), exit 0
- `node tests/test-357-corpus-loader.cjs` - PASS (12 legs), exit 0
- `node tests/test-357-labeler-refusal.cjs` - PASS=83 FAIL=0, exit 0
- `node scripts/replay-card-fire.cjs --surface both` (post-ruling) - `entries=60 false_blocks=0 missed_forks=0 known_misses=1 known_false_blocks=1 new_misses=0 excluded_partial=0 parity_mismatches=0 errors=0`
- `node -e "...d.entries.every(e=>e.label_origin==='human')&&d.meta.ratified_at?0:1"` - exit 0
- `grep -c "## Ratified" 357-DOGFOOD-LABELS.md` - 1
- `node -e "...r.known_false_block&&/text/i.test(r.known_false_block.reason)?0:1"` - exit 0
- `git diff $PLAN_BASE -- tests/fixtures/card-fire-replay/debug-cases.json tests/fixtures/card-fire-replay/live-2026-09-23.json` - empty (no Jev ruling changed either file)
- `git diff --name-only $PLAN_BASE..HEAD -- lib hooks scripts` - 4 files, all from concurrent peer commits (`3c4922f16`, `f2314ec97`, `8c6771ef5`) landed on the shared main tree between this plan's Task 1 and Task 3 commits, not from any commit this plan made (verified: `git diff --name-only 09c71b2d8..0ddd4fa75` for the plan's own two commits touches only `.planning/` and `tests/fixtures/`)
- Em-dash guard - 0 on `357-JEV-LABEL-REPORT.md`, `357-DOGFOOD-LABELS.md`, `dogfood.json`
- Post-commit deletion check on both commits (`git diff --diff-filter=D --name-only`) - empty both times
- Key-pattern leak check (`grep -ciE "TYPESAFE_API_KEY=|Bearer "` on the report) - 0

## User Setup Required

None -- the TYPESAFE_API_KEY was already present in the environment for this run; no new external service configuration required.

## Next Phase Readiness

- Plan 09 (`baseline.json`, standing-gate wiring, the mutation leg) can write its baseline against a HEAD that now legitimately reports `false_blocks:0` with the R-C case correctly counted as an excluded `known_false_block:1`, not a silent uncounted `block`.
- Plan 10 (Larry prose shrink, manifest regen, D-17 filing, requirement closure) should open the R-C follow-on phase named in this plan's ruling (text-understanding disambiguation for the "genuine engagement vs. coincidental phrasing" question) as part of its own D-17 filing.
- Per the executor's objective, `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` were NOT updated; `requirements-completed: [GATE357-09, GATE357-03, GATE357-04]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 08*
*Completed: 2026-09-23*

## Self-Check: PASSED
