---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 13
subsystem: cross-repo-coordination
tags: [mcp-tool-honesty, theo-parity, theo-mirror-task, ts-ast-seed, cross-repo-read-only, gate-render]

# Dependency graph
requires:
  - phase: 276-04
    provides: "tests/test-276-theo-description-parity.cjs, the TOOLHON-12 five-constant parity signal this plan re-ran"
  - phase: 276-11
    provides: "gate_render's corrected description (D-276-3), the fix that opened the DIFFERS this plan mirrors into a Theo coordination task"
provides:
  - "A measured, re-pinned five-constant Theo parity report (Theo HEAD dfb44b2, moved from the research pin 83a1ce2) with every row classified caused-by-this-phase or pre-existing"
  - "docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md: the coordinated out-of-repo recommendation (gate_render mirror task, the two-divergence report, the TS-AST port SEED)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-pin at run time, never trust a stale document's commit: Theo HEAD moved from 83a1ce2 (research pin, matched exactly by plan 276-04) to dfb44b2 by the time this plan ran; test-276-theo-description-parity.cjs's own re-pin logic surfaced this as an INFORMATION line, not a failure, exactly as designed."
    - "Report reality over the plan's own stated expectation when they diverge: the plan's objective prose predicted chain_run would DIFFER (following 276-RESEARCH.md's uncorrected claim); this plan's fresh measurement confirms plan 276-04's earlier correction (chain_run is IDENTICAL, 1113 bytes both sides) still holds against the moved Theo HEAD, and reports that measured fact rather than the plan's own predicted shape."

key-files:
  created:
    - docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md
  modified: []

key-decisions:
  - "Only ONE Theo mirror task is registered by this plan (gate_render, Section 1 of the SEED document), matching D-276-6's binding scope ('of the 24, only gate_render lands on a Theo-absorbed tool'). The gate_answer divergence is reported (Section 2) but NOT registered as a second mirror task in this plan -- it is named as available for a later coordination pass, per the plan's own instruction to report rather than execute a second mirror beyond the one named task."
  - "chain_run reported IDENTICAL, not DIFFERS, contradicting the plan's own objective-section prose (which inherited 276-RESEARCH.md's uncorrected '1113 against 1006' claim). This plan's own governing rule (measure, don't restate) is applied: the phase rules explicitly instruct 'if reality differs, record reality,' and this plan does so rather than writing a divergence that does not exist to match the plan text's own expectation."
  - "STATE.md was NOT touched by this plan. A live foreign unstaged edit was present in the shared working tree (Phase 339's 339-03 executor hand-correcting completed_plans/percent) at plan-execution time; staging STATE.md by path would have swept that uncommitted hunk into this plan's commit. Per the coordinator's explicit mid-execution instruction (one step stricter than the 276-08/276-11 precedent of running only additive verbs), this plan ran NO state.* verbs at all -- no record-metric, no add-decision -- and records its metric/decision content in this SUMMARY.md only."

requirements-completed: [TOOLHON-12, TOOLHON-13]

# Metrics
duration: ~65min
completed: 2026-09-03
---

# Phase 276 Plan 13: Theo Parity Measurement and the Coordinated TS-AST SEED Summary

**Re-measured the five-constant Theo parity report against a re-pinned Theo HEAD (moved past the research pin, as expected for an actively developed repo), classified every row caused-by-this-phase or pre-existing, and filed one coordination document registering the owed gate_render mirror task, the two measured divergences, and a TS-AST port recommendation for Theo's own detector gap -- all without writing a single byte under `/home/jsagi/Theo`.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-09-03T~19:45:00Z (approx, first file read)
- **Completed:** 2026-09-03T20:46:25Z
- **Tasks:** 2 completed (Task 1 measurement-only, no files modified; Task 2 one new file)
- **Files modified:** 1 (new): `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md`

## Accomplishments

