# Requirements -- v5.0 Data Room Presentation System

**Defined:** 2026-03-30
**Core Value:** Every Data Room becomes a living, deployed, shareable application -- always visible, always current, always branded.

## v5.0 Requirements

### Git Integration
- [x] **GIT-01**: `/mos:new-project` initializes git repo + creates GitHub repo via `gh` CLI + first push
- [ ] **GIT-02**: Post-write hook auto-commits every artifact with provenance message (e.g., "methodology: explore-domains", "meeting: 2026-03-30 investor call")
- [ ] **GIT-03**: Auto-push to GitHub after every commit (configurable: auto/manual/batch)
- [ ] **GIT-04**: `.rooms/registry.json` tracks git_remote, vercel_url, auto_push per room
- [ ] **GIT-05**: Git LFS configured for binary files > 10MB (.gitattributes auto-generated)
- [x] **GIT-06**: `gh` CLI detection with guided install if missing

### Deploy Pipeline
- [ ] **DEPLOY-01**: `/mos:publish` guides one-time Vercel setup (link project, first deploy, custom domain)
- [ ] **DEPLOY-02**: Vercel auto-deploys on every git push -- shareable URL always current
- [ ] **DEPLOY-03**: `/mos:publish --sections` for selective publishing (privacy: only include chosen sections)
- [ ] **DEPLOY-04**: `/mos:publish --private` for password-protected deployment
- [ ] **DEPLOY-05**: Exports log (`.exports-log.json`) tracks deployed URLs, timestamps, host

### Presentation Generator
- [ ] **PRES-01**: `generate-presentation` script produces all 6 views from any room in one command
- [ ] **PRES-02**: Dashboard (index.html) -- stats bar, 6 view cards, video embed, assets grid, partners, opportunities, governing thought
- [ ] **PRES-03**: Wiki (wiki.html) -- 3-panel browser, collapsible sidebar, search, TOC, infobox, [[wikilinks]], section colors
- [ ] **PRES-04**: Deck (deck.html) -- fullscreen slides auto-generated from MINTO.md + key artifacts + stats, keyboard nav
- [ ] **PRES-05**: Insights (insights.html) -- animated stat counters, timelines, quadrants, funnels, comparison tables, heat maps
- [ ] **PRES-06**: Diagrams (diagrams.html) -- Graphviz SVG from graph.json edges, light/dark toggle, multiple diagram types
- [ ] **PRES-07**: Graph (graph.html) -- Canvas-based renderer (Milken Twin pattern): circles, particles, glow, cluster highlight, ego-centric exploration
- [ ] **PRES-08**: Both design themes available: De Stijl dark (default) + PWS light (warm variant)
- [ ] **PRES-09**: Branding contract enforced: MindrianOS logo header, "Built with MindrianOS" footer, Mondrian color bar -- non-removable

### Canvas Graph Renderer
- [ ] **GRAPH-01**: Custom Canvas 2D renderer (not Cytoscape) with force simulation, ~330 lines
- [ ] **GRAPH-02**: Circular nodes sized by centrality (degree or betweenness), section-colored at 60% opacity
- [ ] **GRAPH-03**: Animated particles traveling along edges (data flowing visualization)
- [ ] **GRAPH-04**: Hover: connected nodes stay full opacity, everything else dims to 0.15, edges brighten
- [ ] **GRAPH-05**: Glow rings on hovered + core nodes, ambient pulse animation on key concepts
- [ ] **GRAPH-06**: `highlightCluster(group)` API -- keywords/tags trigger group-level highlights
- [ ] **GRAPH-07**: Click node: detail panel slides in with artifact summary + cross-section connections
- [ ] **GRAPH-08**: Edge types visually distinct: INFORMS (thin gray arrow), CONTRADICTS (dashed red), CONVERGES (dotted gold), ENABLES (solid blue arrow)

### KuzuDB Relationship Engine
- [ ] **KUZU-01**: Every filing (methodology, meeting, manual, pipeline, reasoning) creates KuzuDB nodes + edges
- [ ] **KUZU-02**: Cross-room relationship detection -- edges between artifacts in different rooms
- [ ] **KUZU-03**: graph.json generated from KuzuDB queries (not just file scanning)
- [ ] **KUZU-04**: Assumption tracking as first-class KuzuDB entities with validity status
- [ ] **KUZU-05**: Confidence scores on all edges, propagated to graph visualization (edge thickness/opacity)

### Binary Asset Filing
- [ ] **ASSET-01**: PDFs, images, videos filed with markdown wrapper + frontmatter in correct section
- [ ] **ASSET-02**: ASSET_MANIFEST.md auto-updated on every binary filing
- [ ] **ASSET-03**: Assets auto-discovered and displayed in dashboard grid and wiki inline rendering
- [ ] **ASSET-04**: Meeting audio/video filed in meetings/ with transcript link

