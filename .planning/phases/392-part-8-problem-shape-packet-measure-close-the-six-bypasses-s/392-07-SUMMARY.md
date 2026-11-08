---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 07
subsystem: eureka-bridge
tags: [eureka, mcp-client, timeout, engine_timeout, job-sessions, loop-check-L2, F9]
requires: []
provides:
  - "callOptions(deadlineMs, signal) -> {signal, timeout, maxTotalTimeout} on every Eureka client.callTool"
  - "isRequestTimeout(error): the client request-timeout error, mapped to engine_timeout while connected"
  - "job session eviction on transport close or error"
  - "FAKE_EUREKA_SLEEP_MS in the 387 fake engine"
affects: [392-SC6, 392-SC7]
tech-stack:
  added: []
  patterns:
    - "every client.callTool carries the plugin deadline as timeout and maxTotalTimeout"
    - "a timeout after a successful connect is engine_timeout, never a start failure"
key-files:
  created:
    - tests/test-392-eureka-deadline.cjs
  modified:
    - lib/mcp/eureka-tool-contract.cjs
    - lib/mcp/tools/eureka-graph-analyze.cjs
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - tests/fixtures/eureka-fake-engine-387/fake-uv.cjs
decisions:
  - "isRequestTimeout accepts the client 2.x SdkError code REQUEST_TIMEOUT and the legacy 1.x McpError code -32001"
  - "job lifecycle calls (status, result, cancel) use a per-session deadline read at start from MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS (default 900 s)"
  - "scout_result after a terminal state gets the full configured deadline; a call inside a polling loop gets the time left, floor 1 s; a best-effort scout_cancel gets 5 s"
  - "eviction is wired on client.onclose and client.onerror (the client wraps transport.onclose and calls its own onclose after the transport is gone)"
metrics:
  duration: "about 35 minutes"
  tasks: 2
  files: 6
  completed: 2026-11-08
---

# Phase 392 Plan 07: Eureka deadline on every callTool (loop check L2) Summary

The plugin deadline (120 s or 900 s) now rides on every Eureka `client.callTool` as `timeout` and `maxTotalTimeout`, so the MCP client default of 60 s no longer cuts a local Eureka run and a timeout after a connect is reported as `engine_timeout`, never `engine_start_failed`.

## Root cause (PROVEN in the installed tree)

- `node_modules/@modelcontextprotocol/client/dist/src-D0qEN74R.cjs:5521` `const DEFAULT_REQUEST_TIMEOUT_MSEC = 6e4;`
- `:6222` `const timeout = options?.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC;` and `:6223` `new SdkError(SdkErrorCode.RequestTimeout, "Request timed out", { timeout })`.
- `:261` `SdkErrorCode["RequestTimeout"] = "REQUEST_TIMEOUT"`. The installed client is `@modelcontextprotocol/client` 2.1.0 (package.json pins `^2.1.0`). The plan expected an `McpError` with `ErrorCode.RequestTimeout` (-32001); that is the 1.x SDK shape. `isRequestTimeout` accepts both codes.
- `maxTotalTimeout`: `:5776-5784` `_setupTimeout` stores it; `:5786-5797` `_resetTimeout` throws `SdkError(RequestTimeout, "Maximum total timeout exceeded")` when the total elapsed time reaches it; `:6011-6013` the progress handler calls `_resetTimeout` only when `resetTimeoutOnProgress` is true. The plugin does not set `resetTimeoutOnProgress`, so the per-request `timeout` bounds every call today and `maxTotalTimeout` is the ceiling if a later caller enables progress resets. The input-required driver (`:5241-5248`) shrinks `maxTotalTimeout` per leg.
- Every callTool on beta.81 passed only `{ signal }` or nothing, so the 60 s error reached `startFailureRefusal` with `requestSignal.aborted` false.

## The 26 sites re-pinned on beta.81 (a362bf1c4), all changed

