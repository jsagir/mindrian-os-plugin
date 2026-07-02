---
phase: 205-larry-loop-elevation
plan: 03
subsystem: sensor-spine / selector-ranker
tags: [SENS-10, circularity, anti-circular, gear-shift, clarify-vs-reframe, frozen-six, Part-8, Part-7]
one_liner: "SENS-10 circularity sensor detects a circling conversation, classifies one of four causes, and routes each to a frozen-six exit reach (minting none); the ranker flip makes clarifying-ASK impossible as the recommended detent when SENS-10 fires while keeping reframe-ASK eligible."
requires:
  - "insight-sensors SENSOR_REGISTRY + dispatchSensors (Phase 143)"
  - "sensor-types makeReach + frozen REACH_IDS/POSTURE_IDS (Phase 143/148)"
  - "sensor-lagging-component SENS-02 (reused for stuck_unlocated)"
  - "f-selector-ranker rankForSelector (Phase 188 Shape-F)"
provides:
  - "SENS-10 circularity detector (lib/core/sensors/sensor-circularity.cjs)"
  - "four-cause -> four frozen-six-exit mapping (CAUSE_EXIT), cause enum on reach evidence"
  - "SENS-10-fired clarify-vs-reframe ranking suppression in rankForSelector"
affects:
  - "lib/core/insight-sensors.cjs (append-only registry + exports)"
  - "lib/workflow/f-selector-ranker.cjs (runtime ranking only, no bank edit)"
tech_stack:
  added: []
  patterns:
    - "Mirror the SENS-09 sensor file shape (candidate-reach producer, Phase 144 fence)"
    - "Part-8: enum handles only leave the sensor; no user prose in evidence; no egress"
    - "Part-7 item-7: mint no new reach_id; route to the frozen six"
    - "Append-only registry (pre-205 order stays a diff-verifiable prefix)"
    - "Ranking suppression touches runtime only (mirror Phase 158 discount discipline)"
key_files:
  created:
    - "lib/core/sensors/sensor-circularity.cjs"
    - "tests/test-205-sens10-circularity.cjs"
  modified:
    - "lib/core/insight-sensors.cjs"
    - "lib/workflow/f-selector-ranker.cjs"
decisions:
  - "TELL / GRILL / REFRAME are nav-dial GEARS, not reaches: each maps onto a frozen reach_id (context_block for TELL and find-bottlenecks; deep_research for challenge-assumptions GRILL and beautiful-question REFRAME). The gear enum rides evidence, the reach_id stays frozen-six."
  - "stuck_unlocated REUSES the SENS-02 sensorLaggingComponent signal (require + call) rather than re-deriving reverse-salient phrasing (Canon Part 7 reuse-before-build)."
  - "Generic circling cues (circular / back-and-forth / not answering) default to answer_unheard -> TELL, matching the Mordi+Eli tester failure shape (stop asking, deliver)."
  - "Ranker suppression is a ranking-only flip (tags on a row copy, byte-identical no-op when SENS-10 is silent); ASK is never removed from the bank. The frozen Shape-F 0.70/0.15 detent (D-Q4) is untouched."
metrics:
  duration: "~15m (verification + SUMMARY; implementation pre-committed as f104f45c)"
  completed: "2026-07-02"
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  test_assertions: "92 (SENS-10 suite) + 6 (spine-dispatch contract) = 98, all green"
---

# Phase 205 Plan 03: Anti-Circular Within-Frame Gear-Shift (SENS-10) Summary

## One-liner

SENS-10 detects when a conversation circles, classifies the circling into exactly one of four causes, and routes each cause to an EXISTING frozen-six reach (minting no new reach_id); the `rankForSelector` flip makes clarifying-ASK impossible as the recommended detent when SENS-10 fires, while keeping reframe-ASK (the beautiful-question exit) eligible.

## Execution note (important)

