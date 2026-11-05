# Phase 384 plan 10: costs of T02 to T05 (operator-update, lazy require, cascade skip, HMI poll)

Tree: a pinned export of BASE_SHA_384 (db2ea3b05bb70b55741bdeb40b545801b0c37cbe), with node_modules linked from the repo.
Room kind: fixture room only (no real room, no real registry, no real ledger, no real home folder).
Host rules: CPU cap 4 cores (taskset), load1 below 2 at the start of every block, shared lock held, interleaved order, n = 15 per set by default (minimum 7), two sets, median and p95 (sorted sample at index floor(0.95 x (n - 1))), spread in percent.
Counting runs are separate from timing runs and have 3 repeats.

This file is written in order. The rules and the hypotheses are committed before the first result file of each task. A table is added only after its numbers exist.

## Rules

Fixed before any number was taken.

R1 Counts are exact. An exact claim (a skipped flag, a stated number of modules, node starts or keys) passes when the DIRECT count equals the claim in all 3 repeats. A threshold claim (a stated bound such as above 0) passes when every repeat meets the bound. Repeats that differ on an exact claim are shown as min to max and read NOT RESOLVED. A DIRECT count that differs from the claim reads FAIL; it is a result and not an error.

R2 Difference of two timings. For a pair (X, Y), where the hypothesis says X is above Y, take per round the difference of the two walls in the same round, and for each set k the median d(k) of these differences (DERIVED). Take noise = |mX1 - mX2| + |mY1 - mY2|, where mXk and mYk are the set medians (this is the noise rule of plan 384-09: spread percent / 100 x the mean of the set medians, summed over the two parts). PASS when d(1) and d(2) are both above 2 x noise. FAIL when both are 2 x noise or below (a difference of 0 or less is FAIL). NOT RESOLVED when one set passes and the other does not.

R3 Before and after (T03). The DIRECT module count of the process in tree B must be lower than in tree A, equal in all repeats. A count that is equal or higher reads FAIL, whatever the time shows. With a lower count, the reading is R2 with X = A and Y = B.

R4 Share (T05). PASS when R2 reads PASS for the hook above doctor alone and the median of doctor alone divided by the median of the hook is above 0.5 in both sets (DERIVED); FAIL when R2 reads FAIL or a share is 0.5 or below; NOT RESOLVED otherwise.

R5 Premise gates. T03 stops with NOT MEASURED when the two trees differ in the equivalence check. T04 stops with PREMISE FAILED when skipped is not true on the default layout. T05 stops with PREMISE FAILED when the poll status word is not ok. A stop writes `premise_failed: true` and the observed words into the counts file and the md section, skips the timing steps of that task, and the plan goes on with the next task and ends with STATUS PARTIAL.

R6 meets floor. Every reading row has the cell `meets floor` with the value `pending Q5b` (the smallest difference that matters to a person is an owner question). No reading here marks an S finding confirmed or refuted. Basis is the last column of every table in this file, header included (the header cell is the word Basis; a data cell starts with DIRECT, DERIVED or NOT MEASURED).

Basis legend. DIRECT: a number the bench measured or counted. DERIVED: a difference, ratio or sum of measured numbers. NOT MEASURED: a number the bench does not have; the reason is written next to it.

## T02

Operator-update cost per call against the bare node floor.

Hypothesis H-T02. A call of scripts/operator-update.cjs costs more than the bare node start on UserPromptSubmit, Stop and PostToolUse, because it loads lib/conversation/operator.cjs and classifier.cjs before it reads stdin. With the registry shape that the product writes (key active a string, rooms an object), the check at line 106 returns early and the script does no state work. A fixture registry with active_room (a string) and rooms (an array) passes the check and the script then reads the room state.

Reading rules.
T02-a is R2 with X = the call on the product-shape registry and Y = the bare floor, for each of the three events.
T02-b is R2 with X = the call on the guard-passing registry and Y = the call on the product-shape registry, for each event (the work that the early return skips; DERIVED).
T02-c is R1 as a threshold claim on the path taken. The evidence is the sum of fs calls on the room .mindrian folder and sqlite constructions in one call at UserPromptSubmit. The claim is exactly 0 on the product-shape registry and above 0 on the guard-passing registry, in 3 of 3 repeats each. The first count run states the exact number.
The share of module load in the call (module-load median divided by the product-shape UserPromptSubmit median minus the floor median) is reported as DERIVED with no rule.

Results. Two timing sets (n = 15 each), one counts file (3 repeats), fixture room, pinned export. load1 was 0.34 to 0.48 at the start and end of the three result files.

Readings.
T02-a reads PASS at all three events. The call on the product-shape registry is 6.5 to 8.0 ms above the bare node start in each set (floor median 22.8 and 23.4 ms at UserPromptSubmit; call medians 30.1 to 30.8 ms).
T02-b reads FAIL at all three events. The difference between the guard-passing call and the product-shape call is between minus 0.9 and 1.1 ms in the two sets, inside 2 x noise.
T02-c reads PASS. The sums at UserPromptSubmit are 0 0 0 on the product-shape registry and 1 1 1 on the guard-passing registry (one fs call on the room .mindrian folder, no sqlite construction).
The module-load share is 0.985 (set 1): the two requires take about the whole difference between the product-shape call and the bare node start.
Every reading is a result for plan 384-09 to read with its own rule. None of them marks an S finding confirmed or refuted.


Table T02-1: every target (n per set, median, p95, two sets, spread)