- eureka-graph-analyze.cjs :46 scout_run_workflow; :137 scout_start_opportunity_signal_scout; :159 scout_status (loop); :169, :178, :183, :187, :198 scout_cancel; :176 scout_result (no options before).
- eureka-capability-run.cjs :124 scout_status (loop); :136, :146, :151, :155 scout_cancel; :144 scout_result; :166 scout_capability_contract; :178 route start; :221 scout_capabilities.
- eureka-capability-jobs.cjs :53 scout_capabilities; :63 scout_capability_contract; :74 route start; :133 scout_status; :152 scout_result; :205 scout_cancel; :230 scout_cancel (expire); :234 scout_status (bounded cleanup, no options before).
- After the change there are 27 `callTool(` lines (10, 9, 8): the 26 sites plus one new best-effort scout_cancel in the scout timeout branch. Grep: `callTool without callOptions: 0`.

## Deadline per call

| Call | Deadline |
|------|----------|
| scout_run_workflow (graph) | timeoutMs from MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS, default 120 s |
| scout_start_opportunity_signal_scout, scout_result (scout) | timeoutMs from MINDRIAN_EUREKA_SCOUT_TIMEOUT_MS, default 900 s (computed before the start call; the polling budget still starts after the start) |
| scout_status in a polling loop | time left to the loop deadline, floor 1 s |
| scout_capabilities, scout_capability_contract, route start (run) | MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS, default 900 s |
| scout_result in waitForJob | timeoutMs of waitForJob |
| job session start calls and lifecycle calls (status, result, cancel) | session.call_deadline_ms from MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS at start, default 900 s |
| every best-effort scout_cancel, expire cancel | CANCEL_DEADLINE_MS 5,000 ms |
| expire bounded-cleanup scout_status | time left to the 10 s cleanup deadline, floor 1 s |

All deadlines are clamped to 1,000 .. 1,800,000 ms. A call with no signal passes `signal: undefined`.

## RED proof (Task 1, on beta.81 code, commit ed5168f69)

Command: `node tests/test-387-eureka-fake-engine.cjs && node tests/test-392-eureka-deadline.cjs; echo "exit $?"`

- test-387-eureka-fake-engine: 6 passed, 0 failed (the fixture change kept the 387 contract).
- `leg A: ok=false reason=engine_unavailable elapsed=62.1 s` with `cause: engine_start_failed`, `engine_state: broken`.
- `leg B: ok=false reason=engine_unavailable elapsed=62.1 s` with `cause: engine_start_failed`.
- `leg C result: ok=false reason=engine_result_error status=- elapsed=60.0 s`.
- `leg C eviction: session_gone=false after 1.0 s`.
- `test-392-eureka-deadline: 0 passed, 4 failed, total 187.6 s`; printed `exit 1`.
- Note: the typed refusal carries the start cause in `cause` and the reason `engine_unavailable`; the plan wrote "reason engine_start_failed". The 62.1 s is the 60 s client default plus the 2 s stdin grace of `StdioClientTransport.close` (stdio.cjs :184-197) because the fake's pending 65 s timer keeps it alive until SIGTERM.

## GREEN proof (Task 2)

- `leg A: ok=true elapsed=65.2 s`; `leg B: ok=false reason=engine_timeout elapsed=64.0 s` (62 s deadline plus the 2 s close grace; not engine_start_failed); `leg C result: ok=true status=completed elapsed=65.0 s`; `leg C eviction: session_gone=true after 0.1 s`. In every leg the fake recorded the request (connected was true).
- `test-392-eureka-deadline: 4 passed, 0 failed, total 194.6 s`, exit 0.
- `bash tests/run-all-387.sh`: PASS=13 FAIL=0 SKIPPED=1 (test-387-eureka-live-leak, ENV GAP, as before), exit 0.
- `node tests/test-387-eureka-egress.cjs`: 22 passed, 0 failed, exit 0 (A5 and A9 prove the request text and the arguments are unchanged).
- `tests/test-389-seed-egress.cjs` is absent on this branch (it arrives with the later rebase); not run.
- Other suites that load the three modules: test-eureka-capability-run, test-eureka-graph-opportunity-scout, test-eureka-373-02-offline-env, test-eureka-373-02-error-scrub, test-270-tool-schema-budget: all exit 0.
- grep verify: `callTool without callOptions: 0`.
- `node scripts/doctor.cjs --acceptance`: 24/25 while the Task 2 files were still uncommitted; the one failure was `verify-release-clean-tree` (4 tracked files modified at run time), which the Task 2 commit clears. Pre-existing WARN: real-room receipt behind HEAD. No baseline run before the change was taken; UNVERIFIED that the count is otherwise identical to beta.81.

