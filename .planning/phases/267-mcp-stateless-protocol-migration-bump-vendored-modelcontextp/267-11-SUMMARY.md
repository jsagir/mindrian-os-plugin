---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 11
subsystem: mcp
tags: [serveStdio, sdk-v2, swap, dual-era, stdio, elicitation]
requires: [267-10, 267-04]
provides:
  - "bin/mindrian-mcp-server.cjs builds its McpServer from @modelcontextprotocol/server (v2) and serves stdio and the express-missing fallback through serveStdio(() => server)"
  - "tests/test-267-mcpv2-dual-era.cjs: real v2 Client over stdio against the real local server in both eras (2025-11-25 and 2026-07-28), including the elicitation gate arms"
  - "wire-snapshot-zod4.json refreshed to 45 tools (research_run added, meeting description refreshed)"
affects: [267-12, 267-13, 267-14]
key-files:
  created:
    - tests/test-267-mcpv2-dual-era.cjs
  modified:
    - bin/mindrian-mcp-server.cjs
    - lib/mcp/resources.cjs
    - lib/mcp/tool-router.cjs
    - lib/mcp/prompts.cjs
    - lib/mcp/capability-registry.cjs
    - lib/mcp/app-views.cjs
    - tests/test-267-mcpv2-sdk-era.cjs
    - tests/fixtures/267/wire-snapshot-zod4.json
decisions:
  - "Desktop gate PASSED on the recorded probe evidence; no navigator ruling needed"
  - "Snapshot refresh scoped to the two measured diffs only (research_run added, meeting description), existing entry order and the three titled app-view entries preserved"
  - "One TEMPORARY ALLOWANCE in the sdk-era ledger for the single v1 streamableHttp require, printed on every run, to be deleted by 267-14"
metrics:
  tasks: 2
  completed: 2026-10-02
---

# Phase 267 Plan 11: Local server on v2 McpServer, stdio via serveStdio Summary

The local server's stdio branch now runs on the v2 SDK (`McpServer` from `@modelcontextprotocol/server`, `serveStdio(() => server)` from `@modelcontextprotocol/server/stdio`), and a new real-wire test proves both protocol eras on stdio plus the elicitation gate ladder: rung (a) fires exactly once on a 2025-11-25 connection and not at all on a 2026-07-28 connection, with `gate-render.cjs` and `session-binding.cjs` untouched and no MRTR code.

PLAN_BASE=70123e9354a9f9674963637bb4ee72212e1a99e9

## Commits

| Step | Commit | What |
|------|--------|------|
| prep | dd1270c0d | `tests/fixtures/267/wire-snapshot-zod4.json`: add `research_run`, refresh `meeting` description |
| Task 1 | b6c1ec07c | dual-era wire test, RED before the swap |
| Task 2 | e22a8f6ca | swap to v2 `McpServer` + `serveStdio`, `ResourceTemplate` + JSDoc types moved, era ledger updated |

## Desktop gate: PASSED (evidence quoted from 267-TRIPOLAR-PROBES.md, "Desktop (human probe)", commit c5add6eb6)

I read the section myself and the STOP branch does not fire:

- "First c2s method: `initialize` (NO `server/discover` anywhere in the log)."
- "`protocolVersion`: `2025-11-25` (client) / `2025-11-25` (server reply)."
- "`clientInfo`: `{"name":"claude-ai","version":"0.1.0"}`."
- "`capabilityKeys`: `["extensions"]` only ... **No `elicitation` key.**"
- The probe's own reading: "Desktop is 2025-era with no `server/discover`, so the 'Desktop opens with server/discover or a 2026-07-28 initialize' STOP branch does NOT fire. Desktop never declared `elicitation`, so its gate ladder is already rung (b)/(c) today; adopting `serveStdio` cannot move it off rung (a)."

The Decision-input rule says STOP only if Desktop opens with `server/discover` or a 2026-07-28 `initialize`; it does neither. CLI (Claude Code 2.1.281) is also 2025-era with `elicitation` declared, so on CLI this is future-proofing with no wire change, as the plan states. Cowork remains PENDING (267-18 re-asks); 267-12 fixes RCA 1 regardless.

