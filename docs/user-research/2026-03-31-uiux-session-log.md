---
date: 2026-03-31
type: uiux-session-log
session: v1.5.0 upgrade + wiki launch on ALIGN X Milken room
severity: mixed (P1 blocker + P2 confusing + P3 cosmetic)
user: Jonathan (power user, multi-room setup)
room: align-x-milken (29 artifacts, 15 sections, Investment stage)
---

# UI/UX Session Log - 2026-03-31

## Context

User upgraded MindrianOS from v1.4.0 to v1.5.0, then ran `/mos:rooms open align-x-milken`
followed by `/mos:wiki` to browse the Data Room as a wiki.

---

## Issue 1: Wiki Shows "0 sections, 0 pages" (P1 - BLOCKER)

**What happened:**
User ran `/mos:wiki`, wiki server launched on port 8421, browser opened.
Page displayed: "No room sections found. Create a room with /mos:new-project to get started."

**Root cause:**
`scripts/serve-wiki` line 7 hardcodes the default room path:
```bash
ROOM_DIR="${ROOM_DIR:-./room}"
```
This resolves to `MindrianOS-Plugin/room/` (the CWD), not the active room
from the registry (`/home/jsagi/rooms/align-x-milken`).

**Expected behavior:**
`/mos:wiki` should automatically resolve the active room from `.rooms/registry.json`
and pass it to the wiki server. Zero-config for the user.

**Workaround applied:**
```bash
ROOM_DIR=/home/jsagi/rooms/align-x-milken bash scripts/serve-wiki
```

**Fix needed:**
`serve-wiki` should call `scripts/room-registry get-active` and `read` to resolve
the active room path, falling back to `./room` only if no registry exists.

```bash
# Proposed fix for serve-wiki line 7:
if [ -z "${ROOM_DIR:-}" ]; then
  ACTIVE=$(bash "${SCRIPT_DIR}/room-registry" get-active 2>/dev/null || true)
  if [ -n "$ACTIVE" ]; then
    ROOM_PATH=$(bash "${SCRIPT_DIR}/room-registry" read "$ACTIVE" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('path',''))" 2>/dev/null || true)
    if [ -n "$ROOM_PATH" ] && [ -d "$ROOM_PATH" ]; then
      ROOM_DIR="$ROOM_PATH"
    fi
  fi
  ROOM_DIR="${ROOM_DIR:-./room}"
fi
```

**UX impact:** Complete blocker. User sees empty wiki with no indication of what went wrong.
The "create a room" message is misleading since the room exists and is active.

**Affected scripts (same pattern):**
- `scripts/serve-wiki` - uses `ROOM_DIR="${ROOM_DIR:-./room}"`
- `scripts/serve-dashboard` - likely same issue
- `scripts/generate-presentation.cjs` - takes room dir as CLI arg (ok)
- `scripts/compute-state` - takes room dir as CLI arg (ok)
- `scripts/build-graph-from-kuzu.cjs` - takes room dir as CLI arg (ok)
- `scripts/compute-hsi.py` - takes room dir as CLI arg (ok)

**Pattern:** Scripts that take room dir as a CLI argument work fine.
Scripts that use env vars or defaults break in multi-room setups.

---

## Issue 2: STATE.md Contains Raw ANSI Escape Codes (P2 - CONFUSING)

**What happened:**
`compute-state` outputs ANSI color codes for terminal rendering.
When piped to STATE.md, the file contains raw escape sequences:

```
│ □ [38;2;166;61;47mEMPTY - GAP[0m                       │
```

**Expected behavior:**
STATE.md is a markdown file read by other tools (wiki, presentation, skills).
It should contain clean markdown, not terminal escape codes.

**Fix needed:**
Either:
1. `compute-state` should detect when stdout is not a TTY and strip ANSI codes
2. Or use markdown formatting instead of ANSI (e.g., `**EMPTY - GAP**` with a red emoji or marker)

```bash
# Simple fix: detect TTY
if [ -t 1 ]; then
  RED="\033[38;2;166;61;47m"
  RESET="\033[0m"
else
  RED=""
  RESET=""
fi
```

**UX impact:** STATE.md looks broken when viewed in any non-terminal context
(wiki, GitHub, VS Code preview, presentation views).

---

## Issue 3: Port Collision on Relaunch (P3 - MINOR)

**What happened:**
After killing the wiki server on port 8421 and relaunching, the new server
bound to port 8422 because the old port was still in TIME_WAIT.

**Current behavior:** Auto-increment to next available port (8421-8430 range).
This actually works well - the script handles it gracefully.

