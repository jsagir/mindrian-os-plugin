# Phase 353 - Research grounding index (2026-09-17)

The navigator's directive for this phase: "do it end to end; consult langtalks, the icm-architect and Jev; Jev can help, ICM can explain." Three consults ran before planning. Each has its own file; this index says what each one settled and what the planner must still decide.

| Consult | File | What it settled | Verdict |
|---|---|---|---|
| icm-architect (method) | `353-RESEARCH-GROUNDING-icm.md` | Which of the ten invariants bind (1, 2, 4, 7, 8, 9 hard; 5, 6, 10 apply; 3 not applicable, stated), the five-layer mapping with token bands (L2 ruling document 200-500 tokens, per-turn read under 400), the six walk-test checks the two doctor modules must encode, and the authority rule (map is truth, block is view; ledger is truth, `default_methodologies` is view). | GROUNDED in the method the design already claims. |
| Jev (TypeSafe, structure only) | `353-RESEARCH-GROUNDING-jev.md` | The section job canon (OQ-353-1) as a measured table: four sections unambiguous, two with a declared secondary, four exposing a vocabulary gap. Recommendation: extend the closed vocabulary by four members (`model-business`, `model-finances`, `protect-assets`, `design-solution`). Cost and latency of the probe recorded for the release-time rebuild. | MEASURED; navigator ratifies the canon once. |
| langtalks-graph-expert (corpus) | `353-RESEARCH-GROUNDING-langtalks.md` | Three BFS queries returned nodes and zero edges; targeted paths found co-mentions only. Three readings surfaced (arxiv 2603.14828 on provenance pointers in GraphRAG; SDS 985 on agent memory types; one episode on precomputed intelligence vs latency). No claim grounds or contradicts the design. | NOT IN THE CORPUS YET (honest answer per the consult rule). |

## What the planner inherits from the consults

1. The section job canon draft (Jev table) plus the vocabulary extension as the default; ratification is one navigator act at plan review, recorded in the canon file's frontmatter.
2. The ruling document's shape: six generated parts above the authored Inputs / Process / Outputs / Human check, with the `Do NOT load:` line and exactly one human check preserved (invariant 4), and the L2 band respected by pushing overflow to `references/SECTION-SCHEMA.md` (invariant 7).
3. The doctor modules' check list (walk test items 1-6) and the authority rule as the drift definition.
4. The per-turn budget as a measured number on fixture rooms (success criterion 2), not an estimate.
5. Three readings to cite as readings only.

## What the consults did not settle (planner decides, navigator ratifies where marked)

- WD-353-1 defaults (top-K 3, confidence floor 0.5, recency 5, gate `flag`).
- WD-353-2 the anchor edge type against `edges.cjs`'s allow-list.
- OQ-353-2 the Theo-side Section-node emission (dependency, not a blocker).
- Whether the four new vocabulary members are also adopted by any command in this phase (default: no; commands adopt them later).
