# The Brain — MindrinanOS Moat Architecture

## What The Brain IS

The Brain is not a prompt. It is not a document. It is not a database.

The Brain is a live intelligence service hosted at brain.mindrian.ai that provides contextual teaching intelligence to every MindrinanOS user. It is the difference between a chatbot that knows about JTBD and a thinking partner that knows WHEN to introduce JTBD, HOW to frame it for THIS users problem, and WHAT to chain it with next.

The Brain is Larry -- not as text, but as accumulated judgment.

## The Five Layers

### Layer 1: The Framework Graph (Neo4j -- 21K+ nodes, 65K+ relationships)

Not a list of frameworks. A GRAPH of how innovation methodology works.

Node types: Framework (275+), Phase (ordered steps per framework), Concept (abstract ideas), ProblemType (Un/Ill/Well-Defined, Wicked), Book (59 analyzed), Tool (59 with PWS mappings), Course (curriculum), Example (graded student work).

Critical relationship types (the moat):
- FEEDS_INTO: Framework chaining rules (Domain Explorer feeds into Bono as hats)
- TRANSFORMS_OUTPUT_TO: How one outputs become anothers input (sub-domains become personas)
- CO_OCCURS: Frameworks that naturally pair
- ADDRESSES_PROBLEM_TYPE: Which framework for which problem class
- HAS_PHASE: Ordered phase progressions
- PREREQUISITE: What must be explored first
- APPLIED_IN: Real examples with grades

Why unreplicable: Built from 30+ years of teaching. Relationships DISCOVERED through watching 100+ students apply frameworks. Chaining rules come from real classroom observation, not theory.

### Layer 2: The Semantic Embeddings (Pinecone -- 1,427+ vectors)

384-dimensional embeddings of every teaching material: methodology chapters, framework deep-dives, graded student examples, lecture transcripts. Enables meaning-matching, not keyword-matching. Combined with graph: semantics finds WHAT, graph finds WHY and WHAT NEXT.

### Layer 3: The Grading Engine

Calibrated from 100+ real projects. Rubric: Technical Feasibility (25%), Logical Argument (25%), Tool Usage (25%), Cognitive Bias (12.5%), QA (12.5%). Real grade distributions from A (90+) through D+ (48) to F (43). Top feedback patterns: Vision-to-Execution Gap, Framework Vomit, Solution-First, Single-Tool.

### Layer 4: The Mode Intelligence

Not the algorithm (thats in the plugin). The CALIBRATION DATA. 40:30:20:10 engagement distribution. Voice modulation mapping to mode shifts. Strategic question progression patterns. Context-aware adaptations by user type and room state.

### Layer 5: The Chain Recommender (highest-value moat)

Contextual framework chain recommendations based on: room state + framework graph + user history + problem classification + grading assessment. Not static lookup -- LIVE INFERENCE across all five layers.

Example: User has 5 sub-domains from Domain Explorer, tool_usage score is 3/10. Brain recommends: Bono (sub-domains as hats, priority HIGH), then JTBD (sub-domains as personas), then Devils Advocate. Estimated room impact: 17% to 50% readiness.

## Brain MCP Tools (what the plugin calls)

| Tool | Returns | User Experiences |
|------|---------|-----------------|
| enrich_context | Framework matches + connections | Larry seems remarkably knowledgeable |
| suggest_chain | Ranked next-frameworks with transforms | Larry suggests the perfect next step |
| suggest_methodology | Best framework for this moment | Larry introduces the right tool naturally |
| grade_room | Rubric scores + targeted feedback | Honest, calibrated assessment |
| find_connections | Cross-domain bridges | Surprising connections between fields |
| get_chaining_rules | Transform instructions for pipeline handoffs | Pipelines chain intelligently |
| get_teaching_context | Mode-calibrated teaching approach | Larry adjusts perfectly |

The user never sees a tool call. They see Larry being brilliant.

## Without Brain (Tier 0)

Everything works. Embedded references/ has 275 frameworks as text, static chain suggestions, mode algorithm. Tier 0 Larry is good. Tier 1 Larry (with Brain) is a master teacher. The difference is textbook vs professor.

## The Flywheel

More users install (free) -> some connect Brain (paid) -> Brain serves intelligence -> users get better results -> word of mouth -> more users -> anonymized patterns improve Brain -> Brain gets smarter -> repeat.

Network effect moat, not content moat.
