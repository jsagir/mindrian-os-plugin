# Architecture Research: MindrianOS v3.0 MCP Platform & Intelligence Expansion

**Domain:** Claude Code plugin with MCP server dual-delivery, collaborative room access, new intelligence features
**Researched:** 2026-03-24
**Confidence:** HIGH (based on existing codebase analysis + MCP SDK docs + established patterns)

## System Overview: v2.0 (Current) vs v3.0 (Target)

### Current Architecture (v2.0)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE CLI (Plugin Host)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ commands/│  │ skills/  │  │ agents/  │  │  hooks/  │  │ scripts/ │ │
│  │ 41 .md   │  │ 6 SKILL  │  │ 5 .md    │  │hooks.json│  │ 20 bash  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │             │              │             │       │
│       └──────────────┴─────────────┴──────────────┴─────────────┘       │
│                                    │                                    │
├────────────────────────────────────┼────────────────────────────────────┤
│                          LOCAL FILE SYSTEM                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  room/ (8 DD sections + team/ + meetings/ + STATE.md)           │   │
│  │  dashboard/ (graph.json + index.html)                            │   │
│  │  references/ (brain/, methodology/, meeting/, personality/)      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                          REMOTE (Optional)                              │
│  ┌──────────────────┐                                                   │
│  │  Brain MCP        │  brain.mindrian.ai (Neo4j 21K nodes)            │
│  │  (enrichment)     │  Pinecone 1,427 embeddings                      │
│  └──────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** The plugin has NO shared library layer. Commands (.md) instruct Claude to call scripts (bash/python) directly. Logic lives in two places:
1. **Markdown instructions** (commands/, skills/, agents/) -- Claude reads and follows
2. **Bash/Python scripts** (scripts/) -- deterministic computation Claude cannot do (file scanning, PDF rendering, graph JSON generation)

### Target Architecture (v3.0)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DELIVERY SURFACES                                 │
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │  CLI Plugin   │   │  MCP Server   │   │  MCP Server   │                │
│  │  (commands/)  │   │  (Desktop)    │   │  (Cowork)     │                │
│  │  Claude Code  │   │  stdio local  │   │  stdio local  │                │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                 │
│         │                   │                   │                         │
├─────────┴───────────────────┴───────────────────┴─────────────────────────┤
│                       SHARED CORE (mindrian-tools.cjs)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ room-ops    │  │ state-ops   │  │ meeting-ops  │  │ graph-ops    │   │
│  │ read/write  │  │ compute/get │  │ file/analyze │  │ build/query  │   │
│  └─────────────┘  └─────────────┘  └──────────────┘  └──────────────┘   │
├──────────────────────────────────────────────────────────────────────────┤
│                          LOCAL FILE SYSTEM                                │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  room/ (8 DD + team/ + meetings/ + opportunity-bank/ + funding/)│    │
│  │  dashboard/ | references/ | pipelines/ | templates/             │    │
│  └──────────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────────┤
│                          REMOTE (Optional)                                │
│  ┌──────────────────┐  ┌──────────────────┐                              │
│  │  Brain MCP        │  │  Room MCP         │                             │
│  │  brain.mindrian.ai│  │  (shared team     │                             │
│  │  (enrichment)     │  │   room access)    │                             │
│  └──────────────────┘  └──────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Current State | v3.0 Change |
|-----------|----------------|---------------|-------------|
| `commands/*.md` | Claude instructions for CLI `/mindrian-os:*` commands | 41 commands exist | **Unchanged** -- these stay as-is |
| `scripts/*` | Deterministic computation (bash/python) | 20 scripts | **Refactored** -- extract reusable logic to mindrian-tools.cjs |
| `skills/*.md` | Auto-activated behaviors (passive, proactive) | 6 skills | **Extended** -- new persona generation skill |
| `agents/*.md` | Sub-agent definitions for delegated tasks | 5 agents | **Extended** -- new opportunity/funding agents |
| `hooks/hooks.json` | SessionStart, PostToolUse, Stop hooks | 3 hook types | **Unchanged** -- CLI-only concept |
| `mindrian-tools.cjs` | **NEW** shared Node.js entry point | Does not exist | **Created** -- core logic both plugin and MCP call |
| `mcp-server/` | **NEW** MCP server for Desktop/Cowork | Does not exist | **Created** -- MCP tools wrapping shared core |
| `references/` | Embedded methodology, meeting patterns, personality | 4 subdirs | **Extended** -- persona templates, opportunity patterns |

