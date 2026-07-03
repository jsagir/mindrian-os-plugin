---
phase: 210
slug: revert-persona-enforcement-over-reach-selectively-undo-the-m
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 210 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node (CJS assert scripts, no test runner dependency) |
| **Config file** | none — mirrors `tests/run-all-209.sh` / `tests/run-all-205.sh` pattern |
| **Quick run command** | `node tests/test-<name>.cjs` (per touched test file) |
| **Full suite command** | `bash tests/run-all-210.sh` |
| **Estimated runtime** | ~30-60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific `node tests/test-<name>.cjs` for the file just touched
- **After every plan wave:** Run `bash tests/run-all-210.sh`
- **Before `/gsd-verify-work`:** Full suite must be green, plus `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled by the planner from RESEARCH.md's Validation Architecture section — each of the five items (A-E) needs a two-directional regression test: (1) a genuine/relevant/unanswered case still fires the gate, (2) an irrelevant/already-answered case no longer force-blocks.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 210-01-01 | 01 | 1 | Item A (190+209-03 advisory) | — | build/doctor warns, does not fail | unit | `node tests/test-shape-declaration-advisory.cjs` | ⬜ W0 | ⬜ pending |
| 210-01-02 | 01 | 1 | Item B (192 glyph unlock + conditional footer) | — | glyph overridable when turn doesn't fit; footer only on genuine relevance | unit | `node tests/test-voice-glyph-advisory.cjs` | ⬜ W0 | ⬜ pending |
| 210-01-03 | 01 | 1 | Item C (202 disqualifier -> signal) | — | APO loop scores, never vetoes | unit | `node tests/test-voice-contract-signal.cjs` | ⬜ W0 | ⬜ pending |
| 210-01-04 | 01 | 1 | Item D (205 sessionEndQuorum relax) | — | quorum suggests, does not force-pick with <2 genuine signals | unit | `node tests/test-elevation-quorum-advisory.cjs` | ⬜ W0 | ⬜ pending |
| 210-01-05 | 01 | 1 | Item E (209 force-fire relevance gate) | — | skips force-fire when preceding turn already answered OR gate is topically stale | unit + adversarial replay | `node tests/test-card-fire-relevance-gate.cjs` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-shape-declaration-advisory.cjs` — stub, both directions (still-fails-when-genuinely-missing, warns-not-fails-when-declared-not-rendered)
- [ ] `tests/test-voice-glyph-advisory.cjs` — stub
- [ ] `tests/test-voice-contract-signal.cjs` — stub
- [ ] `tests/test-elevation-quorum-advisory.cjs` — stub
- [ ] `tests/test-card-fire-relevance-gate.cjs` — stub, must include the already-answered-plain-text-yes replay case from this session's live incident
- [ ] `tests/run-all-210.sh` — aggregator mirroring `run-all-209.sh`

---

## Manual-Only Verifications

*If none: "All phase behaviors have automated verification."*

All phase behaviors have automated verification. The one navigator-visible check is a live-session replay (Larry no longer force-fires an irrelevant card after a plain-text answer) which the adversarial incident-replay test in item E's Wave 0 stub encodes as an automated fixture, not a manual step.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
