---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 05
subsystem: research-planner
tags: [engine-door, stage-machine, systems-pass, stage-b, hdps, ratchet, rubric, tdd]
requires:
  - phase: 364-03
    provides: sr-steps.cjs (REFUSAL_TEXT, readSrSteps result shape)
  - phase: 364-04
    provides: sr-entry.cjs (resolveEntry result shape, not_run stand-ins, bound inputs)
provides:
  - "lib/core/research-planner/sr-door.cjs: STAGES, STAGE_GATES, STAGE_FIELD, RUBRIC, rubricLines, describeDoor, mapSteps, createRun, nextStage, recordStage, boundForStage, buildQuestionSet, stageB"
  - "SCIENTIFIC_ROADMAPPING.doors in question-templates.cjs now ['/mos:research', '/mos:scientific-roadmap'], explicit_only kept"
  - "tests/helpers/fixture-door-364.cjs: stageOutputsFrom363, syntheticEntry, theoAuthored, runnableRows, walkedState"
  - "tests/test-364-sr-door.cjs: D1-D17 (70 checks)"
affects: [364-06, 364-08, 364-09]
key-files:
  created:
    - lib/core/research-planner/sr-door.cjs
    - tests/helpers/fixture-door-364.cjs
    - tests/test-364-sr-door.cjs
  modified:
    - lib/core/research-planner/question-templates.cjs
key-decisions:
  - "The systems pass has three recorded outcomes: done (it was run), not_run with a stand_in id from entry.bound.systems, or not_run declined with a reason (outcome status 'declined'); all three satisfy it, and sr:5 / sr:6 refuse systems_pass_required before the order check, so a mid-journey entry cannot skip it."
  - "Hypothesis metadata (claim, why_unlocks, slots.limiter_id / unlock_length / evidence_tier_needed) rides in the stageB return, joined to the plan leaf by limiter_id; the plan leaf itself carries only the slot the composer accepts."
  - "A not-ready plan still returns ok:true from stageB with plan_status and next, because a 'not ready' F.6 card is a legitimate review object; only a buildPlan failure is plan_failed."
  - "Door state keeps only stepId, label and stepKind of Theo's rows, never runIt text, so no Theo step content is cached in the run state."
metrics:
  tasks: 3
  files: 4
  completed: 2026-10-03
---

# Phase 364 Plan 05: The door (stage machine, question set, Stage B) Summary

One module walks Theo's seven authored steps in a fixed order with the systems pass in front of paths and limiters, turns the finished walk into a valid question set on the 363 `scientific-roadmapping` template, and hands it to the one planner so each ranked assumed limiter becomes a falsifiable hypothesis on an F.6-ready plan, with no second engine.

PLAN_BASE: `cf29e1819097fd9ba534195793cee93f009349da`

## Commits

| Task | Phase | Commit | Files |
|------|-------|--------|-------|
| 1 | RED | 4d17523bf | tests/helpers/fixture-door-364.cjs, tests/test-364-sr-door.cjs |
| 2 | GREEN (machine) | b0b5f9d89 | lib/core/research-planner/sr-door.cjs |
| 3 | GREEN (question set, Stage B, door) | 61e51e95b | lib/core/research-planner/sr-door.cjs, lib/core/research-planner/question-templates.cjs |

All made with `git commit --only <paths>`; each sha verified as an ancestor of HEAD; no file deletions. TDD order holds (test commit precedes both feat commits).

## What was built

- Stage machine (Task 2): `createRun` refuses `what_missing`, `theo_refused` (exact text "Theo has not authored this step yet" plus the `/mos:research` offer) and `step_map_unresolved`, maps Theo's rows by label then by position, and marks steps below the chosen entry step `not_run` with the entry's stand-ins (override toward step 1 allowed, above the proposed step refused). `recordStage` is pure and enforces fixed order, the systems pass, reason-required rejects, 20000-character output cap, unknown stand-ins and the NR-1 bound reverse-salient rule (a limiter row carrying `source_node_id` or a dismissal with a reason). Reject keeps the stage open and logs named routes into `discarded`; defer pauses.
- Question set (Task 3): `buildQuestionSet` assembles a `mos.research-question-set/1` document for template `scientific-roadmapping`, command `/mos:scientific-roadmap`, covers every researchable template dimension, reads a filed plan's perspective field read-only when a `sr_plan` / `quantified_plan` stand-in names it (run name must be a plain folder name), and drops limiters an earlier filed run settled unless they carry new evidence.
- Stage B: `stageB` binds `describeEngine().api_version === '1'` before any write, requires sr:7 done, ranks with `rankByUnlock`, builds one hypothesis leaf per ranked assumed unresolved limiter, plans through `planner.buildPlan(roomDir, qs, {mode:'deep'})`, returns the F.6 card body, the settled-excluded list, engine warnings and the rubric labelled "plugin-side rubric, not Theo content".
- Template door: only the `doors` line and its comment changed in question-templates.cjs (8 changed lines); `templateForCommand('/mos:scientific-roadmap')` stays null.

