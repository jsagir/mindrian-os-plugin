# Archaeology: the complete-system loop (past phases, seeds, locked decisions)

Filed 2026-08-20 by the archaeology fork of the command-framework-map session. Read-only
sweep of .planning/, docs/, canon, and the rethinking-mindrianos room, answering: what
already exists, what was already decided, and what is genuinely net-new in the
"local graph + context window + remote Brain cooperate always" ask.

Companion brief (same session, sibling file): `2026-08-20-BRIEF-complete-system-loop.md`.

---

## (a) Relevant past phases

| Phase | Name | Shipped | Deferred / left open |
|---|---|---|---|
| 13 | opportunity-bank-funding-room | Early Opportunity Bank + funding room structure (3 plans) | Predates ICM section registry; no dilutive/non-dilutive split |
| 90 | brain-derivation-layer | BRAIN.md per-room derivation cache | The pattern_matches consumption seam it created is still the ONLY Brain content inside decide() |
| 91 / 91.6 | navigation-engine (+graph-wiring) | decide() engine | 91.6 graph wiring proposed as "cheap fix," never scaffolded (per SEED-008) |
| 100/101/104 | jtbd-inference, selector-library, per-command JTBD declarations | JTBD labels on commands | The jtbd_label/jtbd_summary data the Brain audit saw comes from here |
| 109 | sql-context-memory-navigation-spine | navigation.cjs SQL chokepoint | |
| 110 | brain-context-packet-contract | The typed Brain packet, 12 jobs incl select_methodology + suggest_next_move | Still "the only wire" per SEED-045 |
| 125 | f-selector-ranker | Ensemble ranker 0.40 brain_confidence + 0.30 recency + 0.30 problem_type_bind | Weights static; SEED-009 (learned weights) dormant. Phase 244 found the fired-reach path NEVER REACHES this ranker (disjoint path) |
| 137 | brain-mindrianos-sync-compat-harness | NOT EXECUTED. Only a CONTEXT.md exists | This is the named home for continuous Brain-to-local projection sync; entry-19 defers "continuous sync" to it by name |
| 141/142/143/143.x | retrieval spine, local intelligence wiring, insight sensors, dial TUI | The 8-sensor bank (now 18), dispatchSensors, F.7 dial | |
| 144 | navigation-engine-legacy-engine-flip | routing_source legacy-to-engine flip on fired reach | |
| 157 | brain-orchestration-graph-and-methodology-tiers | SEED-024 graduated: Brain holds the orchestration projection (commands, reaches, skills, frameworks) with methodology_tier pws / mindrian-operation; local cache data/brain-orchestration-projection.json (207 nodes) + generator + --check; canon amendment entry-19 (v1.8) | LIVE nav-engine consumption of the cache DEFERRED. Live Brain write of the projection DEFERRED (fast-follow never done). Continuous sync deferred to Phase 137 (never executed) |
| 158 | bounded-rejection-penalty | SEED-009 minimal slice | Full learned-ranker loop still dormant |
| 159 | dial-closer-consumer-wire | Dial consumption wiring | |
| 166 | gated-chain-executor | runChain: auto-run autonomous_safe prefix, halt at first material step | |
| 168 | part4-edge-vocabulary-reconciliation | Frozen edge vocabulary | Any new edge type (e.g. section affinity) is a canon amendment, not a per-phase invention |
| 172 | contextual-invocation-coverage | CIRS R1-R15, trigger tiers (signal > context > keyword) | trigger_tier decorative until 244 |
| 184 | reader-decide-projection-offer | decide() reads projection offer seam | |
| 191 | brain-orchestration-advisor | 3 plans executed on the advisor thread (SEED-045 charter) | The scoring-half consumption (decide() consuming the projection for ranked next-reach) still listed as SEED-045 open item 1 |
| 222 | reach-ranking-unification | ONE shared scored pick across the 3 disagreeing rankers + hand-rolled multiplicative-weights combiner | SEED-057 (synthesis as votable expert) deliberately deferred |
| 237 | reach-mechanism (v1.16.0) | Approve actually executes; ONE autonomy authority; session-scoped reach signals | |
| 238 | decision-gates (v1.16.0) | Gate ledger session-scoped, concurrency-safe | |
| 239 | brain-access-surface (v1.16.0) | Egress guard + PII sanitizer cover live Brain tool names; BRAIN_TOOL_MATCHER | 239-05 sibling: fail-closed belt in brain-client.cjs planned. Directly relevant to server-side composition (a server-internal Brain call bypasses the per-tool-name hook) |
| 240/240.1 | memory + context-layer drift | Layer 2 promotion, dead-letter drain, STATE schema stamp | |
| 244 | semantic-trigger-tier (v1.16.0) | SENS-16 FTS5 bm25 content-relevance sensor; tier-family fusion threaded into ranker; NAV budget named: 1200ms (navigation-engine.cjs:820) | Vector leg on trigger path EXCLUDED for latency, not capability. KEY finding: fired-reach path never reached f-selector-ranker before this |
| 245 | close-the-reach-brain-signal-loop (v1.16.0, 8/8 plans) | Dial fusion (dispatchSensors fire_skill + Brain pattern_matches into F.7); BRAIN.md re-derivation triggers (governing-thought change, BRAIN_STALE_AGE_DAYS, explicit ask); budget-respecting Brain-consult trigger policy (NOT blanket per-invocation); SENS_PRIORITY 18-sensor table; Part 8 guard scoping | This is the closest prior phase to the current ask; its trigger policy is the precedent for "when may the system consult Brain" |
| 246-252 | v2.0.0 "Build the Loop" (7 phases, 19 plans, closed 2026-08-13) | The loop SHIPPED: local trigger -> Brain query -> Larry join -> HITL ratify -> context update, honest refusal everywhere; graph census (181 frameworks, floor 4/28); Brain surface contract (CONTRACT-01..05); MCP-first room resolution; context-driven enrichment queue + alias-collapse EXECUTED live (41 self-loops deleted); honesty rail; cache hygiene (91-97 percent hit rates); guard sweep | Carried open: SWEEP-02, CACHE-03, AVAIL-03; 7 vector-index DROPs (Bolt-gated); ingest prop-drop bug; 429-as-unreachable bug |

