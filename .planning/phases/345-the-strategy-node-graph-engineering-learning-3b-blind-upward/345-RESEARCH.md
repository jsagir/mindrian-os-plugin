# Phase 345: The strategy node (graph-engineering learning 3b, blind upward movement) - Research

**Researched:** 2026-09-14
**Domain:** In-repo systems engineering. The sensor spine (`dispatchSensors` -> `decide()` -> resolver), the per-room JTBD state file, the gate ratification path, the Theo egress boundary, and one doctrine edit in `skills/larry-personality/SKILL.md`.
**Confidence:** HIGH on every mechanism claim (all read in-file this session and several measured live across 30 rooms). MEDIUM on the two design questions the corpus does not answer (cadence shape, stall-signal definition), which are engineering decisions the navigator must rule.

---

## Summary

Phase 345 does not need a library. It needs five in-repo organs wired together correctly, and every one of them is already shipped. The strategy node is a **twenty-first insight sensor** plus a **new field group on an existing state file** plus **one paragraph of doctrine**. There is no new dependency, no new reach id, no schema migration, and no new database table. The whole phase is reuse.

The three hard parts are not the code. They are: (1) the sensor lockstep is **seven places**, not four, and place seven is un-gated, so a plan that misses it ships a sensor that registers, stamps, and never fires, forever, with no error; (2) the room has **no persisted problem-type rung anywhere today** and **no parent-question field on the JTBD**, so the goal-hierarchy record is genuinely net-new state that must be added additively to a file with three live shape variants in the fleet; and (3) the decision-record deliverable rests on a code path that is shipped but has **never executed in any live room**. I measured it: across 30 rooms there are 4,680 `gate_reached` events, 14,676 `reach_presented` events, 7,794 claim nodes, and **zero** `SOURCED_FROM` edges and **zero** `decision:gate:*` nodes. Phase 343 asked whether the gate path is the exception to the no-anchors finding. The honest answer is that it is not an exception and it is not a counterexample: it is an **untested path**. Its writer is correct and its callers starve it.

The climb itself is smaller than the roadmap entry implies. Theo's `classify_problem_type` **takes no parameters** (`lib/core/brain-client.cjs:1152-1155`: "the caller classifies"), and Theo's `taxonomy_ladder` is **a pure render** of the four-rung ladder with the rung the caller already picked (`/home/jsagi/Theo/src/mcp/content/index.ts:161-162`). Neither tool climbs anything for you. The classification is already local and already shipped as `brainClient._inferRungFromQuestion` (`brain-client.cjs:1184`, a named export). So the climb is: classify locally, render remotely for the card, propose at a gate.

**Primary recommendation:** Ship SENS-19 `sensorStrategyReach` reusing the `contradiction` reach id and `pull_back` posture, fed by a `decide()` ctx producer block that reads cadence and stall counts through the already-shipped `lib/core/meter/` readers over `memory_event`; extend `lib/hmi/jtbd-state.cjs` with an additive, typeof-guarded `goal` sub-object carrying `parent_question`, `rung` and `goal_version`; stamp `goal_version` onto the `reach_presented` payload; and make the proposal a real Decision Gate by minting a `goal:<slug>` anchor node so `gate_answer`'s approve branch finally has a `subject_node_id` to write `SOURCED_FROM` against. Do not mint a seventh reach id. Do not call `mcp__theo__*` directly.

---

## User Constraints

**No `345-CONTEXT.md` exists.** `/gsd-discuss-phase` has not run for this phase (`ls .planning/phases/345-*/` returns only `345-LANGTALKS-CONSULT.md`). There are therefore no locked decisions from the navigator. Everything below is either a measured repo fact, a binding constraint inherited from a shipped contract, or a flagged assumption.

### Binding constraints inherited from the langtalks consult (345-LANGTALKS-CONSULT.md)

These are not negotiable; the consult is a standing-rule output.

- Cite the founding source offsets: **4645:4703** (blind upward movement: a loop cannot question its own goal) and **4810:4853** (the strategy node: a slower node that runs on its own cadence, analyzes outcome rates, and rewrites the goals of the downstream execution loops).
- The strategy node `--part_of-->` Graph engineering, beside the Counter-metric reviewer node (Phase 343), the Arbitration node (Phase 346) and the Audit node (Phase 343). It is the "slower cadence" watcher. **It never executes; it re-aims.**
- The strategy node proposes at a Decision Gate and **never rewrites a JTBD silently**.
- The navigator's choice is a typed decision node with `SOURCED_FROM` provenance.
- Vocabulary: use Phase 344's `layer:` key. The strategy node is a **GRAPH-layer** surface.
- Two items are **named assumptions, not corpus evidence**: (a) scheduled re-evaluation of a JTBD or problem-type rung has no corpus source, and the use of `classify_problem_type` / `taxonomy_ladder` as the mechanism is MindrianOS doctrine only; (b) stall signals (repeated reaches without a new claim) as a trigger have no corpus source and are an engineering decision.

### Binding constraints inherited from CLAUDE.md and shipped contracts

See `## Project Constraints (from CLAUDE.md)` below.

---

## Project Constraints (from CLAUDE.md)

| Directive | Citation | What it forbids in this phase |
|---|---|---|
| One governed reach path: `dispatchSensors` -> `decide()` -> resolver; no second selection brain | `CLAUDE.md:152` | The strategy node may NOT get its own scheduler, its own cron, or its own dispatch loop. It is a sensor in the one registry. |
| `lib/core/navigation.cjs` is the single SQL navigation chokepoint; typed edges and `memory_event` nodes are written only through it | `CLAUDE.md:153` | No `better-sqlite3` require in the sensor, the producer block, or any new module. No direct `INSERT INTO nodes`. |
| The Brain boundary holds: LOCAL data never egresses; only generic framework handles and enums cross the wire | `CLAUDE.md:154` | The JTBD **text** never reaches Theo. Only the rung enum and, at most, a taxonomy slug. |
| No em-dashes anywhere; use hyphens | `CLAUDE.md:140` | Applies to every file this phase writes, including the SKILL.md edit. `grep -c $'\xe2\x80\x94'` must return 0. |
| CJS only, no TypeScript; every output is an inspectable edit surface | `CLAUDE.md:134` | Pure `.cjs`, node built-ins, zero new runtime deps (the Phase 87 invariant every sensor file restates). |
| Reuse before build: search the methodology surface enumerated from disk first | `CLAUDE.md:142` | The cadence, stall and counting organs already exist (see Don't Hand-Roll). Building a second one is a Canon Part 7 violation. |
| Every directory gets a `ROOM.md`; filesystem is the source of truth for room state | `CLAUDE.md:141` | The goal-hierarchy record belongs in the per-room file, not a global store. |
| GUIDED default (`feedback_larry_pedagogical_guided_first.md`, HARD RULE; `lib/core/directive-envelope.cjs:11-13`) | `directive-envelope.cjs:22`, `:70` | The strategy proposal is GUIDED by construction: it offers a reframe at a gate, it never runs AUTONOMOUS. |
| Dev-Research Compositing | `CLAUDE.md` "Dev-Research Compositing (Rethinking Room)" | Phase findings file in BOTH `.planning/phases/345-.../` and `~/MindrianRooms/rethinking-mindrianos/research/`, cross-linked. `.planning/` is gitignored (`.gitignore:97` `.planning/*`, verified with `git check-ignore -v`), so this document does not travel between machines. Anything the repo must keep goes in `docs/`. |

---

## Phase Requirements

**No requirement ids exist for Phase 345.** `.planning/ROADMAP.md:716` says `**Requirements**: TBD`. The planner mints them.

### Proposed prefix: `STRAT`

Measured as free in both repos this session.

- MindrianOS-Plugin `.planning/REQUIREMENTS.md` + `ROADMAP.md` prefixes in use: `ANCHOR AND AVAIL CACHE CANON CARRY CER CHOKE COMP CR DECISIONS ENRICH FIX FLIP FLOOR GRAPHDB GUARD HOOK ICML LAYER LOCUS MCPFIX MEMOP MOAT OQ PYPORT RADAR RECON RSEXP RSFENCE RSLOCAL SENS STEP SWEEP TAIL TB TOOLHON TRUST WIRE` (188 tracked rows).
- ProblemsWorthSolving-Brain `.planning/REQUIREMENTS.md` prefixes in use: `CONTRACT EVAL HYGIENE`.
- `STRAT` collides with neither. It also does not collide with `SENS-` (sensor ids, a different namespace) or `LAYER-` (Phase 344).

Avoid `GOAL` (reads as a Brain/Theo node label and the langtalks graph has a generic `Goals` node, per the consult's third row). Avoid `NODE`. [VERIFIED: grep over both repos' REQUIREMENTS.md and ROADMAP.md]

---

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Detect that the cadence or stall threshold is crossed | HARNESS (the ctx producer block in `decide()`) | - | The db read must run at ctx-assembly, never inside a pure sensor. Stated verbatim at `lib/core/navigation-engine.cjs:935-937`: "The db read runs HERE (ctx-assembly), NEVER inside the pure sensor (Part 8/9)." |
| Turn that crossing into a candidate reach | GRAPH (the sensor, `lib/core/sensors/sensor-strategy-reach.cjs`) | - | A sensor is pure, sync, zero-I/O, and produces a frozen scalar bag. It is the only object that crosses from the sensor layer into the navigator's decision. |
| Classify the current question's rung | LOOP (local, `brainClient._inferRungFromQuestion`) | - | Theo's `classify_problem_type` takes no parameters; the caller classifies. The classifier is already local, pure, and a named export (`brain-client.cjs:1184`). |
| Render the four-rung ladder for the card | GRAPH (Theo `taxonomy_ladder` via `brainClient.callTool`) | LOOP (local fallback on Tier 0) | It is a pure render of a rung the caller already picked. It is optional decoration; the proposal must survive Brain being unreachable. |
| Hold the room's goal and its parent question | CONTEXT (`<roomDir>/.mindrian/jtbd-state.json`) | - | The ICM nested parts are the CONTEXT layer in file form (Phase 344's own framing). The JTBD state file is the room's goal record. |
| Present the proposal as a Decision Gate | GRAPH (`gate_render` -> model -> `gate_answer`) | - | The navigator at the gate is the one reviewer node. Human-in-Command, Canon Part 9 role 5. |
| Write the ratified choice as a typed decision node | HARNESS (`navigation.writeReasoningNode` via `gate.cjs` approve branch) | - | The single SQL chokepoint owns every typed write. |
| Stamp which goal version an execution reach ran under | HARNESS (`navigation.logMemoryEvent`, `reach_presented` payload) | - | `memory_event` is the append-only bookkeeping organ and already carries the per-reach row. |
| The reframe doctrine | PROMPT (`skills/larry-personality/SKILL.md`) | - | Phase 344 WD-3 names `larry-personality/SKILL.md` as the PROMPT rung's owner surface. |

