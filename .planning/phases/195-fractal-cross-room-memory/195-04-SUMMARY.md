---
phase: 195-fractal-cross-room-memory
plan: 04
subsystem: navigation
tags: [umbilical, cross-room, edge-type, registry-store, part8, orphan-reap, node-sqlite, fcm-11]

# Dependency graph
requires:
  - phase: 195-01
    provides: the Wave-0 UMBILICAL_TO edge FLOOR stub (membership, never .size) that this plan flips GREEN
provides:
  - UMBILICAL_TO minted additively in ALLOWED_EDGE_TYPES (peer cross-room edge, beside vertical NESTED_WITHIN)
  - lib/core/cross-room-store.cjs - the registry-level .rooms/cross-room.db single write chokepoint for UMBILICAL_TO edges
  - Part-8 enum/scalar-only property fence {relevance, signal, linked_at, session_id} enforced at the registry boundary
  - room-deletion reconcile - cascade purge (layer 1) + periodic orphan reap of unregistered slugs (layer 2)
affects: [195-05, cross-room-cord, f8-umbilical-fanout, room-discard, self-heal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "registry-level single-write-chokepoint mirroring navigation.cjs writeEdge discipline ({ok} return, never throws, edge_type membership gate) at .rooms/ scope"
    - "Part-8 cross-room fence enforced by an enum/scalar property allow-list + length cap (prose can never ride an allowed field)"
    - "open/close-per-call node:sqlite DatabaseSync store (cloned session-presence per-call opener) with graceful sqlite-absent degradation"
    - "two-layer orphan reconcile: cascade-driven purgeRoomEdges + periodic reapOrphanEdges cloning session-presence reapStalePresence, fail-safe on unreadable registry"

key-files:
  created:
    - lib/core/cross-room-store.cjs
  modified:
    - lib/core/navigation/edges.cjs
    - lib/core/room-discard-cascade.cjs
    - tests/test-195-umbilical-edge-floor.cjs
    - tests/run-all-195.sh

key-decisions:
  - "Chose Option A (node:sqlite cross-room.db) over Option B (JSON edge log) per D-03 navigator discretion - SQL gives trivial bidirectional traversal + atomic DELETE for purge/reap"
  - "Enforce the Part-8 fence by an UNKNOWN-KEY rejection plus a 64-char scalar-string cap, so prose is rejected whether smuggled as a new key or stuffed into signal/session_id"
  - "reapOrphanEdges fails SAFE: an unreadable/absent registry reaps nothing (never mistakes unreadable for empty and purges everything)"

patterns-established:
  - "Registry-level typed-edge store as the sibling analog to a room-local room.db edge: peer edges belong to neither room, so they live at .rooms/ single source of truth"
  - "Cascade step 6b (cross-room purge) slots between registry-key removal and fs.rmSync in the ordered teardown"

requirements-completed: [FCM-11]

# Metrics
duration: 7min
completed: 2026-07-01
---

# Phase 195 Plan 04: Umbilical Edge + Registry Cross-Room Store Summary

**UMBILICAL_TO minted additively as the horizontal peer cross-room edge, plus a registry-level `.rooms/cross-room.db` single-write-chokepoint store with a Part-8 enum/scalar fence and two-layer room-deletion reconcile (cascade purge + periodic orphan reap).**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-01T14:07:13Z
- **Completed:** 2026-07-01T14:14:00Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified) + 1 test-runner

## Accomplishments
- Minted `UMBILICAL_TO` into the frozen `ALLOWED_EDGE_TYPES` set ADDITIVELY, beside the vertical `NESTED_WITHIN` lineage edge and without clobbering the concurrent Phase-205 `SHARES_JOB`/`ELEVATES_TO` additions. Encoded the axis contrast (vertical parent-child lineage vs horizontal peer link) in the comment block.
- Built `lib/core/cross-room-store.cjs`: the registry-level single write chokepoint mirroring `navigation.cjs::writeEdge` at `.rooms/` scope. Edges round-trip bidirectionally (queryable from either room end) via a `node:sqlite` `cross-room.db`.
- Enforced the Canon Part-8 cross-room fence: only enum/scalar props `{relevance, signal, linked_at, session_id}` are accepted; unknown keys, non-scalars, and over-long strings are rejected WITHOUT throwing (no prose crosses the boundary).
- Reconciled against room deletion in two layers: the discard cascade now purges every UMBILICAL_TO edge touching the discarded slug (step 6b), and a periodic `reapOrphanEdges` sweeps edges pointing at slugs no longer in `.rooms/registry.json` (defense-in-depth for out-of-band deletions).
- Flipped the Wave-0 FLOOR stub GREEN (SKIP -> hard membership assertion) and its run-all-195.sh leg from `run_if` to `run`. Suite: 10 passed, 0 failed, 3 skipped (unbuilt Wave-3 consumer plans).

