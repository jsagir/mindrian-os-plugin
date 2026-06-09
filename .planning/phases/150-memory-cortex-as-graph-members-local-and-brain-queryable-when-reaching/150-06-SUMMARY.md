---
phase: 150-memory-cortex-as-graph-members
plan: 06
subsystem: selector-graph-driven-and-render-unlock
tags: [dial, selector, cortex-reach-adapter, archetype-escalation, render-unlock, part2, part3, part4, part7, part9, MEM-06, D-08, D-02]
one_liner: "The 148 selector goes graph-driven: a cortex-reach-adapter folds the legD cortex into roomState.reachScores, resolveArchetype escalates above the static floor on contradiction presence, and buildReachList -> dial-presenter gains its FIRST production caller on the live decide() surface (the C2 render unlock)."

# Dependency graph
requires:
  - phase: 150-01
    provides: "the projected cortex node types (memory_artifact / governing_thought / navigator_persona / decision) the adapter reads as presence + enum signals"
  - phase: 150-04
    provides: "getRoomContext legD cortexNodes -- the RAW-LOCAL projected cortex the adapter folds into reachScores and the render threads onto the LOCAL routing lane"
  - phase: 148
    provides: "the FROZEN dial: buildReachList (MAX_K=3, 0.70/0.15 gate, DIAL_REACH_K=6), the 6 machine reaches, resolveArchetype + reach-component-map.json (the static archetype floor)"
  - phase: 143.1
    provides: "dial-reach-orchestrator buildReachList (the pure ranker) + dial-presenter renderDial (the pure renderer with ZERO production callers -- the C2 BLOCKED render arm)"
  - phase: 144
    provides: "navigation-engine decide() + routing_source legacy->engine flip -- the engine arm this render keys on"
provides:
  - "lib/hmi/cortex-reach-adapter.cjs: buildReachScoresFromCortex(cortexNodes) -> {reach_id: 0..1} -- the NEW getRoomContext->reachScores caller; the flat-file side-channel demoted to fallback (D-02)"
  - "resolveArchetype(reachKey, cortexState?) -- OPTIONAL second arg; contradiction presence escalates select -> confirm above the static floor; no-arg callers byte-stable; the static map is never lowered"
  - "scripts/intent-classifier.cjs renderEngineDecisionWithDial: buildReachList -> dial-presenter wired into the LIVE decide() response surface (D-08 render unlock); the FIRST production caller of the pair"
  - "tests/test-150-selector-graph-driven.cjs + tests/test-150-render-unlock.cjs registered in run-all-150.sh"
