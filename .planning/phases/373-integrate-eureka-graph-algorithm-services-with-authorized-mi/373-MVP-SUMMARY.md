---
phase: 373
plan: "MVP"
subsystem: mcp-eureka-adapter
tags: [eureka, mcp, hardening, rights-gate, experimental]
requires: [373-01]
provides:
  - host-side hardening of the five room-backed Eureka graph services (also called 373-02 in commits)
affects:
  - lib/mcp/tools/eureka-graph-projection.cjs
  - lib/mcp/tools/eureka-graph-discovery-signals.cjs
  - lib/mcp/tools/eureka-graph-analyze.cjs
  - lib/mcp/tools/eureka-capability-run.cjs
  - lib/core/navigation/engine-projection.cjs
  - docs/integrations/mindrian-eureka-engine.md
key-files:
  created:
    - tests/test-eureka-373-02-room-refusal.cjs
    - tests/test-eureka-373-02-precheck.cjs
    - tests/test-eureka-373-02-readiness.cjs
    - tests/test-eureka-373-02-offline-env.cjs
    - tests/test-eureka-373-02-error-scrub.cjs
  modified:
    - lib/mcp/tools/eureka-graph-projection.cjs
    - lib/mcp/tools/eureka-graph-discovery-signals.cjs
    - lib/mcp/tools/eureka-graph-analyze.cjs
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/core/navigation/engine-projection.cjs
    - docs/integrations/mindrian-eureka-engine.md
    - tests/test-eureka-graph-algorithm-services.cjs
decisions:
  - "Task 1 (lift files) was not done: the tree already holds the adapter and the five services (PROVEN by 373-01)."
  - "Offline forcing is scoped to callEurekaWorkflow (graph workflows). The scout and the generic bridge keep the old allowlist, because they may need to install an encoder extra."
  - "The opt-in name MINDRIAN_EUREKA_ALLOW_NETWORK=1 is ASSUMED. The plan says 'explicit opt-in' and names no variable."
  - "Tool descriptions were not changed. The plan text suffix is not added. No tool-schema byte change."
metrics:
  tasks: 5
  commits: 5
  completed: 2026-10-28
---

# Phase 373 MVP plan: hardening scope Summary

STATUS: DONE for the five approved items. Rights gate unchanged: the services are experimental and local-only. No text calls them ready.

## Items (each test-first; RED confirmed on the old code)

| # | Item | Commit | RED evidence |
|---|------|--------|--------------|
| 1 | Refuse a sealed room (GUARDRAIL.md, registry sealed or archived) and a room whose identity state is not `ready`, before any engine starts | 0a8d1ddc9 | Old code launched the engine and returned `engine_lineage_mismatch` |
| 2 | bridge_pairs limit 2,500 nodes and 12,000 edges; edge_atypicality `category_attribute` must be a projected node attribute key (default `problem_type`) | b9c2628d1 | Old code accepted 2,501 nodes |
| 3 | `readiness: experimental` on every service result; Known limits section in the guide (0 of 30 held-out edges in top 200, 2026-10-19; no numeric parity; authorship unresolved; local-only; no export path) | 73660f1b1 | Old result had no readiness field; guide had no section |
| 4 | Force `UV_OFFLINE`, `HF_HUB_OFFLINE`, `TRANSFORMERS_OFFLINE` to `1` in the graph workflow child, over hostile host values; exact opt-in lifts it | 325e4a4c7 | Old code did not pass `UV_OFFLINE` and passed `HF_HUB_OFFLINE=0` through |
| 5 | Fixed text for every engine call failure; engine message, stderr and extra keys dropped; unknown reason becomes `engine_failed` | 6eb4cb2fd | Old code forwarded engine text and paths |

The new typed reasons are `room_sealed`, `room_identity_not_ready`, `bridge_projection_too_large`, `unsupported_category_attribute` and `engine_failed`.

## Verification (PROVEN, run in this tree with HOME, USERPROFILE and MINDRIAN_ROOMS_HOME in temp dirs, UV_OFFLINE=1)

- Pass: the five new 373-02 tests, test-eureka-graph-algorithm-services, test-eureka-graph-discovery-signals, test-eureka-graph-projection, test-eureka-mcp-tools, test-eureka-capability-run, test-eureka-graph-opportunity-scout, test-341-eureka-no-brain-reach, test-341-eureka-deps-resolver, test-363.1-eureka-exclusion, test-363.1-eureka-tail, test-366-eureka-alias.
- Pass: test-270-tool-schema-budget (5/5, no re-baseline: descriptions unchanged), test-198-contract-schema (437 assertions), test-267-mcpv2-lockstep (6/6), `node scripts/build-connector-registry.cjs --check` prints OK.
- Pass (live, real Eureka stdio MCP, offline variables set): test-eureka-live-graph-algorithm-services. This proves the forced offline child still runs on this machine.
- `git diff --check` clean. No em-dashes or en-dashes in written files.

## Deviations from Plan

- [Rule 1 - Bug] test-eureka-graph-algorithm-services.cjs passed the number 1 as `category_attribute`. The new pre-check refuses it. The placeholder is now `'domain'`. No assertion was weakened.
- Item 3 envelope label: the assignment named the guide. The label in the guide needed a true envelope field, so `readiness: experimental` was also added to the result in code.
- Plan text suffix on tool titles and descriptions ("Experimental. Not validated ..."): not added. The assignment scoped item 3 to the guide. See NEXT.
- Plan Task 3 gate work (267 wire snapshots, 276 ledger, run-all-372 fix) not done: no tool was added or re-described, so no regeneration is needed. UNVERIFIED for the 276 ledger and run-all-372.

## Deferred and out of scope

- `tests/test-234-free-core-network-scan.cjs` still fails on `eureka-hsi-interpret-whitespace.cjs`, `identity.cjs` and `sensors.cjs`. None of the files changed here are in its failure list. Not fixed; a Part 8 allow-list change needs the navigator.
- Tool title and description suffix, and `annotations` wording ("starts a local process"): needs a decision because it changes tool-schema bytes and may touch generated connector files.
- Live bridge and job-cancel tests on an idle host were not re-run (UNVERIFIED).
- Peer working-tree changes (359 forward-harness fixtures, `.planning/debug/379-1-1-*`, pycache) are not owned by this work and were not touched.

## Known Stubs

None.

## Threat Flags

None. The change narrows what reaches an engine and what reaches the caller. It adds no endpoint, no auth path, no write path and no export path.

## Self-Check

PASSED. The five commits 0a8d1ddc9, b9c2628d1, 73660f1b1, 325e4a4c7 and 6eb4cb2fd are ancestors of HEAD. The five new test files exist.
