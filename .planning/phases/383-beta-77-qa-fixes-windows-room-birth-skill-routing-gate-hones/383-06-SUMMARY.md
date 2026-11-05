---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 06
subsystem: failure-honesty
tags: [plain-failure, seed-117, doctrine, card-fork, prose-budget, changelog]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: plain and tried pass-through on environment_not_ready (plan 04), PLAIN_* platform texts (plan 03), RED tests L1 to L6 and F1 to F5 (plan 02), byte-budget precedent (plan 05)
provides:
  - four PLAIN_* constants exported from lib/core/room-open.cjs
  - plain field on set_active_failed, on the birth failure returns and on answerRoomCreation failures
  - plain-first rooms-open failure text in lib/mcp/tool-router.cjs
  - plain-first SEED-117 doctrine on five surfaces (larry-extended, two copies each in commands/rooms.md and skills/rooms/SKILL.md)
  - the Your call rule for a fork that ends in prose; the card copy rule
affects: [383-07, 383-08, 383-11]

tech-stack:
  added: []
  patterns:
    - "The verbatim cause stays in reason, stderr and the [room-birth] log line; the plain field is the beginner-facing half (D-05)"
    - "A doctrine edit avoids the D7h speech verbs (says, tells, names, shows, mentions, suggests, prints, surfaces, offers) on a line that holds a command id"

key-files:
  created: []
  modified:
    - lib/core/room-open.cjs
    - lib/core/navigation/room-birth.cjs
    - lib/mcp/startup-operations.cjs
    - lib/mcp/tool-router.cjs
    - agents/larry-extended.md
    - commands/rooms.md
    - skills/rooms/SKILL.md
    - tests/test-359-prose-budget.cjs
    - data/harness-manifest.json
    - CHANGELOG.md

key-decisions:
  - "scripts/check-card-fire.cjs unchanged: F1 to F3 green at HEAD. QA383-05 was a doctrine-wording fix only."
  - "The larry-extended SEED-117 sentence is shorter than the plan wording (a path instead of a file path, a parenthesis for the Python error and version) and says Give, not Show, because the D7h scan flags Show on a line that holds a /mos command id."
  - "Two cuts pay for the added bytes in larry-extended: the rationale sentence of the failed-create section and the cost-list examples of the Sourced Claims sentence."

requirements-completed: [QA383-05, QA383-06, QA383-07]

duration: not timed (start not recorded)
completed: 2026-11-05
---

# Phase 383 Plan 06: Plain failure message and the fork doctrine Summary

**A beginner who hits a room create or switch failure now gets three plain lines (what failed, why, one fix) with no path and no raw error, while the verbatim line stays in stderr, the log and the bug seed; the Your call doctrine now covers a fork that ends in prose so the Stop hook can force the card.**

## Accomplishments

- lib/core/room-open.cjs defines and exports PLAIN_CREATE_FAILED, PLAIN_CREATE_FAILED_KEPT_FOLDER, PLAIN_SWITCH_FAILED and PLAIN_ROOM_NOT_CREATED (3 lines each, no path). openRoom set_active_failed carries `plain` (the resolver plain on environment_not_ready, else PLAIN_SWITCH_FAILED) and still carries `stderr` and `python`.
- lib/core/navigation/room-birth.cjs: registry_guard_refused, registry_create_failed (KEPT_FOLDER when rolled back to registry_only), room_db_unreadable and identity_readback_failed carry `plain`. Lazy require of room-open; the four `[room-birth]` stderr writes are all kept (4 at HEAD before, 4 after).
- lib/mcp/startup-operations.cjs answerRoomCreation: `plain` from the birth result or PLAIN_ROOM_NOT_CREATED, on both the failure and the catch return.
- lib/mcp/tool-router.cjs: the rooms-open failure text prints `**Tell the navigator (plain, as is):**` and `result.plain` first; the registry block is relabelled for the bug report. The `result.stderr` and `result.python` reads stay (test-l9o R3).
- Doctrine: line 126 now reads "at a genuine, unanswered fork that ends in prose"; a new line says card text is written to the navigator as you; the SEED-117 sentence puts the plain message first and the verbatim line into the bug seed and the log, in larry-extended, commands/rooms.md (2 places) and skills/rooms/SKILL.md (2 places).
- CHANGELOG.md: one bullet under Unreleased, Fixed, ends with "Not live until a release carries it." and carries no measured number because none applies.

## Task Commits