**Consequence for the planner:** the phase touches four of the five Phase 344 rungs. The sensor file itself declares `layer: graph`. The `jtbd-state.cjs` change declares `layer: context`. The SKILL.md edit lands on a `layer: prompt` surface. If Phase 344 has landed `scripts/check-layer-declaration.cjs` by execution time, every new declaring surface in this phase must carry a `layer:` key or the gate goes red (`344-01-PLAN.md` LAYER-04, fail-closed).

---

## Standard Stack

### Core: zero external packages

This phase installs **nothing**. Every organ is in-repo and shipped. That is a measured statement, not an aspiration: every row below was opened and read this session.

| Organ | File and line | What it gives Phase 345 | Why it is the standard |
|---|---|---|---|
| Sensor struct contract | `lib/core/sensors/sensor-types.cjs:43` (`REACH_IDS`), `:54` (`POSTURE_IDS`), `:237` (`makeReach`) | The frozen candidate-reach shape. `makeReach` returns `null` on an unknown reach id or posture and drops every non-primitive from `evidence` before freezing. | It is the Part-8 choke. Every sensor since Phase 173 reuses one of the six ids. |
| Sensor registry | `lib/core/insight-sensors.cjs:721` (`SENSOR_REGISTRY`, 20 members), `:781` (`SENSOR_REGISTRY_IDS`, 20 ids) | Where SENS-19 registers. | Index-parallel identity; `stampSensorId` (`:834`) reads `SENSOR_REGISTRY_IDS[i]` by position. |
| Sensor dispatch | `lib/core/insight-sensors.cjs:873` (`dispatchSensors`), membership gate at `:907`, stamp at `:912` | The one governed dispatch. | `CLAUDE.md:152`. No second selection brain. |
| Sensor priority doctrine | `lib/core/sensors/sensor-priority.cjs:134` (`SENS_PRIORITY`, four groups A-D) | Where SENS-19 ranks. | Fail-closed: omission reddens `scripts/build-connector-registry.cjs --check` and `tests/test-245-priority-complete.cjs`. |
| ctx producer convention | `lib/core/navigation-engine.cjs:901-1041` (three blocks: MED-01 cortex `:905-930`, SENS-11 expert `:931-975`, SENS-16 content `:976-1041`) | Where the db read for cadence and stall counts goes. | The governed split. Un-gated: this is the dangerous place. |
| JTBD state I/O | `lib/hmi/jtbd-state.cjs` (`getCurrent`, `setCurrent`, `history`, `isStale`, `bumpTurnCount`; `SCHEMA_VERSION = 1`, `HISTORY_MAX = 50`) | The room's goal record. Atomic tmp+rename, never throws, Canon Part 8 LOCAL by construction. | It is the only writer of `<roomDir>/.mindrian/jtbd-state.json`. Additive fields have a precedent: Phase 240 added `turn_count` and `manual_set` **without bumping `SCHEMA_VERSION`**, because every reader typeof-guards (`jtbd-state.cjs:145-148` comment). |
| JTBD taxonomy | `lib/hmi/jtbd-taxonomy.json` (13 entries, flat) | The 13 job slugs, which are enums and therefore Part-8-safe as handles. | Already treated as a safe generic handle by SENS-05 (`sensor-jtbd-reweight.cjs:113-118`). |
| Local rung classifier | `lib/core/brain-client.cjs:1184` `_inferRungFromQuestion`, markers at `:1170-1175` | Climbs the ladder without any wire call. Returns `'Wicked' \| 'UnDefined' \| 'WellDefined' \| 'IllDefined'`. | "It is PURE and LOCAL: it never sends the question anywhere, which is the whole reason it exists (Canon Part 8 - the question is user data and stays local)." (`:1157-1160`) A **named export**, not a test-only member (`brain-client.cjs` exports block). |
| Brain wire door | `lib/core/brain-client.cjs:595` `callTool`, in-process Part 8 belt at `:657-676` | The one path to `taxonomy_ladder`. | The belt classifies EVERY `callTool` payload. A direct `mcp__theo__*` call bypasses the PreToolUse hook entirely (see Pitfall 5). |
| Egress recognizer | `lib/core/part8-egress-guard.cjs:328` (`TAXONOMY_RUNGS`), `:440-447` (the `taxonomy_ladder` arm) | `taxonomy_ladder` already has a known-safe shape proof: exact keys `{rung}` required, `{question_label}` optional, rung in a closed four-value set, label 1-120 chars single-line. | Fail-closed on schema drift: an unrecognized extra key means no proof and the call gates as ambiguous. |
| memory_event log | `lib/core/navigation/memory-events.cjs:728` (`logEvent`), `:781` (`findRecentChanges`), `EVENT_TYPES` (52 members) | The cadence and stall substrate. | The one append-only bookkeeping organ. 23,736 rows fleet-wide is the largest node population (343 consult). |
| Counts readers | `lib/core/meter/gate-density-reader.cjs:95` `computeInvocationDensity`; `lib/core/meter/transfer-reader.cjs`; `lib/workflow/reach-reject-reader.cjs:142` `presentationsCount`, `:185` `rejectCountInWindow` | **Pure, Part-8-safe, injection-seamed counters over `memory_event`.** Exactly the stall signal, already built. | They open no db, make no remote call, read only enums and scalars via `navigation.findRecentChanges`, prefer a `roomState.<counter>` injection seam so tests run db-free, and return a zeroed cold-start object on fault. |
| Throttle precedent | `lib/core/breakthrough/canary.cjs:85-124` (`computeDismissalRate`, `isThrottled`, `emitThrottleEvent`) | The cool-down shape: a rate over a window, a minimum sample, a threshold constant, and a `*_throttled` memory_event carrying the scalars so `/mos:doctor` can find it. | It is the shipped answer to "a watcher that fires too often". Per-kind isolation enforced inside the rate computation so one drifting detector cannot throttle siblings. |
| Gate ladder | `lib/mcp/gate-render.cjs` (`SUPERSET_SCHEMA:66`, `normalizeCard`, `MAX_EVIDENCE_NODE_IDS = 64`), `lib/mcp/tools/gate.cjs:112` (`gate_render`), `:242-312` (the approve branch) | The proposal card and the ratification write. | Three-rung renderer ladder, one canonical `{gate_id, chosen, verdict}` answer shape. |
| Typed decision writer | `lib/core/navigation/reasoning-write.cjs:106` `writeReasoningNode`, targets built at `:160-177`, `SOURCED_FROM` written at `:182-190` | The typed decision node with provenance. | It is the ONLY `SOURCED_FROM` writer in the repository. |
| Node id minting | `lib/core/navigation/reasoning-write.cjs:89` `REASONING_NODE_ID(kind, key)` | `decision:gate:<gate_id>`, and by the same idiom `goal:<slug>`. | Re-exported through the chokepoint at `lib/core/navigation.cjs:237`. |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| A twenty-first sensor in `SENSOR_REGISTRY` | A standalone scheduler or a hook that fires on a timer | Violates `CLAUDE.md:152` (one governed reach path). Also invisible to `SENS_PRIORITY`, to the Part-8 sweep, and to the routing fence. **Reject.** |
| Reusing the `contradiction` reach id | Minting a seventh reach id, e.g. `strategy` | The 343 ICM consult calls this "the single most expensive change in this subsystem": it touches `sensor-types.cjs`, all 20 sensors, `dispatchSensors:907`, `isReachEligibleForTurn`, `skills/larry-personality/SKILL.md`, `lib/hmi/dial-reach-orchestrator.cjs:123-139`, `lib/workflow/reach-reject-reader.cjs:40-47`, and every render surface. The six ids are a UI contract as much as a code one. **Reject.** |
| Reusing `contradiction` | Reusing `context_block` | `context_block` is the "pull the room's own facts" reach; SENS-05 already owns the JTBD-change row on it. `contradiction` is the reach whose product meaning is "something in your frame disagrees with itself", which is precisely a stale goal. `contradiction` is also not turn-stage gated (only `brain_consult` and `deep_research` are, `insight-sensors.cjs:908-911`). **Prefer `contradiction`, MEDIUM confidence, put to the navigator.** |
| A `goal` sub-object on `jtbd-state.json` | A new `goal-state.json` file | A second file is a second producer and a second ICM part row, and it splits the goal across two homes. `jtbd-state.cjs` already owns the atomic write, the history ring, the staleness predicate, and the manual-override window. **Reject the second file.** |
| Bumping `SCHEMA_VERSION` to 2 | Additive typeof-guarded fields at v1 | Phase 240 set the precedent explicitly and wrote down why (`jtbd-state.cjs:145-148`): additive fields plus typeof-guarded readers means a legacy file behaves exactly as before. 20 of 30 live rooms have no `jtbd-state.json` at all and the 10 that do carry a `current` object with **only** `jtbd/confidence/entered_at/evidence/expires_at` (measured this session). **Stay at v1.** |
| Calling Theo's `taxonomy_ladder` via `brainClient.callTool` | Calling `mcp__theo__taxonomy_ladder` directly from the model | The plugin's PreToolUse egress hook matcher is `mcp__(?:(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain\|pws-brain-mcp)__.*\|[a-z0-9_-]+__brain_[a-z0-9_]+)` (`hooks/hooks.json:225` and `:327`). `theo` is not in the two-member server alternation, and `taxonomy_ladder` does not start with `brain_`, so **a direct Theo call matches neither arm and is never scanned.** Theo's own `z.strictObject` is the only defence in that case, which Theo's source says in those words. **Reject the direct call. Route through `callTool`.** |

**Installation:** none. Confirm with `git diff --stat package.json` returning nothing at phase close.

---

## Package Legitimacy Audit

**Not applicable: this phase installs zero external packages.**

The repo's standing invariant (Phase 87, restated in the header of every sensor file, e.g. `sensor-jtbd-reweight.cjs:36`) is "pure CJS, node built-ins + project libs only, no new deps". Nothing in the deliverables requires a package. `slopcheck` was therefore not run and no registry lookup was performed, because there is no candidate to check.

**If a plan proposes a package:** that plan is out of scope for this phase and must be raised as a design fork before execution. The acceptance check is `git diff package.json` empty at phase close.

---

## Architecture Patterns

### System architecture diagram

