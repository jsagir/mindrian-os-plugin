---
id: SEED-094
status: dormant
planted: 2026-09-08
planted_during: "Phase 298 (SEED-032: Harness-as-Code), wave 2 execution"
trigger_when: "when a phase next touches room_search, room_graph, or the local room.db read path for a relational or thematic query (not a literal-substring lookup); or when Phase 299 (SEED-033, autonomous execution) is planned, since a router decision changes what an autonomous chain is allowed to traverse unattended; or when a navigator reports room_search returning nothing for a question that is actually answerable from edges already in the room graph"
scope: large
---

# SEED-094: Route room queries by type: graph traversal for relational questions, community summaries for thematic ones, hybrid substring plus semantic for lookup, with edge provenance so drift is distinguishable from hallucination

## Why This Matters

room_search today is one mode: case-insensitive substring match, explicitly not semantic or
fuzzy (its own tool description says so). room_graph and graph_query are a second mode:
neighborhood traversal from a focus node. Nothing routes between them by query shape, and
nothing answers a thematic question ("what are the recurring tensions across this room's
meetings") at all, because no single node or neighborhood contains a theme.

The navigator-supplied "Techniques to Master Modern AI Systems" reference (2026-09-08,
revised) names this gap precisely as its GraphRAG variant (Section 1, Variant C). Two query
modes, not one: local search (entity plus neighborhood expansion, what MindrianOS's
graph_query already does) and global search (map-reduce over pre-computed hierarchical
community summaries, which MindrianOS has no analog of). The reference's own worked example:
"what are the recurring themes across these meetings" is exactly the shape of question a room
navigator asks and room_search cannot answer, because no chunk (no meeting entry) contains a
theme; themes are a property of the whole room.

The reference also names the two failure modes an LLM-constructed graph has, and they map
directly onto this repo's own machinery:

- **Spurious noise -> retrieval drift**: an edge that should not exist, followed as if it did.
  Remedy: edge confidence, provenance, source-count thresholds. MindrianOS's graph_write
  already carries `read_version` for optimistic-concurrency provenance on writes; nothing
  reads confidence or source-count back at traversal time.
- **Incomplete information -> retrieval hallucination**: traversal continues through a gap it
  cannot support. Remedy per the reference: abstain, or fall back to text retrieval, or ask a
  human. That remedy IS a Decision Gate ("I cannot traverse this"), which MindrianOS already
  has the machinery for (gate_render / gate_answer); nothing currently fires it from a
  traversal read path, only from a chain halt.

Filed alongside SEED-092 (a grounding-grader harness policy) and SEED-093 (evidence-window
invalidation on model change), from the same reference and the same Phase 298 review session.
This seed is the knowledge-injection-axis counterpart; those two are the runtime-control-axis
ones (the reference's fourth axis, added in the revision).

Grounding note (langtalks graph, 9,260-node snapshot dated 2026-08-27): GraphRAG itself is
well represented (ep 41 with Lee Twito and Gal Peretz; ep 21 with Jesus Barrasa/Neo4j on
knowledge graphs generally; two 2026 papers, Zarrinkia/Srinivasan/Thomo arXiv 2603.14045 on
the Graph-RAG reasoning bottleneck, and Ma et al. arXiv 2603.14828 on retrieval drift and
hallucination from imperfect graphs - both cited directly in the filed research entry below).
Community-detection specifics (Leiden clustering, hierarchical map-reduce) are the reference's
own synthesis and are NOT independently corroborated in the corpus; treat that mechanism as a
design idea to validate, not a grounded fact.

## When to Surface

**Trigger:** see frontmatter. This is explicitly NOT a Phase 298 task (298 is locked to the
harness-manifest and policy-declaration surface per 298-SPEC.md) and explicitly NOT
automatically part of Phase 299 either - it is an input to how 299 is scoped, not a
sub-requirement of it, since routing a query and routing an autonomous chain are related but
distinct decisions.

## Scope Estimate

**Large**: this is a full milestone-shaped idea, not a phase-shaped one. Minimum honest scope:
(1) a query-shape classifier (relational vs thematic vs lookup) sitting in front of
room_search/graph_query, (2) SOME thematic-summary mechanism over room.db content (community
detection is one option; a cheaper LLM map-reduce over section entries is another, and the
choice needs its own research pass against Canon Part 8 since summarization touches room
content directly), (3) edge-confidence or source-count metadata on graph_write's typed edges,
read back at traversal time, (4) the abstain-or-gate remedy wired into whichever traversal
read path grows deep enough to hit an unsupported gap. Each of the four could be its own
phase; do not scope this as one plan.

## Breadcrumbs

- lib/mcp/tools (or equivalent): room_search tool description ("literal-recall... NOT semantic
  or fuzzy matching, so for a conceptual or relational question reach for room_graph")
- graph_query / graph_reason (mcp__plugin_mos_mindrian-os__graph_query,
  mcp__plugin_mos_mindrian-os__graph_reason transitive_support mode): the existing local-search
  analog (neighborhood traversal, multi-hop reads), no global/thematic mode
- graph_write: read_version optimistic-concurrency field, the nearest existing thing to edge
  provenance; no confidence or source-count field today
- gate_render / gate_answer: the existing Decision Gate machinery the "abstain, ask a human"
  remedy would reuse rather than build new
- .planning/seeds/SEED-092-grounding-grader-harness-policy-sourced-claims-rung-ladder.md and
  SEED-093-harness-evidence-window-invalidation-on-model-version-change.md: sibling seeds from
  the same source and session
- ~/MindrianRooms/rethinking-mindrianos/research/2026-09-08-techniques-modern-ai-systems-revised-capture.md
  (mirrored to ~/MindrianOS/research/): the full filed reference, GraphRAG section, both papers
  cited with arXiv ids
- .planning/todos/pending/2026-09-08-phase-299-runtime-hitl-gate-placement-inputs.md: the
  sibling todo carrying the runtime-control-axis half of this same source into Phase 299's
  discussion

## Notes

Captured during Phase 298 wave 2 execution, from a langtalks-grounded Larry review of a
navigator-supplied and then navigator-revised AI-systems reference. The revision itself
independently converged on several points the review had raised (adding GraphRAG, splitting
HITL into two architectures, a memory-terminology warning) before this seed was written -
evidence the review's gaps were real, not idiosyncratic.
