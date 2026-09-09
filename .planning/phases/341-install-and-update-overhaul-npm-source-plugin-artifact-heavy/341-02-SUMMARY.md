---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 02
subsystem: infra
tags: [npm-install, createRequire, eureka, embedding, doctor-fix, cjs]

# Dependency graph
requires:
  - phase: 341-01
    provides: "tests/run-all-341.sh aggregator + the two D-03/D-04 EXPECTED-RED tripwires this plan's new legs slot into"
provides:
  - "lib/core/eureka-deps-resolver.cjs: the single side-directory resolution authority (eurekaDepsRoot/requireEurekaDep/eurekaDepInstalled)"
  - "lib/core/eureka/eureka-enable.cjs: EUREKA_DEP_SPEC + buildEurekaInstallArgv (pure) + enableEureka (probe/lock/spawn/re-probe)"
  - "/mos:eureka enable subcommand, room-independent, --dry-run supported"
  - "doctor --fix eureka, real (spawns the same enable path, statusline-visibility-module.cjs idiom)"
  - "MINDRIAN_EUREKA_DEPS_ROOT test seam"
affects: [341-03, 341-04, 341-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createRequire(path.join(root, 'noop.js')) side-directory shim: the anchor file need not exist, Node walks upward from its directory to resolve node_modules"
    - "Never throw across a resolver boundary: eurekaDepsRoot/requireEurekaDep/eurekaDepInstalled all degrade to a documented default (path string, null, or plain object) instead of propagating"
    - "Probe-then-spawn-then-reprobe installer: enableEureka reports ok from a fresh filesystem probe after spawnSync, never from the exit code alone"
    - "doctor --fix spawns a dedicated script rather than installing inline (statusline-visibility-module.cjs fix() idiom), reused for fixEurekaSmoke"

key-files:
  created:
    - lib/core/eureka-deps-resolver.cjs
    - lib/core/eureka/eureka-enable.cjs
    - tests/test-341-eureka-deps-resolver.cjs
    - tests/test-341-eureka-enable-argv.cjs
  modified:
    - lib/core/eureka/embedding-spine.cjs
    - scripts/eureka-command.cjs
    - commands/eureka.md
    - commands/doctor.md
    - lib/core/doctor/class-s-eureka-smoke.cjs
    - skills/eureka/SKILL.md
    - skills/doctor/SKILL.md

key-decisions:
  - "EUREKA_DEP_SPEC pinned to '@huggingface/transformers@^4.2.0', read directly out of package.json's dependencies entry before plan 341-04 removes it -- this constant becomes the sole remaining record of that range."
  - "parseArgs in scripts/eureka-command.cjs normalizes a bare 'enable' (no ROOM_DIR positional) to sub='enable'/roomDir='.', the narrowest possible bypass of the two-positional shape for this one room-independent subcommand."
  - "Rule 1 bug fix (found live, not introduced by this plan): bare 'help' with no ROOM_DIR positional fell into the same unknown-subcommand trap as bare 'enable' would have; normalized to opts.help=true so USAGE prints, unblocking this plan's own verify command."
  - "fixEurekaSmoke's body is replaced but LAYERS/checkEurekaSmoke/_layer1..4 (including the known :180 isModelCached bug) are left untouched -- that surgery is plan 341-03's exclusive scope, kept out of this commit so the layer count stays at 4 between plans."

requirements-completed: [D-09, D-12, D-13]

# Metrics
duration: 55min
completed: 2026-09-09
---

# Phase 341 Plan 02: On-Demand Eureka Embedding Stack Installer Summary

**Single createRequire side-directory resolver plus a probe/lock/spawn/re-probe installer, wired into `/mos:eureka enable` and a now-real `doctor --fix eureka`, landed with the heavy dependency still present so the release train stays green before plan 341-04's payload cut.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-09
- **Completed:** 2026-09-09
- **Tasks:** 3 completed
- **Files modified:** 11 (4 new, 7 modified, 2 of the 7 are auto-regenerated skill mirrors)

## Accomplishments

- `lib/core/eureka-deps-resolver.cjs` is the ONE `createRequire` in the whole tree (confirmed zero prior hits, confirmed exactly one after): `eurekaDepsRoot()`, `requireEurekaDep(name)`, `eurekaDepInstalled(name)`, all never-throw, all package-name-guarded against path traversal (T-341-08).
- `lib/core/eureka/embedding-spine.cjs`'s two lazy `require('@huggingface/transformers')` call sites (`isModelCached`, `getEncoder`) now resolve through that one authority. The `encoder_unavailable` envelope is unchanged in shape; the literal `encoder_unavailable` occurrence count went from 10 (pre-edit) to 11 (post-edit, strictly `>=`).
- `lib/core/eureka/eureka-enable.cjs` ships `EUREKA_DEP_SPEC` (`@huggingface/transformers@^4.2.0`, the pinned range plan 341-04 will remove from `package.json`), a PURE `buildEurekaInstallArgv` (spawns nothing, unit-testable without a download), and `enableEureka` (idempotent probe, `acquireInstallLock`/`waitForUnlock`/`releaseInstallLock`, `spawnSync` with `input:''` and a 120000 ms timeout, success reported from a fresh filesystem re-probe, never the exit code alone).
- `/mos:eureka enable` is wired into `scripts/eureka-command.cjs`'s router, supports `--dry-run` (prints the resolved argv, spawns nothing), and works both as `ROOM_DIR enable` and bare `enable` (room-independent, the narrowest possible bypass of the room requirement).
- `doctor --fix eureka` is real: `fixEurekaSmoke` now spawns `eureka-command.cjs . enable` as a subprocess (shell-free, `input:''`, stderr capped at 500 chars), mirroring the `statusline-visibility-module.cjs` `fix()` idiom. The `{fixed, reason}` envelope and the 4-layer `LAYERS` registry are unchanged -- Class S's own layer surgery stays plan 341-03's job.
- The `/mos:eureka` command identity is untouched (D-12): `name: eureka`, `connects_to_spine: true`, `sub_mode: eureka-portfolio` all verified by grep, and `data/framework-names.json` shows zero diff.
- `bash tests/run-all-341.sh`: `PASS=9 FAIL=0 SKIP=17 EXPECTED-RED=2` (up from plan 341-01's `PASS=7 SKIP=19`; exactly the two new `tests/test-341-*.cjs` legs flipped SKIP -> PASS, the two D-03/D-04 tripwires are still honestly red pending plan 341-04's packaging cut).
- `bash tests/run-all-310.sh`: `PASS=9 FAIL=0 SKIP=2`, zero regression.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/core/eureka-deps-resolver.cjs and route embedding-spine's lazy requires through it** - `ac69095d` (feat)
2. **Task 2: Create lib/core/eureka/eureka-enable.cjs and wire /mos:eureka enable** - `f3976f0c` (feat)
3. **Task 3: Make doctor --fix eureka real** - `ec98625f` (feat)

Tasks 2 and 3 each triggered an automatic re-run of `node scripts/build-skill-mirrors.cjs` by the pre-commit hook (skill-mirror drift on `skills/eureka/SKILL.md` and `skills/doctor/SKILL.md` respectively, since both mirror the commands they changed); the regenerated mirrors were staged and included in the same commit rather than a follow-up one.

## Files Created/Modified

- `lib/core/eureka-deps-resolver.cjs` - the single side-directory resolution authority. 4 exports counted by grep: `eurekaDepsRoot`, `requireEurekaDep`, `eurekaDepInstalled`.
- `lib/core/eureka/embedding-spine.cjs` - `isModelCached` and `getEncoder` now resolve `@huggingface/transformers` via `requireEurekaDep` instead of a bare `require`; `createRequire` count in this file is 0 (the shim lives only in the resolver).
- `lib/core/eureka/eureka-enable.cjs` - `EUREKA_DEP_SPEC`, `buildEurekaInstallArgv`, `enableEureka`. Reuses `lib/core/npm-cli-resolve.cjs` and `lib/core/npm-install-lock.cjs` (Canon Part 7); zero `exec`/`execSync`/bare `spawnSync('npm', ...)`.
- `scripts/eureka-command.cjs` - `case 'enable'` in the router; `--dry-run` flag; `cmdEnable`; USAGE text; `parseArgs` normalization for bare `enable` and (Rule 1 fix) bare `help`.
- `commands/eureka.md` - `argument-hint` includes `enable`; routing table row; new `## Subcommand: enable` section. `name: eureka`, the connector block, `hitl_shape`/`hitl_why` untouched.
- `commands/doctor.md` - one line next to the `--eureka-smoke` bullet documenting `--fix eureka`.
- `lib/core/doctor/class-s-eureka-smoke.cjs` - `fixEurekaSmoke` body replaced (spawns the enable subcommand); `LAYERS`, `checkEurekaSmoke`, `_layer1`-`_layer4` untouched.
- `skills/eureka/SKILL.md`, `skills/doctor/SKILL.md` - regenerated mirrors (`node scripts/build-skill-mirrors.cjs`), not hand-edited.
- `tests/test-341-eureka-deps-resolver.cjs` - hermetic tmpdir suite, 6 arms, `PASS=6 FAIL=0`.
- `tests/test-341-eureka-enable-argv.cjs` - hermetic argv suite, 6 arms, `PASS=6 FAIL=0`, never spawns an install (construction-guarded: the file's own source is scanned for the spawning function's name).

## Decisions Made

- See `key-decisions` in the frontmatter above (EUREKA_DEP_SPEC provenance, the bare-`enable` normalization, the bare-`help` Rule 1 fix, and the plan-341-03 layer-surgery boundary).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bare `help` invocation of scripts/eureka-command.cjs**
- **Found during:** Task 2, while verifying this plan's own `<verify>` command `node scripts/eureka-command.cjs help | grep -q enable`
- **Issue:** `node scripts/eureka-command.cjs help` (no ROOM_DIR positional) parsed `roomDir='help'`, `sub=''`, fell into the `default:` "unknown subcommand" branch instead of printing USAGE -- a pre-existing defect, reproduced identically against the unmodified pre-Task-2 file.
- **Fix:** One-line normalization in `parseArgs`: `if (out.sub === '' && out.roomDir === 'help') out.help = true;`, mirroring the `-h`/`--help` flag path.
- **Files modified:** `scripts/eureka-command.cjs`
- **Verification:** `node scripts/eureka-command.cjs help | grep -q enable` now exits 0; full USAGE text prints, including the new `enable` line.
- **Committed in:** `f3976f0c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary to satisfy this plan's own literal verify command; no scope creep -- the fix is a one-line normalization scoped to the exact defect blocking verification, not a broader rewrite of the argv parser.

## Issues Encountered

- The pre-commit hook's `build-skill-mirrors --check` gate blocked the first commit attempt for Task 2 and Task 3 (both touched `commands/*.md`, which mirrors into `skills/*/SKILL.md`). Resolved by running `node scripts/build-skill-mirrors.cjs` and including the regenerated mirror file in the same commit -- not a deviation from the plan's own file list, since the mirror is auto-derived, not hand-authored.
- None otherwise. All three tasks passed every listed acceptance-criteria command on first or second (post-mirror-regen) attempt.

## User Setup Required

None - no external service configuration required. Zero real npm install anywhere in this plan's verification: `buildEurekaInstallArgv` is pure (no spawn), `enableEureka`'s idempotent probe short-circuited every test invocation in this plan (the pre-341-04 tree still has `@huggingface/transformers` in the plugin's own `node_modules`, so `eurekaDepInstalled` reports `installed:true` and no `spawnSync` ever ran, including inside `fixEurekaSmoke`'s own acceptance check). Confirmed after every test run: `test ! -d "$HOME/.mindrian/eureka-deps/node_modules/@huggingface"`.

## Next Phase Readiness

- Plan 341-03 (Class S layer surgery, the `model_installed` layer) can now call `eurekaDepInstalled` directly -- the resolution authority this plan built is exactly what makes that plan's "one resolution authority" claim true.
- Plan 341-04 (the real packaging cut) can now safely remove `@huggingface/transformers` from `package.json` `dependencies`: `EUREKA_DEP_SPEC` in `lib/core/eureka/eureka-enable.cjs` is the durable record of the pinned range, and every consumer already resolves through the side-directory-first, plugin-fallback resolver rather than a bare `require`.
- `doctor --fix eureka` and `/mos:eureka enable` are NOT yet wired end-to-end into `scripts/doctor.cjs`'s own `--fix --eureka-smoke` flag dispatch (that file is not in this plan's `files_modified` list and its class-S carve-out block does not currently branch on `flags.fix`). `fixEurekaSmoke` itself is correct and independently verified via direct call; the CLI dispatch wiring is left for a later plan to close, consistent with "Class S's LAYER surgery is deliberately NOT here; it is plan 341-03."
- No blockers.

## Self-Check: PASSED

- `lib/core/eureka-deps-resolver.cjs` exists, `node --check` exits 0 - FOUND
- `lib/core/eureka/eureka-enable.cjs` exists, `node --check` exits 0 - FOUND
- `tests/test-341-eureka-deps-resolver.cjs` exists, exits 0, `PASS=6 FAIL=0` - FOUND
- `tests/test-341-eureka-enable-argv.cjs` exists, exits 0, `PASS=6 FAIL=0` - FOUND
- Commit `ac69095d` (feat, eureka-deps-resolver) - FOUND in `git log --oneline`
- Commit `f3976f0c` (feat, eureka-enable + /mos:eureka enable) - FOUND in `git log --oneline`
- Commit `ec98625f` (feat, doctor --fix eureka) - FOUND in `git log --oneline`
- `bash tests/run-all-341.sh`: `PASS=9 FAIL=0 SKIP=17 EXPECTED-RED=2` - CONFIRMED
- `bash tests/run-all-310.sh`: `PASS=9 FAIL=0 SKIP=2` (zero regression) - CONFIRMED
- `node scripts/doctor.cjs --eureka-smoke --json` reports exactly 4 layers, exit 0 - CONFIRMED
- `node scripts/doctor.cjs --acceptance --pre-flight` exits 0 - CONFIRMED
- `node scripts/check-shape-declaration.cjs --check` exits 0 (advisory WARN only, pre-existing) - CONFIRMED
- `git status --porcelain` is empty (clean tree, only plan-declared files touched) - CONFIRMED

---
*Phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy*
*Completed: 2026-09-09*
