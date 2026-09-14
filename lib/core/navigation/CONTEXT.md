# lib/core/navigation/

## What this directory is

The SQL navigation spine for the per-room local graph (`<roomDir>/.mindrian/room.db`). `lib/core/navigation.cjs` re-exports this directory's helpers as the closed API surface; nothing outside this directory talks to `room.db` directly except the two named exclusions below.

## The two write chokepoints and the one read chokepoint

`lib/core/node-insert.cjs:202` (`insertNode`) is the single NODE write chokepoint.

`lib/core/navigation/edges.cjs` `writeEdge` is the single EDGE write chokepoint.

`lib/core/navigation.cjs` is the READ chokepoint.

The two write chokepoints are constitutionally distinct: an anchor edge is not `node-insert.cjs`'s business, because its entire contract is inserting one row into `nodes` correctly across three schema variants, and it has no edge surface at all.

Two named exclusions bypass the node chokepoint entirely, cited at `node-insert.cjs:5-9`: `lib/core/navigation/memory-events.cjs` (append-only bookkeeping dedupe) and `lib/core/rs-sqlite-mirror.cjs` (bulk-write hot path). Both issue a raw `INSERT INTO nodes` of their own.

## What a claim's provenance is

The provenance edge is `SOURCED_FROM` (`edges.cjs:854`; design commentary at `edges.cjs:818-847`).

Its only writer is `reasoning-write.cjs:185`, which has produced zero rows in any room because both callers supply an empty evidence list and the writer refuses to fabricate one (`reasoning-write.cjs:163-165`, the never-fabricate-provenance floor).

The dominant claim producer is a different function, `typed-claim.cjs:121` `writeClaimNode`, which writes a node and zero edges.

The second anchor named in the design, a memory-event provenance edge, has no writer, no edge type and zero instances (`memory-events.cjs:764-777` writes no edge).

Four claim-producing paths exist and only one of them anchors, and changing that is Phase 273 territory, not this directory's. See `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md` section 5 for the file-by-file blast radius if that fix is ever taken on.

## Why a dangling endpoint is legal

Phase 169 `D-169-11` removed the hard foreign key from `edges(source, target)` to `nodes(id)`, under an if-not-exists guard that binds new databases only (`lazygraph-ops.cjs:165-181`).

The reason: a room-lineage `NESTED_WITHIN` edge legitimately points at a node that lives in a different room's database, and a hard FK would reject that.

Consequence, stated once: an edge whose endpoint has no node row is not a schema violation, it is a permitted state, and nothing anywhere rejects one. `writeEdge` validates params, the edge type, and review status, and then inserts; it never probes whether either endpoint has a node row.

The correct response to that fact is measurement, not a re-added foreign key. `lib/core/doctor/room-graph-integrity-module.cjs` is the organ that measures it.

## Three schema variants, one rule

Migrated (16-column), partially migrated (12-column), and legacy (3-column) databases all exist in the live fleet at once. Any read that names a column beyond `id`, `type` and `properties` must gate on `PRAGMA table_info(nodes)` first, exactly as `node-insert.cjs:20-30` already does for writes.

A statement the schema cannot answer reports null, never zero. A zero on an unreadable column reads as a clean bill of health; a null reads honestly as unmeasured.

## The two doors

`openRoomDbReadOnlyForCaller` (`spine-events.cjs`) is the door for any census or read-only sweep.

`openRoomDbForCaller` is the door for write paths only, because it runs 13 table-creation statements (each an IF-NOT-EXISTS guard) and 5 migrations on every open. A census run through it would migrate every registered room on first run, including the legacy 3-column rooms, which would then stop being a measurable population.

## Reads / Does / Writes / Human check / Change-impact

**Reads.** Node and edge rows over a caller-owned handle, gated on `PRAGMA table_info` for schema-variant safety before any column beyond `id`/`type`/`properties` is named.

**Does.** Owns claim, decision, opportunity, and memory-event writers, the edge-write chokepoint, insight queries, focus tracking, and node-status transitions, all as pure functions over a caller-supplied handle. Never opens `room.db` itself; the chokepoint module owns the lifecycle.

**Writes.** Zero DDL beyond the two chokepoints. Every typed writer rides the `properties` JSON blob; only `node-insert.cjs` and `edges.cjs` execute an `INSERT`, plus the two named exclusions above.

**Human check.** Promotion of a node to `confirmed` requires a human APPROVE through `navigation.confirmNode` (Canon Part 9 role 5). The write itself is deliberately ungated because the gate is on trust, not on existence; a proposed claim is not a defect.

**Change-impact.** A change here hits every typed writer, `lib/core/navigation.cjs`'s re-export surface, the doctor census, and 77 call sites across 43 files that read `writeEdge`'s `.ok`. It does not hit the room schema DDL, `REACH_IDS`, or `SENSOR_REGISTRY`.

## The name collision

Fleet level: `$ROOMS_HOME/.rooms/.room-graph/rooms.db` is the live rooms registry database, the real and current fleet-level registry graph.

Room level: `.room-graph/` as a per-room path is dead. The real per-room database path is `<roomDir>/.mindrian/room.db` (`lib/core/room-db.cjs:255-256`).

A plan or a script that globs `.room-graph/room.db` finds the fleet registry, not a room graph. Treating that file as a room's local graph is a category error with no error message to catch it.
