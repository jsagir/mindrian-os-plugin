# Roadmap: MindrianOS Plugin v1.7.0 Causal Reasoning Layer

## Milestones

<details>
<summary>Previous milestones (Phases 1-51) -- SHIPPED</summary>

- v1.0 MVP (Phases 1-5) -- shipped 2026-03-22
- v2.0 Meeting Intelligence (Phases 6-9) -- shipped 2026-03-24
- v3.0 MCP Platform (Phases 10-19) -- shipped 2026-03-25
- v4.0 Brain API & CLI UI (Phases 20-25) -- shipped 2026-03-29
- v5.0 Presentation System (Phases 26-33) -- shipped 2026-03-31
- v5.1 User Outlets (Phases 34-38) -- shipped 2026-03-31
- v1.6.0 Powerhouse (Phases 39-46) -- shipped 2026-03-31
- v6.2 RoomHub + SnapshotHub (Phases 47-51) -- shipped 2026-04-01

</details>

### v1.7.0 Causal Reasoning Layer (In Progress)

**Milestone Goal:** Larry can trace cause-effect chains, detect assumption cascades, surface bottlenecks through graph structure, and track falsifiable predictions -- enabling "because...because...because" reasoning across the Data Room.

## Phases

- [ ] **Phase 52: Causal Schema + Brain Enrichment** - KuzuDB CausalClaim schema and Neo4j causal framework wiring (parallel targets)
- [ ] **Phase 53: Causal Extraction** - Larry extracts cause/mechanism/effect triples from room artifacts with provenance and Three Gaps enforcement
- [ ] **Phase 54: Graph Engine** - NetworkX algorithms for chain traversal, cascade simulation, bottleneck detection, contradiction detection, and cross-reference linking
- [ ] **Phase 55: Post-Write Integration + Prediction Registry** - Causal candidate flagging in post-write cascade and falsifiable prediction tracking with closed-loop learning
- [ ] **Phase 56: Command + Larry Wiring** - /mos:causal command, Brain directives, Larry personality JTBD, and proactive discovery surfacing
- [ ] **Phase 57: Release** - CHANGELOG, version bump, schema docs

## Phase Details

### Phase 52: Causal Schema + Brain Enrichment
**Goal**: The causal data model exists in KuzuDB and the Brain's causal framework family is wired with traversable edges
**Depends on**: Phase 51 (v6.2 SnapshotHub)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06, BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04, BRAIN-05, BRAIN-06, BRAIN-07
**Success Criteria** (what must be TRUE):
  1. Running initSchema() on an existing .lazygraph database adds CausalClaim node table and CAUSES, CASCADES_TO, EXTRACTED_FROM edge tables without destroying existing data
  2. graphStats() reports CausalClaim count and causal edge counts alongside existing node/edge stats
  3. KuzuDB bounded path queries on CausalClaim chains return correct results without hanging (tested with intentional cycle data, CJS-side deduplication)
  4. Brain query for "causal frameworks" returns Theory of Change, Root Cause Analysis, Systems Thinking, Causal Loop Diagrams connected via FEEDS_INTO chain with TYPICAL_AT stage mappings
  5. Brain query patterns 11-13 (causal_framework_select, causal_pattern_match, causal_contradiction_resolve) return valid results
**Plans**: 2 plans
Plans:
- [ ] 52-01-PLAN.md -- KuzuDB CausalClaim schema extension (SCHEMA-01 through SCHEMA-06)
- [ ] 52-02-PLAN.md -- Brain causal framework enrichment + query patterns 11-13 (BRAIN-01 through BRAIN-07)

### Phase 53: Causal Extraction
**Goal**: Larry can extract structured causal claims from any room artifact with provenance tracking and quality enforcement
**Depends on**: Phase 52
**Requirements**: EXTRACT-01, EXTRACT-02, EXTRACT-03, EXTRACT-04, EXTRACT-05, EXTRACT-06
**Success Criteria** (what must be TRUE):
  1. Running /mos:causal extract on a room artifact produces cause/mechanism/effect triples stored as CausalClaim nodes in KuzuDB with EXTRACTED_FROM edges linking back to the source artifact
  2. Each extracted claim has confidence scored by method: observed=0.7, asserted=0.5, inferred=0.3
  3. Extraction caps at 5 claims per artifact and every claim includes an explicit mechanism and falsifiable prediction (Three Gaps)
  4. Claims are classified into one of 7 domains (materials, business, competitive, financial, team, legal, general)
**Plans**: TBD

### Phase 54: Graph Engine
**Goal**: The system can traverse causal chains, simulate cascades, detect bottlenecks and contradictions, and cross-reference causal claims with existing HSI/RS/Analogy edges
**Depends on**: Phase 53
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04, ENGINE-05, ENGINE-06, ENGINE-07, ENGINE-08
**Success Criteria** (what must be TRUE):
  1. /mos:causal trace on a claim shows the full "because...because...because" chain up to 6 hops via NetworkX all_simple_paths
  2. Cascade simulation shows "if X is wrong, what falls?" with confidence decaying multiplicatively per hop
  3. Bottleneck detection surfaces high-centrality, low-out-degree CausalClaim nodes that the user did not explicitly ask about
  4. Contradiction detection catches circular reasoning (A causes B causes C causes A) and reports the cycle
  5. Cross-reference queries show which HSI pairs have causal explanations, which reverse salients have causal chains, and which analogies match causal structure
