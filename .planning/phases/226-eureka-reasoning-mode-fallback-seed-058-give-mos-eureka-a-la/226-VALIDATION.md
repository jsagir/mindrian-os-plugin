---
phase: 226
slug: eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
planned: 2026-07-15
---

# Phase 226 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:assert (.cjs legs, Node >= 22.5.0) + bash aggregator (the run-all-212.sh run/run_if convention); zero new deps |
| **Config file** | none needed — tests/eureka-offline-preload.cjs is the zero-network guard, wired via NODE_OPTIONS in the aggregator |
| **Quick run command** | `NODE_OPTIONS="--require ./tests/eureka-offline-preload.cjs" node tests/test-226-null-legs.cjs` (the D1 hardest gate) |
| **Full suite command** | `bash tests/run-all-226.sh` |
| **Estimated runtime** | ~60-120 seconds (the 200-entry cap leg dominates; bounded under 30s by design) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-226-null-legs.cjs` (plus the task's own leg)
- **After every plan wave:** Run `bash tests/run-all-226.sh` (run_if guards make partial landings SKIP, not FAIL)
- **Before `/gsd-verify-work`:** Full suite green + `bash tests/run-all-215.sh`, `run-all-216.sh`, `run-all-219.sh` green (SEED req 7 embedded-path oracle)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 226-01-01 | 01 | 1 | REQ-1 (D1/G-1) | T-226-01 | D1 guard exists and is RED before implementation (test-first) | unit (RED) | `node tests/test-226-null-legs.cjs` (expected require-fail) | ❌ W0 (this task creates it) | ⬜ pending |
| 226-01-02 | 01 | 1 | REQ-1, REQ-2, REQ-7 | T-226-01/02/04 | Module exports + additive-only critic diff + zero egress grep | unit + source | `node -e "require('./lib/core/eureka/reasoning-mode.cjs')"` + Part 8 grep | ✅ | ⬜ pending |
| 226-01-03 | 01 | 1 | REQ-1, REQ-2 (D1, D3) | T-226-01/03/05 | Null legs strict, judgeFn count === 2, verdict-by-code, prompt byte-equality, bias-to-reject | unit | `node tests/test-226-null-legs.cjs && node tests/test-226-rubric-parity.cjs` | ✅ (created 01-01/01-03) | ⬜ pending |
| 226-02-01 | 02 | 2 | REQ-8, REQ-4, REQ-1 | T-226-01/02/08 | Non-speculative entry, banking unreachable, G-1 assert before write | behavior + suites | stage-export node -e check + `bash tests/run-all-215.sh` | ✅ | ⬜ pending |
| 226-02-02 | 02 | 2 | REQ-6, REQ-5 (md leg), REQ-3 | T-226-06 | Caveat first, no fabricated numeric column, cause named | unit (render) | render node -e check (plan 02 task 2 verify) | ✅ | ⬜ pending |
| 226-02-03 | 02 | 2 | REQ-3, REQ-6, REQ-8 (D4, D7) | T-226-07/08 | Byte-parity vs real emitter; cause codes; no false trigger | integration (hermetic) | `node tests/test-226-field-contract.cjs && node tests/test-226-degrade-cause.cjs` (offline preload) | ✅ (created here) | ⬜ pending |
| 226-03-01 | 03 | 3 | REQ-5 (D6 html) | T-226-09/10/11 | Mode banner mandatory, escaped, zero external URL | unit | renderReportHtml node -e check (plan 03 task 1 verify) | ✅ | ⬜ pending |
| 226-03-02 | 03 | 3 | REQ-5 | T-226-09 | One governed door; retriable exit round-trips; honest status states | behavior | wiring node -e check + no-report html path | ✅ | ⬜ pending |
| 226-03-03 | 03 | 3 | REQ-5 (D6/G-4) | T-226-09 | Label + caveat in md AND json AND html of the same run; doc-parity | integration (hermetic) | `node tests/test-226-mode-disclosure.cjs` (offline preload) | ✅ (created here) | ⬜ pending |
| 226-04-01 | 04 | 4 | REQ-4, REQ-7, REQ-2 (D5, D8, D3-neg) | T-226-02/13 | banked literal false, zero opportunity nodes, cap holds at 200 entries, junk stays rejected | integration (hermetic) | the three plan 04 task 1 legs (offline preload) | ✅ (created here) | ⬜ pending |
| 226-04-02 | 04 | 4 | REQ-1..REQ-8 roll-up | T-226-12 | One-command gate; SKIP-not-silent; tripwire-plant flips exit | aggregator | `bash tests/run-all-226.sh` + doctor --acceptance subset | ✅ (created here) | ⬜ pending |
| 226-04-03 | 04 | 4 | Human calibration (AI-SPEC Section 5) | T-226-14 | Caveat wording prevents over-trust; David case honest end to end | manual (checkpoint) | N/A — blocking human-verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-226-null-legs.cjs` — the D1 fabricated-number regression guard, written FIRST (plan 226-01 Task 1), proven RED before implementation. This is the phase's single highest-stakes correctness property.
- [ ] `tests/fixtures/226-reasoning-pairs.cjs` — the >= 12 pair reference dataset (AI-SPEC Section 5 composition), created alongside the RED test so every later plan's legs consume it.

No framework install needed — node:assert + the existing eureka-offline-preload.cjs cover all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Caveat wording actually prevents over-trust (not just legally covers it) | REQ-4/REQ-5 human half of D2/D5/D6 | AI-SPEC Section 5 rule: real-judge accuracy and calibration wording are a HUMAN checkpoint (the 212 plan-05 >= 0.85 precedent), never an automated assertion | Plan 226-04 Task 3 checkpoint: David-case run, ICD-203 trust-vs-plausibility read, second-reader html test, upgrade-delta honesty read |
| Rubric bar held on real pairs (Gentner lens spot-check) | REQ-2 human half of D3 | Structure-mapping quality of live pairs cannot be stub-asserted | Same checkpoint, step 6 (2-3 ranked pairs) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (see map — every auto task carries a runnable command; the only manual item is the mandated human calibration checkpoint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test-226-null-legs + fixtures created in plan 01 Task 1, before implementation)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (flips at execution: wave_0_complete after 226-01 Task 1; final approval at the 226-04 Task 3 checkpoint)