## Task Commits

Each task was committed atomically:

1. **Task 1: Mint UMBILICAL_TO in ALLOWED_EDGE_TYPES + extend the edge FLOOR** - `a1ac61d7` (feat)
2. **Task 2: Registry-level cross-room store, single write chokepoint** - `781901b9` (feat)
3. **Task 3: Room-deletion reconcile - purge + periodic reap** - `a4eba0cf` (feat)

**Plan metadata:** (final docs commit below)

## Files Created/Modified
- `lib/core/cross-room-store.cjs` (created) - Registry-level `.rooms/cross-room.db` store: `writeUmbilicalEdge` (single chokepoint), `edgesForRoom` (bidirectional read), `purgeRoomEdges` (cascade layer 1), `reapOrphanEdges` (periodic layer 2), plus the Part-8 property validator.
- `lib/core/navigation/edges.cjs` (modified) - Added `'UMBILICAL_TO'` to `ALLOWED_EDGE_TYPES` additively with the axis-contrast comment block.
- `lib/core/room-discard-cascade.cjs` (modified) - Added step 6b: purge cross-room edges touching the discarded slug, between registry-key removal and `fs.rmSync`.
- `tests/test-195-umbilical-edge-floor.cjs` (modified) - Flipped to a hard UMBILICAL_TO membership assertion; added store round-trip, rejection, purge, reap, and cascade-integration blocks (23 assertions).
- `tests/run-all-195.sh` (modified) - Flipped the FCM-11 leg from `run_if` to `run`.

## Decisions Made
- **Option A (SQLite) over Option B (JSON log)** for the store: D-03 leaves this to navigator discretion; SQL gives trivial bidirectional traversal and atomic `DELETE ... WHERE source_room=? OR target_room=?` for both purge and reap.
- **Part-8 fence = allow-list + length cap:** rejecting unknown keys blocks prose smuggled as a new field; the 64-char scalar cap blocks prose stuffed into an allowed string field like `signal`.
- **Reap fails safe:** an absent/unreadable registry reaps nothing, so a transient read error can never mistake "unreadable" for "no rooms registered" and wipe the store.

## Deviations from Plan

None - plan executed exactly as written. UMBILICAL_TO was appended additively; the Phase-205 `SHARES_JOB`/`ELEVATES_TO` entries were re-read immediately before editing and remain intact (grep count unchanged). No other 205 files were touched.

## Issues Encountered
- The Wave-0 test initially used a placeholder slug (`room-...`) that did not match `PLACEHOLDER_SLUG_RE` (`/^untitled-\d{4}-\d{2}-\d{2}-\d{4}.../`); corrected the cascade-integration fixture to `untitled-1999-01-01-0000` before the cascade leg was authored, so no failing commit landed.

## User Setup Required
None - no external service configuration required. The store uses the built-in `node:sqlite` runtime (degrades gracefully when absent).

## Next Phase Readiness
- SEED-044 substrate is ready: `UMBILICAL_TO` exists and the registry store round-trips edges, so Plan 05 (the F.8 cross-room cord fan-out + resume triggers) can consume the type and the `writeUmbilicalEdge` chokepoint directly.
- Cross-room fence (Part 8) and orphan-reap (D-03) are both proven by the floor test, so consumers can write edges without re-implementing the boundary or the deletion reconcile.
- No blockers.

## Self-Check: PASSED

- Files: all 6 deliverables present on disk (1 created, 3 modified, 1 test-runner, 1 SUMMARY).
- Commits: a1ac61d7, 781901b9, a4eba0cf all in git history.
- 205 non-clobber: `SHARES_JOB` + `ELEVATES_TO` still present in `edges.cjs`.
- Suite: `bash tests/run-all-195.sh` -> 10 passed, 0 failed, 3 skipped (unbuilt Wave-3 consumers); canon 7-kind floor green; no canon byte touched.

---
*Phase: 195-fractal-cross-room-memory*
*Completed: 2026-07-01*
