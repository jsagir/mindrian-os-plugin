# Phase 23: Multi-Room Management - Research

**Researched:** 2026-03-29
**Domain:** Multi-project workspace management for Claude Code plugin (bash scripts + markdown commands + Node.js tooling)
**Confidence:** HIGH

## Summary

MindrianOS currently operates with a single hardcoded `room/` directory per workspace. Every script, hook, command, and Node.js tool resolves `ROOM_DIR="${WORK_DIR}/room"` or `"./room"` as the single room path. Multi-room management requires introducing a `.rooms/registry.json` registry that maps room names to paths, tracks which room is active, and provides a resolution layer that all existing code routes through.

The scope is well-bounded: 36 commands reference `room/STATE.md` or `room/USER.md`, 8 scripts hardcode `room/` paths, 3 hooks fire on room operations, and the Node.js tooling layer (`bin/mindrian-tools.cjs` + `lib/core/*.cjs`) passes `roomDir` as an argument already. The architecture favors a thin resolution script (`scripts/resolve-room`) that returns the active room's absolute path, replacing hardcoded `room/` references with `$(resolve-room)` in bash and `resolveRoom()` in Node.js.

**Primary recommendation:** Introduce `.rooms/registry.json` as the single source of truth for room identity and active room tracking. Create `scripts/resolve-room` as the universal room path resolver. Add `commands/rooms.md` for the management command. Modify `session-start`, `on-stop`, `post-write`, and `context-monitor` to resolve through the registry. Guard all file-writing commands with an active-room check.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROOM-01 | `.rooms/registry.json` with room index and active room tracking | Registry schema design below; no existing `.rooms/` directory or registry pattern in codebase |
| ROOM-02 | `/mos:rooms` command (list, new, open, close, archive, where) | UI system already declares `/mos:rooms` as Shape B (Semantic Tree) in command-to-shape mapping table |
| ROOM-03 | Context safety - active room lock on all file-writing commands | 36 commands reference `room/`; `post-write` hook is the natural enforcement point; `classify-insight` already gates on `*/room/*` path |
| ROOM-04 | Header canary - room name always visible in Zone 1 | Zone 1 header already shows room name; needs registry-aware resolution instead of reading `room/STATE.md` |
| ROOM-05 | Session start shows multi-room context when multiple rooms registered | `session-start` script currently checks for `room/` directory; needs registry-aware greeting variant |
</phase_requirements>

## Standard Stack

This phase is purely plugin infrastructure -- no new libraries needed. All implementation uses the existing stack.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Bash scripts | 5.x | Room resolution, registry operations | All existing scripts are bash; consistency |
| Node.js (mindrian-tools.cjs) | 18+ | CLI tooling layer, graph ops | Already the plugin's tool runtime |
| JSON | -- | Registry format (.rooms/registry.json) | Plugin already uses JSON for plugin.json, hooks.json, graph.json |

### No New Dependencies
This phase adds no npm packages, no new runtimes, no external services. Everything is bash scripts + JSON files + markdown commands.

## Architecture Patterns

### Current Single-Room Architecture

Every file in the codebase assumes one room at `${WORK_DIR}/room/`:

```
Workspace/
  room/                    <-- hardcoded everywhere
    STATE.md
    USER.md
    problem-definition/
    market-analysis/
    ...
```

**Scripts that hardcode `room/`:**
- `scripts/session-start` -- line 13: `ROOM_DIR="${WORK_DIR}/room"`
- `scripts/on-stop` -- line 11: `ROOM_DIR="${WORK_DIR}/room"`
- `scripts/post-write` -- lines 16-18: checks `*/room/*` pattern
- `scripts/classify-insight` -- line 17: checks `*/room/*` pattern
- `scripts/compute-state` -- receives `room/` as argument
- `scripts/build-graph` -- receives `room/` as argument
- `scripts/generate-standalone` -- line 16: `ROOM_DIR="${1:-./room}"`
- `scripts/context-monitor` -- reads room state from working dir

**Commands that reference `room/` (36 total):**
All 24 methodology commands read `room/STATE.md`. Additionally: `room.md`, `new-project.md`, `status.md`, `help.md`, `grade.md`, `deep-grade.md`, `diagnose.md`, `suggest-next.md`, `compare-ventures.md`, `pipeline.md`, `find-connections.md`, `export.md`.

