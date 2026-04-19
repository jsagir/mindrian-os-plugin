---
type: distribution-strategy
status: concept
source: Session 2026-04-16 discussion (Jonathan + Larry)
extends: byo-api-and-surfaces.md
---

# Goose (Block) as Distribution Surface

## Why Goose

Goose is Block's open-source AI agent framework with MCP-first architecture. MindrianOS's v3.0 MCP server (already spec'd at docs/v3-mcp-platform) plugs into Goose directly as an extension. Zero architecture changes to the MCP layer. Goose provides the visual conversation UI that MindrianOS lacks. MindrianOS provides the methodology intelligence that Goose lacks. Complementary, not competing.

ACP (Agent Communication Protocol) enables Goose to use Claude Code as a sub-provider, meaning the full MindrianOS plugin capability (hooks, scripts, file I/O) remains accessible even when the primary interface is Goose.

## Architecture

```
Goose Desktop (open source UI shell)
  │
  ├── MindrianOS MCP Server (methodology + rooms + Brain)
  │   ├── tools: room_status, file_artifact, run_methodology, query_brain
  │   ├── resources: room state, graph edges, intelligence alerts
  │   └── prompts: Larry personality, methodology frameworks
  │
  ├── Claude Code via ACP (sub-provider for heavy lifting)
  │   └── hooks, scripts, file I/O, plugin commands
  │
  └── Other MCP servers (Notion, Supabase, GitHub, etc.)
```

## What MindrianOS provides as a Goose extension

| MCP Tool | What it does |
|----------|-------------|
| room_status | Returns active room state, sections, entries, intelligence |
| file_artifact | Files a new artifact into the correct section |
| run_methodology | Executes /mos:* commands (JTBD, lean-canvas, etc.) |
| query_brain | Natural language query against 21K-node Brain graph |
| query_room | Natural language query against room.db LazyGraph |
| build_thesis | Runs the full GO/NO-GO investment thesis analysis |
| export_deck | Generates MOSDeckEngine presentation |
| file_meeting | Files and analyzes a meeting transcript |

These are the SAME tools the v3.0 MCP server already exposes. Goose just becomes another consumer alongside Claude Desktop and Cowork.

## Distribution advantage

1. Goose community gets MindrianOS as a one-click extension install
2. MindrianOS reaches users who prefer Goose's visual UI over Claude Code's terminal
3. Both products benefit: Goose gets a killer methodology extension, MindrianOS gets a visual shell without building one
4. The BSL license allows free use as an installed extension (expressly permitted in the Additional Use Grant)

## Relationship to the localhost API (Phase 86)

The Goose extension and the localhost API are not competing paths. They compose:

- Localhost API serves the De Stijl dashboard to browser tabs
- Goose extension serves MindrianOS tools to the Goose conversation UI
- Both read from the same room filesystem and room.db
- Both call the same Brain MCP for enrichment
- A user could run both simultaneously: Goose for conversation, browser for visualization

## Phase mapping

| Phase | Surface | Architecture |
|-------|---------|-------------|
| 86 | Browser (localhost dashboard) | Node HTTP server inside plugin |
| 87 | Operational buttons + BYO API | localhost API extends to chat + commands |
| 88 | Chrome extension | Reads from localhost API |
| 89 | Discord bot | Reads from localhost API |
| 90 | Goose extension | MCP server (already spec'd in v3.0) |

Phase 90 is the LOWEST cost phase because the MCP server is already designed. The only work is Goose-specific packaging (extension manifest, icon, description, install instructions).

## Risk

Goose is early-stage and community-driven. If Block deprioritizes it or the community fragments, the MCP server still works with Claude Desktop, Cowork, and every other MCP host. No lock-in in either direction.

## Cross-references

- [[solution-design/ui-ux-pathways/byo-api-and-surfaces]] -- the API surface Goose calls
- [[solution-design/ui-ux-pathways/architecture-vision]] -- the bidirectional architecture
- docs/v3-mcp-platform (in MindrianOS-Plugin repo) -- the MCP server spec
- [[mindrian-gtm/gtm-strategy/bsl-1.1-ip-protection]] -- BSL expressly permits extension use
