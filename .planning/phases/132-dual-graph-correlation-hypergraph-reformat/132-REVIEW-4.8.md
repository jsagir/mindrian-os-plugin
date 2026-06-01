# Phase 132 - Re-baseline Review (4.7 -> 4.8) + forward-prep for 134 / 136

**Reviewed:** 2026-06-01
**Method:** 6-lens re-examination (intent / 4.7-to-4.8 / couple-134 / couple-136 / canon-reuse / scope-risk). The parallel agent fan-out was rate-limited server-side; this synthesis was completed directly with Tavily validation of the load-bearing technical claims.
**Phase under review:** 132 - Dual-Graph Correlation + Hypergraph Teaching-Graph Reformat, scoped 2026-05-17 under Claude 4.7.

---

## 1. Verdict

**rescope-before-plan (split).** The four pillars (correlation_id contract, hypergraph reformat, cross-label dedup, content cleanup) are each sound, but bundling a load-bearing ARCHITECTURAL PRIMITIVE (correlation_id + CI gates) with a HIGH brain-impact ~6000-node CONTENT REFORMAT in one 7-10 day phase is the central risk. Split: ship the primitive early and small; run the reformat as a separate, parallelizable workstream.

---

## 2. The 4.7 -> 4.8 re-baseline

- **Open decision 4 (Wire-It cluster sequencing) is now moot.** The CONTEXT debates depth-first vs breadth-first because a 4.7 session suffered "mid-cluster context-switches." 4.8 holds the full ~278-node cluster map in context, so breadth-first batching (or whole-cluster passes) is viable; the depth-first workaround was a 4.7 context-window artifact.
- **The ~278-node content cleanup is more autonomous under 4.8.** This is mechanical-with-judgment relabel/wire work (ILLUSTRATES, CONTEXTUALIZES, INSTANCE_OF). 4.8 can execute larger reversible batches per pass with the rollback-by-created_by discipline already specified. Raise batch size; lower the number of human checkpoints (keep the reversibility gate).
- **Cross-label dedup canonical-pick can be model-judged, not hand-curated.** The "most-edged + primary-label-preferred" heuristic plus 4.8 judgment can resolve the ~50 cross-label groups with a human-confirm only on the ambiguous tail, rather than one-by-one.

---

## 3. Forward-prep for Phase 134

**Good news: correlation_id is embedding-INDEPENDENT, so there is no hard collision with 134's re-vectorization question - but make that independence explicit.**

- **correlation_id is name-based, not vector-based.** The CONTEXT defines it as a stable hash of `(canonical_name, primary_label)`. 134's open-question-2 worries about whether transformers.js embeddings drift from the current Pinecone index and force a re-vectorization. Because correlation_id keys on name+label (not on the embedding), a 134 substrate swap does NOT invalidate it. **Add an explicit note:** "correlation_id is embedding-independent; safe under any Phase 134 / 127.1 vector-substrate change." This turns a latent worry into a stated invariant.
- **Coordinate with the parked Pinecone work (127.1), not 134.** Pinecone consolidation is Phase 127.1 (parked on a 7-day soak per the source RCA). 132's content reformat changes the Neo4j teaching graph; if 127.1 later moves vectors Pinecone -> Neo4j HNSW, 132's node set is the thing being indexed. Note the dependency so 132's archival (`:Archived` label) is respected by any future re-index (do not re-vectorize archived nodes).
- **Package-name correction (validated, shared with 134/131).** Wherever the embedding lib is referenced downstream, it is `@huggingface/transformers` (Transformers.js v3+), not `@xenova/transformers`. Source: huggingface.co/blog/transformersjs-v3.

---

## 4. Forward-prep for Phase 136 (render spine, soft-dep)

- **The Part 8 split is the key subtlety.** 132 reformats the BRAIN teaching graph (Neo4j, remote). 136 renders the LOCAL room.db graph. They never share node storage (Canon Part 8: no user data in the Brain). The coupling is INDIRECT: 136's LazyGraph suggestion slot and dual-render consume `chain-recommender` output, and the chain-recommender reads the teaching graph 132 cleans.
- **The contract 136 depends on:** 132 acceptance criterion 2 ("chain-recommender returns one canonical target per query, no duplicate-target fork"). If the teaching graph still forks across cross-label duplicates, 136's suggestion slot shows duplicate/again-wrong targets. **Lock criterion 2 as a "consumed by Phase 136 LazyGraph slot" contract** and add it to 136's soft-dep note. This is the single most important 132 -> 136 alignment.
- **Hypergraph event nodes are teaching-graph-internal.** The 5 reified events (Authorship/Illustration/Contradiction/Motivation/Evolution) enrich chain-recommender quality; 136 renders the RESULT (a cleaner suggestion), not the event nodes themselves. No render contract is needed for them - good, this keeps 136 decoupled.

