---
phase: 373
plan: "01"
subsystem: mcp-eureka-adapter
tags: [eureka, mcp, graph-algorithms, lineage, authorization]
requires: []
provides:
  - five room-backed Eureka graph algorithm tools with fail-closed lineage and typed engine refusals
  - catalog-derived live capability audit (no frozen counts)
affects: [lib/mcp/tools/eureka-graph-discovery-signals.cjs, docs/integrations/mindrian-eureka-engine.md]
key-files:
  created:
    - tests/test-eureka-graph-algorithm-services.cjs
    - tests/test-eureka-live-graph-algorithm-services.cjs
  modified:
    - lib/mcp/tools/eureka-graph-discovery-signals.cjs
    - tests/test-eureka-live-capability-run.cjs
    - tests/test-eureka-live-bridge.cjs
    - docs/integrations/mindrian-eureka-engine.md
    - commands/eureka.md
    - skills/eureka/SKILL.md
decisions:
  - "Keep the existing single-file table (5 specs, 5 independently registered tools, names eureka_graph_find_shared_neighbor_gaps etc.) instead of splitting into 5 files with the plan's file names. Reason: already shipped in 4a32b0937, registered, connector rows present, registry --check OK."
  - "Do not re-port the adapter wave. The review worktree /tmp/mos-eureka-review no longer exists, and the 18 adapter files already live in this tree (commits 1ebed69e3, 4a32b0937)."
metrics:
  tasks: 3
  commits: 2
  completed: 2026-10-28
---

# Phase 373 Plan 01: Adapter wave and five room-backed graph services Summary

STATUS: DONE (plan was mostly already implemented; this run closed the gaps). Two commits, no re-port.

## What already existed (PROVEN by reading code and running tests)

- Adapter wave: 18 eureka tool files in `lib/mcp/tools/`, `lib/mcp/eureka-tool-contract.cjs`, `lib/core/navigation/engine-projection.cjs`, generic run and job tools. Commits 1ebed69e3 and 4a32b0937.
- The five services: `lib/mcp/tools/eureka-graph-discovery-signals.cjs` registers five separate tools over `eureka_graph_project` logic and the shared stdio MCP client. Connector ledger rows exist.
- Generic async job path already rejects missing capability, scope, and snapshot lineage when the start request bound them. Covered by `tests/test-eureka-capability-run.cjs` (omitted capability_id, scope, snapshot_id). The plan statement "current code accepts omitted identity" was stale.
- Review worktree `/tmp/mos-eureka-review`: missing (UNVERIFIED comparison against it; not needed).

## Gaps found and closed

1. Catalog counts. The live catalog now has 67 entries: 59 runnable, 8 unavailable, 54 `eureka-workflow` routes, 5 other CLI route assignments in 4 executables. The plan's 66/58/53 are already stale. `tests/test-eureka-live-capability-run.cjs` had literal 59/8/54. It now derives counts and the route histogram from the catalog, asserts every status is accounted for, and compares the installed `eureka-workflow` CLI choices with the catalog shared-workflow IDs. Docs, `commands/eureka.md`, `skills/eureka/SKILL.md` updated to 67/59/8/54 with a note that the test derives them.
2. Live bridge test failure (root cause proven). `tests/test-eureka-live-bridge.cjs` failed at the real-bound `graph.explore_local_relationships` step with a misleading `engine_lineage_mismatch`. Root cause: the fixture room had 0 edges, the current engine returns `invalid_input` ("hole swap null needs at least 2 distinct edges"), and the host mapped a status-only reply to a lineage error. Fixture now has 3 edges.
3. Five services hardening in `eureka-graph-discovery-signals.cjs`:
   - Refuse a projection without non-empty scope and snapshot identity before any engine start.
   - Require non-empty string `scope_id` and `snapshot_id` in the engine result (a null host id could no longer match a null result id).
   - Map engine `invalid_input`, `failed`, `blocked`, `cancelled`, `expired` to typed `engine_<status>` refusals with fixed text; engine free text is not forwarded.
