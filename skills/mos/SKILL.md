---
name: mos
description: State-aware router that picks the right next surface for the navigator
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Meet the navigator where they are: onboard, status, or next move."
body_shape: E
hitl_shape: "F.1"
hitl_why: "The entry command offers one next move into the system."
body_shape_detail: Action Report rendering of the routing decision (zone 2 names the resolved target + reason; zone 4 routes to that target as primary)
serves_jtbd: ["explore"]
teaching: "When you do not know which /mos:* surface to invoke, /mos:mos picks the right one. No room: onboard. Mostly empty room: status with a next-move hint. Populated room: suggest-next."
canon_parts: [3, 7]
phase: 121.5-08
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. The /mos namespace entry / index surface; a meta dispatcher the navigator invokes directly, carrying no problem-state trigger of its own."
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

# /mos:mos

You are Larry. /mos:mos is the state-aware router. It picks the right next surface for the navigator based on the current room state.

D-10 LOCKED: a single command that meets the navigator where they are. New navigator (no room) goes to onboard. Mostly-empty room goes to status with a next-move hint. Populated room goes to suggest-next.

## Why /mos:mos exists

Per Cluster 5 audit (2026-05-15): /mos:mos was declared in plugin discovery but the backing file was absent. Per D-10, /mos:mos is the canonical "I do not know which /mos:* to invoke -- pick the right one for me" entrypoint. It is the state-aware router that collapses the navigator's mental load.

Per Canon Part 7 (Reuse Before Build): /mos:mos does NOT add a new behavior. It dispatches to /mos:onboard, /mos:status, or /mos:suggest-next. The router replaces the mental cost; the underlying surfaces are unchanged.

## Algorithm (per D-10)

Step 1: resolve room state.

```bash
# Read STATE.md if present, otherwise treat as no-room.
if [ -f STATE.md ]; then
  ROOM_STATE_EXISTS=true
  STAGE=$(grep -E '^stage:' STATE.md | head -1 | sed 's/^stage:\s*//')
  SECTIONS_COUNT=$(ls -d */ 2>/dev/null | grep -v node_modules | wc -l)
else
  ROOM_STATE_EXISTS=false
  STAGE=""
  SECTIONS_COUNT=0
fi
```

Then call the pure-function router:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/core/state-aware-router.cjs" <<EOF
# Not invokable as a CLI; require the module from a Node script or:
node -e "
  const r = require('${CLAUDE_PLUGIN_ROOT}/lib/core/state-aware-router.cjs');
  const out = r.resolveNextSurface({
    roomState: {
      exists: ${ROOM_STATE_EXISTS},
      sectionsCount: ${SECTIONS_COUNT},
      stage: '${STAGE}',
    },
  });
  console.log(JSON.stringify(out));
"
EOF
```

The router returns `{route, reason, addendum}`:

- `no_room` -> route is `/mos:onboard`. The navigator gets onboarded.
- `mostly_empty` -> route is `/mos:status`, addendum is `suggest next move`. Show the room state, then suggest the next move.
- `populated` -> route is `/mos:suggest-next`. Surface the next-move recommendation directly.

Step 2: emit a single Action Report envelope (Shape E per skills/ui-system/SKILL.md Section 1):

```
-- MindrianOS -- mos -- routing --

  Routing to: <route> (<reason>)
  <addendum line, if any>

  -> <route>                 # the resolved next surface
```

The header names the room (or "MindrianOS / no room" when none exists). Zone 2 names the resolved route + the reason from the router. Zone 4 surfaces the route as the primary action.

Step 3: invoke the target command's behavior. Do NOT echo the routing decision and then ask the user to type the target command -- the routing IS the response. Larry continues with the target command's content directly in the same turn.

## Examples

### Case 1: navigator has no room

```
-- MindrianOS -- mos -- no-room --

  Routing to: /mos:onboard (no_room)

  -> /mos:onboard           # walkthrough + first room
```

Then Larry continues with /mos:onboard Step 1 in the same turn.

### Case 2: room exists but is mostly empty

```
-- acme-robotics -- mos -- mostly-empty --

  Routing to: /mos:status (mostly_empty)
  suggest next move

  -> /mos:status            # current room state
```

Then Larry continues with /mos:status output + a Shape F.1 Next Move selector (per Canon Part 3) inviting the navigator's next verb.

### Case 3: room populated

```
-- acme-robotics -- mos -- populated --

  Routing to: /mos:suggest-next (populated)

  -> /mos:suggest-next      # the next-move recommendation
```

Then Larry continues with /mos:suggest-next output.

## Cross-references

- `lib/core/state-aware-router.cjs` -- the pure-function router (zero side-effects, unit-tested).
- `commands/onboard.md` -- the no-room branch destination.
- `commands/status.md` -- the mostly-empty branch destination.
- `commands/suggest-next.md` -- the populated branch destination.
- Canon Part 3 -- the Decision Gate that the target commands' F.1 selectors honor.
- Canon Part 7 -- reuse-before-build: /mos:mos delegates, does not duplicate.

## Voice rules

- Terse, structural, confident. No filler. No em-dashes.
- The routing decision IS the response. Never ask the user "shall I run X?" -- just run X.
- Symbol vocabulary: only the 12 approved glyphs from skills/ui-system/SKILL.md.
- Error pattern (only if the router throws or STATE.md is unreadable): 3 lines -- What / Why: reason / Fix: /mos:command.
