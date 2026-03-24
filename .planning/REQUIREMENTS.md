# Requirements: MindrianOS Plugin v3.0

**Defined:** 2026-03-24
**Core Value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure, where Larry guides them through venture innovation.

## v3.0 Requirements

Requirements for MCP Platform & Intelligence Expansion. Each maps to roadmap phases.

### Shared Core

- [x] **CORE-01**: Plugin operations accessible via `mindrian-tools.cjs` single entry point callable by both CLI commands and MCP tools
- [x] **CORE-02**: Room sections auto-discovered dynamically (no hardcoded section list) — new sections like opportunity-bank/ and funding/ register automatically
- [ ] **CORE-03**: Parity matrix validates every CLI command has a corresponding MCP tool, checked in CI

### MCP Server

- [ ] **MCP-01**: MCP server exposes all plugin capabilities via hierarchical tool router (5-8 high-level tools grouping 41+ commands)
- [ ] **MCP-02**: Room state, sections, and artifacts accessible as MCP Resources (read-only browsing without tool calls)
- [ ] **MCP-03**: Common methodology workflows available as MCP Prompts (file meeting, run analysis, grade venture)
- [ ] **MCP-04**: MCP server runs via stdio transport, configurable in claude_desktop_config.json with one line
- [ ] **MCP-05**: Larry personality and teaching mode active in MCP context (same experience as CLI)

### Room Collaboration

- [ ] **COLLAB-01**: MCP server accesses local room via configurable `MINDRIAN_ROOM` env var
- [ ] **COLLAB-02**: Room state syncable to git repo for team collaboration (git-based shared room)
- [ ] **COLLAB-03**: Git sync handles STATE.md merge conflicts gracefully (last-write-wins with history preservation)

### Brain Hosting

- [ ] **BRAIN-01**: Brain MCP server deployed as remote service at brain.mindrian.ai
- [ ] **BRAIN-02**: Desktop/Cowork users can connect to Brain via MCP config (same as CLI users)
- [ ] **BRAIN-03**: Brain access gated by API key for paid tier subscribers

### Opportunity Bank

- [ ] **OPP-01**: New room/opportunity-bank/ section with ICM-standard filing, frontmatter, and cross-references
- [ ] **OPP-02**: Proactive grant scanning via Grants.gov REST API surfaces relevant opportunities based on room intelligence
- [ ] **OPP-03**: Discovered opportunities filed as room artifacts with relevance scoring and source provenance
- [ ] **OPP-04**: Opportunity Bank integrated into compute-state and analyze-room intelligence pipeline

### Funding Room

- [ ] **FUND-01**: New room/funding/ section with sub-rooms for non-dilutive, dilutive, and grants
- [ ] **FUND-02**: Per-grant folders with lifecycle stages: Discovered > Researched > Applying > Submitted > Awarded/Rejected
- [ ] **FUND-03**: Grant progress tracked in section STATE.md with deadlines, status, and next actions
- [ ] **FUND-04**: Cross-references between funding entries and opportunity-bank sources

### AI Team Personas

- [ ] **PERS-01**: Domain expert personas generated from room intelligence as structured markdown in team/ folder
- [ ] **PERS-02**: Six Thinking Hats (De Bono) mapped to generated personas — each argues from a specific perspective
- [ ] **PERS-03**: Larry can invoke personas for multi-perspective analysis on any room artifact
- [ ] **PERS-04**: Personas labeled as "perspective lenses" with disclaimers, never positioned as expert advisors

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
| CORE-03 | Phase 11 | Pending |
| MCP-01 | Phase 11 | Pending |
| MCP-02 | Phase 11 | Pending |
| MCP-03 | Phase 11 | Pending |
| MCP-04 | Phase 11 | Pending |
| MCP-05 | Phase 11 | Pending |
| COLLAB-01 | Phase 11 | Pending |
| COLLAB-02 | Phase 12 | Pending |
| COLLAB-03 | Phase 12 | Pending |
| BRAIN-01 | Phase 12 | Pending |
| BRAIN-02 | Phase 12 | Pending |
| BRAIN-03 | Phase 12 | Pending |
| OPP-01 | Phase 13 | Pending |
| OPP-02 | Phase 13 | Pending |
| OPP-03 | Phase 13 | Pending |
| OPP-04 | Phase 13 | Pending |
| FUND-01 | Phase 13 | Pending |
| FUND-02 | Phase 13 | Pending |
| FUND-03 | Phase 13 | Pending |
| FUND-04 | Phase 13 | Pending |
| PERS-01 | Phase 14 | Pending |
| PERS-02 | Phase 14 | Pending |
| PERS-03 | Phase 14 | Pending |
| PERS-04 | Phase 14 | Pending |

**Coverage:**
- v3.0 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
