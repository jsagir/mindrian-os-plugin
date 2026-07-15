---
phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
plan: 04
subsystem: eureka
tags: [reasoning-mode, phase-gate, pair-cap, negative-corpus, field-parity, human-checkpoint, cjs]
status: COMPLETE - Tasks 1-3 executed; Task 3 human checkpoint APPROVED

# Dependency graph
requires:
  - phase: 226-01
    provides: "lib/core/eureka/reasoning-mode.cjs (scoreReasoningPairs, proposeCandidatePairs, readRoomMarkdown, assertReasoningInvariants) + the >= 12 pair fixture set + critic._gate1 encoder-free reuse"
  - phase: 226-02
    provides: "scripts/eureka-portfolio-report.cjs mode:reasoning branch (reasoningStageSeed/Emit/Score, buildUpgradeDelta) + the frozen four-key JSON contract"
  - phase: 226-03
    provides: "tests/test-226-mode-disclosure.cjs + the report-html / eureka-command reasoning subcommands the aggregator registers"
  - phase: 212
    provides: "tests/test-212-negative-corpus.cjs recorded junk classes (byte-copied exemplars for the D3 replay) + tests/run-all-212.sh aggregator shape; the plan-05 precedent (human-gated accuracy sign-off, never self-certified) this Task 3 checkpoint follows"
provides:
  - "tests/test-226-posture.cjs: D5/G-3 working-diagnosis posture (banked literal-false, ZERO opportunity nodes in room.db, provenance.banking string, upgrade delta, short-list rule, FIELD-PARITY live diff)"
  - "tests/test-226-pair-cap.cjs: D8/G-6 end-to-end cap on a synthetic 200-entry room (candidates <= 25, pairs_sent <= cap, env override in a child)"
  - "tests/test-226-rejection-replay.cjs: D3 negative-corpus replay through the encoder-free path (3 junk classes stay rejected, gate-1 class dies with 0 judge calls)"
  - "/tmp/226-calibration-demo/.mindrian/eureka/portfolio-report.{md,json,html}: the real end-to-end David proving case (7 fixture pairs / 14 nodes, --force-encoder-unavailable) the navigator reviewed at the Task 3 checkpoint"
affects: [226-04-task2, 226-04-task3, eureka]
key-decisions:
  - "Navigator APPROVED the Task 3 human checkpoint on the real reasoning-mode demo (/tmp/226-calibration-demo). Caveat-wording honesty (ICD-203 lens, question 1) reads as a genuine basis/confidence separation, not self-cover: it names the degrade cause (encoder_unavailable, 2 of 3 critic legs structurally null), states the analogy bar was not lowered, and marks banked=false as a human-only promotion gate. Judged PASS."
  - "Real Gentner-lens quality (question 2) was found NOT independently testable from the demo's portfolio-report.md: the final Statements section renders the inherited embedded-mode template (generic 'combining X and Y' filler), not the genuine mechanismText/mappingStatement content that IS present in the reasoning workdir's mappings.json. This is the SAME limitation the AI-SPEC Section 5 domain research already flagged (spot-checked against the existing template, not reasoning-mode-specific content) - confirmed by inspection, not a new gap. Navigator accepted this as an honest, pre-flagged scope boundary of Task 3 rather than a blocker."
  - "Upgrade-delta honesty (question 3) was judged on WORDING only (the demo does not execute an embedded re-run): the caveat's promise ('shows the reasoning -> embedded delta, rather than silently replacing this result') reads honest. Behavioral proof of the delta path is separately covered by test-226-posture.cjs's provenance.upgrade assertions (D5/G-3), not by this demo."
  - "Net verdict: 1 of 3 calibration questions fully exercised by the demo artifact, 2 of 3 structurally out of reach of a report-level review (by design - mappings.json holds the real content, the report does not surface it). Navigator judged this an acceptable basis for closing Task 3, given REQ-4's behavioral guarantees are independently proven by the automated D5 suite."

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

**COMPLETE - Tasks 1-2 executed and committed autonomously; Task 3, the mandatory HUMAN
calibration checkpoint (AI-SPEC Section 5, autonomous:false), was reviewed and APPROVED by the
navigator on the real /tmp/226-calibration-demo David proving case on 2026-07-15.**

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

## Task 2: run-all-226 aggregator + TEST_FILES registration + docs (COMPLETE)

- **tests/run-all-226.sh:** The single PASS/FAIL/SKIP phase gate, modeled verbatim on
  run-all-212.sh (same run/run_if counters, the same `NODE_OPTIONS=--require tests/eureka-offline-preload.cjs`
  zero-network export, the same `[ FAIL -eq 0 ]` non-zero-exit convention). test-226-null-legs is
  listed FIRST and labeled the phase's HARDEST GATE (the D1 fabricated-number tripwire). Every leg is
  `run_if`-guarded on its file (partial-landing safe, SKIP counted never silent). The header maps each
  of the eight D1-D8 legs to its dimension + REQ id, plus the SEED-req-7 embedded regression legs run
  the field-contract legs of the embedded suites directly (test-215/216-field-contract.cjs) rather than
  nesting whole suites - the runtime rationale is stated in the header.
