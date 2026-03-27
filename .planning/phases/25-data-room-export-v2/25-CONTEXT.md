# Phase 25: Data Room Export Template v2 - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** Conversation design session + two reference HTML files

<domain>
## Phase Boundary

Replace the current export system with a canonical single-file HTML export template that works for ANY MindrianOS user's data room. The template combines the best of two proven designs: Black Domain's easy sidebar navigation with PolygonEye's De Stijl Mondrian grid + multi-view architecture. The export script reads room/ state dynamically and embeds everything into one self-contained HTML file (no external dependencies).

**Parallel session context:** A generate-standalone script is being built that:
1. Runs build-graph to get fresh graph.json
2. Reads dashboard/index.html
3. Embeds graph.json into the HTML
4. Outputs a self-contained file

This phase defines the HTML TEMPLATE that script embeds into. The script wiring is a separate task.

</domain>

<decisions>
## Implementation Decisions

### Architecture: Four-View Layout (from PolygonEye)
- **Overview**: Mondrian grid painting — colored cells for each room section, clickable to open documents. Asymmetric grid layout. Stage badge. Section metadata (entry count, summary).
- **Documents**: Side rail (section color) + content area + TOC sidebar. Markdown rendered to HTML. Frontmatter infobox. Back button returns to overview.
- **Intelligence**: Gaps (structural holes), Convergence (cross-section themes), Contradictions (internal tensions), with severity badges. Reads room intelligence data.
- **Graph**: Cytoscape.js knowledge graph. Section nodes (colored squares), meeting nodes (diamonds), speaker nodes (circles). Convergence/contradiction edges. Legend + stats sidebar.

### Navigation: Hybrid (from both references)
- Top bar: project name + stage badge + view switcher (Overview / Intelligence / Graph)
- In Document view: sidebar navigation with section list (like Black Domain) for quick browsing between sections without returning to overview
- Section dots indicate active (has entries) vs empty (gap)

### Design System: De Stijl (strict)
- Colors: `--mondrian-red: #C23B22`, `--mondrian-blue: #1B3B6F`, `--mondrian-yellow: #E8B931`, `--mondrian-black: #1A1A1A`, `--mondrian-white: #F7F3ED`, `--accent-green: #2D6B4A`, `--accent-sienna: #B5602A`
- Grid borders: 5px solid black (Mondrian thick lines), 3px for thin
- Typography: DM Sans (labels/nav), Playfair Display (headlines), Source Serif 4 (body), JetBrains Mono (data/code)
- Zero border-radius everywhere
- Animation: cell assembly fade-in (0.6s), hover scale (subtle)

### Content Rendering
- Markdown to HTML via marked.js (CDN)
- Mermaid diagrams via mermaid.js (CDN)
- Tables styled with DM Sans headers, Source Serif body, 3px bottom border
- Code blocks: black background, white text, JetBrains Mono
- Blockquotes: yellow left border, light yellow background
- SVG diagrams embedded inline

### Data Embedding
- All room data embedded as JSON in `<script>` tags (type="application/json")
- Markdown content embedded in `<script>` tags (type="text/markdown") per section
- Graph data (nodes + edges) embedded as JSON
- Intelligence data (gaps, convergence, contradictions) embedded as JSON
- Zero external requests — everything in one file

### Template Generation Script
- Node.js script at `scripts/generate-export.cjs`
- Reads room/ directory structure and STATE.md
- Reads room intelligence (ROOM-INTELLIGENCE.md or proactive scan)
- Reads LazyGraph data (graph.json from build-graph)
- Reads each section's artifacts (markdown files)
- Injects all data into the HTML template
- Outputs single .html file

### Command Integration
- `/mos:room export` calls the generate script
- `--format standalone` (default) produces the self-contained HTML
- Output goes to `room/exports/YYYY-MM-DD-{room-name}.html`

### Responsive Design
- Desktop: full Mondrian grid + all sidebars
- Tablet: 2-column grid, collapsible TOC
- Mobile: single-column stack, no sidebars
- Print: document view only, no nav/footer

### Claude's Discretion
- Exact Mondrian grid cell sizing and span assignments per section count
- How to handle rooms with more than 9 sections (the grid is designed for 9)
- Animation timing details
- Cytoscape layout algorithm parameters
- How Mermaid diagrams are detected and rendered in markdown content

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Designs
- `/mnt/c/Users/jsagi/Downloads/PolygonEye-Align-DataRoom-Report.html` — PolygonEye reference: Mondrian grid, document rail, intelligence view, graph view, full CSS/JS
- `/mnt/c/Users/jsagi/Downloads/index.html` — Black Domain reference: sidebar navigation, entry cards, overview grid

### Existing Export System
- `scripts/build-graph.cjs` — Builds graph.json from room LazyGraph data
- `scripts/serve-dashboard.cjs` — Current dashboard server (localhost wiki)
- `dashboard/index.html` — Current dashboard HTML (to be replaced/evolved)
- `commands/room.md` — Room command (export subcommand lives here)

### Intelligence Sources
- `skills/room-proactive/SKILL.md` — Proactive intelligence (gaps, convergence, contradictions)
- `scripts/analyze-room.cjs` — Room analysis script
- `room/ROOM-INTELLIGENCE.md` — Generated intelligence file

### Design System
- `skills/ui-system/SKILL.md` — CLI UI ruling system (De Stijl tokens, body shapes)

</canonical_refs>

<specifics>
## Specific Ideas

- The Mondrian grid must feel like a PAINTING, not a dashboard — asymmetric cells, thick black borders, bold colors
- Each section gets a fixed color from the De Stijl palette (problem=red, solution=blue, market=white, business=green, competitive=white, team=white, meeting=gray, personas=red/amethyst)
- The stage badge (Discovery/Design/Build/etc) sits in a yellow cell in the grid
- Intelligence badges use the same De Stijl colors: red for gaps/critical, yellow for convergence/warnings, blue for validation, green for confirmed
- The graph should use the same section colors for node fills, with thick black borders (Mondrian style)
- Footer: "Generated by MindrianOS · PWS Methodology · {date}"
- The template must handle rooms with varying numbers of sections gracefully (not all rooms have the same sections)

</specifics>

<deferred>
## Deferred Ideas

- Interactive editing in the export (read-only for now)
- Real-time updates (it's a snapshot export)
- Multi-room comparison view
- PDF export from the HTML
- Embeddable widget version

</deferred>

---

*Phase: 25-data-room-export-v2*
*Context gathered: 2026-03-27 via conversation design session*
