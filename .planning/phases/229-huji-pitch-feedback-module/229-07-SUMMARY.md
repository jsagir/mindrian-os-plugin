---
phase: 229-huji-pitch-feedback-module
plan: 07
subsystem: infra
tags: [claude-code-headless, spawnSync, scratch-room, model-profiles, zod, part8-egress, minto, batch-pipeline]

# Dependency graph
requires:
  - phase: 229-01
    provides: EvidenceSchema + FeedbackResultSchema (zod) + JSON Schema files + CONTRACTS.md (PIPELINE_ARG, INTAKE_PATH, SCORED_MODE, AUTH_PATH, RECIPE_HOME)
  - phase: 229-03
    provides: huji-eval.quoteVerifier (G1) + deterministic code checks
  - phase: 229-04
    provides: PWS_grading recipe (recipe-maps NAMED_RECIPES + pipelines/PWS_grading) + frozen rubric-huji.md (score-and-continue)
  - phase: 229-05
    provides: huji-intake.populateRoom (Stage A Claimify room-builder) + huji-stage-a-intake.md frozen prompt
provides:
  - "scripts/huji-run-one.cjs: scaffoldScratchRoom() + runOne() - the two-stage isolated per-submission runner"
  - "Grading-legal scratch-room scaffold (Stage: Validation, pinned-model .config.json) mirroring birthRoom STEP-1, never compute-state"
  - "Two-stage spawn: Stage A --bare haiku extraction (transcript by path) -> Stage B /mos:pipeline PWS_grading (--plugin-dir opus, frozen rubric appended)"
  - "Per-unit guardrail battery G1/G2/G3/G4/G6 gating the out/<id>/.done marker"
