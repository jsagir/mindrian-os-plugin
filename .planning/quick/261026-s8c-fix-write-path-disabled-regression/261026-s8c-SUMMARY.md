---
quick_id: 261026-s8c
phase: quick/261026-s8c
plan: 01
subsystem: mcp-server
tags: [mcp, host-detection, write-path, doctor, surface-detect]
requirements: [S8C-01, S8C-02, S8C-03, S8C-04, S8C-05]
status: complete
key-files:
  created:
    - lib/mcp/client-identity-log.cjs
    - lib/core/doctor/mcp-write-path-module.cjs
    - tests/test-doctor-mcp-write-path.cjs
  modified:
    - lib/mcp/surface-detect.cjs
    - lib/mcp/mcp-first-flag.cjs
    - lib/mcp/tools/status.cjs
    - lib/mcp/tools/views.cjs
    - lib/mcp/tools/graph.cjs
    - lib/mcp/tools/claim.cjs
    - lib/mcp/tools/claim-verify.cjs
    - lib/mcp/tools/question.cjs
    - scripts/mindrian-mcp-server.cjs
    - data/doctor-modules.json
    - tests/test-234-host-tier.cjs
---

# Quick 261026-s8c: write_path_disabled regression fix Summary

Five items, five commits, tests in each commit, nothing pushed. A Claude Code CLI session now reports surface cli, the refusal text names the fix, the client name is logged once per connection, a doctor check warns when writes are off, and a 2026-era connection is judged by the identity in the request envelope.

## Commits

| Item | SHA | Subject |
|------|-----|---------|
| 1 (S8C-01) | 1975012d4 | fix(mcp): detect CLAUDE_CODE_ENTRYPOINT=cli as surface cli (quick 261026-s8c item 1) |
| 2 (S8C-02) | 61fb81faf | feat(mcp): log client name and version once per connection to stderr (quick 261026-s8c item 2) |
| 3 (S8C-03) | 89b222348 | fix(mcp): write_path_disabled hint names surface, host and the exact flag value (quick 261026-s8c item 3) |
| 4 (S8C-04) | 92a467902 | feat(doctor): mcp-write-path check warns with the fix text when writes are off (quick 261026-s8c item 4) |
| 5 (S8C-05) | a5e1f2c2e | fix(mcp): read client identity from the request envelope when getClientVersion is null (quick 261026-s8c item 5) |

Paths per commit: item 1 = 2 paths, item 2 = 4, item 3 = 7, item 4 = 3, item 5 = 9. Each `git show --stat` listed only the named paths.

## MCP App views that stop registering on cli

D-03: CAPABILITY_MAP.cli keeps apps false. After item 1 a Claude Code CLI MCP session is surface cli, so the MCP App views are not registered there.

Printed by the test (label MCP-APP-DIFF), onlyDesktop = the names that exist on desktop and not on cli:

```
room-dashboard
room-graph
room-wiki
ui://mindrian-os/room-dashboard
ui://mindrian-os/room-graph
ui://mindrian-os/room-wiki
```

onlyCli = `[]` (the cli catalog is a subset of the desktop catalog). No other view is lost. Nothing outside the six accepted names disappears.

Test that shows it: `node tests/test-234-host-tier.cjs`, Part B6, lines labelled `MCP-APP-DIFF` (it asserts onlyCli is empty and onlyDesktop is a subset of the six accepted names; any other name fails the test).

## Probe lines (PROVEN, measured)

P3 probe: SDK Client, `versionNegotiation { mode: 'auto' }` (2026 era), clientInfo.name "Claude Code", real server, no MINDRIAN_TRANSPORT, no CLAUDE_SURFACE, no MINDRIAN_MCP_FIRST, ENTRYPOINT=cli inherited. Prints capability_floor of status_read.

Before item 5 (taken before any Task 5 edit, after items 1 to 4):
```
auto {"surface":"cli","host_tier":{"host":"unknown","hostTier":"tier0"},"write_path_enabled":false,"tool_registration":{"complete":true,"failed":[]}}
```
After item 5:
```
auto {"surface":"cli","host_tier":{"host":"claude-code","hostTier":"tier1"},"write_path_enabled":true,"tool_registration":{"complete":true,"failed":[]}}
```
After item 5, clientInfo.name changed to SomeNewClientNeverSeenBefore:
```
auto {"surface":"cli","host_tier":{"host":"unknown","hostTier":"tier0"},"write_path_enabled":false,"tool_registration":{"complete":true,"failed":[]}}
```

Planner facts, restated as measured: P3 (a 2026-era client named "Claude Code" gets host unknown and write off before item 5) and P4 (on a 2026-era connection oninitialized does not fire and getClientVersion() is null in a handler; the identity is in `extra.mcpReq.envelope["io.modelcontextprotocol/clientInfo"]`). The live Claude Code era on stdio is UNVERIFIED. This work does not state the live cause of host=unknown. The S8C-02 log line will show what the live client sends, and the first status_read of a live session settles which era it uses.

