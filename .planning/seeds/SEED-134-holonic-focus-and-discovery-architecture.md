---
id: SEED-134
title: "Holonic Focus and Discovery Architecture: bounded knowledge focus plus controlled cross-boundary discovery over the nested Data Room"
status: open
priority: critical
filed: 2026-10-19
planted_during: "v2.0.0-beta.71 cut (quick 261019-ksf in flight); Phase 371 at human_needed"
trigger_when: "the next GSD phase after the beta.71 cut ships (navigator ruling 2026-10-19: 'seed this as the critical next gsd for mindrian')"
scope: large
source: "navigator paste 2026-10-19, a research-backed architectural proposal headed '/gsd:seed, MindrianOS: Holonic Focus and Discovery Architecture'; preserved verbatim below"
surfaces: [MindrianOS-Plugin, Theo, theo-context]
consults: [icm-architect, icm-workspace-architect, neo4j-modeling-skill, neo4j-graphrag-skill, neo4j-agent-memory-skill, neo4j-vector-index-skill, Theo graph-rulebook]
promotes_to: "Phase 0 (architecture audit and gap matrix, largely done by the two consults below) as its own GSD phase, then the smallest slice: a read-only bounded-focus mode of context_assemble with an explicit omitted[] list plus the JHTV A/B against Eureka RS (Council section); then Phases 1 to 6 of the proposal's roadmap as separate phases"
sibling_work: "mindrian-eureka gsd/mindrianos-holonic-discovery/ (uncommitted 2026-10-19; assumes a Neo4j room graph, to be corrected to room.db)"
---

# SEED-134: Holonic Focus and Discovery Architecture

## The idea, very simply

A Data Room already stores a lot of connected knowledge. What it does not yet give Larry or Theo is a reliable way to decide where to start, which context matters right now, which surrounding evidence to pull in, when to step across a boundary into a neighbouring area, which links are verified and which are guesses, and how to keep the path that led to a discovery.

Two failures pull in opposite directions. Too much context and the model drowns (the "lost in the middle" effect). Too little and it never sees the cross-domain link that matters. The proposal's answer is to treat a knowledge unit as a Holon: a thing that is whole on its own and also a part of something larger. Focus on one Holon at a time, project only what the task needs (and say what was left out), cross into other Holons only through explicit Portals, and let a separate discovery mode propose links that stay "proposed" until a person accepts them.

The central claim is a hypothesis to test, not a result: bounded focus plus controlled cross-boundary discovery produces better reasoning and more validated discoveries than today's context assembly, without losing provenance, structure or human authority.

## Why this matters for MindrianOS

- It is the next step of the moat (the graph that knows WHEN, WHICH and in WHAT SEQUENCE): the room graph becomes navigable, not just stored.
- It lands on what already exists: the single navigation chokepoint, proposed-then-confirmed claims, the gate ledger, contradiction and whitespace scans, the Eureka, HSI, analogies and connections perspectives, context_assemble, sealed rooms. The proposal itself says: audit first, never rewrite.
- Canon fit: Part 9 (memory locality, human confirms every truth claim) and Part 8 (no room content to the Brain) are the proposal's invariants 2, 5 and 12 under other names.

## Navigator ruling

2026-10-19: "lets seed this as the critical next gsd for mindrian" and "consult the neo4j and icm skills relevant to it." Priority critical; the phase comes right after the beta.71 cut. Start with the architecture audit and gap analysis (Phase 0 of the proposal), then the smallest slice that tests the hypothesis. Not a rewrite.

