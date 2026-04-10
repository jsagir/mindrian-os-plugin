---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: verifying
stopped_at: Completed 79-04-PLAN.md
last_updated: "2026-04-10T15:46:43.123Z"
last_activity: 2026-04-10
progress:
  total_phases: 11
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 18
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Ship MindrianOS intelligence as a platform -- any LLM host gets routed tools, interactive UI (MCP Apps), and a room memory system. Replace dead KuzuDB with SQLite. Co-develop plugin and MCP server from shared core.
**Current focus:** Phase 77 — sqlite-foundation

## Current Position

Phase: 77 (sqlite-foundation) — COMPLETE
Plan: 2 of 2 (complete)
Status: Phase complete — ready for verification
Last activity: 2026-04-10

Progress: [##                  ] 18%

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: 7min
- Total execution time: 0.23 hours

## Accumulated Context

### Decisions

- KuzuDB abandoned Oct 2025 -- must replace with SQLite (better-sqlite3, WAL mode)
- lazygraph-ops.cjs is the single replacement point -- 90% of 24+ files route through it
- room.db at room/.mindrian/room.db replaces .lazygraph/ directory
- Graph + Memory in one database: nodes/edges tables + identity/facts/sessions/fragments/assumptions tables
- 5-7 MCP router tools (not 23 flat) -- LLMs degrade above 20 tools
- MCP server co-development: lib/core/*.cjs is shared core, MCP tools are thin Zod wrappers
- Larry Lite: 200-line system prompt for host LLMs (methodology instinct, not personality)
- MCP Apps (SEP-1865): De Stijl dashboards, knowledge graph, wiki render in-chat via ui:// scheme
- Natural language graph queries replace Cypher (Larry/host LLM translates to SQL)
- Co-development rule: every new capability ships as both plugin command AND MCP tool
- Neo4j Brain stays as-is (remote MCP, complex Cypher, 21K nodes, the moat)
- De Stijl component library early -- all apps depend on shared components
- Keep async wrappers initially to avoid 100+ call-site breakage during SQLite migration
- .mindrian/ is the unified room metadata directory (replaces .graph/ and .lazygraph/)
- buildGraphFromKuzu function name preserved for backward compat -- Phase 79 handles script updates
- [Phase 78]: JSON columns stored as strings, parsed on read with try/catch fallback
- [Phase 78]: FK constraints on fragments.session_id enforced naturally by better-sqlite3
- [Phase 79-04]: build-kuzu kept as backward-compat alias; collectKuzu renamed to collectGraphData with SQL; Neo4j Brain MCP tool names left as-is

### Pending Todos

- generate-hub.cjs standard features (sticky top bar, persona card, vis-network graph)
- Update generate-snapshot.cjs constellation (sidebar/detail panel from Tony prototype)
- Update generate-presentation.cjs graph view to vis-network
- LaTeX export command: /mos:latex
- Grading calibration data: 0/100+ Example nodes

### Blockers/Concerns

- KuzuDB npm package still works but receives no security patches -- migration is urgent
- MCP Apps SDK (@modelcontextprotocol/ext-apps) needs version verification before building
- Claude.ai postMessage bug (issue #47) affects MCP Apps -- needs guard in all HTML
- ChatGPT MCP Apps compatibility unverified -- TEST-02 is discovery work

## Session Continuity

Last session: 2026-04-10T15:46:43.117Z
Stopped at: Completed 79-04-PLAN.md
Resume file: None
