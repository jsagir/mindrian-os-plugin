# Roadmap: MindrianOS Plugin v6.2 RoomHub + SnapshotHub

## Milestones

<details>
<summary>Previous milestones (Phases 1-46) -- SHIPPED</summary>

- v1.0 MVP (Phases 1-5) -- shipped 2026-03-22
- v2.0 Meeting Intelligence (Phases 6-9) -- shipped 2026-03-24
- v3.0 MCP Platform (Phases 10-19) -- shipped 2026-03-25
- v4.0 Brain API & CLI UI (Phases 20-25) -- shipped 2026-03-29
- v5.0 Presentation System (Phases 26-33) -- shipped 2026-03-31
- v5.1 User Outlets (Phases 34-38) -- shipped 2026-03-31
- v1.6.0 Powerhouse (Phases 39-46) -- shipped 2026-03-31

</details>

### v6.2 RoomHub + SnapshotHub (In Progress)

**Milestone Goal:** Any Room becomes a living, adaptive intelligence surface. RoomHub serves it interactively on localhost with 7 Showcase views, generative Fabric chat, and a full 12-Thread Constellation. SnapshotHub freezes it into static HTML for sharing.

## Phases

- [ ] **Phase 47: Adaptive Room Detection + Parallel Extraction** - Detect Room type from State/Sections/Entries, configure adaptive labels and metrics, run tiered model extraction
- [ ] **Phase 48: Constellation + Fabric Graph** - Full 12-Thread Cytoscape graph with De Stijl colors, spectral OM-HMM coloring, Surprises, Bottlenecks, cross-domain bridges
- [ ] **Phase 49: Showcase Views + Deep Links** - Overview, Library, Narrative, Synthesis, Blueprint views plus claude-cli:// deep links on every element
- [ ] **Phase 50: Generative Fabric Chat** - Chat view with natural language to Cypher, Constellation click injection, BYOAPI, docked in all views
- [ ] **Phase 51: SnapshotHub Export + Polish** - Freeze RoomHub to static HTML, version history, responsive 375-1440px, offline mode, MindrianOS signature

## Phase Details

### Phase 47: Adaptive Room Detection + Parallel Extraction
**Goal**: The system knows what kind of Room it is looking at and has extracted all Section-level intelligence in parallel using tiered models
**Depends on**: Phase 46 (Powerhouse -- model routing, parallel agents, spectral profiles)
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, EXTRACT-01, EXTRACT-02, EXTRACT-03
**Success Criteria** (what must be TRUE):
  1. Running /mos:hub on the demo-cancer-room correctly identifies it as "research" and displays research-specific stats (papers, citations, findings)
  2. Running /mos:hub on the ALIGN room correctly identifies it as "venture" and displays venture-specific stats (entries, threads, gaps, grants)
  3. Section cards show type-adapted labels ("Research Question" for research, "User Needs" for website, "Problem Definition" for venture)
  4. Parallel haiku extraction completes for all Sections producing Thesis, Claims, and spectral profiles; sonnet synthesizes top 5 Signals + health score; opus generates Room narrative adapted to detected type
**Plans**: TBD

### Phase 48: Constellation + Fabric Graph
**Goal**: Users see every Thread in their Room's Fabric as an interactive, color-coded Constellation that reveals Surprises, Bottlenecks, and cross-domain bridges
**Depends on**: Phase 47
**Requirements**: FABRIC-01, FABRIC-02, FABRIC-03, FABRIC-04, FABRIC-05, FABRIC-06, VIEW-06
**Success Criteria** (what must be TRUE):
  1. Constellation view renders all 12 Thread types from KuzuDB with distinct De Stijl colors and a toggle filter sidebar
  2. Entries are colored by their spectral OM-HMM profile -- higher spectral_gap produces more intense coloring
  3. HSI_CONNECTION edges (Surprises) show animated particles on high-breakthrough connections
  4. REVERSE_SALIENT edges (Bottlenecks) display innovation thesis tooltip on hover
  5. ANALOGOUS_TO edges render as dashed cross-domain bridge lines between Sections
