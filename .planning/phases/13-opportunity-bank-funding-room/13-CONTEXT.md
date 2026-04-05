# Phase 13: Opportunity Bank + Funding Room - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Source:** Discussion with Jonathan

<domain>
## Phase Boundary

Phase 13 adds two new room sections that work together:
1. **Opportunity Bank** (`room/opportunity-bank/`) — context-driven discovery of grants, funding, and partnership opportunities based on room intelligence
2. **Funding Room** (`room/funding/`) — lifecycle tracking for opportunities the user decides to pursue

</domain>

<decisions>
## Implementation Decisions

### Grant Discovery is Context-Driven, Not Source-Hardcoded
- Discovery is driven by the USER'S room data: problem domain, geography, team profile, venture stage
- NOT a fixed Grants.gov API integration — Larry researches using whatever sources are relevant to the context
- Sources include: web research (Tavily), Grants.gov, Brain connections, manual filing, any relevant grant database
- The room context generates the search queries — "What grants exist for [problem domain] in [geography] at [stage]?"
- This is a GRAPH problem — opportunities have edges to room sections they relate to (this grant matches this problem-definition)

### Confirm-First Surfacing
- Discovered opportunities are PRESENTED to the user, NOT auto-filed
- Larry surfaces opportunities with relevance reasoning and asks: "Want me to file this?"
- User confirms → filed to opportunity-bank/ with full provenance
- User rejects → reason captured (rejection is data, per CLAUDE.md architecture)
- This prevents noise in the room while keeping discovery proactive

### Funding Lifecycle
- Four stages: **Discovered > Researched > Applying > Submitted**
- Each stage has a clear definition and transition criteria
- Per-opportunity folders in room/funding/ track the lifecycle
- No "Awarded/Rejected" stage — that's a binary outcome, not a stage to track

### Dual Delivery
- All operations must work as both CLI commands (/mos:*) and MCP tools
- Phase 11 MCP server already has the tool router — new commands register into existing hierarchical tools

### Claude's Discretion
- Exact folder structure within opportunity-bank/ and funding/
- Frontmatter schema for opportunity artifacts
- How to integrate with compute-state and analyze-room (Phase 10 dynamic discovery handles this)
- Proactive discovery trigger (session-start hook vs on-demand command vs both)
- Web research tool selection for grant discovery

</decisions>

<specifics>
## Specific Ideas

- The opportunity-bank/ section is similar to competitive-analysis/ — artifacts with frontmatter, cross-references
- Funding lifecycle mirrors the meeting archive pattern — per-item folders with metadata
- Brain can enrich discovery by connecting venture domain to known funding patterns
- The "confirm-first" pattern is identical to file-meeting's segment confirmation — reuse that UX

</specifics>

<deferred>
## Deferred Ideas

- Automated grant application drafting (v4.0+)
- Grant deadline notifications/calendar integration
- Candid Grants API (paid, add when adoption justifies cost)
- Grant success rate analytics across MindrianOS users

</deferred>

---

*Phase: 13-opportunity-bank-funding-room*
*Context gathered: 2026-03-25 via discussion*
