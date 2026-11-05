---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 05
subsystem: routing
tags: [routing, session-start, doctrine, no-room, memory, diagnosis, prose-budget]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: tests/test-383-no-room-routing.cjs with legs N1 to N6 (plan 02)
provides:
  - 383-ROUTING-DIAGNOSIS.md with seven causes C1 to C7, marks and a decision table
  - Mode 1 text that routes a named method need and offers /mos:new-project once
  - a no-room memory sentence in session-start and in agents/larry-extended.md
  - a missing-room-tools sentence in agents/larry-extended.md
affects: [383-06, 383-11]

tech-stack:
  added: []
  patterns:
    - "Doctrine added to agents/larry-extended.md must fit the 65 percent body cap of test-3696-voice-first-budget (headroom 12 B after this plan)"
    - "A hook-level diagnosis runs the real hook with env -i and mkdtemp homes"

key-files:
  created:
    - .planning/phases/383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones/383-ROUTING-DIAGNOSIS.md
  modified:
    - scripts/session-start
    - agents/larry-extended.md
    - tests/test-359-prose-budget.cjs
    - data/harness-manifest.json
    - CHANGELOG.md

key-decisions:
  - "Task 3 (first-turn hook notice) NOT built. Rule: build only when C6 shows a CLI state where the MCP server cannot start AND the larry-extended doctrine does not reach the session. C6 verdict: PROVEN no notice exists, PROVEN the doctrine loads through settings.json agent regardless of server state, no failing CLI state shown, Desktop and Cowork run no hooks. scripts/sessionstart-npm-reconcile.cjs is unchanged and tests/test-383-mcp-unavailable-notice.cjs does not exist."
  - "The no-room memory and missing-tools sentences sit in the second Operating invisibly bullet of agents/larry-extended.md, not on the Operating policy line. Reason: the Operating policy line is hashed by the D7h freeze, and a separate line broke the body cap."
  - "Two duplicate clauses were cut from agents/larry-extended.md to pay for the added bytes: the gate-card clause of the first Operating invisibly bullet (bullet 5 keeps the rule) and the Voice modulation line (references/personality/voice-dna.md lines 103 and 105 keep the content)."

requirements-completed: [QA383-02, QA383-03]

duration: not timed (start not recorded)
completed: 2026-11-05
---

# Phase 383 Plan 05: No-room routing and memory notice Summary

**The diagnosis shows the report's guess is half true: the session-start Mode 1 text told Larry not to route in a no-room session, and nothing told the user that memory calls refuse without a room. Both are fixed in text; the hook-side engine gate and the registry are cleared; the skill-listing budget and the Windows hook state stay open for the retest.**

## Accomplishments

- 383-ROUTING-DIAGNOSIS.md names seven causes with file:line, hook-level command output and a mark each (PROVEN, CITED, STILL OPEN), a decision table, a live-eval leg and a Rethinking Room mirror note.
- Mode 1 of scripts/session-start now says: a named method need runs the matching /mos command, a stated goal gets one /mos:new-project offer, nothing is filed unless the user asks.
- The no-room context says once, in plain words, that nothing from the talk is remembered and offers a room.
- agents/larry-extended.md says the same when no room is bound and says in the first reply when the room tools are missing.
- Result of `node tests/test-383-no-room-routing.cjs`: `PASS: 6 FAIL: 0 PENDING: 0`. Line printed by the test: `LISTING entries=227 description_chars=18545 method=commands/*.md+skills/*/SKILL.md minus disable-model-invocation`.
- `bash tests/run-all-383.sh`: `Phase 383: PASS=9 FAIL=5 SKIP=0` (was PASS=8 FAIL=6). The five still red are card-fork, card-second-person, plain-failure, sourced-number and voice-length, owned by plans 06 to 08.

## Diagnosis result (verdicts)

| Cause | Verdict |
|-------|---------|
| C1 Mode 1 text suppresses routing | PROVEN text on every no-room session after the first. The first session on a machine takes the FIRST_INSTALL branch and carries no Mode 1 text. Whether the QA session saw it: STILL OPEN |
| C2 `if (roomDir)` gate in the intent classifier | PROVEN gate, cleared as a cause: with one room the engine block still has `fire_skill: null` for the trigger sentence, so this gate never runs a command in either state |
| C3 registry entry | PROVEN present; `command-registry: OK` |
| C4 skill listing budget | CITED mechanism; size measured (227 entries, 18,545 chars); overflow on the QA laptop STILL OPEN |
| C5 bash hooks on Windows | PROVEN code fact (WSL launcher or silent exit 0); the branch on the QA laptop STILL OPEN |
| C6 MCP server down, no notice | PROVEN no notice; doctrine reaches the CLI; Desktop UNVERIFIED |
| C7 memory calls need a bound room | PROVEN; zero calls with no room is the doctrine, the gap was the silence |

## Task Commits

