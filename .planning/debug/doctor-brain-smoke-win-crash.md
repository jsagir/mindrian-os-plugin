---
kind: rca
slug: doctor-brain-smoke-win-crash
status: awaiting_human_verify
trigger: "/mos:doctor --brain-smoke crashes the Node process on Windows with a libuv UV_HANDLE_CLOSING assertion (src\\win\\async.c line 76) + exit 127, AFTER printing the L3/L4/L5 FAIL lines. Reported by tester Gary Laben on v1.13.0-beta.34, Windows, 2026-05-30."
created: 2026-05-30
updated: 2026-05-30
platform: Windows (win-x64)
surface: CLI (Claude Code on Windows)
reporter: tester gary-laben
related_feedback: docs/testers/gary-laben/FEEDBACK.md (2026-05-30 entry, BUG B)
canon_parts: [Part 8]
---

# RCA: doctor --brain-smoke libuv UV_HANDLE_CLOSING crash on Windows

## Symptoms

1. **Expected behavior:** `/mos:doctor --brain-smoke` with a failing L3 (HTTPS schema
   probe returns null on a revoked/invalid key) should print the FAIL lines and exit
   with a normal non-zero code (1). A failed probe is a normal, graceful outcome.
2. **Actual behavior:** After printing `[FAIL] L3`, `[FAIL] L4 skipped-prior-layer-failed`,
   `[FAIL] L5 skipped-prior-layer-failed`, the Node process crashes with a libuv
   assertion and the Claude Code Bash wrapper reports `Exit code 127`.
3. **Error message (verbatim):**
   ```
   Error: Exit code 127
   ...
   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
   ```
4. **Timeline:** First observed 2026-05-30 on v1.13.0-beta.34, Windows. The brain-smoke
   class M probe shipped Phase 127-02. No prior report of this crash.
5. **Reproduction (hypothesis):** Run `/mos:doctor --brain-smoke` on Windows with a key
   that the Brain rejects (403 -> schema probe returns null), so L3 FAILS and L4/L5 skip.
   The crash fires during process teardown after the layers resolve.

## Scope and Impact

- **Surface:** Windows CLI only (assertion path is `src\win\async.c`, a libuv Windows file).
  Not reproduced on Linux/macOS. Tri-Polar: CLI-Windows affected; Desktop/Cowork unknown.
- **Severity:** Medium. It does NOT change the diagnostic outcome (the FAIL lines print
  correctly before the crash), but it makes a normal "key invalid" failure look like a
  catastrophic crash to a cautious tester. Erodes trust in the doctor exactly when a user
  is already debugging. For Gary specifically it amplified a simple revoked-key problem
  into "either the server is down or something is very wrong."
- **Blast radius:** any Windows user whose brain-smoke L3 fails (revoked key, offline,
  401/403, cold-start timeout) hits this. The failure path is the COMMON path for the
  exact users who run brain-smoke (people whose Brain is not working).

## Initial evidence (seeded by orchestrator before debugger spawn)

- Dispatch: `scripts/doctor.cjs:3359` -- `classMBrainSmoke(flags).then(function(code){ process.exit(code); })`.
  `process.exit()` is called as soon as the layer chain resolves. If any libuv handle
  (timer, async wakeup, socket) is still open or mid-close at that instant, Windows libuv
  asserts in `async.c`.
- Probe impl: `lib/core/doctor/class-m-brain-smoke.cjs`.
  - L3 schema probe (line ~92) calls into `lib/core/brain-client.cjs`, whose fetch uses
    `AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS)` (brain-client.cjs:215, 275). An
    `AbortSignal.timeout` schedules a libuv timer + an async handle. On a fast 403 the
    fetch resolves but the timeout timer may still be live/unref'd when `process.exit`
    runs.
  - L4 `_spawnAndHandshake` (line 133) creates a child process via `spawn` + a
    `setTimeout` timer (line 139). In Gary's run L4 was SKIPPED (prior layer failed), so
    the L4 child is likely NOT the trigger -- but confirm the skip path does not still
    construct/leak a handle.
