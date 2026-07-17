---
phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
plan: 05
subsystem: testing
tags: [smoke-test, calibration, zod, skill-optimization, d7-gate, reference-dataset]

# Dependency graph
requires:
  - phase: 230-01
    provides: SmokeLabelSchema (lib/core/skillopt-schemas.cjs) + out/inventory.json (124 skills, 59 backed)
provides:
  - "smoke-labels.json: the human-approved D7 calibration reference set (13 records, all 7 composition slots)"
  - "The measuring stick the funnel judge is checked against before any full 124-skill spend is trusted"
affects: [230-07, funnel calibration, D7 smoke-set replay gate, WS2 false-positive guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-labeled reference dataset as a pipeline INPUT (lives outside out/, structurally un-overwritable by assertUnderOut-guarded writes)"
    - "Draft-from-real-data then human-approve at a blocking checkpoint (automation first, human judgment where it is the actual point)"

key-files:
  created:
    - .planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/smoke-labels.json
  modified: []

key-decisions:
  - "Composition drafted entirely from real out/inventory.json: every named skill exists, every near-miss pair shares a real family key"
  - "ws2_defect = rooms (its sole backing_ref is scripts/check-card-fire.cjs) so a WS2 review targets exactly the 2026-07-05 logged over-enforcement bug"
  - "ws2_clean = status (mos-status.cjs, read-only, covered by tests/run-all-129.sh) as the D4 false-positive guard"
  - "Near-miss labels drafted honestly: find-connections and explore-trends flagged (genuine sibling overlap), not optimistically passed"

patterns-established:
  - "Reference dataset lives beside the plan files, deliberately outside out/, so no pipeline run can overwrite the calibration authority (T-230-17 mitigation)"
  - "Blocking human-verify checkpoint gates draft labels gaining gate authority (T-230-16 self-calibration mitigation)"

requirements-completed: [D7]

# Metrics
duration: 22min
completed: 2026-07-17
---

# Phase 230 Plan 05: Smoke-Test Calibration Set Summary

**A 13-record, human-approved SmokeLabelSchema reference set (all 7 composition slots, grounded in the real 124-skill inventory) that locks the D7 calibration bar before any full-fleet spend.**

## Performance

- **Duration:** 22 min (incl. blocking human-verify checkpoint)
- **Started:** 2026-07-17T18:45:00Z
- **Completed:** 2026-07-17T19:07:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1 created

## Accomplishments
- Drafted the smoke calibration set from real `out/inventory.json` data (124 skills / 59 backed), filling every AI-SPEC Section 5 composition slot with grounded, reasoning-attached labels.
- Cleared the blocking human-verify checkpoint: Jonathan reviewed all 13 records and all 5 named judgment calls and approved the set exactly as drafted, with no edits.
- Locked `smoke-labels.json` as the D7 reference: the measuring stick the funnel judge must agree with before the full 124-skill spend is trusted (AI-SPEC Offline metric "Funnel-vs-manual agreement on smoke set").

## Task Commits

1. **Task 1: draft the smoke set from real inventory data** - `cc9f9a8a` (docs)
2. **Task 2: Jonathan pre-labels -- approve or edit** - no file change (approved as drafted; verbatim approval recorded below)

**Plan metadata:** see final `docs(230-05)` commit (SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `.planning/phases/230-.../smoke-labels.json` - 13-record SmokeLabelSchema array; the hand-labeled D7 calibration reference. Lives outside `out/` so pipeline writes structurally cannot overwrite it.

## The approved composition (13 records, all 7 slots)

| # | Skill | Role | Label |
|---|-------|------|-------|
| 1 | doctor | clear_fire | pass |
| 2 | deck | clear_fire | pass |
| 3 | find-connections | near_miss_pair | flagged |
| 4 | find-analogies | near_miss_pair | pass |
| 5 | explore-domains | near_miss_pair | pass |
| 6 | explore-trends | near_miss_pair | flagged |
| 7 | explore-futures | near_miss_pair | pass |
| 8 | explore-opportunity | near_miss_pair | pass |
| 9 | pipeline | weak_description | flagged |
| 10 | jtbd | good_description | pass |
| 11 | rooms | ws2_defect | finding_expected |
| 12 | status | ws2_clean | no_finding_expected |
| 13 | splash | not_evaluated_probe | not_evaluated |

## Human Approval (verbatim)

> "Approve as drafted"

Jonathan reviewed the 13-record draft and all 5 judgment calls (the find-connections/find-analogies pair, explore-trends as the collision risk, jtbd as the good-description pick, mos-status.cjs as the ws2_clean pick, and rooms as the ws2_defect vehicle) and approved the smoke set exactly as drafted -- no edits. The SmokeLabelSchema validation gate was re-run after approval and passed (13 records, all slots, all valid), locking the set as the D7 reference.

## Decisions Made
- **ws2_defect vehicle = rooms, not ignite:** rooms' only `backing_ref` is `scripts/check-card-fire.cjs`, so a WS2 review of rooms targets exactly the defective file with no dilution from other backing scripts. Confirmed by Jonathan.
- **Near-miss labels drafted honestly, not optimistically:** find-connections (vague "cross-domain patterns", no named method) and explore-trends ("surface future problems" bleeds into explore-futures' territory) were drafted `flagged` per the plan's explicit instruction to draft honestly where sibling descriptions genuinely overlap. Confirmed by Jonathan.
- **not_evaluated_probe mechanism:** splash is fed to the funnel via the Plan 02 `--probe-timeout-unit splash --probe-mark` hook (verified present in scripts/skillopt-funnel.cjs), forcing a 1ms timeout that must land as `not_evaluated` reason `induced_probe` (D5).

## Deviations from Plan

None - plan executed exactly as written. Jonathan approved the draft with zero edits, so no re-labeling or skill swaps were applied.

## Issues Encountered
- **`.planning/` is gitignored:** matching the established phase precedent (CONTEXT.md / AI-SPEC.md / PLAN.md / PATTERNS.md were force-added under `docs(230)` commits, and STATE.md / ROADMAP.md are tracked), the durable `smoke-labels.json` calibration artifact was committed with `git add -f`. This is the same durable-design-artifact convention already used across Phase 230, not a new pattern.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **D7 reference is locked and on disk before any live smoke spend.** Plan 07 hard-depends on this set: the smoke funnel run compares its verdicts against these approved labels, and the full 124-skill spend is gated on agreement clearing tolerance.
- No blockers.

## Threat Flags

None - no new security-relevant surface introduced. The two registered threats (T-230-16 self-calibration, T-230-17 pipeline overwrite) are both mitigated as designed: the blocking human-verify checkpoint gated the labels gaining authority, and the file lives outside `out/` beyond the reach of `assertUnderOut`-guarded writes.

## Self-Check: PASSED

- FOUND: smoke-labels.json
- FOUND: 230-05-SUMMARY.md
- FOUND: commit cc9f9a8a (Task 1 draft)

---
*Phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur*
*Completed: 2026-07-17*