```
                         ROOM STATE (CONTEXT layer)
                <roomDir>/.mindrian/jtbd-state.json
                  current: { jtbd, confidence, entered_at,
                             evidence, expires_at,
                             turn_count, manual_set,
                +NEW-->     goal: { parent_question,
                                    rung, goal_version,
                                    set_at, set_by } }
                                        |
                                        | getCurrent()  (read only, enum/scalar)
                                        v
  room.db memory_event log  ---->  decide() ctx-assembly            <-- HARNESS
  (gate_reached 4,680,             navigation-engine.cjs:901-1041
   reach_presented 14,676,             [ SENS-19 PRODUCER BLOCK ]
   f_selector_decision,               reads via navigation chokepoint:
   status_promoted,                     reachesSinceLastProposal
   node_created)                        claimsSinceLastProposal
        ^                                artifactsSinceLastProposal
        |                                unresolvedContradictions
        | logMemoryEvent                 strategyCooldownActive
        |                                     |
        |                                     v  flat scalars on sensorCtx
        |                          dispatchSensors(turn, tuple, sensorCtx)   <-- GRAPH
        |                          insight-sensors.cjs:873
        |                                     |
        |                          [ sensorStrategyReach ]  pure, sync, zero I/O
        |                          returns makeReach({
        |                            reach_id: 'contradiction',
        |                            posture:  'pull_back',
        |                            dispatch: 'strategy-reach (jtbd re-aim)',
        |                            companions: ['ADDRESSES_PROBLEM_TYPE:<enum>',
        |                                         'serves_jtbd:<slug>'],
        |                            signal:   'goal_staleness',
        |                            evidence: { reaches_since, claims_since,
        |                                        goal_version, rung, cooldown }
        |                          }) or null
        |                                     |
        |                          membership gate  :907
        |                          turn-stage gate  :910
        |                          stampSensorId    :912  ('SENS-19')
        |                                     |
        |                                     v
        |                          scored re-order + resolveFireSkill
        |                                     |
        |                    +----------------+----------------+
        |                    |                                 |
        |                    v                                 v
        |          LOCAL rung climb                   Theo render (OPTIONAL)
        |          brainClient._inferRungFromQuestion  brainClient.callTool(
        |          pure, no wire                         'taxonomy_ladder',
        |          brain-client.cjs:1184                 { rung: <4-value enum>,
        |                    |                             question_label?: <slug> })
        |                    |                          in-process Part 8 belt :657
        |                    |                          known_tool_shape proof :440
        |                    |                          Tier 0 -> omit the render
        |                    +----------------+----------------+
        |                                     |
        |                                     v
        |                        gate_render (GRAPH, the one reviewer node)
        |                        card.header      = the reframe, one line
        |                        card.options     = keep / rewrite / change rung / defer
        |                        card.subject_node_id  = 'goal:<room-slug>'   <-- LOAD BEARING
        |                        card.evidence_node_ids = [the claim/artifact ids
        |                                                  the producer collected]
        |                                     |
        |                          navigator answers (Human-in-Command)
        |                                     v
        |                        gate_answer  tools/gate.cjs:218
        |                          verdict === 'approve'  -> :242
        |                            navigation.writeReasoningNode(db, {
        |                              nodeId: REASONING_NODE_ID('decision:gate', gate_id),
        |                              nodeType: 'decision',
        |                              epistemicType: 'decision',
        |                              subjectNodeId:  card.subjectNodeId,     -> SOURCED_FROM
        |                              evidenceNodeIds: card.evidenceNodeIds,  -> SOURCED_FROM
        |                              origin: 'gate_answer' })   reasoning-write.cjs:182-190
        |                            navigation.confirmNode(...)   gate.cjs:301
        |                                     |
        |                        approve AND the chosen option is a rewrite
        |                                     v
        +---------------- jtbdState.setCurrent(roomDir, { ..., goal: {...} })
                          goal_version incremented, history row appended
```

### Recommended file layout

```
lib/core/sensors/
  sensor-strategy-reach.cjs      # SENS-19: pure, sync, zero I/O
lib/core/
  insight-sensors.cjs            # require + SENSOR_REGISTRY + SENSOR_REGISTRY_IDS + exports
  navigation-engine.cjs          # the SENS-19 ctx producer block, after the SENS-16 block
lib/core/sensors/
  sensor-priority.cjs            # SENS_PRIORITY, Group A
lib/core/strategy/               # NEW dir, if the cadence math needs a home
  goal-cadence.cjs               # pure: thresholds + shouldPropose(counts) -> bool
lib/hmi/
  jtbd-state.cjs                 # additive goal sub-object + setGoal/getGoal
data/
  icm-parts.json                 # the jtbd-state row gains the goal field (Phase 344 dep)
skills/larry-personality/
  SKILL.md                       # the doctrine edit, at line 77
tests/
  test-345-strategy-sensor.cjs
  test-345-goal-record.cjs
  test-345-lockstep.cjs
  test-345-gate-anchor.cjs
  run-all-345.sh
```

### Pattern 1: register a sensor (SEVEN places, not four)

This table is the 343 ICM consult's binding correction (`343-ICM-CONSULT.md:121-133`, R1 BLOCKING at `:496`). It is reproduced here because a plan that ships four edits is wrong in two different ways.

| # | Place | Citation | Fail mode if omitted |
|---|---|---|---|
| 1 | New detector file `lib/core/sensors/sensor-strategy-reach.cjs` | new file | - (but it is auto-covered by the Part-8 sweep and the routing fence, both of which glob `lib/core/sensors/*.cjs`: free) |
| 2 | `require` line at the top of `lib/core/insight-sensors.cjs` | `insight-sensors.cjs` head | ReferenceError at module load |
| 3 | `SENSOR_REGISTRY` append | `insight-sensors.cjs:721-754` | Sensor never runs |
| 4 | `SENSOR_REGISTRY_IDS` append, **SAME index** | `insight-sensors.cjs:781-802` | **Silently mis-stamps every reach after that index** (`stampSensorId:834` reads by position) |
| 5 | `module.exports` append | `insight-sensors.cjs:918` onward | Unreachable by name. Phase 245-01 found `sensorRoomPick` in exactly this state (`insight-sensors.cjs:952-957`) |
| 6 | `SENS_PRIORITY` append, **Group A** | `lib/core/sensors/sensor-priority.cjs:134-160` | **Build goes RED** at `scripts/build-connector-registry.cjs:1139-1149` and `tests/test-245-priority-complete.cjs` |
| 7 | **ctx producer block** in `decide()` | `lib/core/navigation-engine.cjs:901-1041`, append after the SENS-16 block ending at `:1041` | **Sensor loads, registers, stamps, and never fires. No error, ever.** Nothing checks this. |
| 8 | (optional) `sensor_triggers: [SENS-19]` in a command frontmatter, then regenerate `data/connector-registry.json` | `build-connector-registry.cjs:596,625` | No command surface declares the sensor |

**SENS_PRIORITY placement is a doctrine decision, not an append.** The table is grouped A-D by durability (`sensor-priority.cjs:100-133`). Group A is "confirmed room-state / projected-cortex facts". A measured count of reaches and claims over the persisted `memory_event` log is a confirmed room-state fact, so **SENS-19 belongs in Group A**, not at the end. Placing it in Group D by reflex would rank a measured structural fact below bm25 lexical relevance, which Canon Part 11 R3 forbids.

### Pattern 2: the ctx producer block

Copy the SENS-11 block (`navigation-engine.cjs:931-975`) structurally, not the SENS-16 block: SENS-11 is the clean example of "read room.db through a caller-threaded handle and thread flat scalars plus one LOCAL candidate list onto `sensorCtx`".

```javascript
// Source: lib/core/navigation-engine.cjs:931-975 (the SENS-11 shape), verbatim idiom
// Phase 345 producer (SENS-19): derive the cadence + stall scalars
// sensorStrategyReach reads. The db read runs HERE (ctx-assembly), NEVER
// inside the pure sensor (Part 8/9). The engine does not OPEN room.db; it
// uses the caller-threaded handle (ctx.roomDb). Caller-threaded ctx.*
// scalar overrides win (the test seam). Defensive; never throws.
{
  let reachesSince = 0;
  let claimsSince = 0;
  let unresolvedContradictions = 0;
  const roomDb = (ctx.roomDb && typeof ctx.roomDb.prepare === 'function') ? ctx.roomDb : null;
  if (roomDb) {
    try {
      const since = readLastProposalEpochMs(roomDb); // via findRecentChanges
      const counts = computeStrategyCounts(roomDb, since);
      reachesSince = counts.reaches_since;
      claimsSince = counts.claims_since;
      unresolvedContradictions = counts.unresolved_contradictions;
      // LOCAL candidate list for the gate handler ONLY; never ridden on the reach.
      sensorCtx.strategyEvidenceCandidates = counts.candidates;
    } catch (_e) {
      // soft-fail: degrade to no strategy signal
    }
  }
  sensorCtx.reachesSinceLastProposal =
    (typeof ctx.reachesSinceLastProposal === 'number' && ctx.reachesSinceLastProposal >= 0)
      ? ctx.reachesSinceLastProposal : reachesSince;
  sensorCtx.claimsSinceLastProposal =
    (typeof ctx.claimsSinceLastProposal === 'number' && ctx.claimsSinceLastProposal >= 0)
      ? ctx.claimsSinceLastProposal : claimsSince;
  sensorCtx.unresolvedContradictions =
    (typeof ctx.unresolvedContradictions === 'number' && ctx.unresolvedContradictions >= 0)
      ? ctx.unresolvedContradictions : unresolvedContradictions;
  if (!Array.isArray(sensorCtx.strategyEvidenceCandidates)) {
    sensorCtx.strategyEvidenceCandidates = [];
  }
}
```

Three properties of this idiom are load-bearing and must be preserved: the `ctx.*` override wins (that is the test seam that lets a unit test fire the sensor with no db and no fixture); the whole block is wrapped so it degrades to no signal rather than throwing; and the candidate node-id list rides `sensorCtx`, never the reach (the reach is a flat scalar bag and `makeReach` would drop the array anyway, `sensor-types.cjs:257-267`).

### Pattern 3: the sensor itself

Model on `lib/core/sensors/sensor-jtbd-reweight.cjs` (SENS-05). It is the closest sibling: same state file, same Part-8 posture, same companion-handle vocabulary.

```javascript
// Source: lib/core/sensors/sensor-jtbd-reweight.cjs:94-140 (the shape), adapted
const { makeReach } = require('./sensor-types.cjs');
const jtbdState = require('../../hmi/jtbd-state.cjs');

function sensorStrategyReach(_turn, tuple, ctx) {
  const roomDir = (ctx && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
  if (!roomDir) return null;

  // Cool-down first: a watcher that nags is worse than no watcher.
  if (ctx.strategyCooldownActive === true) return null;

  const reaches = (typeof ctx.reachesSinceLastProposal === 'number') ? ctx.reachesSinceLastProposal : 0;
  const claims  = (typeof ctx.claimsSinceLastProposal === 'number') ? ctx.claimsSinceLastProposal : 0;
  const stuck   = (typeof ctx.unresolvedContradictions === 'number') ? ctx.unresolvedContradictions : 0;

  const cadenceDue = reaches >= STRATEGY_CADENCE_REACHES;
  const stalled    = reaches >= STALL_MIN_SAMPLE && claims === 0;
  if (!cadenceDue && !stalled && stuck < STALL_CONTRADICTION_FLOOR) return null;

  const current = jtbdState.getCurrent(roomDir);
  const slug = (current && typeof current.jtbd === 'string') ? current.jtbd : '';
  if (!slug) return null;                       // no goal set -> nothing to re-aim
  const goal = (current && current.goal && typeof current.goal === 'object') ? current.goal : null;
  const rung = (goal && typeof goal.rung === 'string') ? goal.rung : 'unclassified';
  const goalVersion = (goal && typeof goal.goal_version === 'number') ? goal.goal_version : 0;
  const pt = (tuple && typeof tuple.problem_type === 'string' && tuple.problem_type)
    ? tuple.problem_type : 'undefined';

  return makeReach({
    reach_id: 'contradiction',
    posture: 'pull_back',                       // climb, do not push
    dispatch: 'strategy-reach (jtbd re-aim)',
    companions: ['serves_jtbd:' + slug, 'ADDRESSES_PROBLEM_TYPE:' + pt],
    signal: cadenceDue ? 'goal_cadence_due' : 'goal_stall',
    // LOCAL scalars only: counts + taxonomy enums. No evidence text, no prose.
    evidence: {
      jtbd: slug, rung: rung, goal_version: goalVersion,
      reaches_since: reaches, claims_since: claims,
      unresolved_contradictions: stuck, problem_type: pt,
    },
  });
}
module.exports = { sensorStrategyReach: sensorStrategyReach };
```

