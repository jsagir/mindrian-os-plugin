---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 12
subsystem: mcp
tags: [http, createMcpHandler, rca, dns-rebinding, cowork, toNodeHandler]
requires: [267-11]
provides:
  - "bin/mindrian-mcp-server.cjs flag-OFF /mcp route served per request by toNodeHandler(createMcpHandler(() => createServer(), { legacy: 'stateless' })), both protocol eras, localhost Host/Origin guards"
  - "side-effect-free createServer(): tree watcher starts once per process in main() with a per-branch target; stdio server singleton is lazy"
  - "@modelcontextprotocol/node 2.1.0 (VETTED) in package.json, package-lock.json, npm-shrinkwrap.json"
  - "tests/test-267-mcpv2-http-flag-off.cjs (MCPV2-05, MCPV2-17)"
  - "RCA 1 resolved with before/after output"
affects: [267-13, 267-14]
key-files:
  created:
    - tests/test-267-mcpv2-http-flag-off.cjs
    - .planning/debug/resolved/mcp-http-flag-off-one-request-per-process.md
  modified:
    - bin/mindrian-mcp-server.cjs
    - package.json
    - package-lock.json
    - npm-shrinkwrap.json
    - references/security/cve-db.json
    - tests/fixtures/267/wire-snapshot-zod4.json
    - .planning/debug/knowledge-base.md
decisions:
  - "Installed @modelcontextprotocol/node at 2.1.0 to match server/core/client 2.1.0 (one family version); npm now shows @modelcontextprotocol/server 2.2.0 as latest, recorded as a follow-up"
  - "Flag-ON branch starts no tree watcher in this plan (its old watcher bound to a never-connected singleton and delivered nothing); 267-14 wires it to the modern handler"
  - "Plain require of @modelcontextprotocol/node inside the HTTP branch (per plan); createMcpHandler comes from the existing top-level requireWithHeal of @modelcontextprotocol/server"
metrics:
  tasks: 2
  completed: 2026-10-02
---

# Phase 267 Plan 12: Flag-OFF HTTP via createMcpHandler (RCA 1) Summary

The flag-OFF HTTP branch now serves a whole conversation instead of one request: every `/mcp` request is answered by a fresh server built through `createMcpHandler(() => createServer(), { legacy: 'stateless' })` behind `toNodeHandler`, both protocol eras work, and the loopback endpoint refuses DNS rebinding with a 403 before any MCP handling.

PLAN_BASE=88317b8539c12433d1f2c424f065ab2b2f291534

## Commits

| Step | Commit | What |
|------|--------|------|
| Task 1 | b16e31824 | RED test: multi-request, dual-era, rebinding, latency |
| Task 2 (deps) | 96a4eba39 | `@modelcontextprotocol/node` 2.1.0 in manifest + both lockfiles, VETTED allowlist entry |
| Task 2 (fixture) | 694cd2ae4 | refresh one `orchestration` description in the zod4 wire snapshot (peer 366-16 wording) |
| Task 2 (fix) | a3e09b249 | flag-OFF route on createMcpHandler, guards, watcher hoist, test arm fix |
| Task 2 (RCA) | b8fb9ba46 | RCA 1 resolved + knowledge-base block |

## Root cause (RCA 1, restated)

One `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` was built at boot and reused for every request. A stateless transport throws "Stateless transport cannot be reused across requests" on its second call; hono turns that into a bare empty 500. A stateless transport is per request by definition, so the fix shares the factory and never the transport.

## Verification output (all with fresh `HOME=$(mktemp -d) MINDRIAN_ROOMS_HOME=$(mktemp -d)`)

Request-by-request statuses, same sequence on the same hermetic server:

| Request | Before (pre-fix) | After |
|---------|------------------|-------|
| initialize | 200 | 200 |
| notifications/initialized | 500 | 202 |
| tools/list | 500 | 200 |
| tools/call contract_version | 500 | 200 |
| tools/list #2 | 500 | 200 |
| 2026 v2 Client (auto) | "Version negotiation failed: the server answered the probe with HTTP 500" | negotiates 2026-07-28 |

RED run (pre-fix tree): `RESULT: PASS=2 FAIL=4` (only the watcher-boot and port-free arms passed).

GREEN run:

```
  ok legacy 2025 over raw HTTP: initialize, initialized, tools/list, tools/call, then 5 more tools/list, every one 2xx
  ok era 2026: v2 Client over StreamableHTTPClientTransport negotiates 2026-07-28 and lists the same tool names
  ok DNS rebinding: bad Host 403, bad Origin 403, loopback Host without Origin 200, localhost Origin 200
    tools/list latency ms: p50=13 p95=24 max=24 all=13,13,24,12,15,16,13,12,14,12
  ok latency: 10 sequential tools/list each under 5000 ms (p50/p95 recorded)
  ok tree watcher boot did not fail (once-per-process is gated structurally by the createServer grep)
  ok process hygiene: port 3847 is free after the run

RESULT: PASS=6 FAIL=0
```

Per-request build cost: p50 13 ms, p95 24 ms for tools/list (bound 5000 ms), so the factory-per-request cost is negligible.

