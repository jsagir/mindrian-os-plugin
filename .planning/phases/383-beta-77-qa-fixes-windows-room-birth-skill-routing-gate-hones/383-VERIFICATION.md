---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
verified: 2026-11-05T00:00:00Z
status: human_needed
score: 8/10 requirements verified in code and tests; 2 partial (QA383-02 live leg, QA383-09 measurement only); 0 failed
overrides_applied: 0
re_verification: none (initial verification)
gaps: []
human_verification:
  - test: "Real Windows room create (QA383-01 laptop leg, plan 383-11)"
    expected: "On a Windows machine with no WSL distro and no real Python on PATH, /mos:new-project either creates a room in a test MINDRIAN_ROOMS_HOME or prints three plain lines before any card and writes no folder. Fill Part C of 383-WINDOWS-RECEIPT.md and sign Part E."
    why_human: "This host is WSL on Windows. The QA laptop PATH and WSL state cannot be reproduced here. The receipt is UNSIGNED."
  - test: "Routing cause C1 (first-install branch or Mode 1 text), C4 (skill listing overflow), C5 (which Windows hook branch ran)"
    expected: "Receipt fields answer which cause hit the beta.77 session. Prompt 'I know what I want, I need the how' runs /mos:scientific-roadmap with no room and inside a room; first reply with no room says nothing is remembered."
    why_human: "383-ROUTING-DIAGNOSIS.md marks all three STILL OPEN. They need the owner's laptop or a live model. The claude plugin eval leg (tool_used: Skill) was not run."
  - test: "QA383-08 session sentence"
    expected: "Owner names the exact unsourced number and its sentence from the beta.77 QA session. It is then added as test leg U3 in tests/test-383-sourced-number.cjs."
    why_human: "The full QA report text is not in the repo. U3 prints PENDING by design."
  - test: "Gated junk-tree deletion (D-02) and the Windows QA machine listing"
    expected: "Owner answers the F.0 card for digests 677711508073 (linux), 3ba9221b0a9e (windows-dev) and the QA machine digest; Part D of the receipt records each verdict."
    why_human: "Deletion needs the owner's approval on the real machine (SEED-117). Nothing was deleted. Listing 3 is not taken."
  - test: "Reply length in a live session (QA383-09)"
    expected: "Longest default reply in the retest is 8 sentences or fewer, and the voice-length shadow rows from a real window show the over-length rate."
    why_human: "The phase ships a measurement, not an enforcement. The live rate needs the retest session and a reviewed window."
  - test: "Desktop and Cowork rows (D-06)"
    expected: "Rows stay UNVERIFIED unless the owner also runs the create and the routing prompt on Claude Desktop (Windows) and Cowork."
    why_human: "No Desktop or Cowork host in this session."
---

# Phase 383: Beta.77 QA fixes - Verification Report

**Phase Goal:** Fix the ten findings from the owner's beta.77 QA report, worst first, each one reproduced before it is fixed. P0: room creation fails on Windows. P1: no /mos command fired in 19 turns, no context_assemble or memory_event. P2: card before environment check, no card at a real fork, raw error shown to a beginner. P3: third-person card copy, one unsourced number, over-long replies, a folder written without a card.
**Verified:** 2026-11-05
**Status:** human_needed
**Re-verification:** No, initial verification.

Note on requirement IDs: QA383-01 to QA383-10 are defined only in 383-PRD.md. They are not in .planning/REQUIREMENTS.md (0 matches). Traced against the PRD table.

## Automated checks run by the verifier

