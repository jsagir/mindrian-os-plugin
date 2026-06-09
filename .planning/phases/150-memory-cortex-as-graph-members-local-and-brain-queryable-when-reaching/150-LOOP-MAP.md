# Phase 150 Loop-Closure Map (cross-phase memory/graph/ICM revisit)

> "Revisit all md + graph memory / sqlgraph / dual graph / brain work / local work / and ICM structure related phases. See how 150 can be the closing of the loop on all those." -- navigator, 2026-06-09.
>
> Produced by a 5-agent read-only cross-phase fan-out (MD+ICM / SQL local spine / dual-graph+Brain / retrieval+consumption / open-deferred-loops inventory) on 2026-06-09. All file:line evidence verified against `main`. This is the honest "after 150, what is closed and what stays open" map.

## Headline

The memory system is FAR more complete than the stale phase map suggests: the local retrieval spine (141), the compute-store-ACT loop (142, EXECUTED -- VERIFICATION 6/6, the "not yet executed" map row is STALE), the sensors (143), the engine flip (144), and the selector machinery (148) are ALL shipped and live. **The loop breaks precisely where the USER memory cortex should feed it.** Phase 150 closes that local break completely and lights up the dormant remote wire by becoming its first consumer -- but it does NOT, by itself, close the remote-Brain live writes or the semantic-quality gate. Those are honest companions.

## The local loop and its 4 broken links (retrieval cluster)

The loop `memory read -> grounded reach -> presented -> filed -> memory` breaks at 4 links, each mapped to a 150 requirement:

| Link | Break | Evidence | Closed by |
|------|-------|----------|-----------|
| L1 | Memory cortex is NOT a graph member (6 MD files read flat; the 149 dev/user inversion) | `grep memory_artifact lib/` = 0; folder-memory.cjs flat read | MEM-01..04 (memory_artifact writer + governing_thought/persona/decision nodes + reconcile + lineage + hook) -- mirrors 149 |
| L2 | getRoomContext can't see the cortex (surfaces in-content claims/events only) | room-context.cjs has zero cortex SELECT | MEM-05 (legD/cortexNodes) + MEM-06 (REMOTE typed packet) |
| L3 | decide() sensors STARVED (lowFillSections/venture_stage no producer) | navigation-engine.cjs:622 reads ctx.lowFillSections; intent-classifier.cjs:1220 never sets it; sensorTuple.stage undefined :618 | MEM-07 (produce sensor ctx from STATE/USER projection) |
| L4 | Render arm UNSURFACED (buildReachList + dial-presenter have NO production caller; engine decides, navigator never sees) | grep buildReachList / require dial-presenter outside orchestrator+tests = empty; intent-classifier consumes fire_skill for routing only | D-08 render unlock + MEM-08 (selector graph-driven; live caller) -- the 148+150 PAIR |

## The SQL local graph spine is HALF-WIRED (cluster 2 -- the deepest finding)

The local "mind" (Canon Part 9) shipped 3 of its 4 constitutional layers COMPLETELY -- navigation (109 chokepoint + memory_event, acceptance-tested), truth-state enforcement (108 contract + promoteNodeStatus + 129.5 confirmNode), and the READ surface (room-home/insights/packet). **But the PROJECTION/WRITE layer for truth-claim nodes is missing.** Grep proves zero ongoing production writers for `claim`, `decision`, `evidence`, and (casing-broken) `opportunity`; `assumption` has only a one-shot 109 migration:

- **The decision EXTEND promotion NEVER got a writer.** Phase 108 (RECONCILIATION.md:97) promised "promote decisions_index rows to graph nodes via DECIDES edge." `decisions_index` is created (memory-ops.cjs:113) but NEVER INSERTed in production. `find_stale_decisions` (insights.cjs:118), focus.cjs:126, room-home.cjs:60, packet.cjs:62 all query `type='decision'` -> SILENT EMPTY SET in every real room.
- **Triple-ledger drift:** a decision lives in MINTO.md decision_log (decision-capture.cjs:460) + the orphan decisions_index table + memory_event `f_selector_decision` (selector-decisions.cjs:180) -- none of which is the `decision` graph node the reads expect.
- **129.5 confirmNode works, but there is almost nothing to confirm** -- the promotion lever sits on a near-empty pile because the producers are missing.

**150 closes the DECISION loop** (D-03 + mechanism item 1 ships the decision-node projector -- the exact 108/109 EXTEND that never landed) and the cortex gap. **150 does NOT close** the ongoing `assumption` table->node drift, the `claim`/`evidence`/`open_question`/`entity`/`meeting` writers (the rest of the 108 NEW taxonomy), or the `Opportunity`(cap)/`opportunity`(lower) casing mismatch (graph-ops.cjs:219).

## The dual-graph / Brain side is BUILT-BUT-DORMANT (cluster 3)

The machinery shipped; there is no live consumer and the live writes are deferred:
- **sendPacket has ZERO production consumers; allow_excerpts is unconsumed** (packet.cjs:31-33). **150 would be the FIRST real sendPacket consumer** -- it lights up the dormant wire and inherits the weight of proving the Part-8 guards fire in production.
- **Phase 132 live Brain writes are DEFERRED** (curation-132-05-pseudonymize.cjs:169 refuses --execute; zero live reify). **6 internal-team `:Person` real names persist in the production Brain right now. This is the ONE genuinely-open live Part 8 exposure.** 150 must TOLERATE held/un-reified nodes (UNDERSTANDING section 4 caveat 1); it does NOT fix them.
- **HELD nodes are un-joinable** (name > 80 chars -> no correlation_id). 150's join degrades to LOCAL-only.
- **The dual-graph-health gate is report-only** (baseline mode); only new regressions fail.
- **Phase 137 sync-compat harness was never built** (.github/workflows empty).

