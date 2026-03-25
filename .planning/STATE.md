---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: MCP Platform & Intelligence Expansion
status: executing
stopped_at: Completed 15-03-PLAN.md -- Phase 15 complete
last_updated: "2026-03-25T09:39:42.936Z"
last_activity: 2026-03-25 — Completed 15-01 (LazyGraph core module with KuzuDB)
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 15
  completed_plans: 14
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Dual-surface platform (CLI + MCP) delivering MindrianOS to Desktop/Cowork users with grant discovery and AI personas
**Current focus:** Phase 15 — User Knowledge Graph (KuzuDB LazyGraph)

## Current Position

Phase: 15 of 15 (User Knowledge Graph)
Plan: 3 of 3 in current phase (COMPLETE)
Status: Phase 15 Complete
Last activity: 2026-03-25 — Completed 15-03 (Pinecone stub, query command, schema docs)

Progress: [██████████] 97% (34/35 plans complete across v1.0+v2.0+v3.0+v4.0)

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

Last session: 2026-03-25T09:39:42.933Z
Stopped at: Completed 15-03-PLAN.md -- Phase 15 complete
Resume file: None
