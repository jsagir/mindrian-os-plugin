# Phase 108: Provenance Field Contract

**Status:** CONTRACT specification for RECONCILE-108-03. Phase 108 ships zero migration code. Phase 109 implements the columns, indices, and constraints documented here.
**Authority:** This file specifies what Phase 109 will add to the `nodes` table at `lib/core/lazygraph-ops.cjs:31-37`. Phase 108 itself does NOT modify `room.db` schema. Deviations from this contract during Phase 109 plan-phase require an amendment commit to this file.
**Date:** 2026-05-03

## Why This Contract Exists

The current `nodes` table at `lib/core/lazygraph-ops.cjs:31-37` has only 3 columns (`id`, `type`, `properties`). All provenance lives (if at all) inside the `properties` JSON blob inconsistently. Three concrete examples of the inconsistency, observed via direct file inspection 2026-05-03:

- `lazygraph-ops.cjs:315`: `JSON.stringify({ title, section, methodology, created, content_hash })` - `created` is the only timestamp; no `created_by`, no `review_status`.
- `lazygraph-ops.cjs:354`: `JSON.stringify({ confidence: 'medium' })` - confidence as STRING enum.
- `lazygraph-ops.cjs:670-680`: `CausalClaim` properties include `confidence` as REAL [0, 1] - INCONSISTENT with the string-enum at line 354.

Without first-class indexed columns, the Canon Part 9 invariant query (below) cannot run efficiently - it would require a full table scan + JSON parse on every row. Without consistent confidence representation, evidence-grading queries (Canon Part 5) cannot be implemented.

Phase 108 specifies the fix; Phase 109 ships it. This document is a CONTRACT specification, not a migration script.

## Required Fields (Phase 109 contract; every node will carry once Phase 109 migrates)

The following six fields are specified by this Phase 108 contract. Phase 109 ships the migration that adds these columns to the `nodes` table. Phase 108 itself does not modify the live schema.

| Field | SQL Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `source_path` | TEXT | NOT NULL | (none) | File path, meeting ID, or event ID where the node originated. Required for provenance traceability per Canon Part 4 (Phase 109 enforces NOT NULL). |
| `created_by` | TEXT | NOT NULL | (none) | Closed enum (see below). Names which actor created the node (Phase 109 enforces NOT NULL + CHECK). |
| `confidence` | REAL | NULL | NULL | Range [0.0, 1.0]. Nullable because confirmed nodes may drop confidence (truth has confidence 1.0 implicitly). |
| `review_status` | TEXT | NOT NULL | `'proposed'` | Closed enum from the truth-state taxonomy (see TRUTH-STATES.md, Plan 108-03). 8 values: `proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated`. Phase 109 enforces NOT NULL + default `'proposed'`. |
| `created_at` | INTEGER | NOT NULL | (none) | Unix epoch ms. Phase 109 enforces NOT NULL. |
| `last_seen_at` | INTEGER | NOT NULL | (none) | Unix epoch ms. Drives the stale-marking auto-job (see TRUTH-STATES.md, Plan 108-03). Phase 109 enforces NOT NULL. |

### Verbatim Column-Type Specification (Phase 109 reference)

The contract column types stated as a single SQL fragment for Phase 109 to copy verbatim into its `nodes` table migration. Phase 108 ships this as specification text only; Phase 109 ships the actual `ALTER TABLE` and `CREATE TABLE` migration code.

```
source_path        TEXT NOT NULL    -- where the node came from (file path, meeting ID, event ID)
created_by         TEXT NOT NULL    -- enum: 'user' | 'larry' | 'import' | 'brain' | 'system'
confidence         REAL             -- 0.0-1.0; nullable for confirmed nodes
review_status      TEXT NOT NULL    -- enum from truth-state taxonomy; default 'proposed'
created_at         INTEGER NOT NULL -- unix epoch ms
last_seen_at       INTEGER NOT NULL -- unix epoch ms
```

This block matches CONTEXT.md D-02 lines 107-120 verbatim (modulo en-dash to hyphen conversion per project hard rule).

## Optional Fields (Phase 109 contract; populated when applicable)

The following three fields are specified as optional under this contract. Phase 109 ships them as nullable columns; population is scoped to the situations described in the Purpose column.

| Field | SQL Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `source_section` | TEXT | NULL | NULL | Folder section name if applicable. |
| `confirmed_by` | TEXT | NULL | NULL | Set ONLY when `review_status = 'confirmed'`. The contract specifies the value should be `'user'` for the node to count as trusted memory per Canon Part 9 (enforcement happens via the Phase 109 Part 9 invariant test, not via a CHECK constraint on this column). |
| `confirmed_at` | INTEGER | NULL | NULL | Unix epoch ms. Paired with `confirmed_by`. |

## Closed Enum: `created_by`

Per CONTEXT D-02, the `created_by` field is a closed enum with exactly 5 values. Phase 109 enforces this enum at the DB level (Phase 108 specifies; Phase 109 implements):

```
'user'   - human-typed input via Decision Gate APPROVE or direct edit
'larry'  - Larry-authored content (proposals, suggestions, syntheses)
'import' - bulk-imported from external source (vault import, OPML, etc.)
'brain'  - Brain MCP returned the suggestion (annotates LOCAL node; does NOT mean egress)
'system' - system-triggered (auto-stale, auto-cascade, hook-driven)
```

Phase 109 ships this enforcement as part of the migration via a `CHECK` constraint:

```
created_by TEXT NOT NULL CHECK(created_by IN ('user', 'larry', 'import', 'brain', 'system'))
```

This prevents typos like `created_by = 'use'` from passing silently. Such typos would slip past the Part 9 invariant query (a typo masking a Brain-confirmed node would not match the `confirmed_by != 'user'` filter).

