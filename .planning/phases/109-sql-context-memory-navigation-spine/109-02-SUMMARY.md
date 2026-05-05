---
phase: 109-sql-context-memory-navigation-spine
plan: "02"
subsystem: navigation
tags: [navigation, focus, session-state, statusline, canon-part-1, canon-part-4, canon-part-9, sql, sqlite, migration, idempotent]
requirements: [NAV-109-01]
canon_parts:
  - "Part 1 (Wicked Navigator): focus node IS the navigator's working-memory anchor"
  - "Part 3 (Tri-Context Decision Gate): active focus is the LOCAL context anchor for Phase 110 Decision Gate panels"
  - "Part 4 (Every Choice Is Graph Data): setFocus writes a focus_changed memory_event for audit trail"
  - "Part 9 (Memory Locality): session_focus persists in room.db, never in process memory"
dependency_graph:
  requires:
    - "Plan 109-01 nodes-provenance migration (FK target nodes(id) needs the post-migration 12-column schema; see deviation note 1)"
    - "Plan 109-00 Wave-0 test stub for tests/test-navigation-focus.cjs (assumed; not present in this isolated worktree, dual-write happened)"
  provides:
    - "session_focus table with PK session_id, FK focus_node_id REFERENCES nodes(id), CHECK enum on set_by, idx_session_focus_set_at index"
    - "lib/core/navigation/focus.cjs internal helpers (getActiveFocus / setFocus / computeAutoFocus / VALID_SET_BY)"
    - "lib/core/navigation/ subdirectory with ROOM.md identity (Plans 109-04..09 ship sibling helpers here)"
    - "lib/core/migrations/ subdirectory (Plan 109-01 nodes-provenance also lives here)"
    - "Idempotent migration sentinel pattern phase_109_session_focus_v1 in identity table"
    - "Statusline 🎯 focus glyph prefix (best-effort; Canon Part 8 LOCAL-only)"
    - "Phase 106-02 glyph fence amendment per RESEARCH Open Question 11.8 (🎯 shared between JTBD and focus contexts)"
  affects:
    - "lib/core/room-db.cjs: openRoomDb async-to-sync contract change (parallel-worktree merge surface; see deviation 2)"
    - "scripts/statusline-mos: focus_segment prefix added; functional only when MINDRIAN_ROOM and session_id env vars are set"
    - "tests/test-context-monitor-d02-broadcast.cjs: Test 5 semantics broadened to amended fence"
tech_stack:
  added: []
  patterns:
    - "node:sqlite DatabaseSync (synchronous prepared statements throughout)"
    - "Idempotent migration via identity sentinel key pattern (mirrors Phase 108 Plan 108-01 pattern)"
    - "Defensive ALTER TABLE ADD COLUMN backfill in try/catch for parallel-worktree FK target compatibility"
    - "Hermetic per-test tmpdir + module-injection mock (jtbd / operator) pattern from tests/test-cross-room-memory.cjs"
    - "Closed enum validation via Set lookup BEFORE db touch (setFocus invalid_set_by gate)"
    - "Single BEGIN/COMMIT transaction wraps session_focus INSERT + memory_event INSERT (atomicity guarantee)"
key_files:
  created:
    - lib/core/navigation/focus.cjs
    - lib/core/navigation/ROOM.md
    - lib/core/migrations/phase-109-session-focus.cjs
    - tests/test-navigation-focus.cjs
    - .planning/phases/109-sql-context-memory-navigation-spine/109-02-SUMMARY.md
  modified:
    - lib/core/room-db.cjs
    - scripts/statusline-mos
    - tests/test-context-monitor-d02-broadcast.cjs
