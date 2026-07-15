---
phase: 224
slug: graph-derivation-harness-seed-034
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 224 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node zero-deps test scripts (repo convention: `tests/test-<phase>-*.cjs`, aggregated by `tests/run-all-<phase>.sh`) |
| **Config file** | none — repo pattern needs no config; new tests register in `lib/memory/run-feynman-tests.cjs` |
| **Quick run command** | `node tests/test-224-<module>.cjs` (single-file, per-task) |
| **Full suite command** | `bash tests/run-all-224.sh` |
| **Estimated runtime** | ~30 seconds (fixture rooms are tmpdir SQLite, no network) |

---

## Sampling Rate

- **After every task commit:** Run the task's own `node tests/test-224-*.cjs` leg
- **After every plan wave:** Run `bash tests/run-all-224.sh`
- **Before `/gsd-verify-work`:** Full suite green PLUS no-regression legs: `bash tests/run-all-222.sh`, `node tests/test-218-write-safety.cjs` (shared room.db write path)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs are finalized by the planner; the requirement rows below are fixed by 224-SPEC.md.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | Req 1 (derive on write) | — | related-pair fixture yields ≥1 typed edge; unrelated-pair fixture yields 0 | integration | `node tests/test-224-derive-on-write.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Req 2 (backfill 0→N, idempotent) | — | b2-journey-shaped fixture 0→N; second run edge count unchanged | integration | `node tests/test-224-backfill-idempotent.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Req 3 (resolver fallback) | — | no-sentinel fixture resolves identically to resolveWriteRoom() | unit | `node tests/test-224-resolver-fallback.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Req 4 (proposed-only, edge review_status — OQ-1 navigator ruling 2026-07-15) | — | every derived edge row carries review_status='proposed'; confirm path requires byUser | unit | `node tests/test-224-proposed-only.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Req 5 (Part 8 zero egress) | T-egress | grep gate: no fetch/https/child_process-network in new modules | static | grep leg inside `run-all-224.sh` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Req 6 (O(n) scorer calls) | — | N existing + 1 new write triggers exactly N scoreMeasured calls (injection-counted) | unit | `node tests/test-224-scorer-call-count.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Req 7 (structural gates) | — | build-connector-registry --check, check-shape-declaration, doctor --acceptance all exit 0 | gate | legs inside `run-all-224.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-224-derive-on-write.cjs` — fixture-room helper + related/unrelated pair stubs (Req 1)
- [ ] `tests/test-224-backfill-idempotent.cjs` — b2-journey-shaped fixture builder (Req 2)
- [ ] Migration test leg for the edges review_status column (OQ-1 ruling: literal SPEC wording, phase-222 migration pattern) — double-run idempotency proof
- [ ] `tests/run-all-224.sh` — aggregate harness scaffold (copy run-all-222.sh shape)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live-room backfill sanity | Req 2 | Real room content quality can't be fixture-proven | Run `/mos:graph --derive` against a real room (b2-journey or a copy); eyeball that proposed CONVERGES/INFORMS edges are plausible, not noise |
| Foreground latency feel | Req 1 / D-02 | Wall-clock under real hook contention | Write a room artifact in a live session; confirm no perceptible post-write stall (<300ms target) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
