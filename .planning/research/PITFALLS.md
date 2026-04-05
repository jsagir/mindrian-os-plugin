# Domain Pitfalls: Causal Reasoning Layer (v1.7.0)

**Domain:** Causal reasoning over unstructured text in an embedded knowledge graph (KuzuDB)
**Researched:** 2026-04-03
**Context:** Adding causal extraction, cascade simulation, and prediction tracking to MindrianOS Plugin v1.6.3

**Consultant session failures referenced:** Branch `claude/plugin-consultant-review-6MYsc` proposed DoWhy/causal-learn (wrong data type), monolithic orchestrator (architecture fiction), 7 subcommands (over-scoped), regex-based extraction with 9 signal types (cargo cult), and Jaccard novelty scoring (placeholder shipped as feature).

---

## Critical Pitfalls

Mistakes that cause rewrites, abandoned features, or graph degradation.

### Pitfall 1: Wrong Abstraction Level for Causal Extraction

**What goes wrong:** Building extraction that operates at the wrong level of abstraction -- either too shallow (keyword matching) or too deep (full statistical causal inference). The consultant proposed regex patterns scanning for 9 causal signal types ("because", "leads to", "results in"). Research confirms that causal keywords in text are unreliable indicators of actual causal reasoning. The word "because" frequently introduces justifications, elaborations, or correlations -- not causal mechanisms.

At the other extreme, importing DoWhy/pgmpy/causal-learn assumes tabular DataFrame inputs. The system's data is unstructured markdown text from venture conversations. These libraries solve a fundamentally different problem (estimating causal effects from observational data with known variables) than what MindrianOS needs (extracting causal claims from natural language and storing them as graph structure).

**Why it happens:** Causal reasoning sits at the intersection of NLP, graph theory, and statistical inference. Consultants and developers reach for the tools they know. NLP people reach for regex/spaCy. Stats people reach for DoWhy. Both are wrong for this use case.

**Consequences:** Regex extraction produces a graph full of false causal claims (every "because" becomes a CAUSES edge). Statistical tools fail entirely because there's no tabular data to operate on. Either path wastes a milestone.

**Prevention:**
- Use a two-tier approach: (1) Larry (the LLM) performs semantic extraction during conversation -- it already understands causal structure from context. (2) A lightweight post-write heuristic ONLY flags candidate sentences for Larry's review, never creates causal edges autonomously.
- The heuristic is a filter, not an extractor. It reduces the text Larry needs to re-examine, not a source of truth.
- Never import statistical causal inference libraries. The data type is wrong. If you need causal statistics later, you'd first need to convert claims into structured variables -- a separate future feature.

**Detection (warning signs):**
- Regex patterns that match > 20% of sentences in a typical room artifact
- Importing any library that requires a DataFrame as primary input
- Extraction that runs without LLM involvement and creates edges
- More than 3 "signal types" in a heuristic detector

**Phase relevance:** Phase 1 (causal extraction design). This is the foundational decision. Get it wrong and everything downstream is polluted.

---

### Pitfall 2: Graph Pollution from Low-Confidence Causal Claims

**What goes wrong:** Every extracted causal claim gets written as a CAUSES edge in KuzuDB at the same confidence level. Within weeks, the graph becomes a dense hairball where legitimate "semiconductor qualification CAUSES competitive moat" is indistinguishable from "meeting timing CAUSES schedule change." Research on Causal Knowledge Graphs confirms that distinguishing high-confidence from spurious edges is the critical quality gate -- precision@K for top-K highest-confidence predictions determines whether the system is usable for decision-making.

**Why it happens:** Developers optimize for recall ("don't miss any causal claims") instead of precision ("only store claims worth acting on"). The consultant's design had no confidence threshold for edge creation -- everything extracted gets written.

**Consequences:**
- Larry's causal traces return noise alongside signal
- Users lose trust when the system surfaces obvious or trivial causal chains
- Cascade simulation produces misleading results because low-confidence edges are treated as certain
- Graph queries slow down as edge count inflates (see Pitfall 6)

