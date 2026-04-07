---
name: brain-connector
description: >
  Brain enrichment for Larry. Passive: weaves graph context into responses.
  Proactive: surfaces contradictions and gaps. Active when Brain API key is
  set (MINDRIAN_BRAIN_KEY in .env) or Brain MCP server is configured.
activation: "env:MINDRIAN_BRAIN_KEY"
---

# Brain Connector -- Enrichment Layer

## Detection

Check Brain availability in order:
1. `MINDRIAN_BRAIN_KEY` env var (CLI users)
2. `mcp__mindrian-brain__brain_schema` tool (Desktop/Cowork MCP)
3. `mcp__neo4j-brain__get_neo4j_schema` tool (legacy)

Any success = Brain active. All fail = silent fallback. Never mention failures to user.

Pinecone RESOURCE_EXHAUSTED (429): fall back to Neo4j Cypher only via `brain_query`.

### Offer-to-Setup

When Brain detection fails AND request would benefit (framework queries, grading, cross-domain): answer with local references first, then offer once: "I'd give you more here with Brain connected -- `/mos:setup brain`"

## Passive Enrichment (Every Turn)

- Framework mention: find related frameworks, weave naturally
- Methodology session: check if Brain recommends different next step
- Simple fast lookups only. Complex queries: delegate to Brain Agent.
- Prefer Cypher over Pinecone (no quota limits)

### Team-Execution Enrichment

When the user is discussing team, leadership, or working in team-execution section:

1. Query Brain for leadership frameworks matching the discussion:
```cypher
MATCH (f:Framework)-[:RELATED_TO]->(:Concept {name: 'Causal Reasoning'})
WHERE f.name IN ['Tuckman Team Stages', 'Psychological Safety', 'Adaptive Leadership',
                  'Emotional Intelligence in Leadership', 'High-Performing Teams']
OPTIONAL MATCH (f)-[:TYPICAL_AT]->(s:VentureStage {name: $venture_stage})
RETURN f.name, s IS NOT NULL AS matches_stage
ORDER BY matches_stage DESC
```

2. Surface the leadership FEEDS_INTO chain relevant to the conversation:
```cypher
MATCH path = (f:Framework {name: $current_framework})-[:FEEDS_INTO*1..3]->(next:Framework)
WHERE next.name IN ['Adaptive Leadership', 'Situational Leadership', 'High-Performing Teams',
                     'Distributed Leadership', 'Systems Leadership', 'Transformational Leadership']
RETURN next.name AS suggested, [r IN relationships(path) | r.confidence] AS confidence
ORDER BY confidence DESC LIMIT 3
```

3. Weave naturally: "The teaching graph connects what you're describing to [framework] -- it addresses the [specific gap] you mentioned."

## Proactive Surfacing (SessionStart + PostToolUse)

After room changes and session start:
- Run gap assessment and contradiction check against room frameworks
- Max 2 HIGH-confidence findings
- Voice: "Hold on -- I noticed something..."
- For Brain users, replaces room-proactive bash analysis (superset)

### Leadership Proactive Signals

On SessionStart, if room has team-execution entries:

1. Check if any leadership frameworks from the graph have been used vs. available:
```cypher
MATCH (f:Framework)-[:TYPICAL_AT]->(s:VentureStage {name: $stage})
WHERE f.name IN ['Tuckman Team Stages', 'Psychological Safety', 'Adaptive Leadership',
                  'Emotional Intelligence in Leadership', 'High-Performing Teams',
                  'Servant Leadership', 'Distributed Leadership', 'Transformational Leadership']
RETURN f.name AS available_framework
```

2. Compare against frameworks already applied in room (from STATE.md `frameworks_used`)
3. If 3+ unused leadership frameworks are available for the current stage, surface: "Your team section has data but you haven't used [N] leadership frameworks that match your stage. /mos:leadership to explore."

## Gating Rules

- Max 2 proactive findings per greeting
- HIGH confidence only for auto-surfacing
- Never interrupt methodology sessions
- Silent fallback on all failures
- Pinecone quota exhausted: use Neo4j only

## Brain-Powered Command Suggestions

Brain has Command nodes linked to Frameworks, VentureStages, SignalTypes. Level 3 intelligence from 100+ real projects.

Query `brain_proactive_command` for ranked suggestions with JTBD framing, trigger conditions, stage impact. Pick top match for current Room Signals. Present via JTBD formula from Command node fields.

Multi-hop: Room frameworks -> FOLLOWS_FRAMEWORK -> Command -> TRIGGERED_BY_SIGNAL -> Signals -> RELEVANT_AT_STAGE -> Stage

Fallback: local Room heuristics from larry-personality provoked suggestions.

## Delegation

Delegate to `agents/brain-query.md` for: 2+ graph hops, explicit connection exploration, cross-domain discovery, multi-venture patterns, deep proactive reasoning.

## Primary Tool: brain_ask

Always use `brain_ask` first -- natural language, auto-routes Pinecone/Neo4j, handles fallback. Only use `brain_query` (raw Cypher) for specific complex queries.

## Tool Names

| Surface | Smart | Neo4j | Pinecone | Schema |
|---------|-------|-------|----------|--------|
| mindrian-brain | brain_ask | brain_query | brain_search | brain_schema |
| neo4j-brain (legacy) | N/A | read_neo4j_cypher | search-records | get_neo4j_schema |
