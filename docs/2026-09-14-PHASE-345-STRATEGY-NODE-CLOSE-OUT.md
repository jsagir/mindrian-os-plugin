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

---

## The number this phase existed to move

This phase's headline deliverable was a number: `SOURCED_FROM` edges and `decision:gate:*` nodes
produced by an approved strategy gate.

**Before (measured 2026-09-14, 345-ICM-CONSULT's census, cited verbatim in the decisions record
WD-8):** 0 `SOURCED_FROM` edges, 0 `decision:gate:*` nodes, across 30 live rooms, against 4,680
`gate_reached` events on the CLI surface (`scripts/intent-classifier.cjs:2401`). A strategy
proposal had no anchor to point a provenance edge at, and the gate's own decision-node/edge writer
(`gate_answer`'s approve branch, shipped 2026-09-03, quick 260903-i2x) had never once been
exercised with a real `subject_node_id`/`evidence_node_ids` pair for this card kind.

**After (measured 2026-09-15, `node tests/test-345-gate-ratify.cjs`, printed verbatim):**
```
MEASURED: sourced_from_edges_to_anchor=1 confirmed_decision_gate_nodes=1
```
Through the ACTUAL registered `gate_render`/`gate_answer` MCP tool handlers, on a fixture room
built under `os.tmpdir()`, driving a real `strategy_goal` card end to end: approve produces
exactly one `SOURCED_FROM` edge whose `target` resolves to a real `goal:<slug>` anchor node row,
and exactly one `decision:gate:<gate_id>` node at `review_status='confirmed'`. Reject and defer
both produce 0 edges and 0 nodes (the negative leg, also measured, not assumed).

**Honest caveat, stated explicitly per this phase's own must-have:** the after count is a FIXTURE
measurement on one scratch room driven through the real tool handlers. It is NOT a fleet
measurement. As of this close-out (2026-09-15), no live room has yet answered a strategy gate,
because SENS-20 only began firing in production with plan 05's landing earlier the same day, and
the cadence floor (`STRATEGY_MIN_INTERVAL_REACHES=20`, `STRATEGY_CADENCE_REACHES=40`) means the
earliest a real room could see its first proposal is measured in tens of reaches, not immediately.
The mechanism is proven correct end to end through the real code path; the fleet number itself
remains 0/0 until a live room crosses the threshold and a navigator approves.

---

## Decisions ruled

Nine working decisions from `docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md` Section 2, all
finalized at this close (zero rows remain `WORKING`):

| Id | Decision | Final status | What shipped |
|---|---|---|---|
| WD-1 | Cadence constants ship in the same plan as the throttle | RULED 2026-09-15 (navigator `ratify-all`) | `STRATEGY_CADENCE_REACHES=40`, `STRATEGY_STALL_MIN_SAMPLE=12`, `STRATEGY_MIN_INTERVAL_REACHES=20` (plan 03/05) |
| WD-2 | Goal record is a top-level sibling key, never nested | HELD 2026-09-15 | `goal`/`goal_history` top-level, threaded through all three writers (plan 02) |
| WD-3 | `taxonomy_ladder` liveness discharged by one probe, card falls back safely | HELD 2026-09-15 | Probe ran (exit 0, 2026-09-15T12:49:33Z); `_resolveLadderText` degrades to `localLadderLine` on any non-`.ladder` shape (plan 06) |
| WD-4 | Reach id `contradiction`, posture `pull_back` | RULED 2026-09-15 (navigator `ratify-all`) | `sensorStrategyReach` fires exactly this reach id/posture pair (plan 04/05) |
| WD-5 | Requirement prefix `STRAT` | HELD 2026-09-15 | Eighteen-id family minted and closed in `.planning/REQUIREMENTS.md` (plan 01/09) |
| WD-6 | Persisted vocabulary is Theo's four ids; wire vocabulary is the lowercase ladder enum | HELD 2026-09-15 | `rung-vocabulary.cjs` is the sole home (plan 01). A separate, unresolved live rung-CASING mismatch on the wire side is carried forward below, not a contradiction of this ruling. |
| WD-7 | Anchor node typed `'goal'`/`'assumption'`/`'proposed'`, never `'claim'` | HELD 2026-09-15 | `mintGoalAnchor` mints, `confirmNode` promotes on approve (plan 06/07) |
| WD-8 | `SOURCED_FROM` measured on the MCP surface; CLI surface wired additively | HELD 2026-09-15 | MCP writes the decision node and edge; CLI stamps `anchor_node_id` and emits `strategy_proposed` (plan 07) |
| WD-9 | SENS_PRIORITY Group A, not Group D | RULED 2026-09-15 (navigator `ratify-all`) | Registered Group A, positionally between SENS-11 and SENS-14, as **SENS-20** (id corrected from the research-time `SENS-19`, which Phase 343 claimed first -- decisions record Section 6, fully closed, not deferred) |

---

## What stayed open

Seven rows, each with its citation, so the next phase inherits a map rather than an audit.

**(a) The three dead readers of `jtbd.current.id`.** `lib/core/navigation/packet.cjs:318-320`
(throws `ERR_INVALID_ARG_TYPE` on `getCurrent(null)`), `lib/core/navigation/insights.cjs:368-373`,
`lib/core/navigation/focus.cjs:123-129`. None is in this phase's `files_modified`, so the Rule-1
correction did not apply. A separate quick task (345-ICM-CONSULT R10 item 1, AP-G4).

**(b) Seeding `jtbd:<slug>` to revive `focus.cjs` Rule 1.** A different fact, a different phase
(345-ICM-CONSULT R10 item 2).

**(c) The mandatory-anchor fix on `typed-claim.cjs::writeClaimNode`.** Phase 273 territory; blast
radius already mapped at `343-ICM-CONSULT.md` and restated in `docs/343-CLOSE-OUT.md`'s own
structural-gap section (7,824 of 7,836 fleet claims carry no structural anchor as of 2026-09-15).

**(d) The two-column goal-drift doctor statement (345-ICM-CONSULT R9).** Rooms with a `goal` key
and no `goal:<room-slug>` node (drift) versus rooms with the node and no key (a rejected or
deferred proposal, legitimate). Deferred because `data/doctor-modules.json` was inside Phase
344-05's `files_modified` while 344 was mid-flight at research time. Hand to Phase 346.

**(e) The `data/icm-parts.json` `jtbd-state` row.** It must record that the file now holds two
facts with two lifetimes and two producers (the JTBD classifier's `current`/`history` versus the
strategy node's `goal`/`goal_history`), and name SENS-20 and the `gate_answer` handler as
consumers, or the part row asserts a single job the file no longer has (345-ICM-CONSULT Pitfall 7
and AP-G8). Deferred for the same 344-05 mid-flight reason as (d). Hand to Phase 346.

**(f) The one line Phase 345 owes to `lib/core/navigation/CONTEXT.md` when Phase 343 R12 lands,
naming the goal's home and its anchor.** Not minted here as a second routing surface; a soft
dependency this plan set carries but does not resolve, since Phase 343 R12 has not landed in this
tree as of this close.

**(g) The `taxonomy_ladder` rung-casing mismatch** (discovered plan 06, carried forward by name
in plan 08, closed out here with a full reproduction and a named home rather than silently
dropped). The deployed Theo `taxonomy_ladder` tool's `rung` argument schema is Theo-cased
(`'IllDefined'`, `'WellDefined'`, `'UnDefined'`, `'Wicked'`); `rung-vocabulary.cjs::toLadderRung`
produces, and `taxonomy-climb.cjs::renderLadder` sends, the lowercase ladder-vocabulary form
(`'ill-defined'`), per a literal, already-ratified plan-06 acceptance criterion. Measured live
against the deployed origin (2026-09-15): the lowercase send is REJECTED (`MCP error -32602: ...
expected one of "UnDefined"|"IllDefined"|"WellDefined"|"Wicked" at rung`); the Theo-cased send
SUCCEEDS, returning a real `ladder` string and a structured `rungs` array. Functionally harmless
in production today: `_resolveLadderText` trusts only a live `.ladder` field and degrades safely
to `localLadderLine` on any other shape, so the strategy card always renders -- it just never
actually renders the Brain-decorated ladder, silently. Full reproduction:
`lib/core/strategy/strategy-card.cjs`'s own header comment; `345-06-SUMMARY.md` ("Live Finding
for Plan 08"); `345-08-SUMMARY.md` ("Live Finding Carried Forward to 345-09");
`docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md` Section 3 item (e). **Owner:** a dedicated
quick task against `lib/core/strategy/rung-vocabulary.cjs` and/or
`lib/core/strategy/taxonomy-climb.cjs::renderLadder`, reconciling which casing the wire actually
wants versus what `toLadderRung` emits -- not a drive-by edit inside this close-out plan, and not
Phase 346's to inherit silently (named explicitly in `docs/OPEN-HANDOFFS.md`'s Phase 345 row,
below).

---

## Grounding

Two langtalks source offsets, cited verbatim per `345-LANGTALKS-CONSULT.md`: **4645:4703** (blind
upward movement -- a loop cannot question its own goal) and **4810:4853** (the strategy node -- a
slower node that runs on its own cadence, analyzes outcome rates, and rewrites the goals of the
downstream execution loops). Scheduled JTBD or rung re-evaluation and stall-signal triggers are
NAMED ASSUMPTIONS with no corpus source, per `345-LANGTALKS-CONSULT.md`; they are MindrianOS
engineering doctrine, not a corpus finding.

Corrected research assumptions from `345-RESEARCH.md`:
- **A5** discharged by the ICM consult's eleven-reader enumeration (345-ICM-CONSULT, the full
  `jtbd.current`/`jtbd.history` reader walk that grounded the top-level `goal` key's placement,
  WD-2).
