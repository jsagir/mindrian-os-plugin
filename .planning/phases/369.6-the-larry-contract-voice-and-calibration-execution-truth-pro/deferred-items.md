# Deferred items, phase 369.6

Out-of-scope findings. Each one is logged here and not fixed by the plan that found it.

## 369.6-03 (found 2026-10-29)

1. tests/test-359-prose-budget.cjs, leg "B5: session-start outside the doctrine line is byte-untouched" fails.
   - Cause: quick 261029-sof (commit dfbadf150) changed scripts/session-start (the three temp paths now follow TMPDIR). The frozen sha256 SESSION_START_OUTSIDE_DOCTRINE (247f7746...) predates it.
   - PROVEN not caused by plan 03: `git diff --stat 60c1d1f7f HEAD` lists only the six plan 03 files, and the test fails on the same bytes at the dispatch HEAD.
   - Owner: the plan that next edits scripts/session-start re-bases this sha under a dated comment (plan 369.6-07 Task 1, the N6 two-window rule), or a /gsd-quick before it. The failing-leg baseline (tests/fixtures/3696-known-failures.json) does not hold this leg, so tests/run-all-3696.sh reports it FAILED until it is re-based.

2. lib/memory/userpromptsubmit-integration.test.cjs, leg "Test 3: engine sleep -> hook returns within cap" fails only under suite load.
   - Run alone, twice, the file shows only the baseline leg (Test 8). Under tests/run-all-3696.sh it also showed Test 3 (a wall-clock leg).
   - Owner: plan 369.6-13 (baseline review). Treat as a wall-clock flake until a quiet-machine run shows otherwise.

## 369.6-04 (found 2026-10-29)

1. lib/memory/minto-debounce-consumer-census.test.cjs, leg "Test 5: mutation proof" failed once inside tests/run-all-3696.sh.
   - Failure text: "real on-stop exits 0; stderr= ... null !== 0". A null exit status means the child was killed (a time limit), so this is a load-dependent leg.
   - PROVEN not caused by plan 04: run alone twice on the same tree it printed "5/5 passed" both times. Plan 04 adds only test files and edits the 114 rubric fixture and the 114 shell test.
   - Same family: lib/memory/debouncer-drain-at-prompt.test.cjs passed in the same suite run although it is a baseline red leg (reported by the aggregator as "known red healed"). Both legs depend on wall-clock timing.
   - Owner: plan 369.6-13 (baseline review), with the Test 3 flake of userpromptsubmit-integration.test.cjs from plan 03.

2. tests/test-114-commands-regression.sh (AC-114-04 of tests/test-114-larry-default-activation.sh) fails in this session: "/mos:status invocation failed or timed out". It starts a live `claude --print` call.
   - Not part of tests/run-all-3696.sh. Not caused by plan 04 (it reads none of the files this plan changed). The AC-114-02 leg of the same orchestrator (tests/test-114-turn-1-voice.sh) passed.
   - Owner: none in this phase. ENV GAP (a live claude call).
