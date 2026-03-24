# Claude Capabilities Index for MindrianOS

Last updated: 2026-03-22

This reference is curated. Run `/mos:radar --fetch` to check the Claude Code changelog for recent additions.

---

## models

### Opus 4.6 (1M Context)
- **What:** Extended thinking, adaptive reasoning, 128K max output tokens, 1M context window
- **MindrianOS relevance:** Methodology sessions can go deeper with full reference loading viable. Complex pipelines (Discovery, Thesis) can hold complete Room state in context without compression.
- **Status:** available
- **Since:** 2026 Q1

### Sonnet 4.6 (200K/1M)
- **What:** Balanced speed and intelligence. 200K default context, extendable to 1M.
- **MindrianOS relevance:** Default model for most users. Context compression and selective reference loading are critical. Room intelligence pipeline must stay within budget.
- **Status:** available
- **Since:** 2026 Q1

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

---

## plugins_mcp

### Plugin Marketplace
- **What:** Git-based plugin distribution with auto-updates and version management
- **MindrianOS relevance:** Primary distribution channel. Users install MindrianOS with one command. Auto-updates keep methodology content current.
- **Status:** available
- **Since:** 2025 Q4

### MCP Tool Search
- **What:** Auto-discovers available MCP tools at 10% context threshold
- **MindrianOS relevance:** Brain MCP discovery. When Brain is connected, Claude automatically finds Neo4j query tools without explicit configuration.
- **Status:** available
- **Since:** 2025 Q4

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
