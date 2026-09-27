# SEED-097 Ingestion Report

## Codex review of the MindrianOS intelligence layer

**Scope:** `/home/jsagi/dev/MindrianOS-Plugin`, current WSL development checkout

**Purpose:** provide SEED-097 with a complete implementation and architecture review for turning MindrianOS from an in-room pairing engine into a private, cross-room and external-literature research tool.

**Review posture:** read-only review. No source changes were made as part of this report.

**2026-09-27 Astra review disposition:** the implementation inventory remains
evidence. The earlier architecture sketches below are superseded where they
conflict with SEED-097's independent-perspective matrix, small local envelope,
optional research branch and minimal-change plan. The seed is the implementation
briefing authority. Detailed review:
`~/MindrianRooms/mindrianOS/research/2026-09-27-mos-canvas-astra-pathways-review.md`.
No all-engine sequence, mandatory corpus call, single vector-index migration,
universal pair schema or general Jev-readiness assumption should be inferred.

## Executive decision

MindrianOS should not replace Find Analogies, Whitespace, Reverse Salient, HSI, or Eureka with one new algorithm. It should add a shared **MOS-CANVAS** layer around them.

Each part remains an independent strategic perspective. A common local substrate provides cohort assembly, candidate records, provenance, verification, human review, and controlled external research. Cross-perspective comparison is optional and preserves each part's standalone finding and ranking logic.

The current repository already contains most of the parts, but they are split across two generations:

1. An older but functional `/mos:research` and Reverse Salient pipeline that can call external sources.
2. The newer 355/355.1 intelligence layer, which has better local provenance and ambient behavior but is deliberately room-local.

SEED-097 should be an integration phase over those parts, not another independent fetcher or scoring engine.

## Hard constraints

The implementation must preserve these invariants:

- Room content never leaves the machine.
- Only exact, audited, navigator-approved query strings may cross the egress boundary.
- External results return as reviewed, hash-anchored records.
- Local graph reads and writes use `lib/core/navigation.cjs`.
- Every truth claim remains proposed until a human ratifies it.
- CLI, Claude Desktop, and Cowork use the same typed contracts and approval state machine.
- Existing modules are adapted before new equivalents are built.

## 1. Existing machinery inventory

### Live and wired

**Reverse Salient orchestration.** `scripts/rs-discovery-engine.cjs:12-75` wires domain analysis, the query matrix, academic/patent/industry fetchers, preprocessing, scoring, classification, synthesis, and graph output. This is a complete legacy pipeline, but it is not yet a SEED-097 research-run protocol.

**CJS RS engine.** `lib/agents/reverse-salient-agent.cjs:66-72,234-316` selects the CJS or Python backend and routes local graph operations through navigation. It produces room findings; it does not provide the complete external research approval and evidence lifecycle.

**Academic fetcher.** `lib/core/rs-fetcher-academic.cjs:57-83,477-605` supports OpenAlex, arXiv, PubMed, Scopus, IEEE, and Nature with key gates, timeouts, rate-limit handling, and audit calls. Semantic Scholar is absent from the source enum; add it only if terms and measured coverage warrant it. OpenAlex is the proposed first provider.

**Unified corpus adapter.** `lib/core/research-corpus.cjs:718-755,769-780` exposes `fetchCorpus` and `fetchCorpusEnvelope` with a shared pre-egress audit. It is a fetch substrate, not yet a research-run ledger, approval ledger, or result-review system.

**Patent fetching.** `scripts/rs-discovery-engine.cjs:27-32,112-114` wires the patent fetcher into the legacy discovery pipeline.

**Industry/web fetching.** `lib/core/rs-fetcher-industry.cjs:25-49,104-179,197-221` audits both the input query and each refined subquery before the single native fetch site. This is strong Part-8 defense, but it does not attach a navigator approval ID or result hash to returned records.

**External analogy path.** `lib/core/eureka/online-pattern-query.cjs:1-32,93-132` composes and audits abstract pattern queries but never transmits them. `commands/find-analogies.md:180-218` adds a navigator approval gate and dispatches one fetch worker per approved query. This is the best existing model for SEED-097's exact-query approval contract.