**Prevention:**
- **Confidence-gated writing:** CausalClaim nodes get created at extraction time with a confidence score. Only claims with confidence >= 0.7 get CAUSES edges. Below 0.7, they exist as isolated CausalClaim nodes that can be promoted later.
- **Mechanism requirement (Three Gaps):** Following Duraisamy's framework, every causal claim requires a mechanism ("A causes B THROUGH mechanism M"). Claims without mechanisms are flagged as hypotheses, not stored as edges.
- **User confirmation loop:** High-impact causal claims (those that would create CASCADES_TO chains across sections) require user APPROVE/REJECT before edge creation -- matching the existing cross-subsystem cascade rule.
- **Decay/pruning:** Causal claims that remain unconfirmed after 3 sessions get downgraded. Claims that get contradicted by new evidence get INVALIDATED, not deleted (preserving the learning history).

**Detection (warning signs):**
- More CAUSES edges than INFORMS edges in a typical room (causal edges should be rarer)
- Average confidence score across all CAUSES edges is below 0.6
- Users never reference causal traces in their work
- Cascade simulation chains that exceed 5 hops routinely

**Phase relevance:** Phase 1-2. The confidence schema must be designed before any extraction code runs.

---

### Pitfall 3: Monolithic Orchestrator Architecture

**What goes wrong:** A single script or module tries to coordinate all causal operations: extraction, graph writing, cascade simulation, prediction tracking, Brain queries, and cross-referencing. The consultant proposed `unified-discovery.py` importing HSI, analogy, and causal engines as Python modules -- but these are CLI scripts that output JSON, not importable modules. The architecture was fiction.

**Why it happens:** It feels clean to have one coordinator. But MindrianOS already has an established pattern: scripts output JSON, CJS scripts write to KuzuDB, hooks chain operations. Adding a monolithic Python orchestrator violates every architectural decision in the system.

**Consequences:**
- Single point of failure: if the orchestrator errors, all causal features break
- Can't gracefully degrade (Tier 0 principle violated)
- Testing becomes impossible because everything is coupled
- Timeout issues in the post-write hook (3-second budget shared with existing steps)

**Prevention:**
- Follow the existing pattern exactly: `Python computes -> JSON intermediate -> CJS writes to KuzuDB`
- Causal extraction is Larry's job during conversation (no separate script needed for extraction)
- Post-write hook adds ONE step: candidate flagging (lightweight, < 500ms)
- Cascade simulation and prediction tracking are on-demand commands, not post-write operations
- Each operation is independently testable and independently failing

**Detection (warning signs):**
- Any file named `orchestrator`, `coordinator`, or `unified`
- A Python script that imports 3+ internal modules
- A script that both reads markdown AND writes to KuzuDB (separation of concerns violation)
- Hook timeout budget consumed by causal processing

**Phase relevance:** Phase 2 (integration architecture). Must be resolved before any code touches the post-write cascade.

---

### Pitfall 4: False Transitivity in Cascade Simulation

**What goes wrong:** "A CAUSES B" and "B CAUSES C" does NOT mean "A CAUSES C." Research on causal chain reasoning (Rehder 2015, von Sydow 2016) demonstrates that people (and systems) systematically assume the Markov condition holds in causal chains when it often doesn't. Confounding variables, nonlinear effects, and contextual modifiers break transitivity.

Example: "Qualification timeline CAUSES competitive moat" and "Competitive moat CAUSES pricing power" does NOT mean "Qualification timeline CAUSES pricing power" -- the pricing power might come from IP, not timeline.

**Why it happens:** Graph traversal naturally chains edges. If you query `MATCH (a)-[:CAUSES*1..5]->(b)`, KuzuDB returns transitive chains without checking whether transitivity is valid. The system presents these chains as causal reasoning when they may be confounded.

**Consequences:**
- Users make strategic decisions based on causal chains that don't hold
- Larry presents false confidence: "BECAUSE X... BECAUSE Y... BECAUSE Z" when Z doesn't follow from X
- The system becomes a confabulation engine rather than a reasoning tool
- Particularly dangerous for venture founders making investment or pivot decisions

**Prevention:**
- **Chain confidence decay:** Each hop in a causal chain multiplies confidence. A 0.8 -> 0.8 chain has 0.64 effective confidence. Beyond 3 hops, flag as "speculative chain" rather than "causal trace."
- **Mechanism continuity check:** When traversing A->B->C, verify that B's mechanism as an effect of A is compatible with B's mechanism as a cause of C. If the mechanism changes, flag the chain break.
- **Bounded traversal:** Never traverse CAUSES chains beyond 4 hops. The LazyGraph schema doc already warns about KuzuDB's walk semantics requiring upper bounds.
- **Confounding flag:** When two nodes have a common upstream cause, flag potential confounding rather than asserting direct causation.
- **Display with decay:** Show confidence as it decays along the chain. "A -> B (0.85) -> C (0.72) -> D (0.58, speculative)"

