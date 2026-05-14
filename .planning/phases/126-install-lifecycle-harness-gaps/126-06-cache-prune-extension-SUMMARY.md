---
phase: 126-install-lifecycle-harness-gaps
plan: 06
subsystem: infra
tags: [install-cache, atomic-swap, doctor, fs-cleanup, env-var, phase-95.2, phase-123]

# Dependency graph
requires:
  - phase: 123-install-lifecycle-harness
    provides: pruneMarketplaceCache (Phase 123 Plan-05 cache-version prune; this plan extends with stale-backup prune)
  - phase: 95.2-install-cache-atomic-recovery-sessionstart-preflight
    provides: mindrian-os.stale-<tag>-<timestamp> backup-dir naming pattern (scripts/doctor.cjs:295)
provides:
  - Stale backup-dir pruning step inside pruneMarketplaceCache
  - MOS_CACHE_PRUNE_AGE_DAYS env-var contract (default 30, override integer-only)
  - removedBackups + ageDays additive return fields on pruneMarketplaceCache
  - pruneStaleBackups standalone helper exposed via module exports
  - 7-scenario hermetic test fixture (tests/test-cache-prune-extended.cjs)
  - tests/run-all-126.sh Phase 126 scoped aggregator (Plan 06 + sibling slots)
affects:
  - Phase 126 Plan 03 (acceptance-gate self-coverage): may add an acceptance check exercising the new stale-backup prune path on scaffolded broken-state fixtures
  - Phase 126 Plan 07 (install-state schema v2): the install-state record could optionally track last_backup_prune timestamp in v2 (out of scope for this plan)
  - scripts/doctor.cjs --fix call-site at line ~2100: continues to read r.removed.length + r.kept only (backward-compat preserved); may opt-in to surface r.removedBackups in a future renderer pass

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive return shape extension (removedBackups + ageDays additive to the Phase 123 { kept, removed, skipped, reason } contract)"
    - "Literal-prefix pattern match with period gate: /^mindrian-os\\.stale-/ does NOT match mindrian-os/ live install"
    - "Env-var integer parse with regex /^\\d+$/ + fallback to default (rejects negative, non-numeric, and empty values)"
    - "Per-entry best-effort error swallowing (mirrors Phase 123 cache-prune rmSync error path)"
    - "Hermetic per-test mkdtempSync HOME fixture (mirrors tests/test-cache-prune.cjs)"

key-files:
  created:
    - tests/test-cache-prune-extended.cjs
    - tests/run-all-126.sh
  modified:
    - lib/core/cache-prune.cjs

key-decisions:
  - "Env-var name MOS_CACHE_PRUNE_AGE_DAYS settled (CONTEXT.md Open Question 4 lean -- env var for v1, config for v2)"
  - "Default 30 days -- the next operational threshold beyond Phase 95.2's 24h user-driven cleanup window"
  - "Pattern uses period-after-prefix (mindrian-os\\.stale-) NOT prefix-only (mindrian-os) -- guards live install dir against accidental sweep"
  - "Skipped path (corrupt installed_plugins.json) also returns the additive fields with empty array + resolved ageDays -- shape contract is uniform across all return paths"
  - "pruneStaleBackups exposed as a sibling helper in module.exports for future direct reuse by other call sites (doctor --acceptance, session-start, etc) without taking the marketplace-cache lock"

patterns-established:
  - "Phase 126 dog-fooding pattern: extend Phase 123 substrate (cache-prune.cjs) rather than fork -- Canon Part 7"
  - "Per-plan test aggregator (tests/run-all-126.sh) registers suites incrementally as sibling plans land -- mirrors run-all-122.sh / run-all-125.sh"

requirements-completed: []

# Metrics
duration: 4 min
completed: 2026-05-14
---

# Phase 126 Plan 06: Cache Prune Extension (Stale Backup Window) Summary

