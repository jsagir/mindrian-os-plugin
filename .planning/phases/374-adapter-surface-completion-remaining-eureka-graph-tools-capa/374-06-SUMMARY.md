---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 06
subsystem: mcp
tags: [eureka, mcp, job-path, lineage, owner-binding, catalog-cache, pair-screen-verifier]
requires: ["374-03", "374-05"]
provides:
  - "requestTooLarge, MAX_REQUEST_BYTES, clearCatalogCache, setCatalogClock, getCatalog, getContract exported by eureka-capability-run.cjs"
  - "start guards (request_too_large, lineage_required), unconditional result lineage check, job owner binding (job_session_wrong_owner) in eureka-capability-jobs.cjs"
  - "lib/mcp/eureka-pair-screen.cjs: verifyPairScreenResult, PAIR_SCREEN_CAPABILITY_ID, RESULT_SCHEMA_VERSION, LABEL"
affects: [374-08, 374-10, 374-13]
tech-stack:
  added: []
  patterns: ["deps.callerIdentity seam as the last argument", "fixed-sentence refusals that never repeat result text", "per-process cache keyed by engine root and pyproject.toml mtime"]
key-files:
  created:
    - lib/mcp/eureka-pair-screen.cjs
  modified:
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - tests/test-341-eureka-no-brain-reach.cjs
    - tests/test-387-eureka-egress.cjs
    - tests/test-eureka-capability-run.cjs
    - tests/test-387-eureka-engine-states.cjs
    - tests/helpers/eureka-installed-layout-387.cjs
key-decisions:
  - "The snapshot_id omitted from a result scope gives engine_lineage_missing (a scope without both ids counts as no lineage)."
  - "The owner check runs before the expiry answer, so a wrong caller learns nothing about an expired job."
  - "The verifier also checks that the listed manifest.json file hash equals manifest_sha256."
requirements-completed: [PLG374-04, ADAPT374-02, ADAPT374-04, ADAPT374-05]
duration: 45min
completed: 2026-11-08
---

# Phase 374 Plan 06: Job path hardening and the pair-screen result verifier Summary

The generic Eureka job path now refuses an oversize request and a request without scope_id and snapshot_id before any child starts, refuses a result without matching lineage, binds each retained job to its session and room, caches the catalog and contracts per process, and has a pure pair-screen result verifier. The four RED tests of plan 374-05 are green.

## Engine request model check (read only, cat only)

File: /home/jsagi/dev/mindrian-eureka/src/mindrian_eureka/opportunity_pairs/mcp_server.py. PROVEN by reading.

| Model | Route | scope_id | snapshot_id |
|-------|-------|----------|-------------|
| ScoutRunInput | scout_start | accepted, required | accepted, optional |
| OpportunityScoutInput | scout_start_opportunity_signal_scout | accepted, required | accepted, optional |
| PairScreenInput | scout_start_pair_screen (later plan) | accepted, required | accepted, required |

No model rejects either field, so requiring both ids on every async route is safe. No NEEDS_HUMAN.

## What changed

- eureka-capability-run.cjs: `requestTooLarge(request)` is the one size rule; `callEurekaCapability` uses it (same answer as before). Catalog cache: Map keyed by engine root plus pyproject.toml mtime (0 when missing), 30 minutes per entry, a failed fetch is never stored, callers get a structuredClone, a changed mtime drops older entries of the same root. A contract is stored only when it matches the capability and carries both schemas. `invokeCapabilityWithClient` takes an optional sixth argument `cacheRoot`; without it the function behaves as before.
- eureka-capability-jobs.cjs: start guards run after the shape check and before the engine root and the session limit. `callerIdentity(extra, ctx)` builds `{ sessionKeyHash, roomId }` from resolveEffectiveSessionId, gate-ledger ledgerSessionKey (sha256 of the key) and resolveMcpSessionRoom with noFloor; it never throws. Session record holds session_key_hash and room_id. `getSession(jobId, caller)` returns job_session_wrong_owner (no job detail, no engine call). `jobResult` lineage check is unconditional. `register(server, ctx)` passes `{ ctx }`. No description or inputSchema changed.
- lib/mcp/eureka-pair-screen.cjs: requires only node:crypto. Check order: schema_version, capability_id, scope present, scope equal to expect, status, label, room_write and portfolio_write, approval.verified_by_engine, shapes of counts, caps_hit, warnings, manifest_sha256, outputs, files, then each file (inline hash and UTF-8 byte count; a non-inline file with content is invalid), then manifest.json hash against manifest_sha256. Refusals are four fixed sentences. A good result returns counts, label, summary_line marked untrusted, manifest_sha256, caps_hit, warnings, file list without content, and host_handoff state and owner. completed_empty adds the fixed sentence "An empty shortlist does not show that no opportunity exists."

