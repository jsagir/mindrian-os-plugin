---
phase: 236
slug: room-db-data-loss-fixes
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
revised: 2026-07-29
---

# Phase 236 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node.js scripts (`node:assert` + process exit codes), repo convention, no jest/vitest/pytest |
| **Config file** | none. Wave 0 has no framework to install, `node:sqlite` `:memory:` mode is already available |
| **Quick run command** | `node tests/test-236-<description>.cjs` |
| **Full suite command** | `bash tests/run-all-236.sh` |
| **Estimated runtime** | ~30 to 45 seconds. Six of the eight files are synchronous, local, and finish in about a second each. Two are not: `test-236-open-busy-detected.cjs` deliberately waits out the `timeout: 5000` busy window at `room-db.cjs:117-118` (roughly 5s per contended-open scenario), and `test-236-rebuild-wal-concurrent-read.cjs` seeds several hundred artifacts to widen the rebuild window enough to sample it. No network, no LLM calls |

---

## Sampling Rate

- **After every task commit:** Run the specific `test-236-*.cjs` file(s) the task's acceptance criteria reference
- **After every plan wave:** Run `bash tests/run-all-236.sh`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds for six of the eight files. The two contention tests (`test-236-open-busy-detected.cjs`, `test-236-rebuild-wal-concurrent-read.cjs`) are slower BY DESIGN: their whole point is to hold a real lock and to sample a real rebuild window, and shortening them would make them decorative

---

## Per-Task Verification Map

*Populated by the planner from the four plans' actual task lists. 236-RESEARCH.md's
`<validation_architecture>` names SEVEN mandatory mutation-provable tests (GRAPHDB-01 x4,
GRAPHDB-02 x2, GRAPHDB-03 x1). The count is now EIGHT: adversarial verification found a second
unscoped whole-table wipe at `scripts/build-ecosystem-graph.cjs:146`, byte-identical to the
`lazygraph-ops.cjs` one, and 236-01-PLAN.md Task 4 closes it with its own survival test. That
eighth test post-dates 236-RESEARCH.md and is authoritative over it.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 2 (written RED) / Task 3 (fixed GREEN) | 236-01 | 1 | GRAPHDB-01 | T-236-01, T-236-03 | rebuildGraph preserves memory_event/claims/decisions/stage_history | integration | `node tests/test-236-rebuild-preserves-journal.cjs` | ❌ W0 | ⬜ pending |
| Task 4 (RED then GREEN in one task) | 236-01 | 1 | GRAPHDB-01 | T-236-16, T-236-17 | build-ecosystem-graph.cjs, the SECOND unscoped wipe, preserves the same populations, spares non-artifact cascade edges, and is atomic | integration | `node tests/test-236-ecosystem-graph-preserves-journal.cjs` | ❌ W0 | ⬜ pending |
| Task 1 | 236-02 | 2 | GRAPHDB-01 | T-236-06 | runDeriveBackfill default path preserves journal | integration | `node tests/test-236-backfill-default-preserves-journal.cjs` | ❌ W0 | ⬜ pending |
| Task 2 | 236-02 | 2 | GRAPHDB-01 | T-236-03 | crash mid-rebuild leaves original rows intact | integration | `node tests/test-236-rebuild-crash-mid-transaction.cjs` | ❌ W0 | ⬜ pending |
| Task 3 | 236-02 | 2 | GRAPHDB-01 | T-236-04, T-236-05 | concurrent WAL reader never sees partial state | integration | `node tests/test-236-rebuild-wal-concurrent-read.cjs` | ❌ W0 | ⬜ pending |
| Task 1 (probe + header record) / Task 2 (classifier) / Task 3 (gate completed) | 236-03 | 1 | GRAPHDB-02 | T-236-08, T-236-09 | busy open produces typed busy result | integration | `node tests/test-236-open-busy-detected.cjs` | ❌ W0 | ⬜ pending |
| Task 1 (probe + header record) / Task 2 (classifier) / Task 3 (file created, gate completed) | 236-03 | 1 | GRAPHDB-02 | T-236-08, T-236-10 | broken/mid-migration open produces typed broken result | integration | `node tests/test-236-open-broken-detected.cjs` | ❌ W0 | ⬜ pending |
| Task 2 | 236-04 | 1 | GRAPHDB-03 | T-236-14, T-236-18 | engines floor matches the Context7-verified version at which the `timeout` constructor option actually takes effect (>=22.16.0, nodejs/node PR 57752), NOT the version where the module merely stopped needing a flag (22.13.0) | unit/log | `node tests/test-236-engines-floor.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Reading the Task ID column.** Three rows name more than one task because the test file and the
code it gates land in different tasks by design:

- `test-236-rebuild-preserves-journal.cjs` is authored in 236-01 Task 2 and MUST be observed RED
  against the unmodified `lazygraph-ops.cjs` before 236-01 Task 3 writes the fix. A green result at
  Task 2 is a stop-and-report condition, not a pass.
- Both GRAPHDB-02 files begin in 236-03 Task 1 as a behavioral PROBE with TODO stubs, because the
  real thrown-error shapes are unknown (236-RESEARCH.md Open Question 1, LOW confidence) and must
  be observed before any classifier is written against them. Task 2 writes the classifier from that
  record. Task 3 replaces the stubs with the real assertions.

**Two production files carry no test row of their own, by design.** 236-03 Task 2 narrows the
swallow-to-null catch at BOTH `lib/core/graph-derivation.cjs:254-257` and
`lib/core/graph-refine-loop.cjs:112`. Neither has a dedicated test file; both are covered by the
mutation clause in the two GRAPHDB-02 gates, which requires reinstating `catch (_e) { db = null; }`
at EACH site independently and observing red. A mutation applied to only one site must still turn a
gate red, which is what stops the two narrowings drifting apart.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework to install.

---

## Manual-Only Verifications

All phase behaviors have automated verification (see 236-RESEARCH.md Validation Architecture: every
success criterion has a scriptable, deterministic reproduction).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s for six of eight files; the two contention tests are slower by design and the reason is recorded above
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
