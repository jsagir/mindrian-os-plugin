# Phase 59: Migration Engine - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase, discuss skipped)

<domain>
## Phase Boundary

Guided migration from legacy ~/room/ and ~/rooms/ layouts to ~/MindrianRooms/. Detects scattered rooms, shows file counts, confirms each move, optionally creates symlinks. Integrated into /mos:setup.

</domain>

<decisions>
## Implementation Decisions

### Migration Script
- **D-01:** scripts/migrate-rooms bash script. Detects legacy paths: ~/room/, ~/room-*/, ~/rooms/*/, ~/demo-*/room/
- **D-02:** Shows discovery table: path, venture name (from STATE.md if exists), file count, proposed slug
- **D-03:** Human confirms EACH room move individually -- not batch "move all"
- **D-04:** Uses cp -a then prompts for old path deletion (never auto-deletes)
- **D-05:** Optional symlinks: after move, offer `ln -s ~/MindrianRooms/[slug] ~/old-path` for backward compat
- **D-06:** After each move: calls room-registry create to register, calls update-icm-index to refresh INDEX.md

### /mos:setup Integration
- **D-07:** /mos:setup gains "organize rooms" option that runs scripts/migrate-rooms
- **D-08:** Session-start hook can suggest migration when legacy paths detected (via resolve-room deprecation warning)

### Claude's Discretion
- Exact discovery patterns for edge cases
- Whether to detect rooms by STATE.md presence or by section folder names
- Symlink prompt wording

</decisions>

<canonical_refs>
## Canonical References

### Scripts
- `scripts/resolve-room` -- Legacy detection logic (Strategy 2) already identifies old paths
- `scripts/room-registry` -- create subcommand for registration after move
- `scripts/update-icm-index` -- INDEX.md refresh (from Phase 57)

### Commands
- `commands/setup.md` -- Needs "organize rooms" option added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- resolve-room Strategy 2 already detects legacy ~/room/ paths
- room-registry create handles registration with venture_name extraction from STATE.md
- update-icm-index refreshes INDEX.md after changes

### Established Patterns
- MINDRIAN_ROOMS_HOME env var for path resolution
- Atomic operations: cp -a for copy, registry update, then optional cleanup
- Human confirmation via stderr prompts or command interaction

### Integration Points
- /mos:setup command already has integration options (brain, graph, etc.)
- session-start deprecation warning already nudges users toward migration

</code_context>

<specifics>
## Specific Ideas

- The physical move for Jonathan's environment is already done (~/MindrianRooms/ populated). This script handles OTHER users and future migrations.
- Discovery should handle: room/, room-adam/, room-dahbura/, rooms/align-x-milken/, demo-cancer-room/room/ patterns

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 59-migration-engine*
*Context gathered: 2026-04-06*