Acceptance greps: `grep -c statelessTransport bin/mindrian-mcp-server.cjs` = 0; `grep -c "createMcpHandler("` = 3 (one real call, two in comments); `grep -c "localhostHostValidation()"` = 1; `awk '/^function createServer/,/^}/' ... | grep -c startTreeWatcher` = 0; `grep -rn "createRequestStateCodec\|inputRequired(" bin lib | wc -l` = 0.

Battery:

| Check | Result |
|-------|--------|
| `test-267-mcpv2-dual-era.cjs` (stdio unaffected by the hoist) | PASS=5 FAIL=0 |
| `test-248-surface-probes.cjs` (flag-ON HTTP legs) | 25/25 green |
| `test-267-mcpv2-lockstep.cjs` | PASS=6 FAIL=0 (six `@modelcontextprotocol/*` deps, all VETTED, incl. node) |
| `test-341-shrinkwrap-no-dev.cjs` | PASS=4 FAIL=0 |
| `test-266-connect-path-process-budget.cjs` | 7 passed, 0 failed |
| `test-267-mcpv2-sdk-era.cjs` | PASS=5 FAIL=0 SKIP=1 (temporary v1 allowance unchanged) |
| tree-watcher tests (270 cross-room-fence, baseline-schema-driven, no-second-walker) | PASS; `test-270-dynamic-tree` FAIL = known baseline (old `resource()` stub) |
| `bash tests/run-all-198.sh` | Passed 13 Failed 3 (Part 8 floor, SPEC-2, SPEC-5), identical to baseline |
| `bash tests/run-all-199.sh` | Passed 3 Failed 2 (AS-01/06/07, AS-09), identical to baseline |
| `bash tests/run-all-267.sh` | PASS=26 FAIL=3 SKIP=4; the 3 are CIRS (c), zod4 (b)(d), 354 concurrency K4, known baseline. (One suite run also showed the brain-shim canary red; run alone it is PASS=6 FAIL=0, so it is flaky under the full suite, not a regression) |
| `node scripts/check-release-payload-ceiling.cjs --check` | OK (0 findings), run via run-all-267 |
| em-dash grep on added lines | 0 |

## Deviations from Plan

**1. [Rule 3 - Blocking] Snapshot refresh.** `test-267-mcpv2-dual-era.cjs` (a plan-listed regression check) went red on `tool:orchestration:description` after peer commit 8a66273ce (366-16, the router stubs now point at `research_run` perspective ops) changed the live description. Same precedent as 267-11's snapshot refresh: refreshed that one description in `tests/fixtures/267/wire-snapshot-zod4.json` (measured against the live wire, one line), separate commit 694cd2ae4. Not in the plan's `files_modified`. If peer 366 keeps moving descriptions this fixture will need refreshing again.

**2. [Rule 1 - Bug in my own RED test] Rebinding arm used `fetch`.** Node's `fetch` (undici) does not let a caller override `Host`, so the first version of the Host arm sent a loopback Host and got 200. Switched the rebinding arms to `node:http` in the fix commit. The RED commit therefore failed on the multi-request, 2026 and latency arms (the rebinding arm failed there on the unrelated bare 500), not on a clean "200 for Host evil.example"; the guard behavior is now proven GREEN with a real foreign Host header.

**3. [Rule 3 - lockfile hygiene] Shrinkwrap root version.** `npm install` rewrote `npm-shrinkwrap.json` root version beta.55 to beta.56; restored to beta.55 (267-10 precedent; lockstep check 2 excludes the root version by design). `package-lock.json` is not rewritten by npm when a shrinkwrap exists, so the new package block and the dependency line were added by hand, byte-copied from the shrinkwrap, to keep both files in lockstep (lockstep Check 1 and 2 pass).

**4. Task-order note.** The tree-watcher hoist, handler swap, and guards landed in one commit (a3e09b249) rather than a separate hoist commit, since the plan lists one fix commit.

No auth gates. `git status --short` was clean on every file before I edited it. No peer-owned file was written (no connector/honesty data, no `tool-router.cjs`).

## Follow-ups / peer findings

- npm now lists `@modelcontextprotocol/server` 2.2.0 as latest. This plan stays on the 2.1.0 family (client/core/server/node all 2.1.0). A family bump is a separate decision.
- Cowork probe still PENDING (A7: does real Cowork reach the flag-OFF HTTP branch). RCA 1 is fixed regardless; recorded in the resolved RCA.
- The flag-ON branch still starts no tree watcher and still carries the single v1 `StreamableHTTPServerTransport` require (267-14).
- `references/security/cve-db.json` note says hono peer is optional and already present as `@modelcontextprotocol/sdk`'s own dependency (`npm ls hono` shows `hono@4.12.9` deduped under both sdk and node); no new hono install.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-267-04 (rebinding) mitigated and test-armed with Host and Origin cases; T-267-05 unchanged (express.json 100 KB limit runs first); T-267-06 mitigated (createServer grep gate, p50/p95 recorded); T-267-SC mitigated (same family version, official repo, no install scripts, dated VETTED entry, lockstep and payload gates green); T-267-11 grep is 0; T-267-07 accepted as planned.

## Self-Check: PASSED

b16e31824, 96a4eba39, 694cd2ae4, a3e09b249 and b8fb9ba46 resolve on main; `tests/test-267-mcpv2-http-flag-off.cjs` and `.planning/debug/resolved/mcp-http-flag-off-one-request-per-process.md` exist.
