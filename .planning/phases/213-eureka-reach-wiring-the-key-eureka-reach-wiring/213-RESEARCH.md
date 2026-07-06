# Phase 213: Eureka-Reach Wiring, THE KEY - Research

**Researched:** 2026-07-06
**Domain:** Wiring the SEED-049/050 eureka engine into the governed reach spine (dispatchSensors -> decide() -> F.7 dial -> runChain) + the LarryReacts recommend-next-command surface
**Confidence:** HIGH (every load-bearing claim verified against live code or the rethinking-mindrianos room; zero web research needed - the room answered every major question)

## Summary

The navigator's directive for this research was: validate the ROADMAP's Phase 213 approach against the prior art already filed in the rethinking-mindrianos Data Room, and only go online where the room leaves a gap. Verdict: **the ROADMAP approach and the prior art agree on every structural decision, with one framing conflict that the 2026-07-05 addendum already resolves** - the goal sentence's "wire into Phase 190's build-gate, 202's disqualifier, 205's elevation tree" names those three mechanisms in their PRE-Phase-210 binding forms, but all three were softened by Phase 210 (advisory / signal-not-veto / suggest-not-force), and the prior art (`04-synthesis-rebuild-vs-surgery.md` section 1) explicitly classifies the binding forms as "enforcement overshoot... the walk-back is the immune response, not the disease." Phase 213 must wire into the SOFTENED forms. Wiring into the pre-210 binding semantics would simultaneously re-introduce the forcing mechanism the LOCKED constraint forbids and contradict the room's consolidation-in-place verdict.

The second headline: the room's `04-synthesis` (section 3, Step 2) assigns Phase 213 a bigger job than the ROADMAP sentence does - it is **the first born-wired proof of the spine-at-feature-time discipline**, the #1-leverage structural change of the whole consolidation arc. `01-cli-canon-audit.md` (3d) used the then-empty Phase 213 directory as its exhibit-A of the "build the feature, defer the spine-wiring, wire never" failure mode. The planner should treat "the SENS-13 sensor is wired into `dispatchSensors -> decide()` inside this same phase, verified by a test that fails if the reach is unreachable" as the phase's defining acceptance criterion, not an implementation detail.

All wiring targets verified live: SENS-13 is genuinely the next free sensor id (SENS-01..SENS-12 live, highest is SENS-12 at `lib/core/insight-sensors.cjs:120`); `recommendFrameworkChain`/FEEDS_INTO (`lib/brain/chain-recommender.cjs:6`), `composeWorkflow` (`lib/workflow/command-resolver.cjs:110`), `decide()` (`lib/core/navigation-engine.cjs:817`), `runChain` (`lib/core/chain-executor.cjs:8`), and the 205 pre-drilled sockets (`fusion-router.cjs:283` `ctx.lateralEngine`, `grill-engine.cjs:210` `BLOCKED_UNTIL_200`) all exist as the ROADMAP claims. Two execution blockers remain open and are NOT research blockers: the curing-sequence debug track is still `status: gathering` (steps 2-5 unrun), and Phase 212 is planned (5 plans on disk) but unexecuted, so the Grounding Guard that gates SENS-13's firing does not exist yet.

**Primary recommendation:** Plan 213 as a thin, additive, recommend-only wiring pass over existing surfaces (the `260705-ui4` statusline-ratification-cue quick task is the shipped in-house template for exactly this move), with the SENS-13-reachable-through-decide() born-wired test as the phase gate, the three 190/202/205 touchpoints wired in their post-210 softened semantics, and the Arrival/status-quo/COMPRESSION meters built as deterministic-first code with the critic gate consumed through Phase 212's `eureka-critic.cjs` contract.

<user_constraints>
## User Constraints (no CONTEXT.md exists - locks carried from ROADMAP navigator addenda)

Phase 213 has no CONTEXT.md. The following are navigator-locked decisions recorded in `.planning/ROADMAP.md:2931-2944` and the spawning directive; they bind exactly like CONTEXT.md decisions:

### Locked Decisions
1. **"The Brain RECOMMENDS, never TRIGGERS"** (constitutional here). Flow: Brain scores reaches -> `decide()` -> F.7 dial -> navigator confirms -> `runChain` executes. Phase 213 must NOT re-introduce a forcing mechanism - that is exactly what Phase 210 reverted. [ROADMAP.md:2940]
2. **Sensor id is SENS-13, not SENS-11.** SENS-11 is live (Phase 203-03 reusable-expert, `lib/core/sensors/sensor-expert-skill.cjs`). Verified this session - see Prior-Art Validation V1. [ROADMAP.md:2933]
3. **Wire INTO existing machinery, do not rebuild:** `lib/brain/chain-recommender.cjs` (`recommendFrameworkChain`, FEEDS_INTO traversal) + `lib/workflow/command-resolver.cjs` (`composeWorkflow`) + `navigation-engine.cjs::decide()`. [ROADMAP.md:2938]
4. **Single canonical command-truth source:** `commands/*.md` frontmatter + `data/command-registry.json`. The 116 command-research sub-rooms + 103 dossiers + room.db RELATED_TO edges are ONE-TIME enrichment input, never a fourth live runtime data path. [ROADMAP.md:2937-2939]
5. **Gated by Phase 212's Grounding Guard passing calibration** (212-05 human-verify >=0.85). [ROADMAP.md:2933]
6. **BLOCKED UNTIL** the curing-sequence debug track (`.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md`) has a verdict - it is testing the exact 190/202/205 mechanisms this phase wires into. Execution blocked; research/planning may proceed. [ROADMAP.md:2944]

### Claude's Discretion
- Exact seam shape for each of the three touchpoints (190/202/205), provided all are recommend-only and additive.
- Whether the COMPRESSION meter lives in `lib/core/eureka/` or `lab/` first (see Open Questions).
- Wave structure and test layout.

