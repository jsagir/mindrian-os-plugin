---
phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
plan: 06
subsystem: skill-fleet-optimization / harness close-out
tags: [aggregation, human-gate, eval-harness, reconciliation, do-no-harm, write-path, evidence-quote, smoke-replay, cjs, no-api-spend]

# Dependency graph
requires:
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 01
    provides: "lib/core/skillopt-schemas.cjs (LoopSummarySchema, CodeFindingSchema, UnitRecordSchema, NOT_EVALUATED_REASONS, PHASE_OUT_DIR, assertUnderOut, toJsonSchemas)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 02
    provides: "out/funnel/funnel-results.json shape + out/funnel/units/ ledger (UnitRecord payloads = JudgeVerdict)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 03
    provides: "out/loop/<skill>/summary.json shape (LoopSummary + blocked_by_regression + regressed_queries)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 04
    provides: "out/review/findings.json + findings-raw.json shapes; anchorEvidence (reused for the D4 evidence-quote check)"
  - phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur
    plan: 05
    provides: "smoke-labels.json (13 records) - the D7 expected_funnel reference joined by checkSmokeAgreement"
provides:
  - "scripts/skillopt-merge.cjs: report aggregator + terminal human-approval STOP gate (runMerge, buildReport); no write path toward skills/ or scripts/, no write-back flag anywhere (CFM4)"
  - "scripts/skillopt-eval.cjs: the independent deterministic gate layer re-deriving D3/D4/D5/D6/D7 from artifacts alone (checkReconciliation, checkDoNoHarm, checkWritePath, checkEvidenceQuotes, checkSmokeAgreement)"
  - "tests/run-all-230.sh: the phase's single PASS/FAIL/SKIP aggregator gate, deterministic + zero-API-spend, wired into repo test convention"
affects: [230-07-smoke]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer verification: skillopt-eval re-derives every critical gate from on-disk artifacts, independent of the pipeline scripts that produced them (huji-eval over huji-run-one discipline)"
    - "Missing input renders NOT RUN, never empty-implies-clean: the merge distinguishes a step that did not run from a step that ran and found nothing (T-230-18/D5)"
    - "Independent reconciliation counter: the merge re-counts spawned/ok/not_evaluated from the unit files themselves and exits 1 on drift, never trusting the pipeline's own tally"
    - "Terminal human gate with zero write capability: the merge emits an itemized approval checklist + STOP banner and stops; no flag turns an approved diff into a real edit"
    - "realpath-based write-path containment: checkWritePath resolves symlinks and rejects any out/ file that resolves under skills/ scripts/ lib/ (T-230-20)"

key-files:
  created:
    - scripts/skillopt-merge.cjs
    - scripts/skillopt-eval.cjs
    - tests/run-all-230.sh
  modified: []

key-decisions:
  - "Fleet trigger-accuracy is re-derived in the merge from the funnel UNIT payloads (predicted_skill === expected_skill over ok units), not read from funnel-results, so not_evaluated units are excluded from both numerator and denominator by construction (D5)."
  - "Reconciliation at the merge layer counts unit files by status and treats an unparseable or unexpected-status file as an identity break (exit 1), a stronger independent check than re-reading the pipeline's own reconciliation block."
  - "schemas-roundtrip spawns node (process.execPath) on the schema module selftest, never claude; the whole eval file has zero spawnSync('claude') call sites so it is free to run on every push."
  - "checkWritePath does NOT follow symlinked directories (a node_modules symlink is one realpath check, not a descent), keeping the walk bounded while still catching any symlink that escapes into a forbidden tree."
  - "The triggerloop leg in run-all-230.sh is guarded on the live firing capture (per the plan), so it runs green now (captures present) and SKIPs cleanly in a fresh checkout where .planning/out is gitignored."

requirements-completed: [D3, D4, D5, D6]

# Metrics
duration: 35min
completed: 2026-07-17
---

# Phase 230 Plan 06: Harness Close-Out Summary

**The three pieces that close the harness: the merge step that folds every artifact into ONE honest human-gated report and STOPs, the independent skillopt-eval layer that re-derives D3/D4/D5/D6/D7 from the artifacts alone so a pipeline bug cannot vouch for itself, and run-all-230.sh, the deterministic zero-API-spend phase gate. All three green on fixtures with no live spend.**

## What Was Built

