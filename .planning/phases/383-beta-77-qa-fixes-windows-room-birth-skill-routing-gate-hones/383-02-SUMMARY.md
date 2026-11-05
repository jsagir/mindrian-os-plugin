---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 02
subsystem: testing
tags: [routing, card-gate, plain-failure, voice, sourced-number, red-first]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: tests/helpers/harness-383.cjs and tests/run-all-383.sh from plan 01
provides:
  - six RED-first test files for QA383-02, -03, -05, -06, -07, -08, -09
  - target strings and payload shapes for plans 05, 06 and 07 pinned in tests
affects: [383-05, 383-06, 383-07, 383-08, 383-11]

tech-stack:
  added: []
  patterns:
    - "Static string contracts pin the exact target phrase, with a guard leg for the code side that already works"
    - "Child-process legs with a boom python3 shim, as in tests/test-l9o-rooms-python-floor.cjs"
    - "Sweep tests use one fixed extraction rule and an ALLOWLIST that a stale entry fails"

key-files:
  created:
    - tests/test-383-no-room-routing.cjs
    - tests/test-383-card-fork.cjs
    - tests/test-383-plain-failure.cjs
    - tests/test-383-card-second-person.cjs
    - tests/test-383-sourced-number.cjs
    - tests/test-383-voice-length.cjs
  modified: []

key-decisions:
  - "The six files reuse tests/helpers/harness-383.cjs (hermeticEnv, applyEnv, reporter, shimPath, mkTmp) because plan 01 is already done; the plan text allowed self-contained files but did not forbid reuse"
  - "F3 builds the answered-fork turn through deriveTurnSignals from a transcript, then calls classifyCardFire, so the leg covers the real signal path"
  - "C5 prints PENDING while findThirdPersonNavigator is missing, because C1 already fails for the same cause"

requirements-completed: [QA383-02, QA383-03, QA383-05, QA383-06, QA383-07, QA383-08, QA383-09]

duration: not timed (start not recorded)
completed: 2026-11-05
---

# Phase 383 Plan 02: Wave 0 tests for routing, gate and voice Summary

**Six RED-first test files that pin the no-room routing text, the card-fork doctrine, the plain three-line failure payload, second-person card copy, the sourced-number sweep and the 8-sentence reply limit; the sweep reproduces the plan's 372-sentence, 27-file measurement.**

## Accomplishments

- Each file states its target as a string contract or a fixture leg and fails at HEAD for a behavior reason (phrase missing, function not exported, field absent, file absent). No leg failed for a syntax or path reason.
- The routing test prints the listing size with its counting method.
- The sourced-number test uses one extraction rule and prints every hit plus the totals.
- Guard legs pin the code that already works (declared-fork arm, hook spawn, answered fork, registry entry, bash syntax).

## Task Commits

1. Task 1: routing, card-fork and plain-failure tests - `acacce9a9`
2. Task 2: card copy, sourced-number and voice-length tests - `ee00ae78d`

## HEAD result table (measured in this run, before any implementation, HEAD acacce9a9 for tasks 1 files, ee00ae78d tree for task 2 files)

| File | Exit | Last line | RED legs (FAIL at HEAD) and cause | Guard or other legs (PASS at HEAD) |
|------|------|-----------|-----------------------------------|------------------------------------|
| test-383-no-room-routing.cjs | 1 | `PASS: 3 FAIL: 3 PENDING: 0` | N1 (new routing words missing; `No methodology routing` and `Do NOT suggest /mos:new-project unprompted` still present), N2 (no `nothing from this talk is remembered` in the no-room branch, 12 lines read), N3 (both phrases missing from agents/larry-extended.md) | N4 guard, N5 report, N6 guard |
| test-383-card-fork.cjs | 1 | `PASS: 4 FAIL: 1 PENDING: 0` | F4 (`when no card can fire` present, `fork that ends in prose` absent) | F1, F2, F3, F5 guards |
| test-383-plain-failure.cjs | 1 | `PASS: 0 FAIL: 6 PENDING: 0` | L1, L2, L3 (`plain` is undefined; ok, reason and stderr already hold), L4 (three doctrine files lack all three phrases and still hold `Report the failure line verbatim`), L5 (`run inside WSL` present), L6 (tool-router never reads `result.plain`) | none |
| test-383-card-second-person.cjs | 1 | `PASS: 1 FAIL: 3 PENDING: 1` | C1 (no `findThirdPersonNavigator` export), C2 (MODE_MENU and the cold-start line both say `the navigator starts talking`), C4 (`to the navigator as you` absent) | C3 (16 static card strings scanned, no third-person hit) ; C5 PENDING until C1 can run |
| test-383-sourced-number.cjs | 1 | `PASS: 2 FAIL: 1 PENDING: 1` | U1 (50 figure hits) | U2 (empty allowlist), U4 (no dash in a swept string); U3 PENDING by design |
| test-383-voice-length.cjs | 1 | `PASS: 0 FAIL: 7 PENDING: 0` | V1 (no `checkReplyLength` export), V2 to V5 (same cause, reported against V1), V6 (probe-D appended 0 voice-length rows), V7 (voice-length.json ENOENT) | none |

