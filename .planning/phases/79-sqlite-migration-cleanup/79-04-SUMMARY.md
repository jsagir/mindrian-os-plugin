---
phase: 79-sqlite-migration-cleanup
plan: 04
subsystem: cli, commands, hooks, presentation
tags: [sqlite, migration, cli, hooks, commands, lazygraph]

requires:
  - phase: 79-01
    provides: lazygraph-ops.cjs SQLite core (openGraph, queryGraph, etc.)
  - phase: 79-02
    provides: graph-ops.cjs updated wrapper functions
provides:
  - CLI entry point with updated graph subcommands (SQL not Cypher)
  - All SKIP_DIRS using .mindrian instead of .lazygraph
  - Command docs referencing SQL queries and .mindrian/room.db
  - Hook scripts with .mindrian path filters
affects: [79-05, presentation, dashboard, scout]

tech-stack:
  added: []
  patterns:
    - "backward-compat alias: build-kuzu maps to build-sqlite in CLI"
    - "collectGraphData replaces collectKuzu in presentation generator"

key-files:
  created: []
  modified:
    - bin/mindrian-tools.cjs
    - scripts/generate-presentation.cjs
    - scripts/extract-room-intelligence.cjs
    - lib/quickview/server.cjs
    - scripts/post-write
    - scripts/pre-compact
    - scripts/on-agent-complete
    - commands/graph.md
    - commands/causal.md
    - commands/query.md
    - commands/scout.md
    - commands/scheduled-tasks.md
    - commands/dashboard.md

key-decisions:
  - "build-kuzu kept as backward-compat alias mapping to build-sqlite"
  - "collectKuzu renamed to collectGraphData with SQL queries replacing Cypher"
  - "Neo4j Brain MCP tool name (neo4j_cypher) left as-is -- that is external Brain, not room graph"
  - "graphData variable replaces kuzu variable in ROOM_DATA to accurately reflect SQLite source"

patterns-established:
  - "Room graph check: fs.existsSync(.mindrian/room.db) replaces .lazygraph/ directory check"
  - "SQL queries in command docs replace Cypher examples"

requirements-completed: [SQLITE-08]

duration: 4min
completed: 2026-04-10
---

# Phase 79 Plan 04: CLI, Presentation, Hooks, Command Docs Migration Summary

**Eliminated all kuzu/.lazygraph references across 13 files -- CLI says SQL, SKIP_DIRS say .mindrian, command docs reference SQLite**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T15:39:32Z
- **Completed:** 2026-04-10T15:43:30Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Updated mindrian-tools.cjs USAGE, graph subcommands, and record-decision to reference SQLite/.mindrian
- Rewrote collectKuzu to collectGraphData with SQL queries instead of Cypher
- Updated all 4 SKIP_DIRS sets from .lazygraph to .mindrian
- Updated all 3 bash hook scripts (.mindrian path filters, hsi-to-graph references)
- Updated all 6 command docs to reference SQL, .mindrian/room.db, and SQLite schema

## Task Commits

Each task was committed atomically:

1. **Task 1: Update mindrian-tools.cjs and presentation/hook scripts** - `8a6aa4b` (feat)
2. **Task 2: Update command markdown files** - `fb2c096` (feat)

## Files Created/Modified
- `bin/mindrian-tools.cjs` - CLI entry point: SQL usage strings, build-sqlite subcommand, .mindrian/room.db check
- `scripts/generate-presentation.cjs` - collectGraphData (was collectKuzu), SQL queries, .mindrian SKIP_DIRS
- `scripts/extract-room-intelligence.cjs` - .mindrian in SKIP_DIRS
- `lib/quickview/server.cjs` - .mindrian in SKIP_DIRS
- `scripts/post-write` - hsi-to-graph comment
- `scripts/pre-compact` - .mindrian path filter
- `scripts/on-agent-complete` - .mindrian path filter, room graph comment
- `commands/graph.md` - SQLite schema reference, SQL query patterns
- `commands/causal.md` - causal-to-graph bridge, .mindrian/room.db error messages
- `commands/query.md` - SQL translation guide, .mindrian/room.db auto-init
- `commands/scout.md` - hsi-to-graph script reference
- `commands/scheduled-tasks.md` - hsi-to-graph script reference
- `commands/dashboard.md` - .mindrian/room.db pre-flight check

## Decisions Made
- Kept build-kuzu as backward-compat alias in CLI switch-case
- Left neo4j-brain MCP tool name (neo4j_cypher) untouched -- that references the external Brain, not room graph
- Renamed ROOM_DATA.kuzu to ROOM_DATA.graphData for accuracy in presentation generator

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 13 files clean of kuzu/.lazygraph references
- Ready for Plan 05 (final verification sweep)

## Self-Check: PASSED

- All 13 modified files verified present on disk
- Commit 8a6aa4b (Task 1) verified in git log
- Commit fb2c096 (Task 2) verified in git log
- SUMMARY.md created and verified

---
*Phase: 79-sqlite-migration-cleanup*
*Completed: 2026-04-10*
