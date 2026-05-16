---
type: architectural-review-A
reviewer: canon-compliance-auditor
target: dual-graph proposal (.planning/research/2026-05-16-dual-graph-architectural-proposal.md)
created: 2026-05-16
canon_version: v1.4
canon_parts_audited: [Part 1, Part 3, Part 4, Part 7, Part 8, Part 9]
---

# Canon Compliance Review (Reviewer A) -- Dual-Graph Proposal

## Verdict

**CANON-COMPLIANT-WITH-CONSTRAINTS.**

The proposal as written is canon-compliant on every Part audited (1, 3, 4, 7, 8, 9), but only if the constraints in Section 7 are written verbatim into the cross-phase amendments. Three of the five new surfaces (transition aggregates, learned weights, local fallback predictor) sit one careless line away from a Part 8 breach -- they are room-specific bytes by construction and must NEVER appear in a Brain packet field, query parameter, or sanitizer-bypassing log line. The proposal acknowledges this in Section 5.2 but does not yet bind the constraint at the schema layer. The Verdict downgrades from CANON-COMPLIANT to WITH-CONSTRAINTS until the Part 8 fence is named as a frozen invariant in each amended CONTEXT.md.

---

## Per-question findings

### Q1 -- Risk surface for LOCAL bytes to reach Brain via packet/query

**None of the five new elements creates a direct Part 8 breach as proposed**, but two create *adjacent* risk surfaces that must be fenced.

Direct evidence the boundary is already structurally hard:
- `lib/core/brain-client.cjs:82` defines `sanitizeCypherInput` (whitelist sanitizer); `:46-64` define sha256 hashing for any LOCAL-derived key that crosses the wire; `:1104` carries the comment "raw-Cypher methodology lookups carry only generic handles."
- `lib/brain/chain-recommender.cjs:80-83` `FEEDS_INTO_CYPHER` binds only `$seed` (framework name) -- never command string, never user content.
- `lib/workflow/f-selector-ranker.cjs:21-22` declares "Canon Part 8 (Graph Boundary): zero Brain calls (consumes packet, never issues query); LOCAL only."
- Phase 110-CONTEXT.md:145 names the invariant: *"Brain queries carry only generic handles + enums + sha256 hashes; never user bytes."*

Adjacent risk surfaces the proposal opens:

1. **Transition aggregates** (Section 3.1). The aggregate table `transition_edges(from_event, to_event, count, success_rate, latency_ms)` is computed from `memory_event` payload bodies. Some `memory_event` payloads carry user-content adjacent fields -- e.g., `f_selector_miss.user_intent: <verbatim user text>` (`lib/core/navigation/memory-events.cjs:108-111`). If a transition aggregator ever reads `user_intent` as a join key or includes it in a query payload, that is a breach. The aggregator MUST project only enum scalars (event_type, framework, command slug from registry) -- never freeform payload fields.

2. **Learned weights** (Section 3.2). Tuning data is drawn from `f_selector_decision` and `f_selector_miss` rows. The reason strings in `selector-decisions.cjs:84-86` are user-supplied. Weights themselves are scalars (safe), but the *training query* that produces them must not embed reason strings as features.

**Confirmation:** ASSOCIATION_LENS and TRANSITION_LENS as lens-class *names* create zero risk surface (they are vocabulary). The local fallback predictor is purely LOCAL by definition (no Brain wire involved) and creates zero risk.

### Q2 -- TRANSITION_LENS naming and Canon Part 9

**Rides existing clause as additive. No reinterpretation required.**

Canon Part 9 (MINDRIAN-CANON.md:301-303) states verbatim:

> *"SQL (`room.db`) remembers and navigates. The local SQLite graph is the authoritative machine-readable memory layer. It holds typed nodes, typed edges, provenance, validity status, and a memory event log."*

The proposal's TRANSITION_LENS reads `memory_event` aggregates -- it asks SQL to remember not just events but the *shape of event sequences*. This is precisely what "remembers and navigates" already covers; Part 9 does not restrict the navigation shape to single-hop edge walks.

