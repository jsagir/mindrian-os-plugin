# Phase 41: Hub Page - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Source:** docs/EXPORT-DESIGN-BRIEF.md

<domain>
## Phase Boundary

Enhance generate-snapshot.cjs index.html with full hub page content: stats bar, view cards grid, section cards with gap indicators, key insights, red team severity, methodology artifact cards, breakthroughs above fold, opportunities bank. This builds ON TOP of Phase 40's branded skeleton.

</domain>

<decisions>
## Implementation Decisions

### Stats Bar (HUB-01)
- **D-01:** 5 counters: Sections, Articles, Connections, Gaps, Grants
- **D-02:** JetBrains Mono font, large numbers, small labels below

### View Cards (HUB-02)
- **D-03:** 3-column grid of cards linking to co-located view HTML files
- **D-04:** Each card: tag label, title, description, "Open >" link
- **D-05:** Conditional -- grayed out with reason if no content for that view
- **D-06:** Views: Intelligence Map, Wiki, Doc Hub, Deck (actual files created in Phase 42)

### Section Cards (HUB-03)
- **D-07:** 4-column grid, one card per room section
- **D-08:** Populated sections: colored left border (section color), article count, latest article title
- **D-09:** Empty sections: dashed border, muted opacity, "No entries yet" text

### Key Insights (HUB-04)
- **D-10:** Max 5, extracted from graph edges + red team
- **D-11:** Priority: CRITICAL red team > CONTRADICTS > VALIDATES > MINTO governing thoughts > CONVERGES 3+ sections
- **D-12:** Always include at least 1 positive (VALIDATES) if one exists
- **D-13:** Render as quote cards with severity badge

### Red Team (HUB-05)
- **D-14:** Scan for methodology: red-team or methodology: challenge-assumptions in frontmatter, OR RED-TEAM-REPORT.md
- **D-15:** Render as 4 severity boxes: CRITICAL (red), HIGH (orange), MEDIUM (yellow), LOW (green)
- **D-16:** Skip section entirely if no red team data

### Methodology Cards (HUB-06)
- **D-17:** Detect methodology: field in article frontmatter
- **D-18:** Render with badge (diagnose, red-team, lean-canvas, etc.)

### Above-the-Fold (ATF-01, ATF-02)
- **D-19:** Breakthroughs: from ADJACENT_POSSIBLE graph nodes, blue-accented cards, silently skip if none (AD-8)
- **D-20:** Opportunities: scored list from funding-strategy/, relevance badge, funder, amount, deadline. CTA if none exist.

### Claude's Discretion
- Exact HTML/CSS for each component
- How to extract insights from graph.json edges
- MINTO.md parsing for governing thoughts

</decisions>

<canonical_refs>
## Canonical References

- `docs/EXPORT-DESIGN-BRIEF.md` -- Page structure wireframe, component specs
- `scripts/generate-snapshot.cjs` -- Generator from Phase 40 (ADD content to its template)
- `~/mindrian-website/website/src/components/shared/Card.tsx` -- Card pattern reference (READ ONLY)
- `~/mindrian-website/website/src/components/shared/SectionHeader.tsx` -- Section header reference (READ ONLY)
- `~/mindrian-website/website/src/lib/agents.ts` -- Section color maps (READ ONLY)
- `~/demo-cancer-room/room/` -- Test fixture with all content types

</canonical_refs>

<code_context>
## Existing Code Insights

- generate-snapshot.cjs already has room scanning, stats computation, section discovery
- The template already has header, footer, stats bar skeleton, section cards skeleton
- Need to ADD: insights extraction, red team parsing, methodology detection, breakthrough/opportunity rendering
- Graph.json already loaded -- need to query edges by type for insights

IMPORTANT: ~/mindrian-website/ is READ ONLY style guide. Never write to it. Only read component patterns.

</code_context>

<specifics>
## Specific Ideas

- Demo cancer room has: red team data, opportunities (funding-strategy/), methodology artifacts, graph with CONTRADICTS edges
- The hub page should look like the wireframe in EXPORT-DESIGN-BRIEF.md (Page Structure section)

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 41-hub-page*
*Context gathered: 2026-03-31*