## Observed identity lines (S8C-02, real server)

Legacy drive (client test-cursor-sim):
```
[mindrian-os] client identity: name="test-cursor-sim" version="1.0.0" via=initialize source=client_version
```
2026-era drive (SDK Client, auto negotiation, name Claude Code, one status_read):
```
[mindrian-os] client identity: name="Claude Code" version="2.1.310" via=status_read source=envelope
```
Each drive produced exactly 1 identity line. Every non-empty stdout line of the legacy drive was valid JSON-RPC 2.0 (badStdout 0). The 2026-era drive does not count stdout lines (the SDK client hides the raw stream).

## Callers of detectSurface() and surface branches (re-run greps, Task 1 Step 3)

Re-ran `grep -rn "detectSurface" lib scripts bin` and `grep -rn "ctx.surface|surface.surface|CLAUDE_HOST_SURFACES|CAPABILITY_MAP"`. Result matches the planner list; no unlisted branch on surface:
- scripts/mindrian-mcp-server.cjs:75 (isHttpTransport, transport only), :144 and :180 (detectSurface), :250 registerRouterTools, :270 registerResources, :437 isMcpFirst (HTTP daemon branch). cli gives stdio, so Desktop and Cowork paths are unchanged.
- lib/mcp/capability-registry.cjs:13 and :23: CAPABILITY_MAP.cli apps false, the source of the app-view change above.
- lib/mcp/gate-render.cjs:166 and lib/mcp/never-do-gate.cjs:39: CLAUDE_HOST_SURFACES lists cli, desktop, cowork equally. No change.
- lib/mcp/tools/stop-gate.cjs:58, chain.cjs:987, research.cjs:742: pass ctx.surface to gate-render. No change in result.
- lib/mcp/tool-router.cjs:668 to 678 and :936: stamp line form for cli (cli and cowork share one form). Claude Code CLI now gets the cli form.
- lib/core/navigation-engine.cjs:1160: reads ctx.surface === 'cli'. The MCP surface does not feed it.
- lib/core/arbitration.cjs:152: a comment only (hooks flag from CAPABILITY_MAP). No code change.
- lib/statusline/surface-detect.cjs and scripts/statusline-fallback-echo.cjs: separate helpers. Not touched.

## Before and after of the spawn-test set (Task 1 Step 0 and Step 4)

The 15 tests (the 12 named plus test-234-host-tier, test-l8g-theo-bare, test-270-tool-schema-budget) were run `timeout 300 node <test>` with CLAUDE_CODE_ENTRYPOINT=cli in the shell: before any edit, after item 1, and at the end after item 5. Exit codes identical in all three runs:

| Test | Exit |
|------|------|
| test-266-dep-heal-connect-budget | 0 |
| test-266-connect-path-process-budget | 0 |
| test-267-mcpv2-cli-probe | 77 (skip: MOS_267_LIVE_CLI_PROBE unset) |
| test-267-mcpv2-tee | 0 |
| test-267-mcpv2-dual-era | 1 (already failing before; 2 era-snapshot FAIL lines identical before and after) |
| test-267-mcpv2-sdk-era | 0 |
| test-354-concurrency-surfaces | 0 |
| test-270-resource-session-room | 1 (already failing: resource name set changed; identical before and after) |
| test-341-eureka-no-brain-reach | 0 |
| test-tool-router-active-room-misroute | 1 (already failing; identical before and after) |
| test-mcp-server-stdin-eof-exit | 0 |
| test-btm-theo-is-the-brain | 0 |
| test-234-host-tier | 0 |
| test-l8g-theo-bare | 1 (already failing: A4 flags eureka-judge.cjs and source-lens-driver.cjs; surface-detect.cjs is not named) |
| test-270-tool-schema-budget | 1 (already failing; identical before and after) |

The FAIL/PASS line content of the five failing tests was diffed before, after item 1, and at the end: no change. These five failures are not caused by this work.

## Test commands and results