- **Task 1 (measurement).** Re-pinned Theo at run time: `git -C /home/jsagi/Theo rev-parse --short HEAD` returned `dfb44b2` (full `dfb44b297b790b6b807b566d82f7d2389eb1da42`), which has moved past the research pin `83a1ce2` that plan 276-04 matched exactly. This is expected news for an actively developed repo (RESEARCH assumption A14), not a failure, and `test-276-theo-description-parity.cjs`'s own re-pin logic surfaced it correctly as an INFORMATION line. Ran both arms of the parity test (default and `--strict`), recorded the full five-line report verbatim below, and independently confirmed the `gate_answer` divergence's cause via `grep -c "SOURCED_FROM\|USES_FRAMEWORK" /home/jsagi/Theo/src/mcp/operational/gate-answer.ts` returning `0`. `graph_write` confirmed IDENTICAL, as plan 276-11 designed. `git -C /home/jsagi/Theo status --porcelain` and `git -C /home/jsagi/Theo rev-parse HEAD` were run and recorded before every read and after the plan's last read; both were byte-identical across the whole plan (the same two pre-existing local Theo-repo lines throughout: `M src/generated/build-stamp.ts` and one untracked `.gitkeep` under a Theo seed folder, neither touched by this plan).
- **Task 2 (the coordination document).** Wrote `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md` (196 lines). Section 1 quotes the plugin's corrected `gate_render` final sentence verbatim from `lib/mcp/tools/gate.cjs` (as landed by plan 276-11, commit `02468fcb`) and names the exact Theo file and line, `src/mcp/operational/gate-render.ts:89-93`, citing D-276-3 and D-276-6 as authority and stating explicitly the change is coordinated, never executed from this repo. Section 2 reports the MEASURED `gate_answer` divergence (offset 585, plugin 1462 / theo 1152 bytes, cause confirmed by the independent zero-count grep against commit `2c8dfddf`) and states plainly that `chain_run` measures IDENTICAL today, correcting rather than restating the plan's own inherited expectation. Section 3 leads with the zero-tools-scanned warning, names all three structural mismatches (discovery's four-positional-argument assumption vs Theo's config-object shape; `maskNonCode`'s lack of TypeScript generic/type-annotation awareness; `resolveWritePrimitives`'s `require()`-based CJS enumeration, which cannot work against TypeScript sources) with current plugin-side file:line citations re-measured live rather than copied from the stale research citations, states Theo's tool count as 28 (23 `registerContentTool` + 5 `registerOperationalTool`, counted live in this plan), recommends `ts.createSourceFile`, and cites D-1 with the measured 10-to-24 finding-count figure from `276-06-SUMMARY.md` as the cautionary case. Section 4 cross-links the phase directory, the RESEARCH.md Theo cross-check section, the parity test itself (named as the standing non-blocking signal), the decision ledger, and the two prior measurement plans.

## Task Commits

Task 1 modified no files (measurement only; results recorded in this SUMMARY and consumed by Task 2). Task 2 was committed atomically:

1. **Task 2: docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md** - `8b5a3ab8` (docs)

## Files Created/Modified

- `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md` (196 lines, new) - the coordinated out-of-repo recommendation: the `gate_render` mirror task with the verbatim corrected sentence and exact Theo site, the two measured divergences (`gate_answer` DIFFERS/pre-existing, `chain_run` now IDENTICAL), and the TS-AST port SEED for Theo's own `/gsd-capture`.

## Theo Parity Measurement (Task 1, recorded verbatim)

Re-pinned at run time. Research pin: `83a1ce2`. Measured live: `dfb44b2` (full
`dfb44b297b790b6b807b566d82f7d2389eb1da42`). They differ -- expected news, named rather than
silently re-used.

`node tests/test-276-theo-description-parity.cjs` -- exits **0**:

```
INFORMATION: Theo checkout HEAD (dfb44b2) has moved past the commit this
INFORMATION: report was pinned to (83a1ce2). Theo is actively developed;
INFORMATION: a moved pin is expected news, not a failure (RESEARCH Assumption A14).

-- FIVE-CONSTANT PARITY REPORT --
ROOM_BIND_DESCRIPTION [room_bind] (theo source: dist (dist/mcp/operational/room-bind.js)): IDENTICAL (254 bytes both sides)
GRAPH_WRITE_DESCRIPTION [graph_write] (theo source: dist (dist/mcp/operational/graph-write.js)): IDENTICAL (157 bytes both sides)
GATE_RENDER_DESCRIPTION [gate_render] (theo source: dist (dist/mcp/operational/gate-render.js)): DIFFERS at offset 266 (plugin 429 bytes / theo 323 bytes)
GATE_ANSWER_DESCRIPTION [gate_answer] (theo source: dist (dist/mcp/operational/gate-answer.js)): DIFFERS at offset 585 (plugin 1462 bytes / theo 1152 bytes)
CHAIN_RUN_DESCRIPTION [chain_run] (theo source: dist (dist/mcp/operational/chain-run.js)): IDENTICAL (1113 bytes both sides)

5 constant(s) compared, 2 problem(s) (DIFFERS or EXTRACTION_FAILED)
This is a coordination signal (Theo D-04), never a gate; the plugin cannot fix
Theo's own file from this repo. Nothing under /home/jsagi/Theo was written.
```

