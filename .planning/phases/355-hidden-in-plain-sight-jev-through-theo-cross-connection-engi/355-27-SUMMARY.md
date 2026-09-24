---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 27
subsystem: testing
tags: [close-out, phase-gate, requirements, theo-handoff, rethinking-room, gate-honesty]

# Dependency graph
requires:
  - phase: 355-01..355-26, 355-28
    provides: "every SUMMARY.md, 355-BASELINE.md, 355-VERIFICATION.md, 355-JEV-MEASUREMENT.md, 355-VALIDATION.md this plan cites verbatim"
provides:
  - "tests/run-all-355.sh: Part 8/Part 9 sweeps hard-gated over the final 6-file target list, plus a new navigation-chokepoint check on scripts/eureka-portfolio-report.cjs and lib/core/eureka/opportunity-harvest.cjs"
  - "lib/memory/run-feynman-tests.cjs: all 30 offline tests/test-355-*.cjs registered with Plan/HIPS comments"
  - ".planning/REQUIREMENTS.md: Phase 355 (HIPS family) section, HIPS-01..09 closed [x] with measured proof, HIPS-10 open [ ] with a stated reason"
  - "docs/2026-09-25-HANDOFF-theo-phase-355-results.md: dated M-side entry to Theo (T-3, T-2, T-5)"
  - "rethinking-mindrianos research trail + MindrianOS mirror, both committed"
