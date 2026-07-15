---
phase: 229-huji-pitch-feedback-module
plan: 06
subsystem: pitch-feedback-eval
tags: [llm-judge, calibration, spearman, anchor-hygiene, self-preference-bias, canon-part8, eval-harness]

# Dependency graph
requires:
  - phase: 229-03
    provides: "scripts/huji-eval.cjs (D1-D9 deterministic code-check harness + argv router)"
  - phase: 229-02
    provides: "calibration/ fixtures + INDEX.md + eval/probes/manifest.json (the 6 graded anchors and the anchor-hygiene corrections)"
  - phase: 229-01
    provides: "lib/core/pitch-feedback-schemas.cjs FeedbackResultSchema (what the judge scores against)"
provides:
  - "eval/judge-schema.json (Real/Win/Worth 1-5 + D1/D6/D7 violation arrays JSON Schema)"
  - "eval/judge-prompt.md (judge rubric: corpus-stable spine + violation checklists, anchor-hygiene NORMATIVE)"
  - "spawnJudge() / evaluateCalibration() / calibrationProtocol() / spearman() in scripts/huji-eval.cjs"
  - "--suite anchors [--judge] + --report --judge CLI legs (fails closed under 0.7 Spearman)"
  - "tests/run-all-229.sh 229-06 D6/D7 aggregator leg"
affects:
  - "229-07 single-submission runner (consumes the judge for per-unit D6/D7 scoring)"
  - "229-08 batch orchestrator (judge scores the cohort sample after calibration)"
  - "229-09 demo + human re-rank + Amnon better-than-a-TA verdict (external gates the judge feeds)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LLM-as-judge pinned to a DIFFERENT model from the grading spine (sonnet judging opus) to dodge self-preference bias"
    - "Judge trusted ONLY behind a calibration gate: Spearman >= 0.7 vs canonical anchor ordering, plus two exact ordering asserts, fails closed"
    - "Pure gate math (evaluateCalibration) separated from the model call (spawnJudge) so the gate is RED-testable with zero API cost"
    - "Judge leg skips cleanly without ANTHROPIC_API_KEY so structural runs never depend on a model call"
    - "args-array spawnSync, no shell, Read-only tools (never the execSync shell-quote pattern) for untrusted-content sessions"

key-files:
  created:
    - ".planning/phases/229-huji-pitch-feedback-module/eval/judge-schema.json"
    - ".planning/phases/229-huji-pitch-feedback-module/eval/judge-prompt.md"
  modified:
    - "scripts/huji-eval.cjs"
    - "tests/run-all-229.sh"

decisions:
  - "Judge scores ONLY the corpus-stable Real/Win/Worth spine (1-5) + D1/D6/D7 violation lists, never the three incompatible raw grade scales"
  - "Canonical anchor numbers bound in (Circular 24/100 not stale 43, AI-Ed 42.5/100 not stale 48.5); fixture-08 90/100 excluded as an if-it-was-A+ projection"
  - "Calibration math always self-verifies (1 PASS + 4 FAIL fixtures); the live judge runs only with a key and fails closed (exit 1) under 0.7 Spearman"
  - "Judge model pinned sonnet vs the opus spine, overridable via HUJI_JUDGE_MODEL/HUJI_SPINE_MODEL env, with a hard guard that they must differ"

patterns-established:
  - "known-ordering Spearman: normalize every anchor (percentage, N/100, 1-5 scorecard) onto one 0-100 rank axis; only order matters"
  - "Dental pre/post modeled as two comparison points over the same fixture via a per-anchor focus directive appended to the prompt"

requirements-completed: [D1, D3, D6, D7]

# Metrics
duration: 18min
completed: 2026-07-16
---

# Phase 229 Plan 06: LLM Judge + Calibration Protocol Summary

**A headless sonnet judge scores pitch feedback on the corpus-stable Real/Win/Worth spine plus D1/D6/D7 violation lists, and is trusted to gate delivery only after clearing a calibration gate (Spearman >= 0.7 vs the 6 canonical anchors, Dental post > pre, DnATA < Lucid) that fails closed and never runs on a structural build.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-16T01:05:00+03:00 (approx, first file read)
- **Completed:** 2026-07-16T01:21:34+03:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

### Task 1 - Judge prompt + judge schema (anchor hygiene NORMATIVE)

- `eval/judge-schema.json`: a draft-07 JSON Schema with `submission_id`, `real`/`win`/`worth` (integers 1-5), and `d1_violations`/`d6_violations`/`d7_violations` (string arrays), `additionalProperties: false`.
- `eval/judge-prompt.md`: the judge scores ONLY the one spine stable across all four corpus format eras (Is-it-Real / Can-we-Win / Is-it-Worth-it), never the three incompatible raw scales. Encodes the normalization map (below 50% = 1 ... 90+ = 5), the BINDING canonical numbers (Circular 24/100, AI-Ed 42.5/100 confirmed by its JSON handoff), the fixture-08 projection exclusion, and the 05/06 process-log ingredients (evidence-grounding, bias-flag, consistent rubric, problem-reframe) as violation-checklist items. Declares the sonnet-judging-opus self-preference dodge. Zero em-dashes.

