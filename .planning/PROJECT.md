# MindrianOS Plugin

## What This Is

A commercial Claude Code + Cowork plugin that delivers Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. Users install with one command and immediately get Larry (the AI teaching personality) plus a structured Data Room that passively captures insights and proactively surfaces gaps, contradictions, and convergence signals. The plugin leverages Claude's native capabilities while optionally connecting to the Brain (Neo4j knowledge graph with 21K+ nodes of teaching intelligence) for enriched guidance.

## Core Value

Users can run the full PWS methodology — 25 specialized methodology bots, structured pipelines, and an intelligent Data Room — inside Claude Code with zero infrastructure, where Larry guides them through venture innovation using the same teaching intelligence that powers the classroom experience.

## Current State

**Shipped:** v2.0 Meeting Intelligence (2026-03-24)
**Next:** v3.0 (planning)

v1.0 + v2.0 = 41 commands, 5 agents, meeting intelligence pipeline, team room, cross-meeting intelligence, three-layer knowledge graph, De Stijl dashboard + timeline mode, 5 PDF export types.

## v3.0 Backlog (Captured Ideas)

- Opportunity Bank (room section + proactive grant discovery agents)
- Funding Room (non-dilutive/dilutive/grants sub-rooms, GSD-style process per grant)
- AI Team Member Personas (domain experts generated from intelligence + Bono perspectives)
- Wiki-style Data Room Dashboard (hosted Render/Vercel, nodes = pages, edges = hyperlinks)
- Obsidian Plugin (room/ as Obsidian vault with graph view)
- Chrome Plugin (meeting join + room access)
- Room as Remote MCP (collaborative team access from local/remote)
- MindrianOS CLI tools layer (mindrian-tools.cjs like gsd-tools.cjs)
- Data Room level status bar (CLI nested room/section context)
- Cursor + Antigravity/Windsurf compatibility (ICM = universal interface)
- Risk vs Uncertainty blog post (adapted for MindrianOS)
- Site style guide + generated images per article

## Requirements

### Validated

v1.0 shipped (2026-03-22):
- ✓ One-command install, Larry active immediately (v1.0, Phase 1)
- ✓ 26 methodology commands + 5 Brain commands + 7 infrastructure commands (v1.0, Phases 2-4)
- ✓ Data Room with 8 sections, proactive intelligence, pipeline chaining (v1.0, Phases 2-3)
- ✓ De Stijl dashboard with knowledge graph + chat (v1.0, Phase 3.1)
- ✓ PDF export (thesis, summary, report, profile) (v1.0, Phase 3.2)
- ✓ Brain MCP integration with 4 agents (v1.0, Phase 4)
- ✓ Self-update, context awareness, capability radar (v1.0, Phase 5)
- ✓ Analytics + learning system (v0.2.0)
- ✓ Auto-update notification at SessionStart (v0.2.0)

v2.0 shipped (2026-03-24):
- ✓ Meeting filing pipeline with 3 input modes (paste/file/audio) + Velma transcription (v2.0, Phase 6)
- ✓ Speaker identification with 12 roles, ICM nested folder profiles, proactive web research (v2.0, Phase 6)
- ✓ Team room structure with dynamic folders, multiple roles, status lifecycle (v2.0, Phase 7)
- ✓ Full meeting archive packages (7 files per meeting + audio copy) (v2.0, Phase 7)
- ✓ Cross-meeting intelligence: convergence, contradictions, action items, team patterns (v2.0, Phase 8)
- ✓ Read AI / Vexa / Recall.ai MCP integration + --latest auto-fetch (v2.0, Phase 8)
- ✓ Three-layer knowledge graph with [[wikilinks]] and lazy graph pattern (v2.0, Phase 9)
- ✓ Dashboard timeline mode with layer toggles, preset views, edge animations (v2.0, Phase 9)
- ✓ Minto pyramid meeting-report PDF export with speaker attribution (v2.0, Phase 9)
- ✓ Simon's Architecture of Complexity as basis theorem (v2.0, architecture)

### Active

(Pending v3.0 requirements definition via `/gsd:new-milestone`)

### Out of Scope

- Full-stack web UI (V2 approach) — plugin replaces the need for Next.js/FastAPI/CopilotKit
- Mobile app — Claude surfaces handle this
- Real-time collaboration features — Cowork handles this natively
- Brain graph editing by users — users get intelligence, never see or modify the graph
- Custom LLM integration — Claude-native only
- Payment processing in plugin — handled externally via Anthropic marketplace / Stripe

## Context

**Source material ready to port:**
- MindrianV2: 25 methodology prompts (Python), Larry personality (8 .md files), mode engine, router, 18 skills
- MindrianOS: 16 Claude Desktop project specs with full methodology definitions, 5 design docs, grading rubrics
- Brain: Neo4j Aura with 21K nodes, 65K relationships, 1,427 Pinecone embeddings — deployed as MCP server at brain.mindrian.ai
- ICM paper (2603.16021v2): Interpretable Context Methodology — folder structure as orchestration
- GSD patterns from ~/.claude/get-shit-done/ for state management

**Architecture decisions:**
- ICM-native: no framework code, folder structure IS orchestration
- "Configure the factory, not the product" — Layer 3 (reference/factory) is the IP, Layer 4 (working artifacts) is user's work
- Every output is an edit surface; plain text as universal interface
- Fresh subagent contexts prevent context rot (GSD pattern)

**Distribution:**
- Anthropic marketplace — anyone with Claude can install
- Break-even on Brain tier: 5-17 subscribers at $9/month

## Constraints

- **Plugin format**: Must conform to Claude Code plugin structure (commands/, skills/, agents/, hooks/, .mcp.json, settings.json, plugin.json)
- **No server infrastructure**: Plugin runs entirely in Claude's environment — no backend services except optional Brain MCP
- **Brain IP protection**: The 21K-node teaching graph, grading intelligence, and mode engine calibration are proprietary — never distributed, only served via MCP
- **Neo4j Aura Free limits**: LazyGraph must work within 50K node limit
- **Three surfaces**: All features must work across CLI, Desktop, and Cowork without surface-specific code
- **Existing assets**: Must port from V2/OS, not rebuild from scratch — 25 prompts, Larry personality, mode engine already exist

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ICM-native architecture | Folder structure as orchestration eliminates framework code; paper-backed methodology | — Pending |
| GSD state management | STATE.md per room with master aggregation; proven pattern from GSD | — Pending |
| Brain as remote MCP | IP stays on server; users get intelligence not data; MCP is Claude-native | — Pending |
| LazyGraph optional | Enhances but never required; graceful degradation; Neo4j Aura Free is zero cost | — Pending |
| Tier 0 fully functional | Free tier works completely; Brain adds enrichment not gatekeeping | — Pending |
| Pipeline chaining through Room | Week 7 pattern; output becomes structured input; Room drives routing | — Pending |
| Larry as default agent | Immediate personality; zero-config experience; mode engine differentiates | — Pending |
| Three-surface compatibility | Same plugin, same workspace, same CLAUDE.md; Cowork gets 00_Context/ | — Pending |
| One-command install | Zero config required; Larry talks immediately; optional enhancements later | — Pending |
| Factory/Product separation | Layer 3 = IP (factory), Layer 4 = user work (product); clean ownership boundary | — Pending |

---
*Last updated: 2026-03-19 after initialization*
