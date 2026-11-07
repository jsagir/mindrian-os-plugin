# Plan 384-18 Task 1: C-B candidate (Phase 382 commit 23ab77410) before any product change

START_SHA: 25bb9d04b17b86be718d17e85ca6b0bf95d6969b (tree A, label before).
Tree B: the same export with `--apply-commit 23ab77410` (applied cleanly, no hand port needed), label candidate.
Target: `doctor:all` (doctor --all, wall time). Metric: wall_ms.median. Two interleaved sets, n of 7 per tree per set, taskset 0-3, run under the lock `$HOME/.cache/mos-perf-384.lock`. Floor 50 ms (owner decision 2). Scratch trees only; no product file changed.

Load1 at the start of the blocks: 0.81 (fixture), 1.07 (copy).

## Decision table: local real-room copy (the class that ranks, owner decision 5)

Copy made by the harness picker, scratch only. Picker line: class real-copy, 221 files, 13728700 bytes, file system ext2/ext3 (the tool prints no path). Isolation check strict: both sets exit 0, no source path changed.

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-B candidate 23ab77410, doctor --all, local real-room copy, scratch trees | 3701.55 (3481.2 / 3921.9) | 3952 (4185.2 / 3718.8) | 4082.1 | 4431.8 | -704 | 203.1 | 907.1 | 50 | 11.905823 | 11.801619 | NO-GAIN |

VERDICT NO-GAIN d1=-704 d2=203.1 noise=907.1 floor=50

## Second table: fixture rooms home

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-B candidate 23ab77410, doctor --all, fixture rooms, scratch trees | 3862.2 (3577.5 / 4146.9) | 3708.45 (3510.3 / 3906.6) | 4656.8 | 4022.5 | 67.2 | 240.3 | 965.7 | 50 | 14.742893 | 10.686405 | NO-GAIN |

VERDICT NO-GAIN d1=67.2 d2=240.3 noise=965.7 floor=50

## Reading

Local real-room copy: the median of doctor --all is 3701.55 ms in tree A and 3952 ms in tree B. The sign of d1 is negative (B is larger in set 1) and the sign of d2 is positive (B is smaller in set 2). The two signs differ and the noise is 907.1 ms, so the word is NO-GAIN.

Fixture rooms home: the median is 3862.2 ms in tree A and 3708.45 ms in tree B. Both signs are positive (B smaller), d1 is 67.2 ms and d2 is 240.3 ms, and the noise is 965.7 ms, so the word is NO-GAIN. The difference is inside the noise of the two sets.

Both classes give NO-GAIN under the rule of ab-verdict. The spread of each tree is above 10 percent in both blocks; the sets differ by more than the effect.

The Windows mount class is NOT MEASURED in this phase (owner decision 5). The numbers in the Phase 382 commit message (3.9 ms per file call warm, about 1.0 s per pass warm, 12 s cold) are the Phase 382 author's claims for the mount. They are not claims of this phase and no number here confirms or refutes them.
