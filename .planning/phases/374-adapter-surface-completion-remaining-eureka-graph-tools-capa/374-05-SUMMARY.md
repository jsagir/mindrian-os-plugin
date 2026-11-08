---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 05
subsystem: testing
tags: [eureka, mcp, red-tests, job-path, lineage, catalog-cache, pair-screen]
requires: []
provides:
  - "tests/run-all-374.sh phase aggregator (glob discovery, found-equals-0 guard, dash fence, --neighbors)"
  - "RED tests T6 (start guards), T8 (job owner), T7 (result verifier), T13 (catalog cache)"
affects: [374-06]
tech-stack:
  added: []
  patterns: ["in-process fake MCP client and transport", "arm helper printing ok/FAIL at column 1"]
key-files:
  created:
    - tests/run-all-374.sh
    - tests/test-374-start-guards.cjs
    - tests/test-374-job-owner.cjs
    - tests/test-374-verify-result.cjs
    - tests/test-374-catalog-cache.cjs
  modified: []
key-decisions:
  - "Arm counts are fixed for plan 374-06: G 5, O 6, V 16, C 7."
  - "V2 to V9 follow the order of the behavior list. The threat model names V6 and V7 for the hash and byte checks; in the tests they are V7 and V8."
requirements-completed: [PLG374-04, ADAPT374-02, ADAPT374-04, ADAPT374-05]
duration: 40min
completed: 2026-11-08
---

# Phase 374 Plan 05: RED tests for the job path hardening Summary

Four failing tests state what plan 374-06 must build (start guards, owner binding, result verifier, catalog cache), and a glob-driven aggregator will show green only when it has. No product file changed.

## Tests and the plan that makes each green

| Test | File | Arms | First failing line | Green in |
|------|------|------|--------------------|----------|
| T6 start guards | tests/test-374-start-guards.cjs | G0 to G4 (5) | G0 requestTooLarge not exported | 374-06 |
| T8 job owner | tests/test-374-job-owner.cjs | O0 to O5 (6) | O0 session record has no session_key_hash | 374-06 |
| T7 result verifier | tests/test-374-verify-result.cjs | V0 to V15 (16) | V0 lib/mcp/eureka-pair-screen.cjs does not exist yet | 374-06 |
| T13 catalog cache | tests/test-374-catalog-cache.cjs | C0 to C6 (7) | C0 clearCatalogCache not exported | 374-06 |

## RED output (right reason: missing code, no syntax error)

```
$ node tests/test-374-start-guards.cjs   (exit 1)
FAIL - G0 the shared size helper requestTooLarge is exported by eureka-capability-run.cjs
  reason: requestTooLarge is not exported by lib/mcp/tools/eureka-capability-run.cjs yet (plan 374-06 adds the shared size helper and the job start guards)
FAIL - G1 a request over 20 MiB gives request_too_large and no child starts
  reason: a start with an oversize request must be refused (the job path has no size cap today)
FAIL - G2 a request without scope_id, or without snapshot_id, gives lineage_required and no child starts
  reason: a start without scope_id must be refused
ok - G3 a request with both ids and a normal size starts and returns a job id
FAIL - G4 the lineage check on a result is unconditional and the session closes in every case
  reason: no scope: expected engine_lineage_missing, got engine_lineage_mismatch
374 start guards: 5 arms, 4 failed

$ node tests/test-374-job-owner.cjs   (exit 1)
FAIL - O0 the caller identity seam exists: the session record binds to the injected identity
  reason: the session record has no session_key_hash from deps.callerIdentity yet (plan 374-06 adds the callerIdentity seam to startCapability, jobStatus, jobResult and cancelJob)
ok - O1 the same session reads status, cancel and result of its own job
FAIL - O2 another session gets job_session_wrong_owner and the engine gets no call
  reason: status by another session, got undefined
FAIL - O3 the same session key with another bound room gets job_session_wrong_owner
  reason: status from another room, got undefined
FAIL - O4 the stored record holds session_key_hash (64 hex) and never the raw session id
  reason: session_key_hash must be 64 hex characters
ok - O5 an unknown job id still gives job_session_not_found
374 job owner: 6 arms, 4 failed

$ node tests/test-374-verify-result.cjs   (exit 1)
FAIL - V0 ... through FAIL - V15 ...   (16 of 16 fail)
  reason (each): lib/mcp/eureka-pair-screen.cjs does not exist yet (plan 374-06 creates it)
374 verify result: 16 arms, 16 failed

$ node tests/test-374-catalog-cache.cjs   (exit 1)
FAIL - C0 clearCatalogCache is exported by eureka-capability-run.cjs
  reason: clearCatalogCache is not exported by lib/mcp/tools/eureka-capability-run.cjs yet (plan 374-06 adds the catalog cache)
FAIL - C1 two calls for one root fetch the catalog once and each contract once
  reason: scout_capabilities calls for three runs of one root, expected 1, got 3
FAIL - C2 after clearCatalogCache() the next call fetches again
  reason: clearCatalogCache is not exported ... yet (plan 374-06 adds the catalog cache)
FAIL - C3 a different engine root fetches again
  reason: one root, two calls: expected 1 catalog fetch, got 2
FAIL - C4 a changed modification time of pyproject.toml fetches again
  reason: before the touch: expected 1 catalog fetch, got 2
FAIL - C5 startCapability and callEurekaCapability share the cache for one root
  reason: both paths, one root: expected 1 catalog fetch, got 4
FAIL - C6 an entry lives 30 minutes (injected clock)
  reason: setCatalogClock is not exported ... yet (plan 374-06 adds the catalog cache)
374 catalog cache: 7 arms, 7 failed

$ bash tests/run-all-374.sh   (exit 1)
>>> test-374-approval-gate.cjs: PASSED          (peer plan 374-03 file, not mine)
>>> test-374-catalog-cache.cjs: FAILED (exit 1)
>>> test-374-job-owner.cjs: FAILED (exit 1)
>>> test-374-start-guards.cjs: FAILED (exit 1)
>>> test-374-verify-result.cjs: FAILED (exit 1)
>>> 374 dash fence: PASSED
Phase 374: PASS=2 FAIL=4 SKIPPED=0
```

