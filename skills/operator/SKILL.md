---
name: operator
description: "Show or manually set the conversation operator (JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE): the per-room state machine that governs how Larry renders responses"
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
compatibility: Requires Claude Code (or a host implementing disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.
help_jtbd: "See or change the conversation operator state."
argument-hint: "[history] [set <op>] [reset] [--json]"
body_shape: E (Action Report)
hitl_shape: "F.1"
hitl_why: "The operator view offers one next move on the current state."
body_shape_detail: current state + last 5 history (default), full history (history subcommand), Shape F.1 picker (set subcommand), Shape F.4 confirmation (reset subcommand)
serves_jtbd: ["explore"]
teaching: "When you want to see or set how Larry should render right now, /mos:operator shows the conversation state machine: JUST_TALK, EXPLORE_CAPTURE, BUILD_ROOM, METHODOLOGY, or DECISION_GATE."
allowed-tools: Bash Read AskUserQuestion
disable-model-invocation: false
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: operator
  framework: null
  posture: hold
  hierarchy_rank: 36
  filing: none
  plan_gated: false
  web_scope: null
---

# /mos:operator

Inspect or manually set the conversation operator for the active room. The operator is the state primitive that governs Larry's rendering: JUST_TALK suppresses 4-zone output, BUILD_ROOM emits full Shape E, METHODOLOGY suppresses spontaneous Zone 4 footers, DECISION_GATE locks Shape F.x.

The operator state file lives at `<roomDir>/.mindrian/conversation-operator.json` (per-room, never global). Hooks (Phase 99-04) keep it fresh automatically as you type, invoke tools, and end sessions. Most users never need this command directly -- the heuristic classifier (Phase 99-02) handles transitions silently. Use `/mos:operator` when:

- The poller (Phase 95.1 class F) reports the operator looks wrong
- You want to inspect what Larry currently believes the operator is
- You want to manually override (e.g., force JUST_TALK to stop filing for the rest of the session)
- You are debugging the state machine

## Step 1: Parse the user's intent

Look at the invocation:

- `/mos:operator` (no args) -> show current state + last 5 history entries (Shape E)
- `/mos:operator history` -> show full history up to 50 entries (Shape E)
- `/mos:operator set <op>` -> render Shape F.1 picker; if the user selected an operator inline (e.g., `set BUILD_ROOM`), perform the transition immediately and re-render Shape E showing the new state
- `/mos:operator reset` -> render Shape F.4 confirmation; on user confirmation, transition to JUST_TALK
- `/mos:operator --json` -> machine-readable output (for hooks / regression tests)

Combine `--json` with any subcommand: `/mos:operator history --json`.

## Step 2: Execute

Run via Bash:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/operator-command.cjs" $@
```

The script does the work:

1. Resolves the active room from `~/MindrianRooms/.rooms/registry.json`
2. Loads `<roomDir>/.mindrian/conversation-operator.json` via `lib/conversation/operator.cjs.getCurrent`
3. Branches on subcommand: render Shape E, render Shape F.1, render Shape F.4, or perform a transition
4. For `set` subcommand: validates the requested operator against the 7 transition rules; rejects invalid transitions with a 3-line stderr per Canon Part 3 Rule 2 and exits non-zero

## Step 3: Render the output

The script outputs a 4-zone Shape E (Action Report) per `skills/ui-system/SKILL.md`. Display the script's stdout directly. Do not re-format. Do not strip ANSI color codes.

## Example output (default -- show current state)

```
-- mindrianos -- operator -- BUILD_ROOM --

  ■ Current               BUILD_ROOM
     entered  2026-05-01T10:42:00Z (3m ago)
     previous EXPLORE_CAPTURE
     context  active_section=research, methodology=null

  ■ Last 5 history
     ├─ JUST_TALK         2026-05-01T10:30:00Z  trigger=session_start
     ├─ EXPLORE_CAPTURE   2026-05-01T10:35:00Z  trigger=user_message
     └─ BUILD_ROOM        2026-05-01T10:42:00Z  trigger=mos_command

  Summary: total transitions=3, history_used=3/50

  ▶ /mos:operator history     # full history
  ▷ /mos:operator set <op>    # manual transition
  ▷ /mos:operator reset       # return to JUST_TALK
```

## Example output (history subcommand)

```
-- mindrianos -- operator -- BUILD_ROOM --

  ■ Full history (3/50 entries)
     ├─ JUST_TALK         2026-05-01T10:30:00Z  trigger=session_start          from=null
     ├─ EXPLORE_CAPTURE   2026-05-01T10:35:00Z  trigger=user_message           from=JUST_TALK
     └─ BUILD_ROOM        2026-05-01T10:42:00Z  trigger=mos_command            from=EXPLORE_CAPTURE

  Summary: total transitions=3, history_used=3/50, oldest=2026-05-01T10:30:00Z

  ▶ /mos:operator             # current state
  ▷ /mos:operator set <op>    # manual transition
  ▷ /mos:operator reset       # return to JUST_TALK
```

## Example output (set subcommand -- Shape F.1 picker)

```
-- mindrianos -- operator -- set --

  ■ Manual operator transition
     current: BUILD_ROOM

  [F.1 Next Move]
   ▶ JUST_TALK
   ▷ EXPLORE_CAPTURE
   ▷ BUILD_ROOM         (current -- selecting this is a no-op)
   ▷ METHODOLOGY
   ▷ DECISION_GATE
   ▷ Free-Text

  ▶ /mos:operator             # cancel and re-show state
  ▷ /mos:operator history     # see full history first
```

## Example output (reset subcommand -- Shape F.4 confirm)

```
-- mindrianos -- operator -- reset --

  ■ Reset operator to JUST_TALK
     current: BUILD_ROOM
     this discards your active filing context (active_section=research)

  [F.4 Confirm Reset]
   ▶ Confirm reset to JUST_TALK
   ▷ Cancel

  ▶ /mos:operator             # show current state
  ▷ /mos:operator history     # see full history
```

## Note on Shape F.1 + F.4 deferral

Per Phase 95.1-04 D-19 deferral pattern, the F.1 picker and F.4 confirmation render as STRUCTURAL marker blocks in stdout. Larry handles conversational selection: when the user types "set to METHODOLOGY" or "yes, reset" in natural language, Larry interprets and re-invokes the command with the explicit verb (e.g., `/mos:operator set METHODOLOGY`).

Phase 88.2 (`uiux-selector-block`) will replace the marker block with the canonical AskUserQuestion primitive. See `.planning/phases/99-conversation-operator-state-machine/operator-shape-f1-deferred.md` for the deferral note + re-trigger condition.

## Voice rules

When Larry surfaces the output conversationally:

- "You're currently in BUILD_ROOM. Filing is live; every response ends with the 4-zone footer."
- "Want to override? `/mos:operator set <op>` lets you pick from the five canonical operators."
- "If the operator looks wrong, `/mos:doctor --ui-compliance` will tell you whether the renderer is honoring it correctly."

NEVER:
- Apologize for the operator state being what it is. The state is the truth.
- Suggest the user "should" be in a particular operator. The user picks.
- Re-show the example output blocks above when speaking conversationally; just describe what they would see.
