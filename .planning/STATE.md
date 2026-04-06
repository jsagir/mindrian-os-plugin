---
gsd_state_version: 1.0
milestone: v1.8.6
milestone_name: MindrianRooms -- ICM Room Organization
status: defining_requirements
stopped_at: null
last_updated: "2026-04-06T00:00:00.000Z"
last_activity: 2026-04-06 - Milestone v1.8.6 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** Centralize all Data Rooms under ~/MindrianRooms/ with ICM-compliant structure
**Current focus:** Defining requirements for v1.8.6

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-04-06 -- Milestone v1.8.6 started

## Accumulated Context

- 3 normalization scripts written: brain-normalize-final.cypher, brain-normalize-supplement.cypher, brain-normalize-problemtype.cypher
- Architecture reference: references/brain/graph-architecture.md (5-layer stack, 10 Cypher patterns)
- Graph baseline verified: FEEDS_INTO=17(4 real), TYPICAL_AT=4, PREREQUISITE=0, ADDRESSES_PROBLEM_TYPE=38(polluted)
- Neo4j Aura + APOC 2026.03.0, write via console, read via MCP
- Curly apostrophe fix applied to all scripts (STARTS WITH prefix matching)
- Mullins execution order fix applied (match as Technique, not ValidationTool)

### Pending Todos

- **generate-hub.cjs standard features:** Sticky top bar with Mondrian branding, persona card auto-generated from room data, view buttons linking to views/ folder, bottom nav with Mindrian branding, vis-network graph replacing Cytoscape -- all as STANDARD output not manual patches
- **Update generate-snapshot.cjs constellation:** Already uses vis-network (v1.8.4) but needs the sidebar/detail panel/controls from the Tony prototype
- **Update generate-presentation.cjs:** Graph view should use vis-network per references/design/graph-visualization-standard.md
- **Update dashboard/index.html:** Live dashboard graph view should match export quality
- **LaTeX export command:** /mos:latex for any artifact with PDF output
- **Open source diagram lib evaluation:** For architecture/flow diagrams in exports
- **Desktop Data Room MCP:** KuzuDB Windows build blocked -- need alternative or skill bridge
- **Grading calibration data:** 0/100+ Example nodes -- needs Lawrence's actual grading records