**Pruner extended with a sibling pass over `~/.claude/plugins/mindrian-os.stale-*` backup dirs older than `MOS_CACHE_PRUNE_AGE_DAYS` (default 30 days) -- closes the disk-accumulation surface created by Phase 95.2's atomic-swap recovery on long-running tester installs.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-14T10:33:53Z
- **Completed:** 2026-05-14T10:38:05Z
- **Tasks:** 2 (1 RED + 1 GREEN; no REFACTOR step needed)
- **Files modified:** 1 (`lib/core/cache-prune.cjs`)
- **Files created:** 2 (`tests/test-cache-prune-extended.cjs`, `tests/run-all-126.sh`)

## Accomplishments

- New stale-backup prune surface added to `pruneMarketplaceCache` -- single function now closes BOTH the cache-version accumulation (Phase 123) and the atomic-swap-backup accumulation (Phase 95.2 dog-fooded surface).
- `MOS_CACHE_PRUNE_AGE_DAYS` env-var contract shipped (default 30 days; integer-only override with regex `/^\d+$/` gate; v2 may move to `.mos/config.json`).
- 7-scenario hermetic test fixture covers: default-window prune, default-window retain, env-var contract both directions (3-day too-young + 90-day too-old retain), idempotency, no-regression-vs-Phase-123, pattern-match safety (live install + unrelated siblings untouched).
- Return shape extended additively: `{ kept, removed, removedBackups, skipped, reason, ageDays }` -- the Phase 123 `scripts/doctor.cjs` consumer at line ~2100 continues reading only `r.removed.length + r.kept`, no breakage.
- `pruneStaleBackups(home, ageDays, dryRun)` exposed as a standalone helper via `module.exports` for future direct reuse by `doctor --acceptance` (Plan 03) or session-start without re-running the cache-version pass.
- Phase 126 scoped runner (`tests/run-all-126.sh`) scaffolded with Plan 06 registered first; sibling plans (126-01, 126-02, 126-03, 126-04, 126-05, 126-07) each register their own entries (Plan 126-01 has already appended `test-doctor-fix-renderer.cjs` in parallel).

## Task Commits

Both tasks were committed atomically with `--no-verify` per the parallel-execution wave-protocol invariant:

1. **Task 1: Create stale-backup prune fixture test (TDD RED)** -- `c939335` (test)
2. **Task 2: Extend cache-prune.cjs with stale-backup prune step (TDD GREEN)** -- `f7294a8` (feat)

_No REFACTOR step -- the extension was minimal (one helper function + additive return fields) and clean as written; clarity was not improved by a second pass._

## Files Created/Modified