CANON-PHASE-MAP.md:325 already records that `lib/core/navigation.cjs` is the "13-function navigation chokepoint" implementing Part 9. Adding a lens class that reads through this chokepoint (per the Phase 128 substrate contract amendment proposed in Section 6.A) is structurally identical to the existing edge-typed reads.

The proposal's Section 5.3 framing ("the local mind remembers its own movement") is a faithful restatement of Part 9's existing scope, not an extension. No canon amendment needed.

### Q3 -- Room-local learned weights and Canon Part 8

**YES, implementable in a room-local-only fashion that satisfies Part 8.** Required guardrails:

1. **Weights table is `room.db`-resident.** Stored as a node type (e.g., `learned_weight` with `properties: {feature, value, updated_at}`) inside the user's local SQLite. Never written to the Brain MCP, never serialized into a Brain Context Packet field.

2. **Training reads are LOCAL-only.** Weight updates read `memory_event` rows via `navigation.findRecentChanges` (the chokepoint). They never call `brainClient.query` or `brainClient.sendPacket`. Verifiable via the Phase 110-05 adversarial seed pattern.

3. **Weights never appear in `Brain Context Packet` payload fields.** The packet schema (Phase 110) carries scalars derived from the local graph (`framework_chain_hint`, `banked_opportunities` count + top-3 HSI per Phase 110-CONTEXT.md:55), but the weights themselves stay LOCAL.

