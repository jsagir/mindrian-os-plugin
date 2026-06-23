---
phase: 172-contextual-invocation-coverage
plan: 10
subsystem: infra
tags: [cirs, r6, inv-08, inv-12, curated-chains, feeds-into, orchestration-projection, local-only, earned-confidence]

# Dependency graph
requires:
  - phase: 172-03 (orchestration-projection + validateProjection)
    provides: data/brain-orchestration-projection.json + the curated_chains -> FEEDS_INTO/CHAINS/PREREQUISITE addEdge mapping + the chain_layer_note SOURCE-EMPTY/materialized flip
  - phase: 170-dual-use-diffusion-ace
    provides: the ACE FEEDS_INTO venture-flow seed (S-Curve / Reverse Salient / PEST INTO Adoption-Capacity Theory; ACE INTO Scenario Planning / Mullins / Triple Validation Compass) -- 170 wrote it to the Brain with UNIFORM 0.8/0.75 weights; this plan re-supplies it on the LOCAL projection with per-edge EARNED confidence (the R6 cure)
  - phase: 122-workflow-layer
    provides: data/command-registry.json + scripts/build-command-registry.cjs (the curated_chains host) + lib/workflow/f-selector-ranker.cjs (the Part-3 MAX_K ranker the recommender defers to)
provides:
  - data/command-registry.json curated_chains populated with 13 per-edge {kind, from, to, confidence} entries (was [])
  - data/brain-orchestration-projection.json FEEDS_INTO chain layer materialized (11 FEEDS_INTO + 1 CHAINS + 1 PREREQUISITE)
  - lib/workflow/local-chain-recommender.cjs: recommendChainCandidates() ranks chain candidates off the LOCAL projection by curated confidence, Local-Only (INV-12)
  - tests/test-curated-chains-ranking.cjs: 4 ranking behaviors, registered in run-all-172.sh (now 10/10)
  - build-command-registry.cjs loadCuratedChains(): curated_chains is now a hand-maintained block PRESERVED across regeneration (the R6 placeholder-by-omission fix)