### Deferred Ideas (OUT OF SCOPE)
- Phase 191's own unfinished business (191-03/191-05 + the `visibility: admin` filter in the offer composer) - ROADMAP.md:3492 explicitly keeps it OUT of 213.
- SEED-052 (GSD each command as a mini-product) - registered, deliberately not actioned.
- Type-3 pattern-transfer / find-analogies (Phase 214) and portfolio fusion (Phase 215).
- Whitespace/structural-hole substrate (Phase 212.5).
</user_constraints>

## Phase Requirements

`.planning/ROADMAP.md:2942` says **"Requirements: TBD"** and no `.planning/REQUIREMENTS.md` exists (verified: file absent). No requirement IDs were provided to this research. The planner should derive requirements from the goal sentence + the locked constraints above; the Prior-Art Validation table below maps each goal clause to its enabling research.

## Prior-Art Validation (PRIMARY DELIVERABLE)

Each row states where the ROADMAP's 213 approach AGREES with or CONFLICTS with a named room entry. Source labels: [room] = rethinking-mindrianos entry, [code] = live repo verification this session, [my inference] where marked.

### V1. Sensor id SENS-13 - ROADMAP AGREES with live code (VERIFIED)

**Claim:** new eureka sensor is SENS-13; SENS-11 is taken.
**Verification [code]:** `lib/core/insight-sensors.cjs` header comments enumerate SENS-01..SENS-12: SENS-11 = Phase 203-03 expert-skill (`insight-sensors.cjs:111`), SENS-12 = Phase 209-05 room-pick (`insight-sensors.cjs:120`). `lib/core/sensors/` grep yields numeric ids SENS-01..SENS-12 (no 13), plus two named sensors (SENS-RECENCY `insight-sensors.cjs:77`, SENS-SHOW `:93`). **SENS-13 is free. The ROADMAP's 2026-07-04 audit correction holds.** The seed's own text carries the same correction ([room] `.planning/seeds/SEED-049-...md` CAPSTONE, "THE EUREKA-REACH" bullet 1).
**Additional live fact for the planner:** SENS-13 must fire the FROZEN `deep_research` reach - `REACH_IDS` is a frozen six-element list (`lib/core/sensors/sensor-types.cjs:43-50`: context_block, contradiction, cross_room, brain_consult, deep_research, hats) and CIRS R3 forbids minting a 7th. SEED-049 already locked `deep_research` as the carrying reach and SENS-02's lagging-component substrate (`lib/core/sensors/sensor-lagging-component.cjs:5,74`) as the reuse base.

### V2. "First born-wired spine proof" - ROADMAP AGREES with room, but the room DEMANDS MORE

**Room entry:** `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/04-synthesis-rebuild-vs-surgery.md`, section 2 change #1 + section 3 Step 2: *"make Phase 213 the first born-wired proof rather than leaving it a `.gitkeep`. Prove it on eureka + one venture-methodology reach, then make it a build-time gate."* Ranked the #1-leverage structural change of the entire consolidation arc.
**Room entry:** `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/01-cli-canon-audit.md`, section 3d: the spine is "load-bearing as a WRITE chokepoint, aspirational as the REACH/decide path"; Phase 213's empty directory is the exhibit: *"the actual build order is: engine first (211, built), spine-wiring second (213, blocked and empty)."*
**Validation:** the ROADMAP's addendum (wire INTO decide()) agrees. But the ROADMAP sentence treats 213 as "wiring work"; the room treats it as **the precedent-setting proof that features wire their reach into `decide()` in the same phase that builds them**. No conflict in direction - a conflict in stakes. The plan must include a test asserting the eureka reach is REACHABLE through `decide()` at runtime (the Phase 185 doctor --drift reachability predicate is the in-house pattern for this, [code] STATE.md Phase 185 entry), and should note the follow-on: after 213 + one more proof phase, spine-routing becomes a born-wired build gate.

### V3. The three 190/202/205 touchpoints - GOAL SENTENCE CONFLICTS with prior art; the addendum resolves it

**The conflict:** ROADMAP goal ([ROADMAP.md:2933], drafted 2026-07-04 from SEED-050 language) says wire into "Phase 190's build-gate declaration, Phase 202's disqualifier, and Phase 205's elevation tree." All three names describe PRE-Phase-210 binding semantics. Phase 210 (COMPLETE, [code] ROADMAP.md:2869 + STATE.md 210 entry) softened exactly these three:
- 190's R16 gate -> **advisory** with `--strict` opt-in ([code] CLAUDE.md Part 11 R16 text; `scripts/check-shape-declaration.cjs:5` "R16 gate core").
- 202's voice-contract disqualifier -> **"SIGNAL, not a gate"** ([code] `lab/apo/apo-loop.cjs:47`, `:247` "Selection sees EVERY candidate").
- 205's elevation quorum -> **"SUGGESTS"** ([code] `lib/core/fusion-router.cjs:516` "Phase 210-D downgrade: the quorum SUGGESTS its cross-frame hypothesis").

