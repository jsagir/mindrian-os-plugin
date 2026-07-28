---
phase: 236
slug: room-db-data-loss-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 236 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node.js scripts (`node:assert` + process exit codes) — repo convention, no jest/vitest/pytest |
| **Config file** | none — Wave 0 has no framework to install, `node:sqlite` `:memory:` mode is already available |
| **Quick run command** | `node tests/test-236-<description>.cjs` |
| **Full suite command** | `bash tests/run-all-236.sh` |
| **Estimated runtime** | ~10 seconds (synchronous, local, no network/LLM calls) |

---

## Sampling Rate

- **After every task commit:** Run the specific `test-236-*.cjs` file(s) the task's acceptance criteria reference
- **After every plan wave:** Run `bash tests/run-all-236.sh`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

*Populated by the planner from 236-RESEARCH.md's Validation Architecture table once tasks are assigned IDs. See 236-RESEARCH.md `<validation_architecture>` for the 7 mandatory mutation-provable tests this phase must ship (GRAPHDB-01 x4, GRAPHDB-02 x2, GRAPHDB-03 x1).*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | GRAPHDB-01 | — | rebuildGraph preserves memory_event/claims/decisions/stage_history | integration | `node tests/test-236-rebuild-preserves-journal.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GRAPHDB-01 | — | runDeriveBackfill default path preserves journal | integration | `node tests/test-236-backfill-default-preserves-journal.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GRAPHDB-01 | — | crash mid-rebuild leaves original rows intact | integration | `node tests/test-236-rebuild-crash-mid-transaction.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GRAPHDB-01 | — | concurrent WAL reader never sees partial state | integration | `node tests/test-236-rebuild-wal-concurrent-read.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GRAPHDB-02 | — | busy open produces typed busy result | integration | `node tests/test-236-open-busy-detected.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GRAPHDB-02 | — | broken/mid-migration open produces typed broken result | integration | `node tests/test-236-open-broken-detected.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GRAPHDB-03 | — | engines floor matches Context7-verified unflagged version | unit/log | `node tests/test-236-engines-floor.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test framework to install.

---

## Manual-Only Verifications

All phase behaviors have automated verification (see 236-RESEARCH.md Validation Architecture — every success criterion has a scriptable, deterministic reproduction).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
