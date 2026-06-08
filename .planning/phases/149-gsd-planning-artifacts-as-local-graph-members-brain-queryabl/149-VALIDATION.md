---
phase: 149
slug: gsd-planning-artifacts-as-local-graph-members
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-08
---

# Phase 149 — Validation Strategy

> Per-phase validation contract. Authored from 149-SPEC.md acceptance criteria (research skipped - the CONTEXT maps the Phase 124 analog end-to-end). Every GAM requirement maps to a falsifiable `node tests/test-149-*.cjs` verify.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node CJS asserts + bash runner (the shipped `tests/run-all-<phase>.sh` + `test-*.cjs` pattern; clone the Phase 124 `tests/run-all-124.sh` + the adversarial Part-9 invariant test) |
| **Config file** | none - bash + node, no test framework install |
| **Quick run command** | `node tests/test-149-<unit>.cjs` |
| **Full suite command** | `bash tests/run-all-149.sh` |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `node tests/test-149-<unit>.cjs`
- **After every plan wave:** Run `bash tests/run-all-149.sh`
- **Before `/gsd-verify-work`:** Full suite green AND `check-brain-boundary` green
- **Max feedback latency:** ~120 seconds

---

## Per-Requirement Verification Map

| Requirement | Correct Behavior | Test Type | Automated Command | Status |
|-------------|------------------|-----------|-------------------|--------|
| GAM-01 | each GSD artifact = a `planning_artifact` node via navigation.cjs; grep-audit: no direct room.db open in the writer | unit + grep | `node tests/test-149-artifact-nodes.cjs` | pending |
| GAM-02 | requirement ids exist as nodes; "which artifacts touch IRW-06" returns SPEC + owning plan | unit | `node tests/test-149-requirement-nodes.cjs` | pending |
| GAM-03 | lineage edges exist (FEEDS_INTO chain + VALIDATES); requirement traces SPEC->CONTEXT->PLAN->VERIFICATION via navigation.cjs; no bespoke edge type | unit | `node tests/test-149-lineage-edges.cjs` | pending |
| GAM-04 | writer hook upserts idempotently; writing the same artifact twice yields exactly one node + one edge set | unit | `node tests/test-149-idempotent-upsert.cjs` | pending |
| GAM-05 | `planning_artifact` nodes returned by a /mos:graph-style read; nodes live in the active room's room.db | unit | `node tests/test-149-navigable.cjs` | pending |
| GAM-06 | Brain-query path = typed packet only; `check-brain-boundary` passes; adversarial: zero artifact prose reaches any Brain packet | unit + grep | `node tests/test-149-brain-egress.cjs` (+ check-brain-boundary in run-all-149.sh) | pending |
| GAM-07 | backfill ingests a fixture `.planning/` tree; second run leaves node/edge count unchanged (idempotent) | integration | `node tests/test-149-backfill.cjs` | pending |
| Part-9 invariant | the reconcile + writer read/write ONLY via navigation.cjs (zero non-SQLite fs reads of room data); mirrors the Phase 124 adversarial invariant test | regression | `node tests/test-149-navigation-only-invariant.cjs` | pending |

*Status: pending - green - red - flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-149.sh` - the aggregator (clone `run-all-124.sh`: CJS asserts + the Part-9 invariant + `check-brain-boundary` grep sweep)
- [ ] Per-GAM `test-149-*.cjs` suites, created in their owning plan's wave
- [ ] A fixture `.planning/` tree for the backfill + idempotence tests

*Existing infrastructure (node + bash) covers the framework; no install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /mos:graph visually shows the planning artifacts in the active room | GAM-05 | graph render is host-driven | Open /mos:graph in the mindrianOS room; confirm planning_artifact nodes + lineage edges appear |

*All machine behaviors have automated verification; only the visual graph render is manual.*

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers `run-all-149.sh` + the Part-9 invariant + check-brain-boundary
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** authored-by-orchestrator (research skipped; Phase 124 analog)
