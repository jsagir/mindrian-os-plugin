# MindrianOS Plugin

## What This Is

A commercial Claude Code + Cowork plugin that delivers Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. Users install with one command and immediately get Larry (the AI teaching personality) plus a structured Data Room that passively captures insights and proactively surfaces gaps, contradictions, and convergence signals. The plugin leverages Claude's native capabilities while optionally connecting to the Brain (Neo4j knowledge graph with 21K+ nodes of teaching intelligence) for enriched guidance.

## Core Value

Users can run the full PWS methodology — 25 specialized methodology bots, structured pipelines, and an intelligent Data Room — inside Claude Code with zero infrastructure, where Larry guides them through venture innovation using the same teaching intelligence that powers the classroom experience.

## Current State

**Shipped:** v5.0 Data Room Presentation System (2026-03-31)

v1.0 through v5.0 = 52 commands, 8 agents, 49 MCP tools. 6-view Data Room Presentation System (Dashboard, Wiki, Deck, Insights, Diagrams, Graph). Canvas knowledge graph with particles and glow. BYOAPI chat with Larry. Git integration (optional), KuzuDB automatic backbone, HSI pipeline, binary asset filing, Vercel one-click deploy. Dual themes (De Stijl dark + PWS light). MindrianOS branding enforced.

**Milestones shipped:**
- v1.0 MVP (2026-03-22) -- 5 phases, 20 plans
- v2.0 Meeting Intelligence (2026-03-24) -- 4 phases, 13 plans
- v3.0 MCP Platform (2026-03-25) -- 10 phases, 26 plans
- v4.0 Brain API & CLI UI (2026-03-29) -- 6 phases, 12 plans
- v5.0 Presentation System (2026-03-31) -- 8 phases, 17 plans
- v5.1 User Outlets (in progress)

## Current Milestone: v5.1 User Outlets

**Goal:** Make MindrianOS's power reachable -- wire user-facing commands to built infrastructure, build onboarding, and ensure everything from v5.0 actually works from a user's perspective. No new infrastructure -- just outlets.

**Target features:**

CLI Identity:
- Mondrian banner fires reliably on cold start and after updates
- /mos:splash command for manual banner display
- Banner renders correctly across terminal environments

Onboarding (Phase 33 build):
- First-install detection via ~/.mindrian-onboarded marker
- 7-step Larry-voiced interactive walkthrough (all skippable)
- USER.md generated from onboarding conversation
- Update path shows "What's New" from CHANGELOG
- /mos:onboard command for re-run anytime

Command Wiring (connect existing infrastructure to users):
- /mos:present -- generate 6-view presentation + open in browser
- /mos:dashboard -- open interactive graph dashboard with chat
- /mos:speakers -- show speaker profiles from filed meetings
- /mos:reanalyze -- re-run intelligence on existing meetings
- /mos:graph -- direct KuzuDB graph exploration

JTBD Warm Start:
- Larry reads room state + user's current job to phrase nudges
- Every suggestion follows "You have [state]. /mos:X [outcome that matters]"
- Max 2-3 nudges per session, never feature descriptions
- Commands framed as job acceleration, not tool usage

v5.0 Validation:
- Phase 32-02 generative tools (highlightCluster, filterEdgeType, showInsight) verified working
- End-to-end: install -> onboard -> file -> present -> share flow tested
- All 6 presentation views render correctly with room data
- v4.0 Brain API & CLI UI (2026-03-29) -- 6 phases, 12 plans

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

v4.0 shipped (2026-03-29):
- Brain API key management with Supabase, approve/revoke/extend, plan-gated brain_write guard (v4.0, Phase 20)
- CLI UI Ruling System: 4-zone anatomy, 5 body shapes, 12 glyphs, session start contract (v4.0, Phase 21)
- Self-teaching admin panel (/mos:admin) with help visibility filtering (v4.0, Phase 22)
- Multi-room management: registry, /mos:rooms (6 subcommands), room lock, header canary (v4.0, Phase 23)
- Autonomous engine: /mos:act with Brain-driven framework selection, chain mode, dry-run (v4.0, Phase 24)
- De Stijl HTML export: Mondrian grid, document reader, intelligence view, Cytoscape graph (v4.0, Phase 25)

### Active

Deferred from v3.0:
- [ ] Room as Remote MCP (collaborative team access)
- [ ] Opportunity Bank (room section + proactive discovery agents)
- [ ] Funding Room (non-dilutive/dilutive/grants sub-rooms)
- [ ] AI Team Member Personas (domain experts + Bono perspectives)

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after v5.1 milestone start*
