# Phase 342 - Catalog C: Analysis + Graph Engines

Scope: the `analysis` MCP tool family, `contradiction_check`/`whitespace_scan`'s graph half,
`graph_reason`, `memory-cortex-reach`, the reach/sensor machinery, the Minto reasoning layer,
the Six Thinking Hats family, `diagnostics`, and the roadmap-type selector (Phase 264).
Read-only, v2.0.0-beta.30. Siblings `342-CATALOG-A-insight-engines.md` and `342-FINDINGS.md`
cover overlapping ground; not repeated except where load-bearing. No room content, no real names, no em-dashes.

**Shared infra phases (not repeated per entry):** every `/mos:` methodology command here
inherits 122-workflow-layer (frontmatter contract + `data/command-registry.json`, VERIFICATION
"passed"), 143.3-connector-spine (VERIFICATION "passed"), 144.1-connector-retrofit-sweep
(SUMMARY chain complete through plan 08). Per-entry "Phases" lines list only DISTINCTIVE work.

## Summary table

| Engine | Command | MCP tool | Model needed? | Brain/Theo touch? | Declared frameworks | Proposed Theo name | Phases |
|---|---|---|---|---|---|---|---|
| analyze-systems | /mos:analyze-systems | `analysis` (buildContext-only) | no | no | Systems Thinking (existing) | reuse existing | 267.3-04, 265-13 |
| systems-thinking | /mos:systems-thinking | `analysis` (buildContext-only) | no | no | Systems Thinking (existing) | reuse existing | 267.3-04, 265-13 |
| analyze-timing | /mos:analyze-timing | `analysis` (buildContext-only) | no | no | S-Curve Analysis (existing), Adoption-Capacity Theory (curated_extra) | reuse existing | 172-12, 265-13 |
| macro-trends | /mos:macro-trends | `analysis` (buildContext-only) | no | no | PEST Analysis (curated_extra) | reuse (needs Brain promotion) | 265-13 |
| explore-trends | /mos:explore-trends | `analysis` (buildContext-only) | no | no | S-Curve Analysis (existing) | reuse existing | 265-13 |
| dominant-designs | /mos:dominant-designs | `analysis` (buildContext-only) | no | no | Dominant Design (curated_extra) | reuse (needs Brain promotion) | 265-13 |
| explore-futures | /mos:explore-futures | `analysis` (buildContext-only) | no | no | Scenario Planning (existing) | reuse existing | 265-13 |
| futures | /mos:futures | not in `analysis` enum | yes (via rs/hsi-engine.cjs) | no direct | Futures Wheel (curated_extra) | reuse (needs Brain promotion) | 265-13, 272 |
| scenario-plan | /mos:scenario-plan | `analysis` (buildContext-only) | no | no | Scenario Planning (existing) | reuse existing | 265-13 |
| find-bottlenecks (+rs-explain) | /mos:find-bottlenecks, /mos:rs-explain | `analysis` find-bottlenecks (REFERENCE-ONLY) | yes (embedding-spine.cjs) | rs-explain yes; find-bottlenecks itself no | Reverse Salient Analysis (existing, live in Theo) | reuse existing | 265-13, 272 |
| root-cause | /mos:root-cause | `analysis` (buildContext-only) | no | no | Root Cause Analysis (existing) | reuse existing | 265-13 |
| causal (extract/trace/predict) | /mos:causal | `analysis` (mostly non-functional) | no | no | Root Cause Analysis (existing) | reuse existing | 267.3-04 |
| contradiction_check | none | `contradiction_check` (REAL) | no | no | none declared | Local Contradiction Scan (NEW) | 109-05 |
| whitespace_scan (graph half) | none | `whitespace_scan` (REAL) | no | no | none declared | Local Gap Scan (NEW) | 109-05 |
| graph_reason | none | `graph_reason` (REAL, 2 modes) | no | no | none declared | Transitive Support Trace / Sub-Room Proximity (NEW) | 109-05 |
| memory-cortex-reach | /mos:memory-cortex-reach | none dedicated | no | no direct | none declared | Memory Cortex Bridge (NEW) | 150-05, 267.3-06 |
| Reach and Sensor Dispatch | none (infra) | none dedicated | no | yes (chainOfferForReach) | n/a (infra) | Candidate-Reach Sensor Dispatch (NEW) | 143, 144, 148 |
| Minto reasoning layer | /mos:mos-reason, /mos:structure-argument | `room_graph` (REAL) | no | no | The Pyramid Principle, MECE (existing) | reuse existing | 265-14 |
| Six Thinking Hats family | /mos:bono, think-hats, persona, hat-briefing | `methodology` (persona, think-hats) | no | no direct | Six Thinking Hats (existing) | reuse existing | 118-06, 223, 265-16 |
| diagnostics | /mos:diagnostics | none dedicated | yes (Python, unmigrated) | no | HSI Semantic Surprise Analysis Assistant (existing) | reuse existing | 121.5-08 (stale), 267.3-06, 272 |
| roadmap-type selector | none (sensor-only) | none dedicated | no | indirect | n/a (routes to named frameworks) | Roadmap-Type Classifier (NEW) | 264 |

