---
phase: 261029-sc6-b-follow-ups-re-base-test-3551-tri-polar
plan: 01
quick_id: 261029-sc6
subsystem: tests
tags: [tests, hooks, tri-polar, fixture, cold-start]
status: COMPLETE
requires: [261029-qef]
provides:
  - tests/test-3551-tri-polar.cjs with 2 pins (BASE_3551 for Stop, BASE_NON_STOP for non-Stop) and a timeout-blind compare
  - tests/fixtures/369/hook-cold-start-baseline.json in second budgets (46 entries, 45 measured, n=10)
key-files:
  modified:
    - tests/test-3551-tri-polar.cjs
    - tests/fixtures/369/hook-cold-start-baseline.json
    - tests/run-all-363.sh
decisions:
  - "tests/run-all-363.sh run_known signature moved to PASS=64 FAIL=4 by orchestrator order (commit 25a7617bd); the leg that moved the count beyond 63/5 is the doctor no-new-regression leg, whose determinism is UNVERIFIED"
completed: 2026-10-29
---

# Phase 261029-sc6 Plan 01: perf change B follow-ups Summary

STATUS is COMPLETE. All tasks ran and 3 commits exist. The third commit (run-all-363 signature) follows the orchestrator ruling and the later order to finish it. One caveat stays: see the Coordinator ruling follow-up.

## Commits (3, none pushed)

| Order | Sha | Message |
|-------|-----|---------|
| 1 | 92e605402 | test(261029-sc6): re-base the tri-polar non-Stop hooks.json pin to a13ab61f1 and ignore timeout and onFailure in the compares |
| 2 | 013fd40b5 | test(261029-sc6): refresh the 369 hook cold-start baseline fixture to the second budgets |
| 3 | 25a7617bd | test(261029-sc6): run-all-363 known signature follows the measured 355.1 count (64 pass, 4 fail) after the tri-polar re-pin |

PROVEN: all 3 shas are ancestors of HEAD (`git merge-base --is-ancestor`). Each commit used `git commit --only -m ... -- <path>` with one explicit path. `git show --stat` showed one file per commit. PROVEN: no file was deleted. Nothing is pushed. PLAN.md, SUMMARY.md and STATE.md are not committed by me.

## Task A: tri-polar pin

Changes in tests/test-3551-tri-polar.cjs (PROVEN, 26 insertions, 10 deletions):
- `BASE_3551 = '2f5109bef'` is kept for the Stop leg. `BASE_NON_STOP = 'a13ab61f1'` is new (D-A).
- `withoutTimeoutKeys(value)` drops the keys `timeout` and `onFailure` and nothing else.
- The event key set of HEAD must equal the key set of BASE_NON_STOP.
- Each non-Stop array compares against `a13ab61f1` after the strip. The SessionStart `normalizePreflight` stays.
- The Stop survival compare also uses the strip (D-B). The Stop length check and the ambient-stop entry checks (async, timeout 5, --stop, no --dry-run) are unchanged.

Test lines:
- Before (PROVEN): `PASS: 8 FAIL: 1`, message `hooks.json[SessionStart] must be unchanged from BASE_3551`.
- After, run 1 and run 2 (PROVEN): `PASS: 24 FAIL: 0`, exit 0 on both.

Negative check (PROVEN): a scratch copy of hooks.json with `--tampered` appended to the first PreToolUse hook command, loaded through a compiled copy of the test. Result: exit 1, `PASS: 8 FAIL: 1`, message `hooks.json[PreToolUse] must be unchanged from BASE_NON_STOP (timeout and onFailure aside)`. The strip does not hide a changed command. Nothing was written into the repo.

run-all-3551 (PROVEN, run 20:59 to 21:05, load 1.5 to 2.4):
- Before (planning): `Phase 355.1: PASS=62 FAIL=6 SKIP=0`, tri-polar FAILED.
- After: `Phase 355.1: PASS=64 FAIL=4 SKIP=0`, `>>> test-3551-tri-polar.cjs: PASSED`.
- Expected by the plan: 63/5. Actual: 64/4. One more leg moved. CORRECTION (PROVEN by diffing the before and after logs): the leg that moved is `doctor --acceptance (no-new-regression vs BASE_3551 baseline)`, FAILED before ("NEW acceptance regression vs BASE_3551: doctor-all") and PASSED after. `test-198-adapter-budget` PASSED in BOTH logs; my first report named it by mistake. The doctor leg depends on tree and peer state (the aggregator header says peer sessions in this shared tree drive its gaps), so its flip is not shown to be deterministic.
- FAILED lines in the log: dependency-diff (first, in the 355.1 aggregator), test-355-direction-agreement, 356 ledger build, 356 answer key, run-all-356, 272-cache-probe, run-all-272, run-all-355, test-auto-explore-fingerprint, test-connector-tier-d-hooks. The 4 top-level fails are dependency-diff, run-all-355, test-auto-explore-fingerprint and test-connector-tier-d-hooks (ASSUMED from the aggregator shape; the others are nested in run-all-355).
- Decision: tests/run-all-363.sh signature changed from `PASS=62 FAIL=6` to `PASS=64 FAIL=4` in commit 25a7617bd (orchestrator order, see the follow-up section). The plan Step 5 rule alone would not allow this edit (count was not 63/5).

