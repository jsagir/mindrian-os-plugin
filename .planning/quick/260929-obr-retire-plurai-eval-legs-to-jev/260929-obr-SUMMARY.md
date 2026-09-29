---
phase: quick-260929-obr-retire-plurai-eval-legs-to-jev
plan: 01
status: complete
subsystem: evals
tags: [jev, plurai-retirement, eval-legs, exit-77, part-8]
requirements: [QUICK-260929-obr]
commits:
  - 80edd63b6 (Task 1: helper + contract test + plan)
  - b498e0c95 (Task 2: 211/212 legs, harnesses, baseline stamps)
  - a5fd09ee9 (Task 3: report-from-transcript, 192/203, docs)
completed: 2026-09-29
---

# Quick 260929-obr: Retire Plurai live eval legs, route live judging through Jev

One-liner: every live Plurai network path is deleted; the 211/212 gold-card judge now runs live on Jev (usefulness_judge over synthetic gold-card text, guarded by makeUsefulnessCeiling), exits 77 (SKIPPED, ENV GAP) without a key, and no test run rewrites a tracked baseline.

## What changed

- `tests/helpers/jev-gold-card-leg.cjs` (new): shared leg. Two synthetic pairs, `jev()` + `makeUsefulnessCeiling` + `parseJevResponse`, exit contract 0 / 1 / 77, zero file writes, key never printed. A 404 is a LOUD failure (the Plurai 404 was silently deferred for weeks).
- `tests/test-211-jev-leg-contract.cjs` (new): 21 offline assertions (C1-C13: stubbed fetch, net guard, baseline sha256 unchanged).
- `tests/test-211-judge-gate.cjs`: offline directional contract only (Test B, key resolver, baseline writer removed).
- `tests/test-211-jev-judge-leg.cjs` (new) and `tests/test-212-jev-leg.cjs` (git mv from `test-212-plurai-leg.cjs`): thin live legs.
- `tests/run-all-211.sh`, `tests/run-all-212.sh`: exit 77 maps to SKIPPED (ENV GAP); Jev contract + live legs added.
- `evals/plurai/211-baseline.json`, `212-baseline.json`: retirement stamp (`status: retired`, `retired_on`, `retired_reason`, `superseded_by`); all original fields intact.
- `lab/eval/report-from-transcript.cjs`: network client deleted (callJudge, endpointUrl, buildRequestBody, parseJudgeResponse, loadApiKey); the three network judges report SKIPPED with `PLURAI_RETIRED_REASON`; voice-signature still scores deterministically; `--offline` kept as a no-op; zero fetch in every mode. Not ported to Jev: the Jev egress ruling allows structure only, and tester transcripts are user text even when scrubbed.
- `tests/test-eval-report-from-transcript.cjs`: retired-mode test (apiKey + counting fetch makes zero calls) and module-surface/source test.
- `tests/run-all-192.sh`, `tests/run-all-203.sh`: the retired live-judge leg is an explicit counted SKIPPED line with a reason.
- `evals/plurai/README.md`, `docs/PLURAI-USAGE-AND-QA-REPORT.md`, `lab/plurai-suite/suite-manifest.cjs`: retirement statements.

## Live Jev leg result on this machine

Key present (env + `~/.secrets/typesafe.env`), real calls made:

| Pair | Expected | Jev choice | Confidence |
|------|----------|-----------|------------|
| transferable_darkmatter | useful or already_known | useful | 0.70 |
| unrelated_davinci_lovelace | not_useful or none | not_useful | 0.27 |

Both matched; no assertion was loosened. Without a key both legs exit 77 (verified with `HOME=$(mktemp -d)` and the env var unset).

## Classification (final state per file)

