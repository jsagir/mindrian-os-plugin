# Phase 345 Strategy Node: Decisions, Requirement Mint, and Non-Goals

Status: Active
Implementing phase: 345 (the strategy node, graph-engineering learning 3b, blind upward movement)
Sibling contracts: docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md and
docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md (the same registry-is-the-table shape, Phase 343
and Phase 347), docs/LAYER-DECLARATION-CONTRACT.md (Phase 344)

---

## Why this file is in docs/

`.planning/*` is gitignored in this repository except `.planning/debug/` (`.gitignore:97-98`), so
`345-RESEARCH.md`, `345-ICM-CONSULT.md`, `345-LANGTALKS-CONSULT.md`, and every PLAN and SUMMARY
file this phase writes under `.planning/phases/345-.../` are local-only: they exist on this
machine and evaporate at the next machine switch. A decision this phase adopts, a requirement id
this phase mints, or a scope fence this phase draws must land here, in a tracked file, or it does
not survive. A reader on another machine is missing the three source files named above and should
treat every conclusion below as this file's own reproduction of their content, not a pointer to
files they can open.

---

## Section 1: Requirements minted

Eighteen ids, the `STRAT` prefix (measured free against both repos' `.planning/REQUIREMENTS.md`
and `ROADMAP.md` prefix lists, per `345-RESEARCH.md` "Phase Requirements"; it collides with
neither `SENS-` nor `LAYER-`).

| id | deliverable | plan | source |
|---|---|---|---|
| STRAT-01 | The top-level `goal` key on `jtbd-state.json` with `parent_question`, `rung`, `goal_version`, `set_at`, `set_by`, carried through `writeStateAtomic` and preserved by all three writers | plan 02 | 345-ICM-CONSULT R1 (BLOCKING) |
| STRAT-02 | `goal_version` monotone and the bounded `goal_history` ring; absent reads as 0 | plan 02 | 345-RESEARCH Pattern 4 |
| STRAT-03 | One declared persisted rung vocabulary with a tested mapping to the egress-guard ladder enum | plan 01 | 345-ICM-CONSULT R6 (BLOCKING) |
| STRAT-04 | The cadence and stall counters read through the navigation chokepoint over `memory_event`, with named constants and an injection seam | plan 03 | 345-RESEARCH Pattern 2 |
| STRAT-05 | The cool-down: hard minimum interval, dismissal-rate throttle, REJECT-only suppression, and a `strategy_throttled` memory_event | plan 03 | 345-RESEARCH Pitfall 3 |
| STRAT-06 | `sensorStrategyReach`, pure, sync, zero I/O, returning `null` on every refusal branch | plan 04 | 345-RESEARCH Pattern 3 |
| STRAT-07 | SENS-19 registered across lockstep places 2 through 6 with `SENS_PRIORITY` in Group A | plan 05 | 345-ICM-CONSULT R8; 343 lockstep precedent |
| STRAT-08 | The ctx producer block, lockstep place 7, pinned from the far end through `decide()` | plan 05 | 345-RESEARCH Pitfall 1 |
| STRAT-09 | The stall count exposed as a named null-default input for the Phase 346 arbiter | plan 03 | 345-RESEARCH Architectural Responsibility Map |
| STRAT-10 | The climb: local rung inference plus the optional taxonomy_ladder render through `brainClient.callTool` with a local one-line fallback | plan 06 | 345-RESEARCH "Primary recommendation" |
| STRAT-11 | No file under `lib/` contains the literal `mcp__theo__` | plan 01 (enforced by the aggregator) | 345-RESEARCH Pitfall 5 |
| STRAT-12 | The idempotent payload-free `goal:<room-slug>` anchor node, minted before the card | plan 06 | 345-ICM-CONSULT R2 (BLOCKING) |
| STRAT-13 | The strategy proposal as a Decision Gate whose approve branch writes a typed decision node with at least one `SOURCED_FROM` edge, wired on both surfaces | plan 07 | 345-ICM-CONSULT R4, R5 |
| STRAT-14 | Every `reach_presented` payload carries the `goal_version` it ran under | plan 07 | 345-RESEARCH Architectural Responsibility Map |
| STRAT-15 | The two L2 contract Inputs pointer lines plus the `problem-definition.md` rung-vocabulary correction | plan 08 | 345-ICM-CONSULT R6, R7 |
| STRAT-16 | The SKILL.md doctrine amendment in place at the anti-circular rule, plus the dist mirrors | plan 08 | 345-RESEARCH Runtime State Inventory |
| STRAT-17 | Every declaring surface this phase adds carries `layer: graph` | plan 09 | Phase 344 vocabulary |
| STRAT-18 | Phase close: aggregator green, every STRAT id closed with a measured proof | plan 09 | Phase 254/257/265/267.2/267.3/270/272/274/276/339/275/340/344/343/347 precedent |

