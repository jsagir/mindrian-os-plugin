# 395-05 Summary: carried findings, committed without the gate change

Date: 2026-11-16. Branch `work/395-selection-by-job`. Base of this slice: `1538bbec3`.

## What changed

* `lib/mcp/tools/sensors.cjs`: new key `goal_job { state, id, offers, how_to }` in every `suggest_next` reply with a room. Before, the hint on how to set a goal job was sent in 0 of 15 replies of a born room.
* `lib/core/feyminto/brief.cjs`: a nest in a sub-room has one fingerprint for the generator, the stop walk and the reader (it follows the goal of the sub-room).
* `scripts/intent-classifier.cjs`: time guard: when the hook has used its 1,200 ms budget before the selector step, the selector is skipped; the block is still printed.
* New `tests/test-395-carried.cjs` (16 checks); `tests/run-all-395.sh` lists it.

## What was taken out, and why

Changes 3 to 5 of the plan (`lib/mcp/tools/gate.cjs`: keep a `strategy_goal` gate open after a dialog answer and accept only a relay of that answer) are NOT committed. The cold check proved a fault (Blocker B1): with the gate left open, the same session can call `gate_render` with `mirror_of` that gate, get a text card with no dialog, and answer the mirror with another choice. Run: the person picked `defer` in the dialog, then the mirror path gave `goal_written true`. That is weaker than the rule "only a human confirms".

The main session then made 3 edits by hand, as the cold check listed: `gate.cjs` restored from HEAD; check B1 removed from the new test; the sentence about a dialog answer in `GOAL_JOB_STEPS` replaced by a sentence that states the limit ("On a host that takes the answer in a dialog of its own, the gate closes with that answer, gate_answer replies unknown_gate and no job is set: say so to the person."), and the word list of check A3 changed to match. The replaced sentence was written by the main session, not by a planner, and only the word `unknown_gate` is pinned by a check.

## What ran

* After the take-out: `node tests/test-395-carried.cjs`: 16 of 16. `bash tests/run-all-395.sh`: 5 files PASSED.
* Before the take-out (executor): suites 345 and 289 same failing sets before and after; suite 3696 same FAILED lines; suite 36925 same plus the load-dependent brief-wiring arm.
* Cold check (`docs/designs/selection-path/runs/395-05/cold-check.md`): 24 mutations, each check can fail; hook stdout byte-identical in 24 of 24 pairs; brief-wiring, 5 alternating runs each: untouched 3 of 5 failed, changed 2 of 5 failed, median wall 46.5 s against 46.4 s; no effect of the change.

## What did not run

* The full suites after the take-out (the take-out restores one file to HEAD and removes text).
* Any live host. Fake hosts only.

## Carried

* F2 stays open: on a host that answers a gate in its own dialog, no goal can be set. A fix needs a plan with a guard on the mirror path and an owner decision.
* MA1 (older than this work, on HEAD too): a dialog that the person closed can be mirrored in the same session and the goal written through the mirror. This is a fault in shipped code. Report to the owner.
* MA2 (older than this work): a research run in the root room that names the same section name makes the 2 brief writers rewrite a sub-room brief on each call.
* MA3: send the full `how_to` steps only for state `not_set` (reply grows by 1,649 bytes with no goal, 1,552 with a goal).
* Owner decision A7: a root goal no longer ranks a sub-room nest.