4. Tests. New unit matrix `tests/test-eureka-graph-algorithm-services.cjs` (RED confirmed on the old code, then GREEN) and live test `tests/test-eureka-live-graph-algorithm-services.cjs`.
5. Docs: the five tools were not documented. Added one bullet to `docs/integrations/mindrian-eureka-engine.md`.

## Commits

- 808d04508 test(373-01): derive Eureka catalog counts from source and fix zero-edge live fixture
- 57b674c4c feat(373-01): typed engine statuses and identity guard for the five graph services

## Verification (all run in this tree with HOME, USERPROFILE, MINDRIAN_ROOMS_HOME in temp dirs; UV_OFFLINE=1, HF offline)

- PROVEN pass: test-eureka-graph-algorithm-services, test-eureka-graph-discovery-signals, test-eureka-graph-projection, test-eureka-capability-run, test-eureka-mcp-tools, test-eureka-graph-opportunity-scout, test-198-contract-schema (437 assertions), test-270-tool-schema-budget (5/5, 75 tools, ~20881 tokens, no re-baseline needed: tool count and descriptions unchanged), test-363.1-eureka-exclusion, test-363.1-eureka-tail, test-366-eureka-alias.
- PROVEN pass (live, real Eureka stdio MCP and installed CLI): test-eureka-live-capability-run (59 runnable contracts, 8 unavailable refused, CLI IDs equal catalog), test-eureka-live-bridge, test-eureka-live-graph-algorithm-services (all 5 services through the real session resolver and a bound temp room; installed CLI parity of envelope and shape; partial disclosure; unbound refusal; room.db hash unchanged).
- PROVEN: `node scripts/build-connector-registry.cjs --check` prints OK. `git diff --check` clean. No em-dashes or en-dashes in written files.

## Deviations from Plan

- [Rule 1 - Bug] Zero-edge live fixture fixed (item 2 above).
- [Rule 2 - Missing critical] Identity guard and typed status mapping (item 3).
- Plan Wave 2 file layout (five separate files, other tool names) not followed; functional equivalent already shipped. Renaming would break shipped tool names. If the owner wants the plan names, that is a separate rename task.
- No connector regeneration was needed: no tool added, renamed or re-described. `contract-version.cjs` not bumped.
- `test-eureka-live-opportunity-scout.cjs` and the RS+HSI scout leg were not exercised with a real encoder: the Hugging Face model is not available offline in the temp HOME. The test prints the accepted "ENGINE UNAVAILABLE" outcome.

## Deferred Issues / Out of scope

- `tests/test-234-free-core-network-scan.cjs` FAILS on `lib/mcp/tools/eureka-hsi-interpret-whitespace.cjs`, `identity.cjs`, `sensors.cjs` (forbidden network token). None of these were touched by this plan. UNVERIFIED whether it also failed before commit 1ebed69e3. Needs its own task.
- Observed (once): with a fixed `seed`, `graph.find_network_holes` null-model statistics (null_mean, z) differed between the CLI process and the MCP process on the same snapshot. Cause UNVERIFIED (not investigated; Eureka-side). The live test compares only the deterministic envelope and shape.
- Items in `373-MVP-PLAN.md` (sealed-room refusal, node and edge limit pre-checks for bridge pairs, `readiness: experimental` label, offline env forcing, error-text path scrub) are NOT done. That plan is a draft awaiting owner approval and it is not this plan.
- Plan item 3 re-review items (job session caps and expiry, cancellation on scout paths, structured output annotations) were not re-audited line by line beyond running their existing tests (all pass).
- `scripts/__pycache__/compute-hsi.cpython-312.pyc` shows modified in the tree after live runs. Not committed. Not owned by this plan.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or file access was added. The change narrows acceptance of engine output.

## Self-Check: PASSED

- Files exist: both new tests, SUMMARY. Commits 808d04508 and 57b674c4c are ancestors of HEAD.
