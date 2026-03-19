# MindrianOS Plugin — Claude Code Project Guide

> **Repo:** MindrianOS-Plugin (commercial Claude Code + Cowork plugin)
> **Working directory:** /home/jsagi/MindrianOS-Plugin/
> **Related:**
>   - /home/jsagi/MindrianOS/ — V4 research, design docs, Claude Desktop project specs
>   - /home/jsagi/MindrianV2/ — V2 production (25 bot prompts, mode engine, intelligence pipeline)

---

## What Is This?

A commercial Claude Code + Cowork plugin. Users install with ONE command:

```
claude plugin install mindrian-os@mindrian-marketplace
```

Thats it. No setup required. Larry starts talking. The room starts listening.
Optional: connect Neo4j Aura (free) for deeper intelligence. Optional: connect Brain for enrichment.

---

## The Three Layers

| Layer | What | Where | Who Owns It |
|-------|------|-------|-------------|
| **Plugin** | Skills, commands, agents, hooks, pipelines | This repo (marketplace) | Open |
| **Brain** | Neo4j 21K nodes + Pinecone 1.4K embeddings + teaching intelligence | brain.mindrian.ai (remote MCP) | Jonathan — SECRET IP |
| **Room** | Users workspace, entries, sub-rooms, LazyGraph, exports | Users local folder + their Aura | User owns their work |

---

## The Moat — Why This Cannot Be Copied

### Anyone can copy (and thats fine):
- 25 methodology prompts (based on published frameworks)
- Plugin structure (markdown + JSON)
- ICM stage contracts (folder structure)

### What CANNOT be copied — Larrys Brain:

**1. The Teaching Graph (Neo4j — 21K+ nodes, 65K+ relationships)**
Not a catalog. A MAP of how frameworks CONNECT, CHAIN, and APPLY.
- Framework-to-framework chaining rules
- Framework-to-problem-type mappings
- Phase progressions per framework
- CO_OCCURS and ADDRESSES_PROBLEM_TYPE relationships
- Cross-domain connection patterns

**2. The Grading Intelligence**
Calibrated from 100+ real student projects:
- Component weights, grade distributions, feedback patterns
- Vision-to-Execution Gap detection
- Framework mastery tracking across revisions

**3. The Mode Engine Calibration**
Tuned from 30+ years of real classroom teaching:
- 40:30:20:10 distribution (conceptual:storytelling:problem-solving:assessment)
- Voice modulation patterns mapped to mode shifts
- Context-aware variations by audience and content type

**4. The Curriculum Graph**
59 books + 59 tools + 1,427 embeddings. Not a list — a semantic web.

**5. Cross-User Intelligence (Future)**
Anonymized patterns from all users improve the Brain for everyone.

### The Moat Formula:
Prompts can be copied. The graph that knows WHEN to use WHICH prompt,
in WHAT sequence, calibrated by REAL teaching data — thats the moat.

---

## Architecture

### User Experience: Install and Go

```
# Install (one command)
claude plugin install mindrian-os@mindrian-marketplace

# Start working (zero config)
> Talk to me about your venture idea

# Larry is already active. Room is already listening.
# No Neo4j needed. No Brain needed. Just works.

# OPTIONAL: Add graph for deeper intelligence
/mindrian-os:setup graph

# OPTIONAL: Connect Brain for enrichment
/mindrian-os:setup brain
```

### Plugin Structure
```
MindrianOS-Plugin/
├── .claude-plugin/plugin.json
├── commands/                    # /mindrian-os:larry, :room, :pipeline, etc.
├── skills/                      # Auto-activated: room-passive, room-proactive, etc.
├── agents/                      # Sub-agents: larry-extended, research, swarm
├── hooks/hooks.json             # Intelligence pipeline
├── pipelines/                   # ICM stage contracts (minto, bono, hsi, etc.)
├── scripts/                     # HSI computation, export generators
├── references/                  # Embedded Layer 3 (Tier 0 fallback)
├── .mcp.json                    # Brain MCP (optional), research tools
├── settings.json                # Default: Larry is the main agent
└── docs/                        # Architecture, moat analysis
```

### Source Material

| Asset | Source | Port Status |
|-------|--------|-------------|
| Larry personality | MindrianV2/prompts/larry_skill/*.md | TODO |
| 25 methodology prompts | MindrianV2/prompts/*.py | TODO |
| Mode engine | MindrianV2/agent/intelligence/larry_mode_engine.py | TODO |
| 16 Claude Desktop projects | MindrianOS/.planning/research/pws-academy-input/ | TODO |
| Context pipeline | MindrianOS/docs/design/04-CONTEXT-PIPELINE.md | Reference |
| Orchestration | MindrianOS/docs/design/02-ORCHESTRATION.md | Reference |
| V2-V4 mapping | MindrianOS/.planning/research/V2_TO_V4_AGENT_MAPPING.md | Guide |
| Neo4j store patterns | MindrianOS/backend/app/skills/background/neo4j_discovery_store.py | Reference |
| Grading + rubrics | MindrianOS/.planning/research/pws-academy-input/CONTEXT.md | TODO |
| 59 Innovation Tools | Notion DB | TODO |
| 59 Library items | Notion DB | TODO |
| Larry style DNA | claude-project-12-larry-style-guide.md | TODO |
| Week 7 Combining Tools | pws-week-7-combining-tools.md | TODO |
| ICM paper | 2603.16021v2.pdf | Architecture |
| GSD patterns | ~/.claude/get-shit-done/ | Architecture |

---

## Key Decisions

1. **One-command install** — zero config required. Larry works immediately.
2. **ICM-native** — folder structure IS the orchestration
3. **GSD state management** — STATE.md manages nested room hierarchy
4. **Three surfaces** — Claude Code CLI + Desktop + Cowork
5. **Brain as remote MCP** — IP never distributed. Users get intelligence, not data.
6. **LazyGraph optional** — enhances but never required
7. **Pipelines chain through Room** — output becomes next inputs structure (Week 7)
8. **Tier 0 fully functional** — no dependencies, graceful degradation everywhere
