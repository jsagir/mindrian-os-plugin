---
status: open
kind: rca
trigger: "v1.16.0-beta.1 release cut: doctor --acceptance --pre-tag's eureka-fts-index-visible check (Phase 244-06) flagged room jonathan-contractor-motj as index_stale (451 orphan rows); attempting the standard fix (a real rebuildGraph() call, the same one aion-eureka-synergy's identical staleness was fixed with cleanly) failed."
filed: 2026-07-31
---

# rebuildGraph FK constraint failure on jonathan-contractor-motj

**Symptom:** `rebuildGraph(conn, roomDir)` throws `FOREIGN KEY constraint failed` inside
`clearIndexerOwnedRows` (`lib/core/lazygraph-ops.cjs:151`, called from `rebuildGraph:674`)
for room `jonathan-contractor-motj` (`/home/jsagi/MindrianRooms/motj-ecosystem/sub-rooms/
jonathan-contractor-motj`). The sibling stale room `aion-eureka-synergy` rebuilt cleanly
with the identical call pattern (`{"success":true,"artifacts":91,"sections":15,"subRooms":0}`),
so this is room-data-shape-specific, not a general regression in Phase 236's scoped-delete
machinery.

**Verified safe, not corruption:** Phase 236's transaction wrap did its job -- the failed
attempt rolled back cleanly. `PRAGMA foreign_key_check` on the live `.mindrian/room.db`
returns zero violations; node/edge counts (690/198) match the pre-attempt doctor health
check. The room's CURRENT committed state is internally consistent. The bug is in the
DELETE ordering `clearIndexerOwnedRows` uses for the ownership-scoped wipe, not in the
data itself -- something about this room's specific edge/node shape (a sub-room, per its
registry entry `"parent": "motj-ecosystem"`) trips an FK ordering `aion-eureka-synergy`'s
shape does not.

**Not root-caused yet.** Filed here rather than under release-cut time pressure, per this
session's own standing discipline (state root cause before patching). Next investigator:
compare `clearIndexerOwnedRows`'s delete order against this room's actual `edges` table
foreign-key targets (likely a parent-child sub-room edge type, or a node type outside
`INDEXER_OWNED_NODE_TYPES` that still holds a live FK reference to something the scoped
delete removes).

**Release impact, this run:** the room is `status: "parked"` per the registry (not
actively used), and the doctor check's own escape hatch
(`DOCTOR_SKIP_EUREKA_FTS_HEALTH=1`) exists precisely for "known issue, don't block an
unrelated release" cases. Used for this v1.16.0-beta.1 / v1.15.0-finalize cut with this
RCA as the paper trail. `aion-eureka-synergy` (the second stale room) IS fixed and no
longer contributes to the check's failure -- only `jonathan-contractor-motj` remains.

**Not this session's scope to fix:** this is a room-data bug pre-dating and unrelated to
the v1.16.0 "Infrastructure Remediation" milestone; Phase 244 only built the DETECTION
(the health check) that surfaced it for the first time. A real fix belongs to its own
debug session.
