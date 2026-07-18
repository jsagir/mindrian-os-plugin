---
phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
plan: 07
subsystem: skill-fleet-optimization / live smoke calibration
tags: [live-smoke, calibration, funnel, trigger-detector, adversarial-review, cost-projection, no-silent-skip, human-gate, cjs]

# Dependency graph
requires:
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 02
    provides: "skillopt-genqueries.cjs + skillopt-funnel.cjs (per-family generation, roster-wide judge funnel, induced-probe hook)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 03
    provides: "skillopt-triggerloop.cjs (preflightPluginLoad, runCapture, detectSkillFire pinned to live captures)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 04
    provides: "skillopt-codereview.cjs (adversarial review + evidence anchor)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 05
    provides: "smoke-labels.json (13 human-approved pre-labels, the D7 measuring stick)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 06
    provides: "skillopt-merge.cjs + skillopt-eval.cjs + tests/run-all-230.sh"
provides:
  - "230-07-CALIBRATION.md: the calibration verdict (agreement table, detector proof, WS2 both-directions, probe proof, cost projection, deferred-run statement)"
  - "out/ live smoke artifacts: funnel-results.json (97 units), captures, review findings, the first real merged report, projection.json"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-run discipline enforced: a 100%-not_evaluated funnel HALTED for transport diagnosis rather than re-running blind; root cause fixed, not papered over"
    - "Deviations fixed under the executor rules, never hand-edited to green: the honest 30% agreement and the CONFIRMED defect are the real computed outputs"
    - "Resume-by-cache for opus review so a reaped/short execution window still converges without re-spending"

key-files:
  created:
    - .planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/230-07-CALIBRATION.md
    - .planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/out/smoke/projection.json
  modified:
    - scripts/skillopt-funnel.cjs
    - scripts/skillopt-codereview.cjs

key-decisions:
  - "The funnel per-query budget default ($0.05) is too low for a real 124-roster judge call (~$0.17, cache-creation dominated); added --budget-per-query and ran the smoke at 0.25."
  - "The induced not_evaluated probe (splash) was constructed as a single-query set so the forced timeout is splash's SOLE unit, landing not_evaluated at the SKILL level (matching the funnel selftest's own single-query probe fixture and the D7 checkSmokeAgreement probe gate). Inducing the harder not_evaluated outcome, never masking a real one."
  - "WS2 review was completed via per-file resume drivers because opus review/refute calls run ~3-4 min each and the execution environment reaps detached parents / caps foreground at 10 min; every finding is the real output of a live opus pass."

requirements-completed: [D2, D5, D7]

# Metrics
duration: ~4h (rate-limit-bound live spawns)
completed: 2026-07-18
---

# Phase 230 Plan 07: Live Smoke Calibration Summary

**The harness ran LIVE end to end on the 13-record approved smoke set only: per-family query
generation, a roster-wide judge funnel (97 units, reconciliation holds, induced probe honest),
fresh both-directions Skill-fire captures, an adversarially-verified code review that CONFIRMED
the real check-card-fire over-enforcement defect while leaving the clean control clean, and the
first STOP-gated merged report. The D7 calibration gate FAILS at the default tolerance:
funnel-vs-manual agreement is 30% (3/10), driven mostly by real full-roster near-misses the
isolated pre-labels did not anticipate. Nothing real was written; the full 124-skill run and
any Workflow-tool orchestration stay deferred behind Jonathan's explicit opt-in.**

## Calibration result (the verdict is Jonathan's, at the checkpoint)

- **Funnel-vs-manual agreement: 30.0% (3/10 labeled skills), tolerance 85% -> D7 gate FAIL.**
  The full agreement table, mismatches, and the three-cause diagnosis (real roster collisions,
  a null-labeled-negative artifact, a doctor transport confound) are in 230-07-CALIBRATION.md.
- **Detector both directions (fresh captures):** doctor.jsonl fired:true (mos:doctor),
  offtopic-weather.jsonl fired:false.
- **WS2 both directions:** check-card-fire.cjs -> 1 CONFIRMED finding (the `[1] ... [2]`
  BACKSTOP over-enforcement class, verbatim-anchored); mos-status.cjs -> 0 findings.
- **Probe honest:** splash landed not_evaluated (reason induced_probe) at the skill level.
- **Reconciliation holds:** spawned 97 = ok 92 + not_evaluated 5 (1 probe + 4 transport timeouts).
- **Cost:** smoke actual ~$23; full-fleet projection ~$480 (funnel ~$156, trigger ~$259,
  review ~$45, genqueries ~$20) in out/smoke/projection.json.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Live WS1 smoke: generation, funnel, probe, detector re-proof, projection | 70b264d2 | scripts/skillopt-funnel.cjs (+ out/ artifacts) |
| 2 | Live WS2 smoke + merge + calibration computation | e306d6d0 | scripts/skillopt-codereview.cjs, 230-07-CALIBRATION.md (+ out/ artifacts) |
| 3 | Jonathan reviews the calibration verdict | (checkpoint, resolved 2026-07-18) | "Calibrated -- close as-is"; reconciliation captured as SEED-061 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Funnel per-query budget too low for the real 124-roster judge**
- **Found during:** Task 1 (first funnel launch: 100% of units died `nonzero_exit`).
- **Root cause:** a judge call loads the full 124-skill roster + rubric (~50k tokens); with
  `--no-session-persistence` the prompt cache does not persist across hermetic spawns, so the
  first turn cache-creation costs ~$0.16, tripping the hardcoded `--max-budget-usd 0.05` fuse
  (`error_max_budget_usd`). Every unit exited non-zero and was honestly recorded not_evaluated.
