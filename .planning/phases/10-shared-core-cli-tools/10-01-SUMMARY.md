---
phase: 10-shared-core-cli-tools
plan: 01
subsystem: cli
tags: [nodejs, cli, execSync, section-registry, bash-wrapper]

requires:
  - phase: none
    provides: "First plan in v3.0 — no prior phase dependencies"
provides:
  - "mindrian-tools.cjs CLI entry point with room/state subcommand routing"
  - "Core library modules (index.cjs, section-registry.cjs, room-ops.cjs, state-ops.cjs)"
  - "Test room fixtures and golden files for regression testing"
  - "discoverSections() dynamic section discovery function"
affects: [10-02, 11-mcp-server, 12-grant-discovery]

tech-stack:
  added: []
  patterns: [gsd-tools-routing, execSync-bash-wrapper, golden-file-regression]

key-files:
  created:
    - bin/mindrian-tools.cjs
    - lib/core/index.cjs
    - lib/core/section-registry.cjs
    - lib/core/room-ops.cjs
    - lib/core/state-ops.cjs
    - tests/test-room/problem-definition/entry-01.md
    - tests/test-room/market-analysis/entry-01.md
    - tests/test-room/STATE.md
    - tests/golden/compute-state.md
    - tests/golden/analyze-room.txt
  modified: []

key-decisions:
  - "Zero npm dependencies — pure Node.js built-ins only for core modules"
  - "Wrap Bash scripts via execSync, do not rewrite logic in Node.js"
  - "Golden files captured with timestamp normalization for regression testing"

patterns-established:
  - "GSD routing pattern: switch-case on command/subcommand in entry point"
  - "execSync wrapper pattern: 10s timeout, resolve script path from __dirname"
  - "Section discovery: directory qualifies if it has .md files or STATE.md"
  - "Output helper: JSON to stdout, >50KB to tmpfile with @file: prefix"

requirements-completed: [CORE-01]

duration: 3min
completed: 2026-03-24
---

# Phase 10 Plan 01: Shared Core + CLI Tools Summary

**mindrian-tools.cjs entry point routing room/state subcommands to core library modules wrapping Bash scripts via execSync with 33ms cold start**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T19:20:02Z
- **Completed:** 2026-03-24T19:23:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created mindrian-tools.cjs CLI entry point with room and state subcommand routing
- Built 4 core library modules (index, section-registry, room-ops, state-ops) with zero npm dependencies
- Established test room fixtures (2 sections + STATE.md) and golden file regression baselines
- 33ms cold start validates feasibility within hook timeout budgets

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test room fixtures and golden files** - `f8d379a` (test)
2. **Task 2: Create core library modules and mindrian-tools.cjs entry point** - `0878985` (feat)

## Files Created/Modified
- `bin/mindrian-tools.cjs` - CLI entry point routing subcommands to core modules
- `lib/core/index.cjs` - Shared helpers: output(), error(), safeReadFile(), PLUGIN_ROOT
- `lib/core/section-registry.cjs` - CORE_SECTIONS metadata + discoverSections() dynamic discovery
- `lib/core/room-ops.cjs` - listSections() and analyzeRoom() wrapping Bash scripts
- `lib/core/state-ops.cjs` - computeState() and getState() wrapping Bash scripts
- `tests/test-room/problem-definition/entry-01.md` - Test fixture with minto-pyramid methodology
- `tests/test-room/market-analysis/entry-01.md` - Test fixture with tam-sam-som methodology
- `tests/test-room/STATE.md` - Minimal test room state (Pre-Opportunity)
- `tests/golden/compute-state.md` - Golden baseline from compute-state script
- `tests/golden/analyze-room.txt` - Golden baseline from analyze-room script

## Decisions Made
- Zero npm dependencies: pure Node.js built-ins only, matching GSD pattern
- Wrap-not-rewrite: Bash scripts executed via execSync with 10s timeout, no logic ported
- Golden file regression uses timestamp normalization (computed: field differs per run)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core modules ready for 10-02 (CLI surface commands) to build on
- discoverSections() and listSections() available for MCP tool layer (Phase 11)
- Test room fixtures available for all future regression testing
- Cold start timing (33ms) confirms viability within 2-3s hook budget

---
*Phase: 10-shared-core-cli-tools*
*Completed: 2026-03-24*
