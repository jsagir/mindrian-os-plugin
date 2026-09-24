---
status: fixing
kind: rca
trigger: "mcp-http-listen-error-false-started"
issue_id: ""
severity: medium
surfaces: [cowork]
brain_mode: full-loop
canon_parts: [11]
created: 2026-09-24T07:43:32Z
updated: 2026-09-24T07:43:32Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. `bin/mindrian-mcp-server.cjs:404` calls `app.listen(listenPort, '127.0.0.1', () => {...})` with a zero-argument callback. Express 5 (installed: `express@5.2.1`) invokes that callback with a bind-error argument (e.g. `EADDRINUSE`) when the listen fails, but the callback signature here takes no parameter, so the error is silently dropped and the "success" branch runs unconditionally -- the server logs a false "started" line and, flag-ON, would write a pidfile for a port it does not own.
test: Held port 3847 with a test-owned `net` listener, then spawned the flag-OFF HTTP server and captured its stderr for 5000ms.
expecting: (met) the false "started" line prints anyway, and the process stays alive rather than exiting on the bind failure.
next_action: NONE for this plan (267-02 is RCA-filing only, no code change). Fix owned by 267-13 (shared with RCA 5).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48
- Reported by: 267-02 plan execution (2026-09-24), found live during plan-time reproduction (per `267-02-PLAN.md`'s objective, one of the four defects "found at plan time")
- Date first observed: 2026-09-23 (plan-time), the Express 5.2.1 callback-signature check cited in `267-02-PLAN.md`'s Task 2 action text; re-reproduced live 2026-09-24 during this RCA-filing plan
- Related debug sessions: `mcp-server-sigterm-no-exit` (RCA 5) -- a stale, undead server from THAT defect is exactly what leaves port 3847 held for a later server to false-start against, in a real deployment; this RCA's reproduction instead holds the port deliberately with a test-owned listener to isolate the defect independently.

### Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `782ecc4662edab1b0901788250ba9ed0ff1992f4` (PLAN_BASE for 267-02)
- **WIRE claims probe against:** a hermetically-spawned local instance of `bin/mindrian-mcp-server.cjs` on this same tree, HTTP transport, flag-OFF, with port 3847 deliberately held by a test-owned `net.Server`
- **Date of audit:** 2026-09-24
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Problem Statement

When the local `mindrian-os` MCP server's HTTP branch fails to bind its port (e.g. `EADDRINUSE`), it logs a false "MCP server ... started ... HTTP on 127.0.0.1:3847 ..." success line and keeps running, rather than reporting the bind failure and exiting -- a success report with no actual success, this repo's recurring false-success class.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: When `app.listen()` fails to bind (port already held), the server logs an honest error naming the failure (e.g. the error code and the port), skips any flag-ON pidfile write and session catch-up, and exits with a non-zero code.
actual: The server logs the SAME "started" success line it would log on a real successful bind, even though the port is held by an unrelated process, and the process stays alive (does not exit).
errors: none surfaced to the operator -- this IS the bug: the underlying Express/Node bind error is never read or reported at all.
reproduction:
  1. Confirm port 3847 is free.
  2. Bind port 3847 with a test-owned `net.Server` (holding the port).
  3. Spawn `MINDRIAN_TRANSPORT=http node bin/mindrian-mcp-server.cjs` hermetically, flag-OFF.
  4. Observe stderr over the next 5000ms: the "started ... HTTP on 127.0.0.1:3847 ..." line prints anyway, and the process does not exit.
started: Present since `app.listen(port, host, callback)` was first written with a zero-argument callback; not introduced by Phase 267. Confirmed live at plan time (2026-09-23) via an Express 5.2.1 callback-signature check, and reproduced again here (2026-09-24).

## Scope and Impact

- Affected surfaces: cowork (the only surface routed to the HTTP branch by default).
- Affected commands: server startup itself -- any operator or process manager trying to start the local server on an already-occupied port 3847.
- Affected users: any deployment where port 3847 is already held (most commonly by a previous instance of this same server that survived SIGTERM without exiting -- see RCA 5, `mcp-server-sigterm-no-exit`, which produces exactly this precondition in practice).
- Version range: present since this callback was written; confirmed reproduced against the currently-installed `express@5.2.1` (declared range `^5.1.0` in `package.json`).
- Severity: medium (no data corruption, but it is a false-success report that can leave an operator believing a server is live and serving on a port when it is not -- the "real" server that lost the race silently limps along doing nothing useful, while any client connecting to port 3847 is actually talking to the OTHER process that won the bind).
- Blast radius: isolated to the flag-OFF `app.listen()` callback and its flag-ON sibling logic (pidfile write, session catch-up) that also runs unconditionally inside the same callback body.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Express 5 does not actually pass an error to the `listen()` callback, so there is nothing to read.
  evidence: `267-CONTEXT.md`/`267-02-PLAN.md`'s own plan-time check states Express 5.2.1 invokes the `app.listen` callback with an EADDRINUSE error object -- this is the documented Express 5 behavior (a change from Express 4's error-via-`'error'`-event-only contract). The installed version (`express@5.2.1`, confirmed via `node_modules/express/package.json`) matches the version this check was run against.
  timestamp: 2026-09-24T07:43:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-24T07:49:00Z
  checked: live spawn of the flag-OFF HTTP server with port 3847 held by a test-owned `net.Server`, hermetic env
  found: |
    `HOLDER: bound 3847`
    `CHILD STDERR after 5000ms:`
    `[mindrian-os] Capabilities: active=[apps, tasks] inactive=[hooks, scripts]`
    `[mindrian-os] MCP Apps registered: room-dashboard, room-wiki, room-graph`
    `[mindrian-os] MCP server v2.0.0-beta.48 started (cowork, HTTP on 127.0.0.1:3847, room: <hermetic room>)`
    `[mindrian-os] Session catch-up: first session or no changes detected.`
    `CHILD exited? false exitCode=null`
    `CHILD contains false "started" line? true`
  implication: Confirms the Symptoms exactly -- the false "started" line prints even though the port was already held by a different process for the entire 5000ms window, and the child process never exits (it also never actually served anything, since it never successfully bound the port).

