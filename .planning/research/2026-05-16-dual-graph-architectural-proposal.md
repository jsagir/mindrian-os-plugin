---
type: architectural-proposal
status: pending-review (ultrareview cloud audit requested 2026-05-16)
created: 2026-05-16
author: room session 2026-05-16 with Jonathan Sagir + Larry
target_milestone: v1.13.1 (cross-phase amendment proposal) OR v1.14.0 (deferral candidate)
affected_phases:
  - Phase 127.1 brain-graphrag-collapse-pinecone-neo4j-hnsw (just inserted 2026-05-16)
  - Phase 128 substrate-contract-adr (scoped, Wave 4 Stream E, beta.3)
  - Phase 129 spine-repair-memory-event (scoped, Wave 4 Stream F, beta.3)
  - Phase 130 lens-engine-skeleton + cognitive-family-migration (scoped, Wave 6.5, beta.5)
  - Phase 131 research-as-graph-aware-workflow-step (scoped, Wave 6.7, beta.5c)
  - Phase 121.5 terminal-coherence-capstone (v1.13.0 final; hold-flag active)
canon_parts_at_risk:
  - Part 3 (Tri-Context Decision Gate)
  - Part 4 (Every Choice Is Graph Data)
  - Part 7 (Reuse-Before-Build)
  - Part 8 (Graph Boundary -- LOCAL-to-BRAIN: NO)
  - Part 9 (Memory Locality and Interpretation)
review_request: cloud ultrareview, scope = audit this proposal text against the canon, the v1.13.1 execution plan, and the cited shipped substrate; produce findings on whether the proposal should land as cross-phase amendments, get deferred to v1.14.0, or get rejected
hold_flag_dependency: 121.5-CONTEXT.md "HOLD-FLAG (lands 2026-05-16; lifts when ultrareview verdict returns)" -- this doc IS the artifact the hold-flag was waiting on
---

# Dual-Graph Architectural Proposal -- Review Document

## What this doc is

A self-contained proposal for cloud-reviewer audit. The cloud reviewer does NOT have access to the conversation that generated this work; this doc reconstructs the full argument so the reviewer can engage with the architectural shape on its own terms.

The proposal originated 2026-05-16 when an outside source described a DGEKT-inspired dual-graph reading layer (association graph + transition graph + ensemble scoring). Jonathan + Larry audited the proposal against the shipped MindrianOS substrate (Phase 108/109/110/122/125) and against the v1.13.1 execution plan. This document captures the result of that audit and frames the resolution choice as APPROVE / REJECT / DEFER (per Canon Part 3 Decision Gate vocabulary).

## Section 1 -- The proposal as received

The original proposal (from an external source via Jonathan, paraphrased here for review fidelity):

> "Adapt DGEKT-style ideas to MindrianOS by separating two graph views over the same evolving activity stream: an **association graph** (entities, capabilities, tools, files, users, projects, policies, memories) and a **transition graph** (task flow, agent handoffs, tool-call sequences, failure-to-retry chains, plan evolution over time). Combine them for better decisions via ensemble scoring. The ensemble would score next actions from multiple graph lenses:
>
> - structural relevance from association graph,
> - temporal likelihood from transition graph,
> - semantic relevance from embeddings/vector search,
> - policy constraints from rules/guardrails.
>
> A simple planner score: `Score(action) = alpha * S_assoc + beta * S_trans + gamma * S_semantic + delta * S_policy`. No need for a heavy GNN first; start with heuristic weights and logged outcomes, then learn weights later from successful runs. Suggested implementation path: local SQLite writable graph with separate `assoc_edges` and `transition_edges` tables; planner that scores next actions using both graphs plus remote Neo4j enrichment; learned ranking over successful runs as a phase 3 upgrade."

Source: external proposal pasted into the 2026-05-16 conversation. Cites: github.com/Yumo216/DGEKT, arxiv references.

## Section 2 -- The 70% audit: what MindrianOS already has

A focused codebase audit (run via Explore agent on 2026-05-16) confirmed that the majority of the proposal restates already-shipped MindrianOS architecture. Findings with file:line evidence:

### 2.1 Local SQLite writable graph (proposal item: "local SQLite writable graph")