4. **No cross-user aggregation.** Canon Part 8 (MINDRIAN-CANON.md:290): *"Cross-user intelligence, if ever built, is a separate product with a separate installer and a separate legal review."* The implementing phase must add a CI tripwire (mirroring Phase 90's 5-tripwire pattern) that fails any code path joining weights from `~/.mos/rooms/<room-A>/room.db` with `~/.mos/rooms/<room-B>/room.db`.

5. **Reason strings excluded from feature vectors.** Per Q1, the learned-weight feature extractor MUST project only enum scalars from `f_selector_decision` payloads, not the freeform `reason` field.

With these five guardrails the design is canonically clean. Without them, learned weights become the most likely future Part 8 breach in the v1.13.1 surface.

### Q4 -- Reuse-Before-Build count (Canon Part 7)

**Audited: 5 shipped surfaces extended, 3 net-new surfaces required. Net-additive claim sustained.**

Shipped surfaces the proposal *extends* (read or write through, no fork):
1. `lib/core/navigation.cjs` (the 13-function chokepoint + 5 additive re-exports; verified above). TRANSITION_LENS reads through it.
2. `lib/core/navigation/memory-events.cjs:10-112` (37 event types, frozen `EVENT_TYPES` Set). Transition aggregates project over this log.
3. `lib/workflow/f-selector-ranker.cjs:270-285` (the `_scoreCommand` formula at lines 278-282 -- `brain_confidence * 0.40 + (1 - recency_decay) * 0.30 * inv + problem_type_bind * 0.30 * inv`). Learned weights tune the multipliers; the formula shape is preserved.
4. `lib/workflow/selector-decisions.cjs` (the D7 writer that emits `f_selector_decision` events + DEFERRED/REJECTED edges). Becomes the feedback loop's data source.
5. `lib/brain/chain-recommender.cjs:75-83` (the FEEDS_INTO traversal). Local fallback predictor mirrors this shape against the LOCAL graph instead of the Brain.

Net-new surfaces the proposal requires:
1. **Transition aggregate table or view** (Section 3.1). New schema element. Justifies itself per Phase 108 frozen-taxonomy rule: must be added via the same RECONCILIATION.md mechanism Phase 108 established.
2. **Learned-weights store** (Section 3.2). New node type (`learned_weight` per Q3) with provenance + update trail.
3. **`local-chain-recommender.cjs` sibling** (Section 3.3). A LOCAL-only chain walker against room.db. The proposal explicitly names this gap; no existing module fills it.

5 extends vs. 3 net-new = **net-additive on shipped substrate**, sustaining the Section 2 audit's "70% restates shipped" claim. The Part 7 cost is acceptable IF each net-new surface ships with the "which of the 25 does this replace or extend, and why is repointing insufficient?" answer (MINDRIAN-CANON.md:239) in its plan.

### Q5 -- APPROVE/REJECT/DEFER as graph data (Canon Part 4)

**Yes, the proposal's resolution decision itself produces typed graph edges per Part 4.**

The proposal's Section 6.B explicitly states: *"Rejection is data per Canon Part 4. The reject reason becomes a graph node that teaches the next cross-relationship scan to not surface a dual-graph-shaped proposal again unless evidence accumulates."* This is correct and self-applying.

The mechanism is already shipped:
- `lib/workflow/selector-decisions.cjs` emits `f_selector_decision` memory events + DEFERRED/REJECTED cascade edges via `navigation.writeEdge` (the chokepoint, exposed at `lib/core/navigation.cjs:91`).
- `lib/core/navigation/memory-events.cjs:98-105` registers the `f_selector_decision` event type with payload `{decision, command, framework, reason, edge_semantic, expires_at, score_at_decision, investment_level_at_decision}`.
- Phase 125-CONTEXT.md D7 binding (referenced in `f-selector-ranker.cjs:47-52`) makes this the canonical pattern for decision-as-graph-data.

**Where the proposal's resolution would land:** If REJECT is selected, the reject reason should land as either (a) a `memory_event` row with `event_type='architectural_proposal_decided'` (would require an additive event type, mirroring the Phase 117 / 116 / 124 additive extension pattern at `memory-events.cjs:54-85`), or (b) the `docs/autopsies/2026-05-16-dual-graph-proposal-rejected.md` autopsy file the proposal itself names in Section 6.B as the artifact. The autopsy file is Part 4-adjacent (file artifact, not graph node), so option (a) is the cleaner Part 4 form.

**Recommendation for the resolution itself:** Whichever path is taken (APPROVE/REJECT/DEFER), emit the decision via the existing Phase 125 D7 surface or an additive `architectural_proposal_decided` event type, so the decision joins the graph and informs Phase 92's drift-detection engine when that ships.

---

## Constraints the proposal MUST honor if approved

1. **Transition aggregate projections are enum-only.** No freeform payload fields (especially `f_selector_miss.user_intent`, `f_selector_decision.reason`) may enter aggregate join keys, feature vectors, or downstream packet fields. Frozen as a structural invariant in the Phase 128 substrate contract amendment.

2. **Learned-weight store is `room.db`-resident.** Never serialized into a Brain Context Packet, never written through `brain-client.write`. Added as a typed node to the Phase 108 frozen taxonomy via the same RECONCILIATION.md mechanism.

3. **No cross-room aggregation of weights or transition stats.** CI tripwire required, mirroring the Phase 90 5-tripwire pattern, that fails any code path joining two rooms' `room.db` files. Cross-user learning is a separate product per Canon Part 8 (MINDRIAN-CANON.md:290).

4. **Local fallback predictor reads through `navigation.cjs`.** Zero direct `room-db.cjs` requires outside the existing allow-list (per the Phase 109-06 pre-commit hook). The new `local-chain-recommender.cjs` sibling becomes the eighth approved navigation consumer.

5. **Lens-class names reserved, not implemented.** ASSOCIATION_LENS and TRANSITION_LENS land as vocabulary slots in Phase 130's lens-engine skeleton; implementations defer to v1.14.0 plant-seed conditions in Section 6.C of the proposal. Vocabulary reservation costs ~$0 if wrong (CONTEXT.md edits only); implementation costs are real and require accumulated outcome data the proposal correctly defers.

6. **Resolution decision itself emits a typed graph edge.** Via the Phase 125 D7 surface (`selector-decisions.recordSelectorDecision`) OR an additive `architectural_proposal_decided` event type. The proposal's "rejection is data" framing must be made executable, not aspirational.

7. **Every amended CONTEXT.md declares `canon_parts:` frontmatter** per the CANON-PHASE-MAP.md forward-compatibility rule. The five amendments (127.1/128/129/130/131) each name Part 7 + Part 8 + Part 9 at minimum.

---

## Final read

The dual-graph proposal is a faithful restatement of shipped MindrianOS substrate plus three real gaps; it earns CANON-COMPLIANT-WITH-CONSTRAINTS provided the seven constraints above land verbatim in the amended CONTEXT.md frontmatter and the learned-weights piece is built with the Phase 8 fence at the schema layer, not the policy layer.
