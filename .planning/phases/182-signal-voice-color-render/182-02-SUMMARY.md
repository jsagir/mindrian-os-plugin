---
phase: 182-signal-voice-color-render
plan: 02
subsystem: testing
tags: [voice-signature, de-stijl, part-12, signal-02, drift-test, missing-mark, run-all-182, r15, aggregator]

# Dependency graph
requires:
  - phase: 182-01
    provides: lib/hmi/voice-color-mark.cjs (markForMove + detectVoiceMark + MARK_COLORS) + the Part 12 Voice Signature doctrine on both voice SKILL surfaces
  - phase: 178-universal-gate-chokepoint
    provides: scripts/check-render-coverage.cjs (the R15 render-coverage gate leg (a) re-runs)
  - phase: 179-ignite-b1-starting-point-fix
    provides: tests/test-ga4-card-fire-interceptor.cjs (the GA-4 interceptor leg (b) leans on)
provides:
  - tests/test-larry-voice-mark-182.cjs (the SIGNAL-02 missing-mark + doctrine-declaration drift test)
  - tests/run-all-182.sh (the one-command Phase 182 PASS/FAIL aggregator)
affects: [signal-02, voice-signature, phase-182-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drift-test-over-shipped-code idiom (mirrors lib/memory/skill-vs-code-drift.test.cjs): read the live SKILL prose + exercise the deterministic detector in one suite, so doctrine and code fail the build together at PR time"
    - "No-new-color anchor: MARK_COLORS asserted equal to the palette.json base.mondrian_* primaries reduced to bare names (derived from palette, not a hand-typed list) -- a 6th color trips the fence RED"
    - "Honest declaration-enforced residual asserted as a named doctrine line (mirrors Phase 178 R15 / Phase 179 R-1): the test enforces the convention + predicate, never a per-token runtime recolor"
    - "Phase aggregator idiom (mirrors run-all-180.sh / run-all-179.sh): run()/run_if() helpers, unguarded hard-FAIL for the SIGNAL-01 verify, file-guarded SKIP for leaned-on suites"

key-files:
  created:
    - tests/test-larry-voice-mark-182.cjs
    - tests/run-all-182.sh
  modified: []

key-decisions:
  - "The test asserts the DECLARED CONVENTION + the detector predicate, NOT a per-token runtime guarantee -- the honest residual is itself an asserted doctrine line so it stays named"
  - "MARK_COLORS equality is derived from palette.json base.mondrian_* keys (set equality both directions), making the no-new-color anchor real, not a tautology"
  - "Leg (a) (the R15 SIGNAL-01 gate) is UNGUARDED + hard-FAIL so the SIGNAL-01 verify can never be silently skipped; the 179 lean + the frozen fences are file-guarded SKIPs"

patterns-established:
  - "tests/run-all-182.sh is the single Phase 182 gate: R15 render-coverage + 179 GA-4 lean + the missing-mark test + the carried frozen-set drift fences, all in one command"

requirements-completed: [SIGNAL-02]

# Metrics
duration: 12min
completed: 2026-06-27
---

# Phase 182 Plan 02: SIGNAL-02 Missing-Mark Test + Phase Aggregator Summary

**The SIGNAL-02 acceptance closed: a Larry CLI turn missing its De Stijl voice-color mark is now CAUGHT by tests/test-larry-voice-mark-182.cjs (a drift test that also asserts the Part 12 Voice Signature doctrine is declared on both voice SKILL surfaces and that MARK_COLORS mints no new color), welded with the R15 SIGNAL-01 gate and the carried frozen-set fences into tests/run-all-182.sh, the one-command Phase 182 PASS/FAIL gate (5/5 green).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (both build)
- **Files created:** 2 (test + aggregator)
- **Files modified:** 0

## Accomplishments

- **SIGNAL-02 closed (Task 1):** `tests/test-larry-voice-mark-182.cjs` (59 assertions, 9 tests) mirrors the `lib/memory/skill-vs-code-drift.test.cjs` idiom. It exercises `detectVoiceMark` across the four cases (marked Larry / native-host / >1-mark / non-De-Stijl spoof), asserts `markForMove` maps the 5 moves, and carries the explicit **missing-mark catch**: a Larry turn that should wear a mark is stripped, run through the detector, and asserted CAUGHT (native-host / no-mark, never mistaken for the valid Larry turn it was). The `MARK_COLORS` no-new-color anchor is asserted by set equality against the `palette.json` `base.mondrian_*` primaries (both directions). The doctrine-declared assertions read both live SKILL surfaces and grep the load-bearing prose (Voice Signature, the 5 mappings, the absence-is-native-host rule, the declared-convention residual on larry-personality; the voice-color mark, no-new-color, frozen-render-contract, native-host prose on ui-system). An em-dash self-check scans the file's own source via a U+2014 unicode escape.
- **Phase aggregator built (Task 2):** `tests/run-all-182.sh` mirrors `run-all-180.sh`: `set -uo pipefail`, `run()`/`run_if()` helpers, PASS/FAIL/SKIP counters, non-zero exit on FAIL. Four legs: (a) SIGNAL-01 R15 `check-render-coverage --check` (unguarded hard-FAIL), (b) SIGNAL-01 lean 179 GA-4 interceptor (file-guarded SKIP), (c) SIGNAL-02 missing-mark test, (d) carried reach-ids(6)/posture-ids(3) drift fences.
- **`bash tests/run-all-182.sh` is GREEN: 5 passed, 0 failed, 0 skipped.**
- **Real fence, not a tautology:** three scratch mutations (a 6th color in MARK_COLORS; a broken missing-mark catch; a removed larry SKILL doctrine line) each tripped the test RED; all reverted, tree clean, test green again.

## Task Commits

1. **Task 1: SIGNAL-02 missing-mark + doctrine-declaration drift test** - `320aa734` (test)
2. **Task 2: run-all-182.sh phase aggregator** - `c813d0c3` (test)

## Files Created

- `tests/test-larry-voice-mark-182.cjs` - 292 lines. The SIGNAL-02 drift fence over `lib/hmi/voice-color-mark.cjs` + both SKILL surfaces + `palette.json`. LOCAL only, no Brain, no network. Mirrors `skill-vs-code-drift.test.cjs` (assert/test harness, passed/failed counter, `process.exit(1)` on failure).
- `tests/run-all-182.sh` - 78 lines. The Phase 182 single PASS/FAIL aggregator. Mirrors `run-all-180.sh`. bash-only, em-dash-free, emoji-free.

## Decisions Made

- The missing-mark catch is the load-bearing SIGNAL-02 assertion: the test strips a real Larry turn and proves the detector classifies it native-host / no-mark, never the valid Larry turn it was, AND proves the with-mark and without-mark turns classify differently (blue vs null). This is the exact failure SIGNAL-02 names.
- Leg (a) (R15) is unguarded and hard-FAILs; the SIGNAL-01 verify can never be silently skipped. The 179 lean and the frozen fences are file-guarded SKIPs, so a leaned-on suite that is absent is visible, not a silent failure (mirrors `run-all-179.sh` / the threat register T-182-06 disposition).
- The honest residual (declaration-enforced, not a runtime recolor) is asserted as a named doctrine line in both the module's existing SKILL prose and the test, so it stays named rather than being silently over-promised (the constraint that the test must NOT pretend to verify every literal assistant token is recolored).

## Deviations from Plan

None - plan executed exactly as written. No bugs, missing functionality, or blocking issues encountered; no architectural decisions required. The voice-color-mark module + doctrine already shipped in Plan 182-01, so Task 1 (tdd) is a drift-test-over-shipped-code task: the test passes against the shipped module immediately, and the scratch-mutation proof (reverted) confirms it is a real fence rather than a tautology.

## Issues Encountered

The em-dash self-check (Test 9) correctly tripped on the first run because the test file's own source carried a literal em-dash (in the Test 9 comment and a `const emDash` literal). Fixed by building the em-dash from its unicode escape (`String.fromCharCode(0x2014)`) so the file's source contains zero literal em-dashes. This is the self-check working as designed (D5). Two pre-existing untracked files (docs/CANON-RECALIBRATION-PROPOSAL.md, references/design/newsletter-email-template.html) were present in the working tree before this plan; unrelated, deliberately NOT staged.

## Constraint Compliance

- No em-dashes: both files are em-dash-free (the test self-checks; grep confirms 0).
- Part 8 clean: both files are LOCAL only (node/bash over repo files); no fetch/http/Brain call surface.
- No frozen contract touched: the carried reach-ids (frozen 6) + posture-ids (frozen 3) drift fences pass inside the aggregator; MARK_COLORS stays the 5-primary palette-anchored set; no new color, no 6th reach, no edge/node minted.
- Honest framing: the test enforces the declared convention + the detector predicate, NOT a per-token runtime guarantee (the named residual is asserted, not hidden).

## Self-Check: PASSED

- FOUND: tests/test-larry-voice-mark-182.cjs
- FOUND: tests/run-all-182.sh
- FOUND: .planning/phases/182-signal-voice-color-render/182-02-SUMMARY.md
- FOUND commit: 320aa734 (test, +292)
- FOUND commit: c813d0c3 (test, +78)
- `bash tests/run-all-182.sh` exits 0: Passed 5, Failed 0, Skipped 0

---
*Phase: 182-signal-voice-color-render*
*Completed: 2026-06-27*
