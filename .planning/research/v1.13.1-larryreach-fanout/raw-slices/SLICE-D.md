# Slice D -- Bi-temporal edges -- Stage-1 additive migration + line-53 bug

Verdict: **PARTIAL**

## Current State

Edges live in one SQLite table from lazygraph-ops.cjs initSchema (lib/core/lazygraph-ops.cjs:38-46): edges(source TEXT, target TEXT, type TEXT, properties TEXT DEFAULT empty-json), PRIMARY KEY (source, target, type), FKs to nodes(id). No surrogate id column, no temporal columns. Every writer upserts on that composite key: writeEdge (lib/core/navigation/edges.cjs:217-220) does INSERT ... ON CONFLICT(source,target,type) DO UPDATE SET properties=excluded.properties, and lazygraph-ops.cjs repeats the same upsert at lines 392/630/655/682/770/872/928/945/964/1013. SUPERSEDES is already in the frozen ALLOWED_EDGE_TYPES Set (edges.cjs:154, Phase 131-01, alongside CONTRADICTS at :153) so the predicate exists today; only temporal columns are missing. Template = phase-109-nodes-provenance.cjs: sentinel idempotency (:32,:68-76), idempotent ALTER loop with PRAGMA guard plus duplicate-column swallow (:95-108), BEGIN/COMMIT/ROLLBACK (:371-382), and a 12-step rebuild for PK/CHECK changes (:270-341). openRoomDb (room-db.cjs:104-112) composes initSchema then initMemorySchema then the Phase 109 migrations; a new migration registers there as the next idempotent call.

## File Evidence

- `lib/core/lazygraph-ops.cjs:38-46` -- edges DDL: source,target,type,properties with PRIMARY KEY (source,target,type), FKs to nodes(id). No id, no temporal columns. The composite PK IS the bi-temporal history problem.
- `lib/core/navigation/edges.cjs:217-220` -- writeEdge chokepoint: ON CONFLICT(source,target,type) DO UPDATE overwrites prior row in place; history destroyed on re-write of same triple.
- `lib/core/navigation/edges.cjs:154` -- SUPERSEDES already allowlisted (Phase 131-01, with CONTRADICTS at :153). writeEdge accepts it today; only columns missing.
- `lib/core/navigation/edges.cjs:215` -- writeEdge manufactures an edgeId and returns it but never INSERTs it (no id column). True history needs that id to become a real PK.
- `lib/core/migrations/phase-109-nodes-provenance.cjs:37-48,95-108` -- NEW_COLUMNS plus addColumnsIdempotent: the verbatim ALTER-only additive template (PRAGMA guard, ADD COLUMN, duplicate-column swallow).
- `lib/core/migrations/phase-109-nodes-provenance.cjs:270-341` -- tightenSchemaWithCheckConstraints: the 12-step rebuild (create _new, INSERT SELECT, DROP, RENAME, recreate indices plus dependent views/triggers at :245-268). Required only for a PK change, the true-history path.
- `lib/core/migrations/phase-109-nodes-provenance.cjs:32,68-76,365-384` -- Sentinel idempotency plus BEGIN/COMMIT/ROLLBACK wrapper to copy for a phase_1XX_edges_bitemporal_v1 migration.
- `lib/core/room-db.cjs:104-112` -- openRoomDb composition point: initSchema then initMemorySchema then Phase109 migrations. New migration registers here, best-effort-required like :40-46.
- `scripts/build-graph-from-sqlite.cjs:50,53` -- BUG CONFIRMED. :50 defines roomDbPath; :53 references fs.existsSync(lazygraphPath) which is never declared (grep = only :50,:53). ReferenceError. Fix: roomDbPath.
- `scripts/build-graph-from-sqlite.cjs:52-55,66,387-389` -- The exit-0 try/catch opens at :66, AFTER the throwing guard at :53. So the ReferenceError is UNCAUGHT, crashes non-zero, defeating the never-fail-hook-chain/exit-0 contract (:11-13,:389).

## Gaps

- valid_from / valid_to / superseded_by columns all absent from edges.
- No bi-temporal edges migration module exists; nothing registered after the Phase 109 chain.
- writeEdge ON CONFLICT DO UPDATE overwrites in place; Stage-1 columns are necessary but not sufficient for history.
- No history-aware read path: all readers select current edges with no validity-window filter, so closed edges still surface as live.
- No partial index WHERE valid_to IS NULL.
- build-graph-from-sqlite.cjs:53 ReferenceError must be fixed (lazygraphPath to roomDbPath) independently.

## Raw Notes

STAGE-1 (ALTER-only, no PK change): copy phase-109 addColumnsIdempotent against edges. Three nullable, duplicate-resilient ALTERs: valid_from INTEGER (epoch ms; backfill now()), valid_to INTEGER (NULL = open/currently-valid), superseded_by TEXT (soft pointer). Wrap in BEGIN/COMMIT plus a phase_1XX_edges_bitemporal_v1 sentinel. Register in room-db.cjs:109-112. Add CREATE INDEX IF NOT EXISTS idx_edges_open ON edges(source,target,type) WHERE valid_to IS NULL. Genuinely ALTER-only: SQLite ADD COLUMN cannot touch the composite PK and these are plain attributes, so no rebuild. Trivial, idempotent, matches the template. Skeleton owned, hence PARTIAL not REFUTED.

TRUE HISTORY REQUIRES A PK CHANGE: YES. PK (source,target,type) means at most ONE physical row per triple. History needs TWO rows per triple: old with valid_to stamped (closed) plus new with valid_to NULL (open). Composite PK forbids it; the second INSERT collides and ON CONFLICT DO UPDATE (edges.cjs:218-219 plus the 10 lazygraph-ops upserts) silently OVERWRITES rather than closing. THIS is the (source,target,type) collision problem named in the task, real and the wall. Stage-2 = phase-109 12-step rebuild: edges_new with a surrogate PK (INTEGER PK / unique edge id, which writeEdge already mints at :215 and currently discards, or a widened PK (source,target,type,valid_from)), INSERT SELECT old rows stamping valid_from, DROP/RENAME, recreate 5 indices plus partial index, drop/recreate rs_discoveries VIEW (lazygraph-ops.cjs:84) plus any edges-mentioning trigger via dependentSchemaObjects (:245-268). PLUS writeEdge ON CONFLICT must change from DO UPDATE (overwrite) to close-old-then-insert-new in a transaction. Stage-1 columns alone give a current-validity-window annotation, NOT retained history, because re-asserting a triple still clobbers.

LINE-53 BUG CONFIRMED: grep lazygraphPath = two hits, :50 (roomDbPath, correct) and :53 (typo, undeclared). One-token fix: fs.existsSync(roomDbPath). The throw at :53 precedes the exit-0 try at :66, so it is UNCAUGHT and crashes non-zero, opposite of the stated graceful exit-0. The ReferenceError is unconditional once :53 is reached (undeclared-var access throws regardless of room.db presence), so this path is effectively dead / never successfully exercised in prod. Signal: either the script is off the live hook path or its failures are absorbed upstream; recommend a separate fix plus a who-invokes-it audit.
