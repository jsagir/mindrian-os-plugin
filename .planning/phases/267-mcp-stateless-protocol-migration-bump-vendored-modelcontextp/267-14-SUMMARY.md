---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 14
subsystem: mcp
tags: [flag-on, daemon, isLegacyRequest, session-binding, dns-rebinding]
requires: [267-13]
provides:
  - "bin/mindrian-mcp-server.cjs flag-ON /mcp routed by protocol era: isLegacyRequest(toWebRequest(req, req.body), req.body) true -> serveLegacySession (session-keyed NodeStreamableHTTPServerTransport map, unchanged wiring), false -> createMcpHandler({ legacy: 'reject' }) via toNodeHandler"
  - "Host/Origin guards (hostGuard/originGuard) shared by flag-OFF and flag-ON /mcp and added to /event"
  - "flag-ON tree watcher targeting modernMcpHandler.notify.resourcesChanged; modern handler appended to mcpHandlers"
  - "no @modelcontextprotocol/sdk import left in bin/mindrian-mcp-server.cjs; sdk-era TEMPORARY ALLOWANCE deleted"
  - "tests/test-267-mcpv2-flag-on.cjs (MCPV2-06, MCPV2-17)"
affects: [267-15, 267-17, 267-18]
key-files:
  created:
    - tests/test-267-mcpv2-flag-on.cjs
  modified:
    - bin/mindrian-mcp-server.cjs
    - tests/test-267-mcpv2-sdk-era.cjs
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/deferred-items.md
decisions:
  - "Terminal-listener hoist (267-13 note) not done: outside this plan's scope and the plan forbids touching 267-13 lifecycle code beyond appending to mcpHandlers; recorded in deferred-items.md"
  - "The sdk-era EXPECT list needed no new entry: the local server was already listed; only the allowance map and its reporting were removed"
metrics:
  tasks: 2
  completed: 2026-10-02
---

# Phase 267 Plan 14: Flag-ON daemon era routing Summary

The flag-ON daemon now answers both protocol eras on one /mcp route: 2025 clients keep the session-keyed room binding (now on v2's Node transport), 2026-07-28 clients get a modern-only per-request handler, and the local server entry point no longer imports the v1 SDK.

PLAN_BASE=536b9d57c545235e1484e7b9dd533aa151ec812c

## What was built

1. **RED test** (1c13a510d): `tests/test-267-mcpv2-flag-on.cjs`, five arms plus hygiene. Pre-change: `PASS=4 FAIL=2` (legacy isolation and unknown-session 400 passed on today's daemon; the 2026-07-28 negotiation arm got `2025-11-25` and the rebinding arm got 200 for a bad Host).
2. **Routing** (7c74c8095), `bin/mindrian-mcp-server.cjs`:
   - The session-keyed legacy logic moved verbatim (same `sessionIdGenerator`, `onsessioninitialized`/`onsessionclosed`, `sessionRegistry` calls, per-session `createServer()`, 400 on unknown id) into `serveLegacySession(req, res)`, on `NodeStreamableHTTPServerTransport` from `@modelcontextprotocol/node`.
   - `/mcp`: Host and Origin guards, then on flag-ON `toWebRequest(req, req.body)` plus `isLegacyRequest(webReq, req.body)`; true goes to the legacy leg, false to the modern handler. Nothing the predicate calls modern can reach the legacy transport (T-267-33).
   - `/event` got the same two guards before `sseEventBus.subscribe`.
   - Flag-ON tree watcher targets `modernMcpHandler.notify.resourcesChanged()`; the modern handler is pushed onto `mcpHandlers`, so `exitAfterTeardown` closes it (T-267-10).
   - The v1 `streamableHttp.js` require is gone. `lib/core/session-binding.cjs` and `lib/mcp/session-registry.cjs` are untouched.
3. **sdk-era test** (same commit): `V1_ALLOWANCES` map and its reporting deleted; Arm C now fails on any v1 require in the ledger files.

## Verification (real output)

Every run used `HOME=$(mktemp -d) MINDRIAN_ROOMS_HOME=$(mktemp -d)`; port 3847 confirmed free afterwards.

```
$ node tests/test-267-mcpv2-flag-on.cjs
  ok legacy 2025: two concurrent sessions get distinct ids, room_bind is per-session, session file written
  ok legacy: an unknown mcp-session-id is 400
  ok modern 2026-07-28: auto-negotiating Client negotiates 2026-07-28 and lists the same tool names
  ok DNS rebinding: bad Host 403 on /mcp and /event, bad Origin 403, loopback Host served on both
  ok tree watcher boot did not fail
  ok process hygiene: the spawned daemon PID is dead after the run
RESULT: PASS=6 FAIL=0

$ node tests/test-267-mcpv2-sdk-era.cjs      RESULT: PASS=5 FAIL=0 SKIP=1   (Arm C: all three files v2-only; Arm D skip = package.json still lists v1, 267-17)
$ node tests/test-267-mcpv2-lifecycle.cjs    RESULT: PASS=5 FAIL=0   (flag-ON SIGTERM exit after 14 ms, pidfile cleared)
$ node tests/test-267-mcpv2-http-flag-off.cjs RESULT: PASS=6 FAIL=0
$ node tests/test-198-concurrency-mcp.test.cjs  PASS
$ node tests/test-248-surface-probes.cjs     25/25 green, 0 leg(s) skipped
$ bash tests/parity-198.sh                   Passed: 8 Failed: 0 Skipped: 0
$ bash tests/run-all-198.sh                  Passed: 13 Failed: 3 (Part 8, SPEC-2, SPEC-5 = baseline)
$ node tests/test-354-concurrency-surfaces.cjs  FAIL - 1 of 19 checks failed (K4 Playwright leg, ENV baseline)
$ bash tests/run-all-267.sh                  Phase 267: PASS=28 FAIL=3 SKIP=2
   FAILED: CIRS gates (c), zod4 contract (b)/(d), 354 concurrency surfaces -- all known baseline reds
   SKIPPED: CLI live probe (ENV GAP), in-repo clients (267-15, not yet landed)
```

Acceptance greps: `isLegacyRequest(` 1, `NodeStreamableHTTPServerTransport` 3, `legacy: 'reject'` 1, non-comment `@modelcontextprotocol/sdk` in the server 0, `TEMPORARY ALLOWANCE` in sdk-era 0, `createRequestStateCodec|inputRequired(` in bin/lib 0, `git diff $PLAN_BASE -- lib/core/session-binding.cjs lib/mcp/session-registry.cjs | wc -l` 0.

## Deviations from Plan

None - plan executed as written. No wire-snapshot description line needed refreshing (dual-era green). The dual-era repo-wide census arm passed inside the full runner this time (no peer interference observed).

### Observations

- The plan's optional hoist of the HTTP terminal listener was not done (see decisions); recorded in deferred-items.md.
- `tests/test-248-surface-probes.cjs` still drives the daemon with the v1 SDK *client* classes; that is a client, outside this plan's server-import criterion (267-15/17 territory).

## Known Stubs

None.

## Threat Flags

None. T-267-04 (rebinding guards on /mcp and /event, tested), T-267-07 (distinct ids, 400 on unknown, isolation arm), T-267-33 (strict isLegacyRequest routing, modern arm), T-267-10 (modern handler in mcpHandlers) mitigated; T-267-32 accepted as planned.

## Commits

- 1c13a510d test(267-14): add failing flag-ON era routing test
- 7c74c8095 feat(267-14): route the flag-ON daemon by protocol era, drop the last v1 server import

## Self-Check: PASSED
