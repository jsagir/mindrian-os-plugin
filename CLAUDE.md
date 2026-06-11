# MindrianOS Plugin — Claude Code Project Guide

> **Repo:** MindrianOS-Plugin (commercial Claude Code + Cowork plugin)
> **Working directory:** /home/jsagi/dev/MindrianOS-Plugin/ (THE ONLY DEV WORKSPACE)
> **Related:**
>   - /home/jsagi/MindrianOS/ — V4 research, design docs, Claude Desktop project specs
>   - /home/jsagi/MindrianV2/ — V2 production (25 bot prompts, mode engine, intelligence pipeline)

---

## WORKSPACE GUARD (READ FIRST — ADDED 2026-04-13)

**`~/.claude/plugins/mindrian-os/` is NOT a dev workspace. It is a plugin install cache.**

Every commit, every git operation, every GSD phase must run from `/home/jsagi/dev/MindrianOS-Plugin/`. Running from the plugin cache silently diverges from GitHub and from every user's install.

**Before starting any session:**
1. `pwd` — confirm you are in `/home/jsagi/dev/MindrianOS-Plugin/`, not in `~/.claude/plugins/*`
2. `git fetch origin main` — never work on a stale clone
3. `git log origin/main..HEAD` — if non-empty, you are ahead; check why
4. `git log HEAD..origin/main` — if non-empty, you are behind; pull before starting

**If the session-start hook trips the workspace guard**, you are in the wrong place. `cd ~/dev/MindrianOS-Plugin` and restart the session.

**Incident reference:** On 2026-04-13 a full v1.9.8 milestone (phases 76-80, 42 commits, Obsidian vault import) was executed in the plugin cache directory by mistake. The work was recovered via `git format-patch` + `git am --3way` but it took a full investigation to detect. Read `docs/autopsies/2026-04-13-wrong-workspace-incident.md` before you start, so you understand why this rule exists.

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
| **Brain** | Neo4j 27,804 nodes (incl. 12,401 MethodologyChunk substrate; ~15.4K teaching-graph core) + 19,987 relationships + Pinecone 12,413 vectors + teaching intelligence (live read 2026-06-11) | mindrian-brain.onrender.com (remote MCP) | Jonathan -- SECRET IP |
| **Room** | Users workspace, entries, sub-rooms, LazyGraph, exports | Users local folder + their Aura | User owns their work |

---

## Tri-Polar Design Rule (MANDATORY)

Every feature, command, skill, and capability MUST be evaluated through all three surfaces:

| Surface | How Users Interact | What Matters Most |
|---------|-------------------|-------------------|
| **Claude Code CLI** | Full power. Hooks fire, scripts run, `/mos:*` commands. Power users. | Hook reliability, script execution, context budget, file output |
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

**1. The Teaching Graph (Neo4j -- 27,804 nodes incl. 12,401 MethodologyChunk substrate; ~15.4K teaching-graph core, 19,987 relationships; live read 2026-06-11)**
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
59 books + 59 tools + 12,413 Pinecone vectors (live read 2026-06-11). Not a list -- a semantic web.

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
/mos:setup graph

# OPTIONAL: Connect Brain for enrichment
/mos:setup brain
```

### Plugin Structure
```
MindrianOS-Plugin/
├── .claude-plugin/plugin.json
├── commands/                    # /mos:larry, :room, :pipeline, etc.
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
9. **Wicked Problem Management** — the Data Room is NOT a document repository. It is a wicked problem management system (Rittel & Webber 1973). Every venture exhibits all 10 characteristics of wicked problems.
10. **Nested System Architecture** — the venture IS a nested system (Simon 1962). Changes in one subsystem cascade through others. The room structure must represent and track these cascades.
11. **Meetings are the primary knowledge source** — institutional knowledge lives in conversations, not documents. Meeting filing is the gateway to multi-stakeholder intelligence.
12. **Assumptions are first-class entities** — every claim in the room has a validity status. Tracking assumption validity is the #1 underserved outcome (Opportunity Score: 18).
13. **Rejection is data** — when a user rejects a suggestion, the reason becomes a graph node. "Why not" teaches the system as much as "yes."
14. **Bidirectional stage progression** — ventures don't progress linearly. A well-defined problem can regress to ill-defined after market feedback. The system supports regression with history preservation.
15. **ICM Layer 0 everywhere** — every directory in the Data Room MUST have a ROOM.md identity file. No exceptions. Whether it's a room section, sub-room, team profile folder, meeting archive, or opportunity bank — if it's a directory, it gets ROOM.md. This is the contract between the folder and every agent that touches it. Folders without identity cause misfiling and lost context across all surfaces (CLI, Desktop, Cowork).
16. **Obsidian Vault Nested Structure (v1.9.7)** — every artifact in a .mos vault MUST sit in its own named folder in a nested structure. Never place a bare .md file in a section root. Always: `section/artifact-name/artifact-name.md`. This enables Obsidian graph view, per-artifact attachments (images, data files), per-artifact ROOM.md identity, and clean wikilink resolution. Example: `opportunity-bank/opp-01-quantum-brain-imaging/opp-01-quantum-brain-imaging.md` not `opportunity-bank/opp-01-quantum-brain-imaging.md`. The folder IS the artifact. The .md file IS the content. Attachments, related analysis, and sub-findings live alongside it. This rule applies to ALL surfaces (CLI exports to vault, Desktop filing, Cowork shared rooms).