**Detection (warning signs):**
- Causal traces that exceed 4 hops presented without confidence decay
- Users citing causal chain conclusions that skip intermediate mechanisms
- Chain endpoints that have no direct evidential support in any room artifact
- Queries using unbounded variable-length CAUSES paths

**Phase relevance:** Phase 3 (cascade simulation). Must be designed into the simulation engine from the start, not bolted on.

---

### Pitfall 5: Prediction Systems That Get Abandoned

**What goes wrong:** The prediction registry fills up with predictions nobody reviews. Resolution criteria are vague ("we'll know by Q3"). No review cadence exists. Within 2 months, the `.predictions/REGISTRY.json` is a graveyard of stale predictions that Larry occasionally references but nobody acts on.

Research on superforecasting (Tetlock 2015) shows that prediction systems work ONLY when: (1) questions have clear resolution criteria, (2) there's a regular review cadence with feedback, (3) predictions are updated with new evidence, and (4) the system tracks calibration over time.

MLOps research confirms the same pattern: "set & forget" mentality kills prediction systems. Without a Ground Truth system that catalogs forecasts and their resolutions with timestamps, the system degrades.

**Why it happens:** Building prediction creation is fun. Building prediction review is boring. Developers build the input side and defer the output side. The consultant proposed predictions without specifying resolution criteria format, review triggers, or what happens when predictions expire.

**Consequences:**
- Users ignore predictions entirely (feature abandoned)
- Larry references stale predictions, undermining trust
- No calibration data means the system can't improve
- The REGISTRY.json grows indefinitely, slowing file reads

**Prevention:**
- **Mandatory resolution criteria at creation:** Every prediction MUST specify: (a) what would confirm it, (b) what would refute it, (c) a deadline. Predictions without all three are rejected.
- **Forced review cadence:** Larry surfaces the oldest unresolved prediction every 5th session. Not optional.
- **Maximum active predictions:** Cap at 10 active predictions per room. Force resolution of old ones before adding new ones. The consultant proposed unlimited predictions -- this is how registries die.
- **Resolution states:** CONFIRMED / REFUTED / SUPERSEDED / EXPIRED. Never just "open" or "closed."
- **Calibration score:** Track what percentage of high-confidence predictions resolved as expected. Surface this to the user: "Your predictions have been 60% accurate at the 80% confidence level -- you may be overconfident."
- **Lean format:** REGISTRY.json entries should be < 10 fields. Bloated entries mean nobody reads them.

**Detection (warning signs):**
- More than 10 unresolved predictions in a room
- No predictions resolved in the last 30 days
- Predictions without explicit resolution criteria
- No review prompts from Larry in recent sessions

**Phase relevance:** Phase 4 (prediction tracking). Design the review loop BEFORE the creation interface.

---

## Moderate Pitfalls

### Pitfall 6: KuzuDB Schema Bloat and Query Performance

**What goes wrong:** Adding CausalClaim as a new node type + CAUSES, CASCADES_TO, EXTRACTED_FROM as new edge types brings the schema to 3 node types and 15 edge types. KuzuDB uses column-oriented storage with CSR-based adjacency indices per edge type. Each new REL TABLE creates a separate index structure. While KuzuDB handles hundreds of millions of nodes efficiently, the overhead is per-query: multi-type traversal queries must scan multiple index structures.

The specific concern is queries that need to cross edge types: "Find all artifacts connected to X via any combination of INFORMS, CAUSES, HSI_CONNECTION, and ANALOGOUS_TO." This requires either a UNION of multiple MATCH clauses or separate queries merged in application code.

**Why it happens:** Each feature team adds "just one more edge type." The schema grows organically. KuzuDB's schema-first requirement means every edge type is a separate table -- unlike Neo4j where edge types are labels on a single edge store.