## (b) Open requirements / roadmap overlap

Current milestone: v2.1.0 "Green the Floor," status PLANNING, zero phases cut yet, next
phase number 253. Its REQUIREMENTS.md (sourced from a 4-leg Fable research pass 2026-08-13)
is ENTIRELY about Brain graph enrichment integrity: RECON (attribute the untracked
enrichment wave, re-baseline the floor), TRUST (429 honesty, floor-probe voiding), FIX
(ingest prop drop, ALIAS_OF self-loop guard, normalizeName alias-awareness), CER (28
flagship frameworks to readiness 4/4), FLOOR (check-flagship-floor.cjs exit 0), TAIL
(demand-ranked long-tail worklist), SEED-A (UN-WIRED gate re-sourced from live :Framework
population), SEED-B (grading checks framework grounding readiness), CARRY (v2.0.0 leftovers).

Overlap verdict: workstreams 1 (mislabel check), 5 (dedup), and 6 (edge wiring) of the
current ask are LARGELY THE SAME WORK as v2.1.0's A/B/C/D families, already scoped. Live
graph state: 146 canonical frameworks, kickoff floor 8/28. The 2026-05-10 schema-entropy
debug numbers (100 frameworks, 119K CO_OCCURS on Neo4j) are PRE-cutover; the census +
admin sitting already remediated much of it on Memgraph (alias collapses executed and
verified 2026-08-11). The mislabeling check should VERIFY against the census, not redo it.

## (c) Relevant seeds

