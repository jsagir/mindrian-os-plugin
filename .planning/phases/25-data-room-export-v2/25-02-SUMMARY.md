---
phase: 25-data-room-export-v2
plan: 02
subsystem: scripts
tags: [export, node, room-data, intelligence, lazygraph, kuzu, html-generation]

requires:
  - phase: 25-data-room-export-v2
    plan: 01
    provides: export-template.html with ROOM_DATA_PLACEHOLDER and CONTENT_SCRIPTS_PLACEHOLDER
provides:
  - Node.js script that reads room data and injects into export template
  - Updated /mos:room export subcommand calling generate-export.cjs
affects: [dashboard/export-template.html, commands/room.md]

tech-stack:
  added: []
  patterns: [zero-npm-deps, graceful-degradation, open-use-close KuzuDB, regex frontmatter parser]

key-files:
  created:
    - scripts/generate-export.cjs
  modified:
    - commands/room.md

key-decisions:
  - "KuzuDB queried via child_process spawning a temp script (async->sync bridge) with open-use-close pattern"
  - "analyze-room 5s timeout, build-graph 10s timeout -- partial data still produces valid export"
  - "Script tags escape closing </script> in markdown content to prevent injection"
  - "Room name extracted from STATE.md frontmatter (venture_name, room_name, name) with H1 and dirname fallbacks"

requirements-completed: [EXPORT-05]

duration: 3min
completed: 2026-03-27
---

# Phase 25 Plan 02: Generate Export Script Summary

**Node.js generation script that reads room data, runs intelligence/graph analysis, queries LazyGraph, and injects into De Stijl template for self-contained HTML export**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T16:12:07Z
- **Completed:** 2026-03-27T16:15:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created generate-export.cjs with zero npm dependencies (fs, path, child_process only)
- Script discovers sections dynamically, reads artifacts, runs analyze-room and build-graph
- LazyGraph (KuzuDB) integration queries typed relationship edges when .lazygraph/ exists
- Graceful degradation: every data collection step is try/catch, partial data produces valid export
- Updated /mos:room export to call the new script instead of flat markdown copy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generate-export.cjs Node.js script** - `91d8218` (feat)
2. **Task 2: Update room command export subcommand** - `6fb4891` (feat)

## Files Created/Modified
- `scripts/generate-export.cjs` - Node.js export generator: room reader, intelligence parser, graph builder, KuzuDB querier, template injector
- `commands/room.md` - Export subcommand now calls generate-export.cjs, shows De Stijl HTML format with section/intelligence counts

## Decisions Made
- KuzuDB queried via spawning a temporary Node.js script to bridge async KuzuDB API into synchronous main flow
- analyze-room gets 5s timeout, build-graph gets 10s timeout -- both degrade gracefully on failure
- Closing script tags in markdown content escaped to prevent HTML injection
- Room name resolution chain: STATE.md venture_name > room_name > name > H1 heading > directory basename

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - script is complete with all specified data collection and injection functionality.

## Next Phase Readiness
- generate-export.cjs ready for end-to-end testing with real room data
- Template + script integration complete: /mos:room export produces self-contained HTML
- Plan 03 (if any) would add testing or additional export formats

---
*Phase: 25-data-room-export-v2*
*Completed: 2026-03-27*
