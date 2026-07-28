---
phase: 242
slug: the-moat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 242 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` (per `tests/test-sqlite-*.cjs` convention) plus plain-script exit-code tests. No third-party framework (no Jest/Mocha). |
| **Config file** | none — `node:test` needs no config; run directly via `node tests/test-*.cjs` or `bash tests/run-all-242.sh` |
| **Quick run command** | `node tests/test-hsi-to-graph-transaction.cjs` or `node tests/test-kuzu-reintroduction-gate.cjs` |
| **Full suite command** | `bash tests/run-all-242.sh` |
| **Estimated runtime** | ~15-30 seconds (includes a real fork()'d concurrent-reader + a real spawn()/SIGKILL crash-injection run) |

---

## Sampling Rate

- **After every task commit:** Run the test file the task's plan targets (`node tests/test-hsi-to-graph-transaction.cjs` or `node tests/test-kuzu-reintroduction-gate.cjs`)
- **After every plan wave:** Run `bash tests/run-all-242.sh`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 242-01-01 | 01 | 1 | MOAT-01 | T-242-01 | Crash mid HSI-to-graph rewrite never zeros the prior scoring layer | integration (real spawn+SIGKILL) | `node tests/test-hsi-to-graph-transaction.cjs` | ❌ W0 | ⬜ pending |
| 242-01-02 | 01 | 1 | MOAT-01 | T-242-01 | Concurrent reader mid-rewrite never observes an empty edge set | integration (real fork(), extends SQLITE-03) | `node tests/test-hsi-to-graph-transaction.cjs` | ❌ W0 | ⬜ pending |
| 242-01-03 | 01 | 1 | MOAT-01 | T-242-01 | Removing the transaction wrap turns the gate red (mutation-proof) | integration | same file, mutation-proof assertion | ❌ W0 | ⬜ pending |
| 242-02-01 | 02 | 1 | MOAT-02 | — | Seeding one live kuzu reference fails the gate; current tree passes | unit (script exit-code) | `node tests/test-kuzu-reintroduction-gate.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-hsi-to-graph-transaction.cjs` — crash-injection (spawn+SIGKILL) + concurrent-reader (fork) + mutation-proof coverage for MOAT-01
- [ ] `tests/test-kuzu-reintroduction-gate.cjs` — seed-and-fail + current-tree-passes coverage for MOAT-02
- [ ] `tests/run-all-242.sh` — phase aggregator, glob-discovery shape copied from `tests/run-all-233.sh`
- [ ] `scripts/check-kuzu-reintroduction.cjs` — the production script the MOAT-02 test exercises (build artifact, not itself a test)
- [ ] Framework install: none needed — `node:test` is a Node builtin already used throughout `tests/`

---

## Manual-Only Verifications

*None. All phase behaviors have automated verification (per RESEARCH.md: real spawn/SIGKILL crash injection, real fork() concurrent reader, and script exit-code assertions are all scriptable without human interaction).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
