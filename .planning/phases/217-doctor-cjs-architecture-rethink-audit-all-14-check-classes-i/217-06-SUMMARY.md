---
phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i
plan: 06
subsystem: infra
tags: [doctor, check-migration, cadence-always, d-01, d-02, registry-runner, class-i-fix, class-j-fix, multi-recovery, ctx-checks, carve-out, refactor]

# Dependency graph
requires:
  - phase: 217-01
    provides: cadence-gated accumulative engine (always pass, flag gate, fix-then-recheck flow with fixRes.recoveries[] plumbing, spread-into-report.checks, shared.cjs with PLUGIN_ROOT/INSTALL_DIR/readInstalledPluginsVersion)
  - phase: 217-05
    provides: proven fix-carrying migration recipe (runner file + registry entry + engine fix-then-recheck), the introduced_version historical-ship-version precedent, the engine running-version PLUGIN_ROOT fallback, class A as the sole remaining non-generic render path
provides:
  - The FINAL two migrated doctor checks (I install-state + fix, J deployment-surfaces + fix) moved from the inline main() block into registry-driven cadence:always runner files; registry now at 14 entries, all D-03 gate-green
  - I's fix returns MULTIPLE recovery records (the classIRecoveries array) and each lands on report.recovered via the engine's recoveries[] plumbing; J's fix preserves its own recovery-array semantics
  - J's check reads I's SAME-INVOCATION result via ctx.checks['install-state'] (topology / active_root / active_version) with a shared.cjs self-derivation fallback (resolveActivePluginRoot + readInstalledPluginsVersion) when ctx.checks is empty
  - The three sanctioned carve-outs are now WRITTEN, auditable justifications in the code (class A install-cache positional _finalizeAndExit coupling; brain-smoke M + eureka-smoke S async-vs-sync-engine)
  - Engine running-version fallback now fires on NON-CLEAN-SEMVER (not just unresolvable) so a 4-component install version never wrongly defers a cadence:always diagnostic that ships with the code
