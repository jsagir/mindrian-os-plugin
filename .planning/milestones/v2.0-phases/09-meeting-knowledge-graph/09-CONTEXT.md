# Phase 9: Meeting Knowledge Graph - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

The room IS the graph. Meetings and speakers become first-class nodes in a layered knowledge graph — but the graph represents the ENTIRE Data Room, not just meetings. Meetings are one element alongside artifacts, sections, concepts, and intelligence signals. The graph uses [[wikilinks]] for organic concept connections (like Wikipedia), build-graph reads existing intelligence files, and the dashboard gains a timeline mode with highlighted convergence/contradiction edges. Export gains Minto-structured meeting reports.

</domain>

<decisions>
## Implementation Decisions

### Layered Graph Architecture
- **Three layers**: (1) Room structure (sections as parent nodes), (2) Content (artifacts, meetings, speakers), (3) Intelligence (concepts extracted from [[wikilinks]], contradictions, convergence signals). Layers can be toggled in dashboard.
- **Edge taxonomy**: Claude's discretion on unified taxonomy. Must include: SPOKE_IN, FILED_TO, ATTENDED, REINFORCES, CONTRADICTS, INFORMS, CONVERGES, INVALIDATES, ENABLES, plus any additional that emerge from the structure.
- **Source-typed edges**: Edges carry their source type (meeting-CONTRADICTS vs methodology-CONTRADICTS vs proactive-CONTRADICTS). Different visual weight based on source confidence.
- **De Stijl palette**: Each node type gets a color from the Mondrian-inspired palette. Extend existing section colors with meeting, speaker, concept, intelligence node colors.

### [[Wikilinks]] and Lazy Graph
- **Larry auto-links**: When filing artifacts (meetings or methodology sessions), Larry auto-inserts [[concept-name]] links to recognized concepts. User can also add links manually.
- **Lazy graph pattern**: Maintain RELATIONSHIPS first (edges are the intelligence). When enough edges converge on a concept, Larry asks: "This keeps coming up — want to give it a proper page?" Nodes grow organically from connections.
- **Unresolved links**: If [[concept]] doesn't exist as a file yet, the link is "red" (unresolved) in the graph. These are discovery signals — concepts the room talks about but hasn't formalized yet.
- **build-graph parses [[wikilinks]]**: Scan all room artifacts for `[[...]]` patterns. Each becomes an edge in graph.json. This is how the graph grows organically from content.

### Micro-Knowledge Capture
- **Relationships ARE the micro-knowledge**: Don't explicitly create micro-knowledge nodes. The cross-references, [[wikilinks]], and cross-relationship edges discovered by intelligence layer ARE the micro-knowledge. Individual observations become significant when the graph reveals their connections.
- **Wikipedia structure**: Hyperlinks between artifacts are more valuable than any single artifact's content. The graph captures the link structure and surfaces hidden patterns.

### Dashboard Enhancements
- **Layer toggles + preset views**: Toggle buttons per layer (Structure/Content/Intelligence) for power users. Preset views for quick access: 'Room Overview', 'Meeting Map', 'Team Network', 'Intelligence Map'. Presets are saved toggle combinations.
- **Timeline mode**: Integrated in graph — not a separate view. Graph has a 'timeline mode' that arranges meeting nodes chronologically on X-axis while keeping section nodes on Y-axis. Toggle between freeform and timeline layout.
- **Highlighted edges in timeline**: REINFORCES edges pulse/glow green. CONTRADICTS edges pulse red. Convergence patterns jump out visually.
- **Node click → Details + chat**: Side panel shows node details (meeting summary, speaker profile, artifact content). Room chat can discuss that specific node: "Tell me about this meeting."
- **Edge labels on hover**: Clean graph by default. Hover over edge to see type and details. Less visual clutter.
- **Persist positions + auto-layout new**: Existing nodes keep their x,y coordinates. New nodes from new meetings/artifacts get auto-placed near related nodes.

### build-graph Intelligence Reading
- **Read existing intelligence**: build-graph reads MEETINGS-INTELLIGENCE.md + TEAM-STATE.md + cross-relationship scan results. Intelligence is already computed by Phase 6-8 scripts — build-graph visualizes it, doesn't recompute.
- **Also parse [[wikilinks]]**: Scan all .md files in room/ for `[[...]]` patterns to build concept-connection edges.

