# Phase 19: Wikipedia Data Room Dashboard - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Source:** Jonathan directives + wiki research

<domain>
## Phase Boundary

Build a localhost Wikipedia-style viewer for the Data Room. Room sections are pages. KuzuDB edges are hyperlinks. Chat talks to Larry. De Stijl design.

</domain>

<decisions>
## Implementation Decisions (Jonathan's Directives)

### Dark / Light Mode (MANDATORY)
- Wiki MUST support both dark and light modes
- Default: dark (De Stijl: #0D0D0D bg, cream text)
- Toggle in top nav — user preference stored in localStorage
- Light mode: white bg, dark text, same Mondrian accents

### Auto-Create on Room Init (MANDATORY)
- Wiki gets BUILT IMMEDIATELY when a project room is created (/mos:new-project)
- Not a separate step — room creation = wiki creation
- As artifacts are added, wiki pages appear automatically
- The wiki is always there, always current, always expanding

### JavaScript Animations and Visualizations
- Use JS animation libraries where they add insight (not decoration)
- KuzuDB relationship graph is the CRITICAL visualization — animated, interactive
- Cytoscape.js already in the existing dashboard — reuse it
- Edge animations: INFORMS flows, CONTRADICTS pulses red, CONVERGES glows
- Page transitions: smooth, fast (150ms — De Stijl rule)

### KuzuDB Relationship Visualization (CRITICAL)
- This is THE most important visual in the wiki
- Interactive graph showing all room sections as nodes, edges as typed relationships
- Click a node → navigate to that page
- Click an edge → see the artifacts that create the relationship
- Graph updates in real-time as room content changes
- Must be prominent — not hidden in a tab. Graph view is the HOME PAGE of the wiki.

### Claude's Discretion
- Exact CSS implementation of dark/light toggle
- Animation library choice (vanilla JS vs GSAP vs anime.js)
- Layout of graph home page vs page view
- Mobile responsive behavior

</decisions>

---

*Phase: 19-wiki-dashboard*
*Context gathered: 2026-03-26*
