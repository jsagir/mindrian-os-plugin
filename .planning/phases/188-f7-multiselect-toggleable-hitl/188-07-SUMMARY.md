---
phase: 188-f7-multiselect-toggleable-hitl
plan: 07
subsystem: ui
tags: [shape-f, f9, cascade-gate, askuserquestion, hitl, render-coverage, navigation-chokepoint]

# Dependency graph
requires:
  - phase: 188-03
    provides: per-shape render-coverage predicate + SHAPES_UNDER_ASSERTION (F.0-F.7) authored
  - phase: 188-06
    provides: F.8 multiSelect renderer + array capture + fan-out consumer machinery (the clone base)
provides:
  - F.9 ordered Cascade / Reconcile Gate renderer (one question per item, array order IS meaning, paged, no live widget)
  - F.9 position-preserving ordered capture adapter (CLI)
  - F.9 ordered consumer (APPROVE writes edge, REJECT records NOT-applied+reason, DEFER leaves CONTRADICTS pair) via navigation.cjs
  - dispatcher F.9 registration (F_SUBSHAPES + requestedShape === 'F.9' branch)
  - per-shape coverage gate flipped to the full closed ten F.0-F.9 (SFS-10), fully green
affects: [SEED-039 multi-session reconcile, shape-f-selector-family, render-coverage-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordered per-item gate expressed through the paged question card (no bespoke TUI widget; TTY wall Phase 154)"
    - "Closed ordered-outcome vocab {APPROVE,REJECT,DEFER} folded onto the reused OUTCOMES enum via an alias_map (mapOutcome), never a parallel enum"
    - "Consumer resolves an injectable graph writer (test spy) else a navigation.cjs adapter; never opens room.db (Part 9)"

key-files:
  created:
    - lib/hmi/shape-f9-renderer.cjs
    - lib/hmi/f9-ordered-capture-cli.cjs
    - lib/workflow/f9-ordered-consumer.cjs
  modified:
    - lib/hmi/selector-dispatcher.cjs
    - scripts/check-render-coverage.cjs
    - data/render-coverage-registry.json

key-decisions:
  - "Reuse the OUTCOMES enum via a mapOutcome alias (accept==APPROVE); no parallel enum, no normalize layer"
  - "DEFER leaves a CONTRADICTS-linked pair (rejection is data, Decision 13); both claims survive for later reconcile"
  - "SEED-039 version-stamp / multi-session machinery deliberately NOT imported (deferred); F.9 ships the SHAPE only"
  - "Regenerate the derived render-coverage registry via build-render-coverage.cjs rather than hand-edit (sanctioned derived-file path)"

patterns-established:
  - "F.9 = F.5 envelope + F.8 paging + F.3 closed-vocab; the ordered three-way resolve is the only net-new structure"
  - "Position-preserved ordered capture: each element {item_id, outcome, reason?}, array index IS the cascade order"

requirements-completed: [SFS-04, SFS-05, SFS-10]

# Metrics
duration: 20min
completed: 2026-07-01
---

# Phase 188 Plan 07: F.9 Cascade Gate + Coverage Flip Summary

**F.9 ordered per-item APPROVE/REJECT/DEFER cascade gate (paged question card, no live widget) with a navigation.cjs-routed consumer, plus the SFS-10 flip of the per-shape coverage gate to the full closed ten F.0-F.9 - the phase closes fully green.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-01
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified/regenerated)

## Accomplishments
- F.9 renderer emits one question per cascade item in array order (order IS meaning), each carrying the closed {APPROVE, REJECT, DEFER} set; no marker (CONTENT-SET), no Free-Text, paged past the ceiling, no bespoke widget (TTY wall, Phase 154).
- F.9 ordered consumer walks the cascade in order: APPROVE writes the edge, REJECT records NOT-applied + reason (rejection is data, Decision 13), DEFER leaves a CONTRADICTS-linked competing-claim pair. All writes route through navigation.cjs; the consumer never opens room.db (Part 9); degrade-never-block per item.
- Position-preserving CLI capture adapter zips per-item ordered outcomes to their cascade item_id.
- Dispatcher registers F.9 in F_SUBSHAPES and adds the `requestedShape === 'F.9'` branch mirroring F.5.
- SFS-10 flipped: the per-shape coverage gate now asserts the full closed ten F.0-F.9 and is fully green; the per-shape FLOOR hard-fail still exits 1 on a synthetic missing shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: F.9 renderer + dispatcher registration** - `a059ee68` (feat)
2. **Task 2: F.9 ordered capture + consumer** - `f242ee5c` (feat)
3. **Task 3: SFS-10 per-shape coverage gate flip to the full ten** - `06a4927e` (feat)

