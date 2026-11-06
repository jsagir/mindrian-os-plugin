# Phase 384 plan 11: Q7 Write event with the cascade running, Q8 session frequency over all project folders

Tree: a pinned export of BASE_SHA_384 (db2ea3b05bb70b55741bdeb40b545801b0c37cbe), with node_modules linked from the repo.
Room kind: fixture room only (no real room, no real registry, no real ledger, no real home folder).
Host rules: CPU cap 4 cores (taskset), load1 below 2 at the start of every block, shared lock held, interleaved order that rotates each round, n = 15 per set by default (minimum 7), two sets, median and p95 (sorted sample at index floor(0.95 x (n - 1))), spread in percent.
Counting runs are separate from timing runs and have 3 repeats.

This file is written in order. The rules and the Q7 hypothesis are committed before the first Q7 result file. The Q8 hypothesis is committed before the Q8 result file. A table is added only after its numbers exist.

Source of the two questions: owner decisions 7 and 8 of 2026-11-06 (384-OWNER-DECISIONS.md), questions Q7 and Q8 of 384-RANKING.md. The floor of 50 ms per event is owner decision 2.

## Rules

Fixed before any number was taken.

R1 Counts are exact. An exact claim (a skipped flag, a stated number of modules, node starts or keys) passes when the DIRECT count equals the claim in all 3 repeats. A threshold claim (a stated bound such as above 0) passes when every repeat meets the bound. Repeats that differ on an exact claim are shown as min to max and read NOT RESOLVED. A DIRECT count that differs from the claim reads FAIL; it is a result and not an error.

R2 Difference of two timings. For a pair (X, Y), where the hypothesis says X is above Y, take per round the difference of the two walls in the same round, and for each set k the median d(k) of these differences (DERIVED). Take noise = |mX1 - mX2| + |mY1 - mY2|, where mXk and mYk are the set medians (this is the noise rule of plan 384-09, spread percent / 100 x the mean of the set medians, summed over the two parts). PASS when d(1) and d(2) are both above 2 x noise. FAIL when both are 2 x noise or below (a difference of 0 or less is FAIL). NOT RESOLVED when one set passes and the other does not.

R3 Premise gate. P-a: on the harness-layout room the cascade call, as scripts/post-write runs it, returns skipped false on the artifact file and skipped true on the identity file, in 3 of 3 repeats each. P-b: in the counted Write events of that room, the lowest node starts and the lowest module count of the artifact target are each above the highest of the identity target (3 repeats each). When a gate fails, the plan writes `premise_failed: true` and the observed words into the counts file and the md, skips all timing steps of Q7, ends Task 1 with STATUS PARTIAL, and still runs Task 2.

R4 Projection. Cost per session = W x median cost per Write (DERIVED), for W = 1, 5 and 20. W is ASSUMED (20 is the ASSUMED value of 384-RANKING.md); it has no spread. Noise = W x (two-set spread percent / 100 x median). Show wall and summed hook CPU (the S2 definition V11 of 384-RANKING.md). The S2 sum of the four events = carried CPU per event (Stop 1,500, UserPromptSubmit 240, Read 40 ms, carried from the S2 row, not re-measured) times the ASSUMED events per session (30, 30, 60), plus W x the Write CPU. The cell `meets floor` is yes when the cost per Write is above 50 ms and no otherwise (OD-2). In this file the median cost per Write is the mean of the two set medians, and the spread is the spread of the two set medians.

R5 Lower bound class of a Write row of plan 384-04 or 384-05. Inputs: independent (the row does not depend on the file named in the Write payload, for example a synthetic input), identity_is_room_md and identity_skipped (from the counts file of this plan), and the R2 reading of the artifact target above the identity target. Class: independent gives NOT A LOWER BOUND; identity_is_room_md and identity_skipped and a PASS reading give LOWER BOUND; the first two true with a reading that is not PASS give NOT A LOWER BOUND; anything else gives UNVERIFIED. The result files of plan 384-04 do not record the touched file, so a LOWER BOUND class rests on the code path and on the count of this plan; this file says so.

