# Phase 33: Interactive Onboarding System - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Source:** PRD Express Path v2 (docs/superpowers/specs/2026-03-31-onboarding-system-design.md)

<domain>
## Phase Boundary

This phase delivers a deep interactive onboarding system for MindrianOS that builds user context from the first interaction. It consists of:

1. A detection script (`scripts/check-onboard`) that reads a marker file to determine FIRST_INSTALL, UPDATE, or CURRENT status
2. A `/mos:onboard` command with 7-step interactive walkthrough including deep context building
3. Integration into `scripts/session-start` to auto-trigger on first install and inject update context
4. A marker file (`~/.mindrian-onboarded`) written after onboarding completes or is skipped

The onboarding is Larry-voiced throughout. The deep context steps (who are you, domain analysis, incentives) are the highest-value part -- they build a USER.md that makes every subsequent Larry interaction smarter. These steps are skippable but Larry should convey their value.

MindrianOS is infrastructure for ANY domain -- the onboarding must not assume venture/founder context.

</domain>

<decisions>
## Implementation Decisions

### Trigger Logic
- First install detected by absence of `~/.mindrian-onboarded` marker file
- Update detected by comparing marker version < current plugin version
- Marker file format: line 1 = version, line 2 = date
- Marker written after onboarding completes OR is skipped
- Manual re-run via `/mos:onboard`, changelog via `/mos:onboard whats-new`

### 7-Step Flow (all skippable)
- Step 0: Banner (already implemented)
- Step 1: Who Are You? -- Q&A, optional CV/bio paste, optional web research. Builds USER.md
- Step 2: Domain & Subdomain Intelligence -- auto-triggered by Step 1, maps frameworks and room sections
- Step 3: Incentives & Clarification -- success criteria, stakeholders, timeline, prior attempts
- Step 4: Tailored Tool Tour -- contextual to Steps 1-3, falls back to 7-option intent if skipped
- Step 5: What's New (update flow only) -- CHANGELOG parsed as capabilities
- Step 6: Wrap + suggested first action based on full context

### Deep Context Building (Steps 1-3)
- Step 1 has three input approaches: conversational Q&A (3-5 questions), document paste (CV/bio), web research (consent required)
- All approaches produce USER.md with: name, role, domain, subdomain, technical level, current focus, goal, expertise areas
- Step 2 maps domain -> frameworks, suggests relevant room sections, identifies methodology matches
- Step 3 captures: success definition, stakeholders, timeline, prior attempts
- USER.md persists in room or ~/.mindrian-user.md if no room yet

### Fallback Path (if Steps 1-3 skipped)
- Step 4 shows 7 intent options: venture, research, meetings, stakeholders, project mgmt, tour, skip
- Each option maps to a 3-5 command workflow sequence
- Generic but still useful

### Voice Rules (locked)
- Larry voice: conversational, direct, no filler
- Signature openers: "Very simply...", "Here's the thing...", "One thing I've learned..."
- NO emoji, NO "I'd be happy to help", NO "Great question!"
- Deep context steps framed as valuable, not bureaucratic
- Skip framing: "You can skip this, but 5 minutes here saves hours later"

### Session-Start Integration
- Cold start check-onboard returns FIRST_INSTALL, UPDATE, or CURRENT
- FIRST_INSTALL: inject full onboarding instructions into additionalContext
- UPDATE: inject what's-new + core features reminder
- CURRENT: no onboarding injection (normal cold-start menu)

### Claude's Discretion
- Exact Larry copy for each step (must follow voice rules)
- How to structure the conversational Q&A (AskUserQuestion vs natural conversation via context injection)
- How to parse CHANGELOG.md for whats-new
- Whether domain analysis uses Brain MCP (if connected) or Larry's own knowledge
- USER.md exact field structure beyond the specified fields
- How web research consent is obtained and results presented

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Spec
- `docs/superpowers/specs/2026-03-31-onboarding-system-design.md` -- Full PRD v2 with deep context building

### Existing Files to Modify
- `scripts/session-start` -- Current cold-start and warm-start hook (lines 138-142 for integration)

### Existing Patterns
- `scripts/check-update` -- Version comparison pattern (sort -V, CHANGELOG parsing)
- `scripts/banner` -- De Stijl banner script (called before onboarding)
- `skills/larry-personality/SKILL.md` -- Larry voice DNA
- `skills/ui-system/SKILL.md` -- CLI UI ruling system
- `skills/context-engine/SKILL.md` -- USER.md management patterns
- `CHANGELOG.md` -- Source for whats-new parsing
- `.claude-plugin/plugin.json` -- Version number source

</canonical_refs>

<specifics>
## Specific Ideas

- The deep context steps are the killer feature -- USER.md built from onboarding persists and enriches every Larry interaction
- Document paste ("paste your LinkedIn bio") is the fastest path to rich context
- Web research is optional and consent-gated but produces the deepest profile
- Domain analysis should feel like immediate value, not a diagnostic -- "Based on your work in [domain], here's what I already know about your space"
- Incentives step produces problem framing that seeds the room if one exists
- The full onboarding should feel like a first consultation with Larry, not a product tour
- Update flow is lighter: what's new + core features reminder, no deep context re-gathering

</specifics>

<deferred>
## Deferred Ideas

- Warm-start onboarding (room exists but user hasn't done deep context)
- Analytics on onboarding completion rates
- Progressive disclosure (unlock features over time)
- Team onboarding (multiple users in Cowork)
- Brain-enhanced domain analysis (when Brain MCP is connected)

</deferred>

---

*Phase: 33-interactive-onboarding-system*
*Context gathered: 2026-03-31 via PRD Express Path v2*
