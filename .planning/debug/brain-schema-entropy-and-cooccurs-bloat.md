---
status: diagnosed
trigger: "brain-schema-entropy-and-cooccurs-bloat — MindrianOS Brain (Neo4j) degraded into schema entropy + co-occurrence bloat; diagnose root cause + remediation plan + Memgraph migration assessment"
created: 2026-05-10T00:00:00Z
updated: 2026-05-10T00:00:00Z
read_only_investigation: true
---

## Current Focus

hypothesis: CONFIRMED — the Neo4j engine is not the problem. The problem is the absence of an ontology gate on the *upstream* ingestion pipeline (`~/Mindrian/mindrian-deploy/`), specifically: (1) an LLM extractor (`langextract` + gemini filesearch) that writes arbitrary node labels and arbitrary `MERGE`d relationship types straight to Neo4j with no vocabulary constraint, and (2) a spaCy co-occurrence indexer (`lazy_graphrag_index.py`) that fans out O(n²) `CO_OCCURS` edges per chunk with `MIN_CONCEPT_FREQ=1` and no minimum-weight write filter, producing a 119K-edge dense mesh over 7,578 `LazyGraphConcept` nodes. A prior "claude-skill" relabel run (2026-02-05) made it worse by demoting 869 originally-`Framework` nodes into the generic `Concept`/`__Entity__` blob (most are now invisible to `MATCH (f:Framework)`).
test: read-only Cypher quantification + reading the writer code paths.
expecting: (done) — see Evidence below.
next_action: deliver diagnosis + remediation plan + Memgraph verdict (this file). No graph mutations performed; all destructive fixes proposed as plan only.

## Symptoms

(as supplied — see <symptoms> block in the task; measured live 2026-05-10. Confirmed: 23,466 nodes / 166,960 rels / 100 orphans / 1,640 distinct rel types / 824 distinct labels / CO_OCCURS = 119,706 = 71.7% of all rels.)

## Eliminated

- hypothesis: "Neo4j Aura is hitting a scale/perf wall (the engine is the bottleneck)."
  evidence: 23K nodes / 167K rels is two-to-three orders of magnitude below Aura Free's comfortable ceiling; the "real" post-cleanup graph is ~15K nodes / ~25K edges. Zero query in the codebase is latency-bound; every downstream pain point is *retrieval correctness / recall* (under-retrieval because labels are fragmented), not latency. Migrating engines moves zero of the actual cost.
  timestamp: 2026-05-10

