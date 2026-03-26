---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: MCP Platform & Intelligence Expansion
status: completed
stopped_at: Completed 20-01-PLAN.md
last_updated: "2026-03-26T10:02:08.768Z"
last_activity: 2026-03-26 — Completed 20-01 (SQL migration, plan guard, Render env vars)
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 15
  completed_plans: 25
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Dual-surface platform (CLI + MCP) delivering MindrianOS to Desktop/Cowork users with grant discovery and AI personas
**Current focus:** Phase 20 — Brain API Control

## Current Position

Phase: 20 of 20 (Brain API Control)
Plan: 1 of 2 in current phase
Status: 20-01 Complete
Last activity: 2026-03-26 — Completed 20-01 (SQL migration, plan guard, Render env vars)

Progress: [██████████] 100% (47/48 plans complete across v1.0+v2.0+v3.0+v4.0)

## Performance Metrics

**Velocity:**

- Total plans completed: 33 (v1.0: 20, v2.0: 13)
- Average duration: ~4min
- Total execution time: ~2.5 hours

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06 Stage 1 Core | 4 | ~20min | 5min |
| 07 Team Room | 3 | ~14min | 5min |
| 08 Cross-Meeting | 3 | ~8min | 3min |
| 09 Knowledge Graph | 3 | ~10min | 3min |

**Recent Trend:**

- Last 5 plans: 3min, 3min, 4min, 3min, 3min
- Trend: Stable

| Phase 10 P01 | 3min | 2 tasks | 10 files |
| Phase 10 P02 | 5min | 2 tasks | 5 files |
| Phase 11 P01 | 16min | 2 tasks | 5 files |
| Phase 11 P02 | 13min | 2 tasks | 3 files |
| Phase 11 P03 | 5min | 2 tasks | 1 files |
| Phase 12 P01 | 3min | 2 tasks | 7 files |
| Phase 12 P02 | 1min | 3 tasks | 3 files |
| Phase 13 P01 | 3min | 2 tasks | 10 files |
| Phase 13 P02 | 5min | 3 tasks | 8 files |
| Phase 13 P03 | 4min | 2 tasks | 6 files |
| Phase 14 P01 | 5min | 2 tasks | 9 files |
| Phase 14 P02 | 4min | 2 tasks | 4 files |
| Phase 15 P01 | 8min | 2 tasks | 9 files |
| Phase 15 P03 | 4min | 2 tasks | 3 files |
| Phase 15 P02 | 14min | 3 tasks | 5 files |
| Phase 16 P01 | 6min | 2 tasks | 9 files |
| Phase 16 P03 | 3min | 2 tasks | 4 files |
| Phase 16 P02 | 3min | 2 tasks | 3 files |
| Phase 17 P01 | 4min | 2 tasks | 5 files |
| Phase 17 P02 | 4min | 2 tasks | 4 files |
| Phase 17 P03 | 5min | 2 tasks | 5 files |
| Phase 18 P01 | 6min | 2 tasks | 4 files |
| Phase 19 P01 | 10min | 2 tasks | 7 files |
| Phase 18 P02 | 2min | 2 tasks | 4 files |
| Phase 19 P02 | 4min | 2 tasks | 4 files |
| Phase 19 P03 | 5min | 2 tasks | 6 files |
| Phase 20 P01 | 1min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Recent decisions affecting v3.0:

