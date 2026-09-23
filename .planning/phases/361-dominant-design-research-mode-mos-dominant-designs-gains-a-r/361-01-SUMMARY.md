---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
plan: 01
subsystem: testing
tags: [requirements, baseline, aggregator, dominant-design, part8, evidence-pipeline]

# Dependency graph
requires: []
provides:
  - DDR361-01..13 requirement rows minted in .planning/REQUIREMENTS.md
  - tests/fixtures/361-pre-phase.json (pre-phase baseline: base_sha, registry row, Setup/quick-pass text, find_connections arm slice, all digest-pinned)
  - tests/test-361-baseline.cjs (baseline proof + shared extraction helpers: extractSetupSection, extractQuickPassParagraph, extractFindConnectionsSlice, sha256, loadFixture)
  - tests/run-all-361.sh (phase aggregator, written once, never edited by later 361 plans)
affects: [361-02, 361-03, 361-04, 361-05, 361-06, 361-07, 361-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-phase digest-pinning fixture: every later phase test recomputes its digest from `git show <base_sha>:<path>` instead of trusting a hand-edited fixture"
    - "Phase aggregator run/run_if/counters/em-dash-guard shape (copied from tests/run-all-356.sh), guarded legs for not-yet-landed test files report SKIPPED never PASSED"

key-files:
  created:
    - tests/fixtures/361-pre-phase.json
    - tests/test-361-baseline.cjs
    - tests/run-all-361.sh
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "base_sha pinned at c1c948bf0 (HEAD at fixture-generation time), one commit after this plan's own 361-01 REQUIREMENTS mint (bb5989e9c) and one peer commit (354-18, THEO-04 advisory check) that does not touch any of the three pinned files; confirmed via git show --stat before trusting it"
  - "Traceability active-requirements count: both stated occurrences agreed at 360 before this edit, so both were incremented to 373 (360 + DDR361's 13)"

requirements-completed: [DDR361-10, DDR361-12, DDR361-13]

# Metrics
duration: 20min
completed: 2026-09-23
---

# Phase 361 Plan 01: Requirements mint + pre-phase baseline + aggregator Summary

**Minted the 13-row DDR361 requirement family and pinned a digest-verified pre-phase baseline fixture (base commit, command-registry row, quick-pass text, find_connections arm) that every later Phase 361 test measures against, plus the phase-361 test aggregator.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-23T18:30:00+03:00 (approx)
- **Completed:** 2026-09-23T18:39:52+03:00
- **Tasks:** 2 (both completed)
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments
- `.planning/REQUIREMENTS.md` now carries the `### Phase 361 - Dominant-design research mode (DDR361 family)` block with all 13 `- [ ] **DDR361-NN**` rows, and the Traceability section's family enumeration, minted-sentence paragraph, Caveat list, and both active-requirements-count occurrences (360 -> 373) were updated.
- `tests/fixtures/361-pre-phase.json` pins the pre-361 base commit (`c1c948bf018e3810b9ee077e9e1cd1f191fa6e79`), the `/mos:dominant-designs` command-registry row, the command's Setup section and quick-pass paragraph, and the `find_connections` arm of `_proveKnownToolShape` in `lib/core/part8-egress-guard.cjs`, each with a sha256 digest.
- `tests/test-361-baseline.cjs` proves the fixture against `git show <base_sha>:...` for every pinned value (6 legs), and exports the shared extraction helpers (`extractSetupSection`, `extractQuickPassParagraph`, `extractFindConnectionsSlice`, `sha256`, `loadFixture`) for reuse by later 361 test files, guarded by `require.main === module` so requiring it runs no assertions.
- `tests/run-all-361.sh` is the phase aggregator (run/run_if/counters/em-dash guard), written once here: 10 guarded legs for the not-yet-landed 361-02..07 test files (all currently SKIPPED, correctly, since those files do not exist yet), 13 existing-suite legs, 4 generator `--check` legs, a CIRS plan-declaration leg over every landed `361-*-PLAN.md`, and a targeted em-dash guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mint DDR361-01..13 in REQUIREMENTS.md** - `bb5989e9c` (docs)
2. **Task 2: Pre-phase baseline fixture, its test, and the phase aggregator** - `c95a56d0a` (test)

_Base commit at plan start (`PLAN_BASE`): `71b7b501b`_

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - DDR361-01..13 rows plus Traceability updates (enumeration, minted paragraph, Caveat list, active-requirements count 360 -> 373)
- `tests/fixtures/361-pre-phase.json` - pre-phase digest-pinned baseline (base_sha, registry row, Setup/quick-pass text, find_connections slice)
- `tests/test-361-baseline.cjs` - baseline proof (6 legs) + shared extraction helpers exported for later 361 tests
- `tests/run-all-361.sh` - phase-361 verification aggregator (executable)

## Decisions Made
- `base_sha` was set from `git rev-parse HEAD` immediately before fixture generation rather than hard-pinning to the Task 1 commit hash, per the plan's own instruction ("Task 1's commit touches only REQUIREMENTS.md, so every pinned file is still pre-phase"). One peer commit (`354-18`, an unrelated offline THEO-04 advisory check) landed in between; its `--stat` was checked and confirmed to touch none of the three pinned files (`data/command-registry.json`, `commands/dominant-designs.md`, `lib/core/part8-egress-guard.cjs`) before trusting it as the base.
- The two "active requirements" count occurrences in `.planning/REQUIREMENTS.md` Traceability both read `360` before this edit (agreement confirmed), so both were incremented to `373`.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' verify commands and acceptance criteria passed as specified.

## Issues Encountered

**Shared-tree flakiness while running `bash tests/run-all-361.sh` (not a defect in this plan's own work):**
- First full run of the aggregator showed 4 FAILED existing-suite/generator legs: `lib/core/part8-egress-guard.test.cjs` (PB8-03 assertion, file last touched 2026-09-23T15:40:27+03:00 by a concurrent session, before this session started), `tests/test-209-declared-implies-wired.cjs` (skills/commands exemption-list drift, unrelated files last touched by earlier concurrent commits), `tests/test-344-surface-layer-parity.cjs` (denominator off-by-one, 287 vs 286, mid-write by a peer session), and `scripts/build-connector-registry.cjs --check` (transient STALE report).
- Re-running the aggregator seconds later showed `build-connector-registry.cjs --check` and `test-344-surface-layer-parity.cjs` now PASSED (confirming they were mid-write races from peer sessions actively regenerating registries/skills concurrently, not caused by this plan).
- The remaining two failures (`part8-egress-guard.test.cjs` PB8-03, `test-209-declared-implies-wired.cjs`) are classified **pre-existing / peer-diff**: neither file was touched by this plan (Task 1 touched only `.planning/REQUIREMENTS.md`; Task 2 only created new `tests/test-361-*`, `tests/fixtures/361-*`, and `tests/run-all-361.sh`), and both source files were last modified by other concurrent sessions working Phases 355/358/359/360 today. Per the plan's own instruction ("if an existing-suite leg fails, the executor classifies it ... in the SUMMARY and does not edit that suite"), these were not touched or fixed here. `node tests/test-361-baseline.cjs` itself (the leg this plan owns) passed clean on every run, confirming the fixture's `find_connections_slice` digest still matches the live file despite that file's unrelated concurrent edits elsewhere.
- A `.git/index.lock` transiently existed during Task 1's commit attempt (another concurrent session's git operation); confirmed via `ps aux` that it had already been released and `git status` showed only this plan's own diff before retrying the commit successfully.

## Known Stubs

None. This plan's artifacts are a requirements block, a digest-pinned fixture, its proof test, and a shell aggregator - no UI or data-flow stubs are in scope.

## Threat Flags

None. Both threat-register mitigations (`T-361-01` git-status-before-edit / commit --only, `T-361-02` fixture digests recomputed from `git show`) were applied exactly as specified; no new network endpoints, auth paths, or schema changes were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The DDR361 requirement family (13 rows) exists and is ready for later plans to close with measured proof.
- `tests/fixtures/361-pre-phase.json` and `tests/test-361-baseline.cjs`'s exported helpers are ready for 361-02..08 to import and reuse (no later plan should re-derive the extraction rules by hand).
- `tests/run-all-361.sh` is in place and will pick up each later plan's `tests/test-361-*.cjs` file automatically via its `run_if` guards; no later plan should edit this aggregator file itself.
- Two pre-existing, unrelated test failures (`part8-egress-guard.test.cjs` PB8-03, `test-209-declared-implies-wired.cjs`) remain open in the shared tree from concurrent peer sessions; they are not blockers for 361-02 and were not touched here.

## Self-Check: PASSED

All created files verified present on disk; both task commit hashes (`bb5989e9c`, `c95a56d0a`) verified present in `git log --oneline --all`.

---
*Phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r*
*Completed: 2026-09-23*
