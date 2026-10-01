---
phase: 366
slug: eureka-perspective-in-research-planner-mcp-canvas-tooling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-01
---

# Phase 366 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from the
> "## Validation Architecture" section of 366-RESEARCH.md; the planner fills the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node test files (`tests/test-*.cjs`, PASS/FAIL counters, exit 77 = ENV GAP) run by a per-phase bash aggregator; no jest / vitest |
| **Config file** | none; `tests/helpers/hygiene-355.cjs` (key scrub, net guard, checker) is the shared preamble |
| **Quick run command** | `node tests/test-seed103-eureka-perspective.cjs` (node >= 22; on the WSL dev machine: `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` first) |
| **Full suite command** | `bash tests/run-all-seed103.sh && bash tests/run-all-366.sh` (run-all-366.sh is written once in Wave 0) |
| **Estimated runtime** | ~90 seconds for run-all-seed103.sh (20 legs); run-all-366.sh measured at Wave 0 |

Node >= 22.16 with `node:sqlite` is mandatory; `/usr/bin/node` on the WSL machine is v20 and must never run a test or a hook.

---

## Sampling Rate

- **After every task commit:** Run the quick run command plus the test file the task names
- **After every plan wave:** Run the full suite command, then `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-shape-declaration.cjs --check`, `node scripts/build-skill-mirrors.cjs --check`
- **Before `/gsd:verify-work`:** Full suite must be green; the pins (`test-270-tool-schema-budget`, `test-234-tool-description-floor`, `test-205-surface-fence`, `test-353-tripwires`, `test-363-*`) must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by the planner from EPV366-01..28 in 366-RESEARCH.md) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-366.sh` - the phase aggregator, written once, run / run_if legs per planned test file
- [ ] `tests/test-366-*.cjs` - one hermetic file per plan, each with the hygiene-355 preamble and an isolated `MINDRIAN_ROOMS_HOME` set before any repo module loads
- [ ] fixture-room copies of `tests/fixtures/355-rooms/` with `room.db` built and entity extraction run (the spike's substrate; the research found Eureka was `substrate_unavailable` on the bare fixtures)
- [ ] existing infrastructure covers model routing (`test-seed103-claude-routing.cjs`) and the eureka perspective (`test-seed103-eureka-perspective.cjs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blind gold labeling of the spike candidate files | the spike (D-05) | The navigator is the labeler by ruling | `node scripts/label-355-gold.cjs start` on each arm's candidate file, one sitting per arm, seeded shuffle; the record is computed by `measure-355-hit-rate.cjs --check` |
| The gated per-term Theo release | D-13 | An F.8 card needs a human yes | Trigger a miss, answer the card, confirm the audit ledger row and the proposed translation entry |
| Live Theo `normalize_framework_name` round trip | D-13 (c) | Network, vendor | One run with `MOS_366_LIVE=1`, recorded and replayed offline afterwards |
