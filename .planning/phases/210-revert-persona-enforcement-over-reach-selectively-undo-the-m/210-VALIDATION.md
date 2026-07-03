---
phase: 210
slug: revert-persona-enforcement-over-reach-selectively-undo-the-m
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
---

# Phase 210 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node (CJS assert scripts, no test runner dependency) |
| **Config file** | none - mirrors `tests/run-all-209.sh` / `tests/run-all-205.sh` pattern |
| **Quick run command** | `node tests/test-<name>.cjs` (per touched test file) |
| **Full suite command** | `bash tests/run-all-210.sh` |
| **Estimated runtime** | ~30-60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific `node tests/test-<name>.cjs` for the file just touched, plus `node -c` on every edited .cjs
- **After every plan wave:** Run `bash tests/run-all-210.sh` plus the softened phases' own aggregators (`run-all-190/192/202/205/209.sh`)
- **Before `/gsd-verify-work`:** Full suite must be green, plus `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled by the planner 2026-07-03 from RESEARCH.md's Validation Architecture. Every softened gate has a two-directional regression test: (1) a genuine/relevant/unanswered case still fires the gate, (2) an irrelevant/already-answered case no longer force-blocks. Wave 0 (plan 210-01) creates every ⬜ W0 file BEFORE any implementation task runs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 210-01-01 | 01 | 1 | 210-E (Wave 0) | T-210-01 | item-E tests hermetic (tmp isolation) | unit + adversarial replay | `node tests/test-card-fire-relevance-gate.cjs` + `node tests/test-210-trailer-relevance.cjs` | ⬜ W0 | ⬜ pending |
| 210-01-02 | 01 | 1 | 210-A/B/C/D (Wave 0) | T-210-02 | both directions encoded per stub | unit | `node -c` all four stubs | ⬜ W0 | ⬜ pending |
| 210-01-03 | 01 | 1 | ALL (aggregator) | - | 14 legs pre-declared, no later edit | integration | `bash tests/run-all-210.sh` | ⬜ W0 | ⬜ pending |
| 210-02-01 | 02 | 2 | 210-A (advisory + --strict) | T-210-03 | warns-not-fails; violations still enumerated; --strict exits 1 | unit | `node tests/test-shape-declaration-advisory.cjs` + `node scripts/check-shape-declaration.test.cjs` | ⬜ W0 / ✔ extend | ⬜ pending |
| 210-02-02 | 02 | 2 | 210-A (wiring + doc shadows) | T-210-04, T-210-05 | adjacent 178/186 gates byte-untouched | integration | `node scripts/doctor.cjs --acceptance` + `bash -n scripts/release.sh` | ✔ exists | ⬜ pending |
| 210-03-01 | 03 | 2 | 210-B (glyph preference) | T-210-07 | default mapping preserved; natural detection wins on disagreement; null degrades | unit | `node tests/test-voice-glyph-advisory.cjs` + `node tests/test-192-statusline-stance-chip.cjs` | ⬜ W0 / ✔ | ⬜ pending |
| 210-03-02 | 03 | 2 | 210-B (footer prose) | - | relevance-conditional offer; never-forced floor kept | doctrine-presence grep | `node tests/test-stance-voice-glyph-override.cjs` | ✔ re-point | ⬜ pending |
| 210-04-01 | 04 | 2 | 210-C (score not veto) | T-210-09 | violating candidate selectable; signal visible; detector untouched | unit | `node tests/test-voice-contract-signal.cjs` + `node tests/test-202-apo-loop.cjs` | ⬜ W0 / ✔ | ⬜ pending |
| 210-04-02 | 04 | 2 | 210-D (suggest not force) | T-210-10 | suggested:true/forced:false; hypothesis floor T-205-07-E intact; Test 12 unchanged | unit | `node tests/test-elevation-quorum-advisory.cjs` + `node tests/test-205-fusion-router.cjs` | ⬜ W0 / ✔ | ⬜ pending |
| 210-05-01 | 05 | 2 | 210-E-1 (relevance-gated backstop) | T-210-12, T-210-13, T-210-14 | already-answered/irrelevant pass; genuine fork STILL intercepts; caps + CR-03 untouched | unit + adversarial replay | `node tests/test-card-fire-relevance-gate.cjs` + `node tests/test-209-incident-replay.cjs` (verdict legs b/c/d byte-unmodified; leg (a) wording re-pointed in 210-05-02) | ⬜ W0 / ✔ floor | ⬜ pending |
| 210-05-02 | 05 | 2 | 210-E-2 (conditional trailer + wording re-point) | T-210-15 | frozen marker byte-identical; no unconditional BINDING; '[BINDING:' -> '[FIRE-IF-FORK:' re-pointed ONLY in the 4 wording-literal assertions (test-209-incident-replay.cjs + 3 siblings), verdict assertions untouched (line-scoped git-diff proof) | unit | `node tests/test-210-trailer-relevance.cjs` + `node tests/test-209-incident-replay.cjs` + `node tests/test-209-engine-arm-contract.cjs` + `node tests/test-209-room-pick-sensor.cjs` + `node tests/test-gate-native-fire-w1.cjs` | ⬜ W0 | ⬜ pending |
| 210-05-03 | 05 | 2 | 210-E-3 (v2 stamp sweep) | T-210-16 | one scripted mutation surface; no dual markers; count from disk | unit | `node scripts/stamp-firing-block.cjs --check` + `node tests/test-209-stamp-firing-block.cjs` | ✔ exists | ⬜ pending |
| 210-06-01 | 06 | 3 | 210-A (canon checkpoint) | T-210-17 | no canon byte before navigator approval | blocking human checkpoint | - (checkpoint:human-verify) | n/a | ⬜ pending |
| 210-06-02 | 06 | 3 | 210-A (canon lockstep) | T-210-18 | atomic amendment; floor tests at 1.24 anchor | unit | `node tests/test-canon-entry-36-shape-declaration-floor.cjs` + `bash tests/run-all-190.sh` | ✔ re-anchor | ⬜ pending |
| 210-07-01 | 07 | 4 | ALL (phase gate) | T-210-20 | full bidirectional suite + preserve-list proof | integration | `bash tests/run-all-210.sh` + 5 prior aggregators + `node scripts/doctor.cjs --acceptance` | ✔ by wave 3 | ⬜ pending |
| 210-07-02 | 07 | 4 | ALL (release) | T-210-21, T-210-22 | real npm publish, unpublished version, 5-place sync | integration | `scripts/release.sh 1.15.3-beta.1` + registry check | ✔ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Naming note: RESEARCH.md's provisional names `tests/test-210-relevance-gate.cjs` and `tests/run-all-210.sh` resolve to this file's canonical Wave 0 names: `tests/test-card-fire-relevance-gate.cjs` carries the E-1 two-directional contract; `tests/test-210-trailer-relevance.cjs` (from RESEARCH/PATTERNS) is ADDED to the Wave 0 set for E-2 coverage.

---

## Wave 0 Requirements

Created by plan 210-01 (wave 1), before any implementation task:

- [ ] `tests/test-shape-declaration-advisory.cjs` - stub, both directions (still-detects-and-enumerates, warns-not-fails by default, --strict exits 1)
- [ ] `tests/test-voice-glyph-advisory.cjs` - stub
- [ ] `tests/test-voice-contract-signal.cjs` - stub
- [ ] `tests/test-elevation-quorum-advisory.cjs` - stub
- [ ] `tests/test-card-fire-relevance-gate.cjs` - stub, must include the already-answered-plain-text-yes replay case from this session's live incident
- [ ] `tests/test-210-trailer-relevance.cjs` - stub (E-2, frozen-marker + conditional-imperative)
- [ ] `tests/run-all-210.sh` - aggregator mirroring `run-all-209.sh`, all 14 legs pre-declared

---

## Manual-Only Verifications

All phase behaviors have automated verification. The one navigator-visible check is a live-session replay (Larry no longer force-fires an irrelevant card after a plain-text answer) which the adversarial incident-replay test in item E's Wave 0 stub encodes as an automated fixture, not a manual step. The one human gate in the phase is the plan 210-06 canon-wording checkpoint (approval, not verification).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (plan 210-01, wave 1)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner 2026-07-03 (fable) - pending executor confirmation at Wave 0 completion (`wave_0_complete` flips after plan 210-01)