Already shipped. Phase 109 sql-context-memory-navigation-spine landed `lib/core/navigation.cjs` as a 13-function chokepoint over `room.db`. Per Canon Part 9 ("SQL remembers and navigates"), the local spine is the authoritative machine-readable memory layer. Evidence: `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md`; `tests/test-navigation-acceptance.cjs` asserts zero non-SQLite filesystem reads during the navigation flow.

### 2.2 Remote Neo4j read-only (proposal item: "remote Neo4j graph; ontology, historical project graph, domain structure")

Already shipped. Brain MCP architecture per Canon Part 8: `LOCAL data -> BRAIN: NO; BRAIN methodology -> LOCAL: YES`. The remote Brain (21K methodology nodes + 65K relationships) is read-only at the LOCAL-to-BRAIN boundary; only generic framework handles + phase identifiers cross. Evidence: Phase 110 brain-context-packet-contract (`.planning/phases/110-brain-context-packet-contract/110-CONTEXT.md`); `mcp-server-brain/` directory; Canon Part 8 section.

### 2.3 Association-graph view (proposal item: "Local association graph view... who/what is related to what")

Already shipped. Typed cascade edges form the association layer: INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES (Phase 84 + 87), plus REJECTED / DEFERRED (Phase 125 D7), plus the `edge_added` / `edge_removed` memory_event types (Phase 109). Evidence: `lib/core/navigation/memory-events.cjs` lines 10-112 (37 event types); Canon Part 4 ("Every Choice Is Graph Data").

### 2.4 Ensemble scoring (proposal item: "alpha * S_assoc + beta * S_trans + gamma * S_semantic + delta * S_policy")

Partially shipped. Phase 125 F-selector ranker applies a documented ensemble formula at `lib/workflow/f-selector-ranker.cjs` lines 47-52: `0.40 * brain_confidence + 0.30 * recency_decay * investment_level + 0.30 * problem_type_bind * investment_level`. The structure is ensemble; the contents differ from the proposal's four signals. Evidence: `.planning/phases/125-f-selector-ranker/125-CONTEXT.md` Pass-2 D-1..D-11.

### 2.5 Schema (`nodes` / `edges`) (proposal item: "core tables: nodes, assoc_edges, transition_edges")

Already shipped. Phase 108 graph-memory-schema-reconciliation froze the taxonomy at `.planning/phases/108-graph-memory-schema-reconciliation/RECONCILIATION.md` + `TRUTH-STATES.md` + `aliases.yml`. The shipped schema is richer than the proposal's three-table sketch: typed nodes, typed edges, provenance, validity status, memory event log, truth-state transitions.

### 2.6 Vector substrate unification

Just-in-flight. Phase 127.1 (inserted 2026-05-16) collapses Pinecone -> Neo4j HNSW server-side, unifying the methodology vector substrate. After 127.1 ships, the "semantic relevance" signal class in the proposal's ensemble lives on one engine.

**Audit verdict on Section 2:** roughly 70% of the proposal restates shipped substrate. Implementing the proposal as stated would duplicate five surfaces (the SQLite spine, the Brain boundary, the cascade-edge association layer, the F-selector ensemble, the schema). Reuse-Before-Build (Canon Part 7) blocks the duplication.

## Section 3 -- The 30% that is genuinely new

Three audit findings name what is NOT yet shipped, where the proposal correctly identifies gaps:

### 3.1 Transition aggregates (missing)

`memory_event` is a flat append-only audit log today. The audit found zero `transition_edges(from_event, to_event, count, success_rate, latency_ms)` aggregate table. No "given event X, what events most commonly follow" query pattern exists in either the local Cypher patterns or the 14 brain-query patterns. The system records "X happened then Y happened" but never computes "X is followed by Y 70% of the time, and when it is, it succeeds 85% of the time."

Evidence: `lib/core/navigation/memory-events.cjs` lines 118-141 (logEvent), lines 143-150 (findRecentChanges) -- append-only log + linear query, no aggregation.

### 3.2 Learned weights (missing)

The F-selector ranker's `0.40 / 0.30 / 0.30` weights are hardcoded. `investment_level` (at `lib/workflow/f-selector-ranker.cjs` lines 86-97) is adaptive -- it counts `framework_invoked` memory_event rows per framework and grows with use -- but the ensemble *weights themselves* never adapt. No feedback loop reads outcome edges (REJECTED / DEFERRED from Phase 125 D7, or accepted edges from F.0) to nudge weights up or down.

