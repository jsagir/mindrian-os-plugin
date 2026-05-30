---
phase: 129-spine-repair-memory-event
plan: 02
subsystem: spine
tags: [memory-event, spine-read, suggestion-surfaced, navigation-chokepoint, substrate-guard, canon-part-9]

# Dependency graph
requires:
  - phase: 129-01
    provides: spine-events.cjs log* helpers + getCurrentJTBD/getCurrentOperator + 60s logEvent dedup + navigation.cjs re-exports
  - phase: 128-substrate-contract-adr
    provides: live net-new-aware check-substrate.cjs guard that rejects net-new direct room.db access in non-allowlisted scripts
provides:
  - "/mos:status journals a spine_read memory_event (surface=status) carrying section + JTBD + operator snapshot, post-stdout, deduped on no-op repeat"
  - "/mos:memory journals a spine_read memory_event (surface=memory, layer=subcommand) on every rendered subcommand except --opt-out"
  - "/mos:suggest-next journals a suggestion_surfaced memory_event with the surfaced commands + their numeric confidence scores + top_score"
  - "3 read-surface scripts route ALL room.db access through navigation.cjs (zero direct access; substrate guard clean)"
affects: [129-03, 129-04, 116-unresolved-tension-hook, 117-auto-explore-domains, 121-trajectory-telemetry, 130-lens-engine-skeleton]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Best-effort post-stdout telemetry: emission runs AFTER the user-visible frame is written, wrapped in try/catch, degrades to no-op on any navigation load failure or absent room.db"
    - "Lazy-require navigation.cjs with a graceful try/catch (mirrors the existing statuslineCache/folderMemory and shape-G/shape-F6 lazy-loader idioms) so a non-allowlisted spine script reaches room.db ONLY through the chokepoint"
    - "Event payload carries scalars + enums + command names + numeric scores only (Canon Part 8); never MINTO bodies or artifact text"

key-files:
  created:
    - tests/test-129-read-surface-events.cjs
  modified:
    - scripts/mos-status.cjs
    - scripts/memory-command.cjs
    - scripts/suggest-next-command.cjs

key-decisions:
  - "Read-surface scripts emit AFTER stdout so the journal write never delays the user-visible render (threat T-129-02-03 Availability: accept->mitigate)"
  - "suggestion_surfaced commands are sourced from the SAME ranked items[] the F.1 renderer reads (numeric .score), never fabricated; fall back to the resolver-composed workflow commands (score 0) when the ranker returns nothing so the event still reflects the printed surface"
  - "/mos:memory --opt-out emits NOTHING (the user opted out of memory; emitting would contradict that); the existing --opt-out short-circuit before the switch keeps the emit call out of that path"
  - "All room.db access routes through navigation.logSpineRead / logSuggestionSurfaced (roomDir-only, never a db handle) per the Phase 128 substrate contract; these 3 scripts are NOT allow-listed"

patterns-established:
  - "emitSpineRead / emitMemorySpineRead / emitSuggestionSurfaced: thin per-script wrappers that resolve the active room dir, snapshot the scalar payload, and call the Plan 01 helper inside try/catch; exported for in-process tests"

requirements-completed: [SPINE-EVENTS, STATE-AUTHORITY]

# Metrics
duration: ~25min
completed: 2026-05-30
---

# Phase 129 Plan 02: Read-Surface Spine Event Emission Summary

**The three READ-surface spine scripts now journal to the canonical event log on every render: /mos:status and /mos:memory emit spine_read (surface=status / surface=memory+layer), /mos:suggest-next emits suggestion_surfaced with the surfaced commands + their confidence scores -- all post-stdout, all routed through navigation.cjs with zero direct room.db access.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-05-30
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- /mos:status emits exactly one spine_read per render (surface=status) carrying section + a JTBD + operator snapshot via navigation.getCurrentJTBD / getCurrentOperator; two no-op renders in a row dedupe to one event per the Plan 01 60s TTL.
- /mos:memory emits spine_read (surface=memory, layer=<subcommand>) after each rendered subcommand; --opt-out emits nothing (it short-circuits before the switch).
- /mos:suggest-next emits suggestion_surfaced whose properties.commands is an array of { command, score } sourced from the SAME ranked items[] the F.1 renderer reads, with properties.top_score = the max score.
- All 3 scripts reach room.db ONLY through navigation.cjs (logSpineRead / logSuggestionSurfaced, roomDir-only). The live substrate guard scanFiles returns [] for all three; both feat commits passed the live pre-commit hook (no --no-verify).
- Emission is best-effort: it runs AFTER stdout, wrapped in try/catch, and degrades to a no-op on a navigation load failure or an absent room.db (the render still prints).
- Zero new dependencies (node built-ins + existing requires only). No em-dashes in any authored line.

