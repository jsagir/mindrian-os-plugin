# RESEARCH: Meeting Micro-Knowledge DIKW Filing Engine (navigator proposal, filed verbatim)

Filed: 2026-06-11. Source: navigator (Jonathan) research proposal, pasted in the v1.13.1 drift-audit session. Seed: SEED-023. GSD consumers: v1.14.0 milestone scoping, /gsd-plan-phase for any meeting-layer phase.

Navigator framing directive (same session): "any transcript needs to trigger a proper filing system, to be a representation of Ackoff from data to wisdom."

## Integration annotations (added by Larry, 2026-06-11 -- read BEFORE the verbatim proposal)

1. **Ackoff DIKW is the workflow spine.** Data (transcript segments) -> Information (typed atomic claims, Claimify 4-pass) -> Knowledge (insight nodes, heuristics with conditions/counter_conditions) -> Wisdom (Decision-Gate-ready, framework-matched, Brain-query-ready briefs). The existing /mos:build-knowledge command already owns the Ackoff render surface; conversation-mode already maps lanes to DIKW (Phase 143.2). The proposal supplies the missing middle rungs.
2. **Verified 2026-06-11:** cascade routes meetings/ paths (lib/core/intelligence-cascade.cjs:196-198) -- Section 10's risk is half-closed; segment-level E2E confirmation = GATE-0. `knowledge_type` exists nowhere in lib/ or scripts/ (net-new). Edge taxonomy is FROZEN (ALLOWED_EDGE_TYPES closed set, edges.cjs chokepoint, claim-harness C3 rejects non-members) -- new edge types REQUIRE a Canon Part 4 / Phase 108 taxonomy amendment via the canon-amendment-on-itself mechanism.
3. **Part 8 fence:** "hyper-synced with local and remote Brain structure" = taxonomy and framework-affinity rules Brain-side (generic methodology), user claims/insights LOCAL-only; packets carry enums + handles + scalars (Phase 110 wire already enforces shape). Meeting content never egresses.
4. **Part 9 fence:** typed claims and insight nodes are truth-claim nodes -> mint `proposed`, human confirms. Live CDM probe nudges are advisory Decision-Gate renders, never auto-asserted truth.
5. **Part 7 reuse:** lands on /mos:file-meeting, /mos:reanalyze, /mos:build-knowledge, FEYNMAN timeline, Phase 150 cortex -- no new command surface required except possibly the live-probe nudge render.
6. **Composes with:** SEED-022 (insight nodes per-folder under fractal memory), SEED-002 (speaker expertise profiling needs the telemetry consumer), Phase 124 (causal narrative timeline), MEETINGS-INTELLIGENCE.md (becomes graph-backed selective coding).

---

## VERBATIM NAVIGATOR PROPOSAL (preserve unchanged)

# MindrianOS Meeting Layer — Micro-Knowledge Enhancement Proposal

## Executive Summary

The current MindrianOS meeting architecture (three-layer: filesystem / graph / memory log) is a solid provenance-aware pipeline, but it treats all extracted content as uniform claims. Research from cognitive science, knowledge engineering, and NLP reveals a richer taxonomy available at extraction time: tacit insights, root-cause assertions, cognitive cues, expert heuristics, and contradictions. This report maps peer-reviewed methodologies directly onto the existing Mindrian architecture and proposes concrete enhancements at each layer — from the claim schema, to cascade edge types, to new extraction passes — grounded in the research from the prior conversation.

***

## 1. The Core Gap: Uniform Claims vs. Typed Micro-Knowledge

The current pipeline extracts claims and assigns an evidence tier (Academic / Operational / Practitioner / None) plus a `review_status`. This is correct provenance tracking, but it collapses qualitatively different types of knowledge into a single node type. Research from cognitive task analysis (CTA) shows that experts produce at least five distinct knowledge types in unstructured conversation, each with different utility, verification requirements, and decay characteristics:[1][2][3]

- **Explicit facts** — verifiable propositions ("this grant system takes 9 months")
- **Causal / root-cause assertions** — mechanism claims ("delays happen because reviewers aren't accountable to the applicant")
- **Heuristics / rules of thumb** — pattern-based shortcuts ("if a startup has > 3 co-founders, expect governance failure by Series A")
- **Anomaly cues** — "what looks normal but is actually a warning" signals
- **Mental model fragments** — the expert's internal classification structure ("I sort projects into two buckets: legitimacy plays and efficiency plays")

Treating all five as identical `claim` nodes wastes the graph's relational power. Each type demands a different extraction prompt, a different evidence standard, different cascade edge semantics, and a different decay/review policy.

