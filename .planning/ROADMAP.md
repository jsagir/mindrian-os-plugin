# Roadmap: MindrianOS v1.9.0 Whitespace Mapping Power Tool

## Overview

Build a SemNovel-inspired whitespace detection system that finds what's MISSING in a venture's understanding. Starting from embedding infrastructure (llm-embedder + Brain consensus baseline), through density-based gap detection and novelty scoring, to a methodology-aware interpretation layer that classifies gaps by problem type and generates hypotheses through Brain framework chains. TopicForest hierarchical clustering provides a complementary tree view of coverage gaps. Pipeline integration chains whitespace with HSI, RS, and Analogy for a complete Discovery Cycle. Brain learns cross-room whitespace patterns. The /mos:whitespace command and D3.js density map make it all actionable.

## Milestones

<details>
<summary>v1.0 through v6.2 (Phases 1-51) - SHIPPED</summary>

- v1.0 MVP (Phases 1-5, shipped 2026-03-22)
- v2.0 Meeting Intelligence (Phases 6-9, shipped 2026-03-24)
- v3.0 MCP Platform (Phases 10-19, shipped 2026-03-25)
- v4.0 Brain API & CLI UI (Phases 20-25, shipped 2026-03-29)
- v5.0 Presentation System (Phases 26-33, shipped 2026-03-31)
- v5.1 User Outlets (Phases 34-38, shipped 2026-03-31)
- v1.6.0 Powerhouse (Phases 39-46, shipped 2026-03-31)
- v6.2 RoomHub + SnapshotHub (Phases 47-51, shipped 2026-04-01)

</details>

<details>
<summary>v1.8.6 MindrianRooms (Phases 56-59.2) - SHIPPED 2026-04-06</summary>

6 phases, 35 requirements. Centralized rooms under ~/MindrianRooms/, wicked hierarchy navigator, dual-graph layer (KuzuDB + Neo4j Brain).

</details>

<details>
<summary>v1.9.0-parked Context Engineering (Phases 60-63) - PARKED</summary>

Context engineering optimization parked due to intelligence tradeoff concern. Full Intelligence must remain the default. Phase directories archived at .planning/phases/60-63 with original names.

</details>

### v1.9.0 Whitespace Mapping Power Tool (In Progress)

**Milestone Goal:** Detect what's MISSING in a venture's understanding using SemNovel embedding-distance novelty scoring, TopicForest hierarchical gap detection, and Brain methodology-aware interpretation -- codified for innovation opportunity whitespace mapping.

## Phases

**Note:** Phase numbers 60-66 reuse the 60+ range. Old context engineering directories (60-63) are archived/parked.

- [x] **Phase 60: Embedding Infrastructure** - Embed room artifacts and Brain baseline into shared 768-dim semantic space using llm-embedder (completed 2026-04-08)
- [x] **Phase 61: Novelty Scoring & Gap Detection** - Density estimation, whitespace zone identification, novelty scoring, and KuzuDB storage (completed 2026-04-08)
- [x] **Phase 62: Interpretation Layer** - Problem type classification, framework chain selection, and methodology-aware hypothesis generation (the moat) (completed 2026-04-08)
- [x] **Phase 63: TopicForest Hierarchical Clustering** - Agglomerative topic tree with recursive Claude labeling to find sparse branches (completed 2026-04-08)
- [ ] **Phase 64: Pipeline Integration** - Chain whitespace with HSI, RS, and Analogy into a Discovery Cycle
- [ ] **Phase 65: Brain Intelligence Layer** - Write whitespace patterns to Neo4j Brain and enable cross-room learning
- [ ] **Phase 66: Command, Visualization & External Corpus** - /mos:whitespace command, D3.js density map, and Semantic Scholar integration

## Phase Details

### Phase 60: Embedding Infrastructure
**Goal**: Room artifacts and Brain methodology descriptions exist as comparable vectors in the same 768-dim semantic space
**Depends on**: Nothing (first phase of milestone)
**Requirements**: EMBED-01, EMBED-02
**Success Criteria** (what must be TRUE):
  1. Running the whitespace embedder on a room produces cached 768-dim vectors for every artifact using BAAI/llm-embedder (with MiniLM fallback for Tier 0)
  2. Brain methodology/framework descriptions are embedded and cached as a local JSON "consensus baseline" file
  3. Room artifact embeddings and Brain baseline embeddings can be loaded together for downstream computation (same dimensionality, cosine-comparable)
**Plans:** 2/2 plans complete
Plans:
- [x] 60-01-PLAN.md - Room artifact embedding script with llm-embedder + MiniLM fallback
- [ ] 60-02-PLAN.md - Brain baseline embedding + cosine compatibility verification

### Phase 61: Novelty Scoring & Gap Detection
**Goal**: The system identifies low-density whitespace zones where room understanding is missing and scores every artifact by novelty
**Depends on**: Phase 60
**Requirements**: EMBED-03, EMBED-04, OUT-03, OUT-04, OUT-05
**Success Criteria** (what must be TRUE):
  1. UMAP reduces 768-dim embeddings to 15-dim for density estimation, and KDE identifies low-density regions in the room's embedding space
  2. Brain-covered regions with zero room artifact coverage are detected and ranked by strategic importance (RS bottleneck integration)
  3. Every filed artifact receives a novelty score (embedding distance from Brain consensus) that replaces Jaccard-based scoring
  4. Detected whitespace zones are persisted as KuzuDB WhitespaceZone nodes with density_score, nearest_frameworks, hypothesis, strategic_rank, problem_type, and exploration_status
  5. Per-section WHITESPACE.md files written to each room section folder showing detected gaps relevant to that section