**Research command.** `commands/research.md:104-123,244-248,307-307` explicitly gates fetching, uses the shared corpus/cache, and files evidence as proposed rather than confirmed. This is the closest existing end-to-end pattern.

**Hats and personas.** `commands/think-hats.md:63-79` delegates rotation to the lens engine. `commands/persona.md:63-71,129-187` supports persistent and parallel hat analyses. `agents/persona-analyst.md:44-59` defines generic-only remote handles and hat-scoped external research.

**Context assembly.** `lib/mcp/tools/context.cjs:33-89` calls `navigation.getRoomContext`; `lib/core/navigation/room-context.cjs:287-330` provides the local fusion. This is a sound base for cohorts but is currently a conversation-context contract rather than a multi-section research cohort contract.

**Verification stamp.** `lib/core/verification-stamp.cjs:13-76,161-225` calls Theo's `find_connections` once per pair, memoized within a run, and returns strong/indirect/unverified. Runtime Jev judgment is still absent.

### Present but narrow, overlapping, or not connected to SEED-097

**Fixed query matrix.** `lib/core/rs-query-matrix.cjs:1-31,245-297` deterministically generates 60 queries from 15 templates and four categories. It uses only `adjacent_domains[0]`, does not consume hats, problem patterns, cohort state, or run-level yield budgets. It should become one candidate producer, not the main designer.

**Natural-language query translator.** `lib/core/rs-nl-to-query.cjs:177-220,286-319,378-409` generates local Cypher/SQL/Brain-shaped queries. Its `brain_template` is intentionally null for downstream synthesis, and its tests fence it from network use. It is not an external literature-query planner.

**Expert mapping.** The expert fetcher and mapper operate on retrieved academic papers. They are useful post-processors, not corpus-selection or query-planning components.

**Corpus quality gate.** `lib/core/rs-corpus-quality-gate.cjs:3-17,49-62` detects degenerate pair sets offline. It is valuable for evaluation but does not yet gate external-record quality.

**Breakthrough scoring and synthesis.** `lib/core/rs-breakthrough-scorer.cjs:209-239` scores five dimensions, and thesis/commercial/domain/mind-map modules are consumed by the legacy discovery engine. These modules assume the old pair/document shape and need adapters to typed research results.

**Cross-room aggregator.** `lib/core/cross-room-aggregator.cjs:308-368,419-475,508-560` scans room folders and extracts hashes, enums, and signatures. It is appropriate as a registry-level structural scanner. It must not become the graph or cohort authority because it reads files directly through `fs`.

**Cross-room store.** `lib/core/cross-room-store.cjs:3-29,54-99,132-180,199-217` supplies `UMBILICAL_TO` edges with an enum/scalar fence. It owns a registry-level `.rooms/cross-room.db`, separate from a room's navigation-controlled graph.

**Cross-room triggers.** These are useful structural offer generators. They do not create typed research runs or query candidates.

**Ambient run.** `lib/core/ambient-run.cjs:497-550` runs five local producers sequentially. It currently has no external corpus leg. Enabling a fetcher inside ambient would bypass the intended approval lifecycle unless it is routed through the new research-run state machine.

**Ambient rank.** `deferred-items.md:7-30` records that ambient Eureka selection uses simplified `abs_diff` ranking rather than the full AHP/tail-quadrant ranking.

### Existing overlap to resolve

There are four query-generation concepts:

1. `rs-query-matrix`: fixed Reverse Salient templates.
2. `rs-nl-to-query`: local graph/query translation.
3. `online-pattern-query`: abstract analogy queries.
4. `research.md`: command-level lens-specific research flow.

SEED-097 should make all of them emit one typed `ResearchQueryCandidate` shape rather than add a fifth string-building system.

## 2. MOS-CANVAS target architecture

### The per-perspective loop