---

## 1-2. analyze-systems / systems-thinking

*Both decompose a system (layers, or loops/stocks/flows) to find leverage points, near-
duplicate deliveries of one framework, Systems Thinking.*
- Surfaces: `commands/analyze-systems.md`, `systems-thinking.md`; MCP `analysis` tool
  (`tool-router.cjs:234-237`), no agent/script. Neither has a deterministic engine:
  `buildContext()` (`:489`) reads `commands/<name>.md` + STATE.md, returns text, Larry reasons live.
- Phases: 265-13 (2026-08-27, shipped, declaration-truth backfill) | 267.3-04 (shipped, Row
  1/17).
- I/O: in = room state + focus text; out = `room/**/systems/*`.
- Registry: kind=methodology, autonomous_safe=true. analyze-systems: hitl=F.8,
  sub_mode=systems-analysis, posture=push_forward, rank=18, sensors=[SENS-06]. systems-thinking:
  hitl=F.8, sub_mode=systems-thinking-loop, posture=hold, rank=44, sensors=[SENS-06].
- Brain/Theo: none. Local deps: none.
- Theo name: "Systems Thinking" exists in `data/framework-names.json` - reuse.
- Routing: Ill-Defined/Wicked. Chain (`data/roadmap-type-chains.json` `pipeline-analysis`):
  Systems Thinking -> Reverse Salient Analysis -> S-Curve Analysis.

## 3. analyze-timing

*Places a venture on the S-Curve, cross-checked against a second framework, Adoption-Capacity
Theory, sharing this one command.*
- Surfaces: `commands/analyze-timing.md`; MCP `analysis` tool. `buildContext()`-only.
- Phases: 172-12 (shipped; INV-11: "connector home for two reaches", S-Curve path plus a
  SENS-09 Adoption-Capacity path via `data/dispatch-framework-map.json`, `:38-46`) | 265-13
  (shipped).
- I/O: out = `room/**/timing/*`. Registry: hitl=F.1, autonomous_safe=true,
  sub_mode=timing-scurve, posture=push_forward, rank=27, sensors=[SENS-06, SENS-09].
