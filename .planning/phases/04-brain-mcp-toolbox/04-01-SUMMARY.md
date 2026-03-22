---
phase: 04-brain-mcp-toolbox
plan: 01
subsystem: brain-mcp
tags: [neo4j, pinecone, cypher, mcp, brain, skill]

requires:
  - phase: 03-orchestration
    provides: room-proactive skill pattern, command frontmatter pattern
provides:
  - Brain schema reference (node types, relationships, grading calibration)
  - 8 named Cypher query pattern templates for all downstream agents and commands
  - Brain MCP setup command with credential collection and connection test
  - brain-connector skill for passive enrichment and proactive surfacing
affects: [04-02-agents, 04-03-commands, 04-04-upgrades]

tech-stack:
  added: [neo4j-mcp, pinecone-mcp]
  patterns: [query-pattern-templates, thin-skill-thick-reference, silent-fallback]

key-files:
  created:
    - references/brain/schema.md
    - references/brain/query-patterns.md
    - commands/setup.md
    - skills/brain-connector/SKILL.md
  modified: []

key-decisions:
  - "MCP tool names derived from .mcp.json server names: neo4j-brain -> mcp__neo4j-brain__read_neo4j_cypher"
  - "brain-connector skill replaces room-proactive bash analysis for Brain users (brain_gap_assess is superset)"
  - "Query patterns are the single source of truth -- no Cypher embedded in skills or agents"

patterns-established:
  - "Query pattern template: named Cypher in references/brain/query-patterns.md, loaded on demand by agents/skills"
  - "Silent fallback: Brain features silently degrade when MCP unavailable, never error to user"
  - "Credential isolation: .mcp.json in user workspace only, never in plugin directory"

requirements-completed: [BRAN-01, BRAN-02, BRAN-03, BRAN-10]

duration: 3min
completed: 2026-03-22
---

# Phase 4 Plan 01: Brain MCP Foundation Summary

**Brain schema reference, 8 Cypher query pattern templates, conversational setup command, and brain-connector passive/proactive skill**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T12:17:03Z
- **Completed:** 2026-03-22T12:20:03Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Schema reference documenting all 8 node types, 8 relationships, grading calibration data, and .mcp.json template
- 8 named Cypher query pattern templates with LIMIT clauses as single source of truth for all downstream agents
- Conversational setup command that collects credentials, writes .mcp.json (merges if exists), tests both Neo4j and Pinecone connections
- Thin brain-connector skill (256 words, well under 400 token budget) with passive enrichment, proactive surfacing, gating rules, and Brain Agent delegation

## Task Commits

Each task was committed atomically:

1. **Task 1: Brain reference files and setup command** - `71bd0c2` (feat)
2. **Task 2: brain-connector skill** - `6a81be7` (feat)

## Files Created/Modified

- `references/brain/schema.md` - Node types, relationships, grading calibration, .mcp.json template
- `references/brain/query-patterns.md` - 8 named Cypher/Pinecone query templates
- `commands/setup.md` - Conversational Brain MCP setup with credential collection and connection test
- `skills/brain-connector/SKILL.md` - Passive enrichment + proactive surfacing skill

## Decisions Made

- MCP tool names derived from .mcp.json server names (neo4j-brain, pinecone-brain) making them predictable
- brain-connector replaces room-proactive bash analysis for Brain users since brain_gap_assess is a superset
- All Cypher lives in query-patterns.md only -- skills and agents reference, never embed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Users run `/mindrian-os:setup brain` when ready to connect.

## Next Phase Readiness

- Schema and query patterns ready for Plan 02 (Brain Agent + sub-agents)
- brain-connector skill already delegates to `agents/brain-query.md` (created in Plan 02)
- Setup command tested pattern ready for Plan 03 commands to use

---
*Phase: 04-brain-mcp-toolbox*
*Completed: 2026-03-22*
