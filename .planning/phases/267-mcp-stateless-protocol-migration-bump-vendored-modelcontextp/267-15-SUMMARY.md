---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 15
subsystem: mcp-clients
tags: [mcp, v2-client, shim, adapter-client, session-binding, rca-7]

requires:
  - phase: 267-14
    provides: flag-ON daemon routes legacy (2025-era) sessionful traffic to serveLegacySession
provides:
  - bin/mindrian-mcp-shim.cjs on @modelcontextprotocol/server/stdio + @modelcontextprotocol/client
  - lib/mcp/adapter-client.cjs on @modelcontextprotocol/client (default 2025 handshake)
  - tests/test-267-mcpv2-clients.cjs (MCPV2-06 client test)
affects: [267-17 (v1 removal; Arm D of sdk-era unblocks once no v1 import remains and package.json drops it)]

tech-stack:
  added: []
  patterns: ["clients keep the default 2025 handshake (no era auto-negotiation); daemon legacy path serves them"]

key-files:
  created: [tests/test-267-mcpv2-clients.cjs]
  modified: [bin/mindrian-mcp-shim.cjs, lib/mcp/adapter-client.cjs, tests/test-267-mcpv2-sdk-era.cjs]

key-decisions:
  - "RCA 7 arm re-pinned to the observed v2 behavior instead of forcing the old 400 (see Deviations)"
  - "Test drives the shim sequentially (wait for the initialize response), not with the pipelined helper, because a verbatim bridge races the handshake otherwise"

requirements-completed: [MCPV2-06, MCPV2-01]

duration: ~25min
completed: 2026-10-02
---

# Phase 267 Plan 15: Client migration Summary

**Both in-repo MCP clients (stdio-to-daemon shim and hook adapter-client) now run on the v2 client package with the default 2025-era handshake; the shim's session binding and queryDaemon work end to end, and the one place wire behavior changed (RCA 7) is pinned in the test and flagged below.**

PLAN_BASE=57436e591c57ca21d329e1bc0da629fe45d04915

## Commits

- 4e736137b test(267-15): failing client test (RED)
- f155bde1c feat(267-15): shim + adapter-client on the v2 client package, EXPECT_V2 ledger, RCA 7 arm re-pinned

## RED outcomes on the v1 clients (wire parity baseline)

Source arm FAILED (shim must require @modelcontextprotocol/client). The other three arms PASSED on v1: shim unbound (2025-11-25 initialize, tools/list count 45 equals snapshot, room_bind wrote exactly one session file naming room-x), RCA 7 pin (initialize never reached stdout, stderr carried "No valid session ID provided"), adapter (two queryDaemon('contract_version') calls). Hygiene arm passed.

## Verification output (GREEN, hermetic HOME and rooms home)

- `node tests/test-267-mcpv2-clients.cjs`: 5 passed, 0 failed (run twice)
- `node tests/test-267-mcpv2-sdk-era.cjs`: PASS=7 FAIL=0 SKIP=1 (Arm C lists shim and adapter-client as v2-only; Arm D SKIP: package.json still declares v1, awaits 267-17)
- `node tests/test-267-mcpv2-flag-on.cjs`: PASS=6 FAIL=0
- `node tests/test-198-concurrency-mcp.test.cjs`: PASS
- `bash tests/parity-198.sh`: Passed 8, Failed 0
- `node tests/test-248-surface-probes.cjs`: 25/25 green
- `bash tests/run-all-198.sh`: Passed 13, Failed 3 (Part 8 local-only floor, SPEC-2 contract-version, SPEC-5 hooks budget: the 267-BASELINE.md leg set, identical)
- `node tests/test-198-adapter-budget.test.cjs` red on `scripts/on-stop` 618 > 570 lines; `node tests/test-198-local-only.test.cjs` red on `lib/mcp/tools/sensors.cjs` token 'brain-client.cjs'. Both pre-existing, neither file touched here.
- `bash tests/run-all-267.sh`: PASS=29 FAIL=3 SKIP=1. The 3 reds are the known baseline set: CIRS check (c) 31 vs 32, zod4 contract, 354 concurrency (Playwright K4, ENV). New legs "in-repo clients (MCPV2-06)" and "flag-ON routing" PASS; brain shim canary PASS.
- Acceptance greps: `@modelcontextprotocol/sdk` on code lines of both files: 0; `versionNegotiation` count: 0 and 0; `clientOpts.sessionId = hookSessionId` count: 1 (line kept).
- No test-spawned daemon or shim survives (hygiene arm asserts the hermetic daemon PID is dead; shims SIGKILLed). The one mindrian-mcp-server.cjs left running from the dev tree (pid 371242) is a peer's, not mine.

## Deviations from Plan

**1. [Rule 1/4 boundary - behavior change, needs navigator awareness] RCA 7 pin could not stay "400 exactly as before".**
- Found during: Task 2 (pin arm went red after the migration).
- Cause: the v2 `StreamableHTTPClientTransport` (`_send`, client dist/index.cjs ~line 5620) deletes `mcp-session-id` from any initialize request (`if (isHandshake) headers.delete("mcp-session-id")`) and adopts the id the daemon returns. The v1 transport sent the pre-seeded id, which the daemon 400'd. So with MINDRIAN_SESSION_ID set the shim now CONNECTS and works, on a daemon-minted session id.
- What did NOT change: the D-02 gap. The hook id is still never the binding key (the daemon mints its own), so the CLI session and its daemon connection are still two namespaces. Threat T-267-07 disposition holds: no caller can choose a binding key. The shim's connected log line still says "(session <hook id>)", which is now misleading (left alone; the plan says keep every other line).
- Fix: I did not hack the transport to preserve a bug. The pin arm now asserts the observed state (initialize answered, no 400, room_bind works, exactly one new session file, none named after the hook id). A future identity-model decision flips it deliberately.
- Follow-up for the navigator: `.planning/debug/mcp-shim-preseeded-session-id-rejected.md` is now half-stale (the 400 symptom is gone on v2; the missing one-namespace binding remains). Not edited here (not in this plan's files).
- Files: tests/test-267-mcpv2-clients.cjs. Commit: f155bde1c.

**2. [Rule 3 - test driver] Sequential shim driver.** The shared `rpcOverStdio` helper pipelines initialize, initialized and requests; through the verbatim bridge the daemon answered "Server not initialized". The test uses its own `driveShim` that waits for the initialize response. No helper change.

**3. [Cosmetic] Comments reworded** so the `versionNegotiation` grep gate counts 0 even in comments, and the shim header's "vendored SDK" wording updated.

No peer-description wire snapshot refresh was needed (dual-era stayed green).

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None. Neither client talks to the Brain; lib/core/brain-client.cjs and lib/core/part8-egress-guard.cjs untouched.

## Self-Check: PASSED

- tests/test-267-mcpv2-clients.cjs, bin/mindrian-mcp-shim.cjs, lib/mcp/adapter-client.cjs: FOUND
- commits 4e736137b, f155bde1c: FOUND on main