R6 Basis. The last column of every table in this file is Basis (header cell: the word Basis). A data cell starts with DIRECT, DERIVED or NOT MEASURED. DIRECT: a number the bench measured, counted or copied from a result file. DERIVED: a difference, ratio, product or sum of such numbers. NOT MEASURED: a number the bench does not have, with the reason.

Basis legend. DIRECT: a number the bench measured, counted or copied from a result file. DERIVED: a difference, ratio, product or sum of such numbers. NOT MEASURED: a number the bench does not have; the reason is written next to it.

## Q7

PostToolUse Write with a touch target that really runs the cascade.

Hypothesis H-Q7. On a room whose path holds /rooms/, a Write event whose target is a real artifact file runs the cascade. It starts more node processes, loads more modules, and costs more wall time and more summed hook CPU than the same event on the identity file ROOM.md of the same room, which is the file that plans 384-04 and 384-05 touched. The difference is above 2 x noise by R2 in both sets. A change of the artifact content before the event adds no cost above 2 x noise; no direction is fixed for that pair and R2 reports it. On the default layout the cascade is skipped for the artifact too (plan 384-10: skipped true). The reading rules are R2 for the four derived targets, R3 for the premise, R4 for the projection and R5 for the Write rows. The harness layout has /rooms/ in its path. Whether a user room path holds /room/ or /rooms/ is not read here (Canon Part 8), so this file shows both layouts and states which layout each number is for. The reference for reproduction is plan 384-10 (no rule): the ratio of target A to its t04:write:rooms median, per set.

Targets. Each target is one event:PostToolUse:Write run on a fixture room built by the product builder of the pinned export.
A: the artifact file, harness layout, content not changed between rounds.
A2: the same kind of artifact on the harness layout, with one text line appended to that file before every event (changed content). A2 uses a second artifact file of the room, so that the content of the file of A stays the same between rounds.
I: the identity file ROOM.md of the same room, harness layout (the file that findTouchTarget returns, and that plans 384-04 and 384-05 touched).
D: the artifact file on the default layout (a rooms folder with the product default name under a sandbox home, with no /room/ and no /rooms/ segment).
Derived per round (R2 pairs): A minus I, A2 minus I, A2 minus A, A minus D.

Results. One counts file (3 repeats) and two timing sets (n = 15 each, interleaved with an order that rotates each round) for the four targets, on two fixture rooms built by the product builder of the pinned export: a harness-layout room (its path holds /rooms/) and a default-layout room (no /room/ and no /rooms/ segment). load1 was 1.94 at the start of the counts run, 1.71 and 1.96 at the start of the two timing sets, and 2.89 and 2.90 at their end (other work on the host, outside this plan; the start values are below the limit of 2). Every table below states its layout. The bench does not change the file of target A between rounds; target A2 appends one line to its own second file before every event. Whether the cascade itself rewrites the file of A is not checked. Brain network time is not in these numbers: the Brain URL of every child is an unreachable loopback address.

Premise gate (R3): passed.
P-a: the cascade call, as scripts/post-write runs it, returned skipped false on the artifact in 3 of 3 repeats, and skipped true on the identity file ROOM.md of the same room in 3 of 3 repeats, with the reason "ROOM.md is not an artifact". The same call on the artifact of the default layout returned skipped true in 3 of 3 repeats, with the reason "filePath not inside a room directory". The file that findTouchTarget returns for the harness room is the identity file ROOM.md.
P-b: the counted Write event on the artifact started 13 node processes in all 3 repeats and loaded 1042 to 1139 modules (the repeats differ in modules, so by R1 an exact claim on that count would read NOT RESOLVED; the gate compares the lowest value). The counted Write event on the identity file started 9 node processes and loaded 614 modules in all 3 repeats. The lowest artifact values (13 and 1042) are above the highest identity values (9 and 614). The default layout artifact started 8 node processes and loaded 565 modules. No run left a survivor process.

