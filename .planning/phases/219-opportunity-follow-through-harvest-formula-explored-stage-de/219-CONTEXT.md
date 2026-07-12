# Phase 219: Opportunity Follow-Through (harvest formula + explored-stage deep-research chain) - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Opportunities surfaced by the intelligence engines flow through the Harvest Formula lifecycle (candidate -> qualified -> explored -> promoted|parked|retired) instead of dying as files and one-liners. Eureka statements bank as proposed graph nodes; a harvest sensor turns graph events into scored candidates; a qualification Decision Gate files them; an explicit [Explore] action generates deep research + analysis into a Minto-shaped opportunity-bank artifact. Proven live on ador-ip-test, validated on corepower-isolation, then a version is cut.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `219-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `219-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** proposed opportunity-node minting from eureka statements; harvest sensor on the insight-sensor rail (graph-event triggered, Harvest Formula scoring, Four-Lens classification); qualification Decision Gate card with the 5-verb set + rejection edges; explored-stage chain (deep_research + diffusion/timing + find-analogies + web validation -> Minto-shaped bank artifact); frontmatter metadata extraction thin slice; live acceptance on ador-ip-test; navigator-run corepower-isolation validation; version cut + full release lockstep.

**Out of scope (from SPEC.md):** Track 1 engine rewire (find-connections / find-analogies / HSI / scan-opportunities / scenario-plan onto room.db); TRIZ contradiction-typing in whitespace; tier-2 NER; multi-room portfolio dedup (Phase 215); remote classifier (Plurai) wiring; auto-firing the explored chain on qualify.

</spec_lock>

<decisions>
## Implementation Decisions

### Harvest sensor trigger mechanics
- **D-01:** The harvest sensor conforms to the live `lib/core/insight-sensors.cjs` contract and rides the EXISTING dispatch rails: post-write graph events via the existing hook seams + the scheduled scout cadence (`scripts/scout-cadence-runner.cjs`) for periodic recompute. NO new hook surface is minted.
- **D-02:** The sensor surfaces candidates as ranked candidate reaches through the existing F.1 selector path (dispatchSensors -> decide() -> resolver, one governed reach path). It does not mint a new reach id; it rides existing reach semantics the way SENS-09 rides brain_consult.

### Opportunity node + edge representation
- **D-03:** Opportunity candidates mint as a typed node (kind `opportunity`) with `review_status='proposed'` and a `lifecycle` property (candidate|qualified|explored|promoted|parked|retired), through `lib/core/navigation.cjs` only - mirroring 218's writeEntityNode pattern and the graph-derivation.cjs propose-then-confirm HITL precedent.
- **D-04:** Edge vocabulary: reuse existing typed edges (EVIDENCES/SUPPORTS/INFORMS) wherever they fit (Part 7); any net-new edge type is an ADDITIVE extension to ALLOWED_EDGE_TYPES via `lib/core/navigation/edges.cjs`, justified in the plan against the existing vocabulary.
- **D-05:** Rejection on Skip writes a rejection edge following the SEED-009 / `f_selector_decision(outcome=reject)` precedent - rejection is data (repo Decision 13).

### Explore chain composition
- **D-06:** [Explore] composes through the SHIPPED chain machinery: composeWorkflow (command-resolver, recipe-maps) -> `lib/core/chain-executor.cjs` runChain. Zero hardcoded /mos: slugs; posture joined from the command registry; the autonomous_safe prefix runs, material steps halt at gates (Canon Part 3).
- **D-07:** The web leg rides the FROZEN deep_research reach with generic handles only (Part 8), gated through the existing audit seams. Diffusion/timing and find-analogies invoke their existing commands via the resolver, in their CURRENT (Track-1-unrewired) form - the chain contract does not change when Track 1 later rewires their internals.
- **D-08:** The explored-stage output composes Minto via the existing structure-argument (Minto + SCQA + MECE) machinery - reuse, not a new composer. Filed to opportunity-bank/ in the Obsidian nested-folder convention (Decision 16: `section/name/name.md`).

