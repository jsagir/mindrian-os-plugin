---
id: SEED-080
status: dormant
planted: 2026-08-21
planted_during: v2.1.0 milestone, phase 261 (Enrichment Ceremony) planning
trigger_when: after phase 263 closes (v2.1.0 milestone complete) — surface at the next /gsd-new-milestone scan
scope: large — a full milestone, not a quick task
---

# SEED-080: Consolidate the reverse-salient/wicked-problem/value-proposition/trend-analysis/user-experience/life-cycle/taxonomy-of-problems corpus family in the Brain graph

## Why This Matters

Investigated 2026-08-21 while scoping Phase 261's CER-06 (Four Lenses of Innovation payload), in
response to the navigator asking whether a broader book/chapter corpus (Trending to the Absurd,
Scenario Analysis, Nested Hierarchies and Red Teaming, Trend Analysis, User Experience,
Challenging Orthodoxies, Reverse Salients and Life Cycles, and others) was "properly ingested to
the graphrag and graph notes... properly connect all data in nested db's".

Answer, investigated live against canon rather than assumed: **the content mostly already
exists**, but it is badly fragmented, not properly connected. Concrete evidence, all from a live
`brain_query` census run this session:

- **"Reverse Salient" alone has 15+ near-duplicate nodes** across `Concept`/`Product`/
  `DictionaryTerm` labels (`Reverse Salient`, `Reverse Salients`, `reverse salient`,
  `reverse salients`, `Reverse Salient Concept`, `Reverse Salient Confidential`,
  `Reverse Salient Problems`, `Reverse Salients Comparable`, etc.) alongside the one clean
  Framework node that should be canonical (`Reverse Salient Analysis`, id 34088).
- **Several "Wicked Problem" nodes carry giant `<SEP>`-concatenated descriptions** — literal
  evidence of multiple unmerged ingestion passes stitched into one field instead of deduplicated
  (e.g. node 28484, "The Innovation Framework", has a multi-thousand-character description that is
  visibly 4-5 different source descriptions joined by `<SEP>`).
- **50 raw, unprocessed source chunks sit disconnected from the graph proper**:
  `N04_Wicked Problems.pptx.txt - Chunk 1` through `Chunk 50`, `:Chunk`-labelled, never structured
  into the framework/concept layer.
- Similar fragmentation confirmed for "Wicked Problem(s)" (12+ variants), "Value Proposition"
  (dozens of Concept/Product/DictionaryTerm nodes plus the one real Framework, id 23366), "Trend
  Analysis" (6+ variants), "User Experience" (7+ variants), "Life Cycles" (10+ variants).

This is not a missing-content problem, it is a consolidation/dedup problem — and it already has a
name and a queue slot that predates this finding: `SCHEMA.md`'s reconciliation ledger (in
`ProblemsWorthSolving-Brain`) lists **"Wave 2: chimera split, bare-`__Entity__` relabel,
dupe-group judgment — QUEUED (worklist: docs/wave2-worklist-2026-08-18.md)"**. This is the same
entropy Phase 258's own census already measured graph-wide: 800 chimera nodes (multi-primary-label),
453 nodes on deprecated labels, 3,851 Tier-1/2 orphans. The corpus in this seed is a concrete,
worked example of that larger, already-known problem — not a new discovery of a new problem.

**Navigator ruling 2026-08-21:** do not incorporate into the current 258-263 chain. Seed it as the
next phase/initiative after 263 closes, given the scale (a full milestone's worth of consolidation
work, not a quick fix folded into an already-running admin-window ceremony).

## When to Surface

**Trigger:** after Phase 263 closes and the v2.1.0 milestone is complete — surface at the next
`/gsd-new-milestone` scan, or sooner if the navigator explicitly asks for a Brain-corpus-quality
initiative.

This is deliberately sequenced AFTER 258-263, not folded in, per the navigator's own ruling: 261's
admin window is already scoped (CER-01 through CER-06) and adding a corpus-wide consolidation pass
mid-ceremony would risk exactly the kind of undisciplined bulk write D-08/D-11's carded-execution
rules exist to prevent.

## Scope Estimate

**Large.** This is not a single payload. At minimum it needs:
1. Its own live census of the affected node families (this seed's investigation covered ~7 named
   topics as a sample; the real scope is likely the full existing Wave 2 worklist plus whatever
   this session's sample surfaced that Wave 2's original worklist did not already cover).
2. A dedup/merge design per cluster (which node is canonical, how are the duplicates' distinct
   content merged rather than discarded, how are `<SEP>`-concatenated descriptions actually split
   and reconciled rather than left concatenated).
3. Processing the 50 disconnected `Chunk` nodes (and any other similar raw-source residue) into
   the structured graph, or an explicit ruling that they stay as unlinked source material.
4. Its own admin-window ceremony, under the same D-08/D-11 carded discipline as every other write
   this milestone has made (dry-run every merge, navigator approval per cluster or per batch,
   measured-not-predicted verification, GRAPH-WRITE-LOG row).

## Breadcrumbs

- `ProblemsWorthSolving-Brain/SCHEMA.md` section 7 (Reconciliation status ledger) — "Wave 2" row,
  and `docs/wave2-worklist-2026-08-18.md` (the existing, pre-dating worklist this seed's scope
  should reconcile against, not duplicate).
- `ProblemsWorthSolving-Brain/docs/census-2026-08-20.md` (Phase 258's post-window census — the
  800 chimera / 453 deprecated-label / 3851-orphan baseline this corpus is one instance of).
- `ProblemsWorthSolving-Brain/docs/2026-08-21-SOURCE-four-lenses-of-innovation.md` (the Phase 261
  CER-06 source material whose scoping conversation surfaced this seed — Four Lenses itself was
  NOT found fragmented the same way, it is genuinely new content, unlike the 7 topics this seed
  covers).
- `.planning/phases/261-enrichment-ceremony-single-admin-window/261-RESEARCH.md` (Phase 261's own
  research, for the D-08/D-11 carded-execution pattern this future work should reuse).

## Notes

Captured live during Phase 261 planning, with a real census run (not assumed) backing every claim
above. The navigator's own framing was "don't incorporate it, seed it to be next after" — this
file is that seed. Run `/gsd-capture --seed --enrich SEED-080` if the trigger/scope need revision
before the next milestone scan, though both are already filled in with real detail here rather
than left as defaults.
