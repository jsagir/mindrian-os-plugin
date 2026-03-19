# MindrianOS Plugin

## What This Is

A commercial Claude Code + Cowork plugin that delivers Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. Users install with one command and immediately get Larry (the AI teaching personality) plus a structured Data Room that passively captures insights and proactively surfaces gaps, contradictions, and convergence signals. The plugin leverages Claude's native capabilities while optionally connecting to the Brain (Neo4j knowledge graph with 21K+ nodes of teaching intelligence) for enriched guidance.

## Core Value

Users can run the full PWS methodology — 25 specialized methodology bots, structured pipelines, and an intelligent Data Room — inside Claude Code with zero infrastructure, where Larry guides them through venture innovation using the same teaching intelligence that powers the classroom experience.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] One-command plugin install (`claude plugin install mindrian-os`) with Larry active immediately
- [ ] ICM 5-layer folder structure as orchestration (Layer 0-4: identity, routing, stage contracts, reference/factory, working artifacts)
- [ ] Data Room with 8 sections (problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model)
- [ ] Room passive intelligence: auto-capture, classify, and file every insight to correct section
- [ ] Room proactive intelligence: detect gaps, contradictions, convergence; suggest next methodology; alert readiness
- [ ] 25 methodology bot commands ported from V2 prompts
- [ ] Larry personality and voice as default agent
- [ ] Larry mode engine (40:30:20:10 distribution — conceptual:storytelling:problem-solving:assessment)
- [ ] Pipeline system: ICM stage contracts for multi-step methodology workflows (Minto, Bono, HSI, JTBD, etc.)
- [ ] Pipeline chaining through Room — output of one pipeline becomes structured input to next (Week 7 pattern)
- [ ] Room hierarchy with STATE.md per room — sub-rooms for distinct opportunity spaces
- [ ] Master STATE.md aggregating full room tree with session continuity
- [ ] Brain MCP integration (optional) — graph enrichment, chain recommendations, grading, mode intelligence
- [ ] LazyGraph integration (optional) — user's Neo4j Aura Free for personal knowledge graph
- [ ] Three-surface compatibility: Claude Code CLI + Desktop + Cowork
- [ ] Tier 0 (free) fully functional — all 25 methodologies, Data Room, pipelines with no dependencies
- [ ] Graceful degradation: works without Brain, without LazyGraph, without any optional services
- [ ] Methodology extensibility: Level A (conversation bot, one .md), Level B (full pipeline, folder), Level C (Brain graph integration)
- [ ] SessionStart / PostToolUse / Stop hooks for intelligence pipeline
- [ ] Connector awareness skill for detecting and leveraging available MCPs

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