- timestamp: 2026-09-24T07:43:32Z
  checked: `bin/mindrian-mcp-server.cjs:403-410`
  found: |
    ```js
    const listenPort = mcpFirstOn ? daemonLifecycle.discoverPort() : 3847;
    app.listen(listenPort, '127.0.0.1', () => {
      process.stderr.write(`[mindrian-os] MCP server v${version} started (${surface.surface}, HTTP on 127.0.0.1:${listenPort}, room: ${roomDir})\n`);

      if (mcpFirstOn) {
        daemonLifecycle.writePidfile({ pid: process.pid, port: listenPort });
        let cleared = false;
        ...
    ```
    The callback function takes zero parameters. Whatever Express passes as its first argument (the bind error, on failure) is discarded.
  implication: This is the exact defect site. The callback body runs UNCONDITIONALLY -- it cannot distinguish "listen succeeded" from "listen failed, here is why" because it never reads the argument that would tell it. Both the success log line and (flag-ON) the pidfile write happen regardless of whether the bind actually succeeded.

- timestamp: 2026-09-24T07:43:32Z
  checked: `express@5.2.1`'s installed `package.json` (`node_modules/express/package.json`) and the plan's own plan-time verification note
  found: express `5.2.1` is the version installed (declared range `^5.1.0` in `package.json`), matching the version the plan-time EADDRINUSE-callback-argument check was run against.
  implication: The fix's precondition claim (Express 5.2.1 passes an error to the listen callback) is verified against the exact version in this tree, not an assumed or stale version.

## Technical Root Cause

