# Phase 8: Cross-Meeting Intelligence - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Larry builds intelligence ACROSS meetings — detecting convergence (same topics recurring), contradictions (speaker changed position), incomplete action items, and team contribution patterns — plus Read AI MCP integration removes the paste step. This phase makes the meeting system intelligent over time, not just per-meeting.

</domain>

<decisions>
## Implementation Decisions

### Convergence Detection
- **Triple surfacing**: Convergence detected in meeting summary section AND as proactive alert during filing AND tracked in STATE.md convergence signals at room level.
- **Larry's judgment**: No algorithmic engine. Larry reads prior meeting summaries (via metadata.yaml frontmatter search) and uses LLM reasoning to detect convergence patterns. Most flexible, no dependencies.
- **Threshold**: Same topic across 3+ meetings triggers convergence signal.
- **Room-level tracking**: STATE.md gains an "Active Convergence Signals" section listing topics that keep recurring.

### Contradiction Detection
- **Severity-based flagging**: High-impact contradictions (financials, strategy, key decisions) flagged immediately during filing. Low-impact (opinions, preferences) collected in meeting summary.
- **Storage**: Contradictions in meeting summary's Contradictions section AND aggregated in STATE.md's active contradictions list. No separate contradiction files.
- **Larry's judgment**: Same as convergence — LLM reasoning against prior meeting context, not algorithmic.
- **Resolution**: When a contradiction is resolved (user confirms which claim is current), the STATE.md entry is updated.

### Action Item Tracking
- **Aggregated tracker**: room/action-items.md — single file listing ALL open action items across all meetings. Rebuilt by compute-state from individual meeting action-items.md files.
- **Pre-filing triage + cross-reference**: Before filing a new meeting, Larry shows open action items for quick triage. During filing, Larry cross-references segments to remaining open items ("This looks like progress on Lawrence's TAM review. Mark as done?").
- **Simple lifecycle**: open/done only. No overdue or deferred states.

### Team Contribution Patterns (Cross-Meeting)
- **Recurring concerns**: Track when a team member raises the same concern across multiple meetings. "Sarah has flagged regulatory risk in 4 of 5 meetings — this deserves focused attention."
- **Influence shifts**: Track how decision influence shifts over time. Who drives decisions in which areas? Has anyone's influence grown or faded?
- **Concern clustering**: When multiple team members raise related concerns, cluster them into themes.
- **Role-gap analysis**: Map expected contributions by role (investors should weigh in on financials, mentors on strategy). Flag where a role's expected input is missing across meetings. Frame silence as missing perspective, not performance.

### Intelligence File Architecture
- **TEAM-STATE.md**: Per-person knowledge landscape (existing from Phase 7). Phase 8 extends with recurring concerns and influence patterns per person.
- **MEETINGS-INTELLIGENCE.md** (NEW): Cross-meeting patterns — convergence signals, active contradictions, action item aggregation, team-level patterns. Separate from TEAM-STATE.md. Computed by a new compute-meetings-intelligence script.
- **Clean separation**: TEAM-STATE.md = who knows what. MEETINGS-INTELLIGENCE.md = what patterns emerge across conversations.

### Read AI MCP Integration
- **Default from requirements**: Follow RDAI-01/02/03 as written in REQUIREMENTS.md.
- `/mindrian-os:setup meetings` connects Read AI MCP. Config stored in project-level .mcp.json (same pattern as Brain setup).
- `/mindrian-os:file-meeting --latest` auto-fetches the most recent meeting transcript from Read AI.
- **Also support attend-mcp/Recall.ai/Vexa**: If configured via `/setup meetings`, these can also provide transcripts. The `--latest` flag queries whichever meeting source is configured.

### Claude's Discretion
- Exact convergence/contradiction detection prompts
- How many prior meetings to scan for patterns (recommend: last 10 or all, whichever is fewer)
- MEETINGS-INTELLIGENCE.md section organization
- Read AI MCP error handling and fallback behavior

</decisions>

<specifics>
## Specific Ideas

- Convergence detection framing: "Market validation has been raised in 4 of your last 6 meetings. This is becoming a central theme." — not "4/6 meetings mentioned market validation" (context tool, not tracker).
- Contradiction example: "Lawrence said TAM was $190M in the March meeting, but now says $120M. Which is current?"
- Role-gap example: "Your advisor hasn't weighed in on the financial model across the last 3 meetings. Their perspective could strengthen it."
- Action items should feel like a quick pre-flight check, not an interrogation. "3 open items from last meeting. Quick check — any done?"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `references/meeting/cross-relationship-patterns.md` — 5 edge types (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES) with Tier 0 heuristics. Phase 8 makes these work ACROSS meetings.
- `scripts/compute-team` — already computes TEAM-STATE.md. Extend for recurring concerns and influence.
- `scripts/compute-state` — calls compute-team. Will also call new compute-meetings-intelligence.
- `commands/file-meeting.md` — 6-step pipeline. Phase 8 adds pre-filing action item triage (Step 0) and enhances Step 6 cross-relationship scan with cross-meeting patterns.
- `room/meetings/*/metadata.yaml` — searchable meeting metadata for frontmatter-based lookups.
- `room/meetings/*/action-items.md` — per-meeting action items with owners.
- `commands/setup.md` — already has transcription subcommand. Phase 8 adds meetings subcommand for Read AI.

### Established Patterns
- Computed state from filesystem (compute-state → compute-team pattern)
- Frontmatter search for past meeting lookups (grep metadata.yaml)
- Layered computation: compute-state calls sub-scripts
- YAML frontmatter provenance on every artifact
- Confirm-then-file UX with structured rejection

### Integration Points
- `commands/file-meeting.md` needs Step 0 (action item triage) + enhanced Step 6 (cross-meeting patterns)
- `scripts/compute-meetings-intelligence` (NEW) — produces MEETINGS-INTELLIGENCE.md
- `scripts/compute-state` needs to call compute-meetings-intelligence
- `commands/setup.md` needs meetings subcommand for Read AI MCP
- `commands/file-meeting.md` needs --latest flag for Read AI
- `.mcp.json` needs Read AI MCP config entry

</code_context>

<deferred>
## Deferred Ideas

- **HSI/Tier 1 semantic similarity for convergence detection** — Phase 8 uses Larry's judgment (Tier 0). Tier 1 (LSA + MiniLM) could auto-detect convergence even with different wording. Future enhancement.
- **Automated contradiction resolution** — Phase 8 flags contradictions for user resolution. Future: Larry could suggest resolutions based on recency, speaker authority, and Data Room context.
- **Action item assignment from transcript** — Phase 8 tracks items extracted during filing. Future: auto-assign based on role and expertise from TEAM-STATE.md.
- **Data Room level status bar** — user's idea for a CLI status line showing nested room/section/meeting context. Deferred to CLI tools consolidation.

</deferred>

---

*Phase: 08-cross-meeting-intelligence*
*Context gathered: 2026-03-23*