### Filing Pipeline Completeness
- [ ] **FILE-01**: Post-write hook chain: classify -> KuzuDB index -> compute-state -> build-graph -> generate-presentation -> git commit -> push
- [ ] **FILE-02**: Artifact IDs (stable hash) in frontmatter for reliable cross-referencing
- [ ] **FILE-03**: Pipeline provenance in frontmatter (pipeline name, stage number, requires/provides)
- [ ] **FILE-04**: Meeting segments create KuzuDB nodes with SEGMENT_OF edges to meeting node
- [ ] **FILE-05**: Speaker expertise mapped to room sections via CONSULTED_ON edges

### Room Structure Contract
- [ ] **ROOM-01**: Every room maintains STATE.md (quantitative) + MINTO.md (qualitative) context files
- [ ] **ROOM-02**: CJS scripts operate on room path argument (ICM: folder structure = code)
- [ ] **ROOM-03**: Room tree always browsable as GitHub repo with meaningful structure
- [ ] **ROOM-04**: Proactive intelligence persisted in .proactive-intelligence.json with repeat suppression

### Generative UI
- [ ] **GENUI-01**: Vercel json-render integration -- Larry generates UI components declaratively
- [ ] **GENUI-02**: `highlightCluster()` wired as AI tool call in deployed site
- [ ] **GENUI-03**: BYOAPI chat panel -- visitor provides API key, stored in localStorage, direct browser-to-API
- [ ] **GENUI-04**: "Show me contradictions" -> Larry generates filtered graph view + analysis card

### Auto-Update Mechanism
- [ ] **SYNC-01**: Localhost: chokidar watches room/, SSE triggers browser reload (~1s latency)
- [ ] **SYNC-02**: Post-write: hook regenerates presentation views (~2-3s latency)
- [ ] **SYNC-03**: Deployed: git push triggers Vercel auto-deploy (~30s latency)

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| GIT-01 | Phase 26 | Complete |
| GIT-02 | Phase 26 | Pending |
| GIT-03 | Phase 26 | Pending |
| GIT-04 | Phase 26 | Pending |
| GIT-05 | Phase 26 | Pending |
| GIT-06 | Phase 26 | Complete |
| FILE-01 | Phase 27 | Pending |
| FILE-02 | Phase 27 | Pending |
| FILE-03 | Phase 27 | Pending |
| FILE-04 | Phase 27 | Pending |
| FILE-05 | Phase 27 | Pending |
| KUZU-01 | Phase 27 | Pending |
| KUZU-02 | Phase 27 | Pending |
| KUZU-03 | Phase 27 | Pending |
| KUZU-04 | Phase 27 | Pending |
| KUZU-05 | Phase 27 | Pending |
| ROOM-01 | Phase 27 | Pending |
| ROOM-02 | Phase 27 | Pending |
| ROOM-03 | Phase 27 | Pending |
| ROOM-04 | Phase 27 | Pending |
| ASSET-01 | Phase 28 | Pending |
| ASSET-02 | Phase 28 | Pending |
| ASSET-03 | Phase 28 | Pending |
| ASSET-04 | Phase 28 | Pending |
| GRAPH-01 | Phase 29 | Pending |
| GRAPH-02 | Phase 29 | Pending |
| GRAPH-03 | Phase 29 | Pending |
| GRAPH-04 | Phase 29 | Pending |
| GRAPH-05 | Phase 29 | Pending |
| GRAPH-06 | Phase 29 | Pending |
| GRAPH-07 | Phase 29 | Pending |
| GRAPH-08 | Phase 29 | Pending |
| PRES-01 | Phase 30 | Pending |
| PRES-02 | Phase 30 | Pending |
| PRES-03 | Phase 30 | Pending |
| PRES-04 | Phase 30 | Pending |
| PRES-05 | Phase 30 | Pending |
| PRES-06 | Phase 30 | Pending |
| PRES-07 | Phase 30 | Pending |
| PRES-08 | Phase 30 | Pending |
| PRES-09 | Phase 30 | Pending |
| SYNC-01 | Phase 31 | Pending |
| SYNC-02 | Phase 31 | Pending |
| SYNC-03 | Phase 31 | Pending |
| DEPLOY-01 | Phase 31 | Pending |
| DEPLOY-02 | Phase 31 | Pending |
| DEPLOY-03 | Phase 31 | Pending |
| DEPLOY-04 | Phase 31 | Pending |
| DEPLOY-05 | Phase 31 | Pending |
| GENUI-01 | Phase 32 | Pending |
| GENUI-02 | Phase 32 | Pending |
| GENUI-03 | Phase 32 | Pending |
| GENUI-04 | Phase 32 | Pending |

## Out of Scope

- Real-time collaborative editing (Cowork handles natively)
- Custom LLM hosting for chat (BYOAPI only -- user provides their own key)
- Mobile-native app (responsive web only)
- Brain graph editing by users (users get intelligence, never modify)
- Payment/billing for hosting (user's own Vercel/GitHub account)
- Obsidian/Notion sync (future milestone)
