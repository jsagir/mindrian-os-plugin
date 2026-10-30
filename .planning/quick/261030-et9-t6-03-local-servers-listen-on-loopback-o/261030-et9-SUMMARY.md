---
phase: 261030-et9-t6-03-local-servers-listen-on-loopback-o
plan: 01
quick_id: 261030-et9
subsystem: local-previews
tags: [security, loopback, cors, dns-rebinding, T6-03, T6-08]
status: COMPLETE
requires: []
provides:
  - lib/core/loopback-guard.cjs (LOOPBACK_HOST, hostHeaderAllowed, corsHeaders, refuseForeignHost, expressHostGuard)
  - tests/test-261030-et9-loopback-servers.cjs (RED then GREEN, 100 ok checks)
key-files:
  created:
    - lib/core/loopback-guard.cjs
    - tests/test-261030-et9-loopback-servers.cjs
  modified:
    - lib/quickview/hub-server.cjs
    - lib/quickview/server.cjs
    - lib/presentation/presentation-server.cjs
    - scripts/serve-dashboard
    - scripts/serve-wiki
    - scripts/serve-presentation
    - CHANGELOG.md
decisions:
  - "Host check compares the host name only, not the port (DV-1)"
  - "Bind 127.0.0.1 only, not ::1 (documented limit)"
completed: 2026-10-30
---

# Phase 261030-et9 Plan 01: local previews listen on loopback only (T6-03, T6-08) Summary

STATUS is COMPLETE. All 3 tasks ran. 7 commits exist on quick/261030-localhost-bind. Nothing is pushed. The 3 Node previews and the Python dashboard now listen on 127.0.0.1 only. The hub and the quick view send no wildcard CORS header. The 3 Node previews answer 403 to a foreign Host.

## Commits (7, none pushed)

| Order | Sha | Message |
|-------|-----|---------|
| 1 | faf1d46fc | test(261030-et9): add the failing loopback-servers test for T6-03 and T6-08 |
| 2 | d3d7ad203 | fix(261030-et9): add lib/core/loopback-guard.cjs (loopback host, Host check, same-origin CORS) |
| 3 | 426b1c091 | fix(261030-et9): live hub preview listens on 127.0.0.1, refuses a foreign Host, drops the wildcard CORS |
| 4 | 4cf289eb5 | fix(261030-et9): quick view preview listens on 127.0.0.1, refuses a foreign Host, drops the wildcard CORS |
| 5 | 1eea7d2e1 | fix(261030-et9): presentation preview listens on 127.0.0.1 and refuses a foreign Host |
| 6 | 48b184cbb | fix(261030-et9): serve-dashboard serves on 127.0.0.1 only; the port probes of serve-dashboard, serve-wiki and serve-presentation check 127.0.0.1 |
| 7 | fd1215577 | docs(261030-et9): CHANGELOG Fixed bullet for the loopback-only previews |

PROVEN: all 7 shas are ancestors of HEAD (`git merge-base --is-ancestor`, HEAD is fd1215577). Each commit used `git commit --only -m ... -- <paths>`. `git show --stat` on each commit showed only the intended paths. PROVEN: no file was deleted. PLAN.md, SUMMARY.md and STATE.md are not committed by this run. ROADMAP.md and STATE.md are not touched.

## Setup

- `node -e "require.resolve('express'); ..."` failed in the worktree (no node_modules). PROVEN.
- `npm ci --ignore-scripts --no-audit --no-fund` in the worktree: exit 0, `added 137 packages in 17s`. PROVEN. The NODE_PATH fallback was not needed. `git status --porcelain` stayed empty after the install (node_modules is ignored). PROVEN.

## RED run (commit 1)

Command: `node tests/test-261030-et9-loopback-servers.cjs`. Result: exit 1, last line `loopback-servers: 36 FAILED`. PROVEN. 29 checks passed in RED.

