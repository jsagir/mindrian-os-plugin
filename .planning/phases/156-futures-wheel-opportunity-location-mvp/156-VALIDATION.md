---
phase: 156
slug: futures-wheel-opportunity-location-mvp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 156 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node CJS test files (`tests/test-*.cjs`, plain assert) + bash aggregator (`tests/run-all-156.sh`) — repo convention (mirrors run-all-150.9.sh / run-all-150.10.sh) |
| **Config file** | none — node built-in assert; python3 for compute-hsi integration leg |
| **Quick run command** | `node tests/test-futures-<component>.cjs` |
| **Full suite command** | `bash tests/run-all-156.sh` |
| **Estimated runtime** | ~30-60s (HSI integration leg dominates) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `node tests/test-futures-*.cjs`
- **After every plan wave:** Run `bash tests/run-all-156.sh`
- **Before `/gsd-verify-work`:** Full suite green + the Part 8 boundary scan returns 0
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|-------------|------------|-----------------|-----------|-------------------|--------|
| FW-01 command exists + Part 7 frontmatter | — | N/A | file/grep | `test -f commands/futures.md && grep -q 'connector:' commands/futures.md` | ⬜ pending |
| FW-02 bounded multi-ring (depth×fan-out caps) | — | N/A | unit | `node tests/test-futures-generator.cjs` (asserts ring tags + cap bound) | ⬜ pending |
| FW-03 advisory causal-cue flag (never drops) | — | N/A | unit | `node tests/test-futures-causal-cue.cjs` | ⬜ pending |
| FW-04 horizon/confidence/PESTEL frontmatter | — | N/A | unit | `node tests/test-futures-frontmatter.cjs` (enum/range validators) | ⬜ pending |
| FW-05 ROOT_CAUSES/ENABLES via writeEdge | — | only frozen edge types written | integration | `node tests/test-futures-edges.cjs` | ⬜ pending |
| FW-06 file→register→HSI→wire; Artifact-node precondition | T-156-01 | Artifact count == filed count before scan | integration | `node tests/test-futures-hsi-integration.cjs` (asserts ≥1 HSI_CONNECTION) | ⬜ pending |
| FW-07 subsystem PESTEL map render | — | N/A | render assert | `node tests/test-futures-render.cjs` (grep PESTEL grouping) | ⬜ pending |
| FW-08/09 bank w/ edge provenance | — | provenance traces to edge | integration | `node tests/test-futures-bank.cjs` | ⬜ pending |
| FW-10 proposed→confirmed via confirmNode (byUser) | T-156-02 | no agent-confirmed truth-claim | integration | `node tests/test-futures-confirm.cjs` | ⬜ pending |
| FW-11 Part 8 local-only | T-156-03 | zero room-content egress | boundary scan | `node tests/test-futures-part8-leak.cjs` (adversarial) | ✅ PASS (Plan 04, dd82d383) |
| FW-12 top-N chaining via command-resolver (no hardcode) | — | N/A | unit | `node tests/test-futures-chaining.cjs` | ✅ PASS (Plan 04, bc02c7e8) |
| FW-13 SIGNAL seed+per-ring; generic handles only | T-156-03 | query carries no room body | integration+boundary | `node tests/test-futures-signal.cjs` | ✅ PASS (Plan 04, 1f1906ec) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-156.sh` — phase-gate aggregator (created Wave 0 / last wave)
- [ ] `tests/test-futures-part8-leak.cjs` — adversarial egress tripwire stub (mirrors test-navigation-packet-part8-leak.cjs)
- [ ] HSI integration fixture: a small seed room with ≥4 consequence `.md` files for the compute-hsi+hsi-to-graph leg

*Existing infrastructure (node assert + bash aggregator pattern) covers the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Surfaces a bridge the navigator did NOT draw" (the do-what-a-human-can't test) | FW (Goal) | Qualitative judgment of insight value | Run `/mos:futures "automobile adoption"`; confirm ≥1 surfaced HSI_CONNECTION bridge is cross-domain and not an explicit ring link (e.g. automobile→middle-manager) |
| Desktop/Cowork conversational flow | Tri-Polar | No headless harness for the conversational surface | Manually drive the guided-by-ring loop on Desktop; confirm gate + render degrade gracefully (Tier 0 if python3 absent) |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
