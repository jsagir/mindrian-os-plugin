---
phase: 166-gated-chain-executor
plan: 01
subsystem: chain-executor-foundation
tags: [B1, B4, D-166-02, D-166-03, pipeline-state, recipe-maps, part-7, part-8, part-9]
requires:
  - lib/mcp/pipeline-state.cjs (shipped store: read/write/initChain/recordStep/checkPosition)
  - lib/workflow/command-resolver.cjs (validateChainAutonomy posture authority)
  - data/command-registry.json (posture map)
  - data/connector-registry.json (reach -> surface map)
  - data/brain-orchestration-projection.json (207-node ranked-next-reach projection)
provides:
  - pipeline-state.cjs as the SOLE chain-state source of truth (CHAIN_STATE_SOURCE) with a hard isNext gate
  - lib/core/recipe-maps.cjs three-map authority joiner (postureForCommand / wiringForReach / rankedNextReach)
  - tests/run-all-166.sh phase aggregator (Wave 1 foundation suites + Part 8 sweep + em-dash sweep)
affects:
  - Wave 2 runChain loop (consumes checkPosition hard gate + recipe-maps authorities)
tech-stack:
  added: []
  patterns:
    - per-process cache + degrade-to-empty (mirrors command-resolver _load)
    - additive return-shape widening (isNext byte-stable; gate fields additive)
    - U+2014 codepoint escape for the em-dash sweep glyph
key-files:
  created:
    - lib/core/recipe-maps.cjs
    - tests/test-pipeline-state-isnext-gate.cjs
    - tests/test-recipe-maps-authority.cjs
    - tests/run-all-166.sh
  modified:
    - lib/mcp/pipeline-state.cjs
decisions:
  - "pipeline-state.cjs is the sole chain-state truth (D-166-02); commands/pipeline.md:78-114 frontmatter scan demoted to a secondary index"
  - "checkPosition.isNext promoted to a hard gate (gate run/withhold + reason no_active_chain/not_next + expectedNext); isNext stays byte-stable"
  - "recipe-maps reads three maps for three jobs, layered not merged (D-166-03); zero Brain egress (Part 8)"
  - "rankedNextReach is CONTRACT-ONLY: decide() drives the Wave-2 loop; live nav-engine consumption of the projection deferred with Phase 157"
metrics:
  duration_minutes: 4
  completed: 2026-06-18
  tasks: 3
  files_created: 4
  files_modified: 1
---

# Phase 166 Plan 01: Wave 1 Foundation (B1 + B4) Summary

The two load-bearing pre-work blockers landed before any runChain loop code exists: B1 makes `lib/mcp/pipeline-state.cjs` (room/.mindrian/pipeline-state.json) the SOLE chain-state source of truth with a HARD `isNext` gate, and B4 wires `lib/core/recipe-maps.cjs` as the one read-only joiner over the three existing recipe maps (command-registry = posture, connector-registry = reach-to-surface wiring, brain-orchestration-projection = ranked next-reach), each read for exactly one job, layered not merged, with zero Brain egress.

## What Was Built

### Task 1 (B1, D-166-02): pipeline-state.cjs sole-truth + hard isNext gate
- Extended `checkPosition` WITHOUT changing the shipped read/write/initChain/recordStep signatures. The return now carries a hard-gate triple the executor must honor: `gate` ('run' when the tool IS the next expected step, 'withhold' otherwise), `reason` ('no_active_chain' when no chain, 'not_next' when a chain is active but the tool is out of order, null when running), and `expectedNext` (names the tool the chain expects next so a 'not_next' withhold is actionable). The legacy `isNext` boolean stays byte-stable; the new fields are additive.
- Added a module-level `CHAIN_STATE_SOURCE = 'pipeline-state.json'` constant and exported it, plus a sole-truth doc-comment block citing `commands/pipeline.md:78-114` and demoting that frontmatter scan to a secondary index only.
- Captured the SHIPPED store behavior as its first test coverage (the four behaviors in `tests/test-pipeline-state-isnext-gate.cjs`).

### Task 2 (B4, D-166-03): recipe-maps.cjs three-map authority joiner
- `postureForCommand(command)`: posture/autonomy authority. Reuses `command-resolver.validateChainAutonomy` (the ONE posture authority) against a single-step workflow; an autonomous_safe command maps push_forward -> 'run', everything else (including an unknown command) degrades to a withhold-default 'halt' -- never a fabricated autonomous_safe (T-166-02).
- `wiringForReach(reachId)`: reads `data/connector-registry.json` connectors[] and returns the dispatch-target surface(s) whose reach_id matches; unknown reach -> [].
- `rankedNextReach(opts)`: reads the 207-node `data/brain-orchestration-projection.json`, returns ranking-bearing nodes sorted by hierarchy_rank. Carries a TRUTH-IN-LABELING doc-comment: CONTRACT-ONLY reader, decide() drives the Wave-2 loop, live nav-engine consumption deferred with Phase 157.
- Each reader caches per-process and degrades to empty on missing/malformed JSON (mirrors the command-resolver _load idiom). Zero Brain calls; no brain-client require; no raw fetch.