## Task Commits

1. **RED test suite** - `dc280f30` (test) -- 7-test read-surface behavior suite, committed failing
2. **Task 1: spine_read from /mos:status + /mos:memory** - `c23300c6` (feat) -- emitSpineRead + emitMemorySpineRead
3. **Task 2: suggestion_surfaced from /mos:suggest-next** - `286b53a4` (feat) -- buildSuggestionCommands + emitSuggestionSurfaced

_TDD note: the 7-test suite was committed RED first (dc280f30; emitSpineRead not yet defined), then Task 1 turned the status/memory tests GREEN and Task 2 turned the suggest test GREEN. Both feat commits passed the live pre-commit substrate guard._

## Files Created/Modified

- `tests/test-129-read-surface-events.cjs` (created) - 7 hermetic behavior tests: status emits one spine_read with the surface enum + snapshot; dedupe on repeat; graceful no_room_db; memory overview emits surface=memory+layer; --opt-out emits nothing; suggest emits suggestion_surfaced with commands+scores+top_score; substrate guard clean across all 3 scripts.
- `scripts/mos-status.cjs` (modified) - lazy-require navigation.cjs (graceful); emitSpineRead helper (snapshots JTBD + operator, calls navigation.logSpineRead); called at end of main() AFTER stdout with resolveRoomRoot + detectActiveRoom fallback; exported for tests.
- `scripts/memory-command.cjs` (modified) - tryLoadNavigation lazy-loader (mirrors tryLoadShapeG/F6); emitMemorySpineRead (resolves room dir via the registry, calls navigation.logSpineRead surface=memory+layer); called after the dispatch switch (the --opt-out short-circuit keeps it off that path).
- `scripts/suggest-next-command.cjs` (modified) - tryLoadNavigation lazy-loader; buildSuggestionCommands (ranked items[] .score, workflow fallback); emitSuggestionSurfaced (resolveRoomDir or detectActiveRoom fallback); called at end of main() AFTER stdout; helpers exported for tests.

## Decisions Made

- Post-stdout emission everywhere: the journal write is additive and never delays or risks the already-written render (mitigates threat T-129-02-03).
- suggestion_surfaced commands come from the resolver/ranker output (never fabricated), honoring the existing Larry-never-names-a-command-from-memory invariant; scores are the ranker's numeric .score.
- --opt-out is the one /mos:memory subcommand that emits nothing, since emitting would contradict the user opting out of memory.

## Deviations from Plan

None - plan executed exactly as written. Both tasks implemented their `<action>` verbatim; all `<behavior>` assertions are covered by the committed test.

## Threat Surface Scan

No net-new security surface. The 3 scripts add zero network endpoints, zero auth paths, zero new file-access patterns, and zero schema changes. All room.db access routes through the existing navigation.cjs chokepoint; payloads carry only scalars + enums + command names + numeric scores per the plan's threat register (T-129-02-01 / T-129-02-02 mitigated; T-129-02-03 mitigated by post-stdout try/catch).

## Issues Encountered

None. The substrate guard, the 129-01 regression suite (15/15), and the new read-surface suite (7/7) all green; live /mos:status and /mos:suggest-next renders work against this repo's own room/.

## User Setup Required

None - no external service configuration. Zero new dependencies.

## Next Phase Readiness

- Wave 2 read surfaces are complete. 129-03 / 129-04 can refactor the remaining WRITE/dispatch spine scripts (act-command, pipeline-command, jtbd-command, operator-command) onto the same Plan 01 helpers (logWorkflowStage / logJtbdTransition / logOperatorTransition) using the identical post-side-effect, navigation-routed, best-effort pattern established here.
- Phase 116 / 117 / 121 consumers now see /mos:status, /mos:memory, and /mos:suggest-next in the canonical memory_event tail.

## Self-Check: PASSED

- FOUND: tests/test-129-read-surface-events.cjs
- FOUND: scripts/mos-status.cjs (emitSpineRead)
- FOUND: scripts/memory-command.cjs (emitMemorySpineRead)
- FOUND: scripts/suggest-next-command.cjs (emitSuggestionSurfaced)
- FOUND commit: dc280f30 (test RED)
- FOUND commit: c23300c6 (feat Task 1)
- FOUND commit: 286b53a4 (feat Task 2)

---
*Phase: 129-spine-repair-memory-event*
*Completed: 2026-05-30*
