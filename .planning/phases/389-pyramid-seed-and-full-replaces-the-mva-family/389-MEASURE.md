# Phase 389 Plan 03: Measure of research open question 5

## Purpose

Research open question 5: do phrases that the host model derives from the idea give different Brain answers for different ideas? The old brief used fixed strings, so every idea got the same answer (research fact 1). The Seed Test step now sends short generic phrases instead. This record says whether the difference was measured.

## Method

The script `389-measure-live.cjs` reads `tests/fixtures/389/sprouts.json` (3 phrase sets, one for each fixture sentence). For each set it runs `card` and then `run` of `scripts/pyramid-seed-run.cjs` as child processes. For each cell it records the status, the number of results, the duration and a short hash of the excerpt. Then it gives one verdict for each cell across the 3 fixtures:

- DISTINCT: the 3 excerpt hashes differ and none is empty.
- SAME: two or more equal, non-empty excerpt hashes.
- EMPTY: every status is empty.
- PARTIAL: anything else (some empty, the rest distinct).

The script uses the real HOME and the real Brain identity of the caller, and it may call Theo and Tavily. So it refuses to run unless the environment variable MOS_389_LIVE is exactly 1. Only the main session sets it. The executor of plan 389-03 did not set it.

## Record

<!-- measure:start -->
Status: NOT-MEASURED.

No live Brain call and no Tavily call ran in plan 389-03. The environment variable MOS_389_LIVE was not set, so no number below is invented and no verdict exists.

Command for the main session that measures it:

    MOS_389_LIVE=1 node .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-measure-live.cjs

The command replaces this block with the table and the verdicts.
<!-- measure:end -->

## What each verdict means for the Seed

- DISTINCT: keep the cell. The phrase carries enough of the idea to change the answer.
- SAME or EMPTY: the cell stays in the Seed. The text of plan 06 then says that the outside step may add nothing for this idea, and the Seed is complete without it.
- PARTIAL: treat the cell as SAME for the text of plan 06 and record which fixtures were empty.

## Which part needs no fetch

The pyramid itself (Frame, Argue, Decide) does not need any fetch. The Seed ships either way, and every cell degrades to empty: a dead Brain, a blocked phrase, a missing Tavily key or a timeout gives status empty with a typed reason, never a failure of the run (proved by `tests/test-389-seed-egress.cjs` Test 7 and `tests/test-389-seed-cells.cjs` Test 8).