- Site: `bin/mindrian-mcp-server.cjs:404`, the `app.listen(listenPort, '127.0.0.1', () => {...})` callback, function scope inside `main()`'s HTTP branch.
- Cause: the callback function signature declares zero parameters. Express 5's `app.listen()` (built on Node's `net.Server.listen()`, whose `'listening'`/`'error'` events Express 5 bridges into the user callback per its documented contract change from Express 4) invokes this callback with an error object as its first argument when the bind fails (e.g. `EADDRINUSE`). Because the callback never declares or reads that parameter, the error is silently discarded and the callback body -- which assumes success unconditionally -- runs anyway.
- Why it surfaces now: this defect has been present since the callback was first written; it surfaced as a NAMED plan-time finding because Phase 267's planning pass specifically checked Express 5's listen-callback error contract while reading this file for the HTTP-branch migration work, and then live-verified it by deliberately holding the port.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `bin/mindrian-mcp-server.cjs:404-410`, function scope inside `main()`'s HTTP branch
  - Current behavior: `app.listen(listenPort, '127.0.0.1', () => { ...unconditional success path... })` -- the bind-error argument is never read.
  - Required behavior: accept the error argument (`app.listen(listenPort, '127.0.0.1', (err) => { ... })`); when `err` is truthy, write ONE honest stderr line naming the error code and the port (e.g. `` `[mindrian-os] FATAL: failed to bind 127.0.0.1:${listenPort}: ${err.code || err.message}\n` ``), skip the pidfile write and session catch-up entirely, and exit with a non-zero code (`process.exit(1)`); only run the existing success-path body (the "started" log line, flag-ON pidfile write, session catch-up) when `err` is falsy.
  - Short-term patch: same as required behavior -- reading the already-available error argument is itself the minimal fix; there is no smaller interim step.
  - Long-term fix: none beyond the above. This pairs naturally with RCA 5's fix (267-13, same owning plan): once the server reliably exits on SIGTERM, stale port-holders become rare, reducing how often this bind-failure path is even hit in practice -- but the honest-error behavior must still exist independently for the cases where it is hit (a genuinely different process holding the port, a race between two legitimate daemon-spawn attempts, and so on).
- Owning plan: 267-13 (per the RCA-to-plan artifact table in `267-02-PLAN.md`, shared with RCA 5).

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: a Phase 267 lifecycle test (267-13 to create, e.g. `tests/test-267-mcpv2-lifecycle-listen-error.cjs`), reusing the port-free-precheck / SIGKILL-only-of-spawned-PIDs discipline from `tests/helpers/mcp-wire-267.cjs`
  - Given: port 3847 held by a test-owned listener, post-fix
  - When: the flag-OFF HTTP server is spawned
  - Then: stderr contains an honest bind-failure line (never the "started" success line) AND the process exits with a non-zero code within a bounded time
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list
- Test 2:
  - Type: integration
  - Location: same file, added by 267-13
  - Given: port 3847 free, post-fix
  - When: the flag-OFF HTTP server is spawned
  - Then: the existing success behavior is unchanged -- the "started" line prints and the server serves normally (a regression guard so the error-argument fix does not accidentally break the success path)
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the version 267-13 ships in ("the local MCP server now reports an honest error and exits when it fails to bind its HTTP port, instead of falsely logging success").
- Release lockstep: applies when 267-13 ships; see `.claude/includes/release-process.md` and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5.
- Canon: no `docs/CANON-PHASE-MAP.md` update required -- this is a lifecycle-honesty fix, not a new Canon surface. It does directly serve CLAUDE.md's "Honest refusal everywhere" decision (#8): a bind failure must surface, never be silently concealed as success.
- knowledge-base.md: on resolve, add the summary block per `docs/RCA-TEMPLATE.md` section 1.
- Docs / monitoring / process notes: none beyond the above.
- **MindrianOS gate answers (docs/RCA-TEMPLATE.md section 5):**
  1. Canon Part 8 (Graph Boundary): no Brain wire involved. Pure local process-lifecycle and stderr-logging change.
  2. Tri-Polar: cowork only (the only surface reaching this HTTP branch by default). CLI and Desktop (stdio) never call `app.listen()` and are unaffected by construction.
  3. Cross-platform: `EADDRINUSE` and Node's error-object-to-listen-callback contract are cross-platform Node/Express behavior, not OS-specific; the fix is correct on Windows/Mac/Linux by construction.
  4. Release lockstep: named above.
  5. No em-dashes: this file and the eventual fix's commit message, code comments, and CHANGELOG entry all use hyphens only.
  6. Reuse before build (Part 7): not applicable -- this is a one-parameter signature fix to existing code, no new surface added.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- see Technical Root Cause above.
fix: PENDING - lands in 267-13
verification: PENDING
files_changed: []
commits: PENDING
