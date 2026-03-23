# Requirements: MindrianOS Plugin v2.0

**Defined:** 2026-03-23
**Core Value:** Teams can file meeting intelligence into a living Data Room — speakers identified, insights classified, knowledge compounding across meetings — transforming conversations into structured venture intelligence.

## v2.0 Requirements

Requirements for Meeting Intelligence milestone. Continues from v1.0 (Phases 1-5 complete).

### Meeting Transcript Filing

- [ ] **MEET-01**: User can run `/mindrian-os:file-meeting` and paste transcript text, provide a file path, OR provide an audio file (.mp3, .m4a, .wav) that gets transcribed via local Whisper
- [ ] **MEET-02**: Larry identifies speakers in the transcript and asks user to confirm names and roles (mentor, researcher, team-member, investor, advisor, customer)
- [ ] **MEET-03**: Each speaker segment is classified as insight, advice, question, decision, action-item, or noise
- [ ] **MEET-04**: Non-noise segments are mapped to appropriate Data Room sections based on content and speaker role
- [ ] **MEET-05**: User confirms each filing before it's created (confirm-then-file UX, same as room-passive)
- [ ] **MEET-06**: Each filed artifact includes meeting provenance (speaker, speaker_role, meeting_date, segment_type, confidence, source: transcript)
- [ ] **MEET-07**: After all segments filed, Larry creates a meeting summary artifact with key decisions, insights filed, contradictions detected, gaps identified, and action items
- [ ] **MEET-08**: Audio files are transcribed locally via Whisper (openai-whisper or whisper.cpp) with speaker diarization — no cloud dependency
- [ ] **MEET-09**: Whisper transcription includes timestamps and speaker labels that Larry uses for segment identification

### Team Room Structure

- [ ] **TEAM-01**: Room gains a `team/` directory with subfolders: `members/`, `mentors/`, `advisors/`
- [ ] **TEAM-02**: Each person gets their own folder (e.g., `team/mentors/lawrence-aronhime/`) with PROFILE.md, and subfolders for their contributions (insights/, advice/, connections/, concerns/)
- [ ] **TEAM-03**: `/mindrian-os:new-project` creates the team/ structure alongside the 8 topic sections
- [ ] **TEAM-04**: When filing meeting segments, artifacts are cross-linked to both the topic section AND the speaker's person folder
- [ ] **TEAM-05**: `team/TEAM-STATE.md` is computed from filesystem — who contributes what, expertise distribution, gaps in team coverage

### Meeting Archive

- [ ] **ARCH-01**: Each meeting gets its own folder in `room/meetings/YYYY-MM-DD-{name}/` with transcript.md, summary.md, and filed-to/ links
- [ ] **ARCH-02**: `/mindrian-os:status` shows meeting count and last meeting date alongside room state
- [ ] **ARCH-03**: Cross-meeting intelligence: Larry can reference past meetings ("Lawrence mentioned this 3 meetings ago")

### Read AI MCP Integration

- [ ] **RDAI-01**: `/mindrian-os:setup meetings` connects Read AI MCP for automatic transcript pull
- [ ] **RDAI-02**: `/mindrian-os:file-meeting --latest` auto-fetches the most recent meeting transcript from Read AI without paste
- [ ] **RDAI-03**: Read AI MCP config stored in project-level .mcp.json (same pattern as Brain setup)

### Cross-Meeting Intelligence

- [ ] **XMTG-01**: Meeting summary artifacts include convergence detection (same topic mentioned across multiple meetings)
- [ ] **XMTG-02**: Contradiction detection works across meetings (speaker said X in meeting 1, Y in meeting 2)
- [ ] **XMTG-03**: Action items are tracked across meetings — Larry flags incomplete actions from prior meetings
- [ ] **XMTG-04**: Team contribution analysis: which team members are most active, which are silent, which always raise the same concern

### Meeting as Graph Nodes

- [ ] **GRAP-01**: Each meeting becomes a node in the knowledge graph (dashboard/graph.json) — colored distinctly, connected to all artifacts it produced
- [ ] **GRAP-02**: Speaker nodes appear in the graph — connected to their meeting nodes AND to the room sections they contributed to
- [ ] **GRAP-03**: build-graph script reads meetings/ directory and generates meeting nodes + speaker nodes + SPOKE_IN / FILED_TO / ATTENDED edges
- [ ] **GRAP-04**: Cross-meeting edges: when same speaker mentions same concept in two meetings → REINFORCES edge; when two speakers contradict → CONTRADICTS edge
- [ ] **GRAP-05**: Meeting timeline view in dashboard — meetings as a horizontal timeline with vertical edges showing what was filed from each

### Dashboard & Export Updates

- [ ] **DASH-06**: Knowledge graph dashboard shows team members as nodes with edges to their contributions
- [ ] **DASH-07**: `/mindrian-os:export` supports meeting-report type — summary of all meetings with decisions and action items
- [ ] **DOCS-06**: Meeting summary PDFs with speaker attribution and section-colored filing indicators

## v3.0 Requirements (Deferred)

### Audio Transcription (MOVED TO v2.0 — Stage 1)
- Moved to v2.0 MEET requirements

### Live Meeting Join
- **LIVE-01**: Joinly MCP or Recall.ai integration for real-time meeting join
- **LIVE-02**: Larry listens silently during meeting, files insights in real-time
- **LIVE-03**: Mid-meeting alerts via side channel ("The investor just contradicted your market analysis")

### Notion Integration
- **NOTN-01**: Import Notion Data Room structure as room/ template
- **NOTN-02**: Bidirectional sync between room/ folders and Notion databases

## Out of Scope

| Feature | Reason |
|---------|--------|
| Chrome extension for meeting capture | Complex to build and maintain — use Read AI MCP instead |
| Real-time collaborative editing of room | Cowork handles this natively |
| Video recording/playback | Storage/bandwidth; transcripts are sufficient |
| Automated meeting scheduling | Calendar tools handle this |
| Slack/Teams bot integration | Different surface; plugin focuses on Claude Code/Desktop/Cowork |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEET-01 | TBD | Pending |
| MEET-02 | TBD | Pending |
| MEET-03 | TBD | Pending |
| MEET-04 | TBD | Pending |
| MEET-05 | TBD | Pending |
| MEET-06 | TBD | Pending |
| MEET-07 | TBD | Pending |
| TEAM-01 | TBD | Pending |
| TEAM-02 | TBD | Pending |
| TEAM-03 | TBD | Pending |
| TEAM-04 | TBD | Pending |
| TEAM-05 | TBD | Pending |
| ARCH-01 | TBD | Pending |
| ARCH-02 | TBD | Pending |
| ARCH-03 | TBD | Pending |
| RDAI-01 | TBD | Pending |
| RDAI-02 | TBD | Pending |
| RDAI-03 | TBD | Pending |
| XMTG-01 | TBD | Pending |
| XMTG-02 | TBD | Pending |
| XMTG-03 | TBD | Pending |
| XMTG-04 | TBD | Pending |
| DASH-06 | TBD | Pending |
| DASH-07 | TBD | Pending |
| MEET-08 | TBD | Pending |
| MEET-09 | TBD | Pending |
| GRAP-01 | TBD | Pending |
| GRAP-02 | TBD | Pending |
| GRAP-03 | TBD | Pending |
| GRAP-04 | TBD | Pending |
| GRAP-05 | TBD | Pending |
| DOCS-06 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 32 total
- Mapped to phases: 0 (awaiting roadmap)
- Unmapped: 25

---
*Requirements defined: 2026-03-23*
