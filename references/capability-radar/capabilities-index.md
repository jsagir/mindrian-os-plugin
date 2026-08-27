# Claude Capabilities Index for MindrianOS

Last updated: 2026-08-27 (Phase 265 correction pass). `data/capability-ledger.json` is now
the machine-readable source of record for tracked Claude Code capabilities; this file is
curated human prose over it, not a duplicate of its rows.

This reference is curated. Run `/mos:radar --fetch` to check the Claude Code changelog for
recent additions - Step 3b of `commands/radar.md` writes the ledger first, this file gets
updated by hand when a ledger row is promoted to curated prose. `SEED-003-claude-code-2-1-x-
capability-adoption.md` is superseded by Phase 265; see the ledger for current tracking.

---

## models

### Opus 5 (current top-tier model)
- **What:** The current top-tier model. `lib/core/model-profiles.cjs` maps agent types to the
  bare alias `opus`, `sonnet`, or `haiku` - the alias resolves at the host to whatever model
  is currently the top of that family, so a new model generation needs no config change here.
  The `/effort` slider's maximum-reasoning xhigh tier (introduced alongside Opus 4.7, Claude
  Code 2.1.111) is still available and still overkill for most plans, but worth it for
  load-bearing migration phases.
- **MindrianOS relevance:** No config key naming a fixed executor model exists anywhere in this
  repo (that claim in an earlier version of this doc was wrong). The two real model-config
  surfaces are
  `lib/core/model-profiles.cjs` (agent types -> bare aliases) and `.planning/config.json`
  (GSD only), both alias-based.
- **Status:** available
- **Since:** current generation; historical predecessor was Opus 4.7 (Claude Code 2.1.111)

### Opus (extended context, historical baseline: Opus 4.6)
- **What:** Extended thinking, adaptive reasoning, 128K max output tokens, 1M context window.
  Opus 4.6 was the generation that first shipped this combination; the `opus` alias now
  resolves to the current top-tier generation automatically, so this entry documents the
  capability's history rather than asserting Opus 4.6 is current.
- **MindrianOS relevance:** Methodology sessions can go deeper with full reference loading viable. Complex pipelines (Discovery, Thesis) can hold complete Room state in context without compression.
- **Status:** capability persists across generations via alias resolution
- **Since:** 2026 Q1 (Opus 4.6 introduced it)

### Sonnet (balanced default, historical baseline: Sonnet 4.6)
- **What:** Balanced speed and intelligence. 200K default context, extendable to 1M. Sonnet 4.6
  was the generation current when this entry was first written; the `sonnet` alias resolves to
  the current generation automatically, so this entry documents the capability's history rather
  than asserting Sonnet 4.6 is current.
- **MindrianOS relevance:** Default model for most users. Context compression and selective reference loading are critical. Room intelligence pipeline must stay within budget.
- **Status:** capability persists across generations via alias resolution
- **Since:** 2026 Q1 (Sonnet 4.6 introduced it)

### Haiku 4.5
- **What:** Fast, cost-efficient model for background and lightweight tasks
- **MindrianOS relevance:** Potential for non-blocking Room analysis, quick classification tasks, and high-volume insight filing where speed matters more than depth.
- **Status:** available
- **Since:** 2025 Q4

---

## code

### Statusline API
- **What:** Real-time display of context window usage, model info, and cost data in the CLI status bar
- **MindrianOS relevance:** Powers the context-monitor bridge. Lets users see how much context their Room and methodology sessions consume in real time.
- **Status:** available
- **Since:** 2025 Q4

### Hooks (SessionStart, Stop, PostToolUse)
- **What:** Event-driven plugin behavior triggered at session lifecycle points and after tool usage
- **MindrianOS relevance:** Core of the intelligence pipeline. SessionStart loads Room state and proactive findings. PostToolUse triggers passive insight filing. SessionStop handles cleanup.
- **Status:** available
- **Since:** 2025 Q3