The three tasks in this plan were already fully implemented and committed as **`f104f45c` -- `feat(205-03): SENS-10 circularity sensor + clarify-vs-reframe ranker flip`** (authored 2026-07-01), which is an **ancestor of this worktree's base commit `a5e1714f`**. That commit landed all four files (607 insertions). Per continuation discipline, this execution did **not** redo committed work; it **verified** the shipped implementation against every acceptance criterion in the plan and produced the missing `205-03-SUMMARY.md`. The original commit is a single squashed feat commit rather than per-task TDD RED/GREEN commits, because it predates this worktree.

## What was built (verified against the committed code)

### Task 1 - SENS-10 circularity sensor
`lib/core/sensors/sensor-circularity.cjs` exports `sensorCircularity(turn, tuple, ctx)`. It mirrors the SENS-09 file shape (a pure candidate-reach producer). It classifies the circularity CAUSE from LOCAL turn-state (explicit signal kind first, then structural keyword banks over LOCAL turn text) and maps each cause to a frozen-six exit via `makeReach`. Soft-fails to `null` on no-circling and on malformed/throwing input (never throws). Reads LOCAL bytes only: no Brain call, no network call, no `decide()`, no `routing_source` mutation (Phase 144 fence).

### Task 2 - Registry registration (append-only)
`lib/core/insight-sensors.cjs` requires the new sensor with a doc comment ("Phase 205 detector -- SENS-10 circularity. SENS-09 is taken by Phase 170 dual-use diffusion."), APPENDS `sensorCircularity` to `SENSOR_REGISTRY` after `sensorShowShare`, and adds it to `module.exports`. The pre-205 order is unchanged (SENS-10 is the last entry, index 11 of 12) so the canonical order stays a diff-verifiable prefix. `dispatchSensors` surfaces the SENS-10 reach end-to-end (its reach_id is frozen-six, so it passes the existing REACH_IDS membership filter unchanged).

### Task 3 - Ranker flip (clarify-vs-reframe)
`lib/workflow/f-selector-ranker.cjs::rankForSelector` gains a SENS-10-fired signal. When SENS-10 has fired, `_applySens10Flip` re-orders the scored rows: `[exit(s)]` then `[one reframe]` then `[remaining reframe + others by score]` then `[clarification last]`, so ASK-as-clarification is demoted BELOW every non-clarification row (never the top recommendation) while ASK-as-reframe (the beautiful-question exit) stays eligible. It is a ranking suppression, NOT a bank edit (ASK is never removed). Rows are tagged on a COPY, so the result is byte-identical to the prior behavior when SENS-10 is silent. `rankForSelector` remains synchronous (a plain `function` returning a plain array, not a Promise). The frozen Shape-F 0.70/0.15 detent (D-Q4) is untouched.

## The four cause -> reach mappings (as implemented in CAUSE_EXIT)

| Cause (enum) | Gear | Dispatch handle | Frozen-six reach_id | Posture |
|---|---|---|---|---|
| `answer_unheard` | TELL | `tell-synthesis (deliver the answer; stop asking)` | `context_block` | `push_forward` |
| `assertion_unvalidated` | GRILL | `challenge-assumptions` | `deep_research` | `push_forward` |
| `stuck_unlocated` | GRILL (via find-bottlenecks, REUSES SENS-02) | `find-bottlenecks (rs-engine reverse-salient)` | `context_block` | `pull_back` |
| `wrong_frame` | REFRAME (via beautiful-question) | `beautiful-question (Why / What-if / How)` | `deep_research` | `pull_back` |

TELL / GRILL / REFRAME are nav-dial GEARS carried on the `gear` evidence enum; the emitted `reach_id` is always one of the frozen six (context_block, contradiction, cross_room, brain_consult, deep_research, hats). No new reach_id is minted (Canon Part 7, item-7 invariant). The reach evidence is a flat scalar bag `{ cause, gear, mode }` -- all three are enum handles from closed sets, never user prose (Canon Part 8).

## Verification (actual output)