- `lib/core/cache-prune.cjs` -- **EXTENDED**. Added `MOS_CACHE_PRUNE_AGE_DAYS` env-var read at the top of `pruneMarketplaceCache`, added `pruneStaleBackups` sibling helper, extended all three return paths (skipped, no-cache, normal) with `removedBackups` + `ageDays` additive fields, extended header docblock to document the Phase 126 contract.
- `tests/test-cache-prune-extended.cjs` -- **NEW** (415 lines). 7-scenario fixture: ext.1 (60d default prune), ext.2 (5d default retain), ext.3 (env=3 prunes 5d), ext.4 (env=90 retains 60d), ext.5 (idempotency), ext.6 (no regression vs Phase 123 cache prune), ext.7 (pattern-match safety). Hermetic mkdtempSync HOME per test; mirrors test-cache-prune.cjs pattern.
- `tests/run-all-126.sh` -- **NEW** (then merged with sibling Plan 126-01's parallel update). Phase 126 scoped aggregator with `CJS_SUITES=(test-doctor-fix-renderer.cjs test-cache-prune-extended.cjs)` after merge.

## Decisions Made

1. **Env-var name = `MOS_CACHE_PRUNE_AGE_DAYS`** -- settled the Plan-CONTEXT Open Question 4 lean (env var for v1, config for v2).
2. **Default 30 days** -- Phase 95.2's contract retains backups "indefinitely; after 24h the user can delete manually". 30 days is the next operational threshold beyond user-driven cleanup.
3. **Pattern uses period-after-prefix** (`/^mindrian-os\.stale-/`) NOT prefix-only (`/^mindrian-os/`) -- explicitly guards `mindrian-os/` (live install) against accidental sweep. Ext.7 asserts this with a 365-day-old `mindrian-os/` dir that survives the prune.
4. **Skipped-path return shape uniform** -- when `installed_plugins.json` is unreadable, the function still returns `removedBackups: []` and `ageDays` (the resolved window). This means consumers can read the field unconditionally without a null guard.
5. **`pruneStaleBackups` exposed as a sibling helper** -- via `module.exports`. Lets future call sites (Plan 03 acceptance gate, doctor `--acceptance` scaffold) invoke the stale-backup pass directly without the marketplace-cache lock.
6. **No REFACTOR step** -- the GREEN code is 50 added lines of clear, single-purpose code. A second pass would not improve clarity.

## Deviations from Plan

None - plan executed exactly as written.

(All seven test scenarios specified in the plan landed as written; the extension touches only `lib/core/cache-prune.cjs` as scoped; zero regression on Phase 123 cache-prune suite -- 6/6 GREEN; Canon Part 8 forbidden-token grep continues to exit 1 / no match via cp.6 in the Phase 123 suite, confirming the extension introduces zero network surface.)

## Issues Encountered

**Parallel-wave interleave with sibling Plan 126-01:** During the Task 2 commit, sibling Plan 126-01's executor had concurrently updated `tests/run-all-126.sh` (adding its own `test-doctor-fix-renderer.cjs` entry to `CJS_SUITES`). The first `git commit` for Task 2 failed because the orchestrator's state-refresh notification cleared the staging area. Resolved by re-running `git add lib/core/cache-prune.cjs` and re-committing -- a normal parallel-wave occurrence handled by the `--no-verify` flag protocol.

## User Setup Required

None - the new env-var (`MOS_CACHE_PRUNE_AGE_DAYS`) is opt-in. Existing installs continue to use the 30-day default with zero configuration. The default applies on the next session-start cache-prune invocation (via `scripts/doctor.cjs --fix` or the existing session-start hook call site).

## Forward Reference to Plan 03

Plan 03 (acceptance-gate self-coverage) is expected to add an acceptance check that:
- Scaffolds a 60-day-old `mindrian-os.stale-*` backup dir in a fixture HOME
- Invokes `doctor --acceptance` (which internally runs `pruneMarketplaceCache`)
- Asserts the backup dir was removed (or, in dry-run mode, was reported in `removedBackups`)

The `pruneStaleBackups` standalone helper exported in this plan is the door Plan 03 will use for that scaffolded coverage path without re-doing the marketplace-cache prune.

## Next Phase Readiness

- Plan 06 closes Wave 1 (parallel) of Phase 126 from the cache-prune surface. Sibling plans 126-01 (renderer contract) and 126-02 (semver pre-release pick) continue in parallel.
- Wave 2 dependencies are unblocked from Plan 06's side: Plans 03, 05, 07 can all assume `pruneMarketplaceCache` exports `removedBackups + ageDays + pruneStaleBackups`.
- `bash tests/run-all-126.sh` will show 1 PASS (this plan) + 2 RED (sibling plans 126-01, 126-02 still in flight). Once their GREEN commits land, the aggregator goes 3 PASS.

## Self-Check: PASSED

All claimed artifacts verified on disk:
- FOUND: `lib/core/cache-prune.cjs` (13,236 bytes)
- FOUND: `tests/test-cache-prune-extended.cjs` (18,194 bytes)
- FOUND: `tests/run-all-126.sh` (2,644 bytes, executable)
- FOUND: `.planning/phases/126-install-lifecycle-harness-gaps/126-06-cache-prune-extension-SUMMARY.md` (this file)

All claimed commits verified in `git log`:
- FOUND: `c939335` (test(126-06): RED test fixture)
- FOUND: `f7294a8` (feat(126-06): GREEN extension)

Test verification:
- `node tests/test-cache-prune-extended.cjs` -> 7/7 GREEN
- `node tests/test-cache-prune.cjs` -> 6/6 GREEN (Phase 123 regression guard)
- `grep MOS_CACHE_PRUNE_AGE_DAYS lib/core/cache-prune.cjs` -> 3 hits (required >= 1)
- `grep mindrian-os\\.stale- lib/core/cache-prune.cjs` -> 3 hits (required >= 1)

---
*Phase: 126-install-lifecycle-harness-gaps*
*Plan: 06*
*Completed: 2026-05-14*