```text
navigation cohort or explicit goal
      ↓
one chosen strategic perspective
      ↓
its candidate, evidence and method-specific ranking
      ↓
applicable Theo verification and evaluated Jev judgment
      ↓
human review
      ↓
local claim or approved external query
      ↓
optional comparison with other perspectives
```

The engines remain distinct:

- Find Analogies detects structural/function transfer.
- Whitespace detects missing links and unexplored regions.
- RS detects reverse-salient bottlenecks and asymmetric meaning.
- HSI detects semantic/lexical divergence.
- Eureka performs retrieval, embedding similarity, and opportunity harvesting.

MOS-CANVAS supplies the shared evidence, review, and research gateway. Each
perspective can finish independently; synthesis is an additional operation,
not a gate. Eureka's AHP/tail-quadrant ranker stays specific to Eureka.

### Three homes

**Home A, plugin/local room:** navigation-backed cohort assembly; local engine execution; lens and pattern selection; query composition; run ledger; approval ledger; cache; review queue; filing proposals.

**Home B, Theo:** existing governed methodology/path/analytics tools and proposed
corpus/judgment interfaces. `audit_query`, `corpus_search` and `jev_judge` in this
sketch are proposed roles, not verified shipped tool names. The live interface
must be checked. Restricted analytical packets and approved corpus requests
have separate schemas; local candidate records are never serialized wholesale.

**Home C, external services:** OpenAlex, arXiv, PubMed, Semantic Scholar, Scopus, patents, optional industry providers, graph analytics, and Jev/TypeSafe judgment.

### Common candidate contract

**Historical pair-oriented sketch; superseded by the seed's local envelope and
typed perspective payloads.** These fields may belong to a pair finding; they
are not required on roadmaps, gaps or bottleneck records.

```text
DiscoveryCandidate
  candidate_id
  engine
  source_node_ids[]
  target_node_ids[]
  direction
  pattern_type
  problem_type
  raw_scores
  normalized_scores
  evidence_refs[]
  verification_status
  novelty
  confidence
  query_seed
```

Potential comparison features, only when meaningful and calibrated for the
perspectives being compared; no universal vector or new embedding migration:

```text
semantic_similarity
structural_similarity
divergence
novelty
cross_engine_agreement
verification_confidence
human_usefulness
```

Retain each producer's native evidence and score semantics.

### Research-run state machine

```text
DRAFT → CONTEXT_READY → PERSPECTIVE_RUN → RESULT_READY → FILED_PROPOSED
                                ↑             ↓ optional evidence request
                                └── reviewed research results
FILED_PROPOSED → human gate → CONFIRMED / REJECTED / DEFERRED
```

An optional external research child run owns audit, approval, fetch and result
review. Approval binds the exact provider/query/scope actually executed.
Local completion and generic methodology reads do not require a corpus call.

### Typed run contracts

The original field sketches below are design inputs, not frozen schemas or
instructions to create new stores. Adopt the seed's current minimal shared
envelope; lens, pattern and engine-signal fields are optional when applicable.

```text
ResearchRun
  run_id
  room_id
  cohort_ids[]
  lens_id
  problem_type
  discovery_pattern
  engine_signal_ids[]
  status
  policy_version
  created_at

ContextCohort
  cohort_id
  section_ids[]          // at least two, resolved through navigation
  node_ids[]             // local only
  local_signal_ids[]
  problem_type
  pattern_ids[]
  abstract_terms[]
  cohort_hash
  egress_allowed: false

ResearchQueryCandidate
  query_id
  run_id
  corpus
  template_id
  lens_id
  pattern_id
  problem_type
  exact_query
  normalized_query
  query_hash
  audit_version
  estimated_cost
  rationale_codes[]
  status: proposed|approved|rejected|sent

ExternalResult
  result_id
  query_id
  source
  source_record_id
  result_hash
  retrieved_at
  normalized_metadata
  review_status: unreviewed|accepted|rejected
  provenance
```

### End-to-end research loop

