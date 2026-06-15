---
phase: 158
slug: bounded-rejection-penalty-seed-009-minimal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 158 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 158-RESEARCH.md "## Validation Architecture". All tests are DETERMINISTIC (no RNG, no live Brain): use the `roomState.invocationsSinceDecision[command]` injection seam + `_setRegistry` fixtures; parole is counter-keyed per D-06.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node CJS assert-style suites (the `tests/test-*.cjs` idiom) + bash phase-gate runner |
| **Config file** | none - mirrors `tests/run-all-148.sh` (the carried frozen-invariant gate) |
| **Quick run command** | `node tests/test-rejection-penalty.cjs` (the new suite; per touched file) |
| **Full suite command** | `bash tests/run-all-158.sh` (new phase gate) + `bash tests/run-all-148.sh` (frozen-148 must stay green) |
| **Estimated runtime** | ~10-30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched suite
- **After every plan wave:** Run `bash tests/run-all-158.sh`
- **Before `/gsd-verify-work`:** `run-all-158.sh` green AND `run-all-148.sh` green (frozen-6 invariant intact)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Seed rows from the research validation architecture. The planner fills task IDs/waves; every attack in the CONTEXT red-team ledger maps to a deterministic test below.

| Validation target | Requirement | Test Type | Automated Command (deterministic) | Status |
|-------------------|-------------|-----------|-----------------------------------|--------|
| Rejected ranks below identical zero-reject candidate (via `_applyDecay` seam) | RJP-01 | unit | `node tests/test-rejection-penalty.cjs` (injection seam, no db) | pending |
| Byte-stable at zero rejections vs captured baseline | RJP-02 | snapshot | mirror `tests/test-drift-baseline.cjs` byte-compare | pending |
| Bounded discount below N; never below FLOOR=0.05 by accident (double-crush) | RJP-03 | unit | `node tests/test-rejection-penalty.cjs` | pending |
| Hard-suppress at N=3 within W (ABSENT from top-K); PRESENT at N-1 | RJP-04 | unit | `node tests/test-rejection-penalty.cjs` (drop BEFORE sort/slice) | pending |
| Noise attack: rejects below M=2 presentations do NOT suppress | RJP-04/05 | unit | `node tests/test-rejection-penalty.cjs` | pending |
| Confirmation-loop: suppressed candidate RE-SURFACES via W-aging and via parole (P=5) | RJP-04 | unit | `node tests/test-rejection-penalty.cjs` (counter-keyed parole, deterministic) | pending |
| N/M/W/P/CAP/FLOOR are NAMED constants (no magic literal at suppression check) | RJP-05 | source | grep assertion in the suite | pending |
| Part 8: zero rejection-reason strings reach the ranker (enum/scalar only) | RJP-06 | adversarial | mirror `tests/test-navigation-packet-part8-leak.cjs` seeding + `run-all-158.sh` grep sweep | pending |
| Part 9: penalty path reads only via `navigation.cjs` (no direct DB/fs) | RJP-07 | source | grep sweep in `run-all-158.sh` | pending |
| No `ranker_weights` table; 0.40/0.30/0.30 unchanged; frozen-6 invariant green | RJP-08 | regression | `bash tests/run-all-148.sh` (18 suites) | pending |
| `reach_presented` event fires at the dial-render seam, keyed to `cmd:` (D-07) | RJP-04/05 | unit | new suite asserts the additive EVENT_TYPE + payload is enum/scalar | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-rejection-penalty.cjs` - new deterministic suite covering RJP-01..08 via the injection seam
- [ ] `tests/run-all-158.sh` - phase gate (new suite + Part 8 grep sweep + Part 9 grep sweep + frozen-148 passthrough)
- [ ] No new framework - reuse the shipped `test-*.cjs` + `run-all-NNN.sh` idiom

*Existing infrastructure (the `tests/test-*.cjs` + `run-all-NNN.sh` pattern) covers all phase requirements; only the new suite + gate are added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | - | - | All phase behaviors have deterministic automated verification (the injection seam + counter-keyed parole remove the only sources of non-determinism). |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the new suite + gate)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (planner/executor flips when the map is complete)

**Approval:** pending
