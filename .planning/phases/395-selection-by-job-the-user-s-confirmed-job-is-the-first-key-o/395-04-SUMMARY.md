# 395-04 Summary: the job orders inside the selector

Date: 2026-11-15. Branch `work/395-selection-by-job`. Base of this slice: `4a47b04be`.

## What changed

* `lib/core/feyminto/next-move.cjs`: sort keys are now (1) the candidate serves the selection job, (2) the ledger fit score for that job in 3 levels (strong at 1.5 or more, middle, poor under 0.5), counted only when the ledger confidence passes the shipped floor, (3) the count of sources as before. The why sentence names the key that decided.
* `lib/hmi/jtbd-state.cjs`: a goal job `explore` is not a selection job; the section job is used.
* New `tests/test-395-job-orders.cjs` (18 checks); `tests/run-all-395.sh` lists it.

## Decisions made without the owner (he can overrule)

* D1: key 2 is the ledger fit SCORE gated by confidence, not the raw confidence. In the ledger, `score` is the fit and `confidence` is how sure the scorer is. A sort by raw confidence made `score-innovation` the primary for goal `validate-idea` in 9 of 15 nests (cold check count; the planner counted 15 of 15) against 1 of 15 before.
* D2: a goal `explore` never ranks. Before, it made `think-hats` the primary in 10 of 15 nests.
* A3: a command with no counted ledger score is in the middle level, before a command counted poor. This decides 15 of 45 changed primaries with no ledger data for the new primary. Cold check MA3 asks for an owner decision.

## What ran

* New test: 12 checks fail on the old code, 18 of 18 pass with the change. 16 single mutations each fail a check.
* `bash tests/run-all-395.sh`: exit 0, 4 files.
* Suite 36925: PASSED=53 FAILED=4 before and after, same names. Suite 3696: PASSED=125 FAILED=6 SKIPPED=2 KNOWN=18 before and after, same names.
* No job known: 3,168 selector compositions byte-identical to the old code.
* Cold check (`docs/designs/selection-path/runs/395-04/cold-check.md`): COMMIT, 0 blockers, 4 majors, 8 minors.

## Measured effect (born room plus 1 hand-made nest, no goal and 20 goal jobs, 2 surfaces, 630 results)

* 73 of 630 primaries change: 28 from the `explore` rule, 45 from the order.
* The primary serves the job in 181 of 517 results after, 170 before. In 336 of 517 no runnable candidate in the pool serves the job. The pool limits the result, not the order.
* 10 changed primaries read one by one: 6 better by the ledger data, 1 better by the data but doubtful to a reader, 3 only "not shown poor", 0 worse.

## Carried to a later plan

* MA1: `next-move.cjs:231` prints "the ledger rates this command higher for the job" when the primary has no ledger rating and the other command is counted poor. The sentence is false in that case.
* MA2: briefs written before this change keep the old primary with no stale mark. Fix: put a selector-order mark and the ledger `built_at` in the record basis.
* MA3: owner decision on "not rated is before poor"; 17 ledger entries are within 0.06 of a limit.
* MA4: with goal `explore`, `suggest_next` can say "No job is set" while a goal is stored; the gate still accepts `explore`.
* Minor: no check pins the limits 0.5 and 1.5.
