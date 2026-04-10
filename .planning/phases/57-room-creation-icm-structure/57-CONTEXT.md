# Phase 57: Room Creation & ICM Structure - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase, discuss skipped)

<domain>
## Phase Boundary

New rooms are created under ~/MindrianRooms/ with ICM-compliant Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generated, and INDEX.md stays current as rooms change. Updates commands/new-project.md, commands/rooms.md, and scripts/room-registry to target MindrianRooms.

</domain>

<decisions>
## Implementation Decisions

### Room Creation Path
- **D-01:** /mos:new-project creates room at $ROOMS_HOME/[slug]/ (MINDRIAN_ROOMS_HOME env var, defaults to ~/MindrianRooms)
- **D-02:** /mos:rooms create targets same path as new-project -- both use room-registry create which already writes to central registry (Phase 56)
- **D-03:** Room sections (problem-definition/, market-analysis/, etc.) created inside the room directory, not at ROOMS_HOME level

### ICM Layer Auto-Generation
- **D-04:** First room creation checks if $ROOMS_HOME/CLAUDE.md exists. If not, generates it from template (Layer 0: identity)
- **D-05:** First room creation checks if $ROOMS_HOME/INDEX.md exists. If not, generates it from template (Layer 1: routing)
- **D-06:** INDEX.md auto-updates via a script (scripts/update-icm-index) called after room create, archive, and stage change operations
- **D-07:** Templates live at templates/icm/CLAUDE.md and templates/icm/INDEX.md

### ICM Compliance
- **D-08:** CLAUDE.md at ROOMS_HOME answers "What is this place?" with room count, purpose, and ICM layer explanation
- **D-09:** INDEX.md at ROOMS_HOME answers "Where do I go?" with table of all rooms, their stage, entry count, and last activity
- **D-10:** Each room retains its own STATE.md as Layer 2 contract -- no change from current behavior

### Claude's Discretion
- Template content and formatting details
- INDEX.md table format and column choices
- Whether update-icm-index is bash or node.js (prefer bash for consistency with resolve-room)

</decisions>

<canonical_refs>
## Canonical References

### Path Resolution (Phase 56 output)
- `scripts/resolve-room` -- Now resolves from ROOMS_HOME first. Phase 57 depends on this.
- `scripts/room-registry` -- Now writes to central registry. Phase 57 extends create subcommand.

### Commands to Update
- `commands/new-project.md` -- Lines 74-78: room path generation
- `commands/rooms.md` -- Lines 130-151: room creation structure

### ICM Reference
- `docs/MWP-SPECIFICATION.md` -- ICM Layer 0-4 definitions
- `.claude/includes/architecture.md` -- ICM x Simon summary

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- room-registry create already handles: mkdir, registry write, venture_name, venture_stage
- resolve-room ROOMS_HOME pattern established in Phase 56
- Room section creation pattern exists in commands/new-project.md

### Established Patterns
- Bash scripts with inline Python for JSON (resolve-room, room-registry)
- MINDRIAN_ROOMS_HOME env var for path override
- Atomic writes via tmp + mv

### Integration Points
- commands/new-project.md calls room-registry create
- commands/rooms.md create subcommand calls room-registry create
- session-start hook calls resolve-room (will find new rooms automatically)

</code_context>

<specifics>
## Specific Ideas

- INDEX.md should be a markdown table matching the format already created at ~/MindrianRooms/INDEX.md during the physical move
- CLAUDE.md should explain ICM layers briefly, not be a wall of text
- update-icm-index script should be idempotent -- safe to call multiple times

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 57-room-creation-icm-structure*
*Context gathered: 2026-04-06*