## Recommended Project Structure (v3.0 Additions)

```
MindrianOS-Plugin/
├── .claude-plugin/plugin.json      # Plugin manifest (existing)
├── commands/                        # CLI commands (existing, unchanged)
├── skills/                          # Auto-skills (existing, extended)
├── agents/                          # Sub-agents (existing, extended)
├── hooks/                           # CLI hooks (existing, unchanged)
├── scripts/                         # Bash/Python scripts (existing, THINNED)
│   ├── compute-state               # Stays -- fast bash for hook speed
│   ├── analyze-room                # Stays -- fast bash for hook speed
│   ├── session-start               # Stays -- hook entry point
│   └── ...                         # Other scripts stay, but logic shared
│
├── bin/                             # NEW: Shared core
│   ├── mindrian-tools.cjs          # Single Node.js entry point (GSD pattern)
│   └── lib/                        # Internal modules
│       ├── room-ops.js             # Room CRUD, section listing, entry filing
│       ├── state-ops.js            # STATE.md read/write/compute
│       ├── meeting-ops.js          # Meeting filing, speaker ops, cross-intel
│       ├── graph-ops.js            # Build graph JSON, wikilink parsing
│       ├── export-ops.js           # PDF rendering coordination
│       └── persona-ops.js          # AI persona generation/storage
│
├── mcp-server/                      # NEW: MCP server package
│   ├── package.json                # @modelcontextprotocol/sdk dependency
│   ├── server.cjs                  # MCP server entry (stdio transport)
│   └── tools/                      # MCP tool definitions
│       ├── room-tools.js           # room_overview, room_section, room_add
│       ├── meeting-tools.js        # file_meeting, meeting_intelligence
│       ├── methodology-tools.js    # think_hats, lean_canvas, etc.
│       ├── export-tools.js         # export_pdf
│       ├── dashboard-tools.js      # launch_dashboard
│       └── persona-tools.js        # generate_persona, list_personas
│
├── references/                      # Reference materials (existing, extended)
│   ├── personality/                # Larry voice, mode engine
│   ├── methodology/               # 30 methodology references
│   ├── meeting/                   # Meeting filing patterns
│   ├── brain/                     # Brain query patterns
│   ├── personas/                  # NEW: Persona generation templates
│   └── opportunities/             # NEW: Grant/opportunity patterns
│
├── dashboard/                       # De Stijl dashboard (existing)
├── pipelines/                       # ICM stage contracts (existing)
├── templates/                       # PDF templates (existing)
└── settings.json                    # Plugin settings (existing)
```

### Structure Rationale

- **`bin/mindrian-tools.cjs`:** Single entry point following the proven GSD pattern. Both `scripts/*` (called by hooks/commands) and `mcp-server/server.cjs` import the same lib modules. This is NOT a new abstraction -- it is extracting logic that currently lives scattered across 20 bash scripts into callable Node.js functions.
- **`mcp-server/`:** Separate directory (not separate repo) because it shares the same filesystem context. The MCP server needs access to `room/`, `references/`, `scripts/`, and `bin/lib/`. Separate repo would require duplicating or symlinking everything.
- **`scripts/` stays:** Hook scripts (session-start, compute-state, analyze-room) MUST remain as fast bash. Hooks have a 2-3 second timeout. Node.js cold start is too slow. Scripts call into `mindrian-tools.cjs` for complex operations but remain the hook entry points.

## Architectural Patterns

### Pattern 1: Dual-Delivery Layer (The Core Pattern)

**What:** Every capability has two delivery surfaces sharing one implementation. CLI commands (markdown) instruct Claude to call scripts/tools. MCP tools expose the same operations programmatically.

**When to use:** Every new feature in v3.0.

**Trade-offs:** +Consistency across surfaces, +No drift between CLI and MCP. -Need to maintain two thin wrappers per feature. -MCP tools cannot replicate "Claude reads markdown and follows instructions" -- they must be more structured.

**Critical distinction:** CLI commands are *instructions to Claude*. MCP tools are *callable functions*. They are NOT the same thing. A CLI command like `file-meeting.md` is a 200-line conversational pipeline that Claude interprets step by step. The MCP equivalent must decompose this into discrete tools: `prepare_meeting_filing`, `identify_speakers`, `classify_segments`, `file_artifacts`.

