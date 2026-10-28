---
phase: 314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command
plan: 06
subsystem: mcp
tags: [tri-polar, mcp, desktop, cowork, intelligence-tool, read-only, schema-bytes, no-new-tool]

requires:
  - phase: 314-01
    provides: portfolio-snapshot store (scopeId, readLatest, readMovement, markSeen, isSeen, SLUG_RE)
  - phase: 314-03
    provides: composeMovementSummary (the one movement sentence)
provides:
  - "intelligence tool enum value eureka-portfolio: a read-only view of the stored portfolio run and movement for Desktop and Cowork"
affects: [314-08]

key-files:
  created:
    - tests/test-314-mcp.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - tests/fixtures/267/wire-snapshot-zod3.json
    - tests/fixtures/267/wire-snapshot-zod4.json

key-decisions:
  - "eureka-portfolio sits on the intelligence enum only, outside ALL_TOOL_COMMANDS, like eureka-run, eureka-status, eureka-report. The 66-member pin did not move. No MCP tool was added; the count stays 75."
  - "The view reads one scope only: the context value when it matches SLUG_RE, else the whole room. The movement of that scope only is shown and marked seen."
  - "A stub run never shows a movement sentence (the sensor never fires on stub either); it shows the plain not-real line."
  - "Labels from the snapshot are whitespace-collapsed and cut to 80 characters before they print."

requirements-completed: [PM314-09, PM314-08]

completed: 2026-10-28
---

# Phase 314 Plan 06: Desktop and Cowork Read of the Portfolio Summary

**One new enum value, eureka-portfolio, on the existing intelligence tool. It reads the stored run and the stored movement in plain words, writes only the seen marker, and starts nothing.**

## What was built

- `lib/mcp/tool-router.cjs`: constant `EUREKA_PORTFOLIO_COMMAND`, module-level `eurekaPortfolioView(roomDir, context)`, one handler branch beside the `EUREKA_COMPUTE_COMMANDS` branch. The three store modules load lazily inside the function. Any fault reads as "no stored run".
- Answer layout: heading, provenance line (or the stub line), up to 10 ranked rows with plain level words and the score to 2 decimals, the quiet-signal line, the movement sentence (from `composeMovementSummary`, only when an unseen live movement exists for the viewed scope), then the refresh line that points to Claude Code.
- Tri-Polar call, stated: Desktop and Cowork read; a new run needs the Claude Code CLI. The CLI twin is `/mos:eureka-portfolio`.

## Task commits

| Task | Commit | Type |
|------|--------|------|
| 1 RED | 0a27f3f0d | test(314-06): failing test, legs MC1 to MC11 (29 legs failed before the code) |
| 1 GREEN | e914630f0 | feat(314-06): the read-only branch |
| 2 | 224cc7b26 | test(314-06): both wire snapshots list eureka-portfolio |

## Schema-byte measurement (PROVEN, from the file's own measure in tests/test-270-tool-schema-budget.cjs)

| Item | Before | After |
|------|--------|-------|
| Tool count | 75 | 75 |
| Description bytes | 36010 | 36010 |
| Schema bytes | 47512 | 47531 (+19) |
| Total bytes | 83522 | 83541 (+19) |
| Approx tokens | 20881 | 20885 |

Signed change by the file's own rule: pctChange(83522, 83541) = 0.02 percent. Inside DRIFT_TOLERANCE_PCT (10). No tool was added. `tests/test-270-tool-schema-budget.cjs` passes (5 passed, 0 failed), so no re-baseline was made and the AFTER constants are untouched. The file is not in files_modified.

## Verification (PROVEN, run with temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME, UV_OFFLINE=1)

- `node tests/test-314-mcp.cjs`: PASS 53, FAIL 0.
- Exit 0, no pin edited: test-205-surface-fence, test-366-eureka-alias, test-366-router-redirects, test-eureka-mcp-tools. This proves the 66-member parity array did not move.
- Exit 0: test-270-tool-schema-budget, test-366-mcp-plan-only, test-267-mcpv2-brain-shim, all 11 tests/test-276-*.cjs files (the frozen sweep in 276-dispositions.json did not move, so no re-freeze and the dispositions file is unchanged).
- `node scripts/build-harness-manifest.cjs --check`: OK before and after. `node scripts/build-orchestration-projection.cjs --check`: OK before and after. Neither file was regenerated or changed. `node scripts/check-tool-honesty.cjs --check`: exit 0, output identical to before (apart from a process id). `build-connector-registry.cjs --check`: exit 0. `check-render-coverage.cjs`: 0 gap.
- Wire pin proof: a direct comparison of the live intelligence enum (12 values) and description with both snapshots gives equal results for zod3 and zod4.
- Plans 314-01 and 314-03 tests still exit 0 (snapshot, movement, sensor shape B, offer, label lockstep).
- Dash scan (`grep -cP '\x{2014}|\x{2013}'`) on tool-router.cjs, test-314-mcp.cjs and both snapshot diffs: 0.
- Not touched: STATE.md, ROADMAP.md, REQUIREMENTS.md, CHANGELOG.md, docs/CANON-PHASE-MAP.md, data/harness-manifest.json, data/brain-orchestration-projection.json.

## Deviations from Plan

**1. [Rule 1 - Bug, in my test] MC3 row 3 expected the wrong label**
- The test planted labels for n001 to n005, so pair 3 (n005 and n006) carries "Solar thermal pumps", not "Membrane coating patents". The code was correct. Fixed before the GREEN commit.

**2. Task 2 claim "all five suites pass" does not hold in this tree. This is pre-existing, not caused by this plan.**
- test-267-mcpv2-zod4-contract (check b), test-257-strict-input-shapes (Arm B), test-267-mcpv2-registration-api (17 fails) were red BEFORE my change. PROVEN: I ran them first and saved the output; the output is identical after my change. Cause (PROVEN for the registration test and the zod4 contract): the wire snapshots hold 50 local tools and the live server lists 75, because the eureka adapter tools of this branch (eureka_graph_*, eureka_capability_*, and others) are not in the snapshots.
- Same pre-existing red, same cause, identical before and after: test-267-mcpv2-http-flag-off, test-267-mcpv2-clients, test-267-mcpv2-dual-era, test-369-shared-core (leg 9).
- Out of scope per the scope boundary. Not fixed. The snapshot edit for this plan is complete and proven by the direct enum comparison above.

## Known Stubs

None.

## Threat Flags

None. T-314-24 (slug allow-list, MC6), T-314-25 (no Brain call, no network, MC8), T-314-26 (one enum value, bytes recorded above), T-314-27 (no process, only the seen marker, MC9 and MC11) are mitigated and tested.

## Issues Encountered

- An untracked file tests/test-314-e2e.cjs exists in the tree. It is not mine. I did not touch it.

## Self-Check: PASSED

- Files exist: tests/test-314-mcp.cjs, lib/mcp/tool-router.cjs (with eurekaPortfolioView), both snapshots (PROVEN by the runs above).
- Commits 0a27f3f0d, e914630f0, 224cc7b26 are in the log of branch feat/eureka-adapter-rebased.
