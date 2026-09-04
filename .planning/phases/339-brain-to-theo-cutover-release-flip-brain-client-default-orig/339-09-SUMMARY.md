---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 09
subsystem: docs
tags: [theo, brain-cutover, connector-key, egress-guard, entitlement-gate, cross-repo]

requires:
  - phase: 339-01
    provides: the flip's core URL-default change and its reciprocal-record obligations
  - phase: 339-02
    provides: the D-06 coverage-ruling heading contract this note quotes verbatim
  - phase: 339-03
    provides: tests/test-339-cross-repo-note.sh and tests/test-339-269-05-checklist.sh, both RED at end of wave 1
provides:
  - "docs/339-NOTE-theo-desktop-connector-key.md: the reciprocal record Theo's shipped README already cites by path"
  - "269-05-PLAN.md Task 1 rewritten to three real Theo-readiness legs, replacing a checklist that read PASS on facts never in question"
affects: [269-05, theo-cutover-release, entitlement-gate]

tech-stack:
  added: []
  patterns:
    - "Reciprocal cross-repo record: a doc this repo owns, cited by path from a doc the sibling repo already shipped"
    - "Heading-scoped awk extraction + grep -F for cross-repo gate checks, never line-number scoped"
    - "Retire-in-place: superseded checklist items keep their old text plus a dated reason on the same line, never deleted"

key-files:
  created:
    - docs/339-NOTE-theo-desktop-connector-key.md
  modified:
    - .planning/phases/269-moat-shift-install-update-entitlement-gate-replaces-per-quer/269-05-PLAN.md

key-decisions:
  - "Kept mindrian-brain as the sole prescribed Desktop/Cowork connector key; did not add theo as a third BRAIN_TOOL_MATCHER alternation token (D-10 as corrected)"
  - "Leg (a) sources coverage from 09-FLIP-RECORD.md's dated ruling subsection, explicitly not SEED-004, whose latest dated UPDATE predates and is superseded by that ruling"
  - "Leg (c)'s /register sub-check reads the record in 08.4-MOS-LEARNING.md rather than probing the live route, preserving the gate's zero-write contract"

requirements-completed: [FLIP-07, FLIP-08]

duration: 20min
completed: 2026-09-04
---

# Phase 339 Plan 09: Theo Connector Reciprocal Record + 269-05 Gate Rewrite Summary

**Wrote the plugin-side connector-key note Theo's shipped README already links to, and replaced 269-05's false-green six-item Theo-readiness checklist with three legs each sourced from a live, dated Theo record.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-04T05:31:21Z
- **Completed:** 2026-09-04T05:46:21Z
- **Tasks:** 2
- **Files modified:** 2 (1 new, 1 rewritten)

## Accomplishments

- `docs/339-NOTE-theo-desktop-connector-key.md` now exists at the exact path Theo's README
  (commit `11d6f82`) already cites, so that cross-repo link resolves instead of 404ing.
- The note states the mechanism, not just the instruction: `BRAIN_TOOL_MATCHER`'s exact value,
  its two `hooks/hooks.json` mirrors, the unconditional allow at
  `scripts/part8-egress-guard-hook.cjs:152` when a connector key doesn't match, and the named
  residual risk (no test can see a hand-registered connector).
- Phase 269-05's Task 1 checklist can no longer read PASS from a fact that was never in
  question. It now tests three real legs against live Theo sources, with the three retired
  items kept in place with a dated reason rather than deleted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write docs/339-NOTE-theo-desktop-connector-key.md (FLIP-07, D-10 as corrected)** - `24c867e9` (docs)
2. **Task 2: Rewrite Phase 269-05 Task 1's checklist to the three real legs (FLIP-08, D-14 as corrected)** - `6ad8ae3f` (fix)

_No TDD RED/GREEN split: both tasks' `tdd="true"` behavior was verified against the
pre-existing wave-1 test scripts (`tests/test-339-cross-repo-note.sh`,
`tests/test-339-269-05-checklist.sh`), which were already RED before this plan ran and turned
GREEN as each task's single commit landed._

## Files Created/Modified

- `docs/339-NOTE-theo-desktop-connector-key.md` - New. Five-section reciprocal record: the
  connector-key/URL/header record, the mechanism (matcher + guard + residual risk), the two
  recognized keys vs. the one that isn't, why the matcher isn't widened, and the D-06
  coverage-ruling heading contract quoted verbatim. Plus a closing section naming the two
  deferred dispositions (census left describing the incumbent; `brain_write`/
  `ingest_framework` meeting `WRITE_PATH_DISABLED`) and the three Theo hashes on the seam.