## Verification (measured)

- `node tests/test-364-sr-door.cjs`: PASS 70 FAIL 0 (D1-D17).
- `tests/test-363-pyramid.cjs` (21), `test-363-perspective.cjs` (17 legs), `test-366-templates.cjs` (6) green. Also green: test-363-mcp-tool, part8-sweep, cli, plan-schema, structure, acceptance-diffusion, acceptance-whitespace, test-seed103-eureka-perspective.
- RED run before sr-door.cjs existed exited non-zero. Acceptance greps: 17 unique leg ids, dash-byte count 0 in all four files, forbidden-token scan (D15) clean.
- Observed end to end on a temp room: plan status `ready`, card next `review`, three hypothesis leaves (LM2, LM3, LM4, ranked by unlock length), diffusion leaves added because the fixture chain has an adoption step, nothing created under `research/` or `research-plan/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan contract] Hypothesis leaf slots cannot be the plan's slot set**
- **Found during:** Task 3 (reading families.cjs and pyramid.cjs normalizeLeaf).
- **Issue:** The plan's leaf shape has `slots:{limiter_id, unlock_length, evidence_tier_needed}`, but the constraint-interrogation family accepts exactly one slot key, `limiter`; any other key makes `composeForLeaf` return `bad_slot` and the planner marks the leaf local-only (not researchable). `normalizeLeaf` also drops `claim` and `why_unlocks`.
- **Fix:** The leaf handed to the planner carries `slots:{limiter:<short term>}`, `limiter_id` and the falsifier. The door-level hypothesis record returned by `stageB` carries `claim`, `why_unlocks` and `slots.limiter_id / unlock_length / evidence_tier_needed` (plus `limiter`), joined to the plan leaf by `limiter_id`. A short search term is derived from the limiter statement (no operators, quotes, brackets or sentence breaks, at most 80 characters); a limiter that reduces to no term gets no slot and stays unsearched.
- **Files modified:** lib/core/research-planner/sr-door.cjs
- **Commit:** 61e51e95b

**2. [Rule 2 - Missing functionality] Diffusion lens leaves**
- **Found during:** Task 3.
- **Issue:** The 363 fixture's unlock chain has an adoption step, which makes the planner select the diffusion lens and return `needs_lens_leaves` unless diffusion leaves exist.
- **Fix:** `stageB` mirrors the planner's own `structure.lensSelection` decision (not `structureFor`) and, when diffusion fires, rebuilds the question set with the diffusion template's researchable dimensions and a `lens_selection` entry carrying the engine's reason.
- **Commit:** 61e51e95b

### Judgment calls inside the contract

- Outcome vocabulary for the systems pass (`status:'declined'` plus reason, or `stand_in` id) was not spelled out; chosen so a plain `reject` keeps its generic meaning (stage stays open).
- `stageB` returns `card` as the F.6 `body_md` string per the contract and adds `card_object` (the full card) for Shape F rendering by plan 06 or 08, plus `plan_status` and `next`.
- Theo `runIt` text is not persisted in the run state (only stepId, label, stepKind), so resuming a run after a session break re-reads Theo for step text.
- Not-ready plans: `stageB` marks `stage_b` done and returns ok with the not-ready card rather than failing, so Larry can show it and let the navigator revise.

## Known Stubs

None. Fixture strings live only under tests/ and are marked `not canon`.

## Threat Flags

None. Mitigations covered by tests: T-364-17 (D4-D6), T-364-18 (D4 output_invalid and output_too_large, validateQuestionSet before planning), T-364-19 (D2, D15, D16), T-364-20 (D15 static scan), T-364-21 (D12), T-364-22 (D1).

## Notes for downstream plans

- `walkedState` stops after sr:7; call `stageB(roomDir, state, {})` for the plan. `syntheticEntry(over)` builds an entry without a room.db.
- `STAGE_GATES` are as published; the F.1 entry gate lives before `createRun`.
- STATE.md and ROADMAP.md were not touched (orchestrator-owned this phase). The unrelated peer-dirty tests/test-369-canon-scope-docs.cjs was left alone.

## Self-Check: PASSED

- FOUND: lib/core/research-planner/sr-door.cjs, tests/helpers/fixture-door-364.cjs, tests/test-364-sr-door.cjs, lib/core/research-planner/question-templates.cjs (doors edit)
- FOUND commits (ancestors of HEAD): 4d17523bf, b0b5f9d89, 61e51e95b