***

## 2. Enhancing the Claim Schema

### 2.1 Add a `knowledge_type` Field

Building on the Microsoft Research Claimify framework (ACL 2025), which demonstrates that 99% entailment and 91.8% sentence-level coverage requires disambiguating claim types at extraction time, the claim node schema should be extended:[4][5][6]

```json
{
  "id": "claim:uuid",
  "text": "...",
  "knowledge_type": "fact | causal | heuristic | anomaly_cue | mental_model | assumption",
  "evidence_tier": "Academic | Operational | Practitioner | None",
  "review_status": "proposed | confirmed | rejected | deferred",
  "source_speaker": "speaker:uuid",
  "source_segment": "segment:uuid",
  "confidence": 0.0–1.0,
  "conditions": "...",          // when does this hold?
  "counter_conditions": "...",  // when does it break?
  "causal_chain": ["A → B → C"],
  "extracted_by": "llm | human | acta_probe"
}
```

The `conditions` / `counter_conditions` fields come directly from CTA's contrastive probing method (ACTA Knowledge Audit): experts almost always have boundaries on their heuristics that they don't volunteer. Without capturing those boundaries, the claim is over-general and dangerous to cascade.[7][3][8]

### 2.2 Claimify-Style Extraction Pass

The current extraction pipeline (Larry extracts → proposed status) should run a four-stage pass adapted from Claimify:[6][4]

1. **Sentence splitting with context window** — each segment is split into sentences; the preceding 2–3 turns are included as context (critical for resolving "it" / "this" / "they" in spoken conversation).
2. **Selection** — LLM determines whether the sentence contains a verifiable/structured claim or is pure filler/social talk. Filler is tagged `no_claim` and discarded.
3. **Disambiguation** — referential ambiguity is resolved using speaker identity and prior turns. If it cannot be resolved, the segment is flagged `ambiguous` and queued for human review rather than silently dropped.
4. **Decomposition + typing** — each resolved sentence is decomposed into atomic claims and assigned a `knowledge_type` from the taxonomy above.

This replaces a single "extract claims" prompt with a disciplined four-pass pipeline, dramatically reducing false positives and over-general claims — the two failure modes that degrade cascade scan quality downstream.

***

## 3. Enhancing the Extraction Prompts: ACTA Knowledge Audit Integration

The ACTA (Applied Cognitive Task Analysis) Knowledge Audit is a peer-reviewed method for surfacing tacit knowledge during unstructured expert interviews. Its core probe set maps directly onto Mindrian's post-filing re-analysis pass (`/mos:reanalyze`).[9][3][8]

### 3.1 ACTA Cognitive Challenge Probes as Extraction Filters

After the primary claim extraction, a second pass should run these ACTA-derived probes against the transcript segments:[10][7]

| ACTA Probe Type | What It Surfaces | Mindrian Node Type |
|---|---|---|
| "What looks routine but isn't?" | Anomaly detection rules | `knowledge_type: anomaly_cue` |
| "What patterns do you see that others miss?" | Expert perceptual cues | `knowledge_type: heuristic` |
| "What would a novice get wrong here?" | Tacit prerequisite knowledge | `knowledge_type: heuristic` + `conditions` |
| "Walk me through the last time everything nearly failed" | Causal chains, decision points | `knowledge_type: causal` + `causal_chain[]` |
| "When does [principle X] break down?" | Boundary conditions | populates `counter_conditions` on existing claim |
| "What two seemingly similar cases are actually different?" | Mental model classification | `knowledge_type: mental_model` |

This pass is not a new transcript extraction — it is a re-read of already-segmented content through a targeted lens, which fits naturally into `/mos:reanalyze`.

### 3.2 Contrastive Pair Detection

Research on repertory grid technique shows that expert mental models are most clearly revealed by contrasts ("A and B are alike, C is different"). The extraction pipeline should detect contrastive language markers (`"unlike X"`, `"but in this case"`, `"the difference is"`, `"most people think X but actually"`) and flag those segments as high-priority for `mental_model` or `causal` typing, with elevated confidence scoring.[11][12]

***

## 4. Enhancing the Graph Layer: Richer Edge Semantics

The current cascade scan mints five edge types: `INFORMS`, `CONTRADICTS`, `CONVERGES`, `INVALIDATES`, `ENABLES`. This is a good base ontology. Research on knowledge graph event representation and provenance tracking suggests several additions:[13][14][15]

### 4.1 New Recommended Edge Types

