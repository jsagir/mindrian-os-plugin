# lib/core/migrations/

ICM Layer 0 identity for the Phase 109 migrations directory.

Phase-scoped idempotent SQLite migrations for room.db. Each migration is a CJS
module exporting runMigration(db) that:

1. Checks an identity table sentinel row (key = 'phase_NNN_migration_vN').
2. If present, returns { applied: false } without touching the schema.
3. If absent, runs the migration in a single BEGIN/COMMIT transaction and
   inserts the sentinel row at the end.

Migrations are CALLED from lib/core/room-db.cjs openRoomDb composition entry
point. Every caller of openRoomDb sees migrated schema. Cold and warm calls
return identical handles.

## Current migrations

- phase-109-nodes-provenance.cjs: 9-column provenance addition to nodes table
  per PROVENANCE.md (Plan 108-02); status_aliases backfill of assumptions to
  graph nodes per TRUTH-STATES.md (Plan 108-03); 6 new indices; closed-enum
  CHECK constraints on created_by and review_status.

## Invariants (Canon Part 8)

- Migrations write only to room.db.
- Zero Brain queries.
- Zero remote egress.
- Sentinel row in identity table is local-only.

## Owner

Phase 109 SQL Context-Memory Navigation Spine.