---

## Architectural Evolution (from Live Data Room Paper)

The plugin evolves from v1 (flat rooms + methodology commands) to v2+ (wicked problem management):

### Room Structure Evolution

```
v1.0 (current):                    v2.0+ (target):
room/                              room/
├── problem-definition/            ├── problem-definition/
├── market-analysis/               │   ├── assumptions/     ← tracked claims
├── solution-design/               │   └── history/         ← formulation chain
├── business-model/                ├── market-analysis/
├── competitive-analysis/          ├── solution-design/
├── team-execution/                ├── business-model/
├── legal-ip/                      ├── competitive-analysis/
├── financial-model/               ├── team/               ← NEW: people layer
└── STATE.md                       │   ├── members/
                                   │   ├── mentors/
                                   │   └── advisors/
                                   ├── meetings/           ← NEW: conversation layer
                                   │   └── YYYY-MM-DD-*/
                                   ├── legal-ip/
                                   ├── financial-model/
                                   ├── assumptions.json    ← NEW: validity tracking
                                   └── STATE.md
```

### Cross-Subsystem Cascade Rule

When an artifact is filed that contradicts or changes an assumption in another section:
1. Detect the impact (analyze-room or Brain)
2. Generate soft edits for affected sections
3. Present to user: "This insight changes your financial model assumption. Review?"
4. User APPROVE / REJECT (with reason) / DEFER
5. Decision + reason become graph data

### The Core Job (from JTBD Analysis)

> "Reduce the time between insight and validated decision across every dimension of the venture simultaneously."

Every feature is evaluated against this job. If it doesn't compress time-to-decision, it doesn't belong.

### Simon's Architecture of Complexity — The Basis Theorem

Herbert Simon (1962) proved that **all complex systems that persist are hierarchically organized into near-decomposable subsystems**. This isn't a design choice — it's a survival requirement. MindrianOS is the first software implementation of Simon's theory applied to venture innovation.

**Simon's Principles → MindrianOS Implementation:**

| Simon | MindrianOS |
|-------|-----------|
| Near-decomposable systems | Room sections = subsystems with strong internal cohesion, weak external coupling |
| Hierarchy as universal form | `room/` → sections → artifacts → claims. Each level has its own STATE.md |
| Watchmaker parable (Hora builds in modules) | Skills, commands, agents — each built independently, snapped together via hooks |
| Perturbations absorbed within levels | Filing an artifact updates its section, not the whole room |
| Innovation at boundaries between levels | Cross-relationship discovery (INFORMS, CONTRADICTS, CONVERGES) — edges BETWEEN sections are where value concentrates |
| Stable building blocks recombined | 25 methodology commands as reusable modules, pipeline chaining (Week 7 pattern) |
| Near-decomposability enables evolution | Room structure grows organically — team/ folders created on demand, meetings populate the graph |

**Simon + Rittel & Webber (1973):** The venture is a wicked problem. Simon's hierarchy makes wicked problems navigable by decomposing them into near-independent subsystems that can evolve without destroying each other.

**Simon + Tetlock (Superforecasting):** Each room section is a decomposed forecasting domain. Meeting intelligence provides Bayesian updating (convergence = confidence growing, contradictions = beliefs need revision). The intelligence layer IS disciplined belief revision across the hierarchy.