Evidence: `lib/workflow/f-selector-ranker.cjs` line 47-52 (the formula); the absence of any `f_selector_decision`-consuming weight-update function.

### 3.3 Local fallback predictor (missing)

The Brain's `chain-recommender` at `lib/brain/chain-recommender.cjs` lines 6-36 walks `FEEDS_INTO` over the Brain's methodology graph. When the seed framework cannot be resolved, it degrades to `[seed]` (just the seed). There is no local-only predictor that walks the room's own history to suggest "given the trajectory of THIS room, next move is likely X". When the Brain is unreachable (Tier LOCAL per Phase 127), the predictive surface goes dark.

Evidence: `lib/brain/chain-recommender.cjs` lines 75-83 Cypher template requires Brain; no sibling `local-chain-recommender.cjs` exists.

## Section 4 -- Cross-phase mapping in v1.13.1

The v1.13.1 execution plan (`.planning/v1.13.1-EXECUTION-PLAN.md`) contains five phases that are arguably already building toward this architecture, even if they do not name it:

| Phase | Wave | Beta | Existing scope | How the dual-graph idea maps |
|---|---|---|---|---|
| **127.1** | 4 | beta.2 | Pinecone -> Neo4j HNSW vector substrate collapse (server-side) | Unifies the vector substrate; precondition for the "semantic relevance" ensemble signal living on one engine |
| **128** | 4 Stream E | beta.3 | Substrate Contract ADR -- navigation.cjs as the only door (CI guards) | The chokepoint contract every future lens class must route through; would naturally host a lens-class registry |
| **129** | 4 Stream F | beta.3 | Spine repair -- 6 silent scripts route through navigation.cjs + emit memory_event on every transition | Populates the event-to-event stream the transition graph would aggregate over; without 129, transition aggregates have nothing to aggregate |
| **130** | 6.5 | beta.5 | Lens-engine skeleton + cognitive-family migration | The lens-engine skeleton is the natural home for ASSOCIATION_LENS + TRANSITION_LENS as first-class lens classes, alongside the cognitive family Phase 130 is already migrating |
| **131** | 6.7 | beta.5c | Research-as-graph-aware-workflow-step pilot via /mos:research | "Graph-native" could mean dual-lens reading (association edges + transition aggregates ensembled); the pilot proves the pattern |

**The architectural reading:** v1.13.1 is *already* the release where MindrianOS gets a coherent dual-graph reading layer over a unified vector substrate, even without naming the architecture explicitly. The DGEKT-inspired proposal describes the architecture from outside; the question is whether to name it from inside.

## Section 5 -- Canon implications

### 5.1 Canon Part 7 (Reuse-Before-Build)

The 70% audit is exactly the Reuse-Before-Build test. Implementing the proposal as stated would duplicate substrate. The reframe -- "all dual-graph extensions ride the existing SQL spine via the navigation.cjs chokepoint" -- preserves Part 7 because every line of the new work extends shipped surface rather than running parallel.

Critical test: each proposed change must answer "which of the shipped 25 methodology commands / 14 brain-query patterns / 9 cascade-edge types / 37 memory_event types does this replace or extend, and why is repointing insufficient?"

### 5.2 Canon Part 8 (Graph Boundary -- LOCAL-to-BRAIN: NO)

The dual-graph proposal must NOT cause user-specific bytes to reach the Brain. Specifically:
- Transition aggregates are computed from local memory_event data; the aggregates themselves are user-specific. They stay in room.db. They do not leave.
- Learned weights are tuned from a specific room's outcome history. They are user-specific. They stay in room.db.
- Cross-user learning ("what worked for OTHER rooms") is explicitly forbidden by Canon Part 8: *"Cross-user intelligence, if ever built, is a separate product with a separate installer and a separate legal review."*

Risk assessment: if any phase amendment routes transition aggregates or learned weights through a Brain query payload, that is a canonical breach.

### 5.3 Canon Part 9 (Memory Locality and Interpretation)

Canon Part 9 names five roles: Files preserve meaning; SQL remembers and navigates; Brain reasons over structured packets; Larry explains and acts; the human confirms truth. The dual-graph proposal is squarely in the "SQL remembers" role -- specifically, it asks SQL to remember not just events, but the *trajectory* of events.

