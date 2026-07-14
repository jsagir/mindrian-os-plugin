# SEED-049 - The Mindrian EUREKA Engine (tri-modal room.db + tri-source hybrid retrieval, one engine many lenses)

> Framing (navigator, 2026-07-02): these are **EUREKA engines** - breakthrough DISCOVERY, "find the gem nobody saw" - NOT "intelligence" engines. The name is the point: the output is a eureka (a measured, defensible cross-domain opportunity), not a generic intelligence readout.

**Registered:** 2026-07-02 (navigator-directed; agno-docs-mcp trigger + tri-source vision)
**Class:** CODE + ARCH | **Status:** mostly shipped (verified 2026-07-14: Phases 211, 212, 214, 215, 216 all COMPLETE per ROADMAP.md; Phase 213 "THE KEY," the reach-wiring phase, is 5/6 plans done -- only 213-06 (run-all-213 aggregator + human-verify probe) remains, explicitly gated on the curing-sequence debug track resolving. This file previously said "seed"; corrected, but do not mark fully shipped until 213-06 clears.)
**Grounding:** agno-docs-mcp (https://github.com/CENFARG/agno-docs-mcp) as the FTS5/BM25 reference; live runtime verification (node v22.22.2, node:sqlite, SQLite 3.51.2 - FTS5 available, extension-loading available); Tavily research 2026-07-02 (the proven 2025-2026 local-hybrid-RAG stack). Reconciles the existing cluster: SEED-029 (local vector spine, graduated -> Phase 161), SEED-030 (RS spine + expert-graph, open), SEED-024 (Brain orchestration graph), SEED-048 (portfolio FUSION), SEED-008 (close-the-loop), SEED-013 (no-Python-on-user, graduated -> Phase 134). Consumer phases: 89/200 (RS), 164 (BONO), 143 (Insight Sensors), 203 (synthetic expert).

## The vision (navigator, 2026-07-02)

ONE surface-agnostic intelligence engine - a `lib/core` module every embedding/graph-using surface calls (commands, MCP tools, agents, pipelines, skills). Today each of the RS family, HSI, whitespace, find-analogies, find-connections, explore-domains, macro-trends, BONO reimplements its own retrieval/scoring separately. This extracts the shared semantic engine into ONE governed path (Canon Part 11) and makes them consumers. The retrieval is common; the LENS differs (RS = "what lags," analogies = "what's isomorphic across a domain gap," whitespace = "what's absent," HSI = "score cross-domain novelty," BONO = "debate the tension"). Build the engine once; the Part-8 fence lives in it once.

Flagship flow: cross-domain analysis + live research -> reverse-salient bottleneck -> new opportunity.

## The core EUREKA primitive (reverse-engineered from the live RS/HSI/cross-domain pipeline, navigator 2026-07-02)

Every score in the current cross-domain analysis - the differentials, the reverse salients, the cross-domain pairs, the HSI surprises - is ONE formula run over different text pairs. There is really only one function, called many times:

```javascript
differential(lexical, semantic, sentiment) = (semantic + sentiment) / 2 - lexical
```

High score = **two things that MEAN the same but do NOT share vocabulary** - a problem and a solution describing the same underlying function in totally different words. That is the cross-domain opportunity signal. (`Semantic 1.00, Lexical 0.13` = "functionally identical, lexically unconnected - nobody has linked them yet.") A threshold ladder labels it (`>0.5 Breakthrough / >0.3 High / >0.1 Moderate`), and every report section (reverse-salients, cross-domain, expansion, tech-market, competitive) is the SAME `differential()` over different problem x solution arrays.

The three inputs, and the load-bearing weakness:

- **lexical** = vocabulary overlap (Jaccard, or better BM25/FTS5) - real, reproducible, cheap. THIS is where the AGNO method lives: FTS5 + BM25 in-SQLite, no Python (the agno-docs-mcp lesson). It does double duty - the lexical leg of hybrid RETRIEVAL (BM25 + vector -> RRF) AND the lexical side of the DIFFERENTIAL. The eureka is precisely `bert-high, lexical-LOW`, so agno's leg measures the very half whose ABSENCE (low vocabulary overlap while meaning is high) defines the breakthrough. The agno pebble became the measurement of the gap that IS the eureka.
- **semantic + sentiment** = TODAY these are the MODEL's judgment, NOT measured - the code's `haveSimilarFunction` / `calculateValueOverlap` are undefined stubs filled in by the model reading two phrases. So the rankings are meaningful; **the decimals are decorative.**

**This is precisely the gap SEED-049 closes - and the reverse-engineering names the exact fix:** "swap `haveSimilarFunction` for real embeddings (cosine over sentence-transformer vectors), and every number becomes something you could recompute and defend." That IS the tri-modal engine: transformers.js embeddings make `semantic` a MEASURED cosine, FTS5/Jaccard makes `lexical` real. The engine turns the Eureka methodology from sound-but-unmeasured into sound-AND-reproducible. The methodology is already right; the engine supplies the missing measured semantics.

Genuinely rich ideas to KEEP (now made real by the engine, each a LENS on the same retrieval):

- **The surprise gap (HSI):** `surprise = bert_sim(a,b) - lsa_sim(a,b)` - deep contextual similarity minus shallow bag-of-words similarity. A big positive gap = "keyword matching MISSED a deep connection" = the eureka. The tri-modal engine supplies BOTH legs natively: transformers.js embeddings (the deep/BERT side) and FTS5/BM25 or a CJS LSA/SVD (the shallow side). The "+0.193 after research" delta = score, run Tavily, re-score - a before/after on the same function.
- **Gap detection (whitespace):** rare term-pair combinations in the topic space (LSA sparsity) = under-explored intersections = whitespace. A lens over the same index.
- **Devil's advocate (inverted filter):** hunt for LOW differential - "the problem and its 'solution' share too much DNA to be a real solution" (greenwashing / fake-solution flag). Same number, inverted.
- **The Genesis orchestration** (5 personas -> fan-out research -> fan-in synthesis, domain decomposed 4 levels deep) is NOT scoring - it is the Phase 201 harness fan-out that gathers the text the primitive then scores. Orchestration, not math.

So the lenses (differential, surprise-gap, gap-detection, devils-advocate) sit on top; the tri-modal + real-embedding substrate is what finally makes them MEASURED. That is the Eureka engine.

## The reverse-salient detector, precisely (navigator PART 2, 2026-07-02)

Module 2 (the RS core) sharpens the primitive into a DIRECTIONAL signal and exposes defects the engine must fix.

The RS dual-similarity - score each pair two ways and take the gap WITH ITS SIGN:

```javascript
lsa_sim  = shared vocabulary / methods   // structural
bert_sim = shared meaning / concept       // semantic
gap = bert_sim - lsa_sim ;   Math.abs(gap) > 0.30  // = a reverse-salient opportunity
```

The SIGN is the insight, not just the magnitude - it emits a TYPED transfer direction:
- **LSA high, BERT low** (gap < 0) -> same methods, different concepts -> `structural_transfer`: take this TECHNIQUE, apply it to a new problem.
- **BERT high, LSA low** (gap > 0) -> same concept, different methods -> `semantic_implementation`: solve this KNOWN problem with a new technique.

The component-lag RS gate (systems view): score each component (research intensity, innovation rate, development rate vs the SYSTEM average), flag `isReverseSalient` when a component lags / has an innovation gap / sits below half the system average; attach performance_gap, impact 0-10, barriers, and cross-domain solution pathways (feasibility 0-10, viability 0-10).

Two DEFECTS the engine must fix (both "looks rigorous, isn't measured"):
1. **Hardcoded baseline.** The gate compared every component to `avgIntensity = 100` - a placeholder. Against a fake baseline the flags are meaningless. The engine MUST compute the real per-system mean and define the reverse-salient RELATIVE to the system's actual average, on the local graph.
2. **Keyword-dictionary heuristics (Module 3 lifecycle).** "Inefficiency detection" was `count("waste") x 10` looked up in a fixed `waste -> [ideas]` map - a scaffold, not analysis. The engine replaces the dictionary with MEASURED semantic matching against the graph.

The constraint PART 2 names - "real BERT needs torch/transformers/GPU, can't run as plain JS" - is EXACTLY what SEED-049 overturns: transformers.js runs BERT-class embeddings in Node via ONNX with NO Python, NO torch, NO GPU (WebGPU optional). The one thing the reverse-engineering calls impossible in JS is the thing the engine makes routine.

**The unifying pattern (Modules 1-5):** every module pairs a SOUND methodology with a PLACEHOLDER measurement - model-judgment semantics (PART 1), a hardcoded baseline (M2), a keyword dictionary (M3), simplified LSA topics (M1). The Eureka engine is the single substrate that makes ALL of them measured, reproducible, and graph-relative. The RS detector IS the differential engine; the lifecycle mapper is a LENS on it - you build the engine once, both become lenses.

**Canonical example + the full-matrix shape (PART 4, 2026-07-02).** The clearest eureka in the source: `"circadian rhythm optimization"` (sleep science) vs `"manufacturing shift scheduling"` (factories) - LSA ~0 (no shared words), BERT high (both optimize around biological timing) -> big gap -> RS "Circadian-Optimized Manufacturing." Nobody connected them because the two fields never read each other's journals. Mechanically: build TWO N x N similarity matrices (lsa, bert), take `bert[i][j] - lsa[i][j]` over all pairs, keep `|diff| > 0.30`, sort by disagreement (biggest first), top-50 become RS-001..RS-050. Everything else (clustering, convergence hubs, breakthrough scoring) is scoring layered on that one core. NOTE - the source asserts a THIRD time that "BERT needs Python/transformers, no JS equivalent." That recurring assumption, across every module, is EXACTLY the barrier SEED-049 removes: transformers.js runs BERT-class embeddings in Node via ONNX (no Python, no torch, no GPU). The one thing every module says is impossible in JS is the thing the engine makes routine.

## The 6-stage pipeline (correction, navigator 2026-07-02: the modules are STAGES, not repetition)

The six modules are NOT one primitive shown six times - they are the six ORDERED STAGES of the Eureka pipeline, each a distinct lens on the shared differential, run by the Phase-201 harness with the local graph as the accumulating state:

```
M1 DECOMPOSE      break the domain into a 4-level hierarchy of systems/components (nodes)
M2 REVERSE-SALIENT which component lags the system + bert-lsa cross-domain pairs
M3 LIFECYCLE       map a product/process lifecycle; inefficiency -> opportunity per stage
M4 TECH-EXTENSION  where else can this capability be sold (tech -> new industry)
M5 SYNTHESIS       cross-domain pattern recognition: convergence hubs (graph centrality),
                   innovation clusters (DBSCAN), paradigm-shift candidates
M6 PORTFOLIO       score on weighted criteria; tier_1/2/3 by return x risk; the path forward
```

Same `differential` primitive at the core of M2/M4/M5; different STAGE and different lens at each. The prior "saturation" read pattern-matched on the recurring formula and under-read the structural variation - which is exactly the `LSA high, BERT low` error the engine exists to catch (surface vocabulary matched, meaning differed). Recorded here so the pipeline architecture is not lost: the Eureka Engine is the substrate; these six are the ordered lenses the harness pipelines over the graph.

## The lens family + the pipeline-as-graph-state (navigator PART 3, 2026-07-02)

Module 4 (technology extension / market adjacency) is another LENS on the same RS differential, pointed at INDUSTRIES: "where else could this technology be sold?" `extractCoreTech -> findCurrentApplications -> findSemanticNeighbors (the RS gap) -> scoreMarketOpportunity -> buildStrategy`. The canonical eureka: an ML model for molecule-filter adhesion is the SAME math as drug-protein binding -> a $45B pharma adjacency. "Same math, new industry."

The lens family (all one engine, one `differential`, different arrays / different framing):
- **RS** - which component lags the system (reverse salient).
- **market-adjacency** (Module 4) - where else can this tech be sold (tech -> new industry).
- **whitespace** - rare/absent intersections (gap detection).
- **HSI / surprise** - deep-minus-shallow similarity gap.
- **find-analogies / find-connections** - structural isomorphism across a domain gap.
- **BONO** - debate the surfaced tension.

Tuning (from the modules): `|diff| > 0.30` = opportunity, `> 0.40` = exceptional, `> 0.50` = prioritize (breakthrough).

**The `accumulated_context` IS the growing graph.** The m1 -> m2 -> m3 -> m4 -> m5 chain passes a state object that only GROWS (nothing discarded) - "Redux state passed down the chain." That is not new infrastructure: it is the room GRAPH accreting, orchestrated by the Phase-201 harness pipeline (contracts-on-disk, fan-out/fan-in). Each lens/module APPENDS typed edges to the graph through the navigation chokepoint - which is the moat's compounding write-back restated. The pipeline stages are lenses; the accumulating state is the local graph.

## The architecture

```
room.db, TRI-MODAL (one SQLite file, zero infra)      SOURCES, TRI-SOURCE
  ├ STRUCTURAL  the graph (nodes/edges)                 ├ LOCAL   room.db
  ├ LEXICAL     FTS5 + BM25                              ├ REMOTE  Brain (Neo4j + Pinecone)
  └ SEMANTIC    vectors (+ node2vec graph embeddings)    └ ONLINE  live research (Tavily)
        │
        └─ hybrid retrieve (BM25 + vector, per source) -> RRF fuse -> optional cross-encoder rerank
           -> typed evidence set -> LENS (RS/HSI/BONO/whitespace/analogies) -> insight   [Part-8 fenced]
```

## What makes it Mindrian, not generic RAG (navigator, 2026-07-02): the LOCAL leg retrieves DISTILLED insight, not flat chunks

A generic local-RAG stack indexes raw document chunks. MindrianOS already REDUCES its knowledge, so the engine's LOCAL leg retrieves over far higher-signal units the moat already produces:

- **The typed graph** (room.db nodes + typed edges, the navigation.cjs chokepoint) - node2vec / KG-embeddings over STRUCTURE, not just node text. Analogy = structural isomorphism across the graph, which is graph-embedding-native.
- **The ICM memory system (Layers 0-4)** - Identity (STATE.md governing formulation) -> Routing -> Contracts -> Reference -> Artifacts. Each layer is a retrieval SCOPE at a different altitude; the engine retrieves at the right layer (identity vs artifact) instead of flattening everything into one bag of chunks. The folder-structure-as-orchestration IS a pre-built retrieval index.
- **Feynman-MINTO reasoning** - the per-section REASONING.md / BRAIN.md derivations: a governing thought + a MECE argument tree per section (`/mos:mos-reason`, `/mos:structure-argument`). These are the Feynman REDUCTION - the distilled essence of each section, not raw prose. **Retrieving over governing-thoughts is retrieving over insight, not text.** That is the single biggest signal advantage over a generic RAG.

This is the moat expressed in retrieval: the corpus the engine searches is already reduced to governing-thoughts + typed edges + MECE arguments (Feynman-MINTO) before a single query runs. A competitor can copy the FTS5 + vector + RRF stack; they cannot copy the distilled substrate it searches. The hybrid engine is the retrieval mechanics; the ICM + Feynman-MINTO structure is what makes those mechanics land on insight.

## THE MOAT: the closed graph<->web loop (navigator, 2026-07-02)

The moat is NOT the retrieval stack (copyable in an afternoon) and NOT only the distilled substrate. It is the CLOSED LOOP between the local graph and the web - the graph drives the fetch AND frames the analysis, at both ends:

1. **Graph-context-driven FETCHING.** The local graph GENERATES what to fetch. Its reverse-salients (lagging components), whitespace gaps, and low-differential tensions become the research queries - the graph decides what is worth going to the web for. A generic RAG fetches by the user's keyword; the Eureka engine fetches by the graph's own gap. The Genesis orchestration + the RS/whitespace lenses, pointed OUTWARD: the graph is the query generator.
2. **Graph-framed ANALYSIS.** The fetched document is NOT scored in isolation. The `differential` primitive runs it AGAINST the existing graph nodes - semantic-minus-lexical vs what the graph already holds - so the eureka is measured relative to THIS venture's knowledge, not in the abstract. The graph is the reference frame that turns a generic paper into a specific opportunity: "this fetched capability is functionally identical to your lagging component, and nobody has connected them."
3. **Verified WRITE-BACK (compounding).** The verified result writes back as typed nodes/edges through the navigation chokepoint (Canon Part 9, human-gated) - this is literally the Phase 201-03 propose -> fact-check -> refine loop already shipped. Each fetch deepens the graph, which sharpens the NEXT fetch's targeting. The engine compounds; the graph gets denser and better-aimed with every eureka.

Why it cannot be copied: FTS5 + vectors + RRF + transformers.js is commodity. YOUR graph steering the fetch and framing the analysis is not. The stack is the mechanics; the graph-in-the-loop is the moat. Part 8 holds throughout: only generic query handles egress to the web, local content stays local, the fetched external evidence is generic, and the fusion + write-back are local.

So the ONLINE leg of the tri-source engine is NOT a third retrieval source sitting parallel to LOCAL and REMOTE. It is a graph -> web -> graph LOOP, driven and framed by the local graph at both ends. That loop, wrapped around the tri-modal substrate + the measured differential primitive, IS the Eureka engine.

## The proven stack (Tavily research 2026-07-02; all Node/CJS, zero Python)

The tri-modal SQLite + RRF pattern is the mainstream 2025-2026 local-RAG stack, not experimental:

- **LEXICAL: SQLite FTS5 + BM25** - built into SQLite; VERIFIED available in this repo's `node:sqlite` (live test returned a bm25-ranked hit, SQLite 3.51.2). This is the agno-docs-mcp lesson (it uses exactly FTS5 + BM25 + Porter stemming, no embeddings - the lexical leg is all it teaches, and it's the leg MindrianOS lacks).
- **SEMANTIC: `sqlite-vec` (Alex Garcia)** vector virtual table - VERIFIED loadable (`node:sqlite` accepts `allowExtension:true` and exposes `db.loadExtension`). Fallback: brute-force CJS cosine over a normal table - sub-millisecond at room scale (hundreds-to-thousands of nodes, not millions). Either way, no Python.
- **EMBEDDINGS: transformers.js (`@huggingface/transformers`, ONNX runtime)** - runs embedding models in Node with NO Python and NO PyTorch. Small models fit MindrianOS: Model2Vec potion-base-8M (256-dim), MiniLM-L6-v2, mxbai-embed-xsmall. Reference proof: a 15,800-file Obsidian vault indexed as 49,746 chunks in 83MB with Model2Vec + sqlite-vec + FTS5 + RRF - the Obsidian-vault shape is exactly a MindrianOS room. THIS RETIRES the Python sentence-transformers (~2GB) that SEED-013 flagged, and arguably retires LSA (modern small transformer embeddings outperform LSA and run in Node).
- **FUSION: Reciprocal Rank Fusion (RRF)**, `score(d)=Sigma 1/(k+rank_i(d))`, k=60. Rank-only, normalization-free, zero-tuning. Multiple 2025-2026 sources call it "the minimum viable baseline for any RAG deployment" and consistently +15-30% recall over single-method. Crucially it fuses the three SOURCES (local/remote/online) without comparable scores - the natural way to blend legs.
- **RERANK (optional stage 2): cross-encoder** via transformers.js ONNX - the single biggest accuracy lift (+17pp MRR@3 over unreranked hybrid in benchmarks), but heavier; stage-1 RRF hybrid is the must-have, rerank is an upgrade or Brain-side.
- **GRAPH ANALOGY: node2vec / KG-embeddings** over the room.db graph - embed structure, not just node text; cosine-merge near-isomorphic nodes; betweenness/gap detection for whitespace. Academic grounding (IOPscience, arxiv 2602.07491) for "identify gaps, surface hidden cross-domain parallels, generate opportunities" - the RS/whitespace/find-analogies goal exactly.

