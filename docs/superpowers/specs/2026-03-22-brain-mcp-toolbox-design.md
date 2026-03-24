# Phase 4: Brain MCP Toolbox — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** 5 new commands + 4 agents + 1 skill + 8 MCP tools + 5 existing system upgrades

---

## Overview

Phase 4 connects Larry's Brain — Neo4j (21K nodes, 65K relationships) + Pinecone (1.4K embeddings) — to the plugin via MCP tools. This transforms MindrianOS from a methodology framework into a graph-informed intelligence system. Larry becomes smarter without changing his voice.

## Architecture

```
User ↔ Larry (main agent, brain-connector skill auto-loaded)
         ↓ delegates complex queries
    ┌────┴────────────────────────────────┐
    │ Brain Agent  │ Grading Agent        │
    │ Research Agent │ Investor Agent     │
    └────┬────────────────────────────────┘
         ↓ call
    ┌────┴────────────────────────────────┐
    │ 8 Brain MCP Tools (primitives)      │
    ├─────────────────┬───────────────────┤
    │ Neo4j Aura      │ Pinecone          │
    │ 21K nodes       │ 1.4K embeddings   │
    └─────────────────┴───────────────────┘
```

### Three-Layer Intelligence

1. **brain-connector skill** (auto-loaded) — passive enrichment + proactive surfacing. Simple lookups via MCP tools directly. Always-on.
2. **Sub-agents** (spawned on demand) — Brain Agent for complex graph traversals, Grading/Research/Investor for specialized tasks.
3. **MCP tools** (atomic) — 8 structured tool calls to Brain server.

---

## Layer 1: MCP Tools

Brain MCP server exposes 8 tools. Connected via `/mos:setup brain` which adds to `.mcp.json`.

| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `brain_framework_chain` | current frameworks[], problem_type, room_state | {next, confidence, reasoning, anti_pattern} | Recommend next framework |
| `brain_grade_calibrate` | room_state, section_contents | {scores: {vision, problem, feasibility, market, completeness}, percentile, feedback[]} | Calibrated 5-component grading |
| `brain_find_patterns` | venture_description, domain | {similar_ventures[], success_patterns[], failure_patterns[]} | Find similar ventures |
| `brain_concept_connect` | concept | {name, description, connections[{relation, name, type}]} | GraphRAG: immediate connections |
| `brain_cross_domain` | domain_a, domain_b? | {connections[], surprising_patterns[], strength} | Cross-domain discovery |
| `brain_contradiction_check` | claim_a{section, text}, claim_b{section, text} | {conflict: bool, confidence, message} | Semantic conflict analysis |
| `brain_gap_assess` | room_state, venture_stage | {gaps[], weighted_priority[], similar_venture_gaps[]} | Weighted gap analysis |
| `brain_search_semantic` | query, filters? | {results[{text, score, metadata}]} | Pinecone vector search |

---

## Layer 2: Abilities (5 New Commands)

Total after Phase 4: 31 commands (26 existing + 5 new).

### /mos:suggest-next
Graph-informed recommendation. "What should I work on next?" Uses `brain_framework_chain` + `brain_find_patterns` to recommend based on room state + venture stage + similar ventures. Not a static list — personalized to this user's specific situation.

### /mos:find-connections
Cross-domain pattern discovery. "What connects to this?" Uses `brain_cross_domain` + `brain_concept_connect` to surface surprising links between the user's domain and adjacent fields. The "aha moment" command.

### /mos:compare-ventures
"Who else did something like this?" Uses `brain_find_patterns` + `brain_search_semantic` to find similar ventures from Brain's calibration dataset, show what worked/failed, extract applicable lessons.

### /mos:deep-grade
Replaces static `/grade`. Calibrated 5-component assessment (vision, problem definition, feasibility, market understanding, completeness) scored against 100+ real student projects. Produces percentile ranking and specific actionable feedback.

### /mos:research
External web search via Tavily MCP + cross-reference with Brain's semantic index. Synthesizes findings into room artifacts with provenance metadata. The only command that reaches outside the local system.

---

## Layer 3: Sub-Agents (4 New Agents)

### Brain Agent (`agents/brain-query.md`)
- **Role:** Schema expert and GraphRAG retriever. Translates natural language to Cypher/Pinecone queries. Builds context across conversation turns.
- **Tools:** `brain_concept_connect`, `brain_cross_domain`, `brain_find_patterns`, `brain_search_semantic`
- **Spawned by:** Larry, other agents (when queries exceed simple skill patterns)
- **Key behavior:** Never returns raw query results. Returns structured insights in natural language that the calling agent can weave into conversation.

