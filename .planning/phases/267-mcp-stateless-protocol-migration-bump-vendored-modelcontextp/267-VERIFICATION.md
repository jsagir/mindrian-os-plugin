---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
verified: 2026-10-02T00:00:00Z
status: human_needed
score: 9/12 must-haves verified (3 carry-forwards, none FAILED)
overrides_applied: 0
re_verification: false
gaps: []
carry_forwards:
  - truth: "MCPV2-03 zod 4 accepted looser strictness pinned as data (proving test green)"
    status: uncertain
    reason: "Substance shipped and verified (zod 4.6.5, fixture pinned). tests/test-267-mcpv2-zod4-contract.cjs is RED (PASS=1 FAIL=3) from commits that landed after PLAN_BASE 211030b13 and are not Phase 267: 8a66273ce (366-16, tool:orchestration wording), 12ca953a0 (363-17, research_run), 951baa899 (359-05, fork359 zod importer). Navigator-ruled wait for the post-366 combined baseline refresh."
  - truth: "MCPV2-08 CIRS gates hold after every registrar rewrite (proving test green)"
    status: uncertain
    reason: "Substance verified independently (connector registry --check OK, zero shape violations under lib/mcp, registration test PASS=68). tests/test-267-mcpv2-cirs-gates.cjs Check (c) RED: baseline pins 31 connector descriptors, tree has 32 because of research_run (363-17, after PLAN_BASE). Same combined refresh."
human_verification:
  - test: "Real Claude Desktop GUI smoke on the migrated build (temporary mindrian-os-dev entry via wsl.exe to the dev tree, tee log, then list rooms / status prompt / one gate / dashboard view)"
    expected: "Handshake era and capabilities recorded; status prompt answers; gate renders (card, rung b); dashboard view paints and honors room_path containment"
    why_human: "Needs the real Desktop host. Only a scripted surrogate has run post-migration."
  - test: "Cowork session with a build of this tree: status_read, list rooms, one more tool, plus ps aux | grep mindrian-mcp-server and env | grep -E 'CLAUDE_SURFACE|COWORK_SESSION_ID' in the VM"
    expected: "Confirms whether Cowork reaches the flag-OFF HTTP branch (assumption A7, RCA 1 live severity) and that the migrated HTTP server answers a real Cowork client"
    why_human: "No Cowork observation exists before or after migration; the dev build cannot be loaded into Cowork without a human."
---

# Phase 267: MCP SDK v2 Migration Verification Report

**Phase Goal (ROADMAP, CORRECTED SCOPE):** Local-server-only, unified, internally staged migration of the `mindrian-os` MCP server (stdio and both HTTP branches), the brain shim, the shim/adapter clients and every `lib/mcp` registrar from `@modelcontextprotocol/sdk` v1 to the v2 package family, with the v1 package removed last. Out of scope: `mcp-server-brain/`, Theo, `lib/core/brain-client.cjs`, MRTR rework of gate rung (a), flag-ON room-binding identity re-architecture.
**Verified:** 2026-10-02
**Status:** human_needed
**Re-verification:** No, initial verification
**ROADMAP success criteria:** the Phase 267 entry carries no separate Success Criteria list. Must-haves were derived from the goal text, the lead's checklist, and MCPV2-01..19.

