# SEED-052 - GSD each /mos: command as its own mini-product (JTBD + audience + F-shape, properly specced)

**Registered:** 2026-07-05 (navigator-directed, mid Windows commands-missing bisect)
**Class:** ARCH + PRODUCT | **Status:** seed
**Grounding:** direct continuation of the 2026-07-05 reflection already logged against Phase 213's ROADMAP scope addendum and Phase 191's reopened-checklist follow-up (both committed 2026-07-05, `5c164c19` + `4090d99f`). Also grounded in the real, already-filed command-research corpus: `room/command-research/` (116 ROOM.md: 12 cluster + 103 command sub-rooms), `.planning/research/command-map/` (103 dossiers + INDEX.md), `room/.mindrian/room.db` (12 domain + 103 subdomain nodes, 710 RELATED_TO edges - all verified live this session).

## The gap this closes

Phase 213's addendum already states the real intent of the 188-205 arc: use each command's JTBD, audience (admin/user-facing), and declared F-shape to build a LarryReacts that RECOMMENDS (never triggers) the right next command. That addendum also found the raw material already exists - JTBD/F-shape/admin-visibility are in `commands/*.md` frontmatter + `data/command-registry.json`, and Phase 191 is ~85% of the recommend-engine already.

What's still missing is treating EACH of the 107 commands as a properly GSD-cycled mini-product in its own right - not just a frontmatter row. Today a command's "spec" is whatever fits in its frontmatter + body prose; there is no per-command discuss/spec/plan discipline the way a phase gets one. The command-research dossiers (`.planning/research/command-map/*.md`) are a ONE-TIME research snapshot (2026-07-01), not a living spec - they were explicitly scoped in the Phase 213 addendum as enrichment input, not a fourth runtime data path, and that framing stands. This seed is about the PRODUCT-MANAGEMENT gap, not a new data path: does every command have a clear, defensible JTBD; is its audience (admin/user) actually enforced everywhere it should be (Phase 191's addendum already found `visibility: admin` is NOT wired into the recommendation scorer); is its declared F-shape actually the right one (see the parallel finding this session: default to the plain native AskUserQuestion shape for anything non-checkbox, reserve custom multi-axis shapes like F.1's lanes-as-tabs for cases that are genuinely justified, not because it happened to be built that way).

## Why now, why not folded into Phase 213

Phase 213 is about wiring the eureka-sensor into the existing recommend machinery - a focused, already-scoped phase, currently blocked on the curing-sequence verdict. GSD-ing 107 commands as individual mini-products is a much larger, orthogonal initiative: per-command discuss/spec passes, JTBD defensibility review, F-shape audit, audience/visibility enforcement audit. Bundling it into 213 would blow that phase's scope. Keeping it as its own seed lets it graduate to its own phase(s) later, informed by (not blocking) 213.

## What "GSD each command as a mini-product" concretely means (first pass, not final)

- **Spec pass per command (or per cluster of 5-10 related commands, to avoid 107 isolated cycles):** does this command have a clear, single JTBD; is its `help_jtbd` honest; does its frontmatter's `serves_jtbd` match what it actually does.
- **Audience/visibility audit:** which commands are admin-only (`visibility: admin`, `connector.excluded`) vs user-facing, and - the concrete gap Phase 191's addendum already found - wire that distinction into the recommendation scorer so LarryReacts never recommends an admin-only command to a non-admin navigator.
- **F-shape audit:** does each command's declared `hitl_shape` match the navigator-stated default-to-native-AskUserQuestion principle (2026-07-05, this session) - i.e. is a custom/complex shape (F.1 lanes-as-tabs, F.5 branching, F.8 multi-select, F.9 ordered cascade) actually justified for THIS command, or was it over-built and should default down to the plain native single-select card.
- **Relationship/chain accuracy:** cross-check `data/command-registry.json`'s `curated_chains` + `lib/brain/chain-recommender.cjs` FEEDS_INTO edges against the command-research corpus's chains table (`.planning/research/command-map/INDEX.md`) - the corpus was built from real per-command dossier research and may catch chain edges the hand-maintained registry missed.
- **Reuse-before-build (Part 7):** the dossiers + room.db graph are the enrichment INPUT for this pass, not something to requery live - read them once, backfill thin frontmatter fields, then treat `commands/*.md` + `command-registry.json` as canonical again (same rule the Phase 213 addendum already established for the recommend-engine at large).

## Relationship to sibling seeds

- **SEED-049/050 (Eureka generator + critic, Phases 211-215):** a different, parallel capability - the eureka-reach is ONE candidate LarryReacts surfaces; this seed is about getting the other 106+ candidates' underlying JTBD/audience/shape correct so the WHOLE recommend surface (not just the eureka sensor) is trustworthy.
- **Phase 191 follow-up (reopened 2026-07-05):** closing 191-03/191-05 + wiring the admin-visibility filter is the FIRST, smallest slice of this seed's scope - not separate work, just the part that was already gap-identified and small enough to close immediately.
- **Phase 213 addendum:** this seed is the deeper, broader version of the same "real intent" reflection - 213 wires one sensor into the existing recommend machinery; this seed is about making sure all 107 commands the machinery recommends FROM are individually sound.

## The smallest experiment (do not scope-explode)

1. Pick ONE cluster (the command-research INDEX.md already has 12 clusters) as a pilot - probably the smallest or highest-risk one (e.g. `system-admin`, since it's exactly where the audience/visibility gap lives).
2. Run the spec/audience/F-shape audit above against that cluster's ~5-10 commands only.
3. Confirm the audit surfaces something real (a wrong visibility flag, a mismatched JTBD, an over-built shape) before committing to all 12 clusters / 107 commands.
4. If it does, graduate this to a phase, sized per-cluster (12 small phases or one phase with 12 waves), not one 107-command mega-phase.

## Provenance

Grew directly out of the 2026-07-05 conversation: the navigator's reflection on the real, unachieved purpose of Phases 188-205 (JTBD/audience/F-shape-aware LarryReacts, not just sub-room filing) -> a forked research pass confirming the raw material already exists and updating Phase 213 + Phase 191's scope -> the navigator explicitly widening the ask to "GSD each command as a mini-product" while the live Windows commands-registration bug (107 files on disk, only a fraction surfacing in the picker) was still being root-caused in parallel. Registered as its own seed, deliberately NOT actioned yet, per the navigator's own chosen sequencing: finish the live bug first.