1. A room delta, explicit command, or cross-room scalar trigger creates a local run.
2. Navigation resolves the room and selects at least two relevant sections.
3. A cohort assembler collects graph IDs, section roles, local signals, and bounded abstractions.
4. One selected strategic perspective frames its question; hats/personas may help.
5. That perspective alone produces its native finding and evidence requirements.
6. A local finding may proceed directly to review. If evidence is missing, select an applicable source/pattern plan.
7. The composer prepares only the perspective's relevant evidence and counterevidence queries, budgets and audits them.
8. The navigator approves exact strings.
9. The approved corpus request uses the chosen, verified transport contract and existing fetcher.
10. Results return normalized and hash-anchored.
11. The perspective ranks by its own criteria; evaluated Jev policies judge only applicable questions.
12. The navigator reviews evidence cards.
13. Accepted evidence becomes proposed nodes/edges through navigation.
14. Human confirmation promotes truth claims.
15. Confirmed results become new local signals for later ambient runs.

## 3. Query design

### Terminology translation

Create a local terminology registry mapping room handles to canonical terms, synonyms, abbreviations, historical terms, and method vocabulary. Only public translated terms may cross the egress boundary. The originating room phrase must remain local.

### Decomposition

Select bounded subquestions that serve this perspective; the following are
options, not a compulsory five-question chain:

- mechanism: what mechanism produces the effect?
- transfer: where is this mechanism used in another domain?
- failure: what breaks under the reverse-salient condition?
- implementation: what methods operationalize it?
- evidence: what measured results support or contradict it?

### Pattern-specific wording

- **Structural transfer:** same function, different vocabulary.
- **Semantic implementation:** same vocabulary, different function.
- **Reverse salient:** bottlenecks, failure modes, enabling conditions.
- **Decomposition:** component mechanisms separately.
- **Inversion:** negated or opposite operating condition.
- **Convergence:** independent domains using the same mechanism.

### Dedupe and budgets

Use:

```text
normalize(query)
+ corpus
+ lens_id
+ pattern_id
+ terminology_registry_version
```

Budget by engine, lens, corpus, total request count, and provider rate limit. `online-pattern-query` already demonstrates bounded family caps (`lib/core/eureka/online-pattern-query.cjs:48-52`); SEED-097 should promote that discipline to the run level.

### Yield metrics

Measure useful findings per approved query, recall@K against planted transfers, precision/usefulness after human review, novelty against the local graph, cross-section coverage, approval rate, egress rejection rate, result deduplication, ratification rate, time-to-ratification, and provenance completeness.

## 4. Cross-room design

Cross-room transfer should move structure, never content. Keep `cross-room-store.cjs`'s existing scalar fence: `relevance`, `signal`, `linked_at`, and `session_id` (`lib/core/cross-room-store.cjs:39-43,105-129`).

A cross-room seed may contain:

```text
source_room_slug
target_room_slug
section_role
problem_type_a / problem_type_b
pattern_id
framework_signature_prefix
governing_thought_hash_prefix
quantized relevance
signal enum
```

It must not contain prose, artifact titles, embeddings, personal identifiers, copied claims, or free-text rationales.

The receiving room independently assembles its cohort through navigation. The source room's content is never supplied to it. Any external query is generated from the receiving room's abstract vocabulary only.

The existing aggregator remains a structural contradiction scanner. Because it directly scans room folders (`lib/core/cross-room-aggregator.cjs:308-368`), it must not become the graph/context authority. If its output seeds a cohort, the cohort builder must re-resolve graph state through navigation.

## 5. Evaluation plan

The current 43 useful of 96 is the baseline. The 85% unverified rate and overlapping usefulness ranges show that the current verification stamp is not yet discriminative.

### Fixture room

Create a local fixture room with:

- known structural transfers across at least two sections;
- vocabulary translations for identical concepts;
- same-word/different-meaning negatives;
- planted reverse-salient examples;
- planted cross-room relationships;
- planted records from OpenAlex, arXiv, PubMed, Semantic Scholar, and patents;
- ambiguous framework names;
- expected two-hop and three-hop Theo paths;
- high-lexical-overlap negatives.

