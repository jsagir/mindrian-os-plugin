# 395-09 Summary: a measure of whether the selector's answer is right for the job

Date: 2026-11-16. Branch `work/395-selection-by-job`. Measured at HEAD `1072ddb16`.

## What was added (new files only; not in the npm tarball: `package.json` `files` holds no `evals/selection` path)

* `evals/selection/cases.json`: 38 synthetic cases over the 20 job ids (25 on surface mcp, 13 on cli, 20 with a goal job, 5 "none of these" cases). Header: labels written by a model, `owner_reviewed: false`, `synthetic: true`.
* `evals/selection/score.cjs`: deterministic scorer (no model, no network); runs the real selector on fixture rooms; options are the full runnable command list of the surface plus "none of these", built outside the selector.
* `evals/selection/judge.cjs`: optional judge leg with the owner's decision model; refuses to run without a flag; NOT run (dry mode only).
* `evals/selection/README.md`; `tests/test-395-measure.cjs` (18 checks); `tests/run-all-395.sh` lists it.

## Pass bar (written before the first run; a measure, not a gate)

B1 right primary in at least 70 percent of cases that have a right command; B2 0 wrong primaries; B3 right or acceptable in at least 85 percent; B4 0 named primaries on "none of these" cases.

## Result at `1072ddb16` (base `8c493ee13` from the planner's run in brackets)

* B1: 13 of 33, 39.4 percent (7 of 33, 21.2 percent).
* B2: 8 wrong of 38 (17).
* B3: 24 of 33, 72.7 percent (10 of 33, 30.3 percent).
* B4: 4 of 5 (5 of 5; 1 gain from a label changed after a run).
* Right command absent from the candidate pool: 12 (12). Right command in the pool but not first: 8 (14).
* No bar is reached. 2 cases are worse than the base (sel-19, sel-23).

## What ran

* Executor: 5 files written by script, 5 sha256 OK; test 18 of 18; scorer exit 0, second run byte-identical; judge without flag exit 2, dry run exit 0, nothing sent; `run-all-395.sh` 8 files before, 9 after, all PASSED; `run-harness --check` identical before and after; `doctor --acceptance` 20 of 25 before, 19 of 25 after (the extra failed point is `verify-release-clean-tree`, from the uncommitted files; it clears with this commit).
* No cold check of this slice before the commit (new files only, not shipped). A cold check of the case labels is owed; the owner's review of the 38 labels matters more.

## Limits

Labels by a model, not reviewed by the owner; the label author saw selector output before labelling. 38 cases are few (1 case moves B1 by 3 points). The measure cannot show the hook, `suggest_next`, the act planner, chains, Theo, or whether the command does good work.
