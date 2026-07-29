---
phase: 236
slug: room-db-data-loss-fixes
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 236 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node.js scripts (`node:assert` + process exit codes), the repo convention, no jest/vitest/pytest |
| **Config file** | none: Wave 0 has no framework to install, `node:sqlite` `:memory:` mode is already available |
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

*Filled in from the 4 landed PLAN.md files (236-01 through 236-04) after gsd-plan-checker VERIFICATION PASSED. See 236-RESEARCH.md `<validation_architecture>` for the 7 mandatory mutation-provable tests this phase must ship (GRAPHDB-01 x4, GRAPHDB-02 x2, GRAPHDB-03 x1); an 8th test (`test-236-ecosystem-graph-preserves-journal.cjs`) covers the second unscoped-wipe site 236-01 added mid-collision (`scripts/build-ecosystem-graph.cjs`), taking the phase to 8 mutation-provable tests total.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 236-01 Task 2 | 236-01 | 1 | GRAPHDB-01 | T-236-* | rebuildGraph preserves memory_event/claims/decisions/stage_history | integration | `node tests/test-236-rebuild-preserves-journal.cjs` | not yet created | planned |
| 236-01 Task 4 | 236-01 | 1 | GRAPHDB-01 | T-236-* | build-ecosystem-graph.cjs's second unscoped wipe site preserves the same journal | integration | `node tests/test-236-ecosystem-graph-preserves-journal.cjs` | not yet created | planned |
| 236-02 Task 1 | 236-02 | 2 (depends_on 236-01) | GRAPHDB-01 | T-236-* | runDeriveBackfill default path preserves journal | integration | `node tests/test-236-backfill-default-preserves-journal.cjs` | not yet created | planned |
| 236-02 Task 2 | 236-02 | 2 (depends_on 236-01) | GRAPHDB-01 | T-236-* | crash mid-rebuild leaves original rows intact | integration | `node tests/test-236-rebuild-crash-mid-transaction.cjs` | not yet created | planned |
| 236-02 Task 3 | 236-02 | 2 (depends_on 236-01) | GRAPHDB-01 | T-236-* | concurrent WAL reader never sees partial state | integration | `node tests/test-236-rebuild-wal-concurrent-read.cjs` | not yet created | planned |
| 236-03 Task 2 | 236-03 | 1 | GRAPHDB-02 | T-236-* | busy open produces typed busy result | integration | `node tests/test-236-open-busy-detected.cjs` | not yet created | planned |
| 236-03 Task 3 | 236-03 | 1 | GRAPHDB-02 | T-236-* | broken/mid-migration open produces typed broken result | integration | `node tests/test-236-open-broken-detected.cjs` | not yet created | planned |
| 236-04 Task 2 | 236-04 | 1 | GRAPHDB-03 | T-236-14 | engines floor matches Context7-verified `timeout`-option version (v22.16.0, corrected from an interim v22.13.0 draft during plan-checking) | unit/log | `node tests/test-236-engines-floor.cjs` | not yet created | planned |

*Status: planned (plan-checker passed, execution not yet run) · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements, no new test framework to install.

---

## Manual-Only Verifications

All phase behaviors have automated verification (see 236-RESEARCH.md Validation Architecture: every success criterion has a scriptable, deterministic reproduction).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (gsd-plan-checker VERIFICATION PASSED, Dimension 10)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (gsd-plan-checker confirmed)
- [x] Wave 0 covers all MISSING references (no dedicated Wave 0 needed: existing infra covers all 3 requirements per "Wave 0 Requirements" above)
- [x] No watch-mode flags (gsd-plan-checker confirmed)
- [x] Feedback latency < 10s (see Test Infrastructure table: ~10s estimated full-suite runtime)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution (plan-checker verification passed; navigator/phase-close approval happens after `/gsd-execute-phase 236` runs, not at plan time)