1. Task 1: diagnosis - `71a68a43a`
2. Task 2: Mode 1 text, no-room memory line, doctrine sentences, pins, harness manifest - `79f521e6a`
3. Task 2 fix: fit the sentences inside the body budget - `db2ea3b05`
4. Task 2: CHANGELOG entry - `0adaecc5e`
5. Task 3: not built (see key-decisions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The prose-budget pin for scripts/session-start also moved**
- **Found during:** Task 2 verification
- **Issue:** The plan named only LARRY_OUTSIDE_GATES. `SESSION_START_OUTSIDE_DOCTRINE` in tests/test-359-prose-budget.cjs also failed, as its own comment predicts ("any later edit of session-start moves this pin again").
- **Fix:** Both pins re-based with dated comments. The NAV_CARD_FIRE_DOCTRINE line is unchanged.
- **Commit:** `79f521e6a`, `db2ea3b05`

**2. [Rule 1 - Bug] data/harness-manifest.json went stale**
- **Found during:** test-298-contract-parity after the doctrine edit
- **Issue:** The manifest digest of agents/larry-extended.md no longer matched the file.
- **Fix:** `node scripts/build-harness-manifest.cjs`; `--check` exits 0. The file is part of the Task 2 commit.

**3. [Rule 1 - Bug] The plan's doctrine text broke two existing tests**
- **Found during:** `bash tests/run-all-3696.sh`
- **Issue (a):** Appending to the Operating policy line changed its D7h hash (test-3696-operation-doctrine D7h: 13 hits, 12 frozen). Fix: the text left that line.
- **Issue (b):** A separate paragraph of 307 bytes pushed the body to 13058 B, over the 12752 B cap (65 percent of 19619 B) of test-3696-voice-first-budget V3. The headroom before this plan was 1 byte.
- **Fix:** The two sentences were shortened and moved into the second Operating invisibly bullet. Two duplicate clauses were cut (gate-card clause of bullet 1; the Voice modulation line, whose content references/personality/voice-dna.md keeps). A first trim also cut the room-read clause, which test-3696-operation-doctrine D3 pins; it was restored. Result: body 12740 B, cap 12752 B, headroom 12 B.
- **Plan wording changed:** the plan said "keep line 163 byte-identical and append"; line 163 is byte-identical, the added text is in the bullet above instead of on that line.
- **Commit:** `db2ea3b05`
- **Consequence for plan 06:** plan 06 edits the same file (card-fork wording, plain failure). It has 12 B of headroom, not 63. It must cut as much as it adds, or move text to references/personality/agent-operations.md.

## Verification (measured in this run, after the last commit)

- `node tests/test-383-no-room-routing.cjs`: exit 0, `PASS: 6 FAIL: 0 PENDING: 0`.
- `bash tests/run-all-383.sh`: `Phase 383: PASS=9 FAIL=5 SKIP=0`.
- Must-stay-green, each exit 0: test-platform, test-room-birth (35/35), test-l9o-rooms-python-floor (18/18), test-room-registry-windows-atomic-replace, -path and -python-interp, test-startup-flows, test-371-startup-ui, test-359-declared-arm (20/20), test-3696-reply-checks (143/143), test-369-hook-require-graph (5/5), test-session-start-banner, test-209-session-start-exemplar, test-251-skeleton-split, test-3696-persona-drift (20/20), test-3696-operation-doctrine (25/25), test-3696-voice-first-budget (12/12), test-3696-skill-budget, test-143.2-doctrine-presence, test-359-prose-budget (18/18), test-298-contract-parity (20/20 on a clean tree).
- `bash tests/run-all-3696.sh`: `PASSED=124 FAILED=2` on the last run. The two: test-298 (tree dirty because of untracked Phase 384 files; it passes on a clean tree, run after) and test-3696-isolation B5f (a repo file newer than the marker, `tools/perf/count-modules-preload.cjs`, written by the Phase 384 session during the run; the file passed on rerun).
- `bash tests/run-all-359.sh`: `Phase 359: PASS=26 FAIL=1`. The one failure is the forward-harness preflight: `~/.claude/agents/larry-extended.md` is a symlink (dated Oct 29) to the plugin cache. With `HOME` set to an empty temp dir, `node tests/test-359-forward-harness.cjs` prints `Passed: 38 / 38`. Environment gap on this machine, not caused by this plan. Not verified at the parent commit.
- Gates, all exit 0: `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs` (198 wired, 2 excluded, 0 unwired), `node scripts/build-harness-manifest.cjs --check`.
- `grep -cP "[\x{2013}\x{2014}]"` prints 0 for every file this plan wrote or edited (the CHANGELOG already holds 107 older dashes; the added bullet holds none).

## Known Stubs

None.

## Threat Flags

None. No network call, no Brain call and no new tool were added. T-383-10: the diagnosis hook runs used `env -i` with HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME in the session scratchpad. After the work, `find ~/MindrianRooms -newer <diagnosis file>` listed `.rooms/.room-graph` and `mindrianOS/.mindrian`. Those paths are written by live hooks of other sessions on this machine; the source is not proven.

## UNVERIFIED

- The live routing claim (a scripted session reaches /mos:scientific-roadmap with and without a room). It needs a live model; the command is in the diagnosis, section Live eval leg. The exact flags of `claude plugin eval` were not checked.
- Whether the host skill listing overflowed on the QA laptop (C4), which hook branch ran there (C5), and whether the QA session was the first session on that laptop (C1). Plan 383-11 owns these.
- Desktop and Cowork behavior (no hooks, no agent file there [ASSUMED]; the MCP runtime instructions are at their byte cap and were not touched).
- That Claude Code applies the plugin `agent` setting in the QA session (C6).

## Rethinking Room mirror

Draft entry in the session scratchpad: `/tmp/claude-1000/-home-jsagi-dev-MindrianOS-Plugin-release/491e046f-77d7-4444-b831-aea38fda4686/scratchpad/rethinking-mirror-383-05-routing.md`. Nothing was written under ~/MindrianRooms. The main session files it under `rethinking-mindrianos/research/`.

## Self-Check: PASSED

- FOUND: 383-ROUTING-DIAGNOSIS.md, this file, the scratchpad mirror draft.
- FOUND commits: 71a68a43a, 79f521e6a, db2ea3b05, 0adaecc5e.
- tests/test-383-mcp-unavailable-notice.cjs absent and scripts/sessionstart-npm-reconcile.cjs unchanged, as the Task 3 decision requires.