**Prevention:**
- **Query budget:** Establish that no user-facing operation triggers more than 3 Cypher queries. If a feature needs 5 queries, redesign the schema or pre-compute.
- **Pre-computed summaries:** For the "convergence discovery" use case (causal + HSI + RS + analogy edges), compute a summary JSON on write, don't query all edge types at read time.
- **No new node types without justification:** CausalClaim might be better as an Artifact subtype (same node table, distinguished by a `type` property) rather than a separate node table. Evaluate before adding.
- **Index awareness:** KuzuDB doesn't support multi-labeled nodes. If you need polymorphic queries across CausalClaim and Artifact, you'll need UNION queries. Consider whether CausalClaim metadata can be properties on existing Artifact nodes + CAUSES edges instead.

**Detection (warning signs):**
- Cypher queries that take > 200ms on a room with < 100 artifacts
- Functions that issue > 3 sequential Cypher queries
- UNION queries spanning > 3 edge types
- `graphStats()` taking noticeably longer after schema expansion

**Phase relevance:** Phase 1 (schema design). Decide CausalClaim representation before writing any edges.

---

### Pitfall 7: Post-Write Hook Timeout Budget Exhaustion

**What goes wrong:** The existing post-write cascade already runs: (1) analytics tracking, (2) binary file detection, (3) LazyGraph indexing (2s timeout), (4) HSI computation + reverse salient detection + KuzuDB bridge (background), (5) presentation regeneration (background), and (6) classify-insight (exec, blocking). Adding causal candidate flagging to this chain risks exceeding the 3-second hook timeout or, worse, introducing ordering dependencies where causal flagging needs HSI results that haven't computed yet.

**Why it happens:** The post-write hook looks like a free place to add logic. Each addition seems small. But the cascade has serial dependencies (LazyGraph index must complete before HSI reads the graph) and a hard timeout budget.

**Consequences:**
- Hook timeout kills all downstream steps (classify-insight never runs)
- Non-deterministic failures when background processes race
- Causal flagging that depends on updated graph state but runs before graph index completes
- Debugging becomes nearly impossible because failures are silent (exit 0 on timeout)

**Prevention:**
- **Budget audit:** Before adding any step, measure actual wall-clock time of the current cascade. The 3-second timeout in hooks.json is the hard limit.
- **Causal flagging MUST be background, non-blocking:** `(causal-flag "$room_dir" "$FILE_PATH" 2>/dev/null || true) &`
- **No ordering dependency on HSI:** Causal flagging should only read the artifact text and existing graph state, never depend on the HSI computation that runs in the same cascade.
- **Flag-then-process pattern:** The post-write hook only MARKS candidates (appends to `.causal-candidates.json`). Actual extraction happens when the user invokes `/mos:causal extract` or when Larry processes the queue during conversation.
- **Consider debouncing:** If a user writes 5 artifacts in 30 seconds, don't run 5 independent flagging passes. Debounce to a single pass after writes settle.

**Detection (warning signs):**
- classify-insight (the final `exec`) stops producing output
- Room artifacts indexed in LazyGraph but missing causal flags (ordering failure)
- Hook stderr showing timeout errors
- User reports "Larry seems slow after saving files"

**Phase relevance:** Phase 2 (integration). Must be tested with real room write patterns, not unit tests.

---

### Pitfall 8: Overscoped Command Surface

**What goes wrong:** The consultant proposed 7 subcommands for `/mos:causal`. For a brand-new, unvalidated feature, this is scope creep before validation. Users won't learn 7 subcommands for something they've never used before. The cognitive load drives abandonment.

**Why it happens:** Developers design for the feature's full potential rather than its minimum viable interface. Every internal capability gets exposed as a command.

**Prevention:**
- **3 subcommands maximum for v1.7.0:** `extract` (pull causal claims from current artifacts), `trace` (follow a causal chain from a claim), `predict` (register a testable prediction). Everything else is internal or triggered by Larry proactively.
- **Larry-first surface:** Most users will encounter causal reasoning through Larry's conversation, not through commands. `/mos:causal` is the power-user escape hatch, not the primary interface.
- **Each subcommand must have an obvious output:** `extract` produces a list of claims. `trace` produces a chain with confidence. `predict` produces a prediction card. No subcommand should produce "processing..." with no visible result.
- **Desktop surface test:** If a subcommand can't be triggered by natural language on Claude Desktop, it probably shouldn't be a subcommand.

**Detection (warning signs):**
- More than 3 subcommands in the initial release
- Subcommands that are synonyms (e.g., `cascade` and `trace` doing similar things)
- Subcommands that require > 2 flags or arguments
- No usage of a subcommand after 2 weeks in production

