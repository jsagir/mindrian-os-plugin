# Phase 37: JTBD Warm Start - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase)

<domain>
## Phase Boundary

Larry's session greeting tells users what they can DO based on their room state, not what features exist. Every nudge follows "You have [state]. /mos:X [outcome that matters to you]." Max 2-3 nudges per session. Commands framed as job acceleration using JTBD methodology.

Core job (from CLAUDE.md): "Reduce the time between insight and validated decision across every dimension of the venture simultaneously."

</domain>

<decisions>
## Implementation Decisions

### JTBD Framing Rule
- **D-01:** Every suggested command follows: "You have [concrete state]. [Natural language action] [outcome that matters]."
- **D-02:** Larry identifies user's current job from venture stage + room state + USER.md before suggesting
- **D-03:** Never describe features. Describe job completion. "Turn your 12 entries into a dashboard investors can browse" not "Generate 6 HTML views"

### Dynamic Menu
- **D-04:** Session-start command menu adapts to what user hasn't tried yet
- **D-05:** Track command usage in ~/.mindrian-usage.json (command name + last used timestamp)
- **D-06:** Show most relevant 6 commands based on room state + unused commands, not a static list

### Implementation Location
- **D-07:** JTBD framing rule injected into session-start additionalContext (warm start branch)
- **D-08:** Room state analysis already runs via compute-state -- add JTBD nudge generation to context injection
- **D-09:** No new scripts needed -- this is context injection that tells Larry HOW to greet

### Claude's Discretion
- Exact nudge copy for each room state scenario
- How to detect "what user hasn't tried" (usage tracking format)
- Priority order of nudges when multiple apply

</decisions>

<canonical_refs>
## Canonical References

- `scripts/session-start` -- Warm start branch (lines 21-137) where JTBD context gets injected
- `scripts/compute-state` -- Room state computation (sections, entries, gaps, stage)
- `skills/context-engine/SKILL.md` -- USER.md management + context-aware greetings
- `skills/room-proactive/SKILL.md` -- Gap/convergence/contradiction detection
- `skills/larry-personality/SKILL.md` -- Voice rules for nudge copy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- compute-state already outputs section fill, entry counts, venture stage, gaps
- session-start warm branch already injects proactive findings (max 2)
- Room-proactive skill already detects gaps, convergence, contradictions

### Integration Points
- session-start context string (line ~137) -- append JTBD framing instructions
- The warm start greeting instructions tell Larry how to greet -- add JTBD rules here

</code_context>

<specifics>
## Specific Ideas

- Nudge examples by stage (from brainstorm):
  - Early problem: "You're still shaping the problem. You've filed 2 meetings but haven't challenged your assumptions yet. Tell Larry to stress-test what you think you know -- before you build on a weak foundation."
  - Rich room: "Your room has 8 sections filled and 3 convergence signals. Tell Larry to turn this into a dashboard investors can browse -- so your pitch backs itself up with evidence."
  - Meetings filed: "You've had 4 meetings with smart people but most of their insights are sitting in transcripts. Tell Larry to pull those insights into the sections where they belong."

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 37-jtbd-warm-start*
*Context gathered: 2026-03-31*
