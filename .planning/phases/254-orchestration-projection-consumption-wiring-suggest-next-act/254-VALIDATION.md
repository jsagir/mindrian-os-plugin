---
phase: 254
slug: orchestration-projection-consumption-wiring-suggest-next-act
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-02
---

# Phase 254 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:assert` + `node:test` where used; no external runner |
| **Config file** | none by design (CJS scripts, bash aggregators) |
| **Quick run command** | `node tests/test-254-<slug>.cjs` |
| **Full suite command** | `bash tests/run-all-254.sh` |
| **Estimated runtime** | ~10 seconds hermetic; COMP-02's live-wire test uses `tests/helpers/brain-capture-server.cjs` (loopback, not a real network call) |

---

## Sampling Rate

- **After every task commit:** the task's own `node tests/test-254-<slug>.cjs`, plus `node scripts/build-orchestration-projection.cjs --check` (already a pre-commit hook, runs regardless).
- **After every plan wave:** `bash tests/run-all-254.sh` plus the three existing regression suites (`lib/memory/suggest-next-workflow.test.cjs`, `tests/test-act-on-runchain.cjs`, `tests/test-act-cross-class-chain.cjs`).
- **Before `/gsd-verify-work`:** `bash tests/run-all-254.sh` green, `node scripts/doctor.cjs --acceptance` green, `scripts/verify-release` green.
- **Max feedback latency:** 10 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 254-01-01 | 01 | 0 | WIRE-01 | V4 | Multi-hop chain sourced from projection when edges exist for the seed | unit | `node tests/test-254-projection-chain-source.cjs` | ❌ W0 | ⬜ pending |
| 254-01-02 | 01 | 0 | WIRE-02 | — | Empty projection result degrades to registry answer with disclosed source, never empty | unit | `node tests/test-254-degrade-floor.cjs` | ❌ W0 | ⬜ pending |
| 254-01-03 | 01 | 0 | WIRE-03 | — | `act --chain` and `suggest-next` compose from one source, cannot disagree | integration | `node tests/test-254-one-chain-source.cjs` | ❌ W0 | ⬜ pending |
| 254-01-04 | 01 | 0 | WIRE-04 | — | Three framework vocabularies cannot silently diverge | gate | `node tests/test-254-vocabulary-drift.cjs` | ❌ W0 | ⬜ pending |
| 254-01-05 | 01 | 0 | R7-fence | — | No module reachable from `decide()` gains a Brain require; `navigation-engine.cjs` byte-unchanged | structural | `node tests/test-254-r7-structural-fence.cjs` | ❌ W0 | ⬜ pending |
| 254-02-01 | 02 | 1 | COMP-01 | Part 8 | Every `mindrian-os` handler reaching the Brain enumerated and belted | structural | `node tests/test-254-composition-census.cjs` | ❌ W0 | ⬜ pending |
| 254-02-02 | 02 | 1 | COMP-02 | Repudiation | `ambiguous` verdict on server-side path is disclosed, not silent | integration (live wire, loopback capture) | `node tests/test-254-ambiguous-disclosure.cjs` | ❌ W0 | ⬜ pending |
| 254-03-01 | 03 | — | — | — | `brain-router.cjs` added to Theo's adaptation list (written note, no code change to Theo) | doc gate | `git -C /home/jsagi/Theo status --short` returns empty | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders for the planner's own wave/task numbering — the Requirement/Test Type/Command columns are the load-bearing content this VALIDATION.md contributes. COMP-01/COMP-02 exist because D-01 ratified composition; per the Wave 0 Gaps note below, COMP-02's test is conditioned on that ruling (already resolved: APPROVED).*

---

## Wave 0 Requirements

- [ ] `tests/run-all-254.sh` — the glob aggregator, copied from `tests/run-all-262.sh`'s structure (glob discovery, `found -eq 0` guard, no-em-dash fence)
- [ ] `tests/test-254-projection-chain-source.cjs` — WIRE-01
- [ ] `tests/test-254-degrade-floor.cjs` — WIRE-02
- [ ] `tests/test-254-one-chain-source.cjs` — WIRE-03
- [ ] `tests/test-254-vocabulary-drift.cjs` — WIRE-04
- [ ] `tests/test-254-r7-structural-fence.cjs` — the R7 fence, modeled on `tests/test-reader-r4-structural-184.cjs`
- [ ] `tests/test-254-composition-census.cjs` — COMP-01, modeled on `lib/mcp/no-instructions.test.cjs`
- [ ] `tests/test-254-ambiguous-disclosure.cjs` — COMP-02 (D-01 ratified composition, so this test is in scope, not conditional)
- [ ] No framework install needed — `node:assert` + bash already in use

---

## Manual-Only Verifications

*None. This phase makes no live production Brain calls that require a human-gated checkpoint —
COMP-02's live-wire test runs against `tests/helpers/brain-capture-server.cjs` (loopback), and
D-06's fresh-measurement requirement for the composition wave is a targeted hermetic probe
reusing `chain-recommender.cjs`'s existing `normalizeFrameworkName` retry leg, not a live
production run requiring sign-off.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (all 7 test files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
