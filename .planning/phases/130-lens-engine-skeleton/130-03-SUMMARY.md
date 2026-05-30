---
phase: 130-lens-engine-skeleton
plan: 03
subsystem: core-library
tags: [hat-persistence, room-db, lens-engine, cognitive-lens, tension-map, migration, backfill, canon-part-9, canon-part-7, substrate-clean]

# Dependency graph
requires:
  - phase: 130-01
    provides: "lens-nodes.cjs writeHatState / readHatState / readAllHatStates (db-handle chokepoint) + INFORMS / REJECTED_BECAUSE edges"
  - phase: 130-02
    provides: "lens-engine.cjs rotate() (serial/parallel/single) + the ONE synthesizers/tension-map.cjs"
  - phase: 109-sql-context-memory-navigation-spine
    provides: "navigation.cjs chokepoint + room-db.cjs openRoomDb/closeRoomDb + findRecentChanges + logMemoryEvent"
  - phase: 128-substrate-contract-adr
    provides: "the live substrate guard (check-substrate.cjs) + the migrate- allow-list prefix"
provides:
  - "hat-persistence.cjs rewritten: HatState read/write via navigation.cjs (filesystem .mindrian/hats/{color}/STATE.md writes RETIRED)"
  - "lens-nodes.cjs roomDir-taking wrappers (writeHatStateByRoomDir / readHatStateByRoomDir / readAllHatStatesByRoomDir) + navigation.cjs re-exports"
  - "scripts/migrate-hats-to-roomdb.cjs: idempotent one-shot backfill of legacy STATE.md into HatState nodes (markdown left as read-only archive)"
  - "4 cognitive-family commands as thin lens-engine clients (think-hats / persona / hat-briefing / challenge-assumptions)"
  - "persona-ops.cjs analyzeAllPerspectives delegating to lens-engine.rotate; inline tension prose replaced by synthesizeTensionMap (4 duplicates collapsed)"
