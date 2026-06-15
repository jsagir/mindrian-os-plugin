---
phase: 157-brain-orchestration-graph-and-methodology-tiers
plan: 02
subsystem: orchestration-projection
tags: [brain-orchestration-projection, methodology_tier, part-7-reuse, part-8-boundary, part-9-local-cache, generator, cross-domain-analogues, larry-reaches]

# Dependency graph
requires:
  - phase: 157-01-canon-amendment
    provides: "Canon Part 8 dual-role amendment (Appendix D entry 19, v1.8) + methodology_tier (pws | mindrian-operation) minted as the boundary-keeper - the constitutional gate this generator implements"
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: "scripts/build-connector-registry.cjs (the Part 7 generator sibling idiom) + data/connector-registry.json (the reach_id/sub_mode/framework/hierarchy_rank/posture ranking-input source)"
  - phase: 122-workflow-layer
    provides: "data/command-registry.json framework_index (the OPERATES command->framework source; read-only, NOT rebuilt)"
  - phase: 148-larryreach-selector-re-wire
    provides: "lib/core/sensors/sensor-types.cjs REACH_IDS (the frozen 6 reaches incl hats) reused for the reach nodes"
provides:
  - "scripts/build-orchestration-projection.cjs: the projection generator (buildProjection / serializeProjection / listSourceFiles / distinctFrameworks / distinctSubModes / rankingInputsFromConnector)"
  - "data/brain-orchestration-projection.json: 206 nodes (27 pws + 179 mindrian-operation) + 49 OPERATES edges, methodology_tier on every node"
  - "data/cross-domain-analogues.json: hand-authored CROSS_DOMAIN_ANALOGUE seed (the two 150.10 pairs, generic framework names)"
  - "the node id scheme (command:/agent:/skill:/framework:/reach:/sub_mode: prefixed) Wave 3 edges will target"
  - "minted pws framework nodes for the analogue endpoints (Reverse Salient Analysis, Four Lenses of Innovation, Systems Thinking) so Wave 3 CROSS_DOMAIN_ANALOGUE edges do not dangle"