| Check | Command | Result |
|-------|---------|--------|
| Phase aggregator | `bash tests/run-all-383.sh` | `Phase 383: PASS=16 FAIL=0 SKIP=0`. Part 8 sweep and dash fence PASSED. test-383-sourced-number: 3 pass, 0 fail, 1 PENDING (U3) |
| Must-stay-green set | test-platform, test-room-birth (35/35), test-l9o-rooms-python-floor (18/0), test-room-registry-windows-path (25/25), -windows-python-interp (29/29), -windows-atomic-replace (21/21), test-startup-flows, test-371-startup-ui, test-359-declared-arm (20/20), test-3696-reply-checks (143/0), test-room-registry-path-resolution (25/25), test-session-start-banner, test-353-subroom-birth (38/38), test-209-card-fire-gate (7), test-369-hook-require-graph (5/0) | all exit 0 |
| Card-fire baseline | `node tests/test-card-fire-relevance-gate.cjs` | 6 passed, 5 failed. Equal to baseline, not worse |
| Known accepted | `node tests/test-self-update-platform.cjs` | 19 passed, 5 failed. Equal to the accepted 5 of 24 |
| Gates | `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage` | all exit 0 (`connector-registry: OK`, `orchestration-projection: OK`, `198 wired, 2 excluded, 0 unwired`) |
| Acceptance | `node scripts/doctor.cjs --acceptance` | 24/25. Only failure is `verify-release-clean-tree` (Phase 384 bench file), accepted. `real-room-run` WARN (receipt behind HEAD) is expected |

## Observable truths (PRD "done when" rows)

