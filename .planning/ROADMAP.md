# Roadmap: MindrianOS Plugin

## Milestones

- [x] **v1.0 MVP** - Phases 1-5 (shipped 2026-03-22)
- [ ] **v2.0 Meeting Intelligence** - Phases 6-9 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-5) - SHIPPED 2026-03-22</summary>

- [x] **Phase 1: Install and Larry Talks** - Plugin skeleton, Larry personality, Data Room with state system, hooks, graceful degradation, cross-surface compatibility (completed 2026-03-20)
- [x] **Phase 2: Core Methodologies** - ALL 25+ methodology commands with structured artifact output, passive Room intelligence, and problem type classification routing (completed 2026-03-22)
- [x] **Phase 3: Pipeline Chaining and Proactive Intelligence** - Multi-step methodology workflows where output becomes input, plus gap/contradiction/convergence detection (completed 2026-03-22)
- [x] **Phase 3.1: Data Room Dashboard (INSERTED)** - Localhost De Stijl dashboard with knowledge graph and chat (completed 2026-03-22)
- [x] **Phase 3.2: Document Generation (INSERTED)** - Professional De Stijl PDF exports (completed 2026-03-22)
- [x] **Phase 4: Brain MCP Toolbox** - Brain enrichment integration for enhanced routing, calibrated grading, and mode engine
- [x] **Phase 5: Plugin Intelligence Infrastructure** - Self-update system, context window awareness, Claude capability radar (completed 2026-03-22)

</details>

### v2.0 Meeting Intelligence

- [ ] **Phase 6: Stage 1 Core Capability** - file-meeting command with paste/audio input, Whisper transcription, speaker identification, segment classification, confirm-then-file, provenance metadata, meeting summary artifact
- [ ] **Phase 7: Team Room Structure** - team/ directory with members/mentors/advisors, per-person folders, cross-linking artifacts to topic AND speaker, meeting archive, TEAM-STATE.md
- [ ] **Phase 8: Cross-Meeting Intelligence** - Convergence detection across meetings, contradiction tracking, action item continuity, contribution analysis, Read AI MCP integration
- [ ] **Phase 9: Meeting Knowledge Graph** - Meetings and speakers as graph nodes, cross-meeting edges, timeline view, dashboard updates, meeting report export, meeting summary PDFs

## Phase Details

### Phase 6: Stage 1 Core Capability
**Goal**: Users can file a meeting transcript into their Data Room -- paste text, provide a file, or provide audio that gets transcribed locally -- with speakers identified, segments classified, and everything filed with full provenance after user confirmation
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: MEET-01, MEET-02, MEET-03, MEET-04, MEET-05, MEET-06, MEET-07, MEET-08, MEET-09
**Success Criteria** (what must be TRUE):
  1. User runs `/mindrian-os:file-meeting` and can paste transcript text, provide a file path, OR provide an audio file -- all three input modes work
  2. Larry presents identified speakers with proposed names and roles (mentor, researcher, team-member, investor, advisor, customer) and user confirms or corrects before proceeding
  3. Each speaker segment is classified (insight, advice, question, decision, action-item, noise) and non-noise segments are mapped to the correct Data Room section -- user confirms each filing before creation
  4. Every filed artifact includes meeting provenance metadata (speaker, speaker_role, meeting_date, segment_type, confidence, source: transcript)
  5. After all segments are filed, Larry produces a meeting summary artifact with key decisions, insights filed, contradictions detected, gaps identified, and action items
**Plans**: TBD