```
CLI (commands/file-meeting.md):
  Claude reads markdown -> follows 6 steps -> calls scripts as needed
  = ONE command, conversational, Claude has judgment

MCP (mcp-server/tools/meeting-tools.js):
  file_meeting_prepare(transcript) -> {speakers, segments}
  file_meeting_classify(segments) -> {classified}
  file_meeting_route(classified) -> {room_sections}
  file_meeting_commit(routed) -> {artifacts_written}
  = FOUR tools, structured, Claude orchestrates from Desktop
```

### Pattern 2: mindrian-tools.cjs as Shared Core (GSD Pattern)

**What:** A single Node.js entry point with subcommands, following exactly the `gsd-tools.cjs` pattern that already works in production.

**When to use:** Any operation that both scripts and MCP tools need.

**Example:**
```javascript
// bin/mindrian-tools.cjs (entry point)
const command = process.argv[2];
switch(command) {
  case 'room': require('./lib/room-ops').run(process.argv.slice(3)); break;
  case 'state': require('./lib/state-ops').run(process.argv.slice(3)); break;
  case 'meeting': require('./lib/meeting-ops').run(process.argv.slice(3)); break;
  case 'graph': require('./lib/graph-ops').run(process.argv.slice(3)); break;
}

// Callable from bash scripts:
//   node "$PLUGIN_ROOT/bin/mindrian-tools.cjs" room list-sections "$ROOM_DIR"
//
// Callable from MCP server:
//   const { listSections } = require('../bin/lib/room-ops');
//   const sections = await listSections(roomDir);
```

**Trade-offs:** +Proven pattern (GSD uses this daily), +Single source of truth for logic, +Both bash scripts and MCP server can call it. -Node.js must be available (it is on all Claude surfaces). -Extracting from bash scripts takes effort.

### Pattern 3: Room as State Store (Existing, Extended)

**What:** The `room/` directory IS the database. STATE.md is the index. Artifacts are the records. The folder hierarchy IS the schema.

**When to use:** All new room sections (opportunity-bank/, funding/).

**v3.0 Extension:**
```
room/
├── problem-definition/          # Existing 8 DD sections
├── market-analysis/
├── solution-design/
├── business-model/
├── competitive-analysis/
├── team-execution/
├── legal-ip/
├── financial-model/
├── team/                        # v2.0 addition
│   └── members/*/PROFILE.md
├── meetings/                    # v2.0 addition
│   └── YYYY-MM-DD-*/
├── opportunity-bank/            # NEW v3.0
│   ├── STATE.md                 # Sub-room state (grants found, status)
│   ├── grants/                  # Filed grant opportunities
│   ├── partnerships/            # Partnership leads
│   └── competitions/            # Competition/accelerator leads
├── funding/                     # NEW v3.0
│   ├── STATE.md                 # Sub-room state
│   ├── non-dilutive/            # Grants, awards
│   │   └── {grant-name}/       # GSD-style per-grant process folder
│   ├── dilutive/                # Investment rounds
│   └── pipeline.md             # Funnel view across all sources
├── personas/                    # NEW v3.0
│   └── {persona-name}/
│       ├── PERSONA.md           # Generated persona definition
│       └── contributions/       # Persona's contributions to room
├── STATE.md                     # Master state (existing)
├── USER.md                      # User context (existing)
└── MEETINGS-INTELLIGENCE.md     # Cross-meeting intel (existing)
```

**Critical rule for new sections:** `compute-state` and `analyze-room` must be updated to scan new sections. The hardcoded `SECTIONS` array in `analyze-room` (line 17-26) must become extensible:

```bash
# Current (hardcoded):
SECTIONS=(problem-definition market-analysis ... financial-model)

# v3.0 (dynamic discovery + known sections):
CORE_SECTIONS=(problem-definition market-analysis ... financial-model)
EXTENDED_SECTIONS=(opportunity-bank funding personas)
# Also scan for any directory with a STATE.md (user-created sub-rooms)
```

### Pattern 4: MCP Server with stdio Transport

**What:** The MCP server runs as a local process connected via stdio. Claude Desktop and Cowork launch it via `claude_desktop_config.json`.

**When to use:** This is the only delivery mechanism for non-CLI surfaces.

