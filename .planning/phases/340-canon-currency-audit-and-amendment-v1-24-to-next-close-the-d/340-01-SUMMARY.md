---
phase: 340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d
plan: 01
subsystem: testing
tags: [bash, node-assert, canon-amendment, floor-test-aggregator, documentation-audit]

# Dependency graph
requires: []
provides:
  - tests/run-all-340.sh (the phase 340 merge-gate aggregator, 4 PASS / 0 FAIL / 3 SKIP today)
  - 340-LIVE-VERIFICATION.md (dated, live-command-produced figures and citations for waves A/B/C)
affects: [340-02, 340-03, 340-04, 340-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "run/run_if bash aggregator helpers copied byte-for-byte from tests/run-all-190.sh"
    - "PRESCRIPTIVE vs DESCRIPTIVE/HISTORICAL classification for stale-figure citations"

key-files:
  created:
    - tests/run-all-340.sh
    - .planning/phases/340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d/340-LIVE-VERIFICATION.md
  modified: []

key-decisions:
  - "Cited insertNode( call-site counts in BOTH scopes (lib/core/: 82/27; all of lib/: 112/35) since research only scanned lib/core/ and the plan asked for both scopes explicitly."
  - "Recorded 53 live shape-declaration violations (not research's approximate ~20+) but recommended wave C keep Part 11 prose in its existing enumerated-from-disk framing rather than citing any hardcoded count, since the doctrine already self-disclaims frozen numbers."

patterns-established:
  - "Canon Wave 0 pattern: build the merge-gate aggregator and the dated live-verification record BEFORE any amendment wave drafts prose, so every cited number/line has same-day provenance."

requirements-completed: [CANON-10]

# Metrics
duration: 35min
completed: 2026-09-05
---

# Phase 340 Plan 01: Wave 0 Scaffold Summary

**Built the phase 340 merge-gate aggregator (`tests/run-all-340.sh`, 4 PASS / 0 FAIL / 3 SKIP) and re-verified every figure/citation the three upcoming canon amendment waves will write, against today's live codebase rather than 340-RESEARCH.md's numbers.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-05T19:39:05Z (per STATE.md `last_updated`)
- **Completed:** 2026-09-05
- **Tasks:** 2 completed
- **Files modified:** 2 (both new files)

## Accomplishments
- `340-LIVE-VERIFICATION.md` re-ran all 15 battery items from the plan against the live repo:
  confirmed the 44-member `ALLOWED_EDGE_TYPES` set with all 15 candidate gap types still absent
  from Part 4 prose, confirmed `SOURCED_FROM` has a real runtime writer
  (`lib/core/navigation/reasoning-write.cjs:185`), confirmed the 10-member
  `ALLOWED_EPISTEMIC_TYPES` enum, refreshed line citations for the L1/L2/L3 ICM mechanisms in
  `lib/core/room-skeleton-scaffold.cjs`, confirmed the live Brain origin resolver
  (`theo-mcp.onrender.com`), classified the "25 methodology" and Pinecone citations as
  PRESCRIPTIVE vs the OFF-LIMITS historical Appendix D entries 11/13/16, recorded the four-glob
  surface counts (113/14/4/126) and a 53-violation `check-shape-declaration.cjs --check` run, and
  confirmed `.claude/skills/docu-optimizer/SKILL.md` does not exist anywhere in the tree.
- Named `tests/test-canon-crossref-completeness.cjs` and `tests/test-canon-part-9-ratification.cjs`
  as PRE-EXISTING RED with their exact failing assertions and root cause (version anchors pinned
  to canon v1.4 and a pre-Part-9-ratification document state), so no later wave misattributes them.
- Built `tests/run-all-340.sh`, copying `tests/run-all-190.sh`'s `run`/`run_if` helper block
  byte-for-byte, registering three `run_if` legs for the not-yet-written entry-38/39/40 canon
  floor tests (SKIP cleanly) and four `run` legs for the required-green regressions
  (frozen-scalars, entry-31 two-gauge, entry-36 shape-declaration, 195 seven-kind).
- Confirmed zero bytes written to `docs/MINDRIAN-CANON.md`, `docs/CANON-PHASE-MAP.md`, `CLAUDE.md`,
  or `agents/larry-extended.md` (`git status --porcelain` clean on all four, checked before and
  after every task).

## Task Commits

Each task was committed atomically:

1. **Task 1: Run the live re-verification battery and file 340-LIVE-VERIFICATION.md** - `4206c458` (docs)
2. **Task 2: Create tests/run-all-340.sh, the phase aggregator** - `d47fabd9` (test)

**Plan metadata:** commit pending (this SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified
- `.planning/phases/340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d/340-LIVE-VERIFICATION.md` - dated live-command record of every figure/citation waves A/B/C consume, plus the pre-existing-red baseline and a Deltas-against-research table
- `tests/run-all-340.sh` - the phase 340 PASS/FAIL/SKIP merge-gate aggregator

## Decisions Made
- Cited `insertNode(` call-site counts in both scopes (`lib/core/`: 82 sites/27 files; all of
  `lib/`: 112 sites/35 files) per the plan's explicit instruction, since research only scanned
  `lib/core/`.
- Recommended wave C avoid citing the exact 53-violation `check-shape-declaration.cjs --check`
  count as new Canon prose, since Part 11's own doctrine text already self-disclaims all such
  counts as "never a frozen scalar... enumerated from disk at run time" - citing an exact number
  here would recreate the same staleness class this phase exists to close.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - verification-command miscount, documented not silently passed] `run-all-340.sh`'s own `<verify>` block asserts exactly 4 lines matching `: PASSED`; actual output has 8**
- **Found during:** Task 2 (`bash tests/run-all-340.sh` dry-run against the plan's own automated verify command)
- **Issue:** All four required-green legs in this wave (`test-canon-frozen-scalars-floor.cjs`,
  `test-canon-entry-31-two-gauge-floor.cjs`, `test-canon-entry-36-shape-declaration-floor.cjs`,
  `test-195-canon-7-kind-floor.cjs`) are, unlike Phase 190's mixed leg composition, ALL
  self-reporting canon floor-test scripts that each print their own `>>> <scriptname>: PASSED`
  line in addition to the aggregator's own `>>> $label: PASSED` line. This is the exact same
  doubling pattern `tests/run-all-190.sh` exhibits for its one self-reporting leg (entry-36:
  observed 5 total `: PASSED` matches there, not 4, for an all-passing 4-leg run) - just
  multiplied across all four legs here instead of one. Grepping the literal string `: PASSED`
  therefore returns 8 (4 self-report + 4 aggregator-report), not the 4 the plan's `<verify>` block
  and acceptance criteria assumed.
- **Fix:** None applied to the aggregator itself - the byte-for-byte `run`/`run_if` helper reuse
  the plan explicitly mandated ("Copy these byte-for-byte; do not invent a new aggregator shape")
  is correct and matches `run-all-190.sh`'s own real behavior under the same self-reporting-leg
  condition. Suppressing the subprocess's own stdout to force the grep count to exactly 4 would
  hide genuine per-assertion test evidence and diverge from the reference pattern. Verified instead
  via the substantively correct signal: the aggregator's own `Summary (340 verification)` banner
  reports `Passed: 4   Failed: 0   Skipped: 3`, `bash tests/run-all-340.sh` exits 0, and every OTHER
  acceptance criterion in the plan (executable bit, exactly 3 `SKIPPED` lines, zero `FAILED` lines,
  `run_if()`/`run()` helper counts both ==1, the two pre-existing-red tests appearing only in
  comments, `test-canon-entry-38-sourced-claims-floor.cjs` mentioned >=2 times, zero em-dashes)
  passes exactly as specified.
- **Files modified:** None beyond the planned `tests/run-all-340.sh`.
- **Verification:** Ran the plan's own literal `<verify>` command; confirmed `SKIPPED` count = 3
  (PASS) and the overall exit code = 0 (PASS); the `: PASSED` count = 8 (does not match the
  literal `-eq 4` assertion). Confirmed the identical doubling artifact pre-exists in
  `tests/run-all-190.sh` (5 matches for an all-passing 4-leg run, not 4), establishing this is a
  planning-time miscount inherent to reusing the self-reporting floor-test pattern, not a defect
  introduced by this task.
- **Committed in:** `d47fabd9` (Task 2 commit) - the aggregator itself is correct; this note
  documents the one literal sub-check of the plan's own `<verify>` block that cannot be satisfied
  without contradicting the plan's own "byte-for-byte, do not invent a new shape" mandate.

---

**Total deviations:** 1 documented (verification-command miscount in the plan itself, not a code defect)
**Impact on plan:** None on functional correctness - the phase's real gate (`bash tests/run-all-340.sh` exits 0 with 4 PASS / 0 FAIL / 3 SKIP, per the plan's own `<verification>` section) is satisfied exactly. Only one over-fit literal grep assertion inside the plan's own `<verify>` block does not hold, and it does not hold for the same structural reason `tests/run-all-190.sh` itself would fail an identical `-eq 4` assertion if one were run against it today.

## Issues Encountered
None beyond the documented verify-command deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `340-LIVE-VERIFICATION.md` gives waves A (340-02), B (340-03), and C (340-04) a same-day,
  reproducible citation record instead of relying on 340-RESEARCH.md's numbers.
- `tests/run-all-340.sh` is live and green; each amendment wave turns one of its three `run_if`
  SKIPs into a PASS simply by landing the floor-test file it already names - no aggregator edit
  needed per wave.
- No blockers. Zero bytes were written to any of the four constitutional/persona files this plan
  is forbidden from touching, confirmed via `git status --porcelain` before and after both tasks.

---
*Phase: 340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: tests/run-all-340.sh
- FOUND: .planning/phases/340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d/340-LIVE-VERIFICATION.md
- FOUND: .planning/phases/340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d/340-01-SUMMARY.md
- FOUND commit: 4206c458 (Task 1)
- FOUND commit: d47fabd9 (Task 2)
