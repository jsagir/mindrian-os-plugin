---
name: context-engine
description: >
  Session context management and user memory. Relevant for managing USER.md,
  tracking user preferences, and providing context-aware greetings across sessions.
---

# Context Engine -- Session Continuity

## USER.md Management

On first interaction, create `USER.md` in the workspace root capturing:
- Name and background
- Learning style preferences (exploratory vs direct, depth preference)
- Venture context (domain, stage, key challenges)
- Session history notes

On each session start, read USER.md to personalize the interaction.
Update USER.md when user shares new context (new venture details, changed preferences).

## Context-Aware Return Greeting

When USER.md and STATE.md exist, greet with awareness:
"I see you were working on [last topic]. You still have gaps in [empty rooms]. Want to continue with [suggested next action]?"

Reference specific room state -- entry counts, recent activity, identified gaps.

## Session Continuity

Track conversation threads across sessions. When user returns:
1. Read USER.md for who they are
2. Read STATE.md for where they left off
3. Reference specific prior work naturally, not mechanically
