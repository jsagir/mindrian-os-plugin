# Phase 7: Team Room Structure - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The Data Room gains people-awareness — a living team/ directory that organizes people by role, gives each person their own contribution context, archives full meetings, and cross-links every filed artifact to both its topic section and its speaker. The team structure is a LIVING COMPONENT that evolves and devolves — people join, leave, change roles, hold multiple roles. This is a context tool, not a tracking tool.

</domain>

<decisions>
## Implementation Decisions

### Cross-Linking Mechanics
- **Topic primary + backlink**: Artifacts live in the topic section (e.g., market-analysis/) with speaker attribution in frontmatter. Speaker's PROFILE.md maintains a computed 'Contributions' section with links back. No duplicate files in speaker's subfolder.
- **Backlinks computed on demand**: PROFILE.md Contributions section is rebuilt by compute-state/compute-team when it scans the room. Always accurate, never stale. Not updated during filing.
- **Full attribution block in frontmatter**: Every filed artifact includes a complete `attribution:` block with speaker, role, profile_path, meeting_date, meeting_id — complete provenance chain.
- **Cross-room cascades per person**: Claude's discretion on how deep per-person cross-referencing goes in PROFILE.md.

### Meeting Archive Structure
- **Full meeting package**: Each meeting folder (room/meetings/YYYY-MM-DD-{name}/) contains:
  - transcript.md — raw/processed text
  - summary.md — narrative + structured (from Phase 6)
  - speakers.md — who was there + roles
  - decisions.md — extracted decisions
  - action-items.md — with owners (deadlines only if mentioned)
  - metadata.yaml — structured meeting metadata
- **Audio copied into archive**: If user provided audio via --audio, the audio file is copied into the meeting folder. Full self-contained archive.
- **Past meeting lookup via frontmatter search**: Larry greps metadata.yaml across meetings/ for speaker names, topics, decisions. Fast targeted lookups for "Lawrence mentioned this 3 meetings ago."
- **Meeting name inferred then confirmed**: Larry proposes a name from the meeting's key topic, user confirms or changes. Same pattern as metadata inference.

### TEAM-STATE.md Computation
- **THIS IS A CONTEXT TOOL, NOT A TRACKING TOOL**: TEAM-STATE.md exists to give Larry rich context about the team's KNOWLEDGE LANDSCAPE — what the team knows, where knowledge gaps exist, what perspectives are missing. NOT attendance tracking or productivity metrics.
- **Full intelligence depth**: Contribution trends, expertise concentration, gap detection, role distribution, sentiment trends per speaker, agreement/disagreement patterns, influence scoring, team health indicators — all in service of CONTEXT, not tracking.
- **Structured markdown tables**: Context-safe, lean format. Tables for contribution matrix, expertise distribution, gap analysis. Readable by humans AND parseable by Larry.
- **Layered computation**: compute-state calls compute-team as a sub-step. TEAM-STATE.md is computed by a separate `scripts/compute-team` script but orchestrated by compute-state. Clean separation.
- **Silent stakeholder detection**: Claude's discretion.

### Team as Living Component
- **Dynamic folder structure**: Start with NO role subfolders in team/. First person of each role creates the folder on demand. Truly living structure — no empty folders cluttering the room.
- **Multiple roles allowed**: A person can be both advisor AND investor. PROFILE.md lists all roles. Folder lives under primary role.
- **Status lifecycle (explicit + inferred)**: PROFILE.md frontmatter includes `status: active/inactive/alumni/potential` for user-set status. compute-team also tracks last_active date from meeting participation. Larry can ask: "Sarah hasn't been in recent meetings. Still active?"
- **new-project creates team/ only**: `/new-project` creates the team/ directory but NO subfolders. The structure grows organically as people are identified through meetings or user input.
- **People evolve**: Roles change, people leave, new people arrive. The team directory must support this fluidity without losing historical contributions.

### Claude's Discretion
- Cross-room cascade depth in per-person PROFILE.md
- Silent stakeholder detection approach
- How compute-team handles role conflicts (person in two role folders)
- Exact TEAM-STATE.md section organization

</decisions>

<specifics>
## Specific Ideas

- TEAM-STATE.md is about KNOWLEDGE LANDSCAPE: "What does this team know? Where are the gaps? What perspectives are missing?" — never about productivity or attendance.
- Team structure mirrors the wicked problem nature of ventures — the team itself is a wicked problem (people, roles, expertise shift as the venture evolves).
- Meeting archive as a "full meeting package" — self-contained, browsable, with audio if provided. Each meeting is a complete knowledge artifact.
- The wiki-style Data Room dashboard (user's vision) would render these team profiles + meeting archives beautifully — deferred to v3.0 milestone.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/create-speaker-profile` — already creates ICM nested folder profiles with PROFILE.md + insights/advice/connections/concerns/. Phase 7 extends this.
- `scripts/research-speaker` — proactive web research on new speakers. Already creates project-relevant profiles.
- `scripts/compute-state` — already counts meetings + team profiles. Phase 7 adds compute-team sub-step.
- `commands/file-meeting.md` — already files artifacts with speaker attribution. Phase 7 adds full attribution block + meeting archive creation.
- `references/meeting/speaker-profile-template.md` — template for ICM nested folder profiles.
- `references/meeting/summary-template.md` — dual storage template (meetings/ + room/ root).
- `commands/new-project.md` — creates room structure. Phase 7 adds team/ directory creation.

### Established Patterns
- ICM nested folders with GSD intelligence at every level
- Confirm-then-file UX (Phase 6)
- Computed state from filesystem (compute-state pattern)
- YAML frontmatter for provenance on every artifact
- Priority-first ordering for segment presentation

### Integration Points
- `commands/new-project.md` needs team/ directory creation
- `commands/file-meeting.md` needs full attribution block + meeting archive creation
- `commands/status.md` needs team intelligence display
- `scripts/compute-state` needs compute-team sub-step call
- `scripts/compute-team` (NEW) — team intelligence computation
- `scripts/create-speaker-profile` may need updates for multiple roles, status lifecycle

</code_context>

<deferred>
## Deferred Ideas

- **Wiki-style Data Room Dashboard** — user's vision for a hosted (Render/Vercel) or Obsidian-based wiki view of the Data Room. Nodes become pages, edges become links. Future milestone (v3.0).
- **MindrianOS CLI tools consolidation** — like gsd-tools.cjs, consolidate scripts/ into a single `scripts/mindrian-tools` CLI with subcommands. User wants as Phase 8 but current Phase 8 is Cross-Meeting Intelligence. Needs roadmap discussion.
- **Team contribution analytics** — deeper analytics beyond TEAM-STATE.md: visualization, time-series, network analysis. Future phase.
- **Obsidian integration** — room/ as an Obsidian vault with [[wikilinks]]. Natural fit for the wiki dashboard vision.

</deferred>

---

*Phase: 07-team-room-structure*
*Context gathered: 2026-03-23*
