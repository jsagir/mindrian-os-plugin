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

## Multi-Room Context at Session Start

When `.rooms/registry.json` exists AND has 2 or more rooms registered, the session greeting includes a room list after the standard greeting:

Format (appended after the active room's state summary):
```
  Other rooms:
  |- fintech-startup     parked  3 days ago
  |- biotech-venture     archived

  ▷ /mos:rooms                      Manage your rooms
  ▷ /mos:rooms open fintech-startup Switch rooms
```

Rules:
- Only show OTHER rooms (not the active one -- it is already in the header and greeting)
- Symbols: ▶ = parked, ▷ = archived
- Show time since last_opened for parked rooms ("3 days ago", "1 hour ago")
- Max 5 other rooms shown. If more, show count: "...and 3 more (/mos:rooms list)"
- If only 1 room registered, do NOT show the multi-room section

## Context Window Awareness

Read `/tmp/mindrian-context-state` if it exists. If the file is missing or older than 5 minutes (compare TIMESTAMP to current epoch), use conservative defaults: assume 200K context window, 50% usage, unknown model.

### Model-Specific Behavior

| Model Contains | Context Size | Strategy |
|----------------|-------------|----------|
| opus | 1,000,000 | Rich context: load full methodology references inline when relevant |
| sonnet | 200,000 | Lean context: thin skills only, summarize references instead of quoting |
| haiku | 200,000 | Minimal: essential context only, shortest responses |
| (unknown) | 200,000 | Conservative: treat as Sonnet |

### Context Threshold Actions

| Usage | Action |
|-------|--------|
| < 50% | Normal operation. Load references freely. |
| 50-70% | If user requests heavy methodology, mention context is moderate. |
| 70-85% | Warn: "We're at ~75% context. Consider `/clear` before starting a new methodology to keep quality high." |
| 85-95% | Active warning: "Context is getting tight. I'll be more concise. Strongly suggest `/clear` to free space." |
| > 95% | Critical: "Auto-compact will trigger soon. Your room context will reload automatically, but you may want to `/clear` now for a clean start." |

### Adaptive Reference Loading

When context is constrained (above 60% on Sonnet, above 80% on Opus):
- Do NOT load full methodology references inline
- Summarize Room findings instead of quoting full entries
- Skip proactive intelligence detail (mention count only, not full analysis)
- Keep Larry's personality and thin skill instructions (NEVER compress these)

When context is plentiful:
- Load full references when methodology commands request them
- Include detailed proactive intelligence in greetings
- Provide richer examples and deeper framework explanations