All commands below were run by the verifier in its own process with `HOME=$(mktemp -d) MINDRIAN_ROOMS_HOME=$(mktemp -d)`. SUMMARY claims were not used as evidence.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero `@modelcontextprotocol/sdk` requires on code lines in bin/, lib/, scripts/, tests/ | VERIFIED | `grep -rnE "@modelcontextprotocol/sdk" bin lib scripts tests` returns only comments, test-assertion strings that police the absence (sdk-era Arm D, clients, brain-shim source arm), fake-manifest fixtures in `lib/core/mcp-dep-heal.test.cjs`, and JSON fixtures. No `require(`/`requireWithHeal(` of the v1 package. `test-267-mcpv2-sdk-era.cjs` PASS=7 FAIL=0 SKIP=1 (the SKIP is the v1 falsification arm, v1 is gone) |
| 2 | No sdk in package.json or lockfiles | VERIFIED | `grep -c modelcontextprotocol/sdk` = 0 in package.json, package-lock.json, npm-shrinkwrap.json. `node_modules/@modelcontextprotocol/` holds client, core, ext-apps, node, server only. Shrinkwrap lists exactly those five. `test-267-mcpv2-lockstep.cjs` PASS=6 |
| 3 | Server is v2 `McpServer` + `serveStdio` | VERIFIED | `bin/mindrian-mcp-server.cjs:101-102` requires `McpServer, createMcpHandler, isLegacyRequest` from `@modelcontextprotocol/server` and `serveStdio` from `.../server/stdio`; stdio branch `serveStdio(() => getServer())` (lines 330, 577). Live: stdio initialize at 2025-11-25 returned `mindrian-os 2.0.0-beta.56`, tools/list = 45. `test-267-mcpv2-dual-era.cjs` PASS=5 (both eras over stdio) |
| 4 | Flag-OFF HTTP is `createMcpHandler` stateless with host/origin guards | VERIFIED | Lines 432-435: `createMcpHandler(() => createServer(), { legacy: 'stateless' })` behind `toNodeHandler`; `localhostHostValidation` / `localhostOriginValidation` applied first on `/mcp` and `/event`. Live spot-check: three sequential initialize POSTs = 200, 200, 200 (was one per process); `Host: evil.com` = 403; `Origin: http://evil.com` = 403. `test-267-mcpv2-http-flag-off.cjs` PASS=6 |
| 5 | Flag-ON routes by era | VERIFIED | Lines 489-499: `toWebRequest` then `isLegacyRequest(webReq, req.body)`; legacy goes to the session-keyed `NodeStreamableHTTPServerTransport` map (fresh McpServer per session, 400 on unknown id), everything else to modern-only `createMcpHandler({ legacy: 'reject' })`. `test-267-mcpv2-flag-on.cjs` PASS=6 |
| 6 | Lifecycle exits cleanly | VERIFIED | `exitAfterTeardown` (closes httpServer, every mcpHandler, stdioHandle, 2 s unref'd backstop) registered last; listen error branch exits 1 with no "started" line. Live: SIGTERM on the HTTP server exited 0 in about 500 ms. `test-267-mcpv2-lifecycle.cjs` PASS=5 |
| 7 | Clients are on v2 | VERIFIED | `bin/mindrian-mcp-shim.cjs:41-42` uses `@modelcontextprotocol/server/stdio` + `@modelcontextprotocol/client`; `lib/mcp/adapter-client.cjs:24` uses `@modelcontextprotocol/client`; `bin/mindrian-brain-mcp-client.cjs:65-66` uses v2 `McpServer` + `serveStdio`. `test-267-mcpv2-clients.cjs` 5/5, `test-267-mcpv2-brain-shim.cjs` PASS=6 (both eras, six tools, Part 8 intact) |
| 8 | Every registrar on `registerTool`/`registerResource`/prompts; wire intact | VERIFIED | `grep` finds no `.tool(` / `.resource(` / `.prompt(` call sites left in lib/mcp or bin. `test-267-mcpv2-registration-api.cjs` PASS=68; `test-267-mcpv2-prompts.cjs` PASS=26; `test-267-mcpv2-app-views.cjs` PASS=22; `test-267-mcpv2-gate-premise.cjs` PASS=5; live tools/list = 45 |
| 9 | Dep-heal, supply chain, payload and shrinkwrap hold; RCAs filed | VERIFIED | `lib/core/mcp-dep-heal.test.cjs` 9/9; payload ceiling OK (1983 entries, 0 findings) and `test-341-shrinkwrap-no-dev` 4/4 inside run-all-267; six RCAs under `.planning/debug/resolved/`, RCA 7 open with SEED-108 present |
| 10 | MCPV2-03: zod 4 delta pinned as data, proving test green | UNCERTAIN (carry-forward) | zod 4.6.5 in lockstep, `tests/fixtures/267/zod4-accepted-deltas.json` exists, but the proving test is RED PASS=1 FAIL=3. Honestly recorded as `[ ]` in REQUIREMENTS.md. Verifier confirmed all three red causes are commits after PLAN_BASE: 359-05 `951baa899` (2026-09-24 16:21, base is 10:15), 363-17 `12ca953a0`, 366-16 `8a66273ce`. See WARNING 1 |
| 11 | MCPV2-08: CIRS gates hold, proving test green | UNCERTAIN (carry-forward) | Substance holds: `build-connector-registry.cjs --check` prints `connector-registry: OK`; zero shape violations under `lib/mcp`; registration test 68/0. Proving test Check (c) RED, 31 pinned vs 32 live (`research_run`, peer-added). Recorded `[ ]`. See WARNING 1 |
| 12 | MCPV2-13: Tri-Polar wire era and capabilities recorded per surface | UNCERTAIN (human needed, honestly deferred) | CLI measured live pre (2.1.281) and post (2.1.287); Desktop pre-migration human probe (c5add6eb6); post-migration Desktop is a scripted surrogate explicitly labelled "NOT a human probe"; Cowork never observed. REQUIREMENTS.md keeps `[ ]`. See Deferral Honesty below |

**Score:** 9/12 VERIFIED, 3 carry-forwards (none FAILED, no BLOCKER).

### Deferral Honesty Assessment

The three known carry-forwards are recorded honestly, not marked passed.

- **REQUIREMENTS.md:** MCPV2-03, -08, -13 are `[ ]` with the reason stated on each row; the Traceability footer says "16 `[x]`, three `[ ]` with reasons". The 16 `[x]` rows I checked have a proving test that I re-ran green.
- **ROADMAP:** the Phase 267 close line says MCPV2-13 "stays open" and that "the phase claims only CLI and an automated Desktop surrogate"; MCPV2-03/08 named as awaiting the post-366 refresh.
- **267-TRIPOLAR-PROBES.md:** the Desktop-surrogate section opens with a WARNING that it "does NOT satisfy MCPV2-13's human Desktop check". The "Desktop (post-migration)" and "Cowork (post-migration)" sections are headed `Status: DEFERRED` with the navigator ruling quoted and a "Not verified by any human" list. The stale "Cowork (human probe) PENDING" block is left in place but is consistent (and says the re-ask happened).
- **267-VERIFICATION-GATES.md:** `run-all-267.sh` is reported as PASS=29 FAIL=3 SKIP=1, not rounded to green; the plan's own FAIL=0 acceptance line is called out as unmet with the reason. My independent run of `bash tests/run-all-267.sh` reproduced exactly PASS=29 FAIL=3 SKIP=1 (CIRS (c), zod4, 354 concurrency K4; SKIP = the opt-in live CLI probe).
- **K4 red** is an environment gap: `browserType.launch: Executable doesn't exist ... ms-playwright` under an empty HOME. The gates doc says the same and records a 25/25 re-run with the browser path.
- The "peer drift" attribution for MCPV2-03/08 is verified true by commit ancestry (above), not taken on trust.

One minor observation, not a gap: the fork359 zod importer (359-05) predates 267-17 only in that it required zod directly; 267-17 later moved the same file to the v2 server package (`71004d9cb`). The test (d) red is the zod-importer boundary, unrelated to v1 removal.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/mindrian-mcp-server.cjs` | v2 McpServer, serveStdio, createMcpHandler, era routing, guards, clean exit | VERIFIED | Substantive and wired; live-run |
| `bin/mindrian-brain-mcp-client.cjs` | v2 shim, six tools | VERIFIED | brain-shim test PASS=6 |
| `bin/mindrian-mcp-shim.cjs`, `lib/mcp/adapter-client.cjs` | v2 client | VERIFIED | clients test 5/5 |
| `lib/mcp/**` registrars | registerTool form | VERIFIED | registration-api PASS=68, no variadic sites |
| `package.json`, `package-lock.json`, `npm-shrinkwrap.json` | v2 five, no sdk | VERIFIED | lockstep PASS=6 |
| `tests/run-all-267.sh` + 13 `test-267-mcpv2-*.cjs` | proving suite | VERIFIED (3 red legs, see carry-forwards) | present, executed |
| `267-VERIFICATION-GATES.md`, `267-TRIPOLAR-PROBES.md`, seeds SEED-108..111, RCA 7 | records | VERIFIED | present and consistent with code |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| stdio branch | serveStdio handle | `stdioHandle = serveStdio(() => getServer())` | WIRED | closed by exitAfterTeardown |
| `/mcp` route | host/origin guards then handler | `hostGuard`, `originGuard`, `flagOffNodeHandler` / era split | WIRED | live 403 on foreign host/origin |
| flag-ON `/mcp` | era classification | `toWebRequest` + `isLegacyRequest` | WIRED | flag-on test PASS=6 |
| tree watcher | per-branch notify target | `startTreeWatcherOnce({ sendResourceListChanged: ...notify.resourcesChanged })` | WIRED | |
| SIGTERM/SIGINT | exit after teardown | `registerTerminalSignalListeners` registered last | WIRED | live exit 0 in about 500 ms |

### Data-Flow Trace (Level 4)

Not applicable (server and registrar code, no rendered dynamic UI). Live tools/list returned 45 real registrations; `resources/read` data flow is covered by app-views PASS=22.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| stdio handshake and tools/list | piped initialize + tools/list into `bin/mindrian-mcp-server.cjs` (MINDRIAN_TRANSPORT=stdio) | proto 2025-11-25, serverInfo mindrian-os 2.0.0-beta.56, 45 tools | PASS |
| flag-OFF HTTP multi-request | 3 sequential POST initialize to 127.0.0.1:3847/mcp | 200 / 200 / 200 | PASS |
| DNS-rebinding guards | foreign Host / foreign Origin | 403 / 403 | PASS |
| SIGTERM exit | kill -TERM on HTTP server | exit 0 within about 500 ms | PASS |
| Aggregator | `bash tests/run-all-267.sh` | PASS=29 FAIL=3 SKIP=1 (equals gates doc) | PASS with documented reds |
| 13 individual proving tests | `node tests/test-267-mcpv2-*.cjs` | all exit 0 except cirs-gates (1/3 fail) and zod4-contract (3/4 fail) | as documented |

### Probe Execution

No `probe-*.sh` declared for this phase. SKIPPED. The opt-in live CLI probe (`MOS_267_LIVE_CLI_PROBE=1`) was not re-run by the verifier (needs the real HOME to authenticate `claude -p`, which the shared-tree hermetic rule forbids); its results are recorded from 267-18 and are not counted as verified here.

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MCPV2-01, 02, 04, 05, 06, 07, 09, 10, 11, 12, 14, 15, 16, 17, 18, 19 | SATISFIED | proving test for each re-run green by the verifier (10 and 12 via the aggregator legs and lockstep Check 6 / payload ceiling) |
| MCPV2-03 | NOT YET (carry-forward) | proving test red from post-base peer commits; substance in place |
| MCPV2-08 | NOT YET (carry-forward) | proving test red on Check (c) 31 vs 32; substance in place |
| MCPV2-13 | NEEDS HUMAN | human Desktop post-migration smoke and Cowork probe never run |

No orphaned requirements: MCPV2-01..19 are all registered and all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/core/brain-client.cjs` | 2358 | stale comment "ajv transitive via @modelcontextprotocol/sdk" | Info | Comment only; file on the phase's never-edit list; SEED-111 |
| `lib/core/mcp-dep-heal.cjs` | 15, 67, 349, 362 | rationale comments still name v1 | Info | Comments only; SEED-111 |
| `references/security/cve-db.json`, `data/capability-ledger.json`, `mcp-server-brain/{server.cjs,package.json}` | n/a | still mention or depend on v1 | Info | Outside the scoped dirs; `mcp-server-brain/` is explicitly out of scope ("dead"); disposition seeded (SEED-111) |
| phase-modified code | n/a | TBD/FIXME/XXX in lines added since PLAN_BASE | none found | Debt-marker gate clean |

### Human Verification Required

1. **Real Claude Desktop smoke on the migrated build.** Temporary `mindrian-os-dev` entry through `wsl.exe` pointing at the dev tree, tee log. Expected: handshake era and capabilities recorded, status prompt answers, a gate renders as a card (rung b), the dashboard view paints and honors `room_path` containment. Why human: only a scripted surrogate has exercised the migrated server as Desktop.
2. **Cowork probe.** A Cowork session with a build of this tree: `status_read`, list rooms, one more tool, plus `ps aux | grep mindrian-mcp-server` and `env | grep -E "CLAUDE_SURFACE|COWORK_SESSION_ID"` in the VM. Expected: confirms A7 (does Cowork reach the flag-OFF HTTP branch) and a real client round trip. Why human: Cowork has never been observed, before or after.

### Warnings and observations (non-blocking, all disclosed in the phase's own docs)

1. **WARNING: two phase-owned proving tests are red.** `test-267-mcpv2-cirs-gates.cjs` (Check c) and `test-267-mcpv2-zod4-contract.cjs` fail, so `run-all-267.sh` cannot read FAIL=0. Causes verified as post-base peer commits, substance independently verified, navigator-ruled wait for the post-366 combined baseline refresh. Risk: until the refresh lands, these gates will no longer catch a real regression of the same kind (a stale pinned baseline is a weaker tripwire). Recommend a single owned refresh commit re-measuring all three baselines together right after 366 lands, and that someone is named for it.
2. **WARNING: Tri-Polar claim is CLI plus automated surrogate only.** CLI on Claude Code 2.1.287 now opens with `server/discover` (2026 era), so the gate renders at rung (b), not rung (a). Navigator-accepted and recorded, but it is a behavior change of the CLI gate that rests on the dual-era test, not on an observed live gate (the tee cannot show the rung).
3. **Observation: verification weakened by ruling.** The test-257 before-versus-after (v1 versus v2 shim) legs were retired (quick 261002-by3, option 3). Part 8 shim behavior is still guarded by `test-267-mcpv2-brain-shim.cjs` PASS=6, but the old equivalence proof is gone. Arm B of test-257-strict-input-shapes remains red (the baseline's boot race).
4. **Observation: open adjacent defects, unchanged by this phase.** RCA 7 (`mcp-shim-preseeded-session-id-rejected`, flag-ON shim rejects a pre-seeded session id) is open with SEED-108; `desktop-session-binding-fallback` (Desktop `room_bind` `no_session_id`, registry-active fallback) was reproduced post-migration by the surrogate and is unchanged. Neither is in the phase's corrected scope.
5. **Observation: research-trail mirror pending.** The dual-home research filing is at the plugin-side fallback with `mirror_status: PENDING` (room write was refused by the write-scope hook and not routed around). Honest, not a goal item.
6. **Observation: shutdown log noise.** `[session-catchup] Failed to save on shutdown: The "path" argument must be of type string. Received null` appeared at SIGTERM with no room bound (reproduced live by the verifier). Harmless, exit code 0, already noted in the surrogate section.

### Gaps Summary

No FAILED truths and no BLOCKERs. The migration goal is achieved in the code: v1 is gone from manifests, lockfiles, node_modules and every code line in bin/lib/scripts/tests; the server, brain shim, shim and adapter run on the v2 family; flag-OFF HTTP is stateless per request with host/origin guards; flag-ON routes by era; shutdown exits cleanly. Status is `human_needed` rather than `passed` because MCPV2-13's human Desktop and Cowork checks have never run, and `passed` is invalid while the human-verification list is non-empty. MCPV2-03 and MCPV2-08 are mechanical carry-forwards (stale pinned baselines), not unfinished work, and their deferral is recorded honestly everywhere I looked.

---

_Verified: 2026-10-02_
_Verifier: Claude (gsd-verifier)_