affects: [229-08, huji-batch, batch-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "spawnSync args-array (no shell) for both headless stages; transcript passed by FILE PATH, never argv-inlined (T-229-07-01)"
    - "Scratch room grading-legality by direct STATE.md write (literal Stage: Validation), verified via the SAME model-profiles cascade the chain uses"
    - "Chain runs IN-SESSION via the plugin's own /mos:pipeline command; the orchestrator never imports chain-executor"
    - ".done written ONLY after every per-unit gate passes AND feedback.md is non-empty"

key-files:
  created:
    - scripts/huji-run-one.cjs
  modified: []

key-decisions:
  - "Mirror birthRoom STEP-1 scaffold path (scaffoldRoomSkeleton) rather than call birthRoom itself - birthRoom runs compute-state (flips grading off) and registers the room in ROOMS_HOME, neither wanted for an ephemeral out-of-tree scratch room"
  - "Pin the batch model via scratch .config.json model_overrides (grading + framework-runner) so the in-session resolveModel cascade routes the spine to the pinned FULL model ID (one governed door, Canon Part 7)"
  - "Added G3 (Part-8 egress hygiene, reusing part8-egress-guard.classify) as an additional .done gate beyond the plan's G1/G2/G4/G6, per the phase threat register (T-229-07 mitigate) - Rule 2"

patterns-established:
  - "Two-stage auth split (CONTRACTS AUTH_PATH): Stage A --bare + ANTHROPIC_API_KEY; Stage B --plugin-dir + keychain"
  - "Guardrail battery as a pure function (runGuardrails) so the batch loop and tests can call it without a model"

requirements-completed: [D1, D3, D4, D9, D10]

# Metrics
duration: 22min
completed: 2026-07-16
---

# Phase 229 Plan 07: Single-Submission Runner + Scratch-Room Scaffold + Per-Unit Guardrails Summary

**`scripts/huji-run-one.cjs`: a two-stage isolated per-submission runner that scaffolds a grading-legal scratch room, extracts quote-anchored evidence on --bare haiku, runs `/mos:pipeline PWS_grading` (opus + frozen rubric) in one headless session, and writes the `.done` marker only when the G1/G2/G3/G4/G6 guardrail battery passes.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-07-16
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- `scaffoldScratchRoom({roomDir, config})` builds the canonical 8-section ICM skeleton (via the shipped `scaffoldRoomSkeleton` that `birthRoom` STEP 1 uses), then writes STATE.md DIRECTLY with a literal `Stage: Validation` line and a `.config.json` pinning the batch model through `model_overrides`. It verifies grading-legality through the SAME `parseVentureStage`/`resolveModel` cascade the chain uses, and cleans up any partial room on failure.
- `runOne({subId, transcriptPath, deckPath, config, outDir})` runs Stage A (`--bare` haiku extraction, transcript passed by PATH) to emit `out/<id>/evidence.json` + populate the scratch room via the shipped Claimify writer, then Stage B (`/mos:pipeline PWS_grading` with `--plugin-dir` opus + `--append-system-prompt-file rubric-huji.md`) in one isolated session, emitting `feedback.md` (Minto pyramid) + `result.json` (cost, model_id, session_id, calibration_source).
- Per-unit guardrails run BEFORE `.done`: G1 quote-grounding (reuses `huji-eval.quoteVerifier`), G2 zod safeParse of both structured outputs, G3 Part-8 egress hygiene (reuses `part8-egress-guard.classify`), G4 pinned-model provenance, G6 Minto governing-thought-first + <900-word length. `.done` is written only when every gate passes AND feedback.md is non-empty.
- Isolation invariants held: `spawnSync` args-array on both stages (no shell), never `--continue`/`--resume`, `--no-session-persistence` everywhere, and the orchestrator never requires `chain-executor` (the chain runs in-session).

## Task Commits

1. **Task 1 + Task 2: scaffoldScratchRoom + two-stage runOne + guardrails** - `91efefa7` (feat)

Both tasks produce the single new file `scripts/huji-run-one.cjs` and were written and committed together as one atomic unit (Task 1's scaffold + selftest and Task 2's runOne share the same module and are interdependent).

**Plan metadata:** this SUMMARY + STATE.md log append + ROADMAP checkbox (docs commit).

## Files Created/Modified
- `scripts/huji-run-one.cjs` - `scaffoldScratchRoom` + `runOne` + the guardrail battery, arg-array builders (`buildStageAArgs`/`buildStageBArgs`), envelope parser, Minto renderer, and `--selftest-scaffold` / `--dry-run` CLI legs.

## Decisions Made
- **Mirror birthRoom STEP-1, do not call birthRoom.** `birthRoom` runs `scripts/compute-state` (STEP 3) which would recompute the stage from section presence and overwrite the required `Stage: Validation` marker (flipping grading to skip), and it registers the room in ROOMS_HOME. For an ephemeral out-of-tree scratch room both are wrong, so the runner calls `scaffoldRoomSkeleton` directly (the same helper birthRoom's STEP 1 uses) and writes STATE.md itself. This is exactly what RESEARCH Pitfall 2 + the CONTRACTS isolation invariant prescribe.
- **Pin the model via `.config.json` model_overrides.** The scratch room carries `model_overrides.grading` + `model_overrides.framework-runner` = the pinned FULL model ID, so the in-session `resolveModel` cascade (step 1) routes the spine to one model (no second routing brain, Canon Part 7). The Stage B spawn ALSO passes `--model <pinned>` as the hard pin.
- **Pass the transcript by PATH, never argv-inlined** (T-229-07-01): Stage A's prompt references the transcript file path and the session Reads it; the untrusted content never enters argv, and args-array `spawnSync` (no shell) removes quote-injection surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added G3 (Part-8 egress hygiene) as an additional `.done` gate**
- **Found during:** Task 2 (guardrail battery)
- **Issue:** The plan's `<tasks>` names G1/G2/G4/G6 as the `.done` gates, but the phase `<threat_model>` assigns T-229-07 mitigations and the plan's `files_to_read` explicitly calls for reusing `part8-egress-guard.classify()` for a "per-unit G3 Brain-egress guardrail". A per-unit run that consulted the Brain must be hygiene-checked before delivery, or a student-content egress could ride into a delivered artifact.
- **Fix:** `runGuardrails` scans an optional per-room `brain-query-log.jsonl` with `part8-egress-guard.classify` plus a per-unit entity grep from `evidence.json`; a `block` verdict or student-string leak fails G3 and blocks `.done`. The gate is vacuous (passes) when no query log exists, so it never false-fails the transcript-only Tier-0 path.
- **Files modified:** scripts/huji-run-one.cjs
- **Verification:** `--dry-run` + `--selftest-scaffold` green; guardrail smoke test (good fixture passes all gates, wrong-model fixture caught by G4).
- **Committed in:** 91efefa7 (Task commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical / threat-register mitigation).
**Impact on plan:** G3 is additive and defensive; it strengthens the `.done` gate without changing the G1/G2/G4/G6 contract. No scope creep.

## Issues Encountered
- **gsd-tools binary unavailable + concurrent-session STATE.md clobber risk.** `gsd-tools` is not on PATH in this repo, and the documented 229-05/06 + 227-02/03/04 precedent is that `state.advance-plan` clobbers THIS phase's plan counter because another session (phase 227 work / a release cut) commits to shared `main` concurrently. Following that established precedent: STATE.md updated by a MANUAL ADDITIVE LOG APPEND only; the frontmatter progress counters are intentionally left UNTOUCHED. Branch confirmed `main` before every commit.

## User Setup Required
None - no external service configuration required. (A real batch run needs `ANTHROPIC_API_KEY` for Stage A and a keychain-authed CLI for Stage B, per CONTRACTS AUTH_PATH; that is Plan 08 / run-time, not a build-time setup.)

## Next Phase Readiness
- Plan 08 (batch orchestrator) can now call `runOne` over N submissions with a concurrency pool + `batch-state.json` ledger; `.done` is the idempotency marker to skip on resume, and `runGuardrails` is a pure function the batch/D10 harness can reuse.
- The `229-04 (D10) kill/resume + cross-bleed` aggregator leg stays SKIPPED until `scripts/huji-batch.cjs` (Plan 08) exists.

## Self-Check: PASSED
- `scripts/huji-run-one.cjs` exists (created, committed `91efefa7`).
- `node scripts/huji-run-one.cjs --selftest-scaffold` exits 0 (Validation stage, grading -> claude-opus-4-8, 8-section skeleton, pinned override).
- `node scripts/huji-run-one.cjs --dry-run` exits 0; `grep PWS_grading` + `grep append-system-prompt-file` + `grep no-session-persistence` all match; `chain-executor` require absent.
- `bash tests/run-all-229.sh` -> PASS=8 FAIL=0 SKIP=1 (unchanged; no regression).

---
*Phase: 229-huji-pitch-feedback-module*
*Completed: 2026-07-16*
