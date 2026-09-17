# Phase 353 grounding - langtalks-graph-expert (2026-09-17)

Headline before the detail: all three `query_relationship` calls returned `"edges": []`.
Zero relationship edges, across all three questions. The payload is a flat bag of
entity-label nodes (`label` / `src` / `loc`) from a BFS neighborhood walk, not
relational facts, and it contains no verbatim quoted text anywhere - only source
names and character-offset pointers. That means none of the three questions below
can be answered with real `edge:` or quote-grounded evidence from this specific
tool call. Every "Bearing on Phase 353" verdict reflects that.

## Question 1

"How does hierarchical, folder-scoped context (each node reading only its own
contract and parent pointer) compare with loading the whole workspace into the
context window, for agent accuracy and token cost?"

### What the corpus says

- Thin footing: `total_found=1554`, 503 nodes shown (truncated), `edges: []`. No
  edge and no verbatim quote in the payload supports any comparison claim.
- The most on-topic node labels are drawn from the user's own prior ICM notes,
  not independent practitioner sources: "Pointer" [src=note-icm-architect-interpretable-context-meth.jsonl loc=34169:34176], "contract" [loc=6383:6391], "workspace" [loc=6440:6449], "folder" [loc=8611:8617], "Layered loading" [loc=27599:27614], "reading protocol" [loc=27622:27638], "always-load layer" [loc=27640:27657], "task-relevant nodes" [loc=27665:27684]. This is Phase 353's own vocabulary echoed back, not external corroboration.
