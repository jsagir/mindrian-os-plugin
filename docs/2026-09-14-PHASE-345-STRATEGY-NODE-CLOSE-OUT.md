# Phase 345 Close-Out: The Strategy Node

Status: CLOSED 2026-09-15
Implementing phase: 345 (the strategy node, graph-engineering learning 3b, blind upward
movement). Nine plans, 9/9 executed.
Sibling records: `docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md` (the tracked decision
ledger this record reads its Decisions Ruled section from), `docs/2026-09-14-PHASE-344-LAYER-
CONTRACT-CLOSE-OUT.md` and `docs/343-CLOSE-OUT.md` (the two prior close-outs this record's own
shape mirrors), `docs/2026-09-14-PHASE-347-SHARED-STATE-CLOSE-OUT.md` (the most recent sibling
close-out, same shape).

## Why this file is in docs/

`.planning/` is gitignored in this repository (`.gitignore:97-98`, except `.planning/debug/`), so
a phase that closes only in `.planning/phases/345-.../345-09-SUMMARY.md` has closed on one
machine. This file is the artifact another machine can read: what shipped, what is measured, and
what stayed open, with the commands and outputs that prove each claim rather than a restated
assertion.

---

## What shipped

Phase 345 touched four of MindrianOS's five engineering rungs (Phase 344's own vocabulary);
LOOP (a single agent's cycle with a stopping condition) was not touched by this phase.

### PROMPT

- `skills/larry-personality/SKILL.md`: the "Clarify vs reframe (the anti-circular rule)"
  paragraph amended in place (single-hunk diff), naming the strategy node -- a GRAPH-layer
  watcher, not a turn move -- as the owner of the room-level reframe, phrased in the observing
  voice ("when the engine surfaces the strategy reach, Larry's move is the climb, not another
  clarifying question"), citing the graph-engineering source at offsets 4645:4703, naming no
  specific reach count. Shipped byte-identical to `dist/generic-claude-dir/.claude/skills/
  larry-personality/SKILL.md` and `dist/zed/.agents/skills/larry-personality/SKILL.md` (hand-
  copied, since neither shipped generator covers this file for this narrow scope -- see
  345-08-SUMMARY.md Deviation 2).

### CONTEXT

- `lib/hmi/jtbd-state.cjs`: a top-level `goal` key (`jtbd`, `parent_question`, `rung`,
  `goal_version`, `set_at`, `set_by`) plus a bounded `goal_history` ring, sibling to `current` and
  `history`, carried through all three existing writers (`setCurrent`, `bumpTurnCount`, `clear`).
  `setGoal`/`getGoal`/`goalHistory`/`GOAL_HISTORY_MAX` exported. `SCHEMA_VERSION` unchanged at 1
  (an additive field set, not a format bump).
- `templates/room-skeleton/section-contracts/problem-definition.md`: one Inputs pointer to
  `goal.rung`, and Process step 2 corrected from a three-rung-plus-escalation model that
  contradicted all three live code vocabularies to the actual persisted flat four-rung set
  (345-ICM-CONSULT R6, BLOCKING, closed).
- `templates/room-skeleton/section-contracts/strategy.md`: one Inputs pointer to
  `goal.parent_question`.

### HARNESS

- `lib/core/navigation/memory-events.cjs`: two net-new `EVENT_TYPES` members,
  `strategy_proposed` and `strategy_throttled` (98 -> 100 total).
- `lib/core/navigation/goal-anchor.cjs`: `mintGoalAnchor`/`GOAL_ANCHOR_ID` -- the payload-free,
  idempotent `goal:<room-slug>` anchor node, minted through the one node-write chokepoint
  (`node-insert.cjs`), typed `'goal'`/`epistemic_type: 'assumption'`/`review_status: 'proposed'`.
  Re-exported on `lib/core/navigation.cjs` beside `writeReasoningNode`/`confirmNode`.
- `lib/mcp/tools/gate.cjs`: one additive, independently-try/catch-wrapped branch in the existing
  `gate_answer` approve path, routing an approved strategy card to `ratifyGoalProposal` and
  attaching a `strategy_ratification` response key.

### GRAPH

- `lib/core/strategy/rung-vocabulary.cjs`: the one home for the persisted rung vocabulary
  (`THEO_RUNGS`, `LADDER_RUNG_BY_THEO_ID`, `isTheoRung`, `toLadderRung`,
  `PERSISTED_VOCABULARY`) mapping the four Theo-classifier rungs to the lowercase egress-guard
  ladder enum, fail-closed (`null`) on any unrecognized input.
- `lib/core/strategy/goal-cadence.cjs`: `computeStrategyCounts`, `shouldPropose`,
  `readStallSignal`, `readLastProposalEpochMs`, and the three named cadence constants
  (`STRATEGY_CADENCE_REACHES=40`, `STRATEGY_STALL_MIN_SAMPLE=12`,
  `STRATEGY_MIN_INTERVAL_REACHES=20`, navigator-ratified `ratify-all` at the plan-05 checkpoint).
- `lib/core/strategy/strategy-throttle.cjs`: `computeDismissalRate`, `isThrottled`,
  `emitThrottleEvent` -- the hard-interval, dismissal-rate, and reject-suppression cool-down.
- `lib/core/sensors/sensor-strategy-reach.cjs`: `sensorStrategyReach`, pure, synchronous, zero
  I/O, registered as **SENS-20** (corrected from the plan text's stale `SENS-19`, which Phase 343
  claimed first for `sensorGraphIntegrity` -- see "What stayed open" is NOT where this lives;
  this correction is fully closed, not deferred, recorded in the decisions record Section 6).
  Fires the existing `contradiction` reach id at `pull_back` posture (navigator-ratified).
- `lib/core/insight-sensors.cjs`, `lib/core/sensors/sensor-priority.cjs`,
  `lib/core/navigation-engine.cjs`: the full seven-place lockstep for SENS-20, including the
  un-gated seventh place (the ctx producer block in `decide()`), closed with a test that calls
  `decide()` end-to-end and fails when the block is removed (verified by a deliberate negative
  check).
- `lib/core/strategy/taxonomy-climb.cjs`: `climb` (local, zero-network rung classifier),
  `renderLadder` (optional Brain-decorated ladder render through `brainClient.callTool`),
  `localLadderLine` (the Tier 0 one-line fallback).
- `lib/core/strategy/strategy-card.cjs`: `buildStrategyCard`, the four-option `strategy_goal`
  proposal card carrying a real `subject_node_id` and a filtered, capped `evidence_node_ids`
  list, plus a `preview` JSON payload on the `rewrite-jtbd`/`change-rung` options (Rule 2
  deviation, 345-07) carrying the navigator-approved job/rung from render time to answer time.
- `lib/core/strategy/goal-gate.cjs`: `isStrategyCard`, `ratifyGoalProposal` -- the ONLY caller of
  `jtbdState.setGoal` in the repository, reached only from an approved strategy gate. Measured:
  `grep -rn "setGoal(" lib/ scripts/ --include=*.cjs | grep -v jtbd-state.cjs | wc -l` returns
  exactly `1` (345-09 gate-sweep check 11, below).
- `scripts/intent-classifier.cjs`: `goal_version` stamped on every `reach_presented` row;
  `anchor_node_id` plus one `strategy_proposed` memory event on `gate_reached` when a strategy
  reach is offered. Five exported pure payload-helper functions
  (`goalVersionFromRecord`, `isStrategyReach`, `buildReachPresentedPayload`,
  `buildGateReachedPayload`, `buildStrategyProposedPayload`).
- `tests/run-all-345.sh` plus thirteen `tests/test-345-*.cjs` files (the full list: `test-345-
  rung-mapping`, `test-345-goal-record`, `test-345-cadence`, `test-345-cooldown`, `test-345-
  strategy-sensor`, `test-345-part8`, `test-345-lockstep`, `test-345-producer-fires`, `test-345-
  gate-anchor`, `test-345-climb`, `test-345-gate-ratify`, `test-345-goal-version-stamp`,
  `test-345-doctrine`).
- `docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md` (the decisions record) and this file
  (the close-out record) -- both under `docs/`, both tracked, both travel between machines.

No artifact named in `345-01-PLAN.md`'s phase-total list is missing from the above; no artifact
above is claimed that does not exist on disk (cross-checked against `git log --oneline` for
345-01..345-08 and each plan's own Self-Check section).

---

## Gate sweep

Run 2026-09-15 from `/home/jsagi/dev/MindrianOS-Plugin/` (confirmed via `pwd` before the sweep).
Every command below is quoted literally with its literal key output line.

**1.** `bash tests/run-all-345.sh`
```
PASS=19 FAIL=0 SKIP=0
```
Exit 0. Thirteen phase legs (one per `tests/test-345-*.cjs` file) plus four inherited legs plus
the two tripwires (`mcp__theo__`, em-dash), all PASSED.

**2.** `node tests/test-sensors-part8-sweep.cjs`
```
sensors Part-8 5-tripwire sweep: 1 passed, 0 failed over 25 file(s)
```
Exit 0.

**3.** `node tests/test-sensors-routing-fence.cjs`
```
sensors routing fence (Phase 144): 2 passed, 0 failed over 25 file(s)
```
Exit 0.

**4.** `node tests/test-245-priority-complete.cjs`
```
PASS test-245-priority-complete.cjs (8 checks)
```
Exit 0.

**5.** `node scripts/build-connector-registry.cjs --check`
```
connector-registry: OK
```
Exit 0.

**6.** `node scripts/doctor.cjs --acceptance`
```
Acceptance full: 20/20 points passed.
```
Exit 0.

**7.** `node scripts/check-render-coverage.cjs`
```
render-coverage report: 16 covered, 0 excluded, 0 gap (16 entries)
render-coverage md-keyspace: 202 wired, 2 excluded, 0 unwired (204 declaring commands)
```
Exit 0.

**8.** `node scripts/check-layer-declaration.cjs` (STRAT-17; the gate landed in Phase 344, plan
344-02, so the primary check runs, not the grep fallback):
```
OK: 285 surfaces enumerated, 248 declared, 37 exempt (by class: agent=15, command=113,
mcp-tool=27, pipeline=4, skill=126)
```
Exit 0. Header-comment grep additionally confirms `layer: graph` on all six
`lib/core/strategy/*.cjs` files, `lib/core/sensors/sensor-strategy-reach.cjs`, and
`lib/core/navigation/goal-anchor.cjs`; `layer: context` on `lib/hmi/jtbd-state.cjs`;
`skills/larry-personality/SKILL.md` correctly carries no `layer:` key at all, because it is
`connector.excluded:true` with a stated reason and Phase 344's own WD-7 ruling removes exempt
skills from the layer-backfill map entirely (345-08-SUMMARY.md Deviation 1) -- absence here is
the CORRECT post-344-04 state for this one skill, not a gap.

**9.** `LC_ALL=C grep -c $'\xe2\x80\x94'` over every one of the 39 files this phase's eight plans
created or modified (the union of every plan's own `key-files: created`/`modified` list,
excluding the four files a concurrent Phase 347 session touched in the same shared working tree
during this phase's execution window -- `lib/core/chain-executor.cjs`, `lib/mcp/tools/chain.cjs`,
`lib/mcp/tools/context.cjs`, `lib/core/navigation/chain-state.cjs`, `commands/file-meeting.md`,
`skills/file-meeting/SKILL.md`, and the `tests/test-347-*.cjs` files, none of which any 345 plan's
own `files_modified` names):
```
0 (every file)
```
Every one of the 39 phase-owned files returns `0`.

**10.** `git diff --stat package.json`
```
(empty)
```
Zero packages installed by this phase.

**11.** `grep -rn "setGoal(" lib/ scripts/ --include=*.cjs | grep -v jtbd-state.cjs | wc -l`
```
1
```
The one call site is `lib/core/strategy/goal-gate.cjs:192`, inside `ratifyGoalProposal`.

**12.** `grep -rl "mcp__theo__" lib/ | wc -l`
```
0
```

**Checks 1 through 7 all exit 0. Check 9 returns 0 for every file. Check 10 produces empty
output. Check 11 returns exactly 1. Check 12 returns 0. Every gate this phase touched is green in
this one recorded sweep.**

---

## Requirements closed

All eighteen `STRAT-01..18` rows are `- [x]` in `.planning/REQUIREMENTS.md` with a `Measured:`
clause naming a real command and its real output. Repeated here so a reader without
`.planning/` (gitignored) still has the evidence.

| Id | Deliverable | Measured |
|---|---|---|
| STRAT-01 | Top-level `goal` key, carried through `writeStateAtomic` and all three writers | `node tests/test-345-goal-record.cjs` exits 0 (40/40, 2026-09-15) |
| STRAT-02 | `goal_version` monotone, `goal_history` bounded ring, absent reads as 0 | same suite, version-monotonicity + 51-write bound legs |
| STRAT-03 | One declared persisted rung vocabulary, tested mapping to the egress-guard ladder enum | `node tests/test-345-rung-mapping.cjs` exits 0 (40/40, 2026-09-15) |
| STRAT-04 | Cadence/stall counters through the navigation chokepoint, named constants, injection seam | `node tests/test-345-cadence.cjs` exits 0 (41/41, 2026-09-15) |
| STRAT-05 | Cool-down: hard interval, dismissal-rate throttle, REJECT-only suppression, `strategy_throttled` event | `node tests/test-345-cooldown.cjs` exits 0 (30/30, 2026-09-15) |
| STRAT-06 | `sensorStrategyReach` pure, sync, zero I/O, `null` on every refusal branch | `node tests/test-345-strategy-sensor.cjs` exits 0 (19/19) + `node tests/test-345-part8.cjs` exits 0 (14/14) |
| STRAT-07 | SENS-20 registered lockstep places 2-6, `SENS_PRIORITY` Group A | `node tests/test-345-lockstep.cjs` PASS (9/9), 2026-09-15 (345-05) |
| STRAT-08 | Ctx producer block (place 7) pinned from the far end through `decide()` | `node tests/test-345-producer-fires.cjs` PASS (11/11), deliberate negative check confirmed (345-05) |
| STRAT-09 | Stall count exposed as a named null-default input for Phase 346 | `node tests/test-345-cadence.cjs` exits 0 (41/41); `readStallSignal` defaults `null`, never `0` |
| STRAT-10 | The climb: local inference plus optional `taxonomy_ladder` render, local fallback | `node tests/test-345-climb.cjs` exits 0 (13/13, 2026-09-15) |
| STRAT-11 | No file under `lib/` contains the literal `mcp__theo__` | `grep -rl "mcp__theo__" lib/ \| wc -l` returns `0` (re-measured 2026-09-15) |
| STRAT-12 | Idempotent payload-free `goal:<room-slug>` anchor node, minted before the card | `node tests/test-345-gate-anchor.cjs` exits 0 (29/29, 2026-09-15), real `SELECT COUNT(*)` idempotency |
| STRAT-13 | Strategy proposal is a Decision Gate; approve writes a typed decision node with a `SOURCED_FROM` edge, both surfaces | `node tests/test-345-gate-ratify.cjs` exits 0 (33/33), `MEASURED: sourced_from_edges_to_anchor=1 confirmed_decision_gate_nodes=1` -- see "The number this phase existed to move" below |
| STRAT-14 | Every `reach_presented` payload carries the `goal_version` it ran under | `node tests/test-345-goal-version-stamp.cjs` exits 0 (19/19, 2026-09-15) |
| STRAT-15 | Two L2 contract Inputs pointer lines, plus the `problem-definition.md` rung-vocabulary correction | `node tests/test-345-doctrine.cjs` exits 0 (11/11, 2026-09-15) |
| STRAT-16 | SKILL.md doctrine amendment at the anti-circular rule, plus the dist mirrors | same suite, byte-identical three-copy parity leg |
| STRAT-17 | Every declaring surface this phase adds carries `layer: graph` | `node scripts/check-layer-declaration.cjs` exits 0: `OK: 285 surfaces enumerated, 248 declared, 37 exempt` |
| STRAT-18 | Phase close: aggregator green, every STRAT id closed with measured proof | `bash tests/run-all-345.sh` exits 0 (`PASS=19 FAIL=0 SKIP=0`, re-run 2026-09-15 at close) |

Eighteen rows, matching `.planning/REQUIREMENTS.md`'s eighteen `- [x] **STRAT-NN**` rows exactly.
