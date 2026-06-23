# Phase 172 - SPFO v2.1 Chain-Model Reference (verified Brain schema)

> Filed 2026-06-23 from the navigator-provided SPFO v2.1 ("Schema-Aligned Output Format") module.
> SPFO is a framework-detection + appropriateness-grading workflow, but its VALUE to Phase 172 is that
> it is grounded in the VERIFIED live Mindrian Neo4j + Brain schema. It is the source-of-truth reference
> the 172 chain model (curated_chains -> projection FEEDS_INTO -> local-chain-recommender) must mirror,
> because the local orchestration projection is a Brain-DERIVED cache (Canon Part 8 dual-role) - its
> chain edges must match what the Brain actually holds, not a parallel invention. Part 8: generic
> methodology/schema reference only; zero user/venture content.

## Verified chain schema (the shape 172 mirrors)

- **FEEDS_INTO** (Framework -> Framework) carries `confidence` AND `transform`. 172's curated_chains
  today carry `{kind, from, to, confidence}` - they should ALSO carry `transform` to mirror the real
  edge.
- **Multi-hop chain confidence composes MULTIPLICATIVELY** along the path:
  `reduce(c = 1.0, r IN rels | c * coalesce(r.confidence, 0.5))`, ordered by hops then confidence DESC.
  172's local-chain-recommender should use this SAME composition so the offline (Brain-off) ranker
  matches the Brain's model exactly.
- **PREREQUISITE** (Framework <- Framework): what a student needed first. (172 projection: PREREQUISITE.)
- **COMPLEMENTS** (Framework -> Framework): frameworks that work together / integration quality.
  (172 projection uses FEEDS_INTO/CHAINS/PREREQUISITE; COMPLEMENTS is an available verified edge 172
  may surface for integration-density signals - noted, not required.)
- **ADDRESSES_PROBLEM_TYPE** (Framework -> ProblemType): appropriateness/fitness (replaces the invented
  GOOD_FOR). Suitability = present; unsuitability = absent.
- **USES_TOOL / USES_TECHNIQUE / EQUIPS_WITH / ALIAS_OF / MENTIONED_IN**: tool, technique, alias,
  provenance edges.
- Framework node pattern-shape scores: `pattern_linear_score / _cyclical_score / _matrix_score /
  _hierarchical_score` (floats) - the fitness/purpose-alignment signal.

## Graph proposes, Brain judges (= 172 control/data-plane + Part 8)

- Structural queries -> `myneo4j:read_neo4j_cypher` (the graph / control-structure). Qualitative
  judgment -> `mindrian-brain:brain_ask` (NL + curated ops). This is Canon Part 8 + D-172-g verbatim:
  structure is queryable; judgment is the Brain's; no user data crosses.
- `brain_ask` returns a **DirectiveEnvelope** (`directive`, `next_gate.sub_shape`, `mode_signals`) +
  hybrid Pinecone+Neo4j evidence - the SAME Part 3 Decision-Gate contract Larry rides (respect
  `mode_signals` e.g. `user_said_just_tell_me`; drive the follow-up off `next_gate.sub_shape`).
- 172's local projection is the **Brain-OFF mirror** of SPFO's live `framework_chain_slice` /
  FEEDS_INTO walk: Brain-on and Brain-off must yield the SAME chain shape (INV-12 Local-Only).

## Brain access model (operational, verified)

- Tool ids: `myneo4j:read_neo4j_cypher` / `myneo4j:write_neo4j_cypher` (NOT `my-neo4j` with a hyphen -
  that id does not exist); `mindrian-brain:brain_ask` (NL + curated ops).
- `mindrian-brain:brain_query` requires an ADMIN key not available in the workflow - do not call it.
- Curated brain_ask ops seen: `op:"list_frameworks"` (params {limit}), `op:"framework_chain_slice"`
  (params {seeds, max_hops}) - the curated equivalent of the FEEDS_INTO chain walk.

## The v2.0 -> v2.1 lesson (= 172's referential-integrity discipline)

SPFO v2.0 was written against an IDEALIZED graph (MisusePattern, MigrationPath, BETTER_THAN, GOOD_FOR,
Rubric{SPFO_RUBRIC_V1}, FrameworkCriterion, Tool-[:EFFECTIVE_FOR]->ProblemType) - NONE of which exist
live. v2.1 rewrites against verified schema only, with a PROVENANCE RULE: every claim traces to a
verified source; if a step returns empty, say so; NEVER fabricate from memory. This is exactly 172's
guard: the projection `resolve()` THROWS on an unknown endpoint; curated_chains from/to must resolve to
a real projection node (172-10 had to re-scope 5 endpoints; the 172-08 cross-class task keeps the
throw). 172 is built to NOT repeat the v2.0 invention mistake - SPFO is the cautionary case that proves
the discipline matters.

## Sharpenings folded into 172 (Plan 172-15)

1. Add `transform` to curated_chains entries so the projection FEEDS_INTO mirrors `{confidence, transform}`.
2. Adopt the multiplicative confidence composition in local-chain-recommender for multi-hop chains.
3. Treat this file as the verified-schema source-of-truth for the 172 chain edges (no invented edge/prop).

These are REFINEMENTS of INV-08 / R6 (the earned-chain shape); they mint no new edge type, node type, or
reach, and open no Brain wire (the projection stays a LOCAL Brain-derived cache).