| Seed | Proposes | Status |
|---|---|---|
| SEED-008 | Intelligence layer runs compute-and-store, not compute-store-and-act; close the activation gap (routing_source legacy every turn) | dormant, partially shipped (117); named open member of SEED-045 |
| SEED-009 | Learned ranker weights from outcome edges | dormant, gated on 30 testers + 1000 outcome events; minimal slice shipped Phase 158 |
| SEED-024 | Brain as orchestration graph + framework tiers | SHIPPED (Phase 157) |
| SEED-042 | Always-on act/redteam toggle | dormant |
| SEED-043 | Brain Command Recommendation: Brain RECOMMENDS next command (ranked handles), decide() consumes, navigator confirms, runChain executes. 103 Command nodes + USES_FRAMEWORK + ADDRESSES_PROBLEM_TYPE (86 edges) + RELATED_TO (633 chains) wired 2026-07-01; command subgraph MIRRORED INTO room.db same day | dormant, substrate ~85 percent shipped; the named open build |
| SEED-045 | Brain Orchestration Advisor charter (umbrella: 043+008+031+coverage; memory half 040+044+009) | charter; open item 1 IS "wire decide() to consume the local projection cache" |
| SEED-049/050 | Eureka engine + eval (flagship pair) | shipped Phases 211-216 |
| SEED-053 | run_chain as first-class MCP tool with handoffs, halt at material gates | seed; Part-8-CLEAN on the local server (precedent FOR server-side composition on mindrian-os MCP) |
| SEED-056 | Larry behavior contract: wire shipped engines into Larry's own persona instructions (dark-capability class) | proposed; any new suggest-next behavior must also land in the persona contract or it will not fire |
| SEED-057 | Synthesis as votable expert in the 222 combiner | registered, deliberately deferred until combiner observed |
| SEED-074 | Local graph read layer lacks salience + query-time joins (room.db 0 tables measured in 2 active rooms 2026-07-25) | proposed, gated on density threshold |
| SEED-075 | Grading against ungrounded framework produces unreliable contradictions | proposed; v2.1.0 SEED-B is its scoped landing |
| SEED-076 | Room-as-GraphRAG conversational component | seed |

## (d) Locked decisions this work must NOT relitigate