## Task 1 RED, arm by arm (pre-swap tree, v1 server, v2 client)

| Arm | Pre-swap | Post-swap |
|-----|----------|-----------|
| era 2025 (default client, 2025-11-25, instructions, tools/prompts/resources/templates vs snapshot, all tools titled) | PASS | PASS |
| era 2026 (auto client, 2026-07-28) | FAIL: `'legacy' !== 'modern'` (v1 has no `server/discover`, auto falls back to legacy) | PASS |
| elicitation, era 2025 (exactly one `elicitation/create` at the client) | PASS | PASS |
| elicitation, era 2026 (zero requests, rung (b)/(c)) | FAIL: negotiated 2025-11-25, not 2026-07-28 | PASS |
| process hygiene (no spawned server survives) | PASS | PASS |

RED run: `RESULT: PASS=3 FAIL=2`. GREEN run: `RESULT: PASS=5 FAIL=0`.

## Verification output (all with fresh `HOME=$(mktemp -d) MINDRIAN_ROOMS_HOME=$(mktemp -d)`)

GREEN dual-era output (quoted):

```
negotiated 2025-11-25 (era legacy)
negotiated 2026-07-28 (era modern)
negotiated 2025-11-25; elicitation requests seen: 1; renderer elicitation
negotiated 2026-07-28; elicitation requests seen: 0; renderer askuserquestion
RESULT: PASS=5 FAIL=0
```