### Hooks Can Invoke MCP Tools Natively (`type: "mcp_tool"`)
- **What:** Hook entries can declare `type: "mcp_tool"` and call any registered MCP tool directly, without spawning a Node child process
- **MindrianOS relevance:** Removes the `lib/core/brain-client.cjs` proxy layer. Eliminates a class of "hook timed out at 2000ms" failures. Direct moat deepening per the MWP mandate. Tracked as adoption candidate A2 in SEED-003.
- **Status:** available
- **Since:** Claude Code 2.1.118

### PostToolUse `updatedToolOutput` (Tool-Output Rewrite)
- **What:** PostToolUse hooks can rewrite a tool's output via `hookSpecificOutput.updatedToolOutput` before the model sees it
- **MindrianOS relevance:** Structural enforcement of Canon Part 8. Sanitize Brain MCP responses to redact accidental user-data echo at runtime. Closes the gap noted in CANON-PHASE-MAP.md (Part 8 row, "PR gate pending"). Tracked as adoption candidate A3 in SEED-003.
- **Status:** available
- **Since:** Claude Code 2.1.121

### `/usage` (replaces `/cost` + `/stats`)
- **What:** Unified usage/cost reporting command; replaces the two prior commands
- **MindrianOS relevance:** Statusline `📊` token-budget glyph (Phase 106-02) should track the new command's output schema. Single-line update.
- **Status:** available
- **Since:** Claude Code 2.1.118

### `/skills` Type-to-Filter
- **What:** Skills picker now has a type-to-filter search box
- **MindrianOS relevance:** Improves discoverability of MindrianOS's 30+ skills. No code change required on the plugin side.
- **Status:** available
- **Since:** Claude Code 2.1.121

### `/ultrareview` Built-in
- **What:** Built-in parallel code-review command (also available as non-interactive `claude ultrareview [target]`)
- **MindrianOS relevance:** May overlap with MindrianOS's own `/ultrareview`. Verify; if Anthropic's built-in is sufficient, delegate to it and remove the MindrianOS duplication.
- **Status:** available
- **Since:** Claude Code 2.1.111

### `${CLAUDE_EFFORT}` in Skills
- **What:** Skills can read `${CLAUDE_EFFORT}` to calibrate verbosity/depth based on the user's current `/effort` setting
- **MindrianOS relevance:** Larry skills (larry-personality, larry-extended) can match teaching depth to user effort. xhigh effort = deeper Feynman decomposition; low effort = terse navigation.
- **Status:** available
- **Since:** Claude Code 2.1.120

### `claude project purge`
- **What:** Subcommand to delete all Claude Code state at a path with `--dry-run`, `-y`, `-i`, `--all` flags
- **MindrianOS relevance:** Clean-slate command for testers when an install goes sideways. Mention in tester onboarding docs.
- **Status:** available
- **Since:** Claude Code 2.1.126

### Background Tasks (run_in_background)
- **What:** Async command execution that runs without blocking the main conversation
- **MindrianOS relevance:** Potential for non-blocking Room analysis, export generation, and Brain queries that don't interrupt the user's flow.
- **Status:** available
- **Since:** 2025 Q4

### Max Output Tokens (128K for Opus)
- **What:** Opus can generate up to 128K tokens in a single response
- **MindrianOS relevance:** Export and document generation quality. Full thesis documents, comprehensive Room exports, and detailed grading reports can be generated in one pass.
- **Status:** available
- **Since:** 2026 Q1

---

## desktop_cowork

### Cowork
- **What:** Multi-user persistent agents with shared 00_Context/ state directory
- **MindrianOS relevance:** Team venture collaboration. Multiple users can work on the same venture with shared Room state, concurrent methodology sessions, and unified Data Room.
- **Status:** available
- **Since:** 2025 Q4

### Desktop
- **What:** Conversational interface with MCP server support and visual interaction
- **MindrianOS relevance:** Larry personality shines here. Users interact naturally without commands. MCP Brain connection works seamlessly. One of the three surfaces MindrianOS must support.
- **Status:** available
- **Since:** 2025 Q3

