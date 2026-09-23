---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 13
subsystem: infra
tags: [doctor, acceptance, diagnostics, child-process, tier-5, sys-07]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "354-11/354-12 landed first per this plan's own depends_on (wave 6); no functional dependency on their content -- runAcceptance/buildAcceptanceChecklist were untouched by either"
provides:
  - "runBoundedChild(cmd, args, opts) in scripts/doctor.cjs: drop-in cp.spawnSync wrapper, SIGKILL-bounded, reports timed_out/pid/duration_ms"
  - "Per-point duration_ms, summary.duration_ms, summary.slowest in doctor --acceptance JSON output"
  - "[acceptance] <id> start/done <ok|FAIL> <ms>ms stderr progress lines (suppressible via MINDRIAN_ACCEPTANCE_PROGRESS=0)"
  - "DOCTOR_TEST_ONLY_POINTS and DOCTOR_TEST_HANG_POINT test-mode hooks (DOCTOR_TEST_MODE=1 only)"
  - "tests/test-354-acceptance-diagnostics.cjs: hermetic regression proving all of the above plus no-orphan-after-exit"
  - ".planning/debug/sys-07-acceptance-timing.md: RCA classifying SYS-07 WORKING from a measured clean rerun (18/18 pre-tag, 20/21 full with one real dirty-tree finding, zero timeouts, zero orphans)"