2026-10-19, strike ruled (navigator, on the critic's objection): the proposal's closing objective, "make cumulative knowledge more capable of producing validated discoveries", is STRUCK as the definition of done, because counting validated discoveries rewards inflation and only a person and an experiment validate. The ruling objective for every phase this seed promotes to: **make cumulative knowledge more capable of producing traceable, falsifiable candidates that a person can accept or reject quickly.** The verbatim paste below keeps the original line for the record, with this ruling standing over it.

## Consult: ICM (icm-architect, icm-workspace-architect, repo doctrine), 2026-10-19

Read-only consult over the ICM skills, Canon Parts 8 and 9, Appendix B, MWP-SPECIFICATION, LAYER-CONTRACT, `lib/core/navigation/*` and the research planner. Labels: Verified (seen in code, tests or doctrine), Unknown (not proven).

**Doctrine already says it.** ICM: "hierarchy carries context scoping", healthy step budget 2,000 to 8,000 tokens, layers L0 to L4 self-similar at every depth (icm-architect SKILL.md:9,30; references/core.md:17,32,82). MWP-SPECIFICATION.md:29 follows Simon's near-decomposable hierarchy: "Innovation concentrates at boundaries between subsystems - the cross-section edges". That is the Holon idea and the Portal idea under house names. The words Holon and Portal do not appear in the repo. The word Projection already carries three meanings (navigation/projections.cjs ranker signals, navigation/room-projection.cjs change feed, the Part 8 orchestration projection). A fourth meaning will confuse the canon: say "focus projection" or pick another word.

**Gap matrix (house name, state, evidence):**

| Concept | State | Evidence and house name |
|---|---|---|
| Holon | Partial | Units are room, sub-room, section ("nest"). Sections from room-skeleton-scaffold.cjs:486,655; icm-forest.cjs:134 four-class rule. No typed holon node. Verified. |
| Containment vs membership | Partial | NESTED_WITHIN is room containment (edges.cjs:501; room-birth.cjs:1374). PART_OF is taxonomy membership, DECOMPOSED_INTO taxonomy hierarchy (edges.cjs:393; typed-domain.cjs:64,176). Kept apart on purpose (Canon:217). A section has no containment edge; it is a folder. Verified. |
| Boundary | Partial | Room fence: room-path-containment.cjs:115,138. Sealed rooms: cross-room-aggregator.cjs:32-38 (L1 ALLOWED_ROOT, L2 GUARDRAIL.md at :139, L3 brain_cross_room:false, L4 sanitize). Section boundary is its CONTEXT.md contract only. Nothing enforced at node level. Verified. |
| Portal | Partial | UMBILICAL_TO peer cord at registry level (edges.cjs:570; resolve-umbilical-target.cjs:202 skips sealed or archived). SHARES_JOB and ELEVATES_TO cross the frame boundary (edges.cjs:540). graph_reason nearest_sub_room_decisions crosses room.db read-only (icm-forest.cjs:557; graph-derivation.cjs:491 ATTACH). No transition object; a transition writes no record. Verified. |
| Projection | Partial | context_assemble has the budget dial: fragment_window, fragment_char_cap, top_k, max_depth, focus_node_id, estimate_only (lib/mcp/tools/context.cjs:90-142; room-context.cjs:163 leg C, :435-458). It drops excluded types silently (room-context.cjs:142-160). The SessionStart envelope DOES list omissions ("Shortened or left out here", session-context-envelope.cjs:237-249, BLOCK_POLICY :68-90): the ingredient exists on the wrong surface. Verified. |
| Focus Session | Partial | session_focus holds one row per session (focus.cjs:15-30); every setFocus writes a focus_changed memory_event with previous_focus_node_id (:49-60). History is rebuildable from events; no reader, no ordered trail. Verified for the write. |
| Discovery Candidate | Partial, strong | research_run perspective_recall covers eureka, rs, hsi, whitespace, analogies, connections (research.cjs:67,842; perspectives/*.cjs). Candidates land in a run-folder JSONL, not the graph (shared.cjs:180-187); already-connected pairs are dropped (shared.cjs:139-150); the judge "is human-routed; nothing auto-passes" (eureka-judge.cjs:25); structural noise excluded (eureka/candidate-exclusion.cjs). Unknown: whether a human-rejected pair is remembered and excluded later. |

**The 12 invariants against the house:** 1 stable identity EXISTS (artifact-id.cjs 12-hex; LAYER-CONTRACT.md:254). 2 no silent promotion EXISTS (transitions.cjs:65-75 closed set; AGENT_IDENTITIES refused :252-253; confirm-node.cjs:38, holdForEvidence :53). 3 traceability PARTIAL (SOURCED_FROM exists, edges.cjs:854, but navigation/CONTEXT.md records zero rows in any room and 1 of 4 claim paths anchoring). 4 contradiction preservation PARTIAL (CONTRADICTS edges.cjs:163; findContradictions hides superseded by default, insights.cjs:121,154; census found 0 CONTRADICTS edges, SUPERSESSION-CONTRACT.md:34). 5 human gate EXISTS (gate ledger single-use, session-bound, 30-minute TTL, stale_subject refusal, gate.cjs:18-36,428,540; verification-floor.cjs:53; claim_verify rungs 1 to 5, verification.cjs:33-39). 6 security boundaries EXISTS (part8-egress-guard at brain-client.cjs:446; room-path-containment). 7 reversibility PARTIAL (statuses close, never delete; irreversibility-ledger.cjs halts chain steps; room-discard-cascade.cjs; no undo for an edge). 8 temporal integrity PARTIAL (valid_from and valid_until on claims, typed-claim.cjs:96,160; change feed room-projection.cjs; no as-of read in context_assemble). 9 no containment cycles PARTIAL (read side only: visited set graph-derivation.cjs:491-498, DEPTH_CAP=3 coverage-rollup.cjs:41; writeEdge checks neither endpoints nor cycles and has 77 call sites). 10 no manufactured discovery PARTIAL to EXISTS (never-fabricate-provenance floor reasoning-write.cjs:163-165; Stage A refuses fabricated quantities eureka-judge.cjs:55-58). 11 explicit incompleteness PARTIAL ("null, never zero" in navigation/CONTEXT.md; "not asked" reason set LAYER-CONTRACT.md:254; excludedKnown counter shared.cjs:170; context_assemble reports nothing it left out). 12 no cross-room leakage EXISTS (aggregator L1 to L4; room_switched refusal gate.cjs:25; "Cross-room aggregation forbidden" edges.cjs:495-500).

**Smallest slice that tests the hypothesis (ICM seat):** a read-only "bounded focus" mode beside context_assemble, using only existing doors. focus_node_id set to a section node; leg C and getNeighborhood kept inside that section's nodes; an explicit `omitted[]` with counts and reasons (out_of_boundary, excluded_type, budget_cut) built with the envelope's buildPointers pattern; at most N cross-boundary candidates from perspective_recall connections, marked proposed portals, no edge written; acceptance only through gate_render, gate_answer, then writeEdge. Offline A/B on 2 or 3 existing rooms: the same questions against today's context_assemble and the bounded mode; measure tokens, answer-grounding rate, accepted cross-boundary candidates. Part 5 two-gauge discipline: a smaller context has no value unless transfer holds.

**Risks the ICM seat named:** a new edge type (PORTAL, CONTAINS) is a canon amendment under Part 4; reuse NESTED_WITHIN, PART_OF, UMBILICAL_TO first (Part 7). Cycle prevention needs a write-side check in writeEdge (77 call sites). Provenance is near zero in live rooms, so invariant 3 is hollow until the anchoring work (Phase 273) lands. 0 CONTRADICTS edges exist, so invariant 4 has no live data to test against.

## Consult: Neo4j and Theo (modeling, GraphRAG, agent memory, vector and GDS skills, Theo graph-rulebook), 2026-10-19

**Honest ceiling first.** The Neo4j skills do not cover what the proposal cites them for. The modeling skill has no tree-vs-DAG pattern, no valid_from/valid_to pattern and no provenance pattern (its only versioning line is "Audit/history columns -> Intermediate versioning node", SKILL.md:152). The GraphRAG skill has retriever classes only (SKILL.md:42-68), no community summaries and no local/global split. The agent-memory skill covers three memory types, dedup and positioning (SKILL.md:60-70, 286), not event-time vs ingestion-time and not invalidation. For GraphRAG communities, RAPTOR and Zep/Graphiti bitemporality the seed cites the primary papers (R2, R3, R4 below), never these skills.

**What the skills and the Theo rulebook do give, as modeling rules for the room side:**

1. Two edge types, never one. Containment is a strict tree with one parent. Membership is a DAG with many parents. Theo already does this: PART_OF means containment inside a hierarchy only, and SOURCED_FROM was created because provenance is not containment (graph-rulebook.md:500-511, "merging the two would make that difference unqueryable"). Never a generic HAS or RELATED_TO (modeling:67, :285). The room side copies this split and invents no new edge type.
2. A Portal or a membership with its own properties (reason, validity interval, reviewer) is an intermediate node, not a property-laden edge (modeling:131-135; Theo's MethodClaim follows the rule, rulebook:936-946).
3. Boundary kind and holon kind are labels or enums, never nodes; status is a property when it changes often (modeling:99-101, :286). Supersession is an edge plus a `superseded_by` property; never delete, "prefer marking over hard delete" (rulebook:862-871). Theo already has `superseded_by` and `review_status` (rulebook:938-939).
4. Every holon node and edge gets a structural anchor at creation, in the same write; semantic placement can resolve later (Theo CLAUDE.md rule 7, two tiers). Every edge carries direction, canonical endpoints, a source anchor, review_status and a named reader (rulebook:1092-1095).
5. Discovery Candidates are rows on a review sheet, never edges. "Co-occurrence, similarity, and agent inference are never canonical edges" (rulebook:1074, 1096-1099). Only a confirmed claim produces a typed edge (rulebook:943-946).

**Three things the proposal is at risk of doing that the skills forbid:** (W1) making every entity a container or using one generic HOLON/CONTAINS type, which yields supernodes (modeling:156-192, :284-286); split rel types, segregate labels, bucket the Focus Session events (modeling:174-192). (W2) writing similarity or community output straight into the persisted graph: the GDS default flow ends in `write` (gds:201, :346-356), which contradicts rule 5 and "proposed, never silently accepted"; use stream or mutate, then the review sheet; GDS-class work stays outside Theo/Aura on the external seam (Theo CLAUDE.md rule 1). (W3) letting a summary stand in for evidence: Theo rule 6 "No answer is composed from a memorized summary", rule 1 bans LLM interpretation inside the tool; GraphRAG return_context=True keeps raw chunks beside the answer (graphrag:362-370); embeddings live on Chunk nodes, not on business nodes (modeling:276, :288).

**Cost notes:** estimate GDS memory before a projection (gds:171-189); run WCC first and partition (gds:275); the HNSW RAM formula is at vector-index:129. Theo sits far below the ~100K-vector threshold, so a separate vector store is over-engineering (rulebook:1022-1035).

**SQLite carries the model.** One `contains` table with a single-parent constraint, walked with WITH RECURSIVE; a separate many-to-many `member_of` table; validity as valid_from/valid_until columns plus a SUPERSEDES edge; provenance as SOURCED_FROM edges. The room code already uses every one of these: WITH RECURSIVE in navigation/neighborhood.cjs and insights.cjs; valid_from/valid_until in navigation.cjs and room-db.cjs; SUPERSEDES in close-loop-writer.cjs and findings-wirer.cjs; SOURCED_FROM in navigation.cjs. The only Neo4j-only capability is GDS community detection and similarity, which belongs on the Brain side over generic handles or runs per room with a small in-process algorithm. The room side needs no Neo4j. Unverified: navigation/focus.cjs, projections.cjs and room-projection.cjs were counted, not read; Phase 0 reads them before proposing any table.

## Council, 2026-10-19: how mindrian-eureka will and should use this to get better work from its agents

Navigator ask: "make the council around how will and how should the mindrian-eureka will use it to get better work from those agents." Four seats sat, read-only, over `/home/jsagi/dev/mindrian-eureka` (GitHub jsagir/mindrian-eureka, "MindrianOS local-first innovation and opportunity discovery capabilities") and this seed: the Eureka engine owner, the agent orchestration and harness lens, the epistemics and human-gate critic, the Theo method-guide lens.

**Finding zero, before the seats.** Eureka already holds an uncommitted `gsd/mindrianos-holonic-discovery/` folder (PROJECT, RESEARCH, ARCHITECTURE, REQUIREMENTS, ROADMAP, DECISIONS, VALIDATION, CONTEXT; written 2026-10-19 15:09 to 15:15, 44 files dirty in that tree). It is careful work and it already reaches most of this council's conclusions (read-only engine, candidates `proposed` with `evidence: []`, host owns the gate, "do not model Holon as every graph node"). It carries one wrong assumption: the room graph is Neo4j ("local Neo4j read-only CLI", FR-1, SR-1, SR-4, AC-5, Phase 1 "Add local Neo4j read-only"). In MindrianOS the room graph is SQLite `room.db` behind the navigation chokepoint; Neo4j is the Brain (Theo) and Part 8 keeps room content out of it. The authorized snapshot Eureka wants comes from `room.db` through a host exporter, never from a Neo4j connection. Action for the Eureka repo owner: correct that assumption in those eight files before committing them, and cross-link this seed.

**How Eureka WILL use it (the shape that already exists, four seats agree):**

- Eureka is a Mode B worker. MindrianOS owns the room, scope, Theo calls, gates and writes; Eureka gets a bounded, attested bundle and returns leads (docs/integrations/mindrianos.md:9-15,33; ADR 0001). Eureka never resolves a room path, never calls Theo, never writes the portfolio (README). Eureka must not get Mode A (focused reasoning) or Mode C (structural maintenance) authority.
- Eureka already has the projection prototype: `project_focus()` in src/mindrian_eureka/graph_relations/runner.py:11-48 returns `included_node_ids`, `omitted_node_count`, `omitted_edge_count`, `boundary_policy`, a `max_nodes` budget. It is the only job that discloses omissions. Every other job receives `scope_id`, `snapshot_id` and an artifact list (schemas/run-request.v1.schema.json); the result's `read_artifact_ids` says what was read, not what was not.
- Eureka already keeps the dimensions apart where it matters: the RS and HSI `cross_engine_pair_signal` says "No ... complementarity has been established" and never fuses scores (`method_signal_count`); whitespace returns `novelty_check: room-relative-only, external_literature: not_checked` (discovery_workflows.py:113-212, :202); the SME structure-mapping result carries `verification_targets.required_checks` (find_support, find_counterevidence, check_novelty, check_boundary), the closest match to the proposal's Discovery Candidate; graph relations return `status: proposed_for_human_review, score: None, graph_write: not_performed` (discovery_workflows.py:410-435), which is invariant 2 in code.
- The catalog already declares incompleteness: `blocked` (discover_breakthroughs, find_coverage_gaps, find_mechanisms, critique_pitch, deliberation.structure, propose_relationships, evidence.fetch, experts.find), `planned` (orchestrate_multidomain, bottleneck.diagnose, claims.compare, thesis.read_prior), `host_brokered` (analogy.cross_domain_research); run results carry `partial`, `blocked`, `limitations`, `warnings`; the source backtest "failed to beat the baseline" (0 of 30 held-out edges in the top 200 for every method). In holonic terms these are declared incompleteness and must show in the projection or the candidate, not only in prose.
- The `/mos:eureka` adapter is not wired (README:128). No live agent loop crosses the seam today, so the first experiment hand-builds the bundle.

**How Eureka SHOULD use it (the council's rulings, with the seat that owns each):**

1. (Engine owner) Three contract changes, most gain for least change. (a) A `projection` block in run-request `scope`: holon_id, projection_type, included_ids, omitted_count, omission_policy, budget, authorization_attested; echoed in run-result with `unread_artifact_ids` and `truncation` beside `read_artifact_ids`. This generalizes `project_focus` metadata to every job and makes invariant 11 testable. (b) One shared `discovery-candidate.v1` envelope around the RS/HSI pair signal, the SME inference and the relationship proposal: source_refs, target_refs, proposed_relation, supporting_evidence, counterevidence (empty means "not checked"), alternative_explanations, separate signal_strength / evidence_strength / novelty_scope (room-relative | external_checked), validation_requirements (reuse the SME `required_checks` enum), review_state fixed at "proposed" on output; the host maps it to claim_write and gate_render. (c) A per-capability `readiness` echo on every result: catalog status, validated true/false, a link to the limitation, so a host cannot show an experimental unvalidated ranking as an evaluated discovery (invariant 10).
2. (Orchestration) The Focus Session lives on the host, never in Eureka; choosing the active Holon is a scope decision. The host already has the parts: room_bind + question_set + context_assemble(focus_node_id) are focus_open; graph_query / graph_reason are focus_navigate; graph_query + room_state + icm-forest are holon_inspect; claim_write / artifact_file are knowledge_propose; gate_render / gate_answer are knowledge_review (host only); memory_event + room_changes(activity) + gate_list build focus_trace. discovery_search and discovery_evaluate SPLIT: host perspective_recall / perspective_candidates and perspective_judge, contradiction_check, claim_verify; Eureka scout_plan / scout_start, scout_run_workflow (graph.explore_local_relationships, graph.propose_relationships), scout_sme_map, scout_sme_finalize, graph.rank_evidence_paths, graph.score_bayesian_surprise. Net: Eureka needs no new tool; the host needs two additions, a persisted session record and omission fields on context_assemble. Eureka receives focus_session_id and projection_id as audit metadata only, as scope_id is treated today. The agent prompt names four things (one question, one focal node, one projection type, the explicit omission list) instead of a whole bundle; one token budget per session replaces per-call knobs.
3. (Orchestration) Failure B is already answered by two shipped lanes that search past known edges: the host perspectives (eureka, rs, hsi, whitespace, analogies, connections in lib/core/research-planner/perspectives/*-recall.cjs) and Eureka RS/HSI scoring over artifacts with no edge between them. Portals stay a projection over INFORMS, FOLLOWS_FROM, CONTRADICTS and SOURCED_FROM; no new object. Mode B must never be limited to Portal-reachable neighbours or RS and HSI lose the non-neighbour pairs that are their purpose.
4. (Critic) Guards that must be schema rules, not prose. A Portal or candidate has a required discovery_state (proposed, confirmed, rejected), never NULL: writeEdge allows review_status NULL today (edges.cjs:919-938) and a Portal over a NULL edge would read as structure, not as a guess; a similarity-born Portal starts at rung 1 or 2 and cannot pass the verification floor alone. Four separate fields: local_novelty, literature_novelty (null until an approved external search ran), usefulness (null until a person reviewed), confidence (a measured band, never the model's self-report). Every projection lists what it left out AND always keeps every CONTRADICTS neighbour of the focus; a budget cut never drops a contradiction; a summary never substitutes for a primary source. The omission list uses one opaque merged "restricted or unavailable" bucket: cross-room-aggregator.cjs:597 already counts skip_reasons.sealed_room and a count above 0 reveals that a sealed room exists (invariant 11 against invariant 12). Holon ids, titles and Portal explanations are room content; they never go to Theo; the egress guard runs on Portal objects; only eureka_critic-style packets (quantized scalars, closed enums, the [01x]{6} rubric) cross (lib/mcp/tool-router.cjs:2295-2311). Holon ids can also leak through Eureka's job DB and caches (excerpts kept up to 30 days, embeddings cached; mindrianos.md:64): a sealed-room id in a cached result breaks invariant 12.
5. (Critic) A candidate earns a person's minute when four things hold: it is not a restatement (run analysis.compare_text_differences first), it shows evidence on both sides, it names one falsifier, and rejecting it changes nothing a person accepted. The gate card always shows where a Portal came from; Part 12 invisibility must not hide machine origin at the gate.
6. (Critic) Five invariant tests Eureka's evaluations/ adds before adopting holons (today it holds room-run reports and one test file, no negative controls, no decoys, no blind protocol): (i) shuffled-pair control, the false candidate rate on decoys reported and below the rate on real pairs; (ii) projection contradiction retention, one CONTRADICTS source in the focus neighbourhood, budget at minimum, the id appears in included or omitted; (iii) no silent promotion, a similarity-only candidate is proposed at rung 2 or lower and an approve below the floor yields needs_evidence; (iv) sealed-room blindness, 0 sealed rooms then 1, ids, counts and wording byte-identical, no sealed title or id in any egress payload; (v) novelty field separation, no external bundle, literature_novelty and usefulness null, rendered text free of "novel", "new to the field", "validated".
7. (Theo seat) Mapping, with only generic handles on the wire. Wicked challenge: Mode A to map, then B; focal Holon the room root (system, stakeholders, frames); Eureka six-hat review, claim challenge, graph bridges and holes; Theo framework_route{Wicked}, larry_move{challenge}. Undefined exploration: Mode B; one futures sub-room per alternative future; Eureka RS pairs and multidisciplinary research planning; framework_route{UnDefined}. Ill-defined opportunity search: B, then A on each candidate; an opportunity section or sub-room; RS+HSI shortlist, whitespace, mechanism retrieval and SME mapping; live route Four Lenses, Cross-Disciplinary Thinking, JTBD, Process Mapping. Well-defined investigation: Mode A; one claim or hypothesis; claim challenge, OMM decision sequences, package candidate links; live route MECE, Pyramid Principle, Root Cause Analysis, 80/20 (coverage partial, 1 of 4). Mode C has no PWS mode and no Theo handle; it is host-local. The Focus Session asks Theo one thing per step: problem_lenses before classification; framework_route{problem_type} after; framework_steps{framework} on entry (step ids must match PROCESS_STEP_ID_RE, part8-egress-guard.cjs:524-527); larry_move for the next move; review_guide before a gate. Never: case text, holon or node ids, room names, claim prose, Eureka scores or pairs, Focus Session ids, a numeric dial, or the reason for the classification. Unverified: the Wicked and UnDefined routes timed out three times; their instruments come from framework-chains.md, not the live graph.
8. (Theo seat) Theo's own hierarchy is holonic (Chapter PART_OF Phase PART_OF Root; HAS_STEP and PRECEDES order a framework) and it keeps PART_OF (containment) and SOURCED_FROM (provenance) apart on purpose (rulebook:501-512). The room side mirrors that split and invents no edge type. "The next instrument needed to learn" by stage: Wicked, a stakeholder tension map then Beautiful Question; Undefined, trend extrapolation, scenarios, first principles, Dominant Design for "what is the future of X"; Ill-defined, Four Lenses then JTBD; Well-defined, MECE, Root Cause Analysis, then the smallest test that can prove the path wrong; every stage, Challenge Assumptions before a gate.

**The experiment that decides it (orchestration seat, agreed by the ICM seat):** one A/B on the JHTV room, one fixed question set, review volume K=20. Arm A, baseline: the full authorized snapshot to RS scout_start with default context_assemble. Arm B, focus plus discovery: context_assemble(focus_node_id) and Eureka project_focus(hops=2), both with omission metadata, plus one Mode B lane, perspective_recall(rs) restricted to sections that share no edge with the focus, same K. Smallest code change: one `projection` block (included_ids, omitted_count, omitted_policy, snapshot_hash) on the context_assemble reply and on the bundle the host sends to Eureka; both arms logged through memory_event. Five measures: blinded `useful` and `already_known` rates at K=20 through scout_record_review; share of candidates with resolvable source refs; input tokens per arm; count of false novelty claims; recall of held-out links (hide edges filed after date T, count recoveries). Arm B wins only if usefulness or recall rises at equal or fewer tokens, with zero silent promotions. More candidates never count as success.

**Proposed strike (critic; navigator to rule):** the proposal's last line, "The objective is to make cumulative knowledge more capable of producing validated discoveries", invites counting validated discoveries as the success metric, and that metric rewards inflation. Only a person and an experiment validate. Replacement: "more capable of producing traceable, falsifiable candidates that a person can accept or reject quickly."

**The sequencing rule, in Larry's words (Theo seat):** open the map wide and keep every frame alive. Then pick one door, make it small enough to test, and walk through it. Come back with what you learned before you open the map again. Don't hunt for connections before you've framed the question, and don't call a tested path a solved problem.

**Open risks the council left on the table:** the gate ledger is in memory only, so a Focus Session that spans a restart loses its pending gates; two context assemblers exist (MCP context_assemble and the CLI hook path), so omission metadata added to one does not reach the other; ranking is unvalidated (the backtest), so the first phase measures before it builds; traceability is near zero in live rooms (zero SOURCED_FROM rows), so invariant 3 fails on day one unless anchoring lands first.

## Constraints every later phase must keep

- The per-room graph is SQLite (`room.db` through `lib/core/navigation.cjs`), not Neo4j and not KuzuDB. Neo4j is the Brain (Theo). The proposal's "Neo4j has been used" line refers to the Brain side only.
- Part 8: no room content, no room metadata, crosses to `brain_*`. Discovery across rooms is local; the Brain supplies methodology handles only.
- Part 9: writes only through the navigation chokepoint; a claim lands `proposed` and only a person confirms or supersedes it.
- Part 7: reuse before build. `context_assemble`, `graph_reason`, `contradiction_check`, `whitespace_scan`, `research_run perspective_recall`, the gate ledger and `claim_verify` are the existing homes for Projection, Portal, Discovery Candidate and the human gate. A new tool is justified only against them.
- Part 11: every new invocable surface is born wired with a declared HITL shape.
- No em-dashes in anything filed; plain English on every UI surface ("Data Room", never "ICM").

## Open questions for Phase 0

1. Which existing things deserve a Holon boundary: rooms, sub-rooms, sections, artifacts, claims? The proposal warns against making everything a Holon.
2. Is a Portal a persisted object or a projection over existing typed edges (INFORMS, FOLLOWS_FROM, CONTRADICTS, SOURCED_FROM)?
3. Does today's `context_assemble` (four legs, budget dial, focus_node_id) already count as a Projection engine missing only explicit omission metadata?
4. How do sealed rooms (GUARDRAIL.md) and `room-path-containment` map to invariant 6 and 12 so that discovery never reveals a restricted room's existence?
5. What is the baseline to beat (Experiment A to G in the proposal), measured on existing rooms before any change?

## Breadcrumbs

- `lib/core/navigation.cjs`, `lib/core/navigation/CONTEXT.md`: the chokepoint and the claim provenance contract.
- `docs/MINDRIAN-CANON.md` Part 8, Part 9, Appendix B; `docs/MWP-SPECIFICATION.md`; `docs/LAYER-CONTRACT.md`.
- MCP tools: `context_assemble`, `graph_reason`, `contradiction_check`, `whitespace_scan`, `research_run` (perspectives), `claim_write`, `claim_verify`, `gate_render`, `gate_answer`.
- `lib/core/icm-forest.cjs` (room tree), `lib/core/room-skeleton-scaffold.cjs` (sections), sub-room wiring contract (memory: five side effects or fail closed).
- Sibling seeds: SEED-133 (Data Room as a system), SEED-121 (review spine), the Critical Pathway seed-to-phase doc.
- Theo: `/home/jsagi/Theo/notes/graph-rulebook.md` (schema source of truth for the methodology side).

## The proposal, as pasted (verbatim, 2026-10-19)

# /gsd:seed
# MindrianOS: Holonic Focus and Discovery Architecture

**Date:** 2026-10-19
**Project:** m:os (MindrianOS)
**Subsystems:** ICM, DataRoom, Theo, MCP, Research Orchestration
**Status:** Research-backed architectural proposal, not an approved implementation
**Primary objective:** Transform nested knowledge storage into bounded, navigable, cumulative knowledge discovery.

---

## 0. INSTRUCTIONS TO THE IMPLEMENTATION AGENT

You are working on the MindrianOS architecture.

Your task is to investigate the existing codebase, evaluate this proposal against its actual implementation, identify gaps, and produce a feasible implementation plan.

**Do not begin by replacing existing components.**

First inspect the repository, tests, documentation, data models, interfaces, and established architectural decisions.

Differentiate throughout between:

- **Verified:** Confirmed directly from repository code, tests, or authoritative documentation.
- **Reported:** Described in the project background but not yet verified in the repository.
- **Research-supported:** Supported by cited external technical literature.
- **Proposed:** A design decision requiring evaluation.
- **Unknown:** Something that must be investigated before implementation.

Do not invent existing files, APIs, database schemas, benchmarks, or implemented capabilities.

Preserve backwards compatibility wherever feasible.

Use the existing MindrianOS conventions and governance mechanisms. Do not create an independent architecture when the functionality can be integrated into established components.

## 1. PROJECT CONTEXT

### 1.1 MindrianOS purpose

MindrianOS, abbreviated **m:os**, is an emerging knowledge and reasoning operating system.

Its intended purpose is to convert fragmented research, conversations, documents, evidence, ideas, and investigations into reliable, reusable knowledge.

Rather than functioning as a conventional chatbot with memory, m:os aims to make understanding cumulative.

Its central ambition:

> What if knowledge could become a navigable, evolving structure in which every validated connection expands not only what we know, but what we are capable of discovering?

The desired progression is:

**Fragmented information -> Structured understanding -> Validated relationships -> Cumulative discovery -> Structured Eureka**

The system should help humans and intelligent agents:

1. Accumulate understanding.
2. Recognize the limits of existing understanding.
3. Identify contradictions and missing evidence.
4. Investigate unresolved questions.
5. Propose new relationships and hypotheses.
6. Validate important discoveries.
7. Preserve results for subsequent investigations.
8. Identify and construct the next instrument needed to learn.

### 1.2 Structural principle

**Shape means structure.**

This is a foundational architectural principle, not merely a visual-design principle.

A shape represents a meaningful structural or epistemic distinction.

Knowledge elements may serve distinct roles, including:

- Questions
- Claims
- Evidence
- Assumptions
- Contradictions
- Dependencies
- Alternatives
- Constraints
- Opportunities
- Tests
- Decisions

These roles must retain their meaning during extraction, classification, nesting, retrieval, navigation, and synthesis.

### 1.3 Existing architecture, as reported

The following describes prior project context. It must be verified against the repository before making architectural changes.

**ICM:** The internal knowledge organization mechanism.

**DataRoom:** A persistent, problem-oriented knowledge workspace, with a local SQLite database reportedly named `room.db`, supporting stores and a room registry.

**Nested structure:** Knowledge is intended to develop recursively into increasingly specific structures.

**Remote knowledge infrastructure:** Neo4j has been used for methodology or graph-related capabilities.

**Theo:** The native intelligent reasoning and methodological assistant associated with m:os.

**PWS:** The Problem Worth Solving methodology and associated research frameworks.

**Genesis:** Research orchestration and context decomposition capabilities that may already exist as components, prototypes, or design documents.

**OM-HMM:** An Opposable Mind / human-machine methodology that may provide complementary reasoning capabilities.

Earlier experimental interfaces reportedly included:

- `brain_ask`
- `brain_query`
- `brain_schema`
- `brain_search`
- `brain_stats`
- `brain_write`

These names are historical context, not verified current API contracts.

Existing human validation and proposed-to-accepted mechanisms must be discovered and reused.

### 1.4 What the ICM should ultimately become

The ICM is intended to support an ever-expanding, recursively nested knowledge structure.

Each meaningful knowledge unit may contain further structured knowledge units.

This can resemble a fractal in terms of recursive organization, although mathematical self-similarity is not assumed.

The design must accommodate:

- Expansion without semantic corruption
- Persistent identities
- Stable reference resolution
- Recursive relationships
- Multiple valid perspectives
- Explicit contradictory statements
- Provenance and source traceability
- Changes over time
- Reuse across investigations
- Cross-domain discovery

Do not assume all graph nodes must be Holons.

Investigate which concepts deserve an explicit Holon boundary and which should remain ordinary entities, claims, sources, or relations.

---

## 2. PROBLEM DEFINITION

### 2.1 Primary problem

A knowledge system can store large amounts of connected information without providing an intelligent agent with a reliable way to decide:

- Where to begin an investigation
- Which knowledge context currently matters
- Which surrounding information should be available
- When to cross a structural boundary
- Which connections are verified
- Which connections are speculative
- When broader exploration is justified
- How to preserve the path leading to a discovery

The result can be context overload, weak traceability, premature inference, loss of knowledge structure, and missed discoveries.

### 2.2 Two competing failure modes

**Failure A: Excessive context**

The agent receives too much information.

Relevant evidence becomes difficult to isolate, computation becomes expensive, and reasoning can become less reliable.

**Failure B: Excessive isolation**

The agent receives only information inside a tightly bounded context.

Potentially important cross-domain relationships remain undiscovered.

Both failures must be addressed in one integrated design.

### 2.3 Core hypothesis

A combination of bounded knowledge focus and controlled cross-boundary discovery can improve reasoning quality and cumulative discovery without sacrificing provenance, structural integrity, or human authority.

This is a hypothesis requiring comparative testing, not an established result.

---

## 3. RESEARCH FOUNDATION

### R1. Holons and Focus

Initial conceptual source:

https://inferenceengineer.substack.com/p/on-holons-and-focus

Relevant design concepts from the preceding analysis:

- Focal Holon
- Boundary
- Portal
- Projection

**Evidence qualification:** The source page was not directly retrievable during the research pass. Verify its terminology and argument independently before attributing specific technical requirements to its author.

Use it as a conceptual starting point, not as the sole architectural authority.

### R2. RAPTOR

Sarthi et al., *Recursive Abstractive Processing for Tree-Organized Retrieval*, ICLR 2024.

https://arxiv.org/abs/2401.18059

Research contribution:

- Hierarchical retrieval
- Recursive abstraction
- Multiple levels of summarization

Architectural implication:

Investigate how DataRoom projections can represent nested structures at different resolutions while retaining links to underlying evidence.

### R3. GraphRAG

Edge et al., *From Local to Global: A Graph RAG Approach to Query-Focused Summarization*, 2024.

https://arxiv.org/abs/2404.16130

Research contribution:

- Knowledge graph indexing
- Community structure
- Global and local questions
- Cross-cluster synthesis

Architectural implication:

Do not depend exclusively on local traversal. Provide mechanisms for exploring relationships and patterns across independently structured knowledge areas.

### R4. Zep / Graphiti

Rasmussen et al., *Zep: A Temporal Knowledge Graph Architecture for Agent Memory*, 2025.

https://arxiv.org/abs/2501.13956

Research contribution:

- Temporal knowledge representation
- Dynamic entity relationships
- Incremental memory updates
- Historical retrieval

Architectural implication:

Assess explicit event time, ingestion time, supersession, and history-preserving relation updates.

Do not assume the existing ICM already implements a complete temporal graph.

### R5. W3C PROV-O

https://www.w3.org/TR/prov-o/

Research contribution:

- Provenance entities
- Activities
- Agents
- Evidence lineage

Architectural implication:

Design traceable knowledge assertions and transformations.

Prefer interoperability with established provenance concepts rather than inventing an incompatible provenance model.

### R6. Lost in the Middle

Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*, TACL 2024.

https://aclanthology.org/2024.tacl-1.9/

Research contribution:

Longer context does not automatically produce more reliable access to relevant information.

Architectural implication:

Context projection must be evaluated for both relevance and completeness.

A smaller context is not necessarily better if it omits essential evidence.

### R7. MCP

https://modelcontextprotocol.io/specification

Research contribution:

Structured discovery and invocation of tools, protocol-level interaction patterns, and relevant security considerations.

Architectural implication:

Expose Holon navigation and discovery through bounded, typed tools where appropriate.

Separate MCP protocol capabilities from application-specific authorization, audit, and human approval.

Verify the applicable specification version during implementation.

---

## 4. PROPOSED ARCHITECTURE

### 4.1 Architectural layers

**Layer 1: Persistent Knowledge**

Existing ICM / DataRoom infrastructure.

Responsibilities:

- Store entities and claims
- Preserve source material
- Store structural and semantic relationships
- Maintain knowledge state and version history
- Support stable identifiers
- Enforce storage-level integrity

**Layer 2: Holonic Structure**

Defines bounded knowledge units within the persistent knowledge structure.

Responsibilities:

- Holon identity
- Membership
- Parent and child relationships
- Boundary definition
- Semantic scope
- Structural integrity
- Relationship references

**Layer 3: Focus and Projection**

Controls what is assembled for a particular reasoning task.

Responsibilities:

- Current focal Holon
- Investigation objective
- Projection policy
- Context budget
- Evidence priority
- Boundary enforcement
- Focus history

**Layer 4: Discovery**

Investigates relationships outside the current bounded context.

Responsibilities:

- Identify potential connections
- Explore cross-Holonic relationships
- Generate hypotheses
- Search for supporting and contradicting evidence
- Estimate uncertainty
- Propose validation experiments

**Layer 5: Theo**

Orchestrates reasoning using the established m:os methodology.

Responsibilities:

- Select appropriate research and reasoning operations
- Explain findings
- Request additional evidence
- Navigate knowledge
- Invoke discovery workflows
- Present decisions for human review

**Layer 6: Human Governance**

Controls consequential acceptance of proposed knowledge.

Responsibilities:

- Approve or reject structural changes
- Review proposed relationships
- Record rationale
- Maintain decision accountability
- Support reversal and audit

The layers are conceptual responsibilities, not necessarily separate services or databases.

---

## 5. CORE DATA CONCEPTS

### 5.1 Holon

A Holon is a knowledge unit that can be considered both independently and as part of a larger structure.

Candidate attributes:

- Stable identifier
- Semantic title
- Purpose
- Scope definition
- Parent reference
- Child references
- Membership references
- Version
- Creation and update metadata
- Provenance references
- Policy references

**Important:** Nesting does not automatically imply truth, source ownership, or exclusive containment.

Investigate whether the system requires multiple parents, overlapping scopes, and shared memberships.

If so, distinguish canonical containment from semantic membership rather than forcing a strict tree.

### 5.2 Boundary

A Boundary identifies the relevant scope and access constraints of a Holon.

It may distinguish:

- Included knowledge
- Referenced external knowledge
- Excluded knowledge
- Pending evidence
- Authorized cross-boundary access

Separate semantic boundaries from security and authorization boundaries.

A semantic relationship must never grant access to restricted knowledge.

### 5.3 Portal

A Portal is an explicitly modeled transition or navigational relation between Holons.

Candidate properties:

- Source Holon
- Destination Holon
- Relationship type
- Explanation
- Provenance
- Confidence or evidential status
- Authorization conditions
- Discovery or acceptance state

Not every graph edge must become a Portal.

Investigate whether Portals should be first-class persisted objects or projections over existing relations.

### 5.4 Projection

A Projection is a task-specific view of a Holon and its relevant context.

Candidate projection types:

- Overview
- Evidence
- Contradictions
- Dependencies
- Alternatives
- Opportunities
- Research gaps
- Decisions
- Discovery context

Each projection should disclose:

- Included knowledge identifiers
- Omitted-context policy
- Source references
- Epistemic status
- Version or snapshot
- Context limits
- Truncation or incompleteness

A summary must never silently substitute for primary evidence when an assertion requires direct source verification.

### 5.5 Focus Session

A Focus Session records how an agent or human navigated an investigation.

Candidate properties:

- Session ID
- Investigation question
- Active Holon
- Prior Holons
- Projection history
- Navigation events
- Evidence consulted
- Unresolved questions
- Context budget
- Start and end timestamps

Focus Sessions are operational history, not automatic proof of the resulting conclusions.

### 5.6 Discovery Candidate

A Discovery Candidate is a proposed relationship or insight not yet incorporated into accepted knowledge.

Candidate attributes:

- Candidate identifier
- Source knowledge references
- Target knowledge references
- Proposed relation
- Explanation
- Supporting evidence
- Contradicting evidence
- Alternative explanations
- Uncertainty
- Novelty assessment
- Validation requirements
- Proposed next experiment
- Review state

Do not conflate model confidence, evidence strength, validity, and novelty.

These are different dimensions.

---

## 6. EPISTEMIC INVARIANTS

The architecture must preserve the following invariants.

**Invariant 1: Stable identity**

Knowledge identities must survive ordinary reorganization unless explicitly superseded.

**Invariant 2: No silent promotion**

A proposed claim or relationship must not silently become accepted.

**Invariant 3: Traceability**

An accepted evidential assertion must retain inspectable supporting provenance or explicitly disclose that it is insufficiently supported.

**Invariant 4: Contradiction preservation**

Conflicting claims must be representable simultaneously.

Contradiction does not automatically imply that one claim should be deleted.

**Invariant 5: Human authority**

Consequential structural or epistemic acceptance must follow the established human gate.

**Invariant 6: Security boundaries**

Cross-Holonic traversal cannot bypass authorization or reveal inaccessible information.

**Invariant 7: Reversibility**

Consequential modifications must have an auditable history and an appropriate rollback or compensating operation.

**Invariant 8: Temporal integrity**

A new fact should not erase the history of earlier claims where that history remains relevant.

**Invariant 9: Structural integrity**

Recursive nesting must reject cycles in relationships designated as strict containment.

**Invariant 10: No manufactured discovery**

An unsupported inference cannot be presented as a validated discovery.

**Invariant 11: Explicit incompleteness**

Projections must indicate when potentially relevant context was omitted or retrieval failed.

**Invariant 12: No cross-room leakage**

Knowledge and metadata from restricted rooms must not enter another room's projections or discovery results without explicit authorization.

---

## 7. THEO OPERATING MODES

### Mode A: Focused Reasoning

Purpose:

Answer questions or investigate a defined problem using an explicit bounded context.

Proposed sequence:

1. Identify the investigation question.
2. Determine the focal Holon.
3. Select a projection appropriate to the question.
4. Retrieve and verify relevant evidence.
5. Inspect assumptions and contradictions.
6. Identify unresolved dependencies.
7. Produce a traceable response.
8. Preserve the Focus Session.

Expected output:

- Answer or current assessment
- Evidence
- Uncertainty
- Contradictions
- Missing information
- Potential next investigation

### Mode B: Discovery Reasoning

Purpose:

Investigate potential knowledge connections beyond current structural boundaries.

Proposed sequence:

1. Identify unresolved questions or opportunities.
2. Search neighboring and non-neighboring knowledge contexts.
3. Generate candidate relationships.
4. Identify possible alternative explanations.
5. Examine evidence on both sides.
6. Assess whether the relationship is already known.
7. Estimate novelty and uncertainty separately.
8. Propose a test or validation method.
9. Register the candidate without automatically accepting it.
10. Present it for review when appropriate.

Cross-domain discovery must not depend only on existing Portals.

Otherwise, the system risks discovering only connections it already knows how to traverse.

### Mode C: Structural Maintenance

Purpose:

Preserve the integrity and usefulness of the nested ICM.

Possible operations:

- Detect duplicate entities
- Identify misplaced knowledge
- Propose Holon splits
- Propose Holon merges
- Flag ambiguous membership
- Detect broken references
- Repair derived indexes
- Identify structural growth bottlenecks

Structural maintenance proposals must not silently change accepted meaning.

---

## 8. PROPOSED TOOL CONTRACTS

These are candidate capabilities, not claims about existing tools.

Inspect existing `brain_*` tools first and reuse or extend them where practical.

Suggested logical operations:

**focus_open**

Input: room ID, Holon ID, investigation objective, projection policy.

Output: Focus Session ID, resolved scope, authorized context summary.

**focus_project**

Input: Focus Session ID, projection type, constraints.

Output: evidence-linked, versioned context projection with explicit omissions.

**focus_navigate**

Input: Focus Session ID, destination Holon or Portal, purpose.

Output: authorized transition, new context, recorded navigation event.

**holon_inspect**

Input: Holon ID.

Output: structural metadata, memberships, available projections, known portals.

**discovery_search**

Input: investigation question, candidate scope, search policy, resource budget.

Output: candidate connections with ranked evidence and uncertainties.

**discovery_evaluate**

Input: candidate ID.

Output: supporting and opposing evidence, competing explanations, novelty assessment, falsification opportunities.

**knowledge_propose**

Input: typed knowledge or structural change, evidence references, rationale.

Output: immutable pending proposal.

**knowledge_review**

Input: proposal ID, reviewer identity, decision, rationale.

Output: audit-recorded decision and resulting authorized state transition.

**focus_trace**

Input: Focus Session ID.

Output: navigation and evidence-consumption history.

Define typed JSON schemas, permissions, idempotency, errors, pagination, and version requirements.

Do not assume tool names must exactly match this proposal.

---

## 9. TECHNICAL INVESTIGATION

Before selecting an implementation, answer:

### Data model

- What are the canonical ICM entities?
- How is nesting represented?
- Are parent-child relations unique?
- Can knowledge belong to multiple nested contexts?
- How is provenance stored?
- What validation states exist?
- Are contradictions first-class?
- Are references stable across migrations?
- Is history preserved?

### Persistence

- What is stored in SQLite?
- What is stored in Neo4j?
- What belongs to room-local stores?
- What information is derived versus authoritative?
- How are schema migrations managed?
- How are concurrent changes resolved?
- How are failures recovered?

### Theo integration

- Which reasoning capabilities exist?
- How are tools registered?
- How are research grants and budgets recorded?
- How does the established human gate work?
- Can Theo produce inspectable evidence traces?
- How does its context assembly work today?

### Research orchestration

- What parts of Genesis exist?
- Is research decomposition operational?
- Can research findings be written back as proposed knowledge?
- Are experiments and falsification criteria first-class concepts?
- How are failed investigations preserved?

### Security and access

- What is the authority model for DataRooms?
- How is authorization checked during graph traversal?
- Can metadata itself be sensitive?
- Can a Portal reveal the existence of a restricted room?
- How are prompt injection and untrusted source instructions handled?

Produce an evidence-based repository gap matrix before implementation planning.

---

## 10. IMPLEMENTATION ROADMAP

### Phase 0: Architecture audit

Deliverables:

- Repository architecture inventory
- Existing capability map
- Data model diagram
- Tool inventory
- Invariant coverage matrix
- Known failures and technical debt
- Architecture Decision Records for major open choices

Exit condition:

The proposed design has been mapped onto verified existing infrastructure.

### Phase 1: Holonic semantic model

Deliverables:

- Holon definition
- Boundary rules
- Containment and membership semantics
- Stable identifier strategy
- Recursive integrity tests
- Schema migration strategy

Exit condition:

Nested knowledge can be represented without cycles, broken references, or loss of meaning.

### Phase 2: Focus and projection

Deliverables:

- Focus Session lifecycle
- Projection engine
- Context budget mechanism
- Evidence and omission metadata
- Focus audit trail

Exit condition:

Theo can retrieve bounded context reproducibly and disclose the evidence and material omitted.

### Phase 3: Portals and navigation

Deliverables:

- Cross-Holonic relationship representation
- Authorized navigation
- Portal policies
- Navigation history
- Cross-room security tests

Exit condition:

Theo can move between contexts without losing provenance or crossing access boundaries improperly.

### Phase 4: Discovery engine

Deliverables:

- Cross-Holonic candidate generation
- Candidate evidence graph
- Alternative explanation analysis
- Novelty and uncertainty separation
- Candidate registry
- Validation experiment suggestions

Exit condition:

The system can propose previously unrepresented connections without treating them as accepted knowledge.

### Phase 5: Human validation

Deliverables:

- Review queue integration
- Approval and rejection states
- Decision provenance
- Versioned state transitions
- Reversal and rollback tests

Exit condition:

Consequential changes cannot bypass human validation.

### Phase 6: Theo research orchestration

Deliverables:

- Integration with existing Theo frameworks
- Integration with PWS workflows
- Investigation planning
- Reusable learning records
- Controlled orchestration across Focus and Discovery modes

Exit condition:

Theo can investigate a question, recognize missing knowledge, perform bounded exploration, and propose the next instrument needed to learn.

---

## 11. VALIDATION EXPERIMENTS

Establish baseline behavior before changing the architecture.

Evaluate against existing retrieval and reasoning approaches.

### Experiment A: Nested retrieval

Question:

Does Focus-based retrieval improve retrieval accuracy or efficiency across deeply nested knowledge?

Compare:

- Existing retrieval
- Hierarchical projection
- Hierarchical projection with navigation

Measure:

- Recall
- Precision
- Evidence completeness
- Latency
- Token cost
- Answer accuracy

### Experiment B: Structural preservation

Introduce new material into a deeply nested DataRoom.

Measure:

- Correct placement
- Preservation of existing references
- Detection of duplicates
- Structural corruption
- Successful incremental growth

### Experiment C: Contradictory evidence

Introduce incompatible claims with separate sources.

Expected behavior:

- Both claims remain inspectable
- Their relationship is visible
- The system does not automatically erase either
- Theo identifies uncertainty rather than inventing resolution

### Experiment D: Cross-domain discovery

Construct a research problem whose relevant evidence is distributed across otherwise weakly related Holons.

Compare:

- Local-only retrieval
- Existing graph traversal
- Proposed discovery workflow

Measure:

- Discovery recall
- False candidate rate
- Explanation quality
- Evidence traceability
- Cost per validated candidate

Use blind evaluation and negative controls to avoid rewarding speculative connections.

### Experiment E: Human gate

Generate a proposed relation.

Verify:

- It remains unaccepted before review
- Rejection does not mutate accepted knowledge
- Approval records a traceable decision
- The historical state remains recoverable

### Experiment F: Authorization

Attempt to reach restricted knowledge through indirect Portal traversal and discovery search.

Expected behavior:

- Unauthorized content remains inaccessible
- Metadata leakage is controlled
- Rejection is logged appropriately

### Experiment G: Growth and scale

Test increasingly deep and broad structures.

Include adversarial shapes:

- Deep nesting
- Wide branches
- Shared members
- Cyclic proposed references
- Large contradictory clusters
- Repeated ingestion
- Partially unavailable sources

Identify realistic resource and performance thresholds from the current system before setting success targets.

---

## 12. RISKS AND ARCHITECTURAL TRADE-OFFS

### Risk 1: Holon over-modeling

If every entity becomes a Holon, the architecture may become needlessly complex.

Mitigation: Define objective criteria for creating Holon boundaries.

### Risk 2: Projection loss

A projection may omit decisive evidence.

Mitigation: Expose source references, omissions, and escalation mechanisms.

### Risk 3: Discovery hallucination

Semantically similar concepts may be mistaken for meaningful causal or technical relationships.

Mitigation: Require evidence, alternatives, uncertainty, and experimental validation.

### Risk 4: Structural explosion

Recursive growth may produce uncontrollable numbers of nested structures.

Mitigation: Evaluate nesting thresholds, consolidation strategies, and structural maintenance.

### Risk 5: Graph consistency

SQLite and Neo4j may diverge if responsibilities are not explicit.

Mitigation: Determine authoritative stores, synchronization semantics, and recovery guarantees.

### Risk 6: Human review bottleneck

A growing number of proposals may overwhelm reviewers.

Mitigation: Deduplication, prioritization, reversible low-risk operations, and explicit review policies.

### Risk 7: Novelty inflation

A graph connection may be new to the DataRoom but already well established externally.

Mitigation: Separate local novelty, literature novelty, practical usefulness, and demonstrated technical novelty.

### Risk 8: Architectural duplication

The implementation may replicate existing Theo, Genesis, or ICM capabilities.

Mitigation: Audit before design and require a documented reuse-versus-build decision.

---

## 13. REQUIRED GSD OUTPUTS

Create the following planning artifacts, adapted to the repository's existing `/gsd` conventions.

**PROJECT.md**

- Problem statement
- Mission
- Intended users
- Expected outcomes
- Scope
- Non-goals
- Key assumptions

**RESEARCH.md**

- Annotated sources
- Confirmed versus speculative claims
- Architectural comparisons
- Prior art
- Remaining research questions

**ARCHITECTURE.md**

- Verified existing architecture
- Proposed target architecture
- Component interfaces
- Persistence decisions
- Authorization boundaries
- Migration strategy

**REQUIREMENTS.md**

- Functional requirements
- Nonfunctional requirements
- Epistemic invariants
- Security requirements
- Traceability requirements
- Testable acceptance criteria

**ROADMAP.md**

- Dependencies
- Sequenced milestones
- Implementation phases
- Risks
- Exit criteria

**DECISIONS.md**

- Architectural decisions
- Alternatives considered
- Reasoning
- Unresolved decisions

**VALIDATION.md**

- Baselines
- Experimental design
- Test datasets
- Evaluation metrics
- Failure criteria
- Benchmark results, once measured

**CONTEXT.md**

- Project terminology
- Historical architecture assumptions
- Relationships to PWS, Theo, Genesis, and OM-HMM
- Constraints that future agents must preserve

Do not mark any implementation or test as completed unless actually verified.

---

## 14. DEFINITION OF DONE

The feature is not complete merely because Holon objects, retrieval methods, or new MCP tools exist.

Completion requires evidence that m:os can:

1. Preserve and expand deeply nested knowledge.
2. Construct reliable task-specific reasoning contexts.
3. Navigate knowledge boundaries with explicit authorization.
4. Discover candidate relationships beyond the current context.
5. Preserve supporting and contradicting evidence.
6. Distinguish uncertain proposals from accepted knowledge.
7. Prevent unapproved consequential knowledge changes.
8. Reproduce and inspect the evidence path behind important conclusions.
9. Demonstrate measurable value against the existing implementation.
10. Continue accumulating validated knowledge across investigations.

**Final instruction to /gsd:**

Start with the architecture audit and a rigorous gap analysis. Identify the smallest implementation slice capable of testing the central hypothesis.

Avoid a complete architectural rewrite.

Prioritize structural integrity, provenance, reversible proposals, and reliable discovery over interface polish.

The objective is not to make the knowledge graph more elaborate.

**The objective is to make cumulative knowledge more capable of producing validated discoveries.**

_Transcription note: the pasted text used "->" style arrows and no em-dashes; the one unicode arrow in the progression line was written as "->" to keep the file within the repo's hyphen-only rule. Nothing else was changed._