## Why it matters

- **Consolidation, not sprawl (Part 7).** N features stop reimplementing the same retrieve-match-insight loop; they share one engine. Moat-deepening: the engine that knows how to retrieve+fuse across local/remote/online IS the moat.
- **Closes the no-Python arc (SEED-013).** transformers.js + FTS5 + sqlite-vec = the whole embedding/lexical/semantic stack in Node, retiring rs-engine.py / hsi-*.py / rs_math.py / rs_hybrid.py from the user machine.
- **One Part-8 fence.** Local content never egresses; the fence is implemented once in the engine instead of re-risked in every command. Remote/online legs return generic handles + external evidence only.
- **Completes SEED-029.** SEED-029 planned the local VECTOR spine; this adds the LEXICAL leg (FTS5) it was missing and the FUSION/rerank layer, making room.db a full tri-modal retriever.

## Open decisions (for the phase)

- **D1 - vector leg:** `sqlite-vec` extension (fast, ANN-ready) vs pure-CJS cosine (zero dep, sub-ms at room scale). Recommend CJS cosine first (no platform-build risk), sqlite-vec as an opt-in accelerator.
- **D2 - LSA:** retire for transformers.js embeddings (recommended - LSA is the weaker, Python-bound method) vs keep LSA Brain-side as a cheap fallback.
- **D3 - embedding model:** Model2Vec 256-dim (tiny, fast) vs MiniLM/mxbai (stronger, larger). Recommend Model2Vec for the local leg; heavier models Brain-side.
- **D4 - rerank:** ship the cross-encoder locally (transformers.js) vs Brain-side vs defer. Recommend stage-1 RRF now, rerank as a later upgrade.
- **D5 - agno:** reference only (its FTS5/BM25 pattern), NOT a shipped dependency (it is Python; SEED-013 forbids Python on the user machine). Learn from it, do not bundle it.