| Class | Files | Final state |
|-------|-------|-------------|
| LIVE-CALL + baseline writer | tests/test-211-judge-gate.cjs, tests/test-212-plurai-leg.cjs | Replaced with Jev legs; writers gone |
| LIVE-CALL (tool) | lab/eval/report-from-transcript.cjs | Network judges retired (SKIPPED + reason), not ported |
| DEFERRED echo legs | tests/run-all-192.sh, tests/run-all-203.sh | Counted SKIPPED with reason |
| OFFLINE-GATE (keep) | scripts/189-, 198-plurai-gate-check.cjs, lib/core/*-gate.cjs, part8-egress-guard(.test), agentshield-scanner.test, tests/test-200..209 | Untouched |
| DECLARATION | lab/plurai-suite/* | One header comment in suite-manifest.cjs |
| COMMENT | lib/core/cross-room-aggregator.cjs, eureka/entity-classifier.cjs, voice-mark-hybrid.cjs, eureka scripts, run-all-215/218 | Untouched |
| HISTORICAL DATA/DOC | evals/plurai/189..209 baselines, eureka reports, CHANGELOG, handoffs | Untouched (211/212 baselines stamped) |

## Before / after counts

| Harness or test | Before | After | Note |
|-----------------|--------|-------|------|
| run-all-211 | PASS=10 FAIL=0 SKIP=0 | PASS=12 FAIL=0 SKIP=0 | +Jev contract leg, +live Jev leg |
| run-all-212 | PASS=5 FAIL=1 SKIP=0 | PASS=5 FAIL=1 SKIP=0 | optional leg swapped Plurai -> Jev (was in-process SKIP inside a PASS, now a real live PASS); FAIL is pre-existing (below) |
| run-all-192 | PASS=12 FAIL=1 SKIP=0 | PASS=12 FAIL=1 SKIP=1 | +1 SKIP as planned; FAIL is pre-existing (below) |
| run-all-203 | PASS=5 FAIL=0 SKIP=0 | PASS=5 FAIL=0 SKIP=1 | +1 SKIP as planned |
| test-eval-report-from-transcript | 9 assertions, exit 0 | 7 assertions, exit 0 | removed 3 network tests, added 2 |
| test-205-plurai-suite | exit 1 | exit 0 | before-run failure was the dirty-baseline diff guard (date noise from the old writer); fixed by removing the writer |
| part8-egress-guard.test | exit 1 (PB8-03 ambiguous vs allow) | same | pre-existing, not ours |
| agentshield-scanner.test | exit 1 (AS-01 ambiguous vs clean) | same | pre-existing, not ours |

## Deviations from Plan

### Not ours (pre-existing failures, classified, not fixed)

- `run-all-212` FAIL `212-03 Part 8 boundary`: CHECK 1 reports the eureka_critic schema now carries an extra `inputSchema` field vs the closed D1 set. Unrelated to Plurai. The plan's "run-all-212 ends FAIL=0" could not hold; count identical before and after.
- `run-all-192` FAIL `192-01 menu-sweep`: help.md still names the two-axis lanes-as-tabs model. Unrelated.
- part8-egress-guard.test / agentshield-scanner.test: the egress guard returns `ambiguous` where the fixtures expect `allow`/`clean` (last touched by 361-09 case_story arm). Both are unchanged by this task, but they are red before and after, so the plan's "both guard tests still pass" claim does not hold on this tree. Worth a NEW FAILURE triage separate from this quick task.

### Auto-fixed

1. [Rule 3 - Blocking] `git add` with the deleted old rename path aborted the whole command once; re-ran with only existing paths and kept the old path in `git commit --only`. No content impact.
2. [Rule 3] The plan's Plurai-network grep gate also matches comments, so the retired-source test assembles its needles from string parts to keep literals out of the repo.

## Known Stubs

None.

## Threat Flags

None. No new network surface: the only egress is the pre-existing Jev path through the usefulness_judge guard, synthetic text only.

## Follow-ons

1. Port the 13 golden CSV suites in `evals/plurai/` to Jev live judging (phase-sized, out of scope here). The 192-04 and 203-04 SKIPPED lines track this.
2. report-from-transcript's three transcript judges (elevation, progress, reach-gate) have no Jev path under the structure-only egress ruling and would need a structure-only redesign.
3. `skills/mva-report/SKILL.md`, `commands/mva-report.md` (and the `dist/` copies) still describe the four-judge Plurai scoring of `report-from-transcript.cjs`; update wording next time those surfaces are touched.
4. Triage the pre-existing reds above (212-03 schema drift, 192-01 help.md, egress-guard `ambiguous` regressions) as separate NEW FAILURE items.

## Commits

- 80edd63b6: Task 1, helper + contract test (+ plan)
- b498e0c95: Task 2, 211/212 legs, harnesses, baseline stamps
- a5fd09ee9: Task 3, report-from-transcript, 192/203, docs

All confirmed ancestors of HEAD. `git status --porcelain -- evals/plurai/` is empty after two run-all-211 runs and run-all-212 runs. No file under `.planning/phases/363-*`, `tests/run-all-363.sh`, `tests/*363*`, or `.planning/STATE.md` was touched.

## Self-Check: PASSED