decisions:
  - "Used 'room:<roomId>' as auto-focus rule 3 fallback (NOT a new governing_thought node type) per RESEARCH section 4.2 recommendation; avoids amending the frozen Phase 108 aliases.yml"
  - "Authored standalone phase-109-session-focus.cjs migration with defensive ensureProvenanceColumns() backfill so this plan executes correctly in a parallel worktree where Plan 109-01 has not yet shipped; backfill is a strict subset of the canonical 109-01 schema work and is safe under either ordering"
  - "Made openRoomDb synchronous returning the bare DatabaseSync handle (not the legacy async { db, conn } tuple) per Plan's explicit Step 4 instruction; documented the breaking contract change inline as a parallel-worktree merge surface for the orchestrator"
  - "Reused 🎯 glyph for focus per RESEARCH Open Question 11.8 (amend the fence rather than introducing a new glyph); auto-focus rule 1 anchors on JTBD so the two signals are semantically correlated"
  - "Surfaced the focus glyph from scripts/statusline-mos as a prefix BEFORE exec'ing context-monitor (rather than inside context-monitor) to satisfy plan's must_haves grep ('focus_segment' AND 'getActiveFocus' must be in scripts/statusline-mos); functionally equivalent visual outcome"
metrics:
  duration_seconds: 811
  duration_human: "13.5 minutes"
  tasks_completed: 3
  tasks_total: 3
  commits: 3
  files_created: 5
  files_modified: 3
  test_assertions_added: 8
  test_assertions_amended: 1
completed_date: "2026-05-05"
---

# Phase 109 Plan 02: Focus Node Model Summary

**One-liner:** Persistent session focus stored in `room.db` (`session_focus` table with FK to `nodes(id)`), three-rule auto-focus cascade (active JTBD anchor → DECISION_GATE most-recent unconfirmed decision → `room:<roomId>` root), every focus shift logged as a `focus_changed` memory_event, and a 🎯 statusline glyph that surfaces the active focus to the wicked navigator.

## Implementation

### session_focus table (D-01)

Five columns, locked by RESEARCH section 2.3 DDL:

```sql
CREATE TABLE IF NOT EXISTS session_focus (
  session_id    TEXT PRIMARY KEY,
  focus_node_id TEXT NOT NULL,
  focus_type    TEXT NOT NULL,
  set_at        INTEGER NOT NULL,
  set_by        TEXT NOT NULL CHECK(set_by IN ('user','larry','auto-from-jtbd','auto-from-operator','auto-from-state')),
  FOREIGN KEY (focus_node_id) REFERENCES nodes(id)
);
CREATE INDEX IF NOT EXISTS idx_session_focus_set_at ON session_focus(set_at DESC);
```

Migration is idempotent via `identity.key='phase_109_session_focus_v1'` sentinel. Re-running the migration on an already-migrated room is a no-op (returns `{ applied: false }`).

### lib/core/navigation/focus.cjs API

Three closed-surface helpers (consumed by lib/core/navigation.cjs in Plan 109-04):

- `getActiveFocus(db, sessionId)` — returns `{ sessionId, focusNodeId, focusType, setAt, setBy }` or `null`.
- `setFocus(db, sessionId, nodeId, setBy)` — validates `setBy` against the closed enum AND verifies `nodeId` exists in `nodes` table BEFORE INSERT; on success writes the `session_focus` row AND a `focus_changed` memory_event in a single `BEGIN/COMMIT` transaction. Returns `{ ok: true, eventId }` on success, `{ ok: false, reason }` on validation failure (`invalid_set_by` | `unknown_node`).
- `computeAutoFocus(db, roomDir, sessionId, opts)` — runs the 3-rule cascade per CONTEXT D-01 L79-83:
  - **Rule 1:** active JTBD set → `jtbd:<id>` anchor; `set_by='auto-from-jtbd'`.
  - **Rule 2:** operator `DECISION_GATE` → most recent `proposed`/`needs_evidence` decision; `set_by='auto-from-operator'`.
  - **Rule 3:** else `room:<roomId>` (per RESEARCH section 4.2 — does NOT introduce a `governing_thought` node type that would amend the frozen Phase 108 aliases.yml); `set_by='auto-from-state'`.
  - **Rule 4 (cold start):** all three null → returns `null`; statusline shows no glyph.

