---
phase: 106-statusline-visibility-context-window-broadcast
plan: 00
subsystem: testing
tags: [wave-0, scaffold, requirements, fixtures, feynman-runner, statusline, visibility, doctor-class-g, surface-detect]

# Dependency graph
requires:
  - phase: 95.1
    provides: doctor.cjs drift-detector framework + .room-root sentinel + sibling-not-subdir fixture pattern (D-04, D-05) reused by 106 fixture layout and 106-03 class G dispatch
  - phase: 87
    provides: Feynman test runner registry pattern (lib/memory/run-feynman-tests.cjs) + zero-runtime-dep CJS-only invariant
  - phase: 100
    provides: Wave-0 stub canonical pattern (canonical "to be implemented by plan NN-MM" message + exits 0) reused verbatim per Canon Part 7 reuse-before-build
provides:
  - 6 STATUS-106-01..06 requirement IDs registered in REQUIREMENTS.md (Pending status; ready for Wave 1+2 plans to flip to Complete)
  - 10 Wave 0 test stub files under tests/ exiting 0 with the canonical Phase 106 Wave 0 message
  - Test stub registration in lib/memory/run-feynman-tests.cjs TEST_FILES array (full suite picks up Phase 106 from Wave 0 onward)
  - 3 hermetic fixture directories (test/fixtures/statusline-visibility-stale-settings, statusline-visibility-clean, onboarding-first-session) with seed README + (where applicable) settings.json
  - ROADMAP.md Phase 106 plans list finalized (6 plans 106-00..05); placeholder "Plans: TBD" removed