Table Q7-1 is for the harness layout unless the row says default layout.
Table Q7-2, Q7-2b, Q7-2c and Q7-3 are for the harness layout, except the targets and the pair that say default layout.
Table Q7-4 and Q7-5 show the harness layout (A and A2, and I) next to the default layout (D).

Table Q7-1: premise gates and counts (3 repeats, harness layout unless the row says default layout)

| Quantity | value | Basis |
| --- | --- | --- |
| P-a cascade call on the artifact: skipped true in 0 of 3 repeats (claim 0), reason none | true | DIRECT |
| P-a cascade call on the identity file: skipped true in 3 of 3 repeats (claim all), reason ROOM.md is not an artifact | true | DIRECT |
| cascade call on the artifact, default layout (information): skipped true in 3 of 3 repeats (claim all), reason filePath not inside a room directory | true | DIRECT |
| cascade call on the second artifact used by the changed target (information): skipped true in 0 of 3 repeats (claim 0), reason none | true | DIRECT |
| the file that findTouchTarget returns for the harness room is the identity file ROOM.md | true | DIRECT |
| P-b Write event, artifact, harness layout: node starts, modules, survivors left, repeats agree | 13 starts, 1042 to 1139 modules, 0 survivors, false | DIRECT |
| P-b Write event, changed artifact, harness layout: node starts, modules, survivors left, repeats agree | 13 starts, 1042 to 1139 modules, 0 survivors, false | DIRECT |
| P-b Write event, identity file, harness layout: node starts, modules, survivors left, repeats agree | 9 starts, 614 modules, 0 survivors, true | DIRECT |
| P-b Write event, artifact, default layout: node starts, modules, survivors left, repeats agree | 8 starts, 565 modules, 0 survivors, true | DIRECT |
| path of the file, artifact, harness layout: holds /room/ and holds /rooms/ | false and true | DIRECT |
| path of the file, artifact, default layout: holds /room/ and holds /rooms/ | false and false | DIRECT |
| premise failed (flag in the counts file) | false | DIRECT |
| premise gate by R3 (P-a and P-b) | PASSED | DERIVED |

Table Q7-2: every target (n per set, wall median, p95, two sets, spread)

| Target | n per set | set 1 median ms | set 1 p95 ms | set 2 median ms | set 2 p95 ms | spread percent | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| q7:write:rooms:artifact | 15 and 15 | 3526.835 | 3901.828 | 3579.882 | 3943.576 | 1.5 | DIRECT |
| q7:write:rooms:artifact-changed | 15 and 15 | 3570.83 | 4013.596 | 3571.821 | 3938.045 | 0 | DIRECT |
| q7:write:rooms:identity | 15 and 15 | 812.059 | 924.04 | 202.775 | 989.104 | 120.1 | DIRECT |
| q7:write:default:artifact | 15 and 15 | 209.975 | 832.682 | 414.858 | 912.817 | 65.6 | DIRECT |
| q7:d:artifact-minus-identity | 15 and 15 | 2980.878 | 3347.771 | 3353.597 | 3476.862 | 11.8 | DERIVED |
| q7:d:changed-minus-identity | 15 and 15 | 3173.015 | 3533.529 | 3357.751 | 3745.701 | 5.7 | DERIVED |
| q7:d:changed-minus-artifact | 15 and 15 | 43.995 | 438.552 | -48.139 | 408.703 | 4446.6 | DERIVED |
| q7:d:rooms-minus-default | 15 and 15 | 3314.132 | 3680.465 | 3131.083 | 3489.945 | 5.7 | DERIVED |

