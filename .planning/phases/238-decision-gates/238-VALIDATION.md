---
phase: 238
slug: decision-gates
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 238 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node scripts using `node:assert/strict`, aggregated by a bash runner. No jest/vitest/mocha. |
| **Config file** | none (by design — the aggregator IS the config) |
| **Quick run command** | `node tests/test-238-<leg>.cjs` |
| **Full suite command** | `bash tests/run-all-238.sh` |
| **Estimated runtime** | ~30-60 seconds (includes a 20-forked-process concurrency leg for GATE-03) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-238-<leg>.cjs` for the leg just touched.
- **After every plan wave:** Run `bash tests/run-all-238.sh` plus `bash tests/run-all-198.sh` and `bash tests/run-all-209.sh` (both hold assertions this phase can break).
- **Before `/gsd-verify-work`:** Full `run-all-238.sh` green, plus `node scripts/build-connector-registry.cjs --check`.
- **Max feedback latency:** ~60 seconds (the concurrency leg is the long pole).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 238-xx-01 | TBD | TBD | GATE-01 (G-1) | T-198-10 | A real `chain_run` halt's minted `gate_id` is consumable by `gate_answer`; mint id equals ratified id | integration | `node tests/test-238-one-ledger.cjs` | ❌ W0 | ⬜ pending |
| 238-xx-02 | TBD | TBD | GATE-01 (G-1) | T-198-10 | Seam-liveness `checkMintRatifierLiveness` green on live mint/ratify kinds, red on a renamed mint kind | unit | `node tests/test-238-mint-ratifier-seam.cjs` | ❌ W0 | ⬜ pending |
| 238-xx-03 | TBD | TBD | GATE-01 (G-2) | V5 Input Validation | `chosen` not among the card's options rejected BEFORE any `memory_event` write; mutation (bypass) turns it red | integration | `node tests/test-238-chosen-validation.cjs` | ❌ W0 | ⬜ pending |
| 238-xx-04 | TBD | TBD | GATE-01 (G-2) | V5 Input Validation | Chain resume path also rejects an out-of-card `chosen` | integration | (same file) | ❌ W0 | ⬜ pending |
| 238-xx-05 | TBD | TBD | GATE-03 (A) | V3/V4 | Session B cannot consume session A's gate | integration | `node tests/test-238-session-scoped-ledger.cjs` | ❌ W0 | ⬜ pending |
| 238-xx-06 | TBD | TBD | GATE-03 (B) | V12 Files/Resources | N forked processes x M increments produce EXACTLY N*M; no torn write | concurrency | `node tests/test-238-retry-counter-fence.cjs` (+ `.worker.cjs`) | ❌ W0 | ⬜ pending |
| 238-xx-07 | TBD | TBD | GATE-03 (B) | V12 Files/Resources | A reader concurrent with writers never observes a partial/unparseable file | concurrency | (same file) | ❌ W0 | ⬜ pending |
| 238-xx-08 | TBD | TBD | GATE-04 | — | Every `expect_fire:false` fixture in the committed corpus produces zero intercept | corpus | `node tests/test-238-card-fire-corpus.cjs` | ❌ W0 | ⬜ pending |
| 238-xx-09 | TBD | TBD | GATE-04 | — | Every `expect_fire:true` fixture still fires red (anti-vacuity) | corpus | (same file) | ❌ W0 | ⬜ pending |
| 238-xx-10 | TBD | TBD | GATE-04 | — | `ASCII_BOX_GLYPH_RE` byte-identical; `tests/test-209-backstop-tuning.cjs` still passes | regression | `node tests/test-209-backstop-tuning.cjs` | ✅ | ⬜ pending |
| 238-xx-11 | TBD | TBD | All | — | Existing 198 gate/chain regressions still pass | regression | `bash tests/run-all-198.sh` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task/Plan/Wave columns are TBD — the planner assigns final IDs; this table pins the requirement-to-test mapping, which the plan must not drop.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-238.sh` — aggregator, all legs pre-declared with `run_if` guards so no later plan edits it (the 209-04 precedent)
- [ ] `tests/fixtures/card-fire-corpus-238.json` — the sanitized two-half corpus (`expect_fire:false` half from this session's logged over-enforcement instances, `expect_fire:true` half a genuine unrendered-card control)
- [ ] `tests/test-238-retry-counter-fence.worker.cjs` — the forked-child worker (mirrors `lib/memory/write-lock-atomic.worker.cjs`, the Phase 87-02 precedent)
- [ ] Shared hermetic-isolation helper setting `MINDRIAN_HOME` + `CARD_FIRE_SIDECHANNEL_PATH` for every leg (no test may touch a real user's `.mindrian/` state)
- [ ] Framework install: none needed (plain Node + bash, matching repo convention)

---

## Manual-Only Verifications

*None — every phase behavior in the map above has an automated verification path. The researcher's Open Question 1 (whether GATE-04's remedy trades away the backstop's stated independence from the side channel) is a design decision for the planner/navigator, not a manual test gap.*

---

## Validation Sign-Off

- [x] All tasks have an automated verify path or Wave 0 dependency (mapped above; planner fills in Task/Plan/Wave IDs)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every row above has a command)
- [x] Wave 0 covers all MISSING references (5 items listed above)
- [x] No watch-mode flags (all commands are one-shot `node`/`bash` runs)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (plan-phase orchestrator run, unattended per navigator directive 2026-07-28)
