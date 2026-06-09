# Phase 150 Understanding Pass (pre-planning, navigator-directed)

> "Plan this only after understanding how the work from 140-148 + the spine + the dual-graph can best be utilized by the 150 changes. We are making a claim harness for MindrianOS." -- navigator, 2026-06-09.
>
> Produced by a 4-agent read-only understanding fan-out (140-148 consumption seams / connector spine / dual-graph / claim harness) on 2026-06-09, on top of the earlier 5-agent memory-cortex utilization audit. All file:line evidence is from the agents' reports.

## 0. The unlock thesis (why 148 + 150 are one move)

- `decide()` (lib/core/navigation-engine.cjs:595) IS live-wired: `scripts/intent-classifier.cjs:1329` invokes `runNavigationEngine()` on every UserPromptSubmit; a fired reach flips `routing_source legacy->engine`. The ENGINE fires.
- BUT `buildReachList` (lib/hmi/dial-reach-orchestrator.cjs:211) and `dial-presenter.cjs` have **ZERO production callers** (only orchestrator<->presenter<->tests + doctrine prose). The dial DECIDES internally; the navigator never SEES the presented "one thing most worth your attention."
- Therefore: **148 built the UI machinery; the render is unsurfaced. 150 supplies the grounded signal AND the 148+150 pair wires `buildReachList -> dial-presenter` into the live response.** The two only deliver together. This is the C2 unlock (see the claim harness).
- The claim harness is the proof mechanism: ship 150 RED, turn each `claim-cN` GREEN as the bridge delivers; the marketing site becomes true by instrumentation, not by promise (Part 6 dog-fooding).

## 1. Reuse map -- consumption seams in 140-148 (Canon Part 7: feed, do not rebuild)

| Surface | Seam (file:line) | What 150 inserts |
|---------|------------------|------------------|
| **getRoomContext** | lib/core/navigation/room-context.cjs -- legs A(summary)/B(recentMessages)/C(getNeighborhood); add a `legD` after `relevantNodes` (~line 166) returning a new `cortexNodes` field | A `cortexNodes` leg that SELECTs the 6 projected memory-MD node types so the dial sees governing_thought / gaps / persona / Brain-priors as ranked LOCAL signal. Live-consumed by intent-classifier.cjs:1275. |
| **decide()** | lib/core/navigation-engine.cjs -- `sensorCtx.lowFillSections` (~:622, STARVED, no producer), `sensorTuple.stage` / `ctx.userPersona.venture_stage` (~:618/:188, STARVED), governing_thought (:169-181), Brain priors (:770-792, :946-1036) | PRODUCE the two starved sensor inputs from the STATE/USER cortex projection so `dispatchSensors` (:629) fires on real signal not constant 0/null. Do NOT revive the dead `SECTION_WEIGHTS` import (:64) -- composition stays rule-based. |
| **dial scoring** | lib/hmi/dial-reach-orchestrator.cjs -- `_resolveReachScore(def, roomState)` reads `roomState.reachScores` (:143-151), consumed in `buildReachList` (:220). Orchestrator is a PURE renderer (no room.db). | A getRoomContext->reachScores ADAPTER (new caller, not an orchestrator edit) folds the projected cortex into `roomState.reachScores`. Frozen gate (:175-193), MAX_K=3, DIAL_REACH_K=6 untouched. |
| **reach-component-map archetypes** | lib/hmi/selector-dispatcher.cjs -- `resolveArchetype(reachKey)` (:130-137), static map over reach-component-map.json | Add an OPTIONAL second arg `resolveArchetype(reachKey, cortexState)`: projected node-type presence can ESCALATE a reach's archetype above its static default (e.g. contradiction nodes present -> `select` becomes `confirm`). Optional arg defaults undefined -> all existing callers + frozen 148 contracts byte-stable. The static map stays the floor; cortex only escalates. |
| **test/aggregator** | tests/run-all-149.sh (tolerant owning-plan runner) + tests/run-all-148.sh (gate variant w/ Part-8 grep sweep) + tests/test-149-brain-egress.cjs (adversarial poison + navigation-only invariant) | Clone run-all-149.sh -> run-all-150.sh; clone test-149-brain-egress.cjs -> test-150-brain-egress.cjs poisoning the 6 projected cortex nodes. |

