---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 13
subsystem: mcp
tags: [lifecycle, sigterm, eaddrinuse, false-success, rca]
requires: [267-12]
provides:
  - "bin/mindrian-mcp-server.cjs exitAfterTeardown(signal) + registerTerminalSignalListeners(): SIGTERM/SIGINT run the existing teardown, close httpServer / mcpHandlers / stdioHandle, then exit 0 (2000 ms unref'd backstop), on HTTP flag-OFF, HTTP flag-ON, stdio and the express-missing stdio fallback"
  - "module-level mcpHandlers list (shutdown seam) that 267-14 appends its flag-ON modern handler to"
  - "honest listen failure: one stderr line naming code and port, no started line, no pidfile, no catch-up, exit 1"
  - "tests/test-267-mcpv2-lifecycle.cjs (MCPV2-14, MCPV2-15)"
  - "RCA 5 and RCA 6 resolved with real output"
affects: [267-14]
key-files:
  created:
    - tests/test-267-mcpv2-lifecycle.cjs
    - .planning/debug/resolved/mcp-server-sigterm-no-exit.md
    - .planning/debug/resolved/mcp-http-listen-error-false-started.md
  modified:
    - bin/mindrian-mcp-server.cjs
    - .planning/debug/knowledge-base.md
decisions:
  - "Exit responsibility lives in the entry point, not in shared session-catchup.cjs (the brain shim also uses it); the terminal listener is registered last so snapshot, tree-watcher stop and flag-ON pidfile clear run first"
  - "The terminal listener is registered inside the HTTP listen success callback (after clearOnce), per the plan; a SIGTERM in the sub-second window before the bind completes still only runs the shared snapshot handler"
metrics:
  tasks: 2
  completed: 2026-10-02
---

# Phase 267 Plan 13: Honest process lifecycle (RCA 5 and RCA 6) Summary

The local server now exits 0 within about 12 ms of SIGTERM/SIGINT after its normal teardown, on every transport, releasing port 3847, and a failed HTTP bind is reported as a failure (exit 1, EADDRINUSE named) instead of a false "started" line.

PLAN_BASE=6a917c05ad651db27e7a9c600630d30ad1a4cbb0

## What was built

