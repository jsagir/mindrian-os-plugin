# Phase 40: Generator Core + Branding - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Source:** docs/EXPORT-DESIGN-BRIEF.md (AD-1 through AD-14)

<domain>
## Phase Boundary

Create generate-snapshot.cjs -- a single Node.js script (zero npm deps) that reads a room directory and produces a snapshot folder. This phase builds the generator engine + branding. Hub page content and views come in later phases.

</domain>

<decisions>
## Implementation Decisions

### Generator Architecture (AD-1, AD-2)
- **D-01:** Output is a folder per snapshot: room/exports/{YYYY-MM-DD-HHmm}/ containing index.html + view files
- **D-02:** Generator reads room/ directory at export time, discovers everything (sections, articles, graph, meetings, opportunities)
- **D-03:** Read existing graph.json first. Check for "enriched" metadata field. If enriched=true, use all edge types. If not enriched or missing, fall back to CONVERGES-only keyword overlap
- **D-04:** Node.js, zero npm dependencies. Pure fs, path, crypto built-ins
- **D-05:** Generator produces a minimal but complete index.html with branding even if room is nearly empty (graceful degradation)

### Logo (from Design Brief)
- **D-06:** Real Mondrian grid mark SVG -- 5 rectangles with 2px gaps:
  ```
  [Blue 20x48] 2px [Red 12x22 / Yellow 12x24] 2px [Cream 8x48] 2px [Green 4x32]
  ```
- **D-07:** Header: full logo (icon + "MINDRIAN" wordmark) at height="40"
- **D-08:** Footer: icon only at height="24" + "Built with MindrianOS" text
- **D-09:** Bebas Neue MUST be loaded via Google Fonts CDN for wordmark
- **D-10:** Zero border-radius anywhere. Ever.

### Design Tokens (AD-4, AD-13)
- **D-11:** Hardcode all tokens from globals.css directly in the HTML template:
  - Backgrounds: --ds-bg: #1a1a1a, --ds-surface: #2d2d2d, --ds-elevated: #3a3a3a
  - Text: --ds-cream: #f5f1e8, --ds-muted: #a8a39f
  - Borders: --ds-border: #404040
  - Section colors: red #A63D2F, blue #1E3A6E, yellow #C8A43C, green #2D6B4A, sienna #B5602A, gray #5C5A56, amethyst #6B4E8B, teal #2A6B5E
  - Shadows: flat (0 0 0 1px), lifted (4px 4px 0)
  - Motion: 150ms ease, 200ms ease-out
- **D-12:** Typography: Bebas Neue (display), Inter (body), JetBrains Mono (data)
- **D-13:** Branding footer: "Built with MindrianOS" + 5-color Mondrian bar (red, blue, yellow, green, teal)

### Room Data Discovery
- **D-14:** Scan room/ for sections (directories with .md files)
- **D-15:** Read STATE.md for venture stage
- **D-16:** Read graph.json for nodes, edges, layers
- **D-17:** Count articles, connections, gaps, opportunities
- **D-18:** Detect methodology artifacts via frontmatter (methodology: field)

### Claude's Discretion
- HTML template structure and inline CSS organization
- How to embed the SVG logo (inline vs data URI)
- File reading error handling patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Brief (PRIMARY SOURCE)
- `docs/EXPORT-DESIGN-BRIEF.md` -- Full 564-line brief with AD-1 through AD-14, logo SVG, tokens, layout, quality checklist

### Existing Code to Extend
- `scripts/generate-export.cjs` -- Current generator (477 lines) -- reference for room reading patterns, DO NOT copy its template
- `scripts/build-room-graph.py` -- Graph builder (169 lines) -- reference for keyword overlap logic (fallback path)
- `dashboard/export-template.html` -- Current template -- reference only, Snapshot replaces this

### Logo Source
- `assets/logo.svg` -- Canonical SVG in repo
- Canonical URL: https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg

### Website Design System
- `~/mindrian-website/website/src/app/globals.css` -- Token source (already extracted into D-11)
- `~/mindrian-website/website/src/components/shared/Card.tsx` -- Card pattern reference
- `~/mindrian-website/website/src/components/shared/SectionHeader.tsx` -- Header pattern reference

### Test Fixtures
- `~/demo-cancer-room/room/` -- Complex test (36 nodes, 39 edges, red team, opportunities)
- `~/rooms/align-x-milken/room/` -- Stress test (30 pages, 295 edges)
- Empty room (mkdir + STATE.md) -- Graceful degradation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns from generate-export.cjs
- Room scanning: fs.readdirSync for sections, frontmatter parsing via regex
- Graph reading: JSON.parse(fs.readFileSync('graph.json'))
- Stats computation: section count, article count, edge count
- HTML template injection: template string with ${} placeholders

### What NOT to Reuse
- The old template HTML -- Snapshot has a completely different design system
- Cytoscape.js CDN in old template -- that goes in the Intelligence Map view (Phase 42)
- Tab-based navigation -- Snapshot uses co-located file links instead

</code_context>

<specifics>
## Specific Ideas

- The generator should be runnable standalone: `node scripts/generate-snapshot.cjs ./path/to/room`
- Also callable from /mos:export snapshot command (command wiring in a later phase)
- Graph.json enrichment check: look for metadata.enriched field or count edge types > 1

</specifics>

<deferred>
## Deferred Ideas

None -- staying within phase scope

</deferred>

---

*Phase: 40-generator-core-branding*
*Context gathered: 2026-03-31*