## Relationship

Likely its OWN foundation phase - an "Insight Engine" substrate that converges the cluster (SEED-029/030/024/048/008 + Phases 161/200) and that RS/HSI/BONO/whitespace/find-analogies/find-connections then consume as thin lenses. It sits under the Part-3 tri-context spine (LOCAL + BRAIN + SIGNAL) as its embedding-native realization: the three contexts stop merely gating a decision and start retrieving, fusing, and generating the insight.

## Why this is the whole point + a live validation (navigator, 2026-07-02)

The Eureka Engine is not a feature - it is the realization of a decades-long quest. The pedagogy lead's life work is the EUREKA MOMENT (where the spark comes from, made structured and repeatable); years of hand-built algorithms "never got very far" until AI changed the game. The name is his thesis: EUREKA engines, not intelligence engines. The mandate is scale + speed - ideate at scale, then decide the path forward.

Live validation (a pharma venture-studio session, operators flying BLIND in a domain they did not understand): the engine ran deep-research + whitespace + reverse-salient and surfaced a real cross-domain target-combination opportunity ranked #1 of 25, each with its process + references. The methodology works in production. Its stated purpose: "not to give a solution - better questions, and a path forward." That is the hedged-offer + Decision-Gate framing (Part 12): the eureka is a QUESTION the human judges, not a verdict - the LarryReacts surfacing, confirmed by real use. The graph-is-the-product claim was stated verbatim ("we navigate the relationships between nodes and edges; the relationships create the queries; deep research files back as more nodes and edges") = the graph<->web moat loop from live use. Meeting microknowledge extraction (an agent flags critical-path items onto the graph with a question mark) is another compounding write-back source.

The domain expert's critique = the EXACT gap the measured, graph-framed differential closes: the analysis had framed the differential over SURFACE entities (the drugs) instead of the STRUCTURAL ones (the pathways/targets and their synergistic signals) - a plausible hypothesis, not yet a defensible one. REQUIREMENT this adds (D6): the eureka differential MUST be framed by the DOMAIN GRAPH's entity TYPES - it operates over the right nodes (mechanisms, not surface tokens). This is precisely why the local typed graph must frame the analysis and generic keyword retrieval cannot: the eureka is a NON-OBVIOUS hypothesis (bert-high, lsa-low, "connections you need to hypothesize, not findable online") - the reverse-salient signal, framed on the RIGHT entities. Measured semantics turn a plausible eureka into a defensible one; domain-entity framing turns a generic one into a specific one.

## What the Brain (Neo4j) already knows - the REMOTE leg is largely BUILT (2026-07-02)

Queried the Brain teaching graph (brain_ask + brain_search, Part-8 generic-methodology only). It does not merely know the framework - it already carries the SCHEMA the Eureka Engine needs, which resolves D6 (domain-entity framing) concretely and supplies the REMOTE leg.