affects: [106-01, 106-02, 106-03, 106-04, 106-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 stub canonical message: 'Phase 106 Wave 0 stub - to be implemented by plan 106-NN' (HYPHEN, not em-dash) — inherited verbatim from Phase 100/103/104/105 stub conventions"
    - "Sibling-not-subdir fixture layout under test/fixtures/ — Phase 95.1 D-04 pattern reused"
    - "Hermetic fixture envelope (MINDRIAN_ROOMS_HOME / HOME override) — Phase 95.1 D-05 pattern documented in each fixture README"
    - "TEST_FILES append-block at end of array (NOT mid-array insertion) preserves byte-stability of all existing entries — Phase 87 invariant"
    - "Per-stub owning-plan attribution embedded in the canonical message string so downstream-plan ownership is grep-able from the file itself (no separate manifest needed)"

key-files:
  created:
    - "tests/test-stale-settings-migration.cjs (106-01 owner; STATUS-106-01)"
    - "tests/test-context-monitor-d02-broadcast.cjs (106-02 owner; STATUS-106-02)"
    - "tests/test-statusline-glyph-isolation.cjs (106-02 owner; STATUS-106-02 carve-out fence)"
    - "tests/test-doctor-class-g.cjs (106-03 owner; STATUS-106-03 detection)"
    - "tests/test-doctor-class-g-fix.cjs (106-03 owner; STATUS-106-03 repair)"
    - "tests/test-statusline-banner-suppression.cjs (106-03 owner; STATUS-106-03 24h)"
    - "tests/test-fallback-echo-compose.cjs (106-04 owner; STATUS-106-04 compose)"
    - "tests/test-fallback-echo-30day.cjs (106-04 owner; STATUS-106-04 default-flip)"
    - "tests/test-onboarding-gate.cjs (106-05 owner; STATUS-106-05 first-session)"
    - "tests/test-surface-detect.cjs (106-04 owner; STATUS-106-06)"
    - "test/fixtures/statusline-visibility-stale-settings/README.md + settings.json"
    - "test/fixtures/statusline-visibility-clean/README.md + settings.json"
    - "test/fixtures/onboarding-first-session/README.md"
  modified:
    - ".planning/REQUIREMENTS.md (6 STATUS-106 traceability rows appended)"
    - ".planning/ROADMAP.md (Phase 106 Plans list finalized to 6 plans; TBD placeholder removed)"
    - "lib/memory/run-feynman-tests.cjs (10 stub paths appended to TEST_FILES at end of array)"

key-decisions:
  - "All 10 stubs ship with HYPHEN (not em-dash) per project hard rule, enforced via grep -l verification before commit"
  - "Stub owning-plan number is embedded in the console.log AND the comment so file-level grep alone identifies the downstream owner — no separate ownership manifest required"
  - "Fixtures land as Wave 0 alongside the test stubs (instead of deferring to Wave 1) so plans 106-01/03/05 inherit a hermetic substrate the moment they start; eliminates Wave 1 fixture-creation latency"
  - "ROADMAP.md plans list pre-declares all 6 plans (106-00..05) up front instead of growing the list incrementally as each plan ships — gives the executor and the orchestrator a single deterministic Wave 0/1/2 view"
  - "Run the full Feynman suite both before and after the registry edit to prove zero new failures introduced (155/159 baseline -> 165/169 post-106-00; same 4 pre-existing failures inherited)"

patterns-established:
  - "Pattern: Wave 0 scaffold lands EVERYTHING the downstream waves need (REQ IDs + test stubs + fixtures + ROADMAP plans list) in a single plan with 3 atomic commits — file-disjoint Wave 1 plans then run in parallel without contention"
  - "Pattern: stub-then-replace contract — downstream plans swap real test code into the EXISTING stub path so registry membership in run-feynman-tests.cjs is set once and stays stable across all of Wave 1 and Wave 2"
  - "Pattern: per-task atomic commit with conventional-commit type (chore for REQ/ROADMAP scaffolding, test for stubs + fixtures + registry) keeps the wave-0 history trivially bisectable"

requirements-completed: []  # Wave 0 scaffold; STATUS-106-01..06 stay Pending until their owning Wave 1/2 plans land

# Metrics
duration: ~5 min wall-clock for code edits + ~2 x 2 min Feynman suite verification (~9 min total active work)
completed: 2026-05-03
---

# Phase 106 Plan 00: Wave 0 Scaffold Summary

**Six STATUS-106-01..06 requirement IDs registered + 10 hyphen-strict failing test stubs with owning-plan attribution + 3 hermetic fixture directories + ROADMAP plans list finalized to 6 plans, all in 3 atomic commits with zero new Feynman-suite failures introduced**

## Performance

- **Duration:** ~9 min active work (3 commits + 2 full Feynman suite runs for before/after baseline diff)
- **Started:** 2026-05-02T22:44:28Z (PLAN_START_TIME)
- **Completed:** 2026-05-03T03:36:10Z
- **Tasks:** 3 (all 3 acceptance-criteria-passed)
- **Files modified:** 18 (3 modified + 15 created)

## Accomplishments

- Six STATUS-106-01..06 traceability rows appended to REQUIREMENTS.md, status Pending, ready for Wave 1+2 plans to flip to Complete
- ROADMAP.md Phase 106 plans list finalized to 6 plans (106-00..05); "Plans: TBD" placeholder eliminated
- 10 failing test stubs land under tests/ with HYPHEN-strict canonical message + per-stub owning-plan attribution; all 10 exit 0; downstream plans swap real tests into existing stub paths without registry plumbing
- 3 hermetic fixture directories scaffolded (stale-settings simulating the 2026-04-26 Aryeh Holtzberg incident, clean negative-case, onboarding-first-session no-touch-file) — fixtures inherit Phase 95.1 D-04 sibling-not-subdir + D-05 hermetic-via-MINDRIAN_ROOMS_HOME-override patterns
- All 10 stubs registered in lib/memory/run-feynman-tests.cjs TEST_FILES array at end-of-array (preserves byte-stability of every existing entry)
- Feynman suite delta: 155/159 (baseline pre-106-00) -> 165/169 (post-106-00); same 4 pre-existing failures inherited; zero new failures introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Register STATUS-106-01..06 in REQUIREMENTS.md and finalize ROADMAP.md plans list** - `bc1946c` (chore)
2. **Task 2: Create 10 Wave 0 test stubs and 3 fixture directories** - `8be15b3` (test)
3. **Task 3: Register all 10 Wave 0 test stubs in lib/memory/run-feynman-tests.cjs** - `15fc6ef` (test)

**Plan metadata commit:** pending — STATE.md + ROADMAP plan-progress + this SUMMARY.md will land in a single docs commit after self-check.

## Files Created/Modified

- `.planning/REQUIREMENTS.md` — Appended 6 STATUS-106-01..06 rows to traceability table after JTBDCONS-104-05
- `.planning/ROADMAP.md` — Replaced "Plans: TBD" placeholder under "### Phase 106:" with finalized 6-plan list (106-00..05)
- `lib/memory/run-feynman-tests.cjs` — Appended 10 stub path.join entries at end of TEST_FILES array, preceded by a 4-line comment block explaining the Phase 106-00 Wave 0 contract
- `tests/test-stale-settings-migration.cjs` — Stub for STATUS-106-01 (D-01 self-healing settings; owner 106-01)
- `tests/test-context-monitor-d02-broadcast.cjs` — Stub for STATUS-106-02 (D-02 token-budget broadcast; owner 106-02)
- `tests/test-statusline-glyph-isolation.cjs` — Stub for STATUS-106-02 carve-out fence (forever-on regression fence; owner 106-02)
- `tests/test-doctor-class-g.cjs` — Stub for STATUS-106-03 detection (3 fixtures; owner 106-03)
- `tests/test-doctor-class-g-fix.cjs` — Stub for STATUS-106-03 repair (--fix dispatch; owner 106-03)
- `tests/test-statusline-banner-suppression.cjs` — Stub for STATUS-106-03 24h touch-file suppression (owner 106-03)
- `tests/test-fallback-echo-compose.cjs` — Stub for STATUS-106-04 fallback echo composition (owner 106-04)
- `tests/test-fallback-echo-30day.cjs` — Stub for STATUS-106-04 30-day default-flip (owner 106-04)
- `tests/test-onboarding-gate.cjs` — Stub for STATUS-106-05 onboarding gate first-session + version-bump re-fire (owner 106-05)
- `tests/test-surface-detect.cjs` — Stub for STATUS-106-06 CLI/Desktop/Cowork heuristics (owner 106-04)
- `test/fixtures/statusline-visibility-stale-settings/README.md` — Documents the 2026-04-26 Aryeh Holtzberg incident simulation
- `test/fixtures/statusline-visibility-stale-settings/settings.json` — Pinned `statusLine.command` referencing `mos/1.10.13/scripts/context-monitor` (the stale-cache-path the migration script must detect)
- `test/fixtures/statusline-visibility-clean/README.md` — Documents negative-case (migration script must be a no-op)
- `test/fixtures/statusline-visibility-clean/settings.json` — `{"agent": "larry-extended"}` only; no `statusLine` key
- `test/fixtures/onboarding-first-session/README.md` — Documents fresh-install onboarding gate scenario (HOME override redirects writes into tmp dir per test run)

## Decisions Made

- **Wave 0 scaffolds EVERYTHING up front (REQ IDs + test stubs + fixtures + ROADMAP).** Plan 106-00 deliberately lands fixture directories alongside test stubs (rather than deferring fixtures to Wave 1) so plans 106-01 / 106-03 / 106-05 don't have to pause to set up substrate. This is the same pattern Phase 100-00 / 103-00 / 105-00 used and matches Canon Part 7 (reuse-before-build).
- **Stub owning-plan number embedded in BOTH the comment AND the console.log string.** Downstream-plan ownership is grep-able from the test file alone — no separate manifest. The cost is one extra string per stub; the benefit is that plans 106-01..05 can each grep their own number to find their stub list without consulting any other file.
- **All 10 stubs land at end of TEST_FILES array, after Phase 105.** Mid-array insertion would change line numbers in unrelated entries; end-append preserves byte-stability for the entire pre-existing array. Phase 87 zero-new-deps + zero-side-effects invariant honored.
- **ROADMAP.md plans list pre-declared all 6 plans up front.** The alternative (let each plan land its own ROADMAP row) would create commit-history noise and make the orchestrator's wave-decomposition view inconsistent during Wave 1 execution. Pre-declaration is a one-time scaffold cost that eliminates that ambiguity.
- **HYPHEN strict enforcement at commit time, not just write time.** A grep -l for em-dash across all 15 new files runs as part of Task 2 acceptance criteria — em-dash detection failure would fail the task, not just produce a warning. Project hard rule per memory entry feedback_no_emdashes is treated as a blocker.

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks landed in their planned order with their planned content. All acceptance criteria passed on the first attempt. The Feynman runner returns exit 1 (not exit 0) but that is consistent with the plan's `<done>` clause: "exits 0 if pre-existing tests pass; or unchanged from pre-Wave-0 baseline if any pre-existing tests are red." The 4 inherited failures (test-self-update-platform, test/84-smart-notebook-copilot, lib/memory/debouncer-drain-at-prompt, lib/memory/post-compact-reinjection, lib/memory/decision-capture) are pre-existing baseline outside Phase 106 scope.

## Issues Encountered

- **`.planning/` directory is gitignored.** First attempt to commit Task 1 with `git add` failed because the project's .gitignore excludes the `.planning/` tree. Resolved by using `git add -f` (the historical pattern for Phase 100/103/104/105 force-adds; consistent with how every prior `feat(NN-00)` REQ-registration commit landed). Not a deviation — the workflow doc specified using gsd-tools commit helpers, and the manual `git add -f` is the documented project pattern when committing planning artifacts directly.
- **Test artifact `dashboard/graph.json` regenerates during Feynman suite runs.** The full-suite run touched dashboard/graph.json as a side-effect of one of the existing tests. Discarded with `git checkout -- dashboard/graph.json` before committing Task 3. Not a deviation; this is expected pre-existing behavior in the dashboard test fixture.

## User Setup Required

None — no external service configuration required. All stub tests are hermetic (no network IO, no environment variables, no external dependencies). The fixture READMEs document hermetic envelope contracts (MINDRIAN_ROOMS_HOME / HOME overrides) for downstream plans to consume but do not require any user action at Wave 0.

## Next Phase Readiness

**Ready for parallel Wave 1 dispatch (106-01, 106-02, 106-03):**

- 106-01 (D-01 self-healing settings) can read the stale-settings fixture directly — no fixture scaffolding work required
- 106-02 (D-02 context-monitor token broadcast) has 2 dedicated stubs ready (test-context-monitor-d02-broadcast.cjs + test-statusline-glyph-isolation.cjs as the carve-out regression fence)
- 106-03 (D-03 doctor class G) has 3 dedicated stubs (detection, fix, banner suppression) AND can use BOTH fixtures (stale-settings + clean) for its 3-fixture detection matrix
- Wave 1 plans are file-disjoint per heuristic phase plan structure (CONTEXT.md table) — parallel-safe; no cross-plan contention on stubs or registry edits

**Ready for Wave 2 (106-04, 106-05):**

- 106-04 (D-04 fallback echo + D-06 surface detect) has 3 stubs (fallback-echo-compose, fallback-echo-30day, surface-detect) ready to be replaced
- 106-05 (D-05 onboarding + v1.12.5 release) has 1 stub (onboarding-gate) + the dedicated onboarding-first-session fixture; v1.12.5 release gate (CHANGELOG + plugin.json + package.json + git tag + marketplace ref) does not need a stub since it ships as a verification-gate not a code-test

**No blockers.** Plan 106-00 is the canonical Wave 0 scaffold; plans 106-01..05 can begin immediately.

---
*Phase: 106-statusline-visibility-context-window-broadcast*
*Completed: 2026-05-03*

## Self-Check: PASSED

All 16 created files exist on disk; all 3 modified files exist on disk; all 3 task commits (bc1946c, 8be15b3, 15fc6ef) verified via `git log --oneline --all | grep`. No missing items.