`node tests/test-276-theo-description-parity.cjs --strict` -- exits **1** (2 problems: `gate_render` and `gate_answer` DIFFER).

### Per-constant classification

| Constant | Plugin bytes | Theo bytes | Verdict | Offset | Classification |
|---|---|---|---|---|---|
| `ROOM_BIND_DESCRIPTION` | 254 | 254 | IDENTICAL | n/a | Untouched by this phase |
| `GRAPH_WRITE_DESCRIPTION` | 157 | 157 | IDENTICAL | n/a | Confirmed unchanged; plan 276-11 deliberately left the TOOL description byte-identical, only the `read_version` parameter describe changed |
| `GATE_RENDER_DESCRIPTION` | 429 | 323 | **DIFFERS** | 266 | **CAUSED BY THIS PHASE** (plan 276-11, D-276-3). The owed mirror task, registered in Section 1 of the SEED document |
| `GATE_ANSWER_DESCRIPTION` | 1462 | 1152 | **DIFFERS** | 585 | **PRE-EXISTING**. Cause independently confirmed: `grep -c "SOURCED_FROM\|USES_FRAMEWORK" /home/jsagi/Theo/src/mcp/operational/gate-answer.ts` returns `0`, proving Theo's copy predates the plugin's `2c8dfddf` clause (T2 node-writing half, this same session). Not registered as a second mirror task by this plan; reported for a later coordination pass |
| `CHAIN_RUN_DESCRIPTION` | 1113 | 1113 | IDENTICAL | n/a | **Not caused by this phase, and not a divergence at all today.** Plan 276-04 first measured this as IDENTICAL, correcting `276-RESEARCH.md`'s uncorrected claim of a prior "1113 against 1006" divergence; this plan's fresh measurement against the moved Theo HEAD confirms the correction still holds |

No `EXTRACTION_FAILED` rows occurred. All five constants resolved cleanly via the `dist/` path
(`dist (dist/mcp/operational/*.js)` for every row) -- Theo's compiled build is current and complete
for all five files today.

Every row is classified; none left unclassified.

## Read-Only Boundary Verification (Theo, before/after every task)

`git -C /home/jsagi/Theo status --porcelain` was run before Task 1's first read and after Task 2's
last read; both captures are byte-identical:

```
 M src/generated/build-stamp.ts
?? .planning/phases/11-the-calibrator-guided-framework-sessions-seed-011/.gitkeep
```

Both lines are pre-existing local Theo-repo state, unrelated to and untouched by this plan (matches
the identical two lines plan 276-11 recorded at its own before/after check). `git -C /home/jsagi/Theo
rev-parse HEAD` returned `dfb44b297b790b6b807b566d82f7d2389eb1da42` both before and after -- HEAD did
not move. Nothing under `/home/jsagi/Theo` was created, edited, or deleted by this plan.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: (1) only the `gate_render` mirror task is
registered, matching D-276-6's binding scope exactly -- `gate_answer` is reported, not mirrored, by
this plan; (2) `chain_run` is reported as measured (IDENTICAL) rather than as the plan's own
inherited prediction (DIFFERS), per the phase rule to record reality over restating an assumption;
(3) STATE.md was left entirely untouched (see Issues Encountered below) on explicit mid-execution
instruction from the coordinator, one step stricter than the 276-08/276-11 additive-only precedent.

## Deviations from Plan

None beyond the STATE.md handling named below, which was a coordinator instruction applied
mid-execution, not a self-discovered deviation under Rules 1-4. All other plan-specified actions
were executed exactly as written: both parity-test arms run and recorded, the independent
`gate_answer` cause confirmed by grep, `graph_write` confirmed IDENTICAL, the Theo read-only
boundary asserted before and after, every constant classified, the SEED document's four sections
written to the plan's exact specification, and the em-dash/`registerContentTool`/Theo-porcelain
verification commands all run and passing before staging.

