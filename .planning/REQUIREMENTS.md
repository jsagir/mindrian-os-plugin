# Requirements: MindrianOS Plugin v3.0

**Defined:** 2026-03-24
**Core Value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure, where Larry guides them through venture innovation.

## v3.0 Requirements

Requirements for MCP Platform & Intelligence Expansion. Each maps to roadmap phases.

### Shared Core

- [x] **CORE-01**: Plugin operations accessible via `mindrian-tools.cjs` single entry point callable by both CLI commands and MCP tools
- [x] **CORE-02**: Room sections auto-discovered dynamically (no hardcoded section list) — new sections like opportunity-bank/ and funding/ register automatically
- [x] **CORE-03**: Parity matrix validates every CLI command has a corresponding MCP tool, checked in CI

### MCP Server

- [x] **MCP-01**: MCP server exposes all plugin capabilities via hierarchical tool router (5-8 high-level tools grouping 41+ commands)
- [x] **MCP-02**: Room state, sections, and artifacts accessible as MCP Resources (read-only browsing without tool calls)
- [x] **MCP-03**: Common methodology workflows available as MCP Prompts (file meeting, run analysis, grade venture)
- [x] **MCP-04**: MCP server runs via stdio transport, configurable in claude_desktop_config.json with one line
- [x] **MCP-05**: Larry personality and teaching mode active in MCP context (same experience as CLI)

### Room Collaboration

- [x] **COLLAB-01**: MCP server accesses local room via configurable `MINDRIAN_ROOM` env var
- [ ] ~~**COLLAB-02**: Room state syncable to git repo for team collaboration~~ **(DEFERRED to v4.0 — room stays local for v3.0)**
- [ ] ~~**COLLAB-03**: Git sync handles STATE.md merge conflicts gracefully~~ **(DEFERRED to v4.0)**

### Brain Hosting

- [x] **BRAIN-01**: Brain MCP server deployed as remote service at brain.mindrian.ai
- [x] **BRAIN-02**: Desktop/Cowork users can connect to Brain via MCP config (same as CLI users)
- [x] **BRAIN-03**: Brain access gated by API key for paid tier subscribers

### Opportunity Bank

- [x] **OPP-01**: New room/opportunity-bank/ section with ICM-standard filing, frontmatter, and cross-references
- [x] **OPP-02**: Proactive grant scanning via Grants.gov REST API surfaces relevant opportunities based on room intelligence
- [x] **OPP-03**: Discovered opportunities filed as room artifacts with relevance scoring and source provenance
- [x] **OPP-04**: Opportunity Bank integrated into compute-state and analyze-room intelligence pipeline

### Funding Room

- [x] **FUND-01**: New room/funding/ section with sub-rooms for non-dilutive, dilutive, and grants
- [x] **FUND-02**: Per-grant folders with lifecycle stages: Discovered > Researched > Applying > Submitted > Awarded/Rejected
- [x] **FUND-03**: Grant progress tracked in section STATE.md with deadlines, status, and next actions
- [x] **FUND-04**: Cross-references between funding entries and opportunity-bank sources

### AI Team Personas

- [x] **PERS-01**: Domain expert personas generated from room intelligence as structured markdown in team/ folder
- [x] **PERS-02**: Six Thinking Hats (De Bono) mapped to generated personas — each argues from a specific perspective
- [x] **PERS-03**: Larry can invoke personas for multi-perspective analysis on any room artifact
- [x] **PERS-04**: Personas labeled as "perspective lenses" with disclaimers, never positioned as expert advisors

### User Knowledge Graph

- [x] **GRAPH-01**: Room artifacts automatically indexed as KuzuDB nodes (embedded, one DB per project in room/.lazygraph/)
- [x] **GRAPH-02**: Cross-references (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES) stored as typed edges
- [x] **GRAPH-03**: User can query their project graph via /mos:query with natural language (Larry translates to Cypher)
- [x] **GRAPH-04**: Room artifacts embedded in user-owned Pinecone index for semantic search (optional Tier 2)
- [x] **GRAPH-05**: Graph auto-updates when new artifacts are filed (hook-driven)

### Reasoning Engine

- [x] **REASON-01**: Each room section generates a REASONING.md with Minto/MECE structured analysis, frontmatter dependency graph (requires/provides/affects), and goal-backward verification
- [ ] **REASON-02**: Larry autonomously chains methodology tools in sequences (diagnose → framework → apply → file → cross-reference → graph-update) captured as methodology run artifacts
- [x] **REASON-03**: Chain-of-thought is persisted as .reasoning/ artifacts that future sessions read to understand section state
- [x] **REASON-04**: Reasoning visualization works across CLI (blockquote traces), Desktop (MCP prompts), and Cowork (shared state) — showing logical flow in natural terms
- [x] **REASON-05**: mindrian-tools.cjs provides programmatic frontmatter read/write for reasoning files (learned from gsd-tools.cjs patterns)

## v4.0 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Ecosystem & Surfaces

- **WIKI-01**: Wiki-style Data Room Dashboard hosted on Render/Vercel (nodes=pages, edges=hyperlinks)
- **OBS-01**: Obsidian Plugin (room/ as Obsidian vault with graph view)
- **CHROME-01**: Chrome Plugin for meeting join + room access
- **STATUS-01**: Data Room level status bar (CLI nested room/section context)
- **COMPAT-01**: Cursor + Windsurf compatibility via ICM universal interface
- **SITE-01**: Blog posts (Risk vs Uncertainty) + site style guide + generated images

## Out of Scope

| Feature | Reason |
|---------|--------|
| Streamable HTTP transport (remote MCP) | MCP session state spec still evolving (2026 roadmap item). Ship stdio-only, defer remote to v3.x+ |
| Full CRM/grant management system | Opportunity Bank and Funding Room are room sections with intelligence, not workflow engines |
| Candid Grants API (paid) | Start with free Grants.gov. Add Candid when adoption justifies cost |
| Autonomous persona agents | Personas are stateless perspective lenses, not autonomous agents. Larry orchestrates. |
| Real-time collaborative editing | Git sync provides async collaboration. Real-time deferred to v4.0+ |
| Flat 41-tool MCP surface | Research proved this consumes 30-60K tokens. Hierarchical router is mandatory. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 10 | Complete |
| CORE-02 | Phase 10 | Complete |
| CORE-03 | Phase 11 | Complete |
| MCP-01 | Phase 11 | Complete |
| MCP-02 | Phase 11 | Complete |
| MCP-03 | Phase 11 | Complete |
| MCP-04 | Phase 11 | Complete |
| MCP-05 | Phase 11 | Complete |
| COLLAB-01 | Phase 11 | Complete |
| COLLAB-02 | Phase 12 | Pending |
| COLLAB-03 | Phase 12 | Pending |
| BRAIN-01 | Phase 12 | Complete |
| BRAIN-02 | Phase 12 | Complete |
| BRAIN-03 | Phase 12 | Complete |
| OPP-01 | Phase 13 | Complete |
| OPP-02 | Phase 13 | Complete |
| OPP-03 | Phase 13 | Complete |
| OPP-04 | Phase 13 | Complete |
| FUND-01 | Phase 13 | Complete |
| FUND-02 | Phase 13 | Complete |
| FUND-03 | Phase 13 | Complete |
| FUND-04 | Phase 13 | Complete |
| PERS-01 | Phase 14 | Complete |
| PERS-02 | Phase 14 | Complete |
| PERS-03 | Phase 14 | Complete |
| PERS-04 | Phase 14 | Complete |

**Coverage:**
- v3.0 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