Canon Part 8 note: `created_by = 'brain'` annotates LOCAL nodes that originated from Brain advisory. It does NOT mean the node was egressed to Brain. Brain is read-only from the node's perspective; a node lives in the local graph, marked `proposed`, until a human promotes it.

## The Canon Part 9 Invariant SQL Query (CONTEXT D-02 verbatim)

The single-query enforcement of Canon Part 9. In a Part-9-compliant room (post Phase 109 migration), this query returns 0 rows:

```
SELECT id, type, source_path, created_by, confirmed_by FROM nodes
WHERE review_status = 'confirmed'
  AND (confirmed_by IS NULL OR confirmed_by != 'user');
```

Semantics: any node with `review_status = 'confirmed'` AND `confirmed_by != 'user'` is a constitutional violation. Brain may propose; Larry may explain; only the human may confirm. This query surfaces every violation.

The runtime test for this query lives at `tests/test-part-9-invariant.cjs`. Phase 108 ships this test as a Wave-0 stub; Phase 109 fills it after the `review_status` and `confirmed_by` columns ship.

## Index Strategy

The Part 9 invariant query is the load-bearing query. Its execution plan needs to be a single index seek + filter scan, not a full table scan. Phase 108 specifies the recommended indices; Phase 109 plan-phase decides which ship in v1.

| Index | Type | Purpose | Mandatory in Phase 109? |
|---|---|---|---|
| `idx_nodes_review_status` | btree on `review_status` | Drives the Part 9 invariant query. | YES (mandatory in Phase 109). |
| `idx_nodes_source_path` | btree on `source_path` | "Show me all nodes from this file." | Recommended. |
| `idx_nodes_created_by` | btree on `created_by` | Filter Brain-proposed vs user-confirmed nodes. | Recommended. |
| `idx_nodes_created_at` | btree on `created_at` | Time-range queries (recent changes since session N). | Recommended. |
| `idx_nodes_last_seen_at` | btree on `last_seen_at` | Drives stale-marking auto-job. | Recommended. |
| `idx_nodes_confirmed_by` | partial btree on `confirmed_by WHERE confirmed_by IS NOT NULL` | Sparse field. Partial index keeps it cheap. | Recommended. |

The minimum Phase 109 ships under this contract: `idx_nodes_review_status` (mandatory). Other indices are recommended optimizations; Phase 109 plan-phase decides which to ship in v1 vs which to defer to a later perf pass.

## Phase 109 Two-Step Migration Plan

Per RESEARCH §3 "JSON blob vs first-class columns" tradeoff: existing nodes have provenance scattered through the JSON `properties` blob inconsistently. The migration must preserve that data while moving it to first-class columns. Phase 108 specifies the contract; Phase 109 ships the migration in two steps:

### Step 1: Add NULL columns + backfill from JSON

1. `ALTER TABLE nodes ADD COLUMN source_path TEXT;` (nullable initially).
2. `ALTER TABLE nodes ADD COLUMN created_by TEXT;` (no CHECK yet).
3. ... (one ALTER per field above).
4. Run a one-shot backfill that extracts known fields from `properties` JSON via `json_extract`. Example:

```
UPDATE nodes
SET source_path = json_extract(properties, '$.source_path')
WHERE source_path IS NULL AND json_extract(properties, '$.source_path') IS NOT NULL;
```

5. For nodes where the JSON field is missing, populate sensible defaults: `created_by = 'system'`, `created_at = (current epoch ms)`, `last_seen_at = created_at`, `review_status = 'proposed'`.

### Step 2: Tighten constraints

1. After backfill verifies every row has a non-NULL value where required, run a re-create-table-with-NOT-NULL migration. SQLite does not support `ALTER COLUMN ... SET NOT NULL` directly; the canonical pattern is:
   a. Create a `nodes_new` table with the strict schema.
   b. `INSERT INTO nodes_new SELECT ... FROM nodes;`
   c. `DROP TABLE nodes; ALTER TABLE nodes_new RENAME TO nodes;`
   d. Recreate all indices.
2. Add the `CHECK(created_by IN (...))` constraint as part of `nodes_new`.
3. Verify the Part 9 invariant query runs and returns the expected count (likely 0 for fresh rooms; non-zero for legacy rooms surfaces real violations to fix).

Phase 109 plan-phase decides: ship Step 1 in one plan, Step 2 in a follow-up plan; OR ship both in one atomic migration. Phase 108 specifies that BOTH steps happen.

## Cross-Reference to TRUTH-STATES.md

The `review_status` field is a closed 8-state enum. Full taxonomy (states, transitions, triggers, evidence requirements, status_aliases mapping for the existing `assumptions.validity` enum) lives in TRUTH-STATES.md (Plan 108-03). PROVENANCE.md only names the field and its 8 valid values; TRUTH-STATES.md defines the semantics.

## Cross-Reference to aliases.yml

The `created_by` enum and the `review_status` enum are reflected in `aliases.yml` `status_aliases` section (Plan 108-04). The aliases.yml file is the machine-readable companion to PROVENANCE.md + TRUTH-STATES.md.

## Anti-Patterns Avoided

- No `CREATE TABLE` statement that Phase 109 could `db.exec()` byte-identical (this document is a contract, not a script).
- No edit to `lib/core/lazygraph-ops.cjs` (Phase 109 owns implementation).
- No edit to `docs/MINDRIAN-CANON.md` (deferred to Phase 109 release gate per RESEARCH Anti-Pattern #2).
- No actual SQL migration in this file beyond the illustrative ALTER snippets (which are illustrations, not authoritative DDL).
- No language that suggests Phase 108 itself adds columns to `room.db`. Every "MUST" / "required" wording about provenance fields is scoped to "Phase 109 implementation" or "(once Phase 109 migrates)".