**Node.js tooling (`bin/mindrian-tools.cjs`):**
Already accepts `roomDir` as a positional argument for all subcommands. This is the cleanest layer -- just needs to receive the resolved path.

### Target Multi-Room Architecture

```
Workspace/
  .rooms/
    registry.json          <-- single source of truth
  rooms/                   <-- or user-chosen paths
    acme-robotics/
      STATE.md
      USER.md
      problem-definition/
      ...
    fintech-startup/
      STATE.md
      USER.md
      ...
  room -> rooms/acme-robotics/   <-- symlink (optional, backward compat)
```

### Registry Schema (`.rooms/registry.json`)

```json
{
  "version": 1,
  "active": "acme-robotics",
  "rooms": {
    "acme-robotics": {
      "path": "rooms/acme-robotics",
      "created": "2026-03-15T10:00:00Z",
      "last_opened": "2026-03-29T14:00:00Z",
      "status": "active",
      "venture_name": "Acme Robotics",
      "venture_stage": "Pre-Opportunity"
    },
    "fintech-startup": {
      "path": "rooms/fintech-startup",
      "created": "2026-03-20T09:00:00Z",
      "last_opened": "2026-03-25T16:00:00Z",
      "status": "parked",
      "venture_name": "FinTech Startup",
      "venture_stage": "Discovery"
    }
  }
}
```

**Key design decisions from user memory:**
- `active` field is the single source of truth for which room commands operate on
- Status values: `active`, `parked`, `archived`
- Paths are relative to workspace root (portable)
- `room/` (singular) navigates INTO sections; `rooms` (plural) manages WHICH room

### Room Path Resolution Pattern

**New script: `scripts/resolve-room`**

```bash
#!/usr/bin/env bash
# resolve-room: Returns absolute path to active room directory
# Exit 0 + path on stdout = room found
# Exit 1 + empty = no room (legacy or registry)

WORK_DIR="${1:-$PWD}"
REGISTRY="${WORK_DIR}/.rooms/registry.json"

# Strategy 1: Registry exists
if [ -f "$REGISTRY" ]; then
  active=$(python3 -c "import json; r=json.load(open('$REGISTRY')); print(r.get('active',''))" 2>/dev/null)
  if [ -n "$active" ]; then
    room_path=$(python3 -c "import json; r=json.load(open('$REGISTRY')); print(r['rooms']['$active']['path'])" 2>/dev/null)
    abs_path="${WORK_DIR}/${room_path}"
    if [ -d "$abs_path" ]; then
      echo "$abs_path"
      exit 0
    fi
  fi
fi

# Strategy 2: Legacy single room/
if [ -d "${WORK_DIR}/room" ]; then
  echo "${WORK_DIR}/room"
  exit 0
fi

# No room found
exit 1
```

**This is the keystone script.** Every existing script and hook that currently hardcodes `ROOM_DIR="${WORK_DIR}/room"` gets replaced with:

```bash
ROOM_DIR=$("${SCRIPT_DIR}/resolve-room" "$WORK_DIR") || { echo "No active room"; exit 0; }
```

### Backward Compatibility Strategy

Critical: existing users have `room/` directories. The resolution script handles this transparently:
1. If `.rooms/registry.json` exists, use it
2. If not, fall back to `room/` directory
3. `/mos:rooms new` on a workspace with existing `room/` offers to "adopt" it into the registry

### Migration Path for Existing `room/`

When a user first runs `/mos:rooms` on a workspace with a legacy `room/` directory:
1. Detect `room/` exists but no `.rooms/registry.json`
2. Create `.rooms/registry.json` with the existing room registered
3. Set it as active
4. No files moved -- `path` points to `room` (relative)
5. User can continue working as if nothing changed

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON manipulation in bash | Custom sed/awk JSON editing | `python3 -c "import json; ..."` one-liners | Already used in session-start, on-stop; reliable for simple reads/writes |
| Symlink management | Complex symlink switching | Direct path resolution via registry | Symlinks break on Windows, are fragile with git, create confusion |
| Concurrent access locking | File-level mutex/flock | Single-writer assumption (one Claude session per workspace) | Claude Code is single-session; no concurrency risk in CLI or Desktop |
| Room state persistence | Custom state serialization | Existing `compute-state` script pointed at resolved path | Script already works with any directory path as argument |

