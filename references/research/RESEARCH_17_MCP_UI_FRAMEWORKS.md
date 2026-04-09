# RESEARCH_17: MCP UI Frameworks -- Solving the Filesystem Invisibility Problem

**Date:** 2026-04-06
**Source:** Community research, MCP Apps spec, open-source ecosystem scan
**Purpose:** Map available UI frameworks to MindrianOS UX friction points identified in RESEARCH_16 and the 2026-04-05 Lawrence/Leah user session
**Depends on:** RESEARCH_16 (Native-First Architecture), user-research/2026-04-05-leah-lawrence-session.md

---

## 1. The Problem This Solves

User session finding (2026-04-05):
> "I was stressing me out, the file structure, because I didn't understand it." -- Lawrence Aronhime

Design principle from session analysis:
> "The folder structure must be invisible to the user while remaining the source of truth for the system."

Current MindrianOS exports (dashboard, wiki, deck, graph) are generated as static HTML files that open in a browser. They work but require:
1. User to know the `/mos:export` or `/mos:visualize` command exists
2. A separate browser window
3. No interactivity (static snapshots)
4. No inline chat integration

MCP Apps solve this by rendering interactive UI INSIDE the chat interface -- Claude Desktop, Cowork, or any MCP-compatible client.

---

## 2. Available Frameworks

### Tier 1: Core Standards

#### `@modelcontextprotocol/ext-apps` -- Official SDK
- **Source:** github.com/modelcontextprotocol/ext-apps
- **What it does:** Official Anthropic/MCP team SDK. Provides `registerAppTool`, `registerAppResource`, `useApp`/`useWidget` React hooks.
- **Working examples:** pdf-server, system-monitor-server, map-server, shader-toy
- **Transport:** Renders as iframes in Claude Desktop/Cowork chat
- **Why it matters:** This is THE official path. Building on this guarantees compatibility with Claude's roadmap.

#### `mcp-ui` -- Community Standard
- **Source:** github.com/MCP-UI-Org/mcp-ui | mcpui.dev
- **What it does:** Community project that PRECEDED and directly influenced the official spec.
  - `@mcp-ui/server` -- `createUIResource()` helper to register UI bundles
  - `@mcp-ui/client` -- `AppRenderer`/`UIResourceRenderer` React components
- **Relationship:** Designed to work alongside `@modelcontextprotocol/ext-apps`
- **Why it matters:** Community battle-tested patterns. Higher-level abstractions than the official SDK.

### Tier 2: Accelerators

#### `mcp-generative-ui` -- Auto-UI Wrapper
- **Source:** github.com/vivekhaldar/mcp-generative-ui
- **What it does:** Wraps ANY existing plain MCP server and automatically generates interactive UIs for tool results. Turns raw JSON into charts, tables, visual components.
- **Key insight:** No manual UI coding needed. Could wrap MindrianOS MCP server immediately.
- **Why it matters for MindrianOS:** Our MCP server already returns structured JSON (room state, section entries, grant results). This could generate visual cards from existing output WITHOUT rewriting the MCP server.

#### Flowbite MCP UI Starter
- **Source:** github.com/themesberg/mcp-ui-starter
- **What it does:** Production-ready React + Tailwind starter with pre-built widgets (charts, tables, forms). Supports Claude, ChatGPT, and Gemini.
- **Why it matters:** Fastest path to a polished widget library. De Stijl design tokens could be applied on top of Tailwind.

### Tier 3: Reference Implementations

#### MCP Memory Service React Dashboard
- **Source:** github.com/doobidoo/mcp-memory-service
- **What it does:** Working example of React + shadcn/ui + Tailwind dashboard wired to MCP via `window.mcpTools`. Stats cards, tabs, debounced queries, TypeScript types.
- **Why it matters:** Closest architectural pattern to what MindrianOS needs (dashboard with sections, entry counts, intelligence signals).

#### MCP Manager
- **Source:** github.com/marcusglee11/mcp-manager
- **What it does:** Full-stack: React frontend + FastAPI REST API + Python CLI. Manages MCP server installations, health monitoring, real-time status.
- **Why it matters:** Shows the local web server pattern for complex admin UIs.

#### Dynamic MCP UI Generator (POC)
- **Source:** github.com/iamadi11/mcp-ui-poc
- **What it does:** POC with React + Vite client + Express + MCP server. Dynamic form builder, dashboard creation, chart generation.
- **Why it matters:** Shows the full client/server split architecture.

### Tier 4: Plugin Infrastructure

#### Claude Code Plugin Template
- **Source:** github.com/ivan-magda/claude-code-plugin-template
- **What it does:** GitHub template with plugin.json, hooks, skills, agents, slash commands, CI/CD.
- **Relevance:** Reference for plugin structure, not UI.

