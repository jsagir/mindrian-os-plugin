---
phase: 229-huji-pitch-feedback-module
plan: 02
subsystem: eval
tags: [eval-fixtures, ground-truth, probes, injection, fairness, degenerate, aggregator, bash, D1, D2, D3, D8, D10]

# Dependency graph
requires:
  - phase: 229-huji-pitch-feedback-module
    provides: "two customer sample transcripts (sample-1-safescan, sample-2-study-app), 229-VALIDATION D1-D10 map, CONTRACTS.md Wave-0 resolutions, evidence/feedback schemas from Plan 01"
provides:
  - "sample-1.inventory.json + sample-2.inventory.json - transcript-traceable D2 recall ground truth (also D1 covered-element ground truth)"
  - "eval/probes/manifest.json - 7 probes across 5 types (duplicate-anchor, near-dup-fairness, injection, degenerate, covered-element)"
  - "5 probe transcripts: injection-safescan, near-dup-studyapp-a/-b, degenerate-empty, degenerate-noise"
  - "tests/run-all-229.sh - the phase PASS/FAIL/SKIP gate, D1-first, green-while-SKIP, with the human 'better than a TA' checkpoint doctrine"
affects: [229-03-eval-harness, 229-04-intake-adapter, 229-07-batch-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transcript-traceable ground truth: every inventory item carries verbatim quote + M:SS timestamp + evidenced disposition; _label_status pending human confirm"
    - "Machine-readable probe manifest {id, type, source_sample, expected_behavior, inject_positions} the harness reads to inject at known cohort positions"
    - "run-all aggregator with file-guarded run_if legs: partial phase SKIPs (counted), never silent; D1 hardest gate first; two-part gate (structure green + human checkpoint)"
    - "Injection probe as inert data: adversarial prompt-override line lives only inside injection-safescan.md, headered as PROBE DATA, treated as content never command"

key-files:
  created:
    - .planning/phases/229-huji-pitch-feedback-module/eval/labeled-inventories/sample-1.inventory.json
    - .planning/phases/229-huji-pitch-feedback-module/eval/labeled-inventories/sample-2.inventory.json
    - .planning/phases/229-huji-pitch-feedback-module/eval/probes/manifest.json
    - .planning/phases/229-huji-pitch-feedback-module/eval/probes/injection-safescan.md
    - .planning/phases/229-huji-pitch-feedback-module/eval/probes/near-dup-studyapp-a.md
    - .planning/phases/229-huji-pitch-feedback-module/eval/probes/near-dup-studyapp-b.md
    - .planning/phases/229-huji-pitch-feedback-module/eval/probes/degenerate-empty.md
    - .planning/phases/229-huji-pitch-feedback-module/eval/probes/degenerate-noise.md
    - tests/run-all-229.sh
  modified: []

key-decisions:
  - "Inventories are mechanical enumeration only - every entity/claim/gap/covered-element traces to a verbatim transcript span; nothing inferred beyond the text (T-229-02-02 anti-fabrication)"
  - "sample-2 records BOTH risks WITH mitigations in covered_elements so marking risks 'missing' is a detectable D1 FAIL, and the metacognition (self-named gaps) is a separate covered element (reward, never double-punish)"
  - "duplicate-anchor probe emitted per sample (two entries), both pinned to inject_positions [1,50,100,150,200] for D3 fairness at N=200"
  - "degenerate-empty.md is a true 0-byte file (the probe IS emptiness); degenerate-noise.md is diarized all-noise - both fail-closed probes, not gradeable content"
  - "run-all-229 drops the run-all-226 eureka-offline NODE_OPTIONS preload (229 has no offline transformers dependency to fence)"
  - "The human 'better than a TA' checkpoint is announced as PHASE GATE PART 2 but never asserted green by the script (run-all-226 precedent: human calibration is a real leg, never automated)"

patterns-established:
  - "submission_id convention: safescan-001 / study-app-001 (mirrors the CONTRACTS.md writer-spike claim id namespace)"
  - "Every probe keeps the customer diarized Speaker N: (M:SS) format so the intake adapter parses probes and real submissions identically"

requirements-completed: [D2, D3, D8, D10]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 229 Plan 02: Eval Scaffolding (Ground-Truth Inventories, Probe Set, Aggregator) Summary

**Two transcript-traceable ground-truth inventories (D2/D1), a 7-probe synthetic set with a machine-readable manifest (D3 duplicate-anchor, D8 fairness, injection, degenerate, covered-element), and the run-all-229.sh phase gate that runs D1 first, SKIPs green until the harness lands, and reserves the "better than a TA" verdict as a human-only leg.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files created:** 9

## Accomplishments

- **Task 1 - labeled inventories.** `sample-1.inventory.json` (SafeScan) mechanically enumerates the product, the big-nine scope, the smart-light-sensor tech (evidenced `asserted`), the three-step usage, the 18-month shelf life, FDA compliance, all four hires (hardware/biosensor engineer, mobile app developer, safety expert, operation manager), and the roadmap. `sample-2.inventory.json` (study-app) enumerates the three features (summaries/flashcards/quizzes), the 10-12 week timeline, the three roles, the three self-named gaps in `self_identified_gaps` (deeper market research, competitor analysis, user testing), and BOTH risks WITH their mitigations in `covered_elements` (low engagement -> gamification; inaccurate content -> expert validation). Every item carries a verbatim `quote` + `M:SS` timestamp; `_label_status: "drafted-pending-human-confirm"` reserves Jonathan's confirmation for the Plan 09 demo.
- **Task 2 - probe set + manifest.** `manifest.json` registers 7 probes across all 5 required types. `duplicate-anchor` is emitted per sample, both at `inject_positions [1,50,100,150,200]`. `near-dup-studyapp-a.md` and `-b.md` are two lightly reworded copies of study-app with every claim identical (the D8 swap test). `injection-safescan.md` is a copy of SafeScan carrying apostrophes, markdown, and one inert prompt-override line at 1:45, headered as PROBE DATA. `degenerate-empty.md` (0 bytes) and `degenerate-noise.md` (all "Recording in progress") are the fail-closed probes. The `covered-element` probe points at sample-2's 0:52 risks+mitigation.
- **Task 3 - aggregator.** `tests/run-all-229.sh` is modeled verbatim on `run-all-226.sh` (identical run/run_if counters, file-guarded SKIP, non-zero-exit-on-FAIL), drops the eureka-offline preload, lists the D1 quote-verifier leg first as the hardest gate, guards every D1-D10 leg on its harness file (`scripts/huji-eval.cjs` / `scripts/huji-batch.cjs`), and announces the two-part gate with the human "better than a TA" checkpoint as a non-automated leg. It exits 0 with all 8 legs SKIPPED until the Wave 1+ harness lands.

## Task Commits

1. **Task 1: Hand-label ground-truth inventories** - `edbe685a` (feat)
2. **Task 2: Author synthetic probe set + manifest** - `ecf64371` (feat)
3. **Task 3: Author run-all-229.sh aggregator** - `64a2d448` (feat)

## Deviations from Plan

None - plan executed exactly as written. All three task verifications passed on first run. The `.planning/` eval files were force-added (`git add -f`) per the established repo convention (CLAUDE.md: ".planning/ is gitignored, so git add -f"), consistent with Plan 01; `tests/run-all-229.sh` is outside `.planning/` and added normally.

## Threat Surface Notes

- **T-229-02-01 (injection):** The prompt-override line is confined to `injection-safescan.md`, headered explicitly as inert PROBE DATA, and was treated as content (never obeyed) during authoring. The Write pre-hook flagged the injection pattern as expected; this is the intended adversarial fixture, not a live instruction. It validates (in Plan 03/07) that Stage A extraction treats transcript content as data.
- **T-229-02-02 (ground-truth spoofing):** Inventories are mechanical enumeration traceable to verbatim spans with `_label_status` pending human confirm; no label was fabricated. A fabricated label would corrupt the D2 recall gate.
- **T-229-02-SC (installs):** Zero package installs - pure data + one bash file.

## Known Stubs

None that block the plan goal. The eight `run-all-229.sh` legs SKIP by design because their harness scripts (`scripts/huji-eval.cjs`, `scripts/huji-batch.cjs`) are built in later waves (Plans 03/04/07); each SKIP is counted and printed, never silent, and turns RED the moment its leg fails. This is the intended green-while-SKIP posture, not an unwired stub.

## Self-Check: PASSED

- All 9 created files present on disk (2 inventories, manifest, 5 probe transcripts, run-all-229.sh).
- All 3 task commits present in git history (edbe685a, ecf64371, 64a2d448).
- Task 1/2 asserts re-run green; `bash tests/run-all-229.sh` exits 0 with 8 SKIPs.

---
*Phase: 229-huji-pitch-feedback-module*
*Completed: 2026-07-16*