## Common Pitfalls

### Pitfall 1: Post-Write Hook Path Matching
**What goes wrong:** The `post-write` hook currently matches `*/room/*` to detect room file writes. If rooms move to `rooms/acme-robotics/`, this pattern breaks.
**Why it happens:** Hardcoded path pattern in `post-write` line 16.
**How to avoid:** Change the match to use the resolved room path, or match against any directory containing a `STATE.md` ancestor (the script already walks up looking for STATE.md at line 30-38).
**Warning signs:** New room artifacts not getting classified or indexed in LazyGraph.

### Pitfall 2: Session Start Performance
**What goes wrong:** Adding registry resolution to session-start adds latency. Current requirement: < 2 seconds.
**Why it happens:** Python3 invocation for JSON parsing adds ~100ms.
**How to avoid:** `resolve-room` is a single python3 one-liner (~50-100ms). Cache the resolved path in `/tmp/mindrian-active-room` for the session.
**Warning signs:** Session start exceeding 2-second budget.

### Pitfall 3: Context Monitor Stale Room Reference
**What goes wrong:** `scripts/context-monitor` reads room state from the working directory. If the user switches rooms mid-session, the statusline shows stale data.
**Why it happens:** Statusline caches room context for the session.
**How to avoid:** Context monitor must read from registry on each tick, not cache a room path.
**Warning signs:** Statusline showing wrong room name after `/mos:rooms open`.

### Pitfall 4: Admin Panel Interaction
**What goes wrong:** `/mos:admin` manages Brain API keys -- it's roomless. Room switching during admin operations could corrupt state.
**Why it happens:** Admin panel operates outside room context.
**How to avoid:** Admin commands should be room-agnostic. The active room lock (ROOM-03) should not block admin commands.
**Warning signs:** Admin operations failing with "no active room" errors.

### Pitfall 5: Export Template Room Identity
**What goes wrong:** `dashboard/export-template.html` gets room name from `room/STATE.md`. Multi-room needs it from the resolved room's STATE.md.
**Why it happens:** `scripts/generate-standalone` and `scripts/build-graph` receive room path as argument.
**How to avoid:** These scripts already accept `$1` as room directory -- just pass the resolved path. No template change needed.
**Warning signs:** Export showing wrong room name or "No room directory found" error.

### Pitfall 6: New Project vs. Rooms New
**What goes wrong:** `/mos:new-project` currently blocks if `room/` exists ("one project per workspace"). This conflicts with multi-room.
**Why it happens:** Line 18-21 of `commands/new-project.md` hardcodes the single-room check.
**How to avoid:** Modify `new-project` to work through the registry. If registry exists, create room at `rooms/{slug}/` and register it. If no registry, backward-compatible behavior.
**Warning signs:** Users unable to create second rooms.

## Code Examples

### Registry Read (bash, using existing python3 pattern)

```bash
# Source: scripts/session-start line 16 (existing pattern)
REGISTRY="${WORK_DIR}/.rooms/registry.json"
if [ -f "$REGISTRY" ]; then
  active_name=$(python3 -c "
import json
r = json.load(open('$REGISTRY'))
print(r.get('active', ''))
" 2>/dev/null)
fi
```

### Registry Write (bash)

```bash
# Update active room in registry
python3 -c "
import json
with open('$REGISTRY', 'r') as f:
    reg = json.load(f)
reg['active'] = '$NEW_ROOM'
reg['rooms']['$NEW_ROOM']['last_opened'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
reg['rooms']['$NEW_ROOM']['status'] = 'active'
# Park the previous active
for name, room in reg['rooms'].items():
    if name != '$NEW_ROOM' and room['status'] == 'active':
        room['status'] = 'parked'
with open('$REGISTRY', 'w') as f:
    json.dump(reg, f, indent=2)
" 2>/dev/null
```

### Session Start Multi-Room Greeting (new variant)

```
-- Acme Robotics -- Pre-Opportunity --

  > Reading the Room
  > 3/8 sections active, 8 entries, last activity 2 days ago

  Other rooms:
  ├-- ▶ fintech-startup     parked  3 days ago
  └-- ▷ biotech-venture     archived

  ▶ /mos:status                     See full progress
  ▷ /mos:rooms                      Manage your rooms
  ▷ /mos:rooms open fintech-startup Switch rooms
```