**Simon + Hughes (Reverse Salients):** In any expanding system, some components lag behind others. The cross-relationship scan finds these reverse salients — the room sections where the venture's understanding is weakest relative to its ambition.

**The Architecture Theorem:** _The folder structure IS the near-decomposable hierarchy. The intelligence layer IS the weak interaction detector. Larry IS the hierarchical search navigator._

### ICM × Wicked Problem Management × Simon

ICM (Van Clief & McDermott 2026) says: **folder structure IS the code.** The paper (Sagir 2026) says: **the venture IS a wicked problem.** Simon (1962) says: **complex systems persist through hierarchical near-decomposability.** Combined:

**The folder structure IS the wicked problem, organized as a near-decomposable hierarchy.**

Each room section is a subsystem. Each artifact is a claim. Each cross-reference is a relationship. The hidden connections between subsystems — the ones nobody sees until it's too late — are discoverable by traversing the room's structure as a graph. This IS Simon's "weak interactions between subsystems" made visible.

```
ICM Layer 0 (Identity)     = The venture's current problem formulation (Simon: top of hierarchy)
ICM Layer 1 (Routing)      = Problem type × wickedness → which agent/skill responds (Simon: hierarchical search)
ICM Layer 2 (Contracts)    = Pipeline stage contracts encode cascade rules (Simon: inter-subsystem interfaces)
ICM Layer 3 (Reference)    = Brain graph + methodology references + assumption registry (Simon: stable building blocks)
ICM Layer 4 (Artifacts)    = Room entries = claims with validity status + cross-refs (Simon: subsystem components)
```

**The cross-relationship discovery rule:** After EVERY artifact is filed (methodology session OR meeting segment), the system scans for:
1. **INFORMS** — this artifact references another section ([[cross-ref]])
2. **CONTRADICTS** — this artifact conflicts with an existing claim
3. **CONVERGES** — this artifact's themes appear in 3+ other sections
4. **INVALIDATES** — this artifact makes an existing assumption stale
5. **ENABLES** — this artifact unblocks something in another section

These are not keyword matches. They are STRUCTURAL relationships in the nested system. The graph finds what humans miss.

**The proactive discovery loop:**
```
Artifact filed → cross-relationship scan → new edges found
    → Larry surfaces: "This changes your financial model assumption"
    → User: APPROVE (cascade) / REJECT (reason captured) / DEFER
    → Decision becomes graph data → next scan is smarter
```

This loop is the wicked problem management engine. It never stops running. It gets smarter with every decision.

### Reference

See `docs/research/LIVE_DATA_ROOM_JTBD_PAPER.md` for full theoretical grounding:
- **Simon (1962)** Architecture of Complexity — THE basis theorem. Near-decomposable hierarchies, watchmaker parable, hierarchical search. MindrianOS is Simon's theory as software.
- **Rittel & Webber (1973)** wicked problems — the 10 characteristics. The venture IS a wicked problem.
- **Van Clief & McDermott (2026)** ICM — folder structure as agentic architecture. The code IS the folder structure.
- **Tetlock (2015)** Superforecasting — Bayesian updating, decomposition, probabilistic triage. The intelligence layer IS disciplined belief revision.
- **Hughes (1983)** Reverse Salients — lagging components in expanding systems. Cross-relationship scan finds where the venture's understanding lags.
- **Christensen/Ulwick** JTBD framework — the core job is time compression between insight and validated decision.
- **Ashby's Law** of Requisite Variety — tools must match system complexity. 25 methodologies + intelligence layer = requisite variety for wicked problems.
- **Knight (1921)** Risk vs. Uncertainty distinction — Risk can be managed, Uncertainty must be navigated. MindrianOS navigates uncertainty through Simon's hierarchical structure.

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

---

## MWP Moat Awareness (MANDATORY for all contributors)

The Mindrian Workspace Protocol (MWP) is a 7-layer integrated system. The moat is NOT any individual layer - it is the integration of all 7 layers operating simultaneously on every user action.

**The 7 Layers:** Folder Hierarchy, Artifact Provenance, Cascade Pipeline, MINTO Reasoning, HSI Innovation Discovery, Proactive Intelligence Loop, Brain Enrichment.

