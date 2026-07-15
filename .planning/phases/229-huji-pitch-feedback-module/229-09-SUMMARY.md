---
phase: 229-huji-pitch-feedback-module
plan: 09
subsystem: testing
tags: [pws-grading, demo, eval, claude-cli, json-schema, auth, calibration, minto]

# Dependency graph
requires:
  - phase: 229-08
    provides: batch orchestrator (runBatch) + D10 harness
  - phase: 229-07
    provides: single-submission runner (runOne) + scratch-room scaffold
  - phase: 229-06
    provides: LLM judge spawner + calibration protocol
  - phase: 229-04
    provides: PWS_grading recipe + score-and-continue rubric
provides:
  - "Automated phase-gate half verified GREEN (run-all-229 PASS=9, code 7/7, judge-math + scaffold + pool selftests)"
  - "Empirical diagnosis of the 3-layer CLI/auth blocker that stops the first live demo spawn (DI-1/DI-2/DI-3)"
  - "demo/DEMO-VERDICT.md (pipeline-output section + pending Amnon-verdict placeholder)"
  - "deferred-items.md (the 3 pipeline bugs with reproductions + recommended fixes)"
affects: [229-pipeline-fix, huji-run-one, huji-eval, CONTRACTS-AUTH_PATH]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-spawn contract verification: model-free dry-runs assert arg arrays but never spawn; first live spawn exposes CLI-contract drift"
    - "Honest-blocker discipline: document + defer grade-provenance/auth bugs rather than blind-patch an unvalidatable pipeline"

key-files:
  created:
    - .planning/phases/229-huji-pitch-feedback-module/demo/DEMO-VERDICT.md
    - .planning/phases/229-huji-pitch-feedback-module/deferred-items.md
  modified:
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Did NOT fabricate the two demo feedback artifacts - the demo is the sale; a faked artifact costs the deal (threat T-229-09-01)"
  - "Did NOT blind-patch the 3 pipeline bugs - each touches the grade-provenance/auth contract and none can be validated without a credential; logged to deferred-items.md for a dedicated fix plan"
  - "STATE.md updated by manual additive log append; frontmatter counters left untouched (anti-clobber precedent); plan stays INCOMPLETE (blocked)"

patterns-established:
  - "The demo run is the first live claude spawn in a phase built entirely on model-free tests - treat it as the CLI-contract integration test"

requirements-completed: []  # D6/D7 human halves NOT completed - blocked at checkpoint

# Metrics
duration: ~40min
completed: 2026-07-16
---

# Phase 229 Plan 09: Demo Run + Human Calibration Checkpoint Summary

**Automated phase-gate half verified GREEN; the live demo (the sale) is blocked by a reproduced 3-layer CLI/auth chain on the first live spawn, so the two feedback artifacts were honestly NOT generated and Amnon's verdict + the HUJI workshop remain pending.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-16 (session)
- **Completed:** 2026-07-16
- **Tasks:** 1 of 3 attempted (Task 1 = auto, partial/blocked); Tasks 2-3 = blocking-human checkpoints, not startable this session
- **Files created:** 2 (DEMO-VERDICT.md, deferred-items.md) + demo/ dir
- **Files modified:** 2 (ROADMAP.md, STATE.md)

## Accomplishments

- **Automated phase-gate half GREEN.** `bash tests/run-all-229.sh` -> PASS=9 FAIL=0 SKIP=0; `huji-eval --suite code --strict` -> 7/7; `--suite anchors --judge` self-verifies the calibration math (1 PASS + 4 FAIL fixtures) then cleanly SKIPS the live judge (no key); `huji-run-one --selftest-scaffold` + `--dry-run` and `huji-batch --dry-run 5` + `--test-d10` all exit 0.
- **Precise, empirical blocker diagnosis** of why the live demo cannot run, reproduced against `claude` 2.1.211 (see Issues Encountered). Delivered as `demo/DEMO-VERDICT.md` + `deferred-items.md`.
- **Held the line on honesty:** no fabricated demo artifacts, no blind pipeline patch, no hardcoded key.

## Task Commits