affects: [217-07, doctor-check-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a migrated check with a same-invocation dependency on a sibling reads it from ctx.checks['<sibling-id>'] (the engine accumulates always-results in registry array order) and self-derives every needed leg from shared.cjs when the sibling row is absent, so the runner works BOTH inside the engine (dependency present) and standalone (empty ctx.checks) -- proven by the Task 1 smoke exercising the fallback path"
    - "a fix that yields MULTIPLE recovery records returns { status, detail, recoveries: [...] }; the Plan 01 engine glue pushes EACH recoveries[] element onto report.recovered (Object.assign({ tool: mod.id }, rec), the fixer's own tool field winning) -- reproducing the pre-migration element-by-element push without any main() code"
    - "a migrated check whose RAW body returns a non-vocabulary status ('healthy') keeps the raw function re-exported for the legacy consumer (doctor.cjs --acceptance keys on 'healthy') while the engine check(ctx) maps 'healthy'->'ok' (and 'skipped'->'skip') so report.checks carries the standard ok|warn|error|skip vocabulary -- one body, two surfaces, zero duplicate code in doctor.cjs (Pitfall 4)"
    - "the accumulative engine's running-version-of-record falls back to PLUGIN_ROOT/.claude-plugin/plugin.json whenever checkInstallVersion resolves a NON-CLEAN-SEMVER string (semver.valid false, e.g. a 4-component 1.12.5.1 that coerce silently truncates to 1.12.5 and would place the install BELOW a diagnostic's introduced_version), not only when it resolves nothing -- a cadence:always check that ships WITH the running code must never be deferred by a weird installed-version string"

key-files:
  created:
    - lib/core/doctor/install-state-module.cjs
    - lib/core/doctor/deployment-surfaces-module.cjs
  modified:
    - lib/core/doctor/shared.cjs
    - scripts/doctor.cjs
    - data/doctor-modules.json
    - tests/test-doctor-class-j.cjs

key-decisions:
  - "introduced_version set to the HISTORICAL Phase 123 ship version 1.13.0-beta.13 (CHANGELOG `## [1.13.0-beta.13] - 2026-05-13`, the release that shipped class I + class J), NOT the plan's literal 1.15.3. 1.15.3 is a STABLE release which sorts AFTER the running prerelease 1.15.3-beta.13 (semver: stable > prerelease), so the deferred-guard would DEFER both entries on the current install and drop their report.checks rows. Extends the Plan 02/03/04/05 introduced_version-correction precedent."
  - "the class I helpers (readLegacyConfigPin, resolveLegacyConfigPinEntry, detectMarketplaceCacheInstall, collectVersionOfRecord, computeVersionDivergences, pathBinVanished, isLegacyDevClone, legacyDirtyOrUnpushed, readInstalledPluginsInstallPath, readHomeFile, readPathBinVersion) moved to shared.cjs rather than into the install-state runner, because doctor.cjs's --report-registration-bug assembler ALSO consumes five of them (collectVersionOfRecord, computeVersionDivergences, readLegacyConfigPin, detectMarketplaceCacheInstall, readInstalledPluginsInstallPath). shared.cjs is the single leaf both the runner and the assembler import (the Plan 01 pure-reader precedent); a back-require of scripts/doctor.cjs from a runner is forbidden (Pitfall 4)."
  - "the raw checkInstallState / checkDeploymentSurfaces are re-exported from the runner modules and bound in doctor.cjs via `const checkInstallState = installStateModule.checkInstallState` (no `function` keyword) so the --acceptance path (buildAcceptanceChecklist keys on the historical 'healthy' status) stays byte-identical while the function-def grep gate reads 0. Never a duplicate body in doctor.cjs."
  - "the class-A BUG 7 reinterpretation (downgrade install-cache 'missing' to a note when class I resolves topology=='marketplace-cache') was RELOCATED from the retired I/J main() block to AFTER the accumulative engine populates report.checks['install-state'] (class I now runs inside the engine), still gated on flags.installState. Reading the engine-populated row preserves the exact class-A/class-I interplay without a duplicate check call."
  - "the engine running-version fallback trigger widened from `!_normalizeVersion(runningRaw)` (null after coerce) to `!semver.valid(runningRaw)` (not CLEAN semver). _normalizeVersion COERCES 1.12.5.1 -> 1.12.5 (truthy), which sorts below install-state's 1.13.0-beta.13 introduced_version and DEFERRED it, breaking class-I test i.6. A non-clean install version now falls back to the running CODE's own PLUGIN_ROOT version; clean prereleases (1.13.0-beta.13) still resolve as-is."

patterns-established:
  - "after Plan 06 EVERY doctor check the difficulty map cleared is registry-driven; the ONLY three special-cased blocks left in main() are the sanctioned carve-outs (class A install-cache, brain-smoke M, eureka-smoke S), each opened with a literal 'Phase 217 carve-out:' justification comment -- loud, written, auditable, not silent omissions"

requirements-completed: [D-01, D-02]

# Metrics
duration: ~50min
completed: 2026-07-11
---

# Phase 217 Plan 06: Migrate I/J + Write the Three Sanctioned Carve-out Justifications Summary

**The final migration wave (D-01/D-02): install-state (class I, + multi-record fix) and deployment-surfaces (class J, + fix, reads class I's same-invocation result via ctx.checks), the two checks with the deepest main() interplay, move from the inline main() block into registry-driven cadence:always runner files -- and the three sanctioned carve-outs (class A install-cache, brain-smoke M, eureka-smoke S) become WRITTEN, auditable justification comments instead of silent omissions. Registry now at 14 entries, all D-03 gate-green; scripts/doctor.cjs shrank ~890 lines of function bodies.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-11
- **Tasks:** 2 (both auto)
- **Files:** 6 (2 created, 4 modified); scripts/doctor.cjs shrank ~890 lines gross (helper block + I/J check+fix bodies + the I/J main() dispatch block deleted, net a small marker-comment + require + BUG-7-relocation add-back)

## Accomplishments

- **Two runners on disk, contract-compliant.** install-state-module.cjs and deployment-surfaces-module.cjs each export check+fix. Every check returns a status in ok|warn|error|skip with a non-empty detail on every path. Both require node built-ins + ./shared.cjs only (plus PLUGIN_ROOT-joined sibling helpers surface-detect.cjs / cache-prune.cjs for J's fix), zero back-require of the doctor CLI (Pitfall 4). Module ids equal the existing report.checks keys so every downstream consumer + test stays stable.
- **Class I migrated with its multi-record fix.** install-state-module.cjs check(ctx) is the moved checkInstallState (resolveActivePluginRoot + install-state.json read + live spot-check + F11 legacy-config-pin drift + topology classification with the BUG 7 marketplace-cache carve-out + 6-way version-of-record). fix(ctx) is the moved performClassIFix returning `{ status, detail, recoveries: [...] }` -- the exact classIRecoveries array the old main() pushed element-by-element; the engine glue now performs that push (tool:'install-state' added). The dev-clone safety belt (isLegacyDevClone) and the dirty/unpushed refuse checks (legacyDirtyOrUnpushed) are preserved verbatim (Phase 123 D-13 / threat T-217-03).
- **Class J migrated, ctx.checks-aware with a self-derivation fallback.** deployment-surfaces-module.cjs check(ctx) derives topology/activeRoot/activeVersion in priority order: (a) ctx.checks['install-state'] (the same-invocation class-I result the engine accumulates in registry array order); (b) self-derive via shared.cjs (resolveActivePluginRoot + readInstalledPluginsVersion) for any missing leg. Then the moved checkDeploymentSurfaces body. fix(ctx) is the moved performClassJFix (re-stamp ok:false session-start-owned surfaces + unconditional marketplace-cache prune) preserving J's recovery-array semantics.
- **Status vocabulary bridged with zero duplication.** The raw checkInstallState/checkDeploymentSurfaces bodies return the historical 'healthy'|'warn'|'error'|'skipped' vocabulary; they are re-exported for doctor.cjs --acceptance (which keys on 'healthy'). The engine check(ctx) maps 'healthy'->'ok' and 'skipped'->'skip' so report.checks carries the standard ok|warn|error|skip vocabulary the generic renderer + computeSummary key on. One body, two surfaces.
- **Shared readers relocated to the leaf.** Eleven class-I/J helper readers moved from doctor.cjs into shared.cjs (both the runners AND the --report-registration-bug assembler import them from the single leaf surface; five are still consumed by the assembler, added to doctor.cjs's shared.cjs destructure).
- **Registry wired, main() shrunk, carve-outs written.** Two cadence:always entries appended (install-state BEFORE deployment-surfaces so ctx.checks carries I's result when J runs; both share the installState flag). The I/J main() dispatch block + the class-I helper block + the four dead function bodies deleted. Three `Phase 217 carve-out:` justification comments added (class A: positional _finalizeAndExit coupling + readers already in shared.cjs; brain-smoke M + eureka-smoke S: async runners vs the sync engine loop). The class-A BUG 7 reinterpretation relocated to after the engine populates report.checks['install-state'].

## Task Commits

1. **Task 1: Create the I and J runner files (multi-recovery fix + ctx.checks dependency)** - `b24ae7db` (feat)
2. **Task 2: Wire I/J entries, delete inline blocks + dead bodies, write the three carve-out justifications** - `3783ae36` (refactor)

## Files Created/Modified

- `lib/core/doctor/install-state-module.cjs` - NEW. class-I runner: check (moved checkInstallState, healthy->ok map, detail synthesized) + fix (moved performClassIFix, returns { status, detail, recoveries: [...] }). Re-exports raw checkInstallState + performClassIFix for --acceptance. Exports `{ check, fix, checkInstallState, performClassIFix }`.
- `lib/core/doctor/deployment-surfaces-module.cjs` - NEW. class-J runner: check (ctx.checks['install-state'] -> shared.cjs self-derive fallback, moved checkDeploymentSurfaces, healthy->ok / skipped->skip map) + fix (moved performClassJFix). Re-exports raw checkDeploymentSurfaces + performClassJFix. Exports `{ check, fix, checkDeploymentSurfaces, performClassJFix }`.
- `lib/core/doctor/shared.cjs` - MODIFIED. Added the 11 class-I/J shared readers (readLegacyConfigPin, resolveLegacyConfigPinEntry, detectMarketplaceCacheInstall, collectVersionOfRecord, computeVersionDivergences, pathBinVanished, isLegacyDevClone, legacyDirtyOrUnpushed, readInstalledPluginsInstallPath, readHomeFile, readPathBinVersion) + exports.
- `scripts/doctor.cjs` - MODIFIED (shrinks ~890 lines). Deleted the class-I helper block, checkInstallState, performClassIFix, the class-J helpers, checkDeploymentSurfaces, performClassJFix, and the I/J main() dispatch block. Added the shared.cjs helper imports + the runner-module raw-check bindings; relocated the class-A BUG 7 reinterpretation after the engine; widened the running-version fallback to non-clean-semver; wrote the three carve-out comments.
- `data/doctor-modules.json` - MODIFIED. 2 new cadence:always entries (install-state 1.13.0-beta.13 fix_supported:true; deployment-surfaces 1.13.0-beta.13 fix_supported:true, ordered AFTER install-state, shares the installState flag). 14 total.
- `tests/test-doctor-class-j.cjs` - MODIFIED. j.1 vocab pin healthy -> ok (the engine maps the raw checkDeploymentSurfaces status into ok|warn|error|skip). Vocab-only, same clean-fixture meaning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] introduced_version set to the historical Phase 123 ship version, not the plan's literal 1.15.3**
- **Found during:** Task 2 (pre-wiring deferred-guard analysis; the Plan 05 precedent).
- **Issue:** The plan artifact table specified `introduced_version: "1.15.3"` for both entries. 1.15.3 is a STABLE release; the running version is the prerelease 1.15.3-beta.13, and semver sorts stable AFTER its prerelease, so the deferred-guard would DEFER both entries and drop their report.checks rows.
- **Fix:** install-state + deployment-surfaces set to 1.13.0-beta.13 (CHANGELOG `## [1.13.0-beta.13] - 2026-05-13`, the release that shipped class I + class J per Phase 123 Plans 02+03). Valid semver, <= running, deferred-guard a no-op. Extends the Plan 02/03/04/05 precedent.
- **Files modified:** data/doctor-modules.json
- **Commit:** 3783ae36

**2. [Rule 3 - Blocking] Engine running-version fallback widened from unresolvable to non-clean-semver**
- **Found during:** Task 2 (class-I test i.6 failed: report.checks['install-state'] absent on a 1.12.5.1 install).
- **Issue:** i.6 sets up a scratch install reporting the 4-component non-semver version 1.12.5.1. checkInstallVersion RESOLVES it, and `_normalizeVersion` COERCES it to 1.12.5 (truthy, so the Plan 05 unresolvable-only fallback did not fire). 1.12.5 sorts BELOW install-state's 1.13.0-beta.13 introduced_version, so the deferred-guard DEFERRED install-state and it never ran -- a cadence:always diagnostic going dark on a weird installed-version string.
- **Fix:** The fallback trigger widened from `!_normalizeVersion(runningRaw)` to `!semver.valid(runningRaw)`. A non-clean-semver install version now falls back to the running CODE's own PLUGIN_ROOT/.claude-plugin/plugin.json version (which HAS the module); clean prereleases (1.13.0-beta.13) still resolve via checkInstallVersion as-is. This is the natural completion of the Plan 05 cadence:always design (the diagnostic ships with the code and must not be silenced by an install-version quirk). Explicit opts.running:null still soft-fails to skip (module-selector seam preserved).
- **Files modified:** scripts/doctor.cjs
- **Commit:** 3783ae36

**3. [Rule 3 - Test pin follows migrated vocabulary] class-J j.1 status pin healthy -> ok**
- **Found during:** Task 2 (test-doctor-class-j j.1 asserted the top-level status 'healthy').
- **Issue:** The pre-migration checkDeploymentSurfaces returned status 'healthy' on a clean fixture and the inline main() block pushed it verbatim into report.checks. The D-03 contract gate REQUIRES check() to return a status in ok|warn|error|skip, so the engine check(ctx) maps 'healthy'->'ok'. report.checks['deployment-surfaces'].status now reads 'ok'.
- **Fix:** j.1 pin updated 'healthy' -> 'ok'. Vocab-only pin (same clean-fixture meaning), the migration consequence the plan's Task 2 action step 4 anticipated. class-I needed NO status pin update (i.11 keys on topology + finding absence, not status).
- **Files modified:** tests/test-doctor-class-j.cjs
- **Commit:** 3783ae36

## Authentication Gates

None.

## Verification

- `node tests/test-doctor-module-contract-parity.cjs` -> ALL PASS (14 registry modules pass the 9-rule D-03 gate).
- `node tests/test-doctor-class-i.cjs` -> 11/11 (incl. i.6 the 4-component 1.12.5.1 non-semver no-crash pin, i.11 the BUG 7 marketplace-cache topology).
- `node tests/test-doctor-class-j.cjs` -> 8/8 (incl. j.1 the migrated ok pin, j.5 dev-clone surface skipped, j.7 self-entry excluded).
- `node tests/test-doctor-module-selector.cjs` -> 19 (explicit running:null -> skip seam preserved).
- `node tests/test-doctor-fix-renderer.cjs` -> 12/12.
- Task 1 smoke (the plan one-liner): I+J export check+fix, both satisfy the vocab+detail contract against a scratch home, J's fallback path exercised with an empty ctx.checks, I's fix returns a recoveries array (26 refs).
- Live acceptance: `node scripts/doctor.cjs --install-state --json` emits BOTH install-state + deployment-surfaces rows with vocab statuses + detail (shared flag + registry order dependency proven live). `--all --json` succeeds (exit 0), 15 checks keys, all five cadence:always ids present. `grep -c "Phase 217 carve-out" scripts/doctor.cjs` == 3; function-def grep == 0.
- No-regression: class-g 6/6, class-g-fix 3/3, class-h 3/3, class-h-fix 3/3, class-b 5/5, class-c 3/3, class-e 3/3, class-f 4/4, statusline-prefix-validator 8/8, doctor-acceptance suite 6/6. `--report-registration-bug` exits 0 (assembler consumes the moved shared readers). `--acceptance --pre-tag` exits 1 -- UNCHANGED from the pre-change backup (dev-workspace version-of-record inconsistency, not a regression).
- `node -c scripts/doctor.cjs` clean; no em-dashes in any created/modified file; doctor-modules.json valid (14 modules).

## Threat Surface

- T-217-03 (tampering via class-I install-topology mutations): the dev-clone safety belt (isLegacyDevClone) + dirty/unpushed refuse checks (legacyDirtyOrUnpushed) preserved verbatim; every destructive step (legacy-clone rm) is backup-then-verify; dryRun honored.
- T-217-01 (self-DoS): every runner check + fix is wrapped by the engine try/catch; the dev-clone hook install spawn + git probes carry bounded timeouts.
- T-217-SC: zero external packages installed.

## Next Phase Readiness

- The registry migration is COMPLETE for everything the difficulty map cleared. The three carve-outs (class A, brain-smoke M, eureka-smoke S) are written, auditable justifications; class A stays the single hand-coded render path.
- The multi-recovery fix + ctx.checks same-invocation-dependency + self-derivation-fallback patterns are documented for any future family.
- 217-07 (D-04 full commands/doctor.md audit + doc-parity test + run-all-217.sh + real-room human gate) is the remaining plan. No blockers.

## Self-Check: PASSED

- FOUND: lib/core/doctor/install-state-module.cjs, lib/core/doctor/deployment-surfaces-module.cjs
- FOUND commits: b24ae7db (Task 1), 3783ae36 (Task 2)

---
*Phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i*
*Completed: 2026-07-11*