- `AbortSignal.timeout` is the strongest single suspect: it is the only always-constructed
  async handle on the L3 path, and the UV_HANDLE_CLOSING assertion in `async.c` is the
  classic signature of a timer/async handle being torn down by `process.exit` mid-close.
- Node global `fetch` (undici) keeps a connection pool with keep-alive sockets; an
  un-closed undici agent at `process.exit` is a secondary suspect on Windows.

## Leading hypotheses (for the debugger to test, do not assume)

- **H1 (primary):** `AbortSignal.timeout()` on the L3 fetch path leaves a pending libuv
  timer/async handle that `process.exit()` (doctor.cjs:3359) tears down mid-close ->
  Windows `async.c` assertion. Fix direction: clear the timeout explicitly (use an
  `AbortController` + `clearTimeout` in a `finally`) instead of `AbortSignal.timeout`, OR
  drain handles before exit (await a `setImmediate`/let the event loop empty, or
  `process.exitCode = code` + return instead of synchronous `process.exit`).
- **H2:** undici keep-alive socket pool not closed before `process.exit`. Fix: close the
  global dispatcher (`await fetch`'s agent `.close()/.destroy()`) or set `process.exitCode`
  and let the loop drain.
- **H3:** the `.then(code => process.exit(code))` synchronous-exit pattern itself is the
  bug regardless of which handle -- switching to `process.exitCode = code` (no forced exit)
  may resolve all variants. Verify nothing else holds the loop open indefinitely (the L4
  child + timer must still be cleaned).

## Resolution

root_cause: |
  Dangling undici keep-alive TLS socket at a synchronous process.exit().

  On the L3 schema-probe path, brain-client `_ensureSession` (and the sibling
  `callTool`) handled a key-rejected HTTP response (401/403) by returning/throwing
  at `if (!initRes.ok)` WITHOUT consuming the response body. Node's global fetch
  (undici) keeps the underlying TLS socket in a keep-alive, not-yet-released state
  until its body is read. That un-drained socket is a LIVE libuv handle
  (TCPSocketWrap) at the instant the dispatch at scripts/doctor.cjs:3360 fired a
  synchronous `process.exit(code)`. On Windows, libuv force-tears-down that
  still-closing handle and asserts `!(handle->flags & UV_HANDLE_CLOSING)` in
  src\win\async.c line 76; the abort surfaces to the Claude Code Bash wrapper as
  "Exit code 127". Linux/macOS process.exit silently discard the handle, which is
  why the crash is Windows-only.

  H1 (AbortSignal.timeout timer) was ELIMINATED: getActiveResourcesInfo() on the
  real 401 path shows NO 'Timeout' entry -- undici clears the AbortSignal timer
  when the request settles. The leaked handle is the socket (H2), not the timer.

  Note: the bug is the ABORT (exit 127), not the exit code. The class-flag
  invariant (exit 0 even on per-layer FAIL, Canon Part 8, asserted by
  tests/test-127-02-doctor-class-m.sh T3) is correct and preserved; the
  orchestrator's "should exit 1" framing is superseded by the repo contract.

fix: |
  Two complementary minimal changes, both proven to zero the active-resource list:

  (1) scripts/doctor.cjs ~3359 (the --brain-smoke dispatch): replaced synchronous
      `process.exit(code)` with `process.exitCode = code; return` (both the .then
      and the .catch). The event loop drains every outstanding libuv handle the
      OS-safe way, then exits naturally with the requested code. Covers ALL handle
      variants (socket / timer / L4 child) and is correct on Windows/macOS/Linux.

  (2) lib/core/brain-client.cjs: on the non-OK branch of `_ensureSession` and of
      `callTool`, drain the body via `await res.arrayBuffer()` (try/catch) before
      returning/throwing, so undici releases the keep-alive socket even if a future
      caller force-exits. Defense-in-depth at the source of the leak.

verification: |
  - Real-socket side-by-side against live Brain (Bearer revoked -> 401):
      OLD (no drain):   getActiveResourcesInfo() = ["TCPSocketWrap","Immediate"]  (LEAK)
      NEW (drain+exitCode): getActiveResourcesInfo() = []                          (CLEAN)
  - `node scripts/doctor.cjs --brain-smoke` no-key path (L2 fail -> L3/L4/L5 skip):
      prints FAIL lines, EXIT_CODE=0, no abort.
  - Valid-key path: all 5 layers PASS, EXIT_CODE=0, completes in ~6s (no hang --
      the L4 child + setTimeout drain cleanly under process.exitCode).
  - `--brain-smoke --json` self-probe (Tri-Polar): valid 5-layer JSON, EXIT_CODE=0.
  - tests/test-127-02-doctor-class-m.sh: 5/5 PASS (incl. T3 exit-0 invariant + T4
      Tier-0 cascade).
  - Regression: test-brain-client-params, test-brain-response-sanitize,
      test-resolve-brain-key (9/9), test-doctor-class-i (11/11), test-doctor-class-j
      (8/8): all PASS.
  - True Windows assertion not reproducible on Linux (assertion is src\win\async.c);
      verified by the platform-agnostic proxy (getActiveResourcesInfo == [] at exit
      + clean exit code). A Windows confirmation by tester Gary or a Windows CI
      runner remains the only residual gap.

files_changed:
  - scripts/doctor.cjs (dispatch: process.exit -> process.exitCode at the --brain-smoke branch)
  - lib/core/brain-client.cjs (drain non-OK response body in _ensureSession + callTool)

## MindrianOS Gates (RCA Section 5)

- Canon Part 8 (Brain boundary): PASS. Diagnostic-only; no new Brain surface; no
  user data logged. Body drain discards bytes (arrayBuffer never inspected).
- Tri-Polar (CLI / Desktop / Cowork): CLI fixed; `--brain-smoke --json` self-probe
  verified intact (doctor.cjs ~2801 path exercised via T2 + live --json run).
- Cross-platform: PASS. process.exitCode + body-drain are platform-neutral; no
  Windows special-casing.
- No em-dashes: PASS in both changed files (1 pre-existing em-dash on doctor.cjs:13
  header comment is outside this change; left untouched to avoid scope creep).
- Reuse before build: PASS. No new dependencies; smallest change at the dispatch +
  the leak source.

## Required Code Changes (resolved)

Done. See Resolution above.

## Tests

- Cross-platform: must verify the fix on Windows (the only repro surface). A Linux repro
  may be possible by forcing a pending `AbortSignal.timeout` handle then `process.exit`;
  the debugger should attempt a platform-agnostic regression test that asserts the smoke
  exits with code 1 (not a crash) when L3 fails.
- Regression: brain-smoke with a VALID key must still exit 0 cleanly.

## Non-Code Follow-ups

- After fix ships, tell Gary the crash he reported is patched (close the loop in FEEDBACK.md).
- Check the sibling spawn at doctor.cjs:2801 (`--brain-smoke --json` self-probe) for the
  same forced-exit teardown pattern.

## Current Focus

reasoning_checkpoint:
  hypothesis: "On the L3-fail (invalid/revoked key -> 401/403) path, brain-client
    `_ensureSession` throws/returns at `if (!initRes.ok)` WITHOUT draining the response
    body. The undici keep-alive TLS socket stays alive (un-released) at the instant the
    dispatch at doctor.cjs:3360 calls synchronous `process.exit(code)`. On Windows libuv
    forcibly tears down that still-closing socket handle -> assertion
    `!(handle->flags & UV_HANDLE_CLOSING)` in src\\win\\async.c line 76. Linux
    process.exit silently discards the handle, which is why it is Windows-only."
  confirming_evidence:
    - "Live repro mirroring the real non-drained path (Bearer INVALID): the Brain returns
       401, _ensureSession returns {error:'invalid_key'} WITHOUT draining the body, and
       process.getActiveResourcesInfo() at the .then(code=>process.exit) boundary shows
       ['TCPSocketWrap','Immediate'] -- a live undici socket handle at exit."
    - "AbortSignal.timeout is NOT the dangling handle: no 'Timeout' appears in the active
       resources list. Node/undici clears the AbortSignal timer when the request settles.
       H1 is ELIMINATED."
    - "When the body IS drained (await initRes.arrayBuffer()) AND process.exitCode is used
       instead of process.exit, getActiveResourcesInfo() returns [] -- handle gone,
       process still exits clean with code 0/1."
  falsification_test: "If draining the non-OK body + switching the dispatch to
    process.exitCode left a non-empty active-resources list (or hung the process), the
    socket-handle hypothesis would be wrong. It returned [] and exited cleanly -> confirmed."
  fix_rationale: "Two complementary minimal changes attack the ROOT (a leaked libuv handle
    at a forced exit), not the symptom: (1) dispatch uses process.exitCode=code + return so
    the event loop drains every handle the OS way (covers ALL handle variants, future-proof,
    cross-platform); (2) brain-client drains the response body on the non-OK branch so the
    undici socket is released even when callers do force-exit. Both proven to zero the
    active-resource list."
  blind_spots: "Cannot reproduce the actual Windows assertion on this Linux box (assertion
    is in src\\win\\async.c). Verifying by the platform-agnostic proxy: getActiveResourcesInfo
    == [] at exit + clean exit code. True Windows confirmation needs tester Gary or a Windows
    CI runner. Also must confirm the valid-key path (L4 spawns a child + timer) still DRAINS
    and exits (does not hang) under process.exitCode."