### Qualification card wiring
- **D-09:** The card fires through the existing AskUserQuestion/gate_render dispatcher at the sensor's candidate-reach surface. SEED-021 holds: no ASCII-box fallback on card-capable surfaces. Verb set per the Brain answer: [Qualify+file] [Ask Brain] [Rephrase] [Suggest next] [Skip].
- **D-10:** Part 11 CIRS: every net-new invocable surface this phase ships (harvest sensor, any command/verb surface, the explore action) is born WIRED with a declared hitl_shape/hitl_why, or explicitly EXCLUDED with reason - checked by the born-wired gate and scripts/check-shape-declaration.cjs.

### Metadata thin slice
- **D-11:** The frontmatter pass extends 218's `entity-extract.cjs` dispatcher (same batch transaction, same open/work/close-per-invocation discipline per 218 D-05), deterministic and zero-LLM, writing frontmatter fields (methodology, created/date, status, section, confidence) as node properties on artifact nodes.

### Verification + release mechanics
- **D-12:** Live-room checkpoints are MANDATORY plan steps, not optional extras (218 lesson R1: fixture-green lied twice). The ador-ip-test end-to-end run is its own plan with its own verification evidence.
- **D-13:** Corepower-isolation validation is a NAVIGATOR-run Desktop step: the plan produces a paste-ready validation prompt + checklist; the navigator's confirmation is recorded in 219-VERIFICATION.md before the release gate opens. This also closes the open session-memory item (re-run eureka on corepower post-218).
- **D-14:** Release via `scripts/release.sh <version>` (five-gate lockstep - never hand-bump), npm publish + marketplace ref pin, VERSION-BUMP-CHECKLIST, website hand-typed-version fact-check. Version number follows the CHANGELOG convention at release time (next increment on the current line unless the navigator directs otherwise).
- **D-15 (navigator, 2026-07-13):** The release ALSO updates the marketplace entry (~/mindrian-marketplace/.claude-plugin/marketplace.json, source.ref pinned to the new tag - lockstep gate 5) AND refreshes README.md to the most recent feature state. Both keep their EXISTING styling (README stays Feynman + JTBD per the standing rule) - content updated, never restyled.

### Engine-breaks fallback (navigator, 2026-07-13)
- **D-20:** Every engine-backed surface in this phase carries a TERMINAL LLM-manual-baseline rung: when the deterministic engine cannot run (capability probes fail beyond the graceful rungs, crash, missing substrate - the FTS5 class), the surface OFFERS at a Decision Gate (never silently) an LLM high-effort manual mode: the model performs the intelligence work directly (reads the room artifacts, finds connections, scores by the SAME Q1..Q8 rubric + D-18 component definitions, fetches via the native web tools on the frozen deep_research reach). Output is honestly labeled `engine_mode: llm_manual_baseline` in report provenance AND artifact frontmatter, files through the SAME navigation.cjs gates as proposed content, Part 8 unchanged. It is an OFFERED fallback, never the default and never a silent substitute (the corepower lesson: manual mode masquerading as the engine is the anti-goal); a manual-mode result NEVER flips calibration/baseline status and is excluded from calibration sets. Doctor/report surfaces that manual mode was used.

### Data Room placement (navigator, 2026-07-13)
- **D-21:** Every artifact this phase creates is stored in PROPER ICM nesting - never a loose file: opportunities at `opportunity-bank/<section>/<name>/<name>.md` (Decision 16 Obsidian nesting; section per the 216 field contract - real domain slug, never ICM type); explore-chain research at `research/<dated-slug>/<dated-slug>.md`; filing goes through the EXISTING filing ops (opportunity-ops fileOpportunity / navigation.cjs writers) so STATE.md recompute + post-write cascade + graph indexing fire as normal. Every created directory carries its identity per ICM Layer 0 conventions (the room scaffolding owns ROOM.md/INDEX generation - reuse, never hand-mint). IF any flow ever mints a SUB-ROOM (e.g. a promoted opportunity graduating to its own workspace), it MUST go through the sub-room creation wiring contract (atomic 5 side-effects or fail closed - standing HARD RULE); sub-room minting is NOT in 219 v1 scope (promoted stage records the outcome; graduation is a follow-on).