### Phase 7: Team Room Structure
**Goal**: The Data Room gains a team/ directory that organizes people by role, gives each person their own contribution folder, archives full meetings, and cross-links every filed artifact to both its topic section and its speaker -- turning the Room from topic-organized to people-aware
**Depends on**: Phase 6
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, ARCH-01, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. `/mindrian-os:new-project` creates team/ directory alongside the 8 topic sections, with members/, mentors/, advisors/ subfolders ready
  2. Each person has their own folder (e.g., team/mentors/lawrence-aronhime/) with PROFILE.md and contribution subfolders (insights/, advice/, connections/, concerns/) that accumulate over meetings
  3. When filing meeting segments, each artifact is cross-linked to both the topic section (e.g., market-analysis/) AND the speaker's person folder -- both locations reference the same content
  4. Each meeting gets its own archive folder in room/meetings/YYYY-MM-DD-{name}/ with transcript.md, summary.md, and filed-to/ links
  5. `/mindrian-os:status` shows meeting count and last meeting date, and team/TEAM-STATE.md is computed from filesystem showing who contributes what, expertise distribution, and team coverage gaps

### Phase 8: Cross-Meeting Intelligence
**Goal**: Larry builds intelligence ACROSS meetings -- detecting when topics converge, speakers contradict themselves, action items go incomplete, and team participation patterns emerge -- plus Read AI integration removes the paste step entirely
**Depends on**: Phase 7
**Requirements**: XMTG-01, XMTG-02, XMTG-03, XMTG-04, RDAI-01, RDAI-02, RDAI-03
**Success Criteria** (what must be TRUE):
  1. Meeting summaries include convergence detection -- Larry identifies when the same topic was mentioned across multiple past meetings and surfaces the pattern
  2. Larry detects contradictions across meetings (speaker said X in meeting 1, Y in meeting 2) and flags them in summaries and proactive alerts
  3. Action items are tracked across meetings -- Larry flags incomplete actions from prior meetings at the start of each new meeting filing
  4. Team contribution analysis shows which members are most active, which are silent, and which consistently raise the same concern
  5. User can run `/mindrian-os:setup meetings` to connect Read AI MCP, then `/mindrian-os:file-meeting --latest` auto-fetches the most recent transcript without manual paste

### Phase 9: Meeting Knowledge Graph
**Goal**: Meetings and speakers become first-class nodes in the knowledge graph -- connected by SPOKE_IN, FILED_TO, ATTENDED, REINFORCES, and CONTRADICTS edges -- with a timeline view in the dashboard and meeting-specific exports
**Depends on**: Phase 8
**Requirements**: GRAP-01, GRAP-02, GRAP-03, GRAP-04, GRAP-05, DASH-06, DASH-07, DOCS-06
**Success Criteria** (what must be TRUE):
  1. Each meeting appears as a distinctly colored node in the knowledge graph (dashboard/graph.json), connected to all artifacts it produced
  2. Speaker nodes appear in the graph, connected to their meeting nodes AND to the room sections they contributed to
  3. Cross-meeting edges exist: REINFORCES (same speaker, same concept, two meetings) and CONTRADICTS (two speakers disagree) are visible and navigable
  4. Dashboard shows a meeting timeline view -- meetings as a horizontal timeline with vertical edges showing what was filed from each
  5. `/mindrian-os:export meeting-report` generates a summary of all meetings with decisions and action items, and meeting summary PDFs include speaker attribution with section-colored filing indicators

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Install and Larry Talks | v1.0 | 3/3 | Complete | 2026-03-20 |
| 2. Core Methodologies | v1.0 | 5/5 | Complete | 2026-03-22 |
| 3. Pipeline Chaining | v1.0 | 2/2 | Complete | 2026-03-22 |
| 3.1 Data Room Dashboard | v1.0 | 2/2 | Complete | 2026-03-22 |
| 3.2 Document Generation | v1.0 | 2/2 | Complete | 2026-03-22 |
| 4. Brain MCP Toolbox | v1.0 | 3/3 | Complete | 2026-03-22 |
| 5. Plugin Intelligence | v1.0 | 3/3 | Complete | 2026-03-22 |
| 6. Stage 1 Core Capability | v2.0 | 0/? | Not started | - |
| 7. Team Room Structure | v2.0 | 0/? | Not started | - |
| 8. Cross-Meeting Intelligence | v2.0 | 0/? | Not started | - |
| 9. Meeting Knowledge Graph | v2.0 | 0/? | Not started | - |
