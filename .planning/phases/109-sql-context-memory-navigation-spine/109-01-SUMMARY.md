---
phase: 109-sql-context-memory-navigation-spine
plan: "01"
subsystem: navigation
wave: 1
tags: [navigation, migration, nodes-provenance, truth-states, nav-109-02, nav-109-03, canon-part-4, canon-part-7, canon-part-8, canon-part-9, sqlite]
requirements:
  - NAV-109-02
  - NAV-109-03
canon_parts:
  - "Part 4 (Every Choice Is Graph Data - the 9 provenance columns make every node carry created_by / source_path / review_status / created_at / last_seen_at; the assumptions-table backfill promotes legacy assumption rows to first-class graph nodes)"
  - "Part 7 (Reuse Before Build - migration runs INSIDE the existing room-db.cjs openRoomDb composition entry point; no new module surface; no new npm dependencies)"
  - "Part 8 (Graph Boundary - migration writes only to room.db; zero Brain queries; zero remote egress; the identity sentinel row is local-only)"
  - "Part 9 (Memory Locality and Interpretation - the closed-8 review_status CHECK enum is the truth-state taxonomy in SQL; the closed-5 created_by enum encodes who may author what; this is the substrate Canon Part 9 ratifies in Plan 109-11)"
dependency_graph:
  requires:
    - "Phase 108 (frozen schema/taxonomy: TRUTH-STATES.md closed-8 review_status states + status_aliases, PROVENANCE.md 6+3 provenance fields, RECONCILIATION.md memory_event first-class node type, aliases.yml)"
    - "109-00 (test stub registration: tests/test-navigation-migration-{idempotent,backfill,coexistence}.cjs + the 500-node sample-room fixture seed.sql)"
  provides:
    - "lib/core/migrations/phase-109-nodes-provenance.cjs runMigration(db) -> { applied, sentinelInserted, backfilledAssumptions } - idempotent via identity.key='phase_109_migration_v1' sentinel; rebuilds the nodes table from the legacy 3-column shape (id, type, properties) to the 12-column provenance shape with closed-5 created_by + closed-8 review_status CHECK enums"
    - "the SQLite canonical 12-step view/trigger drop-and-recreate dance around the nodes-table rebuild (added by follow-up fix 7d87ed5; see Follow-up fix section)"
    - "status_aliases backfill: legacy assumptions-table rows become graph nodes with review_status mapped per Phase 108 TRUTH-STATES.md (untested -> proposed, supported -> validated, contradicted -> invalidated, stale -> stale); one state_alias_migration memory_event logged per migrated row"
    - "lib/core/migrations/ROOM.md ICM Layer 0 identity for the new migrations subdirectory"
  affects:
    - "every Phase 109 navigation module reads the provenance columns this migration adds (neighborhood.cjs, packet.cjs, room-home.cjs, insights.cjs, ingestion.cjs)"
    - "lib/core/room-db.cjs openRoomDb runs this migration (best-effort require) before/alongside the lazygraph + memory schema init"
    - "lib/core/lazygraph-ops.cjs + lib/core/memory-ops.cjs (parallel-worktree merge surface; see Deviations)"
tech-stack:
  added: []
  patterns:
    - "Re-create-table-with-CHECK-constraints (canonical SQLite 12-step recipe): CREATE nodes_new with NOT NULL + CHECK enums; INSERT SELECT from old nodes; DROP nodes; ALTER nodes_new RENAME TO nodes; rebuild 6 new indices"
    - "Idempotency via an identity-table sentinel key (mirrors Phase 108 Plan 108-01 + Phase 109 Plan 109-02 patterns)"
    - "Runtime identity-schema detection (identityHasUpdatedAt): the legacy memory-ops.cjs identity table is 3-column (key, value, updated_at TEXT NOT NULL); the Phase 108 PROVENANCE.md spec assumed 2-column; the sentinel INSERT is built to match whichever shape is present"
    - "BEGIN/COMMIT/ROLLBACK transaction wrapper per Phase 87-06 invariant (node:sqlite has no transaction(fn) higher-order helper)"
    - "Follow-up fix 7d87ed5: dependentSchemaObjects(db) enumerates every view/trigger from sqlite_master whose sql references `nodes`, drops each before the rebuild, re-execs the captured CREATE sql after the indices are rebuilt - the canonical SQLite recipe for ALTER ... RENAME TO with dependent objects"
