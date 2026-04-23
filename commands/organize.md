---
name: organize
description: Navigate room hierarchy with graph-aware tree
argument-hint: [tree|propose|compound]
body_shape: B (Semantic Tree)
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

# /mos:organize

You are Larry. This command manages the room portfolio hierarchy using **Body Shape B (Semantic Tree)** per the UI Ruling System.

Room organization is a wicked problem (Rittel & Webber 1973). Multiple valid groupings exist simultaneously. Decisions are never final -- they feed future proposals. The system gets smarter from every GROUP, SEPARATE, and DEFER decision.

## UI Format

- **Body Shape:** B (Semantic Tree) for all subcommands
- **Reference:** `skills/ui-system/SKILL.md`
- All subcommands follow the 4-zone anatomy: Header Panel, Content Body, Intelligence Strip (cross-room signals), Action Footer (NEVER omitted)
- **Symbols:** Only the 12 approved glyphs. No emoji. No em-dashes.
- **Nesting depth:** Max 3 levels (root / group / room). Never deeper.

## Routing

Parse user input to determine which subcommand to execute. If no subcommand is given, default to `tree`.

Subcommands: `tree` (default), `propose`, `view`, `move`

**Natural language mapping (Desktop/Cowork):**
- "organize my rooms" / "show room structure" -> `tree`
- "how should I reorganize?" / "suggest groupings" -> `propose`
- "show rooms by client" / "group by stage" -> `view by-stage`
- "move fintech to clients" / "put biotech in health group" -> `move fintech-startup clients`

---

## Subcommand: tree

**Trigger:** `/mos:organize` or `/mos:organize tree`

### Step 1: Get Room Data

Determine `ROOMS_HOME` (`$MINDRIAN_ROOMS_HOME` or `~/MindrianRooms`).

Run `bash scripts/room-registry list` to get JSON array of rooms.

If the command fails or returns empty:
> "No rooms found. Run `/mos:rooms new` to create your first room."
Then STOP.

### Step 2: Scan Physical Hierarchy

Scan `$ROOMS_HOME` for the actual directory structure:

```bash
# List top-level directories (excluding hidden, _archive)
ls -d "$ROOMS_HOME"/*/ 2>/dev/null | grep -v '/\.' | grep -v '/_'
```

For each directory, check:
1. Is it a registered room? (exists in registry.json)
2. Is it a group directory? (contains subdirectories that are rooms, has a CLAUDE.md)
3. Is it an orphan? (directory exists but not in registry)

### Step 3: Check ICM Compliance

For each room, check:
- `CLAUDE.md` exists at room level (Layer 0)
- `STATE.md` exists (Layer 2)
- Section directories present (problem-definition/, market-analysis/, etc.)

Use status indicators:
- `checkmark` = ICM-compliant (CLAUDE.md + STATE.md + sections)
- `bullet` = Partial (missing some ICM layers)
- `warning` = Non-compliant (no STATE.md or no sections)

### Step 4: Render Room Tree

Render using Body Shape B (Semantic Tree):

```
-- MindrianOS -- Room Portfolio -- ~/MindrianRooms/ -------------------

  v ~/MindrianRooms/
  |- [group-icon] clients/                           3 rooms
  |  |- [checkmark] acme-robotics        active   Pre-Opportunity   8 entries
  |  |- [bullet] fintech-startup         parked   Discovery         14 entries
  |  +- [checkmark] biotech-venture      parked   Validation        22 entries
  |
  |- [group-icon] internal/                          1 room
  |  +- [checkmark] mindrian-ops         active   --                5 entries
  |
  |- [warning] orphan-project            --       --                0 entries
  +- _archive/                                       2 rooms

  Rooms: 5 registered, 1 orphan, 2 archived
  Groups: 2 (clients/, internal/)
  ICM health: 3 compliant, 1 partial, 1 non-compliant
```

For ungrouped rooms (directly under ROOMS_HOME), show them at root level without a group parent.

Symbol key for groups:
- `v` (down-triangle) = expanded group with rooms
- `>` (right-triangle-filled) = collapsed group

### Step 5: Intelligence Strip (Zone 3)