Process census before and after the test run: `pgrep -f bin/mindrian-mcp-server.cjs | wc -l` 8 and 8 (peer sessions' own servers are in that count; the test additionally compares PID sets and kills only PIDs it started).

Acceptance greps:

- `grep -c "serveStdio(() => server)" bin/mindrian-mcp-server.cjs` = 2 (stdio branch and express-missing fallback).
- non-comment `StdioServerTransport` count = 0; non-comment `@modelcontextprotocol/sdk` count = 1 (only the HTTP `streamableHttp.js` require, removed in 267-14).
- `grep -rn "createRequestStateCodec\|inputRequired(" bin lib | wc -l` = 0.
- `git diff 70123e935 -- lib/mcp/gate-render.cjs lib/core/session-binding.cjs | wc -l` = 0.
- `requireWithHeal` count in the server entry: 7 lines (connect-path census, which needs at least 4, held; `test-266-connect-path-process-budget.cjs` exit 0).

Battery results:

| Check | Result vs baseline |
|-------|--------------------|
| `test-267-mcpv2-dual-era.cjs` | PASS 5/5 (new) |
| `test-267-mcpv2-sdk-era.cjs` | PASS=5 FAIL=0 SKIP=1; prints `TEMPORARY ALLOWANCE (removed by 267-14): bin/mindrian-mcp-server.cjs may keep 1 v1 require` |
| `test-267-mcpv2-registration-api.cjs` | PASS=68 FAIL=0 (the 45 vs 44 red is CLOSED by the snapshot refresh) |
| `test-267-mcpv2-prompts.cjs`, `-app-views.cjs` (22/22), `-tee.cjs` | PASS |
| `test-267-mcpv2-zod4-contract.cjs` | PASS=2 FAIL=2: (b) extra `tool:research_run:membership` and (d) `scripts/fork359-permission-probe.cjs`, both known baseline reds from 267-08/09/10 |
| `test-267-mcpv2-cirs-gates.cjs` | Check (c) 31 vs 32, known baseline red |
| `test-266-connect-path-process-budget.cjs`, `bash tests/run-all-266.sh` | PASS |
| `test-265-mcp-surface-organ.cjs`, `test-265-gate-render-elicit-schema.cjs`, `test-198-gate-renderers.test.cjs` | PASS |
| `test-248-surface-probes.cjs` (HTTP flag-ON legs on the v2-McpServer/v1-transport composition) | PASS |
| `bash tests/run-all-198.sh` | Passed 13 Failed 3: Part 8 local-only floor, SPEC-2, SPEC-5, identical to 267-BASELINE.md (includes the flag-ON HTTP concurrency legs) |
| `bash tests/run-all-234.sh` | 2 FAILED legs (free-core-network-scan, plugin-root-migrated), subset of the 3 baseline reds (dist-bundle passed) |
| `tests/test-354-*.cjs` (all) | PASS except: concurrency-surfaces (K4, Playwright browser absent under an empty HOME, known), chat-inert-render, poc-room-journey, poc-save-origin (same Playwright ENV GAP under the empty hygiene HOME), framework-command-ledger (`plugin_version drift: ledger=2.0.0-beta.48 repo=2.0.0-beta.56`, peer/release drift, red at HEAD without my edits too); theo-live-contract exit 77 skip |
| tree-watcher tests (`grep -l tree-watcher tests/*.cjs`: baseline-schema-driven, cross-room-fence, no-second-walker PASS) | `test-270-dynamic-tree.cjs` FAIL `server.registerResource is not a function`, see Deferred |
| `node scripts/doctor.cjs --acceptance` | `mcp-surface-tool-count` PASS (the doctor mcp-surface organ's hand-rolled 2024-11-05 handshake still works against the swapped server). Other points FAIL only because of the empty-HOME hygiene (no install-state, no installed_plugins.json, no marketplace.json) |
| `bash tests/run-all-267.sh` | PASS=25 FAIL=3 SKIP=5: the 3 are CIRS (c), zod4 (b)(d), 354 concurrency K4 (all known); brain shim canary passed this run; registration API now green |

## Deviations from Plan

**1. [Rule 3 - Blocking] Snapshot refresh before Task 1.** The dual-era test compares against `wire-snapshot-zod4.json`, which was stale (44 tools, old `meeting` description). Per the orchestrator's brief this plan owns the refresh. I added `research_run` (captured from the live wire after peer 366-12's c8177e67f landed; it carries `perspective_recall`) and refreshed the `meeting` description, inserted in place so the existing order and titled app-view entries are unchanged, and recorded a `refreshed_by` field. Commit dd1270c0d. Re-measured against the live wire afterwards: zero diffs.

**2. [Scope note] `tests/fixtures/267/wire-snapshot-zod4.json` is not in the plan's `files_modified`.** Included by orchestrator instruction.

**3. [Peer-coordination] No connector/honesty data written.** `data/connector-registry.json`, `data/mcp-tool-connectors.json` and `tests/fixtures/tool-honesty/276-dispositions.json` were not touched, per the orchestrator note. `check-tool-honesty` printed `OK (42 tool(s), 136 branch(es) scanned, 0 high-risk)` in the pre-commit hook.

No other deviations. `lib/mcp/tool-router.cjs` received only the one-line JSDoc type change (peer 366 agreed to hold edits there; `git status --short` was clean on every file before I edited it).

## Deferred / peer findings

- `tests/test-270-dynamic-tree.cjs` fails `server.registerResource is not a function`: its stub server only implements the old `resource()` method and `resources.cjs` has called `registerResource` since 267-09. Red at HEAD without my edits (verified in a detached worktree), so not caused here; fix is to teach the stub `registerResource`. Logged to `deferred-items.md`.
- `tests/test-354-framework-command-ledger.cjs` T2: ledger `plugin_version` beta.48 vs repo beta.56 (release drift, not 267).
- Playwright-dependent tests (354 chat-inert-render, poc-room-journey, poc-save-origin, concurrency K4) cannot find a browser under the empty hygiene HOME; ENV GAP, not a regression.
- Still open from 267-08/09/10: CIRS (c) 31 vs 32 and zod4 (b)(d). The zod4 (b) extra compares against the older zod3 snapshot, so refreshing the zod4 snapshot does not close it; closing it needs an accepted-delta entry or a zod3-snapshot decision for a later plan.
- Cowork probe still PENDING (267-18 re-asks).

## Known Stubs

None.

## Threat Flags

None. T-267-23 (gate ladder) mitigated and test-armed by the two elicitation arms; T-267-11 grep is 0; T-267-22 identity files untouched; T-267-28 gate passed on recorded evidence; T-267-27 handled by per-PID SIGKILL and PID-set comparison.

## Self-Check: PASSED

dd1270c0d, b6c1ec07c, e22a8f6ca resolve on main; `tests/test-267-mcpv2-dual-era.cjs` exists.
