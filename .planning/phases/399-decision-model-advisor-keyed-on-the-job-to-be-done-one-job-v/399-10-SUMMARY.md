---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 10
subsystem: decision-advisor-benchmark
tags: [benchmark, top3-recall, ece, brier, cross-validation, option-shuffle, phase-gates, internal-only]
requires: [399-05, 399-06, 399-07, 399-08, 399-09]
provides:
  - scripts/bench-decision-routing.cjs (runOfflineBench, runProviderBench, shuffledOrders, expectedCalibrationError, brierScore, foldOf, scorePairs)
  - tests/test-399-bench.cjs (BM1-BM7, 11 legs)
  - tests/run-all-399.sh (15 tests, then 5 phase-owned drift checks)
affects: []
tech-stack:
  added: []
  patterns: [leave-one-fold-out isotonic calibration by command hash, sha256-seeded fixed shuffles, policy gated provider mode through the one transport, two-view circularity control]
key-files:
  created:
    - scripts/bench-decision-routing.cjs
    - tests/test-399-bench.cjs
  modified:
    - tests/run-all-399.sh
    - tests/test-399-job-vocabulary.cjs
decisions:
  - "The benchmark reports two views. The top-level figures use every registry label and are CIRCULAR (the 26 D-07 labels came from the same model run as the recorded probabilities). The excluding_d07 view removes those 26 pairs from the evaluation set and from the calibration fit."
  - "Per-job recall orders commands as the shipped table does (calibrated value descending, then command name). Per-command recall adds a raw-probability tie-break variant. Both are reported."
  - "A random-ranking baseline is reported next to per-command recall so the lift is visible."
  - "Provider mode sends one request per job per option order, because a neutral request has one job context. Jev gets 4 orders, Gemini 1."
  - "The CLI refuses --provider without --live (exit 2); --live passes through the transport, so the egress line decides (exit 4 while off)."
metrics:
  tasks: 2
  completed: 2026-11-24
---

# Phase 399 Plan 10: Routing benchmark and phase gates Summary

An offline, deterministic routing benchmark (top-3 recall, AUC, ECE, Brier, 5-fold by command, with and without the 26 circular labels), a policy gated provider mode with option shuffles, and the phase gates run against their base values. Internal measure, not for public quoting (Phase 399 Deferred).

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Routing benchmark with cross-validated calibration and option shuffles (I-12, D-05) | a2a2b4bc5 |
| 2 | Phase runner runs 5 phase-owned drift checks | 49a7982a7 |
| 2 (cleanup) | Dash check in the vocabulary test written as escapes | dda98c8f1 |

## Internal measure, not for public quoting

Run: `node scripts/bench-decision-routing.cjs --head dda98c8f1 --out <scratchpad>` at HEAD dda98c8f1. Scope: the 73 commands with run steps that occur in the recorded run, 13 jobs, 949 pairs. Answer key: the current registry `serves_jtbd`. Calibration: isotonic, 5 folds by sha256(command) mod 5; every pair is scored by a fit that never saw its own command's fold.

| Measure | ALL LABELS (CIRCULAR, includes the 26 D-07 labels) | EXCLUDING the 26 D-07 pairs |
|---|---|---|
| Pairs, labelled pairs | 949, 128 | 923, 102 |
| Per-command top-3 recall (hits / commands with a label) | 79.2% (57/72) | 73.6% (53/72) |
| Random top-3 baseline | 37.0% | 31.9% |
| Per-command recall, tie broken by raw p | 77.8% | 73.6% |
| Mean per-job recall at 3 (13 jobs) | 78.2% | 66.7% |
| AUC raw / calibrated (cross-validated) | 0.835 / 0.822 | 0.793 / 0.776 |
| ECE raw / cross-validated | 0.261 / 0.026 | 0.267 / 0.027 |
| Brier raw / cross-validated | 0.177 / 0.077 | 0.182 / 0.080 |

Per-job recall at 3 (all labels / excluding the 26): audit-room 66.7 / 33.3; compare-options 33.3 / 33.3; connect-domains 100 / 100; decide-pursue 100 / 66.7; explore 66.7 / 66.7; file-meeting 50 / 50; find-bottleneck 100 / 100; find-problem 100 / 100; plan-execution 33.3 / 33.3; prepare-pitch 100 / 66.7; surface-contradiction 66.7 / 50; understand-market 100 / 66.7; validate-idea 100 / 100.

