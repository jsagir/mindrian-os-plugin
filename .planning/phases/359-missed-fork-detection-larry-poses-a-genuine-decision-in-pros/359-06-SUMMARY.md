---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 06
subsystem: testing
tags: [jev, dev-time, labeling, navigator-checkpoint, fork-declaration, card-fire-replay]

# Dependency graph
requires:
  - phase: 359-02
    provides: synthetic-359 opt-in corpus, dogfood overlay, prose-forks-359.json, dogfood-fork-labels-359.json
  - phase: 359-03
    provides: declared arm interpretation questions (I-1, I-2 origin)
  - phase: 359-04
    provides: fork359_moonshot Jev policy, scripts/score-moonshots-359.cjs
provides:
  - "359-JEV-LABEL-REPORT.md: dev-time is_fork readings for all 36 synthetic-359 entries vs hand prose_fork labels"
  - "359-MOONSHOT-SCORES.md: relevance/radicalness distribution for the 17 fixture moonshots"
  - "Navigator-ratified dogfood-fork-labels-359.json (fork_label_origin: human, meta.ratified: true) for all 24 dogfood ids"
  - "Two moonshot rewrites (syn359-fork-08, syn359-fork-10) pushed harder per N-8"
  - "I-1 and I-2 interpretations confirmed for plans 07/08 to rely on"