Spread above 10 percent is kept and shown: the identity file target (120.1), the default layout target (65.6), the difference of artifact and identity (11.8) and the difference of changed and unchanged artifact (4446.6; the two set medians of a difference near 0 have a mean near 0, so this percent has no meaning on its own). The per-round walls of the identity and default layout targets are on file (rounds_ms in the result files). They have two groups of rounds: many rounds near 200 ms and some rounds between 700 and 1050 ms. The median of each set sits in one group or the other, which is the cause of the spread. Why some rounds are in the higher group is not investigated here (UNVERIFIED); the per-hook medians in Table Q7-2c show the higher group in the scripts memory-artifact-graph-hook.cjs and auto-explore-fingerprint.cjs in set 1.

Table Q7-2b: summed hook CPU per Write target (ms)

| Target | n per set | set 1 median ms | set 1 p95 ms | set 2 median ms | set 2 p95 ms | spread percent | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| q7:write:rooms:artifact | 15 and 15 | 5000 | 5080 | 5030 | 5100 | 0.6 | DIRECT |
| q7:write:rooms:artifact-changed | 15 and 15 | 5060 | 5160 | 5040 | 5160 | 0.4 | DIRECT |
| q7:write:rooms:identity | 15 and 15 | 460 | 490 | 430 | 480 | 6.7 | DIRECT |
| q7:write:default:artifact | 15 and 15 | 390 | 420 | 390 | 440 | 0 | DIRECT |

Table Q7-2c: per hook medians of the artifact target and the identity target (set 1, wall ms and CPU ms of each hook)

| Target | hook id | wall median ms | CPU median ms | Basis |
| --- | --- | --- | --- | --- |
| q7:write:rooms:artifact | hooks/run-hook.cmd post-write | 3526.835 | 4750 | DIRECT |
| q7:write:rooms:artifact | scripts/frontmatter-schema-validator.cjs | 38.004 | 10 | DIRECT |
| q7:write:rooms:artifact | scripts/async-artifact-auto-commit.cjs | 56.431 | 20 | DIRECT |
| q7:write:rooms:artifact | scripts/memory-completion-detector.cjs | 46.683 | 10 | DIRECT |
| q7:write:rooms:artifact | scripts/auto-explore-fingerprint.cjs | 171.307 | 80 | DIRECT |
| q7:write:rooms:artifact | scripts/gsd-artifact-graph-hook.cjs | 48.748 | 10 | DIRECT |
| q7:write:rooms:artifact | scripts/memory-artifact-graph-hook.cjs | 140.071 | 90 | DIRECT |
| q7:write:rooms:artifact | scripts/operator-update.cjs | 57.708 | 20 | DIRECT |
| q7:write:rooms:identity | hooks/run-hook.cmd post-write | 205.191 | 170 | DIRECT |
| q7:write:rooms:identity | scripts/frontmatter-schema-validator.cjs | 74.265 | 30 | DIRECT |
| q7:write:rooms:identity | scripts/async-artifact-auto-commit.cjs | 65.986 | 20 | DIRECT |
| q7:write:rooms:identity | scripts/memory-completion-detector.cjs | 58.272 | 10 | DIRECT |
| q7:write:rooms:identity | scripts/auto-explore-fingerprint.cjs | 388.494 | 80 | DIRECT |
| q7:write:rooms:identity | scripts/gsd-artifact-graph-hook.cjs | 46.805 | 10 | DIRECT |
| q7:write:rooms:identity | scripts/memory-artifact-graph-hook.cjs | 732.623 | 120 | DIRECT |
| q7:write:rooms:identity | scripts/operator-update.cjs | 65.394 | 20 | DIRECT |

The hook that carries the artifact cost is the post-write hook (wall median 3526.8 ms and CPU median 4750 ms of the 5000 ms of the event in set 1). The other seven hooks of the event run side by side with it.

Table Q7-3: pair readings by R2 (harness layout unless the row says default layout)

| Pair | d(1) ms | d(2) ms | noise ms | 2 x noise ms | reading | meets floor | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q7-a: artifact above identity file (harness layout) | 2980.878 | 3353.597 | 662.331 | 1324.662 | PASS | yes | DERIVED |
| Q7-b: changed artifact above identity file (harness layout) | 3173.015 | 3357.751 | 610.275 | 1220.55 | PASS | yes | DERIVED |
| Q7-c: changed artifact above unchanged artifact (no direction fixed, harness layout) | 43.995 | -48.139 | 54.038 | 108.076 | FAIL | no | DERIVED |
| Q7-d: artifact on the harness layout above artifact on the default layout | 3314.132 | 3131.083 | 257.93 | 515.86 | PASS | yes | DERIVED |

