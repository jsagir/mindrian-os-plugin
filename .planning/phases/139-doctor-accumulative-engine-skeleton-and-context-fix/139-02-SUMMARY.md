---
phase: 139-doctor-accumulative-engine-skeleton-and-context-fix
plan: 02
subsystem: doctor / accumulative-engine
tags: [accumulative-engine, semver-selector, watermark, doctor-modules, idempotency, canon-part-6, canon-part-7, canon-part-8]
requires:
  - lib/core/install-state.cjs::migrateIfNeeded (the semver-dispatch + future-DEFER + additive-idempotency shape generalized)
  - data/deployment-surfaces.json (the hand-maintained manifest pattern mirrored)
  - lib/core/migration-snapshot.cjs (the module extended with the watermark ledger)
  - scripts/doctor.cjs::checkInstallVersion (reads the running version of record)
provides:
  - data/doctor-modules.json (module registry skeleton; modules[] EMPTY)
  - lib/core/migration-snapshot.cjs::readDoctorApplied / writeDoctorApplied (~/.mindrian/doctor-applied.json watermark)
  - scripts/doctor.cjs::runAccumulativeEngine (the semver selector loop; exported for testing)
affects:
  - scripts/doctor.cjs (selector wired into main under --all/--fix/standalone; main() now guarded behind require.main===module)
tech-stack:
  added: []
  patterns:
    - semver-dispatch window (applied_through, running] generalized from migrateIfNeeded
    - future-version DEFER (never run a module the install predates the other way -- introduced > running)
    - prerelease-preserving normalization (semver.valid first, coerce only for sloppy input)
    - additive never-regress watermark (a hotfix cannot lower applied_through)
    - per-runner try/catch soft-fail (one bad module never crashes the loop)
    - atomic tmp+rename ledger write
    - require.main===module CLI guard + module.exports for hermetic unit testing
key-files:
  created:
    - data/doctor-modules.json
    - tests/test-doctor-module-selector.cjs
  modified:
    - lib/core/migration-snapshot.cjs
    - scripts/doctor.cjs
decisions:
  - "doctor keeps its OWN applied-through watermark at ~/.mindrian/doctor-applied.json; it never depends on ~/.mindrian-last-version for the from->to delta (session-start overwrites that early)"
  - "the watermark never regresses: a LOWER appliedThrough keeps the stored (higher) value -- a hotfix cannot rewind the heal-through point"
  - "prerelease labels are preserved for comparison (semver.valid), so 1.13.1-beta.4 vs beta.3 windows correctly; coerce is the fallback only for non-valid input"
  - "the engine is NOT a class flag -- it runs under --all, --fix, and a bare standalone run; result lands on report.checks['accumulative-engine']"
  - "empty registry => zero modules selected; the loop + window math + runner-dispatch wiring is complete so Plan 03 adds only a registry entry + a runner file, no engine code"
  - "main() guarded behind require.main===module so tests can require doctor.cjs and call runAccumulativeEngine with an injected registry + watermark HOME"
metrics:
  duration: ~35m
  completed: 2026-06-04
canon_parts: [6, 7, 8]
requirements: [S2]
---

# Phase 139 Plan 02: Accumulative Engine Skeleton (S2) Summary

The version-dispatch substrate that converts doctor's frozen Phase-95 class roster into a forward-healing engine: a hand-maintained module registry (`data/doctor-modules.json`, seeded EMPTY), doctor's OWN applied-through watermark (`~/.mindrian/doctor-applied.json`, never-regressing), and a semver selector (`runAccumulativeEngine`) that runs each registered module whose `introduced_version` is in `(applied_through, running]`, idempotently -- generalizing the proven `install-state.cjs::migrateIfNeeded` + `deployment-surfaces.json` patterns (Canon Part 7 reuse-before-build).

## What was built

