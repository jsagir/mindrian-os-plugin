---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 15
subsystem: mcp
tags: [perf, mcp-start, lazy-require, ab-verdict, no-gain, reverted]
requires:
  - phase: 384-12
    provides: ab-verdict, pin-tree, tree-b modes
  - phase: 384-14
    provides: measuring routine
provides:
  - per tool file load attribution (modules added, exclusive modules, cold load)
  - parity group and golden for tools/list, initialize and registration health
  - measured before and after of the lazy-require change with verdict NO-GAIN (change reverted)
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/s7-load-attribution.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s7-attribution.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s7-readings.md
    - tests/test-384-s7-mcp-start.cjs
    - tests/fixtures/384-s7-tools-list-golden.json
  modified: []
key-decisions:
  - "Keep rule applied as written: NO-GAIN, no retake (the rule retakes only NOT-RESOLVED), fix and mechanism commits reverted, parity commit stays."
requirements-completed: []
completed: 2026-11-07
---

# Phase 384 Plan 15: S7 MCP start Summary

STATUS PARTIAL. The lazy-require change worked as a mechanism (module count 479 to 382) and moved the initialize time by 7.8 ms and 10 ms, far under the 50 ms floor. `ab-verdict` printed `VERDICT NO-GAIN d1=7.8 d2=10 noise=146.4 floor=50`. The fix and the mechanism test are reverted. `ab-verdict outcome` exits 0.

START_SHA: 5c6bfb89563b9a2b2eeece417c5894c88583c8d7.

## Commits

| Sha | Subject | State |
|-----|---------|-------|
| 58c4c84bb | test(384-15): S7 load attribution per tool file and parity group for tools/list | stays |
| 7a1226376 | test(384-15): failing mechanism group, tool files load handler-only modules at start | reverted by 23816150b |
| 168315fe7 | perf(384-15): MCP tool files load handler-only modules on first call, not at start (S7) | reverted by 2243db515 |
| 2243db515 | Revert of 168315fe7 | |
| 23816150b | Revert of 7a1226376 | |
| f27e30a65 | docs(384-15): S7 before and after on pinned exports, verdict NO-GAIN | stays |

BEFORE tree = 7a1226376 (FIX^). Its product files equal START_SHA. After the reverts `git diff 5c6bfb89 HEAD -- lib` is empty, `hooks/hooks.json` and `lib/mcp/register-core-tools.cjs` never changed.

## Attribution (measurements/fix-s7-attribution.md)

- Isolation, n of 7: every one of the 37 files adds about 167 shared modules (lib/core and lib/mcp helpers). research.cjs adds 261, 16 eureka-graph files add 200. This count overstates what a lazy require can remove, because the shared base loads once anyway.
- Exclusive modules (no other tool file adds them): research.cjs 78, sensors.cjs 9, gate.cjs 7, stop-gate.cjs 6, context.cjs 3, status.cjs 3, chain.cjs 2, the rest 1 or 0. The 16 eureka-graph files add no exclusive module (they share one set), so a change in at most 5 of them removes nothing.
- Selected (rule applied to exclusive modules): research.cjs (planner, quick, grants, structure, canonRelease, eurekaJudge), sensors.cjs (reachHedgeRanker, chainRecommender, feyNextMove), gate.cjs (goalGate, gateRaised), stop-gate.cjs (stopGateHandler). 4 files, cap 5. Stayed eager: `perspectives` and `PERSPECTIVE_IDS` in research.cjs (top-level use in the input schema). chain.cjs (2 exclusive modules) and eureka-capability-jobs.cjs (0) were not selected.

## RED and GREEN checks

- Parity group (P1 tool count 72, names, tools/list; P2 initialize; P3 registration health, 37 files): passed on the unchanged code (also in a second sandbox), passed after the change, passed again after the reverts.
- Mechanism group before the change: 5 FAIL lines (M1 counts 479, 479, 479 against limit 379 first, then 384; M2 for each of the 4 files).
- Mechanism group after the change: ALL PASS (counts 382, 382, 382; limit 384; M2 for the 4 files). BASELINE_MODULES 479; removed 97.