affects: ["355.1 (depends on 355 CLOSED)", "any future Theo Phase 20 judgment-seam work reading the T-2 note", "any future canon-coverage work reading the T-3 note"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hard-gate conversion: run_if (SKIP-on-missing) legs converted to run (FAIL-on-missing) legs once every phase artifact is expected to exist, via a small wrapper function returning a shell exit code instead of inlining the branch in the loop"
    - "Never re-baseline: a genuinely new doctor --acceptance failing point discovered during close-out is named and left failing, not folded into the accepted baseline set, even when its root cause is confirmed external/environmental"

key-files:
  created:
    - docs/2026-09-25-HANDOFF-theo-phase-355-results.md
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-27-SUMMARY.md
    - "~/MindrianRooms/rethinking-mindrianos/research/2026-09-25-phase-355-hidden-in-plain-sight-close-out.md"
    - "~/MindrianOS/research/2026-09-25-phase-355-hidden-in-plain-sight-close-out.md"
  modified:
    - tests/run-all-355.sh
    - lib/memory/run-feynman-tests.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-VALIDATION.md
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/todos/pending/2026-07-03-registry-drift-gate-prevent-silent-command-disappearance-key.md
    - docs/OPEN-HANDOFFS.md
    - tests/test-355-direction-readers.cjs
    - tests/test-355-doctor-point.cjs

key-decisions:
  - "HIPS-10 (the phase gate row) is registered [ ] open, not [x], because bash tests/run-all-355.sh genuinely does not exit 0 today -- one new doctor icm-ruling-eval-fresh regression plus a pre-existing feynman-runner hang, both confirmed external to every Phase 355 file, both left visible rather than re-baselined or silently fixed"
  - "tests/run-all-353.sh was NOT added to the no-regression legs despite passing the plan's own 'was it green at BASE_355' test, because a live re-run shows it failing today for the identical root cause as icm-ruling-eval-fresh -- adding a leg known to fail for an out-of-scope reason would conflate that drift with 355's own proof"
  - "Two in-scope test-file bugs (test-355-doctor-point.cjs, test-355-direction-readers.cjs) were fixed as Rule 1 deviations rather than left broken, because both are 355's own test-355-*.cjs files this very task registers as the phase gate, and both bugs were caused by later 355/peer work landing after the test was written, not by any architectural issue"

requirements-completed: [HIPS-01, HIPS-02, HIPS-03, HIPS-04, HIPS-05, HIPS-06, HIPS-07, HIPS-08, HIPS-09]

# Metrics
duration: ~100min
completed: 2026-09-25
---

# Phase 355 Plan 27: Close-out Summary

**Nine of ten HIPS requirement rows closed with measured proof in REQUIREMENTS.md; the tenth (the phase gate itself) stays honestly open because a live run surfaced one new out-of-scope doctor regression and one pre-existing test-runner hang, neither caused by or fixable within any Phase 355 file.**

## Performance

- **Duration:** ~100 min (approximate; PLAN_START_TIME was not explicitly captured at session start)
- **Completed:** 2026-09-25 (local timezone, EEST/UTC+3; UTC still reads 2026-09-24 for most of the session)
- **Tasks:** 3 of 3 completed
- **Files modified:** 10 modified, 4 created (dev repo) + 2 created (home repo, room filing)

## Accomplishments

- `tests/run-all-355.sh`'s Part 8 and Part 9 sweeps converted from run_if (SKIP-on-missing) to hard `run` (FAIL-on-missing) over the final 6-file target list, plus a new navigation-chokepoint check proving `scripts/eureka-portfolio-report.cjs` still requires `navigation.cjs` and `lib/core/eureka/opportunity-harvest.cjs` stays read-only
- All 30 offline `tests/test-355-*.cjs` files registered in `lib/memory/run-feynman-tests.cjs`, each with a one-line Plan/HIPS comment; registration verified correct via an isolated extraction-and-spawn check (30/30 entries found and individually runnable, matching `ls tests/test-355-*.cjs | wc -l`)
- Nine HIPS requirement rows (HIPS-01..09) registered `[x]` in `.planning/REQUIREMENTS.md` with a `**Measured:**` line citing a real command and number for each; HIPS-10 registered `[ ]` open with a fully stated reason
- `355-VALIDATION.md` finalized: all 69 per-task rows set from real runs (66 green, 3 `skipped (not_adopted)` on 355-28's own correctly-skipped tasks), `nyquist_compliant: true`, approved with a documented exception
- Theo results handoff sent (`docs/2026-09-25-HANDOFF-theo-phase-355-results.md`): T-3 gets the unverified rate and hub-inflation share, T-2 gets the citation-check policy and its measured stated-vs-withheld agreement, T-5 gets the backend-field confirmation
- Research trail filed in `~/MindrianRooms/rethinking-mindrianos/research/` and mirrored to `~/MindrianOS/research/`, both committed

## Task Commits

Each task was committed atomically:

1. **Task 1: Final phase gate, test registration, validation sign-off (HIPS-10)** - `3ba25835d` (test)
2. **Task 2: Register and close HIPS-01..10; ROADMAP requirements line; D-26 todo annotation** - `4f13a0cc8` (docs)
3. **Task 3: Theo handoff entry (Section 5) and the rethinking-mindrianos research filing** - `caffc12fc` (docs, dev repo); `2f107e96f` (rethinking-mindrianos: file the entry, home repo); `593473a82` (rethinking-mindrianos: mirror to MindrianOS, home repo)

_All five commits verified as ancestors of their respective repo's current HEAD via `git merge-base --is-ancestor`._

## Files Created/Modified

- `docs/2026-09-25-HANDOFF-theo-phase-355-results.md` - the M-side durable entry to Theo (T-3, T-2, T-5), no em-dash, counts and buckets only
- `tests/run-all-355.sh` - hard Part 8/9 gates, navigation-chokepoint check, amended-test no-regression legs, header notes explaining the two excluded/documented gaps
- `lib/memory/run-feynman-tests.cjs` - 30 new TEST_FILES entries
- `.planning/REQUIREMENTS.md` - Phase 355 (HIPS family) section, Traceability updated (373 -> 383 active requirements)
- `.planning/ROADMAP.md` - Phase 355 card's Requirements line, Plans counter (28/28), 355-27 checkbox
- `.planning/todos/pending/2026-07-03-registry-drift-gate-...md` - D-26 ruling annotated
- `~/MindrianRooms/rethinking-mindrianos/research/2026-09-25-phase-355-hidden-in-plain-sight-close-out.md` and its `~/MindrianOS/research/` mirror
- `tests/test-355-doctor-point.cjs`, `tests/test-355-direction-readers.cjs` - two in-scope bug fixes (see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above. All three decisions are variations on one theme: this plan's own GATE HONESTY instruction ("do NOT re-baseline, weaken a leg, or mark a HIPS row [x] without proof") was treated as binding even where it meant leaving a row open, excluding a leg the letter of the plan's own instruction might otherwise have added, or shipping a phase close-out with a non-zero exit code on its own primary verify command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/test-355-doctor-point.cjs`'s stale "calibrate-citation-check.cjs missing" assumption**
- **Found during:** Task 1 (`bash tests/run-all-355.sh` first run)
- **Issue:** The test was written by 355-21, before 355-26 landed `scripts/calibrate-citation-check.cjs`. Its own comment said the script "does not exist yet," and its exit-0 leg asserted exactly one `spawnImpl` call and `calibrate-citation-check.cjs` status `not_run`. Both scripts now exist, so `checkCrossConnectionHonesty` correctly spawns both, and the test's stale assumption failed two checks.
- **Fix:** Updated the test to expect two `spawnImpl` calls (both scripts), and `calibrate-citation-check.cjs` status `ok` (not `not_run`), with an updated comment explaining the 355-26 landing timeline.
- **Files modified:** `tests/test-355-doctor-point.cjs`
- **Verification:** `node tests/test-355-doctor-point.cjs` now 28/28 (was 25 PASS / 2 FAIL)
- **Committed in:** `3ba25835d` (Task 1 commit)

**2. [Rule 1 - Bug] `tests/test-355-direction-readers.cjs`'s fake MCP server mock, stale for the Phase 267-06 `server.tool` -> `server.registerTool` rewrite**
- **Found during:** Task 1 (`bash tests/run-all-355.sh` first run)
- **Issue:** Phase 267-06 (a peer phase, landed on `main` after 355-12) rewrote every `lib/mcp/tool-router.cjs` registration site from `server.tool(name, desc, shape)` to `server.registerTool(name, {title, description, inputSchema: z.object(shape)}, handler)`. This test's own fake server only implemented `.tool()`, so `registerRouterTools` threw `server.registerTool is not a function` and the leg-1f eureka_critic schema capture never ran.
- **Fix:** Updated the fake server's mock method from `tool(name, _desc, schema)` to `registerTool(name, config, _handler)`, capturing `config.inputSchema.shape` (the zod object's raw per-field shape map, equivalent to the pre-267-06 third argument) instead of the raw third argument. No production code touched.
- **Files modified:** `tests/test-355-direction-readers.cjs`
- **Verification:** `node tests/test-355-direction-readers.cjs` now 28/28 (was FAIL: crashed before completing)
- **Committed in:** `3ba25835d` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, test-file bugs caused by other 355/peer work landing after the test was written).
**Impact on plan:** Both fixes were required for Task 1's own verify command to run cleanly and were scoped entirely to test-file mock code, never production logic. No scope creep; both are documented here per the deviation-documentation contract.

## Issues Encountered (not deviations - genuine open gaps, documented not fixed)

**1. `doctor --acceptance`'s new `icm-ruling-eval-fresh` point FAILS live, outside the BASE_355 baseline.**
`evals/icm/last-run.json`'s stamped `plugin_version` (2.0.0-beta.48) has fallen behind the running repo's version (2.0.0-beta.50) because concurrent peer sessions in this shared tree cut releases without re-running the eval that refreshes the stamp. That eval (`scripts/eval-icm-writers.cjs`) is confirmed Phase 353/356 peer territory (355-BASELINE.md's own D-57 gate sweep). The identical root cause independently fails `tests/run-all-353.sh`'s own `section-command-ledger` leg live today, even though that suite was recorded green at Phase 353's own close-out. Per this plan's own "never re-baseline" instruction, this point was NOT added to the accepted doctor baseline, and `tests/run-all-353.sh` was NOT added to the no-regression legs. Both exclusions are documented in `tests/run-all-355.sh`'s own header, `deferred-items.md`, and `.planning/REQUIREMENTS.md` HIPS-10's open row. Resolution needs a peer/navigator session to re-run `scripts/eval-icm-writers.cjs`.

**2. `node lib/memory/run-feynman-tests.cjs`'s full historical registry hangs, reproducibly, on a pre-existing legacy test.**
Two isolated attempts both stall permanently partway through `test/84-smart-notebook-copilot.test.cjs` Case 13 (its own `spawnSync('bash', [onStop], {timeout: 10000})` call). Root cause, read from the test file, not fixed: if `scripts/on-stop` backgrounds a detached grandchild that inherits the parent's stdout/stderr file descriptors, that grandchild keeps the pipe open after the 10s-timed-out parent dies, and Node's `spawnSync` blocks reading until EOF on a pipe that will never close. `git status --short` on the test file and `scripts/on-stop` is clean; neither is in any Phase 355 plan's `files_modified`. **This does not mean the 30 new registrations are unproven**: an isolated script that extracts and individually spawns just the 30 `tests/test-355-*.cjs` entries confirmed every one exits correctly (29 PASS, 1 the documented leg-H FAIL), so the registration mechanism itself is proven separately from the full historical corpus's own pre-existing hang.

Both issues are logged in full technical detail in `deferred-items.md` and named as HIPS-10's open reason in `.planning/REQUIREMENTS.md`.

## User Setup Required

None - no external service configuration required.

## Gate Results (verbatim, for the record)

- `bash tests/run-all-355.sh`: **PASS=69 FAIL=4 SKIP=0** (stable across three separate runs during this session). Three FAILs are the BASE_355-documented external reds, confirmed byte-identical to their documented state: `test-355-direction-agreement.cjs` leg H (unresolved hits: `lib/core/rs-chain-feeder.cjs`, `lib/memory/test-rs-discovery-engine.cjs`), `run-all-272.sh`'s `272-cache-probe.test.cjs` (`@huggingface/transformers` `ModelRegistry.is_pipeline_cached` API gap), `part8-egress-guard.test.cjs` PB8-03. The fourth FAIL is the new `icm-ruling-eval-fresh` doctor point (Issue 1 above).
- `node lib/memory/run-feynman-tests.cjs`: could not be run to completion this session (Issue 2 above). The 30 newly-registered entries were individually verified correct via an isolated spawn check (29 PASS, 1 documented FAIL matching the same leg-H finding).
- HIPS rows closed vs left open: **9 closed** (HIPS-01 through HIPS-09, each with a `**Measured:**` line citing a real command and number) **, 1 left open** (HIPS-10, phase gate, with the two reasons above stated in full).

## Next Phase Readiness

Phase 355 is CLOSED per the navigator's own close-out discipline: every measurable deliverable (direction convention, floor disclosure, naming honesty, verification stamp, five-producer stamp rendering, proposed-only filing, the first human-judged hit rate, the HSI `not_adopted` decision, the citation/usefulness calibration) is proven with real numbers in `REQUIREMENTS.md`; the one open row (HIPS-10) is honestly left open with two named, external, peer-territory reasons rather than force-closed. `/gsd-execute-phase 355.1` is unblocked (355.1-01 gates only on Phase 355 being CLOSED, which this plan achieves in spirit and in ROADMAP's 28/28 plan count, even though HIPS-10 itself stays open). Any future GSD session touching `tests/run-all-355.sh` or `.planning/REQUIREMENTS.md`'s HIPS-10 row should first check whether a peer has re-run `scripts/eval-icm-writers.cjs` (closing the icm-ruling-eval-fresh gap) before assuming it still applies.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-25*

## Self-Check: PASSED

- `docs/2026-09-25-HANDOFF-theo-phase-355-results.md` FOUND
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-27-SUMMARY.md` FOUND
- `~/MindrianRooms/rethinking-mindrianos/research/2026-09-25-phase-355-hidden-in-plain-sight-close-out.md` FOUND
- `~/MindrianOS/research/2026-09-25-phase-355-hidden-in-plain-sight-close-out.md` FOUND
- Commits `3ba25835d`, `4f13a0cc8`, `caffc12fc` FOUND in `git log --oneline --all` (dev repo)
- Commits `2f107e96f`, `593473a82` FOUND in `git -C ~ log --oneline --all` (home repo)
- All five commits independently re-verified as ancestors of their respective HEAD via `git merge-base --is-ancestor`
