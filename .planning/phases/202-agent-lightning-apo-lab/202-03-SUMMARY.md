---
phase: 202-agent-lightning-apo-lab
plan: 03
subsystem: testing
tags: [apo, seed-002, eval-gate, voice-contract, part-12, plurai, reuse-196, cjs, tdd]

# Dependency graph
requires:
  - phase: 202-02
    provides: "runApo(target, opts) -> { best, candidates, rounds, spanPath } (propose/score/select, Path A)"
  - phase: 205
    provides: "lab/eval/voice-mark-hybrid.cjs::scoreVoiceMark (deterministic-first De Stijl mark scorer)"
provides:
  - "lab/apo/voice-contract-gate.cjs: checkVoiceContract(outputText, opts) -> { pass, violations } (deterministic mechanical checks + reuse of voice-mark-hybrid; subjective reframe-plus-question is the only LLM leg, skipped offline)"
  - "lab/apo/apo-loop.cjs: runApo now DISQUALIFIES any candidate whose declared output breaks the voice contract BEFORE selection (Canon Part 12 hard disqualifier)"
  - "evals/plurai/09-apo-output-voice.csv: 24 synthetic rows (12 compliant, 12 violation) in the 02 quoted-JSON dialect"
  - "evals/plurai/202-baseline.json: hand-labeled baseline_deferred artifact (precision/recall = 1)"
  - "tests/run-all-202.sh: the phase-202 aggregator (202-01/02/03, run_if module-guarded)"
