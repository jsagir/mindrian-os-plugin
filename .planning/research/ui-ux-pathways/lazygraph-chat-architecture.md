---
type: architecture-spec
domain: chat-intelligence-pipeline
status: validated-by-analysis
source: Session 2026-04-16 discussion (Jonathan + Larry)
key_insight: 57x token cost reduction via SQL-targeted context injection
extends: phase-86-localhost-spec.md, byo-api-and-surfaces.md
---

# LazyGraph Chat Architecture: How the Chat Panel Gets Good Insights

## The core principle (one sentence)

The chat doesn't query the graph. Larry queries the graph, and the chat is just Larry's mouth.

## The architecture

```
User types: "What contradicts my market analysis?"
                    |
                    v
    localhost:3131/api/room/chat
                    |
    Step 1: SQL query room.db (0 tokens, milliseconds)
    Step 2: Read only the referenced artifacts (2K tokens)
    Step 3: Read current intelligence signals (0.5K tokens)
    Step 4: Build surgical context injection (3K total)
    Step 5: Send to Anthropic API via BYO key
    Step 6: Larry responds with precision, not noise
                    |
                    v
    Larry: "Your JTBD Merck analysis (20/20 underservice)
    directly contradicts the s-curve analysis which suggests
    late growth phase. If the market is mature, why is the
    opportunity underserved? Either the s-curve timing is
    wrong, or the JTBD is measuring a NICHE within a mature
    market -- which is actually the stronger thesis."
```

## Why this works: the 57x cost multiplier

| Approach | How it works | Tokens per question | Answer quality |
|----------|-------------|--------------------:|----------------|
| Brute force (no graph) | Read entire room into context, ask question | ~200,000 | Vague (too much noise, LLM loses signal) |
| LazyGraph targeted | SQL query for relevant edges, read only those artifacts | ~3,500 | Precise (Larry sees only the relevant data) |
| **Ratio** | | **57x cheaper** | **Better answers with less context** |

The 57x multiplier is the difference between "chatting with your room costs a fortune" and "chatting with your room is basically free." It is also the difference between Larry giving a vague answer from a 200K context dump and a PRECISE answer from 3 surgically selected contradiction edges.

For a user who asks 10 questions per session: 2M tokens (brute force) vs 35K tokens (LazyGraph). Over a month of daily use: 60M tokens saved. That is not an optimization. That is the difference between a viable product and a token-burning toy.

## The three SQL query patterns

### Pattern 1: "What contradicts X?"

```sql
SELECT e.*, a1.title as source_title, a2.title as target_title,
       a1.section as source_section, a2.section as target_section
FROM edges e
JOIN artifacts a1 ON e.source_id = a1.id
JOIN artifacts a2 ON e.target_id = a2.id
WHERE e.type = 'CONTRADICTS'
  AND (a1.section = ? OR a2.section = ?)
ORDER BY e.confidence DESC;
```

Returns: the specific contradiction edges and which artifacts are involved. Larry reads ONLY those 2-3 artifacts (maybe 2K tokens total) instead of the entire room.

### Pattern 2: "What's converging?"

```sql
SELECT e.*, a1.title, a2.title, a1.section, a2.section
FROM edges e
JOIN artifacts a1 ON e.source_id = a1.id
JOIN artifacts a2 ON e.target_id = a2.id
WHERE e.type = 'CONVERGES'
ORDER BY e.confidence DESC
LIMIT 5;
```

Returns: the top 5 convergence signals across the entire room. Larry sees the strongest patterns without reading everything.

### Pattern 3: "Who said what about X?"

```sql
SELECT s.name, s.role, s.claims, e.type, a.title, a.section
FROM stakeholders s
JOIN edges e ON e.source_id = s.id OR e.target_id = s.id
JOIN artifacts a ON (e.source_id = a.id OR e.target_id = a.id)
WHERE a.section = ?
ORDER BY s.name;
```

Returns: stakeholder-attributed claims about a section. Larry can say "Noga flagged cross-sector detection as the highest-value capability, but Lital's framing suggests the value is in the teaching bridge, not detection. Those are two different products."

### Pattern 4: "What gaps should I fill next?"

```sql
SELECT section, COUNT(*) as entry_count
FROM artifacts
GROUP BY section
ORDER BY entry_count ASC;

-- Cross-referenced with:
SELECT DISTINCT target_section
FROM edges
WHERE type = 'INVALIDATES'
  AND target_section NOT IN (
    SELECT section FROM artifacts
    GROUP BY section HAVING COUNT(*) >= 3
  );
```

Returns: sections with the fewest entries AND sections where existing claims have been invalidated. Larry recommends the highest-leverage gap to fill, not just the emptiest section.

### Pattern 5: "Give me the full intelligence briefing"

