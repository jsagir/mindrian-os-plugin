---
status: resolved
kind: rca
trigger: "room-identity-relative-registry-path"
created: 2026-11-16T00:00:00Z
updated: 2026-11-16T00:00:00Z
---

## Current Focus

hypothesis: RESOLVED. findRegistryEntry resolved a relative registry path against process.cwd(), not the rooms home.
test: tests/test-36925-rid-registry-relative-path.cjs (R1-R5), RED before the fix (3 of 5 fail), GREEN after.
expecting: (met) a legacy room with a relative registry path gets its slug and created_at from the registry.
next_action: the main session repairs the real room after review (command in the report).

## Symptoms

expected: runDeriveBackfill with approvedBy on ~/MindrianRooms/<legacy-room> recovers the room to state ready.
actual: readiness not_ready, reason identity_missing, room_id_source minted_by_repair, slug "unknown", unknown_keys room.slug, room.depth, room.parent, room.created_at, room.birth_version; registry_detail slug_unknown.
errors: none thrown; the recovery stops at the slug_unknown branch of lib/core/graph-backfill.cjs _recoverIdentity.
reproduction: copy the room and a one-entry registry (path "<legacy-room>", relative) to a temp rooms home; run repairRoomIdentity with cwd outside that home: slug unknown. Run it with cwd = the rooms home: slug <legacy-room>, source registry.
started: every legacy room whose registry entry carries a relative path and whose .room-root and ROOM.md name no slug.

## Eliminated

- hypothesis: the registry root field "~/MindrianRooms" (literal tilde) is the join base that fails
  evidence: scripts/room-registry (lines 568-577, 611-620, 753-761) joins a relative path to the rooms home, not to the root field. The identity code never reads the root field.
  timestamp: 2026-11-16T00:00:00Z

## Evidence

- timestamp: 2026-11-16T00:00:00Z
  checked: lib/core/navigation/room-identity.cjs findRegistryEntry (was lines 325-336)
  found: samePath(realOrResolved(entry.path), real) with realOrResolved = fs.realpathSync or path.resolve, both relative to process.cwd().
  implication: a relative path matches only when the process cwd is the rooms home.

- timestamp: 2026-11-16T00:00:00Z
  checked: the real room sources (read only)
  found: .room-root is 0 bytes (readJsonFile gives null); ROOM.md has a top-level room_id and no icm_self; the registry entry has path "<legacy-room>", created, no depth or parent.
  implication: the registry key is the ONLY slug source. With no registry match, no slug source exists, so slug is unknown.

- timestamp: 2026-11-16T00:00:00Z
  checked: probe on a temp copy, cwd /tmp versus cwd = rooms home
  found: cwd /tmp gives slug unknown, source none. cwd = rooms home gives slug <legacy-room>, source registry, created_at 2026-08-26T08:09:19Z.
  implication: hypothesis PROVEN.

- timestamp: 2026-11-16T00:00:00Z
  checked: the real room.db identity rows (through a temp copy)
  found: an earlier approved repair already wrote room_id <minted uuid> (minted), slug "unknown", and a Room node room:unknown.
  implication: the next approved repair keeps that room_id, rewrites the slug, and leaves the stale room:unknown node.

## Resolution

root_cause: lib/core/navigation/room-identity.cjs findRegistryEntry resolved entry.path with path.resolve, which uses process.cwd(). The registry stores paths relative to the rooms home. So the entry never matched unless the process ran inside the rooms home, and a room with no other slug source got slug "unknown".
fix: new resolveRegistryPath(p, roomsHome) expands a leading "~" to HOME and joins a relative path to the rooms home (the same rule as scripts/room-registry and lib/core/resolve-active-room.cjs). repairRoomIdentity passes roomsHome to findRegistryEntry. The copy guard (path match first, key match only for an entry with no path) is unchanged.
verification: tests/test-36925-rid-registry-relative-path.cjs 5/5; tests/run-all-36925.sh; end-to-end runDeriveBackfill on a temp copy of the room gives recovered true and a readback of state ready (slug <legacy-room>, created_at from the registry, room_id kept).
files_changed: lib/core/navigation/room-identity.cjs, tests/test-36925-rid-registry-relative-path.cjs, tests/run-all-36925.sh

## Not fixed here (sibling findings)

- lib/core/room-readiness.cjs:222 recordedRoomId compares real(e.path) with the same cwd-relative rule. It reads only entries that carry room_id. Same defect class.
- The stale Room node room:unknown stays in a room that an earlier repair wrote with slug unknown.
- projectRoomIdentity does not write room_id into an empty (0 byte) .room-root (detail sentinel: unparseable).
- room.depth and room.parent stay unknown when the registry entry carries neither. The rule "never defaulted" is kept.
