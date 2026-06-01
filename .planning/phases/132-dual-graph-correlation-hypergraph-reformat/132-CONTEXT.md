---
phase: 132
slug: dual-graph-correlation-hypergraph-reformat
status: scoped (ready for /gsd:discuss-phase 132)
priority: P0 -- closes the teaching-graph half of "Coherent Brain-Wired Product"; Phase 128/129/131 already close the local-spine half
created: 2026-05-17
updated: 2026-06-01 (4.7-to-4.8 re-baseline SPLIT: the correlation_id contract + dual-graph CI gates are EXTRACTED to Phase 130.7 (which lands before 131); this phase is now the hypergraph reformat + cross-label dedup + content cleanup only -- the former "132B". See 132-REVIEW-4.8.md.)
milestone: v1.13.1
beta_target: 1.13.1-beta.6 (after Phase 131 = beta.5c)
wave: 7 (between Phase 131 and Phase 121.5)
absorbed_from: 2026-05-17 dogfooding curation session (HEART orphan find -> Brain-wide orphan census -> dual-graph + hypergraph user reframe)
absorption_source: ~/MindrianRooms/mindrian/mindrianOS/methodology/2026-05-17-brain-curation-audit.md
canon_parts:
  - Part 4 (every choice is graph data -- this phase makes the graph data CORRELATABLE across the LOCAL/TEACHING split)
  - Part 8 (boundary -- correlation contract is enum projection only; no user content leaks to Brain)
  - Part 9 (memory locality -- local memory_event aggregates resolve to canonical teaching-graph correlation_ids)
  - Part 10 (Conversation IS the surface -- Larry's chain-recommender output coherence depends on this phase landing)
depends_on:
  - Phase 127 brain-mcp-local-stdio-shim (Brain default-active; lib/brain/chain-recommender.cjs ships)
  - Phase 128 substrate-contract-adr (navigation.cjs as only door for local writes)
  - Phase 129 spine-repair-memory-event (memory_event emission contract + FOLLOWS_FROM cascade)
  - Phase 130.7 correlation-id-contract-dual-graph-ci-gates (NEW 2026-06-01 -- the correlation contract this reformat writes against; the CI gates that MEASURE this reformat live there)
  - Phase 131 research-as-graph-aware-workflow-step (EvidenceClaim contract + cascade edges)
dependents:
  - Phase 121.5 terminal-coherence-capstone (truth-telling pillar; coherence claim breaks if teaching graph is polluted)
  - v1.14.0 P9 framework-lens migration (5 commands routing through chain-recommender -- needs canonical targets)
  - v1.14.0 P13 source-lens fan-out remainder (13 research surfaces -- INFORMS/CONTRADICTS edges need unique targets)
brain_impact: HIGH (this IS the Brain teaching-graph reformat phase; ~559 nodes archived in dogfooding session; ~278 cluster nodes remaining to wire; cross-label dedup scope ~50-150 nodes; correlation_id rollout across all ~6000 nodes)
hotfix_discipline: NO (architectural primitive + content reformat + CI gate)
estimated_days: 7-10
---

# Phase 132: Dual-Graph Correlation + Hypergraph Teaching-Graph Reformat

## Goal

Finish the teaching-graph REFORMAT half of v1.13.1's "Coherent Brain-Wired Product" claim. The correlation_id contract + dual-graph CI gates that USED to be pillars 1 and 3 of this phase are now Phase 130.7 (extracted 2026-06-01 so they land before Phase 131). This phase now writes the heavy reformat AGAINST that contract, and the 130.7 CI gates measure the result. This phase ships:

1. **Hypergraph reformat** -- 4-5 reified event-node types (AuthorshipEvent, IllustrationEvent, ContradictionEvent, MotivationEvent, EvolutionEvent) that capture n-ary relationships on Neo4j's binary-edge substrate. (was pillar 2)
2. **Cross-label dedup** -- collapse the ~50 same-name-different-label groups (HEART, JTBD, Wicked Problem, Four Lenses, Ackoff-class) into one canonical correlation_id per cluster with facets. (was Sub-plan 132-03)
3. **Content cleanup** -- finish the wire-it work from the 2026-05-17 dogfooding session (clusters A/C/D/E/F/G ~278 nodes) + Ackoff-class fragmentation cleanup across other methodology authors (Drucker, Christensen, Senge, Meadows, de Bono, etc.) + pseudonymize the 6 internal-team `:Person` nodes (open decision 5, resolved).

The correlation_id contract (former pillar 1) and the dual-graph CI gates (former pillar 3) now live in Phase 130.7. correlation_id is name-based and embedding-INDEPENDENT (a stable hash of canonical_name + primary_label), so this reformat is safe under any Phase 134 (`@huggingface/transformers` CJS embedding port) or Phase 127.1 (Pinecone -> Neo4j HNSW) substrate change. The "one canonical target per query, no fork" guarantee (130.7 acceptance criterion) is what Phase 136's LazyGraph suggestion slot consumes -- this reformat is what makes that guarantee TRUE in content.

## Why this matters

The 2026-05-17 dogfooding session that surfaced this phase discovered:

- **The visible curation gap (Section 1-6 of audit doc):** 29 of 155 Framework nodes carry `jtbd_anchor: REVIEW_REQUIRED`, blocking chain-recommender routing. HEART Framework -- the spine of the MindrianOS investor deck -- was invisible to the chain-recommender because it was orphan + unanchored. Dogfooding find.

- **The bigger orphan census (Section 7-9):** Brain has ~4,500 orphan nodes across all labels. The 29 REVIEW_REQUIRED Frameworks were 0.6% of the orphan mass. Four GraphRAG-extraction failure modes account for 928 noise nodes (Unknown Person placeholders, SEP-merged Concepts, numeric-suffix scrape IDs, demoted Framework -> Concept mislabels). 559 archived to `:Archived` label in the session.

- **The cross-label duplicate problem (Section 13):** "HEART Framework" exists as `:Framework + :Product`. "Jobs-to-be-Done" exists as `:Framework + :Product + :DictionaryTerm`. "Wicked Problem" exists as `:Concept + :ProblemType + :DictionaryTerm`. "Four Lenses of Innovation" has 12+ variant nodes across 6 different labels including 5 mislabeled "Rowan Gibson's X" `:Person` nodes. Ackoff is shattered across 5+ nodes including 2 frameworks wrongly labeled `:Person`. Cascade edges (INFORMS, CONTRADICTS, SUPERSEDES) fork across these variants; chain-recommender returns the wrong canonical.

- **The Wire-It Contract user reframe (Section 10):** mid-session, the user surfaced the meta-pattern across four cluster corrections: nothing in the 380 demoted Concepts is a Framework. They are the SUPPORT CAST (examples + authors + factors + motivations) that makes frameworks teachable. The fix is not relabeling. The fix is WIRING with typed edges. Aronhime DNA spelled out in graph form.

- **The dual-graph + hypergraph call (this session):** the user articulated that v1.13.1's "Brain-Wired Product" coherence needs (a) dual-graph correlation between local room.db navigation events and Brain teaching-graph entities, and (b) hypergraph formatting of the teaching graph so n-ary relationships (Person + Framework + Book + Year + Organization) capture as ONE reified event node + binary edges, not as N separate binary edges losing context.

Without Phase 132, every Phase 127 / 118-02 / 131 / 121.5 release-candidate functional test passes BUT real-world quality is degraded: chain-recommender returns thin or wrong cohorts for the 22 still-REVIEW_REQUIRED methodologies; dashboard-graph-neighborhood agent (Phase 118-02) misses cross-domain analogies because Examples (cluster A, ~55 nodes) are not wired ILLUSTRATES to Frameworks; /mos:research (Phase 131) writes cascade edges that fork across cross-label duplicates; Phase 121.5's truth-telling pillar ships onto a teaching graph the user can prove is incoherent within minutes of using it.

## Scope

### Sub-plan 132-01: Correlation contract -- MOVED to Phase 130.7 (2026-06-01)

> EXTRACTED to Phase 130.7 so the correlation_id primitive lands BEFORE Phase 131 (131's cascade edges must hit canonical correlation_ids, not cross-label duplicates). See 130.7-CONTEXT.md. The bullets below are retained for provenance only and are no longer part of Phase 132's scope.

- Add `correlation_id` property to every teaching-graph node (stable hash of canonical name + primary label). One-time backfill via Cypher batch.
- Update `lib/brain/chain-recommender.cjs` to return `{correlation_id, canonical_name, primary_label}` tuples, not raw nodes.
- Update navigation.cjs schema: memory_event references carry correlation_id, not raw name.
- Update `bin/local-chain-recommender.cjs` (Phase 127 Tier-LOCAL sibling) to walk memory_event aggregates by correlation_id.
- Backfill correlation_ids for the 559 archived nodes (point archived nodes' REPLACED_BY edges at canonical correlation_id).

### Sub-plan 132-02: Hypergraph reformat (~3 days)

Introduce 5 reified event-node types as the n-ary relationship substrate:

| Event node | Connects | Example |
|---|---|---|
| AuthorshipEvent | Person + Framework/Book + Year + Organization | "Ackoff authored Idealized Design in 1981 at Wharton" |
| IllustrationEvent | Example + Framework + Year + Industry + Outcome | "M-Pesa illustrates Platform Thinking in mobile money 2007, scaled to 200M users" |
| ContradictionEvent | Framework + RivalFramework + Evidence + Status(open/resolved) | "Disruptive Innovation contradicts Sustaining Innovation; evidence: Kodak; status: open" |
| MotivationEvent | Problem + Framework + Severity + Date | "Wicked Problems motivated PWS Methodology; severity: foundational; 2026" |
| EvolutionEvent | Framework + ParentFramework + Year + Author | "Lean Canvas evolved from Business Model Canvas in 2010 by Ash Maurya" |

Migration: existing binary AUTHORED / ILLUSTRATES / CONTEXTUALIZES / MOTIVATES edges stay (do not break callers) AND ALSO get reified into event nodes where richer context exists. New writes prefer event-node form. v1.14.0 deprecates binary edges once all callers migrate.

### Sub-plan 132-03: Cross-label dedup (~2 days)

Cypher pass identifies same-name nodes across different labels. For each cluster (HEART, Jobs-to-be-Done, Wicked Problem, Four Lenses, Ackoff-class):

- Pick canonical correlation_id (most-edged + primary-label-preferred)
- Migrate incoming edges to canonical
- Archive non-canonical via `:Archived` label + REPLACED_BY
- Add label facets to canonical (HEART canonical Framework also tagged `:Product :DictionaryTerm` as facets for cross-tier lookup)

### Sub-plan 132-04: Finish the Wire-It content (~3 days)

Per the 2026-05-17 audit doc Section 15 backlog:

- Cluster A (~55 examples) -- ILLUSTRATES wiring to Frameworks
- Cluster C2/C3 (~30 dedups + framework promotions back from Concept -> Framework + anchors)
- Cluster D (~80 concepts) -- CONTEXTUALIZES / USES_CONCEPT wiring
- Cluster E (~20 problems) -- INSTANCE_OF ProblemType + MOTIVATES Framework
- Cluster F (~25 case-difference dedup pairs)
- Cluster G (~15 manual one-by-one including Uriel/Yaakov/Yishai)
- Ackoff-class fragmentation cleanup for other shattered authors

### Sub-plan 132-05: CI gates + new curation surfaces -- MOVED to Phase 130.7 (2026-06-01)

> EXTRACTED to Phase 130.7 (the CI gates + the three `/mos:brain-derive` curation surfaces ship with the correlation_id primitive so they can gate the reformat from the start). See 130.7-CONTEXT.md. The content below is retained for provenance only.

Three new commands ship:
- `/mos:brain-derive --review-anchors` -- weekly REVIEW_REQUIRED digest
- `/mos:brain-derive --orphan-census` -- all-labels orphan scan
- `/mos:brain-derive --cross-label-dups` -- same-name-different-label detection

One CI gate added to release-candidate validation:
- chain-recommender CI fails if any JTBD cohort has < 3 frameworks OR REVIEW_REQUIRED count > 10 OR any framework has > 1 target across labels for same canonical name OR orphan-rate per label > 5%

## Non-goals (deferred to v1.14.0)

- DGEKT lens-class taxonomy (rejected per 2026-05-16 dual-graph review verdict; not revisited)
- Learned ranker weights from outcome edges (SEED-009; trigger gate cohort >= 30 testers)
- Pinecone vector substrate consolidation (Phase 127.1; separate workstream)
- Full hypergraph migration of EVERY binary edge (only add reified events where n-ary context is genuinely lost in binary form)
- Brain MCP write-path refactor (Phase 127 hardens read-path; write-path stays at curation-script tier)

## Open design decisions

1. **correlation_id format:** stable hash of `(canonical_name, primary_label)` OR UUID v7 with name->id lookup index? Hash is deterministic + idempotent; UUID is opaque + survives renames.
2. **Cross-label facet model:** store facets as a property array on canonical (`facets: ['Product','DictionaryTerm']`) OR as labels on the canonical node itself? Latter is queryable via `MATCH (n:Framework:Product)` but visually noisy.
3. **Hypergraph event-node naming:** AuthorshipEvent / IllustrationEvent / ... vs generic `Event` with type property? Specific types are queryable + indexable; generic Event keeps the schema smaller.
4. **Wire-It cluster sequencing:** RESOLVED 2026-06-01 -- breadth-first / whole-cluster batches. The depth-first preference was a Claude-4.7 context-window artifact ("mid-cluster context-switches"); 4.8 holds the full ~278-node cluster map in context, so larger reversible batches per pass are viable (keep the rollback-by-created_by discipline). See 132-REVIEW-4.8 section 2.
5. **Mindrian-internal team names in Brain:** RESOLVED 2026-06-01 -- PSEUDONYMIZE the 6 internal-team `:Person` nodes in the Brain, keeping the `mindrian_internal: true` flag. Rationale: the Brain MCP now ships to the testers tier (a shared surface), so the spirit of the "no real names in tracked files" hard rule applies to it. This is a content-cleanup task in pillar 3 (Sub-plan 132-04); not yet executed. See 132-REVIEW-4.8 decision 3.
6. **Backfill cadence for archived nodes:** correlation_id on archived nodes points where? Their REPLACED_BY canonical? Or leave correlation_id null on archived?

## Acceptance criteria

1. Every active (non-archived) teaching-graph node has a stable `correlation_id` property
2. `lib/brain/chain-recommender.cjs` returns one canonical target per query (no duplicate-target fork)
3. `bin/local-chain-recommender.cjs` references correlation_id, not name; resolves identical canonical to the Brain version when Brain is available
4. At least 5 reified event-node types exist with at least 20 instances each (Authorship, Illustration, Contradiction, Motivation, Evolution)
5. The 22 still-REVIEW_REQUIRED Frameworks from the 2026-05-17 audit are either anchored or moved to a `:Archived` label with REPLACED_BY pointing to canonical
6. The ~50 cross-label duplicate groups (Four Lenses, HEART, JTBD, Wicked Problem, Ackoff-class, etc.) collapse into one canonical per cluster with facets
7. `/mos:brain-derive --review-anchors` runs in < 5 seconds; `/mos:brain-derive --orphan-census` runs in < 10 seconds; `/mos:brain-derive --cross-label-dups` runs in < 15 seconds
8. CI gate: a release-candidate Cypher health check fails the build if any of the four health metrics breach threshold

## Reversibility

Every write carries `*_by = 'phase-132-curation-batch-N'`. Section 17 of the 2026-05-17 audit doc documents the rollback Cypher pattern. Same discipline extends to Phase 132 writes: each batch is reversible via REMOVE label / DELETE edge by created_by selector.

## Why this slot in the wave plan

Wave 7 (after Phase 131, before Phase 121.5) is the right slot because:

- Phase 131 lands the EvidenceClaim / cascade-edge contract -- Phase 132 ensures those edges land on canonical targets, not duplicates
- Phase 121.5 truth-telling pillar -- ships AFTER Phase 132 so its coherence claim is testable against a clean teaching graph
- Phase 127 chain-recommender ships in beta.1 -- Phase 132 prepares the graph the recommender reads; if 132 slips, recommender quality degrades silently across the entire beta train

If beta.6 is too late and Phase 132 must land earlier, the correlation_id backfill (132-01) and CI gates (132-05) are the lowest-effort highest-leverage subset that could ship in beta.4 alongside Phase 130, with hypergraph reformat + content cleanup deferring to beta.6 or v1.13.2.

## Pre-flight Brain prep available NOW (parallel to spec writing)

Per the user's "the brain can be Cypher-prepped to be ready" directive: the content cleanup portion of Sub-plan 132-04 can begin via direct Cypher writes BEFORE this phase formally enters /gsd:discuss-phase. The 2026-05-17 dogfooding session already executed: HEART anchor fix, 5 MUST-FIX Framework anchors, 6 Cluster B Person re-labels with AUTHORED edges, 5 C1 dedups, Ackoff first-pass fix, 559 nodes archived to `:Archived` label.

Remaining Cypher prep that can run iteratively without blocking Phase 132 spec discussion:
- Cluster A (~55 example ILLUSTRATES edges) -- needs framework target validation
- Cluster D (~80 concept CONTEXTUALIZES edges) -- mechanical pass possible
- Cluster F (~25 case-difference dedups) -- pure mechanical
- Other shattered-author cleanups (Drucker, Christensen, Senge, Meadows, de Bono)

The spec captures the architectural primitives (correlation_id, hypergraph events, CI gates) which require code + tests, not Cypher. Cypher prep does not block the spec; spec does not block the Cypher prep.
