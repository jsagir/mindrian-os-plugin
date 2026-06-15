---
phase: 157-brain-orchestration-graph-and-methodology-tiers
plan: 03
subsystem: orchestration-projection
tags: [brain-orchestration-projection, typed-edges, closed-edge-set, ranking-inputs, BOG-05, BOG-07, part-8-boundary, part-9-local-cache, cross-domain-analogues]

# Dependency graph
requires:
  - phase: 157-02-orchestration-projection-generator
    provides: "scripts/build-orchestration-projection.cjs (206-node generator) + data/cross-domain-analogues.json + the kind-prefixed node id scheme + the OPERATES scaffold + the minted analogue-endpoint framework nodes"
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: "data/connector-registry.json (the reach_id/sub_mode/hierarchy_rank/posture/sensor_triggers ranking-input source) + the build-connector-registry.cjs frozen-bank + --check idiom mirrored here"
  - phase: 122-workflow-layer
    provides: "data/command-registry.json framework_index (the OPERATES source) + curated_chains (the chain source; EMPTY today)"
  - phase: 148-larryreach-selector-re-wire
    provides: "lib/core/sensors/sensor-types.cjs REACH_IDS (the frozen 6 reaches incl hats) reused for the reach nodes + rankReachesForProblem"
provides:
  - "ALLOWED_EDGE_TYPES = Object.freeze(new Set([OPERATES, CHAINS, FEEDS_INTO, PREREQUISITE, CROSS_DOMAIN_ANALOGUE])): the frozen CLOSED edge set (BOG-05)"
  - "addEdge(type, from, to) referential-integrity chokepoint (throws on undocumented type AND dangling endpoint, dedupes)"
  - "CROSS_DOMAIN_ANALOGUE edges (the two 150.10 pairs) + the source-empty chain layer + a top-level chain_layer_note making the empty layer legible"
  - "top-level ranking-input exposure (reach_id/sub_mode/hierarchy_rank/posture/sensor_triggers) + chain_provenance on every connector-derived mindrian-operation node (BOG-07)"
  - "rankReachesForProblem(projection, opts): a pure fixture query ranking candidate reaches from the projection ALONE"
  - "docs/ORCHESTRATION-PROJECTION-CONTRACT.md: the node schema + closed edge set + curated_chains->edge-type mapping + methodology_tier boundary-keeper rule + forward notes to Plans 04/05"