**The Rule:** Every feature, command, agent, and hook must deepen the MWP moat. Before building, ask: "Does this connect to the cascade pipeline? Does it generate or consume edges? Does it leverage Brain intelligence?"

Features that operate independently of MWP layers add surface area, not moat depth. Surface area without integration is technical debt.

**Full details:** See `docs/MOAT-MANDATE.md` for the PR review checklist, anti-patterns, and what CAN vs CANNOT be copied.
**Protocol specification:** See `docs/MWP-SPECIFICATION.md` for the formal 7-layer protocol with edge schemas and resolution orders.

---

## Modular References (@include)

@.claude/includes/architecture.md
@.claude/includes/moat.md
@.claude/includes/decisions.md
@.claude/includes/release-process.md
@docs/MINDRIAN-CANON.md
@docs/CANON-PHASE-MAP.md

See also: docs/ENV-TUNING.md for environment variable optimization.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**MindrianOS Plugin**

A commercial Claude Code + Cowork plugin that delivers Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. Users install with one command and immediately get Larry (the AI teaching personality) plus a structured Data Room that passively captures insights and proactively surfaces gaps, contradictions, and convergence signals. The plugin leverages Claude's native capabilities while optionally connecting to the Brain (Neo4j knowledge graph with 27,804 nodes of teaching intelligence -- ~15.4K teaching-graph core plus 12,401 MethodologyChunk substrate; live read 2026-06-11) for enriched guidance.

**Core Value:** Users can run the full PWS methodology — 25 specialized methodology bots, structured pipelines, and an intelligent Data Room — inside Claude Code with zero infrastructure, where Larry guides them through venture innovation using the same teaching intelligence that powers the classroom experience.

### Constraints

