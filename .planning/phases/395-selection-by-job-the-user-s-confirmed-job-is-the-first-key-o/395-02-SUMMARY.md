# 395-02 Summary: the job is shown truthfully and can be set

Date: 2026-11-15. Branch `work/395-selection-by-job`. Base of this slice: `bafdb5d4e`.

## What changed

* `lib/core/strategy/goal-gate.cjs`: the old problem type is kept only when it is one of the four ids (M4); a new goal job from option `rewrite-jtbd` must be in the job vocabulary, else reason `goal_job_not_in_vocabulary` and nothing is written.
* `lib/core/feyminto/next-move.cjs`: the source label names the goal job (M2).
* `lib/core/feyminto/brief.cjs`: the goal job and its problem type are in the record basis, so a goal change makes a brief read as stale and the existing walk writes it again (M1); the brief names the job that ranked the move (M2).
* `lib/mcp/tools/sensors.cjs`: `how_to_set_job` in the `suggest_next` reply when the job is unknown and offers exist (M5).
* New `tests/test-395-job-shown.cjs` (18 checks, M3); `tests/run-all-395.sh` lists it.

## What ran

* `bash tests/run-all-395.sh`: exit 0, 27 ok lines (executor and cold check).
* No goal set: selector result, brief text and record basis byte-identical to the old code (119,595 bytes, `cmp` clean).
* Suite 345: fails `mcp__theo__ tripwire` only (baseline). Suite 36925: fails X5, I2/I7/I8c/M4 (baseline), one load-dependent brief-wiring arm, and `triple-context-formatter.test` Test 12.
* Test 12 was run by the main session on the changed tree and on the base tree `8c493ee13`: it fails the same way on both (file `88-07-SUMMARY.md` is absent in this worktree). Not caused by this slice.
* `tests/test-36925-brief-wiring.cjs` alone, 3 runs on each tree, alternating, load 2 to 3.4: exit 0 in all 6 runs. BW4 wall times: changed tree 1,355 to 2,032 ms, base tree 1,370 to 2,398 ms, limit 3,000 ms. The BW2, BW3, BW4 failures of the executor are from machine load.
* Cold check (`docs/designs/selection-path/runs/395-02/cold-check.md`): COMMIT, 0 blockers, 2 majors, 8 minors, 18 mutations.

## What did not run

* The card rung on a Claude host and the elicitation rung (code read only).
* The real `scripts/on-stop` after a goal change.
* Full suites 345 and 36925 a second time.

## Carried to a later plan

* MA1: in a born room `how_to_set_job` is sent in 0 of 17 `suggest_next` replies (a standard nest has a section job; the 3 nests with no job have 0 offers). The goal route exists, but no surface tells the model about it.
* MA2 (finding F2): on a host that answers a gate by inline elicitation, the gate is consumed and no goal is written (`lib/mcp/tools/gate.cjs:1519-1522`).
* mi1: a nested section can get two fingerprints (repeated rewrites in a room with sub-rooms and a goal). mi2: five code parts have no check that can fail. mi3 to mi8: see the cold check.
* Baseline record: add `lib/memory/triple-context-formatter.test.cjs` Test 12 and `tests/test-365-never-do-gate.cjs` arm N12 (fail on untouched code).
