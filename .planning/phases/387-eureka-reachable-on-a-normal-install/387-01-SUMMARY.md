---
phase: 387-eureka-reachable-on-a-normal-install
plan: "01"
subsystem: mcp-eureka
tags: [rca, installed-layout, eureka, part-8]
requires: []
provides:
  - RCA with measured installed-layout tables for the 24 Eureka tools
  - tests/helpers/eureka-installed-layout-387.cjs (probe, reused by later Phase 387 tests)
  - tests/test-387-eureka-installed-layout.cjs (pinned before-state, arms I1 to I8)
  - tests/run-all-387.sh (glob runner, exit 77 is SKIPPED)
affects: [387-03, 387-05, 387-06, 387-09, 387-11]
key-files:
  created:
    - .planning/debug/eureka-engine-unreachable-on-normal-install.md
    - .planning/phases/387-eureka-reachable-on-a-normal-install/387-01-OBSERVATIONS.json
    - tests/helpers/eureka-installed-layout-387.cjs
    - tests/test-387-eureka-installed-layout.cjs
    - tests/run-all-387.sh
  modified: []
key-decisions:
  - "Runtime count settled: 24 eureka tools (75 tools in total); the auditor 23 omitted eureka_critic."
  - "perspective_without_engine: yes"
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 01: Reproduction and RCA Summary

Measured on an installed-layout copy of the pack (linked layout, scratch HOME, real stdio server, no engine): 24 Eureka tools are listed, 1 answers ok (eureka_graph_project, bound room only), 19 answer engine_not_configured, 3 answer job_session_not_found, and eureka_critic fails because its baseline file is not shipped.

## What was done

- Task 1: RCA started with 7 static findings read at HEAD (commit af5bd623c).
- Task 2: installed-layout probe and phase runner (commit 75c88cb2e).
- Task 3: probe run, RCA finished (8dc98d557), observation file (403d06318), pinned test (8675f34b0).

## Findings

- Runtime tools/list: 75 tools, 24 start with eureka, identical for the `claude-code` and `claude-ai` client identities in all 6 scenarios. Static expectation 24 confirmed.
- S1 (unset) and S2 (`env -i` launch) give the same table. S3 gives engine_checkout_unavailable. S4, S5 and S6 give engine_unavailable with a generic text.
- Graph tools open the room projection first (18 of 18 answer no_bound_room unbound).
- Every engine start is a plain `uv run` (4 of 4 argument lists); UV_OFFLINE is set on the graph workflow path only; the uv error line reaches the server stderr and never the caller.
- The research planner perspective answers ok on the installed layout with no engine and 0 network attempts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, new finding] eureka_critic fails on every install**
- **Found during:** Task 3 (probe run)
- **Issue:** `lib/core/eureka-critic.cjs` reads `evals/eureka/212-critic-baseline.json`; `package.json` "files" has no `evals` entry, so the pack lacks the file and the tool answers ENOENT.
- **Fix:** not fixed here (reproduction and RCA plan). Recorded as a NEW FAILURE with Required Code Change 9; no plan 387-03 to 387-11 covers it. The pinned test records the current behavior (arm I3) so a fix changes it on purpose.
- **Files modified:** none
- **Commit:** n/a

**2. [Rule 3 - Blocking] Helper additions beyond the plan text**
- The probe records `text` for text-only results, calls the shipped scout function directly in S6 (the scout path is not reachable through a tool when the fake uv fails the artifact step), and adds a positive control for the network counter. These are inside the helper file and were committed with the pinned test (8675f34b0).

### Not run

- `--npm-ci` layout: the run rules forbid network access, so every installed-layout claim is PROVEN for the linked layout and UNVERIFIED for the npm ci layout.
- The owner shell case (real engine) and any real Desktop or Cowork launch.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or schema was added; the probe uses a dead loopback Brain URL, a scratch HOME and fixture rooms.

## Self-Check: PASSED

- Files exist: the RCA, the observation file, the helper, the test, the runner (checked with `test -f`).
- Commits exist: af5bd623c, 75c88cb2e, 8dc98d557, 403d06318, 8675f34b0.
- `node tests/test-387-eureka-installed-layout.cjs`: 8 passed, 0 failed. `bash tests/run-all-387.sh`: PASS=2 FAIL=0 SKIPPED=0.
