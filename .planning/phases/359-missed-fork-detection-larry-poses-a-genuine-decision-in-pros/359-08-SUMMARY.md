---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 08
subsystem: testing
tags: [baseline, standing-gate, mutation, tripwire, card-fire, fork359]

requires:
  - phase: 359-05
    provides: forward harness and permission probe (dev-only scripts guarded by the tripwire)
  - phase: 359-06
    provides: ratified dogfood overlay, I-1 and I-2 confirmed
  - phase: 359-07
    provides: --fork359 replay metrics, --code-root git:<sha>, --baseline write-359
provides:
  - "tests/fixtures/card-fire-replay/baseline-359.json: the frozen pre-359 fork number (R2)"
  - "tests/test-359-replay.cjs --mutation: M1 arm removed, M2 free-text regex, HEAD control"
  - "tests/test-359-devonly-tripwire.cjs: D1 to D5 dev-only and vendor tripwires"
  - "tests/run-all-359.sh: the 359 standing gate; four 359 legs in tests/run-all-238.sh"
affects: [359-09, 359-10, 359-11, 359-12]

key-files:
  created:
    - tests/fixtures/card-fire-replay/baseline-359.json
    - tests/test-359-devonly-tripwire.cjs
    - tests/run-all-359.sh
  modified:
    - tests/test-359-replay.cjs
    - tests/run-all-238.sh
    - .planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-VALIDATION.md

key-decisions:
  - "Mutation mode exits before the normal legs and uses its own HEAD archive per mutant; nothing is written to the working tree."
  - "The baseline is written with --surface cli, as the plan states. The previous executor's command was verified against the plan: it matches (the plan adds nothing else)."

requirements-completed: [FORK359-02, FORK359-05, FORK359-06, FORK359-10]

duration: ~25min
completed: 2026-10-28
---

# Phase 359 Plan 08: Baseline, mutation legs, tripwire and standing gate Summary

**The pre-359 missed-fork count (17) is frozen in a 359-owned baseline written from the pinned pre-359 commit, removing the declared arm or adding a free-text fork regex is proven to fail the suite, dev scripts are banned from lib/ and hooks/, and the 359 legs run in both run-all-359.sh and run-all-238.sh.**

PLAN_BASE: `1261f696ae5c76c857a40dad1f856b755370e4ee`. Every claim below is PROVEN (command run in this plan) unless marked otherwise.

## Commits

- Task 1: `176997834` test, `tests/fixtures/card-fire-replay/baseline-359.json`, `tests/test-359-replay.cjs`
- Task 2: `3544447cb` test, `tests/test-359-devonly-tripwire.cjs`, `tests/run-all-359.sh`, `tests/run-all-238.sh`, `359-VALIDATION.md`

## R2 baseline

Command (matches the plan, PROVEN): `node scripts/replay-card-fire.cjs --code-root git:2797903a005b7e0500b74c0af70ea86f6f7958fc --fork359 --surface cli --baseline write-359`, exit 0.

- `meta.pre_359_sha` equals `pre-359.json` `pre_359_sha` (2797903a005b7e0500b74c0af70ea86f6f7958fc).
- **R2 missed_forks: 17.** `prose_forks` 17, `controls` 42, `control_false_blocks` 0.
- Split: synthetic-359 contributes all 17 prose forks (`declared_caught` 0, `declared_missed_forks` 17, 3 simple-binary excluded). The dogfood overlay contributes 0 prose forks (all 24 ratified dogfood ids are `prose_fork:false`, 359-06), so the dogfood side adds controls only.
- `verdicts` covers 96 entries from the sources 238, debug, dogfood, live, synthetic-359.
- `tests/fixtures/card-fire-replay/baseline.json` is untouched (git status clean).

## Mutation results (`node tests/test-359-replay.cjs --mutation`, 4/4)