**Already exists, do NOT rebuild:** getRoomContext Leg-C ranked neighborhood + `buildNavigatedNeighborhood`; the `reachScores` consumption seam + the frozen 0.70/0.15 gate; `resolveArchetype` + the reach-component-map registry; the sensor spine (`dispatchSensors`, `sensor-lagging-component` already reads `ctx.lowFillSections`); the run-all + egress-test harness patterns.

## 2. Connector spine plug-in (Phase 143.3 -- ride it, no new dispatcher)

- The `connector:` frontmatter is an 11-key block (docs/CONNECTOR-CONTRACT.md:21-34); `scripts/build-connector-registry.cjs` distills `connects_to_spine:true` surfaces into `data/connector-registry.json` (53 connectors: 46 cmd + 7 agent + 0 skill); a `--check` tripwire CI-gates it; `skills/intelligence-orchestrator/SKILL.md` reads the registry and dispatches ONE reach per beat via the 5-step loop. A surface joins by declaring ONE block -- never by editing the orchestrator.
- **Minimal 150 declaration** (smallest --check-clean shape, no framework-map change), on a command or agent `.md` (a lib reach alone is NOT registry-eligible -- there is no lib `.md` walk):
  ```yaml
  # --- Phase 143.3 connector frontmatter ---
  connector:
    connects_to_spine: true
    sensor_triggers: [SENS-06]          # or a new SENS id added to SENSOR_REGISTRY
    reach_id: cross_room                # one of the FROZEN 6 -- never a 7th
    sub_mode: memory-cortex-bridge      # render label only
    framework: null                     # null + filing:memory_event_only avoids the framework-resolution requirement
    posture: push_forward               # one of the frozen 3
    hierarchy_rank: 60
    filing: memory_event_only
    plan_gated: false
    web_scope: null
  ```
- Frozen banks live in lib/core/sensors/sensor-types.cjs: `REACH_IDS` length 6 (`hats` appended Phase 148), `POSTURE_IDS` length 3. (CONNECTOR-CONTRACT.md prose still says "frozen 5" in places -- STALE; trust the code bank at 6.)
- If 150 needs a new trigger condition, add a sensor fn to `SENSOR_REGISTRY` (lib/core/insight-sensors.cjs:202-212) returning `makeReach({reach_id:'cross_room',...})`; the Part-8 sensor sweep auto-covers new `lib/core/sensors/*.cjs`; the orchestrator routes it with zero edits.

## 3. Dual-graph remote-query (LOCAL<->REMOTE join -- ride it, no new egress path)

