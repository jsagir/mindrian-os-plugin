# 395-07 Summary: truth of what the selector says, and its cost

Date: 2026-11-16. Branch `work/395-selection-by-job`. Base of this slice: `d5e52033e`.

COMMITTED ON THE OWNER'S WORD (2026-11-16, in the main session) BEFORE THE COLD CHECK. The cold check runs after the commit; its findings go to the next plan or to a fix commit.

## What changed (33 changes, all applied by script, each Find text found 1 time; sha256 of the 6 code files equal to the plan table)

* `lib/core/feyminto/next-move.cjs`: every form of the why sentence is true (the form added in `1538bbec3` was false in 19,019 of 30,917 synthetic compositions; 3 of 630 real results change in wording); ceilings: 50 research run folders (newest by run id) and 262,144 bytes for each nest file; lazy `mcp` marker.
* `lib/core/feyminto/capability.cjs`: the tool router and `zod` are loaded only when the `mcp` marker is asked for.
* `lib/core/feyminto/brief.cjs`, `lib/memory/triple-context-formatter.cjs`: a selector-order mark and the ledger `built_at` are in the full fingerprint and in a brief line, so briefs written under an older order read as stale and are rewritten 1 time.
* `lib/core/strategy/goal-gate.cjs`: the gate refuses `explore` as a new goal job (reason `goal_job_does_not_rank`).
* `lib/mcp/tools/sensors.cjs`: sentences true for a stored goal `explore`; `how_to` shorter when a goal is set (1,018 to 699 characters).
* New `tests/test-395-truth-and-cost.cjs` (25 checks); `tests/run-all-395.sh` lists it.

## What ran

* New test: 20 checks fail before the code changes, 25 of 25 pass after (executor, in the work folder).
* `bash tests/run-all-395.sh`: first run failed check 5 of `tests/test-395-hook-reaches-selector.cjs` (wall time of `decide()`, 1,527 ms against 1,200 ms) at load average 14.87; second run 7 of 7 PASSED. Main session: 6 alternating runs of that test on a copy of `d5e52033e` and on the changed tree, while another session ran a build at about 650 percent CPU: each tree failed 1 of 6. Load, not the change (baseline README).
* Main session, after the change: 100 single test files: exit codes equal to the before list except `tests/test-36925-brief-wiring.cjs` (1 before, 0 after; load-dependent). Suite 345: PASS=18 FAIL=1 before and after, same leg. Suite 36925: same failing legs plus brief-wiring arm BW2 (load-dependent; 53 passed, 4 failed against 54 and 3).
* Harness manifest check OK; tool-honesty check exit 0.

## What did not run before the commit

* Suite 3696 after the change (it was still running at commit time; result to be added below).
* The cold check.
* Any live host.

## Planner's measured numbers (scratch copies, alternating runs)

* Cold selector call on `cli`: 179.4 to 123.1 ms median; modules 280 to 174; `zod` files 95 to 0.
* Real hook, `decide()`: 90.0 to 51.4 ms median.
* Worst-case room (2,000 runs, 2 files 10 MB larger): `decide()` 555.6 to 66.1 ms median.

## For the owner

* 9 new sentence texts reach a user's model with no owner review of the wording.
* The gate refuses `explore`. Ceilings of 50 runs and 262,144 bytes; a nest file over the ceiling is cut in mid text.
* `SELECTOR_ORDER` is a constant that a later plan must change by hand when the order or the sentences change.
