---
name: rooms
description: List, switch, or archive project rooms
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "List, switch, archive, or organize rooms in ~/MindrianRooms/."
argument-hint: "[list|switch|archive|park]"
body_shape: B (Semantic Tree)
hitl_shape: "F.1"
hitl_why: "Room switch or archive offers a single next move to pick one room."
serves_jtbd: ["audit-room"]
teaching: "When you have multiple venture rooms and need to switch, list, or archive them, /mos:rooms manages the registry. One person, many ventures."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. Multi-room registry management the navigator drives deliberately; an operator surface with no problem-state trigger."
---

<!--
Phase 192-01 (SEED-020 menu sweep): the `list` and `where` subcommands close with a live Shape F.1
AskUserQuestion card (see each subcommand's Step 3), composed with the shape
`lib/hmi/shape-f1-renderer.cjs` (renderShapeF1) produces and `lib/hmi/selector-dispatcher.cjs`
(appendAskUserQuestionTrailer) fires -- no bespoke widget. The `new`, `open`, `close`, `archive`,
`git-setup`, and `git-status` subcommands intentionally KEEP their 2-3 line text footers: they are
single terminal confirmations, not multi-option next-move choices, so a future sweep should not
re-flag them as an unexplained gap. The connector.excluded:true block below stays true.
-->

# /mos:rooms

You are Larry. This command manages multiple project rooms using **Body Shape B (Semantic Tree)** per the UI Ruling System.

## UI Format

- **Body Shape:** B (Semantic Tree) for all subcommands
- **Reference:** `skills/ui-system/SKILL.md`
- All subcommands follow the 4-zone anatomy: Header Panel, Content Body, Intelligence Strip (conditional), Action Footer (NEVER omitted)
- **Symbols:** Only the 12 approved glyphs. No emoji. No em-dashes.

## Routing

Parse user input to determine which subcommand to execute. If no subcommand is given, default to `list`.

Subcommands: `list`, `new`, `open`, `close`, `archive`, `where`, `git-setup`, `git-status`

**Natural language mapping (Desktop/Cowork):**
- "which room am I in?" / "where am I?" -> `where`
- "switch to fintech" / "open fintech" -> `open fintech-startup`
- "show my rooms" / "list rooms" -> `list`
- "create a new room" / "new room" -> `new`
- "park this room" / "close room" -> `close`
- "archive the old project" -> `archive`
- "set up git for this room" / "add git" -> `git-setup`
- "git status" / "is git configured?" -> `git-status`

---

## Subcommand: list

**Trigger:** `/mos:rooms` or `/mos:rooms list`

### Step 1: Get Room Data

Determine `ROOMS_HOME` (`$MINDRIAN_ROOMS_HOME` or `~/MindrianRooms`).

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" list` to get JSON array of rooms. The registry lives at `$ROOMS_HOME/.rooms/registry.json`.

If the command fails (no registry exists), check for legacy `room/` directory:

- If `room/` exists: Tell the user they have a single-room workspace. Suggest adopting it:
  > "You have an existing room/ project. Run `/mos:rooms new` to create additional rooms -- I'll offer to adopt your existing project into the registry first."

  Then STOP.

- If no room at all: Tell the user they have no rooms yet. Suggest:
  > "No rooms found. Your rooms will live at ~/MindrianRooms/. Run `/mos:rooms new` or `/mos:new-project` to get started."

  Then STOP.

### Step 2: Render Room List

For each room in the JSON array, count .md files in the room directory (excluding STATE.md, ROOM.md, USER.md) to get the entry count.

Render using Body Shape B (Semantic Tree):

```
-- MindrianOS -- Rooms -- ~/MindrianRooms/ -------------------------

  |- [filled-square] acme-robotics          active [git]  Pre-Opportunity   8 entries
  |- [triangle-right] fintech-startup        parked        Discovery         14 entries
  |- [hollow-triangle] biotech-venture        archived      Validation        22 entries

  Active: acme-robotics (switched 2 hours ago)
  Path: ~/MindrianRooms/acme-robotics/

  [triangle-right] /mos:rooms open fintech-startup   Switch to parked room
  [hollow-triangle] /mos:rooms new                    Create a new room
  [hollow-triangle] /mos:rooms where                  Quick sanity check
```

Show `[git]` after the room status if `git_enabled` is `"true"` in the registry entry for that room.

Symbol key:
- `■` (filled square) = active room
- `▶` (filled triangle) = parked room
- `▷` (hollow triangle) = archived room

Compute "switched X ago" from the active room's `last_opened` timestamp relative to now.

### Step 3: Action Footer (Zone 4) -- live F.1 selector

Do NOT close with a bare bullet list. Render the 2-3 grounded next steps as a live Shape F.1
(Next Move) AskUserQuestion card so the navigator picks a move instead of re-typing a command.
Use the AskUserQuestion tool composed with the SAME verb/option shape
`lib/hmi/shape-f1-renderer.cjs` (`renderShapeF1`) produces and `lib/hmi/selector-dispatcher.cjs`
(`appendAskUserQuestionTrailer`) fires -- no hand-built JSON.

Options (each label = the command, description = the one-line why):
- If parked rooms exist: `/mos:rooms open <name>` -- switch to a parked room
- Always: `/mos:rooms new` -- create a new room
- Always: `/mos:rooms where` -- quick sanity check
- Free-Text (appended LAST, automatically) -- "something else / just tell me"

The text bullet list above is preserved as the non-interactive floor for Desktop / Cowork /
piped / non-TTY callers; the live card is the interactive close on top of it.

---

## Subcommand: new

**Trigger:** `/mos:rooms new <name>`

### Step 1: Validate Name

The name must be a valid directory slug: lowercase, alphanumeric, hyphens only.

If the user provides a human-readable name like "Acme Robotics":
- Slugify to `acme-robotics`
- Store the original as `venture_name`

If no name provided, ask: "What should I call this room?"

### Step 2: Resolve ROOMS_HOME and Check State

Determine the central rooms location:

```bash
ROOMS_HOME="${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}"
```

If `$ROOMS_HOME/.rooms/registry.json` does NOT exist AND legacy `room/` directory exists in the workspace:

**FIRE THE CARD -- mandatory, this gate is not optional narration.** This is a Decision Gate (adopt the legacy room, or not) -- the same class of gate `/mos:ignite`'s B1/B2 carry. You MUST surface it by FIRING the AskUserQuestion tool (the interactive up/down selector card) on any card-capable surface (Claude Code CLI, Cowork) in this same turn. You may NOT render this as an ASCII box or a bare prose question and treat silence as "no". If you draw the gate, you fire the card (SEED-021 no-card-no-picture doctrine) -- the Wave-1 GA-4 card-fire interceptor (`scripts/check-card-fire.cjs`) catches a reached-gate turn that renders text but never fires the card.

Card header: "Adopt existing room?" Question: "You have an existing room/ project. Want me to adopt it into ~/MindrianRooms/ so you can have multiple rooms?" Options: **Adopt** (yes) / **Skip** (no, proceed without adoption) / Free-Text (appended last, automatically).

If Adopt:
- Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-room" $PWD --adopt` to create registry with existing room
- Then proceed to Step 3

If Skip: Proceed without adoption (the old room/ still works via legacy fallback).

**Do not narrate room creation from this step.** Adoption only registers the pre-existing legacy `room/` under the name `"default"` -- it is NOT the new named room the user asked for. The actual new room is created ONLY when `/mos:ignite`'s B2 Approve gate fires `birthRoom()` (see the routing note under Step 3). `resolve-room`'s legacy-fallback path returning a valid path with exit 0 is proof the OLD room still resolves, never proof a NEW room was created. Never say "room created" or "room's live" until `birthRoom()` has actually returned `{ok:true}`.

### Step 2.5: ICM Layer 0/1 Auto-Generation

Before creating the room, ensure ICM files exist at `$ROOMS_HOME`:

```bash
if [ ! -f "$ROOMS_HOME/CLAUDE.md" ]; then
  cp "${CLAUDE_PLUGIN_ROOT}/templates/icm/CLAUDE.md" "$ROOMS_HOME/CLAUDE.md"
fi
if [ ! -f "$ROOMS_HOME/INDEX.md" ]; then
  cp "${CLAUDE_PLUGIN_ROOT}/templates/icm/INDEX.md" "$ROOMS_HOME/INDEX.md"
fi
```

If `CLAUDE_PLUGIN_ROOT` is not set, resolve the templates relative to the plugin's installed location: `templates/icm/` at the plugin root (same fallback convention as `skills/admin/SKILL.md` and `skills/status/SKILL.md`). Do NOT use `readlink -f "$0"` to derive the plugin root -- under the Bash tool's actual invocation mechanism `$0` resolves to the shell binary itself, not this file's path, so that pattern silently computes the wrong directory on every call.

### Step 3: Create Room Directory

Create directory at `~/MindrianRooms/<slug>/` (under ROOMS_HOME) with the 8 standard sections:

```
~/MindrianRooms/<slug>/
  problem-definition/
    ROOM.md
  market-analysis/
    ROOM.md
  solution-design/
    ROOM.md
  business-model/
    ROOM.md
  competitive-analysis/
    ROOM.md
  team-execution/
    ROOM.md
  legal-ip/
    ROOM.md
  financial-model/
    ROOM.md
  team/
```

Each ROOM.md gets minimal frontmatter:

```yaml
---
section: {section-name}
purpose: {one-line purpose from section definitions}
---
```

Use the section definitions from `/mos:new-project` Step 4 for purpose and methodology defaults.

**Important (Phase 155-06 routing update):** `/mos:rooms new` now routes to /mos:ignite for the full Hooked first-cycle birth experience. Pass any name/slug the user provided as context. /mos:ignite runs B1 (starting-point gate) unless arrival_asset is determinable from the name context, then proceeds through B2 blueprint approve and B3 first-win. /mos:ignite owns the birth transaction (birthRoom via Plan 02). /mos:rooms new is the entry surface; /mos:ignite is the birth orchestrator.

Route to /mos:ignite after Step 2 (the adoption check -- Step 1 already captured the name/slug). The legacy Steps 3-6 below are preserved as the scaffold backend (invoked by ignite's new-project delegation), but /mos:rooms new no longer drives them directly.

### Step 4: Register Room

Run:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" create <slug> "<slug>" "<venture_name>" "Pre-Opportunity"
```

The registry create command automatically sets the new room as active and parks the previous one.

**Update INDEX.md:** After registration, refresh the routing index:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/update-icm-index" "$ROOMS_HOME"
```

### Step 5: Compute State

Run:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/compute-state" "$ROOMS_HOME/<slug>" > "$ROOMS_HOME/<slug>/STATE.md"
```

### Step 6: Report Success

Show success with Zone 1 header displaying the new room name:

```
-- MindrianOS -- <venture_name> --------------------------------------

  Room created: ~/MindrianRooms/<slug>/
  Status: active
  Venture stage: Pre-Opportunity
  Sections: 8

  [triangle-right] /mos:ignite           Start the birth conversation (B1/B2/B3 gates)
  [hollow-triangle] /mos:rooms list      See all your rooms
```

---

## Subcommand: open

**Trigger:** `/mos:rooms open <name>`

### Step 1: Validate Room Exists

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" read <name>` to check if the room is in the registry.

If not found, show 3-line error:
```
x Room not found: <name>
  Why: No room named "<name>" in .rooms/registry.json
  Fix: /mos:rooms list
```

Then STOP.

### Step 2: Check Room Status

Read the room's status from the registry entry.

If status is `archived`, warn the user:
> "This room is archived. Opening it will set its status to active. Continue?"

Wait for confirmation before proceeding. If user declines, STOP.

### Step 3: Switch Active Room

Run:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" set-active <name>
```

This parks the previous active room and sets the new one as active.

### Step 4: Report Success

Show Zone 1 header with the switched room name:

```
-- MindrianOS -- <venture_name> --------------------------------------

  Switched to: <name>
  Status: active
  Venture: <venture_name>
  Stage: <venture_stage>

  [triangle-right] /mos:status           Check room health
  [triangle-right] /mos:room             View Data Room
  [hollow-triangle] /mos:rooms where      Confirm active room
```

---

## Subcommand: close

**Trigger:** `/mos:rooms close`

### Step 1: Get Active Room

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" get-active` to get the current active room name.

If no active room (empty result), show error:
```
x No active room to close
  Why: No room is currently set as active in the registry
  Fix: /mos:rooms list
```

Then STOP.

### Step 2: Park the Room

Run:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" update <active-name> status parked
```

### Step 3: Clear Active Field

Clear the active field in the registry by running:
```bash
ROOMS_HOME="${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}"
python3 -c "
import json
with open('$ROOMS_HOME/.rooms/registry.json', 'r') as f:
    reg = json.load(f)
reg['active'] = ''
with open('$ROOMS_HOME/.rooms/registry.json', 'w') as f:
    json.dump(reg, f, indent=2)
"
```

**Update INDEX.md:** After parking, refresh the routing index:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/update-icm-index" "$ROOMS_HOME"
```

### Step 4: Report Success

```
-- MindrianOS -- No Active Room --------------------------------------

  Room <name> is now parked. No active room.

  [triangle-right] /mos:rooms list              See all rooms
  [triangle-right] /mos:rooms open <name>       Reopen this room
```

---

## Subcommand: archive

**Trigger:** `/mos:rooms archive <name>`

### Step 1: Validate Room Exists

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" read <name>` to check if the room is in the registry.

If not found, show 3-line error:
```
x Room not found: <name>
  Why: No room named "<name>" in .rooms/registry.json
  Fix: /mos:rooms list
```

Then STOP.

### Step 2: Check if Active

Read the room's status. If the room is currently active, warn the user:
> "This is your active room. Archiving it will leave you with no active room. Continue?"

Wait for confirmation. If user declines, STOP.

### Step 3: Archive the Room

Run:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" archive <name>
```

This sets the room status to `archived`. If the room was active, it also clears the active field.

**Update INDEX.md:** After archiving, refresh the routing index:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/update-icm-index" "${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}"
```

### Step 4: Report Success

```
-- MindrianOS -- Rooms -----------------------------------------------

  Room <name> is now archived.

  [triangle-right] /mos:rooms list              See all rooms
  [triangle-right] /mos:rooms open <other>      Switch to another room
```

If other non-archived rooms exist, suggest opening one by name.

---

## Subcommand: where

**Trigger:** `/mos:rooms where`

### Step 1: Get Active Room

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" get-active` to get the current active room name.

If no active room (empty result):
> "No active room. Run `/mos:rooms list` to see available rooms."

Then STOP.

### Step 2: Read Room Details

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" read <active-name>` to get the full registry entry.

### Step 3: Display Location

```
-- MindrianOS -- <venture_name> --------------------------------------

  Active room: <name>
  Path: ~/MindrianRooms/<name>/
  Venture: <venture_name>
  Stage: <venture_stage>
  Last opened: <timestamp>

  [triangle-right] /mos:status           Check room health
  [triangle-right] /mos:rooms open       Switch rooms
  [hollow-triangle] /mos:rooms list       See all rooms
```

Display the path as `~/MindrianRooms/<name>/` (abbreviated with ~). For legacy rooms that haven't migrated, show the actual path (e.g., `./room/`).

### Step 4: Close with the live F.1 selector

The three footer options above (`/mos:status`, `/mos:rooms open`, `/mos:rooms list`) are the
non-interactive text floor. On top of them, close with a live Shape F.1 (Next Move)
AskUserQuestion card so the navigator picks a next move rather than re-typing a command. Use the
AskUserQuestion tool composed with the SAME shape `lib/hmi/shape-f1-renderer.cjs` (`renderShapeF1`)
produces and `lib/hmi/selector-dispatcher.cjs` (`appendAskUserQuestionTrailer`) fires -- no bespoke
JSON. Free-Text is appended LAST automatically; never suppress it.

---

## Subcommand: git-setup

**Trigger:** `/mos:rooms git-setup [name]`

If no name provided, use the currently active room (get via `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" get-active`).

### Step 1: Validate Room

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" read <name>` to verify room exists.

If not found, show 3-line error and STOP.

### Step 2: Check Current Git State

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/git-ops" status <room_path>` to check if git is already configured.

If already enabled:
> "Git is already set up for this room."
> Show current status (remote URL, auto_push setting, LFS status).
> Offer to change settings: "Want to change auto-push mode? Current: <setting>."

If user wants to change auto_push:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" git-config <name> true "<existing_remote>" "<new_setting>"
```

Then STOP.

### Step 3: Initialize Git

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/git-ops" init <room_path>
bash "${CLAUDE_PLUGIN_ROOT}/scripts/git-ops" lfs-setup <room_path>
```

### Step 4: Offer GitHub Remote

Check gh CLI:
```bash
gh --version 2>/dev/null
```

If gh available, check auth:
```bash
gh auth status 2>/dev/null
```

If gh available AND authenticated:
> "Want me to create a GitHub repo for this room? (Private by default)"

If user accepts:
```bash
gh repo create <name> --private --source=<room_path> --push
```

Capture remote URL.

If gh NOT available:
> "GitHub CLI not installed. Setting up local git only. Install `gh` later to add a remote: https://cli.github.com/"

If gh available but NOT authenticated:
> "GitHub CLI found but not logged in. Run `gh auth login`, then try again. Setting up local git only for now."

### Step 5: First Commit

```bash
git -C <room_path> add -A
git -C <room_path> commit -m "room: initialize <venture_name> Data Room"
```

IMPORTANT: Use `git -C <room_path>` instead of `cd + git`. This keeps all git operations consistent with the scripts/git-ops pattern (no bare `cd` side effects, handles spaces in paths).

If remote configured:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/git-ops" push <room_path>
```

### Step 6: Update Registry

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" git-config <name> true "<remote_url_or_empty>" "off"
```

### Step 7: Report Success

```
-- MindrianOS -- Git Setup Complete ------------------------------------

  Room: <name>
  Git: initialized
  Remote: <url or "local only">
  Auto-push: off (opt-in with --auto-push auto)
  LFS: <enabled/not available>

  [triangle-right] /mos:rooms git-setup <name> --auto-push auto   Enable auto-push
  [triangle-right] /mos:rooms git-status                          Check git state
  [hollow-triangle] /mos:rooms list                                See all rooms
```

### Auto-push Flag

If the user passes `--auto-push <mode>` (where mode is auto, manual, or off), set that mode instead of the default "off":
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" git-config <name> true "<remote>" "<mode>"
```

**CRITICAL:** If ANY git operation fails, print a brief note and STOP gracefully. Git failure must NEVER leave the room in a broken state. Example:

> "Git setup had an issue. Your room still works fine. Try again or check `gh auth status`."

---

## Subcommand: git-status

**Trigger:** `/mos:rooms git-status [name]`

If no name provided, use the currently active room.

### Step 1: Get Status

Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/git-ops" status <room_path>`

### Step 2: Render

If git not enabled:
```
-- MindrianOS -- <name> ------------------------------------------------

  Git: not configured

  [triangle-right] /mos:rooms git-setup <name>   Set up git for this room
```

If git enabled:
```
-- MindrianOS -- <name> ------------------------------------------------

  Git: enabled
  Remote: <url or "none (local only)">
  Auto-push: <auto|manual|off>
  LFS: <installed|not available>
  Uncommitted changes: <N files>

  [triangle-right] /mos:rooms git-setup <name> --auto-push auto   Change auto-push
  [hollow-triangle] /mos:rooms list                                See all rooms
```

---

## Cross-Surface Notes (Tri-Polar Rule)

| Surface | Behavior |
|---------|----------|
| **CLI** | Full subcommand syntax as documented above. Scripts run directly. |
| **Desktop** | Larry interprets natural language and maps to subcommands. See natural language mapping at top. |
| **Cowork** | Same registry, same commands. Cowork agents share the room context via 00_Context/. When switching rooms, mention that Cowork state follows the active room. |

## Error Format

Always use the 3-line error pattern:

```
x What happened
  Why: reason
  Fix: /mos:command
```