Each planted item should carry hidden expected labels for transfer type, direction, source/target sections, expected terms, expected provider, query family, and usefulness.

Compare:

1. current ambient local-only pipeline;
2. fixed 60-query matrix;
3. lens-aware composer;
4. lens + pattern + cohort composer;
5. full external pipeline with Theo/Jev.

Report recall@5/10, precision/usefulness, direction accuracy, false-positive rate for semantic implementation, cohort coverage, unverified rate, verification calibration by hop count, cost per useful finding, human approval/ratification rates, and provenance completeness.

## 6. Ranked changes

1. **Typed ResearchRun state machine and exact-query approval hashes.** High effort, high risk. Touches new run modules, `commands/research.md`, MCP registration, and `lib/core/rs-egress-*`.
2. **Navigation-backed cohort assembler requiring at least two sections.** High effort, high risk. Touches `lib/core/navigation.cjs`, `lib/core/navigation/room-context.cjs`, and `lib/mcp/tools/context.cjs`.
3. **Lens/problem/pattern-aware query composer.** High effort, medium risk. Touches `rs-query-matrix.cjs`, `online-pattern-query.cjs`, hats, and persona surfaces.
4. **Theo typed corpus/audit/Jev contracts.** High effort, high risk. Touches Theo, Jev scripts, verification stamp, and MCP schemas.
5. **Hash-anchor every query and result.** Medium effort, high risk. Touches `research-corpus.cjs`, academic/patent/industry fetchers, and research cache.
6. **Provider-specific cursors/budgets.** Add Semantic Scholar only for a measured coverage gap with acceptable terms.
7. **Make cross-room seeds scalar-only and navigation-compatible.** Medium effort, high risk. Touches cross-room store, aggregator, and triggers.
8. **Build the planted-transfer fixture and evaluation harness.** Medium effort, low risk. Touches tests, fixture-room data, and corpus-quality evaluation.
9. **Calibrate direction, embeddings, thresholds, and ambient AHP ranking.** High effort, high risk. Touches `rs-math.cjs`, `hsi-lsa.cjs`, `rs-innovation-classifier.cjs`, ambient selection, and deferred AHP work.
10. **Close ambient reliability warnings before externalization.** Medium effort, high risk. Touches `ambient-run.cjs`, `ambient-trigger.cjs`, `scout-cadence-guard.cjs`, and deferred warnings.

## 7. Current hazards to resolve first

1. `lib/core/ambient-run.cjs:515-550` awaits producers without per-producer timeouts.
2. `deferred-items.md:105-125` records non-atomic ambient state writes.
3. `deferred-items.md:127-134` records phantom cadence claims consuming the hourly window.
4. `deferred-items.md:137-148` records unverified Windows detached-child behavior.
5. `deferred-items.md:150-160` records catch-all errors being reported as `no_room`.
6. `cross-room-aggregator.cjs` and `cross-room-store.cjs` bypass the room graph navigation path when treated as graph/context authorities.
7. Semantic Scholar is absent from the academic source enum; this is an optional provider gap, not an initial-phase blocker.
8. Existing result records lack approval IDs, query hashes, response hashes, review status, and filing linkage.
9. Verification is dominated by exact framework-name resolution, explaining much of the 85% unresolved rate.
10. Direction/sign conventions and ambient ranking are not yet calibrated for cross-engine evaluation.

## Final recommendation to SEED-097

Start with the MOS-CANVAS contract and one vertical slice; full phase completion
requires all six independent perspective paths and the agreed service scope:

```text
two-section local cohort
→ optional hat/persona lens
→ one selected perspective's standalone candidate
→ one pattern-shaped query family
→ exact navigator approval
→ one corpus adapter behind Theo
→ hashed result review
→ proposed navigation filing
→ human ratification
```

Once that slice is reliable, run a second perspective independently on the
same case. Measure whether linking the two cards adds insight beyond either
alone. More providers and adapters follow measured need; agreement is useful
evidence, and disagreement can be a research lead.