`pull_back` is the right posture and it is not a stylistic choice. `skills/larry-personality/SKILL.md:198` defines the three-value Hierarchical Navigator axis; `push_forward` means "the insight earned its evidence, Larry advances". A strategy reach is the opposite move: stop advancing and re-examine the target. [ASSUMED, MEDIUM: `pull_back` versus `hold`. `hold` is what SENS-05 uses for a JTBD change. Put to the navigator.]

### Pattern 4: the additive goal record

```javascript
// The additive sub-object on jtbd-state.json `current`. SCHEMA_VERSION stays 1,
// per the Phase 240 precedent recorded at lib/hmi/jtbd-state.cjs:145-148.
current.goal = {
  parent_question: '<the rung-above question, LOCAL prose, never egresses>',
  rung: 'IllDefined',        // one of the four Theo rung ids (see Pitfall 4)
  goal_version: 3,           // monotonically increasing; 0 or absent = pre-345
  set_at: '2026-09-14T...Z',
  set_by: 'gate_answer',     // or 'manual' or 'inferred'
};
```

Every reader must typeof-guard, exactly as `bumpTurnCount` does (`jtbd-state.cjs:213-216`). Do not add a required field. Do not bump `SCHEMA_VERSION`. **Measured fleet state (2026-09-14): 10 of 30 rooms have a `jtbd-state.json` at all; the 10 that do carry a `current` with only `jtbd/confidence/entered_at/evidence/expires_at` and NOT the Phase 240 `turn_count`/`manual_set` fields.** So the live fleet already exercises the "legacy file, missing additive fields" path, and every new field will be absent on 100 percent of live rooms on day one.

The parent question is **room content** (it is prose about the venture). It stays local. It never rides a reach, never rides a companion handle, and never reaches Theo. Only the **rung enum** and the **taxonomy slug** may cross.

### Pattern 5: making the gate write a real anchor

This is the deliverable with the biggest gap between the design and the shipped reality, so it gets its own pattern.

`gate_answer`'s approve branch (`lib/mcp/tools/gate.cjs:242-312`) already does exactly what the roadmap asks: it mints `decision:gate:<gate_id>`, calls `navigation.writeReasoningNode` with `subjectNodeId: live.card && live.card.subjectNodeId` and `evidenceNodeIds: live.card && live.card.evidenceNodeIds` (`:283-285`), and promotes to `confirmed` via `navigation.confirmNode` (`:301`). `writeReasoningNode` then writes one `SOURCED_FROM` edge per de-duplicated target, capped at 64, never self-edging (`reasoning-write.cjs:160-190`).

**But the writer has a stated floor**: "Empty list -> zero calls, the design's own never fabricate provenance floor (T-i2x-01 / T-i2x-02)" (`reasoning-write.cjs:162-164`). And the card fields are **optional model-supplied parameters that callers rarely set** (`gate-render.cjs:80-92`: "Nothing in this task READS these fields").

Measured live across all 30 rooms in `~/MindrianRooms`, 2026-09-14:

| Measure | Count |
|---|---|
| `SOURCED_FROM` edges, fleet-wide | **0** |
| `decision:gate:*` nodes, fleet-wide | **0** |
| `gate_reached` memory_events | 4,680 |
| `reach_presented` memory_events | 14,676 |
| `claim` nodes | 7,794 |

So the honest answer to the phase brief's question "say whether the gate path is the exception": **the gate path is not an exception and not a counterexample. It is an untested path.** The approve branch (quick task 260903-i2x, in the tree as of 2026-09-03) has never produced a node in any live room. `gate_reached` fires 4,680 times from `scripts/intent-classifier.cjs:2401` at gate-render time, which is a different surface from the `gate_answer` MCP tool; the two do not connect today.

**Therefore Phase 345 must do three things the roadmap entry does not say out loud:**

1. **Mint the anchor node before rendering the card.** A `goal:<room-slug>` node written through `navigation.writeReasoningNode` (or `insertNode` via the chokepoint) gives `card.subject_node_id` something real to point at. Without it, `writeReasoningNode`'s honest floor produces zero edges and the deliverable is unmet while every test still passes.
2. **Populate `evidence_node_ids` from `sensorCtx.strategyEvidenceCandidates`.** The producer block already has the node ids in hand (that is what the LOCAL candidate list is for, per the SENS-11 and SENS-16 precedent). The cap is 64 (`gate-render.cjs:57`).
3. **Prove the write end to end with a fixture, not a citation.** The acceptance test must open a fixture room.db, drive `gate_render` -> `gate_answer(approve)`, and assert `SELECT COUNT(*) FROM edges WHERE type='SOURCED_FROM'` is greater than zero and that the `decision:gate:*` node exists with `review_status='confirmed'`. Anything less re-ships the same zero.

### Anti-patterns to avoid

- **A second scheduler.** Any timer, cron, hook, or background loop that fires the strategy reach outside `dispatchSensors` is a second selection brain and violates `CLAUDE.md:152`.
- **An async sensor.** A Promise satisfies `typeof === 'object'` but has `reach_id === undefined`, so `dispatchSensors:907` drops it with **no throw and no log**. `sensor-roadmap-type.cjs:40-47` documents this because someone hit it.
- **A db read inside the sensor.** The split is stated verbatim at `navigation-engine.cjs:935-937`. A sensor that requires `better-sqlite3` also trips the Part-8 sweep.
- **A `navigation-engine` require inside the sensor file.** The routing fence sweep (`tests/test-sensors-routing-fence.cjs`) greps `lib/core/sensors/*.cjs` for `navigation-engine` expecting zero hits.
- **Sending the parent question to Theo.** `taxonomy_ladder`'s `question_label` is a capped free-text field. It is capped for hygiene, not as a content defence (`part8-egress-guard.cjs:344-347` says so in those words). The content defence is the default-deny scan that runs first. Putting the room's actual question there is a Canon Part 8 breach even if the scan happens to pass it.
- **A silent rewrite.** The consult forbids it and so does GUIDED-first. `setCurrent` on the goal path runs ONLY from the gate's approve branch.
- **Firing on turn 1 of a cold room.** `contradiction` is not turn-stage gated (`insight-sensors.cjs:908-911`), so the sensor itself must refuse when there is no goal set and no history. A strategy node that re-aims a goal that was set four turns ago is the nagging loop, not the fix.