affects: [172-11 (coverage-rollup chain-reachability monitor now has a non-empty chain layer to monitor), 172-13 (hard-FAIL gate flip), SEED-009 (learned weights), suggest-next / /mos:act chain surfacing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Earned (per-edge, non-uniform) FEEDS_INTO confidence on the PROJECTION curated_chains entry, NOT the frozen navigation ALLOWED_EDGE_TYPES FEEDS_INTO (Canon Part 11 R6 constraint C; edges.cjs untouched)"
    - "Curated-chains-as-hand-maintained-block: build-command-registry.cjs preserves curated_chains across regeneration via loadCuratedChains(), mirroring the loadCuratedExtras() idiom (was hardcoded [] -> wiped on every rebuild)"
    - "Local-Only rank: the recommender reads ONLY committed local files (projection + registry); zero brain-client require, zero fetch/http at rank time (INV-12 / R7)"
    - "R6 ranking-deferral: the recommender SUPPLIES confidence + re-exports the Part-3 MAX_K cap; it does NOT duplicate rankForSelector -- CIRS supplies confidence, Part 3 orders the final surfaced set"
    - "Earned-confidence drop rule: a projection chain edge with no curated-confidence join is DROPPED, never given a fabricated uniform default (R6: absent/uniform confidence is the defect to remove)"

key-files:
  created:
    - lib/workflow/local-chain-recommender.cjs
    - tests/test-curated-chains-ranking.cjs
  modified:
    - data/command-registry.json
    - data/brain-orchestration-projection.json
    - data/orchestration-command-ledger.json
    - data/harness-manifest.json
    - scripts/build-command-registry.cjs
    - tests/run-all-172.sh

key-decisions:
  - "CROSS-CLASS CHAINING PATH TAKEN = framework/reach-scoped (the navigator-directive referential-integrity-safe fallback). The generator's curatedChainEdges() resolve() accepts ONLY framework:<name> / reach:<id> endpoints (build-orchestration-projection.cjs:521-529); a command:<slug>/counterpart endpoint returns the raw string and makes addEdge THROW (dangling-endpoint referential integrity). Per the plan + Canon Part 11 constraint I did NOT force it: no new edge type, no new endpoint kind, no referential-integrity throw. The command->pipeline->framework act-sequenceable chain coverage is recorded as a Plan-11/13 WARN-tier follow-on (command-counterpart chain coverage)."
  - "Projection framework node set is DERIVED from framework_index (command + connector registries) + cross-domain-analogues endpoints, NOT from data/framework-names.json. Several framework-names.json entries (Sustaining vs Disruptive Innovation, Self-Selling Loop, Cynefin Framework, Wicked Problem Detection Framework, Strategic Inflection Point) have NO declaring command so NO projection node; using them as endpoints made addEdge THROW. Re-scoped every curated_chains endpoint to a projection-resolvable framework (Dominant Design, Four Lenses of Innovation, Futures Wheel substituted in), preserving the ACE venture-flow shape and per-edge non-uniform confidence."
  - "confidence lives on the curated_chains SOURCE entry (the projection's FEEDS_INTO supply), NOT on the materialized projection edge (addEdge emits only {type, from, to} per EDGE_FIELD_ALLOWLIST) and NOT on the frozen navigation ALLOWED_EDGE_TYPES FEEDS_INTO (lib/core/navigation/edges.cjs untouched). This is exactly Canon Part 11 R6 constraint C."
  - "curated for v1; learned weights DEFERRED to SEED-009 (per 172-CONTEXT D-172-d). Per-edge confidence is curated/defensible, not learned."

patterns-established:
  - "13 distinct per-edge confidence values across 13 curated_chains entries -- non-uniform by construction (the placeholder-uniform value is the R6 defect to remove)."
  - "chain_layer_note flips SOURCE-EMPTY -> '13 edge(s)' once curated_chains is populated; the projection --check exits 0 with zero dangling edges (referential integrity held)."

requirements-completed: [INV-08]

# Metrics
duration: 38min
completed: 2026-06-23
---

# Phase 172 Plan 10: Curated Chain Confidence + LOCAL-Projection Ranking Summary

Implemented Canon Part 11 R6 / INV-08: populated the curated FEEDS_INTO confidences in `command-registry.json` `curated_chains` (was `[]`), materialized the orchestration projection's chain layer from them, and wired `suggest-next` to rank chain candidates off the LOCAL projection with EARNED per-edge confidence -- all Local-Only (INV-12), zero Brain at rank time. Chain confidence was absent end-to-end in production (placeholder-by-omission); R6 makes earned, non-uniform confidence the rule.

## What shipped

- **Task 1 (commit bed00b75).** Populated `data/command-registry.json` `curated_chains` with 13 curated `{kind, from, to, confidence}` entries, each confidence per-edge (13 distinct values, non-uniform). Seeded from the Phase-170 ACE venture-flow chain. Every from/to resolves to an exact framework name. Found and fixed a Rule-3 blocker: `build-command-registry.cjs` hardcoded `curated_chains: []`, which would wipe the curated data on every regeneration (the literal R6 placeholder-by-omission defect); now preserved across regen via `loadCuratedChains()`, mirroring the existing `loadCuratedExtras()` idiom. No property added to the frozen navigation `ALLOWED_EDGE_TYPES` FEEDS_INTO.
- **Task 2 (commit e5e6ab39).** Regenerated `data/brain-orchestration-projection.json`: the chain layer materialized to **11 FEEDS_INTO + 1 CHAINS + 1 PREREQUISITE** edges; `chain_layer_note` flipped from SOURCE-EMPTY to `13 edge(s)`; `--check` exits 0 with zero dangling edges. Re-scoped curated_chains endpoints from framework-names.json names to projection-resolvable frameworks (see deviations).
- **Task 3 (commits b08b9d36 RED, cbc4dde2 GREEN).** TDD. New `lib/workflow/local-chain-recommender.cjs` (`recommendChainCandidates()`) reads the LOCAL projection's chain edges joined to curated_chains confidence and ranks by confidence descending. Local-Only: zero brain-client require, zero fetch/http, zero live Brain invocation at rank time. R6 ranking-deferral: re-exports the Part-3 `MAX_K` cap and does NOT duplicate `rankForSelector`. `tests/test-curated-chains-ranking.cjs` 4/4 PASS; registered in `tests/run-all-172.sh` (now 10/10).

## Cross-class chaining: path taken (and why)

**Path taken: framework/reach-scoped (the referential-integrity-safe fallback).** Before seeding, I inspected the generator's accepted endpoint kinds: `curatedChainEdges()` -> `resolve()` (`scripts/build-orchestration-projection.cjs:521-529`) accepts ONLY `framework:<name>` and `reach:<id>` endpoints. A `command:<slug>` / counterpart endpoint returns the raw string, and `addEdge` THROWS a dangling-endpoint error (referential integrity). Per the navigator directive and Canon Part 11 constraint, I did NOT force command/counterpart endpoints (no new edge type, no new endpoint kind, no referential-integrity throw). I scoped `curated_chains` to valid framework/reach endpoints. The command -> pipeline -> framework act-sequenceable chain coverage is recorded as a **Plan-11/13 WARN-tier follow-on** (command-counterpart chain coverage); chain-attribute coverage over the wired set remains WARN-tier now (R6 DEFERRED-ENFORCEMENT; hard flip = SEED-009).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] build-command-registry.cjs wiped curated_chains on regeneration**
- **Found during:** Task 1 (the pre-commit `--check` reported the registry STALE after the hand-edit).
- **Issue:** `buildRegistry()` hardcoded `curated_chains: []` (line 247), so any regeneration erased the populated curated_chains -- the placeholder-by-omission defect R6 exists to remove.
- **Fix:** Added `loadCuratedChains()` (mirrors the existing `loadCuratedExtras()` precedent) reading the on-disk registry; `buildRegistry()` now carries curated_chains through untouched. curated_chains became a hand-maintained curated block surviving regeneration.
- **Files modified:** scripts/build-command-registry.cjs
- **Commit:** bed00b75

**2. [Rule 3 - Blocking] curated_chains endpoints must resolve to a PROJECTION node, not just a framework-names.json name**
- **Found during:** Task 2 (the projection build threw `addEdge: dangling edge endpoint (from) "Sustaining vs Disruptive Innovation"`).
- **Issue:** The projection's framework node set is DERIVED from `framework_index` (command + connector registries) + cross-domain-analogue endpoints, NOT from `framework-names.json`. Five of my Task-1 endpoints (Sustaining vs Disruptive Innovation, Self-Selling Loop, Cynefin Framework, Wicked Problem Detection Framework, Strategic Inflection Point) are in framework-names.json but have no declaring command, so no projection node -> addEdge threw (referential integrity, exactly as the plan warned).
- **Fix:** Re-scoped every curated_chains endpoint to a projection-resolvable framework. Substituted Dominant Design (for the sustaining/disruptive-innovation upstream arc), Four Lenses of Innovation, and Futures Wheel; dropped the unresolvable downstream/lateral edges. Preserved the ACE venture-flow shape and per-edge non-uniform confidence (13 distinct values across 13 entries).
- **Files modified:** data/command-registry.json (folded into the Task 2 commit since it is the fix that makes the projection build succeed)
- **Commit:** e5e6ab39

### Sanctioned lockstep (not deviations)

- **harness-manifest STALE tripwire** fired after regenerating the registry (Task 1) and the projection (Task 2). Ran `node scripts/build-harness-manifest.cjs` and staged `data/harness-manifest.json` in the same commit each time -- the sanctioned lockstep prior plans hit.
- **orchestration-command-ledger.json** regenerated alongside the projection (Task 2); committed together.

## Out-of-scope (logged, not fixed)

- **COMMAND-GAP warnings (16 bare commands)** surfaced by the projection `--check`: pre-existing, WARN-only ("hard-FAIL flips in Plan 172-13"), about bare commands not ranked/excluded -- unrelated to this plan's chain layer.
- **/mos:ingest-methodology missing serves_jtbd**: pre-existing build-command-registry WARNING, out of scope.

## Self-Check: PASSED
- FOUND: lib/workflow/local-chain-recommender.cjs
- FOUND: tests/test-curated-chains-ranking.cjs
- FOUND: commit bed00b75 (Task 1), e5e6ab39 (Task 2), b08b9d36 (RED), cbc4dde2 (GREEN)
- VERIFY: node scripts/build-orchestration-projection.cjs --check -> exit 0
- VERIFY: node tests/test-curated-chains-ranking.cjs -> 4/4 PASS
- VERIFY: navigation ALLOWED_EDGE_TYPES FEEDS_INTO untouched (edges.cjs not modified)
- VERIFY: curated_chains 13 entries, 13 distinct confidence values (non-uniform)
- VERIFY: projection FEEDS_INTO 11 + CHAINS 1 + PREREQUISITE 1; chain_layer_note not SOURCE-EMPTY
