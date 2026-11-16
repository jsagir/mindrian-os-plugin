# 395-07b Summary: fix commit for the cold check of `e1f2faff2`

Date: 2026-11-16. Base `ccba8d91b`. Planning on Opus 5.5, execution on Haiku 5.5.

## What changed

* `lib/core/feyminto/next-move.cjs`: `gatherNest` option `wholeFiles`; `ledgerRating` gives `fit` and `unsure`; W6 and W7 say "the ledger rating for X is not sure enough to count" for a row under the confidence floor; `SELECTOR_ORDER` is '395-07b' (each brief is rewritten 1 time at the next stop).
* `lib/core/feyminto/brief.cjs` (`renderBrief`): when a ceiling cut a nest file, the blocks of the brief read the files whole; the next move is still chosen from the cut read. Closes MA1 ("none recorded" for parts that exist).
* `lib/core/strategy/goal-gate.cjs`: `explore` is refused for `change-rung` too, so the sentence "The gate does not take explore" is true. Effect: a room with a stored goal `explore` can no longer change its problem type with a change-rung card.
* `lib/memory/triple-context-formatter.cjs`: a stale head that only the order mark moved adds a true sentence.
* New `tests/test-395-truth-fixes.cjs` (12 checks); `tests/run-all-395.sh` lists it.

## What ran

* New test: 9 fail before, 12 of 12 after. `run-all-395.sh`: all PASSED. 11 nearest files exit 0. Suites 3696 and 36925: same failing legs before and after.
* Scorer: B1 13 of 33, B2 8, B3 24 of 33, B4 4 of 5, pool limit 12, order limit 8: equal to the 395-09 run at `1072ddb16`.
* NO separate cold check before this commit: it is the fix commit of a KEEP WITH A FIX COMMIT verdict. The cold check of plan 395-10 also reads this commit.
* Not run by the executor: the planner's mutation proofs and no-change proof (the planner ran them on scratch copies).