1. Canon Part 11 R7 (constitutional): the orchestration projection is a derived LOCAL
   read-model; decide()/rank time makes NO live Brain call. SEED-045 restates it as
   non-negotiable ("the advisor reads a LOCAL DERIVED CACHE, NEVER a live Brain query at
   decide()/rank time"). Any live-call architecture must land as a canon amendment, or
   put the live call OUTSIDE decide()/rank (command-time or server-tool-time is a
   different seam and needs an explicit ruling, not an assumption).
2. Recommend-never-trigger (SEED-043 constitutional reframe): the Brain proposes ranked
   handles; the navigator confirms at a Shape F gate; runChain executes with safe-halt.
   The Brain never executes and never sees user content. Enums/slugs cross, prose never.
3. One governed reach path (connector spine, Part 11 R4): no second selection brain.
   Brain input enters decide() as ONE candidate input, never a parallel decider.
4. Part 8 entry-19 (canon v1.8, Phase 157): the Brain MAY hold the orchestration
   projection; methodology_tier (pws / mindrian-operation) is the boundary-keeper; the
   LOCAL cache is sanctioned; live write + continuous sync deferred (137), live
   consumption deferred. Extending consumption is FINISHING a sanctioned plan, not new
   constitutional ground; opening a new wire is an amendment.
5. Degrade-never-block + honest refusal (Decisions 1/5/8, amended and ratified v2.0.0):
   Brain unreachable means honest low-confidence local ranking over the room.db-mirrored
   command subgraph, refusal surfaced in-turn, enrichment auto-queued. Never silent.
6. Brain surface contract (Phase 247): the loop-serving read tool set is THE cross-repo
   contract; brain_ask_anything retired; text2cypher withheld; CONTRACT-05 bounded read
   tier is the sanctioned raw-read path. brain_query is NOT registered over HTTPS;
   BRAIN_HTTP_ADMIN was never set (2026-08-10 service audit). Graph mutations go through
   the brain repo's ingest pipeline or admin sittings, not plugin-side ad-hoc writes.
7. Frozen scalars and vocabularies: Part 3 verbs (10, closed), Shape F sub-shapes (F.0-F.9,
   closed), 0.70/0.15 dial gate frozen, MAX_K=3, DIAL_REACH_K=6, Part 4 edge vocabulary
   frozen (additive only via amendment), 1200ms NAV budget (244).
8. Admin-window discipline + statement-level guards (v2.1.0 cross-cutting rules, born from
   the 2-day-open lesson and the 2026-02-05 relabel disaster): bulk graph mutations happen
   only through human-reviewed triage lists, batched deploys, fixtures authored before
   payloads.
9. v2.0.0 closed 20/23 with SWEEP-02 / CACHE-03 / AVAIL-03 carried by explicit navigator
   ruling; do not reopen the closed 20.

## (e) The Part 3 mapping verdict

Canon Part 3 (Tri-Context Decision Gate: LOCAL + BRAIN + SIGNAL -> APPROVE/REJECT/DEFER
through Shape F) IS the constitutional definition of the three-way loop Jonathan is
describing. v2.0.0 "Build the Loop" was its implementation milestone and SHIPPED the
loop's spine (trigger -> Brain -> join -> HITL -> update) with honesty rails.

The current ask is therefore NOT a new loop. It is three things, precisely:
1. FINISHING the deferred consumption half of Phase 157 / SEED-045 / SEED-043: decide()
   and suggest-next/act actually consuming the orchestration projection (local cache,
   R7-compliant) so routing is Brain-derived instead of recipe-maps-only. Already
   planned, never built; the substrate is ~85 percent shipped.
2. CONTINUING v2.1.0 "Green the Floor" (already in planning): graph integrity, dedup,
   edge wiring, readiness. The command-framework map from this session is fresh input
   INTO that milestone's C/D families, extending the 28-flagship scope with the 25
   missing USES_FRAMEWORK edges and the entity dedups.
3. NET-NEW: the section-affinity ranking dimension (DataRoomSection nodes in the Brain
   projection + a Framework-to-section affinity edge + a local ranking boost) and the
   SIGNAL leg of Part 3 remains the least-built of the three contexts. Also net-new:
   Jonathan's server-side composition question (mindrian-os MCP tools calling
   brain-client internally), which SEED-053 partially precedents on the local server.

## (f) rethinking-mindrianos research trails (relevant subset)

- 2026-07-31-dial-rethink-decoupled-from-sensor-bank: the dial scored only by
  cortex-reach-adapter graph-node recency; the finding that seeded Phase 245.
- 2026-07-31-phase-245-spec-reach-brain-signal-loop + part8-contentless-block: 245's spec
  trail + the Part 8 contentless-block design.
- 2026-08-11-build-the-loop-learnings (+ CONTINUATION-HANDOFF): v2.0.0 execution learnings;
  open operator ledger (Supabase env vars, mindrian-brain suspension, foreign-host verify).
- 2026-08-11-alias-collapse-live-audit + runbook + admin-sitting-execution: the live graph
  surgery execution records (the model for any new dedup batch).
- 2026-08-05/06 tnufa-graphrag-grant-grader + bono-reviewer-panel + room-graph-replan:
  grant-grading work directly relevant to the Funding section (dilutive/non-dilutive) ask.
- 2026-07-30 context-layer-drift-detection, phase-240-memory, phase-244-semantic-trigger-tier:
  the memory/context-layer research behind 240/244.
- 2026-07-25 graph-query-time-collapse-sag-paper (SEED-074 source).

## (g) CONSOLIDATION