### Task 3: tests/run-all-166.sh phase aggregator
- Mirrors `tests/run-all-156.sh`: a CJS_SUITES loop that runs to completion (a missing file gates to a FAIL line, never a crash), a Part-8 grep sweep over `lib/core/recipe-maps.cjs` (BRAIN_WRITE + RAW_FETCH + external-http + brain-client regexes, with comment-line filtering so a doc-comment cannot self-invalidate the count), and an em-dash sweep written via the U+2014 codepoint escape so the runner carries no literal em-dash. Final tally + exit 1 on any failure; `set -uo pipefail`; bash only; no emoji.

## Canon Compliance

- **Part 7 (Reuse Before Build):** recipe-maps.cjs is an ~85 percent repoint over the shipped command-resolver + two committed JSON maps; pipeline-state.cjs was EXTENDED, not rewritten. Both cite file:line.
- **Part 8 (Graph Boundary):** recipe-maps.cjs makes zero Brain calls. The projection read is a Brain-DERIVED LOCAL cache (Part 8 amendment entry 19); reading it opens no Brain wire. The Part-8 sweep in run-all-166.sh proves the clean surface by construction.
- **Part 9 (writes via the navigation chokepoint):** this wave is read-only over the maps and the store; it opens no new write path. The store writes stay inside pipeline-state.cjs's existing write() chokepoint.
- **No em-dashes** anywhere (verified across all 5 touched files).

## Truth-in-Labeling (do not regress)

`rankedNextReach` is the projection's first NAMED consumer (closing the dark-projection gap), but it is a CONTRACT-ONLY read. The Wave-2 runChain loop re-derives the next step from `decide()` (navigation-engine.cjs), NOT from rankedNextReach. Live nav-engine consumption of the projection cache for ranked next-reach is explicitly DEFERRED with Phase 157 (166-SPEC.md Out-of-scope). The doc-comment on the function states this so a future reader does not wire it into the loop by mistake. decide()'s return shape is UNCHANGED (B2 untouched this wave).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Relaxed the wiringForReach surface-shape assertion to match shipped connector data**
- **Found during:** Task 2 (GREEN run)
- **Issue:** The initial test asserted every wired surface for reach `context_block` starts with `/mos:`. The shipped `data/connector-registry.json` legitimately wires `agent:persona-analyst` and `agent:reverse-salient-agent` to `context_block` alongside the `/mos:` commands, so the assertion was wrong about the data, not the code.
- **Fix:** Assert every wired surface is a non-empty dispatch-target string AND at least one is a `/mos:` command. The wiring job (reach -> surface) is agnostic to whether a surface is a command, agent, or skill.
- **Files modified:** tests/test-recipe-maps-authority.cjs
- **Commit:** d7bbb8aa (landed with the GREEN impl; the original RED was a module-missing failure)

## Verification

- `node tests/test-pipeline-state-isnext-gate.cjs` -> 4/4 PASS (ISNEXT_GATE_OK)
- `node tests/test-recipe-maps-authority.cjs` -> 4/4 PASS (RECIPE_MAPS_OK)
- `bash tests/run-all-166.sh` -> GREEN (4/4: both suites + Part 8 sweep + em-dash sweep; PHASE_GATE_SCAFFOLD_GREEN)
- `pipeline-state.cjs` exports `CHAIN_STATE_SOURCE === 'pipeline-state.json'` and the sole-truth doc-comment cites `commands/pipeline.md:78-114`.
- Em-dash sweep clean across all 5 touched files.

## Commits

- 310fb2c6 test(166-01): add failing isNext hard-gate + sole-truth test for pipeline-state (B1) [RED]
- 84d8c59c feat(166-01): promote checkPosition.isNext to a hard gate + name pipeline-state the sole chain-state truth (B1) [GREEN]
- 4f003330 test(166-01): add failing three-maps-three-jobs + zero-Brain-egress test for recipe-maps (B4) [RED]
- d7bbb8aa feat(166-01): recipe-maps.cjs -- three existing maps, one job each, layered (B4) [GREEN]
- a7149a11 test(166-01): scaffold tests/run-all-166.sh phase aggregator

## TDD Gate Compliance

Both behavior-adding tasks followed RED -> GREEN: Task 1 (test 310fb2c6 RED, feat 84d8c59c GREEN), Task 2 (test 4f003330 RED, feat d7bbb8aa GREEN). No REFACTOR commit was needed (the GREEN implementations were already clean). Task 3 is a test-infrastructure scaffold (no behavior).

## Self-Check: PASSED

All 6 files present on disk (4 created, 1 modified, 1 summary) and all 5 per-task commits found in git history.