If any cross-room signals exist, show max 2:
- `!` "acme-robotics and fintech-startup share 3 market themes" (convergence)
- `[ ]` "orphan-project not in registry -- run /mos:rooms new to adopt"

Omit entirely if no signals.

### Step 6: Action Footer (Zone 4)

```
  > /mos:organize propose            Get graph-informed grouping suggestions
  > /mos:organize view by-stage      See rooms grouped by venture stage
  > /mos:organize move <room> <group>  Move a room into a group (with confirmation)
```

---

## Subcommand: propose

**Trigger:** `/mos:organize propose`

### Step 1: Gather Room Intelligence

Determine `ROOMS_HOME` and load room list via `bash scripts/room-registry list`.

For each room, collect metadata:
- `venture_name` and `venture_stage` from registry
- Domain keywords: scan `problem-definition/` for topic terms if files exist
- Team info: check `team/` directory for client/stakeholder names
- Entry count and section health

### Step 2: Attempt Graph-Informed Groupings (Graceful Degradation)

**Tier 1 -- Brain + SQLite graph (richest proposals):**

Try calling Brain MCP: `mcp__mindrian-brain__brain_schema` or `mcp__neo4j-brain__get_neo4j_schema`.

If Brain is available, query for cross-room intelligence:

```cypher
// Find rooms that share frameworks
MATCH (r1:Room)-[:USES_FRAMEWORK]->(f:Framework)<-[:USES_FRAMEWORK]-(r2:Room)
WHERE r1.name <> r2.name
RETURN r1.name, r2.name, collect(f.name) AS shared_frameworks

// Find rooms at the same stage
MATCH (r:Room)-[:AT_STAGE]->(s:VentureStage)
RETURN s.name, collect(r.name) AS rooms_at_stage

// Find rooms with shared themes
MATCH (r1:Room)-[:SHARES_THEME]->(t:Theme)<-[:SHARES_THEME]-(r2:Room)
RETURN t.name, collect(DISTINCT r1.name) + collect(DISTINCT r2.name) AS themed_rooms
```

Note: Room nodes may not exist yet (Phase 59.2 creates them). If these queries return empty, fall through to Tier 2.

**Tier 2 -- Metadata-based groupings (always available):**

Group rooms by analyzing:
1. **By venture stage:** Cluster rooms sharing the same `venture_stage`
2. **By name pattern:** Extract common prefixes or domain keywords from room slugs
3. **By domain keywords:** Read first 50 lines of each room's `problem-definition/` files, extract key domain terms, find overlaps
4. **By activity level:** Group stale rooms (no activity >30 days) vs. active ones

### Step 3: Generate Proposals

Create a ranked list of grouping proposals. Each proposal has:
- **Group name** (suggested slug, e.g., `health-ventures`, `pre-opp-rooms`)
- **Rooms included** (which rooms would move into this group)
- **Rationale** (why these rooms belong together)
- **Confidence** (high/medium/low based on signal strength)
- **Source** (Brain graph / metadata / name pattern)

### Step 4: Render Proposals

```
-- MindrianOS -- Room Portfolio -- Reorganization Proposals -----------

  Analyzed 5 rooms. Found 3 potential groupings.

  Proposal 1: "health-ventures" [HIGH confidence]
  Source: shared domain keywords (genomics, clinical, biotech)
  |- biotech-venture         Validation    22 entries
  +- pharma-discovery        Discovery     11 entries

  Proposal 2: "pre-opportunity" [MEDIUM confidence]
  Source: venture stage clustering
  |- acme-robotics           Pre-Opportunity    8 entries
  +- new-idea-room           Pre-Opportunity    3 entries

  Proposal 3: "fintech" [LOW confidence]
  Source: name pattern match
  +- fintech-startup         Discovery     14 entries
     (single room -- grouping deferred)

  > /mos:organize move biotech-venture health-ventures    Accept proposal 1
  > /mos:organize propose --refresh                       Re-analyze with latest data
  > /mos:organize view by-stage                           Preview stage-based view first
```

### Step 5: Record Proposals

Write proposals to `$ROOMS_HOME/.rooms/proposals.json` for future reference:

```json
{
  "generated": "2026-04-06T20:00:00Z",
  "source": "metadata",
  "proposals": [
    {
      "group": "health-ventures",
      "rooms": ["biotech-venture", "pharma-discovery"],
      "rationale": "shared domain keywords: genomics, clinical, biotech",
      "confidence": "high",
      "status": "pending"
    }
  ]
}
```

---

## Subcommand: view

**Trigger:** `/mos:organize view [axis]`

Available axes: `by-stage`, `by-client`, `by-domain`, `by-activity`

This subcommand shows virtual projections WITHOUT moving files. The rooms stay where they are. The view is a lens, not a reorganization.

### Step 1: Load Room Data

Get room list via `bash scripts/room-registry list`. For each room, load metadata as in `propose`.

### Step 2: Build Virtual Grouping

**by-stage:** Group rooms by `venture_stage` field from registry.

**by-client:** Extract client/owner from:
1. `venture_name` in registry (parse for company names)
2. `team/` directory contents (look for stakeholder names)
3. Room slug prefix patterns

**by-domain:** Extract domain from:
1. Problem-definition content keywords
2. Room slug domain terms
3. Brain framework associations (if available)

**by-activity:** Group by last activity:
- Active (activity within 7 days)
- Recent (7-30 days)
- Stale (30+ days)
- Dormant (90+ days)

### Step 3: Render Virtual View

```
-- MindrianOS -- Room Portfolio -- View: by-stage ---------------------

  [virtual projection -- no files moved]

  v Pre-Opportunity (2 rooms)
  |- acme-robotics           active    8 entries
  +- new-idea-room           parked    3 entries

  v Discovery (2 rooms)
  |- fintech-startup         parked    14 entries
  +- pharma-discovery        active    11 entries

  v Validation (1 room)
  +- biotech-venture         parked    22 entries

  > /mos:organize move acme-robotics pre-opportunity    Make this grouping real
  > /mos:organize view by-domain                        Try another lens
  > /mos:organize tree                                  Back to physical structure
```

### Step 4: Action Footer

Suggest converting the virtual view into real groups (with move commands) or trying other axes.

---

## Subcommand: move

**Trigger:** `/mos:organize move <room-name> <target-group>`

### Step 1: Validate Inputs

Run `bash scripts/room-registry read <room-name>` to verify room exists.

If not found:
```
x Room not found: <room-name>
  Why: No room named "<room-name>" in .rooms/registry.json
  Fix: /mos:rooms list
```
Then STOP.

Check if target-group is valid:
- Must be a valid directory slug (lowercase, alphanumeric, hyphens)
- Must not exceed nesting depth (max 3 levels: root/group/room)

### Step 2: Show Move Preview

Display what will happen before asking for confirmation:

```
-- MindrianOS -- Room Move Preview ------------------------------------

  Moving: fintech-startup
  From:   ~/MindrianRooms/fintech-startup/
  To:     ~/MindrianRooms/clients/fintech-startup/

  This will:
  1. Create group directory "clients/" (if new)
  2. Generate ICM CLAUDE.md for "clients/" group
  3. Move fintech-startup/ into clients/
  4. Update registry.json path
  5. Refresh INDEX.md

  Confirm move? (yes/no)
```

### Step 3: Require Explicit Human Confirmation

**CRITICAL:** Wait for explicit "yes" from the user. Accept: "yes", "y", "confirm", "do it", "go ahead".

If user declines or says anything ambiguous, STOP:
> "Move cancelled. Room stays at current location."

If user says "defer":
> Record DEFER decision (Step 7) and STOP.

### Step 4: Execute Move

If confirmed, execute the move:

```bash
ROOMS_HOME="${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}"

# Create group directory if it doesn't exist
mkdir -p "$ROOMS_HOME/<target-group>"

# Move the room directory
mv "$ROOMS_HOME/<room-name>" "$ROOMS_HOME/<target-group>/<room-name>"
```

### Step 5: Generate Group ICM CLAUDE.md

If this is a NEW group (just created), generate an ICM Layer 0 CLAUDE.md for the group directory.

Read the template from `templates/icm/GROUP-CLAUDE.md` and fill in:
- Group name
- Rationale for grouping (from proposal if available, or ask user)
- List of rooms in the group

