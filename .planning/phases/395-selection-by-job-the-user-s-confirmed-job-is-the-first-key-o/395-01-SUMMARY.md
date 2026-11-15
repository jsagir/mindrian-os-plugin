# 395-01 summary: the job is real

* **Date:** 2026-11-15. **Executed on:** Haiku 5.5. **Checked on:** Fable 5.2 (cold check, verdict COMMIT to the work branch only).
* **Evidence:** `docs/designs/selection-path/runs/395-01/` (suite outputs, `cold-check.md`).

## What changed

* `lib/hmi/jtbd-state.cjs`: new `resolveSelectionJob(roomDir, sectionJobId)`. A goal job in the job vocabulary wins; else the section job as before; else none.
* `lib/core/feyminto/next-move.cjs`: `nextMoveForSection` reads the job through that function. `composeNextMove` returns three new keys: `state`, `job`, `job_offers`. The reason text says "serves your goal job" when the job came from the goal.
* `lib/mcp/tools/sensors.cjs`: the `suggest_next` tool's `next_move` carries `job`, `job_state`, `job_offers`.
* `lib/core/strategy/goal-gate.cjs`: a new goal with no problem type keeps the problem type of the goal before it.
* `tests/test-395-job-real.cjs` (9 checks), `tests/run-all-395.sh`.

## What ran

| Check | Untouched code | After |
|---|---|---|
| `tests/run-all-395.sh` | not present | exit 0, 9 of 9 |
| `tests/run-all-345.sh` | 1 failing: `mcp__theo__ tripwire` | the same 1 |
| `tests/run-all-36925.sh` | 4 failing | 4 failing; the same except one arm of `test-36925-brief-wiring.cjs` |
| `tests/test-270-tool-schema-budget.cjs`, `tests/test-254-r7-structural-fence.cjs` | exit 0 | exit 0 |

With no goal set, the result of the selector and each rendered brief are byte-identical to the base commit, apart from the three new keys (cold check: 14 folders, 2 surfaces, old code against new code).

## Waiver: pass condition 2 was not met by the letter

In suite 36925, arm BW2 of `tests/test-36925-brief-wiring.cjs` failed on untouched code and arm BW3 fails after the change. Run alone, the file passes 6 of 6 arms: three runs on the changed tree and three on an untouched copy (main session), and again under ten busy loops (cold check). The cold check names the cause: the on-stop step recompiles each room map with a 0.4 second limit and the brief walk has a 1,200 ms budget, and under the suite's load both run out; the fixture room has no goal, so this change cannot alter the brief text. The two arms are unstable under load. Recorded as a waiver, not as a pass.

## Carried to plan 395-02, before any release

* **M1.** A goal change does not rewrite a section's `BRIEF.md`: the brief's record basis does not include the goal file. A brief can name a move the selector no longer returns.
* **M2.** With a goal set, the brief prints the section job on its `Job:` line and the label "the nest job" among the sources, while the reason says "serves your goal job". The goal job id is never printed.
* **M3.** The new test does not call `nextMoveForSection` or `resolveNextMove`, and its two `composeNextMove` checks have no candidates. It cannot fail for Changes 2, 3b, 4 or for `jobOffersFor`.
* **M4.** A stored problem type outside Theo's four ids now makes a job change fail. Copy the old problem type only when it is one of the four.
* **M5.** No shipped path sets a first goal: the goal card builder has no caller and returns nothing when a room has no goal. Until one exists, M1 and M2 cannot be seen by a user, and a user cannot set a job.

## Not done in this plan

The order rule of the selector; the other proposal paths; the chain; the consult to Theo; the ledger. `.planning/STATE.md` was not edited for the new phase.
