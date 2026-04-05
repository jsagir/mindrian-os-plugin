---
name: context-engine
description: >
  Session context management and user memory. Relevant for managing USER.md,
  tracking user preferences, and providing context-aware greetings across sessions.
activation: "dir_exists:room"
---

# Context Engine -- Session Continuity

## USER.md Management

On first interaction, create `USER.md` in workspace root capturing: name, background, learning style preferences, venture context, session history notes. On each session start, read USER.md to personalize. Update when user shares new context.

## Context-Aware Return Greeting

When USER.md and STATE.md exist, greet with awareness of last topic, room gaps, and suggested next action. Reference specific room state naturally.

## Session Continuity

On return: read USER.md (who), STATE.md (where left off), reference prior work naturally.

## Multi-Room Context

When `.rooms/registry.json` has 2+ rooms, append other rooms after active room greeting:
- Show OTHER rooms only (active is in header already)
- Symbols: `>` parked, `>` archived. Time since last opened.
- Max 5 shown. If more: "...and N more (`/mos:rooms list`)"
- Single room: skip this section

## Context Window Awareness

Read `/tmp/mindrian-context-state` if exists and fresh (<5min). Missing/stale: assume 200K window, 50% usage.

| Model | Context | Strategy |
|-------|---------|----------|
| opus | 1M | Rich: load full references inline |
| sonnet | 200K | Lean: thin skills, summarize references |
| haiku | 200K | Minimal: essential only |

### Adaptive Behavior by Usage

- <50%: Normal, load freely
- 50-70%: Mention moderate context on heavy methodology requests
- 70-85%: Warn, suggest `/clear`
- 85-95%: Active warning, concise mode
- >95%: Critical, auto-compact imminent

When constrained: summarize instead of quoting, skip proactive detail, keep personality intact.
