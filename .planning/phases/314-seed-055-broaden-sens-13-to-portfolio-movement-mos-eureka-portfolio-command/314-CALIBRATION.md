# 314 Calibration record (plan 314-07, D-04)

Date: 2026-10-28
Result: NOT CALIBRATED. Blocker: no_qualifying_room. data/eureka-portfolio-thresholds.json carries calibrated false with this reason.

## What was run

- The harness: scripts/eureka-portfolio-calibrate.cjs, subcommand measure --probe.
- Encoder: live local encoder MongoDB/mdbr-leaf-ir, dtype q8, from the local model cache. No network call, no spend. The run used the offline preload so a missing model file could not reach the network.
- Each probe copied the room into a fresh temp folder, ran runPortfolio once on the copy, and deleted the copy. The original rooms were never opened.
- Resource use (nice -n 10, one process): the largest probe took 164 seconds with a peak of about 855 MB resident memory. The other probes took 0 to 71 seconds with peaks under 855 MB.

## The bar (plan 314-07 Task 3 step 2, not lowered)

pairs_scored at least 200, at least 50 ranked pairs, cohort_techs at least 100.

## Probe table (rooms named by hash only)

Probe order: the room the 215-05 spot-check used first, then the largest rooms by database size. 11 rooms were probed. The other 23 rooms with a database have fewer than 200 edges. Pairs come only from typed edges (test R3), so those rooms cannot reach 200 pairs. That last step is ASSUMED from the pair rule, not probed.

| room_id_hash | nodes | edges | result | cohort_techs | pairs_scored | ranked | qualifies |
|---|---|---|---|---|---|---|---|
| 8fb9034c29b4 (215-05 room) | 8170 | 1076 | degraded no_pairs (58 typed-edge pairs, 2841 things, none left after exclusions) | - | - | - | no |
| a43ff1b737f4 | 13877 | 2242 | scored | 89 | 2 | 2 | no |
| a2e80d4cd53e | 11163 | 3782 | scored | 3628 | 27 | 27 | no |
| 8c064edfb920 | 6338 | 2136 | scored | 3277 | 194 | 194 | no (6 pairs short of 200) |
| ed38d66b6660 | 2804 | 553 | degraded too_few_things (0 things) | - | - | - | no |
| 6c0a21e095a6 | 6193 | 436 | degraded no_pairs (72 typed-edge pairs, 133 things) | - | - | - | no |
| 66c264381a7f | 1575 | 381 | scored | 306 | 1 | 1 | no |
| 0acbf84757d0 | 2330 | 1569 | scored | 679 | 31 | 31 | no |
| 7c0d6bb84bb5 | 1925 | 3661 | degraded no_pairs (3073 typed-edge pairs, 317 things, none left after exclusions) | - | - | - | no |
| 257b9eaa97a2 | 1021 | 1722 | scored | 893 | 96 | 96 | no |
| 6fb30445011e | 801 | 267 | scored | 130 | 4 | 4 | no |

## The rule that would have applied (quoted from the harness)

Candidate N values are 5, 10, 25 and 50 that do not exceed the number of ranked pairs in the baseline. For each N, wobble_moved(N) is the 90th percentile (nearest rank) of entered plus left over the 1 percent trials, wobble_shift(N) the same for max_shift; change_moved(N) and change_shift(N) are the medians over the 10 percent trials. Choose the smallest N where wobble_moved(N) is at most floor(N / 4) and change_moved(N) is greater than wobble_moved(N). reshuffle_min_moved is wobble_moved(N) plus 1, never below 2. reshuffle_min_displacement is wobble_shift(N) plus 1, never below 2. displacement_separates is true when that minimum is at most change_shift(N).

No trial table exists. The noise floor and the holdout trials need a baseline that meets the bar, and no probed room did. No threshold number was measured, so none is recorded and none is invented.

## Findings that explain the result

- The scored pair count is small for every real room. A room with thousands of edges gives few scored pairs, because most typed edges join structural things or are excluded (containers, scaffold pairs, low-trust pairs, the figure guard).
- Two rooms (8fb9034c29b4 and 7c0d6bb84bb5) had typed-edge pairs (58 and 3073) but none survived the exclusions.
- The closest room, 8c064edfb920, scored 194 pairs. That is 6 under the bar. The bar was not lowered.

The run was local compute with no network call and no spend.