1. **RED test** (a48130a04): `tests/test-267-mcpv2-lifecycle.cjs`, four arms plus a hygiene arm. Pre-fix run: `PASS=1 FAIL=4`. Flag-OFF, flag-ON and stdio SIGTERM arms all failed with "did not exit within 3000 ms"; the listen-error arm failed with the server still alive and the "started ... HTTP on 127.0.0.1:3847" line printed against a port held by the test.
2. **Fix** (eb6893bf9), `bin/mindrian-mcp-server.cjs` only:
   - RCA 6: `app.listen` callback now takes `listenErr`; on error it writes `[mindrian-os] HTTP listen failed on 127.0.0.1:<port>: <code>` and `process.exit(1)` before anything else runs. The returned server is kept as `httpServer`.
   - RCA 5: `exitAfterTeardown` (once-guarded, 2000 ms unref'd backstop, closes `httpServer`, each `mcpHandlers` entry and `stdioHandle` in separate try/catch, then `process.exit(0)`), registered via `registerTerminalSignalListeners()` last on each branch. flag-OFF's `createMcpHandler` handler is pushed to `mcpHandlers`.
3. **RCAs resolved** (fbb11e460): both moved to `.planning/debug/resolved/` with Resolution from real output; two knowledge-base blocks added.

## Verification (real output)

```
$ node tests/test-267-mcpv2-lifecycle.cjs     (HOME and MINDRIAN_ROOMS_HOME isolated)
    flag-OFF exit after 13 ms, code 0
  ok HTTP flag-OFF: SIGTERM exits 0 within 3000 ms, snapshot saved, port released
    flag-ON exit after 12 ms, code 0
  ok HTTP flag-ON: pidfile written, SIGTERM exits 0 within 3000 ms, pidfile cleared
    stdio exit after 12 ms, code 0
  ok stdio: initialize sent, stdin open, SIGTERM exits within 3000 ms
  ok listen error: port held by a foreign listener -> exit 1 within 5000 ms, honest EADDRINUSE line, no started line, no pidfile
  ok process hygiene: no spawned server alive and port 3847 free
RESULT: PASS=5 FAIL=0

$ node tests/test-267-mcpv2-http-flag-off.cjs   RESULT: PASS=6 FAIL=0
$ node tests/test-267-mcpv2-dual-era.cjs        RESULT: PASS=5 FAIL=0 (run alone, three times)
$ node tests/test-267-mcpv2-brain-shim.cjs      RESULT: PASS=6 FAIL=0
$ node tests/test-248-surface-probes.cjs        25/25 green, 0 leg(s) skipped
$ bash tests/run-all-198.sh                     Passed: 13 Failed: 3 Skipped: 0
   (failures: Part 8 local-only floor, SPEC-2 contract-version + per-tool schema validity, SPEC-5 hooks/ adapter-only budget = 267-BASELINE.md)
$ bash tests/run-all-267.sh                     Phase 267: PASS=26 FAIL=4 SKIP=3
   FAILED: CIRS gates, zod4 contract, 354 concurrency surfaces (all known baseline reds), and local server dual era (see Deviations)
   SKIPPED: CLI live probe (ENV GAP), flag-on routing and in-repo clients (not yet landed, 267-14)
$ git diff a48130a04 HEAD --stat -- lib/mcp/session-catchup.cjs lib/mcp/daemon-lifecycle.cjs | wc -l   -> 0
$ ss -ltn | grep 3847                           -> port free after every run
```

Acceptance greps: `exitAfterTeardown` 5 occurrences in bin/mindrian-mcp-server.cjs; `listen failed` present; session-catchup.cjs and daemon-lifecycle.cjs untouched.

The stdio arm hung pre-fix too (RED), so it is a real fix on stdio, not just a regression guard.

## Deviations from Plan

### Auto-fixed Issues

None - the plan executed as written. No wire-snapshot description line needed refreshing (dual-era green on tool descriptions).

### Observations

**1. [Peer interference, not a defect] dual-era hygiene arm failed once inside run-all-267.sh.** The arm reported "local server process(es) started by this test survived: 423348", a repo-anchored `bin/mindrian-mcp-server.cjs` PID that appeared after the test's before-snapshot. That test's pgrep census is repo-wide, and peers run their own mindrian processes in this tree (one peer server, PID 371242, was visible afterwards and was not spawned by this plan). The test SIGKILLed the PID it flagged. Run alone three times it passes 5/5. My lifecycle test's own hygiene arm (spawned PIDs only) passes. Not caused by this change.

**2. Terminal listener registration window.** On the HTTP branch the terminal listener is registered in the listen success callback (after clearOnce), as the plan specifies, so a SIGTERM before the bind completes only runs the shared snapshot handler. The window is sub-second at boot; if it matters, 267-14 can hoist registration, since exit is deferred past the awaits and clearOnce also rides the `exit` event.

## Known Stubs

None.

## Threat Flags

None. T-267-10, T-267-29, T-267-30, T-267-31 mitigated as planned (exit with backstop; no pidfile on failed bind; no started line on failed bind; terminal listener registered after the snapshot handler, snapshot line asserted on SIGTERM).

## Follow-ups (non-code, from the RCAs)

- CHANGELOG Fixed entries for both fixes belong to the release that ships them.
- Windows signal semantics unverified (RCA 5 gate 3).
- The brain shim shares registerShutdownHandler and has the same exit gap; out of scope here (shim lifecycle).

## Commits

- a48130a04 test(267-13): add failing lifecycle test
- eb6893bf9 fix(267-13): terminal signal listener and honest listen failure
- fbb11e460 docs(267-13): resolve RCA 5 and RCA 6

## Self-Check: PASSED