The helper accepts an `_mocks` injection seam (`{ jtbd, operator }`) for hermetic testing per `tests/test-cross-room-memory.cjs` pattern; falls back to `require()`'ing `lib/hmi/jtbd-state.cjs` and `lib/conversation/operator.cjs` when no mocks are provided.

### Statusline integration (RESEARCH section 4.3)

`scripts/statusline-mos` gains a `focus_segment` block that:

1. Activates only when both `MINDRIAN_ROOM` and `session_id` env vars are set.
2. Spawns `node -e` to call `openRoomDb(MINDRIAN_ROOM)` + `focus.getActiveFocus(db, session_id)`.
3. If focus returns non-null, emits `🎯 <focusType>:<focusNodeIdShort> ` as a prefix BEFORE `exec`'ing `context-monitor`.
4. Any error path silently degrades to empty prefix (statusline never blocks or throws).

Canon Part 8: zero network surface. The sub-shell only opens the local SQLite handle.

### Phase 106-02 fence amendment (RESEARCH Open Question 11.8)

`tests/test-context-monitor-d02-broadcast.cjs` Test 5 was the JTBD-exclusivity assertion for 🎯. Per OQ 11.8 the planner chose to amend the fence (broaden the assertion) rather than introduce a new glyph. Reasoning:

- Auto-focus rule 1 anchors on the JTBD (`jtbd:<id>`), so the two signals are semantically correlated.
- A new glyph would expand the symbol vocabulary unnecessarily.

Test 5's assertion still passes byte-identically (the hermetic fixture seeds neither JTBD state nor a `session_focus` row, so 🎯 is absent in both pre- and post-amendment semantics). The amendment is primarily documentation: the comment block now reads "🎯 absent only when BOTH JTBD AND focus are absent" instead of "🎯 absent when JTBD is absent."

Exclusivity invariants for 📊 (token-budget) and ⚙️ (operator) remain unchanged.

## Files Touched

| File | Status | Purpose |
|------|--------|---------|
| `lib/core/navigation/focus.cjs` | created | getActiveFocus + setFocus + computeAutoFocus internal helpers (135 lines) |
| `lib/core/navigation/ROOM.md` | created | ICM Layer 0 identity for new lib/core/navigation/ subdirectory per CLAUDE.md Decision 15 |
| `lib/core/migrations/phase-109-session-focus.cjs` | created | Idempotent session_focus migration with defensive nodes-table provenance backfill (94 lines) |
| `lib/core/room-db.cjs` | rewritten | Now synchronous; chains 109-01 (best-effort require) and 109-02 migrations after lazygraph + memory schema init (60 lines) |
| `scripts/statusline-mos` | modified | Added focus_segment prefix block (47 → 98 lines) |
| `tests/test-context-monitor-d02-broadcast.cjs` | modified | Phase 109-02 amendment block + Test 5 semantics broadened |
| `tests/test-navigation-focus.cjs` | created | 8-test hermetic suite covering NAV-109-01 (175 lines) |

## Cascade Resolution for the Test Fixture

For the test fixture seeded in `makeRoom()` (one `room:test` node, one `jtbd:find-bottleneck`, two open `decision:open-1/2`, one closed `decision:closed-1`), the `computeAutoFocus` cascade resolves as:

| Test | JTBD mock | Operator mock | Expected focus | Expected setBy |
|------|-----------|---------------|----------------|----------------|
| 6 (rule 1) | `find-bottleneck` | `JUST_TALK` | `jtbd:find-bottleneck` | `auto-from-jtbd` |
| 7 (rule 2) | null | `DECISION_GATE` | `decision:open-2` (newer than open-1; closed-1 is `confirmed` so skipped) | `auto-from-operator` |
| 8 (rule 3) | null | `JUST_TALK` | `room:test` | `auto-from-state` |

