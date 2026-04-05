# Phase 6: Stage 1 Core Capability - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can file a meeting transcript into their Data Room — paste text, provide a file path, or provide audio that gets transcribed via Modulate Velma — with speakers identified, segments classified by priority, and everything filed with full provenance after user confirmation. Each meeting rebuilds understanding in relation to ALL prior conversations and the existing Data Room — it's an evolving graph, not a flat filing system.

</domain>

<decisions>
## Implementation Decisions

### Transcript Input UX
- **Explicit flags for input modes**: `/file-meeting` (paste), `/file-meeting --file path.txt`, `/file-meeting --audio recording.mp3`
- **Velma only, no Whisper**: Modulate Velma is the sole transcription engine (3¢/hour, streaming, diarization, 20+ emotions). No local Whisper fallback.
- **Speaker labels are critical**: If transcript has speaker labels, Larry uses them. If missing, Larry asks the user to explain who was in the meeting and infers from content.
- **Infer metadata, then confirm**: Larry processes the transcript, infers date/participants/purpose from content and Data Room context, then presents inferences for user confirmation or correction.
- **Chunking strategy**: Claude's discretion — handle long transcripts efficiently.
- **External source hook**: Design the interface for future external sources (Read AI, attend-mcp) in Phase 6. Only paste/file/audio are implemented. Phase 8 plugs in with `--latest` flag.
- **Velma setup**: Both `/mindrian-os:setup transcription` command AND auto-prompt on first `--audio` use if not configured.

### Optional Live Meeting Join (attend-mcp)
- **attend-mcp** (Attendee framework) as optional MCP integration: deploy a bot to Meet/Zoom/Teams meetings, request transcripts mid-meeting, even vocalize responses
- **Recall.ai** as alternative ($0.50/hr): single API call to join, webhooks for transcript delivery. SOC 2 / HIPAA compliant.
- **Vexa** as open-source option: Apache-2.0, has its own MCP server, self-hostable via Docker
- **NOT a dependency**: Core filing (paste/file/audio) works independently. Live join is an optional enhancement configured via `/mindrian-os:setup meetings`
- **Phase 6 scope**: Design the `--join <url>` interface and document attend-mcp/Recall.ai/Vexa options. Implementation can be Phase 6 if time permits, otherwise deferred.

### Speaker Identification & Confirmation
- **Smart hybrid presentation**: Larry shows a table of all identified speakers. If team/ directory has existing members, auto-matches by name. User confirms matches and fills unknowns.
- **Expanded role set**: mentor, researcher, team-member, investor, advisor, customer, founder, partner, domain-expert, government, competitor, unknown
- **Cross-meeting memory**: Larry checks team/ directory for known people. Suggests matches ("This sounds like Lawrence, mentor") but ALWAYS confirms — never auto-assigns.
- **Unknown speaker handling**: Larry infers from content first ("Speaker 2 discussed financials and seems senior — could this be your advisor?"), then asks user to fill remaining gaps.
- **Emotion signals**: Surface only strong emotional signals from Velma data ("Speaker 3 was very skeptical about the market size claim"). Don't surface routine emotions.
- **Role-weighted filing**: Speaker role influences classification priority and room routing. Investor concerns → financial-model flagged higher. Mentor insights → cross-referenced more broadly.
- **Auto-create new profiles**: Every identified speaker who doesn't exist in team/ automatically gets a profile created. Meetings are how the team directory gets populated organically.
- **ICM nested folder profiles**: New profiles are ICM nested folder structures (not flat files) with GSD intelligence — sub-folders for insights/, advice/, connections/, concerns/.
- **Proactive person research**: When a new profile is created, a proactive agent researches the person online in context of the project/room and builds a Data Room-specific profile. User confirms before finalizing.

### Segment Classification UX
- **Priority-first ordering**: Larry shows decisions and action items first (highest impact), then insights and advice. Noise handled separately.
- **Always show reasoning**: Larry explains every classification: "This is an insight about market size → market-analysis. File?" — transparent even when verbose.
- **Flag potential noise**: Uncertain noise segments flagged: "This looks like small talk but Lawrence mentioned a competitor name. File or skip?" — catches hidden insights in noise.
- **Cross-relationship batch scan**: After ALL segments are filed, run a full cross-relationship scan against the existing Data Room. Don't interrupt filing flow with real-time cascade detection.
- **Structured rejection reasons**: When user rejects a filing, Larry offers: [not relevant] [already known] [wrong section] [other] — rejection reasons become graph data (wicked problem architecture: rejection IS data).