- **lib/memory/run-feynman-tests.cjs:** The eight `test-226-*.cjs` paths appended to TEST_FILES (the
  224-VALIDATION test-infra contract precedent), making the D1 tripwire and the Part 9 posture check
  permanent, not one-time review.
- **docs/ENV-TUNING.md:** A Phase 226 section documenting `MINDRIAN_EUREKA_REASONING_MAX_PAIRS`
  (default 25, byte-matched against the reasoning-mode.cjs source constant), the D8 bounded-fan-out
  rationale (a 200-entry room's ~20k raw pairs bounded by the cap, never by room size), and the explicit
  note that the reasoning path computes no AHP composite (no new AHP floor).
- **docs/CANON-PHASE-MAP.md:** A Phase 226 row under Part 9 with canon_parts [3, 8, 9] and a one-line
  description (Part 8 local-only judge, Part 9 banked-never-true on the fallback path, Part 3 gate
  unaffected / no AHP composite).

### Verification (Task 2)

| Check | Result |
|-------|--------|
| `bash tests/run-all-226.sh` | PASS=10 FAIL=0 SKIP=0, exit 0 |
| SKIP guard (move one test file aside) | PASS=9 FAIL=0 SKIP=1, exit 0 (SKIP not FAIL, run_if proven) |
| FAIL tripwire (plant a failing assertion) | exit 1 (non-zero), then reverted byte-clean |
| `grep test-226- lib/memory/run-feynman-tests.cjs` | 8 entries; `node -c` syntax OK |
| ENV-TUNING default (25) byte-matches reasoning-mode.cjs | yes (`envInt('MINDRIAN_EUREKA_REASONING_MAX_PAIRS', 25)`) |
| `grep -qi "phase 226" docs/CANON-PHASE-MAP.md` | present |
| `node scripts/doctor.cjs --acceptance` | 13/15; failed only {coverage-gate, verify-release-clean-tree} - the DOCUMENTED environmental baseline, NO NEW regression |

## Task 3: Navigator calibration checkpoint (APPROVED)

This is the mandatory HUMAN checkpoint (AI-SPEC Section 5, `autonomous: false`, the Phase 212 plan-05
precedent): real-judge accuracy and caveat-wording honesty are a human-verify bar, NEVER an automated
assertion, and Claude does not grade its own caveat wording (the exact self-certification trap the 212
precedent exists to prevent).

**Demo artifact reviewed:** `/tmp/226-calibration-demo/.mindrian/eureka/portfolio-report.{md,json,html}`,
a real end-to-end run through the shipped `scripts/eureka-portfolio-report.cjs` reasoning path
(`--force-encoder-unavailable`, 7 fixture pairs from `tests/fixtures/226-reasoning-pairs.cjs`, 15 ranked
rows). Not a mock: real room.db writes, real reasoning-workdir stages (pairs/mappings/answers.json),
real report emitters.

**Navigator verdict, per question (see key-decisions in frontmatter for full reasoning):**

| # | Question (lens) | Verdict | Basis |
|---|------------------|---------|-------|
| 1 | Caveat stops over-trust vs. legally covers itself (ICD-203) | **PASS** | Names the degrade cause, states the bar was not lowered, separates basis-confidence from verdict, marks banked=false explicit |
| 2 | Analogy bar holds on real pairs (Gentner structure-mapping) | **NOT TESTABLE from this artifact** | Report's Statements section renders the inherited embedded-mode template, not mappings.json's real mechanismText/mappingStatement content - a pre-flagged, confirmed scope boundary, not a new gap |
| 3 | Upgrade delta reads honest, not silent replacement | **PASS (wording only)** | No embedded re-run executed in this demo; the caveat's promise reads honest; behavioral proof lives in test-226-posture.cjs's provenance.upgrade assertions |

**Disposition:** APPROVED as-is. The navigator accepted that REQ-4's behavioral guarantees (banked=false,
zero graph writes, upgrade-delta shape) are independently proven by the automated D5 suite
(`test-226-posture.cjs`), and that question 2's non-testability is an honest, already-documented limit
of report-level review rather than a defect to fix before closing Task 3. No code changes resulted from
this checkpoint.

## Self-Check: PASSED

- `bash tests/run-all-226.sh` -> PASS=10 FAIL=0 SKIP=0, exit 0 (re-confirmed 2026-07-15, post-checkpoint).
- Task 1 + Task 2 commits (`2c9392d3`, `7bed74f7`) exist in git history.
- Task 3 checkpoint closed: navigator verdict recorded above and in frontmatter `key-decisions`; no
  outstanding blocking questions.
- `.planning/HANDOFF-226-checkpoint.md` superseded by this summary; safe to delete.

---
*Phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la*
*Completed: 2026-07-15 - PHASE 226 CLOSED (4/4 plans)*