## RED then GREEN of the scan lists

RED, after adding `lib/mcp/eureka-pair-screen.cjs` to EUREKA_SURFACE_FILES (test-341) and `eureka-pair-screen.cjs` to LIB_MCP_EXTRA (test-387-egress) and before the module existed:

```
FAIL: no Brain/Theo reach in lib/mcp/eureka-pair-screen.cjs (comment lines excluded) -- ... must exist
eureka-no-brain-reach: PASS=22 FAIL=2
FAIL - P1 static: ...   lib/mcp/eureka-pair-screen.cjs: guarded module is missing
test-387-eureka-egress: 21 passed, 1 failed
```

GREEN after the module: test-341 PASS=24 FAIL=0, test-387-egress 22 passed 0 failed.

## Results (PROVEN, run in this tree)

- Before the plan: `bash tests/run-all-374.sh --neighbors` gave PASS=30 FAIL=4 (the four RED files).
- After: `bash tests/run-all-374.sh` gives PASS=6 FAIL=0 (exit 0): approval-gate, catalog-cache (7 arms), job-owner (6), start-guards (5), verify-result (16), dash fence.
- After: `bash tests/run-all-374.sh --neighbors` gives PASS=34 FAIL=0 (exit 0).
- test-270-tool-schema-budget: 5 passed, 0 failed. test-384-s7-mcp-start parity: ALL PASS. build-connector-registry --check: OK.
- test-234-free-core-network-scan: PASS=16 FAIL=3, the same three files as before (eureka-hsi-interpret-whitespace.cjs, identity.cjs, sensors.cjs); no fourth file.
- test-387-eureka-engine-requirements 13/13 and test-387-eureka-route-needs 9/9 pass.

## Existing tests edited (and why)

1. tests/test-eureka-capability-run.cjs: three edits. The injected lineage-omission session records now carry `session_key_hash` of the default caller (they are owned sessions). The expected reason for an omitted scope or an omitted scope.snapshot_id is now engine_lineage_missing (capability_id omission stays engine_lineage_mismatch). The session-limit start request now carries scope_id and snapshot_id, because the start guard runs before the session limit.
2. tests/test-387-eureka-engine-states.cjs (lines 179 and 200) and tests/helpers/eureka-installed-layout-387.cjs (line 57): the eureka_capability_start requests were `{}`; they now carry scope_id and snapshot_id, so the tests still reach the engine-state refusals they check (engine_unavailable). These three files were not in files_modified; the edit is the smallest change that keeps the existing tests meaning the same thing (deviation, Rule 3).
3. tests/test-eureka-live-capability-jobs.cjs: no edit needed (its requests already carry the ids; it is live and was not run).

## Pins

No 384 golden, 267 snapshot or test-270 constant changed, and none turned red. Descriptions and schemas did not change. The G8 line in test-387-eureka-engine-states prints "description bytes: baseline 9096, now 9355"; it is an info line from before this plan and the test passes.

## Deviations from Plan

**1. [Rule 3 - Blocking] Existing 387 tests sent a start request without ids.**
- Found during: Task 3 neighbor run (test-387-eureka-engine-states and test-387-eureka-installed-layout failed with lineage_required).
- Fix: added the two ids to the three request literals named above.
- Commit: see below.

## Known Stubs

None.

## UNVERIFIED

- Multi-host behavior (Claude Desktop, Cowork) of the default callerIdentity: only the injected seam and the no-session process key were exercised.
- The real engine result shape: the verifier is checked against the shape in the contract document and the test builder, not against a live pair-screen result (no live engine run, D-02). The manifest.json versus manifest_sha256 equality is taken from the contract text ("hash of manifest.json"); a real engine that hashes a different form would be refused as engine_result_hash_mismatch.
- tests/test-eureka-live-capability-jobs.cjs and the live bridge test were not run (live).
- Pair-screen route registration, PAIR_SCREEN_IDS and gate wiring are not done here (later gated plans).

## Threat Flags

None. The new module and the new requires in the jobs file stay inside the Part 8 scan lists.

## Self-Check

Run after the commit; see the report of the executor (files exist, commit lists exactly the paths).
