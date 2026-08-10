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
# --- Phase 250-02 CIRS R16 Form B declaration (Canon Part 11) ---
hitl_stages:
  - stage: "brain-refusal-fork"
    shapes: ["F.1"]
    mode: "gate"
hitl_why: "A Brain failure or readiness miss is a genuine Decision-Gate fork: the navigator picks the next move (connect the key, retry, use partial graph material with provenance, or continue without methodology) - never silently degraded."
---

# Brain Connector -- Enrichment Layer

## Detection

Check Brain availability in order:

**Step 0 -- HTTP-path detection (Phase 123, the standard install).** Run `node $PLUGIN_ROOT/lib/core/resolve-brain-key.cjs` (or in JS: `require('./lib/core/resolve-brain-key.cjs').resolveBrainKey()`). If the resolver returns `available: true`, the Brain is active via the **HTTP path** -- call into `lib/core/brain-client.cjs`'s `query() / search() / schema() / ask()`, NOT an MCP tool. The HTTP path is the standard install path on Claude Code CLI; the MCP path (steps 1-3 below) is an alternative for operators who bundle `mcp-server-brain/` or point an external Neo4j MCP at the canonical `mindrian-brain` server name. The resolver also surfaces SEC-02 permission failures explicitly (`available: false, reason: 'permissions too open: ...'`) -- treat those as "not loaded, user action needed", not as silent unavailability.

1. `MINDRIAN_BRAIN_KEY` env var (CLI users -- subsumed by step 0; kept for legacy detection)
2. `mcp__mindrian-brain__brain_schema` tool (Desktop/Cowork MCP)
3. `mcp__neo4j-brain__get_neo4j_schema` tool (legacy)

Any success = Brain active. All fail = visible refusal -- see the Refusal section below.

Pinecone RESOURCE_EXHAUSTED (429): fall back to Neo4j Cypher only via `brain_query`.

### Offer-to-Setup

For a METHODOLOGY ask (framework queries, grading, cross-domain) when Brain detection fails: refuse first (the Refusal section below), then offer the key path as one of the F.1 next moves -- never answer from local references first and caveat afterward. Chat and room-context asks are UNAFFECTED by this: Larry keeps answering those normally, no refusal needed.

(Plan 250-04 reframes the no_key leg to the registration failure edge once silent registration lands -- this text is true TODAY, not permanent.)

## Refusal (the honesty rail)

A failing methodology consult REFUSES visibly -- it never degrades quietly into local heuristics. Four kinds, one honest sentence each, then fire the F.1 Next Move card (SEED-021: fire the card, never draw the box):

- **no_key**: "Methodology needs the Brain, and no key is set. I will not improvise it from memory. Drop a key in `~/.mindrian.env` (chmod 600) or set `MINDRIAN_BRAIN_KEY`, then restart, or we keep working with your room context."
- **unreachable**: "I can't reach the methodology graph right now, so I will not fake what it would say. We can retry in a moment, or keep going with your room context." Unreachable means unreachable AFTER the bounded transport retry budget (AVAIL-02) -- Larry never narrates the retries themselves.
- **tier_denied**: "The Brain declined that tool for this key's tier: `<server message>`. I will not substitute a guess. Check the key tier, or we continue without that tool."
- **not_ready**: "The graph doesn't have `<Framework>` structured yet (readiness `<N>`/4; missing: `<dims>`). I've queued it for enrichment. I can share what the graph does hold on this, marked as partial, or we work without it." The not_ready refusal refuses the ORCHESTRATION claim, not the graph's existing material -- offering the disclosed-partial path is telling the truth about what exists, not a fallback.

**Anti-nagging (all four kinds):**
1. Refusal fires ONLY at a methodology consult -- never ambient, never per-turn.
2. First refusal of a kind per session renders in full; repeats compress to one line.
3. The key-setup pitch appears at most once per session.
4. Refusal never interrupts a non-methodology conversation.

## Provenance (where methodology came from)

Every graph-grounded answer carries ONE source line naming where its methodology came
from; a Larry-voice conversation turn carries none. Absence is the signal, mirroring the
Voice Signature design (larry-personality skill): color square = WHO is speaking, `■ BRAIN`
line = WHERE the methodology came from. One mechanism family, two planes. No new glyph, no
sixth color: the mark reuses the existing `[■ BRAIN]` chip vocabulary from
`skills/ui-system/SKILL.md`'s F.7 dial header chip -- the 12-glyph vocabulary is frozen.