FAIL groups (PROVEN, from the run log):
- `[helper] lib/core/loopback-guard.cjs loads: Cannot find module .../lib/core/loopback-guard.cjs`
- `[hub] listens on 127.0.0.1 only (address): expected "127.0.0.1", got "::"`
- `[hub] no connect on network address 172.23.19.94: connected to 172.23.19.94:33621`
- `[hub] no CORS header for a foreign Origin on ...`: GET /api/state, GET /api/actions, POST /api/command, OPTIONS /api/state, OPTIONS / (each `access-control-allow-origin is *`)
- `[hub] own origin http://localhost:PORT / http://127.0.0.1:PORT is echoed ...: got "*"`
- `[hub] Host evil.example, evil.example:PORT, localhost.evil.com:PORT, 127.0.0.1.evil.com gets 403 on /api/state: expected 403, got 200`
- `[quickview]` the same groups: address `::`, network connect, GET /api/state wildcard, own-origin echo `*`, 4 foreign Host cases at 200
- `[presentation]` address `::`, network connect, 4 foreign Host cases times 2 paths (/ and /__sse) at 200
- `[static]` serve-dashboard has no `--bind 127.0.0.1`; serve-dashboard, serve-presentation and serve-wiki bind `''`; the .listen( inventory lists the 3 Node previews with no loopback host

Passes in RED, as the plan expected (PROVEN): 200 on 127.0.0.1 and localhost; the opener log held `http://localhost:PORT` (so the stub took the call and no real browser opened); the printed URL of the presentation; the no-Host case (Node answers 400); the ::1-first client; the presentation CORS arm.

Stub and cleanup (PROVEN): the opener checks of [hub] and [quickview] passed, so the stub xdg-open took each call. `/tmp/et9-loopback-*` did not exist after the run. `ps` showed no leftover server.

After commit 2 (helper only), PROVEN: 36 `ok - [helper]` lines, 0 `FAIL - [helper]` lines, `loopback-servers: 35 FAILED` (server and static arms still red).
After commits 3 and 4: the [hub] and [quickview] arms had 0 FAIL lines. After commit 5: only the 2 scripts/ static arms failed (`loopback-servers: 2 FAILED`). PROVEN.

## GREEN runs (after commit 7)

- Run 1: exit 0, last line `loopback-servers: ALL PASS`. PROVEN.
- Run 2: exit 0, last line `loopback-servers: ALL PASS`. 100 `ok -` lines. PROVEN.
- SKIP lines: none (this machine has the non-loopback IPv4 address 172.23.19.94). PROVEN.
- INFO lines, run 2 (PROVEN, they do not count):
  - `[hub] a ::1-only client without fallback: ECONNREFUSED (documented limit)`
  - `[quickview] a ::1-only client without fallback: ECONNREFUSED (documented limit)`
  - `[presentation] a ::1-only client without fallback: ECONNREFUSED (documented limit)`

## Existing server tests, before and after

| Test | Before (baseline) | After |
|------|-------------------|-------|
| tests/test-232-wiki-server.cjs | exit 0, `test-232-wiki-server: 8/8 passed` | exit 0, `test-232-wiki-server: 8/8 passed` |
| lib/memory/dashboard-server.test.cjs | exit 0, `dashboard-server: all tests passed (...)` | exit 0, same line |
| tests/test-354-dashboard-host-read.cjs | exit 0, `PASS - 14 checks` | exit 0, `PASS - 14 checks` |

PROVEN. No regression. No full suite and no run-all aggregator was run (C-4).

## Python runtime proof (Task 3 Step 1 d)

PROVEN. `python3 -m http.server $P --bind 127.0.0.1 --directory <scratch>/pydir` on a free port:
- `curl http://localhost:$P/` returned 200.
- `curl -m 2 http://172.23.19.94:$P/` returned curl exit 7 (connection refused).
- The Python process was killed. `ps` showed 0 leftover http.server processes.
`bash -n` returned 0 for serve-dashboard, serve-wiki and serve-presentation. scripts/serve-dashboard itself was not run (it writes dashboard/graph.json in the repo).

## What changed

- lib/core/loopback-guard.cjs (new, 96 lines): `LOOPBACK_HOST = '127.0.0.1'`; `hostHeaderAllowed` (localhost, 127.0.0.1, [::1], any case, optional port 1 to 65535, lookalikes refused); `corsHeaders(origin, port)` (echo of the own origin only, with `Vary: Origin`, never `*`); `refuseForeignHost` (403, body `Forbidden`, no echo of the Host); `expressHostGuard`. Built-ins only. No require, no room data, no network call.
- lib/quickview/hub-server.cjs: `refuseForeignHost` is the first statement of the handler; 4 wildcard headers became the `corsHeaders` spread (the OPTIONS block keeps Allow-Methods and Allow-Headers); `server.listen(port, LOOPBACK_HOST, ...)`.
- lib/quickview/server.cjs: same pattern, 1 wildcard header.
- lib/presentation/presentation-server.cjs: `app.use(expressHostGuard)` before the first route; `app.listen(port, LOOPBACK_HOST, ...)`. No CORS header added.
- scripts/serve-dashboard: `--bind 127.0.0.1` on the http.server line; the port probe binds 127.0.0.1. scripts/serve-wiki and scripts/serve-presentation: the port probe binds 127.0.0.1.
- CHANGELOG.md: 1 insertion, 0 deletions, in `[Unreleased]` `### Fixed`; the bullet ends with "Not live until a release carries it."
- Unchanged (PROVEN by diff review): the printed and opened URL `http://localhost:${port}`, the port printing and defaults, the endpoints, the browser-open code.

## Deviations from Plan

None. The plan ran as written. DV-1 to DV-6 were applied as stated. One small implementation detail: `hostHeaderAllowed` matches the bracketed form with the brackets inside the captured name, so the allow-list holds the literal `[::1]`. The behavior is the one the plan lists.

### Auth gates

None.

## Threat flags

None new. The helper reads only the Host and Origin strings of a request (T-et9-07, Part 8 holds). The change adds no endpoint, no auth path and no file access. T6-08 residual exposure is listed under RISKS.

## Known Stubs

None.

## Tri-Polar (C-8)

ASSUMED from the plan and the command files: the previews run only on the Claude Code CLI. Desktop and Cowork do not start them. The Cowork MCP HTTP transport (scripts/mindrian-mcp-server.cjs) is not touched.

## Report fields

STATUS: DONE

CHANGED:
- Created: lib/core/loopback-guard.cjs, tests/test-261030-et9-loopback-servers.cjs.
- Modified: lib/quickview/hub-server.cjs, lib/quickview/server.cjs, lib/presentation/presentation-server.cjs, scripts/serve-dashboard, scripts/serve-wiki, scripts/serve-presentation, CHANGELOG.md.
- Commits: faf1d46fc, d3d7ad203, 426b1c091, 4cf289eb5, 1eea7d2e1, 48b184cbb, fd1215577 (branch quick/261030-localhost-bind, base bc75d431e, not pushed).

VERIFIED:
- RED: exit 1, `loopback-servers: 36 FAILED` before the fix.
- GREEN: 2 runs, `loopback-servers: ALL PASS`, exit 0 each.
- The 3 existing server tests match their baseline (8/8, all passed, 14 checks).
- Python form: 200 on localhost, curl exit 7 on 172.23.19.94.
- 0 en-dash or em-dash in the added lines of all changed files.
- No wildcard CORS header remains in lib/quickview.
- `git status --porcelain` shows only .planning paths. node_modules is not committed.
- No server process is left running. The temp dir is removed.

UNVERIFIED:
- Windows browser reach through WSL localhost forwarding. Human check: on the WSL machine, run /mos:present and confirm that the Windows browser opens http://localhost:PORT/ and shows the presentation. Windows interop does not run in this sandbox. Microsoft documents forwarding for ports bound to the WSL VM localhost (ASSUMED to cover 127.0.0.1). The wiki server (127.0.0.1 since 260923-lu5) is the precedent.
- Browsers fall back from ::1 to 127.0.0.1 for localhost (ASSUMED, happy eyeballs). Only Node was tested, with a ::1-first lookup and autoSelectFamily true.
- macOS and Windows runs of the new test (the runtime arms skip on win32 by design).
- scripts/serve-dashboard run end to end (it writes into the repo).

RISKS:
- T6-08 residual: lib/wiki/wiki-server.cjs binds 127.0.0.1 but has no Host check, and it exposes /api/save. A DNS rebinding page can reach it. PROVEN by the plan inventory, not changed here (DV-6).
- T6-08 residual: the Python dashboard (scripts/serve-dashboard) has no Host check. It now listens on 127.0.0.1 only, but a rebinding page can still read the snapshot.
- A client that tries only ::1 for localhost and never falls back cannot connect. Documented limit. INFO lines show ECONNREFUSED for that case.
- The Host check accepts any port in the header (DV-1). A rebinding page always sends its own name, so the host name check blocks it.
- Not live until a release carries the change.

NEXT: Queue a follow-up quick for the two residual T6-08 sites: add the shared Host guard (lib/core/loopback-guard.cjs) to lib/wiki/wiki-server.cjs, and move the Python dashboard to scripts/serve-dashboard-live or a Node server with the guard. Run the WSL human check for /mos:present before the beta.77 cut. The orchestrator commits PLAN.md, SUMMARY.md and STATE.md with `git add -f`.

## Self-Check: PASSED

- Files exist: lib/core/loopback-guard.cjs, tests/test-261030-et9-loopback-servers.cjs. PROVEN.
- 7 commits exist and are ancestors of HEAD. PROVEN.
