# The Brain -- MindrianOS Moat Architecture

> See also: `docs/WORKFLOWS.md` -- the framework-to-command layer (Phase 122). The Brain holds methodology (`Framework -[:FEEDS_INTO]-> Framework`); the framework-to-command mapping is plugin-local (`data/command-registry.json`, resolved via `lib/workflow/command-resolver.cjs`). Commands NEVER enter the Brain -- no `Command` node, ever (Canon Part 8).

## What The Brain IS

The Brain is not a prompt. It is not a document. It is not a database.

The Brain is a live intelligence service hosted at pws-brain-mcp.onrender.com that provides contextual teaching intelligence to every MindrianOS user. It is the difference between a chatbot that knows about JTBD and a thinking partner that knows WHEN to introduce JTBD, HOW to frame it for THIS users problem, and WHAT to chain it with next.

The Brain is Larry -- not as text, but as accumulated judgment.

## The Five Layers

### Layer 1: The Framework Graph (Neo4j -- 27,904 nodes, 19,987 relationships)

Not a list of frameworks. A GRAPH of how innovation methodology works.

The 27,904-node total includes 12,401 MethodologyChunk substrate nodes (the Phase 127.1 GraphRAG collapse moved the chunk corpus into Neo4j); the teaching-graph core is ~15.4K nodes. (Live read 2026-06-27 -- see MINDRIAN-CANON.md Appendix D.)

Node types (top labels, live read 2026-06-11): MethodologyChunk (12,401), Concept (9,131), __Entity__ (4,357), Framework (748), Product (1,289), Chunk (1,167), Event (1,013), ProcessStep (650), Person (624), plus Phase, ProblemType, Book, Tool, Technique, Course, Example -- 27 canonical labels total (see mindrian-deploy/docs/BRAIN-SCHEMA.md section 1).

Critical relationship types (the moat):
- FEEDS_INTO: The load-bearing framework-sequencing edge -- one framework's output becomes the next's input; 163 Framework->Framework edges, ~7.9K traversable chains depth 1-4. (Domain Explorer feeds into Bono as hats.)
- TRANSFORMS_OUTPUT_TO: How one output becomes another's input (sub-domains become personas)
- ADDRESSES_PROBLEM_TYPE: Which framework for which problem class (Ill-Defined, Wicked, Well-Defined, Undefined)
- HAS_PHASE: Ordered phase progressions
- PREREQUISITE: What must be explored first
- APPLIED_IN: Real examples with grades
- CO_OCCURS: (0 in the graph as of Phase 3 -- statistical co-occurrence is kept in a sidecar JSONL, never a Brain edge; see BRAIN-SCHEMA.md section 2a)
- 28 canonical relationship types total (see BRAIN-SCHEMA.md section 2)

Why unreplicable: Built from 30+ years of teaching. Relationships DISCOVERED through watching 100+ students apply frameworks. Chaining rules come from real classroom observation, not theory.

### Layer 2: The Semantic Embeddings (Pinecone pws-brain -- 12,485 vectors, 1024-dim + Neo4j framework index)

1024-dimensional embeddings of the teaching corpus across five namespaces (live read 2026-06-11): core (8,555), materials (1,775), reference (1,690), tools (242), graphrag (144), books (7). Enables meaning-matching, not keyword-matching. Combined with graph: semantics finds WHAT, graph finds WHY and WHAT NEXT.

Separately, the Neo4j `framework_embeddings` vector index (384-dim, COSINE) now covers all 177 :Framework nodes -- re-embedded in brain-cleanup Phase 5 QUAL-03 using all-MiniLM-L6-v2 (was 6/100 / 23/748 pre-cleanup). The Pinecone pws-brain index (12,485 vectors) and the Neo4j framework vector index are distinct; the former is the semantic search surface, the latter powers framework similarity lookups directly on the graph.

### Layer 3: The Grading Engine

Calibrated from 100+ real projects. Rubric: Technical Feasibility (25%), Logical Argument (25%), Tool Usage (25%), Cognitive Bias (12.5%), QA (12.5%). Real grade distributions from A (90+) through D+ (48) to F (43). Top feedback patterns: Vision-to-Execution Gap, Framework Vomit, Solution-First, Single-Tool.

### Layer 4: The Mode Intelligence

Not the algorithm (thats in the plugin). The CALIBRATION DATA. 40:30:20:10 engagement distribution. Voice modulation mapping to mode shifts. Strategic question progression patterns. Context-aware adaptations by user type and room state.

### Layer 5: The Chain Recommender (highest-value moat)

Contextual framework chain recommendations based on: room state + framework graph + user history + problem classification + grading assessment. Not static lookup -- LIVE INFERENCE across all five layers.

Example: User has 5 sub-domains from Domain Explorer, tool_usage score is 3/10. Brain recommends: Bono (sub-domains as hats, priority HIGH), then JTBD (sub-domains as personas), then Devils Advocate. Estimated room impact: 17% to 50% readiness.

## Brain MCP Tools (what the plugin calls)

The Brain MCP registers exactly six tools (`mcp-server-brain/lib/brain-ask.cjs`).

| Tool | Returns | User Experiences |
|------|---------|-----------------|
| brain_query | Read-only Cypher results from the teaching graph | Larry seems remarkably knowledgeable |
| brain_schema | Graph structure -- labels, relationship types, properties | Larry knows how the methodology connects |
| brain_write | Confirmed write into the graph (guarded) | Larry remembers what the curriculum teaches |
| brain_search | Semantic-vector matches across teaching materials | Larry finds the right material by meaning, not keyword |
| brain_stats | Index health + corpus counts | Larry's intelligence is live and measurable |
| brain_ask | GUIDED DirectiveEnvelope -- the flagship tool: Larry frames the question, chains the frameworks, and teaches the next move | Larry suggests the perfect next step and explains why |

The user never sees a tool call. They see Larry being brilliant.

## When The Brain Is Unreachable

The Brain is required for methodology. A fresh install registers silently by default (see
`docs/install/BRAIN-SETUP.md`) and starts serving graph-grounded methodology with no key, no
file to drop, no restart ceremony. If registration has not completed, the Brain is offline, or
the operator explicitly opted out (`MINDRIAN_DISABLE_AUTO_REGISTER=1`), Larry refuses visibly
rather than serving a lookalike from local text: a methodology request gets an honest
`DIRECTOR_NOT_AVAILABLE` refusal naming the cause, with room context and conversation still
available. Larry never improvises the graph's job from memory.

## The Flywheel

More users install (free) -> some connect Brain (paid) -> Brain serves intelligence -> users get better results -> word of mouth -> more users -> anonymized patterns improve Brain -> Brain gets smarter -> repeat.

Network effect moat, not content moat.