**Potential issue:** The skill output told the user port 8421, but the server
actually ran on 8422. If the user bookmarks the port, it changes between sessions.

**Suggestion:** Print the actual port clearly. Consider a `/mos:wiki --port` flag
or a `.wiki-port` file for session persistence.

---

## Issue 4: Presentation Generator Warnings (P3 - NOISE)

**What happened:**
`generate-presentation.cjs` outputs warnings for optional scripts:
```
Warning: command failed: bash "scripts/build-graph" "rooms/align-x-milken" ...
Warning: command failed: bash "scripts/analyze-room" "rooms/align-x-milken"
```

These scripts don't exist in v1.5.0 (replaced by `build-graph-from-kuzu.cjs`
and `compute-hsi.py`). The generator still tries to call the old scripts
and shows warnings.

**Fix needed:**
Update `generate-presentation.cjs` to use the v1.5.0 scripts or suppress
warnings when the old scripts aren't present. The generator already handles
the case gracefully (uses graph.json from KuzuDB), so the warnings are
pure noise.

---

## Issue 5: Registry Doesn't Track venture_stage Correctly (P3 - DATA)

**What happened:**
The registry had `venture_stage: "Discovery"` while the room's STATE.md
had `venture_stage: Investment`. The registry was stale.

**Root cause:**
`/mos:rooms open` reads the registry entry but doesn't cross-check
against STATE.md. The venture stage can be updated via compute-state
or manual edit, but the registry doesn't sync.

**Fix needed:**
When opening a room, read STATE.md frontmatter and update the registry
if the venture_stage has changed.

---

## Issue 6: Wiki Empty State Message is Misleading (P2 - UX COPY)

**What happened:**
When the wiki can't find room sections, it displays:
> "No room sections found. Create a room with /mos:new-project to get started."

In this case, the room existed with 29 artifacts. The message should
distinguish between:
1. "No room exists" - suggest /mos:new-project
2. "Room exists but wiki can't find it" - suggest checking ROOM_DIR path
3. "Room exists but has no sections" - suggest adding content

**Better empty state:**
```
No sections found at: {ROOM_DIR}

Possible causes:
- Wrong room directory (check /mos:rooms where)
- Room has no .md files yet (add content with /mos:room)

Current ROOM_DIR: {path}
```

---

## Issue 7: diagrams/ Section Contains node_modules Pollution (P2 - DATA)

**What happened:**
The `diagrams/` section in the room contains a `node_modules/` directory
with npm packages (yargs, cliui, emoji-regex, etc.). These showed up in
artifact discovery, inflating counts in some scripts.

The compute-hsi.py correctly skips node_modules via SKIP_DIRS, but
compute-state counts them as artifacts, showing `diagrams` as non-empty
in some contexts while the wiki shows it as empty (different skip logic).

**Fix needed:**
1. Add `node_modules` to .gitignore in room template
2. All scripts that walk room directories should skip node_modules
3. Consider cleaning the existing diagrams/node_modules/

---

## Severity Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Wiki defaults to ./room, ignores registry | P1 Blocker | Workaround applied |
| 2 | STATE.md has raw ANSI codes | P2 Confusing | Open |
| 3 | Port collision on relaunch | P3 Minor | Auto-handled |
| 4 | Presentation warns about removed scripts | P3 Noise | Open |
| 5 | Registry venture_stage stale | P3 Data | Manual fix applied |
| 6 | Wiki empty state message misleading | P2 UX Copy | Open |
| 7 | diagrams/ has node_modules pollution | P2 Data | Open |

---

## Recommendations

1. **Room resolution should be centralized.** Every script that needs a room path
   should call a shared `resolve-room` function that checks: CLI arg > ROOM_DIR env >
   registry active room > ./room fallback. This exists as `scripts/resolve-room` concept
   in the /mos:rooms skill but isn't wired to all scripts yet.

2. **Empty states need diagnostic info.** When a view shows "nothing found", always
   include the path it searched and a diagnostic hint. Users with active rooms should
   never see "create a room" messages.

3. **Terminal vs file output.** Any script that can be piped to a file must detect
   TTY and strip formatting. STATE.md, MINTO.md, and any generated .md should be
   clean markdown.

4. **Multi-room is the default now.** All scripts written for single-room (`./room`)
   need an audit pass for registry-aware resolution. The v1.5.0 scripts (compute-hsi,
   build-graph-from-kuzu, hsi-to-kuzu) correctly take room dir as CLI arg. The
   older scripts (serve-wiki, serve-dashboard) don't.