affects: [130-04, 116 tension-resolution, 131 research-as-graph, v1.14.0 lens-family migrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-allow-listed module (hat-persistence.cjs) routes ALL room.db access through navigation.cjs roomDir-taking wrappers; never requires room-db.cjs or node:sqlite"
    - "roomDir-taking navigation wrappers (lens-nodes.cjs) open/close room.db internally like spine-events.cjs, while the db-handle writers stay for the engine's batched writes"
    - "Thin command client: rotation mechanics declared in frontmatter (lens_type / lens_set / rotation_mode / synthesizer / persistence); engine owns the loop"
    - "One-shot idempotent backfill with a state_alias_migration memory_event sentinel; legacy markdown left as read-only archive"

key-files:
  created:
    - scripts/migrate-hats-to-roomdb.cjs
    - tests/test-130-cognitive-migration.cjs
  modified:
    - lib/core/hat-persistence.cjs
    - lib/core/navigation/lens-nodes.cjs
    - lib/core/navigation.cjs
    - lib/core/persona-ops.cjs
    - lib/mcp/tool-router.cjs
    - bin/mindrian-tools.cjs
    - commands/think-hats.md
    - commands/persona.md
    - commands/hat-briefing.md
    - commands/challenge-assumptions.md
    - tests/run-all-130.sh

key-decisions:
  - "hat-persistence.cjs (NOT allow-listed) routes through new lens-nodes.cjs roomDir-taking wrappers re-exported from navigation.cjs, rather than requiring room-db.cjs directly -- keeps the rewrite substrate-clean"
  - "Only STATE.md becomes a HatState node; the session-log daily markdown stays as a read-only archive (130-CONTEXT pre-resolved decision); getRecentLogs still reads the archive"
  - "analyzeAllPerspectives becomes async (delegates to lens-engine.rotate); the 2 callers (bin/mindrian-tools.cjs, lib/mcp/tool-router.cjs) await it"
  - "The buildPersonaContent inline disagreement prose is the tension-map duplicate that gets collapsed into synthesizeTensionMap"
  - "Backfill idempotency via a state_alias_migration memory_event sentinel (migration tag hats_to_roomdb), not the 60s dedupe TTL"

requirements-completed: [HATS-STATE-MIGRATION, HATS-BACKFILL, COGNITIVE-CLIENTS-4, DEDUP-TENSION-MAP, RETIRE-FS-HATS]

# Metrics
duration: 18min
completed: 2026-05-31
---

# Phase 130 Plan 03: Cognitive-Family Migration Summary

**hat-persistence.cjs RETIRES its filesystem STATE.md writes onto room.db HatState nodes via navigation.cjs, a one-shot backfill migrates legacy markdown into nodes, the 4 cognitive commands become thin lens-engine clients, and the duplicated tension-map collapses into the single synthesizer with persona-ops delegating its rotation loop to the engine.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-31
- **Completed:** 2026-05-31
- **Tasks:** 3
- **Files modified:** 13 (2 created, 11 modified)

## Accomplishments

- Rewrote `lib/core/hat-persistence.cjs` so the 6 STATE.md filesystem reads/writes become typed HatState node reads/writes through navigation.cjs. The 7 export signatures (HAT_COLORS, HAT_LABELS, loadHatState, saveHatState, logSession, loadAllHatStates, getRecentLogs) are preserved verbatim so existing callers (persona-ops.cjs, hat-briefing.md Step 1 node -e block) keep working. The module is NOT allow-listed, so it never requires room-db.cjs and never requires node:sqlite; it requires navigation.cjs and routes every room.db touch through the roomDir-taking wrappers. The `.mindrian/hats/{color}/STATE.md` filesystem writes are RETIRED (grep proves zero `fs.writeFileSync` against a STATE.md path), paying down the baselined Canon Part 9 filesystem-state violation the Cluster 2 audit flagged. The session-log daily markdown stays as a read-only archive (getRecentLogs reads it; logSession still appends to it), per the 130-CONTEXT pre-resolved decision that only STATE.md becomes a node this phase.
- Added 3 roomDir-taking sibling wrappers to `lib/core/navigation/lens-nodes.cjs` (writeHatStateByRoomDir / readHatStateByRoomDir / readAllHatStatesByRoomDir). Each opens room.db internally via room-db.cjs (legal because navigation/ is allow-listed), routes through the existing db-handle chokepoint, and always closes the handle in finally -- mirroring spine-events.cjs exactly. They are re-exported through navigation.cjs with a per-export justification block. This is the door the non-allow-listed hat-persistence.cjs uses; the existing db-handle writers stay for the engine's batched node+edge writes.
- Shipped `scripts/migrate-hats-to-roomdb.cjs` exporting migrateHatsToRoomDb(roomDir): a one-shot idempotent backfill that scans existing `.mindrian/hats/*/STATE.md` files, parses each via the legacy parseHatState shape, writes each to a HatState node via navigation.writeHatStateByRoomDir, and stamps a `state_alias_migration` memory_event sentinel (migration tag hats_to_roomdb) so a second run is a no-op. The legacy markdown files are LEFT IN PLACE as a read-only archive (never deleted). The script is allow-listed (scripts/migrate- prefix) so it may open room.db; it does so only for the sentinel read/write and routes the node writes through navigation.
- Migrated the 4 cognitive-family commands to thin lens-engine clients, preserving their Phase 122 workflow-layer frontmatter (kind / frameworks / produces / inputs / autonomous_safe / allowed-tools):
  - `think-hats.md`: lens_type cognitive, lens_set six-hats, rotation_mode serial, synthesizer tension-map.
  - `persona.md`: lens_set six-hats, rotation_mode parallel, persistence memory_event; the Step 5 tension-map prose now points at the synthesizer.
  - `hat-briefing.md`: a READER (rotation_mode consume) over the prior lens memory_event tail + HatState nodes, not a rotator.
  - `challenge-assumptions.md`: lens_set ['black-hat'], rotation_mode single, synthesizer tension-map.
  Each command body now points the executor at the lens-engine for the rotation mechanics (loop, synthesizers, memory_event emission) while keeping the Larry voice and framework-reference reads.
- Delegated `persona-ops.cjs analyzeAllPerspectives` to the single lens-engine for-loop: the manual HAT_COLORS rotation is retired; the engine runs serial mode over the cognitive six-hats set with a per-lens function that does the persona invoke + HatState snapshot. The function is now async; its 2 callers (bin/mindrian-tools.cjs persona analyze, lib/mcp/tool-router.cjs room_content analyze) were updated to await it. A defensive fallback keeps all 6 perspectives present even if the engine path fails.
- Collapsed the duplicated tension-map: the buildPersonaContent inline "vs tension_hat" disagreement prose is replaced by a new buildDisagreements helper that constructs two typed lens-finding-shaped node objects and runs them through the ONE synthesizeTensionMap (lib/core/synthesizers/tension-map.cjs). A repo grep confirms no second tension-computation block remains.

## Task Commits

1. **Task 1: rewrite hat-persistence to room.db + one-shot backfill** - `0dfd0cc2` (feat) - hat-persistence.cjs rewrite, lens-nodes.cjs roomDir wrappers, navigation.cjs re-exports, migrate-hats-to-roomdb.cjs, RED test suite (Task 2 portions failing, Task 1 portions green)
2. **Task 2: 4 thin command clients + persona-ops loop delegation + tension-map dedup** - `1e651f82` (feat) - the 4 command frontmatter migrations, persona-ops delegation + buildDisagreements, the 2 awaited callers
3. **Task 3: register suite + zero-regression gate** - `9d277e16` (test) - run-all-130.sh registers test-130-cognitive-migration.cjs

## Files Created/Modified

- `lib/core/hat-persistence.cjs` - rewritten to room.db HatState via navigation.cjs; filesystem STATE.md writes RETIRED; 7 signatures preserved; session-log archive kept read-only
- `lib/core/navigation/lens-nodes.cjs` - 3 roomDir-taking wrappers added (open/close room.db internally like spine-events)
- `lib/core/navigation.cjs` - re-exports the 3 roomDir wrappers with a Phase 130-03 justification block
- `scripts/migrate-hats-to-roomdb.cjs` - idempotent one-shot backfill with a memory_event sentinel; markdown left as archive
- `lib/core/persona-ops.cjs` - analyzeAllPerspectives delegates to lens-engine.rotate (now async); buildDisagreements uses synthesizeTensionMap
- `lib/mcp/tool-router.cjs`, `bin/mindrian-tools.cjs` - await the now-async analyzeAllPerspectives
- `commands/think-hats.md`, `commands/persona.md`, `commands/hat-briefing.md`, `commands/challenge-assumptions.md` - thin lens-engine client frontmatter, Phase 122 frontmatter preserved
- `tests/test-130-cognitive-migration.cjs` - 19 behavior tests (hat-persistence source invariants + round-trip + backfill idempotency + the 4 command frontmatter + persona-ops delegation + tension-map dedup)
- `tests/run-all-130.sh` - registers the migration suite

## Decisions Made

- hat-persistence.cjs (not allow-listed) routes through new lens-nodes.cjs roomDir-taking wrappers re-exported from navigation.cjs, rather than requiring room-db.cjs directly. This keeps the rewrite substrate-clean (the live guard scanFiles returns zero violations) while honoring the contract that only allow-listed navigation submodules may open room.db.
- Only STATE.md becomes a HatState node; the session-log daily markdown stays as a read-only archive (130-CONTEXT pre-resolved decision). getRecentLogs still reads the filesystem archive.
- analyzeAllPerspectives is now async because it delegates to lens-engine.rotate; both callers (bin + MCP tool-router) were updated to await it. The MCP handler was already async; the bin dispatch runs inside async main().
- Backfill idempotency uses a state_alias_migration memory_event sentinel (migration tag hats_to_roomdb), not the 60s dedupe TTL, so the no-op guard survives indefinitely.

## Deviations from Plan

None - plan executed exactly as written. The one design choice the plan left to the executor (how the non-allow-listed hat-persistence obtains a db handle "exactly as the spine-events consumers do") was implemented by adding roomDir-taking wrappers to the allow-listed lens-nodes.cjs and re-exporting them through navigation.cjs, which is the spine-events idiom applied to the lens-node chokepoint. This is the intended pattern, not a deviation. hat-persistence carries zero STATE.md fs writes, zero direct room-db/sqlite require; the 7 signatures are preserved; the backfill is idempotent and leaves the markdown intact; the 4 commands are thin clients with Phase 122 frontmatter preserved; persona-ops delegates to lens-engine.rotate; the inline tension-map is collapsed to the single synthesizer; zero em-dashes; every commit passed the live substrate guard with NO --no-verify.

## Issues Encountered

None. The substrate guard returned clean on hat-persistence.cjs + persona-ops.cjs after the rewrite. The m4-cypher false-positive (a MATCH token adjacent to a template placeholder) was avoided by construction; no rewording was needed and no --no-verify was used.

## Known Stubs

None. hat-persistence performs real navigation.cjs HatState round-trips against a real room.db; the backfill performs real node writes and a real idempotency sentinel; persona-ops drives the real lens-engine.rotate loop and the real tension-map synthesizer. The 19-test suite exercises the round-trip, the no-STATE.md-write invariant, the backfill idempotency, the 4 command frontmatter, the loop delegation, and the tension-map dedup against live fixtures.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary surface beyond the plan's threat_model. T-130-03-01 (substrate bypass) mitigated -- the rewrite routes through navigation.cjs and the guard scanFiles is asserted clean. T-130-03-02 (backfill double-run) mitigated -- the memory_event sentinel makes a re-run a no-op and the markdown is left intact. T-130-03-03 (absent room.db) handled -- the migrate script and the roomDir wrappers degrade to a no-op / default-shape when room.db is absent. T-130-03-04 (HatState confirmed without human) accepted per the Canon Part 9 v1.5 system-bookkeeping carve-out inherited from Plan 01. T-130-03-SC mitigated -- zero new dependencies.

## Next Phase Readiness

- The cognitive lens family now runs entirely on the engine + room.db; the latent filesystem-state Canon Part 9 violation is paid down.
- The 4 commands are thin frontmatter clients; the rotation logic is centralized in lens-engine.cjs.
- Plan 04 (and v1.14.0 lens-family migrations) can append their suites to run-all-130.sh and reuse the roomDir-taking wrapper idiom for any non-allow-listed consumer.

## Self-Check: PASSED

---
*Phase: 130-lens-engine-skeleton*
*Completed: 2026-05-31*