## Eliminated

- hypothesis: H1 -- AbortSignal.timeout() leaves a pending libuv timer at process.exit.
  evidence: process.getActiveResourcesInfo() on the real 401 path shows no 'Timeout' entry;
    undici/Node clears the AbortSignal timer when the fetch settles. The live handle is a
    TCPSocketWrap (undici keep-alive socket), not a timer.
  timestamp: 2026-05-30

## Evidence

- timestamp: 2026-05-30
  checked: ECONNREFUSED repro (fetch to 127.0.0.1:1 with AbortSignal.timeout, drained).
  found: active resources [] at exit -- a fast connection-refused leaves no socket.
  implication: the trigger is NOT a generic AbortSignal leak; it requires a real TLS socket.
- timestamp: 2026-05-30
  checked: Real non-drained path against live Brain (Bearer INVALID -> 401), exact
    brain-client logic (throw/return at !initRes.ok without consuming body), then
    .then(code => process.exit) like doctor.cjs:3360.
  found: process.getActiveResourcesInfo() == ["TCPSocketWrap","Immediate"] at exit.
  implication: CONFIRMED root cause -- undrained undici keep-alive socket is the libuv
    handle that Windows tears down mid-close, asserting in async.c.
- timestamp: 2026-05-30
  checked: Same path WITH body drain (await initRes.arrayBuffer()) + process.exitCode
    instead of process.exit.
  found: active resources [] at exit; process exits with the correct code, no hang.
  implication: both fixes independently remove the dangling handle.
- timestamp: 2026-05-30
  checked: tests/test-127-02-doctor-class-m.sh T3 ("class-flag-invariant-exit-0").
  found: the SHIPPED contract asserts `--brain-smoke` (no --json) EXITS 0 even on per-layer
    FAIL (Canon Part 8 graceful-degradation). classMBrainSmoke() always returns 0 by design.
  implication: the bug is the libuv ASSERTION/ABORT (exit 127), NOT the exit code. The
    "Exit code 127" Gary saw is the abort firing BEFORE the intended process.exit(0). The
    fix must keep exit 0 and remove the abort. Changing the code to 1 would regress T3.
    The orchestrator's "exit code 1" framing is superseded by the repo's class-flag invariant.

## Current Test Plan

- test: run the real `node scripts/doctor.cjs --brain-smoke` with (1) an invalid/empty key
  (must print FAIL lines + exit 1 cleanly) and (2) the working MINDRIAN_BRAIN_KEY (must exit
  0, must NOT hang). Confirm no dangling handles.
- expecting: clean exit on both paths; valid-key path drains the L4 child without hanging.
- next_action: apply fix (a) dispatch process.exitCode + (b) brain-client body drain; rerun.