### Active Room Lock Guard (post-write hook addition)

```bash
# At top of post-write, before any room operations:
ACTIVE_ROOM=$("${SCRIPT_DIR}/resolve-room" "$PWD" 2>/dev/null) || exit 0

# Check if the written file is inside the active room
if [[ "$FILE_PATH" == */room/* ]] || [[ "$FILE_PATH" == */rooms/* ]]; then
  # Verify it's inside the ACTIVE room, not a different one
  if [[ ! "$FILE_PATH" == "$ACTIVE_ROOM"/* ]]; then
    echo "WARNING: Write to inactive room detected: $FILE_PATH"
    echo "Active room: $ACTIVE_ROOM"
    exit 0  # Don't index/classify for wrong room
  fi
fi
```

### /mos:rooms Command Shape B Output

```
-- MindrianOS -- Rooms -----------------------------------------------

  ▼ .rooms/
  ├-- ■ acme-robotics          active   Pre-Opportunity   8 entries
  ├-- ▶ fintech-startup        parked   Discovery         14 entries
  └-- ▷ biotech-venture        archived Validation        22 entries

  Active: acme-robotics (switched 2 hours ago)

  ▶ /mos:rooms open fintech-startup   Switch to parked room
  ▷ /mos:rooms new                    Create a new room
  ▷ /mos:rooms where                  Quick sanity check
```

## Files That Must Change

### Scripts (bash)
| File | Current Behavior | Required Change |
|------|-----------------|-----------------|
| `scripts/session-start` | `ROOM_DIR="${WORK_DIR}/room"` | Use `resolve-room`; add multi-room greeting variant |
| `scripts/on-stop` | `ROOM_DIR="${WORK_DIR}/room"` | Use `resolve-room` |
| `scripts/post-write` | Matches `*/room/*` | Use `resolve-room`; add active room guard |
| `scripts/classify-insight` | Matches `*/room/*` | Use `resolve-room` or resolve via STATE.md walk (already does this) |
| `scripts/compute-state` | Receives path as $1 | No change needed -- already path-agnostic |
| `scripts/build-graph` | Receives path as $1 | No change needed |
| `scripts/generate-standalone` | Default `./room` | No change needed if caller passes resolved path |
| `scripts/analyze-room` | Receives path as $1 | No change needed |
| `scripts/context-monitor` | Reads room from cwd | Must resolve through registry |

### Commands (markdown)
| File | Current Behavior | Required Change |
|------|-----------------|-----------------|
| `commands/new-project.md` | Blocks if `room/` exists | Support registry-aware creation |
| `commands/room.md` | Reads from `room/` | Use resolved path |
| `commands/status.md` | Checks `room/` directory | Use resolved path |
| 24 methodology commands | Read `room/STATE.md` | Read from resolved room path |
| `commands/export.md` | Passes `./room` to scripts | Pass resolved path |

### New Files
| File | Purpose |
|------|---------|
| `scripts/resolve-room` | Universal room path resolver |
| `scripts/room-registry` | Registry CRUD operations (create, read, update, list, archive) |
| `commands/rooms.md` | `/mos:rooms` command definition |

### Node.js Tooling
| File | Current Behavior | Required Change |
|------|-----------------|-----------------|
| `bin/mindrian-tools.cjs` | Accepts roomDir as argument | Add `rooms` subcommand; resolve-room integration |
| `lib/core/room-ops.cjs` | Wraps bash scripts with roomDir | Add resolveRoom() function |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash test scripts (custom runner) |
| Config file | `tests/run-all.sh` |
| Quick run command | `bash tests/test-phase-23.sh` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROOM-01 | Registry creation, reading, updating | unit | `bash tests/test-phase-23.sh::registry` | No - Wave 0 |
| ROOM-02 | /mos:rooms subcommands (list, new, open, close, archive, where) | integration | `bash tests/test-phase-23.sh::commands` | No - Wave 0 |
| ROOM-03 | Active room lock on writes | unit | `bash tests/test-phase-23.sh::lock` | No - Wave 0 |
| ROOM-04 | Header canary shows room name | manual-only | Visual inspection of command output | N/A |
| ROOM-05 | Session start multi-room greeting | integration | `bash tests/test-phase-23.sh::greeting` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/test-phase-23.sh`
- **Per wave merge:** `bash tests/run-all.sh`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test-phase-23.sh` -- covers ROOM-01 through ROOM-05
- [ ] `tests/fixtures/test-registry.json` -- sample registry for tests
- [ ] `tests/test-room/` already exists with STATE.md, problem-definition, market-analysis -- can be extended for multi-room fixtures

