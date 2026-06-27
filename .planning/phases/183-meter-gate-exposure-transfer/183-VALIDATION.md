---
phase: 183
slug: meter-gate-exposure-transfer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 183 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> METER is LOCAL telemetry over the Part 9 navigation.cjs chokepoint. Tests are
> Node CJS assertion scripts in tests/, run via a phase aggregator, mirroring the
> Phase 180 idiom (tests/test-canon-entry-31-two-gauge-floor.cjs + run-all-180.sh).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node CJS assertion scripts (no test runner dep) + bash aggregator, per repo convention |
| **Config file** | none — repo uses standalone node test scripts under tests/ |
| **Quick run command** | `node tests/test-meter-two-gauge-weld.cjs` |
| **Full suite command** | `bash tests/run-all-183.sh` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant `node tests/test-meter-*.cjs`
- **After every plan wave:** Run `bash tests/run-all-183.sh`
- **Before `/gsd-verify-work`:** Full suite must be green + the Part 8 LOCAL-only grep sweep clean
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 183-01-01 | 01 | 1 | METER-01 | T-183-01 (no Brain egress) | gate_reached emitted LOCAL-only via logMemoryEvent; no network | unit | `node tests/test-meter-gate-reach.cjs` | ❌ W0 | ⬜ pending |
| 183-01-02 | 01 | 1 | METER-01 | — | invocation-density derived from EVENT_TYPES reads, no new store | unit | `node tests/test-meter-density.cjs` | ❌ W0 | ⬜ pending |
| 183-02-01 | 02 | 2 | METER-02 | — | transfer proxies (latency/independence/reject-rate) labelled named-debt, not transfer | unit | `node tests/test-meter-transfer.cjs` | ❌ W0 | ⬜ pending |
| 183-02-02 | 02 | 2 | METER-01, METER-02 | — | two-gauge read returns the PAIR or errors; no bare-density export | unit | `node tests/test-meter-two-gauge-weld.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Task IDs/waves are provisional; the planner finalizes them in PLAN.md.*

---

## Wave 0 Requirements

- [ ] `tests/test-meter-gate-reach.cjs` — stub for METER-01 gate-reach emission
- [ ] `tests/test-meter-density.cjs` — stub for METER-01 invocation-density derivation
- [ ] `tests/test-meter-transfer.cjs` — stub for METER-02 transfer proxies
- [ ] `tests/test-meter-two-gauge-weld.cjs` — stub for the welded-pair contract
- [ ] `tests/run-all-183.sh` — phase aggregator (mirrors run-all-180.sh)

*No new test framework — existing standalone-node-script convention covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A live navigator reaches the decide() gate and the meter reads a real number | METER-01 acceptance | Requires a real conversational turn on the engine arm with roomDb open | Run a session that fires a reach (engine arm), then read the meter via navigation.cjs; confirm gate_reached count > 0 and the two-gauge read returns the pair |
| Desktop/Cowork gate-reach is counted (not CLI-only) | METER-01 landmine | The emit must sit on the surface-shared resolve path; cross-surface needs the host | Confirm the hook is on the shared resolve seam, not a CLI-only branch (static check + reasoning) |

*The first row is the entry-31 self-binding-clause precondition: a real two-gauge reading from a live navigator on the gate.*

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] Part 8 LOCAL-only grep sweep (fetch|http|curl|brain.mindrian|tavily) clean over new files
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
