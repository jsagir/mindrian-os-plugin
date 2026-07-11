---
phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i
plan: 04
subsystem: infra
tags: [doctor, check-migration, cadence-always, d-01, d-02, d-04, registry-runner, class-b-fix, refactor]

# Dependency graph
requires:
  - phase: 217-01
    provides: cadence-gated accumulative engine (always pass, flag gate, fix-then-recheck flow, spread-into-report.checks, shared.cjs with readRegistry/findRoomRoot/PLUGIN_ROOT)
  - phase: 217-03
    provides: proven migration recipe (runner file + one registry entry), the introduced_version historical-ship-version precedent
provides:
  - Three fix-carrying-family doctor checks (B cascade-rooms, C cascade-rooms-active, E room-md) migrated from inline main() blocks into registry-driven cadence:always runner files
  - The NEVER-WIRED class B --fix implemented for real (RCA doctor-fix-class-b-unwired.md closed from the code side, D-04's preferred resolution): fix(ctx) creates missing .room-root sentinels for rooms whose dir exists, honors dryRun, suggests dir-missing rooms
  - Class C positional simulateWritePath signature refactored to ctx.flags.simulateWrite (Pitfall-5)
  - Class E performRoomMdRecovery co-located with its check; the old hand-wired main() fix dispatch retired in favor of the engine fix-then-recheck flow
  - doctor.cjs shrunk (four dead function bodies + three now-dead helpers + one dead import removed)
affects: [217-05, 217-06, 217-07, doctor-check-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fix-carrying migrated check = one runner file (check + fix) + one cadence:always registry entry with fix_supported:true; the engine's fix-then-recheck flow owns dispatch (fix on warn, recovered plumbing, re-check) so no hand-wired main() branch is needed"
    - "the class B fix mirrors the canonical room-creation writer's content contract (lib/core/room-auto-create.cjs: empty file, mode 0o644) and writes ONLY the literal .room-root filename, never a caller-supplied path (T-217-03)"
    - "a fixer that returns its OWN tool field (room-md's tool:'generate-section-intelligence') keeps that field through the engine's Object.assign({tool: mod.id}, fixRes) glue; a fixer that omits it inherits tool:mod.id (cascade-rooms -> tool:'cascade-rooms')"

key-files:
  created:
    - lib/core/doctor/cascade-rooms-module.cjs
    - lib/core/doctor/cascade-rooms-active-module.cjs
    - lib/core/doctor/room-md-module.cjs
  modified:
    - data/doctor-modules.json
    - scripts/doctor.cjs
    - tests/test-doctor-class-b.cjs

key-decisions:
  - "introduced_version for cascade-rooms / cascade-rooms-active / room-md set to 1.12.1-beta.1 (the HISTORICAL Phase 95.1 ship version), NOT the plan's literal 1.15.3. 1.15.3 is a STABLE release which sorts AFTER the current running prerelease 1.15.3-beta.13 (semver: stable > prerelease), so the cadence:always deferred-guard (semver.gt(introduced, running)) would DEFER all three modules, drop their report.checks rows, and fail the class B/C/E spawnSync tests (which run the real doctor.cjs at the real running version). Historical ship versions make the guard a no-op everywhere the check should run. Extends the Plan 02 + Plan 03 introduced_version-correction precedent (this plan's own read_first explicitly directed it)."
  - "the class B sentinel-repair writer mirrors lib/core/room-auto-create.cjs (empty file, mode 0o644) rather than room-birth.cjs's richer JSON {room,active,born}. The .room-root content contract is genuinely inconsistent across the codebase (empty, 'mindrian-room\\n', and JSON all appear) and the class B check only tests sentinel EXISTENCE. The empty-file writer is the safest mirror for a REPAIR: it never fabricates room metadata (active-flag, born-date, slug) that a repair cannot reliably know, and room-auto-create is the closest-in-spirit auto-create sibling."
  - "removed the now-exclusively-dead helpers (SKIP_DIRS, listSubdirs, invokeGenerator) and the resolveUmbilicalTarget import from doctor.cjs, not just the four named function bodies -- they had zero remaining call sites after the migration, so leaving them would be dead weight contradicting the phase's shrink goal"

patterns-established:
  - "the C runner shares the --cascade-rooms flag with the B runner (two registry entries, same flag:'cascadeRooms'), exactly reproducing the pre-migration single-flag/two-checks behavior"

requirements-completed: [D-01, D-02, D-04]

# Metrics
duration: ~35min
completed: 2026-07-11
---

# Phase 217 Plan 04: Migrate B/C/E + Wire the Never-Wired Class B Fix Summary

**The three fix-carrying-family doctor checks (cascade-rooms, cascade-rooms-active, room-md) move from inline main() blocks into registry-driven cadence:always runner files, and the phase's headline lands: class B's --fix -- advertised in commands/doctor.md since Phase 95.1 but NEVER wired (RCA doctor-fix-class-b-unwired.md) -- is implemented for real as the cascade-rooms runner's fix(ctx), which creates missing .room-root sentinels, honors dry-run, and is pinned by two new spawnSync regression tests.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-11
- **Tasks:** 2 (both auto)
- **Files:** 6 (3 created, 3 modified)

## Accomplishments

- **Three runners on disk, contract-compliant.** cascade-rooms (B) and room-md (E) export check+fix; cascade-rooms-active (C) exports check only. Each check returns a status in ok|warn|error|skip with a NON-EMPTY detail on every path (the plan's D-03 rule 9 addition: the pre-migration ok returns for B and E had no detail; both now carry one). All require from node built-ins + ./shared.cjs only, zero back-require of the doctor CLI (Pitfall 4). Module ids equal the existing report.checks keys so every downstream consumer + test stays stable.
- **The never-wired class B --fix is now real (D-04 closed from the code side).** cascade-rooms-module.cjs fix(ctx) reads ctx.check_result.missingSentinels and, per room: (a) dir exists + sentinel missing -> writes an empty `.room-root` (mode 0o644, mirroring room-auto-create.cjs) honoring ctx.dryRun; (b) dir itself missing -> pushes onto suggested[] with a 'room dir missing, not auto-created' note (never creates directories -- T-217-03). Returns {status, projected, suggested, errors, detail}. The engine's fix-then-recheck flow owns dispatch; report.recovered gets an entry with tool 'cascade-rooms' (inherited from mod.id since the fixer omits its own tool field). commands/doctor.md's class-B --fix claim is now TRUE in code (Plan 07 re-words the doc against this reality).
- **Class C Pitfall-5 signature refactored.** The pre-migration checkCascadeRoomsActive took a POSITIONAL simulateWritePath. The runner's check(ctx) remaps it: `const simulateWrite = (ctx.flags && ctx.flags.simulateWrite) || ctx.simulateWrite || null;` then runs the moved body. The --simulate-write test seam is preserved exactly.
- **Class E recovery co-located with its check.** room-md-module.cjs carries check + fix (performRoomMdRecovery moved in verbatim, invoked with ctx.check_result), plus its private helpers (SKIP_DIRS, listSubdirs, invokeGenerator with the generator path re-based off PLUGIN_ROOT). The recovery record's own tool:'generate-section-intelligence' field is preserved so the engine's recovered plumbing keeps the class-E record shape-identical.
- **Registry wired, inline blocks + dead bodies deleted.** Three cadence:always entries appended to data/doctor-modules.json (9 entries total, contract-parity gate green). From scripts/doctor.cjs: the B/C inline block, the E inline block, the E --fix dispatch, the four dead function bodies, the three now-dead helpers (SKIP_DIRS, listSubdirs, invokeGenerator), and the dead resolveUmbilicalTarget import all removed.
- **Regression pin for the headline bug.** Two new spawnSync sub-tests in test-doctor-class-b.cjs: --fix creates the missing sentinel + reports status ok + recovered tool 'cascade-rooms'; --fix --dry-run writes nothing.

## Task Commits

1. **Task 1: Create the B, C, E runner files (including the NEW class B fix)** - `9fa902fe` (feat)
2. **Task 2: Wire B/C/E registry entries, delete inline blocks + dead bodies, extend class B test** - `a887a693` (refactor)

## Files Created/Modified

- `lib/core/doctor/cascade-rooms-module.cjs` - NEW. class-B runner: check (sentinel scan, ok-path detail added) + fix (the NEW wiring -- creates missing sentinels, dryRun honored, dir-missing rooms suggested). Exports `{ check, fix }`.
- `lib/core/doctor/cascade-rooms-active-module.cjs` - NEW. class-C runner: check only, Pitfall-5 simulateWrite remap, non-empty detail on every path. Exports `{ check }`.
- `lib/core/doctor/room-md-module.cjs` - NEW. class-E runner: check (ok-path detail added) + fix (performRoomMdRecovery, tool field preserved). Self-contained SKIP_DIRS/listSubdirs/invokeGenerator, generator path off PLUGIN_ROOT. Exports `{ check, fix }`.
- `data/doctor-modules.json` - MODIFIED. 3 new cadence:always entries (cascade-rooms fix_supported:true, cascade-rooms-active false, room-md true), all introduced_version 1.12.1-beta.1.
- `scripts/doctor.cjs` - MODIFIED (shrinks). Deleted the B/C + E inline blocks, the E fix dispatch, the four dead function bodies, SKIP_DIRS + listSubdirs + invokeGenerator, and the resolveUmbilicalTarget import + stale comments.
- `tests/test-doctor-class-b.cjs` - MODIFIED. Two new spawnSync sub-tests (test4 fix-creates-sentinel + recovered, test5 dry-run-writes-nothing).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] introduced_version set to the historical ship version 1.12.1-beta.1, not the plan's literal 1.15.3**
- **Found during:** Task 2 (pre-wiring deferred-guard analysis; the plan's own read_first directed this).
- **Issue:** The plan artifact table specified `introduced_version: "1.15.3"` for all three entries. 1.15.3 is a STABLE release; the current running version is the prerelease 1.15.3-beta.13, and semver sorts a stable AFTER its prerelease (semver.gt("1.15.3","1.15.3-beta.13") === true). The cadence:always deferred-guard (`semver.gt(introduced, running)`) would therefore DEFER all three modules on the current install, drop their report.checks['cascade-rooms' / 'cascade-rooms-active' / 'room-md'] rows, and fail the class B/C/E spawnSync tests (which run the REAL doctor.cjs at the real running version, no injected running). It would also re-introduce Pitfall-1 silence on every pre-1.15.3 install.
- **Fix:** Set each entry to 1.12.1-beta.1 -- the historical Phase 95.1 ship version (CHANGELOG `## [1.12.1-beta.1] - 2026-04-30`, the release that shipped `--cascade-rooms` and `--room-md`). Valid semver, <= running in every environment where the check should be live, so the deferred-guard is a no-op. Extends the Plan 02 + Plan 03 introduced_version-correction precedent.
- **Files modified:** data/doctor-modules.json
- **Commit:** a887a693

**2. [Rule 3 - Blocking cleanup] Removed the now-exclusively-dead helpers + import beyond the four named function bodies**
- **Found during:** Task 2.
- **Issue:** The plan directs deleting the four dead function bodies. After that deletion SKIP_DIRS, listSubdirs, invokeGenerator (all solely used by checkRoomMd/performRoomMdRecovery) and the resolveUmbilicalTarget import (solely used by checkCascadeRoomsActive) had zero remaining call sites -- dead weight contradicting the phase's shrink goal.
- **Fix:** Removed all four along with their stale comments; re-based the room-md runner's generator path off PLUGIN_ROOT (shared.cjs) since invokeGenerator moved into the runner. `findRoomRoot` was dropped from the shared.cjs destructure (no remaining doctor.cjs consumer). Verified `node -c` + `require()` clean and all class tests green.
- **Files modified:** scripts/doctor.cjs
- **Commit:** a887a693

## Authentication Gates

None.

## Verification

- `node tests/test-doctor-module-contract-parity.cjs` -> ALL PASS (9 registry modules pass the 9-rule D-03 gate; negative self-test bites).
- `node tests/test-doctor-class-b.cjs` -> 5/5 (the 3 original pins + the 2 new fix pins: sentinel created + recovered tool:'cascade-rooms'; dry-run writes nothing).
- `node tests/test-doctor-class-c.cjs` -> 3/3 (simulateWrite seam intact via ctx.flags remap).
- `node tests/test-doctor-class-e.cjs` -> 3/3 (--fix invokes generator, recovered references generate-section-intelligence).
- `node tests/test-doctor-module-selector.cjs` -> 19; `node tests/test-doctor-fix-renderer.cjs` -> 12; `node tests/test-doctor-class-f.cjs` PASS; `node tests/test-doctor-plugin-disabled-state.cjs` PASS; `node lib/memory/doctor-deprecation-surface.test.cjs` PASS.
- `node tests/test-doctor-ui-self-compliant.cjs` -> 4/4 (doctor.cjs source stays forbidden-char-clean after the deletions).
- Hermetic class B fix fixture (dryRun writes nothing + projected==1; real fix writes the sentinel + re-check ok; dir-missing room suggested + not created) -> ALL PASS.
- `node scripts/doctor.cjs --cascade-rooms --json` (scratch home) -> cascade-rooms + cascade-rooms-active rows present with vocab statuses + non-empty detail. `--cascade-rooms` exits 0 (classFlagsActive exit-0 invariant intact). `--all --json` -> cascade-rooms, cascade-rooms-active, room-md all present as top-level rows.
- Acceptance greps: `grep -c "scripts/doctor" <each runner>` = 0; `function checkCascadeRoomsSentinel|checkCascadeRoomsActive|checkRoomMd|performRoomMdRecovery` = 0. `node -c scripts/doctor.cjs` clean; `require()` clean. No em-dashes in any created/modified file.

## Threat Surface

- T-217-03 (path tampering): cascade-rooms fix resolves room paths exactly as check does (roomsHome join + existsSync), never creates directories, honors dryRun, and writes only the literal '.room-root' filename -- verified by the dir-missing-room fixture (suggested, not created) and the dry-run pin.
- T-217-01 (self-DoS): every runner has per-item try/catch (soft-fail), and the engine wraps each runner + fixer in try/catch besides.
- T-217-SC: zero external packages installed.

## Next Phase Readiness

- The fix-carrying migration recipe is proven: runner check+fix + one registry entry (fix_supported:true) + the engine fix-then-recheck flow, no hand-wired main() branch. Plans 05-06 can migrate the remaining fix-carrying checks (G statusline, H install-incomplete, I install-state) the same way.
- The class B headline bug is closed from the code side; Plan 07 re-words commands/doctor.md against the now-true reality.
- No blockers.

## Self-Check: PASSED

- FOUND: lib/core/doctor/cascade-rooms-module.cjs, lib/core/doctor/cascade-rooms-active-module.cjs, lib/core/doctor/room-md-module.cjs
- FOUND commits: 9fa902fe (Task 1), a887a693 (Task 2)

---
*Phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i*
*Completed: 2026-07-11*