## Measurement (copied from measurements/fix-s7-readings.md)

Primary `mcp:os:initialize`, wall_ms.median, n of 41 per tree per set, two interleaved sets, pinned exports, fixture room, taskset 0-3, load1 start 1.48 (set 1) and 1.40 (set 2).

| median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 605.15 (568 / 642.3) | 596.25 (560.2 / 632.3) | 1085.2 | 1001.7 | 7.8 | 10 | 146.4 | 50 | 12.277948 | 12.092243 | NO-GAIN |

Guard `mcp:os:tools-list`: NO-GAIN (d1 9.7, d2 14.4, noise 181.3); not WORSE. The change removed 1.3 and 1.7 percent of the median initialize time, far under the floor. The S7-eu question (16 Eureka files) is not answered and stays NOT RESOLVED.

## Suites (run in the working tree with the change, before the measurement)

Green: tests/test-384-s7-mcp-start.cjs (both groups), test-354-registration-diagnostics, test-198-local-only, test-198-contract-schema, test-eureka-mcp-tools, test-eureka-capability-run, test-366-mcp-plan-only, test-366-mcp-perspective-ops, test-366-mcp-release-route, test-research-run-session-binding, test-363-part8-sweep, test-363-mcp-tool, test-276-meeting-gate-wiring, run-all-198, `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`.

Red, not failures of this plan:
- run-all-354: test-354-framework-command-ledger (plugin_version drift in the ledger), red in an export of START_SHA too (8 passed, 1 failed). test-354-concurrency-surfaces K2 failed once inside run-all-354 (room.db in use by another process, a lock contention check), passed with 26 checks on a second run in the working tree and in an export of START_SHA. Treated as a flake; UNVERIFIED as to cause.
- run-all-366: 75 PASS, 1 FAILED, 1 KNOWN. The failing leg is 380 gate wiring (5 changelog-content checks) and the 380 face panel aggregate; 380 gate wiring is red in an export of START_SHA too. The known leg is the pre-existing 355 pin. Same as the result in 384-14.

## Deviations from Plan

1. [Rule 3 - Selection rule] The 20-module threshold and the selection were applied to exclusive modules, not to the isolation counts of Table 1 (written down in the attribution file before any fix existed). Reason: the isolation counts include a shared base of about 167 modules that no change in 4 files can remove.
2. [Rule 1 - Test constant] REMOVED_MODULES was first 100 (sum of exclusive modules). 4 of them (perspectives/index, surfaced-offers, answer-route, session-verify-state) are reached by requires that stay eager, so the reachable number was 97 and the constant became 95 in the fix commit, with a comment.
3. [Process] The attribution tool got a second mode (`--exclusive`) and its "modules added" excludes the tool file itself (selftest values 0, 1, 4 as the plan says).
4. [Process] The attribution table ran with load1 2.67 at its start (plan asks below 2 for timed gates). Its milliseconds are informational only; the selection uses module counts.
5. [Process] No retake: the word is NO-GAIN, F10 retakes only NOT-RESOLVED (same reading as plan 384-13).
6. [Process] The branch is `main` in a linked worktree; the worktree-agent branch assertion does not apply.

## Known Stubs

None.

## Threat Flags

None. The change was reverted; while present it moved only the position of requires and added no network call.

## NOT MEASURED, UNVERIFIED

Native Windows, Desktop and Cowork surfaces, a real room (fixture room only, Canon Part 8), the cold-install case of lib/core/mcp-dep-heal.cjs. The handler-time cost of the first call (lazy load moves load cost to the first call) was not measured. CPU time was not read as a metric.

## Self-Check: PASSED

Files exist: bench/s7-load-attribution.cjs, fix-s7-attribution.md, fix-s7-set1.json, fix-s7-set2.json, fix-s7-readings.json, fix-s7-readings.md, tests/test-384-s7-mcp-start.cjs, tests/fixtures/384-s7-tools-list-golden.json. Commits 58c4c84bb, 7a1226376, 168315fe7, 2243db515, 23816150b, f27e30a65 are in the log. `ab-verdict outcome` exits 0. phase-guard prints OK. Parity group passes at HEAD.