- Brain/Theo/deps: none direct (SENS-09 fires a separate `brain_consult` reach, Entry 17's).
- Theo name: "S-Curve Analysis" exists, reuse. "Adoption-Capacity Theory" is a `curated_extras`
  entry (not in the Brain's FEEDS_INTO snapshot as of 2026-05-12) - flag for promotion.
- Routing: Well/Ill-Defined. Chain: S-Curve Analysis -> Adoption-Capacity Theory -> Scenario
  Planning (`command-registry.json` `curated_chains`, 0.82 then 0.74).

## 4-6. macro-trends / explore-trends / dominant-designs

*PEST across a domain; push today's trends to extremes on the S-Curve; ask whether a market has
converged on one winning design.*
- Surfaces: `commands/macro-trends.md`, `explore-trends.md`, `dominant-designs.md`; MCP
  `analysis` tool, same three enum values. All three `buildContext()`-only.
- Phases: 265-13 (2026-08-27, shipped - this plan's summary names "19 unfilled [methodology]
  placeholders... the futures web_scope correction" as its scope for these commands).
- I/O: out = `room/**/trends/*` (macro/explore), `room/**/dominant-designs/*`.
- Registry: all autonomous_safe=true. macro-trends: hitl=F.8, sub_mode=macro-pest,
  posture=hold, rank=39, sensors=[]. explore-trends: hitl=F.3, sub_mode=trends-scurve,
  posture=push_forward, rank=32, sensors=[SENS-04]. dominant-designs: hitl=F.1,
  sub_mode=dominant-design, posture=push_forward, rank=28, sensors=[SENS-06]. Brain/Theo/deps: none.
- Theo name: "PEST Analysis" and "Dominant Design" are `curated_extras`, absent from the
  Brain's FEEDS_INTO snapshot - flag both for promotion; "S-Curve Analysis" reuse.
- Routing: Understand-Market (Ill-Defined). Chains: PEST -> Scenario Planning (0.60); Dominant
  Design -> Adoption-Capacity (0.80); S-Curve is prerequisite of Dominant Design (0.69).

## 7-8. explore-futures / futures

*Two DIFFERENT, easy-to-conflate commands. explore-futures synthesizes TTA/Scenario/S-Curve
views (Scenario Planning). futures runs a Futures Wheel: seed concept -> bounded consequence
rings -> HSI cross-domain bridge scan (a different theory entirely).*
- Surfaces: `commands/explore-futures.md` (in `analysis` enum), `commands/futures.md` (NOT in
  `ANALYSIS_COMMANDS`, `tool-router.cjs:234-237`, no MCP tool of its own today).
- Core modules: explore-futures = `buildContext()`-only. futures = real code -
  `lib/core/futures/orchestrator.cjs` requires `rs-engine.cjs`/`hsi-engine.cjs` (one of the "3
  real callers" Phase 272 wired; see Entry 10, 19, Catalog A).
- Phases: both 265-13 (2026-08-27, shipped, "the futures web_scope correction" named
  explicitly in the plan's own summary).
- I/O: explore-futures out = `room/**/futures/*`; futures out =
  `room/opportunity-bank/futures-*/**`.
- Registry: explore-futures: autonomous_safe=true, sub_mode=futures-scenario, posture=hold,
  rank=33, sensors=[]. futures: **autonomous_safe=false**, hitl=F.2, sub_mode=futures-wheel,
  posture=hold, rank=45, sensors=[SENS-06].
- Brain/Theo: neither calls brain-client directly.
- Local deps: futures via `orchestrator.cjs` -> `rs-engine.cjs`/`hsi-engine.cjs` ->
  `embedding-spine.cjs::embedTexts()` (line 456), in-process ONNX (transformers.js), degrades to
  `{success:false, error:'encoder_unavailable'}` rather than throwing (`:44-51`).
- Theo name: "Scenario Planning" exists, reuse. "Futures Wheel" is a `curated_extras` entry,
  named in `roadmap-type-chains.json` as never-autonomous-safe, preserve that if promoted.
- Routing: Compare-Options/Explore (Ill-Defined-Wicked). Chains: Futures Wheel <-> Scenario
  Planning (0.73 / 0.66, two-way curated edge).

## 9. scenario-plan

*Builds a 2x2 scenario matrix on two key uncertainties and names each quadrant (Scenario
Planning, shares the framework name with explore-futures but is its own command).*
- Surfaces: `commands/scenario-plan.md`; MCP `analysis` tool. `buildContext()`-only.
- Phases: 265-13 (shipped). I/O: out = `room/**/scenarios/*`.
- Registry: hitl=F.5, autonomous_safe=true, rank=45. Brain/Theo/deps: none.
- Theo name: "Scenario Planning" exists, reuse.
- Routing: Compare-Options. Chain (vision-paper): Scenario Planning -> Four Lenses of
  Innovation.

## 10. find-bottlenecks (+ rs-explain sibling)

*Reverse Salient Analysis: finds the one lagging component holding back an otherwise-advancing
system, pairing a structural (topic-keyword LSA) signal against a semantic-embedding signal and
surfacing the biggest divergence. rs-explain is the NL front end over the same graph data.*
- Surfaces: `commands/find-bottlenecks.md`; MCP `analysis` `find-bottlenecks` (REFERENCE-ONLY -
  `buildContext()` returns instructions, not a computed result). `rs-explain` has no MCP tool.
  Agent: `lib/agents/reverse-salient-agent.cjs`.
- Core modules: `lib/core/rs-engine.cjs` (Mode A orchestration; structural leg from
  `rs-math.cjs`, semantic leg from `embedding-spine.cjs::embedTexts`; writes REVERSE_SALIENT
  edges via `lazygraph-ops.cjs`; backend gated by `rs-backend-dispatch.cjs::resolveBackend()`,
  line 55). `rs-explain` (`commands/rs-explain.md:56-70`) triangulates `room.db`
  (`lazygraph-ops.queryGraph`), a separate Aura graph (Cypher), and the Brain (`brainClient`).
- Phases: 265-13, 267.3-04/07 (shipped) | 272-phase-134-real-remediation (11/11 plans complete,
  shipped, the real transformers-based CJS port Phase 134 had falsely marked complete).
- I/O: in = room artifacts + embeddings; out = `room/**/reverse-salients/*`,
  `.rs-engine-results.json`, REVERSE_SALIENT edges.
- Registry: find-bottlenecks: hitl=F.8, autonomous_safe=true, sub_mode=reverse-salient,
  posture=pull_back, rank=2, sensors=[SENS-02]. rs-explain: **autonomous_safe=false**, hitl=F.1,
  sub_mode=reverse-salient-explain, posture=pull_back, rank=3, sensors=[SENS-02].
- Brain/Theo: rs-engine.cjs itself = none (fully local). rs-explain = YES, live -
  `brainClient.isAvailable()` + a `brain_query` template when reachable (`:70`); since Phase 339
  (shipped 2026-09-04) resolves to `theo-mcp.onrender.com` by default (`brain-client.cjs:40`).
- Local deps: `embedding-spine.cjs` in-process ONNX (Entry 7-8). CJS is the default backend;
  Python (`rs-engine.py`) is a retained fallback, opt-in via `MINDRIAN_RS_BACKEND=python`.
- Theo name: "Reverse Salient Analysis" exists AND is confirmed live in Theo's graph today
  (matched via alias, per `342-FINDINGS.md`), reuse, no promotion needed.
- Routing: Find-Bottleneck (Ill-to-Well-Defined). Chains: technical-roadmap (Problem Definition
  Transformation -> Reverse Salient -> Knowns and Unknowns); pipeline-analysis (Systems
  Thinking -> Reverse Salient -> S-Curve Analysis).

## 11. root-cause

*Traces a recurring symptom to its upstream cause via 5-Whys/Fishbone/Fault Tree (Root Cause
Analysis, same declared framework as causal).*
- Surfaces: `commands/root-cause.md`; MCP `analysis` tool. `buildContext()`-only.
- Phases: 265-13 (shipped). I/O: out = `room/**/root-cause/*`.
- Registry: hitl=F.9, autonomous_safe=true, rank=42. Brain/Theo/deps: none.
- Theo name: "Root Cause Analysis" exists, reuse (shared with causal, Entry 12).
- Routing: Find-Problem. Next-step in `tool-router.cjs:1247-1248`: scenario-plan -> root-cause
  -> causal-trace (intended, not fully built, Entry 12).

## 12. causal (causal-extract / causal-trace / causal-predict)

*Intended 3-stage pipeline: extract cause/mechanism/effect triples, trace causal chains,
predict downstream effects. Only stage one is real.*
- Surfaces: `commands/causal.md` (one file, all stages as subcommands). MCP `analysis` enum has
  THREE values (`causal-extract`/`causal-trace`/`causal-predict`, `tool-router.cjs:234-237`)
  but no `commands/causal-extract.md` etc. exist and `GROUPED_PREFIX_FALLBACK`
  (`tool-router.cjs:440-444`) has no `causal-` entry - `causal-trace`/`causal-predict` through
  MCP return the "no reference file found" fallback, not a real result. Script:
  `scripts/causal-to-graph.cjs` (extract stage's SQLite bridge only).
- Core modules: `commands/causal.md:182-214` instructs writing `.causal-extract.json` then
  running `scripts/causal-to-graph.cjs`, calling `lazygraph-ops.cjs::createCausalClaim()` (1096),
  `createExtractedFromEdge()` (1129), `createCascadesToEdge()` (1150). `trace`/`predict` have NO
  backing module: `commands/causal.md:64-77` instructs Larry to refuse both, "ships in v1.7.0",
  unmet as of v2.0.0-beta.30.
- Phases: 267.3-04 (shipped, Row 2). No phase found shipping causal-trace/causal-predict.
- I/O: in = one artifact path; out (extract only) = `room/**/causal/*`,
  `room/.causal-extract.json`, CausalClaim/EXTRACTED_FROM/CASCADES_TO in room.db SQLite
  (`references/causal/causal-schema.md` still describes this as KuzuDB, stale;
  `causal-to-graph.cjs`'s own header confirms the SQLite migration).
- Registry: hitl=F.9, autonomous_safe=true, frameworks=["Root Cause Analysis"],
  sub_mode=causal-trace (named "trace" though trace is unshipped), posture=pull_back, rank=6,
  sensors=[SENS-02]. Brain/Theo: none. Local deps: none (SQLite write only).
- Theo name: "Root Cause Analysis" exists, reuse for extract. No name proposed for
  trace/predict, naming dead code to Theo would point a recommended chain at nothing.
- Routing: Find-Problem/Find-Bottleneck. Same framework as root-cause (Entry 11).

## 13. contradiction_check

*Scans the local graph for CONTRADICTS edges touching a focus node.*
- Surfaces: no `/mos:` command. MCP tool `contradiction_check` (`sensors.cjs:255`, REAL
  execution) calls `navigation.findContradictions(db, focusNodeId)`, re-exported from
  `insights.cjs::findContradictions()` (line 44).
- Phases: 109-05 (per this tool's own MCP description, not independently re-verified against
  `.planning/phases/109*` this pass, cite with that caveat).
- I/O: in = `node_id` (optional, else active focus); out = `{focus_node_id, contradictions[]}`
  or an honest "No focus node" note. Registry: n/a (no command entry).
- Brain/Theo: none. `insights.cjs:16`: "Canon Part 8: zero Brain queries; pure SQL on room.db."
- Local deps: none.
- Theo name: no existing framework fits (a graph primitive). Propose "Local Contradiction Scan"
  (NEW), tagged infra/checkpoint.
- Routing: n/a alone. Fires ahead of Decision Gates; pairs with root-cause/find-bottlenecks
  when a contradiction blocks progress.

## 14. whitespace_scan (graph half)

*Gap scan: unanswered `open_question` nodes plus claims with no SUPPORTS/EVIDENCES edge. A
DIFFERENT engine from `/mos:whitespace` (Entry 19's sibling, HSI-backed) despite the shared
word, flagged as a likely confusion for Theo's team.*
- Surfaces: no `/mos:` command. MCP tool `whitespace_scan` (`sensors.cjs:291`, REAL execution)
  calls `findOpenQuestions(db, roomId)` (`insights.cjs:311`) and `findUnsupportedClaims(db,
  roomId)` (`insights.cjs:69`); own description: "mints no third query."
- Phases: 109-05 (same caveat as Entry 13).
- I/O: in = none (whole-room); out = `{open_questions[], unsupported_claims[], gap_count}`.
- Registry: n/a. Brain/Theo: none (`insights.cjs:16`). Local deps: none.
- Theo name: propose "Local Gap Scan (Open Questions / Unsupported Claims)" (NEW), distinct
  from "HSI Semantic Surprise Analysis Assistant" which `/mos:whitespace` already owns.
- Routing: n/a alone. Neighbors: `/mos:whitespace` (Entry 19), `contradiction_check` (Entry 13).

## 15. graph_reason (transitive_support / nearest_sub_room_decisions)

*Two multi-hop reads a flat query cannot express: is a claim supported directly, only
transitively, or not at all; and which sub-room's decisions sit structurally nearest a focus
node.*
- Surfaces: no `/mos:` command. MCP tool `graph_reason` (`graph-reason.cjs:59`, REAL execution,
  both modes). `transitive_support` -> `insights.cjs::findTransitiveSupport()` (179, shares its
  maxDepth default of 5 with `findBlockingAssumptions`, 86). `nearest_sub_room_decisions` ->
  `icm-forest.cjs::findNearestSubRoomDecisions()` (557, opens/ATTACHes/DETACHes each child
  room.db itself, `:79-84`).
- Phases: 109-05 (`findTransitiveSupport`, same caveat as Entry 13); `icm-forest.cjs`'s own
  phase not located this pass.
- I/O: transitive_support in = `node_id`, `max_depth` (1-5); out = support classification +
  chain. nearest_sub_room_decisions in = `node_id` (optional), `max_results` (1-50, capped at
  10); out = ranked sub-room list.
- Registry: n/a; `:114-121` declares `hitl_shape:'none'`. Brain/Theo/deps: none, `:43`: "zero
  [Brain/network tokens]."
- Theo name: no existing framework fits either mode. Propose "Transitive Support Trace" and
  "Sub-Room Decision Proximity" (NEW, two handles, the questions differ).
- Routing: n/a alone. Neighbor: any Decision Gate needing to know a claim is load-bearing.

## 16. memory-cortex-reach

*Brings a stale governing-thought or a fresh contradiction to a Decision Gate. Does not compute
cortex content itself - it is the navigator-facing surface the reach spine dispatches to.*
- Surfaces: `commands/memory-cortex-reach.md` + `skills/memory-cortex-reach/`. No dedicated MCP
  tool (reached via the reach spine, Entry 17). Sensor `sensor-memory-cortex.cjs::
  sensorMemoryCortex()` (81), helpers `hasStaleGoverningThought()` (53),
  `freshContradictionCount()` (62). Adapter `cortex-reach-adapter.cjs::hasContradiction()`
  (145), `buildReachScoresFromCortex()` (194).
- Phases: 150-05 (MEM-05, D-05, `insight-sensors.cjs:70`) | 267.3-06 (shipped, Row 22).
- I/O: in = room graph state; out = one F.1 Decision Gate offer, cortex content surfaced only
  AFTER approval (`:8`).
- Registry: hitl=F.1, frameworks=null, reach_id=cross_room, sub_mode=memory-cortex-bridge,
  posture=push_forward, rank=60, sensors=[SENS-08], filing=memory_event_only.
- Brain/Theo: none direct; the `cross_room` reach can carry a `brain_framework_chain` companion
  via Entry 17, an indirect touch. Local deps: none.
- Theo name: no framework fits (a bridge, not a methodology). Propose "Memory Cortex Bridge"
  (NEW), tagged infra/reach.
- Routing: n/a (reach-triggered), fires alongside whichever methodology reach is active.

## 17. Reach and Sensor Dispatch Engine

*The machinery that makes every engine above fire PROACTIVELY: 20 sensors watch each turn for a
trigger, a chokepoint dispatches them in fixed order, a decision function routes a fired sensor
to a reach, and (only when a companion is present) an async offer layer asks Theo which
framework-chain to recommend next.*
- Surfaces: no `/mos:` command. MCP `suggest_next`/`reach_candidates` pull the same
  `dispatchSensors` path, consumed by every command's `sensor_triggers`.
- Core modules: `insight-sensors.cjs`: `SENSOR_REGISTRY_IDS` (781, 20 sensors SENS-01..SENS-18
  plus SENS-RECENCY/SENS-SHOW), `dispatchSensors()` (873, pure chokepoint).
  `navigation-engine.cjs::decide()` (876) routes a fired reach to a verb.
  `dial-reach-orchestrator.cjs::buildReachList()` (306, scores/gates candidates,
  `_applyFrozenGate` at 231). Two chain recommenders: `local-chain-recommender.cjs`
  (`recommendChainCandidates()` 122, `recommendMultiHopChains()` 243, LOCAL, zero Brain touch)
  and `chain-recommender.cjs::chainOfferForReach()` (594, Brain-backed, see closing section).
- Phases: 143-insight-sensors-the-7-row-trigger-map (VERIFICATION "passed") | 144-navigation-
  engine-legacy-engine-flip (wired `dispatchSensors` into `decide()`) | 148 (D-09, the 6th
  "hats" reach, per `lib/core/sensors/sensor-types.cjs` header).
- I/O: in = turn text, session tuple, room context; out = a candidate-reach struct or null,
  optionally a chain offer.
- Registry: n/a to the engine itself (it PRODUCES the per-command facts reported elsewhere).
- Brain/Theo: YES, the one genuine live call site outside rs-explain:
  `chain-recommender.cjs::chainOfferForReach()` (594) calls
  `brainClient.recommendChain(problemType)` (per `342-FINDINGS.md`, cross-checked against
  `brain-client.cjs::recommendChain()` line 1879), sends ONLY problem_type + max_steps (Canon
  Part 8), never room content. Fires only with a `brain_framework_chain` companion present.
- Local deps: none (pure JS heuristics/regex + JSON reads).
- Theo name: propose "Candidate-Reach Sensor Dispatch" (NEW, infra tag) - the routing layer
  other frameworks travel through, not itself invoked by name.
- Routing: not problem-type-routed itself; performs that routing for every other engine. Full
  Brain-to-local trace in the closing section.

## 18. Minto reasoning layer (room_graph reasoning-*)

*Generates/verifies Feynman-MINTO pyramid reasoning (governing thought down to grounded
support) for a room section, stored as REASONING.md with parsed frontmatter, plus run tracking.*
- Surfaces: `/mos:mos-reason` (The Pyramid Principle), `/mos:structure-argument` (+ MECE). MCP
  `room_graph` tool: `reasoning-get/generate/verify/run/list/frontmatter`
  (`tool-router.cjs:219-220`, handlers 1012-1065; REAL execution).
- Core modules: `reasoning-ops.cjs`: `generateReasoning()` (385), `getReasoning()` (430),
  `listReasoning()` (447), `verifyReasoning()` (481), `createRun()` (509) - a genuine
  deterministic parser/writer, not LLM-instruction-only.
- Phases: 265-14 (2026-08-27, shipped, rewired mos-reason to one subagent per room section
  behind a migration-backup guard with a cross-section coherence check).
- I/O: in = a section name; out = parsed/generated REASONING.md, a verification report, or run.
- Registry: mos-reason: hitl=F.9, autonomous_safe=true, sub_mode=minto-reason,
  posture=push_forward, rank=21, sensors=[SENS-06]. structure-argument: hitl=F.9,
  autonomous_safe=true, sub_mode=pyramid-argument, posture=hold, rank=31, sensors=[SENS-06].
- Brain/Theo: none found. Local deps: none (Phase 265-14's subagent dispatch uses Claude
  subagents, not a local ML model).
- Theo name: "The Pyramid Principle" and "MECE" both exist - reuse verbatim.
- Routing: Explore/structure a Wicked-to-Ill-Defined argument into MECE. Chain: Problem
  Definition Transformation -> MECE (0.71).

## 19. Six Thinking Hats family (bono / think-hats / persona / hat-briefing)

*Four commands, one framework, increasing depth: think-hats rotates the six hats directly;
persona generates Six-Hats personas from room data; hat-briefing synthesizes a per-hat panel
over Larry's own prior analysis; bono is the deep one - a governed, twice-fanned research
debate (a subdomain x hat swarm, then a sequential inter-hat argument over a graph-proposed
what-if), gated at three Decision Gates, filing only on approval.*
- Surfaces: `commands/bono.md`, `think-hats.md`, `persona.md`, `hat-briefing.md`. MCP:
  `persona`/`think-hats` in the `methodology` tool enum (buildContext-only); `bono`'s real
  substrate has no MCP tool (CLI/agent-orchestrated only per its own body text).
- Core modules: bono's real engine (self-described as "SEQUENCES the shipped BONO substrate",
  `commands/bono.md:67`): `expert-library.cjs::assembleTeam()` (204),
  `bono/cell-fanout.cjs::runCellFanout()` (195), `bono/debate-composition.cjs::runDebate()`
  (247), `bono/hat-governance.cjs` (`HAT_GOVERNANCE`, `assertHeterogeneity`),
  `bono/persona-research.cjs::personaDispatchCell()` (105), `close-loop-writer.cjs`
  (`writeCloseLoop`, `findPriorConclusion`). think-hats/persona/hat-briefing: buildContext-only.
- Phases: 118-06 (declaration; VERIFICATION "human_needed", not clean-shipped) |
  223-jtbd-driven-...-bono (shipped 2026-07-16, wired governance seams onto the pre-existing
  substrate) | 265-16 (shipped, generate-personas routes to `/mos:persona --parallel`) |
  267.3-04/06 (shipped).
- I/O: think-hats/persona out = `room/**/six-hats/*`, `room/team/ai-personas/*`. bono out =
  `room/solution-design/*`, only on terminal APPROVE, plus a close-the-loop graph edge.
- Registry: all four frameworks=["Six Thinking Hats"], reach_id=hats, sensor_triggers=[SENS-17]
  (bono/persona/think-hats) or [SENS-07] (hat-briefing). think-hats/persona:
  autonomous_safe=true. bono: **autonomous_safe=false**, rank=4. hat-briefing:
  **autonomous_safe=false**, rank=2.
- Brain/Theo: none found directly; bono's research fan uses the Part 8 egress guard for a
  LOCAL-to-web (not LOCAL-to-Brain) boundary. Local deps: none.
- Theo name: "Six Thinking Hats" exists, reuse for all four (Theo cannot distinguish
  depth-of-execution from the name alone, a real limitation worth flagging).
- Routing: Explore/Compare-Options (Wicked for bono). Six Thinking Hats is named in
  `roadmap-type-chains.json` as never-autonomous-safe (same as Futures Wheel).

## 20. diagnostics (HSI Wave-1 fingerprint)

*A one-screen scalar dashboard of four room-health metrics: disruption (CD index), coverage
(blindspot mass), element novelty, Bayesian surprise. Framework: HSI Semantic Surprise Analysis
Assistant (shared with `/mos:whitespace` and `/mos:score-innovation`, Catalog A/B's to report).*
- Surfaces: `commands/diagnostics.md`. No MCP tool of its own. Script:
  `scripts/diagnostics-command.cjs`.
- Core modules: `diagnostics-command.cjs::runPy()` (103) `execSync`s python3 against FOUR
  standalone scripts (`compute-disruption-index.py`, `compute-blindspot-mass.py`,
  `compute-element-novelty.py`, `compute-bayesian-surprise.py`), a SEPARATE, still-Python path
  from the Phase 272 JS port (`hsi-engine.cjs`, required only by `intelligence-cascade.cjs`/
  `futures/orchestrator.cjs`, never by `diagnostics-command.cjs`); Phase 272 named diagnostics
  explicitly OUT of that port.
- Phases: 121.5-08 Sub-plan J (LOCKED 2026-05-16, `commands/diagnostics.md:58`: renaming to
  `/mos:fingerprint` in v1.14.0, unshipped as of v2.0.0-beta.30) | 267.3-06 (shipped, Row 6) |
  272 (11/11 plans complete, shipped, but did NOT touch diagnostics' Python scripts - only 2 of
  4 carry `ensure_ml_deps.py` self-heal wiring).
- I/O: in = room artifact corpus; out = 4-metric dashboard, `room/**/diagnostics/*`.
- Registry: hitl=F.1, body_shape=E, autonomous_safe=true,
  frameworks=["HSI Semantic Surprise Analysis Assistant"], sub_mode=wave1-fingerprint,
  posture=hold, rank=7, sensors=[SENS-01]. Brain/Theo: none, `:195`: "Zero Brain query sites in
  scripts/diagnostics-command.cjs, verified by inspection."
- Local deps: `requirements-hsi.txt` (scikit-learn, numpy, sentence-transformers, pinecone,
  requests). Degrade: `runPy()` (`:103-118`) wraps each `execSync` in try/catch, returning
  `{ran:false, error}` per algorithm rather than throwing.
- Theo name: "HSI Semantic Surprise Analysis Assistant" exists, reuse, but flag that this name
  maps to three non-uniform implementations (diagnostics/whitespace Python scripts, the Phase
  272 JS port used elsewhere).
- Routing: Audit-Room (any type). Chain (landscape-analysis): Usher's Model of Cumulative
  Synthesis -> HSI Semantic Surprise Analysis Assistant.

## 21. Roadmap-type selector (Phase 264)

*Silently classifies a stated research goal into one of six roadmap output-shapes and resolves
it to a hand-authored framework-name chain via the existing `chain_resolve` seam, never a new
selection brain.*
- Surfaces: no dedicated `/mos:` command (sensor-triggered). Feeds `chain_resolve`/`chain_run`.
- Core modules: `sensor-roadmap-type.cjs::classifyRoadmapType()` (268, pattern-weighted
  scoring), `chainForRoadmapType()` (317, reads `data/roadmap-type-chains.json`),
  `sensorRoadmapType()` (357, SENS-18 entry, `insight-sensors.cjs:799`), drift-tested by
  `tests/test-264-roadmap-type-chains-drift.cjs`.
- Phases: 264-Roadmap-Type-Selector (5/5 plans complete, shipped, `ROADMAP.md:509-548`; also
  built `salient-governance.cjs`, a two-pass adversarial RS critic).
- I/O: in = turn text (classified, never stored verbatim); out = a `context_block` reach
  offering the matched chain, e.g. technical-roadmap -> [Problem Definition Transformation
  Framework, Reverse Salient Analysis, Knowns and Unknowns Matrix Framework].
- Registry: n/a. Its chain table's `_note` deliberately excludes Futures Wheel and Six Thinking
  Hats from every chain ("would flip `validateChainAutonomy` false").
- Brain/Theo: none (pure regex scoring); the chain emitted CAN carry a `brain_framework_chain`
  companion via Entry 17, an indirect touch. Local deps: none.
- Theo name: no framework fits (it selects BETWEEN frameworks). Propose "Roadmap-Type
  Classifier" (NEW), routing/selector tag.
- Routing: its purpose IS problem-type-to-chain routing; all six chains cited in Entries 4/9/18/20.

---

## How a Theo-named handle reaches these engines today

The live spine, already shipped, already fenced (cross-verified against `342-FINDINGS.md`,
which traced the same path from the Eureka side to the identical conclusion):

1. `lib/brain/chain-recommender.cjs::chainOfferForReach(reach, opts)` (594) is the ONLY place
   this repo calls Theo for a chain recommendation. Fires only with a `brain_framework_chain`
   companion (Entry 17); absent one, returns `null` before any Brain call.
2. Calls `brainClient.recommendChain(problemType)` (`brain-client.cjs:1879`), sending ONLY
   problem_type + max_steps (Canon Part 8), never a framework name or room content. Since Phase
   339 (shipped 2026-09-04) resolves to `theo-mcp.onrender.com` by default (`:40`).
3. Theo's `chain[]` is adapted by `adaptChainToRunInput()` (`chain-recommender.cjs:677`),
   mapping each framework NAME to LOCAL commands via `command-resolver.cjs::
   commandsForFramework(name)` (85, reads `framework_index` only). An unmapped name triggers one
   `normalizeFrameworkName()` retry, else falls to `unmapped`, Theo can never invent a command.
4. Results feed `composeWorkflow(frameworkChain)` (`command-resolver.cjs:110`), yielding
   `{step, framework, command|null, optional}`, an unmapped framework degrades honestly.
5. The plan runs through `lib/core/chain-executor.cjs::runChain()` (437), which HALTS at the
   first material step (posture per `recipe-maps.cjs::postureForCommand()`, 181, not
   `push_forward`, or irreversible), posture authority is LOCAL, never re-derived from Theo.

| Engine | Reachable via Theo -> chain_run today? |
|---|---|
| analyze-systems, systems-thinking, analyze-timing, macro-trends, explore-trends, explore-futures, dominant-designs, scenario-plan, root-cause, find-bottlenecks, causal (extract), diagnostics, mos-reason, structure-argument, think-hats, persona | Yes, auto-runs (autonomous_safe true) |
| futures, bono, hat-briefing, rs-explain | Yes, but halts at a gate (autonomous_safe false) |
| causal-trace, causal-predict | No - declared but not implemented |
| contradiction_check, whitespace_scan, graph_reason, memory-cortex-reach, reach/sensor dispatch, roadmap-type selector | No - no `frameworks:` declared, not chain-targetable |

The gap for Theo's own build side mirrors Catalog A's: the trigger spine needs no new
transport. What several engines need first is either a `frameworks:` declaration (the
graph-native tools, if a navigator should reach them BY NAME through a chain) or, for
macro-trends/dominant-designs/futures, promotion of their `curated_extras` names into the
Brain's own graph so Theo can recommend them by name, not just execute them once named by a human.
