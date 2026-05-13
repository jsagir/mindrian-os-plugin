---
phase: 124-feynman-temporal-awareness
plan: "00"
subsystem: testing
tags: [wave-0, substrate, feynman-temporal-awareness, canon-part-9, canon-part-5, requirements, roadmap, red-stubs]

# Dependency graph
requires:
  - phase: 88-feynman-minto-memory-layer
    provides: "the FEYNMAN.md file in the per-folder memory triple (ROOM.md / MINTO.md / FEYNMAN.md); this phase appends a sentinel-bounded `## Timeline (auto)` section to that file"
  - phase: 109-sql-context-memory-navigation-spine
    provides: "findRecentChanges + findStaleDecisions navigation primitives + memory_event log + source_section provenance + navigation.cjs closed chokepoint (the renderer reads ONLY through this)"
provides:
  - "10 TEMPORAL-124-XX requirement IDs registered in .planning/REQUIREMENTS.md with goal-shaped descriptions tracing to CONTEXT D-NN decisions (committed by Task 1; verified)"
  - "10 Pending rows appended to the REQUIREMENTS.md per-phase status table (committed by Task 1)"
  - "4 RED test stubs (tests/test-feynman-timeline-*.cjs) each exiting 1 with a MISSING - Wave N stderr line so the runner records RED status, not a false-positive PASS"
  - "tests/run-all-124.sh scoped Phase 124 runner (verbatim structural mirror of tests/run-all-110.sh; exits 1 today, 4 RED CJS_SUITES)"
  - "lib/core/feynman/ROOM.md (ICM Layer 0 identity per CLAUDE.md decision #15; D-07 location lock)"
  - "4 new entries in lib/memory/run-feynman-tests.cjs TEST_FILES[] under a Phase 124 comment block mapping each suite to its owning plan"
  - "ROADMAP.md Phase 124 block: 124-00-PLAN.md plan-list checkbox flipped to [x]; Plans line now reads `5 plans across 4 waves` per Task 1"
