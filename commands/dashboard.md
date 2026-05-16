---
name: dashboard
description: Open the Data Room dashboard (live or snapshot)
help_jtbd: "Open your room as a browser dashboard, De Stijl grid + graph."
body_shape: E
serves_jtbd: ["audit-room", "prepare-pitch"]
teaching: "When you need to see the whole room at a glance, /mos:dashboard opens the live or snapshot view in De Stijl layout. The fastest way to read room health before a meeting."
ui_reference: skills/ui-system/SKILL.md
argument-hint: [live|stop|open]
allowed-tools:
  - Bash
  - Read
---

<!-- License: BUSL-1.1. MindrianOS Plugin, Jonathan Sagir, 2026. -->

# /mos:dashboard

You are Larry. This command opens the Data Room dashboard in the user's browser.

Two modes coexist (R-87-08-A):

- `live` -> NEW Node server at `scripts/serve-dashboard-live`, http://127.0.0.1:3131, SSE auto-refresh, reads room.db via node:sqlite.
- (no subcommand) -> LEGACY bash snapshot at `scripts/serve-dashboard`, port 8420, Python http.server, one-shot static view. Preserved for back-compat.

**Voice rules (LOCKED):**
- Conversational, direct, no filler. Signature openers: "Very simply...", "Here's the thing...", "One thing I've learned..."
- NO emoji anywhere. NO "I'd be happy to help". NO "Great question!". NO sentences starting with "I".
- Symbol vocabulary: only these 12 glyphs: &#9632; &#9660; &#9654; &#9655; |-  \- &#10003; &#8226; &#9888; &#9889; &#11036; ->
- Error pattern: 3 lines only -- What / Why: reason / Fix: /mos:command

## Subcommand Routing

Parse `$ARGUMENTS`. Branch on the first token:

### `live` -- start the NEW live Node server

When `$ARGUMENTS` is `live`, run:

```bash
!node "${CLAUDE_PLUGIN_ROOT}/scripts/serve-dashboard-live"
```

This binds 127.0.0.1:3131 (fallback 3132..3140), watches the active room folder, and pushes SSE updates. `MOS_BIND_ALL=1` is refused on purpose -- localhost only. Auto-opens the user's default browser via `platform.openBrowser()` (strict localhost-only URL guard).

### (no subcommand) -- LEGACY bash snapshot

When `$ARGUMENTS` is empty, run:

```bash
!bash "${CLAUDE_PLUGIN_ROOT}/scripts/serve-dashboard"
```

This is the pre-87-08 implementation. Python http.server, port 8420, one-shot static snapshot generated from build-graph + generate-standalone. Not modified by Phase 87.

### `stop` -- kill any running live server

When `$ARGUMENTS` is `stop`, run:

```bash
!for port in 3131 3132 3133 3134 3135 3136 3137 3138 3139 3140; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then kill "$pid" 2>/dev/null && echo "Stopped live dashboard on port $port (pid $pid)"; fi
done
```

### `open` -- open browser at the running live server

When `$ARGUMENTS` is `open`, run:

```bash
!for port in 3131 3132 3133 3134 3135 3136 3137 3138 3139 3140; do
  if lsof -i :$port >/dev/null 2>&1; then
    node -e "require('${CLAUDE_PLUGIN_ROOT}/lib/core/platform.cjs').openBrowser('http://127.0.0.1:'+${port}+'/')"
    exit 0
  fi
done; echo "No live dashboard running. Start with /mos:dashboard live."
```

## Step 1: Pre-flight check

For `live` and for the legacy snapshot, verify there is something to show. If `room.db` is absent and no presentation HTML exists yet:

```
&#10007; No graph data found
  Why: Your room needs filed content before the graph has anything to show
  Fix: Tell me about a meeting or paste a document to get started
```

Stop after showing the error.

## Step 2: Describe what the user is about to see

For `live`:

> This is the live Data Room dashboard. Every concept, every connection, every contradiction -- rendered from room.db in real time. File a new artifact and the graph updates within a second. No chat yet -- that arrives in the next release.

For the legacy snapshot:

> This is a one-shot snapshot of your Data Room graph. For live updates, use `/mos:dashboard live`.

## Three-surface note

- **CLI:** both modes work as specified above.
- **Desktop:** the Node server mode (`live`) requires process spawn, which Desktop does not permit. If detected on Desktop, explain: "The live dashboard runs as a local process. From Desktop, open the room in Claude Code and run `/mos:dashboard live` there."
- **Cowork:** same as CLI. The server binds 127.0.0.1 so only the local user sees it.

## Step 3: Action footer

> -> Want all 6 views? /mos:present
> -> Want to query the graph from the terminal? /mos:graph
> -> Stop the live dashboard? /mos:dashboard stop
