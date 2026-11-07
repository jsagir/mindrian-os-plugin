VERDICT NO-GAIN d1=172.3 d2=210.6 noise=174.3 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S8 stop_gate_check warm ping during the call, before and after | 310.65 (257.5 / 363.8) | 119.2 (85.2 / 153.2) | 546 | 475.9 | 172.3 | 210.6 | 174.3 | 50 | 34.218574 | 57.04698 | NO-GAIN |

## Guard: warm tool reply (mcp:block:stop_gate_check:warm:tool against mcp:block-b)

VERDICT NO-GAIN d1=-5.8 d2=-12.6 noise=222 floor=50

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S8 guard warm:tool | 329.6 (275.8 / 383.4) | 338.8 (281.6 / 396) | 565.9 | 750.1 | -5.8 | -12.6 | 222 | 50 | 32.645631 | 33.766234 | NO-GAIN |

## Guard: cold ping (mcp:block:stop_gate_check:cold:ping against mcp:block-b)

VERDICT NO-GAIN d1=184.4 d2=197.7 noise=196.1 floor=50

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S8 guard cold:ping | 338.75 (286.4 / 391.1) | 147.7 (102 / 193.4) | 594.1 | 374.6 | 184.4 | 197.7 | 196.1 | 50 | 30.907749 | 61.882194 | NO-GAIN |

No guard printed WORSE.

## Result in words

Verdict word: NO-GAIN, so the keep rule (both set differences above twice the noise and above 50 ms) is not met and the change is reverted. Sets: set 1 and set 2, 15 runs each, interleaved, pinned exports of the commit before the fix (A, label before) and of the fix commit ff8ecf2e5 (B, label after), fixture room, taskset 0-3, load1 at the start of the sets 1.12 and 0.32.

Median warm ping during stop_gate_check: tree before 257.5 ms (set 1) and 363.8 ms (set 2); tree after 85.2 ms (set 1) and 153.2 ms (set 2). Combined medians shown in the table: 310.65 ms before and 119.2 ms after. The after value is below 200 ms, so the in-process steps (recompile, folder-memory snapshot) did not hold the loop for more than 200 ms in these sets. Both set differences were above the 50 ms floor (172.3 and 210.6 ms). The verdict is NO-GAIN because the noise term (174.3 ms) is large: the median of the same tree moved by 106.3 ms (before) and 68.0 ms (after) from set 1 to set 2, and twice the noise (348.6 ms) is above both differences. The warm tool reply (guard) shows the same set-to-set drift (noise 222 ms). The host state between the two sets differed; the rule does not allow a retake for NO-GAIN. The fix commit ff8ecf2e5 and the mechanism test commit 4ec4efdfc are reverted; the parity commit 6ce9afbdf stays. A follow-up for the owner: a quieter host or a larger n could resolve the noise term; no code change is made here.