affects: [124-01, 124-02, 124-03, 124-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 substrate plan: ships ZERO behavior, only registers requirements + roadmap + test-stub paths that downstream plans fill (mirror of 109-00 and 110-00)"
    - "RED stub idiom: process.stderr.write('MISSING - Wave N must implement ... (Plan XX-YY)\\n'); process.exit(1) -- runner records RED status without false-positive PASS"
    - "Scoped runner mirror of tests/run-all-110.sh: bash + set -uo pipefail + SHELL_SUITES/CJS_SUITES + per-suite PASS/FAIL loop + Summary block + exit 1 if any failed"
    - "Feynman runner TEST_FILES[] registry: append in a per-phase block with a comment header mapping each file to its owning plan, then path.join(REPO_ROOT, 'tests', '<file>') entries"
    - "ICM Layer 0 ROOM.md identity per new code directory (lib/core/feynman/) -- D-07 location lock"

key-files:
  created:
    - "tests/test-feynman-timeline-renderer.cjs (RED stub filled by 124-01; TEMPORAL-124-02 + -04 + -05 + -07)"
    - "tests/test-feynman-timeline-empty-state.cjs (RED stub filled by 124-01; TEMPORAL-124-04)"
    - "tests/test-feynman-timeline-runner.cjs (RED stub filled by 124-02; TEMPORAL-124-01 + -03 + -08 + -09)"
    - "tests/test-feynman-timeline-canon-part-9-invariant.cjs (RED stub filled by 124-04; TEMPORAL-124-10)"
    - "tests/run-all-124.sh (scoped Phase 124 runner; mirrors tests/run-all-110.sh)"
    - "lib/core/feynman/ROOM.md (ICM Layer 0 identity for the new dir; the renderer + runner ship next door in Plans 124-01 + 124-02)"
  modified:
    - ".planning/REQUIREMENTS.md (10 TEMPORAL-124-XX entries + 10 Pending status rows -- Task 1)"
    - ".planning/ROADMAP.md (Phase 124 block: Requirements line + 5-plan checkbox list -- Task 1; 124-00-PLAN.md flipped to [x] -- Task 2 closure)"
    - "lib/memory/run-feynman-tests.cjs (TEST_FILES[] +4 Phase 124 entries appended after Phase 123 block)"

key-decisions:
  - "All 4 test stubs use the exact 'MISSING - Wave N must implement ... (Plan 124-NN)' idiom from tests/test-brain-packet-schema-check.cjs and the Phase 110 / 122 stubs; runner records RED status without a false-positive PASS"
  - "Phase 124 block in TEST_FILES[] placed AFTER the Phase 123 block (at the end of the array, immediately before the closing `];`) so the registration order tracks the chronological phase landing order -- mirrors Phase 110 / 122 / 123 placement convention"
  - "lib/core/feynman/ROOM.md authored as a short (25-line) ICM Layer 0 identity that documents (a) the renderer + runner ship here in 124-01 + 124-02, (b) the upstream navigation.cjs chokepoint (Phase 109), (c) the D-02 sentinel pair contract, (d) the D-06 4-tier threshold cascade, (e) the boundary (NO Brain calls per Part 8; NO fs reads outside FEYNMAN.md + room.db family per Canon Part 9). Mirrors the lib/core/navigation/ROOM.md tone."
  - "Wave-0 substrate convention: TEMPORAL-124-01..10 stay `Pending` in REQUIREMENTS.md after Plan 124-00 ships. They only flip to Complete when the owning implementation plan (124-01 / 124-02 / 124-03 / 124-04) lands. Matches the Phase 109 / 110 substrate precedent."

patterns-established:
  - "Per-suite -> plan comment mapping in tests/run-all-NNN.sh header AND in lib/memory/run-feynman-tests.cjs TEST_FILES[] block: the reader sees at a glance which plan owns each RED suite (continues the Phase 110 / 122 / 123 convention)"
  - "Per-new-directory ROOM.md identity: any code directory created by a phase ships an ICM Layer 0 identity file in the same plan that creates the directory, regardless of whether the directory is empty (D-07 location lock pre-fills before Plans 124-01 + 124-02 ship the renderer + runner)"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-05-13
---

# Phase 124 Plan 00: FEYNMAN.md Temporal Awareness Wave 0 Substrate Summary

**Wave 0 substrate: 10 TEMPORAL-124-XX requirement IDs registered in REQUIREMENTS.md (block + 10 Pending traceability rows), ROADMAP.md Phase 124 block updated with the 5-plan checkbox list, 4 RED test stubs at the canonical paths Plans 124-01 / 124-02 / 124-04 will fill, tests/run-all-124.sh scoped runner mirroring tests/run-all-110.sh, lib/core/feynman/ROOM.md ICM Layer 0 identity for the new dir, and the 4 new TEST_FILES[] entries in lib/memory/run-feynman-tests.cjs. Ships ZERO behavior; everything later wave plans need is on disk.**

## Performance

- **Duration:** ~5 min (Task 2 + closure; Task 1 was committed in a prior session)
- **Completed:** 2026-05-13
- **Tasks:** 2 (Task 1 committed as `5097366` in prior session; Task 2 + closure in this session)
- **Files modified:** 8 (3 modified, 6 newly-created across Tasks 1 + 2)

## Accomplishments

- **Task 1 (already committed as `5097366`)**: Registered 10 TEMPORAL-124-XX requirement IDs (TEMPORAL-124-01..10) in `.planning/REQUIREMENTS.md` under a new `## FEYNMAN.md Temporal Awareness (TEMPORAL-124)` block with goal-shaped descriptions citing D-NN decisions; appended 10 `Pending` rows to the per-phase status table; updated `.planning/ROADMAP.md` `### Phase 124` block (Requirements line + 5-plan checkbox list `124-00-PLAN.md` through `124-04-PLAN.md`).
- **Task 2 (this session, commit `a4a1f49`)**: Created 4 RED test stubs at `tests/test-feynman-timeline-{renderer,empty-state,runner,canon-part-9-invariant}.cjs`. Each is 8 lines, exits 1 with a `MISSING - Wave N must implement ... (Plan 124-NN)` stderr line; verified on direct invocation.
- **Task 2**: Shipped `tests/run-all-124.sh` as a verbatim structural mirror of `tests/run-all-110.sh`: bash + `set -uo pipefail` + `SHELL_SUITES`/`CJS_SUITES` + per-suite PASS/FAIL loop + Summary block + exit 1 if any failed. Runs to completion and exits 1 today (4 RED CJS_SUITES) -- correct-by-design until the owning plans land. Mode 0755 (executable).
- **Task 2**: Created `lib/core/feynman/ROOM.md` (25 lines) as ICM Layer 0 identity per CLAUDE.md decision #15. Documents the renderer + runner shipping next door in Plans 124-01 + 124-02; the upstream navigation.cjs chokepoint; the D-02 sentinel pair contract; the D-06 4-tier threshold cascade; the Canon Part 8 + Part 9 boundaries.
- **Task 2**: Extended `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` with the 4 new test paths under a Phase 124 comment block placed AFTER the Phase 123 block (at the end of the array, immediately before the closing `];`).
- **Closure**: Flipped `- [ ] 124-00-PLAN.md ...` to `- [x] 124-00-PLAN.md ...` in `.planning/ROADMAP.md` Phase 124 Plans checklist.

## Task Commits

Each task was committed atomically with `--no-verify` per the parallel_execution rule (concurrent session was editing Phase 125 plans on `main`):

1. **Task 1: Register 10 TEMPORAL-124-XX requirement IDs in REQUIREMENTS.md and update ROADMAP.md Phase 124 block** -- `5097366` (feat) -- committed in prior session.
2. **Task 2: Create the 4 RED test stubs, tests/run-all-124.sh, lib/core/feynman/ROOM.md, and register the 4 suites in the Feynman runner** -- `a4a1f49` (test) -- committed in this session with explicit pathspec on 7 files; zero Phase 125 contamination.

## Files Created/Modified

- `.planning/REQUIREMENTS.md` (Task 1) -- Added `## FEYNMAN.md Temporal Awareness (TEMPORAL-124)` block with 10 entries; appended 10 `| TEMPORAL-124-0N | Phase 124 | Pending |` rows to the per-phase status table.
- `.planning/ROADMAP.md` (Task 1 + closure) -- Phase 124 block: Requirements line set to `TEMPORAL-124-01..10 (registered 2026-05-13 ...)`; Plans line set to `5 plans across 4 waves ...`; 5-plan checkbox list shipped (124-00 through 124-04); the `124-00-PLAN.md` row flipped from `[ ]` to `[x]` at Task 2 closure.
- `lib/memory/run-feynman-tests.cjs` (Task 2) -- Appended a Phase 124 comment block + 4 path.join entries to `TEST_FILES[]` mapping each suite to its owning plan; placed immediately before the closing `];`.
- `tests/test-feynman-timeline-renderer.cjs` (Task 2) -- RED stub (8 lines); `MISSING - Wave 1 must implement renderer unit test (...) (Plan 124-01)`; filled by 124-01 (TEMPORAL-124-02 + -04 + -05 + -07).
- `tests/test-feynman-timeline-empty-state.cjs` (Task 2) -- RED stub (8 lines); `MISSING - Wave 1 must implement the empty-state placeholder test (zero memory_event rows -> "*No timeline events yet.*") (Plan 124-01)`; filled by 124-01 (TEMPORAL-124-04).
- `tests/test-feynman-timeline-runner.cjs` (Task 2) -- RED stub (8 lines); `MISSING - Wave 1 must implement the runner integration tests (sentinel-bounded merge + byte-preserved body + idempotent re-run + memory_event log) (Plan 124-02)`; filled by 124-02 (TEMPORAL-124-01 + -03 + -08 + -09).
- `tests/test-feynman-timeline-canon-part-9-invariant.cjs` (Task 2) -- RED stub (8 lines); `MISSING - Wave 3 must implement the Canon-Part-9-invariant forbidden-substring sweep (...) (Plan 124-04)`; filled by 124-04 (TEMPORAL-124-10).
- `tests/run-all-124.sh` (Task 2) -- Scoped Phase 124 runner; mode 0755 (executable); verbatim structural mirror of `tests/run-all-110.sh`; `CJS_SUITES` = the 4 new suites; header documents RED-by-design-until-owning-plan-lands; exits 1 today (4 RED stubs).
- `lib/core/feynman/ROOM.md` (Task 2) -- ICM Layer 0 identity (25 lines) for `lib/core/feynman/` where the renderer + runner ship in Plans 124-01 + 124-02.

## REQUIREMENTS Table State (delta)

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEMPORAL-124-01 | Phase 124 | Pending |
| TEMPORAL-124-02 | Phase 124 | Pending |
| TEMPORAL-124-03 | Phase 124 | Pending |
| TEMPORAL-124-04 | Phase 124 | Pending |
| TEMPORAL-124-05 | Phase 124 | Pending |
| TEMPORAL-124-06 | Phase 124 | Pending |
| TEMPORAL-124-07 | Phase 124 | Pending |
| TEMPORAL-124-08 | Phase 124 | Pending |
| TEMPORAL-124-09 | Phase 124 | Pending |
| TEMPORAL-124-10 | Phase 124 | Pending |

10 rows added; matches the goal-shaped block above the table. Total TEMPORAL-124- occurrences in the file: 20 (10 entries + 10 status rows) -- the verify expression `grep -c "TEMPORAL-124-" .planning/REQUIREMENTS.md` returns 20 as expected.

## ROADMAP Phase 124 block diff (Task 1 + Task 2 closure)

Task 1 wrote:
1. `**Requirements**: TEMPORAL-124-01..10 (registered 2026-05-13 -- see .planning/REQUIREMENTS.md "## FEYNMAN.md Temporal Awareness (TEMPORAL-124)")`
2. `**Plans:** 5 plans across 4 waves (planned 2026-05-13 via /gsd:plan-phase 124). Target band: v1.13.0-beta.14 (the FEYNMAN sentinel idiom is additive; no backwards-compat risk for current FEYNMAN.md consumers).`
3. Plans checkbox list: 5 entries `124-00-PLAN.md` through `124-04-PLAN.md`.

Task 2 closure flipped `- [ ] 124-00-PLAN.md ...` to `- [x] 124-00-PLAN.md ...` (single-line edit; no other content changed; em-dash sweep on the modified block returns zero matches).

## Feynman-runner registry diff

`lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` grew by 4 entries (within a Phase 124 comment block) right before the closing `];`:

```
+  // Phase 124-00: FEYNMAN.md Temporal Awareness Wave 0 substrate (4 stubs filled by Plans 124-01 / 124-02 / 124-04).
+  //   test-feynman-timeline-renderer.cjs              -> 124-01 (TEMPORAL-124-02 + -04 + -05 + -07: renderer unit + D-05 template + thresholds + section scoping)
+  //   test-feynman-timeline-empty-state.cjs           -> 124-01 (TEMPORAL-124-04: empty-state placeholder)
+  //   test-feynman-timeline-runner.cjs                -> 124-02 (TEMPORAL-124-01 + -03 + -08 + -09: sentinel-bounded merge + body byte-identical + watermark + idempotent + memory_event + EVENT_TYPES +2)
+  //   test-feynman-timeline-canon-part-9-invariant.cjs -> 124-04 (TEMPORAL-124-10: forbidden-substring sweep + fs-instrument allow-list)
+  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-renderer.cjs'),
+  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-empty-state.cjs'),
+  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-runner.cjs'),
+  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-canon-part-9-invariant.cjs'),
```

`node --check lib/memory/run-feynman-tests.cjs` returns 0 (syntax OK).

## Verification Receipts

| Check | Command | Expected | Actual |
|---|---|---|---|
| TEMPORAL-124 line count | `grep -c "TEMPORAL-124-" .planning/REQUIREMENTS.md` | 20 | 20 |
| Heading present | `grep "## FEYNMAN.md Temporal Awareness (TEMPORAL-124)" .planning/REQUIREMENTS.md` | match | match |
| Status row present | `grep "| TEMPORAL-124-10 | Phase 124 | Pending |" .planning/REQUIREMENTS.md` | match | match |
| ROADMAP plan list start | `grep "124-00-PLAN.md" .planning/ROADMAP.md` | match | match (with [x]) |
| ROADMAP plan list end | `grep "124-04-PLAN.md" .planning/ROADMAP.md` | match | match |
| ROADMAP req line | `grep "TEMPORAL-124-01..10" .planning/ROADMAP.md` | match | match |
| All 6 new files exist | `for f in tests/test-feynman-timeline-*.cjs tests/run-all-124.sh lib/core/feynman/ROOM.md; do test -f "$f"; done` | all OK | all OK |
| All 4 stubs exit 1 with MISSING | direct `node` invoke each | rc=1 + MISSING line | rc=1, MISSING line printed for each |
| Feynman registry has 4 refs | `grep -c "test-feynman-timeline" lib/memory/run-feynman-tests.cjs` | >= 4 | 8 (4 comment lines + 4 path.join entries) |
| Scoped runner exits 1 | `bash tests/run-all-124.sh; rc=$?` | 1 | 1 (4 RED CJS_SUITES; 0 Passed, 4 Failed) |
| Em-dash sweep on new files | `grep -P "[\x{2014}\x{2013}]" tests/test-feynman-timeline-*.cjs tests/run-all-124.sh lib/core/feynman/ROOM.md` | no match | no match (grep exit 1) |
| Feynman runner syntax | `node --check lib/memory/run-feynman-tests.cjs` | OK | SYNTAX OK |
| Regression: Phase 110 scoped suite | `bash tests/run-all-110.sh; rc=$?` | 0 | 0 (4/4 PASSED, 9s elapsed) |
| Regression: build-command-registry --check | `node scripts/build-command-registry.cjs --check; rc=$?` | 0 | 0 |
| Regression: test-jtbd-taxonomy | `node tests/test-jtbd-taxonomy.cjs; rc=$?` | 0 | 0 |
| No Phase 125 contamination | `git show --name-only a4a1f49 \| grep -E "125"` | no match | no match (clean) |

All success criteria from the plan's `<success_criteria>` block met.

## Decisions Made

- **lib/core/feynman/ ROOM.md authored before the renderer + runner ship.** Per D-07 location lock + CLAUDE.md decision #15 (ICM Layer 0 everywhere), the new directory `lib/core/feynman/` gets its ROOM.md in the Wave-0 substrate plan rather than waiting for Plans 124-01 + 124-02. The ROOM.md documents the forthcoming renderer + runner so any agent (or human) who touches the directory before those plans land has the identity anchor.
- **Phase 124 block placed AFTER the Phase 123 block in TEST_FILES[].** Mirrors the chronological-landing-order convention used by the Phase 110 / 122 / 123 blocks. Future Phase 125+ blocks will continue this pattern.
- **All 4 RED stubs use the canonical 8-line shape.** `'use strict'` + 4 comment lines (Phase / Requirement / Deliverable / Pattern) + stderr write + exit 1. Matches `tests/test-feynman-timeline-renderer.cjs` (already on disk) and the Phase 110-00 stubs verbatim.
- **Hyphens not em-dashes everywhere.** Every file written contains zero U+2014 and zero U+2013 per the CLAUDE.md hard rule. Verified across all new/modified regions.
- **Explicit pathspec on every git commit.** `git add -- <paths>` and `git commit -- <paths>` (NOT `git add .` / `git add -A`) so the concurrent session's 6 Phase 125 PLAN.md modifications stayed unstaged and did not get swept into Task 2's commit. Verified via `git show --name-only a4a1f49 | grep 125` returning empty.

## Deviations from Plan

None. The plan executed exactly as written. Task 1 had already been committed by a prior executor (commit `5097366`); this session executed Task 2 + the ROADMAP plan-list checkbox flip + SUMMARY + STATE updates.

The pre-existing untracked `tests/test-feynman-timeline-renderer.cjs` file (left on disk by a prior executor that returned early without committing) was inspected and confirmed to match the canonical Wave-0 stub idiom exactly (matching the byte-shape of the other 3 stubs about to be created). It was kept verbatim and included in Task 2's commit alongside the 3 newly-created stubs.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Wave 1 plans (124-01, 124-02) are unblocked** and ready to run sequentially (124-02 depends on 124-01's `firstCapturedLastTouchedBySection` navigation primitive + the renderer module). They have:

