---
phase: 141
plan: 05
subsystem: graph-export
tags: [bug-fix, build-graph, sqlite, cytoscape, graceful-degradation, one-token]
requires:
  - 141-01 (tests/test-build-graph-guard.cjs RED regression)
provides:
  - scripts/build-graph-from-sqlite.cjs line-53 guard referencing roomDbPath (graceful exit-0 path restored)
affects:
  - The graph.json Cytoscape export path is no longer dead on the missing-room.db guard
tech_stack:
  added: []
  patterns:
    - "one-token guard fix (lazygraphPath -> roomDbPath)"
    - "child_process spawn-script-assert-exit-0 regression"
key_files:
  created: []
  modified:
    - scripts/build-graph-from-sqlite.cjs
decisions:
  - "Changed exactly one token on line 53 (lazygraphPath -> roomDbPath); no refactor, no try/catch move, no rename of roomDbPath"
metrics:
  duration: ~3 minutes
  completed: 2026-06-05
  tasks: 1
  files: 1
  commits: 1
---

# Phase 141 Plan 05: BUG-01 Graph-Export Guard Fix Summary

Fixed the one-token ReferenceError at `scripts/build-graph-from-sqlite.cjs:53`: the missing-room.db guard tested an undeclared `lazygraphPath`, throwing an uncaught ReferenceError BEFORE the exit-0 try/catch opened at line 58, leaving the graceful-degradation path dead and the graph.json Cytoscape export silently never emitted. The guard now tests `roomDbPath` (declared at line 50).

## What Was Built

| Change | File | Effect |
|--------|------|--------|
| `lazygraphPath` -> `roomDbPath` on line 53 | `scripts/build-graph-from-sqlite.cjs` | The `fs.existsSync(roomDbPath)` guard now references the path line 50 actually declared; the script reaches its `process.exit(0)` graceful path instead of crashing with a ReferenceError |

## Verification

- `node tests/test-build-graph-guard.cjs` -> `PASS` (exit 0). The BUG-01 regression spawns the real script via child_process against a tmp directory with NO `.mindrian/room.db` and asserts exit code 0; it is now GREEN.
- `grep -n "lazygraphPath" scripts/build-graph-from-sqlite.cjs` returns nothing (the undeclared symbol is gone).
- `grep -n "fs.existsSync(roomDbPath)" scripts/build-graph-from-sqlite.cjs` returns the line-53 guard.
- `git diff --stat` shows `1 file changed, 1 insertion(+), 1 deletion(-)` -- the change touches exactly one token on one line.
- No em-dashes in this summary or the change (CLAUDE.md HARD rule); hyphens only.

## Design Notes

The bug was a swallowed-error trap: the outer try/catch at line 58 would have caught any failure inside the graph-building body and exited 0 (never failing the hook chain), but the typo'd guard sat OUTSIDE that try/catch, so the ReferenceError escaped uncaught and the process died non-zero. The fix restores the intended ordering where the cheap existence guard short-circuits cleanly before any heavy work begins.

## Deviations from Plan

None. Plan executed exactly as written -- a single-token edit. No Rule 1-4 deviations required. No packages installed (threat T-141-SC: no package surface). The change is purely local batch I/O with no network surface (threat T-141-10: mitigated -- the regression test proves the graceful exit-0 guard is restored).

## Known Stubs

None.

## Self-Check: PASSED

- `scripts/build-graph-from-sqlite.cjs` verified present and modified on disk (line 53 references roomDbPath).
- Task commit 58cdd223 verified in git log.
- `node tests/test-build-graph-guard.cjs` exits 0 (GREEN).
- Em-dash byte scan returns 0 across this SUMMARY.