This plan adds the after-the-fact layer that sits on top of Plans 02-04. Those plans put guardrails INSIDE each pipeline script (a funnel that exits 1 on its own reconciliation drift, a loop that blocks a regressing diff, a reviewer that drops a fabricated finding). The risk that leaves is self-vouching: if a pipeline script has a bug, its own internal guardrail is exactly the thing that might be wrong. So this plan re-checks every critical gate from the OUTSIDE, reading only the bytes on disk.

1. **scripts/skillopt-merge.cjs** - the aggregator + terminal gate. `buildReport` folds the funnel verdicts, the flagged-skill loop summaries, the WS2 code findings, and the per-spawn unit ledgers into `report.json` + `skillopt-report.md`, five sections: run metrics, per-skill trigger verdicts, code-quality findings (CONFIRMED/PLAUSIBLE only), every not_evaluated unit by name, and the terminal itemized approval checklist under a STOP banner. A missing input renders a NOT RUN section, never an empty-implies-clean one. An independent reconciliation re-counts the unit files and the script exits 1 with the delta named if `spawned != ok + not_evaluated` across any ledger. There is no code path that writes to `skills/` or `scripts/`, and no flag that pushes an approved change back onto a real file.

2. **scripts/skillopt-eval.cjs** - the independent deterministic gate layer. Six `--check` subcommands under `--suite code`, each re-deriving one dimension from disk: schemas-roundtrip (the zod source is sound and emits no `$schema` meta-ref), reconciliation (D5, per-ledger identity + closed-vocab reasons), do-no-harm (D3, a proposed diff implies zero regression), write-path (D6, no out/ file resolves under skills/scripts/lib via realpath), evidence-quote (D4, every reported finding's quote is verbatim in the real .cjs, reusing Plan 04's anchor), and smoke-replay (D7, funnel verdicts agree with smoke-labels.json at >= tolerance and the not_evaluated probe landed). Each SKIPs cleanly when its input does not exist yet.

3. **tests/run-all-230.sh** - the phase gate. Nine legs on the run-all-229 conventions, deterministic and zero-API-spend. It is the AUTOMATED half of the gate; the paid LLM layer and the human calibration are announced as PHASE GATE PART 2, never asserted here.

## How It Works (Feynman)

Think of a factory that inspects its own machines and then writes a report you sign off on. Two dangers: the factory could lie about a machine that broke (call a jammed line "fine"), and it could quietly ship a "fix" onto a machine that was already working. This plan hires an outside auditor who never talks to the factory. The auditor walks the paper trail: counts every job ticket and checks that finished-plus-failed equals started (no ticket vanished), re-reads each quoted defect against the real machine (no invented quotes), and confirms no output pipe was secretly plumbed back into the shop floor (nothing writes to the real skills). Then the report lands on your desk with a checklist and a big STOP: nothing changes until you tick the boxes by hand.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | skillopt-merge.cjs - aggregate, reconcile, STOP at the human gate | e8ad380b | scripts/skillopt-merge.cjs |
| 2 | skillopt-eval.cjs - the independent deterministic gate layer | e4374152 | scripts/skillopt-eval.cjs |
| 3 | run-all-230.sh - the phase aggregator gate | 5fffddb4 | tests/run-all-230.sh |

## Verification

- `node scripts/skillopt-merge.cjs --selftest` exits 0 on all five fixtures: the not_evaluated probe is excluded from the accuracy numerator AND denominator while listed by name in section 4; a refuted finding appears in no findings section but is counted in the survival-rate metric; a missing loop dir renders NOT RUN; a blocked_by_regression summary renders as blocked (not a proposed diff); an unparseable unit file breaks reconciliation and no report is written. The grep gate confirms `assertUnderOut` is present and no `--apply` / write-back flag exists.
- `node scripts/skillopt-eval.cjs --selftest` exits 0 across twelve PASS/FAIL fixture directions (six checks x2), plus clean SKIP guards. `--suite code` on the current repo exits 0 with explicit SKIP lines for the four artifacts that do not exist yet (no live funnel/loop/review). Zero `spawnSync('claude')` call sites.
- `bash tests/run-all-230.sh` exits 0: 9 PASS, 0 FAIL, 0 SKIP at this point in the phase (the live capture is present so the triggerloop leg runs). A temporarily injected false leg produces a nonzero exit. Executable bit set, no em-dashes, no spawnSync/claude in any leg.
- `git status` shows only the three new files as this plan's contribution (plus the pre-existing, out-of-scope `evals/plurai/211-baseline.json` drift carried from Plan 03).

