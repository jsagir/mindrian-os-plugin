---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 04
subsystem: testing
tags: [mcp, tri-polar, wire-probe, stdio-tee, desktop, cowork, checkpoint, wave-0]

# Dependency graph
requires:
  - phase: 267-01
    provides: "tests/helpers/mcp-wire-267.cjs (hermeticEnv, wireSnapshot, killTree, LOCAL_SERVER, BRAIN_SHIM), tests/run-all-267.sh (both MCPV2-13 legs pre-declared)"
provides:
  - "tests/helpers/mcp-stdio-tee.cjs: reusable handshake-only stdio tee -- byte-for-byte pass-through both directions, logs ONLY initialize/server-discover/notifications-initialized (plus the matching handshake response) to MOS_TEE_LOG, every other message method-only, stops after 20 records"
  - "tests/test-267-mcpv2-tee.cjs: self-test proving the tee is a faithful pass-through and never leaks tool arguments (8/8 checks green)"
  - "tests/test-267-mcpv2-cli-probe.cjs: opt-in live Claude Code probe (MOS_267_LIVE_CLI_PROBE=1), wraps both the local server and the brain stdio shim"
  - "267-TRIPOLAR-PROBES.md: CLI section filled with a real, live-verified result (claude 2.1.281); Desktop and Cowork sections PENDING with copy-pasteable absolute-path config snippets for the navigator"
