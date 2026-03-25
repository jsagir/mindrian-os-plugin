---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: MCP Platform & Intelligence Expansion
status: executing
stopped_at: Completed 13-02-PLAN.md
last_updated: "2026-03-25T00:04:00Z"
last_activity: "2026-03-25 — Completed 13-02 (Grant discovery, CLI+MCP, analyze-room OPP-04)"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 10
  completed_plans: 9
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Dual-surface platform (CLI + MCP) delivering MindrianOS to Desktop/Cowork users with grant discovery and AI personas
**Current focus:** Phase 13 — Opportunity Bank + Funding Room

## Current Position

Phase: 13 of 14 (Opportunity Bank + Funding Room)
Plan: 2 of 3 in current phase -- COMPLETE
Status: In Progress
Last activity: 2026-03-25 — Completed 13-02 (Grant discovery, CLI+MCP, analyze-room OPP-04)

Progress: [██████████] 97% (29/30 plans complete across v1.0+v2.0+v3.0)

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

Last session: 2026-03-25T00:04:00Z
Stopped at: Completed 13-02-PLAN.md
Resume file: None