| # | Req | Truth | Status | Evidence |
|---|-----|-------|--------|----------|
| 1 | QA383-01 | One resolver finds a working Git Bash and Python 3.9+, rejects the WSL launcher and Store stub, and every registry spawn uses one helper | VERIFIED in code (laptop leg human) | `lib/core/platform.cjs`: `_probeBash` rejects non-msys ostype on win32 and System32/WindowsApps paths; `_probePython` rejects exit 9009 and Store text, falls through `python3`, `python`, `py -3`; `spawnRoomRegistry` uses argv array, no shell, forward-slash paths, `environment_not_ready` when runtime fails. Five call sites (room-birth, room-identity, room-open, room-auto-create, graph-backfill) call `spawnRoomRegistry`; zero bare `bash` spawns left (test-383-spawn-chokepoint 14/14). `scripts/room-registry` re-probes by running and exits 127 naming every candidate. Windows-side proof by plan 383-03 on the dev machine (receipt Part A). QA laptop run not done |
| 2 | QA383-02 | Cause named with evidence; scripted session reaches a /mos command with and without a room | PARTIAL, human | `383-ROUTING-DIAGNOSIS.md` names seven causes with file:line and command output. Fix shipped for C1 (Mode 1 text in `scripts/session-start` now says a named method need still routes, one /mos:new-project offer on a stated goal). C2 and C3 ruled out by run. C4 (listing budget: 227 entries, 18,545 chars), C5 (hook branch on Windows) and C1 reach are STILL OPEN. The live `claude plugin eval` leg was not run. The Desktop and Cowork rows are stated UNVERIFIED |
| 3 | QA383-03 | Cause named; if MCP server was down the session says so, else calls fixed | VERIFIED as diagnosed (reach UNVERIFIED) | C7 PROVEN: `context_assemble` and `memory_event` are tied to a bound room by doctrine (`agents/larry-extended.md:163`), and the laptop had no room (QA383-01). Fix: doctrine sentence plus the session-start line "Without a room, nothing from this talk is remembered. Say that once..." (present in `scripts/session-start`). The hook notice for a down MCP server was deliberately not built (no CLI state shown where the doctrine does not load). That choice is UNVERIFIED on Desktop/Cowork |
| 4 | QA383-04 | Preview checks the environment before the card; on failure no card, no folder, one plain message | VERIFIED | `lib/mcp/startup-operations.cjs` `prepareRoomCreation` calls `resolveRoomRuntime()` before `mintCard`, returns `environment_not_ready` with `plain`. `resumeFn` rechecks with `refresh:true`. `birthRoom` guards before first write. test-383-preview-env-check passed in run-all |
| 5 | QA383-05 | Unanswered fork produces a card the same turn; answered fork produces none | VERIFIED | `scripts/check-card-fire.cjs` declared-fork arm (Phase 359) returns `declared-fork-no-card`; Phase 383 added the doctrine ("Your call: A \| B \| What if C" at a fork that ends in prose, `agents/larry-extended.md:123,141`). test-383-card-fork F1 to F5 passed (declared fork blocks, answered fork gives `no-gate-signal`) |
| 6 | QA383-06 | Beginner sees plain words and one next step; verbatim line kept in seed and log | VERIFIED | `PLAIN_ROOM_NOT_CREATED` and `plain` on the failure payload (`startup-operations.cjs`, `room-birth.cjs`). Doctrine at `agents/larry-extended.md:145` and `commands/rooms.md:246,314` reads plain-first, verbatim-filed (D-05). test-383-plain-failure passed |
| 7 | QA383-07 | Navigator-facing card text is second person; lint finds no third-person reference | VERIFIED | `findThirdPersonNavigator` in `lib/hmi/larry-reply-checks.cjs`; mode card text rewritten ("when the reply is talk instead of a pick"); test-383-card-second-person 5 pass. Sweep covers static card strings (16 scanned) |
| 8 | QA383-08 | The number is found and sourced or removed; a test guards the string | PARTIAL, human | D-04 path: `findUnsourcedNumber` sweep of 386 static strings; 14 hits, all allowlisted with a reason and live-hit check (U1, U2 pass); commands/agents sentences fixed. The QA session's own number is still not on file: U3 PENDING |
| 9 | QA383-09 | A sample of default turns stays inside the voice rule; "just tell me" still gives a full answer | PARTIAL (measurement only) | Delivered: `checkReplyLength` with exemptions, a count-only `voice-length` shadow row in `scripts/check-voice-style.cjs`, declared policy `data/harness-policies/voice-length.json`. It logs and never blocks. Run output: `CORPUS over8=9 of 98` (some are deliberate probes). Escape hatch exemption passes V3 and V5. Nothing in this phase makes default turns shorter beyond the existing "2 to 8 sentences" reminder. Live rate not measured |
| 10 | QA383-10 | No write under rooms home before a gate is approved; failed create leaves no half room | VERIFIED (gated paths) | `scripts/room-registry` now treats an absolute RPATH as the room dir (`/*) ROOMDIR="$RPATH"`, `msys\|cygwin` handling, no `ROOMS_HOME/RPATH` doubling). test-383-registry-abs-rpath and test-383-no-write-before-gate passed. `birthRoom` returns before mkdir when the runtime fails (S3). `room-auto-create` stays gateless by design (D-01, Canon Part 10) but skips quietly when the runtime fails (S4). Existing junk trees: listing and digest-bound `--clean-doubled-rooms=<digest>` repair shipped; deletion not run, needs owner approval |

**Score:** 7 VERIFIED, 3 PARTIAL (QA383-02, -08, -09), 0 FAILED. No truth is FAILED, so no BLOCKER. The partial items are human or measurement items, not missing code.

## CONTEXT decisions D-01 to D-08

| Decision | Honored | Evidence |
|----------|---------|----------|
| D-01 auto-create gateless, guarded | Yes | `room-auto-create.cjs:179` returns `environment_not_ready` |
| D-02 no hand deletion, gated repair | Yes | Doctor row plus `--clean-doubled-rooms=<digest>` in `scripts/doctor.cjs`; receipt Part D unsigned, nothing deleted |
| D-03 lazy resolver in platform.cjs, no second module | Yes | `resolveRoomRuntime` lazy and cached; `detectPlatform` untouched; honors `MINDRIAN_BASH`, `MINDRIAN_PYTHON` |
| D-04 sweep without full report | Yes | test-383-sourced-number U1, U2 |
| D-05 plain-first, verbatim-filed | Yes | doctrine lines above |
| D-06 CLI required, Desktop/Cowork UNVERIFIED | Yes | stated in diagnosis and receipt |
| D-07 doctor point for hook shell, seed for the fix | Yes | `resolveHookShell`, `lib/core/doctor/room-runtime-module.cjs`, SEED-144 present |
| D-08 never edit a 384 file | Yes | `git status` shows only the pre-existing Phase 384 bench modification; no 383 commit lists a 384 file |