| Target | n per set | set 1 median ms | set 1 p95 ms | set 2 median ms | set 2 p95 ms | spread percent | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t02:floor-node | 15 and 15 | 22.784 | 24.374 | 23.389 | 26.865 | 2.6 | DIRECT |
| t02:floor-bash-node | 15 and 15 | 24.071 | 25.824 | 24.297 | 26.55 | 0.9 | DIRECT |
| t02:module-load | 15 and 15 | 7.807 | 8.609 | 7.362 | 8.591 | 5.9 | DIRECT |
| t02:ups:real-shape | 15 and 15 | 30.711 | 32.15 | 30.466 | 32.617 | 0.8 | DIRECT |
| t02:ups:guard-passing | 15 and 15 | 31.401 | 33.363 | 31.113 | 33.385 | 0.9 | DIRECT |
| t02:stop:real-shape | 15 and 15 | 30.47 | 33.755 | 30.833 | 33.325 | 1.2 | DIRECT |
| t02:stop:guard-passing | 15 and 15 | 30.109 | 32.441 | 30.825 | 32.681 | 2.4 | DIRECT |
| t02:post-read:real-shape | 15 and 15 | 29.754 | 31.813 | 30.588 | 33.781 | 2.8 | DIRECT |
| t02:post-read:guard-passing | 15 and 15 | 30.883 | 32.582 | 30.795 | 34.369 | 0.3 | DIRECT |
| t02:d:real-minus-floor:ups | 15 and 15 | 7.975 | 10.43 | 6.543 | 10.25 | 19.7 | DERIVED |
| t02:d:real-minus-floor:stop | 15 and 15 | 7.193 | 11.396 | 8.049 | 11.669 | 11.2 | DERIVED |
| t02:d:real-minus-floor:post-read | 15 and 15 | 6.953 | 9.207 | 7.96 | 9.875 | 13.5 | DERIVED |
| t02:d:guard-minus-real:ups | 15 and 15 | 0.48 | 3.189 | 0.268 | 2.887 | 56.7 | DERIVED |
| t02:d:guard-minus-real:stop | 15 and 15 | -0.584 | 2.337 | -0.9 | 1.646 | 42.6 | DERIVED |
| t02:d:guard-minus-real:post-read | 15 and 15 | 1.127 | 3.503 | -0.443 | 3.781 | 459.1 | DERIVED |

Table T02-2: pair readings by R2

| Pair | d(1) ms | d(2) ms | noise ms | 2 x noise ms | reading | meets floor | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T02-a ups: product-shape call above floor | 7.975 | 6.543 | 0.85 | 1.7 | PASS | pending Q5b | DERIVED |
| T02-a stop: product-shape call above floor | 7.193 | 8.049 | 0.968 | 1.936 | PASS | pending Q5b | DERIVED |
| T02-a post-read: product-shape call above floor | 6.953 | 7.96 | 1.439 | 2.878 | PASS | pending Q5b | DERIVED |
| T02-b ups: guard-passing call above product-shape call | 0.48 | 0.268 | 0.533 | 1.066 | FAIL | pending Q5b | DERIVED |
| T02-b stop: guard-passing call above product-shape call | -0.584 | -0.9 | 1.079 | 2.158 | FAIL | pending Q5b | DERIVED |
| T02-b post-read: guard-passing call above product-shape call | 1.127 | -0.443 | 0.922 | 1.844 | FAIL | pending Q5b | DERIVED |

Table T02-2b: share of module load in the call (set 1, no rule)

| Quantity | value | Basis |
| --- | --- | --- |
| module-load median divided by (product-shape ups median minus floor median) | 0.985 | DERIVED |

Table T02-3a: registry shapes (booleans)

| Registry | has_active_room_key | active_is_string | rooms_is_array | Basis |
| --- | --- | --- | --- | --- |
| written by the product | false | true | false | DIRECT |
| guard-passing | true | true | true | DIRECT |

Table T02-3b: path taken, modules and node starts per call (3 repeats each)

| Event | Registry | fs calls on .mindrian | fs calls on the room folder | sqlite constructed | modules | node starts | repeats agree | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ups | product shape | 0 0 0 | 0 0 0 | 0 0 0 | 3 3 3 | 1 1 1 | true | DIRECT |
| ups | guard-passing | 1 1 1 | 1 1 1 | 0 0 0 | 3 3 3 | 1 1 1 | true | DIRECT |
| stop | product shape | 0 0 0 | 0 0 0 | 0 0 0 | 3 3 3 | 1 1 1 | true | DIRECT |
| stop | guard-passing | 0 0 0 | 1 1 1 | 0 0 0 | 3 3 3 | 1 1 1 | true | DIRECT |
| post-read | product shape | 0 0 0 | 0 0 0 | 0 0 0 | 3 3 3 | 1 1 1 | true | DIRECT |
| post-read | guard-passing | 1 1 1 | 1 1 1 | 0 0 0 | 3 3 3 | 1 1 1 | true | DIRECT |

Table T02-3c: T02-c reading by R1 (threshold claim at UserPromptSubmit)

| Claim | product-shape sums (3 repeats) | guard-passing sums (3 repeats) | reading | meets floor | Basis |
| --- | --- | --- | --- | --- | --- |
| product shape is exactly 0, guard-passing is above 0 | 0 0 0 | 1 1 1 | PASS | pending Q5b | DIRECT |

Observation, not fixed here: the check at scripts/operator-update.cjs line 106 needs rooms to be an array, and the registry that the product writes holds rooms as an object (table T02-3a: rooms_is_array false, has_active_room_key false). On that registry the script returns at once at all three events and reads no room state (table T02-3c). Whether that early return is intended is not read here.
