---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 07
subsystem: mcp-sessions
tags: [mcp, sessions, flag-on, acceptance, d-19, env-scrub]

requires:
  - phase: 369-04
    provides: hermetic flag-ON daemon helper (startDaemon, restartDaemon, legacyClient, autoClient), fixture-room builder
  - phase: 267-mcp-stateless-protocol-migration
    provides: the flag-ON sessionful legacy leg and the stateless modern leg
provides:
  - six-arm live-daemon acceptance proving the shell's legacy MCP path is sessionful
  - ensureDaemon env scrub (no inherited CLAUDE_CODE_SESSION_ID) with a static and live test
  - 369-SESSION-CONTRACT.md (client mode, host identity, bootstrap code, 289 dependency)
affects: [369 shell server plans, plan 19 sign-in, plan 26 replay]

tech-stack:
  added: []
  patterns:
    - "KNOWN result self-flips: the test reads consumeGate source to detect Phase 289"

key-files:
  created:
    - tests/test-369-sessionful-acceptance.cjs
    - tests/test-369-daemon-env-scrub.cjs
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-SESSION-CONTRACT.md
  modified:
    - lib/mcp/daemon-lifecycle.cjs

key-decisions:
  - "Shell MCP client is Client with versionNegotiation { mode: 'legacy' }, one per browser session; modern arm pinned as no_session_id"
  - "Shell is not in HOST_TIER_MAP; launcher sets MINDRIAN_MCP_FIRST=cowork; clientInfo name mindrian-shell"
  - "Bootstrap: 32-byte single-use code, 60 seconds, sha256-armed, exchanged for an HttpOnly SameSite=Strict cookie with a 303 to a clean URL"
  - "delete env.CLAUDE_CODE_SESSION_ID in ensureDaemon only; MINDRIAN_SESSION_ID path untouched"

requirements-completed: [SESS369-01, SESS369-02, SESS369-03, SESS369-04]

duration: 40min
completed: 2026-10-03
---

# Phase 369 Plan 07: Session Contract Summary

**Legacy sessionful MCP path proven live (bind, mint, answer, isolation, restart), modern arm and the inherited-CLI-session hazard pinned, the daemon spawn scrubbed of CLAUDE_CODE_SESSION_ID, and the shell's session contract written down.**

## Accomplishments

- `tests/test-369-sessionful-acceptance.cjs`: six arms against the shipped daemon. All PASS. Prints `KNOWN: a cross-session refusal burns the owner's gate (spike 007 burn-probe); Phase 289 fixes it` (flips to an owner-ratified assertion by itself once consumeGate checks before it deletes), `PINNED: modern request identity is not proven...`, and `HAZARD PINNED...`.
- `lib/mcp/daemon-lifecycle.cjs`: six inserted lines, `delete env.CLAUDE_CODE_SESSION_ID` after the env build and before `spawn(` (also covers an id arriving via `opts.env`).
- `tests/test-369-daemon-env-scrub.cjs`: static order check, shim rung (b) guard, live fixture server recording its own env (no session id; `MINDRIAN_TRANSPORT=http`, `MINDRIAN_MCP_DAEMON=1` kept).
- `369-SESSION-CONTRACT.md`: client mode, host identity, bootstrap authentication, scrub plus callers plus CLI rung (b) note plus the 289 dependency.

## Task Commits

1. Task 1, acceptance test: `014ad959c`
2. Task 2, scrub, scrub test, contract: `fee06c410`

## Test Results

- `node tests/test-369-sessionful-acceptance.cjs`: PASS=6 FAIL=0 (gate ids differ per run; rooms room-x, room-y)
- `node tests/test-369-daemon-env-scrub.cjs`: PASS=3 FAIL=0
- `node tests/test-267-mcpv2-flag-on.cjs`: PASS=6 FAIL=0 (green before and after the edit)
- `node tests/test-267-mcpv2-clients.cjs`: 5 passed, 0 failed (green before and after the edit)
- `git diff --stat` on tests/test-267-mcpv2-flag-on.cjs, lib/mcp/gate-ledger.cjs, lib/mcp/tools/gate.cjs: empty
- `grep -c "delete env.CLAUDE_CODE_SESSION_ID"` = 1; `grep -c MINDRIAN_SESSION_ID lib/mcp/daemon-lifecycle.cjs` = 0 before and after

## Deviations from Plan

- **Comment wording (Rule 3, acceptance criterion):** the plan's mandated comment names `MINDRIAN_SESSION_ID`, which would raise that grep count from 0 to 1 against "unchanged". The comment says "the hook-driven session variable (the shim's connection key)" instead. Same meaning.
- **Arm 5 "unbound" read:** `room_state_bound` on an unbound legacy client reports `room_binding.bound: false` with the registry fallback room (not an absent `room_dir`), so the arm asserts `bound === false`; the write-scoped refusal observed is `no_bound_room` (via a gate_render then gate_answer on the unbound client).
- **Arm 4 second refusal:** after the first refusal burns G2 today, the bound stranger's answer is `unknown_or_expired_gate`, not `session_mismatch`. The arm accepts either (a stranger never ratifies and writes nothing); the first, unbound answer is asserted `session_mismatch` exactly. After Phase 289 both are `session_mismatch`.

## Findings (not caused by this plan)

- The shim's header comment and code say it keys the daemon connection by `MINDRIAN_SESSION_ID`, but the existing RCA 7 pin in test-267-mcpv2-clients records that the daemon mints its own id and the hook id is not the binding key on that path. Recorded in the contract; no change made.
- The plugin's `.mcp.json` runs the stdio server directly, not the shim, so CLI rung (b) never calls `ensureDaemon`; the only callers are `lib/mcp/adapter-client.cjs` and `bin/mindrian-mcp-shim.cjs`. The scrub therefore cannot unbind a CLI path that was correctly bound.

## Known Stubs

None.

## Threat Flags

None. T-369-07-01/02/04/05/06/07 mitigated as planned (05 and 06 as contract text, implemented in plan 19); 03 transferred to Phase 289 and visible in arm 4.

## Self-Check: PASSED

- Files present: tests/test-369-sessionful-acceptance.cjs, tests/test-369-daemon-env-scrub.cjs, 369-SESSION-CONTRACT.md, lib/mcp/daemon-lifecycle.cjs (edited)
- Commits present: 014ad959c, fee06c410