Write the filled template to `$ROOMS_HOME/<target-group>/CLAUDE.md`.

If the group already has a CLAUDE.md, update the room list section to include the newly moved room.

### Step 6: Update Registry and Index

Update the room's path in the registry:

```bash
bash scripts/room-registry update <room-name> path "<target-group>/<room-name>"
```

Refresh INDEX.md:

```bash
bash scripts/update-icm-index "$ROOMS_HOME"
```

### Step 7: Record Decision

Record the user's decision for future proposal intelligence.

Write to `$ROOMS_HOME/.rooms/decisions.json`:

```json
{
  "decisions": [
    {
      "timestamp": "2026-04-06T20:00:00Z",
      "type": "GROUP",
      "room": "fintech-startup",
      "target": "clients",
      "rationale": "client-based grouping",
      "source": "user-confirmed"
    }
  ]
}
```

Decision types:
- **GROUP** -- user confirmed moving room into a group
- **SEPARATE** -- user explicitly rejected a proposed grouping ("keep these apart")
- **DEFER** -- user acknowledged the proposal but chose not to act now

When Brain graph is available (Phase 59.2+), also create graph edges:

```cypher
// GROUP decision
MERGE (r:Room {name: "fintech-startup"})
MERGE (g:RoomGroup {name: "clients"})
MERGE (r)-[:GROUPED_BY_USER {timestamp: datetime(), rationale: "client-based"}]->(g)

// SEPARATE decision
MERGE (r1:Room {name: "room-a"})
MERGE (r2:Room {name: "room-b"})
MERGE (r1)-[:SEPARATED_BY_USER {timestamp: datetime(), reason: "different domains"}]->(r2)
```

If Brain is not available, the local `decisions.json` file is sufficient. Future proposals read this file to avoid re-suggesting rejected groupings.

### Step 8: Report Success

```
-- MindrianOS -- Room Move Complete -----------------------------------

  Moved: fintech-startup
  To:    ~/MindrianRooms/clients/fintech-startup/
  Group: clients/ (ICM CLAUDE.md generated)
  Registry: updated
  INDEX.md: refreshed

  Decision recorded: GROUP fintech-startup -> clients

  > /mos:organize tree                   See updated structure
  > /mos:organize propose                Get more suggestions
  > /mos:organize move <room> clients    Add another room to this group
```

---

## Decision Memory

The organize command maintains two local files for decision intelligence:

1. **`$ROOMS_HOME/.rooms/proposals.json`** -- generated proposals with status tracking
2. **`$ROOMS_HOME/.rooms/decisions.json`** -- all GROUP/SEPARATE/DEFER decisions with timestamps

When generating new proposals (via `propose`), the system:
1. Reads `decisions.json` to avoid re-suggesting SEPARATE'd groupings
2. Boosts confidence for proposals that align with previous GROUP decisions
3. Surfaces DEFER'd proposals again after 30 days with a note: "Previously deferred on [date]"

When Brain graph is available, these local files serve as a staging area. Decisions are promoted to graph edges for richer cross-room intelligence.

---

## Graceful Degradation

| Available | Proposal Quality | Source |
|-----------|-----------------|--------|
| Brain + SQLite graph | Rich: shared frameworks, themes, co-occurrence | Graph queries |
| Brain only | Good: venture stage taxonomy, framework connections | Cypher queries |
| SQLite graph only | Good: local graph relationships, room metadata | Local graph |
| Neither (Tier 0) | Basic: stage clustering, name patterns, domain keywords | Registry + filesystem |

The command always works. Intelligence quality scales with available infrastructure. This is the Tier 0 principle applied to room organization.

---

## Cross-Surface Notes (Tri-Polar Rule)

| Surface | Behavior |
|---------|----------|
| **CLI** | Full subcommand syntax as documented above. Scripts run directly. |
| **Desktop** | Larry interprets natural language and maps to subcommands. See natural language mapping at top. |
| **Cowork** | Same registry, same commands. Moves affect all team members sharing the room hierarchy. Announce moves in shared context. |

## Error Format

Always use the 3-line error pattern:

```
x What happened
  Why: reason
  Fix: /mos:command
```