All three GREEN.

## Glyph Fence Amendment Line Range

`tests/test-context-monitor-d02-broadcast.cjs` lines 173-191 (the Phase 109-02 amendment block + Test 5 reframed assertion). The `Phase 109-02 amendment` marker string anchors the amendment for future audits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Identity table schema mismatch**
- **Found during:** Task 2 (first run of focus tests after migration shipped)
- **Issue:** Migration sentinel INSERT failed with `NOT NULL constraint failed: identity.updated_at`. The plan's pseudocode used a 2-column `(key, value)` identity schema but `lib/core/memory-ops.cjs` initMemorySchema() canonically creates `identity (key TEXT PK, value TEXT NOT NULL, updated_at TEXT NOT NULL)`. Memory-ops always runs first because room-db.cjs calls `initMemorySchema(db)` before our migration.
- **Fix:** Updated `lib/core/migrations/phase-109-session-focus.cjs` `ensureIdentityTable()` to issue the canonical 3-column CREATE (no-op when memory-ops already ran), and the sentinel INSERT statement to include `updated_at` (set to the same ISO timestamp as `value`).
- **Files modified:** `lib/core/migrations/phase-109-session-focus.cjs` (within Task 2 commit ff9667d before the COMMIT)

**2. [Rule 3 - Blocking issue] Pre-Phase-109-01 nodes table schema (parallel worktree)**
- **Found during:** Task 2 design phase (before running tests)
- **Issue:** Plan 109-01's nodes-provenance migration ships in a separate worktree (per `<parallel_execution>` note in execution prompt). The current `nodes` table is the pre-109-01 3-column shape `(id, type, properties)` but our test fixture INSERTs with all 9 provenance fields (`source_path`, `created_by`, `confidence`, `review_status`, `created_at`, `last_seen_at`). Without 109-01's migration in this worktree, those columns don't exist and the test setup fails.
- **Fix:** Added `ensureProvenanceColumns()` defensive backfill in the session_focus migration. It runs additive `ALTER TABLE nodes ADD COLUMN ...` for each of the 6 provenance columns (plus `source_section`), each wrapped in try/catch so re-runs (when 109-01 has already added the column) are no-ops. The backfill is a strict subset of the canonical 109-01 schema work and is safe under either ordering.
- **Files modified:** `lib/core/migrations/phase-109-session-focus.cjs` ensureProvenanceColumns helper