### Research Corpus Contract (navigator, 2026-07-13 - from the DOM->Markdown->KG pattern review)
- **D-16:** Deep-research outputs are a CORPUS, not dead markdown. (1) Explore-chain research files as a research/ artifact with frontmatter + URL-cited sources (existing /mos:research provenance conventions, via navigation.cjs). (2) POST-FILING EXTRACTION: the 218 extractor + metadata pass runs scoped-incremental on every newly filed explore-chain artifact, landing proposed entities/relations with DERIVED_FROM edges to the artifact node - the research content becomes graph-visible to all engines at filing time. (3) OFFLINE DEGRADE: web leg down -> the chain queries the room's own research corpus (tri-modal scoped to research/) with provenance "web: absent (room-corpus degrade)". (4) REJECTED: new deps (jsdom/Playwright/@lightfeed - Tavily covers DOM->markdown server-side) and direct Neo4j triplet writes (Part 8 breach; room.db via navigation.cjs is the only graph target). Web-ingestion-agent as a standalone package = deferred idea, not this phase.
- **D-17 (adopted from external review annex, 2026-07-13):** Stage-vs-outcome separation on opportunity nodes: artifact_status (filed|banked, backward-compatible) vs opportunity_stage (banked|explored) vs opportunity_outcome (open|deferred|rejected|archived), PLUS an append-only stage_history[] of entries {from,to,at,actor,reason,evidence_ids,formula_version} written on EVERY lifecycle transition. Never overwrite prior state - supersede/append, never delete (funding-subsystem stage-model precedent, opportunity-ops.cjs). The D-03 lifecycle field remains the human-readable current-state summary; the axes + history are the durable record.
- **D-18 (adopted from external review annex, 2026-07-13):** Versioned component model for harvest readiness: expose components, not one opaque number - critic_gate (212 verdict, eligibility), compression_score (213, reuse unchanged), portfolio_score (215 AHP, keep 3 dimensions), tail_flag (215, never fold into the main score), evidence_readiness (deterministic provenance/claim-count rubric), follow_through_readiness (owner/next-experiment/decision-question closed rubric). HarvestIndex_v1 = critic_gate x weighted sum - ADVISORY, versioned, weights explicit/editable, ships EXPERIMENTAL until calibrated on a labeled set. Missing input -> typed 'unknown'/'insufficient_evidence', NEVER a fabricated zero. Composes with the Brain Q1..Q8 rubric: Q1..Q8 = the human card checks; components = machine readiness from EXISTING measured signals. Q2 Connection stays the only hard gate.
- **D-19 (adopted from external review annex, 2026-07-13):** Provider-status envelope + research contract drift fix: research runs return research_mode (normal | web_degraded_local_fallback | local_only | insufficient_evidence) + per-provider {status, reason, counts, freshness}; a cold/empty corpus returns insufficient_evidence, never ok:true+empty. FIX the commands/research.md <-> lib/lens-engine/source-lens-driver.cjs contract drift (docs claim paid->native->cache at research.md:271; the driver is cache-first + failure->empty - Manus-verified, confirmed locally) BEFORE the local corpus provider lands. Public .mindrian/research-cache stays free of room body text (guard test).

### Claude's Discretion
- Sensor scoring internals (exact Signal x Connection x Lens x Actor weighting, thresholds) - deterministic, documented, tuned against the ador fixture + live run.
- Candidate dedup policy (same opportunity resurfacing across sessions) - suppress via existing seen/rejection edges.
- Minto template field mapping details.

### Folded Todos
- `2026-07-08-f7-rescope-212-213-against-registercapability.md` (score 0.9) - folded as an ADVISORY seam-check only: its subject is Phases 212/213, not 219, but it flags the registerCapability seam; the planner must verify the qualification-card + sensor wiring against the CURRENT capability-registration surface rather than a stale pre-registerCapability pattern. Not a scope addition.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements + scoping trail
- `.planning/phases/219-opportunity-follow-through-harvest-formula-explored-stage-de/219-SPEC.md` - Locked requirements - MUST read before planning
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-13-opportunity-follow-through-scoping/2026-07-13-opportunity-follow-through-scoping.md` - full scoping: failure modes with file:line proof, five source lanes, three-bucket engine map, D1-D5, R1-R5
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-07-fable-max-pack/00-mining/opportunity-harvest-brain-answer.md` - BINDING Harvest Formula (Brain already asked and answered; do not re-ask)

