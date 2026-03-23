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

## Tri-Polar Design Rule (MANDATORY)

Every feature, command, skill, and capability MUST be evaluated through all three surfaces:

| Surface | How Users Interact | What Matters Most |
|---------|-------------------|-------------------|
| **Claude Code CLI** | Full power. Hooks fire, scripts run, `/mindrian-os:*` commands. Power users. | Hook reliability, script execution, context budget, file output |
| **Claude Desktop** | Conversational. Users talk to Larry. Less command-driven. | Larry personality, natural language discoverability, conversational flow |
| **Cowork** | Multi-user, persistent agents. `00_Context/` shared state. Collaborative. | Shared room state, concurrent access, team visibility, export quality |

**Before building any component, ask:**
1. How does this work on **CLI**? (scripts, hooks, file I/O)
2. How does this work on **Desktop**? (conversational, personality-driven)
3. How does this work on **Cowork**? (shared state, multi-user, 00_Context/)

Features that only work on one surface are incomplete. Design for all three.

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

---

## Release Process (MANDATORY)

**Every time you push changes to the plugin repo, follow this exact process:**

### Step 1: Update CHANGELOG.md
Add a new entry at the top with the version number and date:
```markdown
## [X.Y.Z] - YYYY-MM-DD
### Added
- Feature description
### Fixed
- Bug fix description
### Changed
- Change description
```

### Step 2: Bump version in plugin.json
Update `"version"` in `.claude-plugin/plugin.json` to match the CHANGELOG version.

### Step 3: Commit with version tag
```bash
git add CHANGELOG.md .claude-plugin/plugin.json [changed files]
git commit -m "release: vX.Y.Z — [one-line summary]"
git tag vX.Y.Z
```

### Step 4: Push with tags
```bash
git push origin main --tags
```

### Step 5: Update marketplace (if needed)
```bash
cd ~/mindrian-marketplace
claude plugin marketplace update mindrian-marketplace
```

**Users get notified automatically** — SessionStart checks GitHub CHANGELOG once per day and shows "[Update Available]" in Larry's greeting.

**Never skip this process.** Every push that changes user-facing functionality MUST bump the version.
