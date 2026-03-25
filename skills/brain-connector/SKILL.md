---
name: brain-connector
description: >
  Brain enrichment for Larry. Passive: weaves graph context into responses.
  Proactive: surfaces contradictions and gaps. Active when Brain API key is
  set (MINDRIAN_BRAIN_KEY in .env) or Brain MCP server is configured.
---

## Detection

Check if Brain is available. Try these in order:

1. Check if `MINDRIAN_BRAIN_KEY` environment variable is set (CLI users with API key)
2. Try calling `mcp__mindrian-brain__brain_schema` (Desktop/Cowork users with MCP config)
3. Try calling `mcp__neo4j-brain__get_neo4j_schema` (legacy direct connection)

Success on ANY = Brain active. All fail = silently fall back. **Never mention Brain connection failures to the user.**

**If Pinecone returns RESOURCE_EXHAUSTED (429):** This means the monthly embedding quota is used up. Fall back to Neo4j Cypher queries only — use `brain_query` tool with Cypher instead of `brain_search`. Neo4j queries do NOT consume Pinecone quota.

## Passive Enrichment (Every Turn)

Runs passive checks before responding. Check if Brain context helps:

- **Framework mention detected**: Use `brain_concept_connect` pattern from `references/brain/query-patterns.md` to find related frameworks. Weave naturally into response.
- **Methodology session active**: Use `brain_framework_chain` pattern to check if Brain recommends a different next step than static chains-index. Mention only if confidence is high.
- **Simple, fast lookups only**. Never run multi-hop queries inline. If complex, delegate to Brain Agent.
- **Prefer Cypher queries over Pinecone search** when possible — Cypher has no quota limits.

## Proactive Surfacing (SessionStart + PostToolUse)

After room changes and at session start:

- Run `brain_gap_assess` against current room frameworks (via Cypher, not Pinecone)
- Run `brain_contradiction_check` if new artifacts added
- Surface at most **2 HIGH-confidence findings**
- Use Larry's voice: "Hold on -- I noticed something..."
- For Brain users, this **replaces** the room-proactive bash analysis (`brain_gap_assess` is a superset)

## Gating Rules

- Max 2 proactive findings per session greeting
- Only HIGH confidence findings surface automatically
- Never interrupt a methodology session with proactive findings
- If any Brain call fails, silently fall back -- never error to user
- If Pinecone quota exhausted, use Neo4j only -- never block on Pinecone errors

## Delegation

Delegate to `agents/brain-query.md` when:
- Question requires 2+ graph hops
- User explicitly asks to explore connections
- Cross-domain discovery requested
- Pattern matching across multiple ventures

## Brain Tool Names (by surface)

| Surface | Neo4j Schema | Neo4j Query | Pinecone Search |
|---------|-------------|-------------|-----------------|
| CLI (API key) | brain_schema | brain_query | brain_search |
| Desktop (mindrian-brain MCP) | brain_schema | brain_query | brain_search |
| Legacy (direct neo4j-brain) | get_neo4j_schema | read_neo4j_cypher | search-records |

Try the first available. Fall back silently.