## Test environment

The test runs under the plugin's Node MCP client (`@modelcontextprotocol/client` 2.1.0) against the Phase 387 fake engine, a Node script started by the `StdioClientTransport` through its shebang (`/usr/bin/env node`). The real engine's locked environment (`uv run --no-sync --offline --locked --no-python-downloads`, mcp 2.3.0) is never started and the system Python (mcp 1.25.0) is never used. The plugin copies only allowlisted variables to the engine child (`EUREKA_CHILD_ENV_KEYS`), so the test writes a 3-line launcher in its temp folder that sets `FAKE_EUREKA_SLEEP_MS=65000` and requires `fake-uv.cjs`; `MINDRIAN_EUREKA_UV` points at the launcher and `MINDRIAN_EUREKA_ROOT` at the fixture copy. No network: a local stdio child only; the fake writes only inside the temp folder.

## Deviations from Plan

### Auto-fixed and clarified

**1. [Rule 1 - Bug] SDK error shape differs from the plan text**
- **Found during:** Task 2
- **Issue:** the plan expected `McpError` with `ErrorCode.RequestTimeout` (-32001); the installed client 2.1.0 throws `SdkError` with code `REQUEST_TIMEOUT`.
- **Fix:** `isRequestTimeout` accepts both codes; `SdkErrorCode` is read from `@modelcontextprotocol/client`.
- **Files:** lib/mcp/eureka-tool-contract.cjs

**2. [Rule 3 - Blocking] FAKE_EUREKA_SLEEP_MS cannot cross the child allowlist**
- **Found during:** Task 1
- **Fix:** the test delivers the variable through a launcher script outside the engine folder; the fixture keeps the environment switch as planned and the fixture folder tree stays `fake-uv.cjs,pyproject.toml` (387 F6).

**3. [Rule 2 - Missing] Lifecycle deadline for job sessions**
- The plan named no variable for the status, result and cancel calls of a retained session. The session stores `call_deadline_ms` from `MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS` (default 900 s) at start and every lifecycle call uses it; leg C uses 70 s.

**4. Eviction hook location**
- The client wraps `transport.onclose` in `connect` (dist :5815-5826) and calls `client.onclose` from `_onclose` (dist :5847-5858) after clearing its transport. The eviction is set on `client.onclose` and `client.onerror` in `attachEviction` (the key-link pattern `onclose` holds). `closeSession` inside the hook is a no-op close on a gone transport.

**5. RED reason field**
- The RED outcome is `reason: engine_unavailable, cause: engine_start_failed` (the typed refusal of 387-05). Leg B asserts on both fields.

### Deferred (out of scope, not changed)

- CLAUDE.md stack table still names `@modelcontextprotocol/sdk ^1.29.0`; package.json pins the 2.1.0 split packages (`client`, `core`, `node`, `server`). Doc drift for a later docs quick.
- doctor `real-room-run` WARN (receipt behind HEAD) is pre-existing.

## Threat register dispositions

- T-392-18 mitigated: timeout and maxTotalTimeout on all 26 sites, including the two with no options.
- T-392-19 mitigated: RequestTimeout while connected is engine_timeout (leg B).
- T-392-20 mitigated: eviction on transport close or error (leg C); MAX_ACTIVE_SESSIONS unchanged.
- T-392-SC accepted: no package install; the fake engine is a Node script.

## Known Stubs

None.

## Commits

- ed5168f69 test(392-07): add failing Eureka deadline test and the fake engine sleep switch
- 7880edeb0 feat(392-07): carry the plugin deadline on every Eureka callTool, engine_timeout while connected, session eviction on close

## Self-Check: PASSED

All 6 plan files and this SUMMARY exist on disk; commits ed5168f69 and 7880edeb0 are in the branch history; no tracked file was deleted between a362bf1c4 and HEAD; zero forbidden dash characters in the new and changed files.
