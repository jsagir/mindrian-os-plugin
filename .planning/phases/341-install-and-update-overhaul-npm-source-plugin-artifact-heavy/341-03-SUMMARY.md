---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 03
subsystem: infra
tags: [class-s, eureka, doctor, embedding-spine, report-html, mcp-topology, tdd-style-tripwires]

# Dependency graph
requires:
  - phase: 341-02
    provides: "lib/core/eureka-deps-resolver.cjs (eurekaDepInstalled/requireEurekaDep, never-throw contract) that this plan's L5 and getEncoder/isModelCached already route through"
provides:
  - "Class S 5-layer split: L1-L4 blocker (capability reachable), L5 model_installed advisory (D-11)"
  - "The awaited isModelCached fix (Pitfall 6): cache-miss branch reachable, no cold-cache download inside a release gate"
  - "ENCODER_UNAVAILABLE_HINT: the one exported remedy constant, referenced by embedding-spine.cjs and report-html.cjs"
  - "tests/test-341-class-s-layer-split.cjs, tests/test-341-slim-install-honest-degrade.cjs, tests/test-341-eureka-no-brain-reach.cjs"
  - "D-12 topology baseline: eureka_critic LOCAL-only, zero Brain/Theo reach across 7 named files, one named+bounded npm egress"
affects: [341-04, 342]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Advisory layer contract: a layer can carry advisory:true so checkEurekaSmoke excludes only its ok:false from the overall reduction while still reporting it in full on the JSON payload (D-10 'never a silent no-op' applied to a passing gate)."
    - "Self-referential tripwire hygiene: a tripwire test that greps other files for network-call-shaped patterns must build its own pattern strings so its own source never contains the literal substring it is hunting for (verified against the exact acceptance grep)."
    - "Module._load scoped interception (finally-restored) to simulate a missing native dependency hermetically when both the side-directory AND the plugin-node_modules fallback would otherwise still find the real package on a pre-cut dev tree."

key-files:
  created:
    - tests/test-341-class-s-layer-split.cjs
    - tests/test-341-slim-install-honest-degrade.cjs
    - tests/test-341-eureka-no-brain-reach.cjs
  modified:
    - lib/core/doctor/class-s-eureka-smoke.cjs
    - scripts/doctor.cjs
    - tests/test-eureka-smoke.cjs
    - lib/core/eureka/embedding-spine.cjs
    - lib/core/eureka/report-html.cjs

key-decisions:
  - "L5 (model_installed) is APPENDED to the frozen LAYERS array rather than inserted, so the harness-pinned ids and order of L1-L4 never move; checkEurekaSmoke's overall-ok reduction explicitly excludes any layer carrying advisory:true, and _runLayer propagates the advisory flag from the raw layer-fn return onto the pushed payload object."
  - "_layer1 (deps_present) is now capability-only: it probes sqlite-vec alone. The heavy @huggingface/transformers probe moved to _layer5, which resolves through eurekaDepInstalled (lib/core/eureka-deps-resolver.cjs) -- the same authority the runtime and the installer use -- rather than re-implementing a second probe."
  - "The un-awaited isModelCached bug (class-s-eureka-smoke.cjs:180, pre-fix) is closed by adding an explicit spine._test.resolveDtype() call and awaiting isModelCached(model, cacheDir, dtype); demonstrated live (then reverted) that removing the await flips the dedicated cache-miss-reachability arm in tests/test-341-class-s-layer-split.cjs from PASS to FAIL, proving the test is a real regression trap, not incidental coverage."
  - "scripts/doctor.cjs's eureka-smoke-stack-ready passing-path return now includes each advisory layer's reason in `detail`, so a green pre-tag gate never hides 'model not installed' from the operator (D-10 applied to the gate itself, not just the probe)."
  - "ENCODER_UNAVAILABLE_HINT is exported from embedding-spine.cjs and required (not re-typed) by report-html.cjs, so the remedy sentence has exactly one source of truth across the stderr notice, the encoder_unavailable detail, the HTML report, and (independently, with its own Larry-sentence wording) Class S's L5 reason."
  - "tests/test-341-slim-install-honest-degrade.cjs discovered live that MINDRIAN_EUREKA_DEPS_ROOT alone cannot simulate a slim install on THIS pre-341-04 tree, because two of eureka-deps-resolver.cjs's fallback arms (requireEurekaDep's plain require(name), and eurekaDepInstalled's plugin-fallback fs.existsSync probe) resolve from the resolver's own real, unpackaged-yet node_modules rather than the fixture. Closed with a scoped, finally-restored Module._load interception (for the require-based arm) plus a monkeypatch of the already-loaded resolver module's exported eurekaDepInstalled function (for the fs-based arm, picked up by Class S's L5 because it re-requires the resolver fresh inside its function body on every call)."

