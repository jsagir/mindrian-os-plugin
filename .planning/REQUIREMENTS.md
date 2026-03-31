# Requirements: MindrianOS Plugin

**Defined:** 2026-03-31
**Core Value:** One command produces a unified visual snapshot from any Data Room

## v5.2 Requirements

### Generator

- [ ] **GEN-01**: Single generate-snapshot.cjs script (Node.js, zero npm deps) produces snapshot folder
- [ ] **GEN-02**: Output is a folder per snapshot: room/exports/{YYYY-MM-DD-HHmm}/index.html + view files
- [ ] **GEN-03**: Reads existing graph.json (KuzuDB enriched) first, falls back to keyword-only CONVERGES

### Logo & Branding

- [ ] **BRAND-01**: Real Mondrian grid mark SVG (canonical from website) in header and footer
- [ ] **BRAND-02**: Website design system tokens hardcoded (from globals.css, standalone)
- [ ] **BRAND-03**: "Built with MindrianOS" footer, Mondrian color bar, Bebas Neue/Inter/JetBrains Mono

### Hub Page

- [ ] **HUB-01**: Stats bar (sections, articles, connections, gaps, grants)
- [ ] **HUB-02**: View cards grid linking to co-located view files (conditional -- grayed if no content)
- [ ] **HUB-03**: Section cards with populated indicators + gap indicators (dashed, muted) for empty sections
- [ ] **HUB-04**: Key insights extraction (max 5, priority: CRITICAL > CONTRADICTS > VALIDATES > MINTO > CONVERGES, always 1 positive)
- [ ] **HUB-05**: Red team severity summary (if RED-TEAM-REPORT.md or methodology: red-team exists)
- [ ] **HUB-06**: Methodology artifact cards (detect methodology: in frontmatter, render with badge)

### Above-the-Fold

- [ ] **ATF-01**: Breakthrough angles from ADJACENT_POSSIBLE graph nodes (silently skip if none)
- [ ] **ATF-02**: Bank of Opportunities scored list from funding-strategy/ (CTA if none exist)

### Views

- [ ] **VIEW-01**: Intelligence Map -- 7-layer graph with toggles, edge filters, click-to-inspect (keeps existing Cytoscape design, AD-13)
- [ ] **VIEW-02**: Wiki -- article browser with sidebar, search, wikilinks
- [ ] **VIEW-03**: Doc Hub -- scrollable reader
- [ ] **VIEW-04**: Deck -- auto-generated slides (if 3+ sections populated)

### Versioning

- [ ] **VER-01**: manifest.json with rich stats per snapshot (sections, articles, edges, gaps, opportunities)
- [ ] **VER-02**: Collapsible version history sidebar in hub page

### Cross-Cutting

- [ ] **CROSS-01**: Responsive 375px-1440px (mobile-first breakpoints)
- [ ] **CROSS-02**: CDN default for Cytoscape.js, --offline flag inlines it
- [ ] **CROSS-03**: All content hyperlinked via KuzuDB graph relationships (AD-14), edge-type color coded
- [ ] **CROSS-04**: Works offline (file:// protocol)

## Future Requirements

- Version comparison in sidebar (sparkline progress over time)
- Team/partners section rendering
- Featured quote selection algorithm
- Snapshot diffing between versions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Delete old 5 scripts | Keep deprecated until Snapshot tested on 3+ rooms (AD-3) |
| Re-compute semantic edges | Read existing graph.json only (AD-2) |
| Website repo dependency | Tokens hardcoded, standalone (AD-4) |
| Custom themes | De Stijl dark only for v5.2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEN-01 | TBD | Pending |
| GEN-02 | TBD | Pending |
| GEN-03 | TBD | Pending |
| BRAND-01 | TBD | Pending |
| BRAND-02 | TBD | Pending |
| BRAND-03 | TBD | Pending |
| HUB-01 | TBD | Pending |
| HUB-02 | TBD | Pending |
| HUB-03 | TBD | Pending |
| HUB-04 | TBD | Pending |
| HUB-05 | TBD | Pending |
| HUB-06 | TBD | Pending |
| ATF-01 | TBD | Pending |
| ATF-02 | TBD | Pending |
| VIEW-01 | TBD | Pending |
| VIEW-02 | TBD | Pending |
| VIEW-03 | TBD | Pending |
| VIEW-04 | TBD | Pending |
| VER-01 | TBD | Pending |
| VER-02 | TBD | Pending |
| CROSS-01 | TBD | Pending |
| CROSS-02 | TBD | Pending |
| CROSS-03 | TBD | Pending |
| CROSS-04 | TBD | Pending |

**Coverage:**
- v5.2 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24

---
*Requirements defined: 2026-03-31*
