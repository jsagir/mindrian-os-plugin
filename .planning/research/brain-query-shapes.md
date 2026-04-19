---
status: research-stub
phase: 90
created: 2026-04-19
owner: Phase 90 research during planning
purpose: Spec the exact Brain query shapes brain-derivation.cjs uses to build BRAIN.md sections
---

# Brain Query Shapes for Phase 90 Brain Derivation Layer

## Why this document exists

Phase 90 CONTEXT specifies that `lib/core/brain-derivation.cjs` calls `brain_ask` / `brain_query` to populate each BRAIN.md section. The exact prompts, query shapes, and expected return shapes are NOT specified. Without this document, the planner for Phase 90 has to invent them. That produces risky guesses.

This doc answers: for each BRAIN.md section, what does brain-derivation.cjs ask Brain, and what shape of answer does Brain return?

## Research method

Before Phase 90 plans are generated, run the following against Brain MCP:
1. Probe `mcp__mindrian-brain__brain_schema` to verify current node types
2. For each BRAIN.md section below, craft a candidate query, test it, document the return
3. File results back in this document before running `/gsd:plan-phase 90`

## BRAIN.md sections -- query shapes needed

### 1. Pattern Matches
**Input:** governing_thought string, section name, venture_stage
**Brain query target:** Framework nodes + Case nodes with similar claim patterns
**Expected return shape:** array of `{node_type, node_id, similarity_score (0-1), summary}`
**Open question:** How is similarity computed? Pinecone embedding of governing_thought against node embeddings, or keyword match via Cypher?

### 2. Cross-Domain Analogies
**Input:** section identifier, governing_thought, framework_applied
**Brain query target:** SAPPhIRE / TRIZ nodes, cross-domain edges
**Expected return shape:** array of `{source_domain, target_domain, analogy_type, mapping, confidence}`
**Open question:** Does Brain have SAPPhIRE/TRIZ populated, or is this for future data?

### 3. Wicked Indicators
**Input:** section content excerpt, governing_thought
**Brain query target:** 8 WickedIndicator nodes flagged in earlier audit
**Expected return shape:** array of `{indicator_name, present (bool), evidence_excerpt}`
**Open question:** What are the 8 indicators specifically? Query Brain for full list at start of research.

### 4. Unfilled Opportunity Matches
**Input:** venture_stage, section_type, governing_thought
**Brain query target:** Opportunity nodes (value_potential: transformative/high/medium)
**Expected return shape:** array of `{opportunity_id, title, value_potential, match_score, rationale}`
**Open question:** Are Opportunity nodes already scored against venture types or does match happen at query time?

### 5. Framework Chain Predictions
**Input:** current framework_applied, venture_stage, problem_type
**Brain query target:** Framework FEEDS_INTO edges
**Expected return shape:** ordered list of `{next_framework, confidence, reasoning}`
**Open question:** 40+ FEEDS_INTO edges exist per prior audit; what's the fanout per framework?

### 6. Assessment Thinking Chain Position
**Input:** current rigor level (applied frameworks)
**Brain query target:** PedagogicalChain nodes
**Expected return shape:** `{current_position, suggested_next_step, progression_chain}`
**Open question:** Is there one canonical Assessment Thinking Chain or multiple by domain?

### 7. ProblemType Classification
**Input:** governing_thought, section content excerpt
**Brain query target:** ProblemType nodes (Undefined/Ill-Defined/Well-Defined/Wicked)
**Expected return shape:** `{classification, confidence, evidence_flags}`
**Open question:** Does Brain have a classifier or does this require prompt-based inference?

### 8. Flagged Contradictions (cross-room)
**Input:** governing_thought, room_id, accessible_rooms (respecting GUARDRAIL.md scope)
**Brain query target:** claims in other user rooms matching pattern
**Expected return shape:** array of `{target_room, target_section, contradiction_type, evidence}`
**Open question:** Cross-room aggregation requires room-scoped Brain indexing; does this exist?

## Open questions for research pass

1. **brain_ask vs brain_query** — which is cheaper / faster / more accurate per section? Cypher queries are zero-cost at inference but require schema knowledge. brain_ask auto-routes but may embed queries that fail silently.

2. **Token budget per derivation** — full 8-section derivation makes ~8-10 Brain calls. For a 10-section room with --all, that's 80-100 Brain calls. Rate limit implications.

3. **Caching strategy** — if governing_thought doesn't change, do we cache derivations? `governing_thought_hash` invalidates, but 7-day freshness window is also defined. What wins?

4. **Graceful degradation paths** — Brain offline = no BRAIN.md. But what if Brain returns partial (some sections succeed, others fail)? Partial BRAIN.md or skip entirely?

5. **Schema versioning** — Brain graph version bumps. BRAIN.md carries `brain_graph_version`. When Brain updates, all BRAIN.md become stale. Bulk regen or lazy?

## Deliverable shape

Before `/gsd:plan-phase 90`, fill in this doc with:
- Actual Cypher / brain_ask prompts per section
- Tested return shapes
- Fallback behaviors per failure mode
- Token cost per section per query

Then Phase 90 planner reads this and generates plans against known interface, not speculation.