- **A7** ruled at R5 (345-ICM-CONSULT R5, the anchor node's type/epistemic_type/review_status
  triple, WD-7).
- **A9 WRONG.** `345-RESEARCH.md` assumed at most one `dist/` mirror needed regeneration; both
  `dist/` mirrors (`dist/generic-claude-dir/.claude/skills/larry-personality/SKILL.md` and
  `dist/zed/.agents/skills/larry-personality/SKILL.md`) exist and were regenerated (hand-copied,
  byte-identical) in plan 08, because `larry-personality` ships to both surfaces independently.
- **A6** discharged by the plan-06 liveness probe (`scripts/check-brain-tool-liveness.cjs`,
  2026-09-15T12:49:33Z, exit 0, `RESULT: OK`), with the probe's own honest scope caveat recorded
  (it enumerates the six stdio-shim Brain tools, not `taxonomy_ladder` itself) -- the probe's OK
  result did not, by itself, discharge whether `taxonomy_ladder` answers live; the plan-06 manual
  smoke test against the real deployed tool is what actually discharged A6, and it is also what
  surfaced the rung-casing mismatch named in "What stayed open" item (g).

**The research-room mirror did NOT land this session.** Per the Dev-Research Compositing rule
(`CLAUDE.md`), this reasoning trail should mirror into
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-15-phase-345-strategy-node-close-out.md`.
Attempted this session and refused by Claude Code's own `write-scope-check` PreToolUse hook
(identical class of refusal Phase 344's and Phase 347's own close-outs both hit and recorded):
the active room is `idem-room`, not `rethinking-mindrianos`
(`~/MindrianRooms/.rooms/registry.json`). The full drafted mirror content (what shipped, the
`taxonomy_ladder` casing finding restated for a room-side reader, and the cross-domain lesson --
two independent vocabulary-collision bugs in one phase, an id collision at plan-04/05 time and a
casing collision at plan-06 time, both worth naming as one pattern: a locally-declared enum
mirroring a remote tool's schema needs a live schema-correctness probe, not just a reachability
probe) is preserved in full in this close-out record's own "What stayed open" item (g) and this
Grounding section above, so no content is lost even though the second home does not yet exist.
**Owner:** the user, or a future session with `rethinking-mindrianos` set active
(`/mos:rooms switch rethinking-mindrianos`), then filing
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-15-phase-345-strategy-node-close-out.md`
with this record's own content and cross-linking it back here.