affects: [157-03, 157-04, 157-05, brain-orchestration-projection-check, navigation-engine-cache-consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Part 7 generator sibling of build-connector-registry.cjs: listSourceFiles walk + build* -> serialize* byte-compare + three-branch main(), but reads committed JSON registries instead of re-walking frontmatter"
    - "DERIVED node list (BOG-03): file walk (commands/skills/agents) UNION registry framework_index keys UNION analogue endpoints UNION REACH_IDS UNION distinct connector sub_modes; zero hand-authored nodes"
    - "methodology_tier boundary-keeper on every node: framework=pws, all machinery=mindrian-operation"
    - "analogue-endpoint minting: cross-domain-analogues from/to endpoints join the distinct-framework union so Wave 3 edges resolve to real nodes"

key-files:
  created:
    - scripts/build-orchestration-projection.cjs
    - data/cross-domain-analogues.json
    - data/brain-orchestration-projection.json
    - lib/memory/orchestration-projection.test.cjs
    - tests/test-orchestration-projection.cjs
  modified: []

key-decisions:
  - "Node id scheme is kind-prefixed: command:/mos:<base>, skill:<dir>, agent:<base>, framework:<name>, reach:<reach_id>, sub_mode:<sub_mode>. Command surface matches connector-registry surface naming exactly so OPERATES edges line up with framework_index inverse-index values."
  - "D-01 honored: skills carry NO connector frontmatter, projected as name+tier-only mindrian-operation nodes (13/13); agents/commands that have a connector carry their ranking inputs."
  - "D-02 honored: cross-domain-analogues.json is hand-authored generic framework-NAME pairs (the two 150.10 seeds), NOT HSI/embedding-derived; the generator reads it and mints its endpoints as framework nodes."
  - "OPERATES edge scaffold (command -> framework) promoted from BOTH command-registry.framework_index AND connector-registry.framework_index, deduped + sorted for byte-stability; Plan 03 widens the edge set to CHAINS/FEEDS_INTO/PREREQUISITE/CROSS_DOMAIN_ANALOGUE."
  - "REACH_IDS reused from sensor-types.cjs (the frozen 6 incl hats); never redefined."

metrics:
  duration: "4 min"
  completed: 2026-06-15
  tasks: 2
  files: 5
  nodes_total: 206
  nodes_pws: 27
  nodes_mindrian_operation: 179
  edges_operates: 49
---

# Phase 157 Plan 02: Brain Orchestration Projection Generator + Nodes Layer Summary

The orchestration-projection generator (a Part 7 reuse sibling of `scripts/build-connector-registry.cjs`) reads the two committed registries plus a skills/agents file walk plus the hand-authored `data/cross-domain-analogues.json`, and emits `data/brain-orchestration-projection.json`: a 206-node / 49-edge graph where EVERY node carries a `methodology_tier` of exactly `pws` (27 framework nodes) or `mindrian-operation` (179 machinery nodes), at per-file grain, with a fully DERIVED node list (zero hand-authoring).

## What Was Built

### Task 1: data/cross-domain-analogues.json (the hand-authored seed)
A version-controlled, `--check`-ready seed mirroring the `curated_chains` idiom: a `hand_authored_note` string declaring it generic-framework-names-only / never-HSI-derived / never-user-content, plus an `analogues[]` array with the two 150.10 prototype pairs:
- `Systems Thinking` (M4 leverage) <-> `Reverse Salient Analysis`
- `Systems Thinking` (M3 archetype / find-analogies) <-> `Four Lenses of Innovation`

All four endpoint strings use the EXACT `framework_index` spellings (confirmed present in both registries), so Wave 3's CROSS_DOMAIN_ANALOGUE edges resolve to real framework nodes.

### Task 2: the generator + the projection + the tests
`scripts/build-orchestration-projection.cjs` mirrors the connector generator's shape (`listSourceFiles` walk, `buildProjection` -> `serializeProjection` byte-stable JSON + trailing newline, three-branch `main()` with a `--check`-ready hook for Plan 04). It reads `connector-registry.json` + `command-registry.json` as read-only sources, walks `skills/<dir>/SKILL.md` + `agents/*.md`, and reads `cross-domain-analogues.json`.

`buildProjection()` emits:
- **nodes[]** at per-file grain: 95 commands, 13 skills, 9 agents, 27 frameworks, 6 reaches, 56 sub_modes. Frameworks = `pws`; everything else = `mindrian-operation`. Command/agent nodes carry their `ranking` block (reach_id/sub_mode/hierarchy_rank/posture/sensor_triggers/framework) pulled from the connector spine (BOG-07 precursor).
- **edges[]**: 49 OPERATES (command -> framework) scaffold edges promoted from both `framework_index` inverse maps, deduped + sorted.

`lib/memory/orchestration-projection.test.cjs` (11 assertions) is re-required by `tests/test-orchestration-projection.cjs` (the connector test split idiom).

## Node ID Scheme (what Wave 3 must target)

| kind | id format | tier | count |
|------|-----------|------|-------|
| command | `command:/mos:<base>` | mindrian-operation | 95 |
| skill | `skill:<dir>` | mindrian-operation | 13 |
| agent | `agent:<base>` | mindrian-operation | 9 |
| framework | `framework:<exact name>` | pws | 27 |
| reach | `reach:<reach_id>` | mindrian-operation | 6 |
| sub_mode | `sub_mode:<sub_mode>` | mindrian-operation | 56 |

The command surface in a node id matches the `connector-registry` surface naming exactly (`/mos:<base>`), so OPERATES `from` ids line up with `framework_index` inverse-index values. Edges carry `{ type, from, to }` with `from`/`to` being node ids.

## Wave 3 Handoff (typed edges + ranking exposure)

- **Framework nodes confirmed minted (analogue endpoints):** `framework:Reverse Salient Analysis`, `framework:Four Lenses of Innovation`, and `framework:Systems Thinking` all exist as pws nodes. Wave 3's CROSS_DOMAIN_ANALOGUE edges (read from `data/cross-domain-analogues.json`) will NOT dangle.
- **All 27 framework nodes** come from the union of `command-registry.framework_index` (27 keys) + `connector-registry.framework_index` (25 keys) + the 3 distinct analogue endpoints; the union is exactly 27 (the analogue endpoints were already framework_index members).
- **Ranking inputs are already attached** to command/agent nodes under `node.ranking`; Wave 3 should widen this exposure (BOG-07) and add the CHAINS/FEEDS_INTO/PREREQUISITE edges (framework->framework, reach->reach) + the CROSS_DOMAIN_ANALOGUE edges. The `EDGE_TYPES` closed set in the generator currently lists only `OPERATES`; Wave 3 widens it.
- **The 6 frozen reach nodes** (incl `hats`) are present as `reach:` nodes; Wave 3's reach->reach chaining targets these.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - HARD-RULE] Em-dash literal in the RED test's em-dash detector**
- **Found during:** Task 2 (after the GREEN commit, during the cross-file em-dash sweep)
- **Issue:** `testNoEmDash()` in `lib/memory/orchestration-projection.test.cjs` used a literal `'—'` (U+2014) to detect em-dashes in the generator source. That literal made the test file itself contain an em-dash byte, violating the HARD RULE (no em-dashes anywhere).
- **Fix:** Replaced the literal with `String.fromCharCode(0x2014)` so the codepoint is referenced by escape and the test file stays em-dash-free. Test still passes and still detects em-dashes in the generator.
- **Files modified:** lib/memory/orchestration-projection.test.cjs
- **Commit:** 4ededc81 (bundled with the GREEN implementation)

No other deviations. The plan executed as written; all `must_have` truths and artifacts are satisfied.

## Authentication Gates

None. No auth, network, or external service was touched (Part 8/9: zero live Brain).

## Verification Evidence

- Generator runs: `Wrote data/brain-orchestration-projection.json (206 nodes, 49 edges)`.
- Unit tests: `orchestration-projection.test: 11/11 passed` (shape, tier-on-every-node, tier-assignment, derived-not-hand-authored, node-grain-count, frozen-reaches-including-hats, analogue-endpoints-minted, serialize-deterministic, operates-edges, no-brain-client-require, no-em-dash).
- Plan Task 2 `<automated>` verify: `nodes: 206 all tiered OK; hats present`.
- Boundary grep `brain-client|fetch(|require('http|curl` over the generator: 0 matches (BOG-09, Part 9).
- Em-dash sweep over all 5 touched files: none.
- Idempotency: re-running the generator produces a byte-identical artifact (no git drift).
- Regression: `data/command-registry.json` untouched (Phase 122 read-only); `build-connector-registry.cjs --check` still `connector-registry: OK`.

## Known Stubs

None. The OPERATES edge scaffold and the deferred CHAINS/FEEDS_INTO/PREREQUISITE/CROSS_DOMAIN_ANALOGUE edges are an explicit plan-scoped split (this plan delivers nodes + OPERATES scaffold; Plan 03 completes the typed-edge layer), not an unintended stub. `node.ranking` is populated on every command/agent node that has a connector; commands without a connector entry correctly omit it (the connector spine is the authoritative ranking source).

## Self-Check: PASSED

All 5 created files exist on disk; all 3 task commits (c8ce8171, ca66b7c7, 4ededc81) exist in git history.