**The prior art's ruling [room]:** `04-synthesis-rebuild-vs-surgery.md` section 1 classifies the R15/R16 enforcement stack as "enforcement overshoot... The system is already surgically removing this pile by itself; the walk-back is the immune response, not the disease." Section 3 Step 7 lists the enforcement shell among the deletable clusters.
**Resolution (already encoded in the ROADMAP's own 2026-07-05 addendum, [ROADMAP.md:2935/2940]):** 213 wires into the three touchpoints **in their post-210 softened forms**, meaning:
- 190 touchpoint = the new eureka surface is BORN-DECLARED (`hitl_shape` declared at creation; the advisory R16 lint passes) - not "make the gate harder."
- 202 touchpoint = the COMPRESSION score becomes an APO reward-loop SIGNAL (the lab tunes eureka fire-rate against it, per SEED-050: "APO tunes fire-rate against the compression score" [room seed]) - not a candidate-killing veto.
- 205 touchpoint = the eureka feeds the elevation machinery through the pre-drilled `ctx.lateralEngine` socket ([code] `fusion-router.cjs:283,418-429`) and the GRILL `BLOCKED_UNTIL_200` seam ([code] `grill-engine.cjs:210`) as a suggest-quality input - not a forced elevation branch.
**Any plan task that words a touchpoint as "block," "disqualify," or "force" contradicts both the LOCKED constraint and the room's verdict.**

### V4. Wire-into-not-rebuild - ROADMAP AGREES with M-series doctrine exactly

**Room entry:** `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-architectural-mandates-m-series/2026-07-05-architectural-mandates-m-series.md`. M4 (workflow composability: registry-derived next-steps, not hand-written) is the direct doctrinal ancestor of LarryReacts; the closing recommendation is *"Do not let a sixth subsystem get built as a bespoke per-feature loop before either mandate is ratified."*
**Validation:** the ROADMAP addendum's "wires INTO this, it does not build a traversal from scratch" [ROADMAP.md:2938] is precisely M-series-compliant. Verified the machinery is real, not stub [code]: `recommendFrameworkChain` via FEEDS_INTO reusing `framework-chain-composer.cjs` (`lib/brain/chain-recommender.cjs:6,27-28`, with `isAvailable()` sync degrade at `:39`); `composeWorkflow(frameworkChain)` (`lib/workflow/command-resolver.cjs:110`); the Phase 191 offer composer `lib/core/navigation-engine-offer.cjs` already emits exactly ONE calibrated `{ command, framework, jtbd, confidence }` offer with a margin-floor abstain (`:12,:30,:162`) - the recommend surface is ~85% shipped, matching ROADMAP.md:3492's fork-research figure. Also verified the addendum's data claims: 107 commands, `hitl_shape` on 99, `serves_jtbd` on all 107, `curated_chains` in `data/command-registry.json`, `visibility` count = 1 in the registry (unwired), 3 `visibility: admin` files on disk [code, this session].
**One M-series caution the ROADMAP does not carry:** M4's own failure evidence was "18+ commands shipping the literal `[methodology]` placeholder" - a feature that declared composability but never rendered it. The 213 equivalent failure would be a SENS-13 that registers but whose offer never renders through the F.7 dial. The reachability test (V2) is the countermeasure.

### V5. Ratification-gap discipline - ROADMAP COMPLIES; two dependency facts must be verified at plan time

**Room entry:** `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-reverse-salient-ratification-gap/2026-07-05-reverse-salient-ratification-gap.md` (the most load-bearing entry for 213). Its finding: the system's reverse salient is the conversion step between verdict and tracked, **dependency-checked** work - with a fast failure mode ("promoted WITHOUT its own hard dependency declared", Phase 2, evidence item 2) and a slow one (7-week SEED stalls).
**Validation:** Phase 213 is the anti-instance of the slow mode (it IS ratified, with 6 declared dependencies + an explicit BLOCKED UNTIL clause [ROADMAP.md:2943-2944]) - the room's prescription applied. But the fast-mode lesson bites here in two places the planner must not skip:
1. **Phase 212 is planned, NOT executed** ([code] all five 212 plan checkboxes unchecked, ROADMAP.md:2912-2916; `.planning/phases/212-.../` holds plans but no SUMMARYs). The Grounding Guard (`lib/core/eureka-critic.cjs`, `data/eureka-critic-tags.json`) **does not exist on disk yet** ([code] file absent). 213's GuardGate multiplier has nothing to consume until 212-05's >=0.85 human-verify passes. Scheduling 213 execution before that checkpoint would be a literal SEED-038-shaped repeat of the fast failure mode.
2. **The curing-sequence debug track has no verdict** ([code] `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` frontmatter `status: gathering`; Results: Step 1 PARTIAL, steps 2-5 "not yet run"). ROADMAP's BLOCKED UNTIL stands.

### V6. Shipped wiring precedent - statusline-ratification-cue AGREES with and TEMPLATES the 213 seam style

**Room entry:** `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-statusline-ratification-cue/2026-07-05-statusline-ratification-cue.md`. A ratification-cue was wired into the live statusline by: reusing the existing mechanism end-to-end (writer `persistFromDecision`, zero read-side changes), an **opt-in fallbackProvider** on an existing seam, a ~60-line new scanner, fresh per-call room resolution (never registration-frozen - citing the room's own MCP-staleness finding), and Part 8 enum/count-only content in the shared cache. Shipped: [code] `lib/statusline/ratification-next.cjs` exists; quick task `260705-ui4` has PLAN/RESEARCH/SUMMARY on disk.
**Validation:** this is the in-house proof that the recommend-not-force, additive-seam, reuse-first wiring style the 213 addendum mandates actually ships and stays green (19/19 prior tests unchanged there). The planner should copy four properties: (a) opt-in seam, no default behavior change; (b) read-side untouched; (c) fresh room resolution per call; (d) Part 8: only enums/handles/counts cross any shared or remote surface - for 213 that means the Shape-F offer text names the two bridged node HANDLES and direction enum (structural_transfer vs semantic_implementation), and anything Brain-bound carries only generic handles ([room seed] SEED-049 CAPSTONE "Part 8: only generic handles surface").

### V7. Node floor + 211 substrate health - room CORRECTS a stale constraint; ROADMAP must not carry it

**Room entry:** `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-phase212-blockers-fixed-node22-vec0-correction/2026-07-06-phase212-blockers-fixed-node22-vec0-correction.md`. Section 2 empirically DISPROVES the Node >=23.5.0 floor claim carried by 212-RESEARCH Open Q5 and the room's own earlier diligence: sqlite-vec loads on Node v22.22.2 via better-sqlite3 `allowExtension` (`vec_version()` = 0.1.9); the >=23.5 floor applies only to `node:sqlite`'s loadExtension. Explicit consequence stated for THIS phase: *"Consequence for Phase 212.5 / 213-215 planning: do not carry the Node >=23.5 floor as a constraint."*
**Validation:** no 213 plan may cite a Node floor or gate vec0 usage on runtime version; the CJS-cosine path is the honest degrade only when the extension is genuinely absent. Both 211 generator blockers (live-mode OOM batching; vec0 probe-based backend selection with WeakSet handle gating) are FIXED on main (commits c222ff7d/7ec75b5e/73698c73/37ed9c67 [room]; [code] `lib/core/eureka/` ships embedding-spine/vector-store/tri-modal-index/hybrid-retrieve/lexical-overlap). `run-all-211.sh` = PASS=9 FAIL=1 where the 1 is a pre-existing env-dependent rerank leg, proven by HEAD~1 revert-repro [room section 1] - the planner should not treat that leg as a 213 regression.

### V8. Chain-executor layer tension - REAL but RESOLVED in favor of wiring in

**Apparent conflict:** `01-cli-canon-audit.md` 3c names the chain-executor/workflow layer (runChain, command-resolver, composeWorkflow, command-registry) as CLI-legacy scaffolding cluster 4, "~90% wiring of existing code... most deletable"; `04-synthesis` Step 7 schedules it for opportunistic retirement. The ROADMAP mandates wiring 213 INTO that same layer.
**Resolution:** `04-synthesis` itself resolves this - retirement is "opportunistic as phases touch them," never scheduled, and "deleting it means lean harder on the native subagent/hook/MCP primitives, which is itself in-place work" (section 1, cluster 4). Canon Part 7 (reuse-before-build) and M-series (no second traversal) both outrank a someday-retirement note. **[my inference]:** keep 213's integration seams THIN (V6 style - one additive provider function per touchpoint, no new orchestration state), so that if the glue layer is ever retired the eureka wiring moves with a one-file edit instead of a re-architecture.

### V9. Critic-scope split - 212-RESEARCH and the room both hand 213 the graders; no conflict

**Sources:** [code] `.planning/phases/212-.../212-RESEARCH.md:62-63` explicitly defers "Arrival grader, status-quo judge, question-type judge, COMPRESSION meter (SEED-050 step 5)" and "eureka-reach/SENS-13 wiring, Shape-F offer, LarryReacts" to Phase 213. [room seed] SEED-050 defines the exact designs: Arrival grader verdicts Full/Partial/Missed/**Lured (negative)**; status-quo label `status_quo_stuck` vs `redirect_ok`; the deterministic composite `Score = CompressionDelta x GuardGate x StatusQuoGate` with every case card carrying `human_baseline_effort` (arrival without compression = null - the $12M->$30M niche-foods negative). The Phase 211 gold set already exists as the calibration baseline: [code] `evals/eureka/211-manual-baseline.md` ("211 manual COMPRESSION baseline (first gold set)"), `evals/eureka/README.md:41` ("THE METRIC - COMPRESSION, not arrival"), `evals/eureka/cases/`.
**One scope note from SEED-050 (lines 102-105):** the critic-side judges should be designed as an MCP-servable ruling API (inputs = abstracted feature vectors, output = verdict + confidence) so the calibration can live behind Mindrian's own MCP - "a scope refinement, not new architecture." The deterministic COMPRESSION meter itself is code, not an LLM judge, and stays local.

### Where the room left a genuine gap requiring online research: NONE

Every major question (sensor id, wiring surfaces, softened-vs-binding touchpoint semantics, Node floor, judge design, gold-set existence, blocker status) was answered by the room + live code. No web research was performed, consistent with the MCP-stack-awareness rule (no silent WebSearch) and the navigator's ask-the-room-first directive. This phase installs **zero new packages** (see Package Legitimacy Audit), which removes the usual web-verification workload.

## Project Constraints (from CLAUDE.md)

- **Workspace guard:** all work in `/home/jsagi/dev/MindrianOS-Plugin/`, never the plugin cache.
- **Canon Part 3:** material choices pass the Tri-Context gate through Shape F (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen). The eureka offer is Shape-F content, not a new selector.
- **Canon Part 7:** reuse before build - the plan must justify any net-new surface against the 25 methodology commands + existing libs. (This research pre-justifies: the only net-new runtime surfaces are the SENS-13 detector, the deterministic meter(s), and thin seam functions.)
- **Canon Part 8:** LOCAL -> BRAIN: NO. Only generic handles/enums cross the wire. The eureka's bridged-node CONTENT never egresses.
- **Canon Part 11 (CIRS):** every new invocable surface is born WIRED or EXCLUDED, and born with a declared HITL shape (R16, advisory as of Phase 210 - declare anyway; do not rely on the advisory downgrade).
- **Canon Part 12:** Larry offers hedged, never grades, never forces; De Stijl color mark on every turn.
- **Tri-Polar rule:** the eureka offer must work on CLI (card), Desktop (conversational), Cowork (shared room) - the sensor + offer composer path is surface-agnostic; only rendering differs.
- **Conventions:** CJS only, no TypeScript; no em-dashes anywhere; bash scripts stay authoritative; every feature evaluated on all three surfaces.
- **Verification:** phase tests via `bash tests/run-all-213.sh` (to create); born-wired gates `node scripts/build-connector-registry.cjs --check`, `check-render-coverage.cjs`, `check-shape-declaration.cjs`; roll-up `node scripts/doctor.cjs --acceptance`.
- **Dev-Research Compositing:** this phase touches MindrianOS's own architecture - findings file in BOTH the phase dir AND `~/MindrianRooms/rethinking-mindrianos/research/` (this RESEARCH.md needs a room mirror at plan/execute time, or an explicit waiver).

## Architectural Responsibility Map

The plugin's tiers, not web tiers:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect eureka availability (bridge exists in graph) | Sensor plane (`lib/core/sensors/` SENS-13) | Eureka lib (`lib/core/eureka/`, `rs-differential-scorer.cjs::scoreMeasured`) | Sensors watch state and fire reaches; the differential math already ships in 211 [code :413,:473] |
| Rank + gate the offer | Reach/decide plane (`navigation-engine.cjs::decide()`) | F.7 dial (`lib/hmi/dial-presenter.cjs`, `dial-label-composer.cjs`) | LOCKED: decide() is the ONE selection brain; no second scorer |
| Render the offer + navigator confirm | HMI plane (Shape-F F.1/F.5 via SEED-020 single door) | - | `deep_research` maps to a closed shape ('Spawn Sub-Agent', `navigation-engine.cjs:409,:429`) |
| Recommend next command (LarryReacts) | Offer composer (`navigation-engine-offer.cjs`) + registry (`data/command-registry.json`) | `chain-recommender.cjs` (Brain FEEDS_INTO, generic handles only) | 85% shipped; frontmatter/registry is the single canonical source (LOCKED) |
| Execute confirmed chain | Workflow plane (`composeWorkflow` -> `runChain`) | - | runChain halts at first material step; opens NO Brain wire [code chain-executor.cjs:8,43] |
| Grade the eureka (GuardGate) | Phase 212 critic (`eureka-critic.cjs` + `eureka_critic` MCP tool) - NOT built yet | - | 213 consumes the contract; does not build the guard |
| Score compression/arrival/status-quo | Eval plane (deterministic meter + graders; `evals/eureka/` gold set) | lab/apo (APO tunes fire-rate against the score - SIGNAL, not veto) | SEED-050 design; 211-04 baseline exists |
| Write back a pursued eureka | navigation.cjs chokepoint + Phase 189 HITL basket + 201-03 graph-refine | - | Part 9: only a human confirms a truth-claim node |

## Standard Stack

**No new external packages.** This is a wiring phase over shipped internals:

### Core (existing internal surfaces - wire into, do not modify semantics)
| Surface | Location (verified) | Role in 213 |
|---------|--------------------|-------------|
| Sensor registry + types | `lib/core/insight-sensors.cjs`, `lib/core/sensors/sensor-types.cjs` (REACH_IDS frozen six, `:43-50`) | Register SENS-13; fire `deep_research` |
| SENS-02 substrate | `lib/core/sensors/sensor-lagging-component.cjs` | Reuse base per SEED-049 CAPSTONE |
| decide() engine | `lib/core/navigation-engine.cjs:817` | The one selection brain; reachability test target |
| Offer composer | `lib/core/navigation-engine-offer.cjs` | LarryReacts recommend surface (margin-floor abstain built in) |
| Chain recommender | `lib/brain/chain-recommender.cjs` (FEEDS_INTO; `isAvailable()` degrade) | Brain-advisory next-framework leg (generic handles only) |
| Workflow resolver + executor | `lib/workflow/command-resolver.cjs:110`, `lib/core/chain-executor.cjs` | Confirmed-offer execution; halt-at-material |
| 205 sockets | `lib/core/fusion-router.cjs:283` (`ctx.lateralEngine`), `lib/core/grill-engine.cjs:210` (`BLOCKED_UNTIL_200`) | Pre-drilled injection points; grill has a written 4-fix live-wiring spec |
| Differential | `lib/core/rs-differential-scorer.cjs::scoreMeasured` (`:413,:473`) | The measured bridge signal SENS-13 consumes |
| Eureka substrate | `lib/core/eureka/{embedding-spine,vector-store,tri-modal-index,hybrid-retrieve,lexical-overlap}.cjs` | 211's shipped engine (both infra blockers fixed) |
| Gold set + formula | `evals/eureka/211-manual-baseline.md`, `evals/eureka/README.md`, `evals/eureka/cases/` | Calibration baseline for the meters |
| Critic contract (pending 212) | `data/eureka-critic-tags.json` + `lib/core/eureka-critic.cjs` per 212-01-PLAN | GuardGate input; consume, don't build |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Registering SENS-13 | Piggybacking on SENS-02 directly | Violates the ROADMAP's explicit SENS-13 lock; SENS-02 fires a different reach mapping |
| Frontmatter/registry as command truth | room.db RELATED_TO edges (710 live) as runtime source | LOCKED against - "querying three overlapping sources of command truth at runtime... is the mistake to avoid" [ROADMAP.md:2939] |
| Deterministic COMPRESSION meter in code | LLM-judge for compression | SEED-050 is explicit: the meter is THE deterministic leg; LLM judges are Arrival/status-quo only |

**Installation:** none.

## Package Legitimacy Audit

This phase installs **no external packages** - all dependencies (`better-sqlite3`, `sqlite-vec`, `@huggingface/transformers`, MCP SDK, zod) already ship from Phases 211/212-planning and passed their own Phase 211-01 "deps legitimacy gate" [code ROADMAP.md:2896]. slopcheck not run - nothing to check.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram (the governed recommend loop, post-210 semantics)

```
room.db graph state (211 tri-modal index + scoreMeasured differential)
        |
        v
SENS-13 eureka detector (new; reuses SENS-02 substrate)
  fires only when: bridge exists (bert-high/lsa-low, non-co-occurring communities)
                   AND GuardGate available (212 critic verdict != pseudoscience/restatement)
        |
        v  (reach_id = deep_research, FROZEN; no 7th reach)
dispatchSensors -> decide()  [navigation-engine.cjs:817]
        |            \
        |             +--> LarryReacts offer composer [navigation-engine-offer.cjs]
        |                    reads: commands/*.md frontmatter via command-registry.json
        |                    (serves_jtbd + hitl_shape + curated_chains)
        |                    optional Brain leg: recommendFrameworkChain (FEEDS_INTO,
        |                    generic handles only, isAvailable() degrade)
        v
F.7 dial / Shape-F card (F.1 single offer, F.5 when it branches)
  Larry voices it HEDGED (Part 12): "X and Y look like the same structure -
  here is the opportunity + transfer direction. Want to pursue it?"
        |
        v  NAVIGATOR CONFIRMS (the only trigger in the system)
composeWorkflow -> runChain (autonomous_safe prefix, HALT at first material step)
        |
        v
outcomes fan out (all recommend-grade, none forcing):
  - pursued eureka -> Phase 189 HITL basket -> navigation.cjs write (Part 9 human gate)
  - COMPRESSION meter scores the arc (deterministic: CompressionDelta x GuardGate x StatusQuoGate)
  - score flows to lab/apo as a reward SIGNAL (202 touchpoint, post-210: never a veto)
  - elevation machinery consumes via ctx.lateralEngine socket (205 touchpoint: suggest)
  - new surface born-DECLARED with hitl_shape (190 touchpoint: advisory lint green)
```

### Pattern 1: Additive opt-in seam (the ui4 template)
**What:** every touchpoint is a new optional provider/parameter on an existing function; default behavior byte-identical with the option absent.
**When to use:** all three 190/202/205 touchpoints + the offer-composer extension.
**Source:** [room] statusline-ratification-cue entry ("existing 19/19 clear-semantics tests stay green since no-opts behavior is byte-identical"); shipped at `lib/statusline/ratification-next.cjs`.

### Pattern 2: Born-wired reach test in the same phase
**What:** a test that fails if SENS-13's reach is unreachable through `decide()` at runtime (not just registered).
**Source:** Phase 185's doctor --drift reachability predicate ([code] STATE.md Phase 185: "doctor --drift now FAILS when a WIRED capability is unreachable by decide() at runtime").

### Pattern 3: Probe-based capability selection, never disk-state inference
**What:** any "is the guard/critic available" check probes the live module (mirror of `ensureVecLoaded()`), never infers from a file existing on disk.
**Source:** [room] phase212-blockers entry, Blocker 2 - the vec0 bug was exactly a disk-state-implies-capability inference.

### Anti-Patterns to Avoid
- **Forcing mechanism in any form** (auto-fire, mandatory card, disqualifier, blocked-until-answered): re-introduces what 210 reverted; contradicts LOCKED constraint. The Stop-hook force-fire incident is live memory (`feedback_1_15_enforcement_regression_watch.md`).
- **A second selection brain:** scoring/ranking eureka offers anywhere but `decide()` violates the connector-spine architecture (CLAUDE.md: "no second selection brain").
- **A 7th reach id:** REACH_IDS is frozen (CIRS R3). SENS-13 rides `deep_research`.
- **Runtime reads of dossiers/sub-rooms/room.db for command truth:** enrichment is one-time backfill into frontmatter; runtime reads registry only [ROADMAP.md:2939].
- **Command-triggered eureka:** "a command-triggered eureka engine is dead on arrival... students do not type commands" [room seed SEED-049, THE KEY section]. The sensor is the key, not a command.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FEEDS_INTO traversal | new chain walker | `recommendFrameworkChain` (`lib/brain/chain-recommender.cjs`) | exists, tested, Part 8-safe, degrade path built |
| Command chaining/execution | new orchestrator | `composeWorkflow` + `runChain` | halt-at-material + retry budget (201-02) already governed |
| Offer ranking/abstain | new scorer | `navigation-engine-offer.cjs` margin floor | calibrated; single-offer contract with confidence |
| Bridge detection math | new differential | `scoreMeasured` + `lib/core/eureka/` | 211 shipped it measured, provenance-tagged |
| Grounding verdicts | in-phase critic | Phase 212's `eureka-critic.cjs` contract | two-in-a-box: the critic phase owns calibration |
| Elevation entry point | new fusion branch | `ctx.lateralEngine` socket (`fusion-router.cjs:283`) | 205 pre-drilled it, degrades `blocked_until_phase_200_rs` |
| HITL write-back gate | new approval flow | Phase 189 chokepoint basket + navigation.cjs | Part 9 human-confirms-truth-claim already enforced |

**Key insight:** SEED-049's CAPSTONE quantifies it - the engine is ~80% already shipped; 213 is a UNIFICATION phase. Every hand-rolled duplicate here is a sixth instance of the M-series disease.

## Common Pitfalls

### Pitfall 1: Wiring into the pre-210 binding semantics
**What goes wrong:** the goal sentence's vocabulary ("build-gate," "disqualifier," "elevation tree") tempts a planner into hard gates.
**Why:** the sentence was drafted 2026-07-04 from SEED-050 language; Phase 210's softening landed in code and canon (entry 37) before it.
**How to avoid:** V3's resolution table - advisory/signal/suggest wordings only.
**Warning signs:** any plan verb like "block," "reject," "force," "must answer."

### Pitfall 2: deep_research rank starvation
**What goes wrong:** the eureka offer never surfaces because `deep_research` is 5th in canonical REACH_IDS order and `sensorReaches[0]` (top by canonical order) drives the fired shape ([code] `navigation-engine.cjs:600-601`); any same-turn context_block/contradiction sensor outranks it.
**How to avoid [my inference]:** verify the actual co-fire behavior during planning; the fix, if needed, belongs in SENS-13's firing condition (fire on quiet turns / stronger gating), NOT in reordering REACH_IDS (frozen) or bypassing decide().
**Warning signs:** reachability test passes in isolation but the offer never renders in a real session probe.

### Pitfall 3: Scheduling execution before the two open gates
**What goes wrong:** the SEED-038 fast-failure repeat (V5) - work starts against 190/202/205 mechanisms the curing bisect may still change, or against a Grounding Guard that hasn't passed >=0.85.
**How to avoid:** plan now; gate execution on (a) curing-track verdict, (b) 212-05 checkpoint. State both as explicit plan preconditions.

### Pitfall 4: Arrival-without-compression scoring
**What goes wrong:** a grader that rewards reaching the destination scores the niche-foods null-control positively.
**How to avoid:** the meter is CompressionDelta-based vs `human_baseline_effort` on every case card; Lured scores NEGATIVE. The 211-04 baseline (`evals/eureka/211-manual-baseline.md`) is the regression anchor.

### Pitfall 5: Part 8 leakage in the offer or the APO signal
**What goes wrong:** bridged-node CONTENT (user text) rides into a Brain query, telemetry shard, or the shared next-move cache.
**How to avoid:** handles + enums only across every non-local surface (V6 property d); reuse the 196 `classify()` Part-8 guard on any online/remote leg.

## Code Examples

### Registering a sensor that fires an existing frozen reach (the SENS-11/12 idiom)
```
// Source: lib/core/insight-sensors.cjs:111,:120 + :600-604 (registry wiring comments)
// SENS-11 (expert-skill) and SENS-12 (room-pick) both fire the EXISTING
// context_block reach. SENS-13 does the same with deep_research:
//   - detector module in lib/core/sensors/sensor-eureka.cjs (name TBD by planner)
//   - registered in SENSOR_REGISTRY in canonical order
//   - emits { reach_id: 'deep_research', payload: '<handle>:<enum>' }  // enum-only payload, insight-sensors.cjs:500 idiom
```

### The single-offer recommend contract (LarryReacts substrate)
```
// Source: lib/core/navigation-engine-offer.cjs:12,:30,:162,:200
// emits exactly ONE calibrated offer or null (margin-floor abstain):
//   { command, framework, jtbd, confidence }
// confidence = clamp01(score*0.5 + margin*0.5); downstream floor 0.7 enforced at consumer (:544)
// D-02: consumers never re-derive or re-weight confidence (:673)
```

### The composite score (SEED-050, deterministic)
```
// Source: .planning/seeds/SEED-050-...md:47 + evals/eureka/README.md:41
// Score = CompressionDelta(hypothesis_in -> destination) x GuardGate x StatusQuoGate
// GuardGate = 0 if any scoring-path turn is 'pseudoscience' (212 critic verdict)
// StatusQuoGate = 0 if any scoring-path turn is 'status_quo_stuck'
// Lured (fell for seeded distractor) = NEGATIVE, not zero
```

## State of the Art

| Old Approach (pre-210) | Current Approach (post-210, what 213 targets) | When Changed | Impact |
|--------------------|------------------------------------------|--------------|--------|
| R16 shape gate HARD-FAIL | Advisory lint, `--strict` opt-in | Phase 210-06, canon entry 37, 2026-07-03 | 190 touchpoint = declare-at-birth, not harden-the-gate |
| Voice-contract DISQUALIFIER before selectBest | SIGNAL: per-violation dent on blended score; selection sees every candidate | Phase 210-C (`apo-loop.cjs:47,:247`) | 202 touchpoint = compression score joins the reward blend |
| Elevation quorum mechanical must-follow | Quorum SUGGESTS its cross-frame hypothesis | Phase 210-D (`fusion-router.cjs:516`) | 205 touchpoint = eureka feeds suggestions via lateralEngine |
| Legacy score() (Python LSA subprocess) | `scoreMeasured` (local, CJS, provenance-tagged) | Phase 211-03 | SENS-13 consumes the measured differential |
| "sqlite-vec needs Node >=23.5" | DISPROVED - loads on Node 22 via better-sqlite3 allowExtension | 2026-07-06 room correction | No Node floor constraint in any 213 plan |

**Deprecated/outdated:**
- SENS-11 as the eureka id: superseded 2026-07-04 (id collision with Phase 203-03).
- The original seed's "Phase 206/208" numbering: renumbered to 211/213.
- Node >=23.5 floor: an over-read of `node:sqlite` docs; corrected in the room.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Keeping 213 seams thin future-proofs against workflow-layer retirement | V8 [my inference] | Low - extra refactor cost later, no behavior risk |
| A2 | deep_research rank starvation is a live risk needing a firing-condition fix | Pitfall 2 [my inference from navigation-engine.cjs:600-601; co-fire behavior not empirically tested this session] | Medium - if wrong, wasted gating complexity; if right and ignored, the KEY never surfaces |
| A3 | The curing bisect will not materially change the 190/202/205 seams beyond what 210 already softened | Pitfall 3 | Medium - plans may need seam re-verification after the verdict; hence the BLOCKED UNTIL |

Everything else above is [VERIFIED: live code] or [CITED: room entry / repo path] per the inline tags.

## Open Questions

1. **Where do the Arrival/status-quo graders and COMPRESSION meter live - `lib/core/eureka/` or `lab/`?**
   - What we know: the meter is deterministic (code); graders are LLM-judges; SEED-050:102-105 wants the judge family MCP-servable eventually; 202's precedent puts tuning loops in `lab/apo/`.
   - Recommendation: meter in `lib/core/eureka/` (runtime-consumed by the APO signal), graders eval-side first (`lab/` + `evals/eureka/`), MCP-servable packaging deferred to the critic-MCP step of the consolidation arc (`04-synthesis` Step 4).
2. **Does SENS-13 fire pre- or post-GuardGate?**
   - What we know: the two-in-a-box doctrine says neither ships trustworthy alone; the guard's #1 job is restatement filtering.
   - Recommendation: guard verdict as a firing precondition (a restatement never becomes an offer), with a probe-based availability check (Pattern 3) and an honest degrade (no guard -> no fire, never no guard -> unguarded fire). The navigator should confirm this at plan discussion.
3. **What is the second born-wired proof phase?** `04-synthesis` Step 2 wants eureka + one venture-methodology reach before the build-time gate is minted. Out of 213's scope, but the planner should name the candidate in the phase summary so the ratification-gap discipline (V5) holds.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | YES | v22.22.2 (room-verified) | - |
| better-sqlite3 + sqlite-vec | 211 substrate reads | YES | vec_version 0.1.9 loads on this runtime | CJS-cosine path (honest degrade) |
| @huggingface/transformers (cached) | embedding spine | YES (dev box; cache-dependent elsewhere) | per 211-01 | offline test seams (encodeFn passthrough) |
| Phase 212 critic (`eureka-critic.cjs`) | GuardGate | **NO - not built** (plans only) | - | none: execution gate, by design |
| Curing-track verdict | 190/202/205 seam stability | **NO - status: gathering, steps 2-5 unrun** | - | none: execution gate, by design |
| Brain MCP (chain-recommender remote leg) | optional FEEDS_INTO enrichment | optional | - | `isAvailable()` sync degrade built in |

**Missing dependencies with no fallback:** the two execution gates above - both are deliberate ROADMAP gates, not surprises. Planning proceeds; execution waits.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bare Node assert scripts (`tests/test-*.cjs`) + bash aggregators (`tests/run-all-<phase>.sh`) - house pattern, no jest/vitest |
| Config file | none (convention-driven) |
| Quick run command | `node tests/test-213-<leg>.cjs` |
| Full suite command | `bash tests/run-all-213.sh` (Wave 0 gap - create) |

### Phase Requirements -> Test Map (requirement IDs TBD; behaviors from the goal + locks)
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SENS-13 registered, fires deep_research only | unit | `node tests/test-213-sensor-eureka.cjs` | NO - Wave 0 |
| Eureka reach REACHABLE through decide() (born-wired proof) | integration | `node tests/test-213-reach-wired.cjs` (Phase 185 predicate pattern) | NO - Wave 0 |
| Recommend-never-trigger invariant (no auto-fire path; navigator confirm required before runChain) | unit/adversarial | `node tests/test-213-no-force.cjs` | NO - Wave 0 |
| COMPRESSION meter reproduces 211-04 hand-scored baseline | regression | `node tests/test-213-compression-meter.cjs` vs `evals/eureka/211-manual-baseline.md` | NO - Wave 0 |
| Touchpoints additive: 190 lint green / 202 signal-not-veto / 205 suggest | unit x3 | per-seam tests | NO - Wave 0 |
| Part 8: offer + APO signal carry handles/enums only | boundary scan | reuse 196-pattern boundary test | NO - Wave 0 |
| No regression | aggregate | `bash tests/run-all-211.sh` (expect PASS=9 FAIL=1 env leg), `run-all-205.sh`, `run-all-144.sh`, `check-shape-declaration --check`, `check-render-coverage` | YES (existing) |

### Sampling Rate
- **Per task commit:** the task's own `node tests/test-213-*.cjs` leg
- **Per wave merge:** `bash tests/run-all-213.sh` + touched prior aggregators
- **Phase gate:** full 213 suite + `node scripts/doctor.cjs --acceptance` green, plus a REAL-conversation Larry probe (the curing-track's own QA protocol style) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-213.sh` aggregator
- [ ] the six test files above
- [ ] fixture: a synthetic room.db slice with a known bridge pair (reuse `evals/eureka/cases/` cards)

## Security Domain

`security_enforcement` absent from config = enabled. This is a local CLI plugin phase; the applicable surface is the data boundary, not auth.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local CLI; MCP tool auth is 212's rate-limit/dedupe scope |
| V3 Session Management | no | - |
| V4 Access Control | partial | `visibility: admin` filtering is Phase 191's tracked debt, explicitly OUT of 213 scope |
| V5 Input Validation | yes | sensor payloads are `'<handle>:<enum>'` (closed enums, `insight-sensors.cjs:500` idiom); critic tags are closed enums (`data/eureka-critic-tags.json` per 212-01) |
| V6 Cryptography | no | none introduced |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User-content egress to Brain via offer/telemetry | Information Disclosure | Canon Part 8: generic handles/enums only; reuse 196 `classify()` guard; 212-03's zero-roomDir MCP wrapper precedent |
| Unattended write-back of an LLM-proposed edge | Tampering | Part 9 + Phase 189 HITL basket + 201-03 dryRun-default graph-refine |
| Forcing mechanism regression (UX-integrity) | Elevation of Privilege (of the machine over the navigator) | the no-force adversarial test; navigator-confirm as the only trigger |

## Sources

### Primary (HIGH confidence - room entries + live code, all read this session)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-reverse-salient-ratification-gap/2026-07-05-reverse-salient-ratification-gap.md` - ratification discipline, fast/slow failure modes (V5)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/01-cli-canon-audit.md` - sections 3c/3d (spine load-bearing vs aspirational; scaffolding clusters) (V2, V8)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/04-synthesis-rebuild-vs-surgery.md` - sections 1, 2 (#1 change), 3 (Step 2), 4 (V2, V3, V8)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-architectural-mandates-m-series/2026-07-05-architectural-mandates-m-series.md` - M4 + closing recommendation (V4)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-statusline-ratification-cue/2026-07-05-statusline-ratification-cue.md` - the shipped wiring template (V6)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-phase212-blockers-fixed-node22-vec0-correction/2026-07-06-phase212-blockers-fixed-node22-vec0-correction.md` - Node-floor correction + blocker fixes + 212 split (V7)
- Live repo verification (file:line cites inline throughout): `lib/core/insight-sensors.cjs`, `lib/core/sensors/sensor-types.cjs`, `lib/brain/chain-recommender.cjs`, `lib/workflow/command-resolver.cjs`, `lib/core/navigation-engine.cjs`, `lib/core/navigation-engine-offer.cjs`, `lib/core/chain-executor.cjs`, `lib/core/fusion-router.cjs`, `lib/core/grill-engine.cjs`, `lab/apo/apo-loop.cjs`, `lab/apo/voice-contract-gate.cjs`, `scripts/check-shape-declaration.cjs`, `lib/core/rs-differential-scorer.cjs`, `lib/core/eureka/*`, `evals/eureka/*`, `data/command-registry.json` + `commands/*.md` counts, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md`, `.planning/phases/212-*/212-RESEARCH.md`, `.planning/quick/260705-ui4-*/`
- `.planning/seeds/SEED-049-mindrian-insight-engine-tri-modal-tri-source-hybrid-retrieval.md` (CAPSTONE + THE KEY sections), `.planning/seeds/SEED-050-eureka-eval-salient-verifier-judge-synthetic-trust.md` (judge design, composite formula, MCP-servable note)

### Secondary / Tertiary
- None. No web research performed (room + code answered every question; zero new packages; per the MCP-stack-awareness rule no silent WebSearch was run).

## Metadata

**Confidence breakdown:**
- Prior-art validation: HIGH - every claim cross-checked room-entry-to-live-code
- Wiring surfaces: HIGH - all verified on disk with line numbers
- Pitfall 2 (rank starvation): MEDIUM - inferred from code comments, not empirically co-fire-tested
- Execution-gate status: HIGH - both gates read directly from their tracking files today

**Research date:** 2026-07-06
**Valid until:** the curing-sequence verdict or 212 execution, whichever lands first - both can shift the seams (re-verify V3 + V5 then; nominal 14 days otherwise)