key-files:
  created:
    - lib/core/migrations/phase-109-nodes-provenance.cjs
    - lib/core/migrations/ROOM.md
    - tests/test-navigation-migration-idempotent.cjs
    - tests/test-navigation-migration-backfill.cjs
    - tests/test-navigation-migration-coexistence.cjs
  modified:
    - lib/core/room-db.cjs
    - lib/core/lazygraph-ops.cjs
    - lib/core/memory-ops.cjs
decisions:
  - "Migration uses the rename-out-of-existence table rebuild (not in-place ALTER) because SQLite cannot add a CHECK constraint to an existing column; the 12-column destination schema column order matches the NEW_COLUMNS list so the INSERT SELECT lines up positionally"
  - "Idempotency via identity.key='phase_109_migration_v1' sentinel: re-running runMigration on an already-migrated room.db is a no-op returning { applied: false }"
  - "status_aliases backfill maps legacy assumption validity values to the closed-8 review_status enum per Phase 108 TRUTH-STATES.md; each migrated row gets a state_alias_migration memory_event so the migration itself is auditable in the memory log"
  - "Runtime identity-schema detection so the sentinel INSERT works against both the 3-column memory-ops.cjs identity table (the live shape) and the 2-column PROVENANCE.md spec"
metrics:
  duration: "post-hoc reconstruction (original plan executed 2026-05-05; follow-up fix 2026-05-12; SUMMARY written by Plan 109-12 2026-05-12)"
  completed: 2026-05-12
  tasks: 2
  files_created: 5
  files_modified: 3
---

# Phase 109 Plan 01: Nodes-Provenance Migration Summary

**The phase-109-nodes-provenance migration rebuilds the `nodes` table from the legacy 3-column shape `(id, type, properties)` to the 12-column provenance shape - 9 new columns (`source_path`, `created_by`, `confidence`, `review_status`, `created_at`, `last_seen_at`, `source_section`, `confirmed_by`, `confirmed_at`) plus the closed-5 `created_by` CHECK enum and the closed-8 `review_status` CHECK enum - and backfills legacy assumptions-table rows into first-class graph nodes via the Phase 108 `status_aliases` table, logging one `state_alias_migration` memory_event per migrated row. Idempotent via an `identity.phase_109_migration_v1` sentinel. A post-merge follow-up fix (commit `7d87ed5`) added the canonical SQLite 12-step view/trigger drop-and-recreate dance around the table rebuild so the migration no longer crashes `openRoomDb` for any `room.db` carrying the Phase-89 `rs_discoveries` view.**

> Reconstruction note: this SUMMARY is hand-written by Plan 109-12 (2026-05-12). Plan 109-01 was executed on 2026-05-05 in a parallel worktree; its code landed on `main` (commits `eec5008`, `4691bec`, `22201c5`) but no clean `docs(109-01): complete` commit was ever made, so no original SUMMARY exists to restore verbatim. This text is reconstructed from the on-disk migration module (`lib/core/migrations/phase-109-nodes-provenance.cjs`), the migration tests (`tests/test-navigation-migration-{idempotent,backfill,coexistence,views}.cjs`), the feature/test commits, and the post-merge follow-up fix `7d87ed5` + its debug archive `2601229`.

## What Shipped

### lib/core/migrations/phase-109-nodes-provenance.cjs (NEW)

`runMigration(db)` -> `{ applied, sentinelInserted, backfilledAssumptions }`. Also exports `SENTINEL_KEY` (`'phase_109_migration_v1'`).

Migration shape:

1. **Sentinel short-circuit.** If `identity.phase_109_migration_v1` is present, return `{ applied: false }` immediately - the migration is a no-op on an already-migrated room.
2. **Add the 9 provenance columns.** `ALTER TABLE nodes ADD COLUMN x9` (each duplicate-resilient via try/catch so re-runs and parallel-worktree pre-migration backfills are no-ops). The columns: `source_path TEXT`, `created_by TEXT`, `confidence REAL`, `review_status TEXT DEFAULT 'proposed'`, `created_at INTEGER`, `last_seen_at INTEGER`, `source_section TEXT`, `confirmed_by TEXT`, `confirmed_at INTEGER`.
3. **Backfill from properties JSON.** `json_extract` lifts `confidence` (legacy `'high'`/`'medium'`/`'low'` strings -> REAL values per Phase 108 PROVENANCE.md) and other provenance hints out of the `properties` JSON blob into the new columns.
4. **status_aliases assumptions backfill.** Legacy `assumptions`-table rows are promoted to first-class graph nodes with `type='assumption'` and a `review_status` mapped through the Phase 108 `status_aliases` table: `untested -> proposed`, `supported -> validated`, `contradicted -> invalidated`, `stale -> stale`. A `legacy_validity` property is preserved on each migrated node for the backfill regression test.
5. **state_alias_migration memory_event log.** One `memory_event` node (`event_type='state_alias_migration'`, per Phase 108 TRUTH-STATES.md L68 - the 15th closed-set event type) is logged per migrated assumption row, so the migration itself is auditable in the memory log.
6. **Re-create the table with NOT NULL + CHECK constraints (canonical SQLite 12-step recipe).** `CREATE nodes_new` with the 12-column destination schema, the closed-5 `created_by` CHECK enum, and the closed-8 `review_status` CHECK enum (`proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated`); `INSERT INTO nodes_new SELECT ... FROM nodes`; `DROP TABLE nodes`; `ALTER TABLE nodes_new RENAME TO nodes`; rebuild 6 new indices (including `idx_nodes_type` and `idx_nodes_created_at` that `findRecentChanges` relies on - NAV-109-03).
7. **Insert the sentinel row.** `INSERT INTO identity (...)` keyed `phase_109_migration_v1` - schema-detected so it works against both the 3-column memory-ops.cjs `identity` table (the live shape, with `updated_at TEXT NOT NULL`) and the 2-column PROVENANCE.md spec.

All steps run inside a single `BEGIN`/`COMMIT` transaction (Phase 87-06 invariant: node:sqlite has no `transaction(fn)`); `ROLLBACK` on any error.

### lib/core/room-db.cjs / lib/core/lazygraph-ops.cjs / lib/core/memory-ops.cjs (MODIFIED)