- "Context Window" traces to the Redis/Andrew Brookins memory episode [src=https://softwareengineeringdaily.com/2025/08/26/redis-and-ai-agent-memory-with-andrew-brookins/ loc=814:829]; "Accuracy" and "cost" trace to arxiv 2603.14045, "The Reasoning Bottleneck in Graph-RAG" [loc=42991:42994 and loc=35222:35226]; "whole-KG injection" traces to arxiv 2603.14828, "Toward Robust GraphRAG" [loc=30954:30972]. These two papers look like the right sources by title, but no edge connects them to the folder/contract/pointer nodes above.
- No node or edge in the payload states a direction (e.g. "layered loading raises accuracy" or "whole-KG injection raises cost"). Any such claim here would be invented.

### Bearing on Phase 353

- UNGROUNDED: "reading only your own contract + parent pointer per turn improves agent accuracy vs loading the whole workspace." Corpus is silent - the two arxiv papers that look relevant never got past bare node labels in this call.
- UNGROUNDED: "folder-scoped reading cuts token cost vs whole-workspace loading." "tokens" and "cost" nodes exist, but zero edges relate them to folder-scoping or contracts.
- CAUTION: several of the "supporting" node labels (Layered loading, reading protocol, always-load layer, task-relevant nodes) are pulled from the user's own icm-architect notes already sitting in the graph. Treat this as a self-reference signal, not validation from outside the project.
- Design stands on its own reasoning for now. If real grounding is wanted, re-run with `relationship_path` or `multihop_query` between specific node pairs (e.g. "folder" -> "Accuracy", "whole-KG injection" -> "cost") instead of the bare BFS `query_relationship` dump used here.

## Question 2

"Precomputed routing tables or lookup-based tool selection versus an LLM choosing
tools at runtime: what do practitioners report about latency, determinism and
evaluation?"

### What the corpus says

- Thin footing: `total_found=964`, 523 nodes shown (truncated), `edges: []`. No edge and no verbatim quote supports any latency, determinism, or evaluation claim.
- On-topic node labels are present but disconnected: "Latency" [src=note-agent-factory-deep-dive-into-agent-evalu.jsonl loc=7414:7421], "Runtime" [src=https://www.latent.space/p/databricks loc=69160:69167], "routing" [src=note-icm-architect-interpretable-context-meth.jsonl loc=22582:22589], "Precomputed architecture intelligence" [src=https://www.youtube.com/watch?v=-Fb1SBC_nmg loc=12922:12959], "Lookup tools" [src=https://data4sci.com/blog/building-an-advanced-agentic-harness loc=3878:3890], "Tool Selection" [src=https://www.superdatascience.com/podcast/sds-985-the-four-types-of-memory-every-ai-agent-needs-with-richmond-alake loc=54861:54875], "Deterministic" [loc=2144:2157], "Non-Deterministic" [loc=8257:8274], "Evaluation" [src=https://arxiv.org/abs/2603.14045 loc=18003:18013].
- These labels span at least five distinct sources (an agent-eval podcast, a Databricks/Latent Space episode, a GitNexus code-graph video, a harness-engineering blog, a memory podcast), which suggests the underlying episodes do discuss precomputed vs LLM-chosen tool routing somewhere - but this BFS walk returned no edge tying "Precomputed architecture intelligence" to "Latency," or "Deterministic" to "Evaluation."
- No practitioner quote on latency numbers, determinism trade-offs, or eval methodology survived into this payload.

### Bearing on Phase 353

- UNGROUNDED: "a precomputed shipped table filtered at runtime is faster than an LLM choosing at runtime." "Latency," "Runtime," and "Precomputed architecture intelligence" co-occur in the neighborhood, but no edge states a comparison.
- UNGROUNDED: "precomputed lookup is more deterministic / more evaluable than LLM tool choice." "Deterministic," "Non-Deterministic," and "Evaluation" are present as separate, disconnected nodes.
- CAUTION: "Deterministic" and "Non-Deterministic" both surfacing as distinct nodes (rather than one edge relating them) hints the corpus likely does contain a real deterministic-vs-nondeterministic debate, most plausibly in the Agent Factory evaluation episode or the Claws Architecture episode. Worth a targeted `relationship_path` follow-up before treating this pass as conclusive either way.
- Design stands on its own reasoning for now. Re-run narrower (e.g. `relationship_path("Deterministic", "Tool Selection")`) rather than citing this dump as support.

## Question 3

"Anchoring retrieved memory or claims to an explicit intent or job-to-be-done node
in a knowledge graph: does typed anchoring improve retrieval precision and
provenance in agent memory systems?"

### What the corpus says

- Thin footing: `total_found=1051`, 516 nodes shown (truncated), `edges: []`. No edge and no verbatim quote supports a precision or provenance claim.
- On-topic node labels: "Claims" [src=note-icm-architect-interpretable-context-meth.jsonl loc=21277:21282], "Anchoring" [src=https://feeds.podcastle.ai/f4fd14e4-4a16-40d6-8c8c-7309e27978e8/text2sql.mp3 loc=4894:4903], "Intent" [src=https://feeds.podcastle.ai/e28ca915-73a3-4e32-a9a4-7d7185b4c16a/voice%2520agents.mp3 loc=19028:19034], "Job" [src=note-icm-architect-interpretable-context-meth.jsonl loc=28724:28728], "Provenance Pointers" [src=https://arxiv.org/abs/2603.14828 loc=56826:56845], "retrieved evidence" [loc=89889:89907], "Relational Tuples" [loc=56793:56808], "Source Passage" [loc=56853:56867], "Precision" [src=note-easyhypergraph-fast-higher-order-network.jsonl loc=8325:8334], "TypedTool" [src=https://data4sci.com/blog/building-an-advanced-agentic-harness loc=5762:5771].
- Four of these labels (Provenance Pointers, retrieved evidence, Relational Tuples, Source Passage) trace to the single arxiv paper 2603.14828, "Toward Robust GraphRAG: Mitigating Retrieval Drift and Hallucination from Imperfect Knowledge Graphs" - by title the most plausible source for this exact question - but none of these node labels are connected to each other or to "Anchoring" / "Job" / "Intent" by any edge the tool returned.
- "Job" and "Intent," the two labels closest to "job-to-be-done," come from unrelated sources: "Job" from the user's own icm-architect notes, "Intent" from a voice-agents podcast about conversational-turn intent detection. These are likely false-friend matches, not the same sense of JTBD Phase 353 means.

### Bearing on Phase 353

- UNGROUNDED: "a typed anchor edge from every filed claim to a JTBD node improves retrieval precision." No edge in the payload connects any anchoring/job/intent node to any precision/provenance node.
- CAUTION: don't read the mere presence of "Job" and "Intent" as validation - "Intent" is almost certainly a voice-agent NLU concept, not a knowledge-graph JTBD-anchor concept. Treat as a false-friend match, not support.
- CAUTION: arxiv 2603.14828's cluster of provenance-related labels (Provenance Pointers, retrieved evidence, Relational Tuples, Source Passage) is a strong signal that paper is worth reading directly - this tool call captured its vocabulary but none of its actual claims.
- Design stands entirely on the team's own reasoning for now. If grounding is wanted, read 2603.14828 directly or re-query with `relationship_path` anchored on its specific node ids, not this BFS dump.

## Coverage

- File 1 (Q1, hierarchical context): 2524 lines total. Lines 1-2400 read in full via the Read tool (six 400-line passes). Lines 2401-2524 (the closing `edges: []` and the single-line `raw` field, ~61,165 characters) exceeded the Read tool's per-call token limit as one JSON line; verified instead by direct pattern search (`grep`/`wc`) confirming `raw` is an exact text duplicate of the 503-node array plus a truncation footer, with zero occurrences of the string "EDGE" anywhere in the file. Nodes: 503 shown / 1554 total_found. Edges: 0.
- File 2 (Q2, routing tables): 2624 lines total. Lines 1-2400 read in full via the Read tool. Lines 2401-2624 (~61,119-character `raw` line) verified the same way: duplicate of the 523-node array, zero "EDGE" occurrences. Nodes: 523 shown / 964 total_found. Edges: 0.
- File 3 (Q3, typed anchoring): 2589 lines total. Lines 1-2400 read in full via the Read tool. Lines 2401-2589 (~61,066-character `raw` line) verified the same way: duplicate of the 516-node array, zero "EDGE" occurrences. Nodes: 516 shown / 1051 total_found. Edges: 0.

## Targeted follow-up (relationship_path and multihop_query on named pairs, same day)

The BFS dumps above carried zero edges, so the orchestrator ran the corpus's own path tools on the node pairs the summary flagged. Results verbatim from the tool:

- `Provenance Pointers` -> `Retrieval`: found, 2 hops, both `mentioned_in_episode` "Toward Robust GraphRAG: Mitigating Retrieval Drift and Hallucination from Imperfect Knowledge Graphs" (arxiv 2603.14828).
- `Knowledge Graph` x `Provenance` (multihop): shared_episodes 0; the path again routes through the same GraphRAG paper via `Provenance Pointers`.
- `Agent memory` -> `Provenance`: found, 3 hops: `agent memory --compares_to--> RAG --mentioned_in_episode--> [the same GraphRAG paper] <--mentioned_in_episode-- Provenance Pointers`.
- `Precomputed architecture intelligence` -> `Latency`: found, 3 hops, through the episode Fb1SBC_nmg where `Query --critiques--> Latency`.
- `Deterministic` -> `Evaluation`: found, 2 hops, co-mentioned only in "61 - Voice Agents | Shay Davidson (Lemonade)" (a voice-agent evaluation context, not tool routing).
- `Context window` -> `Tool selection`: found, 2 hops, co-mentioned only in "SDS 985: The Four Types of Memory Every AI Agent Needs (Richmond Alake)".

Reading: the corpus offers three pointers worth a direct read before Plan 2 and Plan 3 are executed, and no claim that grounds or contradicts the design:
1. arxiv 2603.14828 (robust GraphRAG, retrieval drift, provenance pointers) for the anchor-edge design (D-353-8): the vocabulary match (provenance pointers to retrieved evidence) is exactly the shape of "a claim carries a pointer to the job node it was filed under". UNGROUNDED until read; the planner may cite it as a reading, never as evidence.
2. SDS 985 (four types of agent memory) for the per-turn read budget (invariant 7): a co-mention of context window and tool selection, nothing more.
3. Episode Fb1SBC_nmg ("precomputed architecture intelligence", "query critiques latency") for the precomputed-ledger decision (D-353-3): the one place in the corpus where precomputation and latency sit in the same episode. UNGROUNDED as evidence; consistent in direction.

Verdict for the phase: the design's three load-bearing choices stand on the icm-architect method (invariants 1, 2, 4, 7, 8, 9, documented in `353-RESEARCH-GROUNDING-icm.md`) and on the Jev measurements (`353-RESEARCH-GROUNDING-jev.md`), not on this corpus. "Not in the corpus yet" is the honest answer here, per the standing consult rule.