### `node tests/test-205-sens10-circularity.cjs` -> PASS (EXIT=0)
`PASS 92 assertions`. Covers: all four circling fixtures each fire and route to a frozen-six reach with the expected cause/gear/posture; the progressing-conversation fixture returns null; the cause enum is present and drawn from the closed set with no multi-word user prose; explicit-signal vs keyword fire modes; the SENS-02 lagging-component reuse path (bottleneck -> stuck_unlocated); soft-fail to null on 8 malformed inputs plus a throwing turn getter (DoS mitigation); grep-style assertions that the sensor makes no fetch/http call, never calls decide(), never requires navigation-engine, and has no em-dashes; append-only registry (SENS-10 is the LAST entry, appended after SENS-SHOW, SENS-09 still precedes it); dispatchSensors surfaces the SENS-10 reach; and the full ranker flip (sync plain array, byte-identical no-op when unfired, top recommendation is the exit not a re-ask, reframe stays eligible in the reserved slot, clarification never top).

### `node tests/test-sensor-spine-dispatch.cjs` -> PASS (EXIT=0)
`sensor-spine dispatch contract: 6 passed, 0 failed`. REACH_IDS still exactly the frozen six, POSTURE_IDS exactly three, makeReach frozen-struct + null-on-invalid, dispatchSensors returns an array and never throws. Registry dispatch is unbroken with SENS-10 registered.

### grep-verify (sensor-circularity.cjs)
- Network primitives (fetch/http/https/axios/WebFetch/net.connect): **NONE FOUND (clean)**.
- `decide()` call: **NONE FOUND (clean)**.
- `routing_source`: only appears in a comment describing the Phase 144 fence, never as a mutation.
- `require(...)`: only `./sensor-types.cjs` and `./sensor-lagging-component.cjs` (both pure, LOCAL).
- Em-dash scan: **NONE FOUND (clean)**.

## Threat model dispositions (from the plan's register)

- **T-205-03-I (info disclosure)** mitigated: reach evidence carries the `cause`/`gear`/`mode` enums only, never user prose (Part 8) -- asserted by "evidence carries no multi-word user prose" for all four causes.
- **T-205-03-T (tampering / frozen six)** mitigated: SENS-10 routes to existing reach_ids, mints none -- asserted by "CAUSE_EXIT[...] reach_id is frozen-six" for all four causes. (The frozen-six drift guard proper lands in 205-04.)
- **T-205-03-D (DoS / sensor throw)** mitigated: soft-fail to null on malformed and throwing input -- 9 soft-fail assertions.
- **T-205-03-SC (npm installs)** mitigated: no package installs in this plan.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Missing `node_modules` in the worktree (environment, not code).**
- **Found during:** Verification (running `node tests/test-205-sens10-circularity.cjs`).
- **Issue:** The worktree had no `node_modules` directory (git worktrees do not copy untracked dirs, and `node_modules` is neither committed nor gitignored here). The test transitively loads `f-selector-ranker.cjs -> navigation-engine.cjs -> brain-client.cjs`, which requires `ajv/dist/2020`, so the test could not even load (`Cannot find module 'ajv/dist/2020'`).
- **Fix:** Symlinked the worktree `node_modules` to the same-commit main-checkout dependency cache (`ln -s /home/jsagi/dev/MindrianOS-Plugin/node_modules node_modules`). This is the standard git-worktree pattern for the dependency cache -- a read-only reference that does not mutate the main checkout, installs no new/unknown package (ajv is an already-declared, already-present dependency), and hits no network. `node_modules` is untracked, so it is not committed.
- **Files modified:** none (filesystem symlink only, uncommitted).
- **Commit:** n/a.

Otherwise the plan was implemented exactly as written (in the pre-existing commit f104f45c).

## Known Stubs

None. All four causes are wired to live frozen-six exits; the sensor and ranker both operate on real inputs (no placeholder/mock data paths).

## Self-Check: PASSED

- `lib/core/sensors/sensor-circularity.cjs` -> FOUND (tracked, 278 lines).
- `tests/test-205-sens10-circularity.cjs` -> FOUND (tracked, 92 assertions green).
- `lib/core/insight-sensors.cjs` -> FOUND (SENS-10 registered, index 11 of 12, append-only).
- `lib/workflow/f-selector-ranker.cjs` -> FOUND (rankForSelector sync flip present).
- Commit `f104f45c` -> FOUND in history (ancestor of base a5e1714f); message `feat(205-03): SENS-10 circularity sensor + clarify-vs-reframe ranker flip`.