---

## 5. Canon + reuse corrections (Part 7 / 8 / 9)

- **Part 8 boundary is correctly stated** ("correlation contract is enum projection only; no user content leaks to Brain"). This is the only phase touching the Brain teaching graph; the brain-boundary-scan must pass on every new code path (chain-recommender + local-chain-recommender changes).
- **Part 9 local writes** must reference correlation_id, not raw name (CONTEXT 132-01 says so). Verify navigation.cjs memory_event references carry correlation_id at plan-time.
- **Reuse:** correctly extends `lib/brain/chain-recommender.cjs` (shipped Phase 122) and `bin/local-chain-recommender.cjs` (Phase 127). Confirm those signatures at plan-time.

---

## 6. Scope / reverse-salient / sequencing

- **Reverse salient:** the ~6000-node correlation_id backfill + ~50 cross-label dedup groups - the largest, least-reversible-feeling operation, and the one most likely to silently degrade chain-recommender quality across the whole beta train if it slips. The CONTEXT itself flags the split escape hatch ("132-01 + 132-05 could ship in beta.4 alongside Phase 130").
- **RECOMMENDED SPLIT:**
  - **132A - the primitive (small, early, load-bearing):** correlation_id contract (132-01) + the CI gates (132-05). This is what 131 and 136 depend on. Ship it BEFORE or WITH 131.
  - **132B - the reformat (parallelizable, lower coupling):** hypergraph events (132-02) + cross-label dedup (132-03) + content cleanup (132-04). Can run as Cypher-prep in parallel (the CONTEXT already notes "pre-flight Brain prep available NOW") and land over a longer window without blocking the v1.14.0 render-spine chain.
- **Sequencing flip:** the current plan is 131 -> 132. But 131's cascade edges should land on canonical correlation_ids. So **132A (correlation_id) must precede 131**, while 132B can trail. This is the highest-leverage sequencing change in the whole 131/132/134/136 cluster.

---

## 7. Proposed CONTEXT.md changes

| Target | Change | Priority |
|--------|--------|----------|
| Scope / wave plan | Split into 132A (correlation_id 132-01 + CI gates 132-05; ships early, before/with 131) and 132B (hypergraph + dedup + content cleanup; parallel/trailing). The CONTEXT already hints this in "Why this slot" - promote it to the scope. | must |
| New invariant note | "correlation_id is name-based and embedding-INDEPENDENT - safe under any Phase 134 / 127.1 vector-substrate change." | must |
| Acceptance criterion 2 | Tag "no duplicate-target fork" as "consumed by Phase 136 LazyGraph suggestion slot"; add to 136's soft-dep contract. | must |
| Open decision 4 | Resolve to breadth-first / whole-cluster batches (the depth-first workaround was a 4.7 context-window artifact). | should |
| Content cleanup (132-04) | Note 4.8 executes larger reversible batches with fewer human checkpoints (keep rollback-by-created_by). | should |
| Pinecone coordination | Add a note: archived (`:Archived`) nodes must be excluded from any future 127.1 re-index. | nice |
| Any embedding ref | `@huggingface/transformers`, not `@xenova/transformers`. | nice |

---

## 8. Decisions that need Jonathan

1. **Approve the 132A / 132B split?** (Recommend yes - it de-risks the whole v1.14.0 chain and matches the CONTEXT's own escape hatch.)
2. **Approve the sequencing flip** (132A correlation_id before 131)?
3. **Brain MCP sharing + real-team-names** (CONTEXT open decision 5): keep `:Person mindrian_internal:true`, or pseudonymize in the Brain too now that the Brain MCP ships to the testers tier? (Canon "no real names in tracked files" does not cover the Brain, but the testers-tier MCP exposure is a new surface.) This is a privacy call only you can make.

---

## 9. Sources (Tavily-validated)

- Transformers.js v3 rename to `@huggingface/transformers` (shared finding with 131/134): https://huggingface.co/blog/transformersjs-v3
- `@xenova/transformers` deprecation: https://github.com/huggingface/transformers.js/issues/1484
- multilingual-e5-large ONNX 1024-dim (the current Brain embedding dim): https://huggingface.co/Qdrant/multilingual-e5-large-onnx
- (Neo4j reified-event-node / correlation-id best-practice was not separately re-validated in this direct pass; the hypergraph design in the CONTEXT is internally consistent and follows the standard "reify the n-ary relationship as a node + binary edges" pattern. Flag for a targeted Tavily check at plan-phase if the event-node schema is contested.)