#### Desktop Extensions (.mcpb)
- **Source:** anthropic.com/engineering/desktop-extensions
- **What it does:** One-click install packages with manifest.json for Claude Desktop.
- **Why it matters:** Distribution format for MindrianOS Desktop version.

---

## 3. Mapping UI to MindrianOS UX Problems

### Problem -> Solution Matrix

| User Session Problem | Current Solution | MCP UI Solution | Framework |
|---|---|---|---|
| "I don't know where my rooms are" | User navigates Finder, finds room/ folder | **Project Selector Widget** -- inline card showing all rooms with switch button | ext-apps + mcp-ui |
| "What are these slash commands?" | User reads /mos:help output, copy-pastes | **Action Cards** -- clickable buttons rendered in chat: "Build Business Model", "Grade Your Progress" | ext-apps registerAppTool |
| "How much longer?" (chain running) | No progress indicator | **Progress Widget** -- inline progress bar: "Step 3/6: Research | ~4 min remaining" | mcp-ui createUIResource |
| "When I see 89%, what do I do?" | Skull icon in status bar | **Context Health Widget** -- visual meter with plain language: "Your session is 89% full. I'll summarize and keep working." | ext-apps useWidget |
| "The tabs don't display properly" (export) | Static HTML snapshot with broken tabs | **Interactive Dashboard Widget** -- live room dashboard rendered inline with working tabs | mcp-ui AppRenderer |
| "I was stressing about file structure" | Larry explains room/ directories | **Project Overview Card** -- visual card: "Blueprint Phase: 7 entries across 5 areas. Biggest gap: Business Model" | mcp-generative-ui (auto from existing JSON) |
| "Every time I have to ask how to start" | User types `claude` in terminal | **Desktop Extension** -- one-click app icon, no terminal needed | .mcpb Desktop Extension |
| Filing confirmation unclear | "artifact filed to room/market-analysis/" | **Filing Card** -- visual card: "Saved to Market Research [icon] | Your project now has 3 market analyses" | ext-apps |
| Grant discovery results | Text list of grants | **Grant Discovery Widget** -- table with relevance scores, deadlines, apply buttons | Flowbite MCP UI Starter |
| Chain modification mid-run | User types "add research to this chain" | **Chain Builder Widget** -- visual pipeline editor showing framework sequence with drag-reorder | ext-apps + custom |

### The Three Surfaces Revisited

| Surface | Current UI | With MCP Apps |
|---|---|---|
| **CLI** | Terminal text only. Slash commands. ASCII formatting. | Terminal text + **localhost dashboard** (existing pattern, enhanced) |
| **Desktop** | Conversational only. No visual widgets. | Conversational + **inline widgets** (project cards, progress bars, filing confirmations) |
| **Cowork** | Shared state via 00_Context/. Text only. | Shared state + **collaborative widgets** (team can see same project dashboard, grant table) |

---

## 4. Implementation Strategy

### Phase 1: Quick Win -- mcp-generative-ui Wrapper (1-2 days)

Wrap the existing MindrianOS MCP server with `mcp-generative-ui`. This auto-generates visual cards from our existing JSON output with ZERO changes to the MCP server.

**What changes:** Tool results that currently return text/JSON render as visual components.
**What doesn't change:** MCP server code, skill files, hook scripts.
**Risk:** Low. Wrapper sits between server and client. If it breaks, remove it.

**Immediate wins:**
- Room status becomes a visual dashboard card instead of ASCII art
- Grant results become a table with scores instead of text list
- Section entry counts become a visual bar chart

### Phase 2: Core Widgets -- ext-apps + mcp-ui (1-2 weeks)

Build 5 custom widgets using the official SDK:

1. **Project Selector** -- shows all rooms, switch with one click
2. **Progress Tracker** -- chain/swarm progress with time estimates
3. **Filing Confirmation** -- visual card when artifacts are saved
4. **Action Suggester** -- clickable methodology buttons instead of /mos: commands
5. **Context Health** -- visual meter replacing skull icon

**Architecture:**
```
mindrian-mcp-server.cjs (existing)
  ├── lib/mcp/tool-router.cjs (existing, unchanged)
  ├── lib/mcp/resources.cjs (existing, unchanged)
  ├── lib/mcp/prompts.cjs (existing, unchanged)
  └── lib/mcp/widgets/          (NEW)
      ├── project-selector.tsx
      ├── progress-tracker.tsx
      ├── filing-card.tsx
      ├── action-suggester.tsx
      └── context-health.tsx
```

**Key decision:** Widgets render in Desktop/Cowork via iframe. CLI users get the existing terminal output. Same MCP server, dual rendering.

### Phase 3: Interactive Dashboard -- Full React App (2-4 weeks)

Replace the static HTML snapshot with a live interactive dashboard:
- Built with React + shadcn/ui + Tailwind (following MCP Memory Service pattern)
- De Stijl design tokens applied via Tailwind config
- Connected to MCP server via `window.mcpTools` pattern
- Renders inline in Desktop/Cowork, localhost in CLI

