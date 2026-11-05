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