- [v3.0 init]: Hierarchical MCP tool router (5-8 tools) mandatory — flat 41-tool surface kills context budget
- [v3.0 init]: stdio transport only for v3.0 — Streamable HTTP deferred to v3.x+ (MCP session state spec unstable)
- [v3.0 init]: scripts/ stays as-is (Rule of Three) — mindrian-tools.cjs wraps existing scripts, no premature abstraction
- [v3.0 init]: Personas are perspective lenses, not expert advisors — disclaimer on every output
- [v3.0 init]: Only 2 new npm deps: @modelcontextprotocol/sdk + cheerio (zod pulled by SDK)
- [Phase 10]: Zero npm dependencies for core modules — pure Node.js built-ins only
- [Phase 10]: Wrap Bash scripts via execSync (10s timeout), do not rewrite logic in Node.js
- [Phase 10]: 30s timeout for meeting/graph wrappers (slower scripts than room/state)
- [Phase 10]: Extended sections get generic gap messages; core sections keep specific logic
- [Phase 11]: Used server.tool() API for MCP SDK v1.27 (simpler than registerTool)
- [Phase 11]: ALL_TOOL_COMMANDS uses 41 CLI names for parity (data_room has 5 internal sub-commands mapping to CLI 'room')
- [Phase 11]: Larry compact personality (500 chars) in data_room description; full personality for future prompt injection
- [Phase 11]: room:// custom URI scheme for MCP Resources (state, sections, section/{name}, meetings, intelligence)
- [Phase 11]: Larry full personality (13K) injected in every MCP Prompt response for Desktop/CLI parity
- [Phase 11]: run-methodology prompt covers all 25 frameworks (methodology + analysis + intelligence groups)
- [Phase 11]: Extra MCP commands (not in CLI) produce warning only, not failure — allows internal sub-commands
- [Phase 12]: Stateless MCP — new McpServer per request for Render-friendly Brain server
- [Phase 12]: db.labels() fallback instead of apoc.meta.schema() for Aura free tier
- [Phase 12]: StreamableHTTPServerTransport returns SSE format — clients need Accept: application/json, text/event-stream
- [Phase 12]: brain_search uses searchRecords (integrated inference) with clear error fallback
- [Phase 12]: Render free tier with native Node runtime for faster cold start
- [Phase 12]: autoDeploy: true — git push to main triggers redeploy
- [Phase 12]: Single claude_desktop_config.json entry for user Brain setup
- [Phase 13]: YAML frontmatter parsing uses regex/split (no yaml library) following existing codebase pattern
- [Phase 13]: Funding lifecycle uses flat per-opportunity folders (not sub-rooms by type); outcomes separate from stages
- [Phase 13]: Multi-factor relevance scoring for grant discovery (domain, geography, stage, deadline, amount)
- [Phase 13]: Promise.allSettled for dual-API calls — partial results on single API failure
- [Phase 13]: analyze-room 14-day staleness threshold for funding pipeline entries
- [Phase 13]: Stage transitions enforced sequentially with no-skip validation
- [Phase 13]: Outcome (awarded/rejected) restricted to submitted stage; withdrawn allowed at any stage
- [Phase 14]: parseFrontmatter implemented locally in persona-ops.cjs (not imported -- opportunity-ops.cjs does not export it)
- [Phase 14]: Hat-color naming only (white-domain.md) per PERS-04 -- never human names for personas
- [Phase 14]: Thin room guard: sectionCount < 2 returns error, never generates generic personas
- [Phase 14]: MCP invoke-persona accepts JSON { hat, artifact } or plain hat color string in section parameter
- [Phase 14]: Pre-existing parity gap fixed -- opportunities + funding added to ALL_TOOL_COMMANDS
- [Phase 15]: kuzu@0.11.3 (archived, Apple acquisition) stable for our scale; segfaults on exit only
- [Phase 15]: String interpolation with escaping for Cypher v1; parameterized queries deferred
- [Phase 15]: CONTRADICTS via proximity terms; ENABLES/INVALIDATES via explicit frontmatter only (Tier 1)
- [Phase 15]: KuzuDB creates file not directory at .lazygraph path
- [Phase 15]: embedArtifact returns structured { success, reason, embeddingId } contract for Pinecone Tier 2
- [Phase 15]: Schema doc serves dual purpose: developer reference and Larry Cypher generation prompt context
- [Phase 15]: Open-use-close pattern for all lazygraph wrappers (try/finally ensures DB close)
- [Phase 15]: NL query via schema reference in MCP tool description (Larry generates Cypher)
- [Phase 15]: Post-write hook runs graph index in background with 2s timeout (non-blocking)
- [Phase 16]: Enhanced parseFrontmatter local to reasoning-ops.cjs — handles 2-3 level nesting (confidence.high, requires as object array, verification.must_be_true)
- [Phase 16]: reconstructFrontmatter uses inline JSON arrays for short lists, block format for longer content
- [Phase 16]: generateReasoning creates templates with placeholders — Larry fills reasoning content at conversation time
- [Phase 16]: reason-section prompt inlines system+user content in single user role (MCP prompt spec constraint)
- [Phase 16]: Schema reference serves dual purpose: developer docs + Larry generation context (lazygraph-schema.md pattern)
- [Phase 16]: REASONING_INFORMS is Section-to-Section edge type (reasoning dependencies between room sections)
- [Phase 17]: Zero npm dependencies for visual module — pure Node.js built-ins only (continues Phase 10 pattern)
- [Phase 17]: 24-bit true color primary palette with ANSI_BASIC 16-color fallback (consumer chooses)
- [Phase 17]: Stage name normalization strips hyphens/underscores/spaces for flexible input matching
- [Phase 17]: Red blink preserved for critical context threshold (>80%) — safety-critical, not restyled
- [Phase 17]: asciichart npm dependency added for sparkline charts (zero transitive deps)
- [Phase 17]: Graceful degradation: Bash scripts fall back to plain text when visual-ops unavailable
- [Phase 17]: Mermaid diagrams use DS_HEX colors (not ANSI) — Mermaid renders as SVG
- [Phase 17]: MCP visualize routed as data_room subcommands to keep tool count at 6
- [Phase 18]: Catalog order determines suggestion priority (Brain > Velma > Obsidian > Notion > Meeting source)
- [Phase 19]: @ig3/markdown-it-wikilinks@1.0.2 (plan specified 1.1.0 which does not exist)
- [Phase 19]: Dark/light mode toggle in header with localStorage persistence (Jonathan mandatory directive)
- [Phase 19]: Rebuild room index on each page request for development convenience (Plan 03 adds file watcher)
- [Phase 19]: Express 5.x for modern async error handling
- [Phase 18]: Integration Status table replaces Brain-only status in /mos:status; detect-integrations routed as data_room subcommand
- [Phase 19]: Open-use-close pattern per function for KuzuDB wiki queries (not connection pooling)
- [Phase 19]: BELONGS_TO/REASONING_INFORMS excluded from navigation (structural edges)
- [Phase 19]: Cytoscape.js from CDN for graph view (already used in dashboard)
- [Phase 19]: FlexSearch numeric IDs with external Map for id-to-pageId mapping
- [Phase 19]: Chat is a stub -- UI and API contract real, backend is placeholder for future MCP/CLI Larry
- [Phase 19]: Mermaid startOnLoad:false with manual code-block swap for rendering control
- [Phase 19]: SSE auto-refresh uses DOMParser soft reload (no full page refresh)
- [Phase 20]: Plan guard uses closure capture from options parameter, not req object

### Pending Todos

- Trained Lawrence model (PAID TIER): Fine-tune on real teaching transcripts
- Website content refresh: mindrianos-jsagirs-projects.vercel.app
- Pivot Simulator: "What-if" cascade impact command
- Assumption validity UI: Track claim staleness across sections

### Blockers/Concerns

- Node.js cold start vs hook timeout: mindrian-tools.cjs execution time needs validation against 2-3s hook budget
- Windows path handling: stdio MCP on Windows needs cmd /c wrapper — dev env is WSL2, won't surface naturally
- Brain Tier 0 testing: every Phase 12-14 feature must be tested Brain-disconnected first

## Session Continuity

Last session: 2026-03-26T10:02:08.764Z
Stopped at: Completed 20-01-PLAN.md
Resume file: None
