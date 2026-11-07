VERDICT NO-GAIN d1=76.1 d2=76.1 noise=75.6 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S2 post-write default:artifact | 291.1 (272.2 / 310) | 215 (196.1 / 233.9) | 688.7 | 722.8 | 76.1 | 76.1 | 75.6 | 50 | 12.985228 | 17.581395 | NO-GAIN |

## Guard: rooms:artifact (cascade runs)
timed-out set1-a target q7:write:rooms:artifact has timed out runs 5

## Guard: rooms:identity
VERDICT NO-GAIN d1=127.7 d2=33.6 noise=134.3 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S2 post-write rooms:identity | 447.15 (437.1 / 457.2) | 366.5 (309.4 / 423.6) | 622.1 | 621.9 | 127.7 | 33.6 | 134.3 | 50 | 4.495136 | 31.159618 | NO-GAIN |

## Informative: default:artifact cpu_ms.median
VERDICT KEEP d1=160 d2=160 noise=60 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S2 post-write default:artifact | 585 (600 / 570) | 425 (440 / 410) | 820 | 640 | 160 | 160 | 60 | 50 | 5.128205 | 7.058824 | KEEP |

## Note
The default-layout target showed two groups of rounds in plan 384-11; the spread of each set is in the first table. The rooms:artifact guard could not be computed: ab-verdict refused it because timed-out runs are present on the target (the cascade layout runs close to the 5 s hook limit). A refusal is not the word WORSE.
