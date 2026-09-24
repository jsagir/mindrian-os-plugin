---
status: fixing
kind: rca
trigger: "mcp-server-sigterm-no-exit"
issue_id: ""
severity: medium
surfaces: [cowork, cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-09-24T07:43:32Z
updated: 2026-09-24T07:43:32Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. `lib/mcp/session-catchup.cjs`'s `registerShutdownHandler` (`:310-339`) installs SIGTERM/SIGINT/`beforeExit` listeners that snapshot session state and run teardown callbacks but never call `process.exit()`. Installing any listener for SIGTERM/SIGINT removes Node's own default terminate-on-signal behavior, so the process survives the signal indefinitely. In HTTP mode the listening socket keeps the event loop alive on top of that. Confirmed for BOTH the HTTP-mode and stdio-mode server.
test: Live SIGTERM against a hermetically-spawned server, both HTTP-mode and stdio-mode, polling for exit for 5000ms.
expecting: (met) neither case exits within 5000ms; the HTTP case leaves port 3847 still bound.
next_action: NONE for this plan (267-02 is RCA-filing only, no code change). Fix owned by 267-13, scoped to `bin/mindrian-mcp-server.cjs` only (`session-catchup.cjs` stays shared and unchanged, per the plan).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48
- Reported by: 267-RESEARCH.md (2026-09-23, "a test server survive SIGTERM and need SIGKILL"), re-reproduced and extended (stdio case added) during 267-02 plan execution (2026-09-24)
- Date first observed: 2026-09-23 (267-RESEARCH.md Runtime State Inventory, "OS-registered state" row; Pitfall 9)
- Related debug sessions: `mcp-http-listen-error-false-started` (RCA 6) -- a stale, undead server from this same defect is what leaves port 3847 bound for the next server's false-started symptom.

### Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `782ecc4662edab1b0901788250ba9ed0ff1992f4` (PLAN_BASE for 267-02)
- **WIRE claims probe against:** hermetically-spawned local instances of `bin/mindrian-mcp-server.cjs` on this same tree, both HTTP transport (port 3847) and stdio transport
- **Date of audit:** 2026-09-24
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Problem Statement

The local `mindrian-os` MCP server does not exit on SIGTERM (or SIGINT) in either HTTP mode or stdio mode; it survives indefinitely and, in HTTP mode, keeps holding its listening port, requiring SIGKILL to actually terminate it.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `SIGTERM` (or `SIGINT`) causes the server process to save its session snapshot, run any registered teardown callbacks, and then exit within a bounded time (Node's own default signal behavior, which the shutdown handler should preserve rather than silently disable).
actual: The process survives SIGTERM past a 5000ms wait in both HTTP mode and stdio mode. In HTTP mode, the listening socket on port 3847 remains bound after the wait (confirmed by a fresh probe listener failing to bind). The process only terminates on SIGKILL.
errors: none thrown -- this is a silent hang, not a crash. `exitCode` is `null` (never set) at the 5000ms deadline in both cases.
reproduction:
  1. HTTP case: spawn `MINDRIAN_TRANSPORT=http node bin/mindrian-mcp-server.cjs` hermetically (port 3847 confirmed free first), wait for the "started" stderr line, send SIGTERM to the child PID, poll for `exit` for 5000ms.
  2. stdio case: spawn `node bin/mindrian-mcp-server.cjs` hermetically with stdin left open (deliberately, matching how a real MCP client would leave a connection's stdin open), wait ~1.5s for boot, send SIGTERM, poll for `exit` for 5000ms.
  3. Observe: neither process exits within the 5000ms window; SIGKILL is required to actually end either one.
started: Present since `registerShutdownHandler`'s SIGTERM/SIGINT listeners were added (session-catchup functionality, pre-existing); not introduced by Phase 267. First formally NAMED as a NEW FAILURE by 267-RESEARCH.md's live observation during Phase 267 research (2026-09-23).

## Scope and Impact

- Affected surfaces: cowork (HTTP mode -- the only branch with a listening socket that visibly stays bound after the hang) and cli (stdio mode, confirmed here to have the identical listener-removes-default-exit defect, though with no port to leak).
- Affected commands: process lifecycle only -- any external supervisor, test harness, or daemon-management code that sends SIGTERM expecting the process to terminate.
- Affected users: any deployment or test harness that relies on graceful SIGTERM shutdown (e.g. a process manager doing a rolling restart, or a CI test harness tearing down a spawned server between test cases).
- Version range: present at the currently-shipped `2.0.0-beta.48`; not a regression introduced by this migration.
- Severity: medium (no data loss or corruption -- the session snapshot DOES save correctly before the hang; the defect is that the process never actually exits, which cascades into RCA 6's false-started symptom and into flaky test harnesses per 267-RESEARCH.md Pitfall 9).
- Blast radius: `bin/mindrian-mcp-server.cjs` (both transport branches) and `bin/mindrian-brain-mcp-client.cjs` (the brain stdio shim), since both call into `registerShutdownHandler` via `lib/mcp/session-catchup.cjs`. This RCA and its owning fix (267-13) are scoped to `bin/mindrian-mcp-server.cjs` only, per the plan's explicit instruction that `session-catchup.cjs` "stays shared and unchanged" -- the brain shim's own exposure to this same shared-module defect is out of this RCA's fix scope and should be tracked separately if it matters to that shim's own lifecycle.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The hang is specific to HTTP mode (the listening socket keeping the event loop alive) and does not affect stdio mode.
  evidence: The stdio-mode reproduction (stdin left open, no listening socket) ALSO fails to exit within 5000ms after SIGTERM. The root cause (installing a SIGTERM/SIGINT listener disables Node's own default terminate-on-signal behavior, and nothing in the handler calls `process.exit()`) applies identically regardless of transport. The listening socket in HTTP mode is an ADDITIONAL reason the event loop stays alive (Node's default SIGTERM behavior, when NOT overridden, terminates immediately regardless of open handles), not the ONLY reason the process survives.
  timestamp: 2026-09-24T07:43:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-24T07:48:00Z
  checked: live SIGTERM against a hermetically-spawned HTTP-mode server (port 3847 confirmed free first)
  found: |
    `HTTP CASE: server started, pid=1869120`
    `HTTP CASE: exited within 5000ms after SIGTERM? false (elapsed=5021ms, exitCode=null)`
    `HTTP CASE: port 3847 free after SIGTERM wait? false (i.e. still bound=true)`
    `HTTP CASE: SIGKILLed the surviving process.`
  implication: Confirms the HTTP-mode symptom exactly: the process survives past the 5000ms window, and the listening socket remains bound the entire time.

- timestamp: 2026-09-24T07:48:00Z
  checked: live SIGTERM against a hermetically-spawned stdio-mode server (stdin left open, matching a real client connection)
  found: |
    `STDIO CASE: pid=1869136 boot stderr tail=... [mindrian-os] MCP server v2.0.0-beta.48 started (desktop, stdio, room: <hermetic room>)`
    `STDIO CASE: exited within 5000ms after SIGTERM (stdin open)? false (elapsed=5030ms, exitCode=null)`
    `STDIO CASE: SIGKILLed the surviving process.`
  implication: Confirms the defect is NOT HTTP-specific -- the identical hang occurs in stdio mode with no listening socket involved, proving the shared `registerShutdownHandler` listener-installation itself (not the socket) is the root mechanism.

- timestamp: 2026-09-24T07:43:32Z
  checked: `lib/mcp/session-catchup.cjs:308-339`, function `registerShutdownHandler`
  found: |
    ```js
    let _shutdownRegistered = false;
    const _extraTeardownCallbacks = [];
    function registerShutdownHandler(roomDir, extraTeardown) {
      if (typeof extraTeardown === 'function') _extraTeardownCallbacks.push(extraTeardown);
      if (_shutdownRegistered) return;
      _shutdownRegistered = true;

      let _shutdownDone = false;
      const handler = () => {
        if (_shutdownDone) return;
        _shutdownDone = true;
        try {
          snapshotSession(roomDir);
          process.stderr.write('[session-catchup] Session state saved on shutdown.\n');
        } catch (e) {
          process.stderr.write(`[session-catchup] Failed to save on shutdown: ${e.message}\n`);
        }
        for (const cb of _extraTeardownCallbacks) {
          try { cb(); } catch (e) { ... }
        }
      };

      process.on('SIGTERM', handler);
      process.on('SIGINT', handler);
      process.on('beforeExit', handler);
    }
    ```
    The handler saves state, runs teardown callbacks, and returns. No `process.exit()` call anywhere in the function or the handler closure.
  implication: This is the exact mechanism. Per Node.js's own documented signal-handling contract, a process with NO listener for SIGTERM/SIGINT terminates immediately on receipt (Node's built-in default action); installing ANY listener (as this function does) replaces that default action, and the process then stays alive until something calls `process.exit()` explicitly or the event loop otherwise empties. Since `handler` never calls `process.exit()`, the process hangs open indefinitely once the handler has already run once (idempotent via `_shutdownDone`), and even the `beforeExit` listener does not help because `beforeExit` only fires when the event loop is ALREADY about to drain naturally -- it does not force a drain.

## Technical Root Cause

- Site: `lib/mcp/session-catchup.cjs:335-338` (listener installation), function `registerShutdownHandler`, called from `bin/mindrian-mcp-server.cjs:228-256` (per that file's own comment block, "register shutdown handler to save session state").
- Cause: `process.on('SIGTERM', handler)` and `process.on('SIGINT', handler)` are installed with a handler that never calls `process.exit()`. Registering any listener for these signals overrides Node's own default action (immediate termination), so the process survives the signal and keeps running. In HTTP mode, the still-open listening socket is an additional, independent reason the event loop never drains on its own; in stdio mode, open stdin/stdout descriptors serve the same role.
- Why it surfaces now: the defect has been present since `registerShutdownHandler` was written; it surfaced as a NAMED finding during Phase 267's research pass because that pass specifically tested server lifecycle under SIGTERM while building test harnesses for the SDK migration (267-RESEARCH.md Pitfall 9: "a stale test server ... keeps port 3847 bound, and later test servers fail to bind silently. That produced false readings during this research").

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `bin/mindrian-mcp-server.cjs` only (NOT `session-catchup.cjs`, which stays shared and unchanged per the plan, since it is also used by the brain stdio shim and changing its shared contract is out of this fix's scope)
  - Current behavior: `registerShutdownHandler(roomDir, extraTeardown)` is called with no additional termination step; the process relies solely on that shared handler, which never exits.
  - Required behavior: register a terminal signal listener in `bin/mindrian-mcp-server.cjs` itself, installed AFTER the call to `registerShutdownHandler` (so the session snapshot and any flag-ON pidfile clear still run first, via the existing `extraTeardown` callback mechanism or a dedicated `process.on('SIGTERM'/'SIGINT', ...)` pair local to this file), that closes the HTTP server (`app.listen()`'s returned server instance, via `.close()`) and any MCP transport/handler, then calls `process.exit(0)`. Add an unref'd hard-exit backstop timer (e.g. `setTimeout(() => process.exit(0), N).unref()`) so a slow or stuck close-callback cannot re-introduce the same hang.
  - Short-term patch: same as required behavior -- the fix is inherently the addition of an explicit exit path; there is no smaller interim step that does not also add an exit call.
  - Long-term fix: none beyond the above. `session-catchup.cjs`'s own contract (save-and-teardown, no exit) is correct for its OTHER caller (the brain stdio shim, `bin/mindrian-brain-mcp-client.cjs`), so the exit responsibility belongs in each entry point's own file, not in the shared module.
- Owning plan: 267-13 (per the RCA-to-plan artifact table in `267-02-PLAN.md`, shared with RCA 6).

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: a Phase 267 lifecycle test (267-13 to create, e.g. `tests/test-267-mcpv2-lifecycle-sigterm.cjs`), reusing the port-free-precheck / SIGKILL-only-of-spawned-PIDs discipline from `tests/helpers/mcp-wire-267.cjs`
  - Given: the HTTP-mode server running hermetically, post-fix
  - When: SIGTERM is sent to the process
  - Then: the process exits within a bounded time (e.g. 2000ms) AND port 3847 is free immediately after
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list
- Test 2:
  - Type: integration
  - Location: same file, added by 267-13
  - Given: the stdio-mode server running hermetically (stdin left open), post-fix
  - When: SIGTERM is sent to the process
  - Then: the process exits within a bounded time
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the version 267-13 ships in ("the local MCP server now exits on SIGTERM/SIGINT instead of hanging indefinitely").
- Release lockstep: applies when 267-13 ships; see `.claude/includes/release-process.md` and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5.
- Canon: touches Part 9 (Memory Locality) tangentially -- the session snapshot IS the local-mind write this handler protects; the fix must not weaken that save-before-exit guarantee while adding the exit call. No `docs/CANON-PHASE-MAP.md` update required (no new Canon surface, only a lifecycle-completeness fix).
- knowledge-base.md: on resolve, add the summary block per `docs/RCA-TEMPLATE.md` section 1.
- Docs / monitoring / process notes: any process-manager or deployment doc that assumes SIGTERM already worked gracefully should be checked once 267-13 ships (none found referencing this assumption at RCA-filing time).
- **MindrianOS gate answers (docs/RCA-TEMPLATE.md section 5):**
  1. Canon Part 8 (Graph Boundary): no Brain wire involved. The fix only touches local process-lifecycle and local session-snapshot-to-disk behavior.
  2. Tri-Polar: affects cowork (HTTP mode, confirmed) and cli (stdio mode, confirmed here). Desktop uses the same stdio server binary and is affected by construction (unverified live on Desktop specifically, consistent with 267-RESEARCH.md's open A2 on Desktop's live-probed behavior in general).
  3. Cross-platform: SIGTERM/SIGINT signal delivery itself is POSIX-specific; Windows has different signal semantics (SIGTERM is emulated by Node, SIGINT maps to Ctrl+C). The fix's own exit-call addition is portable JS, but the RCA and its fix should be verified on Windows before claiming full cross-platform coverage -- state this explicitly as a gap for 267-13 to close or acknowledge.
  4. Release lockstep: named above.
  5. No em-dashes: this file and the eventual fix's commit message, code comments, and CHANGELOG entry all use hyphens only.
  6. Reuse before build (Part 7): the fix reuses the EXISTING `extraTeardown` callback seam already built into `registerShutdownHandler` (`session-catchup.cjs:304-306`) rather than duplicating the snapshot-save logic; it only adds what that seam does not already provide (the actual `process.exit()` call and socket close).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- see Technical Root Cause above.
fix: PENDING - lands in 267-13
verification: PENDING
files_changed: []
commits: PENDING
