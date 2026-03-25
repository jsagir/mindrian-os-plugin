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

### Offer-to-Setup

When Brain detection fails (all 3 checks return false) AND the user's request would benefit from Brain enrichment (framework queries, grading, cross-domain connections):

1. Answer the user's question using local references (Tier 0 — always works)
2. After the response, add a brief offer: "I'd give you more here with Brain connected — `/mos:setup brain`"
3. Only offer ONCE per session. If user doesn't respond to it, do not repeat.

Brain-beneficial signals: mentions of "grade", "connections", "framework recommendation", "what should I use", "suggest-next", "research [topic]"

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

## Primary Tool: brain_ask

**Always use `brain_ask` first.** It accepts natural language, handles Pinecone vs Neo4j routing internally, and falls back automatically when Pinecone quota is exhausted.

```
brain_ask({ question: "What frameworks relate to JTBD?", topK: 5 })
```

The caller never writes Cypher. The server handles:
- Pinecone semantic search (when available)
- Neo4j Cypher fallback (when Pinecone quota exhausted)
- Keyword extraction from natural language
- Pattern matching to optimal Cypher template

**Only use brain_query (raw Cypher) when you need a specific, complex query that brain_ask can't handle.**

## Tool Names (by surface)

| Surface | Smart Tool | Neo4j Direct | Pinecone Direct | Schema |
|---------|-----------|-------------|-----------------|--------|
| CLI/Desktop (mindrian-brain) | brain_ask | brain_query | brain_search | brain_schema |
| Legacy (neo4j-brain direct) | N/A | read_neo4j_cypher | search-records | get_neo4j_schema |

Try `brain_ask` first. Fall back to direct tools only for complex Cypher. Fall back silently on all errors.