1. Task 1: plain field on failures, plain first in the MCP text - `6502e445d`
2. Task 2: doctrine, prose-budget re-base, harness manifest - `7eebf9979`
3. Task 3: CHANGELOG bullet - `d5b9f117e`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The larry-extended text had to fit the 12,752 B body cap**
- **Found during:** Task 2 (test-3696-voice-first-budget V3 read 12893 B with the plan wording)
- **Issue:** Plan 05 left 12 B of headroom; the plan wording adds about 150 B.
- **Fix:** shorter SEED-117 wording in larry-extended only (the other four copies use the plan wording); cut the sentence "A room built around a failed create skips the wiring the chokepoint guarantees." and the cost-list examples of the Sourced Claims sentence (no test pins them; they survive only in the base fixture). Result: body 12735 B, cap 12752 B, headroom 17 B. "Never hand-build a room" and the `/mos:rooms new <slug>` sentence are unchanged.
- **Commit:** `7eebf9979`

**2. [Rule 1 - Bug] The plan wording "Show the navigator" tripped D7h**
- **Found during:** Task 2 (test-3696-operation-doctrine D7h: 13 hits, 12 frozen, new hit on the edited line)
- **Fix:** "Show" became "Give" on all five surfaces. No D7h entry was re-keyed.
- **Commit:** `7eebf9979`

**3. [Rule 1 - Bug] Two pins moved with the doctrine edit**
- `LARRY_OUTSIDE_GATES` in tests/test-359-prose-budget.cjs re-based with a dated comment (was c2adef6ed9bc...accc8, now a21e7ddaa966...2c86). `SESSION_START_OUTSIDE_DOCTRINE` did not move (scripts/session-start untouched).
- data/harness-manifest.json regenerated; `--check` exits 0.
- **Commit:** `7eebf9979`

check-card-fire.cjs unchanged: F1 to F3 green at HEAD.

## Verification (measured in this run, after the last commit)

- `node tests/test-383-plain-failure.cjs`: exit 0, `PASS: 6 FAIL: 0 PENDING: 0`.
- `node tests/test-383-card-fork.cjs`: exit 0, `PASS: 5 FAIL: 0 PENDING: 0`.
- `node tests/test-383-card-second-person.cjs`: C4 PASS (C1 and C2 stay RED for plan 07).
- `bash tests/run-all-383.sh`: `Phase 383: PASS=11 FAIL=3 SKIP=0` (was PASS=9 FAIL=5). The three RED files: card-second-person, sourced-number, voice-length.
- `agents/larry-extended.md` body: 12735 B, cap 12752 B; test-3696-voice-first-budget 12/12; test-3696-operation-doctrine 25/25; test-359-prose-budget 18/18.
- Exit 0: test-platform, test-room-birth (35/35), test-l9o-rooms-python-floor (18/18), the three test-room-registry-windows-*, test-startup-flows, test-371-startup-ui, test-359-declared-arm, test-3696-reply-checks, test-369-hook-require-graph, test-session-start-banner, test-209-session-start-exemplar, test-251-skeleton-split, test-3696-persona-drift, test-143.2-doctrine-presence, test-3696-one-next-move, test-36925-rft-binding, test-rooms-open-actually-switches, test-383-preview-env-check, test-209-card-fire-gate.
- test-298-contract-parity: exit 0 on a clean tree (run right after the Task 2 commit); exit 1 in the last sweep only on its `git status --porcelain is empty` leg because the other session had `tests/test-384-perf-harness.cjs` modified. Same cause as plan 05 recorded.
- `node tests/test-card-fire-relevance-gate.cjs`: 6 passed, 5 failed, the baseline.
- Gates, all exit 0: build-connector-registry --check, build-orchestration-projection --check, check-render-coverage, build-harness-manifest --check, build-skill-mirrors --check (112 mirrors).
- `grep -cP "[\x{2013}\x{2014}]"` prints 0 for every file this plan edited, and for the added CHANGELOG line.
- `bash tests/run-all-3696.sh`: `Phase 369.6 verification: PASSED=126 FAILED=0 SKIPPED=0 KNOWN=25`.

## Known Stubs

None.

## Threat Flags

None. T-383-05 and T-383-11 are mitigated: the plain text holds no path or raw error, and no stderr write or result field was removed. No Brain call was added (T-383-06).

## UNVERIFIED

- Desktop and Cowork rows: the MCP payloads carry `plain`, but the MCP runtime instructions are at their byte cap and were not changed, so the Desktop model sees `plain` in the payload with no Desktop doctrine line for it.
- Live behavior of the card on a real CLI fork after the doctrine change (needs a live model; plan 383-11 owns the retest). The owner may veto the line-126 change at plan 383-11.
- test-self-update-platform (5 of 24 failing, pre-existing) and run-all-359 forward-harness preflight (stale ~/.claude/agents symlink, ENV GAP) were not touched.

## Self-Check: PASSED

- FOUND commits: 6502e445d, 7eebf9979, d5b9f117e.
- FOUND files: lib/core/room-open.cjs (PLAIN_* exports), this file.
