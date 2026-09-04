# Phase 275: Enlarge Room Schema by ICM Layer - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Source:** SEED-084 (`.planning/seeds/SEED-084-enlarge-room-schema-layered-icm-structure-plus-notion-gap-close.md`) — 10 addenda + 1 ruling, sourced against Brain, Theo, live code, and the actual 2026-04-14 Notion primary-source template (screenshotted directly this session). Not a discuss-phase session — SEED-084's own trail is deeper than a typical discuss-phase produces, so this CONTEXT.md is synthesized from it directly rather than re-asking questions already answered with evidence.

<domain>
## Phase Boundary

Build the ICM layered context hierarchy (L0-L4) for real, per-room, for the first time — today `MindrianRooms/CLAUDE.md` claims L0-L4 but no room implements past L0/L1. Concretely:

- **L1 (routing/always-visible):** a `STATEMENT` field per section (frontmatter or tiny `STATEMENT.md`) — the one sentence always true, always visible.
- **L2 (contract):** the missing per-section `CONTEXT.md` — what the section reads/does/writes, human-check populated from the Feynman-Minto dual-test (SEED-075).
- **L3 (reference/factory):** a genuinely new `references/`/`_shared/` folder per room, holding the `venture_stage` axis schema (2026-09-02 ruling), the `default_methodologies` + `stage_relevance` schemas (both section-grain and `room-blueprints.json` family-grain), and the corrected command citations.
- **L4 (artifacts):** fix SEED-076's inline-content drift (sections that write real content into `ROOM.md` instead of dated entry files).
- **Section-set change:** grow `SECTION_NAMES` from 8 to 11 — add `opportunity-bank`, `funding`, `strategy`.