### The substrate this builds on (Phase 218)
- `.planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-VERIFICATION.md` - the live before/after discipline REQ-5 inherited (fixture-green lied twice)
- `.planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-02-PLAN.md` - D-05 SQLite write-safety pattern the metadata pass must follow
- `scripts/entity-extract.cjs` (218 dispatcher) - the extraction entry the metadata thin slice extends

### Code seams this phase wires into
- `lib/core/insight-sensors.cjs` - the sensor contract the harvest sensor conforms to
- `lib/core/navigation.cjs` + `lib/core/navigation/edges.cjs` - THE write chokepoint + ALLOWED_EDGE_TYPES additive extension
- `lib/core/navigation/insights.cjs` (findRelevantOpportunities:208) - existing bank read the sensor complements
- `scripts/eureka-portfolio-report.cjs` (:44) - the deferred governed write REQ-1 implements; statement source of truth
- `scripts/scout-cadence-runner.cjs` (:249-256) - the cadence seam + the tally-not-opportunities gap being fixed
- `lib/core/chain-executor.cjs` + `lib/workflow/command-resolver.cjs` - the explore chain machinery (D-06)
- `commands/opportunities.md` - bank filing conventions the explored artifact lands in
- `commands/structure-argument.md` (+ its lib machinery) - the Minto/SCQA composer D-08 reuses

### Governance + release
- `docs/MINDRIAN-CANON.md` Parts 3, 7, 8, 9, 11 - gates, reuse, boundary, memory locality, born-wired/CIRS
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` - hitl_shape declaration for every new surface (D-10)
- `.claude/includes/release-process.md` - five-gate lockstep, release.sh entry point (D-14)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 218's writeEntityNode + tier-1 extractor + batch-transaction pattern: the opportunity-node minting and metadata pass reuse this wholesale
- graph-derivation.cjs propose-then-navigator-confirm HITL: `review_status='proposed'` lifecycle start
- SEED-009 / f_selector_decision rejection edges: the Skip-writes-rejection pattern exists; extend, do not invent
- The F.1 selector + f-selector-ranker: candidate ranking surface for harvest candidates
- structure-argument Minto machinery: explored-artifact composition
- run-all-<phase>.sh test-suite convention + doctor --acceptance roll-up

### Established Patterns
- One governed reach path (dispatchSensors -> decide() -> resolver); no second selection brain
- All writes through navigation.cjs; grep-gated
- Part 8 five-tripwire pattern for any external egress leg
- Born-wired gate: build-connector-registry --check, check-shape-declaration, check-render-coverage must stay green

### Integration Points
- Sensor rail: new SENS entry alongside SENS-01..13 (verify next free id against live insight-sensors.cjs)
- Eureka pipeline exit: portfolio-report generation is where statement banking hooks in
- Scout cadence: opportunity recompute slot already exists (:249-256)
- opportunity-bank/: existing bank structure + compute-opportunity-state script

</code_context>

<specifics>
## Specific Ideas

- Navigator: "the opportunity bank is what we keep claiming Mindrian can do... we want to make sure we do it. With proper graph work and proper logic (Minto)."
- Navigator: full in-memory local graph for algorithm passes, not LazyGraph (rooms are 70-2,400 nodes); "extract the actual metadata and extract from it."
- The explored output must read as ANALYZED (deep research + diffusion + analogies + web citations), not a candidate one-liner - that is the complaint being fixed.

</specifics>

<deferred>
## Deferred Ideas

- Track 1 engine rewire (find-connections, find-analogies, HSI, scan-opportunities input side, scenario-plan) + TRIZ contradiction-typing in whitespace - registered as the explicit follow-on in ROADMAP.md Phase 219 entry
- Five-lane harvest EXPANSION (meetings/ACTA, futures-wheel consequence nodes, needs-scoring extraction, beautiful-question pointing) - the sensor ships with the graph-event lane first; other lanes are follow-on sensor extensions
- Tier-2 NER (ONNX token-classification) - 218's deferred escape hatch, only if tier-1 + metadata prove insufficient on ador

### Reviewed Todos (not folded)
- `2026-06-28-ignite-persona-card-under-shows-frozen-role-blend-vocabulary.md` (score 0.6) - ignite onboarding surface, unrelated to opportunity follow-through; left for its own fix

</deferred>

---

*Phase: 219-opportunity-follow-through-harvest-formula-explored-stage-de*
*Context gathered: 2026-07-13*
