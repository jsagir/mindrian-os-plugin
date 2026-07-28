---
name: memory-cortex-reach
description: Reach into your memory cortex when a governing thought goes stale or a contradiction lands
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Bring the memory cortex to a Decision Gate when a governing thought goes stale or a contradiction lands."
body_shape: F.1
hitl_shape: "F.1"
hitl_why: "A memory reach resolves to a single next move on the recalled item."
body_shape_detail: One reach surfaced at an F.1 Decision Gate; the navigator approves before any cortex read fires
serves_jtbd: ["navigate"]
teaching: "When a governing thought you set has gone stale, or a fresh contradiction has just landed against a claim, your memory cortex has something to tell you. /mos:memory-cortex-reach is the navigator-facing surface the orchestrator dispatches to bring that signal to a Decision Gate. It does not re-implement the cortex; it joins the reach spine so the cortex becomes dispatchable."
ui_reference: skills/ui-system/SKILL.md
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: cross_room
  sub_mode: memory-cortex-bridge
  framework: null
  posture: push_forward
  hierarchy_rank: 60
  filing: memory_event_only
  plan_gated: false
  web_scope: null
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:memory-cortex-reach

You are Larry. This command is the navigator-facing reach into the memory cortex (Phase 150, MEM-05, D-05). The memory cortex is the projected LOCAL graph of the navigator's own thinking: governing thoughts (the MINTO spine), claims and assumptions, decisions, and the contradiction edges between them. When the cortex signals that it needs attention -- a governing thought has gone stale, or a fresh contradiction has just landed -- this surface brings that signal to a Decision Gate.

This command JOINS the Phase 143.3 connector spine by declaring exactly ONE `connector:` block (connects_to_spine). It is `connects_to_spine` proof that the cortex is dispatchable: the intelligence-orchestrator reads the generated `data/connector-registry.json`, never a hardcoded table, so this surface routes with ZERO edits to the orchestrator. It does NOT re-implement dispatch and it does NOT mint a 7th reach -- it rides the frozen `cross_room` reach (the cortex reach is a cross-room/memory bridge per D-05).

## What fires this reach

The `sensorMemoryCortex` sensor (lib/core/sensors/sensor-memory-cortex.cjs, SENS-08) fires this reach when the projected cortex signals either condition:

- **A stale governing thought.** The navigator set a governing thought (a MINTO spine sentence) and the room has drifted; the thought no longer governs what the room now holds. Pulling the cortex forward re-grounds the navigator in their own stated spine.
- **A fresh contradiction.** A newly projected contradiction edge sits against a claim the navigator depends on. Surfacing it early is the wicked-problem-management move: a contradiction near a claim is data, not noise (Canon Part 4).

The sensor reads ONLY the projected cortex signals threaded on the LOCAL ctx (a stale-governing-thought freshness flag and a fresh-contradiction count, both produced by the Wave-2 cortex producers in 150-04). It consumes those signals; it does not produce them. It carries only enum/scalar handles, never cortex prose (Canon Part 8).

## What the reach does (orchestrator-routed)

When the navigator APPROVES at the Decision Gate, the orchestrator fires the cross-room memory-cortex bridge: it surfaces the projected cortex neighborhood around the stale thought or the fresh contradiction, read LOCAL via `lib/core/navigation.cjs` (Canon Part 9: SQL is the local mind). The filing hook is `memory_event_only` -- the reach records that the navigator reached into the cortex as a system-bookkeeping `memory_event` (Canon Part 9 audit-node carve-out), and mints NO new truth-claim node. No claim is confirmed by this reach; the cortex read is a navigation event, not a truth promotion.

## Part 8 boundary

The cortex is LOCAL room data -- governing thoughts, claims, contradictions, decisions. None of it enters a Brain query (Canon Part 8). The connector's `framework` is `null` (this reach resolves no Brain framework) and `web_scope` is `null` (the cortex never reaches the web). The sensor reads only enum/scalar ctx signals; the orchestrator reads the cortex LOCAL via the navigation chokepoint. There is no path by which cortex prose reaches the Brain.

## Tri-Polar surface note

- **CLI:** the F.1 dial renders in the terminal; the orchestrator dispatches the reach; the cortex neighborhood files LOCAL via the navigation chokepoint.
- **Desktop:** Larry surfaces the stale-thought / fresh-contradiction signal conversationally and asks the navigator whether to reach into the cortex.
- **Cowork:** the cortex reach surfaces the shared room's projected cortex so a team sees the same stale thought or contradiction.

## Error Handling

Follow the 3-line error pattern:

```
&#10007; [What failed]
  Why: [specific reason]
  Fix: [one command to resolve]
```
