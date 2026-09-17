# Phase 353 grounding - icm-architect consult (2026-09-17)

Consulted: the `icm-architect` skill (Interpretable Context Methodology, Van Clief and McDermott, arXiv:2603.16021), `references/core.md` (five-layer hierarchy, token discipline) and `assets/templates/stage-CONTEXT.md`. Standing consult per the dev rule; this file records what binds Phase 353 and what the walk test must check.

## Which invariants bind, and where in the phase

| Invariant | Binds | Where it lands |
|---|---|---|
| 1. One folder, one job; the folder states its own purpose inside itself | HARD | The section `job_id` and JTBD sentence live in the section's own ROOM.md (`job_id`, `statement`) and in part 1 of its ruling CONTEXT.md. A sub-room without a declared job violates this and is flagged, never guessed. |
| 2. A small, stable entry file that routes and never holds content | HARD | The root ROOM.md keeps its routing role; its `icm_self` block is a pointer set (children as bare names), not a content payload. The room map is tooling-side; the model never reads the map. |
| 4. Every folder-level contract is explicit: inputs, process, outputs, human check | HARD | The six generated parts (job, methodology sequence, writing rules, gates, checks, commands that write here) sit ABOVE the authored Inputs / Process / Outputs / Human check prose, never replace it. The stage template's `Do NOT load:` line stays authored and mandatory. Exactly one human check per section (the gate in part 4 names it, the authored prose states it as an act). |
| 7. Load only what the step needs (2k-8k tokens per step) | HARD, measured | Per turn: one `icm_self` block (60-120 tokens) plus the active folder's ruling sequence, under 400 tokens total (success criterion 2). The L2 contract band in core.md is 200-500 tokens; a ruling document that grows past that pushes detail into an L3 reference (`references/SECTION-SCHEMA.md`) and points at it. |
| 8. Plain text, linkable, queryable; one home per fact, a link beats a copy | HARD | `.mindrian/room-map.json` is the one home of self-location; every `icm_self` block is a fingerprinted derived view. `data/section-command-ledger.json` is the one home of relevance; `default_methodologies` becomes a derived view. The `jtbd:<job_id>` node is the one home of a folder's job inside the graph; claims link to it. |
| 9. The filesystem is the state machine; generated indexes are rebuilt by script, never hand-edited | HARD | Map, self blocks, ruling documents and the ledger are generated and fingerprinted; the doctor fails on hand-edits (fingerprint drift). Status (which folders have a job, which claims are anchored) is derivable by scanning. |
| 3. Numbering encodes order | Not applicable | Section order is not a pipeline order; the methodology SEQUENCE inside a section is carried by the ruling document's ordered list, not by folder numbering. Stated call. |
| 5. Factory vs product | Applies | Canon (section job table), the ledger and the writer contracts are factory (shipped data); ruling documents are generated product per room; the authored prose in each CONTEXT.md is the room's own factory configuration. |
| 6. Every output is an edit surface | Applies with a twist | The generated parts are NOT an edit surface (they are rebuilt); the authored prose below them IS. The marked block boundary is what makes that honest. |
| 10. Instantiate by copying | Applies | New sections and sub-rooms are born from `templates/room-skeleton/` and then generated over; never from a blank page. |

## The five-layer hierarchy, mapped

| ICM layer | core.md band | Phase 353 artifact | Per-turn read? |
|---|---|---|---|
| L0 routing (where am I) | 300-800 tokens | root ROOM.md with `icm_self` | one block |
| L1 routing (where do I go) | 200-500 | root ROOM.md children list; `.mindrian/room-map.json` for tooling | no (tooling only) |
| L2 the control point (what do I do) | 200-500 | each section's ruling CONTEXT.md | the active folder's sequence only |
| L3 factory (what rules apply) | 500-2k | `references/SECTION-SCHEMA.md`, `data/section-command-ledger.json`, the section job canon | not per turn |
| L4 product (what am I working with) | varies | the section's artifacts and claims, each with an anchor edge | as today |

core.md, verbatim on why L2 is the control surface: "L2 is the control surface of the whole system - its Inputs section is what makes context selection explicit, editable, and auditable instead of left to agent judgment." Phase 353 extends that surface from Inputs to the methodology sequence and the writing rules, which is exactly the navigator's ask: a system of ruling, and of writing, per section.

## Walk-test checks the doctor modules must encode

From the skill's walk test, translated to `doctor room-map` and `doctor section-ruling`:

1. Open any folder cold: can the reader answer "which room, what part, what is under me" from the folder's own ROOM.md within one read? -> every directory has a ROOM.md; every ROOM.md carries an `icm_self` block whose fingerprint matches the map.
2. Pick any section: does its contract name the job, exact input paths, the output kind and one human check? -> ruling document parts 1-4 present; authored Inputs with exact paths preserved; exactly one human check.
3. Can status be stated by scanning? -> a section or sub-room without `job_id` is reportable; a claim without an anchor edge is reportable; no runtime state is needed to answer either.
4. Is any routing file carrying payload? -> the `icm_self` block carries names and counts only; a block with descriptions or prose fails.
5. Is any fact stored in two places? -> map vs block fingerprint match; ledger vs `default_methodologies` fingerprint match; drift fails.
6. Token check -> the per-turn read (one block plus one sequence) measured under 400 tokens on the fixture rooms; the full L2 contract inside the 200-500 band, with overflow pushed to L3.

## The authority rule, stated once

The map is the truth and the block is the view. A cold model reads the view because it is small and local; tooling reads the truth because it is complete. When they disagree, the doctor says so and `--fix` regenerates the view from the truth, never the other way round. The same rule holds for ledger vs `default_methodologies`. This is invariant 8 (one home per fact) plus invariant 9 (generated indexes are rebuilt by script), and it is why a hand-edit to a self block is a drift finding, not a preference.

## Guardrail the skill raises, answered

"Don't over-structure": the skill's ladder is chat -> saved prompt -> folders plus one agent, climbed only when the rung below is genuinely automated and repeating. Phase 353 climbs no rung: the folders already exist in 31 rooms and 390 section directories; the phase makes the existing structure carry its own contract instead of leaving the job implicit. The seven roots without ROOM.md and the 155 nested sub-rooms with inconsistent registry ancestry (fleet census, 2026-09-17) are the "same shape appearing three independent times" that the skill calls structure rather than gripe.