- hypothesis: "The MindrianOS-Plugin writers (admin-brain-write.cjs, whitespace-to-brain.cjs, brain-derivation.cjs) are causing the entropy."
  evidence: Those writers all use a *frozen* vocabulary — `WhitespaceZone`, `WhitespacePattern`, `EXPLORED_BY`, `TYPICAL_WHITESPACE`, `USES_TECHNIQUE`, `ProcessStep`, deterministic hashes, provenance scalars. They are Canon Part 8-compliant and bounded. The entropy is entirely upstream in `~/Mindrian/mindrian-deploy/` (the Chainlit production app's ingestion scripts).
  timestamp: 2026-05-10

- hypothesis: "`__Entity__` (5,747 nodes) is itself lint."
  evidence: `__Entity__` is the standard Neo4j LLM-Graph-Builder marker label; 5,594 of those nodes carry embeddings and also carry a real secondary label (Product 1263, Event 979, Person 323, Concept 732, ...). It is not lint per se — but the lack of an ontology means the *secondary* labels under it are the fragmented mess (Product vs InnovationOpportunity vs CreativeWork, etc.). The marker label is fine; the schema underneath it is the problem.
  timestamp: 2026-05-10

## Evidence

- timestamp: 2026-05-10
  checked: live schema counts (python neo4j driver, read-only, ~/brain_query.py)
  found: 23,466 nodes; 166,960 rels; 100 orphans; **1,640** distinct rel types; **824** distinct node labels.
  implication: confirms the reported numbers. ~700 of the 824 labels and ~1,294 of the 1,640 rel types are long-tail noise.

- timestamp: 2026-05-10
  checked: long-tail quantification
  found: **1,294 of 1,640 rel types (79%)** have count ≤5 and together account for only **2,330 of 166,960 rels (1.4%)**. **363 of 824 labels** have ≤2 nodes; **289 are singletons**. Of those singleton-label nodes, 286/289 have NO `source` property (written by an extractor that didn't even tag provenance).
  implication: the vocabulary explosion is pure unconstrained-LLM-extraction artifact, not signal. It is safely collapsible to a small fixed vocabulary.

- timestamp: 2026-05-10
  checked: `MATCH (a)-[:CO_OCCURS]->(b) RETURN labels(a)[0], labels(b)[0], count(*)` + `keys(r)` + weight histogram
  found: CO_OCCURS = 119,706. Endpoint breakdown: LazyGraphConcept→LazyGraphConcept 77,465; LazyGraphConcept↔Concept ~37,860; Concept→Concept 4,375; Framework→Framework only 6. Every CO_OCCURS edge carries only a `weight` int. Weight histogram: **weight=1 → 109,544 (91.5%)**, weight=2 → 9,102, weight≥3 → ~1,055. LazyGraphConcept node degree: median 25, mean 33, max 1,338. LazyGraphConcept connects to the rest of the graph ONLY via `MENTIONED_IN`→Chunk (11,712) and a handful of `ALIAS_OF` edges (~424 total) — it is a near-isolated dense subgraph.
  implication: CO_OCCURS is statistical lint. 91.5% of it is "these two noun-phrases appeared in the same chunk exactly once." It is not curated knowledge, it does not connect meaningfully to the teaching core, and downstream traversals that touch `LazyGraphConcept` get drowned. `enrichCausalEdges()` in brain-client.cjs even filters `CO_OCCURS` by `co.weight >= minConfidence` where minConfidence defaults to 0.5 — so a weight-1 edge passes; the "filter" is a no-op.

- timestamp: 2026-05-10
  checked: node provenance properties (`keys(n)` histogram + `relabeled_by` / `former_label`)
  found: 7,569 nodes carry `chunk_count`/`chunk_ids`/`degree`/`community_id` (the Microsoft-GraphRAG / Louvain fingerprint = the LazyGraphConcept population). **869 nodes carry `former_label: "Framework"` + `relabeled_by: "claude-skill"` + `relabeled_date: "2026-02-05"`** — 750 of them relabeled to `Concept`, 119 to `__Entity__`. Sample of the demoted nodes: "Strategic Foresight", "Platform Thinking Framework", "BONO Innovation Framework", "Validated Learning", "Dominant Design" (real frameworks) MIXED WITH "Anthony W. Ulwick", "Steven Johnson", "Ian Mitroff", "John Howells" (people — should be Person/Author) MIXED WITH "Slow message delivery", "Cumbersome commerce", "Uncomfortable glasses" (JTBD problem-statement examples from *The Innovator's Solution* — should be Problem/Example). Only 1 of the 750 demoted nodes has an embedding; 619 have a `description`.
  implication: there was a prior cleanup attempt that made things *worse*. It bulk-demoted curated `Framework` nodes (and a grab-bag of people and problem statements that had been wrongly labeled `Framework` by the extractor in the first place) all into `Concept`/`__Entity__`. This is the direct cause of "THE-BRAIN.md says 275+ frameworks but `MATCH (f:Framework)` returns 100" — ~750+ true frameworks are hiding under `Concept`. The relabel was almost certainly triggered by the `framework_name_unique` constraint on `Framework.name`: the extractor tried to MERGE a Framework with a name collision, the constraint rejected it, and the fallback wrote it as `Concept`.

- timestamp: 2026-05-10
  checked: `~/Mindrian/mindrian-deploy/scripts/lazy_graphrag_index.py` (the CO_OCCURS writer)
  found: `MIN_CONCEPT_FREQ = 1` (keeps every noun-phrase seen once), `MIN_PHRASE_LENGTH = 3` chars, concepts come from spaCy `noun_chunks` over arbitrary chunk text. Edge construction (lines 199-205): `for i in range(len(concepts)): for j in range(i+1, len(concepts)): edge_weights[pair] += 1` — every pair of concepts in a chunk gets a CO_OCCURS edge → O(n²) per chunk. Write (lines 295-301): `MERGE (a)-[r:CO_OCCURS]-(b) SET r.weight = edge.weight` — no `WHERE weight >= threshold`. Nodes are `MERGE (n:LazyGraphConcept {name})` — re-running the script ACCUMULATES; there is no run-id, no provenance, no idempotent-replace. `ingest_extractions_to_neo4j.py` *also* writes `LazyGraphConcept` nodes (a second, lowercase-name path) from langextract output — so two different pipelines populate the same label with different normalization.
  implication: this is the mechanical root cause of the 119K-edge mesh. Each ingestion run with ~750 chunks each containing ~10-30 spaCy noun-phrases produces tens of thousands of weight-1 edges, and re-runs pile on top.

- timestamp: 2026-05-10
  checked: `~/Mindrian/mindrian-deploy/scripts/ingest_extractions_to_neo4j.py` (the rel-type explosion writer) + `~/Mindrian/mindrian-deploy/tools/graphrag_lite.py` + langextract path
  found: `create_relationship()` (lines 247-267) takes `rel_type` straight from the LLM's `graph_connections` output (free text like `"Six Thinking Hats -[ENHANCES]-> JTBD"`), does `re.sub(r'[^a-zA-Z0-9_]', '_', rel_type.upper())` (sanitize for Cypher-safety ONLY), then `MERGE (s)-[r:{rel_type_safe}]->(t)`. No allow-list, no mapping to a canonical edge vocabulary. `_guess_node_label()` (lines 336-357) heuristically guesses a label and always falls through to `Framework` — but the LangExtract/gemini-filesearch extractor writes its own arbitrary labels (the ~600 long-tail labels: QuantumEcologyManifesto, CostcoSuccessFactors, WindTurbineAnalysis, AssessmentRecommendations, ...). The Chainlit CLAUDE.md even ships a `tools/ontology_designer.py` "for generating graph schemas" — but it is a standalone CLI that was *never wired into the write path*; ingestion does not consult any ontology.
  implication: the schema entropy root cause is "LLM output → sanitize-for-cypher → MERGE, with no ontology constraint." Every extraction run lets the model invent new labels and edge names. ~50 distinct rel types in the `*_FRAMEWORK` family alone (USES_FRAMEWORK, USED_FRAMEWORK, APPLIED_FRAMEWORK, INTRODUCES_FRAMEWORK, PROVIDES_FRAMEWORK, IMPLEMENTS_FRAMEWORK, CRITIQUES_FRAMEWORK, SUGGESTS_FRAMEWORK, DEMONSTRATES_FRAMEWORK, ...) all meaning roughly the same thing.

- timestamp: 2026-05-10
  checked: constraints / indexes (`SHOW CONSTRAINTS`, `SHOW INDEXES`)
  found: ~55 UNIQUENESS constraints — all of the form "`<Label>.id` IS UNIQUE" or "`<Label>.name` IS UNIQUE" for specific labels (Framework, Concept, Tool, Technique, LazyGraphConcept, Person, ProblemType, ...). There is NO constraint that bounds *which* labels or *which* rel-types may exist (Neo4j has no native mechanism for that anyway). There IS a `framework_name_unique` constraint on `Framework.name` (the likely trigger for the demotion-to-Concept fallback). Vector indexes exist on `Concept.embedding`, `__Entity__.embedding`, `Framework.embedding`, `Person.embedding`, `Product.embedding`, `CreativeWork.embedding`, `Chunk.embedding` — i.e. embeddings are scattered across 7 labels, and `Framework.embedding` covers only 6 nodes.
  implication: per-label uniqueness constraints are not an ontology gate. The gate has to live in application code (the writer), not the database.

- timestamp: 2026-05-10
  checked: the curated "teaching core" health
  found: `Framework(100)`: zero isolated, avg degree 21.8, max degree 191 — but only 6/100 have an `embedding`, 77/100 have a `description`, 17/100 have a `purpose`; AND the label is polluted with mislabeled steps ("Define the Focal Component (Level 1)", "Building an 'opposite plan'...", "Domain Selection") that are framework *steps* not frameworks. `FEEDS_INTO=167` (110 Framework→Framework, the rest leak to `__Entity__`). `ADDRESSES_PROBLEM_TYPE=157`. `ProblemType(24)` but with overlapping taxonomy (Ill-Defined Problem / Undefined Problem / Undefined + Wicked / Ill-Defined + Wicked all coexist). `HAS_PHASE=75`, `HAS_STEP=195`, `APPLIED_IN=24`, `PREREQUISITE=17`, `TEACHES=409`. `Book(64)`. ~7,005 nodes carry an `embedding` (mostly `__Entity__`, `Product`, `Chunk` — i.e. ingested entities, not the framework core).
  implication: the teaching core is *structurally* sound (well-connected, the moat edges exist) but is (a) under-labeled (true frameworks scattered across Framework/Concept/InnovationFramework/Technique/Method/Methodology/Tool/InnovationTool/ResearchTool/etc., ~750 of them demoted), (b) under-embedded (the framework_embeddings vector index is nearly empty), and (c) lightly polluted with mislabeled step-nodes. THE-BRAIN.md's claims ("Framework 275+", "21K nodes / 65K rels") are stale on every axis.

- timestamp: 2026-05-10
  checked: downstream read patterns — `mcp-server-brain/lib/brain-ask.cjs`, `lib/core/brain-client.cjs`
  found: `brain-ask.cjs` CYPHER_PATTERNS: every "framework/methodology/tool/technique" intent runs `MATCH (f:Framework) WHERE toLower(f.name) CONTAINS $kw ...` — i.e. it is hard-coded to the `Framework` label and therefore blind to the ~750 demoted frameworks. The `general` fallback runs `MATCH (n) WHERE any(prop IN keys(n) WHERE toLower(toString(n[prop])) CONTAINS $kw)` — a full-graph property scan over all 23K nodes including the 7.5K LazyGraphConcept mesh → noisy returns. `brain-client.cjs` `enrichCausalEdges`/`hatAwareRecommend`/`suggestValidationSteps`/`getFrameworkChain` all start `MATCH (f:Framework)...` and traverse `FEEDS_INTO`/`CO_OCCURS`/`ADDRESSES_PROBLEM_TYPE` — so they see the 100-node curated slice (good for FEEDS_INTO, useless for CO_OCCURS since only 6 Framework→Framework CO_OCCURS edges exist; the CO_OCCURS query in `enrichCausalEdges` returns essentially nothing useful, while `MATCH path = (root:Framework)-[:CO_OCCURS*1..3]->(leaf:Framework)` is at risk of touching the LazyGraphConcept mesh if any Framework node happens to share a name with a LazyGraphConcept).
  implication: the blast radius is silent under-retrieval. Larry's Brain-enriched answers are working off ~13% of the framework corpus (100/~750) and getting zero useful signal from the single largest relationship type (CO_OCCURS), while the `general` fallback is noise-prone. No errors fire; the system just quietly returns less than it should.

## Resolution

root_cause: |
  Three compounding causes, in order of impact:

  RC-1 (schema entropy) — The upstream ingestion pipeline in `~/Mindrian/mindrian-deploy/` writes LLM-extracted nodes and relationships to Neo4j with NO ontology gate. `ingest_extractions_to_neo4j.py:create_relationship()` MERGEs whatever relationship name the LLM emits (after a cypher-safety regex only); the LangExtract/gemini-filesearch extractor writes whatever node label the LLM emits. Result: 1,640 rel types (79% of them ≤5 uses) and ~700 one-off node labels. The `tools/ontology_designer.py` that exists in that repo was never wired into the write path.

  RC-2 (CO_OCCURS bloat) — `~/Mindrian/mindrian-deploy/scripts/lazy_graphrag_index.py` builds a spaCy noun-phrase co-occurrence graph with `MIN_CONCEPT_FREQ=1` and writes ALL pairs as `MERGE (a)-[:CO_OCCURS]-(b) SET r.weight=w` with no minimum-weight filter, O(n²) per chunk. Re-runs accumulate (MERGE-by-name, no run-id). `ingest_extractions_to_neo4j.py` also writes `LazyGraphConcept` nodes from a second path with different name normalization. Result: 7,578 `LazyGraphConcept` nodes + 119,706 `CO_OCCURS` edges (91.5% weight=1), a near-isolated dense mesh that is 72% of the entire graph and is statistical lint, not knowledge.

  RC-3 (a botched prior cleanup) — On 2026-02-05 a "claude-skill" run relabeled 869 nodes from `Framework` to `Concept`/`__Entity__`. It demoted ~750 genuine frameworks (Strategic Foresight, Platform Thinking, BONO Innovation Framework, ...) plus a grab-bag of people and JTBD problem-statement examples that the extractor had wrongly labeled `Framework`. This is why `MATCH (f:Framework)` returns 100 while THE-BRAIN.md (and reality) says ~275-750. The likely trigger: the `framework_name_unique` constraint rejected a colliding-name MERGE and the extractor's fallback wrote `Concept` instead.

  The engine (Neo4j Aura) is not implicated in any of the three. Every downstream symptom is correctness/recall, never latency.

fix: |
  PROPOSED — not executed. This was a read-only investigation; the production graph was not mutated. Destructive steps are given as a plan with example Cypher for human approval. Code/doc changes can be prototyped but the ontology gate touches the upstream Chainlit repo (`~/Mindrian/mindrian-deploy/`) and any Neo4j surgery needs a backup + sign-off.

  --- PRIORITY 0: STOP THE BLEEDING (code, do first, low risk) ---

  P0-1. Add an ontology gate to `~/Mindrian/mindrian-deploy/`. Create `tools/brain_ontology.py` exporting two frozen sets — `ALLOWED_NODE_LABELS` (~30 entries: Framework, Tool, Method, Technique, Book, Author, Person, Organization, CaseStudy, Example, ProblemType, Phase, Step, Concept, Document, Chunk, ...) and `ALLOWED_REL_TYPES` (~20 entries: FEEDS_INTO, TRANSFORMS_OUTPUT_TO, ADDRESSES_PROBLEM_TYPE, HAS_PHASE, HAS_STEP, PREREQUISITE, APPLIED_IN, TEACHES, USES_TOOL, USES_TECHNIQUE, ALIAS_OF, MENTIONED_IN, PART_OF, AUTHORED_BY, IMPLEMENTED_BY, RELATED_READING, ...) — plus a `LABEL_SYNONYMS` / `REL_SYNONYMS` map that folds e.g. {InnovationFramework, TransformationalFramework, SCQAFramework, CynefinFramework} → Framework and {USES_FRAMEWORK, USED_FRAMEWORK, APPLIED_FRAMEWORK, INTRODUCES_FRAMEWORK, ...} → USES_FRAMEWORK. Wire it into `ingest_extractions_to_neo4j.py:create_relationship()` and the node-creation paths so an out-of-vocabulary label/rel-type is either remapped via the synonym table or dropped + logged (NEVER MERGEd as-is). Reuse `tools/ontology_designer.py`'s `GraphOntology` dataclass if it's a fit. (Maps cleanly to the existing pattern in MindrianOS-Plugin where `whitespace-to-brain.cjs` / `admin-brain-write.cjs` already use a frozen vocabulary.)

  P0-2. Fix `lazy_graphrag_index.py`: set `MIN_CONCEPT_FREQ` to ≥3, drop noun-phrases that are pure stop-words/numbers, and on write only emit edges with `weight >= 2` (kills 91.5% of CO_OCCURS at the source). Add a `pipeline_run_id` property to every `LazyGraphConcept` node and `CO_OCCURS` edge it writes, and have `--clear` scope by run-id so re-runs replace rather than accumulate. Consider: do NOT write `CO_OCCURS` to Neo4j at all — co-occurrence is a retrieval-time signal, not a stored relationship; it belongs in an in-process index or Pinecone metadata, not in the graph (this is the cleanest fix and removes ~72% of the graph permanently).

  P0-3. Remove the second `LazyGraphConcept`-writing path from `ingest_extractions_to_neo4j.py:create_concept()` (or align its name-normalization with `lazy_graphrag_index.py`). One pipeline owns one label.

  --- PRIORITY 1: CLEAN THE GRAPH (destructive — backup + sign-off required) ---

  Run order matters. Take a full Aura backup first (`neo4j-admin database dump` or Aura console snapshot). Do P1-1 in a maintenance window.

  P1-1. Delete the CO_OCCURS / LazyGraphConcept lint (the single highest-leverage move — reclaims ~72% of relationships and ~32% of nodes):
        ```cypher
        // 1. drop the mesh edges (run in batches to avoid txn-size limits)
        MATCH ()-[r:CO_OCCURS]->() WITH r LIMIT 50000 DELETE r;   // repeat until 0
        // 2. drop the now-near-orphan concept nodes (keep any that have a non-MENTIONED_IN edge to the curated core)
        MATCH (l:LazyGraphConcept)
        WHERE NOT (l)-[:ALIAS_OF|GROUNDS_FRAMEWORK]-()    // preserve the ~430 that alias real nodes
        DETACH DELETE l;                                   // batch with LIMIT as above
        // 3. drop the dangling MENTIONED_IN→Chunk edges that lost their source
        MATCH (c:Chunk) WHERE NOT (c)<-[:MENTIONED_IN|HAS_ENTITY|NEXT_CHUNK]-() AND NOT (c)<-[:PART_OF]-() DETACH DELETE c;
        ```
        (Decide separately whether the ~430 `LazyGraphConcept`-with-ALIAS_OF nodes should be merged into their aliased target via `apoc.refactor.mergeNodes` and the label retired entirely. Recommended: yes.)

  P1-2. Reverse the bad 2026-02-05 demotion, selectively. The 869 nodes carry `former_label`/`relabeled_by`/`relabeled_date`, so the action is reversible — but do NOT blindly re-add the `Framework` label to all 869 (some genuinely are people / problem statements). Triage:
        ```cypher
        // candidates: relabeled-from-Framework, has a description, and is connected via a teaching edge
        MATCH (n) WHERE n.former_label = 'Framework'
          AND n.description IS NOT NULL
          AND (n)-[:FEEDS_INTO|ADDRESSES_PROBLEM_TYPE|HAS_PHASE|HAS_STEP|TEACHES|USES_TOOL|USES_TECHNIQUE]-()
        RETURN n.name ORDER BY n.name;   // human-review this list, then SET n:Framework REMOVE n:Concept on the approved subset
        // the residue (people) → SET n:Person; (problem statements) → SET n:Example or :Problem
        ```
        Note the `framework_name_unique` constraint: before re-adding the label, dedupe by name (merge the duplicate Concept into the surviving Framework rather than creating a constraint violation).

  P1-3. Collapse the label synonym families with `apoc.refactor.rename.label` (or `SET n:Canonical REMOVE n:Synonym` in batches):
        - {InnovationFramework, TransformationalFramework, SCQAFramework, CynefinFramework, ImplementationFramework, ...} → Framework
        - {InnovationTool, ResearchTool, EnhancedTool, ValidationTool} → Tool
        - {Methodology, AnalyticalMethod, TechnicalMethod} → Method
        - {Technique, LateralTechnique} → Technique  (keep Technique as canonical; it's the biggest at 184)
        - the ~289 singleton labels → strip entirely; keep the node, drop the one-off label (most still carry a generic label like `__Entity__` or `Concept` underneath; the ~65 that are bare `__Entity__`-only need a human glance — likely become `Concept`).

  P1-4. Collapse the rel-type synonym families with `apoc.refactor.rename.type`:
        - {USES_FRAMEWORK, USED_FRAMEWORK, APPLIED_FRAMEWORK, INTRODUCES_FRAMEWORK, PROVIDES_FRAMEWORK, IMPLEMENTS_FRAMEWORK, ...} → USES_FRAMEWORK
        - {USES_TOOL, HAS_TOOL, USED_TOOL, ENHANCES_TOOL, ...} → USES_TOOL
        - {USES_TECHNIQUE, HAS_TECHNIQUE, EMPLOYS_TECHNIQUE, INCLUDES_TECHNIQUE, ...} → USES_TECHNIQUE
        - the ~1,294 ≤5-use rel types → review the top ~40 by count, fold or drop the rest (they're 1.4% of all edges).
        Target: get from 1,640 rel types down to ≤30.

  P1-5. Dedupe the ProblemType taxonomy: pick one of {Ill-Defined Problem, Undefined Problem} as canonical and merge; same for the `+ Wicked` / `+ Simple` / `+ Complex` cross-product (decide whether the 2D taxonomy (definition × complexity) should be properties on a single ProblemType or distinct nodes — recommend properties).

  P1-6. Clean the Framework(100) label itself: move the ~5-10 mislabeled step-nodes ("Define the Focal Component (Level 1)", "Building an 'opposite plan'...", "Domain Selection") to `:Step` and link them `HAS_STEP` to their parent framework.

  --- PRIORITY 2: RE-ESTABLISH THE ASSET (after P1) ---

  P2-1. Re-embed the cleaned framework corpus. After P1-2/P1-3 there should be ~700-800 nodes carrying `:Framework`. Run the embedding job over all of them so the `framework_embeddings` vector index actually covers the corpus (currently 6 nodes). Same for `:Tool`, `:Technique`, `:Method`, `:Book`.

  P2-2. Update `mcp-server-brain/lib/brain-ask.cjs` and `lib/core/brain-client.cjs`: the `framework` CYPHER_PATTERN should match `(f) WHERE f:Framework OR f:Tool OR f:Technique OR f:Method` (or use the consolidated fulltext index `framework_ecosystem_search` which already spans Framework/Method/Tool/Technique). Drop the `general` fallback's full-graph property scan or scope it to the curated labels. Make the CO_OCCURS queries in `enrichCausalEdges` either point at the post-cleanup ALIAS-merged graph or be removed (they currently return ~nothing useful).

  P2-3. Update `docs/THE-BRAIN.md` to the real numbers (post-cleanup: ~15K nodes, ~25K rels, ~750 frameworks once relabel is done, 64 books, ~30 rel types, ~30 labels). Add a "Brain Ontology" doc that pins the allowed vocabulary, mirroring `docs/MWP-SPECIFICATION.md`'s edge-schema section.

  P2-4. (Optional, recommended) Add a lightweight CI/cron "schema drift" check: a Cypher query that asserts `count(DISTINCT type(r)) <= 30` and `count(DISTINCT label) <= 35` and `CO_OCCURS` count == 0 (or below a ceiling). If it trips, an ingestion run violated the gate — block/alert. This is the structural enforcement that prevents recurrence (analogous to Canon Part 8's `brain-boundary-scan`).

verification: |
  Not yet performed (diagnose-and-plan mode; no mutations). Verification plan when remediation is executed:
  - After P0: run an ingestion of one new document against a staging Aura, then assert `count(DISTINCT type(r))` and `count(DISTINCT label)` did not increase, and `CO_OCCURS` weight-1 count is 0.
  - After P1-1: `MATCH (n) RETURN count(n)` ≈ 15K; `MATCH ()-[r]->() RETURN count(r)` ≈ 25K; `MATCH ()-[:CO_OCCURS]->() RETURN count(*)` = 0 (or ≤ chosen ceiling); `MATCH (l:LazyGraphConcept) RETURN count(l)` = 0 (or ≤ 430 if the alias-merge is deferred).
  - After P1-2/P1-3: `MATCH (f:Framework) RETURN count(f)` ≈ 700-800; spot-check that "Strategic Foresight", "Platform Thinking Framework", "BONO Innovation Framework" now carry `:Framework`.
  - After P1-4: `MATCH ()-[r]->() RETURN count(DISTINCT type(r))` ≤ 30.
  - After P2-1: `MATCH (f:Framework) WHERE f.embedding IS NOT NULL RETURN count(f)` ≈ count(f).
  - After P2-2: `brain_ask("frameworks for customer research")` returns JTBD/Customer Discovery AND the previously-demoted ones, with no LazyGraphConcept noise.
  - Behavioral: re-run a Larry session that calls `getFrameworkChain('researcher')` / `hatAwareRecommend` — confirm it now surfaces frameworks that were invisible before.

files_changed: []   # none — read-only investigation

memgraph_assessment: |
  VERDICT: ORTHOGONAL, leaning HURTS. Migrating Neo4j → Memgraph does not address any of RC-1/RC-2/RC-3, and importing a 23K-node graph littered with 1,640 rel types and 700 labels into a fresh engine just rebuilds the mess in a different process.

  Reasoning:
  - The bottleneck is never query latency. The codebase has no slow query; every pain point is retrieval *correctness/recall* — labels fragmented (RC-3), edge vocabulary exploded (RC-1), 72% of the graph is statistical lint (RC-2). An in-memory engine speeds up traversals that are already sub-millisecond on 167K edges. Zero of the actual cost moves.
  - The "engine is not the problem; the missing ontology gate is" thesis is CONFIRMED. The ontology gate is application-layer code in the *ingestion* pipeline. It is exactly as missing on Memgraph as on Neo4j — neither engine has a native "only these labels/rel-types may exist" constraint. Switching engines is effort spent not-fixing the thing.
  - Memgraph's in-memory model is a *cost*, not a benefit, here: the curated asset (frameworks + books + teaching edges + embeddings) wants durability and a managed backup story; Aura Free gives that for free at this size. Memgraph would mean self-hosting (or Memgraph Cloud), snapshot/WAL config, and an HA story for a graph that comfortably fits in Aura Free's ceiling with two orders of magnitude headroom (post-cleanup ~15K nodes / ~25K edges).
  - Memgraph's actual strengths (streaming ingestion via Kafka, MAGE graph algorithms in C++, sub-ms p99 on million-edge OLTP) are not what this workload needs. The Brain is a read-mostly methodology reference queried a handful of times per Larry turn.
  - If the *real* underlying want is "embed the Brain inside the plugin so users get it without a network call" — that points at Kùzu (embedded, columnar, Cypher-ish) or even SQLite-with-a-graph-schema, NOT Memgraph (which is a server). But note Canon Part 8 explicitly forbids distributing the Brain ("IP never distributed, only served via MCP"), so an embedded-in-plugin Brain would be a *constitutional* change, not an engineering one — out of scope for this debug, flag for product/legal.
  - Net recommendation: DO NOT migrate. Spend the migration budget on the ontology gate (P0) + the graph cleanup (P1) + re-embedding (P2-1). Re-evaluate engine choice only if, post-cleanup, a measured query-latency problem actually appears (it won't at this scale). If a future need for embedded local graph emerges, that's Kùzu/SQLite territory and a separate Canon Part 8 conversation, not Memgraph.