affects: [354-16, 354-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runBoundedChild as the single chokepoint for acceptance-point child spawns: field-name-compatible with raw cp.spawnSync results (status/signal/stdout/stderr) so existing call sites reroute with no downstream-shape break, additive fields (timed_out/pid/duration_ms/cmd/timeout_ms) carry the new diagnostic"
    - "Test-mode-only checklist hooks (DOCTOR_TEST_ONLY_POINTS point-id filter, DOCTOR_TEST_HANG_POINT hang injection) applied as a post-filter map/filter in runAcceptance rather than threading test-only state into buildAcceptanceChecklist's point definitions -- keeps the injection blast radius to exactly one point per test run"
    - "stdout/stderr protocol split for a JSON-emitting CLI gate: human-readable per-point summary routes to stderr under --json (JSON.parse(stdout) works with no indexOf('{') workaround), stdout stays unchanged for non-JSON invocations"

key-files:
  created:
    - tests/test-354-acceptance-diagnostics.cjs
    - .planning/debug/sys-07-acceptance-timing.md
  modified:
    - scripts/doctor.cjs

key-decisions:
  - "Task 1's test injects the hang via DOCTOR_TEST_HANG_POINT on version-of-record-repo (a point that normally spawns no child at all) rather than on a point with a real child spawn -- the hang-injection path in runAcceptance fully replaces the point's run() with a synthetic hanging child, so any point id works as the target; version-of-record-repo + install-state were chosen because both apply to the pre-tag tier and are individually fast, keeping the regression hermetic and quick"
  - "Deviation (Rule 1/2): the pre-existing --acceptance --json dispatch in main() printed human-readable PASS/FAIL + summary lines to stdout even under --json, so stdout never actually parsed as clean JSON via a direct JSON.parse (pre-existing gap, not introduced by this plan, but directly blocking this plan's own must-have truth 'stdout JSON stays parseable'). Rerouted that summary to stderr when flags.json is set; every existing test fixture's indexOf('{') workaround still works unchanged (now a no-op on the --json path)"
  - "Task 3's clean rerun ran inside this executor's own Bash tool (there is no separate 'outside the sandbox' terminal available to a GSD executor) but verified network reachability and exercised real network round-trips (npm registry, theo-mcp.onrender.com) as the closest available proxy for 'outside the mock-server-restricted environment' the plan asked for -- documented explicitly in the RCA's Meta section rather than silently assumed"
  - "The one full-mode failure observed during the clean rerun (verify-release-clean-tree: 6 tracked files dirty) is classified as an expected, correctly-detected point failure caused by ~5 concurrent peer Claude Code sessions editing this shared repo during the same window, NOT a runner defect -- confirmed via git log showing 4 unrelated peer commits landing between this plan's own three commits"
  - "requirements mark-complete called for SYS-07 only, after confirming REQUIREMENTS.md's SYS-07 row names Plan 354-13 as its sole owner"

requirements-completed: [SYS-07]

# Metrics
duration: 45min
completed: 2026-09-23
---

# Phase 354 Plan 13: Acceptance-Runner Diagnostics (SYS-07) Summary

**Instruments `doctor --acceptance` with per-point timing, stderr progress, and SIGKILL-bounded child spawns via a new `runBoundedChild` helper, then reruns clean and classifies the 2026-09-20 F-07 "acceptance gate did not terminate" finding as WORKING (a visibility gap, not a hang) from measured data.**

## Performance

- **Duration:** 45 min
- **Completed:** 2026-09-23
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- **Task 1 (RED):** `tests/test-354-acceptance-diagnostics.cjs` spawns `doctor --acceptance
  --pre-tag --json` under `DOCTOR_TEST_MODE=1` with `DOCTOR_TEST_ONLY_POINTS`,
  `DOCTOR_TEST_HANG_POINT`, and `DOCTOR_ACCEPTANCE_CHILD_TIMEOUT_MS=800`, bounded by its own outer
  120s SIGKILL timeout. Ran against the pre-instrumentation `doctor.cjs`: 5 of 6 assertions failed
  (exit 1, as required) because none of the filter/timing/hang/progress hooks existed yet.
- **Task 2 (GREEN):** Added `runBoundedChild(cmd, args, opts)` (a drop-in `cp.spawnSync` wrapper,
  `DOCTOR_ACCEPTANCE_CHILD_TIMEOUT_MS` or 120000ms default, always `SIGKILL`). Rerouted the 4
  previously timeout-less acceptance-point child spawns (the two `git` probes in
  `version-of-record-published`, the `git` probe and `node --check` in `npx-roundtrip`) plus
  `verify-release`, for 6 real call sites (7 total occurrences of `runBoundedChild(` including the
  definition; the DOCTOR_TEST_HANG_POINT injection in `runAcceptance` is the 7th call site,
  bringing the true call-site count to 6 non-test plus 1 test-mode-only). Confirmed by direct
  inspection: 13 real (non-comment) `cp.spawnSync(` calls remain inside `buildAcceptanceChecklist`
  and every one of them already carried an explicit `timeout` (11 inline, 2 -- brain-smoke and
  eureka-smoke -- on the following source line of the same call), so none needed rerouting to
  satisfy "no cp.spawnSync without a timeout." `runAcceptance` now records `duration_ms` per
  point, `summary.duration_ms`/`summary.slowest`, and writes `[acceptance] <id> start`/`done
  <ok|FAIL> <ms>ms` to stderr (suppressible via `MINDRIAN_ACCEPTANCE_PROGRESS=0`), and honors
  `DOCTOR_TEST_ONLY_POINTS`/`DOCTOR_TEST_HANG_POINT` under `DOCTOR_TEST_MODE=1`. Test-354's own
  regression: 6/6 green. All 3 `tests/test-doctor-acceptance*.cjs` siblings: 8/8 + 6/6 + 6/6, no
  regression. A live `doctor --acceptance --pre-tag --json` run: 18/18 points, clean JSON.
- **Task 3 (classify):** Ran a clean `--pre-tag` (18/18 points, 83.6s wall clock) and `full`
  (20/21 points, 101.4s wall clock, one real `verify-release-clean-tree` finding) acceptance run
  wrapped in `/usr/bin/time -v`, with an orphan-process `ps` check after each. Zero `timed_out:
  true` children in either run; all 3 network-touching points (`version-of-record-published`,
  `npx-roundtrip`, `activation-reached-the-wire`) completed normally with real round trips. Wrote
  `.planning/debug/sys-07-acceptance-timing.md` (kind: rca) classifying **SYS-07: WORKING**.

## Task Commits

1. **Task 1: Failing regression** - `63a1fbecb` (test)
2. **Task 2: Instrument runAcceptance + bound child spawns** - `d3da69ec3` (feat)
3. **Task 3: Clean rerun and classify** - `66ab6079d` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tests/test-354-acceptance-diagnostics.cjs` - New hermetic regression (6 assertions: bounded
  exit, timing fields + point filter, hang classification, stderr progress lines, no-orphan
  check, progress suppression)
- `scripts/doctor.cjs` - `runBoundedChild` helper; `runAcceptance` timing/progress/test-hooks;
  6 acceptance-point child spawns rerouted; `--acceptance --json` dispatch now routes its
  human-readable summary to stderr instead of stdout
- `.planning/debug/sys-07-acceptance-timing.md` - RCA classifying SYS-07 WORKING with full
  per-point timing tables, network-touch evidence, and the orphan-check output

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug + missing critical functionality] `--acceptance --json` never actually
emitted clean JSON on stdout**
- **Found during:** Task 2, running the Task 2 acceptance criterion `doctor --acceptance --pre-tag
  --json 2>/dev/null | node -e "JSON.parse(readFileSync(0))"` -- it failed with a SyntaxError
  because the per-point `PASS`/`FAIL` lines and the summary line printed to stdout via
  `console.log` even when `flags.json` was set (pre-existing, dating to the original Phase 123
  Plan-04 dispatch code, not introduced by this plan).
- **Issue:** Every existing test fixture worked around this via `stdout.indexOf('{')`, but a
  direct `JSON.parse(stdout)` -- exactly what this plan's own must-have truth ("stdout JSON stays
  parseable") requires -- never worked.
- **Fix:** Routed the human-readable PASS/FAIL + summary block to `process.stderr` when
  `flags.json` is true; stdout carries only the final `JSON.stringify(result, null, 2)` in that
  mode. Non-JSON invocations are unaffected.
- **Files modified:** `scripts/doctor.cjs` (same commit as Task 2, `d3da69ec3`)
- **Verification:** `doctor --acceptance --pre-tag --json 2>/dev/null | node -e
  "JSON.parse(readFileSync(0,'utf8'))"` now exits 0; all 3 `tests/test-doctor-acceptance*.cjs`
  sibling files (which use the `indexOf('{')` workaround) still pass 100% (8/8 + 6/6 + 6/6),
  confirming backward compatibility.
- **Committed in:** `d3da69ec3` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1/2, stdout/stderr protocol gap directly blocking this
plan's own required behavior)
**Impact on plan:** Necessary to satisfy the plan's literal Task 2 acceptance criterion and its
must-have truth about stdout staying parseable JSON. No scope creep -- confined to the
`--acceptance --json` dispatch path this plan already owns; zero renderer or class-check code
touched (Phase 352 scope untouched).

## Issues Encountered

None blocking. The `test-doctor-acceptance*.cjs` sibling suite is slow (each live-workspace
invocation runs the full real pre-tag/full checklist against this actual repo, ~80-100s per
invocation, several invocations per file) -- this is pre-existing test-suite runtime, not a
regression from this plan's changes; each Bash tool call needed a background-and-poll pattern to
avoid the harness's own 120s foreground-command cap, not because anything hung.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SYS-07 is CLOSED: `doctor --acceptance` is now diagnosable (per-point timing, progress,
  bounded children) and classified WORKING by measured evidence, not assumption.
- `runBoundedChild` is available as the established pattern for any future acceptance-point child
  spawn that needs a bound.
- No blockers for 354-16 or 354-18 (phase close-out / THEO-04 doctor advisory check), neither of
  which touches `runAcceptance`/`buildAcceptanceChecklist`.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: tests/test-354-acceptance-diagnostics.cjs
- FOUND: scripts/doctor.cjs
- FOUND: .planning/debug/sys-07-acceptance-timing.md
- FOUND: .planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-13-SUMMARY.md
- FOUND commit: 63a1fbecb (Task 1)
- FOUND commit: d3da69ec3 (Task 2)
- FOUND commit: 66ab6079d (Task 3)