**This replaces:**
- /mos:visualize (static HTML)
- /mos:export dashboard (static HTML)
- /mos:room (terminal output)
- The need for users to EVER open Finder

### Phase 4: Desktop Extension Package (1 week)

Package MindrianOS as a `.mcpb` Desktop Extension:
- One-click install from Anthropic marketplace
- No terminal, no `claude` command, no PATH issues
- User opens Claude Desktop, MindrianOS is there
- Leah's "every time I have to ask how to start" problem: gone

---

## 5. The Native-First + MCP UI Architecture

From RESEARCH_16:
> Skills should encode WHAT to think, not HOW to use tools.

From this research:
> UI should show WHAT the user has, not WHERE it's stored.

Combined principle:
> **Skills teach Larry domain knowledge. MCP Apps show users their project. The filesystem is invisible to both.**

### Token Impact

MCP App widgets are rendered CLIENT-SIDE. They don't consume context tokens. A project selector card costs 0 tokens to display -- it's an iframe rendered by Claude Desktop from the MCP resource.

This means the MCP UI approach is ADDITIVE to the Native-First token savings:
- Native-First saves ~10,000 tokens per turn (skill compression)
- MCP UI saves ~0 additional tokens (widgets are client-side)
- But MCP UI REMOVES the need for verbose text descriptions of room state

Currently, session-start injects ~1,750 tokens of room state as text. With an inline widget, that text could be replaced by a visual card + a 200-token summary. Potential additional savings: ~1,500 tokens per turn.

### The Full v1.8.0 Stack

```
Layer 0: Skills (Native-First, ~11K tokens)
  - Larry personality (WHAT to think)
  - Proactive patterns (WHAT to detect)  
  - Methodology routing (WHAT frameworks exist)
  
Layer 1: MCP Server (existing, enhanced)
  - 6 hierarchical router tools (existing)
  - Resources (existing)
  - Prompts (existing)
  - Widgets (NEW -- 5 core widgets)

Layer 2: MCP UI (NEW)
  - mcp-generative-ui wrapper (Phase 1)
  - Custom ext-apps widgets (Phase 2)
  - Interactive dashboard (Phase 3)
  - Desktop Extension package (Phase 4)

Layer 3: Filesystem (INVISIBLE to user)
  - room/ structure (unchanged)
  - STATE.md (unchanged)
  - Hooks pipeline (unchanged)
  - Everything works exactly as before
  - User never sees it
```

---

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| MCP Apps spec changes | MEDIUM | Build on official ext-apps SDK, not community forks |
| Desktop-only (CLI users get nothing) | HIGH | CLI keeps existing terminal output. Widgets are ADDITIVE for Desktop/Cowork. |
| Widget maintenance burden | MEDIUM | Start with mcp-generative-ui (zero custom code), graduate to custom only for high-value widgets |
| De Stijl branding in widgets | LOW | Tailwind config with De Stijl tokens. Same approach as existing dashboard. |
| TypeScript build step | MEDIUM | Widgets are separate from plugin core (markdown + CJS). Build step only for widgets. |

---

## 7. Quick Pick for MindrianOS

| Goal | Use This | Timeline |
|---|---|---|
| Immediate visual upgrade (no coding) | `mcp-generative-ui` wrapper | 1-2 days |
| Custom inline widgets for Desktop | `@modelcontextprotocol/ext-apps` | 1-2 weeks |
| Full interactive dashboard | React + shadcn/ui + Tailwind (MCP Memory Service pattern) | 2-4 weeks |
| One-click Desktop install | `.mcpb` Desktop Extension | 1 week |
| Production widget library (Tailwind) | Flowbite MCP UI Starter | Reference only |

---

## 8. Connection to Existing Research

- **RESEARCH_14** (Source Architecture): MCP Apps work within Claude's native tool system. `tengu_harbor` MCP allowlist must include widget servers.
- **RESEARCH_15** (JTBD Optimization): Student archetype benefits most from visual widgets (no terminal literacy required). Venturist benefits from grant table widget. Researcher benefits from cross-domain visualization.
- **RESEARCH_16** (Native-First): MCP UI is the visual complement to Native-First skills. Skills encode knowledge (tokens). Widgets encode presentation (zero tokens).
- **User Session** (2026-04-05): Every friction point has a widget solution. See Section 3 mapping.

---

*Cross-references:*
- *RESEARCH_14_CLAUDE_CODE_SOURCE_ARCHITECTURE.md*
- *RESEARCH_15_V1.8_OPTIMIZATION_JTBD.md*
- *RESEARCH_16_NATIVE_FIRST_PLUGIN_ARCHITECTURE.md*
- *references/user-research/2026-04-05-leah-lawrence-session.md*