affects: [267-11, 267-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handshake-only stdio tee: a transparent child_process wrapper that taps newline-delimited JSON-RPC in both directions without altering the bytes it forwards, whitelisting exactly which message shapes may ever be written to a log file (Canon Part 8 spirit: the tee sits in a real conversation's traffic path during the human Desktop/Cowork probe)"
    - "Process-group cleanup for a tee'd spawn: spawn with detached:true, kill with process.kill(-pid, 'SIGKILL') so the tee's own child (the real server it wraps) is reaped too, not just the tee wrapper process"

key-files:
  created:
    - tests/helpers/mcp-stdio-tee.cjs
    - tests/test-267-mcpv2-tee.cjs
    - tests/test-267-mcpv2-cli-probe.cjs
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-TRIPOLAR-PROBES.md
  modified: []

key-decisions:
  - "id->method correlation map in the tee (not just a method-name whitelist): the self-test requires a tools/call RESPONSE to log as {dir,method:'tools/call'} with method only, but a JSON-RPC response carries only an id, no method. The tee tracks id->method for every host->server request it sees, uses it to attribute a response's log record, and forgets the id once resolved -- so every non-whitelisted request/response pair logs method-only on both legs, never guessing when the id is unknown (it silently skips instead)."
  - "Task 3 (checkpoint:human-action, gate=\"blocking\") is a genuine navigator-only step: operating the actual Claude Desktop GUI and a Cowork VM terminal cannot be done from this shell. Per the phase_context's explicit instruction ('STOP and emit a clear checkpoint... rather than guessing or fabricating'), execution stops here with Tasks 1-2 committed and this SUMMARY, ROADMAP.md's 267-04 line, and an additive STATE.md note all reflecting the PARTIAL/BLOCKED state honestly, rather than inventing Desktop/Cowork results."
  - "STATE.md's Current Position (Phase 355, actively executing in a peer session) was left completely untouched, per the sequential_execution instruction; a new 'Previously (267-04, ...)' additive note was inserted after the existing 267-03 entry, matching the exact precedent 267-01/02/03 established."
  - "ROADMAP.md: hand-edited only the single 267-04-PLAN.md line to append its PARTIAL/BLOCKED status (checkbox left unchecked, since the plan is not complete); full git diff confirmed zero drift outside that one line before committing, per the sequential_execution warning about roadmap.update-plan-progress's observed blank-line drift in other phases' sections."

requirements-completed: []

# Metrics
duration: ~40min
completed: 2026-09-24
---

# Phase 267 Plan 04: Tri-Polar Wire Probe (Tee Built and CLI-Verified, Desktop/Cowork Awaiting Navigator) Summary

**Built and live-verified the reusable handshake-only stdio tee (tests/helpers/mcp-stdio-tee.cjs) that 267-RESEARCH.md's own wire probe technique needed to become a repeatable tool; ran it live against Claude Code 2.1.281 for both the local server and the brain shim (plain 2025-11-25 initialize, elicitation declared, zero server/discover, zero drift from the research's 2.1.280 measurement); PAUSED at the plan's own designed checkpoint because the Desktop and Cowork legs require an actual human operating those host applications, which this session cannot do.**

## Performance

- **Duration:** ~40 min (Tasks 1-2; Task 3 not executed, genuinely requires a human)
- **Started:** 2026-09-24T12:05:00Z (PLAN_BASE `f6799c410`)
- **Completed (through Task 2):** 2026-09-24T12:45:00Z
- **Tasks:** 2 of 3 (Task 3 is a `checkpoint:human-action`, `gate="blocking"` -- STOPPED per protocol, not executed)
- **Files modified:** 4 (all new)

## Accomplishments
- Built `tests/helpers/mcp-stdio-tee.cjs`: spawns the real server command given as argv, pipes stdin/stdout byte-for-byte in both directions, forwards exit code and SIGTERM/SIGINT to the child, and taps (without mutating) newline-delimited JSON-RPC traffic to log ONLY the opening handshake fields (method, protocolVersion, clientInfo, capability keys and values) plus the matching handshake-result response to `MOS_TEE_LOG`. Every other message -- any tool call, any resource read, any other request or its response -- is logged as `{ts, dir, method}` and nothing else. Logging stops entirely after the first 20 records.
- Wrote `tests/test-267-mcpv2-tee.cjs`: spawns the tee wrapping the real local server in a hermetic env, drives `initialize` (2025-11-25, `{elicitation:{}}`), `notifications/initialized`, `tools/list`, and one `tools/call` of `contract_version` with a sentinel value (`TEE-SENTINEL-DO-NOT-LOG`) smuggled into an unused arguments key. Verified live: tool count through the tee equals a direct un-teed spawn (44 tools), the initialize record carries `protocolVersion: '2025-11-25'` and `capabilityKeys` containing `elicitation`, the response record has `hasInstructions: true`, the `tools/call` is logged method-only, and the sentinel string never appears anywhere in the log file. 8/8 checks green, exit 0.
- Wrote `tests/test-267-mcpv2-cli-probe.cjs`: exits 77 (SKIP) unless `MOS_267_LIVE_CLI_PROBE=1` and `claude --version` succeeds. When enabled, wraps both the local server and the brain stdio shim (with `MINDRIAN_BRAIN_URL` pointed at an unreachable loopback, Canon Part 8: no real Brain egress from a probe) in the tee and drives one real `claude -p "Reply with the single word ok." --mcp-config <file> --strict-mcp-config` turn against each, recording whatever opening method/protocolVersion/capabilityKeys the live host actually sends -- the probe records behavior, it never asserts a particular era.
- Ran the live probe once (`MOS_267_LIVE_CLI_PROBE=1 node tests/test-267-mcpv2-cli-probe.cjs`): a real result, not an ENV GAP. `claude --version` = `2.1.281 (Claude Code)`. Both the local server and the brain shim opened with a plain `initialize` at `2025-11-25`, `capabilityKeys: ["roots","elicitation"]`, and no `server/discover` -- exactly matching 267-RESEARCH.md's 2.1.280 wire-tee finding, confirmed live one patch version later with zero drift.
- Opened `267-TRIPOLAR-PROBES.md` with the CLI section fully filled from the real run, and the Desktop and Cowork sections holding ready-to-paste, absolute-path `mcpServers` config snippets plus exact navigator steps (what to run, what to paste back). The Decision-input-for-267-11 section states the rung-ladder rule up front: `serveStdio` adoption is future-proofing only unless Desktop turns out to negotiate 2026 on stdio, in which case 267-11 must stop for an explicit navigator ruling.

## Task Commits

Tasks 1 and 2 were committed atomically; Task 3 was not executed (checkpoint, see below):

1. **Task 1: Handshake-only stdio tee, its self-test, and the opt-in live CLI probe** - `16f037780` (test)
2. **Task 2: Run the live CLI probe once and open 267-TRIPOLAR-PROBES.md** - `145b701dd` (test)

_This SUMMARY.md plus the STATE.md additive note and ROADMAP.md's 267-04 line land in this session's own metadata commit (see below); no further task commit follows, since Task 3 did not execute._

## Files Created/Modified
- `tests/helpers/mcp-stdio-tee.cjs` - the reusable handshake-only stdio tee (Task 1)
- `tests/test-267-mcpv2-tee.cjs` - tee self-test, 8/8 checks green (Task 1)
- `tests/test-267-mcpv2-cli-probe.cjs` - opt-in live Claude Code probe (Task 1)
- `.planning/phases/267-.../267-TRIPOLAR-PROBES.md` - CLI section filled with a live result; Desktop/Cowork PENDING with navigator instructions (Task 2)

## Decisions Made
- The tee tracks an `id -> originating method` map for every host->server request (not just the whitelisted initialize/server-discover pair), so a response to any OTHER request (for example `tools/call`) can still be logged as `{dir, method}` without ever reading that response's own `result`. A response whose id was never seen, or already resolved, is silently skipped rather than logged with a guessed method.
- Both the self-test and the CLI-probe spawn the tee with `detached: true` and clean up by killing the negative pid (the whole process group), because SIGKILL sent to only the tee wrapper's own pid would leave its child (the real server process it spawned) orphaned and running.
- Task 3's checkpoint is genuinely not automatable: it requires opening the actual Claude Desktop GUI and, separately, a real Cowork VM terminal. Per this plan's `phase_context` ("STOP and emit a clear checkpoint... rather than guessing or fabricating Desktop/Cowork results"), execution stops here rather than inventing a plausible-looking result for either host.

## Deviations from Plan

### Auto-fixed Issues

None - Tasks 1 and 2 executed exactly as written. No Rule 1/2/3 auto-fixes were needed; every acceptance criterion in both tasks passed on the first implementation.

**Total deviations:** 0.
**Impact on plan:** None on the completed tasks. Task 3's non-execution is the plan's own designed behavior for a `checkpoint:human-action` gate, not a deviation.

## Issues Encountered
None beyond the expected checkpoint stop. Both live-verification runs (self-test and the CLI probe) succeeded on the first attempt, with zero leaked child processes confirmed via `pgrep` after each.

## User Setup Required

**A navigator must run the Desktop and Cowork probes described in `267-TRIPOLAR-PROBES.md`.** Both sections there hold ready-to-paste JSON config snippets (absolute paths already filled in for this machine) and exact step-by-step instructions:

- **Desktop (about 5 minutes):** add the `mindrian-os-tee` block to Claude Desktop's config, restart, say "list my rooms" once, `cat /tmp/mos-tee-desktop.jsonl` and paste the first 3 lines back, then remove the probe block and restart again.
- **Cowork (about 5 minutes):** ask Larry to run `status_read` in a Cowork session, then in that VM's terminal run `ps aux | grep mindrian-mcp-server` and `env | grep -E "CLAUDE_SURFACE|COWORK_SESSION_ID"` and paste the output back. `cowork-deferred` is an accepted answer if no VM is reachable right now (267-18 re-asks).

Once the navigator's results are pasted back, a fresh executor agent resumes this plan at Task 3 exactly as the `<resume-signal>` in `267-04-PLAN.md` describes: record the results verbatim into `267-TRIPOLAR-PROBES.md`'s Desktop/Cowork sections, add any navigator ruling on the 2026-era-Desktop question if triggered, commit, and only then does this plan close.

## Next Phase Readiness
- 267-11 (the plan that adopts `serveStdio` on the local server) is BLOCKED on the Desktop result specifically: if Desktop negotiates a 2026-era `initialize` on stdio, 267-11 must stop for a navigator ruling before adopting `serveStdio`, per the rule already recorded in `267-TRIPOLAR-PROBES.md`'s Decision-input section.
- 267-18 (phase close) needs either a real Cowork result or an explicit `cowork-deferred` re-ask; RCA 1 (the flag-OFF HTTP one-request-per-process bug, owned by 267-12) is fixed regardless of what Cowork reports, but its live-user-facing severity (A7 in 267-RESEARCH.md) stays unconfirmed until Task 3 lands.
- No blockers for any OTHER Wave 0/1 plan (267-05 through 267-10 do not depend on this plan's Task 3). This plan's own Task 3 is the sole blocker to closing 267-04 itself.
- Zero production files touched (`git diff $PLAN_BASE -- lib bin` empty); this plan changed no file under `lib/` or `bin/`, matching its own `<context>` "This plan changes no production file" rule.

---
*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Status: PARTIAL -- 2 of 3 tasks complete, blocked on navigator checkpoint (Task 3)*

## Self-Check: PASSED

All 4 files created by this plan verified present on disk (`tests/helpers/mcp-stdio-tee.cjs`,
`tests/test-267-mcpv2-tee.cjs`, `tests/test-267-mcpv2-cli-probe.cjs`,
`.planning/phases/267-.../267-TRIPOLAR-PROBES.md`), plus this SUMMARY.md. Both task
commits (`16f037780`, `145b701dd`) verified present in `git log --oneline --all`.
No missing items.
