---
phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i
plan: 01
subsystem: infra
tags: [doctor, accumulative-engine, cadence, semver, module-registry, refactor]

# Dependency graph
requires:
  - phase: 139-doctor-accumulative-engine-skeleton-and-context-fix
    provides: runAccumulativeEngine selector + doctor-modules.json registry + doctor-applied watermark
provides:
  - Cadence-aware accumulative engine (always vs once) that runs diagnostics on EVERY invocation, watermark-immune
  - Per-module flag gate (null flag = class-A/N baseWanted; named flag = flags[key])
  - Fix-then-recheck flow with engine-local recovered[] plumbing
  - Engine returns new checks + recovered keys; main() spreads them into report.checks unconditionally
  - renderHumanReport generic loop action_lines dim sub-line support
  - lib/core/doctor/shared.cjs leaf module (constants + helpers + 3 pure class-A readers)
affects: [217-02, 217-03, 217-04, 217-05, 217-06, 217-07, doctor-check-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cadence:always module = per-invocation diagnostic, watermark-immune; cadence:once = watermark-gated heal"
    - "flag gate: null flag follows the class-A/N baseWanted predicate; a named flag activates only when set"
    - "fix-then-recheck: check -> fix -> re-check, recovered records keyed by module id (fixer tool field wins)"
    - "doctor leaf-module extraction: one-direction require (doctor.cjs -> shared.cjs), no back-require"

key-files:
  created:
    - lib/core/doctor/shared.cjs
  modified:
    - scripts/doctor.cjs
    - data/doctor-modules.json
    - tests/test-doctor-module-selector.cjs

key-decisions:
  - "cadence:always modules skip the watermark lower-bound entirely (only an upper introduced_version <= running deferred-guard applies) -- this is the Pitfall-1 fix that stops migrated checks going permanently silent"
  - "always results land ONLY in alwaysChecks, never in the once-path findings[] -- keeps selector-test findings assertions valid and makes Pitfall 3 impossible"
  - "engine call in main() is now UNCONDITIONAL; the class-A/N gate is reproduced internally via opts.classFlagsActive for the once-pass + the accumulative-engine self-report row"
  - "shared.cjs re-exports resolveActivePluginRoot from lib/core/active-plugin-root.cjs so callers have a single import site; INSTALL_PLUGIN_JSON stays internal (only checkInstallVersion used it)"

patterns-established:
  - "action_lines[]: a cadence:always module returns action_lines and the generic renderer prints one dim '-> ' sub-line each -- the structural home for the hand-coded class H/K/N hint sub-lines that later plans delete"
  - "PLUGIN_ROOT __dirname re-base: a helper moved from scripts/ (one level below root) to lib/core/doctor/ (three levels below) changes path.resolve(__dirname,'..') to path.resolve(__dirname,'..','..','..')"

requirements-completed: [D-01, D-02]

# Metrics
duration: ~40min
completed: 2026-07-11
---

# Phase 217 Plan 01: Cadence-Gated Engine + shared.cjs Extraction Summary

**runAccumulativeEngine gains a cadence split (always = watermark-immune per-invocation diagnostic, once = watermark-gated heal) with flag gating + fix-then-recheck + recovered plumbing, and the shared doctor constants/helpers move into a leaf module lib/core/doctor/shared.cjs with zero circular requires.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-11T16:06Z (approx)
- **Completed:** 2026-07-11
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Killed the Pitfall-1 silent-diagnostic trap: a `cadence:always` module's `check()` now runs on EVERY doctor invocation, immune to the `~/.mindrian/doctor-applied.json` watermark. Only an upper-bound `introduced_version <= running` deferred-guard applies (no lower watermark bound).
- Preserved umbilical's `cadence:once` semantics byte-identically, with ONE relocation: the entire once-pass (window selection + runner invocation + watermark advance) is now gated behind the `flags.all || flags.fix || !classFlagsActive` predicate that used to live at the main() call site. A `--room-md`-only run still never runs the once-heals and never advances the watermark.
- Always results spread into a top-level `report.checks[<id>]` map so the 260711-nrd generic renderer prints one row per check and computeSummary tallies each; they never leak into the once-path `findings[]`.
- Added fix-then-recheck flow (check -> fix -> re-check) with engine-local `recovered[]` plumbing (tool = module id, fixer's own `tool` field wins on Object.assign).
- Added `action_lines[]` support to the generic render loop: one dim `-> ` sub-line per entry.
- Extracted `lib/core/doctor/shared.cjs` as a leaf module (constants, version helpers, room/registry readers, and the 3 pure class-A constituent readers), consumed by doctor.cjs through ONE destructuring require with zero back-require.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cadence gate + flag-gated always-pass + spread/recovered plumbing** - `8b3b8643` (feat)
2. **Task 2: Extract lib/core/doctor/shared.cjs leaf module** - `002f7f8d` (refactor)

## Files Created/Modified

- `lib/core/doctor/shared.cjs` - NEW leaf module: `C` color table, `HOME`, `PLUGIN_HOME`, `INSTALL_DIR`, `INSTALL_PLUGIN_JSON`, `MARKETPLACE_CACHE_DIR`, `PLUGIN_ROOT`; `parseVersion`, `cmpVersion`; `findRoomRoot`, `readRegistry`, `readInstalledPluginsVersion`; `checkInstallVersion`, `checkMarketplaceCache`, `checkDevSourceConsistency`; re-exports `resolveActivePluginRoot`. __dirname re-based; env-var names preserved.
- `scripts/doctor.cjs` - Cadence split in `runAccumulativeEngine` (always/once passes, flag gate, deferred guard, fix-then-recheck, new `checks`+`recovered` return keys); unconditional engine call + destructured glue in main(); action_lines sub-line rendering; moved definitions replaced by one destructuring require of shared.cjs.
- `data/doctor-modules.json` - umbilical gains `"cadence": "once"` + `"flag": null`; `$schema_note` documents the cadence/flag/fix-then-recheck contract + the explicit-boolean fix_supported rule (D-03). No em-dashes.
- `tests/test-doctor-module-selector.cjs` - 6 new hermetic sub-tests plus a return-shape guard: always-reruns-every-invocation, once-below-watermark-stays-skipped, flag gating, null-flag base gate (+ --all re-admit), fix-then-recheck + recovered shape (+ fix_supported:false never fixes), watermark-not-advanced-under-class-flags.

## Decisions Made

- `cadence:always` modules deliberately skip the watermark lower-bound; that immunity is the entire point of the phase (Pitfall 1). Only the future-version upper-bound guard remains.
- Always results go ONLY into `alwaysChecks`, never the once-path `findings[]`, keeping the pre-existing selector-test `findings` assertions valid.
- The engine call in main() became unconditional (always modules must run every invocation via their own flag gates); the old class-A/N gate is reproduced inside the engine for the once-pass and attached only to the `accumulative-engine` self-report row so a `--room-md`-only run does not grow a new row.
- `INSTALL_PLUGIN_JSON` and `PLUGIN_HOME` are exported from shared.cjs too (beyond the required minimum) because performRecoveryAtomic still needs PLUGIN_HOME; INSTALL_PLUGIN_JSON stays internal-facing (only checkInstallVersion referenced it).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The full doctor test suite runs slowly (subprocess-spawning class tests), so verification was run in targeted batches rather than one loop; all relevant suites pass.

## Verification

- `node tests/test-doctor-module-selector.cjs` -> ALL PASS (19 assertions; 13 pre-existing + 6 new cadence/flag/fix sub-tests + return-shape guard).
- `node tests/test-doctor-fix-renderer.cjs` -> All 12 tests PASS (renderer unregressed).
- `grep -c cadence scripts/doctor.cjs` = 12 (>= 3); `grep -c '"cadence": "once"' data/doctor-modules.json` = 1; `grep -c action_lines scripts/doctor.cjs` = 4 (>= 1).
- `node -e "require('./scripts/doctor.cjs')"` exit 0; shared.cjs exports all 14 named symbols; `grep -c "require(.*scripts/doctor" lib/core/doctor/shared.cjs` = 0 (leaf module).
- `node scripts/doctor.cjs --help` exit 0; `node scripts/doctor.cjs --json` exit 0 with valid JSON (checks: accumulative-engine, plugin-enabled-state).
- Existing doctor tests green: module-selector, class-a-topology-drift, class-a-vestigial-legacy, class-b, -c, -e, -f, -g, -g-fix, -h, -h-fix, -i, -j, legacy-config-pin-drift, plugin-disabled-state, preflight-format, report-registration-bug, statusline-prefix-validator, ui-self-compliant, acceptance (x3), atomic-swap, bind-check.
- Known pre-existing failures unchanged: test-doctor-class-p (2 failed) / test-doctor-class-q (6 failed) -- NOT fixed or masked (260711-nrd deferred-items ruling).

## Threat Surface

No new security-relevant surface. T-217-01 (self-DoS): every always-runner invocation is wrapped in try/catch -> one bad module becomes an error row, loop continues. T-217-02 (path-helper tampering): the moved path helpers preserve their existing resolve+existsSync guards verbatim; no new path inputs. No packages installed (T-217-SC accepted).

## Next Phase Readiness

- The cadence-aware engine + shared.cjs are the load-bearing prerequisites for every later 217 plan. D-01 check migration (217-03 onward) can now register `cadence:always` modules that stay live on every run; D-02 file split has begun (3 pure class-A readers already in shared.cjs).
- No blockers.

## Self-Check: PASSED

- FOUND: lib/core/doctor/shared.cjs, scripts/doctor.cjs, data/doctor-modules.json, tests/test-doctor-module-selector.cjs
- FOUND commits: 8b3b8643 (Task 1), 002f7f8d (Task 2)

---
*Phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i*
*Completed: 2026-07-11*