```
REFINES         // new claim tightens/conditions a prior claim (adds counter_conditions)
GENERALIZES     // new claim is a broader pattern over multiple prior claims  
ROOT_CAUSES     // directional causal claim: A → B (source is cause, target is effect)
CONTRADICTS_CONDITIONALLY  // conflicts only under specific conditions
INSTANTIATES    // specific example / incident that evidences an abstract claim
SUPERSEDES      // newer causal/heuristic claim replaces older one (keep old for history)
```

`REFINES` is particularly important: when a meeting segment adds boundary conditions to an existing claim without invalidating it, the current schema forces a choice between `INFORMS` (too weak) and `CONTRADICTS` (wrong). `REFINES` captures this precisely.

`ROOT_CAUSES` enables the graph to express causal chains as first-class structure rather than encoding causality only in claim text. This makes the graph queryable for root-cause traces: "show me all claims that are root-caused by [constraint X]."

### 4.2 Temporal Quadruples for Claim Validity

Research on Temporal Knowledge Graphs (TKGs) demonstrates that associating timestamps with triples is essential for claims that have time-bounded validity. The SQLite `room.db` schema should record not just `created_at` but `valid_from` / `valid_until` on each claim and edge, enabling:[14][16]

- Claims that were true in 2024 but superseded by a 2025 meeting to remain in history
- `SUPERSEDES` edges to carry a timestamp marking the transition
- `/mos:reanalyze` to detect temporal contradictions (same speaker contradicting their own earlier claim)

### 4.3 Graph Reification for Provenance

RDF-star / graph reification principles allow attaching metadata (who asserted it, from which source, with what confidence) directly to edges rather than only to nodes. In the SQLite schema, each edge row should carry:[17][18][19]

```sql
source_claim_id, target_claim_id, edge_type,
asserted_by_speaker, asserted_in_meeting, confidence,
conditions, created_at, valid_from, valid_until
```

This enables queries like: "show me all `ROOT_CAUSES` edges asserted by Speaker A with confidence > 0.7 in the last 6 months."

***

## 5. Enhancing the Meeting Pipeline: A New `insight_class` Layer

The current pipeline produces: `artifact → claim → cascade`. A new intermediate layer — `insight` — should sit between claim and cascade, grouping related claims into coherent insight units.

### 5.1 The Insight Node

Grounded Theory methodology (Glaser & Strauss; widely used in qualitative research for building structured knowledge from unstructured conversation) defines three levels: open coding → axial coding → selective coding. The Mindrian equivalent is:[20][21][22]

- **Open coding** = current claim extraction (individual atomic claims)
- **Axial coding** = new `insight` node (a cluster of claims sharing a common mechanism or subject)  
- **Selective coding** = `MEETINGS-INTELLIGENCE.md` cross-meeting aggregation (already exists!)

An `insight` node in `room.db`:

```json
{
  "id": "insight:uuid",
  "title": "Short human-readable label",
  "core_claim_ids": ["claim:A", "claim:B", "claim:C"],
  "knowledge_type": "root_cause | heuristic | mental_model | pattern",
  "domain": "...",
  "speaker_ids": ["speaker:X"],
  "meeting_ids": ["meeting:Y"],
  "evidence_count": 3,
  "review_status": "proposed"
}
```

### 5.2 Insight Promotion Flow

Insights accumulate evidence across meetings. The cascade scan should check: "do two or more meetings contain converging claims that, together, constitute an insight?" If yes, mint a new `insight` node linking them and write a `CONVERGES` edge to `MEETINGS-INTELLIGENCE.md`. This turns the cross-meeting aggregation file from a prose summary into a graph-backed intelligence product.

***

## 6. Enhancing the Velma / Speaker Layer: CDM Probes During Live Transcription

The Critical Decision Method (CDM), developed by Gary Klein and widely validated in peer-reviewed research on naturalistic decision-making, is the most powerful live technique for surfacing tacit root-cause knowledge. Its core mechanism — retrospective probing of a specific past incident across multiple cognitive sweeps — can be partially automated.[23][24][25]

### 6.1 Real-Time Probe Injection

When Velma detects language markers characteristic of CDM-targetable content (anomaly narratives, "almost failed" stories, decision recollections), the Mindrian system should surface a soft prompt to the room host:

```
💡 [Speaker X is describing a past incident — possible root-cause insight]
Suggested probe: "What was the key moment everything hinged on?"
```

This is not automated interrogation — it's a human-facing nudge that surfaces the right follow-up question at the right moment. The same mechanism already exists implicitly in the Decision Gate (APPROVE / REJECT / DEFER); it simply needs to be extended upstream into the live session layer.

### 6.2 Speaker Expertise Profiling

