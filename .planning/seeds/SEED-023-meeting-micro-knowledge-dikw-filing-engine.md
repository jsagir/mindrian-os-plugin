# SEED-023: Meeting Micro-Knowledge DIKW Filing Engine (typed claims, ACTA probes, insight layer, causal edges)

- **Planted:** 2026-06-11
- **Source:** Navigator research proposal (peer-reviewed grounding: ACTA Knowledge Audit, Microsoft Claimify ACL 2025, Klein CDM, Grounded Theory, Temporal KGs) filed verbatim at `.planning/research/2026-06-11-meeting-micro-knowledge-dikw-proposal.md`. Navigator directive in-session: "any transcript needs to trigger a proper filing system, to be a representation of Ackoff from data to wisdom."
- **When:** v1.14.0+ scoping. Composes with SEED-022 (fractal memory), SEED-002 (telemetry consumer), Phase 150 memory cortex, Phase 124 FEYNMAN timeline.
- **Status:** PARTIALLY PROMOTED (2026-06-11): v1 slice (knowledge_type + 4-pass extraction + conditions + temporal + REFINES/ROOT_CAUSES/INSTANTIATES amendment + any-transcript trigger) -> Phase 150.8 on the v1.13.1 train, by navigator directive. Remainder (insight layer, ACTA reanalyze, speaker profiling, live CDM probes, causal FEYNMAN timeline) stays dormant here for v1.14.0.
- **Bundle:** meeting-intelligence (new) -- evaluate with SEED-022 when either fires.

## The thesis (one line)

Every transcript that lands -- file-meeting, Velma, paste -- auto-fires a filing ladder that IS Ackoff's DIKW pyramid: Data (segments) -> Information (TYPED atomic claims) -> Knowledge (insight nodes + heuristics with boundary conditions) -> Wisdom (Decision-Gate-ready, framework-matched, Brain-query-ready briefs). Today all extracted content collapses into uniform `claim` nodes; the research shows experts emit at least 5 distinct knowledge types that demand different extraction prompts, evidence standards, cascade semantics, and decay policies.

## The 6-type taxonomy (net-new `knowledge_type` field)

fact | causal | heuristic | anomaly_cue | mental_model | assumption -- plus `conditions` / `counter_conditions` (ACTA contrastive probing: experts never volunteer the boundaries of their heuristics; uncaptured boundaries make claims dangerous to cascade).

## Verified against the codebase (2026-06-11)

- **Cascade DOES route meetings:** `lib/core/intelligence-cascade.cjs:196-198` resolves `meetings/` paths. The proposal's Section 10 risk (cascade fires on meeting segments?) is half-closed; full E2E confirmation still needed for segment-level (vs file-level) firing.
- **Edge taxonomy is FROZEN:** `ALLOWED_EDGE_TYPES` is a closed set behind the edges.cjs chokepoint; claim-harness C3 asserts non-taxonomy edges are REJECTED. Adding REFINES / ROOT_CAUSES / INSTANTIATES / SUPERSEDES / CONTRADICTS_CONDITIONALLY / GENERALIZES is a **Canon Part 4 + Phase 108 taxonomy amendment** (canon-amendment-on-itself mechanism, like the 5->6 reach amendment, Appendix D entry 15). Not a code-only change.
- **`knowledge_type` exists nowhere** in lib/ or scripts/ -- genuinely net-new, additive to the claim node schema (Part 9 truth-claim rules apply: typed claims still mint `proposed`, human confirms).

## Canon fences (non-negotiable)

- **Part 8:** meeting content NEVER egresses. "Hyper-synced with remote Brain" means: the knowledge_type TAXONOMY and framework-affinity rules live Brain-side as generic methodology; user claims/insights stay in room.db; Brain packets carry knowledge_type ENUMS + framework handles + scalar counts only (the Phase 110 typed-packet wire already enforces shape).
- **Part 9:** insight nodes and typed claims are truth-claim nodes -> proposed until human-confirmed. ACTA/CDM probe SUGGESTIONS at live-meeting time are advisory renders (Decision Gate), never auto-asserted truth.
- **Part 7 reuse:** lands on existing surfaces, not new ones -- /mos:file-meeting (ingest), /mos:reanalyze (ACTA retrospective pass + saturation rule: a meeting is integrated when reanalysis mints zero new edges), /mos:build-knowledge (the existing Ackoff DIKW command becomes the ladder's render), FEYNMAN.md timeline (causal narrative grouping by insight), Phase 150 cortex (insights become reachable memory).

## Implementation spine (from the proposal's priority table, re-ordered for fences)

1. GATE-0: E2E confirm segment-level cascade firing on meeting artifacts (the proposal's own precondition).
2. `knowledge_type` + `conditions`/`counter_conditions` on claim schema + 4-pass Claimify extraction (selection -> disambiguation -> decomposition -> typing) in file-meeting.
3. Canon amendment: edge taxonomy +REFINES +ROOT_CAUSES +INSTANTIATES (minimum viable trio); temporal `valid_from`/`valid_until` on claims+edges.
4. ACTA probe pass inside /mos:reanalyze (re-read, not re-extract).
5. `insight` node layer (Grounded Theory axial coding) + promotion flow into MEETINGS-INTELLIGENCE.md (CONVERGES-backed, graph-backed instead of prose).
6. Speaker expertise profiling (team/ profiles gain expertise_domains[] + knowledge_type_history; confidence modifier on cascade).
7. Live CDM probe nudges via Velma markers (host-facing Decision Gate render; UX design needed).
8. FEYNMAN.md causal narrative timeline (group by insight; flag proposed-claims orphaned > 30 days).

## Trigger

Fires at v1.14.0 milestone scoping, OR earlier if a meeting-heavy engagement (align-ecosystem cadence) makes the uniform-claim bottleneck user-visible. GATE-0 can run any time -- it is a read-only audit.
