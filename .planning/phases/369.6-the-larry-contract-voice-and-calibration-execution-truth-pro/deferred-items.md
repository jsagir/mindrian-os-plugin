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
