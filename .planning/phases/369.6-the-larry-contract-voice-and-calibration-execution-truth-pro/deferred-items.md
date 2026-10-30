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

## 369.6-07 (found 2026-10-30)

1. skills/larry-personality/SKILL.md keeps spaced double hyphen pauses inside quoted speech patterns of sections outside the Voice Signature section (for example the integration offer pattern "By the way -- [brief benefit]", the onboarding offer and the proactive formula lines). Plan 07 changed only the SKILL lines it names (the identity paragraph and the closing punctuation line); the persona edit discipline forbids other lines.
   - Owner: plan 369.6-11 (the SKILL rewrite) or a /gsd-quick after it. `findDashes` kind pause counts 152 on the whole file at the base and 150 now.

2. tests/test-114-turn-1-voice.sh (AC-114-02 of tests/test-114-larry-default-activation.sh) fails in this session at rubric 1: `claude --print --plugin-dir . ""` returns only a permission-rule warning and no model reply (exit 0). It is a live-call leg and is not part of tests/run-all-3696.sh. It passed in plan 04's session. PROVEN: the same empty reply is returned by running the `claude` command by hand, so the cause is the environment, not the persona text.
   - Owner: none in this phase. ENV GAP (no model reply from a live call).

3. tests/test-3696-rubric-eval.cjs and tests/test-298-contract-parity.cjs fail while a persona file or a tracked file is uncommitted (they require a clean tree or a clean agent file). They pass on the clean tree after each commit of plan 07. Not a defect; the N6 two-window rule covers it.

## 369.6-08 (found 2026-10-30)

1. tests/test-3696-isolation.cjs failed once while the host load was 26 to 30 (headless claude batches from this workspace). Rerun alone at load 5.7 it exits 0, and it passed inside the final suite. Treat as a load-dependent leg. Owner: plan 369.6-13 (baseline review), with the wall-clock flakes of plans 03 and 04.

2. lib/memory/debouncer-drain-at-prompt.test.cjs is a baseline red leg that heals under some timings. In the plan 07 suite run it showed as healed (PASSED); in the plan 08 run it matched its recorded failing legs (KNOWN). This moved the aggregator totals from PASSED=124 KNOWN=25 to PASSED=123 KNOWN=26 with no change in code. Owner: plan 369.6-13.

3. tests/test-114-larry-default-activation.sh (AC-114-02 and AC-114-04) stays red here: the live `claude --print` call returns no reply (ENV GAP, same as plans 04 and 07). Not part of tests/run-all-3696.sh. Not run again after the coordinator load instruction.
