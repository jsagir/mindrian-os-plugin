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

## T03

Lazy require of the timeline runner in folder-memory (before and after, scratch copy only).

Hypothesis H-T03. The require at lib/core/folder-memory.cjs line 268 (and its async twin at lib/core/folder-memory-async.cjs line 220) loads timeline-runner.cjs, timeline-renderer.cjs and navigation.cjs with their dependencies whenever folder-memory is loaded, but the file uses the runner only inside extractFeynmanBody and its async twin. If the require is made lazy, three frequent processes load fewer modules and take less time: the statusline process (scripts/context-monitor, line 21), the node -e snapshot of the on-stop hook (line 414) and the Brain drain hook on an empty queue (line 176). The drain also loads navigation.cjs itself after folder-memory, so the module count of the drain may not change.

Reading rule. R3 for each of the four pairs (statusline, on-stop, drain, cold load of folder-memory.cjs), with the DIRECT module counts as the gate. The edit is made only in a scratch copy of the pinned export (tree B); tree A is the untouched pinned export. The edit is a measurement tool and is not a proposal. The two trees must return equal results in the equivalence check (R5) before any other T03 step.

Results. One counts file (3 repeats, all agree), two timing sets (n = 15 each) in one shared fixture room with two contexts: tree A is the pinned export and tree B is a scratch copy with the one-line lazy edit in each of the two files. The edit is a measurement tool and is not a proposal. The two repo files have no change from this plan.

Equivalence gate (R5): passed. 14 sections, 0 mismatches for the sync readQuintuple, 0 for the async one, and 12 sections used the lazy path (FEYNMAN body not empty).

Readings (R3).
Statusline reads PASS: modules 182 in tree A and 18 in tree B in all 3 repeats; d(1) 40.6 and d(2) 39.0 ms against 2 x noise 1.6 ms.
Cold load of folder-memory reads PASS: modules 167 and 3; d(1) 48.2 and d(2) 49.1 ms against 2 x noise 1.8 ms.
On-stop reads FAIL: the module total is lower (521 and 380, node starts 27 in both trees), but d(1) 5.7 and d(2) 8.6 ms are inside 2 x noise 69.0 ms. The whole hook takes about 1.08 s and its per-round wall varies widely (p95 above 1.1 s in set 1 and above 1.4 s in set 2). The snapshot step (node -e) loads 293 modules in both trees; the lower total comes from feynman-minto-guardian.cjs (183 modules in tree A and 42 in tree B).
Drain on an empty queue reads FAIL: modules 169 and 167 (lower by 2), d(1) minus 2.5 and d(2) minus 1.9 ms against 2 x noise 8.8 ms. The drain loads navigation.cjs itself after folder-memory, as the hypothesis said.
For the load target the label in the count log is the module base name (folder-memory.cjs); for node -e processes the label is eval. The queue file of the drain was absent.

Table T03-1: edit summary and equivalence check (scratch copy, tree B)

| Quantity | value | Basis |
| --- | --- | --- |
| files changed in tree B | 2 | DIRECT |
| lines changed in folder-memory | 1 | DIRECT |
| lines changed in folder-memory-async | 1 | DIRECT |
| sections compared | 14 | DIRECT |
| mismatches, sync readQuintuple | 0 | DIRECT |
| mismatches, async readQuintuple | 0 | DIRECT |
| sections where the lazy path was used (FEYNMAN body not empty) | 12 | DIRECT |
| statusline stdout bytes, tree A and tree B | 116 and 116 | DIRECT |

Table T03-2: DIRECT module counts and node starts per process and tree (3 repeats)

| Target | Tree | node starts | modules total | modules by script (first repeat) | Basis |
| --- | --- | --- | --- | --- | --- |
| statusline | A (pinned export) | 1 1 1 | 182 182 182 | context-monitor:182 | DIRECT |
| statusline | B (lazy edit) | 1 1 1 | 18 18 18 | context-monitor:18 | DIRECT |
| onstop | A (pinned export) | 27 27 27 | 521 521 521 | eval:293, feynman-minto-guardian.cjs:183, memory-lifecycle.cjs:15, recompile-room-references.cjs:28, user-archetype.cjs:2 | DIRECT |
| onstop | B (lazy edit) | 27 27 27 | 380 380 380 | eval:293, feynman-minto-guardian.cjs:42, memory-lifecycle.cjs:15, recompile-room-references.cjs:28, user-archetype.cjs:2 | DIRECT |
| drain | A (pinned export) | 1 1 1 | 169 169 169 | brain-derivation-drain.cjs:169 | DIRECT |
| drain | B (lazy edit) | 1 1 1 | 167 167 167 | brain-derivation-drain.cjs:167 | DIRECT |
| load | A (pinned export) | 1 1 1 | 167 167 167 | folder-memory.cjs:167 | DIRECT |
| load | B (lazy edit) | 1 1 1 | 3 3 3 | folder-memory.cjs:3 | DIRECT |
| repeats agree |  |  |  | true | DIRECT |

