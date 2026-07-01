---
phase: 188
slug: f7-multiselect-toggleable-hitl
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 188 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 188-RESEARCH.md "## Validation Architecture" (HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test scripts (`*.test.cjs` siblings) + `bash tests/run-all-<phase>.sh` (project convention; no jest/vitest) |
| **Config file** | none — each shape ships a `*.test.cjs` sibling run by the phase runner |
| **Quick run command** | `node lib/hmi/shape-f9-renderer.test.cjs` (per-module, < 5s) |
| **Full suite command** | `bash tests/run-all-188.sh` (Wave 0 creates it, model on `tests/run-all-187.sh`) |
| **Estimated runtime** | ~30 seconds (full suite) |

Gate commands: `node scripts/check-render-coverage.cjs`, `node scripts/check-hitl-stages.cjs`, `node scripts/doctor.cjs --acceptance`.

---

## Sampling Rate

- **After every task commit:** Run the touched module's `*.test.cjs` (< 5s)
- **After every plan wave:** Run `node scripts/check-render-coverage.cjs` + `node scripts/check-hitl-stages.cjs`
- **Before `/gsd-verify-work`:** `bash tests/run-all-188.sh` green + `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req ID | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|------|----------|-----------|-------------------|-------------|--------|
| SFS-08 | A | F.3 pick sets depth state | integration | `node lib/hmi/shape-f3-parity.test.cjs` | ❌ W0 | ⬜ pending |
| SFS-09 | A | F.4 pick accumulates progressive harvest scope | integration | `node lib/hmi/shape-f4-parity.test.cjs` | ❌ W0 | ⬜ pending |
| SFS-06 | A | bare F.7 routes to the dial; no F.7→breakthrough path | unit | `node lib/hmi/selector-dispatcher.test.cjs` (F.7 branch) | ⚠️ extend | ⬜ pending |
| SFS-07 | A | 9 fixtures validate against schema; bad fixture fails closed | unit | `node scripts/check-hitl-stages.cjs` | ❌ W0 | ⬜ pending |
| SFS-10 | A/C | per-shape gate green F.0-F.9; synthetic missing shape fails closed | unit/floor | `node scripts/check-render-coverage.cjs --check` | ⚠️ extend | ⬜ pending |
| SFS-12 | A | CLAUDE.md:46 line accurate + additive | assertion | grep assertion in the phase runner | ❌ W0 | ⬜ pending |
| SFS-11 | B | canon amendment present + frozen scalars byte-identical (FLOOR) | floor | canon FLOOR test (MAX_K=3/DIAL_REACH_K=6/0.70/0.15 unchanged) | ⚠️ after gate | ⬜ pending |
| SFS-01 | C | F.8 registered + renders multiSelect card | unit | `node lib/hmi/shape-f8-renderer.test.cjs` | ❌ W0 | ⬜ pending |
| SFS-02 | C | array capture maps N selectedOptions deterministically | unit | `node lib/hmi/f8-capture.test.cjs` | ❌ W0 | ⬜ pending |
| SFS-03 | C | N typed edges on ONE confirm via navigation.cjs | integration | `node lib/workflow/f8-consumer.test.cjs` | ❌ W0 | ⬜ pending |
| SFS-04 | C | F.9 renders ordered per-item APPROVE/REJECT/DEFER (paged) | unit | `node lib/hmi/shape-f9-renderer.test.cjs` | ❌ W0 | ⬜ pending |
| SFS-05 | C | F.9 consumer: APPROVE writes edge, DEFER leaves CONTRADICTS pair | integration | `node lib/workflow/f9-consumer.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-188.sh` — the phase runner (model on `tests/run-all-187.sh`)
- [ ] `lib/hmi/shape-f8-renderer.test.cjs`, `shape-f9-renderer.test.cjs`, `shape-f3-parity.test.cjs`, `shape-f4-parity.test.cjs`
- [ ] `lib/workflow/f8-consumer.test.cjs`, `f9-consumer.test.cjs`
- [ ] FLOOR test for frozen scalars unchanged (canon amendment guard, SFS-11)
- [ ] FLOOR/hard-fail test for the per-shape coverage predicate (synthesize a missing shape, assert exit 1) — model on `tests/test-render-coverage-gate-hardfail.cjs`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Part-3 canon amendment ratification | SFS-11 | Constitutional change — navigator authority only (D-01a); an agent cannot ratify canon | HALT at the `checkpoint:human-verify` in Wave B; present the exact amendment diff; proceed only on explicit APPROVE |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