| Leg | Result |
|-----|--------|
| HEAD control (unmutated copy) | exit 0, declared_catch_rate 1, control_false_blocks 0 |
| M1 (`const forkDeclared = false;` after `ANCHOR fork359-declared-arm`) | exit 1, declared_catch_rate 0 |
| M2 (free-text `or ... ?` regex before the no-gate-signal return) | exit 1, control_false_blocks 3 |
| NETWORK_ATTEMPT_359 | never seen |

Each mutant runs in its own `mkdtemp` copy of `git archive HEAD`; 0 `/tmp/replay-359-root-*` or `/tmp/replay-357-root-*` dirs remain.

## Runner results (hermetic HOME, USERPROFILE, MINDRIAN_ROOMS_HOME)

- `bash tests/run-all-359.sh`: PASS=25 FAIL=0 SKIP=1 (26 legs; the SKIP is `test-359-prose-budget.cjs`, which lands in plan 09, as the plan expects).
- `bash tests/run-all-238.sh`: PASS=14 FAIL=0 SKIP=0. All four new 359 legs PASSED. The 238-03 leg PASSED in this run; the plan expected it as a known red (R-J), but it was green here. No red was added or removed by this plan.
- `bash tests/run-all-357.sh`: PASS=16 FAIL=0 SKIP=0.
- `node tests/test-359-replay.cjs`: 26/26. `node tests/test-359-inertness.cjs`: 4/4.
- `node tests/test-359-devonly-tripwire.cjs`: 9/9 (scanned 1271 runtime files under lib/ and hooks/; 1 workflow file; 3 package scripts).
- `run-all-238.sh` diff: 8 added lines, 0 removed lines.
- `git diff --name-only 1261f696..HEAD` lists only tests/ files and 359-VALIDATION.md. No file under lib/, hooks/ or scripts/ changed. `baseline.json` and `run-all-357.sh` are untouched.
- Em-dash and en-dash count is 0 in every file written. The dash guard in run-all-359.sh covers the files named in the plan and PASSED.
- Known pre-existing reds (R-J: `test-card-fire-relevance-gate.cjs`, `test-ga4-card-fire-e2e-179.cjs`) are not added to any runner and not fixed. UNVERIFIED: whether they still fail; this plan did not run them.

## Deviations from Plan

**1. [Rule 1 - Bug] L8 corpus copy included baseline-359.json once it existed**
- **Found during:** Task 1, first full run of `test-359-replay.cjs` after the baseline was written (25/26).
- **Issue:** L8 proves that `--baseline write-359` without the right code root writes nothing. It copies the fixture dir, so the new baseline file was copied too and the "writes nothing" assertion failed.
- **Fix:** the copy skips `baseline-359.json`. L8 now tests the write guards on a copy that has no baseline, as 359-07 intended.
- **Files modified:** `tests/test-359-replay.cjs`
- **Commit:** `176997834`

**2. Em-dash guard extended to en-dashes.** The plan's task text says "em-dash and en-dash guard"; run-all-357 only checks em-dashes. run-all-359 checks both. No behavior change for existing files (all passed).

## Known Stubs

None.

## Threat Flags

None. The mitigations for T-359-36 to T-359-40 are in place: M1 and M2 legs (T-359-36, T-359-37), tripwire D1 to D5 plus the vendor leg (T-359-38), additive-only run-all-238 change with an explicit-path commit (T-359-39), and a baseline written by the replay from the pinned sha and re-derived by L7 (T-359-40).

## Notes for later plans

- VALIDATION sign-off: `nyquist_compliant` and `wave_0_complete` are true; the prose-budget Wave 0 box and the third sign-off box stay open for plan 09 and the phase close-out. Approval line reads "approved 2026-10-28 (359-08 standing gate green; R8 and R9 pending)".
- STATE.md and ROADMAP.md were not edited (main session owns them).

## Self-Check: PASSED

- FOUND: tests/fixtures/card-fire-replay/baseline-359.json, tests/test-359-devonly-tripwire.cjs, tests/run-all-359.sh (executable), tests/test-359-replay.cjs, tests/run-all-238.sh
- FOUND: commits 176997834 and 3544447cb on feat/eureka-adapter-rebased