The framework is canonical and grounded: Reverse Salient (Hughes - a component fallen behind / out of phase, limiting the whole system's growth), White Space Mapping (overlooked opportunities found by identifying system limits), and - the key one - Intersectional Innovation, defined verbatim as "novel approaches that COMBINE elements from DIFFERENT domains to address reverse salients in unexpected ways" - that IS the cross-domain eureka, in canon. Related: Blue Ocean ERRC / Four Actions, Meaning Innovation (Verganti), Life-Cycle Analysis, Red Teaming. Problem-to-framework map: ill-defined -> jtbd, domain, reverse_salient, bono. "Eureka Moment" and "Reverse Salient" are first-class Framework nodes - the engine composes existing teaching, mints no new theory.

The Brain's Neo4j schema (mirror it LOCALLY in room.db; Part 8 = generic STRUCTURE only, never user data):

```cypher
// node types
ReverseSalient   // bottleneck / lagging component; the HSI discovery pipeline
CrossDomainInnovation, DomainBridge   // cross-domain connections
LeveragePoint    // high-impact intervention point
Bottleneck, Concept (~8000), Community (39)
// relationships
(:Concept)-[:CO_OCCURS]->(:Concept)        // 123K edges
(:Concept)-[:BELONGS_TO]->(:Community)      // GraphRAG-Lite community detection
(:ReverseSalient)-[:BRIDGES]->(:Domain)     // the cross-domain HSI bridge
(:ReverseSalient)<-[:ADDRESSES]-(:LeveragePoint)
```

Three design unlocks:
1. **D6 resolved - the domain-entity types ARE the Brain's PWS node types.** The local graph mints `ReverseSalient` / `DomainBridge` / `LeveragePoint` / `CrossDomainInnovation` typed nodes (mirroring the Brain), so the differential is framed over the RIGHT entities (mechanisms, not surface tokens) - exactly the pharma-validation critique.
2. **The graph-native differential = a `BRIDGE` across non-co-occurring communities.** The Brain detects 39 communities over 123K `CO_OCCURS` edges; a cross-domain eureka is a connection that BRIDGES two communities that do NOT co-occur - the graph twin of "BERT-high, LSA-low." So the engine core can run over GRAPH STRUCTURE (community detection + bridge-finding via node2vec / centrality), not only text pairs. The Brain proves this at 123K-edge scale (GraphRAG-Lite, `tools/graphrag_lite.py`).
3. **The methodology CHAIN is the lens pipeline, taught (FEEDS_INTO):** ill-defined -> reverse_salient -> `LeveragePoint` (ADDRESSES) -> intersectional-innovation opportunity (ERRC / JTBD / Four-Actions). The Eureka Engine runs the Brain's sequence.

Part 8 confirmed live: `brain_ask` returned a GUIDED DirectiveEnvelope - it asked "what decision does applying Eureka Moment inform?" and named the framework, returning generic structure + a reframing question with ZERO user data. The REMOTE leg is Part-8-safe by construction.

Net: the REMOTE leg of the tri-source engine is NOT to-be-invented - the Brain already carries the schema, the community-detection substrate, and the FEEDS_INTO methodology chain. The Eureka Engine mirrors this structure LOCALLY (room.db typed nodes) and fuses LOCAL + this REMOTE + ONLINE.

## CAPSTONE: the Eureka Engine x LarryReacts x Phases 188-205 (fable synthesis, 2026-07-02)

The punchline: the Eureka Engine is roughly 80% ALREADY SHIPPED across the recent phases. It is not a new build - it is a UNIFICATION + one encoder swap + the LarryReacts wiring. Grounded (fable recon, file:line):

ALREADY SHIPPED (the engine's parts, scattered across phases):
- **The differential primitive:** `lib/core/rs-differential-scorer.cjs:107-109` - `DIFF_FLOOR 0.3 / LSA_FLOOR 0.2 / BERT_FLOOR 0.2`. The `bert-lsa>0.30` core is in the codebase, in CJS. Phase 200 explicitly defers the transformers.js encoder swap to "the embedding-spine decision D-200-1" = THIS engine's phase.
- **The write-back / moat loop:** 201-03 `runGraphRefine` (`lib/core/graph-refine-loop.cjs`) - propose -> fact-check -> refine through the navigation chokepoint.
- **The injection sockets (205 pre-drilled them):** `ctx.lateralEngine` (`lib/core/fusion-router.cjs:283`, degrades `blocked_until_phase_200_rs`) and `BLOCKED_UNTIL_200` (`lib/core/grill-engine.cjs:210`, with a 4-fix live-wiring spec written). FUSION + GRILL are waiting for this engine.
- **The cross-room eureka:** a one-signal upgrade to 195's FCM-09 emitter (`lib/core/cross-room-aggregator.cjs:835`, cosine -> differential).
- **The governance / egress / Brain rails:** 188/190 Shape-F + the declaration mandate; 189 the HITL chokepoint basket (the write-back human gate); 196 `classify()` Part-8 guard (the online/remote fence); 191 DirectiveEnvelope (the Brain-advisory remote leg).

USES / USED-BY (bidirectional - "their way and this way"):

| Phase | Eureka Engine USES it | ...is USED-BY / enhanced by the engine |
|---|---|---|
| 188/190 Shape-F + mandate | surfaces the eureka through F.x gates; declares its `hitl_shape` | Shape-F gains a eureka trigger source |
| 189 HITL governance | the human gate on eureka write-back (Part 9 truth-claim) | 189's chokepoint basket gets the eureka proposals |
| 191 Brain advisor | the REMOTE leg (DirectiveEnvelope, generic handles) | Brain advice is scored by the differential |
| 195 cross-room memory | cross-room eurekas (FCM-09 differential) | 195's emitter gains the bridge signal |
| 196 Part-8 guard | the fence the online/remote legs pass | reused, not re-risked |
| 200 RS spine | the differential (rs-differential-scorer) + corpus + the D-200-1 encoder hook | 200's RS lens becomes a consumer |
| 201 harness + Ralph | the fan-out (research) + the 201-03 write-back | the harness pipelines the lenses |
| 202 APO lab | tunes the thresholds (0.3/0.2/0.2), the RRF k, reach-firing from telemetry | the engine's calibration loop |
| 203 synthetic expert | reads the eureka-enriched graph as a persona | fan-out-built from the engine's graph |
| 205 FUSION / GRILL | the `lateralEngine` + GRILL sockets = eureka lenses; the sensors fire it | FUSION/GRILL become eureka lenses |

THE EUREKA-REACH (the LarryReacts wiring - the last missing piece):
- A sensor (**SENS-13** "cross-domain-differential / eureka" - corrected 2026-07-04, was mis-numbered SENS-11 in the original seed draft; SENS-11 is already live as of Phase 203-03, `lib/core/sensors/sensor-expert-skill.cjs` reusable-expert/save-as-skill sensor - a real id collision caught by a codebase audit and fixed before Phase 213 builds it) fires when the graph yields a high-differential BRIDGE (two nodes in non-co-occurring communities, bert-high / lsa-low), reusing the SENS-02 lagging-component substrate + the community-bridge detector (the Brain's `BRIDGES` idiom).
- It routes through the FROZEN `deep_research` reach (mints NO new reach_id; Canon Part 7/11) and surfaces as a Shape-F Decision Gate (a single F.1 offer, or F.5 when it branches).
- Larry CONTEXTUALIZES it as a HEDGED offer (Part 12, offer-never-assert, matching FUSION 205-07): "X and Y are the same idea nobody has connected - here is the opportunity and the transfer direction (structural_transfer vs semantic_implementation). Want to pursue it?" The graph supplies the two bridged nodes + the differential + the direction; the human judges (the "better questions, path forward" doctrine confirmed in the live validation).
- Part 8: only generic handles surface; local content stays local.

BIND THE EUREKA TO DISCUSSION (navigator, 2026-07-02): a surfaced RS / whitespace / bridge is not offered raw - existing surfaces BIND it into structured discussion before the navigator commits. The DOMAIN EXTRACTOR (`lib/core/navigation/typed-domain.cjs` + `/mos:explore-domains` + `/mos:analyze-needs`, the Module-1 decompose) grounds the eureka in the domain hierarchy at the RIGHT entity level (D6). BONO's PERSONA CREATOR (Phase 164 `/mos:bono` + `/mos:persona` Six-Hats + `/mos:rs-experts` synthetic panel (F.8) + the Phase-203 synthetic expert) spins up synthetic domain-experts who DEBATE the RS / whitespace - stress-testing it the way the pharma domain expert did in the live validation (the drugs-vs-pathways critique), but AUTOMATICALLY, before the navigator sees it. So the eureka arrives already domain-grounded and already persona-debated - a defensible opportunity with multiple perspectives, not a raw score. BONO is both a PRODUCER (its research fan-out feeds the differential) and a CONSUMER (it debates the surfaced eureka) - the tightest two-way coupling; GRILL (205-08) validates, BONO debates, the domain extractor grounds.

NET: build ONE thing - the encoder swap (transformers.js, D-200-1) that makes the shipped differential MEASURED, plus the SENS-13 eureka-reach and the graph-framed (Brain-schema) node types - and the engine LIGHTS UP across everything already built: the differential (200), the write-back (201-03), the FUSION/GRILL sockets (205), the cross-room signal (195), the domain extractor + BONO persona-debate (164/203), the governance rails (188/189/190/191/196), and the Brain's schema + community substrate (191). The Eureka Engine is the connective spine OF Phases 188-205, not beside them.

## Three eureka MODES: PRESENT bridge, ABSENT whitespace, PATTERN transfer (navigator, 2026-07-02)

The eureka is not one signal - it is a family of three. The Cross-Topic Connection judge measures only the first:

- **Type 1 - PRESENT bridge (the differential):** two things that DO connect semantically but nobody has linked (bert-high, lexical-LOW). "X and Y are secretly the same idea." Drives a WHAT - transfer / apply (structural_transfer or semantic_implementation). This is the differential + the deployed Cross-Topic Connection judge.
- **Type 2 - ABSENT whitespace (the gap):** what does NOT connect but SHOULD - between two nodes the graph implies a connection, or a component that is MISSING. "What we should see and do not" (live validation, verbatim). The gap IS the opportunity, and it drives a HOW - what must be invented / built to fill it. This is whitespace mapping + reverse-salient (the missing / lagging component), and it needs its OWN judge (a Whitespace judge, sibling to Cross-Topic Connection).

- **Type 3 - PATTERN transfer (find-analogies):** abstract a challenge to its STRUCTURAL PATTERN (SAPPhIRE / TRIZ), then find that same pattern in a DISTANT domain - crossing it via BOTH context-based (semantic) AND pattern-based (structural / lexical) web search, ranked for high relevancy to the pattern. "This SHAPE of problem is solved over there - borrow the shape." Drives a WHAT-FROM-WHERE (analogical transfer across a domain gap). This is the find-analogies lens + the ONLINE leg: pattern-abstraction -> cross-domain pattern-match -> high-relevancy hybrid retrieval (context + pattern = the two retrieval legs, applied outward across domains).

Graph-native: Type 1 = a high-semantic / low-lexical BRIDGE across non-co-occurring communities (a connection nobody made). Type 2 = a STRUCTURAL HOLE - two semantically-adjacent nodes with NO edge/path between them, or a betweenness gap where the structure implies a connection should exist but does not; in the Brain schema this is the reverse-salient / `LeveragePoint` gap - the missing BRIDGE the structure demands. Fill it = the HOW.

Combined, the two modes are the full eureka: what IS secretly connected (transfer it) + what SHOULD be connected but is not (build it). The Eureka Engine runs BOTH over the graph; the Cross-Topic Connection judge covers Type 1, a Whitespace judge covers Type 2.

## THE KEY: how a user reaches it (the anti-"Ferrari-with-no-key" requirement, navigator 2026-07-02)

The deepest product risk: a powerful engine the user must KNOW to invoke - type a command, know the word "reverse salient," know to ask for whitespace - is a Ferrari with no key. The entire persona-test series proves this is fatal: the #1 recurring finding is "students do not type commands." A command-triggered eureka engine is dead on arrival. This is a HARD requirement, not a UX nicety.

The key is NOT a command. The key is Larry + the sensor:
- **WHEN (the user never decides):** the SENS-13 sensor decides. A eureka is AVAILABLE when the graph has earned it - two nodes in non-co-occurring communities that bridge (bert-high / lsa-low). The sensor watches the graph state and fires the reach when a eureka EXISTS, not when the user asks. "The relationships and edges create the queries" (navigator, live validation, verbatim).
- **HOW (the user never learns the methodology):** Larry surfaces it as a plain-language HEDGED offer at the right moment - "the thing you said about X is the same structure as Y from your other topic; nobody has connected them - here is the opportunity. Want to pursue it?" The user answers yes/no. "You do not need to understand the methodology; you talk to the machine; the methodology works in the background" (navigator, live validation).
- **PATH FORWARD (Lawrence's requirement):** the eureka-reach must NOT dead-end at a connection - it offers the next step (research it / GRILL it / build the opportunity), so it "ends with a path forward."

VALIDATION (the WOW = the moat): flying BLIND in pharma (operators knew nothing about the domain), no commands typed, the engine surfaced a real cross-domain target-combination opportunity ranked #1 of 25. The user did not need the key because Larry held it. THAT is the moat: not the differential math (copyable in an afternoon), but Larry DELIVERING the eureka at the right moment, contextualized to YOUR graph, unprompted. A competitor with the same FTS5 + vector + RRF stack has the engine; they do not have Larry driving it off the graph state. The key and the moat are the SAME thing - and it is Canon Part 10 (conversation is the surface; commands are the internals).

RESIDUAL RISK (honest): the risk is NOT access - it is CALIBRATION. Too-frequent firing = noise (a Ferrari that stalls); too-rare = silent (no key felt). That is a tuning problem, addressed by Phase 202 (APO) tuning the fire-rate + thresholds from telemetry, and de-risked EMPIRICALLY by the MVP slice (run on a real room.db; confirm the eurekas are meaningful). The methodology already works (the live validation: model-judgment semantics found a real #1/25); the open questions are calibrated small-local-embedding QUALITY (D3) and FIRE-RATE - both answered by the MVP, not by more design.

## GRADUATION: the Eureka-Engine phase plan (211 -> 215, navigator 2026-07-02; renumbered 2026-07-04 -- 206-209/20x were the original aspirational numbers, never actually free since 209/210 were already taken by the curing-sequence revert; registered for real in `.planning/ROADMAP.md`)

Slice the seed into bounded phases, MVP-first; each shippable with a gate (as tonight's 200/201/202/205 were). ~80% ships already, so each phase is small assembly + one new piece.

- **Phase 211 - Eureka MVP: the MEASURED differential + tri-modal room.db (the vertical slice that proves the thesis).** Swap the encoder to transformers.js (D-200-1) so `rs-differential-scorer.cjs:107` semantic leg is MEASURED not model-judgment; add the FTS5 lexical leg (agno) + vector leg (sqlite-vec / CJS-cosine) to room.db; RRF hybrid. Run on a REAL room.db; de-risk small-embedding QUALITY + fire-rate. Gate: run-all-211 + real-room eureka spot-check + the deployed Cross-Topic Connection judge. Depends: 200.
- **Phase 212 - graph-framed substrate + two-mode detection (D6 + whitespace).** Mirror the Brain node/edge types locally (`ReverseSalient` / `DomainBridge` / `LeveragePoint`; community detection over room.db); Type-1 present-bridge (community-bridge) + Type-2 whitespace (structural hole / missing-edge) detectors; frame the differential over domain-entity types. Gate: a new Whitespace Plurai judge + community-bridge tests. Depends: 211, 191 (Brain schema).
- **Phase 213 - the eureka-reach + LarryReacts wiring (THE KEY).** SENS-13 sensor (fires on a graph eureka, both modes) -> frozen `deep_research` reach -> Shape-F offer; the no-command / hedged / path-forward contract (anti-Ferrari-with-no-key); calibration via 202 APO fire-rate tuning; binding via domain-extractor + BONO persona-debate. Gate: the eureka-surfacing Plurai judge (defined 2026-07-02, thread d7561062) + reach-gate judge. Depends: 212, 188/189/190, 202, 205 (FUSION/GRILL sockets). BLOCKED until the curing-sequence debug track resolves (wires into the exact 190/202/205 mechanisms it is fixing).
- **Phase 214 - Type-3 pattern-transfer + the ONLINE leg (find-analogies).** Pattern-abstraction (SAPPhIRE/TRIZ) -> cross-domain pattern-match -> context + pattern web search (high relevancy); wire the full graph<->web moat loop (fetch driven by graph gaps, analysis framed by the graph, write-back via 201-03). Gate: analogy-transfer tests + the Part-8 online fence (196). Depends: 213, 200 (RS discriminator), 201-03.
- **Phase 215 - re-point the LENSES + portfolio scale.** RS / whitespace / HSI / find-analogies / market-adjacency become thin lenses on the one engine (retire their duplicate retrieval); portfolio-scale (SEED-048): batch-score N, tier_1/2/3. Depends: 211-214.

Each phase inherits the tonight discipline: file:line contracts, adversarial verify, Plurai gate, Part-8 fence, worktree isolation for parallel runs, ledger flip on COMPLETE.

## Provenance - how we got here (navigator: "this is very important", 2026-07-02)

This seed did not start as a plan; it EMERGED from a conversation. The trigger was agno-docs-mcp (https://github.com/CENFARG/agno-docs-mcp): studying it revealed that high-quality retrieval runs INSIDE SQLite via FTS5 + BM25 with ZERO Python - the lexical leg MindrianOS lacked. That one observation opened the thread:

`agno FTS5 lesson` -> "can our SQLite do better" -> tri-modal room.db (graph + FTS5 + vectors) -> tri-source engine (local / remote / online) -> reverse-engineering the LIVE 6-module RS/differential pipeline (the `bert - lsa > 0.30` primitive, the directional RS structural_transfer vs semantic_implementation, market-adjacency, the circadian->manufacturing eureka) -> the discovery that EVERY module pairs a SOUND methodology with a PLACEHOLDER measurement (model-judgment / hardcoded baseline / keyword dictionary) -> the MOAT (the graph drives the fetch AND frames the analysis, compounding via the 201-03 write-back) -> the Mindrian-only substrate (ICM layers + Feynman-MINTO distilled retrieval) -> wiring it into LarryReacts + Shape-F + Phases 188-205 so Larry DRIVES and CONTEXTUALIZES eureka moments.

The lesson agno taught (FTS5 lexical, no Python) is the SMALLEST piece; the journey from it is the whole engine. Recorded here so the origin is not lost.

## Verification log (2026-07-02, this repo)

- `node:sqlite` FTS5: AVAILABLE (live bm25 query returned a ranked hit). SQLite 3.51.2, node v22.22.2.
- `node:sqlite` extension loading: AVAILABLE (`allowExtension:true` accepted; `db.loadExtension` exists) -> sqlite-vec loadable if built for platform; CJS-cosine fallback otherwise.
- `@huggingface/transformers`: NOT yet a dependency (would be a new Node/lab dep; no Python).
- LSA today: Python-bound (`lib/core/rs_math.py`, `rs_hybrid.py`, `scripts/compute-hsi.py`, `detect-reverse-salients.py`); `rs-differential-scorer.cjs` is already a CJS port (precedent for the port).

## Standalone research validation (WebSearch, 2026-07-04; Tavily was down, 402 payment-required, navigator approved WebSearch fallback)

Re-validated the 2026-07-02 Tavily findings against fresh sources, independent of any other update in flight (registered per navigator instruction to treat 048/049 as their own update track). Net: the stack choice holds; three of the five open decisions (D1/D3/D4) now have a sharper, source-backed default.

- **Embeddings (resolves D3 more precisely):** `@huggingface/transformers` v4 confirmed production-ready in plain Node (no GPU) - 53% smaller bundles, ~200ms builds (down from 2s). Concrete model short-list, in order of fit: `Xenova/all-MiniLM-L6-v2` (384-dim, the default workhorse), `Xenova/bge-small-en-v1.5` (384-dim, stronger retrieval-tuned alternative), `nomic-ai/nomic-embed-text-v1.5` (768-dim, only if room-scale ever needs the extra signal). Use `dtype: q8` or `q4` for CPU inference speed/memory - a ~4x speedup on BERT-class embedders is achievable with the right ONNX operators. Model2Vec (the seed's original D3 lean) is real but far less discussed in current sources than MiniLM/BGE - recommend defaulting to `all-MiniLM-L6-v2` unless a room-scale benchmark shows Model2Vec winning on speed with acceptable quality loss.
- **Vector leg (resolves D1 with a scale ceiling):** sqlite-vec confirmed production-safe - pure C, zero deps, ACID-correct (hooks into SQLite's `xBegin/xSync/xRollback/xCommit`, so concurrent writes are safe). Concrete scale data: **100K vectors at 384-dim run under 100ms**; degrades past ~1M or higher dimensions. A MindrianOS room (hundreds to low-thousands of nodes) sits nowhere near that ceiling - this closes D1 in favor of sqlite-vec as primary, not just an opt-in accelerator, with plain CJS-cosine as the zero-dependency fallback when the extension can't load on a given platform. Verify via `SELECT vec_version();` at runtime, matching this repo's existing verification-log discipline.
- **Fusion (sharpens the RRF constant, not just the algorithm):** k=60 remains the textbook default, but current guidance is more scale-aware than the seed's flat citation - **small corpora tune k down (~20)**, large corpora push k up (~100-100+), because k dampens top-rank dominance and a room-scale corpus (small candidate lists) wants LESS dampening, not the large-corpus default. Recommend seeding `RRF_K` at 20-30 for room.db queries, not the generic 60, and exposing it as an env-tunable (matches this repo's `RS_SEMANTIC_FLOOR` precedent from Phase 200). Caveat confirmed important: RRF only earns its keep when the fused rankers are genuinely different signals - FTS5/BM25 + dense vectors is exactly the diverse pair the sources call out as the strong case; fusing near-duplicate rankers (e.g. two BM25 variants) buys nothing.
- **Rerank (resolves D4 with a cheaper option the seed didn't have):** FlashRank surfaced as a strictly better fit for "ship it locally, don't make it heavy" than the seed's transformers.js-cross-encoder default - CPU-only, no Torch/Transformers dependency, ~4MB, one of the smallest reranking models available. Recommend FlashRank as the local rerank default (closes D4 in favor of "ship it," reversing the seed's "defer to Brain-side" lean) with BGE-Reranker-v2-m3 (Apache-2.0, 100+ languages, current best quality/latency tradeoff) as the upgrade path if English-only MiniLM-class quality proves insufficient on real room content.
- **D2 (LSA retirement) and D5 (agno as reference-only):** no new counter-evidence found; both original recommendations stand as-is.

Net effect on the Phase 211 MVP scope (renumbered 2026-07-04 from the original aspirational "206"; registered in `.planning/ROADMAP.md`): the encoder swap (transformers.js) and the tri-modal room.db (FTS5 + sqlite-vec + RRF) are now BOTH validated as production patterns, not just plausible - source-cited concrete model names, a scale ceiling that confirms room.db never approaches sqlite-vec's degradation zone, a corpus-appropriate RRF k, and a lighter rerank default than originally proposed. No architecture change; this tightens the parameter choices Phase 211 ships with.

## Research addendum (2026-07-05, forked read-only pass): the command-research corpus + LarryReacts machinery is closer to done than assumed

Two forked research passes (corpus usability + current reach-machinery assessment) confirmed the raw material for a JTBD/audience/F-shape-aware LarryReacts (the real, unachieved intent behind Phases 188-205, per the navigator's 2026-07-05 reflection) already exists and does NOT need rebuilding - see the Phase 213 + Phase 191 ROADMAP addenda (committed `5c164c19` + `4090d99f`) for the full findings. Summary relevant to this seed:

- **Canonical source is already frontmatter, not the research room.** JTBD (`serves_jtbd`, `help_jtbd`), F-shape (`hitl_shape`, 99/107 files), and admin/user-facing audience (`visibility: admin`, `connector.excluded`) are already declared per-command in `commands/*.md` frontmatter, machine-projected into `data/command-registry.json`. `room/command-research/` (116 ROOM.md sub-rooms) and `.planning/research/command-map/` (103 dossiers + INDEX.md, confirmed live, 710 `RELATED_TO` edges in `room/.mindrian/room.db`) are real and rich, but they are a ONE-TIME 2026-07-01 research snapshot - an enrichment INPUT to backfill thin frontmatter fields, not a fourth live runtime data path to query in parallel with frontmatter/command-registry.json.
- **Traversal/recommendation machinery already exists:** `lib/brain/chain-recommender.cjs` (`recommendFrameworkChain`, FEEDS_INTO traversal) + `lib/workflow/command-resolver.cjs` (`composeWorkflow`) + `lib/core/navigation-engine-offer.cjs` (already command-level, JTBD-aware, confidence-gated, hitl_shape-passthrough - Phase 191's shipped work). Phase 213 wires the eureka-sensor INTO this existing machinery; it is not building a recommend engine from scratch.
- **Real gap found, not architectural:** `visibility: admin` is declared per-command but NOT wired into the recommendation scorer - `navigation-engine-offer.cjs` can currently recommend an admin-only command to a non-admin navigator. Small, scoped fix (Phase 191's reopened 191-03/191-05 + this filter), not new design.
- **Design constraint this reinforces:** "the Brain RECOMMENDS, never TRIGGERS" (the 2026-07-01 handoff's own key decision) - Phase 213 must not reintroduce a forcing mechanism; that is exactly what Phase 210 reverted.
- Sibling seed: SEED-052 (GSD each command as its own mini-product) is the broader product-management follow-through on this finding - auditing all 107 commands' JTBD/audience/F-shape individually, not just confirming the machinery exists.

## Addendum (2026-07-05, navigator directive): the wall goes around calibration, not around the engine, and the REMOTE leg's job is framework selection over STRUCTURE, never over embeddings or raw content

Two navigator directives this session, both about the tri-source architecture already specified above, neither a new engine:

**D7 - moatability seam is the calibration layer, not the differential engine.** The differential computation (embeddings + lexical/semantic scoring over the user's own room content) can NEVER sit behind a remote API wall the way the Brain does - it operates directly on user content, and Part 8 (LOCAL -> BRAIN: NO) is constitutional, not a style choice. The Brain wall works only because the Brain never sees content, only generic framework handles. The legitimately wall-able surface is the CALIBRATION layer: `DIFF_FLOOR`/`LSA_FLOOR`/`BERT_FLOOR` (currently 0.3/0.2/0.2, `rs-differential-scorer.cjs:107-109`), RRF `k` (20-30 room-scale per the 2026-07-04 WebSearch addendum), which gold case-cards count as calibration truth (211-04's 6 cards), judge rubrics, and SENS-13 fire-rate thresholds. Architect this as a small config-provider interface now: satisfied LOCALLY today (hardcoded / `.planning/config.json`), swappable for a Brain MCP call later without touching the engine. This is Phase 212's seam to own (graph-framed substrate + calibration), not a 211 concern - 211 ships with local defaults; 212 is where the interface boundary gets drawn.

**D8 - the REMOTE leg's specific job: navigate the LOCAL engine's structural output and propose which framework fits, never touch the embeddings or the text.** This is not new scope - it is precisely what `brain_ask`/`brain_search` already demonstrated live in this seed's "What the Brain already knows" section (returning Reverse Salient / White Space Mapping / Intersectional Innovation framework matches from a GUIDED DirectiveEnvelope, zero user data). The explicit contract for Phase 212/213 to build against: when the LOCAL engine surfaces a structural signal (a community-bridge exists, differential magnitude, the domain-entity TYPES involved per D6 - e.g. "ReverseSalient node X bridges DomainBridge Y, gap magnitude 0.42, entity types mechanism/pathway"), the ONLY thing that crosses the wire to the Brain is that generic structural description - never the embedding vectors, never the source text, never node IDs traceable to this venture. The Brain's job on receipt is purely: given this SHAPE of signal, which framework/methodology best explains or advances it (Reverse Salient vs Intersectional Innovation vs ERRC vs BONO debate, per the FEEDS_INTO methodology chain already in the Brain's schema) - and it returns that recommendation as a DirectiveEnvelope, same as today. The Brain recommends the LENS; it never computes, sees, or influences the underlying differential math. This reinforces the existing "Brain recommends, never triggers" constraint (the 2026-07-01 handoff decision, reaffirmed by Phase 210's revert) - the framework proposal is advisory input to Larry's hedged offer, not a forcing mechanism.

Net: no new engine, no new wall around content. Phase 212 draws one interface boundary (calibration config, local-satisfied-today/Brain-satisfiable-later) and one data contract (structural-signal-out, framework-recommendation-in, zero content either direction). Both directives are additions to Phase 212's scope, not to 211's in-flight execution.

## D9 - when Larry actually invokes this: firing conditions below full-room, no-room, and the research-validation moment (navigator directive, 2026-07-05)

Answers "when does Larry invoke this, and does it need a full room, or any room at all" precisely, per mode:

- **Type 1 (present bridge) has a hard floor, but it is diversity, not completeness.** The differential needs at least two real content nodes spanning at least two distinct topic areas to have anything to bridge. A THIN room with 3-4 nodes across 2 domains can still surface a genuine Type 1 bridge; a room with 50 nodes all in ONE domain cannot, no matter how "full" it looks by artifact count. Community-bridge detection (the Brain's 39-community substrate) needs enough LOCAL nodes to form at least 2 distinguishable clusters - below that, any "bridge" is noise, not signal (this is the existing residual-risk/calibration concern, sharpened: the floor is measured in DOMAIN DIVERSITY, not room size).
- **Type 2 (whitespace/absent) needs the SAME diversity floor** - a structural hole is only meaningful relative to a graph dense enough to imply where an edge should exist.
- **Type 3 (pattern transfer / find-analogies) does NOT need the local graph to already contain the bridge, and can run with a THIN room or even effectively no prior room content.** Its retrieval targets the WEB (context + pattern search across domains), starting from a single articulated problem. This is the mode that answers "runs even without a full room" - it needs a problem statement, not a populated graph. Practical implication: an EMPTY or brand-new room should never silently suppress Eureka outright; it should route straight to Type 3 (pattern-transfer, online-leg-only) rather than waiting for local density that may never come from a thin room.
- **The strongest re-fire trigger is the moment a research fetch gets validated and written back**, not just idle graph state. SEED-049's own HSI example ("+0.193 after research - score, run Tavily, re-score, a before/after on the same function") already names this: the MOAT's fetch -> validate -> write-back loop (201-03) is exactly when the freshest, highest-signal new evidence enters the graph. SENS-13 should re-evaluate immediately after every 201-03 write-back completes, not only on a fixed poll/idle cadence - a validated research finding is the single highest-probability moment for a NEW bridge to have just appeared.
- **"Next framework after a eureka" is not a new decision to hand-author - it is what `lib/brain/chain-recommender.cjs::recommendFrameworkChain` (FEEDS_INTO traversal, Phase 122-03, confirmed live in this repo) already does.** The eureka-reach (213) should pass its result TYPE (1/2/3) as the seed into that existing recommender rather than hardcoding a next step. That said, the TYPE gives a real default lean the recommender can be seeded with: Type 1 (a secret connection) leans toward BONO debate or trending-to-absurd (stress-test how far the transfer holds - "if this bridge is real, what's its 50-year absurd extreme"); Type 2 (a structural hole) leans toward systems-thinking (map the feedback loops sustaining the gap) or root-cause (why has nobody filled it) before committing to build; Type 3 (a borrowed pattern) is itself already the analogical layer and commonly closes straight into a build/GRILL step. These are LEANS for the FEEDS_INTO seed, never a hardcoded chain - the Brain-recommended framework (D8) and the existing chain-recommender both stay authoritative over the actual next step.

## D10 - find-analogies (Type 3) needs its own embedding wiring; today it has none (navigator directive + room evidence, 2026-07-05)

Confirmed, not assumed - the rethinking-mindrianos room's own `research/2026-07-05-rebuild-vs-surgery/02-moat-embedding-audit.md` (lines 204-211) and the sibling `research/2026-07-05-cross-domain-ratification-analogies/` entry (a live Tier-0 run, dated the same day) both independently establish: **`/mos:find-analogies` at its default tier is FULLY STUBBED.** `commands/find-analogies.md:122-130` - Tier 0 is "generate 3-5 cross-domain analogies from your training knowledge," pure LLM reasoning against training data, zero embedding pipeline. The "Fitness 0.78 / 0.65 / 0.52" numbers the command's own output matrix shows are, in the audit's own words, "model-generated decoration, not computed." The live Tier-0 run in this room independently confirms this from the inside (its own author's note: "every analogy below is this model's reasoning against its training knowledge, not a retrieval against a measured embedding space... no fitness score in this document is computed").

This is a THIRD instance of the exact pattern SEED-049 already names as the unifying defect across every existing module (sound methodology, placeholder measurement) - alongside the model-judgment semantic leg (Part 1) and the hardcoded baseline (M2). find-analogies was not previously inventoried in that list; it belongs there explicitly now.

**What Phase 214 (Type-3 pattern-transfer + ONLINE leg) must therefore do, concretely, beyond what its GRADUATION entry above already says:** wire `find-analogies`' fitness scoring to the 211-01 embedding-spine so the SAPPhIRE-encoded source/target pairs get a REAL cosine similarity instead of an LLM-narrated label. Two distinct signals are needed, not one - do not assume text-embedding cosine alone suffices for a SAPPhIRE/TRIZ structural match:
- **Semantic/text fitness** - cosine over the 211-01 text embedding spine (Xenova/all-MiniLM-L6-v2), the same encoder every other lens uses. Answers "how similar do these two things SOUND."
- **Structural fitness** - the SAPPhIRE encoding's own typed fields (state_change, action, parts, phenomenon, real_effect - see the room's own `sapphire-encoding.md` layer-match rubric: Surface/Behavioral/Structural/Deep) are exactly the kind of thing graph-structural embeddings (node2vec / KG-embeddings, already named in SEED-049's architecture table for the STRUCTURAL leg) measure - isomorphism of RELATIONSHIPS, not surface text similarity. A text embedding alone will happily rate two SURFACE-similar, structurally-unrelated things as "close," which is precisely the false-positive SAPPhIRE's layer rubric exists to catch. find-analogies needs BOTH legs, fused, not a single embedding reused from the other lenses.
- The room's own qualitative "Surface/Behavioral/Structural/Deep" labeling scheme (already in use, already reasoned prose per pair) is a good STOPGAP acceptance target for 214's gate: the measured fitness score should rank-order consistently with the qualitative labels a domain-competent reasoner already assigns, not just produce a number nobody can sanity-check.

This is scope for Phase 214 specifically (it already owns Type-3/find-analogies), not a new phase - recorded here so the "find-analogies is basically done, it just needs the embedding plumbed in" temptation doesn't ship a lens that's still 100% decorative under real Phase-211/215 scrutiny.

## D11 - temporal awareness across every Eureka layer: reuse Phase 160's already-shipped spine, do not build a second clock (navigator directive, 2026-07-05)

Phase 160 (temporal-awareness-spine, COMPLETE, 6/6 plans) already shipped a full bitemporal, recency-aware, HITL-gated time substrate at `lib/core/temporal/`. Per Canon Part 7 (Reuse Before Build), Eureka consumes this - it does not mint a second clock, a second recency formula, or a second before/after-diff mechanism. Concrete mapping, layer by layer:

- **The reference clock (`reference-now.cjs::getReferenceNow()`)** - SENS-13's fire-rate/re-evaluation cadence (D9 above) anchors to this, not `Date.now()`. The precedence ladder (injected `currentDate` -> optional online skew-correction -> raw clock) already solves "what time is it" correctly; Eureka should not re-derive it.
- **Recency as a differential INPUT, not just a display detail (`recency-decay.cjs::rankByRecency`/`recencyScore`)** - a Type-1 bridge built from two STALE nodes (created long ago, never refreshed) deserves lower confidence than the identical bridge built from freshly-validated evidence. Fold the recency score into the differential's confidence, not just into how results are ordered on screen - a stale bridge and a fresh bridge should not read as equally trustworthy just because the raw cosine number is the same.
- **The before/after research delta IS `point-in-time.cjs::queryAsOf(db, nodeKey, T_tx, T_v)`, not a new diff mechanism.** SEED-049's own canonical example ("+0.193 after research - score, run Tavily, re-score") is exactly a bitemporal point-in-time query: call `queryAsOf` for the node state BEFORE the fetch landed and again AFTER, and the delta is the eureka signal. Phase 214's "verified write-back" delta computation (the MOAT section above) should be built directly on this existing function, not a hand-rolled before/after comparison.
- **Non-lossy revision when a bridge gets refuted or strengthened (`supersession.cjs::supersede(db, oldNodeId, newNodeId, opts)`)** - when fresh research changes a differential score enough to flip a finding's verdict, supersede the old eureka node rather than overwrite it. History is preserved (Decision 14: ventures can regress, history is preserved) - a refuted eureka is data, not an embarrassment to delete.
- **The date-sync HITL gate (`date-sync-gate.cjs::requireValidAt`) extends to eureka findings that cite dated real-world sources** - a Type-1/Type-3 finding built from two externally-dated facts (a 2019 paper, a 2015 industry standard) is exactly the `isRealWorldEvent` case the gate already exists to catch. If Eureka write-backs skip this gate, the temporal-blindness sentinel (already shipped, `sensor-temporal-blindness.cjs`) will silently undercount Eureka's own findings as a blind spot in its own coverage.
- **Dual-stamped events (`dual-stamp.cjs::logDualStampedEvent`)** - every eureka finding gets both a speaking-time stamp (when Larry surfaced it) and a reference-time stamp (when the underlying evidence's content-time is), exactly like every other dual-stamped event in the system already does. This is what lets a later query distinguish "this bridge was found in July" from "this bridge is ABOUT a change that happened in March" - both matter, and conflating them is the generic temporal-blindness failure mode Phase 160 was built to close everywhere else.

Net: zero new temporal infrastructure for Eureka. Six existing functions, six integration points, one per layer - Phase 212 (which already owns graph-framed substrate + calibration) and Phase 214 (write-back delta) are where these get wired in, not a new phase.

## D12 - the room/sub-room boundary is a real blind spot for bridge-finding, confirmed in the actual scanner code (navigator directive, 2026-07-05)

Rooms are fractal by design (Decision 10, Nested System Architecture; `sub-rooms/` per `lib/vault/room-scanner.cjs`), and 211-02 (tri-modal room.db) does not currently account for this - confirmed, not assumed, by reading the scanner:

- `findSubRooms(roomDir)` (`room-scanner.cjs:197-221`) recurses exactly ONE level: `room -> sub-rooms/<name> -> sections`. A sub-room that itself contains a further `sub-rooms/` directory is invisible to `scanRoom()` entirely - the function never calls itself recursively. True fractal depth beyond one level is a confirmed, unaddressed gap in the scanner itself, not a hypothetical.
- Per the scanner's own design (each sub-room "owns its own room.db and rebuild pass," stated in `lazygraph-ops.cjs`'s walk logic read earlier this session), sub-rooms get SEPARATE tri-modal indexes under the current architecture. 211-02, built on `scanRoom()`, will naturally index only a room's own direct sections - a sub-room's content lives in an entirely different SQLite file.
- **The consequence for Eureka:** a genuine Type-1 bridge between a parent room's node and a sub-room's node (or between two sibling sub-rooms) is structurally unfindable by either graph alone, no matter how good the embedding math is - the two sides of the bridge are never in the same tri-modal index to be compared. This sits in a gap BETWEEN 211-02's room-scoped index and Phase 195's cross-room aggregator (`cross-room-aggregator.cjs`, already named in this seed's capstone section as a differential-upgrade target) - 195 handles separate TOP-LEVEL rooms; nothing today handles a room and its OWN nested sub-rooms as bridge candidates.

**Not 211-02's problem to solve today** (its PLAN.md scope is a single room's tri-modal index, confirmed by re-reading it - no sub-room mention). This is recorded as a scope gap for whichever phase should own cross-boundary bridging - most likely Phase 212 (already extending what the graph structurally covers) or Phase 215 (portfolio-scale batch-scoring, which already implies scoring across more than one venture-scoped graph). Do not let 211-02 ship as "the tri-modal engine" without this caveat attached: it is the tri-modal engine for ONE room's own flat section set, not yet for the fractal room/sub-room tree.

## D13 - room's own commissioned diligence (2026-07-05, ratification-pending), read late, reconciled against what already shipped

`research/2026-07-05-eureka-critic-brain-mcp-plan/2026-07-05-eureka-technical-diligence.md` is a formal web-researched due-diligence pass against the SAME seven locked decisions this seed graduated into Phase 211/212 - `ratification_status: proposed`, `ratification_target: "before Phase 211/212 execution begins"`. It was not consulted before 211-01/211-02 executed. Reconciled here, honestly, against what is now merged:

- **D1 (sqlite-vec):** REFINE, matches what shipped on the version pin (>=0.1.9 installed exactly), but the recommended adapter seam (one file owning insert/knn-query/delete, so a future swap to sqlite-vector or v0.1.10's ANN path is a one-file change) was NOT built. Tracked as a follow-up.
- **D2 (retire Python LSA):** CONFIRMED, matches what shipped.
- **D3 (embedding model): DOES NOT MATCH.** The diligence flags `Xenova/all-MiniLM-L6-v2` as a 2019-era model with documented 2025-2026 replacements (MongoDB/mdbr-leaf-ir as primary candidate pending an ONNX-load spike, `Xenova/bge-small-en-v1.5` as the safe fallback already first-class in transformers.js) and flags the hardcoded 384-dim assumption as a structural liability (should be a per-room schema value, since leaf-ir's native output is 768-dim, MRL-truncatable). 211-01 shipped with the original, now-outdated choice. Navigator decision 2026-07-05: file a follow-up fix (do not let this sit un-ratified) - spike the newer model, keep the adapter-seam pattern from D1, make `embedding_dim` schema-driven. Queued to run once 211-05 merges (avoids touching `embedding-spine.cjs` under a live in-flight wave).
- **D4 (FlashRank): matches what shipped**, and was already correctly resolved in `211-CONTEXT.md` independently of this diligence doc (FlashRank's Python library rejected per SEED-013; its model served via transformers.js instead) - confirms the dev-repo planning process caught this one on its own even before the diligence doc was read this session.
- **D5 (RRF k=20-30): matches what shipped** (k=25 default, exactly as recommended).
- **C1/C2 (Phase 212's critic architecture) - not yet built, still fully actionable, and it sharpens D7/D8 above rather than contradicting them.** The diligence's literature review (LLM-as-judge novelty-assessment failures: RQ-Bench, HindSight, the Ideation-Execution Gap, "Reliability without Validity") backs D7/D8's existing design with real evidence, not just architectural instinct: (1) the NOVELTY judgment itself must stay LOCAL, content-grounded, with explicit rubric probes and evidence citations - an LLM judging blind on abstracted features alone reproduces the exact "rankings meaningful, decimals decorative" defect this whole seed exists to close; (2) the REMOTE side must be a statistical calibration model trained on a human-labeled gold set (150-300 items minimum), not a second LLM judge - this is D7's calibration-layer-only-remote seam, now with a concrete minimum gold-set size; (3) the wire schema must be frozen to scalars/bounded-enums/bucketed-counts ONLY, with embeddings and text spans explicitly prohibited BY NAME - critically, the diligence cites Vec2Text (arXiv 2310.06816, up to 92% exact reconstruction of 32-token inputs from dense embeddings) as concrete proof that an embedding is NOT a safe abstraction, which is the strongest evidence yet for D8's "never the embedding vectors, never the source text" rule. Phase 212's CONTEXT.md, when written, should cite this diligence doc directly rather than re-deriving the same conclusions from scratch.

**Process note, stated plainly:** this room diagnosed its own disease (the ratification-gap entry, `research/2026-07-05-reverse-salient-ratification-gap.md`, and the CAPA/NTSB/RCA2 analogies that followed it) - a correct, evidenced finding sitting unconverted because nothing forced the conversion before action proceeded. This diligence doc, sitting at `ratification_status: proposed` while Phase 211 executed anyway, is a live instance of exactly that failure, caught only because the navigator asked directly whether the room's findings were actually used. The composite mechanism that research entry recommended (status + owner/date + strength, checked by tooling rather than memory) would have caught this automatically.

## D14 - can any user actually run this stack (navigator directive, 2026-07-05): mostly yes already, one real gap named

Checked against the plugin's own distribution model rather than assumed. Findings:

- **npm dependency install: already solved, pre-existing mechanism.** `scripts/sessionstart-npm-reconcile.cjs` (Phase 95.6 D-05d) is a SessionStart hook that runs `npm install` automatically on CLI whenever a declared `package.json` dependency is missing from `node_modules` - idempotent, defensive (any error -> `{continue:true}`, never blocks the hook chain). `@huggingface/transformers` and `sqlite-vec` are regular `dependencies` entries (confirmed in `package.json`), so this existing mechanism covers them with zero new code. On Desktop/Cowork the hook is a documented no-op; those surfaces rely on the host's own plugin-install mechanism to manage `node_modules` - this is an ASSUMPTION carried over from before this session, not verified in this session, and is the one item in this list not independently re-checked here.
- **sqlite-vec native binary: has a fallback, already shipped.** 211-02 built the semantic leg with sqlite-vec as primary and a pure-CJS cosine fallback (confirmed in its SUMMARY) - if a platform lacks a prebuilt sqlite-vec binary, npm's own `optionalDependencies` resolution plus this fallback keeps the feature working, just slower. No action needed beyond what already shipped.
- **Offline / encoder-unavailable: already graceful.** `embedding-spine.cjs` degrades to an `encoder_unavailable` warning state without throwing (confirmed via its own test suite, Test 3/9) - matches Decision 8 (Tier 0 fully functional, no dependencies).
- **The one real open gap: the first-use MODEL DOWNLOAD itself.** Installing the npm packages is not the same event as fetching the actual ONNX model weights (Xenova/all-MiniLM-L6-v2 today, whichever model the D3 fix lands on) from the Hugging Face Hub - that download (tens of MB) happens lazily on the FIRST real embedding call, over the network, into a cache directory (`MINDRIAN_MODEL_CACHE` override already exists, confirmed in `embedding-spine.cjs:165`, but the DEFAULT cache location's cross-platform behavior - Windows/macOS/Linux, and specifically any Desktop/Cowork sandbox - has not been verified this session). Nothing today gives the user a friendly Larry-voiced heads-up that this is happening the first time ("fetching a small local model, one-time, ~2 seconds to a minute depending on connection") - a user's first Eureka-powered command could just pause silently.
- **Recommended fix, small, follows an existing pattern exactly:** add an `--eureka-smoke` class to `scripts/doctor.cjs`, mirroring the already-shipped `--brain-smoke` 5-layer-probe pattern (documented in `CLAUDE.md`'s Verification section). Layers: (1) both packages present in `node_modules`, (2) sqlite-vec extension loads or the CJS-cosine fallback engages cleanly, (3) a real model-load probe with a short timeout, reporting cache location and hit/miss, (4) offline behavior confirmed graceful, (5) roll into `doctor --acceptance` the same way Brain smoke already is. Separately, wire a first-run Larry-voiced notice (once, not every call) into whatever surface first triggers a real embedding call, so the download is explained rather than silent.

Not urgent enough to block anything in flight; recorded as a small, scoped follow-up alongside the D3 fix task, not a new phase.

## D15 - THE BIG ONE: tested against a real production room for the first time, and the tri-modal index reads TITLES, not content (navigator directive, 2026-07-05: "test the engine against the aion room")

Ran `scripts/eureka-room-report.cjs --db ~/MindrianRooms/aion-eureka-synergy --top 50` live (real model, real download, sqlite-vec backend) against a genuine, mature, real-world venture room (the AION Labs C08 demo build, 639 nodes, 83 real claim nodes, 10 governing_thought nodes, documented in `.planning/debug/aion-eureka-demo-build-qa-session.md`). Result: **0 pairs scored, 0 candidates.** Not a crash, not a config error - traced to ground truth.

**Root cause, confirmed by direct SQL inspection, not inferred:**

- `lib/core/eureka/tri-modal-index.cjs::nodeText(row)` extracts text via `props.name || props.text || props.title || props.governing_thought` ONLY.
- The aion room's 83 `claim` nodes store `{knowledge_type, conditions, counter_conditions, valid_from, valid_until, source_speaker, source_segment}` - none of those keys match. Its 10 `governing_thought` TYPE nodes store `{section, hash, freshness}` - the property key `governing_thought` does not actually exist on them (a naming collision between the node TYPE label and the property KEY `nodeText()` checks for). Its `memory_event`/`memory_artifact` nodes (545 combined) carry bookkeeping (session ids, event types, file hashes) - also no match.
- The room's `facts` table (the schema explicitly designed for subject/predicate/object claims, confirmed via `sqlite_master`) is EMPTY - 0 rows. Real claim substance was never duplicated into either `nodes.properties` or `facts`.
- **Every one of the 639 nodes in this real room produced empty `indexedText()`.** `indexNodes()`'s own `items.length > 0` guard correctly refused to mark `embedded: true` on zero real items - not a false report, an honest one. The pipeline degraded exactly as designed; it just had nothing to degrade FROM.
- Cross-checked against `rethinking-mindrianos`'s room.db (which DID score 6054 pairs earlier this session, offline/stub mode): its signal comes from `Artifact`-type nodes' `title` field (28 nodes, e.g. `"M-Series Architectural Mandates: the disease was already diagnosed"`) - i.e. **document TITLES**, not claim bodies. Its `WhitespaceZone` nodes (143 of them, from a prior `/mos:whitespace` run) carry a real `hypothesis` field with substantive text, but `hypothesis` is not in `nodeText()`'s checked key list either, so even those are currently invisible to the differential.

**What this means, stated plainly:** the tri-modal engine, as shipped, has never actually differentiated real claim-level content. Every test that "passed" so far (211-02's own tests, the offline smoke, the rethinking-mindrianos 6054-pair run) exercised either synthetic fixtures with convenient field names, or a real room's document TITLES standing in for content. The deep, claim-to-claim cross-domain bridging this whole seed exists to build - "circadian rhythm optimization" bridging to "manufacturing shift scheduling" at the level of actual research substance, not just filenames - has not yet been exercised against one real claim. This is the same "sound methodology, placeholder measurement" pattern SEED-049 names as the unifying defect across every pre-existing module (§"The unifying pattern") - now found in the very engine built to fix it, one layer deeper than expected.

**Why this happened architecturally, not carelessly:** MindrianOS's own stated design (CLAUDE.md: "the filesystem is the source of truth, no DB for room state") means `room.db`'s `nodes` table is deliberately a STRUCTURAL/provenance graph - pointers, hashes, session bookkeeping - not a content-duplication store. Real claim/section text lives in the room's actual markdown files (`problem-definition/*.md`, `research/*.md`, per-section `MINTO.md`), referenced by the node's `source_segment`/`section`/`path`/`hash` fields, never inlined. `nodeText()` was written as if node.properties inlines content; it needed to resolve the POINTER back to the file instead. This is the identical shape of gap the qi8 fix (nested-artifact graph indexer) already closed once this session for a different code path (`section-registry.cjs`) - the same lesson (graph nodes reference content, they do not contain it) needed to be relearned here.

**Sharper still - confirmed the exact write-side root cause for `claim` nodes, this is NOT a "the room is old/weird" story.** Read `lib/core/navigation/typed-claim.cjs::writeClaimNode` in full (the ONLY chokepoint that writes `claim`-type nodes, used by the `/mos:file-meeting` extraction path per its own header comment). Its signature REQUIRES `params.text` (`if (typeof text !== 'string' || text.length === 0) return {ok:false, reason:'invalid_text'}` - the function refuses to write without real claim text). But the `props` object actually serialized into `properties` only ever contains `{knowledge_type, conditions, counter_conditions, valid_from, valid_until, source_speaker, source_segment}` - **`text` is read, validated as mandatory, used ONLY to compute a fallback idempotency-hash key when `sourceSegment` is absent, and then silently discarded. It is never written anywhere.** Every claim node this chokepoint has ever produced, on any room, any version, has permanently lost its actual claim sentence at write time. This is not a legacy-room artifact and not a stale-schema-version story - it is a live, present-tense bug in the current `main` branch's only claim-writing path. Confirmed identical behavior across two independent rooms built on two different plugin versions three weeks apart (aion-eureka-synergy, beta.30; rethinking-mindrianos, beta.10/11) is exactly the signature of a write-side code defect, not a room-side data-quality issue.

**What "done" looks like, revised with this sharper finding:**
1. **The real fix, and it's small:** `writeClaimNode` should add `text: text` to `props` (one line). This is a WRITE-SIDE fix, upstream of Eureka entirely - it fixes the claim-content gap for every future claim written from this moment forward, no migration needed for new data.
2. **The gap this does NOT close:** every claim already written before the fix lands has no recoverable text (it was never stored, not even behind a pointer) - those are permanently empty unless the original meeting transcript is still on disk and can be re-extracted through the segment reference. Worth a quick census of how many `claim` nodes exist room-wide before deciding whether backfill is worth attempting versus accepting the loss for pre-fix data.
3. **Read-side fallback still needed for other node types**, independent of the claim-writer fix: `nodeText()`/`indexedText()` should follow `Artifact`/`memory_artifact` nodes' `path` field back to the actual file for real body content (not just frontmatter title), via the same markdown-parsing convention `lib/vault/room-scanner.cjs` already uses (Part 7 reuse). Add `WhitespaceZone`'s real `hypothesis` field (and any other analysis-output node type's real content field) to the checked key list rather than assuming a fixed four-key list covers every node type MindrianOS produces.
4. **Before touching either fix, audit every OTHER node-writer** (`memory-artifacts.cjs`'s `writeDecisionNode` is name-checked in `typed-claim.cjs`'s own comments as sharing the same no-downgrade pattern - worth checking it doesn't share this same drop-the-text defect) for the identical "accepts real content, never persists it" shape before assuming `claim` is the only node type affected.

**Scope and priority:** this is bigger than a "fix" task alongside D3/D14 - it is the single highest-leverage remaining item before Eureka can be said to work on a real room at all, and it likely belongs at the START of Phase 212 (Substrate Grounding Guard is precisely "frame the differential over the right entity types" - D6's own concern - and cannot do that if the entities have no extractable content in the first place). Recommend Phase 212's CONTEXT.md open with this finding, not discover it again independently.
