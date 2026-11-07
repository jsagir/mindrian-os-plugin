VERDICT KEEP d1=712.3 d2=943.4 noise=231.1 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 SessionStart:changed wall, before and after | 5072.85 (5070.2 / 5075.5) | 4245 (4357.9 / 4132.1) | 5686.4 | 5213.3 | 712.3 | 943.4 | 231.1 | 50 | 0.104478 | 5.319199 | KEEP |

## Guard: SessionStart:compact wall (event:SessionStart:compact, must not be WORSE)

VERDICT KEEP d1=1075.4 d2=1058.2 noise=457 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 guard compact wall | 4971.95 (5090.5 / 4853.4) | 3905.15 (4015.1 / 3795.2) | 5630.5 | 5540.3 | 1075.4 | 1058.2 | 457 | 50 | 4.768753 | 5.631026 | KEEP |

## Informative, not gating: SessionStart:changed hook CPU (cpu_ms.median)

VERDICT KEEP d1=1000 d2=820 noise=400 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 info changed cpu | 5235 (5380 / 5090) | 4325 (4380 / 4270) | 5980 | 5520 | 1000 | 820 | 400 | 50 | 5.539637 | 2.543353 | KEEP |

## First take (read before the retake; verdict NOT-RESOLVED, so both sets were taken again once, as the keep rule says)

VERDICT NOT-RESOLVED d1=330.7 d2=196.3 noise=134.4 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 changed wall, first take | 2620 (2654 / 2586) | 2356.5 (2323.3 / 2389.7) | 3608.8 | 3506.7 | 330.7 | 196.3 | 134.4 | 50 | 2.59542 | 2.817738 | NOT-RESOLVED |

VERDICT NO-GAIN d1=275.4 d2=233.4 noise=152.8 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 compact wall, first take | 2568.5 (2540.8 / 2596.2) | 2314.1 (2265.4 / 2362.8) | 4832.7 | 4161.5 | 275.4 | 233.4 | 152.8 | 50 | 2.156901 | 4.20898 | NO-GAIN |

The first take files are fix-s1-take1-set1.json, fix-s1-take1-set1-b.json, fix-s1-take1-set2.json and fix-s1-take1-set2-b.json. The median of the before tree on the first take was 2654 and 2586 ms; on the retake it was 5070.2 and 5075.5 ms. The host ran at a different speed between the two takes (load1 stayed below 2 in both), so the absolute differences of the retake are not comparable with those of the first take. The verdict word of each take is read on its own sets.

## Node starts and process starts (untimed, exact, LD_PRELOAD exec counter, event SessionStart:startup:changed, 3 repeats each)

| tree | node_starts | exec_total median (min / max) | exec_per_repeat |
|---|---|---|---|
| before | 45 | 103 (103 / 111) | 111, 103, 103 |
| after | 40 | 95 (95 / 103) | 103, 95, 95 |

Node starts fall by 5, the number the sites table promised. Process starts in total fall by 8 (median).
