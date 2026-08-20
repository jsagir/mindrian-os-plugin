# LangTalks Counsel: Complete-System Loop (2026-08-20)

Grounded consultation of the langtalks-graph-expert corpus for the complete-system loop milestone (local room graph + conversation context + remote Brain, always on). Five queries run. Per the corpus contract, an empty edges list is an honest "not in the corpus yet," never padded with guesses. Every claim below cites the typed edge the graph actually returned (source locator = episode/source URL plus character span).

Queries and result shape:

| # | Question | Result |
|---|---|---|
| 1 | Local per-agent memory graph + remote shared knowledge graph, per-turn grounding without latency blocking | 1,818 nodes, ZERO typed edges (silent; node inventory only) |
| 2 | Precomputed projection/cache vs live retrieval at inference time | 1,089 nodes, ZERO typed edges (silent; node inventory only) |
| 3 | Reranking retrieval beyond semantic similarity | 163 nodes, 186 typed edges (rich, substantive) |
| 4 | Risks of an MCP server composing calls server-side vs model orchestration | 8 nodes, ZERO typed edges (silent) |
| 5 | Graceful degradation when the remote knowledge service is unavailable mid-conversation | 1,058 nodes, ZERO typed edges (silent) |

## 1. What the corpus says to DO

**Section-affinity ranking is a textbook instance of the corpus's strongest pattern: retrieve broad, then rerank with richer signals.** Episode 25 (Reranking) carries the whole pattern as typed edges:
- `Retrieval -[part_of]-> Top K` and `Top K -[compares_to]-> Top N` (ep 25, span 9497:9530 and 17816:17833): the retrieve-top-N-then-rerank-to-top-K two-stage shape.
- `Embeddings -[compares_to]-> Cross Encoder` (ep 25, 3467:3761) and `Embeddings -[compares_to]-> Re-ranking` (ep 25, 11938:12018): the second stage uses a richer, slower signal than the first-pass similarity.
- `Embeddings -[critiques]-> Nuances` (ep 25, 3520:3582): embeddings alone miss nuance; that is exactly the argument for a metadata boost (section affinity) on top of semantic score.

Mapped to our design: semantic/first-pass candidate set from the existing ranker, then a section-affinity boost as the rerank signal. The corpus treats this as established practice, not novelty.

**Graph signals and vector signals are complements, and the corpus keeps saying so.** This supports using Brain graph edges (USES_FRAMEWORK, section affinity) as ranking inputs alongside similarity:
- `Vector Database -[critiques]-> Knowledge Retrieval` and `Vector Database -[compares_to]-> Knowledge Graph` (ep 21, Jesus Barrasa/Neo4j, 6767:6823 and 21904:21962).
- `Semantic Search -[alternative_to]-> Graph` (ep 57, Memory/Qodo, 13395:13506).
- `Semantic Search -[builds_on]-> Graph Search` inside one `Agentic Runtime` (Atomic GraphRAG on Memgraph, 9706:9948 and 12830:12864): a single unified execution layer over both, on the same engine family the Brain runs on.

**Latency is a first-class constraint on in-conversation retrieval.** `RAG -[critiques]-> Latency` (ep 61, Voice Agents, 12890:12918). The corpus's memory taxonomy separates the fast working set from the long-term store: `Working Memory -[compares_to]-> Context Window` (SDS 985, 34387:34493), `Vector Database -[part_of]-> Long Term Memory` and `Retrieval -[builds_on]-> Cue` (ep 60, Brain Memory, 10023:10072 and 17206:17244). The shape the corpus supports: a fast local working set serves every turn; the long-term store is consulted on cue, not on every beat.

## 2. What the corpus WARNS about

- **Do not let first-pass similarity be the whole ranking.** `Embeddings -[critiques]-> Nuances` (ep 25). A similarity-only surface misses what a second signal catches. Our current local-only ranker with no Brain/section signal is exactly that anti-pattern.
- **In-turn retrieval latency degrades live conversation.** `RAG -[critiques]-> Latency` (ep 61). This is corpus-side weight AGAINST a blocking live Brain call on the per-turn hot path.
- **Retrieval conflicts and accuracy limits are real:** `RAG -[critiques]-> Conflict` (SDS 985, 39406:40101) and `RAG -[critiques]-> Accuracy` (vXkzdMxJ5u4, 6526:6608). When local room signal and Brain signal disagree, the merge policy must be explicit, not accidental.

## 3. Where the corpus is SILENT (we are on our own)

- **Server-side MCP composition** (one tool handler calling another knowledge service internally vs the model orchestrating both): zero typed edges (query 4, total_found=8, edges=[]). Neither endorsed nor warned against. Our own Part 8 hook blind-spot analysis and the 239-05 fail-closed belt stand on their own.
- **Graceful degradation / cold-start behavior mid-conversation**: zero typed edges (query 5). The honest-refusal doctrine has no corpus precedent to lean on; it is Mindrian's own contribution.
- **The exact local+remote two-graph pattern as a named architecture** (query 1) and **projection vs live as a named tradeoff** (query 2): zero typed edges as posed. The node inventories confirm heavy adjacent coverage (episodes 21, 25, 41, 44, 50, 55, 57, 60; SDS 985 Four Types of Memory; Redis and AI Agent Memory; Claws Architecture ep 71; Atomic GraphRAG; Agent Skills on Memgraph; the Claude 5 context-engineering blog), so the ingredients are all discussed, but the corpus has not yet linked them into our specific composite question. "Not in the corpus yet" is the honest answer.

## 4. VERDICT vs the Fable brief's positions

- **Per-turn stays projection-fed: AGREES (indirect but consistent).** The corpus's strongest relevant edges all point the same way: `RAG -[critiques]-> Latency` (ep 61), `Working Memory -[compares_to]-> Context Window` (SDS 985), `Retrieval -[builds_on]-> Cue` (ep 60). Fast local working set per turn, long-term store consulted on cue. Nothing in the corpus argues for a blocking remote call on every turn.
- **On-demand tools compose server-side: SILENT.** No corpus evidence either way (query 4, edges=[]). The brief's position survives unchallenged but uncorroborated; its justification must rest on Mindrian's own canon and code analysis, and it does.
- **Fail-closed guard moves into brain-client: SILENT.** No corpus coverage of degradation patterns (query 5, edges=[]). Same status: unchallenged, uncorroborated, ours to own.
- **Section-affinity ranking dimension: STRONGLY SUPPORTED.** It is an instance of the corpus's best-attested pattern (two-stage retrieve-then-rerank, ep 25) combined with its most repeated structural claim (graph signals complement vector/semantic signals: ep 21, ep 57, Atomic GraphRAG). This is the single place where the corpus actively endorses the milestone's design.

Strongest single supporting citation, verbatim edge form:
`Top K -[compares_to/EXTRACTED]-> Top N` (https://feeds.podcastle.ai/4f/ShZe-ep25 span 17816:17833) together with `Embeddings -[critiques/EXTRACTED]-> Nuances` (same episode, span 3520:3582): retrieve broad on similarity, rerank narrow on the richer signal, because similarity alone misses nuance. Section affinity IS that richer signal for Mindrian.

No corpus evidence contradicts any Fable brief position. One position (section-affinity) is actively endorsed; one (projection-fed per-turn) is consistently supported by adjacent edges; two (server-side composition, fail-closed guard) are corpus-silent and rest on Mindrian's own analysis.
