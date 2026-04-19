---
type: architecture-spec
domain: skill-contextual-invocation
status: critical-update-after-v1.10.11
phase: 88
source: Session 2026-04-17 discussion (Jonathan + Larry)
key_insight: Skills should OFFER themselves based on intent + graph + MINTO triangulation
gsd_priority: critical (handle immediately after Phase 87 v1.10.11 ships)
---

# Phase 88: Skill Offer Engine -- Intent + Graph + MINTO Triangulated Invocation

## Priority: CRITICAL (next after v1.10.11)

Jonathan directive 2026-04-17: "Make it a critical update after 1.10.11 to be handled by GSD."

## The problem

Skills activate on static conditions (room exists, Brain key set) but never react to what the user just said, what the graph actually contains, or where the MINTO reasoning is weak. Users feel skills "aren't contextually invoked" because they aren't.

## The fix

Three signals already available on every user message:

1. **Intent** -- the user's words (UserPromptSubmit already parses this)
2. **Graph** -- room.db edges, artifacts, gaps per section (SQL query, 0 tokens)
3. **MINTO** -- per-section governing_thought + confidence + reasoning_gaps (filesystem read, 0 tokens)

When all three point the same direction, the skill offer is obvious and conversational. When they disagree, Larry answers directly without offering methodology.

## Architecture

```
User types a message
        |
  UserPromptSubmit fires
        |
  skill-offer-engine.cjs (NEW, ~100 lines)
        |
  Intent (0.4) + Graph (0.3) + MINTO (0.3)
        |
  Combined score > 0.6?
        |
  YES: inject 2-3 line skill offer into additionalContext
  NO: no injection, Larry responds normally
```

## Triangulation formula

```
combined = (intent_score * 0.4) + (graph_gap * 0.3) + (minto_gap * 0.3)
```

Maximum 2 offers per message (noise gate).

## Example

User types: "I need to figure out who else is doing this"

- Intent: "competitive" signal = 0.8
- Graph: competitive-analysis has 0 artifacts, 0 edges
- MINTO: competitive-analysis has no governing thought, confidence = 0

Combined: (0.8 * 0.4) + (1.0 * 0.3) + (1.0 * 0.3) = 0.92

Larry: "Your competitive analysis is empty while your solution design has 3 artifacts. That is a reverse salient -- your understanding of the solution is running ahead of your understanding of the landscape. Want me to run /mos:challenge-assumptions or /mos:compare-ventures?"

## Difference from room-proactive

room-proactive fires at SessionStart with static gaps. Skill-offer-engine fires on EVERY UserPromptSubmit, reading the user's INTENT and triangulating against live graph + MINTO state. The difference: notification vs conversation. Users ignore notifications. They respond to conversations.

## Implementation

- New file: scripts/skill-offer-engine.cjs (~100 lines)
- Wired into: scripts/intent-classifier.cjs (UserPromptSubmit hook)
- Reads from: room.db (node:sqlite), room/*/MINTO.md (filesystem)
- Outputs to: additionalContext in hook JSON response
- Token cost: ~200 tokens per message (only when offer fires, 0 when it doesn't)

## GSD execution

```
/gsd:plan-phase 88
```

Estimated: 2-3 days. One new script + one hook modification + MINTO parser reuse.

## Why this matters

This is the difference between MindrianOS as a tool belt (user picks the right wrench) and MindrianOS as a thinking partner (the right wrench offers itself when you reach for something). Tyler said "I'm the one asking more questions here." With the skill-offer-engine, the system asks the right questions because it knows where the reasoning is weak.

## Cross-references

- [[solution-design/ui-ux-pathways/lazygraph-chat-architecture]] -- 57x SQL-targeted query pattern reused
- [[solution-design/ui-ux-pathways/architecture-vision]] -- bidirectional control surface this feeds
- [[competitive-analysis/causal-claims-from-meetings]] -- Claims 2 and 6 solved by contextual offers