---

## Section 2: Working decisions, reversible by the navigator

The navigator may reverse any row below. Reversing an already-ratified decision is a documented
amendment to this table, dated and reasoned, never a silent edit made only in code. Every row
below started at the not-yet-ratified status this section's own name describes, and closes this
phase at either RULED (the navigator answered directly at the plan-05 checkpoint) or HELD
(adopted as planned, unchallenged, confirmed shipped at phase close).

| id | decision | rationale with citation | status | reversal cost |
|---|---|---|---|---|
| WD-1 | The cadence is a named constant with a conservative default and the dismissal-rate throttle ships in the SAME plan | Cite 345-RESEARCH Pitfall 3 and `canary.cjs:85-124` | RULED 2026-09-15 -- navigator selected `ratify-all` on the orchestrator's card: `STRATEGY_CADENCE_REACHES=40`, `STRATEGY_STALL_MIN_SAMPLE=12`, `STRATEGY_MIN_INTERVAL_REACHES=20` ratified as written | One constant edit, no data change |
| WD-2 | The goal record is a TOP-LEVEL `goal` key on `jtbd-state.json`, sibling to `current` and `history`, never nested in `current` | Cite 345-ICM-CONSULT R1 BLOCKING and `jtbd-state.cjs:132-152` (`setCurrent` is a fixed 7-key whitelist constructor with no merge) and `:228-231` (`clear` nulls the container) | HELD 2026-09-15 -- adopted as planned, unchallenged. Shipped in plan 02: `goal`/`goal_history` landed as top-level sibling keys, threaded through `setCurrent`, `bumpTurnCount`, and `clear`, proven with three whole-object preservation legs in `tests/test-345-goal-record.cjs`. | One carry-through line in `writeStateAtomic`; no live room has the key on day one so there is nothing to migrate |
| WD-3 | `taxonomy_ladder` liveness is discharged by ONE probe through `scripts/check-brain-tool-liveness.cjs`, and the card falls back to a local one-line ladder render | Cite 345-RESEARCH A6 and Open Question 6 | HELD 2026-09-15 -- adopted as planned, unchallenged. Shipped in plan 06: the liveness probe ran (2026-09-15T12:49:33Z, exit 0), and `_resolveLadderText` degrades safely to `localLadderLine` on any non-`.ladder` shape -- the probe's own honest scope caveat (it does not itself exercise `taxonomy_ladder`) is why the plan 06 manual smoke test discovered the live rung-casing mismatch this record's own Section 6-adjacent carried-forward item now tracks. | Delete one call site; the fallback is already the Tier 0 path |
| WD-4 | The reach id is `contradiction` and the posture is `pull_back` | Cite 345-RESEARCH A1 and A2 and the reject of minting a seventh reach id | RULED 2026-09-15 -- navigator selected `ratify-all` on the orchestrator's card: reach id `contradiction`, posture `pull_back` ratified as written | Cheap before ship, expensive after, because the six reach ids are a UI contract (343-ICM OBJ-7). This is the row most worth the navigator's attention at the plan-05 checkpoint |
| WD-5 | The requirement prefix is STRAT | Cite the measured prefix census in 345-RESEARCH "Phase Requirements" | HELD 2026-09-15 -- adopted as planned, unchallenged. Shipped in plan 01: the eighteen-id `STRAT` family minted and now closed with measured proof in `.planning/REQUIREMENTS.md`. | A rename across this phase's files |
| WD-6 | The PERSISTED rung vocabulary is Theo's four ids (Wicked, UnDefined, WellDefined, IllDefined), because `brainClient._inferRungFromQuestion` is the only classifier in the repo and those are the only values it returns (`brain-client.cjs:1170-1175`, `:1184`). The egress-guard ladder enum (`part8-egress-guard.cjs:328`) is the WIRE vocabulary and is reached only through the mapper | Cite 345-ICM-CONSULT R6 BLOCKING | HELD 2026-09-15 -- adopted as planned, unchallenged. Shipped in plan 01: `lib/core/strategy/rung-vocabulary.cjs` is the sole home, `toLadderRung` the sole fail-closed conversion point. The live rung-CASING mismatch discovered in plan 06 (deployed `taxonomy_ladder` wants Theo-cased input, `toLadderRung` produces the lowercase egress-guard form) is a SEPARATE, unresolved finding -- it does not contradict this ruling (the PERSISTED-vs-WIRE split still holds), it names a live tool schema drift on the WIRE side; carried forward as a named deferred item below. | One module plus one stored-field rewrite across however many rooms have ratified a goal by then, which is zero at ship |
| WD-7 | The anchor node is typed `node.type` `'goal'` and `epistemic_type` `'assumption'` at `review_status` `'proposed'`, promoted by `confirmNode` on approve; never `node.type` `'claim'` | Cite 345-ICM-CONSULT R5 and OBJ-G5 | HELD 2026-09-15 -- adopted as planned, unchallenged. Shipped in plan 06 (mint) and plan 07 (promotion): `mintGoalAnchor` types the node `'goal'`/`'assumption'`/`'proposed'`; `ratifyGoalProposal`'s approve branch promotes it to `'confirmed'` via the existing `confirmNode` on the same fixture that proves the `SOURCED_FROM` edge. | A node-type rewrite; no edges change because `SOURCED_FROM` is already legal (`edges.cjs:854`) |
| WD-8 | The `SOURCED_FROM` deliverable is MEASURED on the MCP `gate_answer` surface. The CLI `gate_reached` surface (`scripts/intent-classifier.cjs:2401`, 4,680 live rows) is wired in plan 07 to carry the anchor id on its payload and to route a strategy ratification through the same module, so the two surfaces stop being disconnected for this one card kind | Cite 345-ICM-CONSULT AP-G6 and R4 | HELD 2026-09-15 -- adopted as planned, unchallenged. Shipped in plan 07: the MCP surface writes the decision node and edge (measured `sourced_from_edges_to_anchor=1 confirmed_decision_gate_nodes=1` on a fixture room); the CLI surface stamps `anchor_node_id` on `gate_reached` and emits one `strategy_proposed` memory event, but deliberately does not itself write the decision node -- named explicitly in 345-07-SUMMARY.md's "Next Phase Readiness" rather than smuggled together. | The CLI arm is additive and can be removed without touching the MCP path |
| WD-9 | SENS-19 ranks in `SENS_PRIORITY` **Group A**, not Group D. A measured count over the persisted `memory_event` log is a confirmed room-state fact, not a derived intent; Group D would rank a structural fact below bm25 lexical relevance, which Canon Part 11 R3 forbids | Cite `sensor-priority.cjs:100-133` and 345-ICM-CONSULT R8 | RULED 2026-09-15 -- navigator selected `ratify-all` on the orchestrator's card: Group A ratified as written (read as SENS-20, the corrected id per Section 6, since SENS-19 was claimed by Phase 343 first) | Moving one string in one frozen array, plus the header prose row beside it |

