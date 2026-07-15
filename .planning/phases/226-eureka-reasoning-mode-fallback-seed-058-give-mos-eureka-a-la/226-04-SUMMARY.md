---
phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
plan: 04
subsystem: eureka
tags: [reasoning-mode, phase-gate, pair-cap, negative-corpus, field-parity, human-checkpoint, cjs]
status: PARTIAL - Tasks 1-2 complete, Task 3 human checkpoint PENDING (autonomous:false)

# Dependency graph
requires:
  - phase: 226-01
    provides: "lib/core/eureka/reasoning-mode.cjs (scoreReasoningPairs, proposeCandidatePairs, readRoomMarkdown, assertReasoningInvariants) + the >= 12 pair fixture set + critic._gate1 encoder-free reuse"
  - phase: 226-02
    provides: "scripts/eureka-portfolio-report.cjs mode:reasoning branch (reasoningStageSeed/Emit/Score, buildUpgradeDelta) + the frozen four-key JSON contract"
  - phase: 226-03
    provides: "tests/test-226-mode-disclosure.cjs + the report-html / eureka-command reasoning subcommands the aggregator registers"
  - phase: 212
    provides: "tests/test-212-negative-corpus.cjs recorded junk classes (byte-copied exemplars for the D3 replay) + tests/run-all-212.sh aggregator shape"
provides:
  - "tests/test-226-posture.cjs: D5/G-3 working-diagnosis posture (banked literal-false, ZERO opportunity nodes in room.db, provenance.banking string, upgrade delta, short-list rule, FIELD-PARITY live diff)"
  - "tests/test-226-pair-cap.cjs: D8/G-6 end-to-end cap on a synthetic 200-entry room (candidates <= 25, pairs_sent <= cap, env override in a child)"
  - "tests/test-226-rejection-replay.cjs: D3 negative-corpus replay through the encoder-free path (3 junk classes stay rejected, gate-1 class dies with 0 judge calls)"
affects: [226-04-task2, 226-04-task3, eureka]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Field-parity LIVE diff: Object.keys() of a real embedded-path statement row must be a SUBSET of the reasoning row's keys - a live compare against the current emitter, closing the hand-copied-literal-list drift hole in test-226-field-contract"
    - "End-to-end cap proof: the paid rubric fan-out is bounded by the cap (25 default / 7 via child env) not by the ~10k raw cross-section pairs of a 200-entry room"
    - "Encoder-free rejection replay: the 212 junk classes stay rejected via Gate 1 (0 judge calls) or the earned rubric verdict, proving the bar was not relaxed"

key-files:
  created:
    - tests/test-226-posture.cjs
    - tests/test-226-pair-cap.cjs
    - tests/test-226-rejection-replay.cjs
  modified: []

# Metrics
completed: 2026-07-15
---

# Phase 226 Plan 04: Phase Close (D5/D8/D3-negative + gate + docs + human checkpoint) Summary

**PARTIAL - Tasks 1-2 executed and committed autonomously; Task 3 is the mandatory HUMAN
calibration checkpoint (AI-SPEC Section 5, autonomous:false) and is intentionally NOT executed.
This summary is task-scoped and will be completed when the navigator resolves the checkpoint.**

## Task 1: D5 posture, D8 end-to-end cap, D3 negative-corpus replay (COMPLETE)

Three test legs, all green standalone under the offline preload:

- **test-226-posture.cjs (D5/G-3, REQ-4):** Drives the REAL reasoning flow (degrade seed ->
  emit -> score) in a hermetic temp room, then asserts: (1) `banked === false` LITERAL on every
  statement and ranked row; (2) `SELECT COUNT(*) FROM nodes WHERE type = 'opportunity'` returns 0
  against the real room.db (banking hard-skip proven by behavior, not a source grep - the
  test-219-banking query idiom); (3) `provenance.banking` names the skip reason string; (4) a
  later embedded `--offline` re-run over the same room carries `provenance.upgrade` (previous_run_mode
  'reasoning', previous_run_date, previous_top, survived + demoted_or_absent that sum to
  previous_top.length), the md carries the `## Reasoning to embedded upgrade` heading, and the old
  reasoning ranked rows are NEVER merged into the new embedded ranked table (every embedded row has
  a numeric score and no verdict field); (5) `ranked.length <= reasoning_cap`; (6) the FIELD-PARITY
  LIVE DIFF (plan-checker Warning 1 fix): `Object.keys()` of a real embedded-path statement row is a
  SUBSET of the reasoning statement row's keys (embedded 10 keys subset of reasoning 15 keys),
  compared against the actual current embedded emitter, so a future embedded field rename that forgets
  the reasoning emitter fails here even if the field-contract literal list is stale.
- **test-226-pair-cap.cjs (D8/G-6, REQ-7):** Synthetic 200-entry room (two sections), ~10k raw
  cross-section pairs. Asserts pairs.json candidates.length <= 25 (default cap) while
  `pairs_considered` > 1000 (the fan-out existed, bounded by the cap not room size); after a stubbed
  score over the capped set `provenance.pairs_sent <= provenance.reasoning_cap`; and
  `MINDRIAN_EUREKA_REASONING_MAX_PAIRS=7` in a real CHILD process env makes the cap 7. Runs in under
  1 second (pure-CJS Jaccard, encoder never loads).
- **test-226-rejection-replay.cjs (D3, REQ-2):** The three Phase 212 negative-corpus junk classes
  (byte-copied exemplars with attribution) driven through `reasoningMode.scoreReasoningPairs`: the
  `$2-5B exit` class routes pseudoscience via the encoder-free Gate 1 with ZERO judgeFn calls; the
  tahini x blockchain class earns general_shallow from the rubric (the embedding swap-gate is
  structurally absent, so the bar EARNS the rejection); the wind-turbines class forces pseudoscience
  via the honest-generic answer. None of the three reaches ranked (transferable-only filter).

### Verification (Task 1)

| Check | Result |
|-------|--------|
| `node tests/test-226-posture.cjs` (D5/G-3) | exit 0 (7 statements banked=false, 0 opportunity nodes, upgrade delta, field-parity subset) |
| `node tests/test-226-pair-cap.cjs` (D8/G-6) | exit 0 (200 entries, 10000 raw -> 25 capped, pairs_sent 25 <= cap, child env cap=7, ~0.9s) |
| `node tests/test-226-rejection-replay.cjs` (D3) | exit 0 (3 junk classes rejected, gate-1 class 0 judge calls) |
| em-dashes across the 3 new files | 0 |

## Task 2: aggregator + registration + docs

_Pending in this same plan execution (see the follow-on commit)._

## Task 3: Navigator calibration checkpoint

_NOT executed - this is the mandatory HUMAN checkpoint (AI-SPEC Section 5, autonomous:false).
The orchestrator hands off to the navigator; this summary is completed on resume._
