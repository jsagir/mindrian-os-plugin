# SEED-049 - The Mindrian EUREKA Engine (tri-modal room.db + tri-source hybrid retrieval, one engine many lenses)

> Framing (navigator, 2026-07-02): these are **EUREKA engines** - breakthrough DISCOVERY, "find the gem nobody saw" - NOT "intelligence" engines. The name is the point: the output is a eureka (a measured, defensible cross-domain opportunity), not a generic intelligence readout.

**Registered:** 2026-07-02 (navigator-directed; agno-docs-mcp trigger + tri-source vision)
**Class:** CODE + ARCH | **Status:** seed
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

- **lexical** = Jaccard over word sets, `|A intersect B| / |A union B|` - real, reproducible, cheap.
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

## Provenance - how we got here (navigator: "this is very important", 2026-07-02)

This seed did not start as a plan; it EMERGED from a conversation. The trigger was agno-docs-mcp (https://github.com/CENFARG/agno-docs-mcp): studying it revealed that high-quality retrieval runs INSIDE SQLite via FTS5 + BM25 with ZERO Python - the lexical leg MindrianOS lacked. That one observation opened the thread:

`agno FTS5 lesson` -> "can our SQLite do better" -> tri-modal room.db (graph + FTS5 + vectors) -> tri-source engine (local / remote / online) -> reverse-engineering the LIVE 6-module RS/differential pipeline (the `bert - lsa > 0.30` primitive, the directional RS structural_transfer vs semantic_implementation, market-adjacency, the circadian->manufacturing eureka) -> the discovery that EVERY module pairs a SOUND methodology with a PLACEHOLDER measurement (model-judgment / hardcoded baseline / keyword dictionary) -> the MOAT (the graph drives the fetch AND frames the analysis, compounding via the 201-03 write-back) -> the Mindrian-only substrate (ICM layers + Feynman-MINTO distilled retrieval) -> wiring it into LarryReacts + Shape-F + Phases 188-205 so Larry DRIVES and CONTEXTUALIZES eureka moments.

The lesson agno taught (FTS5 lexical, no Python) is the SMALLEST piece; the journey from it is the whole engine. Recorded here so the origin is not lost.

## Verification log (2026-07-02, this repo)

- `node:sqlite` FTS5: AVAILABLE (live bm25 query returned a ranked hit). SQLite 3.51.2, node v22.22.2.
- `node:sqlite` extension loading: AVAILABLE (`allowExtension:true` accepted; `db.loadExtension` exists) -> sqlite-vec loadable if built for platform; CJS-cosine fallback otherwise.
- `@huggingface/transformers`: NOT yet a dependency (would be a new Node/lab dep; no Python).
- LSA today: Python-bound (`lib/core/rs_math.py`, `rs_hybrid.py`, `scripts/compute-hsi.py`, `detect-reverse-salients.py`); `rs-differential-scorer.cjs` is already a CJS port (precedent for the port).
