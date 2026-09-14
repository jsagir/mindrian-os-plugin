# MindrianRooms -- ICM Layer 0 (Identity)

This is the root directory for all MindrianOS Data Rooms.

**Question answered:** "Where am I?"
**Answer:** The unified home for every venture, project, and analysis room managed through MindrianOS.

## ICM Compliance

This directory follows the Interpretable Context Methodology (Van Clief & McDermott, 2026).

This mapping is scoped to the FLEET level, where the unit is a whole room rather than a section inside one; the canonical room-level ICM Layer 0 through Layer 4 statement is docs/MINDRIAN-CANON.md (Appendix B).

- **Layer 0 (this file):** Identity -- what is this place and how is it organized
- **Layer 1 (INDEX.md):** Routing -- which room do I need, and what state is each in
- **Layer 2 (per-room STATE.md):** Contracts -- what does each room contain and what stage is it at
- **Layer 3 (per-room references/):** Stable constraints that persist across sessions
- **Layer 4 (per-room entries):** Working artifacts -- the actual claims, analysis, and evidence

Named but not fixed here: `INDEX.md` is hand-maintained and ships empty, while `.rooms/registry.json` is the real machine index MindrianOS reads. That is a duplicated entry file that drifts, a breach of the generated-indexes-are-never-hand-edited invariant (ICM invariant 9). A generator plus a staleness check is real work, not a drive-by edit, so it stays unowned here for a future phase to pick up.

## Structure Rules

1. Every room is a top-level directory (e.g., `my-venture/`, `my-project/`)
2. Every room contains its own STATE.md (computed, never hand-written)
3. No room nests inside another room
4. `_archive/` holds rooms that are retired, stubs, or empty exports
5. `.rooms/registry.json` is the machine-readable index (MindrianOS reads this)
6. New rooms are ALWAYS created here -- never in ~/room/ or ~/rooms/

## Navigation

- Read INDEX.md for a human-readable overview of all rooms
- Read .rooms/registry.json for programmatic access
- cd into any room directory and run `claude` to work in that room's context