No version bump by Phase 383: the only plugin.json/package.json commits since 2026-11-04 are the beta.78 pre-release bump and the earlier release, not 383 commits.

## Key link and wiring check

| From | To | Status |
|------|----|--------|
| `prepareRoomCreation` | `resolveRoomRuntime` before `mintCard` | WIRED |
| `birthRoom` | `resolveRoomRuntime`, `spawnRoomRegistry` | WIRED |
| room-identity, room-open, room-auto-create, graph-backfill | `spawnRoomRegistry` | WIRED |
| `spawnRoomRegistry` | `MINDRIAN_PYTHON` env, read by `scripts/room-registry` | WIRED |
| `scripts/check-voice-style.cjs` Rule 5 | `checkReplyLength`, policy `voice-length` | WIRED (shadow only) |
| `scripts/session-start` no-room context | remember notice and routing text | WIRED |
| doctor | `room-runtime-module`, `doubled-room-trees-module` | WIRED (acceptance run lists the rows) |

## Anti-patterns and findings

| Severity | Finding |
|----------|---------|
| WARNING | `tests/run-all-383.sh` header comment maps QA383-02 to QA383-10 to the wrong findings (for example QA383-03 "room-creation card offers a real fork", QA383-10 "nothing written before the gate" is right, QA383-05 "failed room creation says what failed"). The PRD defines them differently. Comments only; the legs themselves discover by glob and pass. Fix the header text in a later quick |
| WARNING | QA383-09 is a shadow measurement. The PRD says replies "stay inside the voice rule". That outcome is not demonstrated, and 9 of 98 corpus rows exceed 8 sentences. Promotion to enforcement is a human edit after a reviewed window |
| WARNING | QA383-03 down-MCP first-turn notice is doctrine text only. No hook fires it. Desktop and Cowork reach is UNVERIFIED |
| INFO | Debt-marker scan (TBD, FIXME, XXX) over the Phase 383 source and test files found no real marker (matches were the word JTBD only). Dash fence leg PASSED |
| INFO | Known and accepted failures listed by the caller reproduced exactly (card-fire baseline 6/5, self-update 19/5, clean-tree point) |

## Requirements coverage (PRD table)

| ID | Plans claiming | Status |
|----|----------------|--------|
| QA383-01 | 01, 03, 04, 09 | Code VERIFIED, laptop leg human_needed |
| QA383-02 | 05 | PARTIAL, three causes STILL OPEN, human_needed |
| QA383-03 | 05 | VERIFIED as diagnosed, reach UNVERIFIED |
| QA383-04 | 04 | VERIFIED |
| QA383-05 | 06 | VERIFIED |
| QA383-06 | 06 | VERIFIED |
| QA383-07 | 06, 07 | VERIFIED |
| QA383-08 | 08 | PARTIAL, U3 PENDING, human_needed |
| QA383-09 | 07 | PARTIAL, measurement only |
| QA383-10 | 03, 04, 10 | VERIFIED for gated paths, deletion human_needed |

No orphaned IDs: every ID appears in at least one plan. The IDs are absent from REQUIREMENTS.md by design.

## Gaps summary

No code gap blocks the goal. The phase is at plan 383-11, a human checkpoint by design. `human_needed` stands until the owner fills and signs `383-WINDOWS-RECEIPT.md`, answers the F.0 deletion cards, names the QA session number, and says which of C1, C4, C5 hit the laptop. The phase must not be marked closed, and QA383-01, SEED-142 must not be marked done, until that receipt is signed.

---

_Verified: 2026-11-05_
_Verifier: Claude (gsd-verifier)_