## Deviations from Plan

None - the plan executed exactly as written. Two implementation choices within Claude's discretion, both faithful readings of the spec:

1. The merge re-derives fleet trigger-accuracy from the funnel unit payloads (predicted vs expected over ok units) rather than from a stored accuracy field, because funnel-results.json carries per-skill verdicts but not per-query predictions; this is the only place the raw prediction lives, and computing it here is what makes the not_evaluated exclusion structural rather than trusted.
2. schemas-roundtrip spawns `node` (process.execPath) on the schema module to honor the plan's "node lib/core/skillopt-schemas.cjs selftest exits 0" wording while keeping the mandated zero-`claude`-spawn property.

## Threat Model Adherence

| Threat ID | Disposition | How this plan honors it |
|-----------|-------------|-------------------------|
| T-230-18 (report absorbing missing/failed workstreams) | mitigate | missing inputs render NOT RUN; the merge reconciliation identity exits 1 on drift; every not_evaluated unit is listed by name in section 4 |
| T-230-19 (write-back path from merge) | mitigate | no write-back flag or code path exists; the only merge write targets are under out/report/, guarded by assertUnderOut; grep-gated in verify |
| T-230-20 (out/ escape via symlink) | mitigate | checkWritePath resolves realpaths (fs.realpathSync) and rejects any resolution under skills/, scripts/, lib/; the FAIL fixture crafts a real symlink into skills/ and it is caught |
| T-230-21 (pipeline scripts vouching for themselves) | mitigate | skillopt-eval re-derives D3/D4/D5/D6/D7 from disk artifacts independently of the scripts that produced them (two-layer discipline) |
| T-230-SC (package installs) | accept (N/A) | zero installs this plan |

## Deferred Issues (pre-existing, out of scope)

`node scripts/doctor.cjs --acceptance` reports 13/15 with two FAILs, BOTH pre-existing and unrelated to this plan's three files (logged in `deferred-items.md`):
- **coverage-gate / skill-mirrors `pws-brain (MISSING)`** - fails identically with this plan's only working-tree change stashed away; this plan touched nothing under skills/ or any mirror.
- **verify-release-clean-tree drift (1 file)** - the pre-existing `evals/plurai/211-baseline.json` runtime artifact from Plan 03, already documented out-of-scope in the 03 and 04 summaries.

## Known Stubs

None. All three files are fully wired to the Plan 01 contract module and the Plan 02-05 artifact shapes. The merge's "n/a" metrics and "NOT RUN" sections and the eval's SKIP lines are intentional honest-absence markers (a step that did not run), not stubs; they populate the moment a live pipeline run lands the artifacts. The only deferred surface is the paid smoke run itself (Plan 07 opt-in), which is by design outside this phase.

## User Setup Required

None - no external service configuration. Both scripts run on the already-pinned `zod@^3.25.76` (zod/v4 subpath) and Node already on PATH; zero new dependency.

## Next Phase Readiness

- Plan 07 (smoke) can run the full deterministic gate with `bash tests/run-all-230.sh` before and after the live smoke spend; the artifact-dependent eval checks (reconciliation, do-no-harm, evidence-quote, smoke-replay) flip from SKIP to a real PASS/FAIL the moment the smoke run lands out/funnel, out/loop, and out/review.
- `node scripts/skillopt-merge.cjs` produces the one human-gated report from whatever artifacts exist; on a live smoke run it will carry the real per-skill verdicts, the surviving findings, and the itemized approval checklist, then STOP.
- D3, D4, D5, D6 are now each enforced twice: once inside the pipeline scripts (Plans 02-04), once independently over artifacts (this plan). D7 smoke agreement is wired and waits only for a live funnel to have something to replay.

## Self-Check: PASSED

- FOUND: scripts/skillopt-merge.cjs
- FOUND: scripts/skillopt-eval.cjs
- FOUND: tests/run-all-230.sh
- FOUND commit: e8ad380b (Task 1)
- FOUND commit: e4374152 (Task 2)
- FOUND commit: 5fffddb4 (Task 3)

---
*Phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur*
*Completed: 2026-07-17*
