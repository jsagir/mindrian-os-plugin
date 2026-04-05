# Wikipedia Design Spec for MindrianOS Data Room Wiki

## Zone Mapping: Wikipedia → MindrianOS

| Wikipedia Zone | MindrianOS Equivalent |
|---------------|----------------------|
| **Title (H1)** | Room section name (problem-definition → "Problem Definition") |
| **Lead section** | First paragraph of section STATE.md or REASONING.md — standalone summary |
| **Infobox** | Frontmatter rendered as structured sidebar (venture_stage, artifact_count, last_updated, cross-refs) |
| **Body (H2-H4)** | Artifact content rendered as subsections. Each .md file = a sub-article |
| **Wikilinks** | KuzuDB edges rendered as clickable links. [[market-analysis]] → navigates to that page |
| **Citations** | Source provenance in frontmatter (methodology, speaker, meeting_date). External URLs as ref links |
| **Images/media** | Embedded images from room, Mermaid diagrams rendered inline |
| **See also** | KuzuDB INFORMS/ENABLES edges → "Related sections" |
| **Backlinks** | KuzuDB reverse edges → "What links here" |
| **Categories** | Room section labels, venture stage, methodology tags from frontmatter |
| **Navigation** | Sidebar folder tree (room → sections → artifacts), clickable, collapsible |
| **Talk page** | REASONING.md per section (Larry's analysis of this section) |
| **Revision history** | Git log per artifact |
| **Dashboard** | Home page = KuzuDB graph view + room overview stats |

## Added Layers (Beyond Wikipedia)

| Layer | What |
|-------|------|
| **Dashboard home** | Interactive KuzuDB graph (Cytoscape.js) as the landing page — click node to navigate |
| **Folder tree sidebar** | Collapsible room/section/artifact tree — always visible, click to navigate |
| **Dark/Light mode** | Toggle in header, localStorage persisted |
| **Validation indicators** | Red links for empty sections (gaps), green for validated claims, yellow for assumptions |
| **Citation system** | Internal: [[wikilinks]] from KuzuDB. External: URLs in frontmatter rendered as numbered references |
| **Question section** | Each page shows open questions from REASONING.md verification criteria |
| **Chat** | Talk to the page — Larry scoped to current section context |
| **Search** | FlexSearch across all room content, instant results |
| **Auto-refresh** | chokidar watches room/, SSE pushes updates to browser |

## Design Rules (from De Stijl + Wikipedia MOS)

1. One H1 per page (section name)
2. Sentence case for headings (not Title Case)
3. Bold the subject in the first sentence of the lead
4. Link only first occurrence of a term per page
5. Blue links = existing pages, Red links = empty sections (gaps)
6. Infobox floats right of lead text
7. Citations appear after claims, collected at bottom
8. Section order: Lead → Body → See Also → References → External Links
9. Zero border-radius (De Stijl)
10. 150ms transitions only
11. Mondrian accent colors for edge types