Arms that pass now by design (they pin behavior that must not change): G3, O1, O5.

The aggregator is red by design until plan 374-06. It is not registered in tests/run-all-366.sh yet (plan 374-14 does that).

## Aggregator checks

- `TEST_374_PREFIX=tests/test-374-nonexistent- bash tests/run-all-374.sh` prints "no tests/test-374-nonexistent-* files discovered" and exits 1 (PROVEN).
- `bash tests/run-all-374.sh --neighbors` appends the explicit list. Result on this tree: all 26 neighbor tests, `test-384-s7-mcp-start.cjs parity` and `build-connector-registry.cjs --check` PASSED; the only FAILED legs were the four RED files (PASS=30 FAIL=4).
- A neighbor file that does not exist is a FAILED leg, not a skip. All 26 named files exist.

Neighbor list as written: test-eureka-capability-run, test-eureka-mcp-tools, test-eureka-graph-algorithm-services, test-eureka-graph-discovery-signals, test-eureka-graph-projection, test-eureka-graph-opportunity-scout, test-387-eureka-route-needs, test-387-eureka-egress, test-387-eureka-engine-states, test-387-eureka-installed-layout, test-387-eureka-fake-engine, test-387-eureka-command-wiring, test-387-eureka-docs-wording, test-eureka-373-02-error-scrub, test-eureka-373-02-offline-env, test-eureka-373-02-precheck, test-eureka-373-02-readiness, test-eureka-373-02-room-refusal, test-341-eureka-no-brain-reach, test-289-review-fixes, test-270-tool-schema-budget, test-267-mcpv2-dual-era, test-267-mcpv2-zod4-contract, test-267-mcpv2-clients, test-267-mcpv2-registration-api, test-267-mcpv2-lockstep; then `node tests/test-384-s7-mcp-start.cjs parity` and `node scripts/build-connector-registry.cjs --check`.

## Interface the tests fix for plan 374-06

- `eureka-capability-run.cjs` exports `requestTooLarge`, `MAX_REQUEST_BYTES` (20 MiB), `clearCatalogCache`, `setCatalogClock` (no argument restores the real clock). A cache entry is valid for less than 30 minutes and expires after it (tests use 30 min minus 1 s and plus 1 s).
- `deps.callerIdentity(extra)` returns `{ sessionKeyHash, roomId }`; it is the last argument of startCapability, jobStatus, jobResult and cancelJob. The session record field is `session_key_hash`. The record must not hold the raw session id in any property.
- A wrong caller gets `job_session_wrong_owner` and the engine client receives no scout_status, scout_result or scout_cancel call; the owner session stays open.
- `verifyPairScreenResult(result, { capability_id, scope_id, snapshot_id })` returns `{ ok:false, reason, message }` or `{ ok:true, status, shortlist_empty, summary:{ counts, label, manifest_sha256, caps_hit, warnings, ... } }`. For completed_empty the returned object (any field) holds a sentence that matches "does not show that no opportunity exists"; a completed result does not. The message is a fixed sentence.
- Result lineage arms: no `scope` gives engine_lineage_missing; a different scope_id or snapshot_id gives engine_lineage_mismatch.

## Deviations from Plan

None in scope. Two notes:
- The plan threat model names V6 and V7 for the hash and byte checks. The behavior list (which the tests follow) puts them at V7 and V8. The arm counts are as the plan fixes them.
- I checked the V arms against a throwaway reference implementation kept outside the repo (scratchpad): 16 of 16 pass, so the arms are satisfiable and consistent. It is not committed.

## Known Stubs

None.

## Threat Flags

None. No product file, network call or process spawn was added. The tests start no process.

## Self-Check: PASSED

- All five created files exist. All five are ASCII only (grep for non-ASCII bytes returned 0 for each).
- The existing tests test-387-eureka-fake-engine.cjs and test-eureka-capability-run.cjs still pass (exit 0).
