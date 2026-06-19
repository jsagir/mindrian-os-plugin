---
phase: 165
slug: unknown-unknowns-blindspot-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 165 - Validation Strategy

> Per-phase validation contract. Derived from 165-RESEARCH.md "## Validation Architecture". Harness-as-code: the Verify wave owns the adversarial structured verdict + the phase gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node CJS assert + `tests/run-all-165.sh` bash aggregator (clone the shipped run-all-164.sh / run-all-169.sh idiom) |
| **Config file** | none - bash aggregator runs `node tests/test-*.cjs` and greps for green |
| **Quick run command** | `node tests/test-unknowns-bandit.cjs` (single module, < 5s) |
| **Full suite command** | `bash tests/run-all-165.sh` |
| **Estimated runtime** | ~30-60 seconds |

---

## Sampling Rate

- **After every task commit:** `node tests/test-unknowns-<module>.cjs` for the module touched
- **After every wave merge:** `bash tests/run-all-165.sh` (all unit + Part-8 + frozen-edge + no-random gates)
- **Before `/gsd-verify-work`:** `bash tests/run-all-165.sh` green + `scripts/build-connector-registry.cjs --check` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| D-165-02 | DSP partition + UCB bandit produce ranked partitions | unit | `node tests/test-unknowns-dsp.cjs` / `test-unknowns-bandit.cjs` | W0 | pending |
| D-165-09 | zero Math.random; resume byte-identical | unit + grep | `grep -rc "Math.random" lib/core/unknowns/` (=0) + `test-unknowns-resume.cjs` | W0 | pending |
| D-165-01 | proxy oracle blends 3 LOCAL scalars; top-N gate via confirmNode | unit | `node tests/test-unknowns-proxy-oracle.cjs` | W0 | pending |
| D-165-03 | corpus = UNION(EvidenceClaim/claim/CausalClaim) confirmed + Academic/Operational only (NOT a naive writeClaimNode query) | unit | `node tests/test-unknowns-corpus-adapter.cjs` (fixture room.db) | W0 | pending |
| interPartitionDistance | real distance discriminates (NOT the stub 1.0); lone-partition 0.0 | unit | `node tests/test-unknowns-dsp-goodness.cjs` | W0 | pending |
| D-165-08 | only the 4 frozen edges (INVALIDATES/ROOT_CAUSES/ENABLES/FEEDS_INTO); remap self-check | unit | `node tests/test-unknowns-frozen-edges.cjs` | W0 | pending |
| D-165-10 | zero Brain egress; no raw room.db write (writes via navigation chokepoint) | grep gate | `node tests/test-unknowns-part8-boundary.cjs` (forbidden-substring sweep) | W0 | pending |
| D-165-05/07 | file-meeting connector regen + SENS-06/08 wiring (rides existing reach, no 7th) | integration | `scripts/build-connector-registry.cjs --check` | exists | pending |
| D-165-06 | engine output ranks into F.1 (f-selector-ranker) | integration | `node tests/test-unknowns-rank-in.cjs` | W0 | pending |
| Verify | adversarial {passed,findings[]} verdict proves the engine by instrumentation | adversarial | `node tests/test-unknowns-verdict.cjs` (mirror 164 W6 / 169 W6) | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-165.sh` - the one-command phase gate (clone run-all-164.sh)
- [ ] `tests/test-unknowns-corpus-adapter.cjs` + a fixture room.db with confirmed/proposed/Academic/Operational/None claims - D-165-03 (the UNION corpus, the load-bearing correction)
- [ ] `tests/test-unknowns-dsp.cjs` + `test-unknowns-bandit.cjs` - D-165-02
- [ ] `tests/test-unknowns-dsp-goodness.cjs` - the REAL inter-partition distance discriminates (the stub-leak regression)
- [ ] `tests/test-unknowns-proxy-oracle.cjs` - D-165-01 (3 scalars, weights 0.5/0.3/0.2, budget 3)
- [ ] `tests/test-unknowns-resume.cjs` - interrupt + resume = byte-identical (D-165-09)
- [ ] `tests/test-unknowns-frozen-edges.cjs` - only the 4 frozen edges; remap self-check (D-165-08)
- [ ] `tests/test-unknowns-part8-boundary.cjs` - forbidden-substring sweep (D-165-10)
- [ ] `tests/test-unknowns-rank-in.cjs` - engine output ranks into F.1 (D-165-06)
- [ ] `tests/test-unknowns-verdict.cjs` - the adversarial structured {passed,findings[]} verdict (harness property 6)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live meeting-as-oracle fire (SENS-06 contradiction -> blind spot surfaced at the F.1 gate) | D-165-05/06 | Sensor fire is a Claude Code runtime event; the unit test covers the condition, not the live trigger | File a meeting with a stakeholder contradiction against a confirmed Academic/Operational claim; confirm the blind spot surfaces at the next F.1 gate, freshness-gated |

---

## Security Domain (Canon Part 8 dominant)

| Pattern | Applies | Control |
|---------|---------|---------|
| Part 8 breach (corpus / proxy scalars / HSI priority reach the Brain) | yes | Boundary scan over lib/core/unknowns/* + the proxy oracle; pattern-mining is LOCAL-only; Brain READ-ONLY generic handles; HSI per-partition priority is LOCAL proxy-score v1 (HSI optional cached enrichment, A2/Q1) |
| Room-boundary (cross-room scan) | yes | Room-local v1 (D-165-04); cross-room is the deferred Part-8 amendment |
| Chokepoint bypass (raw room.db write) | yes | All writes via navigation.cjs; clone 169 candidateToFinding for proposed-node writes; the Phase 109 substrate guard enforces |
| Confidently-wrong finding lands confirmed without human | yes | Proxy labels -> review_status: proposed only; human-confirm budget (3) promotes top-N to confirmed at the gate (Part 9 role 5) |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set by the planner once every task maps to a test

**Approval:** pending
