VERDICT NO-GAIN d1=7.8 d2=10 noise=146.4 floor=50
| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S7 mcp:os initialize before vs after (n 41, two sets, interleaved) | 605.15 (568 / 642.3) | 596.25 (560.2 / 632.3) | 1085.2 | 1001.7 | 7.8 | 10 | 146.4 | 50 | 12.277948 | 12.092243 | NO-GAIN |

## Setup

Primary `mcp:os:initialize` against `mcp:os-b:initialize`, metric wall_ms.median, spawn to the initialize reply of the mindrian-os server on the fixture room. Tree A = pinned export of 7a1226376 (BEFORE, product files equal START_SHA 5c6bfb89563b9a2b2eeece417c5894c88583c8d7), tree B = pinned export of 168315fe7 (FIX). n of 41 per tree per set, two sets one after the other, interleaved A B, B A. taskset -c 0-3, sandbox HOME, loopback Brain, lock held. load1 at the start of set 1: 1.48, at its end: 1.65; set 2 start 1.40 (uptime), end 1.42 (uptime). `verify-results` printed OK. No retake: the word is NO-GAIN, and the keep rule retakes only NOT-RESOLVED.

## Guard

`mcp:os:tools-list` against `mcp:os-b:tools-list`, wall_ms.median (copied from the ab-verdict output): VERDICT NO-GAIN d1=9.7 d2=14.4 noise=181.3 floor=50; median A 639.7 (593.2 / 686.2), median B 627.65 (583.5 / 671.8), p95 A 1130.6, p95 B 1043.3. Not WORSE.

## Mechanism (untimed counts, tests/test-384-s7-mcp-start.cjs, 3 fresh child processes)

Modules in require.cache after registerCoreTools (zod loaded first): 479, 479, 479 before; 382, 382, 382 after (minus 97). Selected files: research.cjs, sensors.cjs, gate.cjs, stop-gate.cjs. tools/list, initialize and the registration health equalled the golden before and after.

## Reading

The change moved 97 modules out of the load at registration and the median initialize time of the server moved by 7.8 ms (set 1) and 10 ms (set 2). That is 1.3 percent and 1.7 percent of the median before (605.15 ms over both sets), far under the floor of 50 ms and under the noise term of 146.4 ms (the medians of one tree differ by 74.3 ms between the sets for tree A and 72.1 ms for tree B). The word is NO-GAIN, so the fix commit 168315fe7 and the mechanism commit 7a1226376 are reverted (2243db515 and 23816150b); the parity commit stays. What the measurement shows: the module count at registration is not the cost that sets the initialize time on this host. It does not answer the S7-eu question (the effect of the 16 Eureka files): that question stays NOT RESOLVED as in 384-RANKING.md, and this plan changed no Eureka file.