affects: [150-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cortex -> reachScores adapter as a NEW caller (not an orchestrator edit): the pure ranker stays pure; the adapter folds legD presence + enum signals into the prior map the frozen ranker already consumes; empty cortex -> {} so the flat-file path is the fallback"
    - "archetype escalation rank: the static reach-component-map is the FLOOR; an optional cortexState only LIFTS select -> confirm on contradiction presence, never lowers; orthogonal archetypes (multiSelect/ordered/group/auto/text) untouched"
    - "render unlock via a best-effort wrapper on the engine arm only: renderEngineDecisionWithDial keys on routing_source=='engine', degrades to the base block on any fault, never blocks the turn"
    - "require.main === module guard + module.exports so a self-executing hook script becomes testable without firing the hook"

key-files:
  created:
    - tests/test-150-selector-graph-driven.cjs
    - tests/test-150-render-unlock.cjs
    - lib/hmi/cortex-reach-adapter.cjs
  modified:
    - tests/run-all-150.sh
    - lib/hmi/selector-dispatcher.cjs
    - scripts/intent-classifier.cjs

key-decisions:
  - "cortex-reach-adapter is a NEW caller, NOT an edit to dial-reach-orchestrator.cjs: the orchestrator stays a pure renderer (Canon Part 7 + the resolve/format split). The adapter reads the legD cortexNodes and produces roomState.reachScores; the frozen ranker consumes whatever keys it is handed."
  - "contradiction_present weight = 0.55: a contradiction in the cortex is the one move most worth attention, so it must rank ABOVE the orchestrator's registry-only 0.5 floor (cross_room) to shift the one-move -- yet stay BELOW the 0.70 recommend gate so a single signal escalates the one-move but never solo-crosses the marker floor."
  - "resolveArchetype escalation is a 2-rung ladder (select=0, confirm=1): the cortex only lifts select->confirm; orthogonal archetypes are never down-ranked. The signal source is contradiction presence via the adapter's hasContradiction (lazy-required so a degraded install without the adapter still resolves the static floor)."
  - "the render unlock fires on the engine arm ONLY (routing_source=='engine'): legacy/mixed/silent keep the base block byte-stable (no regression). The dial is the engine-decision face."
  - "cortex_nodes threaded out of runNavigationEngine on the LOCAL routing lane (presence + enums only): NEVER added to the turn object or any path reaching buildBrainPacket (D-03a fence; Canon Part 8). The adapter reads node-type presence + a small fixed enum set, never cortex prose."

requirements-completed: [MEM-06]

# Metrics
duration: 12min
completed: 2026-06-09
tasks: 3
files_created: 3
files_modified: 3
---

# Phase 150 Plan 06: Selector Graph-Driven + Render Unlock Summary

JTBD: today buildReachList (the frozen 148 ranker) and dial-presenter (the pure renderer) have ZERO production callers -- the engine decides the one next move and the navigator NEVER SEES it (the C2 BLOCKED render arm). 148 built the UI machinery; 150 supplies the grounded cortex signal AND wires the render into the live response. They only deliver together. This plan made all three moves: (a) a new cortex->reachScores adapter, (b) the resolveArchetype cortex-escalation arg, (c) the render unlock.

## What shipped

### Task 1 -- RED suite (test commit 380c24a8)
Two RED-by-design CJS suites, registered in `tests/run-all-150.sh`:
- `test-150-selector-graph-driven.cjs` (MEM-06): the adapter folds cortexNodes into reachScores; the cortex shifts the ranked one-move vs a flat reachScores; `resolveArchetype(reachKey, cortexState)` escalates above the static floor and never lowers it; the three frozen 148 constants are read and asserted byte-unchanged.
- `test-150-render-unlock.cjs` (D-08): a require-cache spy on `dial-presenter.renderDial` proves it is INVOKED on the engine arm; the honest-negative (cortex absent) still renders; the legacy arm does not require the dial.

Both went RED exactly as designed (adapter absent, resolveArchetype single-arg, render unwired).

### Task 2 -- adapter + archetype escalation (feat commit 4546bd5d)
- `lib/hmi/cortex-reach-adapter.cjs` (NEW): `buildReachScoresFromCortex(cortexNodes)` reads node-type presence + a fixed enum set (contradiction `kind`, governing_thought `freshness`, persona/memory_artifact presence) and folds them into a normalized 0..1 prior map keyed by reach_id. Empty cortex returns `{}` so the orchestrator's flat-file path is the fallback (D-02). Pure / sync / LOCAL-only / zero Brain / never reads prose.
- `lib/hmi/selector-dispatcher.cjs`: `resolveArchetype` gains the OPTIONAL `cortexState` second arg. No-arg callers are byte-stable (the static reach-component-map floor). With contradiction presence in `cortexState`, a `select` reach escalates to `confirm`; the static map is never lowered (T-150-06-04).

### Task 3 -- the render unlock (feat commit a73a08de)
- `scripts/intent-classifier.cjs`: `renderEngineDecisionWithDial` wraps `formatEngineDecisionBlock` and, on the engine arm (`routing_source==='engine'`), builds `roomState.reachScores` from the legD cortex via the adapter, ranks with the FROZEN `buildReachList`, and presents through `dial-presenter.renderDial` -- the C2 unlock: buildReachList -> dial-presenter gains its FIRST production caller. The legD `cortex_nodes` are threaded out of `runNavigationEngine` on the LOCAL routing lane. The render is best-effort (wrapped; a fault never blocks the turn). A `require.main === module` guard + `module.exports` make the helper testable without firing the hook; self-execution is preserved.

## Frozen-contract compliance
MAX_K=3, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15, DIAL_REACH_K=6 are all byte-unchanged. 150 FEEDS the selector (supplies the priors the ranker already consumes); it never re-architects it. The selector-graph-driven suite reads the constants and asserts their values; the 148 component-map + dial-reach-orchestrator suites still pass.

## Canon gates
- Part 8 (Graph Boundary): the adapter reads presence + enums only, never cortex prose; cortex_nodes ride the LOCAL routing lane only and never reach buildBrainPacket (D-03a fence). `test-150-brain-egress.cjs` still green. Zero Brain calls in the new files.
- Part 9 (Memory Locality): SQL navigated (legD), the adapter reasons over structured node fields, the dial ranks/presents; no prose, no truth-promotion.
- Part 2 / Part 3 / Part 4: the reaches arm the navigator's team; the Shape F dial surfaces them; the engine decision is the one-move the navigator sees.
- No em-dashes / en-dashes in any edited source (verified by grep sweep + per-suite assertion).

## Verification
- `node tests/test-150-selector-graph-driven.cjs` -- all assertions pass.
- `node tests/test-150-render-unlock.cjs` -- all assertions pass.
- `node -c scripts/intent-classifier.cjs` -- parses; self-exec smoke run exits 0.
- `bash tests/run-all-150.sh` -- 10 passed, 0 failed, 4 missing (downstream plans 07/08, out of 150-06 scope).
- `node tests/test-148-component-map.cjs`, `node tests/test-dial-reach-orchestrator.cjs`, `test-selector-dispatcher*.cjs`, `bash tests/run-all-144.sh` -- no regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] contradiction_present weight raised 0.45 -> 0.55**
- **Found during:** Task 2 (the cortex-shift assertion failed).
- **Issue:** With the contradiction weight at 0.45, the cortex-built `contradiction` prior (0.45) stayed below the orchestrator's registry-only 0.5 floor for `cross_room`, so the ranked one-move did not change vs a flat reachScores -- the graph-driven behavior was not observable.
- **Fix:** Raised `CONTRIBUTIONS.contradiction_present` to 0.55 so a single contradiction signal lifts the one-move above the 0.5 registry floor (the intended product behavior: a contradiction IS the move most worth attention) while staying below the 0.70 recommend gate.
- **Files modified:** lib/hmi/cortex-reach-adapter.cjs
- **Commit:** 4546bd5d

### Other deviations
- Added `test-150-render-unlock.cjs` to `tests/run-all-150.sh` (the runner header only pre-listed `test-150-selector-graph-driven.cjs` for Plan 06; the render-unlock suite is the second 150-06 surface and the runner is the authoritative gate). [Rule 2 - missing critical coverage]
- Made `scripts/intent-classifier.cjs` require-safe via a `require.main === module` guard so the render helper is unit-testable without firing the hook. This is the seam the plan's render-unlock proof requires (a spy on dial-presenter driven through the exported helper). Self-execution is preserved and smoke-verified. [Rule 3 - blocking issue: the script self-executed on require]

## Self-Check: PASSED
- FOUND: lib/hmi/cortex-reach-adapter.cjs
- FOUND: tests/test-150-selector-graph-driven.cjs
- FOUND: tests/test-150-render-unlock.cjs
- FOUND commit: 380c24a8 (test RED suite)
- FOUND commit: 4546bd5d (adapter + escalation)
- FOUND commit: a73a08de (render unlock)
