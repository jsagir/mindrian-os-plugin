---
phase: 58
plan: 1
subsystem: scheduled-intelligence
tags: [cowork, mcp, intelligence, scheduling, proactive]
dependency_graph:
  requires: [surface-detect, intelligence-cascade, opportunity-ops]
  provides: [session-catchup, daily-briefing, scheduled-scanner, scheduled-tasks]
  affects: [mindrian-mcp-server]
tech_stack:
  added: []
  patterns: [session-snapshot-on-shutdown, idempotent-daily-filing, query-object-for-llm-search]
key_files:
  created:
    - lib/mcp/session-catchup.cjs
    - lib/core/daily-briefing.cjs
    - lib/core/scheduled-scanner.cjs
    - commands/scheduled-tasks.md
  modified:
    - bin/mindrian-mcp-server.cjs
decisions:
  - Session catch-up runs on Cowork HTTP startup only (not stdio Desktop/CLI)
  - Shutdown handler registers on all surfaces for session state persistence
  - Competitor and news scans return query objects for LLM execution (not direct fetch)
  - Grant discovery calls opportunity-ops.scanOpportunities directly (API access)
  - All intelligence results use date-stamped filenames for idempotency
metrics:
  duration: 7.5 minutes
  completed: 2026-04-05
  tasks_completed: 5
  tasks_total: 5
  files_created: 4
  files_modified: 1
---

# Phase 58 Plan 1: Scheduled Intelligence Summary

Cowork users receive daily briefings, prediction deadline alerts, and proactive competitor/grant/news intelligence via session catch-up on reconnect, daily briefing generation from room state, and scheduled scanner tasks filing to room/intelligence/ with provenance timestamps.

## Tasks Completed

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Session catch-up module | 91dc97e | lib/mcp/session-catchup.cjs |
| 2 | Daily briefing generator | a4e28b1 | lib/core/daily-briefing.cjs |
| 3 | Scheduled scanner (competitor/grant/news) | 1bf7e98 | lib/core/scheduled-scanner.cjs |
| 4 | Cowork scheduled task definitions | 709c74f | commands/scheduled-tasks.md |
| 5 | Wire catch-up into MCP server startup | 5d09163 | bin/mindrian-mcp-server.cjs |

## Requirements Coverage

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| SCHED-01 | Complete | session-catchup.cjs: computeCatchUp reads last-session.json, computes delta |
| SCHED-02 | Complete | daily-briefing.cjs: generates briefing from predictions, contradictions, stale sections |
| SCHED-03 | Complete | scheduled-scanner.cjs: buildCompetitorQueries + fileCompetitorResults |
| SCHED-04 | Complete | scheduled-scanner.cjs: scanAndFileGrants extends opportunity-ops |
| SCHED-05 | Complete | scheduled-scanner.cjs: buildNewsQueries + fileNewsResults |
| SCHED-06 | Complete | commands/scheduled-tasks.md: 6 task definitions for Cowork scheduler |
| SCHED-07 | Complete | All results filed to room/intelligence/ with YAML frontmatter provenance |

## Architecture

**Session Catch-Up Flow (SCHED-01):**
1. MCP server starts on Cowork (HTTP transport detected)
2. After transport connects, computeCatchUp reads room/.mindrian/last-session.json
3. Computes: hours since last session, hours since scout, new files, approaching predictions, stale sections
4. Summary logged to stderr (available to Cowork for first resource notification)
5. On SIGTERM/SIGINT, snapshotSession writes current state for next comparison

**Daily Briefing (SCHED-02):**
- Reads .predictions/REGISTRY.json for deadline tracking
- Scans .intelligence/ and intelligence/ for contradiction markers
- Detects stale sections (7+ days without updates)
- Outputs room/intelligence/briefing-YYYY-MM-DD.md with frontmatter provenance

**Scheduled Scanner (SCHED-03/04/05):**
- Competitor analysis: extracts tracked competitors from room, builds search queries, files results
- Grant discovery: wraps opportunity-ops.scanOpportunities, files scored results to intelligence/
- News scanning: builds domain queries from STATE.md keywords, files results with provenance
- runAllScans() orchestrates all three concurrently

**Design Decision -- LLM-Executed Search:**
Competitor and news scans return structured query objects rather than executing web searches directly. This is because web search tools (WebSearch, Tavily) are LLM-invoked via MCP tools, not callable from Node.js library code. The scheduled-tasks.md command provides the LLM with the query plan and filing functions to execute the full pipeline.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All modules are fully functional:
- session-catchup.cjs reads/writes real session state
- daily-briefing.cjs generates complete briefings from room data
- scheduled-scanner.cjs calls real Grants.gov/Simpler Grants APIs for grant discovery
- Competitor and news scans provide real query objects for LLM execution

## Self-Check: PASSED

All 4 created files exist. All 5 commits verified in git log. MCP server wiring confirmed.