- **Plugin format**: Must conform to Claude Code plugin structure (commands/, skills/, agents/, hooks/, .mcp.json, settings.json, plugin.json)
- **No server infrastructure**: Plugin runs entirely in Claude's environment — no backend services except optional Brain MCP
- **Brain IP protection**: The 27,804-node teaching graph (live read 2026-06-11), grading intelligence, and mode engine calibration are proprietary -- never distributed, only served via MCP
- **Neo4j Aura Free limits**: LazyGraph must work within 50K node limit
- **Three surfaces**: All features must work across CLI, Desktop, and Cowork without surface-specific code
- **Existing assets**: Must port from V2/OS, not rebuild from scratch — 25 prompts, Larry personality, mode engine already exist
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Key Insight: v3.0 Breaks the "No Dependencies" Rule -- Intentionally
## Existing Stack (v1.0/v2.0 -- DO NOT CHANGE)
| Technology | Role | Status |
|------------|------|--------|
| Markdown + YAML frontmatter | Skills, agents, commands, pipelines, references | Shipped, stable |
| JSON | plugin.json, hooks.json, .mcp.json, settings.json, STATE.md frontmatter | Shipped, stable |
| Bash scripts (20 in scripts/) | Room analysis, state computation, meeting intelligence, PDF, transcription | Shipped, stable |
| Neo4j Aura + Brain MCP | 27,804-node graph at mindrian-brain.onrender.com (remote MCP, Streamable HTTP); live read 2026-06-11 | Deployed |
| Pinecone | 12,413 vectors (pws-brain, 1024-dim) for Brain semantic search; live read 2026-06-11 | Deployed |
| Cytoscape.js (via CDN in dashboard HTML) | De Stijl knowledge graph visualization | Shipped v1.0 |
| Velma API | Meeting transcription at 3c/hour | Integrated v2.0 |
| sentence-transformers + LSA (Python) | HSI computation scripts | Shipped v2.0 |
## v3.0 Stack Additions
### 1. MCP Server Framework
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@modelcontextprotocol/sdk` | 1.27.1 | Build MindrianOS MCP server exposing tools to Desktop/Cowork | THE official SDK. Only real option. 34,700+ dependents. MIT license. Supports both stdio and Streamable HTTP transports on a single McpServer instance. [HIGH confidence -- verified npm registry 2026-03-24] |
| `zod` | ^3.25 (use 3.25.76) | Input/output schema validation for MCP tools | Required peer dependency of MCP SDK. SDK declares `"^3.25 || ^4.0"`. Use 3.x because zod-to-json-schema (used internally by SDK) is more tested with 3.x. 4.x works but is newer. [HIGH confidence -- verified npm peer deps] |
- Claude Desktop spawns stdio MCP servers as child processes via `claude_desktop_config.json`. This is the native, zero-config path for local use.
- Streamable HTTP adds authentication, CORS, port management, and TLS complexity with zero benefit for a locally-spawned server.
- The Brain MCP already uses Streamable HTTP for remote access. MindrianOS-Plugin MCP is local-first.
- When remote room access is needed, add Streamable HTTP transport alongside stdio. The SDK supports dual transports on the same McpServer instance -- no code refactor needed.
### 2. Shared Core Library (CLI + MCP)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js CJS (no framework) | >=18 | `lib/core/*.cjs` shared internals called by both CLI and MCP | Mirrors proven GSD pattern. Zero additional dependencies. CJS because plugin ecosystem uses CommonJS. |
### 3. Opportunity Bank & Grant Discovery
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Grants.gov REST API | v1 | Programmatic search of US federal grants | Free. No API key needed for search endpoint (`v1/api/search2`). Returns structured JSON with opportunity details, deadlines, eligibility, amounts. 60 req/min rate limit. [HIGH confidence -- verified Grants.gov API docs] |
| `cheerio` | 1.2.0 | Parse HTML from non-API grant sources | jQuery-style DOM traversal. 19,873 npm dependents. Pure JS, no native bindings. Lightweight alternative to headless browsers. [HIGH confidence -- verified npm] |
| Native `fetch` | Built into Node 18+ | HTTP requests for APIs and web pages | No package needed. Node 18+ global fetch. |
- `session-start` hook already runs `analyze-room`. Extend it: `mindrian-tools.cjs opportunity-scan --room ./room`
- Each session start, check room domain keywords against cached grant data. Fetch fresh if stale (>24h).
- Results filed to `room/opportunity-bank/grants/` as structured Markdown entries.
- Zero infrastructure. No persistent process. No cron. Session start IS the trigger.
### 4. AI Team Member Personas
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| No new library | -- | Persona generation from room intelligence | Personas are structured Markdown files generated from room data + prompt templates. Not a library problem. |
# Dr. Sarah Chen -- Market Validation Expert
## Expertise
## Perspective (Yellow Hat -- Benefits)
## Communication Style
## Knowledge Boundaries
### 5. Scheduled Agents (OPTIONAL -- Future Only)
| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `node-cron` | 4.2.1 | Schedule periodic grant discovery sweeps | ONLY if MCP server runs as persistent Streamable HTTP process (v3.x+ remote room mode). Not needed for v3.0 stdio mode. |
## Supporting Libraries (New)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.25.76 | Schema validation for MCP tools and CLI input validation | Always. Required by MCP SDK. |
| `cheerio` | 1.2.0 | HTML parsing for grant discovery scraping | When scraping grant sources beyond Grants.gov API. |
## Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `npx @modelcontextprotocol/inspector` | Test MCP server tools interactively | Official MCP debugging tool. Connects via stdio, lets you call tools and inspect responses. Use during development. |
| `claude --plugin-dir .` + Desktop config | Test dual delivery | CLI: test via plugin-dir flag. Desktop: add to claude_desktop_config.json as local stdio server. |
## Installation
# Initialize package.json (if not exists)
# Core: MCP server + schema validation
# Opportunity discovery: HTML parsing for non-API grant sources
# That's it. 3 packages. Everything else is Node.js built-ins or existing Bash scripts.
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@modelcontextprotocol/sdk` stdio | Streamable HTTP transport | When remote team access is needed (v3.x+). Add alongside stdio on same McpServer instance. |
| Native `fetch` (Node 18+) | `node-fetch` / `axios` / `got` | Never. Native fetch is sufficient. Zero reason to add HTTP client dependencies. |
| `cheerio` for scraping | Playwright / Puppeteer | Only if a grant site requires JavaScript rendering (unlikely for .gov sites). 200MB+ browser download not justified. |
| No cron for v3.0 | `node-cron` / `agenda` / `bull` | Session-start hook handles proactive scanning. Add cron only if persistent server mode is built. |
| Filesystem room state | SQLite / Redis / Turso | Never. The filesystem IS the ICM architecture. Adding a database creates dual-source-of-truth. |
| Prompt-based personas | LangChain agents / CrewAI | Never. These fight ICM-native design. Claude loads persona markdown as context. |
| Zod 3.x | Zod 4.x | When MCP SDK ecosystem fully stabilizes on 4.x. The SDK accepts both, but 3.x has broader compatibility today. |
| Grants.gov free API | Paid grant databases (Foundation Directory Online, GrantStation) | Only if targeting private/foundation grants beyond federal scope. Adds cost. Defer until proven demand. |
| CJS modules | ESM modules | When Claude Code plugin ecosystem adopts ESM. Currently CJS is the norm (gsd-tools.cjs pattern). |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Express / Hono / Fastify for MCP | MCP SDK includes Hono internally for Streamable HTTP. Adding another HTTP framework creates conflicts. | MCP SDK's built-in transport layer |
| LangChain / CrewAI / AutoGen / Semantic Kernel | Fights ICM-native architecture. Adds 50+ transitive dependencies. Claude IS the LLM -- no orchestration framework needed. | Direct prompt engineering + room-as-context |
| SQLite / Redis / Turso for room state | Creates dual source of truth with filesystem. Breaks "folder IS orchestration" principle. | `room/` filesystem + STATE.md |
| WebSocket libraries (ws, socket.io) | MCP Streamable HTTP handles server-to-client push via SSE when needed. | MCP SDK Streamable HTTP transport (future) |
| Puppeteer / Playwright for scraping | 200MB+ browser download. Grant sites are server-rendered HTML. | `cheerio` + native `fetch` |
| Commander / yargs / meow for CLI | Claude is the caller, not a human. Process.argv parsing is sufficient. GSD pattern proves this. | Direct `process.argv` switch-case in CJS |
| Zod 4.x (for now) | Works with MCP SDK, but ecosystem (zod-to-json-schema) is more battle-tested with 3.x. | `zod@^3.25` |
| dotenv | Plugin runs in Claude's environment. MCP server inherits env from spawning process. `.env` files add confusion about where config lives. | Direct `process.env` access |
| TypeScript | Build step breaks "every output is an edit surface" principle. CJS files are directly inspectable and editable. | Plain CJS with JSDoc type comments if needed |
| npm workspaces / monorepo tools | Single repo with flat structure. No packages to link. | Flat `bin/` + `lib/` structure |
## Stack Patterns by Variant
- `mindrian-tools.cjs` is the entry point
- Import from `lib/core/*` directly
- Hook scripts call `node bin/mindrian-tools.cjs <subcommand>`
- No MCP SDK in this path -- pure Node.js + Bash
- Because: CLI users have full script execution via hooks
- `mindrian-mcp-server.cjs` is the entry point (stdio)
- Register MCP tools that wrap `lib/core/*` functions
- User adds to `claude_desktop_config.json`
- Because: Desktop/Cowork only speak MCP protocol, not plugin commands
- Both entry points import the SAME `lib/core/*` modules
- Feature parity guaranteed by shared core
- Plugin commands = skill triggers CLI tools layer
- MCP tools = thin Zod-validated wrappers around same core
- Because: "Every feature ships as both" is the v3.0 rule
- Add Streamable HTTP transport to existing McpServer
- Same instance, dual transports (stdio + HTTP)
- Room folder must be accessible (Git sync, mounted volume, or shared drive)
- Add `node-cron` for background opportunity scanning
- Because: Remote users can't trigger session-start hooks
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@modelcontextprotocol/sdk@1.27.1` | `zod@^3.25 \|\| ^4.0`, Node.js >=18 | SDK internally uses Hono 4.x, Express 5.x, ajv 8.x. Do NOT add these as direct dependencies -- they come bundled. |
| `zod@^3.25` | `@modelcontextprotocol/sdk@1.27.1`, `zod-to-json-schema@^3.25` | Pin to 3.x branch for stability. |
| `cheerio@1.2.0` | Node.js >=18 | Pure JS, no native bindings. Works everywhere. |
| Plugin layer (Markdown + JSON + Bash) | Claude Code 1.x+ | No change from v1.0/v2.0. Plugin layer is independent of MCP server layer. |
| Brain MCP (remote) | MCP protocol 2024+ | Already deployed. MindrianOS MCP server is SEPARATE -- Claude Desktop lists both in config. |
## Integration Points: How New Stack Connects to Existing
| Existing Component | How v3.0 Stack Integrates |
|-------------------|--------------------------|
| 20 Bash scripts in `scripts/` | `lib/core/*.cjs` wraps script invocations via `child_process.execSync`. Bash scripts remain authoritative. Core library is the Node.js API surface over them. |
| `hooks/hooks.json` + hook scripts | `session-start` hook gains opportunity scan: calls `node bin/mindrian-tools.cjs opportunity-scan`. New hook for persona refresh on room changes. |
| Brain MCP (mindrian-brain.onrender.com) | MindrianOS MCP server is SEPARATE. Both listed in user's `claude_desktop_config.json`. Claude orchestrates between them. They share no code. |
| Plugin commands (commands/*.md) | Commands invoke `mindrian-tools.cjs` subcommands. Same core functions. Commands are the plugin-layer entry; tools.cjs is the execution layer. |
| De Stijl dashboard | Dashboard reads `room/` filesystem. MCP tools write to same filesystem. Dashboard auto-refreshes. No direct integration needed. |
| `room/` folder structure | Opportunity Bank = `room/opportunity-bank/`. Funding Room = `room/funding/`. AI Personas = `room/team/ai-personas/`. Same ICM pattern, new sections. |
| settings.json | Add MCP server path config. Plugin still uses `{"agent": "larry-extended"}`. |
| `.mcp.json` | Add MindrianOS local MCP server alongside existing Brain remote MCP. |
## Sources
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- verified v1.27.1, dependencies, peer deps (`zod@^3.25 || ^4.0`), engine (Node >=18) [HIGH confidence]
- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- McpServer API, registerTool with Zod schemas, StdioServerTransport, Streamable HTTP [HIGH confidence]
- [MCP local server connection guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) -- stdio is native transport for Claude Desktop [HIGH confidence]
- [Claude Desktop MCP config](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) -- claude_desktop_config.json format, stdio vs HTTP [HIGH confidence]
- [Grants.gov API](https://www.grants.gov/api) -- free search endpoint (`v1/api/search2`), no auth for search, 60 req/min, structured JSON responses [HIGH confidence]
- [Grants.gov API Guide](https://grants.gov/api/api-guide) -- endpoint details, query parameters, rate limits [HIGH confidence]
- [Cheerio on npm](https://www.npmjs.com/package/cheerio) -- verified v1.2.0, 19,873 dependents, pure JS [HIGH confidence]
- [node-cron on npm](https://www.npmjs.com/package/node-cron) -- verified v4.2.1, crontab syntax, pure JS [HIGH confidence]
- GSD reference implementation (`~/.claude/get-shit-done/bin/gsd-tools.cjs`) -- proven CJS single-entry-point pattern, 40+ subcommands, process.argv routing [HIGH confidence, local verification]
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## QA and RCA Reporting

When QA-ing a new feature or investigating a defect, write findings to the MindrianOS RCA standard. Do not improvise a bug report.

- **The standard:** `docs/RCA-TEMPLATE.md` is a machine-readable incident spec. It IS the GSD debug-session format plus four agent-input sections (Scope and Impact, Required Code Changes, Tests, Non-Code Follow-ups) and a JSON variant. Read it before writing any root-cause report.
- **Where reports go:** file every report at `.planning/debug/<slug>.md` so `/gsd:debug <slug>` can resume it. `.planning/` is gitignored, so commit RCA files with `git add -f` (the established pattern).
- **Single bug vs feature sweep:** one defect uses `kind: rca`. A multi-component QA pass over a new feature uses `kind: qa-sweep` with a component health matrix. Reference sweep: `.planning/debug/windows-build-brain-python-qa.md`.
- **Classify, never just report:** every finding is WORKING, a known tracked bug (cross-reference its existing debug session), ENV GAP, or NEW FAILURE. Only a NEW FAILURE warrants a fresh `/gsd:debug` session.
- **Clear the MindrianOS gates before calling a fix done** (RCA template Section 5): Canon Part 8 Brain-boundary, Tri-Polar three-surface (CLI / Desktop / Cowork), cross-platform, release lockstep, no em-dashes, reuse-before-build.
- **On resolve:** move the file to `.planning/debug/resolved/` and add a summary block to `.planning/debug/knowledge-base.md` so `gsd-debugger` surfaces it as a known-pattern hypothesis next time.

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