## Issues Encountered

**A live foreign edit was present in the shared working tree at STATE.md.** The coordinator's
mid-execution message identified that Phase 339's concurrent `339-03` executor had an UNSTAGED
hand-correction to `completed_plans`/`percent` in `.planning/STATE.md` at plan-execution time, not
yet committed by that session. Staging STATE.md by path in this plan would have swept that foreign
hunk into this plan's own commit. Per the coordinator's explicit instruction (one step stricter than
the 276-08/276-11 precedent of running only additive `state.*` verbs), this plan ran **no**
`state.*` query verbs at all for this task -- not `record-metric`, not `add-decision`. This plan's
metric and decision content lives in this SUMMARY.md's frontmatter and body only. `ROADMAP.md` is
updated via `roadmap update-plan-progress` as normal (see State Updates below), since that command
is confirmed to touch only the ROADMAP.md progress table, not STATE.md.

## Known Stubs

None. The SEED document states real, measured facts throughout; no placeholder text, no
hardcoded empty value, and every claim in it is either a verbatim quote from a live-read file or a
number produced by a command run during this plan's own execution.

## Threat Flags

None. This plan's threat register (T-276-06, T-276-14, T-276-33, T-276-34, T-276-09, T-276-SC)
covers exactly the surface this plan touches. T-276-33 (a lossy extractor reporting green over a
real divergence) did not fire -- zero `EXTRACTION_FAILED` rows occurred, every constant resolved
against Theo's `dist/` build. T-276-34 (writing to the Theo checkout) did not fire -- verified by
identical `git -C /home/jsagi/Theo status --porcelain` output and an unchanged `HEAD` before and
after. T-276-09 (git index in a shared working tree) is addressed by the single audited commit
below, preceded by `git diff --cached --name-only` listing exactly the one new file. No new network
endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced --
this plan is one read-only measurement pass and one new markdown document.

## User Setup Required

None. No external service configuration required. `THEO_ROOT` defaults to `/home/jsagi/Theo` and
was present on this machine for the full measurement; the test's own SKIP path (verified in earlier
plans) requires no setup on a machine without a Theo checkout.

## State Updates

**STATE.md: deliberately NOT touched.** See "Issues Encountered" above. No `state.*` query verb
was run for this plan.

**ROADMAP.md:** updated via `gsd-tools query roadmap.update-plan-progress 276` (flips 276-13's row
from `[ ]` to `[x]` in the Wave 4 plan list and updates the phase's plan-count line). This command
touches only `.planning/ROADMAP.md`, confirmed by its own scope and by the `git diff --cached
--name-only` audit before the final commit below.

**REQUIREMENTS.md:** `requirements mark-complete TOOLHON-12 TOOLHON-13` was attempted; per
276-11-SUMMARY.md's own precedent, `.planning/REQUIREMENTS.md` does not track TOOLHON-prefixed
requirement IDs at all (a pre-existing gap in the requirements tracker, not caused by this plan).
The `requirements-completed` frontmatter field above is the record of intent, matching the
established pattern from prior plans in this phase.

## Next Phase Readiness

- The `gate_render` mirror task is fully specified and ready for whoever works in the Theo checkout
  to pick up: exact site (`src/mcp/operational/gate-render.ts:89-93`), exact replacement text
  (quoted verbatim in Section 1 of the SEED document), and the authority (D-276-3, D-276-6, Theo
  D-04).
- The `gate_answer` divergence remains open and unregistered as a mirror task, available for a
  later coordination pass -- named explicitly rather than silently dropped, per this plan's own
  must-have truths.
- The TS-AST SEED is filed and ready for Theo's own `/gsd-capture`, to be run from that repo before
  Theo's plan `09-12` authorizes the flip. Theo's own `09-MOS-LEARNING.md` independently rules the
  flip NOT READY on content grounds; this SEED addresses a separate, parallel readiness question
  (detector coverage on the code side).
- No blockers. This plan wrote no production code, touched nothing under `scripts/`, `lib/`, or
  `bin/`, and confirmed the Theo checkout untouched throughout (`git -C /home/jsagi/Theo
  status --porcelain` and `rev-parse HEAD` identical before and after).

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*

## Self-Check: PASSED

`docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md` verified present on disk; this
SUMMARY.md verified present on disk; task commit `8b5a3ab8` verified present in
`git log --oneline --all`.