`bash tests/run-all-383.sh` at the end of this plan: `Phase 383: PASS=2 FAIL=12 SKIP=0`; Part 8 sweep PASSED; dash fence PASSED. The 12 failing files are the 6 of plan 01 and the 6 of this plan; PASS=2 is the Part 8 sweep and the dash fence.

## Card-fork guard result (plan asked for this record)

F1, F2 and F3 all PASS at HEAD. The code side of QA383-05 (the declared-fork arm and the Stop hook) works today, so QA383-05 is a doctrine-wording fix owned by plan 06, with no code cause found.

## Listing report (N5)

`LISTING entries=227 description_chars=18545 method=commands/*.md+skills/*/SKILL.md minus disable-model-invocation`

## Sourced-number sweep (U1)

`SWEEP strings=386 hits=50 allowlisted=0 files=27` at HEAD. Breakdown:

- Rule part (1), commands/*.md and agents/*.md: 372 strings. This matches the plan's 5018cab83 measurement of 372.
- Rule parts (2) and (3), startup-operations literals and session-start spans: 14 more strings, no hit among them.
- The 50 figure hits sit on 38 distinct strings. 38 matches the plan's hit count when read as hit strings; the plan did not say whether it counted figures or strings. The file count, 27, matches.
- `git diff 5018cab83 HEAD` over commands, agents, lib/mcp/startup-operations.cjs and scripts/session-start is empty, so the sources did not move.

Files with hits: commands/admin.md, compare-ventures.md, diagnostics.md, export.md, file-meeting.md, graph.md, hat-briefing.md, ignite.md, jtbd.md, mva-option.md, onboard.md, operator.md, pipeline.md, publish.md, room.md, rs-explain.md, rs-fetch.md, rs-thesis.md, scheduled-tasks.md, setup.md, snapshot.md, trending-to-absurd.md, update.md, vault.md, agents/grading.md, agents/investor.md, agents/persona-analyst.md.

Several hits are figures that are not claims (the HTTP status 401, step markers such as `(1)`, a count of the reply's own items, `<body>`-style templates with a score). Plan 08 decides per hit between a fix and an ALLOWLIST entry with a reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dash characters written into a regex literal**
- **Found during:** Task 2 verification (the aggregator dash fence reported `FORBIDDEN dash` in tests/test-383-sourced-number.cjs)
- **Issue:** The unicode escapes for the two dash characters in the DASH_RE literal were written to disk as the two real characters.
- **Fix:** DASH_RE now builds from `String.fromCharCode(0x2013)` and `String.fromCharCode(0x2014)`. The fence passed after the fix.
- **Files modified:** tests/test-383-sourced-number.cjs (fixed before the Task 2 commit)

**2. [Rule 1 - Bug] Block comment closed early**
- **Found during:** Task 2, `node -c` on tests/test-383-card-second-person.cjs
- **Issue:** A `*/` sequence in a path glob inside the header comment ended the comment.
- **Fix:** The header text names the files in words. No glob inside a comment.

### Other notes

- The plan said the files are self-contained; they use tests/helpers/harness-383.cjs instead, as the orchestrator prompt asked. No second aggregator was created.
- The `--tripwires` mode and the replay suites of tests/test-359-*.cjs were not run; no file of theirs changed.

## Known Stubs

None. The only placeholder is `SESSION_STRING = null` in test-383-sourced-number.cjs (U3), and it is deliberate: plan 383-11 adds the QA session number from the full report. U3 prints PENDING, not PASS.

## Threat Flags

None. Every file sets HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME and CLAUDE_CONFIG_DIR to mkdtemp dirs before any repo require (T-383-07). `git status --porcelain` after the runs lists only the six new test files.

## UNVERIFIED

- Windows, macOS, Desktop and Cowork behavior. The tests run on Linux with string contracts and a PATH shim.
- tests/test-card-fire-relevance-gate.cjs: not run, not touched, not depended on (5 expected RED legs at HEAD per the plan).
- Whether every L1 to L3 assertion other than `plain` stays green after plan 06. They hold at HEAD.

## Self-Check: PASSED

- FOUND: tests/test-383-no-room-routing.cjs, tests/test-383-card-fork.cjs, tests/test-383-plain-failure.cjs, tests/test-383-card-second-person.cjs, tests/test-383-sourced-number.cjs, tests/test-383-voice-length.cjs
- FOUND commits: acacce9a9, ee00ae78d
- No em dash or en dash in the six files (`grep -P "[\x{2013}\x{2014}]"` prints nothing)