**Plans**: 3 plans
Plans:
- [ ] 54-01-PLAN.md -- CJS export function, CASCADES_TO edge creation, test seed data (ENGINE-01, ENGINE-02)
- [ ] 54-02-PLAN.md -- Python NetworkX engine with 5 algorithms (ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04, ENGINE-08)
- [ ] 54-03-PLAN.md -- Cross-reference Cypher queries + results bridge (ENGINE-05, ENGINE-06, ENGINE-07)

### Phase 55: Post-Write Integration + Prediction Registry
**Goal**: Causal candidates are automatically flagged after artifact filing, and users can generate and track falsifiable predictions with closed-loop confidence updates
**Depends on**: Phase 54
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, PREDICT-01, PREDICT-02, PREDICT-03, PREDICT-04, PREDICT-05, PREDICT-06, ENGINE-09
**Success Criteria** (what must be TRUE):
  1. Filing a new artifact triggers causal candidate flagging (regex heuristic) that produces .causal-candidates.json without blocking the post-write cascade
  2. Running /mos:causal extract on flagged candidates writes confirmed claims to KuzuDB via CJS bridge, then cross-reference step links them to existing HSI/RS/Analogy edges
  3. /mos:causal predict generates falsifiable predictions with deadlines, stored in room/.predictions/REGISTRY.json with lifecycle: pending -> confirmed/refuted/expired
  4. Larry proactively prompts for prediction resolution when deadlines pass (session-start or every 5th session)
  5. Resolving a prediction propagates confidence updates back to source CausalClaim nodes in KuzuDB, and prediction summary shows hit rate and overdue count
**Plans**: 3 plans
Plans:
- [ ] 55-01-PLAN.md -- Post-write causal candidate flagging + confirm-to-KuzuDB bridge (HOOK-01, HOOK-02, HOOK-03, HOOK-04)
- [ ] 55-02-PLAN.md -- Prediction registry CRUD, /mos:causal predict command, session-start overdue check (PREDICT-01 through PREDICT-06)
- [ ] 55-03-PLAN.md -- Research-backed examples via analogy engine (ENGINE-09)

### Phase 56: Command + Larry Wiring
**Goal**: Users interact with the full causal layer through /mos:causal and Larry naturally suggests causal reasoning when assumptions stack up
**Depends on**: Phase 55
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, CMD-06
**Success Criteria** (what must be TRUE):
  1. /mos:causal command works with all 3 subcommands: extract (run extraction), trace (chain + cascade + bottleneck + contradiction), predict (generate + track predictions)
  2. Brain causal directives document exists at references/brain/causal-directives.md and Larry references Three Gaps framework during extraction
  3. Larry personality suggests /mos:causal commands at contextually appropriate moments ("When assumptions stack 3-deep, try /mos:causal trace cascade")
  4. Room-proactive intelligence surfaces discoveries when the graph has converging causal + HSI + RS + analogy edges
  5. Causal schema reference document at references/causal/causal-schema.md provides Cypher query context for Brain and Larry
**Plans**: TBD

### Phase 57: Release
**Goal**: v1.7.0 is versioned, documented, and ready for users
**Depends on**: Phase 56
**Requirements**: REL-01, REL-02, REL-03
**Success Criteria** (what must be TRUE):
  1. CHANGELOG.md has a v1.7.0 entry with onboarding steps explaining how to use /mos:causal
  2. plugin.json version reads 1.7.0
  3. docs/lazygraph-schema.md includes a causal section documenting CausalClaim, CAUSES, CASCADES_TO, and EXTRACTED_FROM
**Plans**: TBD

## Progress

**Execution Order:** 52 -> 53 -> 54 -> 55 -> 56 -> 57

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 52. Causal Schema + Brain Enrichment | v1.7.0 | 0/2 | Planning complete | - |
| 53. Causal Extraction | v1.7.0 | 0/TBD | Not started | - |
| 54. Graph Engine | v1.7.0 | 0/3 | Planning complete | - |
| 55. Post-Write Integration + Prediction Registry | v1.7.0 | 0/3 | Planning complete | - |
| 56. Command + Larry Wiring | v1.7.0 | 0/TBD | Not started | - |
| 57. Release | v1.7.0 | 0/TBD | Not started | - |

## Dependency Chain

```
Phase 52 (Schema + Brain) --> Phase 53 (Extraction)
Phase 53 (Extraction) --> Phase 54 (Graph Engine)
Phase 54 (Graph Engine) --> Phase 55 (Post-Write + Predictions)
Phase 55 (Post-Write + Predictions) --> Phase 56 (Command + Larry)
Phase 56 (Command + Larry) --> Phase 57 (Release)
```
