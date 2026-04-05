---
phase: 55
plan: 01
subsystem: context-intelligence
tags: [context, archetype, tiered-loading, mcp-profiles, autocompact, student-progress]
dependency_graph:
  requires: [54-token-hook-optimization]
  provides: [user-archetype-detection, tiered-context-loading, mcp-session-profiles, autocompact-tuning, returning-user-greeting, student-progress-tracking]
  affects: [session-start, on-stop, context-engine]
tech_stack:
  added: []
  patterns: [archetype-detection, tiered-loading, mcp-profile-routing]
key_files:
  created:
    - lib/core/user-archetype.cjs
    - lib/core/mcp-profiles.cjs
  modified:
    - scripts/session-start
    - scripts/on-stop
    - skills/context-engine/SKILL.md
decisions:
  - Archetype detection uses 5 signal sources with weighted scoring and confidence levels
  - Context tiers map to token budgets: minimal ~500, balanced ~2K, rich ~5K
  - MCP profiles map learn=0 servers, full=all 5 servers
  - Autocompact thresholds: student 65%, default 72%, venturist 75%, researcher 78%
  - Session count > 3 triggers domain-aware greeting skip
metrics:
  duration: 211s
  completed: 2026-04-05
  tasks: 6
  files_changed: 5
---

# Phase 55 Plan 01: Context Intelligence Summary

User archetype detection with 5-signal weighted scoring drives tiered context loading (minimal/balanced/rich), MCP profile selection (6 profiles from zero to full server set), archetype-specific autocompact thresholds, returning-user greeting optimization, and student progress tracking across sessions.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | User archetype detection module | 55d0f23 | lib/core/user-archetype.cjs |
| 2 | Tiered context loading in session-start | 4f23fa4 | scripts/session-start |
| 3 | MCP session profiles module | 55d0f23 | lib/core/mcp-profiles.cjs |
| 4 | Autocompact tuning per user type | d52f0ce | skills/context-engine/SKILL.md |
| 5 | Returning user detection | 4f23fa4 | scripts/session-start |
| 6 | Student progress tracking | bd9726f | scripts/on-stop |

## Implementation Details

### User Archetype Detection (CTX-01)

`lib/core/user-archetype.cjs` uses 5 signal sources with weighted scoring:
1. **USER.md content** (weight 2): regex patterns for student/researcher/venturist keywords
2. **Venture stage** (weight 1-3): stage alignment plus late-stage boost for venturists
3. **Room structure** (weight 1): section count as complexity proxy
4. **Research artifacts** (weight 2): presence of research/ or literature-review/ directories
5. **Command history** (weight 1-2): analytics.json command frequency patterns

Returns `{ archetype, confidence, signals }` with confidence derived from score margin.

### Tiered Context Loading (CTX-02)

Session-start hook now selects context tier based on budget percentage and archetype:
- **minimal** (~500 tokens): state summary only. Used when >70% budget consumed or student archetype.
- **balanced** (~2K tokens): state + user context + truncated proactive intelligence (30 lines max).
- **rich** (~5K tokens): full state + user + proactive + learnings. Used when <30% budget or venturist.

Context header now includes: `[Context Tier: X | Archetype: Y | MCP Profile: Z]`

### MCP Session Profiles (CTX-03)

`lib/core/mcp-profiles.cjs` defines 6 profiles:
- **learn**: 0 servers, 0 tools (student exercises)
- **think**: mindrian only, 15 tools (diagnostic)
- **build**: mindrian only, 30 tools (room operations)
- **research**: mindrian + brain + pinecone, 40 tools
- **present**: mindrian + brain, 25 tools
- **full**: all 5 servers, 64 tools

Profile selection: explicit intent keywords > archetype default mapping.

### Autocompact Tuning (CTX-04)

Context-engine SKILL.md now documents archetype-specific thresholds that Claude uses to decide when to suggest `/clear`:
- Student: 65% (needs headroom for exploratory Q&A)
- Default: 72%
- Venturist: 75% (runs pipelines that consume context)
- Researcher: 78% (deep dives need maximum runway)

### Returning User Detection (CTX-05)

When session count > 3 and room domain is known, session-start injects:
`[Returning User] This is session #N. Skip the full introduction. Greet with domain awareness.`

### Student Progress Tracking (CTX-06)

On session end (on-stop hook), if archetype is student:
- Counts completed task files and status:complete markers
- Writes `room/.context/learning-progress.md` with task count, section count, last methodology
- Maintains `room/.context/learning-history.log` (last 10 sessions)
- Next session-start injects progress summary: "You completed X of 22 tasks"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bridge file reading format mismatch**
- **Found during:** Task 2
- **Issue:** session-start used grep for key=value format but context-monitor writes JSON
- **Fix:** Replaced grep-based bridge reading with node JSON parsing
- **Files modified:** scripts/session-start
- **Commit:** 4f23fa4

## Known Stubs

None. All modules are fully wired with real data sources.

## Self-Check: PASSED

All 5 files found. All 4 commits verified.