- **correlation_id** (lib/core/correlation.cjs:88): `sha256(name + '|' + primary_label)[:16]`, embedding-INDEPENDENT, name-based. A LOCAL memory_event and a REMOTE Brain node carrying the same cid ARE the same logical methodology node, zero content crossing the wire. Local stamping path to mirror: lib/core/navigation/spine-events.cjs:74-86 (`_withCorrelationId`).
- **Typed Brain packet** (data/brain-packet-schema.json): `additionalProperties:false` on every node (the Part-8 teeth), `summary`/`explanation` maxLength:120, `packet.cjs::projectText` emits sha256 by default (prose only under the unconsumed `allow_excerpts` Part-3 opt-in). config can CAP privacy_mode, never RAISE it.
- **The 149 pattern to mirror EXACTLY** (lib/core/planning/artifact-brain-packet.cjs + tests/test-149-brain-egress.cjs): build the packet from node IDs + TYPE + correlation_id + enum scalars via `navigation.getNeighborhood`; NEVER read a node's `properties` JSON; no network requires; ship an adversarial poisoned-seed egress test (FORBIDDEN_SUBSTRINGS seeded in node props, assert `JSON.stringify(packet)` contains none + grep the builder for forbidden requires/calls).
- **Minimal Part-8-safe remote query** when reaching: send `{job, correlation_id, problem_type(UDP|IDP|WDP), complexity(Simple|Complex|Wicked), persona(P-enum), current_framework(public handle), governing_thought_hash(sha256), stage, gap_count}`. Response via lib/brain/chain-recommender.cjs: an ordered framework-name chain, or `recommendCanonicalTargets` -> `[{correlation_id, canonical_name, primary_label}]` deduped on cid -- which re-joins the advice back to LOCAL memory-cortex nodes by the same hash. Brain proposes; never confirms (Part 9 role 4-5).
- **Boundary guards 150 must pass:** check-sendpacket (scripts/check-schema-aliases.cjs:443 -- build via a `navigation/`-resident builder, auto-allowlisted), brain-response-sanitize (PII redaction on Brain responses), auditQueryString (lib/core/rs-egress-prompts.cjs -- default-deny on forbidden patterns), the 9-tripwire packet leak test, and the dual-graph-health Part-8 sweep (add 150's path to `PHASE_130_7_PATHS`).

## 4. Substrate-incompleteness caveats 150 must work around

1. **Phase 132 live writes DEFERRED (machinery-only).** The Brain hypergraph reify + 6-node pseudonymize never ran (`curation-132-05-pseudonymize.cjs` refuses `--execute`). 6 internal-team `:Person` real names persist in the production Brain. 150 must tolerate held/un-reified Brain nodes.
2. **HELD nodes are un-joinable.** Brain nodes with name > 80 chars carry `correlation_status='held-name-not-canonical'` and NO correlation_id -> absent from the LOCAL `correlation_labels` index. 150's join must degrade gracefully (no cid -> LOCAL-only, no remote join).
3. **150 may be the FIRST real `sendPacket` consumer.** `packet.cjs` notes sendPacket has "zero production consumers today" and `allow_excerpts` is unconsumed. 150 inherits the weight of proving the guards fire in PRODUCTION, not just tests -- ship its own adversarial egress test, do not lean on dormant fixtures.
4. **The dual-graph-health gate is report-only (baseline mode).** Only NEW regressions vs baseline fail; it does not hard-block cross-label dups. Do not assume it gates content drift.

## 5. The claim harness (the acceptance gate for 150)

Existing infra to reuse: the per-phase gate pattern (tests/run-all-146.sh = the two-group acceptance aggregator "proves by instrumentation, not by promise"; run-all-149.sh = the RED-by-design tolerant skeleton); `scripts/doctor.cjs:2360 buildAcceptanceChecklist` + the `--acceptance` self-contained-exit-code contract (:2337) + `DOCTOR_TEST_FAIL_POINT` self-test hook; the Part-8 egress tests; the real-room fixture discipline (tests/test-cascade-surface-e2e.cjs:1-50 -- copy a committed fictional fixture to a tmpdir, set `MINDRIAN_ROOMS_HOME=<tmpdir>` on every spawn, NO mocked Brain); Class-M Brain smoke (lib/core/doctor/class-m-brain-smoke.cjs, L1-L5) as the live-Brain precondition that honestly self-skips.

The 7 claims (verbatim site language) -> falsifiable assertions:

| # | Claim | Assertion (real room.db) | Today | 150 dependency |
|---|-------|--------------------------|-------|----------------|
| C1 | "picks up where you left off" | session N+1 resumed focus node == the SAME node id written session N (graph identity, not string-match) | partial (STATE.md + readTriple + getRoomContext live; FEYNMAN is NOT the resume substrate) | cross-session focus continuity via the cortex bridge |
| C2 | "suggests a next move grounded in what your workspace contains / the one thing" | `decide()` returns a reach with `routing_source==='engine'` whose justification references a REAL room node; the verb CHANGES when room state changes; AND the navigator SEES it presented | **BLOCKED render arm** -- engine fires live, but buildReachList->dial-presenter has no production caller | 150+148 wire buildReachList->dial-presenter into the live response |
| C3 | "knowledge graph -- which findings contradict" | filing two conflicting artifacts mints a CONTRADICTS edge in room.db, queryable | testable (cascade live; extend e2e to assert the EDGE, not just status) | contradiction edges minted through the same navigation.cjs chokepoint |
| C4 | "Brain surfaces relevant patterns / cross-reference" | Brain packet returns advisory chain handles; Part-8-clean; degrades gracefully offline | conditional (Class-M L5 real probe; structural only, not semantic "relevance") | cortex bridge is the packet's input source |
| C5 | "every claim, decision, evidence is indexed" | K artifacts filed -> >= K typed nodes with Part-9 review_status; no claim exists only as free-text | testable; completeness invariant is where marketing most likely fails | THE core 150 deliverable: every cortex item bridges to a graph node (K-in/K-indexed) |
| C6 | "Brain never sees your project content" | poison-seeded nodes -> every live packet path -> serialized packet contains none; source grep for forbidden require/fetch/http | **strongest, testable today** (test-149-brain-egress + 9-tripwire) | add the cortex packet path to the egress sweep (RED until the bridge lands) |
| C7 | "filing runs a cascade -- informs/contradicts earlier claims" | file A then conflicting B -> `last-cascade.json` classifies AND an INFORMS/CONTRADICTS edge B->A is minted mid-session | testable (extend e2e to assert the edge) | cross-edge minted into the SAME graph the cascade reads |

**Harness shape:** `tests/claim-harness/` with `run-all-claims.sh` (clone run-all-146 two-group), `fixtures/claim-room/` (one obviously-fictional fixture incl. the contradicting pair + poison-nodes), `build-fixture-room-db.cjs` (real room.db via navigation.cjs, NOT hand-stitched SQLite), `claim-c1..c7.cjs` drivers (each with an honest-negative arm; Brain arms self-skip via Class-M). Optional `doctor --claims` gate (sibling of `--acceptance`, self-contained exit code, `DOCTOR_CLAIM_FAIL_POINT` self-test). Registered as a (b)-group suite in run-all-150.sh.

**Cannot be machine-tested (carve out, do not fake):** C2's "is the suggestion GOOD" + C4's semantic "relevance" -- these are the Part 10 empathy / Hooked-ratification gate ("4/5 testers report 'thinking partner'", NEVER run). The claim harness asserts the substrate FUNCTIONS; the empathy audit remains a separate human gate.

## 6. The vision frame (navigator, 2026-06-09)

150 + 148 are the one phase-pair that unlocks Mindrian's potential: 148 = the UI (the dial / selector render -- structure made visible, the moving-M De Stijl splash); 150 = the memory substrate that grounds it (the cortex as graph members, local + remote queryable when reaching). They must work perfectly together to PROVE Mindrian in its own structure (Part 6). The taxonomy this realizes:

- **ICM = structure** -- the folder hierarchy + room.db graph 150 makes the cortex a member of.
- **PWS = structured thinking** -- the reaches the dial offers (the disciplined moves).
- **Mondrian = creativity within constraints** -- the frozen rails (MAX_K=3, the 6 reaches, the 0.70 gate, the De Stijl grid). Breakthrough comes FROM the constraint. The moving M is the structure made alive.
- **Liquid ever-changing structure, organized** -- room.db updating every turn through the one navigation chokepoint (the Liquid State, Phase 136).
- **Thinking big and small at once** -- the dial ranks the ONE next move (small) grounded in the WHOLE room (big): Simon's near-decomposable hierarchy.

The claim harness is how the vision is PROVEN rather than asserted: each site claim becomes a falsifiable test that goes green as 150 + 148 deliver.