### Task 1 -- registry + watermark ledger (commit 37e139db)
- **`data/doctor-modules.json`**: hand-maintained module registry mirroring `data/deployment-surfaces.json` field-for-field in style. `$schema_note` documents the hand-maintained discipline ("new module = one entry, no code change"), the `introduced_version <= running` gate (old installs never faulted for organs they predate), the future-version-DEFER rule, and the per-entry contract `{ id, introduced_version, fix_supported, runner, description }`. `schema_version: 1`, `phase`, `canon_parts: [6,7,8]`, `modules: []` (EMPTY -- Plan 03 registers umbilical as module #1; the other 15 SCOUT-2 organs are out_of_scope).
- **`lib/core/migration-snapshot.cjs`** EXTENDED (not rewritten): added `readDoctorApplied(homeDir)` (soft-fail to `{ applied_through: null, history: [] }` on absent/malformed; never throws) and `writeDoctorApplied(homeDir, { appliedThrough, ranModuleIds })` (atomic tmp+rename, mkdir -p `.mindrian`, appends a history record, NEVER lowers `applied_through` -- a lower or incomparable new value keeps the stored watermark; best-effort returns false on error, never throws; chmod 0600 on POSIX). Both added to `module.exports`; all pre-existing exports preserved byte-identical. A lazy `semver` require backs the never-regress comparison so callers that never touch the watermark pay nothing.

### Task 2 -- semver selector loop (commit fcff3c71)
- **`scripts/doctor.cjs`**: added `runAccumulativeEngine(flags)` plus a `_normalizeVersion` helper (prefers `semver.valid` to PRESERVE prerelease labels, falls back to `semver.coerce` only for non-valid input). The selector:
  1. resolves the RUNNING version via `checkInstallVersion()` (test seam: `opts.running`); unresolved -> `{ status: 'skip' }` soft-fail.
  2. reads the registry (soft-fail to `{ modules: [] }`; test seam: `opts.registry`).
  3. reads the watermark; `null` applied_through means first run, window `(null, running]` = everything `<= running`.
  4. SELECTS modules where `introduced` is in `(applied_through, running]` (lower bound exclusive, upper inclusive); `introduced > running` is DEFERRED; `introduced <= applied_through` is skipped silently.
  5. invokes each selected module's runner (test seam `_check`/`_fix`; else `require(runner)` and call `check`/`fix`) inside a per-runner try/catch -- a throw records an error finding and the loop continues.
  6. advances the watermark to `running` only on a clean (no hard error) non-dry-run; re-running with the watermark already at running selects ZERO modules (no-op). Honors `--dry-run` (select+report, no advance, no fixers) and `--fix` (run fixers).
  7. attaches the result to `report.checks['accumulative-engine']` so `--json` surfaces it.
  Wired into `main` under `--all || --fix || !classFlagsActive` (the engine, not a class). `main()` is now guarded behind `require.main === module` and the selector is exported via `module.exports` for hermetic testing (the standard `node scripts/doctor.cjs` subprocess usage still runs `main()` because `require.main === module` holds).
- **`tests/test-doctor-module-selector.cjs`**: 12 hermetic assertions (mkdtempSync HOME, node:assert): watermark absent/round-trip/never-regress/advance; selector window selection + future-DEFER; first-run-is-everything; idempotent no-op re-run; prerelease compare (beta.4 in-window vs deferred against beta.3); soft-fail on a throwing runner; dry-run no-advance; unresolved-running skip.

## Verification (all PASS)
- `node tests/test-doctor-module-selector.cjs` -> ALL PASS (12 assertions): window + idempotency + pre-release + soft-fail.
- `node -e "JSON.parse(... 'data/doctor-modules.json')"` -> parses; `schema_version: 1`, `modules.length: 0`.
- `node -e "... readDoctorApplied/writeDoctorApplied typeof"` -> EXPORTS OK.
- `grep -n "doctor-applied|doctor-modules|runAccumulativeEngine" scripts/doctor.cjs` -> 10 matches (require + path const + function + main wiring + export).
- `node scripts/doctor.cjs --json` -> valid JSON; `checks['accumulative-engine'].status === 'ok'`, `selected: 0`, `deferred: 0`, `advanced: true` (clean empty-window run advances the heal-through point).
- Regression: `tests/test-doctor-class-c.cjs` 3/3, `tests/test-doctor-class-i.cjs` 11/11, `tests/test-doctor-acceptance.cjs` 6/6 -- the `main()` guard + the new engine call did not regress any existing doctor surface.

## Success criteria (met)
- The engine runs modules ONLY in the `(applied_through, running]` window; re-running is a no-op (idempotency test green).
- Doctor keeps its own watermark; it never depends on `~/.mindrian-last-version` for the from->to delta (watermark_not_lastversion honored).
- Registry + watermark + selector are reuse of `install-state.migrateIfNeeded` + `deployment-surfaces.json` patterns, not a new framework (Canon Part 7).
- Threat register: T-139-05 (window gates every module by introduced <= running; future DEFER), T-139-06 (own ledger, never lowers), T-139-07 (per-runner try/catch soft-fail) all mitigated. T-139-08 (LOCAL file reads only, zero Brain egress) preserved -- the selector makes no network call.

## Deviations from Plan
- **[Rule 3 - Blocking] `main()` guard + `module.exports` added to doctor.cjs.** The plan's Task 2 test seam ("prefer exporting runAccumulativeEngine and passing `{ registry, running, home }` opts") requires `require('../scripts/doctor.cjs')`, but doctor.cjs called `main()` unconditionally at module top-level (which would run the full CLI on require). Guarded `main()` behind `if (require.main === module)` and added `module.exports = { runAccumulativeEngine }`. This is the intended enabling change for the plan's own prescribed test seam, not a behavior change: the standard `node scripts/doctor.cjs ...` invocation and subprocess spawns still satisfy `require.main === module` and run `main()` (verified by class-c/class-i/acceptance regression tests staying green).
- **[Clarification] prerelease normalization does NOT blindly `semver.coerce`.** The plan said "Coerce versions through `semver.coerce` so pre-release labels compare correctly," but `semver.coerce('1.13.1-beta.4')` STRIPS the prerelease to `1.13.1` -- which would break the required beta.4-vs-beta.3 windowing. Implemented `_normalizeVersion` to prefer `semver.valid` (preserves prerelease) and fall back to `semver.coerce` only for non-valid input. This satisfies the plan's INTENT (correct prerelease comparison, the explicit beta.4 test case) rather than the literal coerce call. Verified: `1.13.1-beta.4` is IN the window against running `beta.4` and DEFERRED against running `beta.3`.

## Out of scope (deferred per LOCKED decisions)
- S3 Umbilical first module (`.umbilical` read + `AFFILIATED_WITH` edge projection + register as module #1 in the now-empty registry) -- Plan 03.
- S4 release wiring (version bump, release.sh Step 6.6, `doctor --acceptance` gate) -- later plan.
- The 15 remaining SCOUT-2 organ modules -- v1.13.1+.

## Note on the unrelated working-tree file
`.planning/phases/139-.../139-04-PLAN.md` carried a pre-existing 2-line modification not produced by this plan; per the executor scope boundary it was left untouched and excluded from both commits.

## Self-Check: PASSED
- `data/doctor-modules.json` exists; `tests/test-doctor-module-selector.cjs` exists; `lib/core/migration-snapshot.cjs` + `scripts/doctor.cjs` modified.
- Commit 37e139db (Task 1) present in git history; commit fcff3c71 (Task 2) present in git history.