### Agent Teams
- **What:** Experimental multi-agent coordination for complex tasks
- **MindrianOS relevance:** Potential for specialized agent collaboration. Research Agent + Investor Agent could run adversarial analysis in parallel. Pipeline stages could delegate to focused agents.
- **Status:** experimental
- **Since:** 2026 Q1

### Fork Mode Defaults (`CLAUDE_CODE_FORK_SUBAGENT`)
- **What:** Fork mode runs subagents concurrently. As of Claude Code 2.1.232, fork mode is ON
  BY DEFAULT in every interactive session. The `CLAUDE_CODE_FORK_SUBAGENT` environment variable
  still exists, but its polarity inverted: it is now the opt-OUT, not an opt-in. `=0` turns fork
  mode off in every kind of session; `=1` turns fork mode on in non-interactive mode and the
  Agent SDK only. A reader who sets `=1` in an interactive session today is not opting into
  anything - fork mode is already on for them. Source: code.claude.com/docs/en/sub-agents.
- **MindrianOS relevance:** Substrate for Canon Part 2 Engine 2 (BONO Orchestration) - spawning
  hat-instantiated team members in parallel. Superseded SEED-003 A4; see
  `data/capability-ledger.json` (capability `run_in_background-removal-fork-mode-default-on`)
  and Phase 265 (capability-radar-absorption-routing) for the corrected destination mapping.
- **Status:** available (default on, interactive sessions; opt-out via `=0`)
- **Since:** Claude Code 2.1.232 (the polarity inversion); the variable itself existed since 2.1.117

### Agent Frontmatter `mcpServers` Declaration
- **What:** Individual agent files can declare required MCP servers in frontmatter; loaded for main-thread sessions via `--agent`
- **MindrianOS relevance:** Per-agent Brain MCP scoping. `mos-research` can require Brain without polluting global config; `mos-investor` (synthesis hat) can opt out. See `data/capability-ledger.json` and Phase 265 for current tracking; SEED-003 is superseded.
- **Status:** available
- **Since:** Claude Code 2.1.117

### Push Notification Tool for Remote Control
- **What:** Built-in tool for asynchronously notifying the user (push notification surface)
- **MindrianOS relevance:** Larry can ping the user when Brain finishes an enrichment cycle, when a proactive scan finds a contradiction, or when a long-running methodology completes. Today these only surface if the user is actively in the session.
- **Status:** available
- **Since:** Claude Code 2.1.110

### `/focus` View
- **What:** Toggleable focus view in the TUI
- **MindrianOS relevance:** Aligns with Canon's focus-node concept (Phase 109 D-01). Statusline `🎯` glyph should coordinate with `/focus` state - when user is in focus view, render the focus node prominently.
- **Status:** available
- **Since:** Claude Code 2.1.110

---

## plugins_mcp

### Plugin Marketplace
- **What:** Git-based plugin distribution with auto-updates and version management
- **MindrianOS relevance:** Primary distribution channel. Users install MindrianOS with one command. Auto-updates keep methodology content current.
- **Status:** available
- **Since:** 2025 Q4

### `--plugin-dir` Accepts `.zip` Archives
- **What:** `claude --plugin-dir <path>` now accepts a `.zip` archive in addition to a directory
- **MindrianOS relevance:** Beta-tester distribution side-channel. Today: marketplace tag is the only sanctioned path; beta gating requires marketplace.json to advertise the version. Zip channel decouples - hand a tester a single `.zip` without touching marketplace state. Tracked as adoption candidate A5 in SEED-003.
- **Status:** available
- **Since:** Claude Code 2.1.128

### `claude plugin validate` (Expanded Manifest)
- **What:** Plugin validation command accepts a wider set of manifest fields
- **MindrianOS relevance:** `plugin.json` can declare more metadata that the marketplace honors. Audit current manifest against new accepted fields when planning v1.13.0.
- **Status:** available
- **Since:** Claude Code 2.1.120

