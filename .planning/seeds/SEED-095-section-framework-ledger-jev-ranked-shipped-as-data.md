---
id: SEED-095
status: dormant
planted: 2026-09-17
planted_during: quick tasks after Phase 349 (Jev spikes 001-004)
trigger_when: when SEED-096 (Theo framework content backfill) is closed, or when the framework_index / reach ranking is next redesigned
scope: medium
---

# SEED-095: Section-scoped framework ledger, Jev-ranked over Theo's canonical frameworks, shipped as registry data

## Why This Matters

The 27-name `framework_index` in `data/connector-registry.json` is a tenth of what Theo
knows (410 canonical frameworks). Spike 002 showed Jev ranks Theo's frameworks by
first-move fit for a section at Spearman 0.59 / 0.63 / 0.82 / 0.19 against hand labels,
where graph degree (the current signal, the one the mentor report called wrong) scores
0.06-0.13, and 9-10 of every scenario's top 12 are frameworks the index cannot offer
(Effectuation, Dual-Use, Contextual Inquiry, Commander's Intent, ...). Each room section
has moves that fit it better than others; today nothing carries that per section.

Precomputable: sections x problem types x stages against 410 frameworks is a finite space
(~240 combinations, about $1 at the vendor-claimed rate). Shipped as data, users stay
keyless and never touch the vendor (navigator ruling 2026-09-17).

## When to Surface

**Trigger:** when SEED-096 (Theo content backfill) closes, because the ranking is only
trustworthy where candidate frameworks have real descriptions (305 of 410 are stubs
today), or when the reach ranker / framework_index is next redesigned.

## Scope Estimate

**Medium**: a build script (Theo pull via `brain-client.query` with bucketed,
parameterized predicates; Jev batched Score; emit `data/section-framework-ledger.json`
or per-section ICM files), a consumer in the reach / suggest_next path, tests, and the
release-train wiring (regenerate on `theo-resync`). The room-structure decision
(per-section ICM file vs one registry projection) routes through the `icm-architect`
consult per the standing rule.

## Breadcrumbs

- `.claude/skills/spike-findings-MindrianOS-Plugin/references/section-framework-ledger.md` (the recipe)
- `.planning/spikes/002-jev-section-framework-ranker/` (runner, fixture, results, report)
- `data/connector-registry.json` `framework_index` (27 names) and `data/command-registry.json` `produces` globs (50 of 113 name a section)
- `lib/core/brain-client.cjs` `query(cypher, params)`; Theo read allow-list at `~/Theo/src/mcp/content/find-frameworks-for-problem-type.ts`
- Rooms: `~/MindrianRooms/rethinking-mindrianos/research/2026-09-17-jev-typesafe-spikes-001-004-findings.md` (mirrored in `mindrianOS/research/`)

## Notes

Captured after the 2026-09-17 spike session. Dependency and IP egress rulings are recorded
in `.planning/spikes/MANIFEST.md` Requirements.
