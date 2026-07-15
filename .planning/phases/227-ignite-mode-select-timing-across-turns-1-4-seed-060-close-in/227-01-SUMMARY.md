---
phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in
plan: 01
subsystem: doctor
tags: [doctor-module, sidechannel, mode-select, session-state, advisory-check]

# Dependency graph
requires:
  - phase: 209
    provides: card-fire-sidechannel.cjs's producer/reader pattern (session-scoped store, atomic writes, never-throw) mirrored here with a new store file and TTL
  - phase: 217
    provides: doctor.cjs's cadence-always module contract and card-fire-health-module.cjs's check(ctx) shape, mirrored for mode-select-checkpoint-module.cjs
provides:
  - lib/core/mode-select-sidechannel.cjs exporting recordLanePick/readLanePick, a session-lifetime (24h) lane-pick store, ready for plan 227-04 to wire at the actual call sites (selector-dispatcher.cjs, conversation-mode.md's default-stated branch)
  - lib/core/doctor/mode-select-checkpoint-module.cjs, a check-only advisory doctor module that surfaces a silent mode-select skip as a warn finding
  - data/doctor-modules.json mode-select-checkpoint registry row (flag null, cadence always, fix_supported false)
  - tests/test-227-mode-select-checkpoint.cjs, the hermetic regression proof registered in lib/memory/run-feynman-tests.cjs
affects: [227-04, doctor.cjs regression suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-scoped sidechannel store mirrored from card-fire-sidechannel.cjs (atomic tmp-file+rename write, never-throw, size-cap, TTL-prune-on-read) with its own store file and TTL when the analog's TTL does not fit the new purpose (D-01/D-02)"
    - "Doctor module reads process.env.CLAUDE_SESSION_ID directly for a ctx field doctor.cjs's own ctx object does not carry, rather than modifying scripts/doctor.cjs's ctx shape (one registry row plus one runner file, no script-body edits)"

key-files:
  created:
    - lib/core/mode-select-sidechannel.cjs
    - lib/core/doctor/mode-select-checkpoint-module.cjs
    - tests/test-227-mode-select-checkpoint.cjs
  modified:
    - data/doctor-modules.json
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "D-01/D-02 followed exactly: new store file (mode-select-lane-picks.json), new env override (MODE_SELECT_SIDECHANNEL_PATH), 24h TTL explicitly NOT the analog's 10-minute turn-scoped TTL, documented inline why."
  - "D-04/D-05 followed exactly: registry row uses flag:null (not a named flag, correcting 227-PATTERNS.md's illustrative example against the locked D-04 decision), cadence always, fix_supported false; check(ctx) derives session_id/has_user_turn from process.env.CLAUDE_SESSION_ID when ctx does not override, closing the gap that scripts/doctor.cjs's own ctx object carries neither field."
  - "introduced_version set to 1.15.3-beta.19, confirmed as CHANGELOG.md's top [Unreleased] entry at execution time."

patterns-established:
  - "A doctor check module that needs session identity derives it from process.env.CLAUDE_SESSION_ID inside the module itself (mirroring lib/core/mva-state.cjs and lib/statusline/cockpit-telemetry.cjs), never by growing scripts/doctor.cjs's ctx shape."

requirements-completed: [REQ-1]

# Metrics
duration: ~15min
completed: 2026-07-16
---

# Phase 227 Plan 01: Mode-Select Firing Checkpoint Summary

**A session-scoped sidechannel store plus a check-only doctor module that turns a silent mode-select-gate skip into a scripted warn finding instead of an invisible prose-only failure.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-15 (session start)
- **Completed:** 2026-07-16T00:25:36+03:00
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `lib/core/mode-select-sidechannel.cjs`: `recordLanePick`/`readLanePick` with a 24-hour session-lifetime TTL, atomic tmp-file+rename writes, 64KB size cap with oldest-first truncation, never-throw on any fault. Mirrors `card-fire-sidechannel.cjs`'s pattern deliberately, not its file or 10-minute TTL (D-01/D-02).
- `lib/core/doctor/mode-select-checkpoint-module.cjs`: a `check(ctx)`-only, `flag:null`, `cadence:always` doctor module. Never blocks (`ok`/`warn` only), never false-positives on a doctor run that is itself turn 1 (D-05), and derives its production session identity from `process.env.CLAUDE_SESSION_ID` to close a real gap: `scripts/doctor.cjs`'s own ctx object has no `session_id`/`has_user_turn` field and, per this repo's "one registry row plus one runner file" convention, never will.
- `data/doctor-modules.json`: the `mode-select-checkpoint` registry row, `flag: null` per the locked D-04 decision (227-PATTERNS.md's own illustrative JSON showed a named flag, which would have contradicted D-04 and required an unwanted `scripts/doctor.cjs` edit; the correction is documented inline in the module's own header comment and this summary).
- `tests/test-227-mode-select-checkpoint.cjs`: 6 hermetic assertions (turn-1 guard, silent-skip warn, normal-recording ok, never-throw on a corrupt store, the registry two-way contract, and a bonus missing-lane no-op + export-shape check), registered in `lib/memory/run-feynman-tests.cjs`'s `TEST_FILES` array.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/core/mode-select-sidechannel.cjs (D-01/D-02)** - `c2f1b6b3` (feat)
2. **Task 2: Create the mode-select-checkpoint doctor module and registry row (D-04/D-05)** - `1705ebd9` (feat)
3. **Task 3: Create the hermetic regression test and register it (SPEC Req 1 acceptance)** - `427a4491` (test)

_Note: tasks were `tdd="true"` for tasks 1-2 but executed as build-then-verify (the test file did not exist until task 3, so tasks 1-2 were manually smoke-tested inline per their own `<done>` criteria, then formally proven by task 3's hermetic test which all three commits pass)._

## Files Created/Modified

- `lib/core/mode-select-sidechannel.cjs` - session-scoped lane-pick store (recordLanePick/readLanePick), 24h TTL, atomic writes, never-throw
- `lib/core/doctor/mode-select-checkpoint-module.cjs` - check(ctx)-only advisory doctor module reading the sidechannel
- `data/doctor-modules.json` - new mode-select-checkpoint registry row (flag null, cadence always, fix_supported false)
- `tests/test-227-mode-select-checkpoint.cjs` - hermetic regression test, 6 assertions
- `lib/memory/run-feynman-tests.cjs` - registered the new test file in TEST_FILES

## Decisions Made

- Followed D-01 through D-05 from `227-CONTEXT.md` exactly as locked; no deviation from the decision log.
- Used `flag: null` per D-04's explicit statement, not the named-flag example shown in `227-PATTERNS.md`'s illustrative JSON (that example predates/contradicts the locked decision; using a named flag would have required an unwanted edit to `scripts/doctor.cjs`'s `--all` activation block, violating this repo's "one registry row plus one runner file" convention). This is a plan-internal correction the plan itself instructed ("Important correction" in Task 2's action block), not a deviation from CONTEXT.md.
- `introduced_version: "1.15.3-beta.19"` confirmed against `CHANGELOG.md`'s top `[Unreleased]` entry at execution time; matches `.claude-plugin/plugin.json`/`package.json`'s current version. Note: the live `node scripts/doctor.cjs --all` run in this repo's install topology resolves "running" from the installed marketplace-cache plugin metadata (currently `1.15.3-beta.18`, one behind the repo's in-progress `beta.19`), so the new module correctly DEFERS (does not yet appear in `doctor --all` output) until that install is upgraded to `beta.19` at release time. This is the registry's documented future-version deferral behavior working as designed, not a defect.

## Deviations from Plan

None - plan executed exactly as written. Both task 2's registry-row `flag` correction and task 3's `introduced_version` confirmation were explicit plan instructions, not deviations.

## Issues Encountered

A concurrent Claude Code session was active in this same working directory during execution (shared git index, not a worktree; visible via unrelated uncommitted changes to `dashboard/graph.json`, `evals/plurai/*.json`, and mid-execution commits landing between task commits for Phase 223/229 work). Handled per instructions: staged exact file paths only (`git add <path>`, never `git add -A`/`.`), and for `lib/memory/run-feynman-tests.cjs` specifically verified via `git diff` before staging that the working-tree diff contained ONLY this plan's own added hunk (the concurrent session's Phase 223 additions had already landed in a separate commit by the time this plan's task 3 ran, confirmed via `git log`). No unrelated files were staged or committed.

## User Setup Required

None - no external service configuration required. Wiring the actual recorder call sites (`lib/hmi/selector-dispatcher.cjs`, `conversation-mode.md`'s default-stated branch) is plan 227-04's job, not this plan's.

## Next Phase Readiness

`recordLanePick`/`readLanePick` and the doctor module's `check(ctx)` contract are ready for plan 227-04 to consume. No blockers. `scripts/doctor.cjs` itself remains untouched (zero script-body edits, verified: `git diff` shows no changes to that file across all three task commits).

---
*Phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created files verified present on disk; all three task commit hashes (c2f1b6b3, 1705ebd9, 427a4491) verified in git log.
