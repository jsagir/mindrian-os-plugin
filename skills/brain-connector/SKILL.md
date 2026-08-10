---
name: brain-connector
description: >
  Brain enrichment for Larry. Passive: weaves graph context into responses.
  Proactive: surfaces contradictions and gaps. Active when Brain API key is
  set (MINDRIAN_BRAIN_KEY in .env) or Brain MCP server is configured.
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
# activation: "env:MINDRIAN_BRAIN_KEY"  <- INERT. Claude Code does not read an `activation` frontmatter
#   key (its documented set is name, description, disable-model-invocation, allowed-tools,
#   disallowed-tools, arguments, context, background), and no code in this plugin reads it
#   either. Kept as a comment so the INTENT survives; it never gated anything. Pinned by
#   tests/test-skill-frontmatter-inert-keys.cjs.
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on infra. The Brain MCP connection / methodology-packet skill is invoked by other reaches as a capability; it runs on demand as plumbing, not on a navigator problem-state of its own."
---

# Brain Connector -- Enrichment Layer

## Detection

Check Brain availability in order:

**Step 0 -- HTTP-path detection (Phase 123, the standard install).** Run `node $PLUGIN_ROOT/lib/core/resolve-brain-key.cjs` (or in JS: `require('./lib/core/resolve-brain-key.cjs').resolveBrainKey()`). If the resolver returns `available: true`, the Brain is active via the **HTTP path** -- call into `lib/core/brain-client.cjs`'s `query() / search() / schema() / ask()`, NOT an MCP tool. The HTTP path is the standard install path on Claude Code CLI; the MCP path (steps 1-3 below) is an alternative for operators who bundle `mcp-server-brain/` or point an external Neo4j MCP at the canonical `mindrian-brain` server name. The resolver also surfaces SEC-02 permission failures explicitly (`available: false, reason: 'permissions too open: ...'`) -- treat those as "not loaded, user action needed", not as silent unavailability.

1. `MINDRIAN_BRAIN_KEY` env var (CLI users -- subsumed by step 0; kept for legacy detection)
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

**The command for a framework is whatever `command-resolver.commandsForFramework(<framework>)` returns** (`lib/workflow/command-resolver.cjs`, reading the generated `data/command-registry.json`) -- or, if none, "run <framework> manually -- there is no /mos: for it". For a chain, use `composeWorkflow(<framework-chain>)`. **Commands NEVER live in the Brain (Canon Part 8): the Brain holds methodology -- the FEEDS_INTO chains -- and the `recommendFrameworkChain` traversal in `lib/brain/chain-recommender.cjs` carries framework names + problem-type enums only, never a command string, never user content; the plugin-local registry holds the framework-to-command mapping.** Larry never names a `/mos:` from memory. If the resolver returns nothing, the answer is "run <framework> manually".

The Brain ranks WHICH frameworks to suggest next (the FEEDS_INTO traversal in `lib/brain/chain-recommender.cjs`); turning a recommended framework into a `/mos:` command is the resolver's job, not the Brain's, not memory. Fallback when the Brain is unreachable: local Room heuristics from the navigation engine + the `larry-personality` skill -- still resolving any command through `lib/workflow/command-resolver.cjs`.

See `docs/WORKFLOWS.md` for the full Brain <-> registry <-> Larry join and the Canon Part 8 boundary.

## Enrichment-Queue Auto-Append (Phase 249, ENRICH-01, Larry-direct leg)

On Desktop/Cowork, Larry reaches the Brain via the `pws-brain-mcp` MCP tools directly (`orchestration_readiness`, `discover_structure`) -- bypassing `brain-client.cjs` entirely, so the plugin's own capture seams never fire for this path. This is the ONE place that gap is closed:

**When a methodology consult returns `orchestration_readiness` 0-2/4, or `discover_structure` with `grounded: false`,** run the one-line append CLI so the miss lands in the same enrichment queue the plugin's wrapper chokepoint writes to:

```bash
node <plugin-root>/scripts/enrichment-queue-append.cjs \
  --room <current room directory> \
  --framework "<canonical framework name>" \
  --score <the readiness_score integer, or omit for a discover_structure miss> \
  --missing <comma-separated dims from pattern_type,structure,techniques,flow> \
  --source live_reach
```

Content-free by construction (Canon Part 8): only the canonical framework name, the integer score, the closed-enum dimension tokens, and the fixed `source live_reach` string ever cross into the call -- NEVER the user's turn text, the conversation content, or any artifact body. Never mention this bookkeeping to the user; it is silent backlog maintenance, same posture as every other passive/proactive enrichment behavior on this page.

This is the SAME queue and the SAME append CLI the CLI-path wrapper chokepoint (`lib/core/brain-client.cjs`'s `orchestrationReadiness`/`discoverStructure`) and Phase 250's visible-refusal auto-queue both write through -- one queue, one write surface, per Part 7 (never a second enrichment mechanism).

## Delegation

Delegate to `agents/brain-query.md` for: 2+ graph hops, explicit connection exploration, cross-domain discovery, multi-venture patterns, deep proactive reasoning.

## Primary Tool: brain_ask

Always use `brain_ask` first -- natural language, auto-routes Pinecone/Neo4j, handles fallback. Only use `brain_query` (raw Cypher) for specific complex queries.

## Tool Names

| Surface | Smart | Neo4j | Pinecone | Schema |
|---------|-------|-------|----------|--------|
| CLI (HTTP via brain-client.cjs) | `brain-client.ask()` | `brain-client.query()` | `brain-client.search()` | `brain-client.schema()` |
| mindrian-brain (MCP) | brain_ask | brain_query | brain_search | brain_schema |
| neo4j-brain (legacy MCP) | N/A | read_neo4j_cypher | search-records | get_neo4j_schema |

The first row is the HTTP path (Phase 123 step 0). When `lib/core/resolve-brain-key.cjs` resolves a key, call directly into `lib/core/brain-client.cjs` -- no MCP server required. The bottom two rows are the MCP-path alternatives.
