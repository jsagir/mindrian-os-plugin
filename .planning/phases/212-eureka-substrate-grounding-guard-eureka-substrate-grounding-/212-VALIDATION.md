---
phase: 212
slug: eureka-substrate-grounding-guard
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-06
---

# Phase 212 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Content transcribed from
> 212-RESEARCH.md "Validation Architecture" (committed 872a93b4); this file satisfies the Nyquist
> gate. Scope is CRITIC-ONLY (navigator Q1 lock); the substrate/whitespace half is Phase 212.5.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in (`node tests/test-*.cjs`, plain assert) + bash aggregators; no jest/vitest (house convention) |
| **Config file** | none — standalone CJS files exiting 0/non-0 (the `run-all-2xx.sh` pattern) |
| **Quick run command** | `node tests/test-212-critic-stage-a.cjs` (offline, network-free) |
| **Full suite command** | `bash tests/run-all-212.sh` |
| **Estimated runtime** | ~15 seconds (offline legs); calibration run (212-05) is separate + human-gated |

---

## Sampling Rate

- **After every task commit:** Run the relevant offline `node tests/test-212-*.cjs` (<5s, no model/network)
- **After every plan wave:** Run `bash tests/run-all-212.sh` + `bash tests/run-all-211.sh` (no-regression on the generator 212 consumes)
- **Before `/gsd-verify-work`:** Full `run-all-212` green + `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** 15 seconds (offline suite)

---

## Per-Task Verification Map

| Req | Plan | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|------|------|----------|-----------|-------------------|-------------|--------|
| D2 Stage A | 01 | 1 | gates route correctly | unit | `node tests/test-212-critic-stage-a.cjs` | ❌ W0 | ⬜ pending |
| D2 rubric | 02 | 2 | item pattern → verdict (stubbed judge) | unit | `node tests/test-212-critic-rubric.cjs` | ❌ W0 | ⬜ pending |
| D6 negative | 02 | 2 | tahini/turbines/casino reject as pseudoscience/general_shallow | unit | `node tests/test-212-negative-corpus.cjs` | ❌ W0 | ⬜ pending |
| D1/D3b Part 8 | 03 | 3 | scalars+enums only, floats quantized, no content/embeddings/IDs | unit | `node tests/test-212-part8-boundary.cjs` | ❌ W0 | ⬜ pending |
| D5 resolution | 03 | 3 | no registration-time roomDir closure | unit (grep) | leg in `run-all-212.sh` | ❌ W0 | ⬜ pending |
| D3 gold-set | 04 | 3 | 6 cards vs expected verdicts; sterling lean-checkable first | integration | `node tests/test-212-gold-cards.cjs` | ❌ W0 | ⬜ pending |
| D3 opp-fixtures | 04 | 3 | 2 JHU Opportunity Statements graded (read-only fixtures) | integration | leg in `run-all-212.sh` | ❌ W0 | ⬜ pending |
| >=0.85 calibration | 05 | 4 | accuracy + high pseudoscience recall | manual | `checkpoint:human-verify` (212-05) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Both pre-212 generator blockers are ALREADY CLOSED before this phase executes (they are not Wave 0
gaps for 212 itself, recorded here for the dependency trail):

- [x] **Pre-212 Blocker 1** — batched embedding (`embedding-spine.cjs`) — quick `260706-4yl`, commits `c222ff7d`/`7ec75b5e`, `run-all-211.sh` leg (9) green
- [x] **Pre-212 Blocker 2** — vec0 infer-backend probe fix (`vector-store.cjs`) — quick `260706-5b7`, commits `73698c73`/`37ed9c67`, `run-all-211.sh` leg (10) green

Net-new Wave 0 test scaffolds this phase creates:

- [ ] `tests/test-212-critic-stage-a.cjs`, `test-212-critic-rubric.cjs`, `test-212-negative-corpus.cjs`, `test-212-part8-boundary.cjs`, `test-212-gold-cards.cjs`, `test-212-plurai-leg.cjs`
- [ ] `tests/run-all-212.sh` (modeled on `run-all-211.sh`)
- [ ] `evals/eureka/212-critic-baseline.json` (may ship `baseline_deferred`)
- [ ] Stub-judge injection seam in `eureka-critic.cjs` (the 211 `encodeFn`/`_forceUnavailable` pattern)
- [ ] `evals/eureka/opportunity-drafts/{pair-1,pair-2}.md` — the 2 JHU Opportunity Statements as acceptance fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| >=0.85 accuracy + high pseudoscience recall | GOAL / Q2 lock | Gold LABELS depend on pending 211 human checkpoints; novelty judgment is the weakest LLM-judge task (honest-deferral pattern) | Run `scripts/eureka-critic-run.cjs` against the mdbr-leaf-ir calibration set; navigator signs off the confusion matrix in `212-calibration-report.md` |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies (except the one human-gated calibration leg)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
