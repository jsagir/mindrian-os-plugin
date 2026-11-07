# S4 SubagentStop batch cap, before and after (ab-verdict output)

A = before (96543f446), B = after (e25550a9f). Pinned exports, fixture room, n of 7 per set, two interleaved sets, taskset 0-3 via the tool.

## What the cap did at 20 files

At 20 modified files the batch cap raised the tail and the survivor CPU. The median tail (background_ms) went from 21253.5 ms before to 37208 ms after, and the median survivor CPU from 28715 ms before to 40940 ms after; the sign of d1 and d2 is negative for both (the after tree is larger). The processes started at 20 files rose from a median of 17633.5 to 50635. The hook return time at 20 files is the one number that moved the other way: median 669.9 ms before against 456.45 ms after (KEEP on its own, informative, not gating). The numbers do not show why the process count rose. Verdict word on the primary metric: NO-GAIN, with the guards for tail and processes at 20 files and tail at 5 files printing WORSE. The fix commit e25550a9f and the mechanism commit 96543f446 are reverted (f640469cb, dd1a8937e); the parity commit 876689f2b stays.

## Primary: survivor CPU at 20 files
VERDICT NO-GAIN d1=-11060 d2=-13390 noise=8870 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S4 primary: survivor CPU at 20 files | 28715 (27080 / 30350) | 40940 (38140 / 43740) | n/a | n/a | -11060 | -13390 | 8870 | 50 | 11.387776 | 13.678554 | NO-GAIN |

## Guard: background_ms (tail) at 20 files
VERDICT WORSE d1=-15083 d2=-16826 noise=1743 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guard tail 20 | 21253.5 (21290 / 21217) | 37208 (36373 / 38043) | 22269 | 41426 | -15083 | -16826 | 1743 | 50 | 0.343473 | 4.488282 | WORSE |

## Guard: exec_total (processes started) at 20 files
VERDICT WORSE d1=-31707 d2=-34296 noise=2589 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guard processes 20 | 17633.5 (18928 / 16339) | 50635 (50635 / 50635) | n/a | n/a | -31707 | -34296 | 2589 | 50 | 14.682281 | 0 | WORSE |

## Guard: survivor CPU at 5 files
VERDICT NO-GAIN d1=-1430 d2=-970 noise=2460 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guard survivor CPU 5 | 10030 (9300 / 10760) | 11230 (10730 / 11730) | n/a | n/a | -1430 | -970 | 2460 | 50 | 14.556331 | 8.90472 | NO-GAIN |

## Guard: background_ms (tail) at 5 files
VERDICT WORSE d1=-5060 d2=-5073 noise=33 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guard tail 5 | 9136.5 (9148 / 9125) | 14203 (14208 / 14198) | 10779 | 15712 | -5060 | -5073 | 33 | 50 | 0.251738 | 0.070408 | WORSE |

## Informative: hook return wall_ms.median at 20 files
VERDICT KEEP d1=244.4 d2=182.5 noise=61.9 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| info wall 20 | 669.9 (692.1 / 647.7) | 456.45 (447.7 / 465.2) | 876.3 | 603.7 | 244.4 | 182.5 | 61.9 | 50 | 6.627855 | 3.833936 | KEEP |

## Informative: hook return wall_ms.median at 5 files
VERDICT NO-GAIN d1=-115.7 d2=-69.6 noise=186.5 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| info wall 5 | 407.65 (349.5 / 465.8) | 500.3 (465.2 / 535.4) | 560.4 | 613.9 | -115.7 | -69.6 | 186.5 | 50 | 28.529376 | 14.031581 | NO-GAIN |

## Informative: load1_end at 20 files
VERDICT NO-GAIN d1=0 d2=0 noise=0.78 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| info load1 20 | 9.185 (8.99 / 9.38) | 9.185 (8.99 / 9.38) | n/a | n/a | 0 | 0 | 0.78 | 50 | 4.246053 | 4.246053 | NO-GAIN |

## Informative: load1_end at 5 files
VERDICT NO-GAIN d1=0 d2=0 noise=0.78 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| info load1 5 | 9.185 (8.99 / 9.38) | 9.185 (8.99 / 9.38) | n/a | n/a | 0 | 0 | 0.78 | 50 | 4.246053 | 4.246053 | NO-GAIN |