### Grading Agent (`agents/grading.md`)
- **Role:** Calibrated assessment engine. Reads full room, runs 5-component rubric against Brain's real project data.
- **Tools:** `brain_grade_calibrate`, `brain_gap_assess`
- **Spawned by:** `/mos:deep-grade` command
- **Key behavior:** Produces scored report with percentile ranking, component breakdown, specific feedback per section. Filed to room as grading artifact.

### Research Agent (`agents/research.md`)
- **Role:** External intelligence gatherer. Web search, cross-references with Brain's semantic index, synthesizes into room artifacts.
- **Tools:** `brain_search_semantic`, Tavily MCP tools (`tavily-search`, `tavily-extract`)
- **Spawned by:** `/mos:research` command, Larry (proactive when gap detected)
- **Key behavior:** Every finding gets provenance metadata (source URL, retrieval date, relevance score). Filed to appropriate room section with user confirmation.

### Investor Agent (`agents/investor.md`)
- **Role:** Adversarial persona. Reads room from investor perspective, identifies weak points using Brain's pattern data on what investors actually challenge.
- **Tools:** `brain_find_patterns`, `brain_contradiction_check`, `brain_gap_assess`
- **Spawned by:** Larry (when user is in Investment stage), explicit invocation
- **Key behavior:** Produces structured "investor concerns" artifact with severity ratings. Speaks in investor voice, not Larry voice. Asks the hard questions.

---

## Layer 4: Enhanced Existing Systems

### brain-connector skill (passive + proactive)

**Passive enrichment** — before Larry responds to each user turn:
- Check if Brain has relevant context for this topic
- Call `brain_framework_chain` if user is working through methodology
- Call `brain_concept_connect` if user mentions a concept Brain knows
- Weave insights into Larry's response naturally

**Proactive surfacing** — after room changes (PostToolUse) and at SessionStart:
- `brain_contradiction_check` on new artifacts vs existing room content
- `brain_gap_assess` at SessionStart (replaces static analyze-room for Brain users)
- Gated: max 2 HIGH-confidence findings per session
- Larry surfaces proactively: "Hold on — I noticed something..."

### Upgraded Existing Commands

| Command | Upgrade |
|---------|---------|
| `/mos:diagnose` | Graph-informed: Brain maps problem to similar past problems, shows which frameworks actually worked |
| `/mos:help` | Personalized: Brain recommends based on what similar ventures did at this stage |
| `/mos:grade` | Routes to Grading Agent when Brain is connected (falls back to static rubric without Brain) |
| Pipeline chaining | Dynamic: Brain recommends chains based on room state, not just fixed Discovery/Thesis sequences |
| Larry mode engine | Calibrated: Brain adjusts 40/30/20/10 distribution based on user progress + problem type |

---

## Setup Flow

```
/mos:setup brain
  → Prompts for Neo4j Aura credentials (URI, user, password)
  → Prompts for Pinecone API key
  → Writes to .mcp.json (NOT in default config)
  → Tests connection (simple query)
  → "Brain connected. Larry just got smarter."
```

No Brain = everything works via static references (Tier 0). Brain = everything upgrades silently.

---

## File Inventory

### New Files
- `agents/brain-query.md` — Brain Agent
- `agents/grading.md` — Grading Agent
- `agents/research.md` — Research Agent
- `agents/investor.md` — Investor Agent
- `skills/brain-connector/SKILL.md` — passive + proactive intelligence skill
- `commands/suggest-next.md` — graph-informed next step
- `commands/find-connections.md` — cross-domain discovery
- `commands/compare-ventures.md` — similar venture finder
- `commands/deep-grade.md` — calibrated grading
- `commands/research.md` — external research
- `commands/setup.md` — Brain MCP setup (or add to existing setup command)
- `references/brain/schema.md` — Neo4j schema reference
- `references/brain/query-patterns.md` — common Cypher query templates

### Modified Files
- `skills/room-proactive/SKILL.md` — add Brain-powered proactive checks
- `commands/diagnose.md` — add Brain-informed routing
- `commands/help.md` — add personalized recommendations
- `commands/grade.md` — route to Grading Agent when Brain available
- `commands/pipeline.md` — add dynamic chain recommendation
- `skills/larry-personality/mode-engine.md` — add Brain calibration
- `.mcp.json` — Brain MCP config template (inactive by default)
- `references/methodology/index.md` — add Brain-enhanced routing notes

### Totals
- 13 new files
- 8 modified files
- 4 agents, 5 commands, 1 skill, 2 references
