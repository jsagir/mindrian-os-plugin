# Architecture Research

**Domain:** Claude Code Plugin (AI methodology delivery system)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     USER SURFACES (CLI / Desktop / Cowork)             │
│   All three surfaces read the same plugin, same workspace, same state  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PLUGIN ENTRY LAYER                                                    │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│   │ settings.json │  │ .mcp.json    │  │ hooks.json   │                 │
│   │ agent: larry  │  │ Brain MCP    │  │ Session hooks │                 │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│          │                 │                  │                          │
├──────────┴─────────────────┴──────────────────┴─────────────────────────┤
│                                                                         │
│   COMPONENT LAYER                                                       │
│   ┌────────────┐  ┌─────────┐  ┌─────────────┐  ┌────────────────┐     │
│   │ commands/  │  │ skills/ │  │   agents/    │  │  pipelines/    │     │
│   │ 25 methods │  │ 6 auto  │  │ larry +      │  │ ICM contracts  │     │
│   │ (/mOS:X)   │  │ skills  │  │ research +   │  │ minto, bono    │     │
│   │            │  │         │  │ room-analyst  │  │ hsi, jtbd ...  │     │
│   └─────┬──────┘  └────┬────┘  └──────┬───────┘  └───────┬────────┘    │
│         │              │              │                   │             │
├─────────┴──────────────┴──────────────┴───────────────────┴─────────────┤
│                                                                         │
│   ICM LAYER (Folder Structure = Orchestration)                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │  Layer 0: ROOM.md (identity)                                   │    │
│   │  Layer 1: ROUTING.md (which skill/pipeline for this intent)    │    │
│   │  Layer 2: Stage contracts (per-methodology step definitions)   │    │
│   │  Layer 3: references/ (factory — 275 frameworks, static chains)│    │
│   │  Layer 4: room/ (product — user's Data Room entries, STATE.md) │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   DATA / INTELLIGENCE LAYER                                             │
│   ┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│   │  Room (local)  │  │  Brain MCP       │  │  LazyGraph       │       │
│   │  STATE.md tree │  │  (remote Neo4j)  │  │  (user Neo4j)    │       │
│   │  8 sections    │  │  21K nodes       │  │  Aura Free       │       │
│   │  entries/*.md  │  │  Tier 1 only     │  │  optional         │       │
│   └────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **plugin.json** | Plugin identity, namespace (`mindrian-os`), version | `.claude-plugin/plugin.json` — static manifest |
| **settings.json** | Default agent activation (Larry as main thread) | Root `settings.json` with `{"agent": "larry-extended"}` |
| **commands/** | 25 methodology slash commands + utility commands | One `.md` per methodology; user-invoked via `/mindrian-os:bono` etc. |
| **skills/** | Auto-activated contextual intelligence (room-passive, room-proactive, larry-personality, etc.) | `SKILL.md` per skill; Claude auto-loads when relevant |
| **agents/** | Specialized subagents (larry-extended, research-pipeline, room-analyst) | Markdown files with YAML frontmatter; `larry-extended` is the default main agent |
| **hooks/hooks.json** | Intelligence pipeline triggers (SessionStart, PostToolUse, Stop) | JSON config triggering scripts in `scripts/` |
| **pipelines/** | ICM stage contracts for multi-step methodology workflows | Folder per pipeline with numbered stage files |
| **references/** | Tier 0 fallback data: 275 frameworks, static chain suggestions, mode algorithm | Read-only markdown; Layer 3 of ICM |
| **.mcp.json** | Brain MCP connection config (optional), research tools | Standard MCP config with `${env}` expansion for Brain API key |
| **scripts/** | Hook handler scripts, HSI computation, export generators | Shell/Python scripts referenced by hooks and skills |

## Recommended Project Structure

```
MindrianOS-Plugin/
├── .claude-plugin/
│   └── plugin.json                    # Plugin manifest (name, version, author)
│
├── settings.json                      # {"agent": "larry-extended"}
├── .mcp.json                          # Brain MCP + optional LazyGraph
│
├── agents/
│   ├── larry-extended.md              # DEFAULT AGENT: Larry personality + mode engine
│   ├── research-pipeline.md           # Delegated research with Explore agent
│   └── room-analyst.md                # Room state analysis subagent
│
├── skills/
│   ├── larry-personality/
│   │   └── SKILL.md                   # Voice, tone, mode distribution (auto-invoked)
│   ├── room-passive/
│   │   └── SKILL.md                   # Auto-capture insights to Data Room sections
│   ├── room-proactive/
│   │   └── SKILL.md                   # Gap detection, contradiction alerts, convergence
│   ├── context-engine/
│   │   └── SKILL.md                   # Session continuity, STATE.md management
│   ├── pws-methodology/
│   │   └── SKILL.md                   # Framework selection guidance (auto-invoked)
│   └── connector-awareness/
│       └── SKILL.md                   # Detect available MCPs, suggest integrations
│
├── commands/
│   ├── larry.md                       # /mindrian-os:larry — talk to Larry
│   ├── room.md                        # /mindrian-os:room — room management
│   ├── pipeline.md                    # /mindrian-os:pipeline — run methodology pipeline
│   ├── setup.md                       # /mindrian-os:setup — Brain/Graph connection
│   ├── status.md                      # /mindrian-os:status — room health dashboard
│   ├── grade.md                       # /mindrian-os:grade — rubric assessment
│   │
│   │   # --- 25 Methodology Commands ---
│   ├── bono.md                        # Six Thinking Hats
│   ├── minto.md                       # Pyramid Principle
│   ├── domain-explorer.md             # Domain decomposition
│   ├── jtbd.md                        # Jobs to Be Done
│   ├── hsi.md                         # HSI analysis
│   ├── devils-advocate.md             # Challenge assumptions
│   ├── scenario-analysis.md           # Scenario planning
│   ├── s-curve.md                     # S-Curve analysis
│   ├── beautiful-question.md          # Beautiful Question methodology
│   ├── investment-thesis.md           # Investment thesis builder
│   └── ...                            # (remaining 15 methodology commands)
│
├── pipelines/
│   ├── minto/
│   │   ├── 00-contract.md             # ICM stage contract: inputs, outputs, transitions
│   │   ├── 01-situation.md            # Stage 1: Situation
│   │   ├── 02-complication.md         # Stage 2: Complication
│   │   ├── 03-question.md            # Stage 3: Question
│   │   └── 04-answer.md              # Stage 4: Answer (pyramid structure)
│   ├── bono/
│   │   ├── 00-contract.md
│   │   ├── 01-white-hat.md
│   │   ├── 02-red-hat.md
│   │   └── ...
│   ├── domain-explorer/
│   │   └── ...
│   ├── jtbd/
│   │   └── ...
│   └── week7-chain/
│       └── 00-contract.md             # Meta-pipeline: chains methodology outputs
│
├── references/                         # Layer 3: Factory (Tier 0 fallback)
│   ├── frameworks/
│   │   ├── index.md                   # 275 framework catalog with metadata
│   │   ├── bono.md                    # Framework detail: Six Thinking Hats
│   │   ├── minto.md                   # Framework detail: Pyramid Principle
│   │   └── ...
│   ├── chains/
│   │   └── static-chains.md           # Pre-computed framework chaining suggestions
│   ├── grading/
│   │   └── rubric.md                  # Grading rubric (Tier 0 static version)
│   └── mode-engine/
│       └── calibration.md             # 40:30:20:10 mode distribution spec
│
├── hooks/
│   └── hooks.json                     # Intelligence pipeline hooks
│
├── scripts/
│   ├── session-init.sh                # SessionStart: load STATE.md, set context
│   ├── room-file.sh                   # PostToolUse: classify and file insights
│   ├── state-update.sh                # Stop: update STATE.md with session summary
│   └── hsi-compute.py                # HSI calculation script
│
├── docs/
│   ├── THE-BRAIN.md                   # Brain architecture (moat documentation)
│   └── IDEA-DOCUMENT.md              # Full idea evolution
│
└── CLAUDE.md                          # Project guide, architecture, decisions
```

### Structure Rationale

- **agents/ with larry-extended as default:** `settings.json` sets `{"agent": "larry-extended"}` so the entire session runs with Larry's system prompt, mode engine, and personality. The user never has to invoke Larry -- Larry IS the session. This is the most powerful plugin pattern: replacing Claude's default behavior with a domain-specific personality.

- **skills/ for auto-invoked intelligence:** Skills with `user-invocable: false` or default behavior act as always-on capabilities. `room-passive` listens for insights to file; `room-proactive` detects gaps and contradictions; `larry-personality` ensures consistent voice. Claude auto-loads these based on context, keeping the context budget manageable.

- **commands/ for user-invoked methodologies:** The 25 methodology bots are `disable-model-invocation: true` commands. Users explicitly invoke `/mindrian-os:bono` when they want Six Thinking Hats. This prevents Claude from autonomously running methodology pipelines the user did not request.

- **pipelines/ separate from commands/:** Pipeline stage contracts (ICM Layer 2) are referenced BY commands and skills, not directly invoked. When `/mindrian-os:minto` runs, it reads `pipelines/minto/00-contract.md` and executes stages sequentially. This separation means the same pipeline can be invoked by a command, by a skill, or by chain recommendation.

- **references/ as Tier 0 factory:** This is the embedded IP that makes the free tier fully functional. 275 framework descriptions, static chaining rules, grading rubric, mode calibration. Brain MCP enriches but never gates.

## Architectural Patterns

### Pattern 1: Default Agent as Session Personality

**What:** Use `settings.json` to set a custom agent as the main thread, replacing Claude's default system prompt with Larry's personality, voice, and teaching intelligence.

**When to use:** When the plugin defines a distinct personality that should pervade every interaction, not just respond to specific commands.

**Trade-offs:** Powerful immersion, but the agent's system prompt replaces Claude Code's default prompt entirely. CLAUDE.md files still load. The agent markdown body becomes the ONLY system prompt.

**Example frontmatter for larry-extended.md:**
```yaml
---
name: larry-extended
description: Larry - PWS methodology teaching partner. The default personality for all MindrianOS interactions. Combines 30+ years of teaching intelligence with the PWS framework.
model: inherit
skills:
  - larry-personality
  - room-passive
  - pws-methodology
---
```

The `skills` field preloads full skill content into the agent's context at startup. This is critical: Larry needs his personality, room awareness, and methodology knowledge injected immediately, not discovered lazily.

### Pattern 2: ICM Folder Structure as Orchestration

**What:** Use folder hierarchy and markdown files to encode orchestration logic instead of code. The file structure IS the routing table, the stage contracts, the state machine.

**When to use:** When orchestration can be expressed declaratively. ICM works because Claude reads files and follows instructions -- the folder structure tells Claude what to do in what order.

**Trade-offs:** Zero framework code (huge simplicity win), but debugging is harder since there is no explicit state machine to inspect. Depends on Claude faithfully reading and following file-based contracts.

**How it maps to the plugin:**

| ICM Layer | Plugin Location | Content |
|-----------|----------------|---------|
| Layer 0: Identity | `room/ROOM.md` (user workspace) | "This room is about X venture" |
| Layer 1: Routing | `skills/pws-methodology/SKILL.md` | Framework selection logic |
| Layer 2: Stage Contracts | `pipelines/*/00-contract.md` | Inputs, outputs, transitions per methodology |
| Layer 3: Reference/Factory | `references/` | 275 frameworks, chains, rubric, mode engine |
| Layer 4: Working Artifacts | `room/` (user workspace) | Data Room entries, STATE.md, deliverables |

### Pattern 3: Pipeline Chaining Through Room (Week 7)

**What:** Pipeline outputs are structured artifacts filed to specific Room sections. The next pipeline reads from Room sections as input. The Room itself is the integration bus.

**When to use:** Multi-methodology sequences where one framework's output feeds another (Domain Explorer sub-domains become Bono hat perspectives become JTBD personas).

**Trade-offs:** Elegant and inspectable (every intermediate artifact is a readable file), but requires consistent file naming conventions and structured output formats. If a pipeline writes sloppy output, the next pipeline gets sloppy input.

**Data flow:**
```
/mindrian-os:domain-explorer
    → output: room/solution-design/sub-domains.md

/mindrian-os:bono
    → input: reads room/solution-design/sub-domains.md
    → transforms: sub-domains become hat perspectives
    → output: room/problem-definition/bono-analysis.md

/mindrian-os:jtbd
    → input: reads room/problem-definition/bono-analysis.md
    → transforms: perspectives become customer personas
    → output: room/market-analysis/jtbd-personas.md
```

### Pattern 4: Graceful Degradation via Tiered Intelligence

**What:** Every feature works at Tier 0 (free, no dependencies). Brain MCP enriches at Tier 1 (paid). LazyGraph enhances at Tier 2. The plugin tests for availability and adapts.

**When to use:** Always. This is the core business architecture. The free tier must feel complete, not crippled.

**Implementation pattern:**
```
SessionStart hook:
  1. Check .mcp.json for Brain MCP → set BRAIN_AVAILABLE
  2. Check for LazyGraph Neo4j → set GRAPH_AVAILABLE
  3. Inject tier context into session

Skills/Commands:
  if BRAIN_AVAILABLE:
    call mcp__brain__suggest_chain()     # Live graph intelligence
  else:
    read references/chains/static-chains.md  # Embedded fallback
```

### Pattern 5: Hooks as Intelligence Pipeline

**What:** Use the three lifecycle hooks (SessionStart, PostToolUse, Stop) to create a passive intelligence pipeline that runs alongside conversation.

**When to use:** When you need continuous background processing without user invocation.

**Hook pipeline:**
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/session-init.sh",
        "statusMessage": "Loading room context..."
      }]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/room-file.sh"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/state-update.sh"
      }]
    }]
  }
}
```

**Trade-offs:** Hooks run shell commands, not Claude prompts (except `type: "prompt"` hooks which run a separate single-turn evaluation). Heavy logic in hooks should be fast -- the default timeout is 600s but users will feel delays. Keep hook scripts under 2-3 seconds.

## Data Flow

### Conversation Flow (Single Turn)

```
User Message
    │
    ↓
┌─────────────────────────────┐
│ Larry Agent (main thread)   │
│ System prompt: larry.md     │
│ Preloaded: personality,     │
│   room-passive, methodology │
├─────────────────────────────┤
│ Claude reads ICM context:   │
│   room/ROOM.md (identity)   │
│   room/STATE.md (status)    │
│   references/ (frameworks)  │
├─────────────────────────────┤
│ Claude decides:             │
│   → Direct response?        │
│   → Invoke methodology?     │
│   → Delegate to subagent?   │
│   → Run pipeline?           │
└──────────┬──────────────────┘
           │
    ┌──────┴──────────┐
    │                 │
    ↓                 ↓
[Direct Response]  [Pipeline Execution]
    │                 │
    ↓                 ↓
PostToolUse Hook   Pipeline reads stages
    │                 │
    ↓                 ↓
room-file.sh       Writes artifacts to Room
classifies entry      │
files to section      ↓
    │              PostToolUse Hook fires
    ↓              per artifact written
Stop Hook              │
    │                  ↓
    ↓              Stop Hook
state-update.sh       │
updates STATE.md      ↓
                   state-update.sh
```

### State Management

```
┌─────────────────────────────────────────────┐
│            Master STATE.md                   │
│  (aggregates all room states)                │
│  session_count, last_active, tier_status     │
├─────────────────────────────────────────────┤
│                                              │
│  room/                                       │
│  ├── ROOM.md          (identity, focus)      │
│  ├── STATE.md         (room-level state)     │
│  ├── problem-definition/                     │
│  │   └── *.md entries                        │
│  ├── market-analysis/                        │
│  │   └── *.md entries                        │
│  ├── solution-design/                        │
│  │   └── *.md entries                        │
│  ├── business-model/                         │
│  │   └── *.md entries                        │
│  ├── competitive-analysis/                   │
│  │   └── *.md entries                        │
│  ├── team-execution/                         │
│  │   └── *.md entries                        │
│  ├── legal-ip/                               │
│  │   └── *.md entries                        │
│  └── financial-model/                        │
│      └── *.md entries                        │
│                                              │
│  Sub-rooms (when user discovers distinct     │
│  opportunity spaces):                        │
│  room/opportunities/                         │
│  ├── opp-1/                                  │
│  │   ├── ROOM.md                             │
│  │   ├── STATE.md                            │
│  │   └── [8 sections]/                       │
│  └── opp-2/                                  │
│      └── ...                                 │
│                                              │
│  State flows BOTTOM-UP (child → parent)      │
│  Context flows TOP-DOWN (parent → child)     │
└─────────────────────────────────────────────┘
```

### Key Data Flows

1. **Insight Capture (Passive):** User mentions market data in conversation --> room-passive skill detects it --> classifies as `market-analysis` --> creates timestamped entry in `room/market-analysis/` --> updates room STATE.md entry count.

2. **Gap Detection (Proactive):** room-proactive skill reads STATE.md --> notices `team-execution` has 0 entries while other sections are populated --> surfaces suggestion: "You haven't addressed team composition yet. Consider running JTBD to identify the skills your venture needs."

3. **Pipeline Chaining:** User runs Domain Explorer --> output filed to `room/solution-design/sub-domains.md` --> room-proactive detects new solution-design entry --> checks Brain MCP (or static chains) for what follows Domain Explorer --> suggests: "Your sub-domains are ready for Bono analysis. Run `/mindrian-os:bono` to explore each perspective."

4. **Brain Enrichment (Tier 1):** During any methodology command --> skill checks `BRAIN_AVAILABLE` --> calls `mcp__brain__enrich_context` with current room state --> Brain returns framework connections, chaining rules, grading context --> response is enriched with graph intelligence the user never sees directly.

5. **Session Continuity:** SessionStart hook reads STATE.md --> injects room status, last session summary, pending suggestions into session context --> Larry greets user with awareness of where they left off.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (solo founder) | Single room, flat structure, no sub-rooms needed. All intelligence runs in one session. |
| 5-20 users (classroom) | Each user has independent workspace. Brain MCP handles concurrent requests. No shared state needed at plugin level. |
| 100+ users (marketplace) | Brain MCP needs rate limiting and caching. LazyGraph per-user isolation via project_id. Plugin itself has no scaling concern -- it runs locally per user. |

### Scaling Priorities

1. **First bottleneck: Brain MCP throughput.** At 50+ concurrent Tier 1 users, the Neo4j Aura instance needs query optimization and response caching. Solution: cache frequent framework lookups, use Pinecone for bulk similarity (already deployed).

2. **Second bottleneck: Context window budget.** With 25 commands, 6 skills, and pipeline stage files, the skill description budget (2% of context window, ~16K chars fallback) may be exceeded. Solution: use `disable-model-invocation: true` on methodology commands (keeps descriptions out of context), keep auto-invoked skills to 5-6 max, and use `user-invocable: false` for background skills that only Claude should trigger.

3. **Third bottleneck: Room file volume.** After months of use, a room could have hundreds of entries. Solution: STATE.md acts as index (never scan directories), and pipeline contracts reference specific files by name.

## Anti-Patterns

### Anti-Pattern 1: Putting Orchestration Logic in Scripts

**What people do:** Write complex Python/Shell scripts in `scripts/` that implement routing, state machines, or decision trees.

**Why it is wrong:** Claude cannot read or understand script logic at runtime. The script runs opaquely. If routing logic is in a shell script, Claude cannot explain why it chose a particular methodology. ICM's core insight is that Claude reads markdown natively -- put orchestration logic in markdown where Claude can reason about it.

**Do this instead:** Put routing logic in skills and pipeline contracts (markdown). Use scripts only for side effects Claude cannot perform: file I/O in hooks, external API calls, computation.

### Anti-Pattern 2: Too Many Auto-Invoked Skills

**What people do:** Create 15+ skills without `disable-model-invocation: true`, causing all descriptions to load into context and exceed the skill budget.

**Why it is wrong:** Skill descriptions consume 2% of the context window. With 25 methodology skills plus 6 system skills, descriptions alone could eat 10K+ characters. Claude may drop skills silently.

**Do this instead:** Methodology commands use `disable-model-invocation: true` (user invokes explicitly). System skills (room-passive, room-proactive, etc.) use default or `user-invocable: false`. Keep auto-invoked skills under 6-8 total.

### Anti-Pattern 3: Monolithic Agent System Prompt

**What people do:** Put everything -- personality, all 25 methodologies, room management, grading, pipeline logic -- into one agent's system prompt.

**Why it is wrong:** Exceeds useful prompt size. Claude's instruction following degrades with prompt length. Mixed concerns mean the agent tries to do everything in every turn.

**Do this instead:** Agent system prompt covers personality and core behavior only. Methodologies live in commands/pipelines (loaded on demand). Room intelligence lives in skills (loaded when relevant). The agent's `skills` field preloads only essential always-on skills.

### Anti-Pattern 4: Bypassing Room for Direct Output

**What people do:** Have pipelines produce output directly in conversation without filing to Room sections.

**Why it is wrong:** Breaks pipeline chaining (next pipeline cannot find the output). Breaks gap detection (room-proactive cannot see unfiled work). Breaks session continuity (STATE.md does not reflect the work done).

**Do this instead:** Every pipeline stage writes its output to the appropriate Room section as a timestamped markdown file. The conversation shows a summary; the artifact lives in the Room.

### Anti-Pattern 5: Plugin Agents with hooks/mcpServers/permissionMode

**What people do:** Define `hooks`, `mcpServers`, or `permissionMode` in plugin agent frontmatter.

**Why it is wrong:** Claude Code explicitly ignores these fields on plugin-provided agents for security reasons. The agent loads without error but these fields silently do nothing.

**Do this instead:** Define hooks in `hooks/hooks.json` at the plugin root (scoped to the whole plugin). Define MCP servers in `.mcp.json` at the plugin root. If you need per-agent hooks, instruct users to copy the agent to `.claude/agents/` where all fields work.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Brain MCP** (brain.mindrian.ai) | `.mcp.json` with `type: "http"` or `type: "stdio"` (depending on deployment) | Optional Tier 1. Tools: `enrich_context`, `suggest_chain`, `suggest_methodology`, `grade_room`, `find_connections`, `get_chaining_rules`, `get_teaching_context`. Must handle connection failure gracefully. |
| **LazyGraph** (user's Neo4j Aura Free) | `.mcp.json` entry configured by `/mindrian-os:setup graph` | Optional. User provides their own Aura credentials. Plugin stores in env vars. 50K node limit. |
| **Research Tools** (Tavily, ArXiv, etc.) | `.mcp.json` entries for any available research MCPs | Detected by connector-awareness skill. Not bundled -- user brings their own. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Agent <--> Skills | Preloaded via `skills` field in agent frontmatter | Larry agent preloads 3 essential skills at startup. Others loaded by Claude on demand. |
| Commands <--> Pipelines | Command reads pipeline contract, executes stages | Command is the entry point; pipeline is the execution plan. Command may use `context: fork` to run pipeline in subagent. |
| Skills <--> Room | Skills read/write Room files via standard tools | room-passive writes entries; room-proactive reads STATE.md. No special API -- just file I/O. |
| Hooks <--> Scripts | hooks.json references scripts via `${CLAUDE_PLUGIN_ROOT}/scripts/` | Scripts receive hook input as JSON on stdin. Exit code 0 = success. Scripts must be fast (<3s). |
| Plugin <--> Brain MCP | Standard MCP tool calls | Plugin calls Brain tools like any MCP tool. Brain returns JSON. Plugin never exposes Brain data to user -- only Larry's enriched response. |
| Plugin <--> User Workspace | Room directory created in user's project folder | Plugin writes to `./room/` in the working directory. User owns all files. Plugin reads but never modifies user's existing project files. |

## Build Order (Dependency Graph)

Components must be built in this order due to dependencies:

```
Phase 1: Foundation (no dependencies)
├── plugin.json manifest
├── settings.json (agent: larry-extended)
├── agents/larry-extended.md (core personality)
└── CLAUDE.md (project guide)

Phase 2: Skills Layer (depends on: Phase 1)
├── skills/larry-personality/ (preloaded by larry agent)
├── skills/context-engine/ (STATE.md management)
└── skills/pws-methodology/ (framework selection)

Phase 3: Room System (depends on: Phase 2)
├── Room folder structure (8 sections)
├── STATE.md template and management
├── skills/room-passive/ (auto-capture)
└── skills/room-proactive/ (gap detection)

Phase 4: Methodology Commands (depends on: Phase 3)
├── commands/ (25 methodology bots, one at a time)
├── references/frameworks/ (Tier 0 framework data)
└── references/chains/ (static chaining rules)

Phase 5: Pipeline System (depends on: Phase 3, 4)
├── pipelines/ (ICM stage contracts)
├── Pipeline chaining through Room
└── references/grading/ (rubric for assessment)

Phase 6: Intelligence Hooks (depends on: Phase 3)
├── hooks/hooks.json
├── scripts/ (session-init, room-file, state-update)
└── Hook-driven passive intelligence

Phase 7: External Integration (depends on: Phase 4, 5)
├── .mcp.json (Brain MCP config)
├── Brain tool integration in skills/commands
├── LazyGraph setup command
├── skills/connector-awareness/
└── Graceful degradation testing

Phase 8: Polish & Distribution (depends on: all)
├── Three-surface testing (CLI, Desktop, Cowork)
├── Marketplace submission
└── Documentation and onboarding flow
```

**Key dependency insight:** The Room system (Phase 3) is the critical path. Everything downstream -- commands, pipelines, hooks, Brain integration -- reads from or writes to the Room. Build the Room scaffold early and validate that file-based state management works before building methodology commands that depend on it.

## Sources

- [Create plugins - Claude Code Docs](https://code.claude.com/docs/en/plugins) (HIGH confidence, official docs)
- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/skills) (HIGH confidence, official docs)
- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents) (HIGH confidence, official docs)
- [Hooks - Claude Code Docs](https://code.claude.com/docs/en/hooks) (HIGH confidence, official docs)
- [MCP - Claude Code Docs](https://code.claude.com/docs/en/mcp) (HIGH confidence, official docs)
- [Plugins reference - Claude Code Docs](https://code.claude.com/docs/en/plugins-reference) (HIGH confidence, official docs)
- ICM paper (2603.16021v2) referenced in PROJECT.md (MEDIUM confidence, academic paper)
- GSD patterns from `~/.claude/get-shit-done/` (HIGH confidence, local reference)

---
*Architecture research for: Claude Code Plugin (MindrianOS)*
*Researched: 2026-03-19*
