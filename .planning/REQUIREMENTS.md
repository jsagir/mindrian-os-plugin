# Requirements - v6.2 RoomHub + SnapshotHub

**Defined:** 2026-04-01
**Core Value:** Any Room becomes a living, adaptive intelligence surface -- the RoomHub serves it interactively, the SnapshotHub freezes it for sharing.
**Taxonomy:** All terms per references/taxonomy/TAXONOMY.md

---

## v6.2 Requirements

### Adaptive Room Detection

- [x] **ROOM-01**: Room type detector reads State + Section names + Entry content to classify as venture/website/research/general
- [x] **ROOM-02**: ROOM_TYPE_CONFIG maps each type to: statsBar metrics, hubTitle, sectionLabels, insightTypes, graphLabel
- [x] **ROOM-03**: Stats bar adapts to Room type (venture: entries/threads/gaps/grants | website: pages/components/breakpoints | research: papers/citations/findings)
- [x] **ROOM-04**: Section cards use type-specific labels (venture: "Problem Definition" | website: "User Needs" | research: "Research Question")

### Showcase Views (7)

- [ ] **VIEW-01**: Overview -- hub with adaptive stats, Section cards + Thesis governing thoughts, Signal briefing, Sentinel digest
- [ ] **VIEW-02**: Library -- 3-panel Entry browser with sidebar, FlexSearch, TOC, Thread hyperlinks
- [ ] **VIEW-03**: Narrative -- fullscreen Deck slides from Thesis + top Entries (min 3 Sections)
- [ ] **VIEW-04**: Synthesis -- stat counters, timelines, funnels, Bottleneck heat map, Surprise clusters
- [ ] **VIEW-05**: Blueprint -- SVG architecture from Fabric edges, Mermaid rendering
- [ ] **VIEW-06**: Constellation -- Cytoscape graph, 12 Thread types, De Stijl colors, spectral coloring, particles, glow
- [ ] **VIEW-07**: Chat -- generative panel docked bottom-right, Fabric Cypher queries, BYOAPI

### Generative Fabric Chat

- [ ] **CHAT-01**: Chat queries Fabric (KuzuDB) via natural language to Cypher
- [ ] **CHAT-02**: Constellation clicks inject context ("Tell me about [Entry]", "Threads connecting [Section]")
- [ ] **CHAT-03**: BYOAPI -- user's Claude API key via settings modal, localStorage, never transmitted
- [ ] **CHAT-04**: Chat available in all 7 views (docked bottom-right, expandable)

### 12-Thread Constellation

- [ ] **FABRIC-01**: All 12 Thread types rendered: INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES, BELONGS_TO, REASONING_INFORMS, HSI_CONNECTION, REVERSE_SALIENT, ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA
- [ ] **FABRIC-02**: De Stijl color per Thread type + toggle filters in sidebar
- [ ] **FABRIC-03**: Entries colored by spectral OM-HMM profile (spectral_gap = color intensity)
- [ ] **FABRIC-04**: Surprises (HSI_CONNECTION) with animated particles on high-breakthrough edges
- [ ] **FABRIC-05**: Bottlenecks (REVERSE_SALIENT) with innovation thesis tooltip on hover
- [ ] **FABRIC-06**: ANALOGOUS_TO as dashed cross-domain bridge lines between Sections

### SnapshotHub Export

- [ ] **SNAP-01**: /mos:snapshot generates static HTML to room/exports/{YYYY-MM-DD-HHmm}/
- [ ] **SNAP-02**: All 7 views as co-located HTML + shared CSS/JS
- [ ] **SNAP-03**: manifest.json with Room metrics (entries, threads, surprises, bottlenecks, signals, lenses, conversations)
- [ ] **SNAP-04**: Version history sidebar from room/.snapshots/

### Deep Links

- [ ] **LINK-01**: Every Entry, Section, Thread gets claude-cli://open deep link
- [ ] **LINK-02**: Click opens Claude Code at exact Room location

### Parallel Extraction

- [x] **EXTRACT-01**: Haiku scan per Section (entry counts, Thesis, Claims, spectral profiles) in parallel
- [x] **EXTRACT-02**: Sonnet synthesis (top 5 Signals, Room health score, innovation map)
- [x] **EXTRACT-03**: Opus narrative (Room story, hub hero text adapted to Room type)

### Responsive + Offline

- [ ] **POLISH-01**: Responsive 375px-1440px (mobile-first)
- [ ] **POLISH-02**: CDN default, --offline inlines all deps
- [ ] **POLISH-03**: Works on file:// (chat requires API key)
- [ ] **POLISH-04**: Signature footer + Mondrian bar in all views

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROOM-01 | Phase 47 | Complete |
| ROOM-02 | Phase 47 | Complete |
| ROOM-03 | Phase 47 | Complete |
| ROOM-04 | Phase 47 | Complete |
| VIEW-01 | Phase 49 | Pending |
| VIEW-02 | Phase 49 | Pending |
| VIEW-03 | Phase 49 | Pending |
| VIEW-04 | Phase 49 | Pending |
| VIEW-05 | Phase 49 | Pending |
| VIEW-06 | Phase 48 | Pending |
| VIEW-07 | Phase 50 | Pending |
| CHAT-01 | Phase 50 | Pending |
| CHAT-02 | Phase 50 | Pending |
| CHAT-03 | Phase 50 | Pending |
| CHAT-04 | Phase 50 | Pending |
| FABRIC-01 | Phase 48 | Pending |
| FABRIC-02 | Phase 48 | Pending |
| FABRIC-03 | Phase 48 | Pending |
| FABRIC-04 | Phase 48 | Pending |
| FABRIC-05 | Phase 48 | Pending |
| FABRIC-06 | Phase 48 | Pending |
| SNAP-01 | Phase 51 | Pending |
| SNAP-02 | Phase 51 | Pending |
| SNAP-03 | Phase 51 | Pending |
| SNAP-04 | Phase 51 | Pending |
| LINK-01 | Phase 49 | Pending |
| LINK-02 | Phase 49 | Pending |
| EXTRACT-01 | Phase 47 | Complete |
| EXTRACT-02 | Phase 47 | Complete |
| EXTRACT-03 | Phase 47 | Complete |
| POLISH-01 | Phase 51 | Pending |
| POLISH-02 | Phase 51 | Pending |
| POLISH-03 | Phase 51 | Pending |
| POLISH-04 | Phase 51 | Pending |

**Coverage:** 34/34 requirements mapped

---

## Future Requirements

- SnapshotHub diffing between versions
- Team/partners Section rendering
- Featured quote selection algorithm
- RoomHub as remote MCP (team access)
- Vercel one-click deploy from /mos:snapshot

## Out of Scope

- Backend server (localhost only, static files)
- User accounts/auth (BYOAPI only)
- Real-time collaboration (Cowork handles natively)
- Custom themes (De Stijl dark only for v6.2)
- Rewriting existing Showcase scripts (build on generate-snapshot.cjs)

---
*Requirements defined: 2026-04-01*