How to read it:
- The 26 D-07 labels move the figures by 5 to 12 points on the job-keyed measure, which shows the size of the circularity. The excluding column is the better estimate and is the one to use for direction.
- Ranking is clearly better than random (73.6% against 31.9% per command), so the model carries real signal. AUC about 0.79 matches the research's own 0.78 direction figure.
- Calibration is sound inside this key: ECE falls from about 0.26 to about 0.03. Calibrated AUC is slightly below raw AUC because the step function creates ties.
- The key is still one labeller's registry plus the 26. A label missing from the key counts as wrong, so recall is a floor for the remaining pairs and the key itself is not independent proof.
- Five jobs (audit-room, compare-options, file-meeting, plan-execution, surface-contradiction) sit at 50% or below on the excluding view. Several of these have few labelled commands.

## Would the numbers support default-on?

Recommendation: no, keep MINDRIAN_DECISION_ADVISOR=on as opt-in. The default was not flipped.
- The measure is directional only: one labeller, v0 job-only table (no definition-level or last-command conditioning), ties at calibrated value 1 break alphabetically, and the recorded run is one model pass.
- The measure scores ranking against labels. It does not measure whether users pick the advisor's first option. The selection log from plan 09 (`ground_truth_label`, `selection_observations`) holds that evidence and has no real rows yet.
- Turning it on by default needs, at minimum, an independent label set or enough logged overrule data, and a decision from the owner. This is a NEXT item, not done here.

## What was built

- `scripts/bench-decision-routing.cjs`: reuses `fitIsotonic` and `applyCalibration` from the table builder and `rocAuc` from the calibration gate; no second fit or AUC. Offline mode makes no model call and no network call. Provider mode builds one `next_command_v1` choice question per job over the 73 commands, shuffles with `shuffledOrders(options, 4, job id)` for Jev (first order is the stable id order, the rest are distinct, fixed per seed), asks once for Gemini (SORTS_OPTIONS), averages per-option probabilities and scores top-3 recall. Every send goes through `scripts/decision-advisor-transport.cjs`.
- Output goes to `--out` (default `os.tmpdir()`), carries `internal_only: true` and the note. The CLI writes nothing under data, docs, README.md or CHANGELOG.md (BM7 checks `git status` before and after).
- `tests/test-399-bench.cjs`: 11 legs. BM2 recomputes every cross-validated score from raw inputs and has a leak control: flipping every label of one command in a registry copy must not move that command's scores while it must move others. A mutation (train on all folds) made BM2 fail, then the file was restored. BM6 stubs `fetch` and proves 0 network calls with the shipped policy.
- `tests/run-all-399.sh`: 15 test PASSED lines, then (only when the loop passed) 5 check lines: decision table, job labels, command registry, skill mirrors, orchestration projection. All 5 pass.

## Phase gates against base values

| Gate | Result now | Base value | Verdict |
|---|---|---|---|
| `bash tests/run-all-399.sh` | exit 0, 15 test PASSED, 5 check PASSED | n/a | pass |
| `check-registry-drift.cjs --check` | exit 0, OK (0 findings, 0 accepted removals, baseline=git-tag) | exit 0 same text | same |
| `build-connector-registry.cjs --check` | exit 0, 0 GAP lines | plan text said exit 1 with 20 GAP; orchestrator correction says exit 0 with 0 GAP | matches the corrected base |
| `doctor.cjs --acceptance` | Acceptance full: 25/25 passed | 23/25 (doctor-all, verify-release-clean-tree failed) | better than base; the tree is clean after commits and doctor-all passed this run |
| `check-shape-declaration.cjs --check` | exit 0, 55 advisory WARN violations | exit 0, 55 | same |
| `run-harness.cjs --check` | Totals: 11 pass, 1 fail, 2 ghost, 5 declared, 19 total (session-start-verification logged fail) | same | same |
| `check-render-coverage.cjs` | exit 0 (17 covered, 0 gap) | exit 0 | same |
| `sync-assets.cjs --check` | exit 1, only assets/framework-names.json differs | exit 1, same file | same |
| `run-all-395.sh` | stops at test-395-job-shown, 7 failed legs (B2, D2, E1-E5) | same 7 at base | same. The 14 other 395 tests run one by one: all exit 0 except test-395-job-orders (exit 1, C3, known at base) |
| `run-all-396.sh` | PASS=20 FAIL=0 | not recorded | pass |
| `run-all-36925.sh` | PASSED=54 FAILED=3: next-move 369.25-21, vi3-icm-walk, triple-context-formatter | same 3 at base (plan 07) | same |
| `run-all-3696.sh` | PASSED=129 FAILED=5 KNOWN=17 | PASSED=128 FAILED=6 (unstable 5 or 6) | within the known range |

