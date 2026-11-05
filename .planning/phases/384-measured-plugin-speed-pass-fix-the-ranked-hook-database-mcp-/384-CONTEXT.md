# Phase 384 - Context

**Phase:** 384 - Measured plugin speed pass
**Gathered:** 2026-11-05
**Status:** Ready for planning
**Depends on:** Phase 381 (done)
**PRD:** 384-PRD.md in this directory. The finding table, rules, waves and open questions live there only, so they cannot drift apart.

## Locked decisions (owner)

- Scope: "Measure first, then fix the top 5" (JavaScript and TypeScript; the repo has 0 Java files).
- The work lands on `main` through GSD. No separate long-lived workspace branch for this phase. A throwaway worktree for a heavy measurement run is allowed only with the owner's word.
- Phase 382 is paused. Its branch `workspace/perf-optimize` is evidence, not a merge source.

## Boundaries

In scope: hook scripts, the room database open path, MCP server start-up and per-call cost, the Stop path, the timing harness.

Out of scope: any ESM migration; moving hot-path code to `.ts`; `room-scan` and `room-render-analyze` spawns; `mcp-dep-heal`; UI bundles under `ui/`; `r-and-d/` and `lab/`; any release, tag or version bump.

## Evidence mark

All ten findings are hypotheses from code reading. Only the `doctor --all` timer cause is proven (on the 382 branch). Reviewer coverage was partial: the lists of unread modules are in the five hand-back reports of 2026-11-05 and must be read before Wave 1 picks its targets.

## Canon

Part 8 (real-room copies stay local, counts and timings only), Part 9 (room.db is the local mind; the open path keeps its migration safety), Part 11 (hooks are wired surfaces; merging or removing a hook changes the born-wired registry and the harness manifest, so each such change regenerates them with the repo's own generator), Part 3 (any owner fork is a gate card).

## Verification

`bash tests/run-all-366.sh` and the current run-all for the touched area, plus the parity test for each changed hook (stdout envelope byte-identical). Measured before/after medians in each SUMMARY.
