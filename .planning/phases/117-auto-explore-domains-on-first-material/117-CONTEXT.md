---
phase: 117
slug: auto-explore-domains-on-first-material
status: stub
created: 2026-05-05
milestone: v1.13.0
beta_target: beta.3
canon_parts: [Part 2 Engine 1, Part 3, Part 10]
depends_on: [Phase 89-07 finish (ReverseSalientAgent), Phase 109 SQL spine]
dependents: [Phase 121 telemetry]
estimated_days: 3
---

# Phase 117 -- Auto-Explore-Domains on First Material

**STATUS:** STUB. Scaffolded 2026-05-05 for resumability. Plans not yet written.

## Goal

When material lands (CV uploaded, transcript filed, conversation paragraph
typed), auto-invoke `/mos:explore-domains` as a background job. Surface
findings as a Decision Gate option ("I scanned your CV -- here's what I
found. Want to explore?"). The user never has to remember to invoke the
math layer. Implements Canon Part 10 sub-claim 5 (triple-filter math
runs automatically).

## Why this exists

The Beautiful Question synthesis (2026-05-05) revealed that the
intelligence test is "non-obvious opportunities -- found by the math
layer they never have to invoke, surfaced at intersections and
whitespace, anchored by contradiction signals." All three components
ship today (/mos:explore-domains, /mos:whitespace, /mos:find-bottlenecks)
but they DON'T RUN AS ONE on first material received. This phase
wires the auto-invocation pattern.

## Scope

### IN SCOPE
- Hook: detect "first material lands in room" event
- Auto-invoke /mos:explore-domains with the new material as input
- Trigger HSI scoring + reverse salient + cross-domain match in parallel
- Compose findings into a single Decision Gate option (F.1 selector)
- SEED-003 A3 updatedToolOutput sanitizer pairs here for Part 8 hardening

### OUT OF SCOPE
- Real-time analysis on every typed character (only on artifact-filing
  events)
- Cross-room exploration (single-room v1.13.0 scope)
- Subscription/recurring exploration (one-shot per material)

## Sub-plans (anticipated)

- 117-00 First-material detection hook
- 117-01 Auto-invocation wiring (explore-domains background job)
- 117-02 Triple-filter composition (whitespace + reverse salient + cross-domain)
- 117-03 Decision Gate F.1 surface
- 117-04 SEED-003 A3 updatedToolOutput sanitizer integration
- 117-05 Telemetry integration (Phase 121)

## Acceptance Criteria

1. Upload a CV to a fresh room; /mos:explore-domains fires automatically
2. Findings surface within ~10 seconds via Decision Gate
3. User accepts/rejects via F.1 verbs; outcome captured in telemetry
4. No double-fire on subsequent uploads (rate-limited per-material)
5. Hooked audit Variable Reward axis: 4/10 -> 7/10 at beta.3 gate

## Cross-References

- `~/MindrianRooms/mindrian/mindrian-ecosystem/sub-rooms/website/mindrianos-conversion-fix/solution-design/breakthrough-scan-category-g.md` (sibling reward layer)
- `.planning/phases/89-reverse-salient-engine/` (89-07 finish dependency)
- `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md`
- `docs/CANON-PART-10-PROPOSAL-conversation-as-product.md` (sub-claim 5)

## v1.14.0 Forward-Reference (added 2026-05-07)

**Phase 117 ships in v1.13.0-beta.3. Its Auto-Explore findings will surface in
the wiki when v1.14.0 "The Visible Room" ships** (immediately after v1.13.0
final). When designing the Decision Gate F.1 composition output for Phase
117, structure findings to be navigable from the wiki view — they become the
canonical entry point users walk through to investigate cross-domain
matches, whitespace gaps, and reverse salient bottlenecks.

Specifically, Phase 117's findings should produce:

1. **Wikilink-shaped slugs** for every entity surfaced. The wiki sprint
   (Plan 104-03) implements section-to-section + cross-room hyperlink
   resolution; Phase 117's slugs must be resolvable.
2. **Frontmatter-compatible metadata** for filed artifacts (HSI score,
   confidence tier, source channel, hat-scope). The wiki sprint (Plan 104-03
   Wikipedia zones + Plan 104-05 freshness frontmatter) renders this as the
   infobox sidebar.
3. **Gap-detection output that the content gap dashboard can ingest.** Plan
   104-05 visualizes what `room-proactive` already detects; if Phase 117
   emits gaps in the same shape, the dashboard surfaces them automatically.
4. **Findings researchable on miss.** When a user clicks a Phase 117 finding
   via wiki and it has no canonical page, Plan 104-04
   (click-red-wikilink-to-research) fires the research pipeline.

The wiki + SnapshotHub fusion (2026-05-07) means Phase 117 findings will also
flow to external SnapshotHub exports. Findings should be public-shareable
where Canon Part 8 boundary permits (no LOCAL-only metadata in exports).

**Companion artifacts:**
- `.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md` (Phase 117 listed as dependent)
- `.planning/milestones/v1.14.0-VISIBLE-ROOM-ROADMAP.md` (cross-phase awareness propagation section)
- `.planning/phases/_backlog/v1.14-mindrian-wiki-sprint.md` (engineering memo)

Phase 117's CONTEXT was finalized 2026-05-05; v1.14.0 arc was named
2026-05-07. This forward-reference is post-hoc cross-phase awareness. Phase
117 execution does NOT depend on v1.14.0 — the dependency is one-way:
v1.14.0 consumes Phase 117 output. Phase 117 just needs to be SHAPE-AWARE
of the consumer surface.