Each `team/` profile should carry an `expertise_domains[]` and `knowledge_type_history` derived from past meetings: "Speaker A has produced 12 `causal` claims in domain `gov-grants`, 4 confirmed." This allows the cascade scan to weight new claims by speaker track record — a confidence modifier grounded in the ACTA principle that expertise is domain-specific and measurable.[3][1]

***

## 7. Enhancing `/mos:reanalyze`: The CTA Retrospective Pass

The existing `/mos:reanalyze` command re-scans old meetings as the graph gets smarter. It should gain a dedicated **CTA retrospective pass** — a structured re-read through CTA lenses that the initial filing pass is too time-pressured to apply.

### 7.1 Pass Structure

For each meeting older than N days (configurable), run:

1. **Anomaly scan** — re-read segments through the "what looks routine but isn't?" lens; surface any segments that now look like anomaly cues given new graph context.
2. **Causal chain reconstruction** — trace `ROOT_CAUSES` edges forward from claims in this meeting; if a later meeting confirmed the causal mechanism, upgrade the original claim's `review_status`.
3. **Contrastive pair scan** — find claims in this meeting that contradict claims in later meetings; if not already linked by `CONTRADICTS`, mint the edge now.
4. **Insight aggregation** — check whether claims in this meeting, combined with newer claims, now constitute a promotable `insight` node.

This mirrors the Grounded Theory concept of **theoretical saturation**: the point where new data adds no new codes. In Mindrian terms, saturation is when `/mos:reanalyze` produces no new edges from a meeting — it has been fully integrated into the graph.[21][22]

***

## 8. The FEYNMAN.md Timeline Enhancement

Currently `FEYNMAN.md ## Timeline (auto)` is regenerated from `memory_event` logs. With the new schema, it can become a **causal narrative timeline** rather than a chronological event log:

- Group events by `insight` node rather than by date
- Show the evolution of a root-cause claim across meetings: "first proposed (Meeting A, proposed) → challenged (Meeting B, CONTRADICTS edge) → refined (Meeting C, REFINES edge) → confirmed (you, 2026-05)"
- Flag claims that have been sitting in `proposed` for > 30 days with no cascade activity as "orphaned insights" requiring human review

This transforms `FEYNMAN.md` from a memory log into a **knowledge archaeology tool** — showing not just what was learned but how understanding evolved.

***

## 9. Implementation Priorities

Ranked by impact-to-effort ratio:

| Priority | Enhancement | Effort | Impact |
|---|---|---|---|
| 1 | Add `knowledge_type` to claim schema + update extraction prompt | Low | High — improves all downstream filtering |
| 2 | Add `REFINES`, `ROOT_CAUSES`, `INSTANTIATES` edge types to cascade scan | Medium | High — enables causal graph queries |
| 3 | Claimify-style 4-pass extraction (selection → disambiguation → decomposition → typing) | Medium | High — reduces noise, improves cascade quality |
| 4 | `conditions` / `counter_conditions` fields on claims | Low | Medium — prevents over-general cascades |
| 5 | Temporal `valid_from` / `valid_until` on claims and edges | Low | Medium — enables historical reasoning |
| 6 | ACTA probe pass inside `/mos:reanalyze` | Medium | High — surfaces tacit knowledge from old meetings |
| 7 | `insight` node type + insight aggregation in cascade | High | Very high — closes the gap between claim-level and intelligence-level |
| 8 | Speaker expertise profiling with domain-specific confidence weighting | Medium | Medium — improves cascade prioritization |
| 9 | Live probe injection via Velma markers | High | High — but depends on UX design for the room host |
| 10 | Causal narrative FEYNMAN.md timeline | Medium | Medium — usability improvement |

***

## 10. The Unverified Risk: Cascade Scan on Meeting Segments

As the architecture document itself flags, it remains unverified whether the cascade scan fires on meeting segments or only on methodology artifacts. This matters because enhancements 2–7 above are entirely dependent on the cascade scan running post-filing on meeting content. Before implementing any schema changes, this single audit item should be resolved first — check whether `post_filing_cascade()` (or equivalent) receives `artifact.type === "meeting"` segments as input, and if not, add the type guard before building on top of it.

***

## Summary

The MindrianOS meeting layer has a strong provenance architecture. The gap is semantic richness at extraction time and graph expressiveness at relationship time. The enhancements above — grounded in ACTA, Claimify, CDM, Grounded Theory, and temporal KG research — transform the system from a claim archive into a genuine micro-knowledge mining engine: one where a random conversation with a domain genius produces not just transcripts and bullet points, but a causally structured, speaker-attributed, temporally valid graph of expert insight.[16][22][25][8][4][14][6][23][20][3]