**Plans**: TBD
**UI hint**: yes

### Phase 49: Showcase Views + Deep Links
**Goal**: Users can explore the Room through 5 distinct Showcase views and click any element to open it directly in Claude Code
**Depends on**: Phase 48
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, LINK-01, LINK-02
**Success Criteria** (what must be TRUE):
  1. Overview shows adaptive stats bar, Section cards with Thesis governing thoughts, Signal briefing, and Sentinel digest
  2. Library provides 3-panel Entry browser with sidebar navigation, FlexSearch full-text search, TOC, and Thread hyperlinks between Entries
  3. Narrative generates fullscreen Deck slides from Thesis + top Entries (requires min 3 populated Sections)
  4. Synthesis displays stat counters, timelines, Bottleneck heat map, and Surprise clusters
  5. Blueprint renders SVG architecture from Fabric edges with Mermaid rendering
  6. Every Entry, Section, and Thread has a claude-cli:// deep link that opens Claude Code at the exact Room location
**Plans**: TBD
**UI hint**: yes

### Phase 50: Generative Fabric Chat
**Goal**: Users can ask questions about their Room in natural language and get answers grounded in the Fabric graph, with Constellation clicks feeding context into the conversation
**Depends on**: Phase 48, Phase 49
**Requirements**: VIEW-07, CHAT-01, CHAT-02, CHAT-03, CHAT-04
**Success Criteria** (what must be TRUE):
  1. User types a natural language question and gets an answer backed by Cypher queries against the Fabric (KuzuDB)
  2. Clicking an Entry or Thread in the Constellation injects context into the chat ("Tell me about [Entry]", "Threads connecting [Section]")
  3. Chat uses BYOAPI pattern -- user's Claude API key stored in localStorage via settings modal, never transmitted, with fallback CTA when no key configured
  4. Chat panel is available docked bottom-right in all 7 Showcase views, expandable to full panel
**Plans**: TBD
**UI hint**: yes

### Phase 51: SnapshotHub Export + Polish
**Goal**: Users can freeze the RoomHub into a shareable, offline-capable static export with version history and MindrianOS branding
**Depends on**: Phase 49, Phase 50
**Requirements**: SNAP-01, SNAP-02, SNAP-03, SNAP-04, POLISH-01, POLISH-02, POLISH-03, POLISH-04
**Success Criteria** (what must be TRUE):
  1. /mos:snapshot generates a complete folder of co-located HTML files (all 7 views + shared CSS/JS) to room/exports/{YYYY-MM-DD-HHmm}/
  2. manifest.json contains Room metrics (entries, threads, surprises, bottlenecks, signals, lenses, conversations) and version history sidebar renders from room/.snapshots/
  3. All views are responsive from 375px to 1440px with mobile-first breakpoints
  4. Running with --offline inlines all dependencies; export works on file:// protocol (chat requires API key)
  5. Every view includes the "Built with MindrianOS" signature footer with Mondrian bar
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** 47 -> 48 -> 49 -> 50 -> 51

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 47. Adaptive Room Detection + Parallel Extraction | v6.2 | 0/TBD | Not started | - |
| 48. Constellation + Fabric Graph | v6.2 | 0/TBD | Not started | - |
| 49. Showcase Views + Deep Links | v6.2 | 0/TBD | Not started | - |
| 50. Generative Fabric Chat | v6.2 | 0/TBD | Not started | - |
| 51. SnapshotHub Export + Polish | v6.2 | 1/1 | Complete | 2026-04-01 |

## Dependency Chain

```
Phase 47 (Detection + Extraction) --> Phase 48 (Constellation)
Phase 48 (Constellation) --> Phase 49 (Showcase Views)
Phase 48 (Constellation) --> Phase 50 (Chat)
Phase 49 (Showcase Views) --> Phase 50 (Chat)
Phase 49 + 50 --> Phase 51 (SnapshotHub)
```