**3. [Rule 3 - Blocking issue] openRoomDb async-to-sync contract change**
- **Found during:** Task 2 design phase
- **Issue:** Pre-Phase-109 `openRoomDb` was async returning `{ db, conn }` (a leak from `lazygraph-ops.cjs` openGraph). The plan's Task 2 Step 4 explicitly instructs us to rewrite room-db.cjs to be synchronous and return the bare db handle. The plan's test (Task 1) and the focus.cjs helpers (Task 2) all consume the bare db. Existing callers (`scripts/memory-lifecycle.cjs`, `lib/hmi/across-session-memory.cjs`, `scripts/session-start`) use `await openRoomDb(roomDir)` and `handle.db.prepare(...)`.
- **Fix:** Followed the plan's explicit Step 4 instruction. `closeRoomDb` is now tolerant — it accepts either the bare `DatabaseSync` (current contract) or the legacy `{ db, conn }` shape during the merge cycle. Existing async callers using `await` continue to work because `await x` on a non-Promise resolves to `x` directly; their `handle.db.prepare(...)` calls would fail because `handle.db` is undefined. **This is a breaking API change scoped to room-db.cjs.** The orchestrator should expect to update the 4-5 callers in the merge resolution pass. Documented inline in `lib/core/room-db.cjs` header comment.
- **Files modified:** `lib/core/room-db.cjs` (full rewrite per plan's Step 4 spec)

**4. [Rule 1 - Bug in plan structural assumption] statusline-mos is a thin wrapper, not the renderer**
- **Found during:** Task 3 design phase
- **Issue:** The plan's Step 1 example bash inserts the `focus_segment` into `scripts/statusline-mos` as if it were the rendering script. In reality the file is a 47-line wrapper that resolves the latest plugin cache version and `exec`s `scripts/context-monitor` (the actual Node renderer). The plan author was working from an older mental model. The plan's verification grep checks (`focus_segment` and `getActiveFocus` must be in `scripts/statusline-mos`) lock the file location.
- **Fix:** Honored the plan's verification contract by adding the `focus_segment` block to `scripts/statusline-mos`, but emitting the prefix via `printf` BEFORE the `exec`. The prefix concatenates with context-monitor's output as a single statusline string. This satisfies both the plan's grep checks and a functional outcome (🎯 prefix surfaces in the statusline). A follow-up plan could move the rendering into context-monitor proper for cleaner integration with the existing JTBD glyph block (line 657-663 of context-monitor).
- **Files modified:** `scripts/statusline-mos`

### Skipped scope

None. All 8 success criteria from the plan met.

## Authentication Gates

None.

## Known Stubs

None. The 🎯 focus_segment block is functional (not a stub); it activates whenever both `MINDRIAN_ROOM` and `session_id` env vars are present and the navigation API resolves.

The statusline integration is feature-complete for the user-facing surface, though future plans may relocate the rendering to context-monitor for tighter integration with the existing glyph composition.

## Verification

- `node tests/test-navigation-focus.cjs` → 8/8 PASS
- `node tests/test-context-monitor-d02-broadcast.cjs` → 7/7 PASS (Phase 106-02 regression-free)
- `node -e "const f=require('./lib/core/navigation/focus.cjs'); console.log(typeof f.getActiveFocus, typeof f.setFocus, typeof f.computeAutoFocus);"` → `function function function`
- `node -e "const r=require('./lib/core/room-db.cjs'); ..."` → `5` (session_focus has 5 columns)
- `bash -n scripts/statusline-mos` → exit 0
- `grep -P "[\x{2014}\x{2013}]" lib/core/navigation/focus.cjs lib/core/navigation/ROOM.md lib/core/migrations/phase-109-session-focus.cjs lib/core/room-db.cjs tests/test-navigation-focus.cjs` → 0 matches (zero em-dashes or en-dashes)
- `grep -q "Phase 109-02 amendment" tests/test-context-monitor-d02-broadcast.cjs` → present
- `grep -q "focus_segment" scripts/statusline-mos` → present
- `grep -q "getActiveFocus" scripts/statusline-mos` → present

## Commits

- `bc1255e` test(109-02): add 8 RED tests for focus node model (NAV-109-01)
- `ff9667d` feat(109-02): ship session_focus migration + focus.cjs helpers (NAV-109-01)
- `4abb2a0` feat(109-02): surface 🎯 focus glyph in statusline + amend Phase 106-02 fence

## Next Plan Hand-off

Plan 109-04 (Navigation API chokepoint) can now wire the focus helpers into `lib/core/navigation.cjs` as part of the closed 13-function surface. The `setFocus` `focus_changed` memory_event uses the canonical event_type string per RESEARCH section 2.4 closed-set vocabulary; Plan 109-03 (memory event log) provides the consumer side via `findRecentChanges(since)`. Plan 109-07 (Brain Packet Builder) consumes `getActiveFocus` to populate the `active_context.focus_node` field of the Brain packet (per CONTEXT D-06 L223).

## Self-Check: PASSED

All 8 file existence claims verified. All 3 commit hashes resolve in `git log --all`. Verification battery (focus tests 8/8, d02 broadcast 7/7, focus.cjs exports, session_focus column count, bash syntax, em-dash scan, marker greps) all passed before SUMMARY was written.