- `node tests/test-234-host-tier.cjs` -> 252 passed, 0 failed (items 1, 2, 3, 5).
- `node tests/test-doctor-mcp-write-path.cjs` -> 27 passed, 0 failed (item 4).
- `node tests/test-358-b1-surfaces.cjs` rc 0. `node tests/test-358-b2-surfaces.cjs` rc 0 (after the deviation below). `node tests/test-198-contract-schema.test.cjs` rc 0. `node tests/test-248-resolver-census.cjs` rc 0.
- `node tests/test-doctor-module-contract-parity.cjs` rc 0. `node tests/test-doctor-doc-parity.cjs` rc 0. `node tests/test-265-mcp-surface-organ.cjs` rc 0. `node tests/test-139-acceptance.cjs` rc 0. `node tests/test-354-acceptance-diagnostics.cjs` rc 0.
- `node tests/test-doctor-acceptance-self-coverage.cjs` rc 1: fixtures a to e pass, Test 6 (live workspace, empty stdout) fails. `node tests/test-doctor-acceptance-preflight-checks.cjs` timed out at 400 s (rc 124) with failing synthesized legs. Both run `doctor --acceptance`. Not compared against a pre-change run, so the cause is UNVERIFIED. The empty stdout and the timeout match network reach in this sandbox, not this work.
- `node tests/test-267-mcpv2-dual-era.cjs` rc 1, identical to before the work (see the table).
- `node tests/test-l8g-theo-bare.cjs` rc 1, identical to before the work (see the table).
- Grep gates: `grep -rn "Set MINDRIAN_MCP_FIRST for this surface\|report host.client_name" lib` is empty. The six tool modules have no non-comment `getClientVersion`. `lib/mcp/client-identity-log.cjs` has no console.log, process.stdout, brain, fetch( or URL token outside // lines.
- No em-dash or en-dash in any added line of any changed file.

## doctor-all is not blocked

D-02: the check returns warn, not error. Code reading of scripts/doctor.cjs (line numbers are from the current tree):
- Line 4884 `doctor --json` prints `JSON.stringify(report)`. The report object built at lines 3996 to 4009 has no `summary` key (measured: the bare `--json` output of this run has no `summary` key). The doctor-all acceptance point at line 1198 reads `j.summary.drift` and falls back to 0, so a warn adds no drift there.
- Lines 334 to 345: `--all` sets the class flags. Line 3981: `classFlagsActive` is true when a class flag is set. Lines 4910 to 4912: `if (classFlagsActive) process.exit(0)` in `_finalizeAndExit`, so a warn from a cadence:always check does not change the `--all` exit code.
- Lines 2737 and 2789: `computeSummary` counts warn as drift in the human Summary line. Display only. Not changed.

Measured: bare `HOME=<tmp> node scripts/doctor.cjs --json` exits 3 before the module and 3 after (the exit 3 comes from the empty hermetic HOME: install and cache missing). After the change `checks["mcp-write-path"]` is present with status warn; before it was absent. The engine call `runAccumulativeEngine({home, running:'2.0.0-beta.74', dryRun:true})` returns `checks["mcp-write-path"]`, not deferred. `doctor --all` and `doctor --acceptance` were NOT run by me.

The spawn setup (about 30 lines) is a deliberate copy of the pattern in mcp-surface-module.cjs, because that helper is fixed to tools/list and covered by its own 4-arm test.

## Deviations from Plan

**1. [Rule 3 - Blocking] Item 3: question.cjs gets writePathOffHint through claim-verify.cjs**
- **Found during:** Task 3, regression test-358-b2-surfaces A12.
- **Issue:** The plan said question.cjs takes a new import from mcp-first-flag.cjs. Test A12 seals the require list of question.cjs (six allowed modules). The direct import failed it.
- **Fix:** claim-verify.cjs re-exports writePathOffHint; question.cjs imports it from './claim-verify.cjs' (an allowed module). The test file was not edited.
- **Files:** lib/mcp/tools/claim-verify.cjs, lib/mcp/tools/question.cjs. **Commit:** 89b222348.

**2. [Rule 1 - Bug] Item 3: a literal en-dash and em-dash in a new test line**
- **Found during:** Task 3 dash check. A regex in the new test held the two characters literally. Replaced by unicode escape sequences before the commit. No dash reached a commit.

**3. Item 2: module written before its RED run.** The module file was created before the new tests were run, so the unit arms did not show RED. The live arms did show RED (no identity line) before the server and status.cjs wiring was added. Tests were not weakened.

## Known Stubs

None.

## Threat Flags

None. The envelope identity is as unauthenticated as clientInfo (T-234-08, T-s8c-08). It selects only the default write convenience gate, and every write still passes navigation validation. No new endpoint, no Brain call, no file access outside temp directories.

## Self-Check

Commits 1975012d4, 61fb81faf, 89b222348, 92a467902, a5e1f2c2e are present in `git log`. Created files exist: lib/mcp/client-identity-log.cjs, lib/core/doctor/mcp-write-path-module.cjs, tests/test-doctor-mcp-write-path.cjs. Branch feat/eureka-adapter-rebased, ahead of origin by 197 (192 before this work plus these 5), nothing pushed. Docs artifacts (this SUMMARY, STATE, PLAN) are not committed; ROADMAP not touched.

## Self-Check: PASSED