**Phase relevance:** Phase 3 (command design). Resist scope expansion until v1.7.0 ships and users validate.

---

### Pitfall 9: Novelty Scoring Theater

**What goes wrong:** The consultant proposed Jaccard distance for novelty scoring, acknowledged it was a placeholder, but designed it into the architecture as a feature. Jaccard distance between term sets is not novelty detection -- it measures term overlap, which conflates obscurity with novelty. A claim using rare jargon scores "novel" while a genuinely novel insight using common words scores "mundane."

**Why it happens:** Novelty is genuinely hard to measure. The temptation is to use any computable metric and call it novelty. The Duraisamy paper's "Three Gaps" framework explicitly warns about the Reality Gap -- the distance between computational proxies and actual scientific value.

**Consequences:**
- Users see "HIGH NOVELTY" on trivial claims and lose trust in the scoring system
- Actually novel insights (like the geometry-enabled-qualification bottleneck in the north star example) score low because they use common words
- The system optimizes for linguistic obscurity rather than genuine insight

**Prevention:**
- **Don't ship novelty scoring in v1.7.0.** Mark it as a future capability. A bad novelty metric is worse than no metric.
- **If novelty must ship:** Use LLM-assessed novelty (Larry compares the claim against existing room knowledge and rates novelty on a 1-10 scale with explanation). This is slow but accurate.
- **Never use term-frequency metrics as novelty proxies.** Not Jaccard, not TF-IDF, not cosine distance between term vectors. These measure statistical unusualness, not intellectual novelty.
- **When ready (future):** Novelty = "this claim contradicts or extends an existing assumption in the room." It's relational (graph structure), not statistical (term frequency).

**Detection (warning signs):**
- Novelty scores that correlate with document length or vocabulary rarity
- No user ever mentioning novelty scores in their work
- Novelty scores that don't change when the room gains new knowledge

**Phase relevance:** Defer to post-v1.7.0. Include the field in the schema but leave it empty until a real algorithm exists.

---

## Minor Pitfalls

### Pitfall 10: Brain Graph Enrichment Without Validation

