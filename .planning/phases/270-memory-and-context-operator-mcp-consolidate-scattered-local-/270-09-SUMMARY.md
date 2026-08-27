---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 09
subsystem: mcp
tags: [context-fusion, token-budget, born-wired]

requires:
  - phase: 270-06
    provides: "the born-wired auto-discovery seam and connector-coverage test this plan's new tool must clear"
provides:
  - "getRoomContext's opts.estimateOnly, _meta.legCostChars, _meta.legCostTokensApprox, CHARS_PER_TOKEN_PROXY"
  - "context_assemble MCP Tool"
affects: [270-12]

tech-stack:
  added: []
  patterns:
    - "Additive core-function extension: measure the real computation's cost, then null the response bodies under estimateOnly, rather than building a separate cheaper-but-inexact estimation path"

key-files:
  created:
    - lib/mcp/tools/context.cjs
  modified:
    - lib/core/navigation/room-context.cjs
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "All four getRoomContext legs are already cheap and bounded by design, so estimateOnly runs the SAME real computation and nulls the response bodies afterward, rather than building a separate, potentially-inexact 'cheap structural' sizing path. Every leg's cost number is therefore exact, not a guess -- no estimateExact:false flag was needed anywhere."
  - "Cost is measured in BYTES via Buffer.byteLength(JSON.stringify(leg), 'utf8'), not JS string .length, so a multi-byte character never silently under-counts -- consistent with tests/test-270-tool-schema-budget.cjs's own measure() convention."

requirements-completed: [MEMOP-11, MEMOP-12]

duration: 90min
completed: 2026-08-27
---

# Phase 270 Plan 09: context_assemble Summary

**`getRoomContext` -- the best-instrumented, already-shipped 4-leg context fusion with zero prior MCP surface -- is now reachable as `context_assemble`, with all four of its existing budget knobs exposed as bounded tool parameters and a real `estimate_only` mode that returns exact per-leg cost with all bodies nulled. Manually verified against a real fixture: estimate_only returns the identical cost numbers as a normal call, with every body null.**

## Performance

- **Duration:** 90 min
- **Tasks:** 2
- **Files modified:** 6 (1 new, 5 modified/regenerated)

## Accomplishments

- `lib/core/navigation/room-context.cjs`: purely additive extension (5 deletions, 64 insertions). `CHARS_PER_TOKEN_PROXY = 4` is the one named divisor. `_meta.legCostChars`/`_meta.legCostTokensApprox` mirror `legTimingsMs`'s exact shape. `opts.estimateOnly` nulls the four response bodies while keeping the already-computed exact cost numbers -- no separate, potentially-inexact sizing path was built, since all four legs are already cheap and bounded by design.
- `lib/mcp/tools/context.cjs`: `context_assemble`, mirroring `graph_query`'s exact open/close-through-the-chokepoint shape. Five bounded zod parameters (`fragment_window` <=50, `fragment_char_cap` <=4000, `top_k` <=100, `max_depth` <=5, `estimate_only`). `roomId` derived via the SAME convention `scripts/intent-classifier.cjs` already uses (`path.basename(roomDir)`), not a second identity scheme. `hitl_shape: 'none'`, contrasted explicitly against `memory_event`'s `F.1` in its `hitl_why`.
- Registries regenerated (24 MCP-tool connectors, was 23) plus `data/harness-manifest.json` (same drift-on-new-connector gate plan 270-06 hit). All three born-wired gates pass. `tests/test-234-tool-description-floor.cjs`: 37 tools (was 36), `context_assemble`'s description clears every check on the first try. `tests/test-270-connector-coverage.cjs`: 6/6 legs green.
- **Manually exercised `estimate_only` against a real temp-room fixture** (not just asserted in the abstract): a normal call returned real leg bodies with `_meta.legCostChars.total = 631` / `legCostTokensApprox.total = 158`; `estimate_only: true` against the SAME fixture returned the identical cost numbers with `summary`/`recentMessages`/`relevantNodes`/`cortexNodes` all `null`.
- Zero edit to `lib/mcp/register-core-tools.cjs`, `lib/mcp/tool-router.cjs`, or `bin/mindrian-mcp-server.cjs` -- the auto-discovery seam did its job.

## Task Commits

1. **Task 1: getRoomContext extension** - `40e105b0` (feat)
2. **Task 2: context_assemble tool** - `53cdc992` (feat)

## Files Created/Modified

- `lib/core/navigation/room-context.cjs` - `estimateOnly`, `legCostChars`, `legCostTokensApprox`, `CHARS_PER_TOKEN_PROXY`
- `lib/mcp/tools/context.cjs` - the new tool
- `data/mcp-tool-connectors.json`, `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/harness-manifest.json` - regenerated

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Necessary, plan-directed] `data/harness-manifest.json` needed regeneration again**
- **Found during:** Task 2, the commit's own pre-commit hook
- **Issue:** Same drift-on-new-connector gate plan 270-06 hit -- adding a new MCP-tool connector stales the harness manifest's own source-map snapshot.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` and committed alongside the connector registries.
- **Committed in:** `53cdc992`

---

**Total deviations:** 1 (a now-familiar, plan-06-precedented regeneration step, not a design change). **Impact:** None on the plan's own scope.

## Issues Encountered

**`bash tests/run-all-270.sh`'s PASS/FAIL count shifted from 9/2 (end of plan 270-08) to 8/3 here -- an EXPECTED, designed signal, not a regression.** `tests/test-270-tool-schema-budget.cjs` (plan 270-06) now correctly fails its own "drift alarm" leg: the live tool count is 37 (this plan added `context_assemble`) against its recorded `BASELINE.toolCount = 36`. The test's own failure message says exactly what to do: "if this legitimately changed, plan 270-12 is where the baseline is updated, not this file." This plan deliberately does NOT touch that baseline -- confirmed by reading the file's own design intent (the drift alarm exists precisely to catch a tool-count change between measurement and the phase's final gate). Plan 270-12 owns the AFTER measurement and the real before/after delta.

`node scripts/doctor.cjs --acceptance` transiently showed a second failure (`activation-reached-the-wire`) while the connector registries were mid-regeneration and not yet committed; re-running after the commit landed showed the acceptance baseline back to its established 17/18 (only the pre-existing, environmental `verify-release-clean-tree` failing) -- confirmed not a real regression, just a snapshot taken between a regeneration and its commit.

## Next Phase Readiness

- Wave 4 is complete (both 270-08 and 270-09 have SUMMARY.md files).
- Plan 270-10 (Wave 5) depends on 270-04, 270-07, and this plan, and is now unblocked.
- Plan 270-12 (Wave 7) has a concrete, expected input: `tests/test-270-tool-schema-budget.cjs`'s `BASELINE.toolCount` must be updated from 36 to the phase's final tool count once all remaining tools land, and the AFTER measurement should be computed via the SAME exported `measure()` function this plan's baseline was produced with.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*