```sql
-- Convergences
SELECT * FROM edges WHERE type = 'CONVERGES' ORDER BY confidence DESC LIMIT 3;
-- Contradictions
SELECT * FROM edges WHERE type = 'CONTRADICTS' ORDER BY confidence DESC LIMIT 3;
-- Gaps (sections with < 2 entries)
SELECT section, COUNT(*) as n FROM artifacts GROUP BY section HAVING n < 2;
-- Recent stakeholder claims
SELECT name, claims FROM stakeholders ORDER BY rowid DESC LIMIT 5;
```

Returns: a compact briefing (~1K tokens) that Larry synthesizes into a 3-paragraph intelligence summary. The user gets the morning briefing without Larry reading 200K tokens of room content.

## The context injection template

When the `/api/room/chat` endpoint receives a message, it builds the system prompt:

```
You are Larry -- the PWS methodology teaching partner for MindrianOS.
Voice: conversational, provocative, concise. 3-8 sentences default.

ACTIVE ROOM: {room_name}
VENTURE STAGE: {venture_stage}
SECTIONS: {section_count} active, {entry_count} total entries

RELEVANT GRAPH DATA (from SQL query matching user's question):
{edges_json}

ARTIFACT EXCERPTS (only the ones referenced by the edges above):
{artifact_excerpts}

CURRENT INTELLIGENCE:
- Convergence: {convergence_signals}
- Contradictions: {contradiction_signals}
- Gaps: {gap_list}

STAKEHOLDER CONTEXT (if relevant):
{stakeholder_claims}

Answer the user's question using ONLY the graph data and artifact
excerpts above. Do not hallucinate information that is not in the
provided context. If the graph data does not contain enough to
answer, say so and suggest which /mos:* command would generate
the missing analysis.
```

Total context: ~2-3K tokens of room intelligence + ~1K Larry personality = ~3.5K tokens. The BYO API call costs the user's own Anthropic credits at the standard per-token rate. MindrianOS adds no markup.

## The moat layer

The SQL queries above are GENERIC. Any fork of MindrianOS can run them. But the EDGES those queries return -- the CONTRADICTS, CONVERGES, INVALIDATES relationships -- are populated by the intelligence cascade (scripts/intelligence-cascade.cjs), which is powered by the Brain (brain.mindrian.ai, 21K nodes, 65K relationships).

The graph STRUCTURE is open (BSL licensed, readable by anyone). The graph CONTENT is the moat (populated by the intelligence cascade using Brain-calibrated pattern detection that took 30 years of Lawrence's teaching data to build).

The chat panel is where users EXPERIENCE the moat for the first time. They ask a question. Larry gives an answer that is impossibly precise. They think "how did it know that?" The answer: the Brain told the intelligence cascade where to look, the cascade wrote the edges, the SQL query retrieved the edges, and Larry synthesized only those edges into a targeted response. The precision IS the moat, made visible.

## Why the v1.10.9 node:sqlite migration (Finding E) was the highest-leverage fix

Not because "SQLite on Windows was broken" -- but because SQLite is the query engine that makes the chat panel smart AND cheap. Without it, every chat message costs 200K tokens (full room scan via Claude reading markdown files). With it, every message costs 3.5K tokens (surgical SQL query + targeted artifact reads + Larry response).

Phase 85 Finding E was filed as a Windows compatibility fix. Its real impact is enabling the entire chat intelligence architecture described in this document. The 57x cost multiplier exists because room.db exists, and room.db exists cross-platform because of Finding E.

## Implementation notes for Phase 86

The chat panel in the localhost dashboard needs:
1. An input box at the bottom of the browser window
2. A chat message history panel (scrollable, timestamped)
3. A "section context" selector (which section the user is asking about -- defaults to "whole room")
4. The `/api/room/chat` endpoint on the localhost server
5. A `lib/core/graph-query.cjs` module that implements the 5 SQL patterns above and returns structured JSON
6. A `lib/core/context-builder.cjs` module that takes the SQL results + artifact excerpts + intelligence signals and builds the system prompt template above
7. An Anthropic API call using the BYO key from the request body

The graph-query and context-builder modules are reusable by every surface (browser chat, Discord bot, Chrome extension, Goose extension, mobile app). Build them once, every client gets intelligent graph-backed responses.

## Cross-references

- [[solution-design/ui-ux-pathways/architecture-vision]] -- the bidirectional control surface this powers
- [[solution-design/ui-ux-pathways/phase-86-localhost-spec]] -- where this ships
- [[solution-design/ui-ux-pathways/token-economics]] -- the broader token cost analysis
- [[solution-design/ui-ux-pathways/byo-api-and-surfaces]] -- the API endpoint design
- [[competitive-analysis/causal-claims-from-meetings]] -- Claim 2 ("proactive intelligence is unintelligible from a slide") is solved by this chat panel -- users ASK about their intelligence instead of reading alerts