affects: [apo, reward-signal, eval-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "voice-gate-disqualify: a declared candidate output is checked by checkVoiceContract and REMOVED before selectBest; reward can never overturn a voice violation (Canon Part 12). Candidates with no output stay eligible so the 202-02 loop is unchanged."
    - "deterministic-first-eval-gate: four mechanical violations (too_long, em_dash_present, framework_dump, missing_voice_mark) are proven by detectors; only the subjective reframe-plus-question beat routes to an optional LLM leg, skipped offline and treated as pass unless a mechanical check already fails (Phase 205 hybrid lesson)."
    - "reuse-voice-hybrid: the De Stijl mark check imports scoreVoiceMark from lab/eval/voice-mark-hybrid.cjs rather than reimplementing mark detection (Canon Part 7)."

key-files:
  created:
    - evals/plurai/09-apo-output-voice.csv
    - lab/apo/voice-contract-gate.cjs
    - tests/test-202-voice-contract-gate.cjs
    - evals/plurai/202-baseline.json
    - tests/run-all-202.sh
  modified:
    - evals/plurai/README.md
    - lab/apo/apo-loop.cjs

key-decisions:
  - "CSV label vocabulary: used compliant/violation (matching the 02-larry-pedagogy-voice.csv precedent), NOT the plan's honors/breaks. The harness and README task-row vocabulary are compliant/violation, so the baseline and parity test agree with the established dialect -- D-202-03-A"
  - "Plurai baseline DEFERRED: uv is present but the Plurai eval is an interactive multi-turn MCP /evals:eval flow (ask_user model-choice) that cannot run non-interactively in the sequential executor, and Canon Part 8 keeps Plurai offline/synthetic. Per the plan DEGRADE path the rows are hand-labeled deterministically and 202-baseline.json carries baseline_deferred:true, same as 196/200/201 -- D-202-03-B"
  - "Voice mark carried via bracketed [COLOR] (the detector's recognized secondary form) at turn start for the compliant + non-mark-violation rows, keeping the CSV ASCII-clean; the em-dash violation rows put the em-dash inside the Sample JSON string only -- D-202-03-C"

patterns-established:
  - "voice-gate-disqualify for any reward loop where a hard contract must veto a higher-reward candidate"
  - "deterministic-first-eval-gate: prove what a detector can prove, spend the LLM only on the one subjective beat"

requirements-completed: [SEED-002-eval-gate, REUSE-196, CANON-Part8, CANON-Part12]

# Metrics
duration: ~20min
completed: 2026-07-02
---

# Phase 202 Plan 03: APO Voice-Contract Eval Gate Summary

**The Canon Part 12 hard disqualifier for the APO loop: a synthetic labeled eval CSV of Larry outputs, a local deterministic gate (checkVoiceContract) that reproduces the Plurai judge offline for the four mechanical checks by reusing the Phase 205 voice-mark hybrid, and a wire into runApo that removes any candidate whose output breaks the voice contract BEFORE selection -- so a higher-reward output that dumps a framework, runs long, drops the De Stijl mark, or slips in an em-dash can never win.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 4 (behavior-adding Tasks 2 and 3 each RED then GREEN)
- **Files created:** 5, modified: 2
- **Test result:** run-all-202.sh 3/3 legs PASS (18 + 10 + 6 assertions), exit 0

## Accomplishments

- Authored `evals/plurai/09-apo-output-voice.csv`: 24 synthetic rows, 12 compliant and 12 violation, in the exact 02 quoted-JSON dialect (`"{""agent_response"": ""...""}"`, doubled-quote escaping). The 12 violations isolate one mechanical class each: 3 em-dash, 3 missing voice mark, 3 framework dump, 3 too-long. Added the README task row mapping the CSV to the Part-12 contract.
- Built `checkVoiceContract(outputText, opts) -> { pass, violations }` (`lab/apo/voice-contract-gate.cjs`): four deterministic mechanical legs (`too_long` > 8 sentences, `em_dash_present`, `framework_dump` >= 3 enumerated items with no question, `missing_voice_mark`). The mark leg REUSES `scoreVoiceMark` from `lab/eval/voice-mark-hybrid.cjs` (Part 7) rather than reimplementing detection. The subjective `no_reframe_question` beat is the only LLM leg and is skipped offline. Parity test: local pass matches the label for all 24 rows.
- Wired the disqualifier into `runApo` (`lab/apo/apo-loop.cjs`): each candidate that declares an `output` is checked and, if it fails, marked `disqualified` and excluded from `selectBest`. Proven by test 5 -- a candidate with quality 0.95 but an em-dash output loses to a compliant candidate at quality 0.80. Candidates with no output stay eligible, so the 202-02 suite still passes 10/10 unchanged.
- Persisted `evals/plurai/202-baseline.json` (hand-labeled, `baseline_deferred: true`, precision/recall/accuracy/f1 = 1) and authored `tests/run-all-202.sh` aggregating 202-01/02/03 with `run_if` guards on the runtime module files (wave-0 SKIP contract, modeled on run-all-196.sh).

## Task Commits

Strict TDD, base `5c0b787a` (interleaved with a concurrent session's 201 commits, none of which are mine):

1. **Task 1** synthetic APO-output voice-contract eval CSV - `a11799ed`
2. **Task 2 RED** failing parity test - `5e7cf3a5`
3. **Task 2 GREEN** local voice-contract gate (reuses voice-mark-hybrid) - `b4b3ba11`
4. **Task 3 RED** failing disqualifier test - `4a312796`
5. **Task 3 GREEN** voice-contract disqualifier in the APO loop - `20a78072`
6. **Task 4** Plurai baseline + run-all-202 - `89553fb2`

## Decisions Made

- **Label vocabulary compliant/violation, not honors/breaks (D-202-03-A):** the plan text invented honors/breaks, but the voice precedent `02-larry-pedagogy-voice.csv` and the README task-row vocabulary use compliant/violation. Using the established dialect keeps the baseline, the parity test, and the harness in agreement.
- **Plurai baseline deferred (D-202-03-B):** uv is installed, but the Plurai eval is the interactive multi-turn MCP `/evals:eval` flow (the README fable judge, the ask_user model-choice step) which cannot run non-interactively in the sequential executor; Canon Part 8 also keeps Plurai offline/synthetic. The rows are hand-labeled deterministically and the artifact carries `baseline_deferred: true`, matching 196/200/201.
- **Mark delivery via bracketed [COLOR] (D-202-03-C):** compliant and non-mark violation rows carry the mark as the detector's recognized secondary bracketed form at turn start, keeping the CSV ASCII-clean; the em-dash character (U+2014) appears only inside the Sample JSON of the three em-dash violation rows, never in prose or Reasoning.

## Deviations from Plan

- **CSV labels compliant/violation instead of the plan's honors/breaks** (see D-202-03-A) -- grounded in the 02 precedent and the harness vocabulary.
- **RED/GREEN split into separate commits** for Tasks 2 and 3 (matching 202-01/02 TDD history) rather than a single commit per task.
- No auto-fixes (Rules 1-3) were required; no architectural decisions (Rule 4) arose.

## Canon Compliance

- **Part 12 (Pedagogy):** the voice contract is a HARD disqualifier; reward can never buy a violation. Asserted directly (test 5): the highest-reward candidate with an em-dash output is NOT selected; the compliant lower-reward candidate wins.
- **Part 8 (Graph Boundary):** Plurai is offline / build-CI / synthetic only; the local gate is pure and deterministic for the mechanical checks (zero network, zero Brain). The baseline degrades to `baseline_deferred` when the harness is unreachable; the wave never blocks on network.
- **Part 7 (Reuse):** the De Stijl mark check imports `scoreVoiceMark` from the existing voice-mark hybrid; `run-all-202.sh` models `run-all-196.sh`; the CSV mirrors the 02 dialect.

## Issues Encountered

None. The working tree carried unrelated dirty changes (`.planning/seeds/*` reorganization, config.json, untracked scripts, skills-lock.json) and a concurrent session committing other phases' plan docs (189/192/199/201/204). All six task commits staged only explicit per-file paths; a per-commit `git show --name-only` scan confirmed zero `.planning/seeds/`, zero `commands/act.md`, and zero other-phase contamination in any 202-03 commit.

## User Setup Required

None - lab-side, offline, no external service configuration.

## Next Phase Readiness

- The APO loop now recommends only candidates that clear the Larry voice contract; a human ratifier sees pre-filtered recommendations. When a hosted Plurai judge is available (`/evals:eval` interactively after `/reload-plugins`), replace `202-baseline.json` with a real precision/recall baseline; the local gate already meets-or-beats the hand-labeled parity.

## Self-Check: PASSED

- All 5 created files + this SUMMARY present on disk; 2 modified files carry only my hunks.
- All 6 task commits (`a11799ed 5e7cf3a5 b4b3ba11 4a312796 20a78072 89553fb2`) exist; each touches ONLY 202-03 paths (per-commit name-only scan clean).
- `bash tests/run-all-202.sh` = 3/3 legs PASS (34 assertions), exit 0; `node tests/test-202-voice-contract-gate.cjs` = 6/6, exit 0.
- `commands/act.md` byte-unchanged since base; no network/Brain imports in the local test path; no em-dashes in code/comments/CSV Reasoning/commit messages.

---
*Phase: 202-agent-lightning-apo-lab*
*Completed: 2026-07-02*