**Configuration (user's claude_desktop_config.json):**
```json
{
  "mcpServers": {
    "mindrian-os": {
      "command": "node",
      "args": ["/path/to/MindrianOS-Plugin/mcp-server/server.cjs"],
      "env": {
        "MINDRIAN_ROOM": "/path/to/project/room"
      }
    }
  }
}
```

**Critical design decision: Room path must be configurable.** Unlike CLI where `room/` is always relative to CWD, MCP server runs as a separate process and needs an explicit path to the room. The `MINDRIAN_ROOM` env var solves this. The `setup` command must generate this config.

**Trade-offs:** +stdio is the simplest transport, zero network config. +Works on all platforms. -One MCP server per room (cannot switch projects without reconfig). -No remote access (that requires Streamable HTTP, addressed in Remote Room section).

### Pattern 5: AI Persona Generation and Storage

**What:** Generate domain expert personas from room intelligence. Personas are stored as ICM artifacts (markdown) and act as specialized viewpoints during discussions.

**When to use:** Once a room has sufficient intelligence (3+ populated sections).

**Generation flow:**
```
Room Intelligence
    | analyze-room + MEETINGS-INTELLIGENCE.md
    | Extract: domains mentioned, expertise gaps, team composition
    v
Persona Template (references/personas/)
    | Domain + Bono thinking hat perspective + room context
    v
Generated PERSONA.md
    | Stored in room/personas/{name}/PERSONA.md
    v
Available as: skill context OR agent delegation target
```

**Storage format:**
```markdown
---
name: Dr. Sarah Chen
domain: biotech-regulatory
perspective: white-hat  # Bono thinking hat
generated_from: [solution-design, legal-ip, team-execution]
generated_date: 2026-03-24
room_context_hash: abc123  # Track when room has changed enough to regenerate
---

# Dr. Sarah Chen -- Biotech Regulatory Expert

## Expertise Profile
[Generated from room intelligence]

## Perspective Lens
White Hat: Focus on available data, facts, and what is known/unknown.

## Consultation Triggers
- When filing artifacts in: solution-design, legal-ip
- When keywords detected: FDA, regulatory, compliance, approval
```

**Personas are NOT agents.** They are skill context files that Larry loads when relevant. They do not have their own command entry points. Larry decides when to "consult" a persona based on room context.

## Data Flow

### MCP Tool Call Flow (New)

```
Desktop/Cowork User
    | (natural language to Claude)
Claude decides to call MCP tool
    |
MCP Server (stdio) receives tool call
    |
server.cjs routes to tool handler
    |
Tool handler calls bin/lib/*.js
    |
lib module reads/writes room/ filesystem
    |
Result returned as MCP tool response
    |
Claude presents to user in conversation
```

### CLI Command Flow (Existing, Unchanged)

```
User types /mindrian-os:room
    |
Claude reads commands/room.md
    |
Claude follows markdown instructions
    |
Instructions say: run `scripts/compute-state room/`
    |
Script executes, returns stdout
    |
Claude interprets output, responds to user
```

### Dual-Delivery Example: Room Overview

```
CLI Path:                              MCP Path:
/mindrian-os:room                      tool: room_overview
    |                                      |
Claude reads commands/room.md          server.cjs -> room-tools.js
    |                                      |
Runs: scripts/compute-state            calls: bin/lib/room-ops.js
    |                                      |
Claude interprets STATE output         Returns: {sections: [...], state: {...}}
    |                                      |
Larry-voice conversational response    Claude on Desktop formats for user
```

**Both paths call the same underlying logic.** The CLI path goes through bash script wrapping; the MCP path calls the Node.js module directly.

### Remote Room Access Flow (Future)

```
Remote Team Member (Cowork)
    |
Claude calls MCP tool: room_read_section("market-analysis")
    |
Remote Room MCP Server (Streamable HTTP transport)
    |
Server at {room-host}/mcp reads room/ on host machine
    |
Returns section contents as MCP resource
    |
Claude presents to remote user

Sync model: Git-based
    |
room/ IS a git repo (or subdirectory of one)
    |
git push/pull for sync between team members
    |
MCP server reads from the git-managed room/
    |
Conflicts resolved by: last-write-wins for STATE.md, merge for artifacts
```

**Remote Room is Phase 2 territory.** For v3.0, focus on local MCP server. Remote access adds network transport, authentication, and conflict resolution -- each of which is a significant complexity layer.

## Integration Points

### Where New Features Touch Existing Code

| New Feature | Existing Files Modified | New Files Created |
|-------------|------------------------|-------------------|
| MCP Server | None (additive) | `mcp-server/*` (entire new directory) |
| mindrian-tools.cjs | `scripts/*` (call into tools.cjs for shared logic) | `bin/mindrian-tools.cjs`, `bin/lib/*` |
| Opportunity Bank | `scripts/compute-state` (add section), `scripts/analyze-room` (add section) | `commands/opportunities.md`, `agents/opportunity-scanner.md`, `references/opportunities/*` |
| Funding Room | `scripts/compute-state` (add section), `scripts/analyze-room` (add section) | `commands/funding.md`, `references/funding/*` |
| AI Personas | `skills/room-proactive/SKILL.md` (add persona triggers) | `commands/persona.md`, `references/personas/*`, `bin/lib/persona-ops.js` |
| Room section extensibility | `scripts/compute-state` (dynamic section discovery), `scripts/analyze-room` (dynamic section discovery) | None (refactor existing) |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Brain MCP (brain.mindrian.ai) | MCP client in shared core, optional enrichment | Already integrated; mindrian-tools.cjs wraps client calls |
| Neo4j Aura (user's) | LazyGraph via Cypher queries in build-graph | Existing; no changes for v3.0 |
| Velma (transcription) | HTTP API called from transcribe-audio script | Existing; wrap in meeting-ops.js for MCP access |
| Read AI / Vexa / Recall.ai | MCP servers configured by user | Existing; MCP server can chain to these |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CLI commands <-> scripts | Bash execution via `scripts/*` | Unchanged; commands tell Claude to run scripts |
| MCP tools <-> shared core | Direct Node.js require() | New; MCP tool handlers import bin/lib modules |
| Scripts <-> shared core | `node bin/mindrian-tools.cjs <cmd>` via exec | New; scripts call tools.cjs for complex operations |
| Hooks <-> scripts | hooks.json -> run-hook.cmd -> scripts/ | Unchanged; hooks must stay fast (< 3s) |
| Room sections <-> analyze-room | File system scanning | Modified; must handle dynamic sections |

## Anti-Patterns

### Anti-Pattern 1: Separate Repo for MCP Server

**What people do:** Put the MCP server in a different repository from the plugin.
**Why it is wrong:** The MCP server needs direct filesystem access to `room/`, `references/`, `bin/lib/`, and `scripts/`. A separate repo means either duplicating these or creating fragile symlinks. Version drift between plugin and MCP server becomes inevitable.
**Do this instead:** Keep `mcp-server/` as a directory within the plugin repo. It shares the same version, same references, same room access. One repo, one version, two delivery surfaces.

### Anti-Pattern 2: Rewriting Bash Scripts in Node.js

**What people do:** Replace all bash scripts with Node.js equivalents to "unify the stack."
**Why it is wrong:** Hook scripts (session-start, compute-state, analyze-room) must complete in under 2-3 seconds. Node.js cold start adds 200-500ms. Bash is already fast and working. The existing 4,193 lines of bash are battle-tested.
**Do this instead:** Keep bash scripts as hook entry points and fast-path operations. Extract *shared logic* (the parts both CLI and MCP need) into Node.js modules. Let bash scripts call `node bin/mindrian-tools.cjs` when they need shared functionality.

### Anti-Pattern 3: Making MCP Tools Mirror CLI Commands 1:1

**What people do:** Create one MCP tool per CLI command (e.g., `file_meeting` tool that replicates the entire 200-line `file-meeting.md` pipeline).
**Why it is wrong:** CLI commands are conversational pipelines -- Claude reads instructions and exercises judgment through multiple steps. MCP tools are atomic function calls. A monolithic `file_meeting` tool cannot handle the interactive speaker identification, segment classification, and routing decisions that the CLI command handles conversationally.
**Do this instead:** Decompose CLI pipelines into atomic MCP tools. `file-meeting.md` (one CLI command) becomes 4-5 MCP tools that Claude on Desktop orchestrates in sequence, with conversation between each step.

### Anti-Pattern 4: Building Remote Room Before Local MCP Works

**What people do:** Jump to network-accessible room collaboration immediately.
**Why it is wrong:** Remote room adds authentication, conflict resolution, transport security, and real-time sync -- each a significant system. If local MCP does not work reliably first, debugging is impossible because you cannot isolate whether issues are in the MCP layer or the network layer.
**Do this instead:** Phase 1 = local MCP server (stdio, same machine). Phase 2 = remote room (Streamable HTTP, git sync). Validate the shared core works locally before adding network complexity.

### Anti-Pattern 5: AI Personas as Independent Agents

**What people do:** Give each AI persona its own agent file with autonomous behavior.
**Why it is wrong:** Agents in the plugin system spawn sub-contexts with their own instruction sets. 6 personas = 6 sub-agents = 6x context cost. Personas are lightweight viewpoints, not heavyweight autonomous actors.
**Do this instead:** Personas are skill context files. Larry loads the relevant persona's PERSONA.md when the topic matches, adopting that perspective temporarily. One agent (Larry), multiple lenses.

## Suggested Build Order

Based on dependency analysis:

### Phase 10: Shared Core + CLI Tools Layer
**Dependencies:** None (builds on existing scripts)
**Delivers:** `bin/mindrian-tools.cjs` with `room-ops`, `state-ops`, `graph-ops`
**Rationale:** This is the foundation everything else depends on. Extract existing script logic into callable Node.js modules. Validate by having existing bash scripts call into tools.cjs for complex operations. Nothing else can ship without this.

### Phase 11: MCP Server (Local, stdio)
**Dependencies:** Phase 10 (shared core)
**Delivers:** `mcp-server/server.cjs` with room, state, meeting, and methodology tools
**Rationale:** The MCP server IS the reason for v3.0. Desktop and Cowork users are blocked without it. Uses shared core modules directly. Start with read-only tools (room_overview, room_section, state_get) then add write tools (file_meeting steps, add_entry).

### Phase 12: New Room Sections (Opportunity Bank + Funding)
**Dependencies:** Phase 10 (compute-state/analyze-room extensibility)
**Delivers:** `opportunity-bank/` and `funding/` room sections, new commands, new agent
**Rationale:** These are new room sections following established patterns. The main risk is updating compute-state and analyze-room to handle dynamic sections -- which Phase 10's refactoring prepares for. Can be built in parallel with Phase 11 if compute-state extensibility lands in Phase 10.

### Phase 13: AI Team Member Personas
**Dependencies:** Phase 10 (persona-ops), Phase 12 (richer room intelligence)
**Delivers:** Persona generation from room intelligence, Larry persona-lens behavior
**Rationale:** Personas need a well-populated room to be useful. Building this last means rooms will have opportunity-bank and funding data to generate richer personas. The persona skill extends Larry rather than creating new agents.

### Phase 14: Remote Room Access
**Dependencies:** Phase 11 (MCP server working locally), git-managed room/
**Delivers:** Streamable HTTP MCP transport, git-based room sync, team access
**Rationale:** This is the most complex feature (network, auth, conflicts). It MUST come after local MCP is validated. May be deferred to v3.1 if v3.0 timeline is tight.

```
Phase 10 (Shared Core)
    |----> Phase 11 (MCP Server)  ----> Phase 14 (Remote Room)
    |----> Phase 12 (New Sections) ----> Phase 13 (Personas)
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user, 1 room | Current architecture. MCP server local stdio. Everything works. |
| 1 team, 1 shared room | Git-based sync via Remote Room MCP. Conflict resolution needed for STATE.md. Artifacts merge cleanly (append-only). |
| Multiple teams, multiple rooms | MCP server per room. `MINDRIAN_ROOM` env var switches context. No architectural changes needed -- just multiple server instances. |
| 100+ concurrent Cowork users | Beyond v3.0 scope. Would need: server-side room with database backing, WebSocket sync, operational transforms for concurrent edits. Not on roadmap. |

### Scaling Priority: First Bottleneck

The first thing that breaks at team scale is **STATE.md conflicts**. Two people filing artifacts simultaneously both update STATE.md. Git merge will conflict because STATE.md is a computed aggregate, not append-only.

**Mitigation:** STATE.md is always recomputable from `compute-state`. On conflict, throw away both versions and recompute. This is safe because STATE.md is derived data, not source data.

## Sources

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- Official SDK, v2 expected Q1 2026
- [MCP Server Build Guide](https://modelcontextprotocol.io/docs/develop/build-server) -- Official implementation patterns
- [Claude Desktop MCP Config](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) -- claude_desktop_config.json setup
- [MCP SDK on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- @modelcontextprotocol/sdk package
- Existing codebase: `scripts/*` (20 bash scripts, 4,193 total lines), `commands/*` (41 markdown commands), `bin/` pattern from `~/.claude/get-shit-done/bin/gsd-tools.cjs`
- Simon (1962), ICM paper (2603.16021v2), GSD state management patterns -- all documented in CLAUDE.md

---
*Architecture research for: MindrianOS v3.0 MCP Platform & Intelligence Expansion*
*Researched: 2026-03-24*