Out of boundary: `marketing-sales`, `research-documents` (deferred — see `<deferred>`), Brain `InnovationStage` wiring (zero runtime consumers, out of scope per SEED-084's own 2026-09-02 ruling).

</domain>

<decisions>
## Implementation Decisions

### Section-set (locked, `## RULING 2026-09-04` + `## ADDENDUM 2026-09-04g` in SEED-084)

- `SECTION_NAMES` grows 8 → 11: add `opportunity-bank`, `funding`, `strategy`.
- `opportunity-bank`: highest-evidence addition of anything checked this session — verbatim Theo book-canon hit (defines the Ill-Defined rung of the core taxonomy ladder), already used in 5/8 blueprint families, referenced by 9 commands, already has a registered color/label in `section-registry.cjs`, explicitly excluded from the schema today via a `// skip it silently` comment at `room-skeleton-scaffold.cjs:240`.
- `funding`: promoted on the audit leg (confirmed empty `funding/` shell in `launchpad-02`, 3 independent sources); no distinct Theo chapter but real product-audit grounding.
- `strategy`: new section housing Scenario Planning + Reverse Salient Analysis — two separately-chaptered Theo frameworks with a graph-asserted `FEEDS_INTO` link between them (Reverse Salient → Scenario Planning, confidence 0.65). Absorbs the dead `scenario-analysis` slug citations and the Reverse Salient family currently stuck at Tier 2 everywhere.
- `value-proposition`: explicitly NOT a new section. Ran a Larry/Brain devil's-advocate challenge (`## ADDENDUM 2026-09-04d`) — every grounded hit treats it as PWS's Triple-Validation third gate (venture-level), not a per-section concept. CORROBORATED independently by the actual Notion primary source (`## ADDENDUM 2026-09-04j`): Value Proposition and Business Model share the identical statement text and icon in the template itself. Fold as sub-structure inside `business-model`; do NOT add a per-section `value_proposition` field under the reserved PWS term (checked `lib/core/frontmatter-schemas.cjs` — no such field exists yet, this is a preventive naming catch).
- `meetings`: NO SCHEMA CHANGE. Already deliberately modeled as `STRUCTURAL_DIRS` (`section-registry.cjs:39`), not a scored section — a source that feeds sections, not a destination. Confirmed correct, not a gap.
- `marketing-sales`, `research-documents`: deferred, see `<deferred>`.

### L3 schema promotions (locked, `## ADDENDUM 2026-09-04` + `## ADDENDUM 2026-09-04e`)

- Promote `stage_relevance` AND `default_methodologies` from `SECTION_METADATA` (`lib/core/room-skeleton-scaffold.cjs:47-55`) into the new L3 `references/` file, at BOTH grains: per-section (`SECTION_METADATA`) and per-family (`data/room-blueprints.json`). Document which wins when they name different methodologies for the same section (currently unreconciled).
- Fix the propagation-gap defects found while grounding this (in scope for this phase's L3 pass, not a separate follow-up):
  - `domain-explorer` — DEAD, cited by `problem-definition` and `market-analysis`. No such command exists.
  - `scenario-analysis` — DEAD, cited by `market-analysis`, `business-model`, AND `financial-model` (3 citations). Live replacement: `/mos:scenario-plan` — retarget these citations to the new `strategy` section instead of patching them in place, per `## ADDENDUM 2026-09-04g`.
  - `trending-to-absurd` — LIVE but MISFILED: cited under `problem-definition`, actually produces to `room/opportunity-bank/trending-to-absurd/*`. Refile the citation to `opportunity-bank`.
  - `analyze-needs` — LIVE but MISFILED: cited under `team-execution`, actually produces to `room/market-analysis/jtbd-analysis/*`. Refile the citation to `market-analysis`.
  - `/mos:persona` produces to `room/team/*` — a fourth section-slug spelling (`team`, not `team-execution`), found in passing. Note in execution notes; same propagation-gap class, not a new one.

### `strategy` section command tiering (locked, `## ADDENDUM 2026-09-04g`)

Tier 1 (ground truth): `/mos:scenario-plan`, `/mos:find-bottlenecks`, `/mos:rs-experts`, `/mos:rs-explain`, `/mos:rs-fetch`, `/mos:rs-thesis`.

### `opportunity-bank` ↔ `funding` pipeline relationship (locked, `## ADDENDUM 2026-09-04i`)

These are sequential stages of ONE pipeline, not independent sections — confirmed verbatim in `commands/funding.md`'s own description ("Promote discoveries from opportunity-bank..."). Both sections' L2 `CONTEXT.md` contracts must name this relationship explicitly (`opportunity-bank` notes it feeds `funding` via `/mos:funding create`; `funding` notes it reads from `opportunity-bank`), not leave it as an implicit fact only the command source carries.

`funding`'s own nested sub-schema (document in the L3 reference, same promotion logic as `default_methodologies`):
- **Stage** (sequential, enforced, no skip/backward): `Discovered → Researched → Applying → Submitted`.
- **Outcome** (orthogonal, NOT a stage): `awarded` / `rejected` / `withdrawn`.

`opportunity-bank`'s own nested sub-schema (same treatment): Knight position (`risk` / `uncertainty` / `mixed`) + confidence score, per `commands/opportunities.md`.

### `funding` scope — LOCKED as of the primary-source check (`## ADDENDUM 2026-09-04j`)

The actual 2026-04-14 Notion template's own nested structure under "Funding Options" is exactly two types: **Dilutive Funding** (equity/VC) and **Non-Dilutive** (grants). `/mos:funding` today implements ONLY the non-dilutive half (100% Grants.gov/Simpler-Grants-sourced, zero equity/VC support — grepped and confirmed, zero hits for equity/VC/loan/crowdfund/angel anywhere in `commands/funding.md`). The L2 contract must name BOTH types explicitly. Whether to BUILD dilutive/equity tracking in this phase or scope the phase to non-dilutive-only and defer dilutive is Claude's Discretion at planning time (a real, now-precisely-named scope call, not a pre-existing decision) — see `<specifics>` for the full primary-source table this is drawn from.

### `solution-design` moat/defensibility Human-check (locked, `## ADDENDUM 2026-09-04f`, corroborated `## ADDENDUM 2026-09-04j`)

`solution-design`'s L2 `CONTEXT.md` Human-check field must include: *does this technical choice enable a feature that is hard to copy, or does it just solve the immediate problem* — cross-linked to `competitive-analysis` (the section that tests whether the claimed defensibility actually holds). Grounded in a repeated Larry heuristic across 3 shipped touchpoints (Lean Canvas's Unfair Advantage box, Build-Thesis's "defensible go/no-go" tagline, Theo's Sustaining-vs-Disruptive → Changing Terms of Competition edge) plus the primary Notion source itself nesting "Technology Stack" directly beside "Feature Planning" under Solution and Product. Cite `.claude/includes/moat.md`'s own doctrine ("the graph that knows WHEN to use WHICH prompt... is the moat") as the same causal shape one level down.

### Claude's Discretion

- Exact `STATEMENT` field format (YAML frontmatter key vs. tiny `STATEMENT.md` file per section) — SEED-084 names both as options, doesn't lock one.
- Whether dilutive/equity funding tracking gets BUILT this phase or the L2 contract documents the scope and defers the build (see funding scope above).
- `team-execution`'s Mentor-Profiles schema thickening (the original OQ-7 half-item about `SECTION_METADATA` being thin prose against real Mentor-Profiles usage) — named in the phase goal, not separately re-ruled by any SEED-084 addendum; use judgment on scope/depth.
- Exact migration path for rooms that already use `opportunity-bank` as a non-frozen slug today (the L4 migration story `## RULING 2026-09-04` flags as real execution work, not detailed further).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The full decision trail
- `.planning/seeds/SEED-084-enlarge-room-schema-layered-icm-structure-plus-notion-gap-close.md` — full detail source for every decision above. 10 addenda + 1 ruling. Read in full, not skimmed — this CONTEXT.md compresses it, it does not replace it.

### Code this phase extends (Canon Part 7 — do not re-propose the mechanism)
- `lib/core/room-skeleton-scaffold.cjs` — `SECTION_NAMES` (line ~36-44, marked `FROZEN TABLE CONTRACT` at line 351), `SECTION_METADATA` (line 47-55), `resolveBlueprintFamily` (line 255-257), `ROOM.md` frontmatter writer (line 367-372).
- `lib/core/section-registry.cjs` — `STRUCTURAL_DIRS` (line 39), section color/label registry (`opportunity-bank` already at line 31).
- `data/room-blueprints.json` — family-grain `default_methodologies`, validated by `scripts/check-room-blueprints.cjs`.
- `data/command-registry.json` — the `produces` field is the ground-truth signal this phase's whole command-tiering analysis is built on; re-verify against it at plan time, do not assume the tiering in SEED-084 is still current.
- `lib/core/frontmatter-schemas.cjs` — confirm no `value_proposition` field gets added here.
- `commands/opportunities.md`, `commands/funding.md` — the pipeline relationship and both sections' nested sub-schemas.
- `.claude/includes/moat.md` — cite directly in `solution-design`'s L2 Human-check.
- `tests/test-blueprint-scaffold.cjs`, `scripts/check-room-blueprints.cjs` — existing test/validation surface this phase's schema change must keep green.

</canonical_refs>

<specifics>
## Specific Ideas

**The full command tiering (all 113 commands, 10 sections) is in SEED-084's `## ADDENDUM 2026-09-04e`** — Tier 1 (ground truth), Tier 2 (framework-matched judgment calls), Tier 3 (63 room-wide infrastructure commands, same pool for every section). Reuse this table directly rather than re-deriving it; re-verify against `data/command-registry.json` since it may have changed since 2026-09-04.

**The full 2026-04-14 Notion primary-source template, transcribed in full, is in `## ADDENDUM 2026-09-04j`** — all 10 top-level sections and their nested items, including the Dilutive/Non-Dilutive funding split and the Technology Stack/Feature Planning adjacency.

</specifics>

<deferred>
## Deferred Ideas

- `marketing-sales` — NOT added this phase. Zero code/Theo grounding, but the primary source (`## ADDENDUM 2026-09-04j`) shows it has real specific intended content (Marketing Strategies + Sales Strategies & Pipelines) that was simply never built. Worth re-raising at a future phase, not rejected.
- `research-documents` — NOT added this phase. Primary source shows it as a thin, single generic document library by design — low priority.
- Brain `InnovationStage` wiring into a room — explicitly out of scope per the 2026-09-02 addendum (zero runtime consumers anywhere in this repo today).
- The Theo-side gap that `/mos:opportunities` carries zero resolved framework (`## ADDENDUM 2026-09-04b`) — a Theo-side fix, out of this repo's scope per the R20 two-engine boundary in `CLAUDE.md`.

</deferred>

---

*Phase: 275-enlarge-room-schema-by-icm-layer-notion-gap-close-icm-architect-audit-convergence*
*Context gathered: 2026-09-04, synthesized directly from SEED-084's decision trail*