### Plugin Dependency Auto-Resolution
- **What:** Plugin dependencies are auto-resolved from configured marketplaces
- **MindrianOS relevance:** Simplifies coupling between MindrianOS and Brain MCP if Brain ever ships as a separate marketplace plugin (currently bundled).
- **Status:** available
- **Since:** Claude Code 2.1.117

### MCP Tool Search
- **What:** Auto-discovers available MCP tools at 10% context threshold
- **MindrianOS relevance:** Brain MCP discovery. When Brain is connected, Claude automatically finds Neo4j query tools without explicit configuration.
- **Status:** available
- **Since:** 2025 Q4

### MCP `alwaysLoad` Server Config
- **What:** `alwaysLoad: true` in `.mcp.json` skips tool-search deferral and surfaces server tools from turn 1
- **MindrianOS relevance:** **Eliminates Brain MCP cold-start window.** Today Larry's first session response is "Brain-blind" until the 10% discovery threshold fires. With `alwaysLoad`, Mode A (Full Loop) per Canon Part 3 starts at turn 1. Single biggest leverage adoption per SEED-003 A1.
- **Status:** available
- **Since:** Claude Code 2.1.121

### MCP Auto-Retry on Transient Startup Errors
- **What:** MCP servers auto-retry transient startup errors up to 3 times
- **MindrianOS relevance:** Brain MCP reliability improvement. Reduces "Brain unavailable" Tier 0 fallbacks caused by network blips during boot.
- **Status:** available
- **Since:** Claude Code 2.1.121

### Concurrent MCP Server Connections (Default)
- **What:** Multiple MCP servers connect concurrently at startup instead of serially
- **MindrianOS relevance:** Faster session start when MindrianOS users have Brain + other MCP servers configured (Notion, Gmail, etc.). Net positive for plugin UX.
- **Status:** available
- **Since:** Claude Code 2.1.117

### `/mcp` Tool Count + Zero-Tool Flagging
- **What:** `/mcp` command shows the tool count for connected servers and flags servers that connected with 0 tools
- **MindrianOS relevance:** Direct diagnostic for Brain MCP failure modes. When a tester says "Brain isn't responding," step 1 becomes `/mcp` - if Brain shows 0 tools, the failure mode is now visible. Candidate for `/mos:doctor --brain` integration.
- **Status:** available
- **Since:** Claude Code 2.1.128

### Plugin Hooks
- **What:** SessionStart, SessionStop, and PostToolUse events available to plugins
- **MindrianOS relevance:** Intelligence pipeline foundation. Every hook fires plugin scripts that maintain Room state, file insights, and surface proactive findings.
- **Status:** available
- **Since:** 2025 Q3

### Statusline in Plugins
- **What:** Plugins can declare custom statusline scripts for persistent display
- **MindrianOS relevance:** Context-monitor displays real-time Room health and context budget consumption directly in the CLI status bar.
- **Status:** available
- **Since:** 2025 Q4

---

## visualization

### Mermaid Rendering
- **What:** Built-in Mermaid diagram support for flowcharts, graphs, and sequences
- **MindrianOS relevance:** Data Room relationship visualization. Knowledge graphs, pipeline flows, and venture stage maps rendered inline.
- **Status:** available
- **Since:** 2025 Q3

### SVG Generation
- **What:** Direct SVG output for vector graphics
- **MindrianOS relevance:** De Stijl visual assets. Room dashboard graphics, profile documents, and export visuals use SVG for clean rendering.
- **Status:** available
- **Since:** 2025 Q3

### HTML Artifact Rendering
- **What:** Browser-based rich output via localhost serving
- **MindrianOS relevance:** Data Room dashboard. The De Stijl-styled interactive viewer with knowledge graph, chat panel, and methodology output display.
- **Status:** available
- **Since:** 2025 Q4