Table Q7-3b: summed hook CPU medians and the CPU difference of set medians (no rule)

| Quantity | set 1 ms | set 2 ms | Basis |
| --- | --- | --- | --- |
| CPU median, artifact, harness layout | 5000 | 5030 | DIRECT |
| CPU median, changed artifact, harness layout | 5060 | 5040 | DIRECT |
| CPU median, identity file, harness layout | 460 | 430 | DIRECT |
| CPU median, artifact, default layout | 390 | 390 | DIRECT |
| CPU difference of set medians, artifact minus identity file | 4540 | 4600 | DERIVED |
| CPU difference of set medians, artifact on the harness layout minus artifact on the default layout | 4610 | 4640 | DERIVED |

The CPU rows are differences of set medians, because the result files hold the per-round wall and not the per-round CPU. With the noise of R2 taken from the CPU set medians (artifact 5000 and 5030, identity 460 and 430, so noise 60 ms and 2 x noise 120 ms) both CPU differences of artifact above identity (4540 and 4600 ms) are above 2 x noise. This CPU reading is DERIVED from set medians and is not an R2 reading on per-round differences.

Table Q7-4: cost per session at W Writes (W is ASSUMED; cost per Write is the mean of the two set medians; noise is W x spread; meets floor is the OD-2 floor of 50 ms per Write)

| Target | W (ASSUMED) | wall per Write ms | wall per session ms | wall noise ms | wall meets floor | CPU per Write ms | CPU per session ms | CPU noise ms | CPU meets floor | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| q7:write:rooms:artifact | 1 | 3553.359 | 3553.359 | 53.3 | yes | 5015 | 5015 | 30.09 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:artifact | 5 | 3553.359 | 17766.793 | 266.502 | yes | 5015 | 25075 | 150.45 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:artifact | 20 | 3553.359 | 71067.17 | 1066.008 | yes | 5015 | 100300 | 601.8 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:artifact-changed | 1 | 3571.326 | 3571.326 | 0 | yes | 5050 | 5050 | 20.2 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:artifact-changed | 5 | 3571.326 | 17856.628 | 0 | yes | 5050 | 25250 | 101 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:artifact-changed | 20 | 3571.326 | 71426.51 | 0 | yes | 5050 | 101000 | 404 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:identity | 1 | 507.417 | 507.417 | 609.408 | yes | 445 | 445 | 29.815 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:identity | 5 | 507.417 | 2537.085 | 3047.039 | yes | 445 | 2225 | 149.075 | yes | DERIVED (W ASSUMED) |
| q7:write:rooms:identity | 20 | 507.417 | 10148.34 | 12188.156 | yes | 445 | 8900 | 596.3 | yes | DERIVED (W ASSUMED) |
| q7:write:default:artifact | 1 | 312.417 | 312.417 | 204.945 | yes | 390 | 390 | 0 | yes | DERIVED (W ASSUMED) |
| q7:write:default:artifact | 5 | 312.417 | 1562.083 | 1024.726 | yes | 390 | 1950 | 0 | yes | DERIVED (W ASSUMED) |
| q7:write:default:artifact | 20 | 312.417 | 6248.33 | 4098.904 | yes | 390 | 7800 | 0 | yes | DERIVED (W ASSUMED) |

The cost per Write with the cascade running (target A, harness layout) is 3553.4 ms of wall and 5015 ms of summed hook CPU. Both are above the 50 ms floor of OD-2. The identity file and the default layout also read above the floor on both measures, with a noise of 205 to 609 ms per Write on wall (the two groups of rounds described under Table Q7-2). The cost per Write for the identity file in this plan (mean of the set medians 507.4 ms) has a spread of 120.1 percent, so the single number is a weak summary; the per-round walls are on file.