affects: [157-04, 157-05, brain-orchestration-projection-check, navigation-engine-cache-consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen-bank closed-set idiom (Object.freeze(new Set([...]))) mirroring sensor-types.REACH_IDS + navigation/edges.cjs ALLOWED_EDGE_TYPES; an addEdge chokepoint that THROWS (build error) rather than returns (the navigation/edges.cjs writeEdge returns because it validates runtime input; a generated artifact's malformed edge is a build failure)"
    - "curated_chains kind -> edge-type map (chain->CHAINS, feeds_into->FEEDS_INTO, prerequisite->PREREQUISITE); endpoint resolution to framework:<name> or reach:<id> with addEdge enforcing referential integrity"
    - "CEILING-not-floor closed set: only OPERATES (>=1/framework-command) + CROSS_DOMAIN_ANALOGUE (>=2) are hard floors; chaining is source-driven and legibly-empty via chain_layer_note"
    - "BOG-07 top-level ranking exposure + chain_provenance (framework->command->reach + firing sensors) so the deferred nav engine can RANK and EXPLAIN; name-only skills (D-01) exempt"
    - "newline join separator for the sort-then-split byte-stability pass (node ids contain spaces, never newlines)"

key-files:
  created:
    - docs/ORCHESTRATION-PROJECTION-CONTRACT.md
  modified:
    - scripts/build-orchestration-projection.cjs
    - lib/memory/orchestration-projection.test.cjs
    - data/brain-orchestration-projection.json

key-decisions:
  - "ALLOWED_EDGE_TYPES is the frozen closed set of EXACTLY five types; EDGE_TYPES retained as an array alias of the Set for the Plan 02 export surface. The addEdge chokepoint is the single emission door, so an undocumented type or a dangling endpoint can never reach the artifact."
  - "Ranking inputs exposed at the node TOP LEVEL (n.reach_id, n.hierarchy_rank, ...) per the plan's <automated> verify, with the Plan 02 node.ranking block RETAINED for backwards compatibility, and a new chain_provenance block (BOG-07 elevated: chain + sensor provenance)."
  - "curated_chains is EMPTY today -> ZERO chaining edges emitted + a top-level chain_layer_note (SOURCE-EMPTY, with the recovery action) so the empty layer is legible, never silent and never fabricated (honoring the plan-check note)."
  - "rankReachesForProblem ranks by best (lowest) hierarchy_rank wired to each reach, reach_id tie-break, all 6 frozen reaches always present (Infinity rank when un-wired), reading the projection ALONE (no registry, no Brain, no fs)."

metrics:
  duration: "18 min"
  completed: 2026-06-15
  tasks: 3
  files: 4
  edges_operates: 49
  edges_cross_domain_analogue: 2
  edges_chaining: 0
  nodes_with_ranking_inputs: 56
---

# Phase 157 Plan 03: Closed Typed-Edge Set + Ranking-Input Exposure Summary

Wave 3 completes the orchestration-projection typed-edge layer and the BOG-07 ranking-input exposure. The generator now emits the documented CLOSED set of edge types (a frozen `ALLOWED_EDGE_TYPES` of exactly OPERATES, CHAINS, FEEDS_INTO, PREREQUISITE, CROSS_DOMAIN_ANALOGUE), guarded by an `addEdge` referential-integrity chokepoint that throws on an undocumented type or a dangling endpoint. Every connector-derived `mindrian-operation` node now carries its ranking inputs at the top level plus a `chain_provenance` block (framework -> command -> reach + firing sensors), and a pure `rankReachesForProblem` helper proves a fixture query can rank candidate reaches from the projection alone. The contract doc documents the schema, the closed edge set, the `curated_chains`->edge-type mapping, and the `methodology_tier` boundary-keeper rule.

## What Was Built

### Task 1: the closed typed-edge set (BOG-05)
- `ALLOWED_EDGE_TYPES = Object.freeze(new Set([OPERATES, CHAINS, FEEDS_INTO, PREREQUISITE, CROSS_DOMAIN_ANALOGUE]))` -- exactly these five, mirroring the frozen-bank idiom of `lib/core/sensors/sensor-types.cjs` `REACH_IDS` and `lib/core/navigation/edges.cjs` `ALLOWED_EDGE_TYPES`. `EDGE_TYPES` retained as an array alias for the Plan 02 export surface.
- `makeAddEdge(nodeIds, edges, seen)` returns the `addEdge(type, from, to)` chokepoint: THROWS if `type` is not in the set, THROWS if `from` or `to` is absent from `nodes[]` (referential integrity), dedupes on `(type, from, to)`. It throws (build error) where the room-graph `writeEdge` returns (runtime input validation).
- OPERATES (49): command -> framework, promoted from both registries' `framework_index` inverse maps, collected + sorted + emitted through `addEdge`.
- CROSS_DOMAIN_ANALOGUE (2): one edge per `data/cross-domain-analogues.json` pair -- `Systems Thinking <-> Reverse Salient Analysis` and `Systems Thinking <-> Four Lenses of Innovation` (the 150.10 seeds). The endpoints are minted framework nodes (Wave 2), so they resolve, not dangle.
- CHAINS / FEEDS_INTO / PREREQUISITE (0): emitted from `command-registry.curated_chains` via the `chain|feeds_into|prerequisite` kind map. `curated_chains` is EMPTY today, so ZERO chaining edges are emitted. A top-level `chain_layer_note` states the chain layer is SOURCE-EMPTY pending a populated `curated_chains`, with the recovery action -- the empty layer is legible, never silent, never fabricated.

### Task 2: ranking-input exposure + the fixture reach-ranking query (BOG-07)
- `buildOperationNode(id, kind, name, conn)` exposes every connector-derived command/agent node's ranking inputs at the TOP LEVEL: `reach_id`, `sub_mode`, `hierarchy_rank`, `posture`, `sensor_triggers`, `framework` (enum/scalar verbatim from the connector; Part 8 generic machinery, never user content). It also attaches a `chain_provenance` block (`{ framework, command, reach_id, sub_mode, firing_sensors }`) so a why-block / rejection-reason can cite the FULL chain, not just score signals (BOG-07 elevated). The Plan 02 `node.ranking` block is retained for backwards compatibility. 56 connector-derived nodes carry the ranking surface; name-only skill nodes (D-01) carry none (exempt).
- `rankReachesForProblem(projection, { problemType, stage })` -- a PURE helper reading ONLY the projection (no registry, no Brain, no fs). Ranks the 6 frozen reaches by best (lowest) `hierarchy_rank` of any wired `mindrian-operation` node, `reach_id` ascending tie-break, all reaches present (Infinity when un-wired). Deterministic across rebuilds. Proves the BOG-07 acceptance ("a fixture query can rank candidate reaches from the projection alone").

### Task 3: the contract doc
`docs/ORCHESTRATION-PROJECTION-CONTRACT.md` (a sibling of `docs/CONNECTOR-CONTRACT.md`) documents: the GENERATED Brain-derived LOCAL cache framing (Part 9, zero live Brain I/O, never edit by hand); the node schema + kind-prefixed id scheme + the BOG-07 ranking-input fields; the CLOSED 5-edge set with each edge's meaning + direction + source + the `curated_chains`->edge-type mapping + the CEILING-not-floor + `chain_layer_note` rule; the `methodology_tier` boundary-keeper rule (framework=pws, machinery=mindrian-operation; the Part-8 legibility marker); forward notes to the Plan 04 `--check` tripwire (STALE / UN-WIRED / UN-RANKED, incl the name-only-skill exemption + `chain_layer_note` presence) and the Plan 05 boundary scan; canon anchors (Part 8 dual-role + Appendix D entry 19, Part 9, Part 7).

## Final Edge Counts by Type

| Edge type | Count | Floor | Notes |
|-----------|-------|-------|-------|
| OPERATES | 49 | >=1 per framework-command (HARD) | command -> framework, both framework_index maps |
| CROSS_DOMAIN_ANALOGUE | 2 | >=2 (HARD) | the two 150.10 seed pairs |
| CHAINS | 0 | none (CEILING) | curated_chains source-empty |
| FEEDS_INTO | 0 | none (CEILING) | curated_chains source-empty |
| PREREQUISITE | 0 | none (CEILING) | curated_chains source-empty |

`chain_layer_note` present, flagged SOURCE-EMPTY. 56 nodes expose top-level ranking inputs. Zero dangling edges. 206 nodes unchanged from Wave 2 (this plan adds the edge layer + node ranking exposure, not new nodes).

## Wave 4 Handoff (the --check tripwire)

- **UN-RANKED assertion:** the 56 connector-derived `mindrian-operation` nodes carry top-level `reach_id` + `sub_mode` + `hierarchy_rank` + `posture` + `sensor_triggers` + `chain_provenance`. Plan 04's UN-RANKED check should target a connector-DECLARING node stripped of these fields, and must NOT flag a name-only skill node (D-01): skills are exempt by design (no connector frontmatter -> no ranking fields -> legal). The `--check` must distinguish "connector-declaring but missing ranking" (a failure) from "name-only skill, no connector" (legal exemption).
- **generated_note / chain_layer_note presence:** the projection now carries TWO top-level note strings: `generated_note` (the do-not-edit-by-hand marker, from Wave 2) AND `chain_layer_note` (the SOURCE-EMPTY chain-layer marker, new this plan). Plan 04 can assert `chain_layer_note` presence as the legible-empty-layer marker; when `curated_chains` becomes populated, the note text changes to reflect the emitted count (it is always a non-empty string).
- **Closed edge set as the assertion floor:** Plan 04's `--check` regenerates in memory and byte-compares; it should also assert every emitted edge type is in `ALLOWED_EDGE_TYPES` (the generator already guarantees this via the addEdge chokepoint, so a STALE committed artifact with a stray type is impossible unless hand-edited).
- **The addEdge chokepoint is the referential-integrity guarantee:** Plan 04 does not need to re-validate dangling edges in the committed artifact for a CLEAN repo, because the generator cannot emit one; the STALE check (byte-compare against a fresh regenerate) is what catches a hand-edited artifact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NUL-byte edge-pair separator inherited from the Plan 02 OPERATES scaffold**
- **Found during:** Task 1 (when grep reported the generator source as "binary data" and the Edit tool's exact-match failed on the OPERATES block).
- **Issue:** The Plan 02 OPERATES scaffold joined edge endpoints with a separator that was a literal NUL byte (`'\0'`) baked into the source string (4 NUL bytes total across the generator), not the intended space. The NUL made the file register as binary to grep/`file`. It was latent-harmless for OPERATES (both join + split used the same NUL, and framework names never contain NUL), but it is genuinely wrong: re-typing the separator as a space would then collide with the spaces INSIDE framework names like `Jobs to Be Done (JTBD)` (the very first regenerate after the naive fix threw `dangling edge endpoint (to) "framework:Jobs"`).
- **Fix:** Swept all 4 NUL bytes out of the generator source (Node read/replace, latin1-safe). Replaced the sort-then-split separator with a NEWLINE (`'\n'`): node ids contain spaces but can never contain a newline, so `indexOf('\n')` + `slice` is a corruption-proof split. The `seen` dedup key in `makeAddEdge` was also moved to newline-joined for consistency.
- **Files modified:** scripts/build-orchestration-projection.cjs
- **Commit:** 29c1f063 (bundled with the Task 1 + Task 2 implementation)

No other deviations. Tasks 1 and 2 (both `tdd="true"`) landed as one cohesive generator change to the same three files, so they were committed together as one atomic feat commit referencing 157-03; Task 3 (the doc) is a separate docs commit.

## Authentication Gates

None. No auth, network, or external service was touched (Part 8/9: zero live Brain; verified no `brain-client` require / `fetch` / `http` in the generator).

## Verification Evidence

- Generator: `Wrote data/brain-orchestration-projection.json (206 nodes, 51 edges)`.
- Unit tests: `orchestration-projection.test: 21/21 passed` (the Wave 2 11 + 10 new: closed-edge-set, only-closed-types-emitted, referential-integrity, add-edge-chokepoint-throws, cross-domain-analogue-edges, chain-layer-source-empty-note, ranking-inputs-exposed, chain-and-sensor-provenance, name-only-skills-carry-no-ranking, rank-reaches-from-projection-alone).
- Plan Task 1 `<automated>` verify: `edges OK OPERATES=49 XDA=2` (only the 5 closed types; zero dangling).
- Plan Task 2 `<automated>` verify: `ranking inputs exposed on 56 nodes`.
- Plan Task 3 `<automated>` verify: file exists; 12 edge-type mentions; 8 methodology_tier mentions; 4 local-cache mentions; 0 em-dashes.
- Idempotency: re-running the generator produces a byte-identical artifact (md5 stable).
- Em-dash + NUL sweep over all 4 touched files: zero of each.
- Regression: `build-connector-registry.cjs --check` -> `connector-registry: OK`; `tests/run-all-148.sh` -> Failed: 0 (frozen banks intact); `data/command-registry.json` untouched (Phase 122 read-only); `lib/core/sensors/sensor-types.cjs` + `lib/core/navigation/edges.cjs` untouched (frozen-148 constants + the room-graph edge bank are NOT in any 157-03 commit).

## Known Stubs

None. The zero chaining edges are an explicit source-empty state (curated_chains is `[]`), made legible by `chain_layer_note`, NOT a stub -- the plan-check note mandates emitting zero + the note rather than fabricating chain edges. When `curated_chains` is populated, the same generator materializes the chain layer with no code change.

## Threat Flags

None. Every node field and every edge is generic machinery metadata (command slug, reach_id, sub_mode, framework name, methodology_tier, ranking enum/scalar, SENS id) or one of the five closed edge types between two node ids. No new network endpoint, no auth path, no file-access pattern, no schema change at a trust boundary. The projection introduces no surface beyond the Part 8 dual-role amendment already sanctioned in Wave 1.

## Self-Check: PASSED

- `docs/ORCHESTRATION-PROJECTION-CONTRACT.md` exists (FOUND).
- `scripts/build-orchestration-projection.cjs`, `lib/memory/orchestration-projection.test.cjs`, `data/brain-orchestration-projection.json` exist + modified (FOUND).
- Commit 29c1f063 (feat: typed-edge set + ranking exposure) exists in git history (FOUND).
- Commit d57696db (docs: contract doc) exists in git history (FOUND).
