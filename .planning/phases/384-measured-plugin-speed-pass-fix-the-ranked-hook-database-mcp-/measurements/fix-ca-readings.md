# Plan 384-17 readings: C-A clear the pre-warm timer (port of fb295a541)

Tree A (before) = c5bf88d733491771609370844be414989521af90. Tree B (after) = 779fb8fe0f4cc4a9a0338cb8413ad41f21787ca5. Pinned exports, fixture room, taskset 0-3, interleaved, two sets. doctor:all n of 7 per tree per set; events n of 15 per tree per set. load1 at the start of each block: 1.17, 1.28 (doctor sets), 0.80, 0.43 (event sets).

## Primary 1: doctor --all wall_ms.median

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-A doctor --all wall_ms.median | 18419.4 (17877.2 / 18961.6) | 4108.2 (3995.2 / 4221.2) | 19455.9 | 4460.6 | 13882 | 14740.4 | 1310.4 | 50 | 5.887271 | 5.501193 | KEEP |

## Primary 2: SessionStart:changed background_ms

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-A SessionStart:changed background_ms | 14840 (14834 / 14846) | 7 (8 / 6) | n/a | n/a | 14826 | 14840 | 14 | 50 | 0.080863 | 28.571429 | KEEP |

## Guard: SessionStart:changed wall_ms.median

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guard SessionStart:changed wall_ms.median | 5222.25 (5356.9 / 5087.6) | 5494.95 (5660.6 / 5329.3) | 6167.3 | 6251.5 | -303.7 | -241.7 | 600.6 | 50 | 5.156781 | 6.029172 | NO-GAIN |

## Informative: PostCompact background_ms

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| info PostCompact background_ms | 9.5 (8 / 11) | 10 (9 / 11) | n/a | n/a | -1 | 0 | 5 | 50 | 31.578947 | 20 | NO-GAIN |

## Informative: PostCompact wall_ms.median

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| info PostCompact wall_ms.median | 37.4 (29.6 / 45.2) | 35.65 (28.4 / 42.9) | 49.6 | 48.6 | 1.2 | 2.3 | 30.1 | 50 | 41.71123 | 40.673212 | NO-GAIN |

## Reading

doctor --all wall median: 18419.4 ms before, 4108.2 ms after (set differences 13882 and 14740.4, noise 1310.4); the after tree is lower by about 14.3 s. SessionStart:changed background time: 14840 ms before, 7 ms after (differences 14826 and 14840, noise 14); the after tree is lower by about 14.8 s. The guard (SessionStart:changed wall median) printed NO-GAIN: 5222.25 ms before, 5494.95 ms after, a difference of -303.7 and -241.7 against a noise of 600.6, not WORSE. PostCompact printed NO-GAIN on both metrics (its background time was already about 9.5 ms in tree A in this run).

The link between the 15 s timer and the two numbers is shown only by these differences. Why the PostCompact background time is not 14.8 s in this run is not examined here. Brain network time is NOT MEASURED: the Brain URL is the unreachable loopback in every run. Surfaces other than the Linux CLI path are NOT MEASURED.
