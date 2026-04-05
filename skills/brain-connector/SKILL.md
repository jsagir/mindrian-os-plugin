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

## Proactive Surfacing (SessionStart + PostToolUse)

After room changes and session start:
- Run gap assessment and contradiction check against room frameworks
- Max 2 HIGH-confidence findings
- Voice: "Hold on -- I noticed something..."
- For Brain users, replaces room-proactive bash analysis (superset)

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