affects: [359-07, 359-08, 359-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Navigator ratification flips fork_label_origin local -> human and sets meta.ratified/ratified_at; never auto-applied without the checkpoint (D-20, D-21)"
    - "Moonshot rewrites are validated in-band with parseForkDeclaration(formatDeclaration(labels)).declared before landing in the fixture, not just eyeballed against the grammar prose"

key-files:
  created: []
  modified:
    - .planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-JEV-LABEL-REPORT.md
    - .planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-MOONSHOT-SCORES.md
    - .planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-DOGFOOD-FORK-LABELS.md
    - tests/fixtures/card-fire-replay/dogfood-fork-labels-359.json
    - tests/fixtures/card-fire-replay/prose-forks-359.json

key-decisions:
  - "Navigator ruling: approve-all. All 13 hand labels kept unchanged (6 Jev disagreements on syn359-ctrl-14..19, 7 uncertain ids); all 24 dogfood fork proposals ratified prose_fork:false; I-1 and I-2 confirmed as written."
  - "N-8 push-harder: syn359-fork-08 and syn359-fork-10 moonshots rewritten to break an assumption the practical options share (who controls the announcement / the communication channel), rather than a blended hedge of the practical options."
  - "N-7 (tolerate cosmetic declaration slips) explicitly NOT implemented in this plan; routed as a follow-up to a new plan per navigator instruction."

patterns-established:
  - "Every navigator-ratified label carries fork_label_origin: human and a meta.ratified_at date; plan 07's replay metrics can trust these without re-checking provenance."

requirements-completed: [FORK359-01, FORK359-09]

duration: 25min
completed: 2026-09-24
---

# Phase 359 Plan 06: Dev-Time Jev Labels, Moonshot Scores, Navigator Ratification Summary

**Ran the 357 labeler and moonshot scorer on synthetic-359 only, packaged every open label/interpretation question into one navigator checkpoint, then applied approve-all: dogfood overlay flipped to human-ratified, two moonshots pushed harder per N-8, I-1/I-2 confirmed.**

## Performance

- **Duration:** 25 min (Task 3 onward; Task 1 and Task 2 ran in prior sessions)
- **Tasks:** 3 (Task 1 pre-committed at 290f2b50a; Task 2 checkpoint answered by navigator; Task 3 this session)
- **Files modified:** 3 (plus the two report files already committed in Task 1)

## PLAN_BASE

`332076ccd91d4820f92063e12f02c5a359138f7d` (parent of the Task 1 commit `290f2b50a`).

## Labeler status counts (Task 1, synthetic-359 only)

- Run timestamp: 2026-09-24T13:37:43.575Z, model jev-latest, keyed (not keyless).
- Counts by agreement: agree=23, disagreement=6, uncertain=7 (sums to 36 of 36 synthetic-359 entries).
- Disagreement ids (all controls, hand=false/pass but is_fork=yes): syn359-ctrl-14, syn359-ctrl-15, syn359-ctrl-16, syn359-ctrl-17, syn359-ctrl-18, syn359-ctrl-19.
- Uncertain ids: syn359-fork-09, syn359-fork-10, syn359-fork-13, syn359-fork-14, syn359-fork-15, syn359-ctrl-08, syn359-ctrl-13.
- No dogfood entry appears in the report (grep -c "dogfood-" is 0); test-357-labeler-refusal stayed green throughout (D-21, T-359-27).

## Moonshot distribution (Task 1, fixture moonshots, 17 labeled)

- relevant_to_context: mean=3.52, histogram(0-4)=0,0,0,8,9
- radical_departure: mean=2.50, histogram(0-4)=0,0,9,8,0
- 3 lowest-scoring ids (by radical_departure, before the N-8 rewrite): syn359-fork-10 (1.58), syn359-fork-06 (1.78), syn359-fork-08 (2.00). Both syn359-fork-08 and syn359-fork-10 were the navigator's push-harder targets for exactly this reason.

## Navigator ruling (verbatim intent, relayed via AskUserQuestion)

- **approve-all**: keep ALL 13 hand labels (6 Jev disagreements syn359-ctrl-14..19, 7 uncertain) unchanged; ratify all 24 dogfood fork overlay entries as prose_fork:false (set ratified true / fork_label_origin human per plan); confirm I-1 (yes/no exemption on practical labels only) and I-2 (vacuity floor in probe and text mode).
- **MOONSHOT "push harder" (N-8)**: rewrite the moonshot label of syn359-fork-10 and syn359-fork-08 in `tests/fixtures/card-fire-replay/prose-forks-359.json` to be genuinely radical yet context-relevant (break an assumption the practical options share; trending-to-absurd allowed), within the grammar (starts with `What if`, <=80 chars, no brackets). Ids and prose_fork labels kept.
- **GRAMMAR "tolerate cosmetic slips" (N-7)**: NOT implemented in this plan. The orchestrator is routing this as a follow-up to a new plan (parser accepts lowercase `what if`, surrounding markdown bold on the prefix, and one trailing blank/sign-off line; structural errors stay rejected). syn359-ctrl-16/17/18 will change role once that parser change lands, since their current disagreement (is_fork:yes on a pass control) depends on the exact declaration text these entries carry.

## Ids flipped

**Hand labels: none flipped.** All 13 disagreement/uncertain ids kept their existing hand prose_fork value, per approve-all.

**Dogfood overlay: all 24 ids flipped provenance, zero ids flipped value.** Every id in `tests/fixtures/card-fire-replay/dogfood-fork-labels-359.json` moved `fork_label_origin` from `local` to `human`; `meta.ratified` moved `false` -> `true`; `meta.ratified_at` set to `2026-09-24`. No `prose_fork` value changed (all 24 stay `false`, matching the proposal table in `359-DOGFOOD-FORK-LABELS.md`).

**Moonshot rewrites (2 ids, N-8):**
| id | before | after |
|----|--------|-------|
| syn359-fork-08 | "What if we tease the flagship deal while the waitlist fills quietly" | "What if we let the first customer announce it for us" |
| syn359-fork-10 | "What if we publish a one-line acknowledgment and promise more soon" | "What if we open the fix verification to customers live" |

Both rewrites break the assumption shared by their practical options (that the company alone controls the timing/channel of the announcement or the postmortem communication) rather than hedging between the practical options. Both verified via `parseForkDeclaration(formatDeclaration(labels)).declared === true` before landing (52 and 54 code points respectively, well under the 80-char cap; no brackets, no pipe character).

**Plan 09 note (recorded per navigator instruction):** the prose rule for plan 09 must state that the What-if moonshot should break an assumption the practical options share, pushed toward the absurd when useful (N-8); R9 rescoring in plan 11 will measure it against this bar.

## I-1 / I-2

- **I-1: confirmed.** The declared arm's yes/no exemption applies `isYesNoShapedGate` to the practical labels only, excluding the final What-if moonshot.
- **I-2: confirmed.** The R9 vacuity floor (at least 6 pre-arm misses, or 20% of pre fork runs) applies in both probe mode and the N-4 text fallback; below it the result is INCONCLUSIVE.

No `## Gap` section is needed; neither interpretation was overruled.

## Task Commits

1. **Task 1: Dev-time label run, moonshot scoring, checkpoint packet** - `290f2b50a` (docs), completed in a prior session, per the objective.
2. **Task 2: Navigator ruling checkpoint** - no code commit (decision-only task); ruling captured above and applied in Task 3.
3. **Task 3: Apply the rulings** - `227892e05` (test), ratified dogfood overlay, moonshot rewrites, review-sheet ruling section.

## Files Created/Modified

- `tests/fixtures/card-fire-replay/dogfood-fork-labels-359.json` - all 24 labels flipped to `fork_label_origin: human`; `meta.ratified: true`, `meta.ratified_at: 2026-09-24`.
- `tests/fixtures/card-fire-replay/prose-forks-359.json` - syn359-fork-08 and syn359-fork-10 moonshot labels rewritten (N-8); their `why` fields carry `(ruled 2026-09-24)`.
- `.planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-DOGFOOD-FORK-LABELS.md` - `## Ruling (2026-09-24)` section appended, no id flipped.

## Decisions Made

- Kept every hand prose_fork label as-is (approve-all); the 6 control disagreements and 7 uncertain ids are Jev-side signal only, never ground truth, per D-20.
- Ratified the dogfood overlay in place rather than re-authoring proposals, since the navigator found no id to flip.
- Pushed the two lowest-radicalness moonshots harder rather than rewriting all 17, matching the navigator's scoped instruction.
- Deferred the N-7 cosmetic-tolerance parser change entirely out of this plan; recorded it as a routed follow-up rather than improvising a code change under an execute-only, no-lib/hooks/scripts plan.

## Deviations from Plan

None - plan executed exactly as written and as ruled by the navigator. No Rule 1/2/3 auto-fixes were needed; Task 3's action items (overlay ratification, ruled fixture edits, I-1/I-2 recording) matched the plan's action list exactly.

## Issues Encountered

None. All four required test files (`tests/test-359-corpus.cjs`, `tests/test-357-corpus-loader.cjs`, `tests/test-357-labeler-refusal.cjs`, `tests/test-359-inertness.cjs`) and `bash tests/run-all-357.sh` passed on the first run after the edits.

## User Setup Required

None - no external service configuration required.

## Follow-up routed (not part of this plan)

**N-7 "tolerate cosmetic declaration slips"** is not implemented here. The orchestrator is routing a new plan to change `lib/core/fork-declaration.cjs`'s parser so it accepts lowercase `what if`, surrounding markdown bold on the `What if` prefix, and one trailing blank/sign-off line, while structural errors (missing prefix entirely, wrong label count, bracket/pipe violations) stay rejected. Once that lands, `syn359-ctrl-16`, `syn359-ctrl-17` and `syn359-ctrl-18` change role: their current Jev disagreement (is_fork:yes on a hand-labeled pass control) traces to declaration-adjacent text these controls carry, and the cosmetic-tolerance change is expected to resolve or reclassify that disagreement rather than leave it standing.

## Next Phase Readiness

- Plan 07 (replay metrics, `--fork359`, `--baseline write-359`) can now trust the dogfood overlay as human-ratified ground truth and can rely on I-1/I-2 as confirmed interpretations without re-litigating them.
- Plan 09 (prose rule authoring) has the N-8 push-harder guidance to encode directly: the What-if should break a shared assumption, trending absurd when useful.
- No blockers. The N-7 follow-up is tracked above and does not block 07/08; it targets a later plan that touches `lib/core/fork-declaration.cjs`, outside this plan's execute-only scope.

---
*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Completed: 2026-09-24*