### Meeting Summary Artifact
- **Narrative + structured format**: Larry writes a narrative lead paragraph in his voice, followed by structured sections: ## Decisions, ## Insights Filed, ## Contradictions, ## Gaps, ## Action Items
- **Graph impact**: Show only when significant — contradictions, convergence signals, cascades. Skip for routine filings.
- **Dual storage**: Full summary in room/meetings/YYYY-MM-DD-{name}/summary.md with links to all filed artifacts. Compact reference at room/ root for quick access.
- **Action items with owners**: Owners assigned from speaker context. Deadlines only when explicitly mentioned in transcript. No invented deadlines.
- **Problem evolution**: Implicit in cross-reference scan results, not a dedicated section.

### Architecture: Evolving Graph
- Every meeting is rebuilt in relation to ALL other conversations and the Data Room — this is an evolving knowledge graph, not a flat transcript archive.
- Each room (including person profiles) uses ICM nested folders with GSD intelligence — the folder structure IS the orchestration.
- The cross-relationship discovery loop runs after filing: INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES edges discovered and surfaced.
- Tier 0 = keyword matching (analyze-room). Tier 1 = LSA + lightweight embeddings (MiniLM). Tier 2 = Brain MCP (full HSI).

### Claude's Discretion
- Long transcript chunking strategy
- Exact provenance frontmatter format (must include: speaker, speaker_role, meeting_date, segment_type, confidence, source: transcript)
- Surface adaptation for CLI vs Desktop vs Cowork (tri-polar design rule)
- attend-mcp integration depth in Phase 6 vs deferred

</decisions>

<specifics>
## Specific Ideas

- **attend-mcp** (github.com/xpos/attend-mcp) + Attendee framework (attendee.dev) — self-hostable MCP server for live meeting join. Can chain with other MCPs.
- **Recall.ai** — $0.50/hour managed bot API. Single REST call to join meetings. SOC 2 / HIPAA compliant.
- **Vexa** — open-source (Apache-2.0) with its own MCP server. Self-hostable via Docker.
- **Modulate Velma** — 3¢/hour, real-time streaming, speaker diarization, 20+ emotions. Primary Tier 1 transcription.
- Person profiles should feel like mini Data Rooms — ICM nested structure with sub-folders matching the person's contribution patterns.
- Meeting summary narrative should be in Larry's challenging voice: "Lawrence pushed hard on market validation today. Three things you can't ignore..."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/classify-insight` — keyword-based room section classification (< 100ms). Extend for meeting segment types.
- `skills/room-passive/SKILL.md` — confirm-then-file pattern already defined. Meeting filing follows same UX.
- `scripts/post-write` — PostToolUse hook for filing intelligence. Meeting filing should trigger same pipeline.
- `scripts/compute-state` — filesystem scanner with venture stage inference. Extend for meeting count/date.
- `references/hsi/HSI-TOOLS-REFERENCE.md` — HSI tools for cross-relationship discovery (Plan 06-03).

### Established Patterns
- Thin skill SKILL.md + on-demand reference loading (Phase 1 pattern)
- YAML frontmatter for provenance metadata on every artifact
- Hybrid hook+skill for classification routing (Phase 2 pattern)
- Confirm-then-file UX with noise control (Phase 2 pattern)
- ICM nested folders with GSD STATE.md intelligence at every level

### Integration Points
- `commands/` needs `file-meeting.md` command
- `scripts/` needs meeting-specific processing scripts
- `references/` needs meeting filing reference (segment types, role mappings, provenance schema)
- `skills/room-passive/SKILL.md` needs meeting-awareness additions
- `hooks/hooks.json` may need meeting-specific hook entries
- `.mcp.json` needs attend-mcp/Recall.ai/Vexa optional config (same pattern as Brain setup)

</code_context>

<deferred>
## Deferred Ideas

- **Live meeting join implementation** — attend-mcp/Recall.ai/Vexa actual integration. Phase 6 designs the interface; implementation may extend to later phase if time-constrained. (Related: LIVE-01/02/03 in v3.0 requirements)
- **Chrome extension for meeting capture** — Out of scope per REQUIREMENTS.md. attend-mcp is the better approach.
- **Cross-meeting intelligence** — Phase 8 (XMTG requirements). Phase 6 files individual meetings; Phase 8 connects them.
- **Read AI MCP integration** — Phase 8 (RDAI requirements). Phase 6 designs the `--latest` hook; Phase 8 implements.
- **Meeting nodes in knowledge graph dashboard** — Phase 9 (GRAP requirements).

</deferred>

---

*Phase: 06-stage1-core-capability*
*Context gathered: 2026-03-23*
