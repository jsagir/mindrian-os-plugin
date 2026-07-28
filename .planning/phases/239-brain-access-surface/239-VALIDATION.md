---
phase: 239
slug: brain-access-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 239 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node.js scripts, `node:assert` / `assert`, `child_process.spawnSync`. No Jest/Mocha/Vitest anywhere in this repo (CJS-only convention, no build step) |
| **Config file** | none (by design) |
| **Quick run command** | `node tests/<file>.cjs` |
| **Full suite command** | `bash tests/run-all-239.sh` (does not exist yet — Wave 0 gap) |
| **Estimated runtime** | ~10-20 seconds (dominated by the ~2-4s MCP `tools/list` handshake in the liveness test) |

---

## Sampling Rate

- **After every task commit:** Run the single test file the task touches (`node tests/test-239-*.cjs`), plus `node lib/core/seam-liveness.test.cjs`
- **After every plan wave:** Run `bash tests/run-all-239.sh`
- **Before `/gsd-verify-work`:** Full suite green, plus the no-regression sweep this repo already uses — `bash tests/run-all-196.sh`, `node scripts/build-connector-registry.cjs --check`, `bash tests/run-all-235.sh`
- **Max feedback latency:** ~10s per task-level run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 239-01-01 | 01 | 1 | BRAIN-01 | T1 / T7 | Live `tools/list` handshake enumerates the 6 bare Brain tool names offline; `checkHookMatcherLiveness` verdict is `ok:true` after the fix; mutation (rename a live tool, or stale one matcher) turns it red | integration + mutation | `node tests/test-239-brain-tool-liveness.cjs` | ❌ W0 | ⬜ pending |
| 239-01-02 | 01 | 1 | BRAIN-01 | T3 / T7 | `isBrainTool()` true for both plugin-scoped and project-scoped live names, false for a foreign server name (anti-impersonation) | unit | `node tests/test-brain-response-sanitize.cjs` (inverted fixtures) | ✅ (assertions to invert) | ⬜ pending |
| 239-01-03 | 01 | 1 | BRAIN-01 | T1 | PostToolUse PII-sanitizer hook fires on a live tool name | integration | `node tests/test-239-pii-sanitizer-liveness.cjs` | ❌ W0 | ⬜ pending |
| 239-02-01 | 02 | 2 | BRAIN-02 | T2 / T4 / T5 | Canary token in `opportunity.domain` and in a Blue Hat `methodology_notes` entry is caught before the wire; capture server records zero canary bytes; mutation removing `query()` coverage turns it red | e2e + mutation | `node tests/test-239-query-egress-canary.cjs` | ❌ W0 | ⬜ pending |
| 239-02-02 | 02 | 2 | BRAIN-02 | T4 | Regression: template laundering (the `Framework` vocabulary word cannot launder a canary to `allow`) | unit | same file | ❌ W0 | ⬜ pending |
| 239-02-03 | 02 | 2 | BRAIN-02 | T5 | Regression: guard call is strictly upstream of `sanitizeCypherInput` (sanitize-before-classify ordering cannot return) | unit | same file | ❌ W0 | ⬜ pending |
| 239-03-01 | 03 | 2 | BRAIN-03 | T7 | Census asserts zero production `sendPacket(` call sites outside the allowlist; dated park note exists at the call surface AND in docs; the two contradictory in-repo claims (`navigation/packet.cjs:105` vs `test-150-brain-egress.cjs:12`) are reconciled | unit | `node tests/test-239-sendpacket-parked.cjs` | ❌ W0 | ⬜ pending |
| 239-04-01 | 04 | 3 | BRAIN-01 | T1 | SC1 liveness gate is load-bearing: wired into a real blocking gate (`verify-release`, mirroring Phase 238-06's `checkMintRatifierLiveness` precedent), not only a phase-local test | integration | `scripts/verify-release` (new section) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-239.sh` — SKIP-safe aggregator on the `tests/run-all-196.sh` `run_if`-guarded-on-runtime-module pattern
- [ ] `tests/test-239-brain-tool-liveness.cjs` — BRAIN-01: handshake, matcher liveness, both mutations (rename live tool, stale matcher)
- [ ] `tests/test-239-query-egress-canary.cjs` — BRAIN-02: both canary doors (opportunity field, Blue Hat note), capture-server assertion, mutation leg, both regression legs (template laundering, sanitize ordering)
- [ ] `tests/test-239-pii-sanitizer-liveness.cjs` — the PostToolUse half of BRAIN-01
- [ ] `tests/test-239-sendpacket-parked.cjs` — BRAIN-03 census + park-note assertion
- [ ] Shared helper: a local SSE-shaped capture server bound to `MINDRIAN_BRAIN_URL`, matching the SSE `data: ` line shape `callTool` expects to parse — no such helper exists in `tests/` today
- [ ] No test framework install needed (plain Node.js `assert` convention, already present)

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification. The `sendPacket` "park" decision (BRAIN-03) is itself a written, navigator-equivalent decision recorded in the plan and in the code/docs dated note, not a manual test, per the ROADMAP's own framing ("BRAIN-03 is a decision, not a bug fix").*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new test files + 1 shared capture-server helper + 1 aggregator)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