## Files Created/Modified
- `lib/hmi/shape-f9-renderer.cjs` - F.9 ordered gate renderer; one question per item, closed APPROVE/REJECT/DEFER, mapOutcome alias to reused OUTCOMES, paged, envelope-only (no live widget).
- `lib/hmi/f9-ordered-capture-cli.cjs` - CLI ordered-capture adapter; position preserved, {item_id, outcome, reason?}, sentence on LOCAL lane only.
- `lib/workflow/f9-ordered-consumer.cjs` - ordered consumer; APPROVE/REJECT/DEFER resolve over an injectable graph writer else a navigation.cjs adapter; never opens room.db.
- `lib/hmi/selector-dispatcher.cjs` - F.9 added to F_SUBSHAPES + `requestedShape === 'F.9'` dispatch branch.
- `scripts/check-render-coverage.cjs` - SHAPES_UNDER_ASSERTION extended from F.0-F.7 to the full CANONICAL_SHAPES (F.0-F.9).
- `data/render-coverage-registry.json` - regenerated (adds F.9 to the derived F_SUBSHAPES walk).

## Decisions Made
- Reuse OUTCOMES via mapOutcome alias (accept==APPROVE) rather than mint a parallel enum, matching the dispatcher aliasToCanonical precedent.
- DEFER leaves a CONTRADICTS pair (both claims survive) so the later reconcile has data; rejection is data (Decision 13).
- SEED-039 version-stamp machinery deliberately left out (deferred); F.9 ships the shape, the multi-session reconcile rides it later.
- Regenerated the render-coverage registry with build-render-coverage.cjs (the derived-file generator) rather than hand-editing it.

## Deviations from Plan

None - plan executed exactly as written. The only maintenance step (regenerating `data/render-coverage-registry.json` after the F.9 dispatch branch added a new render entry point) is the sanctioned derived-file path the `--check` STALE guard prompts for, not an unplanned change.

## Issues Encountered
- `node scripts/check-render-coverage.cjs --check` initially reported the registry STALE because the F.9 branch added a new render entry point. Resolved by running the derived generator `node scripts/build-render-coverage.cjs` (registry diff: F.9 appended to the F_SUBSHAPES walk). `--check` then green.

## Verification
- `node lib/hmi/shape-f9-renderer.test.cjs` - PASS (12 assertions).
- `node lib/workflow/f9-consumer.test.cjs` - PASS (8 assertions).
- `node lib/hmi/selector-dispatcher.test.cjs` - PASS (7 tests).
- `node scripts/check-render-coverage.cjs --check-shapes` - GREEN for all ten F.0-F.9.
- `node scripts/check-render-coverage.cjs --check` - GREEN (registry fresh).
- `node tests/test-per-shape-coverage-gate-hardfail.cjs` - PASS (synthetic missing shape exits 1).
- `bash tests/run-all-188.sh` - fully GREEN: Passed 13, Failed 0, Skipped 0.
- `node scripts/doctor.cjs --acceptance` - 12/13; the sole FAIL (`verify-release-clean-tree`) is the pre-existing `.planning/` seed drift I was instructed not to touch, NOT introduced by this plan.
- Source-grep: F.9 consumer requires no better-sqlite3 / node:sqlite, opens no room.db, imports no SEED-039 version-stamp machinery. No em-dashes.

## Next Phase Readiness
- Phase 188 closes fully green: the full Shape-F selector family (F.0-F.9) now resolves a renderer + a dispatch branch, and the born-wired per-shape coverage gate covers every canonical shape.
- F.9 is the shape; SEED-039 multi-session reconcile can now consume it in a later phase.
- Pre-existing `.planning/` seed drift remains uncommitted by design (out of scope for this plan).

---
*Phase: 188-f7-multiselect-toggleable-hitl*
*Completed: 2026-07-01*