- The 4 RED test stub paths to fill (124-01 fills `test-feynman-timeline-renderer.cjs` + `test-feynman-timeline-empty-state.cjs`; 124-02 fills `test-feynman-timeline-runner.cjs`; 124-04 fills `test-feynman-timeline-canon-part-9-invariant.cjs`).
- The 10 TEMPORAL-124-XX requirement IDs registered (their `requirements:` frontmatter lines can reference them by ID).
- The scoped `tests/run-all-124.sh` runner that will report per-task GREEN/RED progression as each plan lands.
- The `lib/core/feynman/ROOM.md` identity anchor pre-shipped so 124-01's `timeline-renderer.cjs` and 124-02's `timeline-runner.cjs` land next door without needing a separate ICM Layer 0 ROOM.md commit.

**Wave 1 sequencing**: 124-01 then 124-02 (124-02's runner test depends on the renderer existing). 124-03 (Wave 2 wiring: session-start cascade slot + `commands/feynman-timeline-refresh.md` + `scripts/feynman-timeline-refresh-command.cjs` + registry regen) is blocked on both. 124-04 (Wave 3 Canon Part 9 invariant + docs) depends on the renderer + runner source files existing so the forbidden-substring sweep has files to scan.

No new blockers. The concurrent session editing Phase 125 plans is unaffected by this work -- Task 2's commit `a4a1f49` is atomic, uses `--no-verify`, and has zero overlap with the 6 modified `.planning/phases/125-f-selector-ranker/125-*-PLAN.md` files.

## Self-Check: PASSED

- `.planning/REQUIREMENTS.md` -- FOUND, 20 TEMPORAL-124 line occurrences (10 entries + 10 rows).
- `.planning/ROADMAP.md` -- FOUND, Phase 124 block has Requirements line + 5-plan checkbox list; `124-00-PLAN.md` row flipped to `[x]`.
- `tests/test-feynman-timeline-renderer.cjs` -- FOUND (RED stub, exits 1, 8 lines).
- `tests/test-feynman-timeline-empty-state.cjs` -- FOUND (RED stub, exits 1, 8 lines).
- `tests/test-feynman-timeline-runner.cjs` -- FOUND (RED stub, exits 1, 8 lines).
- `tests/test-feynman-timeline-canon-part-9-invariant.cjs` -- FOUND (RED stub, exits 1, 8 lines).
- `tests/run-all-124.sh` -- FOUND (executable, exits 1 today, runs to completion; 4/0/4).
- `lib/core/feynman/ROOM.md` -- FOUND (25 lines, ICM Layer 0 identity).
- `lib/memory/run-feynman-tests.cjs` -- FOUND (4 new TEST_FILES entries; node --check OK; grep count = 8).
- Commit `5097366` -- FOUND in `git log` (Task 1; prior session).
- Commit `a4a1f49` -- FOUND in `git log` (Task 2; this session).

---
*Phase: 124-feynman-temporal-awareness*
*Plan: 00 (Wave 0 substrate)*
*Completed: 2026-05-13*