Table T03-3: every target (n per set, median, p95, two sets, spread)

| Target | n per set | set 1 median ms | set 1 p95 ms | set 2 median ms | set 2 p95 ms | spread percent | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t03:statusline:a | 15 and 15 | 84.442 | 90.119 | 84.287 | 103.777 | 0.2 | DIRECT |
| t03:statusline:b | 15 and 15 | 44.832 | 47.372 | 45.459 | 52.91 | 1.4 | DIRECT |
| t03:onstop:a | 15 and 15 | 1079.453 | 1158.46 | 1093.264 | 1419.676 | 1.3 | DIRECT |
| t03:onstop:b | 15 and 15 | 1063.419 | 1146.685 | 1084.102 | 1616.37 | 1.9 | DIRECT |
| t03:drain:a | 15 and 15 | 75.377 | 133.914 | 75.745 | 123.364 | 0.5 | DIRECT |
| t03:drain:b | 15 and 15 | 79.698 | 131.554 | 83.747 | 116.003 | 5 | DIRECT |
| t03:load:a | 15 and 15 | 49.508 | 53.096 | 50.351 | 58.613 | 1.7 | DIRECT |
| t03:load:b | 15 and 15 | 1.316 | 2.186 | 1.392 | 2.891 | 5.6 | DIRECT |
| t03:d:statusline | 15 and 15 | 40.558 | 44.925 | 39.005 | 59.272 | 3.9 | DERIVED |
| t03:d:onstop | 15 and 15 | 5.68 | 102.777 | 8.623 | 85.26 | 41.2 | DERIVED |
| t03:d:drain | 15 and 15 | -2.536 | 61.118 | -1.937 | 48.96 | 26.8 | DERIVED |
| t03:d:load | 15 and 15 | 48.184 | 51.894 | 49.123 | 57.4 | 1.9 | DERIVED |

Table T03-4: pair readings by R3 (the count gate first, then R2)

| Pair | modules A | modules B | d(1) ms | d(2) ms | noise ms | 2 x noise ms | count gate | reading | meets floor | Basis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T03 statusline: tree A above tree B | 182 | 18 | 40.558 | 39.005 | 0.782 | 1.564 | lower in all repeats | PASS | pending Q5b | DERIVED |
| T03 onstop: tree A above tree B | 521 | 380 | 5.68 | 8.623 | 34.494 | 68.988 | lower in all repeats | FAIL | pending Q5b | DERIVED |
| T03 drain: tree A above tree B | 169 | 167 | -2.536 | -1.937 | 4.417 | 8.834 | lower in all repeats | FAIL | pending Q5b | DERIVED |
| T03 load: tree A above tree B | 167 | 3 | 48.184 | 49.123 | 0.919 | 1.838 | lower in all repeats | PASS | pending Q5b | DERIVED |

## T04

Cascade skip on a default-layout fixture room.

Hypothesis H-T04. On a default-layout room the path of every artifact holds neither /room/ nor /rooms/, so runCascade returns skipped true with the reason `filePath not inside a room directory` and does no cascade work. The post-write hook still starts one node process that loads intelligence-cascade.cjs and its requires to get that result. The harness fixture path holds /rooms/, so the cascade runs in the earlier fixture measurements of this phase, and the work folder of a real-room copy ends in /room/ (string test only here). The default layout is a rooms folder with the product default name under a sandbox home, with no /room/ and no /rooms/ segment.

Reading rules.
T04-a is R1: skipped is true in 3 of 3 repeats on the default layout, and false in 3 of 3 on the harness layout (control). A skipped value that is not true in 3 of 3 repeats on the default layout is the premise gate of R5 (PREMISE FAILED, and nothing is timed).
T04-b is R2 with X = the cascade CLI call on the default layout and Y = the bare floor (what a skipped call costs).
T04-c is R2 with X = the PostToolUse Write event on the harness layout and Y = the same event on the default layout (what the cascade adds to a write where it runs).
T04-d is R1-style counts with no pass or fail: node starts and modules loaded for the Write event and for SubagentStop with 5 files, on both layouts, shown side by side for plan 384-09. SubagentStop is counted only and is not timed here.
The real default-layout behaviour of a user room is not read here (Part 8).
