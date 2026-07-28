---
name: context-engine
description: >
  Session context management and user memory. Relevant for managing USER.md,
  tracking user preferences, and providing context-aware greetings across sessions.
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on infra. Assembles conversational context every turn; a continuous substrate skill with no discrete problem-state trigger."
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
"I see you raised [last topic] [time delta]. You have [N] banked opportunities -- strongest: [problem]. You still have gaps in [empty rooms]. Want to continue with [suggested next action]?"

### Larry speaks relative time (Phase 160 R3)

The `[time delta]` in the greeting is NOT free prose. It is produced by the
callable render function `renderTopicGreetingDelta(node, opts)` in
`lib/core/temporal/dual-stamp.cjs`, which composes a `humanDelta()` delta
("you raised this 3 days ago") for the last-touched topic node's `created_at`
against `getReferenceNow()` (the one authoritative reference clock, Phase 160
Wave 1). The renderer REUSES the shipped `humanDelta()` from
`lib/core/feynman/timeline-renderer.cjs` (Canon Part 7 reuse-before-build) --
relative-time rendering is never re-implemented in the greeting.

The through-line: `created_at` = when we filed it; the delta Larry speaks is
"how long ago you raised this." Time rides at the FRONT of the interaction (the
Hooked variable-reward lever), not buried in a timeline view. When the topic
node has no `created_at`, the renderer degrades to the delta-free clause
"I see you were working on [topic]."

Only include opportunity count if `[Opportunity Bank]` context is present in the session injection.

Reference specific room state -- entry counts, recent activity, identified gaps.

### MindrianRooms Location Reference

When the active room resolves under `~/MindrianRooms/` (via `scripts/resolve-room`), include the location naturally in the greeting. Example: "Your rooms live at ~/MindrianRooms/. Active room: [name]."

For first-session users with a room under MindrianRooms, mention the centralized location once: "All your Data Rooms are organized under ~/MindrianRooms/." Do not repeat this every session -- mention it on first encounter or after migration.

## Opportunity Bank in Session Greeting

When session-start injects `[Opportunity Bank]` context, include opportunity awareness in the greeting:

- Reference the count naturally: "You have N banked opportunities."
- Highlight the strongest one: "Your strongest lead: [problem statement] at [confidence] confidence."
- If risk/uncertainty split is uneven, note it: "Most are still uncertainty -- the frameworks can help convert them to risk."
- Suggest reviewing: "Run /mos:opportunities to see the full bank."

Keep it brief -- 1-2 sentences woven into the greeting, not a separate block. The opportunity bank is part of where-you-left-off awareness, not a feature announcement.

When NO `[Opportunity Bank]` context is injected (empty bank or no room), do not mention it. Do not say "your opportunity bank is empty" -- that adds no value.

## Conversation Mode Awareness

When session-start injects `[MindrianOS Mode Routing]` context (no room detected), defer to the `conversation-mode` skill for behavioral instructions. The three modes are:

1. **Just Talk** -- pure thinking partner, no filing, no room suggestions
2. **Explore+Capture** -- thinking partner + persona detection + opportunity banking
3. **Build a Room** -- route to /mos:new-project immediately

When a room EXISTS, the conversation-mode skill is inactive. Standard room-aware greeting applies.

## Session Continuity

Track conversation threads across sessions. When user returns:
1. Read USER.md for who they are
2. Read STATE.md for where they left off
3. Reference specific prior work naturally, not mechanically

## Multi-Room Context at Session Start

When `~/MindrianRooms/.rooms/registry.json` (or workspace `.rooms/registry.json` for legacy) exists AND has 2 or more rooms registered, the session greeting includes a room list after the standard greeting:

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

## KAIROS Daily Log Detection (READY-02)

When the `tengu_kairos` environment variable is set to `true` OR the file `room/.mindrian/kairos-active` exists, KAIROS background memory is available. In this mode:

1. **Skip cold-start context rebuild.** Do NOT re-read all room artifacts to reconstruct session state. KAIROS has already consolidated overnight context into a daily log.
2. **Read the KAIROS daily log** at `room/.mindrian/kairos/daily-log.md` (or the path in `KAIROS_LOG_PATH` env var if set). This contains the consolidated memory from KAIROS background processing.
3. **Read `room/.mindrian/last-session.md`** for structured session state (active_methodology, open_questions, next_suggested_action, confidence_level). This supplements the KAIROS log with MindrianOS-specific session data.
4. **Greet with KAIROS-enriched context:** Reference insights from the daily log naturally. Example: "KAIROS noticed overnight that your financial model assumptions diverge from the market analysis. Want to reconcile?"

When `tengu_kairos` is NOT set and `kairos-active` does not exist, this section is a no-op. Fall through to standard session continuity (USER.md + STATE.md) with zero overhead.

**Graceful degradation:** If the flag is set but the daily log file is missing or empty, fall back to standard context rebuild and log a note: "KAIROS flag detected but no daily log found -- using standard context."

## Context Window Awareness

Read `/tmp/mindrian-context-state` if it exists. If the file is missing or older than 5 minutes (compare TIMESTAMP to current epoch), use conservative defaults: assume 200K context window, 50% usage, unknown model.

### Model-Specific Behavior

| Model Contains | Context Size | Strategy |
|----------------|-------------|----------|
| opus | 1,000,000 | Rich context: load full methodology references inline when relevant |
| sonnet | 200,000 | Lean context: thin skills only, summarize references instead of quoting |
| haiku | 200,000 | Minimal: essential context only, shortest responses |
| (unknown) | 200,000 | Conservative: treat as Sonnet |

### Autocompact Threshold by User Archetype (CTX-04)

Different user types have different optimal compact thresholds. The session-start hook injects the user archetype into context. Use these thresholds to decide when to suggest `/clear` or switch to concise mode:

| Archetype | Compact Threshold | Rationale |
|-----------|------------------|-----------|
| student | 65% | Students need headroom for exploratory Q&A. Compact early to keep teaching quality high. |
| default | 72% | Standard users get the balanced threshold. |
| venturist | 75% | Venturists run pipelines that consume context. Let them use more before suggesting compact. |
| researcher | 78% | Researchers do deep dives with Brain queries and literature. They need the most runway before interruption. |

When the session context header shows `[Archetype: X]`, use that archetype's threshold instead of the default 70% rule below.

### Context Threshold Actions

| Usage | Action |
|-------|--------|
| < 50% | Normal operation. Load references freely. |
| 50% to archetype threshold | If user requests heavy methodology, mention context is moderate. |
| Archetype threshold to threshold+15% | Warn: "We're at ~X% context. Consider `/clear` before starting a new methodology to keep quality high." |
| Threshold+15% to 95% | Active warning: "Context is getting tight. I'll be more concise. Strongly suggest `/clear` to free space." |
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
