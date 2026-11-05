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