## Open Questions

1. **Room storage location**
   - What we know: User memory says `.rooms/registry.json` for the registry. Room directories themselves could live anywhere.
   - What's unclear: Should rooms be forced into a `rooms/` subdirectory, or can users point to arbitrary paths?
   - Recommendation: Default to `rooms/{slug}/` but allow arbitrary paths in registry. The `resolve-room` script handles both.

2. **Symlink backward compatibility**
   - What we know: A `room -> rooms/active-room/` symlink would make all existing code work without changes.
   - What's unclear: Whether symlinks are reliable on Windows (Git for Windows bash), and whether git tracks them sanely.
   - Recommendation: Do NOT use symlinks. Use the `resolve-room` script approach instead. More work upfront, but reliable across platforms.

3. **Cowork surface multi-room**
   - What we know: Cowork uses `00_Context/` for shared state. Multi-room in Cowork means multiple teams could work different rooms.
   - What's unclear: How Cowork shares room registry across agents.
   - Recommendation: Defer Cowork multi-room to a later phase. Focus on CLI + Desktop first.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). This phase is purely code/config changes using existing bash, Node.js, and Python3 (all already verified as available in the plugin's existing scripts).

## Project Constraints (from CLAUDE.md)

- **Tri-Polar Design Rule:** Every feature must work on CLI, Desktop, and Cowork. Multi-room should degrade gracefully on Desktop (conversational room switching) and Cowork (shared registry).
- **Release Process:** CHANGELOG.md + plugin.json version bump + git tag required for any push.
- **NO EMOJI:** Use only the 12 approved glyphs.
- **Dashboard export:** ALWAYS use scripts/generate-standalone or scripts/serve-dashboard. Never generate HTML by hand.
- **STATE.md from script:** STATE.md must ALWAYS be generated by compute-state script, never written directly.
- **Error format:** Strict 3-line pattern (`x What / Why: reason / Fix: /mos:command`).
- **Zone 4 Action Footer:** NEVER omitted from any command output.
- **Banned phrases:** "Great question!", "I'd be happy to help", etc. -- see UI system SKILL.md section 7.
- **No em-dashes:** Use hyphens instead (from user memory).

## Sources

### Primary (HIGH confidence)
- `commands/room.md` -- current room command structure, hardcoded `room/` references
- `commands/new-project.md` -- single-room creation flow, blocking behavior
- `scripts/session-start` -- session initialization, room detection, greeting pipeline
- `scripts/post-write` -- PostToolUse hook, room path matching, LazyGraph indexing
- `scripts/on-stop` -- stop hook, state persistence
- `scripts/compute-state` -- state computation (already path-agnostic)
- `skills/ui-system/SKILL.md` -- 4-zone anatomy, Zone 1 header canary, Shape B for `/mos:rooms`, session start contract
- `hooks/hooks.json` -- hook registration (SessionStart, Stop, PostToolUse)
- `.claude-plugin/plugin.json` -- plugin metadata
- `lib/core/room-ops.cjs` -- Node.js room operations wrapper
- `lib/core/state-ops.cjs` -- Node.js state operations wrapper
- `bin/mindrian-tools.cjs` -- CLI tooling (roomDir argument pattern)
- User memory: `project_mos_multi_room.md` -- prior design decisions, command structure, context safety layers

### Secondary (MEDIUM confidence)
- `dashboard/export-template.html` -- room name in export header (verified line 21 title tag)
- `scripts/context-monitor` -- statusline room awareness (verified reads from cwd)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything is existing plugin infrastructure
- Architecture: HIGH -- codebase fully audited, all `room/` references catalogued, resolution pattern proven by existing `compute-state` argument passing
- Pitfalls: HIGH -- each pitfall traced to specific file and line number
- Test architecture: MEDIUM -- test framework exists but no multi-room tests yet; Wave 0 needed

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- plugin infrastructure, no external API dependencies)