`openRoomDb` runs this migration as part of the room-db composition (best-effort `require` of the migration module - see the parallel-worktree note in Plan 109-02's SUMMARY for the `openRoomDb` async-to-sync contract change that was merged in the same Wave 1 cycle). `lazygraph-ops.cjs` and `memory-ops.cjs` saw small reconciliation edits at the Wave 1 merge so the migration runs in the right order relative to lazygraph `initSchema` (which creates the `rs_discoveries` view - the object the follow-up fix `7d87ed5` had to learn to drop-and-recreate).

### tests/test-navigation-migration-{idempotent,backfill,coexistence}.cjs (NEW)

| Test | Fixture | Assertion |
|---|---|---|
| `test-navigation-migration-idempotent` | room with the legacy 3-column nodes schema; run migration twice | second run is a no-op (`{ applied: false }`; no errors, no data changes); after the first run `PRAGMA table_info(nodes)` returns 12 columns |
| `test-navigation-migration-backfill` | room with legacy data: nodes with `properties.confidence='high'`, assumptions with various validity values | post-migration: `confidence=0.8` (etc.); assumption rows exist as graph nodes with the correct `review_status` per `status_aliases` (untested -> proposed, supported -> validated, contradicted -> invalidated, stale -> stale); `legacy_validity` property preserved |
| `test-navigation-migration-coexistence` | room mid-migration (Step 1 done, table rebuild not yet) | reads via the navigation API still work; old `assumptions.validity` reads still work; no data corruption |

## Follow-up fix (commit 7d87ed5 - the phase-109-migration-view-drop-collision bug)

**What broke:** the migration rebuilt the `nodes` table via the rename-out-of-existence pattern (`DROP TABLE nodes; ALTER TABLE nodes_new RENAME TO nodes`) without first dropping the views/triggers that reference `nodes`. SQLite 3.51.2 (with `legacy_alter_table` OFF) re-validates the whole schema during `ALTER TABLE ... RENAME TO`, so the now-dangling `rs_discoveries` view (created by lazygraph `initSchema`, which runs before this migration in `openRoomDb`) made the rename throw `error in view rs_discoveries: no such table: main.nodes`. That crashed `openRoomDb` for any `room.db` carrying the Phase-89 `rs_discoveries` view - blocking 10 Phase-109 navigation suites and hanging an unrelated Phase-84 test on a dangling SQLite handle (4/16 Phase-109 suites green before the fix).

**The fix:** `tightenSchemaWithCheckConstraints` now follows the canonical SQLite 12-step recipe for dependent objects - a new `dependentSchemaObjects(db)` helper enumerates every view/trigger from `sqlite_master` whose `sql` references `nodes` (not hardcoded to `rs_discoveries`), drops each before the rebuild, and re-execs the captured `CREATE` sql after the indices are rebuilt. Idempotency is preserved (the sentinel short-circuit is unchanged; drop-then-recreate is a no-op for unrelated objects). The fix added `tests/test-navigation-migration-views.cjs` (seeds a `room.db` with an `rs_discoveries`-style view + a bare-CREATE view + a trigger referencing `nodes`; asserts no throw, views/trigger still work post-migration, idempotent re-run) and registered it in `lib/memory/run-feynman-tests.cjs`.

**Outcome:** 14/16 Phase-109 suites green after `7d87ed5` (the 2 still-failing were the Wave 4 stubs that Plans 109-10 + 109-11 later filled; all 16 are green now). The debug session is archived in commit `2601229` (`.planning/debug/resolved/phase-109-migration-view-drop-collision.md`).

## Commits

| Phase | Commit | Message |
|---|---|---|
| RED tests | `4691bec` | test(109-01): add RED migration tests for nodes-provenance |
| GREEN migration | `eec5008` | feat(109-01): ship phase-109 nodes-provenance migration |
| Wave 1 merge | `22201c5` | feat(109-01,109-00): merge Wave 1 worktrees + fix openRoomDb shim |
| Follow-up fix | `7d87ed5` | fix(109-01): phase-109 nodes-provenance migration drops+recreates dependent views around the nodes-table rebuild |
| Debug archive | `2601229` | docs(debug): resolve phase-109-migration-view-drop-collision -- archive session |

## Requirements

- **NAV-109-02** (Typed Neighborhood Retrieval): satisfied at the schema layer - the 9 provenance columns this migration adds are what `getNeighborhood` returns on every neighbor; the recursive-CTE neighborhood query (shipped in Plan 109-04) reads `created_by / source_path / review_status / created_at / last_seen_at` from these columns.
- **NAV-109-03** (Memory Event Log): satisfied at the schema layer - `memory_event` rows live in the unified `nodes` table (not a separate `memory_events` table) per Phase 108 RECONCILIATION.md; the `idx_nodes_type` + `idx_nodes_created_at` indices this migration rebuilds drive the single-SELECT `findRecentChanges` (shipped in Plan 109-03); the `state_alias_migration` event type (the 15th closed-set type) is logged by this migration's own backfill.

## Deviations from Plan

- This SUMMARY is itself a deviation in the sense that it is a post-hoc reconstruction written by Plan 109-12 (2026-05-12), not a SUMMARY written at execution time - because Plan 109-01 never got a clean `docs(109-01): complete` commit when its parallel worktree was merged.
- The migration's `openRoomDb` integration interacted with Plan 109-02's `openRoomDb` async-to-sync rewrite (both Wave 1, file-overlapping on `lib/core/room-db.cjs`); the merge reconciliation handled the contract change - see Plan 109-02's SUMMARY "Deviations from Plan" item 3 for the full account.
- The follow-up fix `7d87ed5` (the view-drop-collision) is documented above as a separate post-merge fix, not a same-day deviation.

## Self-Check: PASSED

- FOUND: lib/core/migrations/phase-109-nodes-provenance.cjs (`module.exports = { runMigration, SENTINEL_KEY }`)
- FOUND: lib/core/migrations/ROOM.md
- FOUND: tests/test-navigation-migration-idempotent.cjs / -backfill.cjs / -coexistence.cjs / -views.cjs
- FOUND commit: eec5008 (GREEN migration)
- FOUND commit: 4691bec (RED tests)
- FOUND commit: 22201c5 (Wave 1 merge)
- FOUND commit: 7d87ed5 (follow-up fix - view-drop-collision)
- FOUND commit: 2601229 (debug archive)
- `node tests/test-navigation-migration-idempotent.cjs` / -backfill / -coexistence / -views all exit 0 (Plan 109-12 re-verified 2026-05-12)
- Zero em-dashes or en-dashes in this file

---
*Phase: 109-sql-context-memory-navigation-spine*
*Plan: 01*
*SUMMARY reconstructed: 2026-05-12 (by Plan 109-12)*