- `.planning/phases/269-moat-shift-install-update-entitlement-gate-replaces-per-quer/269-05-PLAN.md` -
  Task 1's six items rewritten to Leg (a)/(b)/(c) plus a dated retirement note for the old
  items 1-3, item 4's incumbent-host `/register` clause superseded by leg (c)'s record-based
  check, item 5 unchanged, item 6 repointed at `339-RESEARCH.md`. Task's `<verify>` block
  updated to the new heading-scoped `awk`/`grep -F` checks. Tasks 2 and 3 and the
  `checkpoint:human-action gate="blocking"` skeleton are byte-identical (confirmed via
  `git diff`: single hunk, ends at Task 1's closing tag).

## Decisions Made

- Kept `mindrian-brain` as the one prescribed connector key rather than adding `theo` to
  `BRAIN_TOOL_MATCHER`. Rationale (Section 4 of the note): a third alternation token would
  legitimize a key whose only purpose is standalone Theo use, and would turn the guard's own
  vocabulary into a moving target every future backend adds to. The fix belongs in Theo's own
  README, and Theo already made it at `11d6f82`.
- Leg (a) of the 269-05 rewrite sources from `09-FLIP-RECORD.md`'s
  `### Coverage re-measurement, 2026-09-03, and the ruling on it` subsection, not SEED-004.
  SEED-004's latest dated `## UPDATE` (2026-09-02) reads "not yet" and is explicitly
  superseded by that subsection's ruling clause 1 (DRIFT-3, `339-RESEARCH.md`).
- Leg (c)'s third sub-check (`/register` compat route) reads the RECORD in
  `08.4-MOS-LEARNING.md` against `theo-mcp.onrender.com`, never a live probe, preserving the
  gate's zero-write contract that item 4's original text would have violated after a naive
  host swap.

## Deviations from Plan

None - plan executed exactly as written. Both artifacts, all required literals, and all
acceptance criteria matched the plan's `<action>` blocks without needing a Rule 1-4 deviation.

## Issues Encountered

**Two iterations to satisfy the test script's same-line "Retired" requirement.** The plan's
own test (`tests/test-339-269-05-checklist.sh`) requires that any line naming the retired
`pws-brain-mcp.onrender.com` host, or any surviving `Plans: TBD` line, ALSO carry the literal
word `Retired` on that SAME line (not merely nearby). The first draft named the incumbent host
and `Plans: TBD` across a line-wrap boundary from the word "Retired"; two small in-place edits
(no content change, only word placement) fixed this. Verified: `bash
tests/test-339-269-05-checklist.sh` passes, and `bash tests/run-all-339.sh` shows all 12 arms
green.

## User Setup Required

None - no external service configuration required.

## Verification Record

- `bash tests/test-339-cross-repo-note.sh` - PASS (100 lines, all five required literals, zero
  em-dashes).
- `bash tests/test-339-269-05-checklist.sh` - PASS (all three legs, `09-FLIP-RECORD.md` named,
  `theo-mcp.onrender.com` named, every retired-host/retired-TBD line marked `Retired`).
- `bash tests/run-all-339.sh` - `Phase 339: PASS=12 FAIL=0 SKIP=0`.
- `/home/jsagi/Theo` `git status --porcelain` recorded byte-identical before and after this
  plan:
  - **Before:** ` M src/generated/build-stamp.ts` / `?? .planning/phases/11-the-calibrator-guided-framework-sessions-seed-011/.gitkeep`
  - **After:** identical, confirmed via `diff` against the saved before-snapshot, twice (once
    after each task).
- Retirement line, quoted verbatim from `269-05-PLAN.md` as landed: "Retired 2026-09-03
  (Phase 339, D-14). Items 1, 2 and 3 as originally written (Theo Phase 9 Retired `Plans: TBD`
  line, Theo Phase 8 Retired `Plans: TBD` line, Theo Phase 7 completion) read PASS from
  2026-08-27 onward while the real content and infrastructure legs went unchecked. Superseded
  by legs (a), (b) and (c) above."
- `grep -c` for the em-dash character on both changed files: 0.

## Next Phase Readiness

- The cross-reference Theo shipped at `11d6f82` now resolves in both directions: readers of
  Theo's README land on a real document, and this repo's guard mechanism is written down where
  the guard itself lives.
- Phase 269-05's Task 1 gate, when it next runs, tests Theo's actual readiness (coverage,
  Phase 06.2 summaries + the 06.3 drift gap, and the three 09-12 infrastructure legs) rather
  than a fact that was already true on 2026-08-27.
- No blockers for the remaining plans in Phase 339.

---
*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: `docs/339-NOTE-theo-desktop-connector-key.md`
- FOUND: `.planning/phases/269-moat-shift-install-update-entitlement-gate-replaces-per-quer/269-05-PLAN.md` (modified)
- FOUND commit `24c867e9` (`git log --oneline --all | grep 24c867e9`)
- FOUND commit `6ad8ae3f` (`git log --oneline --all | grep 6ad8ae3f`)
- FOUND: `bash tests/test-339-cross-repo-note.sh` exits 0
- FOUND: `bash tests/test-339-269-05-checklist.sh` exits 0
- FOUND: `bash tests/run-all-339.sh` reports `PASS=12 FAIL=0 SKIP=0`