### Task 2 - Judge spawner + calibration protocol in huji-eval.cjs

- `spawnJudge(feedbackPath, opts)`: `spawnSync('claude', [args-array], { no shell })` copying the room-auto-create execFileSync discipline (T-229-06-02), `--bare` + `ANTHROPIC_API_KEY`, `--allowedTools Read`, `--output-format json`, `--json-schema`. Judge model pinned different from the spine with a hard guard.
- `evaluateCalibration(scoresById)`: the pure gate. Spearman(canonical known ordering, judge means) >= 0.7; Dental post-revision strictly above pre (mean up, no dimension regresses); DnATA (10) below Lucid (09) on every dimension. Missing any anchor fails closed.
- `calibrationProtocol(opts)`: spawns the judge over the 6 graded anchors (7 comparison points, Dental pre/post via a focus directive), then runs the pure gate. Returns `{ ok, skipped }` and skips cleanly with no API key.
- Dependency-free `spearman()` + average-rank helper; `parseJudgeOutput()` unwraps the `claude --output-format json` envelope.
- CLI: `--suite anchors [--judge]` always self-verifies the calibration math then runs the live judge only with a key (exit 1 under 0.7); `--report --judge` adds the calibration verdict + per-unit judge scores; `--selftest anchors` registered.
- Wired the `229-06 (D6/D7)` leg into `tests/run-all-229.sh` (guarded on `judge-prompt.md`).

## Verification

- `node scripts/huji-eval.cjs --selftest anchors`: 1 PASS + 4 FAIL calibration fixtures (anti-correlated, dental-not-up, dnata-not-below-lucid, missing-anchor) all behave.
- `env -u ANTHROPIC_API_KEY node scripts/huji-eval.cjs --suite anchors --judge`: exit 0, calibration math verified, live judge skipped with the human re-rank instruction printed.
- `node scripts/huji-eval.cjs --suite code`: 7/7 (no regression).
- `spearman([1,2,3,4],[1,2,3,4])=1.00`, reverse `-1.00`, tied inputs `1.00`.
- `bash tests/run-all-229.sh` (no key): `PASS=8 FAIL=0 SKIP=1` (SKIP = the not-yet-landed 229-08 batch orchestrator).
- Plan verify block: `spawnSync` present, `--suite anchors` present, the `execSync(\`claude` shell pattern absent, module `require()` loads exit 0.
- Zero em-dashes across all four touched files.

## Deviations from Plan

### Auto-fixed / Auto-added

**1. [Rule 2 - Missing critical functionality] Wired the 229-06 judge leg into the phase aggregator**
- **Found during:** Task 2
- **Issue:** The plan built the judge + calibration harness but did not register it in `tests/run-all-229.sh`, so the phase gate would not exercise D6/D7 on a run.
- **Fix:** Added a file-guarded `run_if` leg (`229-06 (D6/D7) judge calibration`) matching the existing pattern; guarded on `judge-prompt.md`. Aggregator now PASS=8.
- **Files modified:** `tests/run-all-229.sh`
- **Commit:** `13cd32b7`

## Concurrent-session note (shared-branch race)

Another session (phase 227 work + a `v1.15.3-beta.24` release cut) was committing to shared `main` throughout this plan. `.planning/` is gitignored in this repo and the established convention is `git add -f` for phase artifacts. My Task-1 `git add -f` of the two eval files was swept into the concurrent session's `ed5a547a` release commit by its broad staging (the "cannot lock ref HEAD" race), rather than landing as a standalone `feat(229-06)` commit. Content integrity was verified directly from git history afterward (schema parses, prompt carries the spine + projection language). The atomic-per-task commit boundary blurred for Task 1, but no work was lost and both files are correctly tracked. Task 2 committed cleanly as `13cd32b7` with only its two files. STATE.md frontmatter counters were intentionally left untouched (manual additive log append only), following the documented 227-02/03/04 + 229-05 anti-clobber precedent where `gsd-tools state.advance-plan` clobbers this phase's plan counter.

## Authentication Gates

None. The judge leg is designed around the absence of `ANTHROPIC_API_KEY`: it skips cleanly and a structural run never fails on a missing key. The live judge is exercised only when a key is present.

## Self-Check: PASSED

- FOUND: `.planning/phases/229-huji-pitch-feedback-module/eval/judge-schema.json`
- FOUND: `.planning/phases/229-huji-pitch-feedback-module/eval/judge-prompt.md`
- FOUND: `scripts/huji-eval.cjs`
- FOUND: `tests/run-all-229.sh`
- FOUND commit: `ed5a547a` (Task 1 files, swept into the concurrent release commit)
- FOUND commit: `13cd32b7` (Task 2)
