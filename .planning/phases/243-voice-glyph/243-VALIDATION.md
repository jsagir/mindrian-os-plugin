---
phase: 243
slug: voice-glyph
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 243 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None. Hand-rolled CJS assertion scripts using `node:assert/strict`, per the CJS-only convention (no jest/vitest/pytest in this repo). |
| **Config file** | None — phase aggregators are `tests/run-all-<phase>.sh` |
| **Quick run command** | `node tests/test-243-voice-glyph-honest.cjs` |
| **Full suite command** | `bash tests/run-all-243.sh` |
| **Estimated runtime** | ~5 seconds (pure in-process fixture calls, no I/O, no network) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-243-*.cjs` (glob all phase-243 unit files)
- **After every plan wave:** Run `bash tests/run-all-243.sh` plus the two mandatory regression legs `bash tests/run-all-192.sh` and `bash tests/run-all-210.sh` (these carry the three assertions Phase 243 inverts and MUST stay green)
- **Before `/gsd-verify-work`:** Full suite green, both regression legs green, plus `node scripts/build-connector-registry.cjs --check` (phase adds no invocable surface; ledger must stay unchanged at 177 wired / 69 excluded / 0 gap)
- **Max feedback latency:** 10 seconds (no framework install, no compile step)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 243-01-01 | 01 | 1 | GLYPH-01 (SC1a/b) | — | Fabricated-identity self-spoof (V-1) removed: no glyph renders without a real natural-detection signal | unit | `node tests/test-243-voice-glyph-honest.cjs` | ❌ W0 | ⬜ pending |
| 243-01-02 | 01 | 1 | GLYPH-01 (SC1c) | — | Mutation gate: restoring the deleted fallback branch turns the honest-empty fixture rows red | mutation | manual patch + rerun `node tests/test-243-voice-glyph-honest.cjs`, recorded as exact diff in plan | ❌ W0 | ⬜ pending |
| 243-01-03 | 01 | 1 | GLYPH-01 (SC1d/e) | — | Phase 210/192 preserve-floors (natural detection still wins; `[stance]` chip unaffected) stay green after inversion | regression | `bash tests/run-all-192.sh` && `bash tests/run-all-210.sh` | ✅ | ⬜ pending |
| 243-02-01 | 02 | 1/2 | GLYPH-01 (SC2) | — | RCA file exists at the path six documents already cite, `kind: rca`, not `resolved`, carries V-2/V-3 as cross-referenced open entries | doc-presence | `node tests/test-243-rca-routing.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-243-voice-glyph-honest.cjs` — new fixture suite covering all 5 De Stijl glyphs (via `voice_glyph`/`voice_color`/`voice_move` input shapes) plus the honest-empty-with-active-stance rows that serve as the mutation gate (SC1a/b/c)
- [ ] `tests/test-243-rca-routing.cjs` — doc-presence test asserting the RCA file's structure (frontmatter `kind: rca`, `status` not `resolved`, V-2/V-3 headings, a citation back to REQUIREMENTS.md GLYPH-01) without pinning prose wording (SC2)
- [ ] `tests/run-all-243.sh` — new glob-discovering aggregator modeled on `tests/run-all-233.sh` (hard-fails on zero discovered tests)
- [ ] No framework install required — existing hand-rolled `node:assert/strict` convention covers this phase entirely

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification. The RCA's content quality (no fabricated dates/attributions, Source-of-Truth Preamble present) is checked structurally by `test-243-rca-routing.cjs`; the human-authorial judgment behind it (per this repo's standing no-fabrication rule) is the executor's responsibility at authoring time, not a separate manual QA step.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`test-243-voice-glyph-honest.cjs`, `test-243-rca-routing.cjs`, `run-all-243.sh`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