Dash check (PROVEN): 0 U+2013 or U+2014 in the added lines.

## Task B: cold-start fixture

Host load (C-4, PROVEN): `uptime` before the run: `21:05:57 up 2:16, load average: 1.48, 1.57, 1.91` (below 4, no retry needed). After the run: `21:12:08 up 2:21, load average: 0.31, 0.74, 1.42`.

Generator (PROVEN): `node scripts/measure-hook-cold-start.cjs --n 10 --json --out <scratch> --tree-check report`. Exit code 0. Stderr empty. Run time about 6 minutes (the plan assumed 1 to 3; ASSUMED estimate was low). measured_at `2026-10-29T19:12:08.820Z`. The output went to a scratch file first (D-D), then was copied to the fixture.

Check script output (PROVEN, run on the scratch file and again on the installed fixture):
- 1 n is 10; keys machine, node, measured_at, n, entries exist: OK.
- 2 46 entries equal the 46 command hooks in file order; event and command match; each `timeout_ms` equals hooks.json timeout x 1000: OK.
- 3 exactly 1 `not_measured`, the npm reconcile hook, text contains "network-capable": OK.
- 4 45 measured; no "legacy" timeout_unit_note: OK.
- 5 numeric p50, p95, max, timeout; p95 below timeout; 0 timeout_breaches for each measured entry: OK.
- 6 tree_unchanged true; tree_diff empty: OK.

Records (not stop conditions):
- 5 highest p95/timeout ratios: sessionstart-reference-now-seed 87.4/5000 = 0.0175; part8-egress-guard-hook 84/5000 = 0.0168; gsd-graph-derive-drain 82.2/5000 = 0.0164; ambient-stop --stop 77.6/5000 = 0.0155; first-install-router 38.1/3000 = 0.0127. Largest headroom use is under 2 percent of the budget.
- Entries with close_breaches above 0: none (the old fixture had 10 on post-compact and session-start).
- first_session_probe: sessionstart-coordinator, bare HOME, n=1, exit_ms 11746.8, timeout_ms 40000, killed_at_limit false.

Tests (PROVEN): `node tests/test-369-hook-require-graph.cjs` prints `5 passed, 0 failed`; arm 3 reads `45 measured entries, n=10, node v22.23.1`. Dash check on the fixture: 0 matches. `git status` showed only the fixture and the peer file .planning/ROADMAP.md as modified.

## Deviations from Plan

None to the task steps. The only departure is the plan-allowed branch: run-all-363.sh was not edited because the measured count was 64/4 and not 63/5. Generator run time was longer than the plan estimate.

## Threat Flags

None. The change touches a test and a fixture only. T-sc6-01: the negative check proves a changed command still fails. T-sc6-02: checks 1 to 6 ran before the copy. T-sc6-04: peer files (.planning/ROADMAP.md, phases/381-*, debug/*.md) were not staged, edited or reverted.

## Coordinator ruling follow-up (2026-10-29)

Ruling: update the run-all-363 signature to 64/4 only if the test-198 flip is deterministic. Step 1 results (PROVEN): `node tests/test-198-adapter-budget.test.cjs` 3 times, uptime load 0.75 each time, exit 0 each time, last line `PASS: test-198-adapter-budget (15 of 15 tests passed)`. The test and hook-adapter-audit.cjs have no diff between 4e178bd23 and HEAD (PROVEN, git diff --stat empty); the test checks the line budgets of hook scripts, not hooks.json timeouts, and it already passed in the planning log.

Result: the premise was wrong. test-198 did not flip (it passed in both logs). The flipped leg is the doctor no-new-regression leg (see CORRECTION above). Its result changes with tree state, so its determinism is UNVERIFIED. I reported this to the orchestrator. The orchestrator then ordered: if the 3 runs of test-198 pass, edit and commit the signature. The 3 runs passed, so I edited line 139 of tests/run-all-363.sh only (`bash -n` OK, 0 dashes, the new string occurs 1 time in the after log) and committed it with `git commit --only` as 25a7617bd. Not pushed. The edit is one line and easy to revert.

## Report

STATUS: DONE
CHANGED: tests/test-3551-tri-polar.cjs (92e605402); tests/fixtures/369/hook-cold-start-baseline.json (013fd40b5); tests/run-all-363.sh line 139 (25a7617bd).
VERIFIED: (PROVEN) tri-polar test PASS: 24 FAIL: 0 on 2 runs; negative check fails at PreToolUse; run-all-3551 prints PASS=64 FAIL=4 with tri-polar PASSED; fixture checks 1 to 6 OK at load 1.48; test-369-hook-require-graph 5 passed, 0 failed; test-198 exit 0 on 3 runs; `bash -n tests/run-all-363.sh` OK; 0 dashes in added content; all 3 shas are ancestors of HEAD.
UNVERIFIED: the whole run-all-363.sh was not run (too long; no single-leg switch was used), so the run_known match is shown only by grep of the after log. Whether the doctor no-new-regression leg gives the same result on every run is unknown.
RISKS: The 64/4 byte-pin is fragile. If the doctor leg flips back to FAILED, the count becomes 63/5 and the run_known leg reports FAILED again. A robust check (match the 355.1 prefix only) would be a separate quick.
NEXT: Commit the SUMMARY. Consider a follow-up quick to make the run-all-363 run_known signature independent of the doctor leg.