**Plans:** 3/3 plans complete
Plans:
- [x] 61-01-PLAN.md - UMAP + KDE density estimation, gap detection, SemNovel novelty scoring
- [x] 61-02-PLAN.md - KuzuDB WhitespaceZone schema + bridge script
- [ ] 61-03-PLAN.md - Per-section WHITESPACE.md ICM-native gap files

### Phase 62: Interpretation Layer
**Goal**: Each whitespace zone is classified by problem type and filled with methodology-aware hypotheses generated through Brain framework chains -- this is the moat
**Depends on**: Phase 61
**Requirements**: INTERP-01, INTERP-02, INTERP-03
**Success Criteria** (what must be TRUE):
  1. Each whitespace zone is classified as Ill-Defined, Well-Defined, Wicked, or Un-Defined using Brain's problem taxonomy and nearest framework context
  2. For each classified gap, a framework chain is selected using Brain's FEEDS_INTO edges and effectiveness scores to sequence the exploration methodology
  3. Larry generates hypotheses that run THROUGH the selected framework chain (methodology-contextualized, not generic prompting) for each whitespace zone
**Plans:** 2/2 plans complete
Plans:
- [x] 62-01-PLAN.md - Problem type classification + framework chain selection engine (interpret-whitespace.cjs)
- [x] 62-02-PLAN.md - Three-gate validation, hypothesis prompt builder, KuzuDB + WHITESPACE.md integration

### Phase 63: TopicForest Hierarchical Clustering
**Goal**: Users can see a hierarchical topic tree showing which branches of understanding have zero coverage at multiple granularity levels
**Depends on**: Phase 60
**Requirements**: INTERP-04
**Success Criteria** (what must be TRUE):
  1. Agglomerative clustering with binary partitioning builds a topic tree from room + Brain embeddings
  2. Claude recursively labels clusters from leaf to root, producing human-readable topic names at every tree level
  3. Sparse branches (Brain nodes present, zero room artifact nodes) are identified as whitespace zones at multiple granularity levels
**Plans:** 2/2 plans complete
Plans:
- [x] 63-01-PLAN.md -- Python clustering engine with corpus size routing (taxonomy/<20, HDBSCAN/20-50, TopicForest/50+)
- [x] 63-02-PLAN.md -- Claude recursive labeling + WHITESPACE.md hierarchical context integration

### Phase 64: Pipeline Integration
**Goal**: Whitespace detection chains with HSI, RS, and Analogy to form a complete Discovery Cycle that finds gaps humans miss
**Depends on**: Phase 61, Phase 62
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04
**Success Criteria** (what must be TRUE):
  1. After HSI finds surprising artifact pairs, whitespace automatically maps what's BETWEEN them (the missing connecting artifact)
  2. After RS finds a bottleneck section, whitespace maps empty territory DOWNSTREAM of each bottleneck
  3. After Analogy maps cross-domain transfer, whitespace identifies where causal/structural transfer hasn't been articulated
  4. The full Discovery Cycle (HSI -> Whitespace -> RS -> Analogy) can run as a chained sequence via /mos:whitespace discover command
**Plans:** 1/2 plans executed
Plans:
- [x] 64-01-PLAN.md -- HSI-seeded, RS-seeded, and Analogy-seeded whitespace detection scripts
- [ ] 64-02-PLAN.md -- Discovery Cycle orchestrator with chained execution and dry-run validation

### Phase 65: Brain Intelligence Layer
**Goal**: The Brain learns from whitespace discoveries across all rooms, enabling "what gaps did similar ventures find?" intelligence
**Depends on**: Phase 61, Phase 62
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04
**Success Criteria** (what must be TRUE):
  1. WhitespaceZone nodes are written to Neo4j Brain linked to the Framework chains that explored them
  2. Cross-room whitespace patterns are tracked in Brain (anonymized) so the Brain learns which gap types are real opportunities vs noise
  3. TYPICAL_WHITESPACE edges connect ProblemType nodes to common whitespace patterns discovered across rooms
  4. Brain queries return actionable intelligence: "what gaps did similar ventures find?" and "which framework chains resolved similar whitespace?"
**Plans**: TBD

### Phase 66: Command, Visualization & External Corpus
**Goal**: Users interact with whitespace through a full command interface, see density maps in the dashboard, and can expand detection to external literature
**Depends on**: Phase 61, Phase 62, Phase 63
**Requirements**: OUT-01, OUT-02, EMBED-05
**Success Criteria** (what must be TRUE):
  1. /mos:whitespace command works with subcommands: map, analyze, hypothesis, tree, score, external, compare
  2. De Stijl dashboard shows a D3.js density map (UMAP 2D scatter + KDE contours) with Brain baseline reference markers and a TopicForest tree overlay
  3. External corpus mode queries Semantic Scholar API, embeds results into the same semantic space, and detects cross-domain whitespace
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 60 -> 61 -> 62 -> 63 -> 64 -> 65 -> 66
Note: Phase 63 depends only on Phase 60, so it can run in parallel with Phase 61-62 if desired.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 60. Embedding Infrastructure | v1.9.0 | 2/2 | Complete    | 2026-04-08 |
| 61. Novelty Scoring & Gap Detection | v1.9.0 | 2/3 | Complete    | 2026-04-08 |
| 62. Interpretation Layer | v1.9.0 | 2/2 | Complete    | 2026-04-08 |
| 63. TopicForest Hierarchical Clustering | v1.9.0 | 2/2 | Complete    | 2026-04-08 |
| 64. Pipeline Integration | v1.9.0 | 1/2 | In Progress|  |
| 65. Brain Intelligence Layer | v1.9.0 | 0/TBD | Not started | - |
| 66. Command, Visualization & External Corpus | v1.9.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-08*
*Last updated: 2026-04-08*