- **THE MARK (terminal/Cowork):** `■ BRAIN: <framework> · <tool> · readiness <N>/4`,
  rendered at the END of the methodology content it grounds -- never turn-anchored (the
  voice-color mark owns the turn start).
- **Desktop degrade:** `**■ Brain:** <framework> · <tool> · readiness <N>/4` (bold markdown
  line, per the ui-system degrade table -- no box chars, no ANSI; `■` U+25A0 is a plain
  glyph that survives every surface).
- **PARTIAL:** a not_ready refusal answered with "use what the graph does hold" (the F.1
  fork, Refusal section above) serves prose search results marked
  `■ BRAIN (partial): <framework> · readiness <N>/4` -- the disclosed-degraded state, told,
  not hidden. Partial is served only after the navigator picks that fork; never by default.
- **TIER0 CHAINS:** anything derived from a `source:'tier0'` hardcoded chain (site 11,
  marked in Plan 250-01) is not graph-grounded -- no `■ BRAIN` line ever, and a methodology
  ask down that path refuses instead (until Phase 252 flips the chains).
- **ANTI-NAGGING:** one source line per answer, never per fact, never repeated within a
  turn -- a mark, not a narration.
- **HTML exports:** obey M:OS Design System v1.1 (the ui-system rule "if it renders as a
  page, it obeys M:OS") -- a source-line component, not the terminal chip.
- **Font caveat:** some fonts render `■` U+25A0 close to `⬛` U+2B1B; position disambiguates
  (the source line is never turn-anchored). Fallback if a live three-surface check shows
  real confusion: the literal word chip `[BRAIN]`.

The exactly-one-color-mark contract survives: `■` (U+25A0) is invisible to
`countDeStijlGlyphs` (`lib/hmi/voice-color-mark.cjs`), so a trailing source line never
breaks the frozen 5-glyph voice-mark count on a Larry turn.

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
- Visible refusal on all failures; render once per consult, never repeat ambient
- Pinecone quota exhausted: use Neo4j only

## Brain-Powered Command Suggestions

**The command for a framework is whatever `command-resolver.commandsForFramework(<framework>)` returns** (`lib/workflow/command-resolver.cjs`, reading the generated `data/command-registry.json`) -- or, if none, "run <framework> manually -- there is no /mos: for it". For a chain, use `composeWorkflow(<framework-chain>)`. **Commands NEVER live in the Brain (Canon Part 8): the Brain holds methodology -- the FEEDS_INTO chains -- and the `recommendFrameworkChain` traversal in `lib/brain/chain-recommender.cjs` carries framework names + problem-type enums only, never a command string, never user content; the plugin-local registry holds the framework-to-command mapping.** Larry never names a `/mos:` from memory. If the resolver returns nothing, the answer is "run <framework> manually".

The Brain ranks WHICH frameworks to suggest next (the FEEDS_INTO traversal in `lib/brain/chain-recommender.cjs`); turning a recommended framework into a `/mos:` command is the resolver's job, not the Brain's, not memory. When the Brain is unreachable: local Room heuristics from the navigation engine + the `larry-personality` skill may still drive CONVERSATION and command resolution -- never presented as methodology -- still resolving any command through `lib/workflow/command-resolver.cjs`. A methodology ask itself refuses visibly (the Refusal section above); local heuristics never stand in for it.

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

For a REFUSAL-triggered append (the not_ready kind, Refusal section above), use `--source refusal` instead of `--source live_reach` -- `refusal` is pre-validated in `ALLOWED_SOURCES`, same CLI, same queue, one write surface (Part 7).

Content-free by construction (Canon Part 8): only the canonical framework name, the integer score, the closed-enum dimension tokens, and the fixed `source` string (`live_reach` or `refusal`) ever cross into the call -- NEVER the user's turn text, the conversation content, or any artifact body. This bookkeeping stays silent ONLY when it accompanies a SUCCESSFUL serve (score 0-2 but material still served with provenance), same posture as every other passive/proactive enrichment behavior on this page. When the append accompanies a REFUSAL, the queueing is SAID as part of the refusal copy itself ("I've queued it for enrichment", Refusal section above) -- it is never quiet there.

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
