---
phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i
plan: 05
subsystem: infra
tags: [doctor, check-migration, cadence-always, d-01, d-02, registry-runner, class-g-fix, class-h-fix, class-d, refactor]

# Dependency graph
requires:
  - phase: 217-01
    provides: cadence-gated accumulative engine (always pass, flag gate, fix-then-recheck flow, spread-into-report.checks, shared.cjs with PLUGIN_ROOT/INSTALL_DIR/readRegistry)
  - phase: 217-04
    provides: proven fix-carrying migration recipe (runner file + one registry entry + engine fix-then-recheck), the introduced_version historical-ship-version precedent, the action_lines[] sub-line renderer support (from 217-01)
provides:
  - Three migrated doctor checks (G statusline-visibility + fix, H install-incomplete + fix, D verify-surface child-spawn) moved from inline main() blocks into registry-driven cadence:always runner files
  - The LAST two hand-coded render branches (class G + class H) retired -- after this plan the ONLY non-generic render path in renderHumanReport is class A (install-cache), the sanctioned carve-out (Plan 06)
  - Engine running-version-of-record now falls back to PLUGIN_ROOT/.claude-plugin/plugin.json when checkInstallVersion cannot resolve the install (so cadence:always diagnostics never go dark under a HOME-override)
  - Pre-migration G/H fix-ordering semantics preserved (H no longer re-stamps over G's stale-override removal)
affects: [217-06, 217-07, doctor-check-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a fix-carrying check that operates on a resource ALSO written by a sibling check in the same shared-flag family reads the sibling's engine-recorded fix_result (ctx.checks['<sibling>'].fix_result) to detect that the sibling fixed the resource THIS invocation, and defers rather than fighting it -- reproducing the pre-migration all-checks-then-all-fixes ordering without a broad engine restructure"
    - "the accumulative engine's running-version-of-record resolves checkInstallVersion() first, then falls back to the running CODE's own PLUGIN_ROOT/.claude-plugin/plugin.json (HOME-independent) so a hermetic HOME-override never silences every cadence:always diagnostic; an EXPLICIT opts.running:null still soft-fails to status:skip (test seam preserved)"
    - "a check-only migrated check (verify-surface) is one runner file exporting check ONLY + one cadence:always registry entry with fix_supported:false; the child-spawn path is a repo-root-resolved constant (PLUGIN_ROOT join), never caller input (T-217-03)"

key-files:
  created:
    - lib/core/doctor/statusline-visibility-module.cjs
    - lib/core/doctor/install-incomplete-module.cjs
    - lib/core/doctor/verify-surface-module.cjs
  modified:
    - data/doctor-modules.json
    - scripts/doctor.cjs
    - tests/test-doctor-statusline-prefix-validator.cjs

key-decisions:
  - "introduced_version set to HISTORICAL ship versions (statusline-visibility 1.12.5 = Phase 106 ## [1.12.5] - 2026-05-03; install-incomplete 1.13.0-beta.9 = Phase 95.6; verify-surface 1.12.1-beta.1 = Phase 95.1, same release as B/C/E), NOT the plan's literal 1.15.3. 1.15.3 is a STABLE release which sorts AFTER the running prerelease 1.15.3-beta.13 (semver: stable > prerelease), so the deferred-guard (semver.gt(introduced, running)) would DEFER all three, drop their report.checks rows, and fail the class G/H tests (which run the REAL doctor at the real running version). Historical ship versions make the guard a no-op everywhere the check should be live. Extends the Plan 02/03/04 introduced_version-correction precedent (this plan's read_first directed it)."
  - "the class-H runner enforces its OWN stricter fix gate runner-internally: if ctx.check_result.recoverable !== true it returns {status:'skip', detail} without touching anything. The engine's generic fix gate is recoverable !== false (LOOSER); class H's historical dispatch gated on recoverable === true. checkInstallIncomplete always sets a boolean recoverable, so the gates are identical in practice, but the runner-internal guard makes the stricter contract airtight and self-documenting."
  - "class H defers to class G when G's fix removed the statusLine THIS invocation. G and H both act on ~/.claude/settings.json .statusLine with OPPOSITE fixes (G removes a stale user override so plugin config applies; H writes the block when missing). Pre-migration, main() ran ALL class checks before ANY fix, so H saw the override present -> ok -> never fought G. The engine runs G fully (check+fix+recheck) before H's check, so H would see G's removal as an incomplete install and re-stamp it (undoing G; on a marketplace-cache install re-introducing a broken legacy-path override). H's check now reads ctx.checks['statusline-visibility'].fix_result and, on the Step-2 settings-based warn only, returns ok when G fixed this run."
  - "the engine running-version fallback to PLUGIN_ROOT plugin.json was necessary because the class G/H tests override HOME (to isolate ~/.claude/settings.json), which breaks checkInstallVersion's install resolution -- unlike the B/C/E tests which override MINDRIAN_ROOMS_HOME. Before the migration class G/H were inline blocks that did not need the running version; as registry modules they do. The fallback is the natural completion of the cadence:always design (a diagnostic must not go silent just because the install dir is not where checkInstallVersion looked) and is a no-op for real installs."

patterns-established:
  - "after Plan 05 the generic render loop is the SOLE row source for every check except class A: the class G + class H hand-coded render branches and their two `if (name === '...') continue;` skip lines are gone; H's hint sub-line rides the action_lines[] renderer support"

requirements-completed: [D-01, D-02]

# Metrics
duration: ~45min
completed: 2026-07-11
---

# Phase 217 Plan 05: Migrate G/H/D + Retire the Last Hand-Coded Render Branches Summary

**The three remaining event/fix-carrying doctor checks -- statusline-visibility (G, + fix), install-incomplete (H, + fix, shares G's activation flag), and verify-surface (D, child-spawn check) -- move from inline main() blocks into registry-driven cadence:always runner files, and the phase's structural headline lands: the last two hand-coded render branches (G and H) are deleted, so the ONLY non-generic render path left in renderHumanReport is class A (install-cache), the sanctioned carve-out.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-11
- **Tasks:** 2 (both auto)
- **Files:** 6 (3 created, 3 modified); scripts/doctor.cjs shrank ~590 lines gross (net -546)

## Accomplishments

- **Three runners on disk, contract-compliant.** statusline-visibility (G) and install-incomplete (H) export check+fix; verify-surface (D) exports check only. Every check returns a status in ok|warn|error|skip with a non-empty detail on every path. All require from node built-ins + ./shared.cjs only (PLUGIN_ROOT, INSTALL_DIR), zero back-require of the doctor CLI (Pitfall 4; grep `scripts/doctor` == 0 per runner). Module ids equal the existing report.checks keys so every downstream consumer + test stays stable.
- **Class G migrated with its fix.** statusline-visibility-module.cjs check(ctx) is the moved checkStatuslineVisibility (four-branch probe: stale user-settings / broken plugin pointer / statusline-mos isolated exec / disableAllHooks; DESKTOP/COWORK -> skip), paths re-based off PLUGIN_ROOT. fix(ctx) is the moved performStatuslineFix (spawns migrate-stale-user-settings.cjs --apply --quiet) and now returns status/detail alongside the raw record main() pushed, preserving tool:'migrate-stale-user-settings' through the engine's Object.assign glue.
- **Class H migrated with its fix + the stricter gate runner-internal.** install-incomplete-module.cjs check(ctx) is the moved checkInstallIncomplete (receipt-halted + missing-statusLine-block detection). fix(ctx) is the moved performClassHFix with the runner-internal recoverable===true guard (returns skip when not exactly recoverable). The deleted H render branch's hint sub-line is now emitted as action_lines:['/mos:doctor --statusline-visibility --fix re-stamps the statusLine block'] on the warn+recoverable path only, rendered by the generic loop's action_lines support.
- **Class D migrated (child-spawn, check-only).** verify-surface-module.cjs check(ctx) is the moved checkSurfaceVerification verbatim: spawnSync of tests/test-cascade-surface-e2e.cjs with the 30s timeout, both the bash-absent and harness-absent branches returning skip (an install is never faulted for a missing dev harness), exitCode/runner payload keys preserved, the child-test path re-based off PLUGIN_ROOT (three '..' hops). No fix export (fix_supported false).
- **Registry wired, the last hand-coded render branches deleted.** Three cadence:always entries appended (12 total, contract-parity gate green), statusline-visibility BEFORE install-incomplete so report row order matches today's render order. From scripts/doctor.cjs: the D/G/H inline blocks, the G and H --fix dispatches, BOTH hand-coded render branches, their two `if (name === '...') continue;` skip lines, the five dead function bodies, their private helpers (STALE_STATUSLINE_PATH_REGEX, stripAnsi, CLASS_H_CANONICAL_STEPS, classHActionString, userSettingsHasStatusLine), and the INSTALL_RECEIPT_JSON const all removed. renderHumanReport now special-cases only 'install-cache'.

## Task Commits

1. **Task 1: Create the G, H, D runner files** - `a678bf43` (feat)
2. **Task 2: Wire G/H/D registry entries, delete inline blocks + render branches + dead bodies** - `e12d0789` (refactor)

## Files Created/Modified

- `lib/core/doctor/statusline-visibility-module.cjs` - NEW. class-G runner: check (four-branch probe) + fix (migrator spawn, status/detail added, tool preserved). Exports `{ check, fix }`.
- `lib/core/doctor/install-incomplete-module.cjs` - NEW. class-H runner: check (receipt + settings-block detection; action_lines hint on warn+recoverable; defers to G when G fixed this run) + fix (runner-internal recoverable===true gate). Exports `{ check, fix }`.
- `lib/core/doctor/verify-surface-module.cjs` - NEW. class-D runner: check only (spawnSync e2e, 30s timeout, bash/harness-absent self-skip). Exports `{ check }`.
- `data/doctor-modules.json` - MODIFIED. 3 new cadence:always entries (statusline-visibility 1.12.5 fix_supported:true; install-incomplete 1.13.0-beta.9 fix_supported:true, flag statuslineVisibility shared with G; verify-surface 1.12.1-beta.1 fix_supported:false).
- `scripts/doctor.cjs` - MODIFIED (shrinks ~590 lines). Deleted the D/G/H inline blocks, G/H fix dispatches, both hand-coded render branches + skip lines, the five dead function bodies + their helpers + INSTALL_RECEIPT_JSON. Added the running-version PLUGIN_ROOT fallback.
- `tests/test-doctor-statusline-prefix-validator.cjs` - MODIFIED. The brand-hexagon-validator source-location pin now reads lib/core/doctor/statusline-visibility-module.cjs (the validator moved there byte-identical); the anti-silent-revert intent is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] introduced_version set to historical ship versions, not the plan's literal 1.15.3**
- **Found during:** Task 2 (pre-wiring deferred-guard analysis; the plan's read_first directed this).
- **Issue:** The plan artifact table specified `introduced_version: "1.15.3"` for all three entries. 1.15.3 is a STABLE release; the running version is the prerelease 1.15.3-beta.13, and semver sorts a stable AFTER its prerelease (semver.gt("1.15.3","1.15.3-beta.13") === true). The deferred-guard (`semver.gt(introduced, running)`) would DEFER all three on the current install, drop their report.checks rows, and fail the class G/H spawnSync tests.
- **Fix:** statusline-visibility 1.12.5 (Phase 106, `## [1.12.5] - 2026-05-03`), install-incomplete 1.13.0-beta.9 (Phase 95.6), verify-surface 1.12.1-beta.1 (Phase 95.1, same release as B/C/E). All valid semver, all <= running, so the deferred-guard is a no-op. Extends the Plan 02/03/04 introduced_version-correction precedent.
- **Files modified:** data/doctor-modules.json
- **Commit:** e12d0789

**2. [Rule 3 - Blocking] Engine running-version-of-record fallback to PLUGIN_ROOT/.claude-plugin/plugin.json**
- **Found during:** Task 2 (class G/H tests failed with report.checks empty).
- **Issue:** The class G/H tests override HOME (to isolate ~/.claude/settings.json), which breaks checkInstallVersion's install resolution -> the engine returned `status:'skip', running:null` and populated NO checks, so `report.checks['statusline-visibility']` was undefined and every class G/H test failed with "Cannot read properties of undefined". Pre-migration, class G/H were inline blocks that never needed the running version; as registry cadence:always modules they do. (The B/C/E tests override MINDRIAN_ROOMS_HOME, not HOME, so 217-04 never hit this.)
- **Fix:** After checkInstallVersion() fails to yield a version, the engine falls back to the running CODE's own PLUGIN_ROOT/.claude-plugin/plugin.json (HOME-independent). Scoped to the `opts.running === undefined` path so the explicit `opts.running:null` -> skip test seam (test-doctor-module-selector line 220) is preserved. A no-op for real installs (checkInstallVersion resolves first). This is the natural completion of the cadence:always design: a diagnostic must not go dark just because the install dir is not where checkInstallVersion looked.
- **Files modified:** scripts/doctor.cjs
- **Commit:** e12d0789

**3. [Rule 1 - Bug] Class H defers to class G when G's fix removed the statusLine this invocation**
- **Found during:** Task 2 (test-doctor-class-g-fix Test 1 failed: statusLine key NOT removed after --fix).
- **Issue:** G and H both act on ~/.claude/settings.json .statusLine with OPPOSITE fixes (G REMOVES a stale user override so plugin config applies; H WRITES the block when missing). Pre-migration, main() computed ALL class checks BEFORE dispatching ANY fix, so H's check saw the override present (returned ok) and H's fix never fought G's removal. The accumulative engine runs G fully (check+fix+recheck removes the override) BEFORE H's check (registry order), so H saw the now-missing override as an incomplete install and re-stamped it -- undoing G, and on a real marketplace-cache install re-introducing a broken legacy-path override.
- **Fix:** H's check reads the engine-recorded ctx.checks['statusline-visibility'].fix_result; when G's fix ran this invocation and H's result is the Step-2 settings-based warn (not the receipt-halted warn, which carries missingSteps[] and is orthogonal to G), H returns ok ("statusLine override removed by statusline-visibility --fix this run; plugin-level config applies"). This reproduces the pre-migration all-checks-then-all-fixes ordering without a broad engine restructure. Verified safe for the genuine install-incomplete case (test-doctor-class-h-fix: G is ok / does not fix there, so H still writes the block).
- **Files modified:** lib/core/doctor/install-incomplete-module.cjs
- **Commit:** e12d0789

**4. [Rule 3 - Test pin follows moved code] statusline-prefix-validator source pin redirected to the class-G runner**
- **Found during:** Task 2 (test-doctor-statusline-prefix-validator asserted doctor.cjs source carries the brand-hexagon validator).
- **Issue:** The pin greps a source file for the validator predicate to guard against a silent revert to the frozen-word "brand + MindrianOS" form. The migration MOVED the validator (byte-identical) from doctor.cjs into statusline-visibility-module.cjs, so the doctor.cjs grep failed.
- **Fix:** The pin now reads lib/core/doctor/statusline-visibility-module.cjs. This is a code-LOCATION pin, not a status/payload pin; the anti-silent-revert intent is unchanged. (Per the plan's "update only render-label/location pins, never statuses/payloads".)
- **Files modified:** tests/test-doctor-statusline-prefix-validator.cjs
- **Commit:** e12d0789

## Authentication Gates

None.

## Verification

- `node tests/test-doctor-module-contract-parity.cjs` -> ALL PASS (12 registry modules pass the 9-rule D-03 gate; negative self-test bites).
- `node tests/test-doctor-class-g.cjs` -> 6/6; `node tests/test-doctor-class-g-fix.cjs` -> 3/3 (stale + --fix removes the override and it STAYS removed; clean + --fix no migrator; disableAllHooks gate holds).
- `node tests/test-doctor-class-h.cjs` -> 3/3; `node tests/test-doctor-class-h-fix.cjs` -> 3/3 (--fix writes the canonical block, idempotent re-run, post-fix ok).
- `node tests/test-doctor-statusline-prefix-validator.cjs` -> 8/8; `node tests/test-doctor-fix-renderer.cjs` -> 12/12; `node tests/test-doctor-module-selector.cjs` -> 19 (explicit running:null -> skip preserved).
- No-regression: class-b 5/5, class-c 3/3, class-e 3/3, class-f 4/4, ui-self-compliant 4/4, plugin-disabled-state 10/10.
- Task 1 smoke (the plan one-liner): G+H export check+fix, D exports check only, H fix skips when not recoverable -> ok.
- Acceptance: `--statusline-visibility --json` emits BOTH statusline-visibility + install-incomplete rows; `--verify-surface --json` emits verify-surface with a vocab status (skip legitimate when harness absent); skip-line grep == 0; renderHumanReport special-cases only 'install-cache'. Human render shows G then H with H's hint sub-line from action_lines. `node -c scripts/doctor.cjs` clean; no em-dashes in any created/modified file.

## Threat Surface

- T-217-03 (elevation via child spawn): verify-surface spawns a repo-root-resolved CONSTANT path (PLUGIN_ROOT join), never caller input; the 30s timeout is preserved; absent harness -> skip.
- T-217-01 (self-DoS): every runner check + fix is wrapped by the engine try/catch; the statusline-mos spawn keeps its 1500ms timeout and the migrator its 5000ms; H's stricter recoverable===true fix gate is runner-internal.
- T-217-SC: zero external packages installed.

## Next Phase Readiness

- The fix-carrying + child-spawn migration recipe is fully proven; only class A + brain-smoke + eureka-smoke remain, which Plan 06 documents as sanctioned carve-outs (class A stays the single hand-coded render path).
- The shared-flag opposite-fix coupling pattern (H defers to G via ctx.checks fix_result) is documented for any future family where two migrated checks write the same resource.
- No blockers.

## Self-Check: PASSED

- FOUND: lib/core/doctor/statusline-visibility-module.cjs, lib/core/doctor/install-incomplete-module.cjs, lib/core/doctor/verify-surface-module.cjs
- FOUND commits: a678bf43 (Task 1), e12d0789 (Task 2)

---
*Phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i*
*Completed: 2026-07-11*