The run-all-3696 failures this run, none caused by phase 399 (no hook, session-start, agents/larry-extended.md, or the named scripts changed in this phase):
- isolation 369.6-02, leg B5b: evidence lines for `hooks/run-hook.cmd session-start` and `scripts/check-pending-ambiguous.cjs` are stale.
- voice-first budget 369.6-08, leg V7: `agents/larry-extended.md` frontmatter differs from the base fixture (the file is not in this phase's diff).
- test-115-surfaces-grep: DROR_TEST_CRITERIA missing from docs/testers/REGISTRY.md.
- test-260917-rooms-home-precedence: `scripts/session-start-reconcile.cjs:32` resolver order.
- test-346-catalogue-schema, leg 12: `scripts/ambient-stop.cjs` and `scripts/card-before-answer-hook.cjs` not catalogued.
- test-359-prose-budget, leg B5: larry-extended and SKILL byte checks.
(Six names are listed; the aggregator counted 5. The test-359 or the isolation line is probably the one the aggregator holds as known. Not investigated further.) I ran the 4 suites in parallel; the results match the earlier serial base shape, so no collision was seen.

Other gate results:
- Dash scan over the 102 files changed since 24d5ccb6a (outside .planning): the first scan flagged tests/test-399-job-vocabulary.cjs, which held the two dash characters inside a regex literal. I wrote them as unicode escape sequences (commit dda98c8f1), and the scan now prints nothing.
- `git diff --stat 24d5ccb6a -- package.json .claude-plugin/plugin.json CHANGELOG.md README.md`: empty.
- `node scripts/bench-decision-routing.cjs --provider jev --live`: stderr `egress_line_off`, exit 4. No network call.

## Tri-Polar statement

One decision-advisor core, no surface-specific code. CLI: the hook selector path, `/mos:act`, and the `closeOffer` log. Desktop and Cowork: `suggest_next` (`next_move.advisor`), `framework_run` and the `gate_answer` log, all through the one MCP server. The benchmark itself is a dev-time script and runs on none of the three surfaces.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dash scan flagged plan 01's vocabulary test**
- **Found during:** Task 2 (dash scan)
- **Issue:** `tests/test-399-job-vocabulary.cjs` line 129 held a literal em dash and en dash in a regex, so the plan's scan could not print nothing.
- **Fix:** the regex now uses unicode escape sequences instead of the raw characters. The test still passes.
- **Files modified:** tests/test-399-job-vocabulary.cjs
- **Commit:** dda98c8f1

### Plan text stale

- `build-connector-registry --check` exits 0 with 0 GAP lines (plan text says 20); doctor acceptance is 25/25 (plan text says 23/25). Both are better than the recorded base and match the orchestrator's corrections.
- `run-all-395.sh` cannot exit 0 because it stops at the pre-existing test-395-job-shown failure; each 395 test was run on its own.

### Additions beyond the plan

- The second (excluding-26) view, the random baseline, the raw-p tie-break variant, `scorePairs` export, `--base` and `--model` flags for provider mode, and a leak control plus mutation check in BM2.
- TDD: the test file and the script were written in the same step, then run. A separate RED run was not made and is not claimed. The BM2 mutation check shows the leak leg can fail.

## Known Stubs

None.

## Threat Flags

None. Provider mode adds no new egress path: it calls the existing transport, which validates labels only and checks the `decision_advisor` line first (T-399-35). Output stays in `--out` and this summary (T-399-34). Every shared gate is reported against its base (T-399-36).

## Risks and open items

- The numbers are circular in part and from one labeller. Do not quote them. The README refresh and the release-ceremony wiring of `build-decision-advisor-table.cjs --check` are NEXT items for the owner (planning constraint: README.md and CHANGELOG.md were not edited).
- Default-on is not supported by this evidence; see the section above.
- The benchmark loads `calibration-gate.cjs`, which prints a SQLite experimental warning and two circular-dependency warnings on stderr. Both are pre-existing module behavior and do not change results.
- Pre-existing failures listed in the gate table were reported, not fixed.

## Self-Check: PASSED

- Files found: scripts/bench-decision-routing.cjs, tests/test-399-bench.cjs, tests/run-all-399.sh, tests/test-399-job-vocabulary.cjs.
- Commits found: a2a2b4bc5, 49a7982a7, dda98c8f1.