---

## Section 3: Named non-goals carried forward

Four rows, each with its citation, so the next phase inherits a map rather than an audit.

(a) The three dead readers of `jtbd.current.id`: `lib/core/navigation/packet.cjs:318-320` (which
throws `ERR_INVALID_ARG_TYPE` on `getCurrent(null)`), `lib/core/navigation/insights.cjs:368-373`,
`lib/core/navigation/focus.cjs:123-129`. None of these files is in this phase's `files_modified`,
so the Rule-1 correction does not apply and they stay a separate quick task (345-ICM-CONSULT R10
item 1, AP-G4).

(b) Seeding `jtbd:<slug>` to revive `focus.cjs` Rule 1 (R10 item 2).

(c) The mandatory-anchor fix on `typed-claim.cjs::writeClaimNode`, Phase 273 territory (R10 item
3).

(d) The two-column goal-drift doctor statement (R9). Deferred because `data/doctor-modules.json`
is inside 344-05's `files_modified` and this phase does not touch a file Phase 344 was mid-flight
on at the time this phase was researched. Hand it to Phase 346 with this citation.

(e) **The `taxonomy_ladder` rung-casing mismatch** (discovered in plan 06, carried forward again
by name in plan 08, closed out here rather than dropped). The deployed Theo `taxonomy_ladder`
tool's `rung` argument schema is Theo-cased (`'IllDefined'`, `'WellDefined'`, `'UnDefined'`,
`'Wicked'`), not the lowercase ladder-vocabulary form `rung-vocabulary.cjs::toLadderRung` produces
and that `taxonomy-climb.cjs::renderLadder` sends (`'ill-defined'`), per the plan-06 acceptance
criterion that pins the lowercase wire value as a literal requirement. Measured live against the
deployed origin (2026-09-15): sending the lowercase form is REJECTED (`MCP error -32602: ...
expected one of "UnDefined"|"IllDefined"|"WellDefined"|"Wicked" at rung`); sending the Theo-cased
form SUCCEEDS and returns a real `ladder` string plus a structured `rungs` array. Functionally
harmless in production today -- `_resolveLadderText` trusts only a live `.ladder` field and
degrades safely to `localLadderLine` on any other shape, so the strategy card always renders,
just never with the Brain-decorated ladder. Full reproduction:
`lib/core/strategy/strategy-card.cjs`'s own header comment, `345-06-SUMMARY.md` ("Live Finding for
Plan 08"), `345-08-SUMMARY.md` ("Live Finding Carried Forward to 345-09"). Not fixed in this phase
because the lowercase send is a literal, already-ratified acceptance criterion from an earlier
plan (345-06 Task 2), not a bug introduced by drift -- reconciling it is a scoped fix to
`rung-vocabulary.cjs` and/or `taxonomy-climb.cjs::renderLadder`, owned by a dedicated quick task
(see `docs/2026-09-14-PHASE-345-STRATEGY-NODE-CLOSE-OUT.md`, "What stayed open," item (g), and
`docs/OPEN-HANDOFFS.md`'s Phase 345 row) rather than a drive-by edit inside this close-out plan.

---

## Section 4: Surface statement (Tri-Polar)

The sensor and the anchor mint live in `lib/core` and therefore run on all three surfaces (CLI,
Desktop, Cowork); the card renders through the existing three-rung gate renderer ladder and mints
no second renderer; the fixture acceptance test in plan 07 exercises the MCP `gate_answer` path,
and the CLI `gate_reached` path is wired in the same plan and asserted separately.

---

## Section 5: Grounding

Two langtalks source offsets, cited verbatim per 345-LANGTALKS-CONSULT: **4645:4703** (blind
upward movement: a loop cannot question its own goal) and **4810:4853** (the strategy node: a
slower node that runs on its own cadence, analyzes outcome rates, and rewrites the goals of the
downstream execution loops). Scheduled JTBD or rung re-evaluation and stall-signal triggers are
NAMED ASSUMPTIONS with no corpus source, per 345-LANGTALKS-CONSULT; they are MindrianOS
engineering doctrine, not a corpus finding.

---

## Section 6: Discovered correction for the plan-05 checkpoint

**SENS-19 is no longer a free id.** Phase 343 landed on this tree (closed before this plan
executed) and claimed `SENS-19` for `sensorGraphIntegrity` (`lib/core/insight-sensors.cjs:813`,
`SENSOR_REGISTRY_IDS`; `lib/core/sensors/sensor-priority.cjs` Group A entry "SENS-19
graph-integrity"; ratified at `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md` WD-7, CENSUS-10). The
`345-RESEARCH.md`, `345-ICM-CONSULT.md`, and this phase's plan set (01 through 09) were authored
against the id `SENS-19` for the strategy-reach sensor, evidently before, or in parallel with,
Phase 343's own landing of the same id for a different sensor. That collision is real, measured
this session (`grep -n "SENS-19" lib/core/insight-sensors.cjs` returns the `sensorGraphIntegrity`
row, index 19, both arrays 20 entries long), and it is NOT corrected by hand-editing the STRAT
rows or WD-9 above: those rows are prescribed verbatim by `345-01-PLAN.md`'s own task text, and
diverging from that wording here would desynchronize this record from the plan file it is meant
to travel alongside, while every other 345 plan (04, 05, 07, 08, 09) still reads `SENS-19` in its
own already-authored text.

**The correction, named for whichever plan executes the actual sensor registration (planned as
345-05):** register the strategy-reach sensor as **`SENS-20`** (the next free id; `SENSOR_REGISTRY_IDS`
currently ends at index 19 with `SENS-19` occupied), not `SENS-19`, in every one of the seven
lockstep places, in `SENS_PRIORITY`, in the sensor's own module header and doctrine comment, in
every `tests/test-345-*.cjs` assertion that currently reads the literal `'SENS-19'`, and in the
`evidence.sensor_id` string the sensor itself stamps. Every STRAT/WD row above that names
`SENS-19` (STRAT-06 through STRAT-09, WD-9) should be read as naming "the strategy-reach sensor
id, corrected to SENS-20 at plan-05 execution time" rather than the literal string `SENS-19`. This
note is the authoritative correction; a later plan's own text, if it still says `SENS-19` when
read, has not yet applied it.

This is exactly the class of drift this document exists to prevent (Section 5 of
`345-ICM-CONSULT.md`'s framing: "a fourth, incompatible model" problem, here applied to an id
collision instead of a vocabulary collision), and it is recorded here rather than silently patched
because plan 01 does not touch any sensor-registration file (`lib/core/insight-sensors.cjs`,
`lib/core/sensors/sensor-priority.cjs`, `lib/core/navigation-engine.cjs` are all outside this
plan's `files_modified`), so the fix belongs to the plan that actually lands the registration, with
this note as its input.

House rules observed: hyphens only, no em-dashes, no emoji, no real names.
