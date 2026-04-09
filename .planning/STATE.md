---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Mindrian Platform -- SQLite + MCP Server
status: ready_to_plan
stopped_at: null
last_updated: "2026-04-10T00:00:00.000Z"
last_activity: 2026-04-10 - Milestone v2.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Ship MindrianOS intelligence as a platform -- any LLM host gets 23 tools, interactive UI, and a room memory system
**Current focus:** v2.0 milestone defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-04-10 -- Milestone v2.0 started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: --
- Total execution time: 0 hours

## Accumulated Context

### Decisions

- KuzuDB abandoned Oct 2025 -- must replace with SQLite (better-sqlite3, WAL mode)
- lazygraph-ops.cjs is the single replacement point -- 90% of 24+ files route through it
- room.db at room/.mindrian/room.db replaces .lazygraph/ directory
- Graph + Memory in one database: nodes/edges tables + identity/facts/sessions/fragments/assumptions tables
- MCP server co-development: lib/core/*.cjs is shared core, MCP tools are thin Zod wrappers
- 23 MCP tools across 3 tiers: Brain (6), Room (11), Graph+Export (6)
- Larry Lite: 200-line system prompt for host LLMs (methodology instinct, not personality)
- MCP Apps (SEP-1865): De Stijl dashboards, knowledge graph, wiki render in-chat via ui:// scheme
- Natural language graph queries replace Cypher (Larry/host LLM translates to SQL)
- Co-development rule: every new capability ships as both plugin command AND MCP tool
- Neo4j Brain stays as-is (remote MCP, complex Cypher, 21K nodes, the moat)

### Pending Todos

- generate-hub.cjs standard features (sticky top bar, persona card, vis-network graph)
- Update generate-snapshot.cjs constellation (sidebar/detail panel from Tony prototype)
- Update generate-presentation.cjs graph view to vis-network
- LaTeX export command: /mos:latex
- Grading calibration data: 0/100+ Example nodes

### Phase 76 (Brain Normalization + Wave 1) -- DONE 2026-04-09

Shipped independently:
- 280 "The X" prefix dupes merged, 73 file path contamination nodes removed
- 20 missing FEEDS_INTO edges added (leadership cluster -> PWS methodology chains)
- 4 Wave 1 algorithm scripts: blindspot-mass, bayesian-surprise, element-novelty, disruption-index
- Brain: 7,931 -> 7,578 LazyGraphConcepts, 122,915 -> 119,706 CO_OCCURS, 147 -> 167 FEEDS_INTO

### Blockers/Concerns

- KuzuDB npm package still works but receives no security patches -- migration is urgent
- MCP Apps SDK (@modelcontextprotocol/ext-apps) needs version verification before building
- TypeScript SDK lacks runtime tool unregister API (issue #898) -- not a blocker, register all at startup

## Session Continuity

Last session: 2026-04-10
Stopped at: Milestone v2.0 initialized, ready for requirements
Resume file: None