This is a load-bearing affirmation of Part 9, not an architectural break. Part 9 already says SQL is the local mind; the proposal makes the local mind remember its own movement.

Critical guardrail: Brain still receives only typed packets (Phase 110), never raw memory. Learned weights and transition aggregates inform Larry's behavior LOCALLY; they do not enrich Brain Context Packets.

## Section 6 -- The three resolution paths

### Path 6.A -- APPROVE (cross-phase amendments to v1.13.1)

Add one-paragraph amendments to the CONTEXT.md of Phases 127.1, 128, 129, 130, 131 that explicitly name the dual-graph architectural intent:

- **127.1 amendment:** "Vector substrate unification is a precondition for dual-lens ensemble scoring; F-selector ranker's future ensemble (association + transition + semantic + policy) reads from one engine after this phase ships."
- **128 amendment:** "Substrate contract reserves a lens-class registry surface. Future lens classes (ASSOCIATION_LENS, TRANSITION_LENS) plug in through the navigation.cjs chokepoint."
- **129 amendment:** "memory_event emission on every transition is the data plane the TRANSITION_LENS reads in Phase 130; this phase's payload is load-bearing for dual-lens ensemble scoring downstream."
- **130 amendment:** Expand lens-engine skeleton scope to name ASSOCIATION_LENS and TRANSITION_LENS as first-class lens classes alongside the cognitive family Phase 130 implements.
- **131 amendment:** Define "graph-native" as dual-lens reading -- source-lens + association-lens + transition-lens, ensemble-scored. Phase 131 becomes the canonical pilot consumer.
- **121.5 hold-flag retraction:** verdict logged, hold-flag converts to a verdict record. F-selector ranker contract gets a `transition_lens_contribution` slot reserved (no implementation; signal to keep the surface extensible).

Plant-seed for v1.14.0: learned-weights feedback loop. This piece needs accumulated outcome data from v1.13.1 tester usage to train against; cannot ship before the data exists.

**Cost:** ~5 hours of CONTEXT.md editing + Canon-Phase-Map updates. No new code; no scope expansion past locked beta targets; additive vocabulary only.

**Risk:** locking lens-class registry vocabulary now constrains future flexibility. If TRANSITION_LENS turns out to be the wrong abstraction, the cost of renaming is moderate (CONTEXT.md edits, no shipped code touches).

### Path 6.B -- REJECT (the proposal does not earn the architectural acknowledgment)

Two ways this verdict could be earned:

1. The 30% gap is real but the dual-graph framing is the wrong way to fill it. (Example: transition aggregates could ship as a single navigation.cjs helper without lens-class taxonomy. Learned weights could ship as a feedback hook without lens-engine vocabulary.)
2. The Canon Part 7 cost of adding two new lens classes outweighs the architectural clarity gain. The shipped substrate already does most of what's needed; the rest can be patched without naming an architecture.

Rejection is data per Canon Part 4. The reject reason becomes a graph node that teaches the next cross-relationship scan to not surface a dual-graph-shaped proposal again unless evidence accumulates.

**Cost:** 30 minutes to write the autopsy doc (`docs/autopsies/2026-05-16-dual-graph-proposal-rejected.md`) capturing what we considered and why we declined. Retract the 121.5 hold-flag. Phase 127.1 stands as already inserted; its own merits are independent of this proposal.

**Risk:** if the dual-graph framing IS the right abstraction and we reject it, Phase 130 ships a lens-engine skeleton that does not admit the architectural shape Phase 131 is implicitly building toward. Future v1.14.0 work has to retrofit.

### Path 6.C -- DEFER (plant-seed for v1.14.0)

The proposal is too rich and too unverified to amend five locked v1.13.1 phases against. Park it as a v1.14.0 plant-seed with explicit trigger conditions:

- Trigger: v1.13.1 final ships AND Phase 127.1 is in production for >= 2 weeks AND transition-graph readiness is demonstrated (memory_event emission population from Phase 129 has accumulated >= 30 days of data) AND F-selector ranker has logged >= 100 F.0 / F.1 / F.2 outcome edges per Phase 125 D7 surface.
- Scope: all three of the 30% gaps (transition aggregates, learned weights, local fallback predictor), staged as separate plans inside one v1.14.0 phase.
- Constraint: Canon Part 8 fence stays intact -- learning is room-local; no cross-user aggregation.

