---
name: rooms
description: Manage multiple project rooms - list, create, switch, park, archive
body_shape: B (Semantic Tree)
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

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

Run `bash scripts/room-registry list` to get JSON array of rooms.

If the command fails (no registry exists), check for legacy `room/` directory:

- If `room/` exists: Tell the user they have a single-room workspace. Suggest adopting it:
  > "You have an existing room/ project. Run `/mos:rooms new` to create additional rooms - I'll offer to adopt your existing project into the registry first."

  Then STOP.

- If no room at all: Tell the user they have no rooms yet. Suggest:
  > "No rooms found. Run `/mos:rooms new` or `/mos:new-project` to get started."

  Then STOP.

### Step 2: Render Room List

For each room in the JSON array, count .md files in the room directory (excluding STATE.md, ROOM.md, USER.md) to get the entry count.

Render using Body Shape B (Semantic Tree):

```
-- MindrianOS -- Rooms -----------------------------------------------

  [v] .rooms/
  |- [filled-square] acme-robotics          active [git]  Pre-Opportunity   8 entries
  |- [triangle-right] fintech-startup        parked        Discovery         14 entries
  |- [hollow-triangle] biotech-venture        archived      Validation        22 entries

  Active: acme-robotics (switched 2 hours ago)

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

### Step 3: Action Footer (Zone 4)

Suggest 2-3 grounded next steps:
- If parked rooms exist: `/mos:rooms open <name>` to switch to a parked room
- Always: `/mos:rooms new` to create a new room
- Always: `/mos:rooms where` for quick sanity check

---

## Subcommand: new

**Trigger:** `/mos:rooms new <name>`

### Step 1: Validate Name

The name must be a valid directory slug: lowercase, alphanumeric, hyphens only.

If the user provides a human-readable name like "Acme Robotics":
- Slugify to `acme-robotics`
- Store the original as `venture_name`

If no name provided, ask: "What should I call this room?"

### Step 2: Check for Legacy Room

If `.rooms/registry.json` does NOT exist AND `room/` directory exists:

Ask the user:
> "You have an existing room/ project. Want me to adopt it into the registry first? This lets you keep your current project and create new ones alongside it."

If user says yes:
- Run `bash scripts/resolve-room $PWD --adopt` to create registry with existing room
- Then proceed to Step 3

If user says no: Proceed without adoption (the old room/ still works via legacy fallback).

### Step 3: Create Room Directory

Create directory at `rooms/<slug>/` with the 8 standard sections:

```
rooms/<slug>/
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

**Important:** `/mos:rooms new` creates the room STRUCTURE only. No deep exploration conversation happens here - that is what `/mos:new-project` does afterward. This keeps room creation fast.

### Step 4: Register Room

Run:
```bash
bash scripts/room-registry create <slug> "rooms/<slug>" "<venture_name>" "Pre-Opportunity"
```

The registry create command automatically sets the new room as active and parks the previous one.

### Step 5: Compute State

Run:
```bash
bash scripts/compute-state rooms/<slug> > rooms/<slug>/STATE.md
```

### Step 6: Report Success

Show success with Zone 1 header displaying the new room name:

```
-- MindrianOS -- <venture_name> --------------------------------------

  Room created: rooms/<slug>/
  Status: active
  Venture stage: Pre-Opportunity
  Sections: 8

  [triangle-right] /mos:new-project     Start the deep exploration conversation
  [hollow-triangle] /mos:rooms list      See all your rooms
```

---

## Subcommand: open

**Trigger:** `/mos:rooms open <name>`

### Step 1: Validate Room Exists

Run `bash scripts/room-registry read <name>` to check if the room is in the registry.

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
bash scripts/room-registry set-active <name>
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

Run `bash scripts/room-registry get-active` to get the current active room name.

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
bash scripts/room-registry update <active-name> status parked
```

### Step 3: Clear Active Field

Clear the active field in the registry by running:
```bash
python3 -c "
import json
with open('.rooms/registry.json', 'r') as f:
    reg = json.load(f)
reg['active'] = ''
with open('.rooms/registry.json', 'w') as f:
    json.dump(reg, f, indent=2)
"
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

Run `bash scripts/room-registry read <name>` to check if the room is in the registry.

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
bash scripts/room-registry archive <name>
```

This sets the room status to `archived`. If the room was active, it also clears the active field.

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

Run `bash scripts/room-registry get-active` to get the current active room name.

If no active room (empty result):
> "No active room. Run `/mos:rooms list` to see available rooms."

Then STOP.

### Step 2: Read Room Details

Run `bash scripts/room-registry read <active-name>` to get the full registry entry.

### Step 3: Display Location

```
-- MindrianOS -- <venture_name> --------------------------------------

  Active room: <name>
  Path: <absolute-path>
  Venture: <venture_name>
  Stage: <venture_stage>
  Last opened: <timestamp>

  [triangle-right] /mos:status           Check room health
  [triangle-right] /mos:rooms open       Switch rooms
  [hollow-triangle] /mos:rooms list       See all rooms
```

---

## Subcommand: git-setup

**Trigger:** `/mos:rooms git-setup [name]`

If no name provided, use the currently active room (get via `bash scripts/room-registry get-active`).

### Step 1: Validate Room

Run `bash scripts/room-registry read <name>` to verify room exists.

If not found, show 3-line error and STOP.

### Step 2: Check Current Git State

Run `bash scripts/git-ops status <room_path>` to check if git is already configured.

If already enabled:
> "Git is already set up for this room."
> Show current status (remote URL, auto_push setting, LFS status).
> Offer to change settings: "Want to change auto-push mode? Current: <setting>."

If user wants to change auto_push:
```bash
bash scripts/room-registry git-config <name> true "<existing_remote>" "<new_setting>"
```

Then STOP.

### Step 3: Initialize Git

```bash
bash scripts/git-ops init <room_path>
bash scripts/git-ops lfs-setup <room_path>
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
bash scripts/git-ops push <room_path>
```

### Step 6: Update Registry

```bash
bash scripts/room-registry git-config <name> true "<remote_url_or_empty>" "off"
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
bash scripts/room-registry git-config <name> true "<remote>" "<mode>"
```

**CRITICAL:** If ANY git operation fails, print a brief note and STOP gracefully. Git failure must NEVER leave the room in a broken state. Example:

> "Git setup had an issue. Your room still works fine. Try again or check `gh auth status`."

---

## Subcommand: git-status

**Trigger:** `/mos:rooms git-status [name]`

If no name provided, use the currently active room.

### Step 1: Get Status

Run `bash scripts/git-ops status <room_path>`

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