---

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---|---|---|---|
| Count how many reaches / gates / claims happened since a timestamp | A bespoke SQL counter in the producer block | `lib/core/meter/gate-density-reader.cjs:95` and `lib/workflow/reach-reject-reader.cjs:142,185`, or `navigation.findRecentChanges` directly | They already handle the null-db cold path, the injection seam for db-free tests, the `READ_LIMIT` bound, the enum-only read discipline, and the never-throw contract. Re-implementing means re-deriving four guards. |
| A room session counter | A new counter file or a new `EVENT_TYPES` member | Derive from `reach_presented` / `gate_reached` counts, or from `lib/core/user-archetype.cjs:225` `getSessionCount` | `sessionstart_coordinator_run` is **declared in `EVENT_TYPES` (`memory-events.cjs:145`) and written by nothing** (grep across the repo returns only the declaration). It is a ghost. Do not build on it without writing the producer first, and if you write the producer, say so as a separate task. `user-archetype.getSessionCount` reads `.context/analytics.json` with a `last-session.md` fallback and returns 0 on a cold room. |
| Cool-down / anti-nag throttling | A new debounce module | `lib/core/breakthrough/canary.cjs:85-124` (rate over a window, minimum sample, threshold constant, `*_throttled` memory_event) or `lib/core/auto-commit-throttle.cjs` (pure ledger throttle, zero fs) | Both are pure, both are shipped, both already solved "do not storm". `canary.cjs` also demonstrates per-kind isolation so one detector cannot throttle its siblings. |
| "The navigator already said no to this" suppression | A rejection tracker | `lib/workflow/reach-reject-reader.cjs:185` `rejectCountInWindow` (REJECT-only, DEFER and PIVOT never contribute) plus `lib/workflow/selector-decisions.cjs` | It is the shipped Phase 158 suppression loop, reach-keyed, already Part-8 clean (it reads the presence of `properties.reason`, never the string). |
| Classify a question's problem-type rung | A new classifier, or a wire call | `brainClient._inferRungFromQuestion(question)` (`brain-client.cjs:1184`, named export) | Pure, local, zero network, with a fixed and documented precedence (Wicked > UnDefined > WellDefined > IllDefined) and multi-word substring versus single-word word-boundary matching already handled. Theo's `classify_problem_type` takes no arguments, so there is no remote alternative. |
| Render the four-rung ladder | Hardcode the four rungs in the card | `brainClient.callTool('taxonomy_ladder', { rung })` with a local Tier-0 fallback | The rung set is already a closed enum in two places (`part8-egress-guard.cjs:328` and Theo's own schema). Hardcoding a third copy is a drift surface. |
| Atomic per-room state writes | `fs.writeFileSync` on `jtbd-state.json` | `lib/hmi/jtbd-state.cjs` `setCurrent` / `writeStateAtomic` | Same-dir tmp + POSIX-atomic `rename(2)`, pid+hrtime collision-free suffix, bounded history, never throws, manual-override window. All of it already written and already tested. |
| A typed decision node with provenance | A direct `INSERT` or a new writer | `navigation.writeReasoningNode` | It is the only `SOURCED_FROM` writer in the repo and it already caps at 64 targets, de-dupes first-wins, refuses self-edges, and never lets an edge failure fail the node write. |
| A gate card | A bespoke AskUserQuestion payload or an ASCII box | `gate_render` (`lib/mcp/tools/gate.cjs:112`) via the three-rung ladder in `lib/mcp/gate-render.cjs` | 307 files assume the host card; the superset schema and the single canonical `{gate_id, chosen, verdict}` answer shape exist precisely so nothing mints a second renderer. Larry's own system prompt forbids drawing an ASCII box. |

**Key insight:** the strategy node is a composition phase, not a construction phase. Every primitive it needs was built for something else and is sitting idle. The `lib/core/meter/` family in particular was built in Phase 183 to answer "how often did the intelligence fire and did it transfer", which is almost exactly the question a strategy node asks about its own downstream loops. The risk in this phase is not that something is missing. It is that a plan will rebuild what is already there because it did not know to look in `lib/core/meter/`.

---

## Runtime State Inventory

Phase 345 is not a rename, but it does change the shape of state that already exists in the live fleet, so the same discipline applies.

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | `<roomDir>/.mindrian/jtbd-state.json`: present in **10 of 30 rooms**; all 10 carry `version: 1` and a `current` object with exactly `jtbd, confidence, entered_at, evidence, expires_at` (no `turn_count`, no `manual_set`). Fleet room.db: 7,794 claim nodes, 23,736+ memory_event nodes, **0** `SOURCED_FROM` edges, **0** `decision:gate:*` nodes. | **Code edit only, no data migration.** The `goal` sub-object is additive and absent-by-default; `goal_version` reads as 0 when missing. Do NOT write a backfill script. The 20 rooms with no state file at all must stay working: `getCurrent` returns `null` and the sensor returns `null`. |
| **Live service config** | Theo (`https://theo-mcp.onrender.com`, `brain-client.cjs` `THEO_ORIGINS`) registers `taxonomy_ladder` and `classify_problem_type` as content tools (`/home/jsagi/Theo/src/mcp/content/index.ts:149-162`). Nothing in Theo changes for this phase. | **None.** Read-only use of two existing tools. If a plan wants a new Theo tool, that is a two-repo phase and out of scope. |
| **OS-registered state** | None. No hook registration, no Task Scheduler entry, no pm2 process is added. The sensor rides the existing `dispatchSensors` call in `decide()`. | **None. Verified by:** the phase adds no entry to `hooks/hooks.json` and no new bin. |
| **Secrets and env vars** | No new secret. The Brain key path (`lib/core/resolve-brain-key.cjs`) is unchanged; `callTool` already resolves it. | **None. Verified by:** the phase makes no new authenticated surface. |
| **Build artifacts / generated files** | `data/connector-registry.json` is generated by `scripts/build-connector-registry.cjs` and carries a `sensor_index`. If any command declares `sensor_triggers: [SENS-19]`, the registry must be regenerated or `--check` goes red. `data/command-registry.json` similarly if a `layer:` key is added to a command. `dist/` bundles mirror `skills/` (there are `dist/generic-claude-dir/.claude/skills/` and `dist/zed/.agents/skills/` copies of `pws-brain/SKILL.md`), so a `larry-personality/SKILL.md` edit may need a `scripts/build-dist-bundles.cjs` run. | **Regenerate, do not hand-edit.** Add both regenerations to the phase gate. Check whether `dist/` carries a `larry-personality` copy before assuming it does not. |

---

## Common Pitfalls

### Pitfall 1: the un-gated seventh lockstep place

**What goes wrong:** the sensor file is written, required, registered in both arrays at matching indices, exported, and priority-ranked. Every gate is green. The build passes. `tests/test-245-priority-complete.cjs` passes. And the sensor never fires, because nothing ever writes `sensorCtx.reachesSinceLastProposal`, so it reads `undefined`, the threshold comparison is false, and it returns `null` on every turn for the rest of time.

**Why it happens:** places 3, 4, 5 and 6 are all gated by a build check or a test. Place 7 is gated by nothing (`343-ICM-CONSULT.md:131`, "nothing - this one is silent").

**How to avoid:** pin it with a test that calls `decide()` with a seeded room handle and asserts a reach comes back with `evidence.sensor_id === 'SENS-19'`, **not** a test that calls `sensorStrategyReach` directly with a hand-built ctx. A direct-call unit test passes with place 7 missing. That is the exact failure this pitfall describes.

**Warning signs:** the plan's task list has four or five file edits for the sensor. The acceptance criteria mention `sensorStrategyReach(...)` but never `decide(...)`.

### Pitfall 2: the anchor that is not there

**What goes wrong:** the plan wires the proposal to `gate_render` and the approve branch to `writeReasoningNode`, ships, and produces zero `SOURCED_FROM` edges, because the card carried no `subject_node_id` and no `evidence_node_ids`, and the writer's honest floor produced zero edges (`reasoning-write.cjs:162-164`).

**Why it happens:** the write path looks complete when you read `gate.cjs:280-290`. The starvation is upstream and is invisible unless you read `gate-render.cjs:80-92` and notice both fields default to null and `[]`.

**How to avoid:** mint the `goal:<slug>` anchor node **before** the card. Assert on edge rows in a fixture, never on the return value of `writeReasoningNode` alone (it returns `ok: true` with `edges_written: 0` and that is a success from its own point of view).

**Warning signs:** an acceptance criterion phrased as "gate_answer returns `reasoning_node.ok === true`". That criterion is satisfied by a node with no edges.

### Pitfall 3: the sensor that becomes the nagging loop

**What goes wrong:** the strategy reach fires every few turns, the navigator dismisses it every time, and within a week it is the thing the user has learned to ignore. This is the exact failure mode the arbitration-node phase (346) already has a live WATCH item for: `feedback_1_15_enforcement_regression_watch.md`, 2026-07-02, "Larry feels less like Larry since v1.15.beta.x, hard-fail checks may have replaced judgment".

**Why it happens:** cadence design is deferred to "tune later" and the default threshold is set low so the sensor is easy to demo.

**How to avoid:** ship the cool-down **in the same plan as the sensor**, not after it. Three mechanisms already exist and should be composed rather than picked:

1. **A hard minimum interval.** No proposal within N reaches of the last one, read from the `reach_presented` log. `presentationsCount` (`reach-reject-reader.cjs:142`) is the counter.
2. **A dismissal-rate throttle.** Copy `canary.cjs:85-96`: over a trailing window of fires, if the dismissal rate exceeds a threshold AND the sample is at least a floor, stop firing and write a `*_throttled` memory_event so `/mos:doctor` can find it.
3. **Reject-keyed suppression.** `rejectCountInWindow(db, 'contradiction', ...)` already answers "the navigator has said no to this reach N times recently", and it correctly excludes DEFER and PIVOT (`reach-reject-reader.cjs:14-17`).

Also: put the threshold constants in one named place with a comment saying what the number means, the way `canary.cjs` does with `D19_DISMISSAL_THRESHOLD`, `D19_FIRE_WINDOW` and `D19_MIN_SAMPLE`. A magic number inside an `if` is untunable.

**Warning signs:** the plan has a single `STRATEGY_CADENCE = 5` constant and no dismissal path.

### Pitfall 4: two rung vocabularies that do not match

**What goes wrong:** the code classifies with `_inferRungFromQuestion`, gets `'IllDefined'`, passes it to `callTool('taxonomy_ladder', { rung: 'IllDefined' })`, and the egress guard's known-shape proof fails, because `TAXONOMY_RUNGS` is `{'undefined', 'ill-defined', 'well-defined', 'wicked'}` (`part8-egress-guard.cjs:328`). The call does not get blocked; it falls through to the terminal catch-all as **ambiguous**, which proceeds with a disclosure. So it works, quietly, in the degraded mode, and nobody notices until the disclosure shows up in a transcript.

**Why it happens:** three rung vocabularies coexist in this repo and none of them is obviously canonical:

| Vocabulary | Values | Where |
|---|---|---|
| Theo problem-type ids | `Wicked`, `UnDefined`, `WellDefined`, `IllDefined` | `brain-client.cjs:1170-1175` (`_RUNG_MARKERS`), `_normalizeBrainProblemType` aliases |
| Egress-guard ladder rungs | `undefined`, `ill-defined`, `well-defined`, `wicked` | `part8-egress-guard.cjs:328` |
| Incumbent canonical names | `Undefined Problem`, `Ill-Defined Problem`, `Well-Defined Problem` | `part8-egress-guard.cjs:335-338` (`RECOMMEND_CHAIN_PROBLEM_TYPES`, the live-during-cutover union) |

**How to avoid:** write one explicit mapping function with a test that asserts a round trip for all four rungs and asserts that `classify()` returns `verdict: 'allow'` with `reason: 'taxonomy_ladder rung enum'` (the test `tests/test-260906-fda-known-tool-shapes.cjs:95` already pins that reason literal as stable). Store the persisted `goal.rung` in exactly one of the three vocabularies and say which in the module header.

**Warning signs:** a rung string appears in more than one plan task with different capitalization.

### Pitfall 5: the Theo call that skips the guard

**What goes wrong:** a plan has the model call `mcp__theo__taxonomy_ladder` directly, because that is what the test file's constant looks like. The plugin's PreToolUse Part 8 egress hook never runs on it.

**Why it happens:** the hook matcher is `mcp__(?:(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*|[a-z0-9_-]+__brain_[a-z0-9_]+)` (`hooks/hooks.json:225` and `:327`). `theo` is not in the closed two-member server alternation, and `taxonomy_ladder` does not start with `brain_`, so neither arm matches. Theo's own source says this in its own words: "MindrianOS-Plugin's Part 8 egress guard DOES NOT SCAN `mcp__theo__*` under EITHER of Theo's possible registration shapes, because two independent name tests both require a closed two-member server-name alternation that `theo` is not in. So `z.strictObject` in the content registrar is not defence in depth here, IT IS THE DEFENCE." (`/home/jsagi/Theo/src/mcp/content/index.ts:194-201`).

**How to avoid:** the climb goes through `brainClient.callTool`, which applies the in-process guard belt at `brain-client.cjs:657-676` regardless of hook coverage. One guard in one function covers all 16 wrappers (the quick 260819-c8j mechanism note at `:607-616`). Add a grep tripwire to `tests/run-all-345.sh` asserting zero occurrences of `mcp__theo__` in any file this phase adds.

**Warning signs:** the string `mcp__theo__` appears anywhere outside a test fixture.

### Pitfall 6: the ghost session counter

**What goes wrong:** the cadence is specified as "every N sessions", a plan finds `sessionstart_coordinator_run` in `EVENT_TYPES` (`memory-events.cjs:145`), builds the counter on it, and it reads 0 forever.

**Why it happens:** `sessionstart_coordinator_run` is declared and **never written**. A repo-wide grep for the literal returns exactly two hits, both in `memory-events.cjs` itself (the comment at `:139` and the enum member at `:145`). It is a ghost event type.

**How to avoid:** either (a) define the cadence in reaches rather than sessions, using `reach_presented` (14,676 live rows, written from `scripts/intent-classifier.cjs:2379`) or `gate_reached` (4,680 live rows, `intent-classifier.cjs:2401`); or (b) write the `sessionstart_coordinator_run` producer as an explicit, separately-acceptance-tested task and say in the plan that it is net-new. Do not silently depend on it.

Note also that `scripts/check-card-fire.cjs:1208` `readSessionCount` is **not** a room session counter: it counts stop-gate intercepts within one conversation session, keyed on the opaque `session_id`, in the `~/.mindrian` retry side-file. It is the wrong instrument.

**Warning signs:** any plan task whose acceptance criterion is "the session count increments" without a task that writes the event.

### Pitfall 7: assuming the ICM contract is inert

**What goes wrong:** the goal-hierarchy record is added to `jtbd-state.json` and nothing declares it, so Phase 344's ICM wiring doctor counts the JTBD part as having a producer and a consumer that no longer describe what the file holds.

**Why it happens:** `data/icm-parts.json` (shipping in `344-05-PLAN.md`) declares each ICM nested part with `id, path_pattern, icm_layer, engineering_layer, producers, consumers, exists_in_room, notes`, and the doctor module reads it. Until 344-05 lands, there is nothing to update; after it lands, there is.

**How to avoid:** the phase must state its dependency on 344 explicitly (`ROADMAP.md:719` already says `**Depends on:** Phase 344`) and add one task: update the `jtbd-state` row in `data/icm-parts.json` to name the strategy sensor and the gate handler as consumers, and add a line to the room's per-section `CONTEXT.md` contract if the goal record is surfaced there. The icm-architect consult is the standing rule for exactly this (`~/.claude/CLAUDE.md`, `feedback_mindrianos_dev_consult_icm_architect.md`, HARD RULE 2026-08-28).

**Warning signs:** the plan touches `jtbd-state.cjs` and never mentions `data/icm-parts.json`.

### Pitfall 8: the doctrine edit that contradicts the shipped section

**What goes wrong:** a new "the reframe is the strategy node's move" paragraph is appended somewhere in `SKILL.md` and now two sections tell Larry what to do when circling, in slightly different words.

**Why it happens:** the rule already exists. `skills/larry-personality/SKILL.md:77`, in the "Three Directions of Elevation (Part 12)" section, reads verbatim:

> **Clarify vs reframe (the anti-circular rule).** A CLARIFYING re-ask continues the loop and is avoidance; a REFRAME question breaks the frame and is progress. When the conversation is circling, NEVER ask another clarifying question -- instead deliver (TELL), validate/grill the load-bearing claim against ground truth, name the bottleneck, or reframe (Why / What-if / How). Never loop.

**How to avoid:** **amend line 77 in place**, do not append a second rule. The edit's job is to add the one thing the existing rule does not say: that the reframe has a **cadence and an owner**, and that the owner is a slower node than the turn loop. Suggested amendment shape, for the planner to refine:

> ... or reframe (Why / What-if / How). Never loop. **And when the circling is not one turn's but the room's, the reframe is not a turn move at all: it is the strategy node's. A loop can only hit its goal; it cannot question it. So when the room has been executing against the same job for N reaches with nothing new filed, climb the taxonomy ladder instead of asking again, and put the rewritten job or the different rung to the navigator at a Decision Gate. Larry never rewrites the job silently.**

Two constraints on the wording: no em-dashes (`CLAUDE.md:140`), and the two-pass ordering at `SKILL.md:49-53` still holds, so the doctrine must be phrased as something the **engine** decides and Larry **observes**, not something Larry computes. Larry does not pick the reach.

Also check whether `dist/` carries a mirrored copy of `larry-personality/SKILL.md` before assuming the single edit is enough: `dist/generic-claude-dir/.claude/skills/` and `dist/zed/.agents/skills/` both mirror `skills/pws-brain/SKILL.md`, so a mirror may exist for larry-personality too.

**Warning signs:** the plan says "add a section to SKILL.md".

---

## Code Examples

### Reading the cadence and stall counts through the chokepoint

```javascript
// Source: lib/core/meter/gate-density-reader.cjs:60-96 (the _counter idiom)
// and lib/core/navigation/memory-events.cjs:781 (findRecentChanges).
const navigation = require('../navigation.cjs');
const READ_LIMIT = 1000;

function _count(db, sinceEpochMs, eventType) {
  if (!db) return 0;
  try {
    const rows = navigation.findRecentChanges(db, sinceEpochMs || 0, {
      eventType: eventType, limit: READ_LIMIT,
    });
    return Array.isArray(rows) ? rows.length : 0;
  } catch (_e) {
    return 0;   // never throws; cold path reads 0
  }
}

function computeStrategyCounts(db, sinceEpochMs) {
  return {
    reaches_since: _count(db, sinceEpochMs, 'reach_presented'),
    gates_since:   _count(db, sinceEpochMs, 'gate_reached'),
    claims_since:  _count(db, sinceEpochMs, 'node_created'),
    promotions_since: _count(db, sinceEpochMs, 'status_promoted'),
  };
}
```

Note `findRecentChanges` filters on `EVENT_TYPES.has(options.eventType)` (`memory-events.cjs:783`), so an event type not in the frozen set silently becomes an unfiltered read of every memory_event. Assert your event-type strings against `EVENT_TYPES` in a test.

### The Theo ladder render, Part-8 clean

```javascript
// Source: lib/core/part8-egress-guard.cjs:440-447 (the known-shape proof)
// + lib/core/brain-client.cjs:595 callTool with its in-process belt at :657.
const brainClient = require('../brain-client.cjs');

// The egress guard's closed rung enum. One home, do not re-declare a third copy.
const LADDER_RUNG_BY_THEO_ID = Object.freeze({
  UnDefined:   'undefined',
  IllDefined:  'ill-defined',
  WellDefined: 'well-defined',
  Wicked:      'wicked',
});

async function renderLadder(theoRungId, jtbdSlug) {
  const rung = LADDER_RUNG_BY_THEO_ID[theoRungId];
  if (!rung) return null;                       // fail closed, never guess
  // question_label is OPTIONAL and, when present, must be a generic handle.
  // A taxonomy slug is an enum (jtbd-taxonomy.json). The room's real question
  // is user content and NEVER goes here (Canon Part 8).
  const args = jtbdSlug ? { rung: rung, question_label: jtbdSlug } : { rung: rung };
  const result = await brainClient.callTool('taxonomy_ladder', args);
  if (result && result.error === 'egress_blocked') return null;
  return result;
}
```

### The local climb, zero network

```javascript
// Source: lib/core/brain-client.cjs:1184 _inferRungFromQuestion (named export).
// Theo's classify_problem_type takes NO parameters; the caller classifies
// (brain-client.cjs:1152-1155). This is the classifier.
const { _inferRungFromQuestion } = require('../brain-client.cjs');

// Runs on the LOCAL parent question. The question never leaves the process.
const rung = _inferRungFromQuestion(goal.parent_question); // 'IllDefined' etc.
```

### The Group A priority entry

```javascript
// Source: lib/core/sensors/sensor-priority.cjs:134-141
const SENS_PRIORITY = Object.freeze([
  // Group A -- confirmed room-state / projected-cortex facts
  'SENS-08',
  'SENS-17',
  'SENS-10',
  'SENS-11',
  'SENS-19',   // <- Phase 345: a measured count over the persisted memory_event
               //    log is a confirmed room-state fact, not a derived intent.
  'SENS-14',
  'SENS-02',
  'SENS-RECENCY',
  // ... Groups B, C, D unchanged
]);
```

---

## State of the Art

| Old approach (in this repo) | Current approach | When changed | Impact on Phase 345 |
|---|---|---|---|
| "Registering a sensor is three or four edits" | Six code edits plus an un-gated producer block, plus an optional eighth | 343 ICM consult, 2026-09-14 (R1, BLOCKING) | The plan's task list must have seven places. |
| Sensors self-declare their id | One central stamp from `SENSOR_REGISTRY_IDS[i]` | Phase 245-01, D-21 | Do NOT add a `sensor_id` field to the reach. `stampSensorId` does it. |
| Brain problem-type vocabulary is the incumbent's | Theo's ids are live on `THEO_ORIGINS`; both vocabularies coexist during the soak | quick 260910-hni, 2026-09-10 | The rung mapping must handle both. See Pitfall 4. |
| `wrapDirective` was a fixed seven-key builder that discarded extra fields | Three additive named pass-throughs: `egress_disclosure`, `refusal`, `grounding` | Phase 257 D-04, then quick 260910-hni | If the strategy proposal needs to ride the envelope, it needs a **fourth named additive field**, added by name only. A generic top-level copy is the leakage class `lib/mcp/no-instructions.test.cjs` exists to prevent (`directive-envelope.cjs:150-165`). |
| Gate approve wrote only a memory_event | Approve also writes a typed decision node with `SOURCED_FROM` and `USES_FRAMEWORK`, promoted via `confirmNode` | quick 260903-i2x, 2026-09-03 | Shipped, correct, and **never executed in any live room** (measured: 0 `decision:gate:*` nodes across 30 rooms). |
| Commands carry no engineering-layer declaration | `layer:` frontmatter, closed six-member vocabulary `prompt,context,harness,loop,graph,none`, fail-closed gate | Phase 344 (planned, 9 plans) | Every new declaring surface in 345 carries a `layer:`. The strategy node is `graph`. |

**Deprecated / do not use:**

- `sessionstart_coordinator_run` as a session counter: declared, never written.
- `framework_invoked` as a density input: `gate-density-reader.cjs:16-19` states it "fires at ~ZERO production sites today".
- `f_selector_decision` as a reject denominator without a caveat: `transfer-reader.cjs:41-44` states it "is not yet written from the dial in production", so the reject-capture denominator cold-starts structurally empty on most rooms. Reject-keyed suppression will therefore read 0 on day one. That is honest, not broken, but the plan must not assume it as the primary cool-down.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `contradiction` is the right reach id for a strategy proposal, over `context_block` | Standard Stack / Alternatives | A semantic mismatch in the render label. Cheap to change before ship, expensive after (it is a UI contract). The 343 consult reasoned the same way for its own graph-integrity sensor and landed on `contradiction`. MEDIUM. |
| A2 | `pull_back` is the right posture, over `hold` | Pattern 3 | SENS-05 uses `hold` for a JTBD change. `pull_back` reads as "stop advancing, re-examine", which matches the doctrine. MEDIUM. Put to the navigator. |
| A3 | The cadence should be measured in **reaches**, not sessions | Pitfall 6 | If the navigator insists on sessions, a `sessionstart_coordinator_run` producer becomes a net-new task with its own acceptance test. Named as an engineering decision by the langtalks consult ("that trigger design is an engineering decision"). |
| A4 | The stall signal is "N reaches with zero `node_created` claim rows and zero `status_promoted`" | Pattern 3, Pitfall 3 | No corpus source (consult, "Not in the corpus yet"). Any other definition is equally defensible. The chosen definition must be written into the module header so it is one home, not a guess repeated in three places. |
| A5 | `goal` as an additive sub-object on `current`, `SCHEMA_VERSION` staying at 1 | Pattern 4 | If a reader is found that does a strict key check on `current`, this breaks. I read every `jtbd-state` consumer I could find (`sensor-jtbd-reweight.cjs`, `scripts/jtbd-command.cjs`, `lib/memory/across-session-memory.cjs` per the module comments) and all typeof-guard, but I did not exhaustively enumerate consumers. LOW risk, worth one grep at plan time. |
| A6 | `taxonomy_ladder` is reachable on the deployed Theo today | Standard Stack | The 31-tool live inventory that names it (`docs/262-LIVE-MEASUREMENT-EVIDENCE.md:314`) was measured **before** the Theo cutover. The Theo source registers it (`/home/jsagi/Theo/src/mcp/content/index.ts:149-162`), which is strong but is source, not a live probe. **A live probe is the cheapest way to discharge this.** MEDIUM. |
| A7 | The `goal:<slug>` anchor node type is acceptable to the graph vocabulary | Pattern 5 | `epistemic_type` is a closed 10-member fail-closed enum (`node-insert.cjs:113`); `node.type` is not constrained by the schema but `ALLOWED_EDGE_TYPES` is (`edges.cjs:32`). `SOURCED_FROM` is already a legal member (`edges.cjs:854`), so no vocabulary change is needed for the edge. The node type is the open question. Consult icm-architect. |
| A8 | The SKILL.md doctrine belongs at line 77 (the anti-circular rule) rather than in the Capability Dial section | Pitfall 8 | If the navigator wants it in the dial table instead, that is a row edit in a six-row table that mirrors `REACH_IDS`, which is a heavier change. MEDIUM. |
| A9 | `dist/` does not carry a mirrored `larry-personality/SKILL.md` | Runtime State Inventory | I confirmed mirrors exist for `pws-brain/SKILL.md` but did not enumerate the full `dist/` skill tree. One `ls` at plan time discharges it. LOW. |

---

## Open Questions

1. **What is N?**
   - What we know: the cadence must be slower than the execution reaches, and it must have a cool-down. Three shipped throttle mechanisms exist.
   - What is unclear: the actual number. The corpus gives no guidance ("no source on scheduled re-evaluation").
   - Recommendation: pick a conservative default with a named constant and a comment stating what the number means, the way `canary.cjs` does, and ship the dismissal-rate throttle in the same plan so the wrong default self-corrects rather than nags. Put the number to the navigator at plan time, not at execution time.

2. **Does the strategy reach ride the DirectiveEnvelope?**
   - What we know: `wrapDirective` carries exactly seven keys plus three named additive pass-throughs, and a generic top-level copy is explicitly forbidden (`directive-envelope.cjs:150-165`).
   - What is unclear: whether the proposal needs to reach the model through the envelope at all, or whether the gate card is sufficient.
   - Recommendation: the gate card is sufficient. Do not touch `wrapDirective` unless a concrete need appears. If it does, add a fourth **named** field and extend `tests/test-257-envelope-passthrough.cjs`.

3. **Is `goal` a node in the room graph, or only a field on the state file, or both?**
   - What we know: Pattern 5 requires a real node id for `subject_node_id` or the `SOURCED_FROM` deliverable is unmet.
   - What is unclear: whether that node should be the durable home of the goal (with the JSON file as a cache) or a thin anchor whose only job is to be pointed at.
   - Recommendation: **thin anchor.** The file stays the home (`CLAUDE.md:141`, filesystem is the source of truth for room state). The node exists so provenance has a target. State this explicitly in the module header so a later phase does not build a second goal store. **This is the question to put to icm-architect**, since it changes the room's ICM nested-part shape.

4. **Does the goal-hierarchy record surface in `ROOM.md`, `STATE.md`, or `USER.md`?**
   - What we know: today the room's goal lives **only** in `<roomDir>/.mindrian/jtbd-state.json`. There is no persisted problem-type rung anywhere: `problem_type` is inferred per turn onto the diagnose tuple (`sensor-types.cjs` `PROBLEM_STATE_FIELDS` is `['stage','jtbd','graph_gap']`, and `problem_type` is not even in it) and `commands/diagnose.md:61` says `$problem_type = inferred from the user's description`. `user-archetype.cjs:250-265` reads a venture name out of `STATE.md` and `ROOM.md` but no goal.
   - What is unclear: whether the navigator wants the parent question visible in a human-readable file.
   - Recommendation: not in this phase. Adding a `STATE.md` writer is a second producer for the same fact and a Canon Part 7 violation. If it is wanted, make it a read-only render in `/mos:jtbd` (`commands/jtbd.md`, `scripts/jtbd-command.cjs`), which already has a Zone-2 state readout block.

5. **Does Phase 345 need Phase 344 to have landed?**
   - What we know: `ROADMAP.md:719` says `**Depends on:** Phase 344`. 344 owns `layer:`, `data/icm-parts.json`, and the fail-closed declaration gate.
   - What is unclear: whether 344's gate will be blocking by the time 345 executes (344-01 WD-8 records it as "drafted here as a prose contract, not enforced constitutionally in this phase").
   - Recommendation: write the `layer:` keys regardless. They are cheap and correct either way, and if the gate is blocking their absence is a hard fail.

6. **Does `taxonomy_ladder` answer on the live Theo origin?**
   - Recommendation: one live probe against `https://theo-mcp.onrender.com` via the shipped `scripts/check-brain-tool-liveness.cjs` path before the plan commits to the render. If it does not answer, the render degrades to a local four-rung card and nothing else in the phase changes. Design the card so that is a one-line fallback, not a re-plan.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js built-ins (fs, path, crypto) | every module in this phase | yes | node 24+ (`node:sqlite` present) | - |
| `better-sqlite3` | room.db reads at runtime | **not resolvable from the repo root** (`require('better-sqlite3')` fails: "Cannot find module") | - | It is resolved at runtime from the installed plugin location, not from the dev checkout. `node:sqlite` (experimental) worked for my measurements. **Tests must not require `better-sqlite3` directly**; use the caller-threaded handle and the `roomState` injection seam, which is exactly why that seam exists. |
| `node:sqlite` | my fleet measurements only | yes (experimental, emits a warning) | node built-in | Measurement tool only, not a runtime dependency. Do not introduce it into `lib/`. |
| Theo (`https://theo-mcp.onrender.com`) | the optional `taxonomy_ladder` render | not probed this session | - | **Tier 0.** `wrapDirective(null, ...)` returns the byte-locked Tier-0 sentinel with `mode_rationale: 'brain_unreachable'` (`directive-envelope.cjs:170-186`). The proposal must render from local state alone. |
| `~/MindrianRooms` (30 rooms) | fixture-adjacent measurement, not runtime | yes | - | Tests build fixtures under `os.tmpdir()` and point `MINDRIAN_ROOMS_HOME` at them (the 344-05 precedent). **Never test against live rooms.** |

**Missing with no fallback:** none.

**Missing with fallback:** `better-sqlite3` at dev-checkout resolution. The mitigation is already the house pattern (caller-threaded handle plus injection seam), so this is a constraint on how tests are written, not a blocker.

---

## Validation Architecture

### Test framework

| Property | Value |
|---|---|
| Framework | Plain Node scripts. No jest, no mocha, no vitest. Each test is a `.cjs` file that exits 0 on pass and non-zero with a printed failing assertion on fail. Some use `node:assert` (`tests/test-198-stop-gate-retry-ceiling.test.cjs`), most use a hand-rolled `ok(label, cond)` helper (`tests/test-meter-density.cjs`). |
| Config file | none. The aggregator shell script is the runner. |
| Quick run command | `node tests/test-345-strategy-sensor.cjs` (single leg, sub-second) |
| Full suite command | `bash tests/run-all-345.sh` |
| Aggregator idiom | `tests/run-all-341.sh` is the current model: `set -uo pipefail`, `run` and `run_if` (artifact-guarded SKIP), PASS/FAIL/SKIP counters, an em-dash guard loop, and `exit $(( FAIL > 0 ? 1 : 0 ))`. 344-01 stands up `tests/run-all-344.sh` on the same shape. |
| Existing gates this phase inherits free | `tests/test-sensors-part8-sweep.cjs` and `tests/test-sensors-routing-fence.cjs` both glob `lib/core/sensors/*.cjs`, so a new detector file is covered with zero edits. `tests/test-245-priority-complete.cjs` and `node scripts/build-connector-registry.cjs --check` both fail closed on a `SENS_PRIORITY` omission. |

### Phase requirements to test map

Requirement ids are proposed (`STRAT-NN`); the planner mints the real ones.

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| STRAT-01 | SENS-19 is registered at matching indices in both arrays, exported by name, and present in `SENS_PRIORITY` Group A | unit | `node tests/test-345-lockstep.cjs` | Wave 0 |
| STRAT-02 | **`decide()` with a seeded room handle returns a reach stamped `evidence.sensor_id === 'SENS-19'` when the threshold is crossed** (the place-7 pin) | integration | `node tests/test-345-producer-fires.cjs` | Wave 0 |
| STRAT-03 | The sensor returns `null` on: no roomDir, no JTBD set, cool-down active, thresholds not crossed | unit | `node tests/test-345-strategy-sensor.cjs` | Wave 0 |
| STRAT-04 | The reach carries only scalars and enums; no prose, no node ids, no parent question | unit + sweep | `node tests/test-345-part8.cjs` and the inherited `node tests/test-sensors-part8-sweep.cjs` | Wave 0 (sweep exists) |
| STRAT-05 | `goal` round-trips through `setCurrent`/`getCurrent`; a legacy file with no `goal` reads `goal_version` 0 and does not throw; `SCHEMA_VERSION` stays 1 | unit | `node tests/test-345-goal-record.cjs` | Wave 0 |
| STRAT-06 | `goal_version` increments only on an approved rewrite, never on a dismissal | unit | `node tests/test-345-goal-record.cjs` | Wave 0 |
| STRAT-07 | **A fixture room.db driven `gate_render` -> `gate_answer(approve)` produces at least one `SOURCED_FROM` edge row and a `decision:gate:*` node with `review_status='confirmed'`** | integration | `node tests/test-345-gate-anchor.cjs` | Wave 0 |
| STRAT-08 | The rung mapping round-trips all four values and `part8-egress-guard.classify` returns `verdict: 'allow'`, `reason: 'taxonomy_ladder rung enum'` for each | unit | `node tests/test-345-rung-mapping.cjs` | Wave 0 |
| STRAT-09 | No file added by this phase contains the literal `mcp__theo__` | tripwire | `grep -rL` leg in `tests/run-all-345.sh` | Wave 0 |
| STRAT-10 | Every execution reach logs its `goal_version` on the `reach_presented` payload | integration | `node tests/test-345-goal-version-stamp.cjs` | Wave 0 |
| STRAT-11 | The cool-down suppresses a second proposal inside the window and emits the throttle memory_event | unit | `node tests/test-345-cooldown.cjs` | Wave 0 |
| STRAT-12 | `skills/larry-personality/SKILL.md` line 77's rule names the strategy node as the owner of the room-level reframe; zero em-dashes in every file touched | doc + tripwire | `node tests/test-345-doctrine.cjs` plus the em-dash guard loop in the aggregator | Wave 0 |

### Sampling rate

- **Per task commit:** the single leg for that task, plus `node scripts/build-connector-registry.cjs --check` on any task touching the sensor lockstep.
- **Per wave merge:** `bash tests/run-all-345.sh`.
- **Phase gate:** `bash tests/run-all-345.sh` fully green, plus the inherited sweeps (`tests/test-sensors-part8-sweep.cjs`, `tests/test-sensors-routing-fence.cjs`, `tests/test-245-priority-complete.cjs`), plus `grep -c $(printf '\xe2\x80\x94')` returning 0 over every file the phase touched, before `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `tests/run-all-345.sh` (aggregator; copy `tests/run-all-341.sh` shape)
- [ ] `tests/test-345-lockstep.cjs` (STRAT-01)
- [ ] `tests/test-345-producer-fires.cjs` (STRAT-02, **the place-7 pin, highest value test in the phase**)
- [ ] `tests/test-345-strategy-sensor.cjs` (STRAT-03)
- [ ] `tests/test-345-part8.cjs` (STRAT-04)
- [ ] `tests/test-345-goal-record.cjs` (STRAT-05, STRAT-06)
- [ ] `tests/test-345-gate-anchor.cjs` (STRAT-07, **the deliverable-4 pin**)
- [ ] `tests/test-345-rung-mapping.cjs` (STRAT-08)
- [ ] `tests/test-345-goal-version-stamp.cjs` (STRAT-10)
- [ ] `tests/test-345-cooldown.cjs` (STRAT-11)
- [ ] `tests/test-345-doctrine.cjs` (STRAT-12)
- [ ] Framework install: **none needed.** Plain node scripts, no runner to install.

Fixture discipline, inherited from `344-05-PLAN.md`: build rooms under `os.tmpdir()`, point `MINDRIAN_ROOMS_HOME` at them, include one deliberately corrupt fixture (an unreadable `jtbd-state.json`, a room.db with the 3-column legacy `nodes` schema) and assert the sweep survives it. Never touch `~/MindrianRooms`.

---

## Security Domain

The phase has no auth surface, no network listener, no user input parsing, and installs no packages. The ASVS categories that would normally apply are mostly inert. The one real boundary is Canon Part 8 data egress, which this repo treats with more rigor than ASVS asks for.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this repo |
|---|---|---|
| V2 Authentication | no | No new authenticated surface. `callTool` reuses the resolved Brain key. |
| V3 Session Management | no | No session is created or read except the opaque `session_id` already in use. |
| V4 Access Control | partial | Canon Part 9 role 5: a truth claim lands `review_status: 'proposed'` and only a human APPROVE at a gate promotes it via `confirmNode`. The strategy node must never mint `confirmed`. |
| V5 Input Validation | yes | `makeReach` drops every non-primitive and returns `null` on an unknown id or posture (`sensor-types.cjs:243-267`). `insertNode` fail-closes on the 10-member `epistemic_type` enum (`node-insert.cjs:211`). `_hasExactKeys` fail-closes on tool-schema drift (`part8-egress-guard.cjs:465`). Use these; do not hand-validate. |
| V6 Cryptography | no | Nothing cryptographic. `crypto.randomUUID`-class id minting only. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Room content smuggled to Theo on the `question_label` free-text field | Information disclosure | Send only a taxonomy enum or omit the field. The default-deny content scan runs first (`part8-egress-guard.cjs:490`) and the 120-char single-line bound is hygiene on top, explicitly not the defence. |
| Direct `mcp__theo__*` call bypassing the PreToolUse hook | Information disclosure | Route every wire call through `brainClient.callTool`, which applies the in-process belt at `:657` regardless of hook matcher coverage. Grep tripwire in the aggregator (STRAT-09). |
| Unbounded caller-controlled retained memory via `evidence_node_ids` | Denial of service | `MAX_EVIDENCE_NODE_IDS = 64` at `gate-render.cjs:57` and `MAX_PROVENANCE_TARGETS` at `reasoning-write.cjs`. Do not raise either. |
| A node id (a section-relative path, therefore room CONTENT) riding a reach | Information disclosure | The LOCAL candidate list rides `sensorCtx`, never the reach. `makeReach` would drop the array anyway, but rely on the convention, not the accident. |
| A gate spoofed to ratify a decision the navigator never made | Spoofing / Elevation | The single-use ledger: `gate_answer` only ratifies a `gate_id` this process minted, and refuses a replay with `unknown_or_expired_gate` (`gate.cjs:170`). Reuse it; do not mint gate ids elsewhere. |
| A sensor that throws and takes down `decide()` | Denial of service (self) | `dispatchSensors` wraps each detector in try/catch (`insight-sensors.cjs:898-916`) and the producer block pattern soft-fails to no signal. Both are already in the idiom; do not add a throw path. |

---

## Sources

### Primary (HIGH confidence, read in-file this session)

- `lib/core/insight-sensors.cjs` (`SENSOR_REGISTRY:721`, `SENSOR_REGISTRY_IDS:781`, `stampSensorId:834`, `dispatchSensors:873`, gates `:907-912`, exports `:918`)
- `lib/core/sensors/sensor-types.cjs` (`REACH_IDS:43`, `POSTURE_IDS:54`, `TRIGGER_TIERS`, `PROBLEM_STATE_FIELDS`, `makeReach:237`)
- `lib/core/sensors/sensor-priority.cjs` (`SENS_PRIORITY:134`, group doctrine `:100-133`)
- `lib/core/sensors/sensor-jtbd-reweight.cjs` (the closest sibling sensor, whole file)
- `lib/core/navigation-engine.cjs:895-1060` (the three ctx producer blocks and the dispatch call)
- `lib/hmi/jtbd-state.cjs` (whole file)
- `lib/hmi/jtbd-classifier.cjs` (header and exports)
- `lib/hmi/jtbd-taxonomy.json` (13 entries, per-entry key list)
- `lib/mcp/tools/gate.cjs:170`, `:218`, `:242-330` (the approve branch)
- `lib/mcp/gate-render.cjs:1-120` (`SUPERSET_SCHEMA`, the carryable fields, `MAX_EVIDENCE_NODE_IDS`)
- `lib/core/navigation/reasoning-write.cjs:82-211` (`REASONING_NODE_ID`, `writeReasoningNode`, the `SOURCED_FROM` loop)
- `lib/core/navigation/memory-events.cjs` (`EVENT_TYPES` full 52-member list, `logEvent:728`, `findRecentChanges:781`)
- `lib/core/meter/gate-density-reader.cjs`, `lib/core/meter/transfer-reader.cjs`
- `lib/workflow/reach-reject-reader.cjs:1-50`, `:142`, `:185`
- `lib/core/breakthrough/canary.cjs:85-135`
- `lib/core/part8-egress-guard.cjs:310-500` (`TAXONOMY_RUNGS:328`, `_proveKnownToolShape:427`, `classify:485`)
- `lib/core/brain-client.cjs:595-676` (`callTool` + the egress belt), `:1128-1200` (`schema`, `_inferRungFromQuestion`), the exports block
- `lib/core/directive-envelope.cjs` (whole file)
- `lib/core/node-insert.cjs:109-215` (`ALLOWED_EPISTEMIC_TYPES`, `insertNode`)
- `hooks/hooks.json:225`, `:327` (the Brain tool matcher)
- `skills/larry-personality/SKILL.md:1-100`, `:130`, `:153-200`, `:235`
- `commands/jtbd.md` (frontmatter, `connector.sensor_triggers: [SENS-05]`)
- `CLAUDE.md:130-200`
- `/home/jsagi/Theo/src/mcp/content/index.ts:145-201` (the four Phase 12 tools, `taxonomy_ladder` as a pure render, the Part 8 note on `mcp__theo__*`)
- `.planning/phases/345-.../345-LANGTALKS-CONSULT.md` (the standing consult)
- `.planning/phases/343-.../343-ICM-CONSULT.md:1-360`, `:420-500` (OBJ-1 through OBJ-8, the seven-place lockstep table, R1 BLOCKING)
- `.planning/phases/344-.../344-01-PLAN.md:96-215` (LAYER-01..16, the six-member layer vocabulary, the classification rubric)
- `.planning/phases/344-.../344-05-PLAN.md` (`data/icm-parts.json`, the per-section CONTEXT.md contract's first code consumer)
- `.planning/phases/344-.../344-06-PLAN.md:17-63` (the GRAPH rung's direct citation rule)
- `.planning/ROADMAP.md:694-730` (Phases 343, 344, 345, 346)
- `.planning/config.json` (`nyquist_validation: true`)

### Measured live this session (HIGH confidence, reproducible)

- 30 rooms under `~/MindrianRooms` with a `.mindrian/room.db`: **0** `SOURCED_FROM` edges, **0** `decision:gate:*` nodes, **4,680** `gate_reached` memory_events, **14,676** `reach_presented` memory_events, **7,794** `claim` nodes. Reproduce with a read-only `node:sqlite` sweep.
- **10 of 30** rooms have a `.mindrian/jtbd-state.json`; all at `version: 1`; sampled `current` objects carry only `jtbd, confidence, entered_at, evidence, expires_at`.
- Requirement-prefix census across both repos' `.planning/REQUIREMENTS.md` and `ROADMAP.md`: `STRAT` is unused.
- `.planning/*` is gitignored (`.gitignore:97`), confirmed with `git check-ignore -v`.
- `sessionstart_coordinator_run` has zero writers repo-wide.
- `require('better-sqlite3')` does not resolve from the repo root.

### Secondary (MEDIUM confidence)

- `docs/262-LIVE-MEASUREMENT-EVIDENCE.md:300-320` (the 31-tool live inventory naming `taxonomy_ladder` and `classify_problem_type`) - measured, but **before** the Theo cutover, hence assumption A6.
- `data/brain-surface-contract.json` (`loop_tools` pins 7 tools; the `non_contract_note` lists 15 more; `taxonomy_ladder` appears in neither list, so it is neither promised nor scheduled for removal).

### Tertiary (LOW confidence, flagged)

- None. No WebSearch was performed; this phase is entirely in-repo and the two external repos (`/home/jsagi/Theo`, `~/dev/ProblemsWorthSolving-Brain`) were read directly rather than searched.

---

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH.** Zero external packages. Every in-repo organ was opened and read this session, with line numbers.
- Architecture / lockstep: **HIGH.** The seven-place table is the 343 ICM consult's binding correction and I re-verified each cited line.
- The gate-anchor finding: **HIGH.** Measured live across 30 rooms, not cited.
- Theo tool behavior: **HIGH** on shape (read from Theo's own source), **MEDIUM** on live reachability post-cutover (A6, one probe discharges it).
- Cadence and stall design: **MEDIUM.** No corpus source; named as engineering decisions by the consult. The mechanisms to implement them are HIGH; the numbers are open.
- Pitfalls: **HIGH.** Every one is either a documented scar in the repo's own comments or a measured zero.

**Standing consults status:**

- `langtalks-graph-expert`: **DONE**, `345-LANGTALKS-CONSULT.md`. Its two named assumptions are carried forward as A3 and A4.
- `icm-architect`: **REQUIRED and not yet run.** The goal-hierarchy record is a new field on an ICM nested part, and Open Question 3 (thin anchor versus durable node) is exactly an ICM shape question. The consult should be run before `345-01-PLAN.md` is written, and it should be asked specifically: (a) is `goal:<slug>` a legitimate node type or should the anchor be an existing type; (b) what does the `jtbd-state` row in `data/icm-parts.json` become; (c) does the per-section `CONTEXT.md` contract's "Commands that write here" / "Inputs" headings need a row for the goal record.

**Research date:** 2026-09-14
**Valid until:** 2026-10-14 for the in-repo mechanism claims (stable, this repo moves by phase not by drift). **2026-09-21 for the live measurements** and for A6, since Theo is under active cutover and Phase 343 and 344 both land code in the same subsystems.