**Cost:** 30 minutes to write the plant-seed. Retract the 121.5 hold-flag. Phases 130 and 131 ship without the dual-graph naming; their CONTEXT.md uses "current" language (per the hold-flag's discipline) to leave the surface extensible.

**Risk:** v1.13.1 ships the substrate but never names the architecture. v1.14.0 has to fight to rename when the time comes. Mild Phase-7 violation (we built without acknowledging what we were building).

## Section 7 -- Open design questions for the reviewer to weigh

These are the questions the cloud reviewer should engage with explicitly:

1. **Is "association lens vs transition lens" actually the right abstraction**, or is the DGEKT mapping a coincidence of vocabulary masking a different real shape? The proposal comes from an education-specific knowledge-tracing paper; is the analogy load-bearing for MindrianOS or aesthetic?

2. **Does naming TRANSITION_LENS in Phase 130's skeleton create a vocabulary lock-in cost** that exceeds the architectural-clarity benefit? Phase 130's current scope is the cognitive-lens family migration; adding two more lens classes (without implementing them in the same phase) reserves vocabulary against future implementations.

3. **Does Canon Part 8 hold under this proposal?** Specifically: does any phase amendment introduce a code path where transition aggregates or learned weights could reach the Brain via a packet field, even by accident? The reviewer should sweep for forbidden surfaces.

4. **Is the v1.13.1 execution plan's wave dependency contract violated by the amendments?** Per `feedback_v1131_execution_plan_is_contract.md`, the plan wins. The amendments must not expand any phase past its locked beta target nor reorder waves.

5. **Should Phase 121.5 actually be a touch point** (terminal-coherence-capstone in v1.13.0), or is it sufficient that the hold-flag protected it from foreclosing the F-selector contract surface? The hold-flag's discipline ("use 'current' not 'final'") may be enough; the amendments may not need to touch 121.5 directly.

6. **What is the cost of rejection-with-no-action?** If we REJECT, Phase 130 ships without dual-lens vocabulary AND Phase 131 ships without "graph-native = dual-lens" language. Do those phases as currently scoped accidentally build the architecture under different names anyway? If yes, rejection is mostly free. If no, rejection has real downstream cost.

## Section 8 -- Authority + provenance

- Source proposal: external (cited as DGEKT-inspired), pasted into the 2026-05-16 conversation.
- Codebase audit: Explore agent run 2026-05-16 with three specific questions on transition aggregates / learned weights / local fallback predictor. Results filed inline in Section 2 and 3.
- Execution plan reading: `.planning/v1.13.1-EXECUTION-PLAN.md` lines 11-585, particularly the Synthesis-Plan Absorption block (2026-05-16) that named Phases 128/129/130/131.
- Canon: `docs/MINDRIAN-CANON.md` v1.4 (Parts 1, 3, 4, 7, 8, 9).
- Canon-Phase Map: `docs/CANON-PHASE-MAP.md` (which phases implement which canon parts).
- Hold-flag: `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` top section (the artifact this review unblocks).
- Memory rules in play: `feedback_v1131_execution_plan_is_contract.md`, `feedback_reverse_salient_agent_graph_native.md`, `feedback_121_5_statusline_co_design.md`, `project_brain_mcp_three_track_transition.md`.

## Section 9 -- What the reviewer is asked to produce

A verdict in one of three forms:

- **APPROVE** with confidence rating and any constraints the amendments must honor. List specific risks the reviewer wants surfaced in each amended CONTEXT.md.
- **REJECT** with the reason-as-graph-data captured. The reason should name which of the 6 open questions above tips the call.
- **DEFER** with the trigger conditions for v1.14.0 reconsideration. The reviewer may add or modify the trigger conditions proposed in Path 6.C.

The reviewer should treat this proposal as architectural, not tactical. Tactical implementation details (HNSW parameters, exact weight-update formulas, specific Cypher patterns) are out of scope for this review; those are plan-phase work IF the verdict is APPROVE.

---

## Section 10 -- Verdict outcome (appended 2026-05-16 post-review)

Three independent architectural reviewers ran and converged. Deliverables:

- `.planning/research/2026-05-16-dual-graph-review-A-canon-compliance.md` -- Verdict: **CANON-COMPLIANT-WITH-CONSTRAINTS** (7 binding constraints; Part 8 fence must be enforced at the schema layer, not policy layer).
- `.planning/research/2026-05-16-dual-graph-review-B-execution-plan-contract.md` -- Verdict: **PLAN-COMPLIANT-WITH-CONSTRAINTS** (127.1 ACCEPT / 128 ACCEPT-WITH-EDITS / 129 ACCEPT / 130 ACCEPT-WITH-EDITS / 131 REJECT-AS-WRITTEN; 8 constraints).
- `.planning/research/2026-05-16-dual-graph-review-C-adversarial.md` -- Verdict: **PROPOSAL-IS-OVERSPECIFIED** (DGEKT vocabulary doesn't transfer; lens-class taxonomy flattens semantic structure; the hold-flag manufactured the urgency).

### Synthesized verdict

A fourth path the original proposal did not name, that emerged from the three reviews converging:

**REJECT the architectural framing. APPROVE two minimal additive primitives in v1.13.1. DEFER the rest to v1.14.0. RETRACT the 121.5 hold-flag.**

Confirmed by Jonathan via tri-context Decision Gate on 2026-05-16.

### Decision cascade (executed 2026-05-16)

| Sub-decision | Outcome | Where it landed |
|---|---|---|
| `FOLLOWS_FROM` cascade edge type as 8th additive type in the cascade vocabulary | **APPROVED** | Phase 129 CONTEXT.md "Additive scope expansion" section + acceptance criterion |
| `bin/local-chain-recommender.cjs` as plain Tier-LOCAL helper | **APPROVED** | Phase 127 CONTEXT.md "Additive scope expansion" section |
| Cross-phase lens-class amendments (127.1 / 128 / 129 / 130 / 131) with ASSOCIATION_LENS / TRANSITION_LENS naming | **REJECTED** | No vocabulary changes to those phases. The DGEKT-inspired framing does not transfer. |
| Phase 131 "graph-native = tri-lens ensemble" redefinition | **REJECTED** | Phase 131's "graph-native" stays defined by Phase 130's actual v1.13.1 deliverables (cognitive lens only). |
| Learned ranker weights / feedback loop | **DEFERRED** | Plant-seed filed at `.planning/seeds/SEED-009-learned-ranker-weights-from-outcome-edges.md`. Trigger: cohort >= 30 testers AND outcome edge count >= 1000. |
| 121.5 hold-flag | **RETRACTED** | Verdict logged in place at `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` top section + DISCUSSION-LOG.md banner. Parallel session unblocks. |
| Audit trail per Canon Part 4 | **PENDING** | Will land as `architectural_proposal_decided` memory_event when the v1.13.1 additive primitives ship (Phase 127 local-chain-recommender, Phase 129 FOLLOWS_FROM). Until then this Section 10 entry IS the audit trail. |

### Rejection reason captured (Canon Part 4)

The DGEKT-inspired framing was rejected because:
1. **The mapping is vocabulary, not architecture.** DGEKT is a supervised-learning model for student knowledge tracing with binary correctness signal and exercise-concept hypergraph. MindrianOS has no analog regime (no exercises, no binary correctness, no mastery curve). The proposal borrowed words without the source signal.
2. **The "association lens" abstraction flattens semantic structure.** The shipped 7 cascade edge types (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES / REJECTED / DEFERRED) encode distinct cognitive operations. Calling them all "association" is a flattening error.
3. **Learned weights on the current 4-tester cohort would overfit** to Jonathan + three friends as universal truth. Cohort needs >= 30 before learning is honest.
4. **The hold-flag manufactured the urgency.** The canonical workflow's "current vs final" language discipline (per Canon Part 7 consolidation phases) already protects against foreclosure of the at-risk surfaces. Retracting the hold-flag dissolves the forcing function without losing the protection.
5. **The three real gaps fit as three small helpers (~180 lines total) without lens-class taxonomy** -- and two of the three are now APPROVED as additive primitives, while the third (learned weights) is DEFERRED to v1.14.0 with explicit cohort-readiness trigger.

This rejection becomes graph data when the additive primitives ship. The next time a dual-graph-shaped proposal surfaces against the same room, the cross-relationship scan will surface this reject reason and the next decision can build on it instead of relitigating it.

---

*End of proposal. Hold-flag retracted 2026-05-16. Verdict logged. Plant-seed filed for v1.14.0.*