150 closes the loop by becoming the first consumer; it CANNOT close 132 live writes or 137 -- separate phases.

## MD memory + ICM (cluster 1, covered by the prior 5-agent audit)

FEYNMAN.md is write-only (2 writers, 0 consumers; not in readTriple/readQuadruple; no readQuintuple; the discover.md:170 seed-writer doesn't exist). BRAIN.md is a flat side-channel (9 sections, ~4 used; SECTION_WEIGHTS dead; brainAnchors orphaned). ROOM.md over-enforced/unread; MINTO governing-thought used as a hash + presence gate, the pyramid ignored. The ICM "folder IS the code" structure is real for folders but the per-folder MEMORY is not a graph member. 150 closes FEYNMAN read-back (D scope item 9) + the orphans (D-03) + projects all 6 (MEM-01..04).

## The full open-loop inventory (cluster 5) -- 23 loops, what 150 closes

### Phase 150 GENUINELY closes (the local loop)
1. **L21 USER memory cortex as graph members** -- the headline; fixes the 149 dev/user inversion.
2. **L22 the 4 cortex orphans** -- sensor ctx, brainAnchors producer, SECTION_WEIGHTS (implement-or-delete), decision double-ledger projection.
3. **L23 FEYNMAN.md read-back + the missing seed-writer** -- stops the write-only sink.
4. **L19 the 148+150 render unlock** -- buildReachList->dial-presenter surfaced live; selector graph-driven. Closes ONLY as a pair with 148.
5. **The decision-node EXTEND debt** (108/109) -- the SQL spine's headline writer gap.
6. **First sendPacket consumer** -- proves the dormant dual-graph wire.

### Remains OPEN after 150 -- the honest companions
| Open loop | Why 150 doesn't close it | Companion |
|-----------|--------------------------|-----------|
| **132 live Brain reify + 6-node pseudonymize** | 150 works AROUND held/un-reified nodes. Real names persist in prod Brain -- the one open LIVE Part 8 exposure. | Phase 132 v1.14.0 bulk pass |
| **Part 10 ratification (empathy + Hooked gate)** | 150's harness carves out semantic claims (C2 "is it good", C4 "relevance") to the human gate. | Part 10 ratification (human) |
| **119 D-02 receipt nudge (DEGRADED)** | Substrate may close, but the `venture_classified:true` EMISSION site is a Phase 115 follow-up not named in 150 scope. | Phase 115 dual-path classifier emission |
| **Rest of the 108 truth-claim writers** (claim/evidence/opportunity casing/assumption ongoing-drift) | 150 ships only the decision projector + cortex. | a 108-completion phase |
| **112 GraphRAG retrieval + Room Budding; 113 WASM spike** | Net-new retrieval algorithms / strategic spike. | Phases 112, 113 |
| **100 command-hiding; 88.2 canonical F.1 selector** | 150 keeps frozen 148 contracts. | Phases 100, 88.2 |
| **134 xenova CJS port; 133 conversational-Brain; 136 liquid-state; 137 sync; 138 radar** | NOT-built; 150 names some in its vision frame, delivers none. | Phases 133/134/136/137/138 |
| **144.1 connector-retrofit sweep; 15 of 16 doctor organs** | 150 rides the spine + adds one --claims organ; the sweep + other organs are separate. | Phases 144.1, 139-continuation |

### Two corrections the revisit surfaced (fix the record)
- **95.5 Post-Compact Memory Pipeline is already CLOSED** (shipped v1.13.0-beta.7, VERIFICATION 5/5). The auto-memory note `project_post_compact_memory_pipeline.md` ("half-wired / no consumer") is STALE -- correct it; do NOT list 95.5 as an open companion.
- **142 is EXECUTED** (VERIFICATION 6/6, 2026-06-06). The CANON-PHASE-MAP "plans ready, not yet executed" row is STALE. The getRoomContext->decide() wire (CASC-02) IS live; 150 only ENRICHES its input with the cortex legs -- no double-ownership, but the 150 plan should state it enriches (not lands) that wire.

## Verdict

**Phase 150 closes the LOCAL memory loop -- completely.** It makes the website's "picks up where you left off / suggests a grounded next move / every decision indexed / Brain never sees your content" claims structurally true LOCALLY, and lights up the dormant remote wire as its first consumer. It is honestly NOT a single phase that closes the WHOLE memory system: the remote-Brain LIVE writes (132 -- the open live Part 8 exposure), Part 10 semantic ratification, the 119 nudge emission (115), the rest of the 108 truth-claim writers, and the retrieval-depth phases (112/113/142-already-done/144.1/133/134/136) remain. The loop-closure narrative must name these companions rather than imply 150 swallows them.

**Open scope decision for the navigator:** keep 150 tight (local cortex loop + first-remote-consumer) with named companions, OR widen 150 to ABSORB the nearest adjacent loops -- specifically (a) the full 108 truth-claim writer set (not just decision), and/or (b) the 119 nudge emission via the cortex/USER projection. Widening makes 150 a more complete loop-closer at the cost of a larger phase.
