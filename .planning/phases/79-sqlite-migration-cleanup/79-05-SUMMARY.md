---
phase: 79-sqlite-migration-cleanup
plan: 05
subsystem: lazygraph, scripts, cli, commands, tests
tags: [sqlite, migration, nl-queries, cleanup, kuzu-removal]

requires:
  - phase: 79-03
    provides: lazygraph-ops.cjs SQLite core functions
  - phase: 79-04
    provides: Updated CLI/hooks/commands with .mindrian paths
provides:
  - NL query template module (10 intent patterns mapped to parameterized SQL)
  - Rebuild-from-artifacts migration tool for existing rooms
  - Complete removal of kuzu dependency from package.json
  - Zero kuzu references in production code (28 files updated)
affects: [presentation, export, intelligence-cascade, scout, causal, hsi]

tech-stack:
  added:
    - "lib/core/nl-graph-queries.cjs (NL intent to SQL translator)"
    - "scripts/migrate-lazygraph.cjs (room graph migration tool)"
  patterns:
    - "Parameterized SQL queries via build() returning { sql, bindings }"
    - "Script renaming: *-to-kuzu -> *-to-lazygraph, build-graph-from-kuzu -> build-graph-from-sqlite"

key-files:
  created:
    - lib/core/nl-graph-queries.cjs
    - scripts/migrate-lazygraph.cjs
  modified:
    - package.json
    - package-lock.json
    - bin/mindrian-tools.cjs
    - lib/core/graph-ops.cjs
    - lib/core/intelligence-cascade.cjs
    - lib/core/model-profiles.cjs
    - lib/mcp/app-views.cjs
    - lib/graph/canvas-graph.js
    - scripts/build-graph-from-sqlite.cjs (renamed from build-graph-from-kuzu.cjs)
    - scripts/causal-to-lazygraph.cjs (renamed from causal-to-kuzu.cjs)
    - scripts/hsi-to-lazygraph.cjs (renamed from hsi-to-kuzu.cjs)
    - scripts/whitespace-to-lazygraph.cjs (renamed from whitespace-to-kuzu.cjs)
    - scripts/cross-room-detect.cjs
    - scripts/discovery-cycle.cjs
    - scripts/generate-export.cjs
    - scripts/generate-presentation.cjs
    - commands/causal.md
    - commands/scheduled-tasks.md
    - commands/scout.md
    - tests/test-phase-15.sh
    - tests/test-phase-27-sqlite-schema.sh (renamed from test-phase-27-kuzu-schema.sh)
    - tests/test-phase-27-meetings.sh
    - tests/test-phase-53-causal-extract.sh
    - README.md
    - OPTIMIZATION-REVIEW.md
    - docs/user-research/2026-03-31-uiux-session-log.md

decisions:
  - "10 NL query templates (7 required + 3 bonus: causal_claims, whitespace_zones, convergence)"
  - "Migration tool uses rebuild-from-artifacts, never reads old .lazygraph/ KuzuDB"
  - "Scripts renamed rather than just updating internals for clean codebase"
  - "cross-room-detect.cjs fully rewritten to use lazygraph-ops.cjs instead of direct kuzu require"
  - "generate-export.cjs execLazyGraphSync rewritten with SQL query instead of Cypher"

metrics:
  duration: "16 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 26
  files_renamed: 5
---

# Phase 79 Plan 05: NL Query Templates, Migration Tool, and Kuzu Removal Summary

NL graph query module with 10 parameterized SQL templates, rebuild-from-artifacts migration tool, kuzu removed from package.json, 28 files updated to zero kuzu references in production code.

## Tasks Completed

### Task 1: NL Graph Query Template Module
Created `lib/core/nl-graph-queries.cjs` with 10 intent-to-SQL query templates:
1. **contradictions** - Find artifacts contradicting a target
2. **neighbors** - All incoming/outgoing connections for a node
3. **path** - 2-hop path between two nodes
4. **stats** - Node and edge counts by type
5. **section_artifacts** - List artifacts in a section
6. **hsi_connections** - High-surprise HSI connections sorted by score
7. **reverse_salients** - Lagging sections by differential score
8. **causal_claims** - Cause-mechanism-effect chains (bonus)
9. **whitespace_zones** - Innovation gaps with hypotheses (bonus)
10. **convergence** - Artifacts appearing in 3+ edge types (bonus)

Exports: `translateQuery(intent, params)`, `executeNLQuery(conn, intent, params)`, `QUERY_TEMPLATES`

**Commit:** 0210f46

### Task 2: Migration Tool, Kuzu Removal, Reference Cleanup
- Created `scripts/migrate-lazygraph.cjs` with --dry-run, --force, --help flags
- Removed `kuzu: "^0.11.3"` from package.json
- Renamed 4 scripts to remove kuzu from filenames
- Rewrote `cross-room-detect.cjs` getArtifactTitles() from KuzuDB to SQLite
- Rewrote `generate-export.cjs` queryLazyGraph/execLazyGraphSync from Cypher to SQL
- Updated all internal references across 28 files

**Commit:** 0aa7c6c

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extensive kuzu references in 28 files beyond plan scope**
- **Found during:** Task 2
- **Issue:** Plan expected kuzu references limited to package.json, but 14 .cjs/.js files, 3 commands, 4 tests, 3 docs all contained kuzu references
- **Fix:** Renamed 5 scripts, rewrote 2 functions (cross-room-detect, generate-export), updated all references
- **Files modified:** 28 total
- **Commit:** 0aa7c6c

**2. [Rule 1 - Bug] Migration tool side effects on require()**
- **Found during:** Task 2 verification
- **Issue:** `require('./scripts/migrate-lazygraph.cjs')` triggered help output and process.exit
- **Fix:** Wrapped CLI logic in `if (require.main === module)` guard
- **Commit:** 0aa7c6c

## Verification Results

| Check | Result |
|-------|--------|
| NL templates count >= 7 | PASS (10 templates) |
| translateQuery returns sql + bindings | PASS |
| kuzu in package.json | REMOVED |
| Migration tool loads without error | PASS |
| Migration tool --help works | PASS |
| grep kuzu in *.cjs/*.js (excluding migrate-lazygraph) | 0 matches |
| grep kuzu in *.md (excluding CHANGELOG, RESEARCH, .planning) | 0 matches |

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED

- FOUND: lib/core/nl-graph-queries.cjs (7637 bytes)
- FOUND: scripts/migrate-lazygraph.cjs (8015 bytes)
- FOUND: commit 0210f46
- FOUND: commit 0aa7c6c