Table Q7-5: S2 sum of the four events per session (R4; carried CPU per event is Stop 1500 ms x 30, UserPromptSubmit 240 ms x 30, Read 40 ms x 60, ASSUMED events, not re-measured here)

| Layout | W (ASSUMED) | carried CPU ms | Write CPU per Write ms | Write term ms | S2 sum ms | Write term noise ms | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| harness layout, artifact (A) | 1 | 54600 | 5015 | 5015 | 59615 | 30.09 | DERIVED (W ASSUMED) |
| harness layout, artifact (A) | 5 | 54600 | 5015 | 25075 | 79675 | 150.45 | DERIVED (W ASSUMED) |
| harness layout, artifact (A) | 20 | 54600 | 5015 | 100300 | 154900 | 601.8 | DERIVED (W ASSUMED) |
| default layout, artifact (D) | 1 | 54600 | 390 | 390 | 54990 | 0 | DERIVED (W ASSUMED) |
| default layout, artifact (D) | 5 | 54600 | 390 | 1950 | 56550 | 0 | DERIVED (W ASSUMED) |
| default layout, artifact (D) | 20 | 54600 | 390 | 7800 | 62400 | 0 | DERIVED (W ASSUMED) |
| S2 row of 384-RANKING.md (fixture, Write CPU 425 ms, W = 20) | 20 | 54600 | 425 | 8500 | 63100 | not carried | DIRECT (copied from 384-RANKING.md) |

At W = 20 the Write term with the cascade running is 100300 ms and the Write term of the S2 row of 384-RANKING.md is 8500 ms (ratio 11.8, DERIVED). The S2 sum at W = 20 is 154900 ms on the harness layout and 62400 ms on the default layout. The default layout sum is close to the 63100 ms of the S2 row, which is the expected result for a Write on which the cascade did not run.

Table Q7-6: Write rows of plans 384-04 and 384-05 by name and class (R5: reading of artifact above identity is PASS; identity file is ROOM.md: true; identity cascade skipped: true)