**What goes wrong:** Layer 1 (Brain Graph Enrichment) proposes wiring FEEDS_INTO chains, CO_OCCURS edges, and TYPICAL_AT mappings between causal frameworks in the Brain. If these edges are wrong (e.g., Root Cause Analysis doesn't actually FEED_INTO Systems Thinking in all contexts), Larry will confidently recommend incorrect framework sequences.

**Prevention:**
- Validate each Brain edge with the teaching graph owner (Jonathan) before creating it
- Add edges incrementally (2-3 per iteration) and test with real room scenarios
- Each edge needs a usage example: "When does Root Cause Analysis actually feed into Systems Thinking?"

**Phase relevance:** Phase 1 (Brain enrichment). Small, validated batch -- not all edges at once.

---

### Pitfall 11: EXTRACTED_FROM Edge Explosion

**What goes wrong:** Every CausalClaim gets an EXTRACTED_FROM edge pointing to its source artifact. If an artifact contains 8 causal claims, that's 8 EXTRACTED_FROM edges from 8 CausalClaims to 1 Artifact. Across a room with 40 artifacts, this could be 100-300 EXTRACTED_FROM edges -- potentially more than all other edge types combined.

**Prevention:**
- Store source_artifact as a PROPERTY on CausalClaim, not as a separate edge type. EXTRACTED_FROM is a provenance pointer, not a semantic relationship worth traversing.
- Reserve edge types for relationships that participate in graph traversal queries.

**Phase relevance:** Phase 1 (schema design). Property vs. edge decision.

---

### Pitfall 12: Presentation Layer Causal Visualization Overreach

**What goes wrong:** Trying to visualize causal chains as interactive graph diagrams in the 6-view presentation system before the data quality is established. Complex graph visualizations of noisy causal data look impressive in demos but confuse real users.

**Prevention:**
- Start with text-based causal trace output: "A -> B (0.85) -> C (0.72)"
- Add graph visualization only after users validate the traces are useful in text form
- Non-technical venture founders need narrative ("X causes Y because..."), not node-edge diagrams

**Phase relevance:** Defer to post-v1.7.0. Text traces first, visualization second.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema design | CausalClaim as separate node table inflates query complexity | Consider CausalClaim as Artifact subtype with `type: 'causal-claim'` property |
| Brain enrichment | Incorrect FEEDS_INTO chains recommended by Larry | Validate each edge with teaching examples before creation |
| Causal extraction | Regex/keyword extraction pollutes graph | LLM extraction only; heuristic for flagging candidates, never for creating edges |
| Post-write integration | Hook timeout exceeded, ordering races | Background-only, no ordering dependency on HSI, flag-then-process pattern |
| Cascade simulation | False transitivity presented as causal reasoning | Confidence decay per hop, 4-hop maximum, mechanism continuity check |
| Prediction tracking | Registry abandoned within weeks | 10-prediction cap, forced review cadence, mandatory resolution criteria |
| Command surface | Too many subcommands, low adoption | 3 subcommands max; Larry-first for most users |
| Novelty scoring | Meaningless metric undermines trust | Defer to post-v1.7.0; if shipped, use LLM assessment not term-frequency |
| Performance | 15 edge types cause slow multi-type queries | Query budget of 3 Cypher queries per operation; pre-compute summaries |
| Visualization | Complex graph diagrams confuse non-technical users | Text-based traces first; narrative presentation for founders |

---

## Lessons from the Consultant Session (Explicit Reference)

The consultant session (branch `claude/plugin-consultant-review-6MYsc`) provides five concrete anti-lessons:

| Consultant Proposal | What Was Wrong | Correct Approach |
|---------------------|---------------|------------------|
| DoWhy / causal-learn / pgmpy | Require tabular DataFrames; our data is unstructured markdown text | LLM-based extraction; no statistical causal inference libraries |
| `unified-discovery.py` monolithic orchestrator | Engines are CLI scripts outputting JSON, not importable Python modules | Follow existing pattern: Python -> JSON -> CJS -> KuzuDB |
| 7 subcommands for `/mos:causal` | Over-scoped for an unvalidated feature | 3 subcommands: extract, trace, predict |
| Regex with 9 causal signal types | Causal keywords don't indicate actual causal reasoning | LLM extraction with heuristic candidate flagging only |
| Jaccard distance novelty scoring | Measures term overlap, not intellectual novelty | Defer novelty scoring; use LLM assessment when ready |

Each of these mistakes shares a root cause: **applying generic tooling to a domain-specific problem without understanding the data type, architecture constraints, or user needs.**

---

## Sources

- [Transitive reasoning distorts induction in causal chains](https://link.springer.com/article/10.3758/s13421-015-0568-5) - von Sydow et al. on false transitivity
- [Causal networks or causal islands?](https://pmc.ncbi.nlm.nih.gov/articles/PMC4490159/) - Rehder on mechanism-based causal reasoning
- [Challenges and Opportunities in Causality Analysis Using LLMs](https://www.mdpi.com/1099-4300/28/1/23) - Survey of LLM causal reasoning limitations
- [Survey on extraction of causal relations from natural language text](https://link.springer.com/article/10.1007/s10115-022-01665-w) - Comprehensive NLP causal extraction survey
- [Heuristic Detectors vs LLM Judges](https://dev.to/tuomo_pisama/heuristic-detectors-vs-llm-judges-what-we-learned-analyzing-7000-agent-traces-iil) - Hybrid approach evidence (heuristic flag + LLM judge)
- [CausalKG: Causal Knowledge Graph](https://arxiv.org/pdf/2201.03647) - Causal KG construction patterns
- [Superforecasting: How to Upgrade Your Company's Judgment](https://hbr.org/2016/05/superforecasting-how-to-upgrade-your-companys-judgment) - Prediction system design from Tetlock's research
- [Using AntiPatterns to avoid MLOps Mistakes](https://ar5iv.labs.arxiv.org/html/2107.00079) - Prediction system antipatterns
- [KuzuDB CIDR paper](https://www.cidrdb.org/cidr2023/papers/p48-jin.pdf) - CSR storage, schema-first architecture, performance characteristics
- [Embedded databases: KuzuDB study](https://thedataquarry.com/blog/embedded-db-2/) - KuzuDB benchmarks and query performance
- [The Illusion of Causality in LLMs](https://www.mdpi.com/2504-4990/8/3/57) - Why LLMs appear to reason causally but rely on semantic pattern recombination
- Duraisamy (2025) "Active Inference AI Systems for Scientific Discovery" - Three Gaps framework (Abstraction, Reasoning, Reality)
- Hughes (1983) Reverse Salients - Betweenness centrality for bottleneck detection