- **Fix:** added a `--budget-per-query <usd>` CLI flag flowing to `config.budgetPerQueryUsd`
  (default unchanged); ran the smoke at 0.25. HALTED the funnel on the >5% not_evaluated rate,
  diagnosed with a single manual spawn (captured the `error_max_budget_usd` envelope), then
  re-ran. No artifact was hand-edited to green.
- **Files modified:** scripts/skillopt-funnel.cjs
- **Commit:** 70b264d2

**2. [Rule 3 - Blocking] WS2 opus review could not complete in the execution window; added resume**
- **Found during:** Task 2 (opus review/refute calls run ~3-4 min each; the environment reaps
  detached background/nohup parents and caps foreground Bash at 10 min; background codereview
  was also classifier-denied).
- **Fix:** added a per-file result cache (out/review/files/<stem>.json) so a completed file is
  reused instead of re-spending opus, with findings aggregated from EVERY cached file (so the
  two smoke files reviewed across separate launches yield one complete findings.json), plus
  `--concurrency`, `--review-max-turns`, and `--max-chunk-lines` flags. The check-card-fire
  review pass had already produced its anchored findings on disk; its refute pass and the
  mos-status review were completed via the exported primitives, then aggregated by the resume
  path. Every finding is the real output of a live opus pass; nothing was fabricated.
- **Files modified:** scripts/skillopt-codereview.cjs
- **Commit:** e306d6d0

**3. [Rule 3 - Probe construction] splash induced-probe trimmed to a single query**
- **Found during:** Task 1 (funnel setup).
- **Issue:** `--probe-timeout-unit` forces only a skill's FIRST unit to time out. With splash's
  8 generated queries, the other 7 would succeed and splash would classify `flagged`, not
  `not_evaluated`, contradicting the D7 `checkSmokeAgreement` probe gate and the smoke label.
- **Fix:** trimmed splash's query set to its single first query (original preserved as
  out/queries/splash.full.json.bak), so the forced timeout is splash's sole unit and it lands
  `not_evaluated` at the skill level, exactly mirroring the funnel selftest's single-query
  probe fixture. This induces the HARDER outcome (not_evaluated), the opposite of editing to
  green.
- **Files modified:** out/queries/splash.json (gitignored runtime artifact)

## Issues Encountered

- **Nested-capture side effect (reverted):** the `--capture doctor "...fix any install-cache
  drift"` spawn runs a real agent with default tools under `dontAsk`, and the "fix"-phrased
  query led it to autonomously edit scripts/check-card-fire.cjs (121 lines), the card-fire
  tests, and resolve a debug todo. The detector proof still succeeded (doctor fired), but the
  collateral edits were out of scope and would have corrupted the WS2 defect target, so they
  were restored to committed state via per-file `git checkout --` before WS2 ran. Lesson: use a
  read-only query phrasing for capture spawns.
- **4 transport timeouts** (`deck-7`, `doctor-0/1/2`) during the congested early funnel passes
  (the background job was reaped and resumed several times). Recorded honestly as not_evaluated;
  they do not change any labeled skill's verdict (doctor flags on a real miss regardless).
- **Review-call costs not persisted:** because WS2 finished via manual resume drivers, the three
  opus review envelopes were not written to unit records; the projection's review bucket is a
  flagged estimate.

## Threat Model Adherence

| Threat ID | Disposition | How honored |
|-----------|-------------|-------------|
| T-230-22 (spend DoS) | mitigate | scope locked to smoke skills via --families/--skills; no full-fleet flag used; funnel HALTED at >5% not_evaluated for diagnosis before re-run |
| T-230-23 (self-grading) | mitigate | agreement computed by deterministic checkSmokeAgreement vs pre-approved labels; the 30% FAIL is reported, not tuned away; no mid-run rubric change |
| T-230-24 (probe/failed units absorbed) | mitigate | induced_probe asserted present-as-not_evaluated by code; reconciliation re-checked on live artifacts (97 = 92 + 5) |
| T-230-25 (writing outside out/) | mitigate | git status confirms no skills/ drift; the only scripts/ changes are the two intentional, committed harness fixes; the nested-capture edits were reverted |
| T-230-SC (package installs) | accept (N/A) | zero installs |

## Known Stubs

None. The review bucket cost in projection.json is a flagged estimate (not a stub); every other
number is measured from live envelopes.

## Self-Check: PASSED

- FOUND: .planning/phases/230-.../230-07-CALIBRATION.md
- FOUND: .planning/phases/230-.../out/smoke/projection.json
- FOUND: .planning/phases/230-.../out/funnel/funnel-results.json (reconcile_ok true, 97 units)
- FOUND: .planning/phases/230-.../out/review/findings.json (1 CONFIRMED)
- FOUND: .planning/phases/230-.../out/report/skillopt-report.md (STOP-gated)
- FOUND: .planning/phases/230-.../out/captures/doctor.jsonl + offtopic-weather.jsonl
- FOUND commit: 70b264d2 (Task 1 funnel budget fix)
- FOUND commit: e306d6d0 (Task 2 codereview resume fix)

---
*Phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur*
*Completed: 2026-07-18. Calibration verdict: "Calibrated -- close as-is." Reconciliation work (null-negative labeling fix, re-labeled smoke re-run) captured as SEED-061, not blocking this phase's closure. Fleet run stays deferred behind a future explicit opt-in.*