requirements-completed: [D-10, D-11, D-12, D-13]

# Metrics
duration: 25min
completed: 2026-09-10
---

# Phase 341 Plan 03: Class S Blocker/Advisory Split + Eureka Topology Tripwire Summary

**Class S goes from 4 to 5 layers (L5 model_installed, advisory), the un-awaited isModelCached bug that let a cold-cache release gate perform a real model download is fixed, every encoder_unavailable degrade path now carries one canonical `/mos:eureka enable` remedy sentence, and a new grep tripwire freezes Eureka's zero-Brain/Theo topology before Phase 342 touches it.**

## Performance

- **Duration:** ~25 min (commit-to-commit span: 2026-09-10T06:27:15+03:00 to 06:39:48+03:00, plus prior reading/verification time not reflected in commit timestamps)
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 completed
- **Files modified:** 8 (3 new test files, 5 modified source files)

## Accomplishments

- `lib/core/doctor/class-s-eureka-smoke.cjs` LAYERS grew from 4 to 5 by APPENDING `{id: 'model_installed', name: 'L5 embedding-model-installed'}` -- verified the first four ids and their order are byte-identical to before this plan (`deps_present,vec_backend,model_probe,graceful_degrade`), satisfying the harness's wire-lock.
- `_layer1` no longer probes `@huggingface/transformers`; it probes `sqlite-vec` alone (still a real hard dependency post-341-04). `_layer5` resolves the model probe through `eurekaDepInstalled('@huggingface/transformers')` -- the one authority plan 341-02 built -- returning `{ok:true, advisory:true, reason:'embedding model stack installed at <dir> (<where>)'}` when present, or the exact Larry sentence `'Eureka is reachable; the local model is not installed yet - run /mos:eureka enable (one-time, about 380 MB)'` when absent.
- Fixed the live Pitfall 6 defect: `spine._test.isModelCached(model, cacheDir)` (no await, no dtype) became `await spine._test.isModelCached(model, cacheDir, dtype)` with `dtype` resolved via `spine._test.resolveDtype()`. Verified directly: pointing `MINDRIAN_MODEL_CACHE` at a fresh empty tmp dir now correctly reports `"cache miss ... downloads on first real embedding call"` in 101ms with no download, where the pre-fix code would have treated the returned Promise object as always-truthy and taken the cache-HIT branch (a real embed / real download) instead. Demonstrated live (then reverted) that removing the `await` flips `tests/test-341-class-s-layer-split.cjs`'s dedicated cache-miss-reachability arm from PASS to FAIL.
- `checkEurekaSmoke`'s overall-ok reduction now excludes any layer carrying `advisory:true`; `_runLayer` propagates the `advisory` flag from the raw layer-fn result onto the pushed payload object, so the JSON always shows the advisory layer's own `ok`/`reason` even when it never affects the run's overall verdict.
- `scripts/doctor.cjs`'s `eureka-smoke-stack-ready` acceptance point: layer-count literal moved from 4 to 5 in the SAME commit as the Class S edit (verified `grep -c "layers.length !== 5"` = 1, `grep -c "layers.length !== 4"` = 0); the passing-path `detail` now includes each advisory layer's `reason`, so a green `--acceptance --pre-tag` run never hides "model not installed" from the operator.
- `lib/core/eureka/embedding-spine.cjs` exports `ENCODER_UNAVAILABLE_HINT = 'model not installed - run /mos:eureka enable (one-time, about 380 MB)'`, appended to the `getEncoder` `require_failed` detail (the missing-package arm only -- `_forceUnavailable` and `load_failed` are untouched). `encoder_unavailable` literal count: 11 pre-edit -> 12 post-edit (`>=` holds); `error: 'encoder_unavailable'` literal count: 4 (untouched shape). Confirmed live that `maybeEmitDownloadNotice` already fires on a real cache miss (plan 341-02's reroute made this reachable; no further change needed here).
- `lib/core/eureka/report-html.cjs` requires the same exported constant (never re-typed: `grep -c "380 MB"` in this file returns 0) and appends it to the reasoning-mode caveat whenever `degrade_cause` is `encoder_unavailable` (including the unstated-cause default), escaped the same way every other interpolated value in the file is escaped. Verified the rendered HTML contains both `/mos:eureka enable` and `380 MB`.
- New `tests/test-341-class-s-layer-split.cjs` (6 arms, PASS=6 FAIL=0): the 5-id/order pin, advisory-failure-does-not-fail-the-run, blocker-still-blocks, the real L5 resolver-authority coupling (via a monkeypatch of `resolver.eurekaDepInstalled`), the L1 fixture proof (sqlite-vec present, no huggingface, L1 still passes), and the cache-miss-reachability regression trap.
- New `tests/test-341-slim-install-honest-degrade.cjs` (5 arms, PASS=5 FAIL=0, runs in 0.1s): the D-10 proof. Discovered live that a bare `MINDRIAN_EUREKA_DEPS_ROOT` override is insufficient to simulate "model absent" on this pre-341-04 tree (two resolver fallback arms still find the real package); closed with a scoped `Module._load` interception plus an `eurekaDepInstalled` monkeypatch, both restored in `finally`. Proves `getEncoder`/`embedTexts` degrade honestly with the remedy, Class S passes overall with L5 advisory `ok:false`, the HTML report carries the remedy, and `data/command-registry.json` has zero diff from `HEAD`.
- New `tests/test-341-eureka-no-brain-reach.cjs` (12 arms, PASS=12 FAIL=0): `eureka_critic` registers only inside `registerRouterTools` (the LOCAL server, wired from `bin/mindrian-mcp-server.cjs`), and `bin/mindrian-brain-mcp-client.cjs` mentions "eureka" nowhere at all; zero Brain/Theo reach across 7 named Eureka-surface files (comment lines excluded from the match); the ONE network-capable call in that 7-file surface is the npm `spawnSync` inside `eureka-enable.cjs`'s `enableEureka` (never `buildEurekaInstallArgv`, never the resolver -- `db.exec(...)` SQLite calls and the local self-respawn in `scripts/eureka-command.cjs` are correctly excluded as non-network); Phase 342's must-not-preclude list (5 `data/*.json` registries, `commands/eureka.md`'s `name`/`connects_to_spine`, the `--refresh-names` flag) is intact. Demonstrated live (then removed, no scratch file left behind): a poisoned scratch copy of `eureka-critic.cjs` with an injected `require('./brain-client.cjs')`, re-pointed at from a temporary copy of the test, flips exactly the one affected arm to FAIL (`PASS=11 FAIL=1`) with every other arm unaffected -- proof this is a real tripwire, not a tautology. This file's own source was verified to contain zero literal network-call-shaped substrings via the exact acceptance-criteria grep.
- `bash tests/run-all-341.sh`: `PASS=12 FAIL=0 SKIP=14 EXPECTED-RED=2` (up from plan 341-02's `PASS=9 SKIP=17`; the three new `tests/test-341-*.cjs` legs flipped SKIP -> PASS, the two D-03/D-04 tripwires are still honestly red pending plan 341-04's packaging cut).
- `bash tests/run-all-310.sh`: `PASS=9 FAIL=0 SKIP=2` (the pre-existing Test 10/Test 11 npx-publish self-test failure is a documented, unrelated known issue that this suite's own leg 8a marks SKIPPED; the "scoped working-tree diff" leg correctly SKIPPED once all three tasks were committed).
- `node scripts/doctor.cjs --acceptance --pre-tag` exits 0 (17/17 points) WITHOUT `DOCTOR_SKIP_EUREKA_SMOKE` set, on the pre-341-04 tree (full node_modules still present) -- confirming the split is green either way, per this plan's own success criterion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Split Class S into blocker plus advisory, fix the un-awaited isModelCached, and move the doctor point to 5 layers** - `9bd305df` (feat)
2. **Task 2: Make the slim-install degrade honest across every consumer** - `7ed96cd4` (feat)
3. **Task 3: Pin the Eureka topology with the D-12 no-drift tripwire** - `26957bcb` (test)

## Files Created/Modified

- `lib/core/doctor/class-s-eureka-smoke.cjs` - 5-layer LAYERS registry, `_layer1` capability-only, new `_layer5` advisory, `_runLayer`/`checkEurekaSmoke` advisory-aware reduction, the awaited `isModelCached` fix at `_layer3`.
- `scripts/doctor.cjs` - `eureka-smoke-stack-ready` point: layer-count literal 4 -> 5, label reworded to name the blocker/advisory split, passing-path `detail` now surfaces advisory reasons.
- `tests/test-eureka-smoke.cjs` - every arm updated for 5 layers + `mockL5`; integration arm asserts `layers[4].id === 'model_installed'`.
- `tests/test-341-class-s-layer-split.cjs` - new, 6 arms, `PASS=6 FAIL=0`.
- `lib/core/eureka/embedding-spine.cjs` - `ENCODER_UNAVAILABLE_HINT` constant, exported; appended to the missing-package `encoder_unavailable` detail only.
- `lib/core/eureka/report-html.cjs` - requires `ENCODER_UNAVAILABLE_HINT`, appends it to the reasoning-mode caveat when `degrade_cause` is `encoder_unavailable`.
- `tests/test-341-slim-install-honest-degrade.cjs` - new, 5 arms, `PASS=5 FAIL=0`, D-10 proof.
- `tests/test-341-eureka-no-brain-reach.cjs` - new, 12 arms, `PASS=12 FAIL=0`, D-12 topology tripwire, demonstrated live against an injected reach.

## Decisions Made

See `key-decisions` in the frontmatter above (advisory-append contract, L1/L5 split boundary, the isModelCached fix and its live-demonstrated regression trap, the doctor `detail` surfacing, the single `ENCODER_UNAVAILABLE_HINT` source of truth, and the two-mechanism fixture needed for a genuine slim-install simulation on a pre-341-04 tree).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own stated test approach] The `MINDRIAN_EUREKA_DEPS_ROOT`-only fixture cannot simulate a slim install on this tree**
- **Found during:** Task 2, while writing `tests/test-341-slim-install-honest-degrade.cjs`
- **Issue:** The plan's action text says pointing `MINDRIAN_EUREKA_DEPS_ROOT` at an empty temp directory is sufficient to make the resolver miss "on both arms." On this pre-341-04 tree (the heavy dependency is still physically present in the plugin's own `node_modules` by design), two of `eureka-deps-resolver.cjs`'s fallback arms do NOT consult that env var at all: `requireEurekaDep`'s plain `require(name)` fallback resolves from the resolver module's own real directory upward (hits the real package), and `eurekaDepInstalled`'s plugin-fallback arm is a pure `fs.existsSync` probe of the real plugin root (not require-based, not env-configurable). Without closing both, the test would silently exercise the REAL installed package instead of a simulated absence, defeating the entire point of the D-10 proof.
- **Fix:** Added a scoped, `finally`-restored `Module._load` interception (throws `MODULE_NOT_FOUND` for the exact request string `'@huggingface/transformers'`, delegates every other request unchanged) to close the require-based fallback, plus a monkeypatch of the already-loaded resolver module's exported `eurekaDepInstalled` function (picked up by Class S's L5 because it re-requires the resolver fresh inside its function body every call) to close the fs-based fallback. Both are restored before the test exits, in every code path.
- **Files modified:** `tests/test-341-slim-install-honest-degrade.cjs` (this deviation is entirely test-file-scoped; no production file was touched to accommodate it)
- **Verification:** All 5 arms pass; `getEncoder`/`embedTexts` genuinely return `encoder_unavailable` (not a real model result) under the fixture, and Class S's L5 genuinely reports `ok:false` (not the real "installed" state visible outside the fixture, which was independently confirmed earlier in Task 1's own manual verification).
- **Committed in:** `7ed96cd4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in the plan's stated test-fixture approach, Rule 1)
**Impact on plan:** Necessary for the D-10 proof to actually prove what it claims on this tree. No scope creep -- the fix is entirely contained inside the new test file; zero production code was changed to accommodate it, and the fixture technique (scoped monkeypatch, restored in finally) mirrors the precedent already used for the `isModelCached`/`getEncoder` regression trap in Task 1's own test.

## Issues Encountered

- While writing `tests/test-341-eureka-no-brain-reach.cjs`'s Arm 3 (the one-legitimate-egress check), an early draft used a literal `'spawnSync('` string inside an `assert.ok(hits[0].indexOf('spawnSync(') !== -1, ...)` call for extra specificity. This would have tripped this SAME test file's own acceptance criterion (`grep -Ec "https?://|spawnSync\(|npm view|api\.github" tests/test-341-eureka-no-brain-reach.cjs` must return 0) -- self-referential tripwire hygiene requires the test's own source to never contain the literal substrings it hunts for elsewhere. Resolved by re-checking the already-matched line against the same `NETWORK_PATTERN` regex object instead of re-typing the literal substring, and by escaping the parenthesis inside the regex literal itself (`\(` rather than `(`) so the raw grep-matchable substring never appears. Confirmed via the exact acceptance-criteria grep command before committing.
- No other issues. All three tasks passed every listed acceptance-criteria command on first or second attempt.

## User Setup Required

None - no external service configuration required. Zero real npm install, zero real model download, zero network call anywhere in this plan's three new test files or any modified source file (confirmed by the em-dash-adjacent no-network-call acceptance grep already run against `tests/test-341-eureka-no-brain-reach.cjs`, and by direct inspection of the `Module._load`/monkeypatch fixtures in `tests/test-341-slim-install-honest-degrade.cjs`, which intercept but never perform a real require).

## Next Phase Readiness

- Plan 341-04 (the real packaging cut) can now remove `@huggingface/transformers` from `package.json` `dependencies` with Class S already split: L1-L4 will still pass (sqlite-vec stays a hard dependency), and L5 will honestly flip to `ok:false` with the exact `/mos:eureka enable` remedy on a real slim install -- no code change needed in this file for that cut to land green. The two `run-all-341.sh` `EXPECTED-RED` tripwires (D-03 heavy-dependency absent, D-04 shrinkwrap-in-payload) are exactly what 341-04 is expected to flip to PASS.
- Phase 342 (Theo-Aware Intelligence Layer) has a recorded, demonstrated-real baseline to diff against: `tests/test-341-eureka-no-brain-reach.cjs` will fail loudly (not silently) the moment Eureka gains any Brain/Theo reach, which is exactly the signal Phase 342's own deliberate change should trip -- at which point that phase updates this test's baseline in its own commit, not by bypassing it.
- No blockers. This plan changed nothing about packaging, `package.json`, `scripts/release.sh`, or the marketplace, per its own stated scope.

## Self-Check: PASSED

- `lib/core/doctor/class-s-eureka-smoke.cjs` LAYERS ids in order `deps_present,vec_backend,model_probe,graceful_degrade,model_installed` - CONFIRMED
- `tests/test-341-class-s-layer-split.cjs` exists, `node --check` exits 0, `PASS=6 FAIL=0` - FOUND
- `tests/test-341-slim-install-honest-degrade.cjs` exists, `node --check` exits 0, `PASS=5 FAIL=0` - FOUND
- `tests/test-341-eureka-no-brain-reach.cjs` exists, `node --check` exits 0, `PASS=12 FAIL=0` - FOUND
- `tests/test-eureka-smoke.cjs`: `PASS=4 FAIL=0` - CONFIRMED
- Commit `9bd305df` (feat, Class S split + isModelCached fix) - FOUND in `git log --oneline`
- Commit `7ed96cd4` (feat, honest degrade across every consumer) - FOUND in `git log --oneline`
- Commit `26957bcb` (test, D-12 topology tripwire) - FOUND in `git log --oneline`
- `node scripts/doctor.cjs --eureka-smoke --json` reports 5 layers, `layers[4].id === 'model_installed'`, exit 0 - CONFIRMED
- `node scripts/doctor.cjs --acceptance --pre-tag` exits 0 (17/17), WITHOUT `DOCTOR_SKIP_EUREKA_SMOKE` set - CONFIRMED
- `bash tests/run-all-341.sh`: `PASS=12 FAIL=0 SKIP=14 EXPECTED-RED=2` - CONFIRMED
- `bash tests/run-all-310.sh`: `PASS=9 FAIL=0 SKIP=2` - CONFIRMED
- `git status --porcelain` is empty (clean tree, only plan-declared files touched across all three tasks) - CONFIRMED

---
*Phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy*
*Completed: 2026-09-10*