| Row | file | plan | value on file | file records the touched file | independent of the Write file | class | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PostToolUse:Write | census-fixture.json | 04 | exec median 36 | no | false | LOWER BOUND | DIRECT |
| script post-write (in SubagentStop:files5) | census-fixture.json | 04 | count 39 | no | true | NOT A LOWER BOUND | DIRECT |
| script post-write (in SubagentStop:files20) | census-fixture.json | 04 | count 129 | no | true | NOT A LOWER BOUND | DIRECT |
| event:PostToolUse:Write | census-spread.json | 04 | set medians 200 and 210 ms | no | false | LOWER BOUND | DIRECT |
| event:PostToolUse:Write | census-walls-fixture-s1-rerun.json | 04 | median wall 200 ms, n 15 | no | false | LOWER BOUND | DIRECT |
| hooks/run-hook.cmd post-write (in event:PostToolUse:Write) | census-walls-fixture-s1-rerun.json | 04 | wall 198.9 ms | no | false | LOWER BOUND | DIRECT |
| event:PostToolUse:Write | census-walls-fixture-s1.json | 04 | median wall 898.5 ms, n 7 | no | false | LOWER BOUND | DIRECT |
| hooks/run-hook.cmd post-write (in event:PostToolUse:Write) | census-walls-fixture-s1.json | 04 | wall 194.1 ms | no | false | LOWER BOUND | DIRECT |
| event:PostToolUse:Write | census-walls-fixture-s2-rerun.json | 04 | median wall 210 ms, n 15 | no | false | LOWER BOUND | DIRECT |
| hooks/run-hook.cmd post-write (in event:PostToolUse:Write) | census-walls-fixture-s2-rerun.json | 04 | wall 203.2 ms | no | false | LOWER BOUND | DIRECT |
| event:PostToolUse:Write | census-walls-fixture-s2.json | 04 | median wall 400.5 ms, n 7 | no | false | LOWER BOUND | DIRECT |
| hooks/run-hook.cmd post-write (in event:PostToolUse:Write) | census-walls-fixture-s2.json | 04 | wall 199.4 ms | no | false | LOWER BOUND | DIRECT |
| script:ledger:n100:find-first (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 0.4 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n100:find-warm (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 0.1 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n100:read-first (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 0.4 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n1000:find-first (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 1.7 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n1000:find-warm (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 1.2 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n1000:read-first (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 2.9 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n10000:find-first (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 17.3 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n10000:find-warm (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 13 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n10000:read-first (in S6 ledger) | s6-ledger-set2.json | 05 | median wall 24.6 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n100:find-first (in S6 ledger) | s6-ledger.json | 05 | median wall 0.4 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n100:find-warm (in S6 ledger) | s6-ledger.json | 05 | median wall 0.1 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n100:read-first (in S6 ledger) | s6-ledger.json | 05 | median wall 0.4 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n1000:find-first (in S6 ledger) | s6-ledger.json | 05 | median wall 1.7 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n1000:find-warm (in S6 ledger) | s6-ledger.json | 05 | median wall 1.3 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n1000:read-first (in S6 ledger) | s6-ledger.json | 05 | median wall 2.8 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n10000:find-first (in S6 ledger) | s6-ledger.json | 05 | median wall 17.6 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n10000:find-warm (in S6 ledger) | s6-ledger.json | 05 | median wall 13.2 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script:ledger:n10000:read-first (in S6 ledger) | s6-ledger.json | 05 | median wall 22.5 ms, n 7 | no | true | NOT A LOWER BOUND | DIRECT |
| script state-write.cjs | s9-stop-reads.json | 05 | listed | no | true | NOT A LOWER BOUND | DIRECT |
| script post-write (in event:SubagentStop:files20) | subagent-files-copy-local.json | 04 | count 107 | no | true | NOT A LOWER BOUND | DIRECT |
| script post-write (in event:SubagentStop:files20) | subagent-files.json | 04 | count 111 | no | true | NOT A LOWER BOUND | DIRECT |
| PostToolUse:Write (table row) (in census table) | census-table.md | 04 | 8 (8, 0, 0) ; 36 (36-44) | no | false | LOWER BOUND | DIRECT |
| PostToolUse:Write (table row) (in census table) | census-table.md | 04 | 200.0 / 210.0 ; 447.6 / 443.9 | no | false | LOWER BOUND | DIRECT |
| Felt path row PostToolUse:Write of 384-RANKING.md (stands on the plan 384-04 Write row) | 384-RANKING.md | 04 | set medians 200.0 and 210.0 ms | no | false | LOWER BOUND | DIRECT |
| S2 Write CPU of 384-RANKING.md (stands on the plan 384-04 Write row) | 384-RANKING.md | 04 | 425 ms CPU per Write | no | false | LOWER BOUND | DIRECT |

Plan 384-05 holds no row named Write or post-write that depends on a Write payload. Its S6 ledger rows (script:ledger) are listed above as the rows that the PRD ties to each Write or Edit; they use a synthetic ledger, so independent is true and the class is NOT A LOWER BOUND. The row of plan 384-05 that holds the text write in its name (the script state-write.cjs in the Stop event) is independent of a Write payload as well.
The result files of plan 384-04 do not record the touched file (touch_applied is null or absent), so a LOWER BOUND class rests on the code path and on the count of this plan. The plan 384-08 copy Write row is not classed (see the Not measured section).

Table Q7-7: reproduction against plan 384-10 (ratio of the target to its t04 median, per set) and against the plan 384-04 Write row (no rule)

| Quantity | set 1 | set 2 | Basis |
| --- | --- | --- | --- |
| plan 384-10 t04:write:rooms median ms (harness layout, artifact) | 3249.939 | 3231.002 | DIRECT |
| this plan, artifact on the harness layout (A) median ms | 3526.835 | 3579.882 | DIRECT |
| ratio of A to plan 384-10 t04:write:rooms | 1.085 | 1.108 | DERIVED |
| plan 384-10 t04:write:default median ms (default layout, artifact) | 197.793 | 214.106 | DIRECT |
| this plan, artifact on the default layout (D) median ms | 209.975 | 414.858 | DIRECT |
| ratio of D to plan 384-10 t04:write:default | 1.062 | 1.938 | DERIVED |
| plan 384-04 Write row median ms (n of 15 per set) | 200 | 210 | DIRECT |
| this plan, identity file (I) median ms | 812.059 | 202.775 | DIRECT |
| ratio of I to the plan 384-04 Write row of the same set | 4.06 | 0.966 | DERIVED |

The artifact on the harness layout reproduces plan 384-10 (ratio 1.085 and 1.108). The default layout and the identity file reproduce the plan 384-04 and 384-10 values in the group of rounds near 200 ms and read higher where the set median sits in the group of rounds between 700 and 1050 ms (D set 2: ratio 1.938; I set 1: ratio 4.06). This is the spread shown under Table Q7-2.

Readings.
Premise gate (R3): PASSED (P-a 3 of 3 on both files, P-b 13 against 9 node starts and 1042 against 614 modules).
Q7-a PASS (R2): the Write event on the artifact is 2980.9 and 3353.6 ms above the Write event on the identity file ROOM.md; 2 x noise is 1324.7 ms. The node starts (13 against 9) and the modules (1042 to 1139 against 614) are above as well, and the summed hook CPU is 4540 and 4600 ms above (DERIVED from set medians).
Q7-b PASS (R2): the changed artifact is 3173.0 and 3357.8 ms above the identity file; 2 x noise is 1220.6 ms.
Q7-c FAIL (R2): the changed artifact is 44.0 and -48.1 ms from the unchanged artifact, inside 2 x noise (108.1 ms). Appending one line to the file before the event adds no cost that this bench can tell from noise. The CPU medians (5000 and 5030 ms against 5060 and 5040 ms) agree.
Q7-d PASS (R2): the artifact on the harness layout is 3314.1 and 3131.1 ms above the artifact on the default layout; 2 x noise is 515.9 ms. The cascade call is skipped on the default layout (3 of 3 repeats).
H-Q7 as a whole is read in the Reading summary.

Observation, not fixed here:
1. The cascade runs only for a path that holds /room/ or /rooms/ (isRoomFile of lib/core/intelligence-cascade.cjs). A default-layout path holds neither, so a Write on that layout costs the skipped path (target D, skipped true in 3 of 3 repeats). The cascade call on a path of the default layout is therefore skipped for every artifact. The local real-room copy has a work folder that ends in /room/ (a string test only, not read here), so a Write there runs the cascade.
2. The harness touch target of plans 384-04 and 384-05 was the identity file ROOM.md (findTouchTarget returned it in this plan; the cascade call on it was skipped true in 3 of 3 repeats). The Write rows of plan 384-04 and the numbers of 384-RANKING.md that stand on them are lower bounds for a Write that runs the cascade (Table Q7-6, class LOWER BOUND, with the caveat that the files of plan 384-04 do not record the touched file).
3. A Write on an artifact of the harness layout costs a median of 3.5 s of wall, with a p95 of 3.9 to 4.0 s, in this bench. The entry of the post-write hook in hooks/hooks.json has the timeout value 5 (the harness adds 1 s of grace and treats the value as seconds; the unit is not re-read here, UNVERIFIED). In a self-test run of this bench on a loaded host (load1 about 2.8, with the live checkout) 2 of 8 runs of the changed-artifact target ran into that harness timeout; that file was not kept. The two committed timing sets have no timed-out run (timed_out 0 for all targets).
4. Everything in this section is for fixture rooms of the harness layout and the default layout. Whether a user room path holds /room/ or /rooms/ is not read here (Canon Part 8).