REUSE / EXTEND (exists, do not rebuild):
- data/brain-orchestration-projection.json + generator + --check (Phase 157): the
  R7-compliant vehicle for Brain-derived routing AND the natural carrier for section
  affinity. Regenerate with the map's corrections rather than inventing a new cache.
- The Brain Command graph (103 Command nodes, USES_FRAMEWORK, ADDRESSES_PROBLEM_TYPE,
  RELATED_TO) + its room.db mirror (2026-07-01): suggest-next's data ALREADY EXISTS in
  graph form; the session's 25-edge gap list is a CORRECTION PASS on this layer.
- chain-recommender.cjs, composeWorkflow, runChain, pipeline-state.cjs, the 222 unified
  ranker + combiner, the 245 dial fusion + Brain-consult trigger policy, the 249
  enrichment queue + ENRICH-02 payload template, the 251 cache hygiene rail.
- THE CANONICAL SECTIONS ALREADY EXIST IN CODE: lib/core/section-registry.cjs
  CORE_SECTIONS is exactly 8 (problem-definition, market-analysis, solution-design,
  business-model, competitive-analysis, team-execution, legal-ip, financial-model),
  plus EXTENDED_SECTION_META (opportunity-bank, funding, personas) and STRUCTURAL_DIRS
  (meetings, team). room-skeleton-scaffold.cjs scaffolds "the canonical 8-section ICM
  structure"; room-birth.cjs writes one section node per canonical section into room.db
  (id convention section:<slug>). Jonathan's examples map 1:1 onto EXISTING slugs:
  Eureka -> opportunity-bank; JTBD/Bono -> meetings; Leadership -> team-execution/team;
  IP-Legal -> legal-ip; Funding -> funding (subfolders dilutive/non-dilutive are net-new
  children, not a new section). The Brain-side DataRoomSection label is empty, but the
  taxonomy to project into it is DEFINED, in shipped code. Define nothing from scratch.

ALREADY DECIDED (honor, cite, move on): everything in section (d). The live-vs-cache
question is 80 percent pre-answered: R7 forbids live at decide()/rank; SEED-043/045
define the sanctioned shape (local projection consumption + offline-derived
brain_confidence); the open architectural question is ONLY whether an EXPLICIT
suggest-next/act invocation (command-time, not per-turn) or a server-side MCP tool
composition (SEED-053's Part-8-clean local-server precedent) may make a live call,
and that needs a navigator ruling plus possibly a narrow amendment, not a rebuild.

GENUINELY NET-NEW (the actual build):
1. Section-affinity dimension: populate DataRoomSection in the projection from
   section-registry.cjs; a Framework/Command-to-section affinity edge (edge vocabulary
   amendment, Part 4/entry-19); a section-affinity term in the 222 combiner/125 ranker;
   local mapping of user-custom sections onto canonical slugs (ALIAS-style, local-only,
   Part 8: only canonical slugs ever cross the wire).
2. The decide()/suggest-next consumption wiring (SEED-045 open item 1, SEED-043 build):
   planned, substrate shipped, never wired.
3. Funding section children (dilutive/non-dilutive) + grant-grading routing into them
   (grounded by the 2026-08-05/06 grant-grader research).
4. recipe-maps.cjs reconciliation: generate or verify it against the projection so the
   two taxonomies cannot drift (a --check gate in the 157 generator style).
5. The server-side composition ruling + (if approved) the narrow implementation with the
   239-05 fail-closed belt in brain-client.cjs.
6. Persona-contract wiring (SEED-056 class): whatever ships must be named in Larry's own
   behavior contract or it stays dark capability.

SEQUENCING IMPLICATION (for the sibling brief): v2.1.0 "Green the Floor" is already the
open milestone in planning and owns graph integrity; the consumption wiring + section
affinity is EITHER v2.1.0 phase-family additions or the next milestone. Do not fork a
competing milestone; extend the one in planning or sequence behind it.