1. **Task 1 (partial - blocked):** demo/DEMO-VERDICT.md + deferred-items.md + ROADMAP + STATE - see plan-metadata commit below (no separate per-task code commit: Task 1's live artifacts were blocked, so the work product is the verification record + diagnosis).

**Plan metadata:** committed with this SUMMARY (docs, see final line).

_Tasks 2 (Amnon verdict) and 3 (HUJI calibration workshop) are `checkpoint:human-verify gate="blocking"` and were not started - they require real-world human actions._

## Files Created/Modified

- `demo/DEMO-VERDICT.md` - Pipeline-output section (BLOCKED, cost $0, no model_id, judge unverified) + the 3-layer blocker chain with reproductions + a pending placeholder for Amnon's verbatim verdict and Jonathan's sign-off (Task 2).
- `deferred-items.md` - DI-1/DI-2/DI-3: the three pipeline bugs (json-schema-as-path, schema draft 2020-12, Stage A `--bare` credential) with empirical symptoms and recommended fixes.
- `.planning/ROADMAP.md` - 229-09 row flipped to `[~]` blocked-at-checkpoint with the blocker summary.
- `.planning/STATE.md` - manual additive log append (frontmatter counters untouched; plan stays incomplete).

**NOT produced (blocked, by design not omission):** `demo/feedback-sample-1.md`, `demo/feedback-sample-2.md` (no successful pipeline run), the `rubric-huji.md` few-shot slot (stays intentionally empty - no approved artifacts to embed), `calibration-workshop.md` (Task 3, needs the live workshop).

## Decisions Made

- **No fabrication of demo artifacts.** The demo IS the sale; threat T-229-09-01 says a fabricated/unfair artifact costs the deal. An absent artifact is honest; a faked one is not.
- **Document, do not blind-patch.** DI-1/DI-2/DI-3 are pre-existing bugs in shipped Plan 06/07/08 code, each on the grade-provenance or auth contract, and none can be validated end to end without a credential. Per the executor scope-boundary + auth-gate rules and the plan's own instruction, they are logged for a dedicated fix plan, not patched blind.
- **Manual STATE append, counters untouched** (documented 229-05/06/07/08 anti-clobber precedent; `gsd-tools` not on PATH; plan is incomplete so the completed-plans counter must not advance).

## Deviations from Plan

Not deviations in the Rule 1-4 auto-fix sense - the plan could not reach its auto-fix surface because Task 1's live run is gated. The single structural departure: Task 1 is reported as **partial/blocked**, not complete, because the two demo artifacts (its core deliverable) cannot be produced this session without resolving DI-1/DI-2/DI-3.

## Issues Encountered

The first live `claude` spawn (Plan 09 is the first non-dry-run in Phase 229) hits a 3-layer chain against `claude` 2.1.211, each reproduced:

1. **DI-1 - `--json-schema` wants inline JSON, not a path.** `huji-run-one.cjs` (both stages) and `huji-eval.cjs` (`spawnJudge`) pass a file path; the CLI JSON-parses it and fails: `Unrecognized token '/'`. `@file` also fails. Blocks Stage A, Stage B, and the judge identically.
2. **DI-2 - schema draft 2020-12 rejected.** The zod-generated schemas declare `draft/2020-12`; the CLI validator: `no schema with key or ref ".../draft/2020-12/schema"`. draft-07/no-`$schema` gets past.
3. **DI-3 - Stage A `--bare` has no credential.** Stage A is `--bare` (skips keychain) + key from `ANTHROPIC_API_KEY` (unset) -> `"Not logged in - Please run /login"`. Stage-A-specific: the NON-bare Stage B keychain path authenticates cleanly here (plugin loads, Larry active). Exactly the CONTRACTS AUTH_PATH risk.

Full reproductions + recommended fixes in `deferred-items.md`.

## User Setup Required

**To unblock the sale (ordered):**
1. DI-1: inline the schema JSON in `huji-run-one.cjs` (both stages) + `huji-eval.cjs` `spawnJudge` (mechanical).
2. DI-2: decide at the zod-generation layer whether to emit an accepted draft or strip `$schema`, then re-verify every gate (Jonathan - grade-provenance surface).
3. DI-3: export `ANTHROPIC_API_KEY` for `--bare` Stage A, OR revise AUTH_PATH so Stage A uses the keychain like Stage B (Jonathan/CONTRACTS).
4. Run the live demo over both samples, clear the 0.7 Spearman judge gate, hand the 2 artifacts to Amnon for the "better than a TA" verdict, embed approved artifacts as the rubric few-shot anchors, then run the HUJI calibration workshop (Task 3).

## Next Phase Readiness

- **Blocked at the two-part phase gate.** Automated half is green; the human half (Amnon's verdict + the HUJI TA blind-comparison workshop) cannot proceed until the live demo artifacts exist, which needs DI-1/DI-2/DI-3 cleared.
- No student data was processed; no Brain egress occurred (no live run). Canon Part 8 intact.

## Self-Check: PASSED

- demo/DEMO-VERDICT.md exists; deferred-items.md exists; ROADMAP.md + STATE.md updated. (Verified below in the commit step.)

---
*Phase: 229-huji-pitch-feedback-module*
*Completed (blocked at checkpoint): 2026-07-16*