### Meeting-Report Export
- **Minto pyramid structure**: Executive summary → Logical claim (what the meetings collectively tell us) → Critical backbone (supporting arguments from key meetings) → Evidence and questions (contradictions, open items, unresolved debates) → Full analysis by case/meeting.
- **Larry's voice**: Written as Larry would write it — challenging, questioning, pushing for rigor.
- **Speaker attribution**: Claude's discretion on PDF design within De Stijl constraints. Must include section-colored filing indicators per DOCS-06.

### Claude's Discretion
- Unified edge taxonomy details
- Speaker attribution PDF design (within De Stijl constraints)
- Node sizing (by connection count, importance, or flat)
- Preset view definitions
- How timeline mode handles non-meeting nodes

</decisions>

<specifics>
## Specific Ideas

- "The room IS the graph. Meetings are one element." — the graph represents ALL room intelligence, not just meetings.
- Lazy graph: edges are discovered first, nodes grow metadata on demand. Like Wikipedia — hyperlinks predate many article pages.
- [[wikilinks]] in markdown are the organic graph growth mechanism. Larry auto-inserts them. Users can add manually.
- Micro-knowledge: individual observations that become significant only when the graph reveals their connections across rooms and meetings.
- "Your project becomes your co-founder" — tagline for the living Data Room that thinks with you.
- Minto pyramid for meeting reports: the same analytical rigor Larry applies in methodology sessions, applied to meeting intelligence exports.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-graph` — already generates Cytoscape.js JSON from room/ with 8 section group nodes + artifact nodes. Phase 9 extends with meeting/speaker/concept nodes + [[wikilink]] edges.
- `dashboard/` — De Stijl dashboard with CoSE/grid layout engine, room chat, knowledge graph viewer. Phase 9 adds timeline mode + layer toggles.
- `scripts/render-pdf` — WeasyPrint PDF renderer. Phase 9 adds meeting-report type.
- `commands/export.md` — export command with thesis/summary/report/profile types. Phase 9 adds meeting-report.
- `scripts/compute-meetings-intelligence` — produces MEETINGS-INTELLIGENCE.md (convergence, contradictions, action items).
- `scripts/compute-team` — produces TEAM-STATE.md (expertise, gaps, recurring concerns, influence).
- `references/meeting/cross-relationship-patterns.md` — 5 edge types with Tier 0 heuristics.
- `references/meeting/cross-meeting-intelligence.md` — convergence/contradiction protocols.

### Established Patterns
- Cytoscape.js for graph rendering (Phase 3.1)
- CoSE layout algorithm
- De Stijl color palette for sections
- YAML frontmatter for artifact metadata
- Computed intelligence from filesystem (compute-state → compute-team → compute-meetings-intelligence)
- WeasyPrint PDF generation with @font-face and TOC bookmarks

### Integration Points
- `scripts/build-graph` needs [[wikilink]] parser + meeting/speaker/concept node generation + intelligence layer reading
- `dashboard/index.html` needs layer toggles + timeline mode + preset views + node click details panel
- `commands/export.md` needs meeting-report type
- `scripts/render-pdf` needs meeting-report template (Minto structure)
- `commands/file-meeting.md` needs Larry auto-insert [[wikilinks]] when filing

</code_context>

<deferred>
## Deferred Ideas

- **Opportunity Bank** — new room section (room/opportunity-bank/) with explicit (user-declared) and discovered (HSI/Reverse Salient) opportunities. User wants this as a milestone.
- **AI Team Members** — generate AI personas from domain intelligence + Bono perspectives that join the project team as synthetic advisors. v3.0+.
- **Wiki-style Data Room Dashboard** — hosted (Render/Vercel) wiki view of the Data Room. Nodes become pages, edges become hyperlinks. v3.0 milestone.
- **Obsidian Plugin** — MindrianOS as an Obsidian plugin. Room/ is already an Obsidian vault. Graph view, intelligence, Larry integrated into Obsidian. v3.0.
- **Room as Remote MCP** — Data Room accessible via local or remote MCP server. Team members connect from different locations. v3.0.
- **CLI tools consolidation** — single `scripts/mindrian-tools` CLI with subcommands (like gsd-tools.cjs). User wanted as Phase 8 but deferred.
- **Data Room level status bar** — CLI status line showing nested room/section/meeting context. Deferred.
- **HSI/Tier 1 semantic similarity** — auto-detect convergence with different wording. Future enhancement beyond Tier 0 keyword matching.

</deferred>

---

*Phase: 09-meeting-knowledge-graph*
*Context gathered: 2026-03-24*
