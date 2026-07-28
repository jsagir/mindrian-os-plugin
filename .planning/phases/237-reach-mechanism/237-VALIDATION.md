---
phase: 237
slug: reach-mechanism
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-28
---

# Phase 237 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `237-RESEARCH.md`'s "Validation Architecture" section (research already did this analysis in full; this file restates it in the Nyquist contract shape, no new analysis performed here).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:assert` only — no jest, no vitest, no mocha (confirmed across `tests/*.cjs` and `lib/**/*.test.cjs`) |
| **Config file** | none — each test is a standalone executable `.cjs` that exits 0/1 |
| **Quick run command** | `node tests/test-237-<leg>.cjs` |
| **Full suite command** | `bash tests/run-all-237.sh` |
| **Estimated runtime** | ~30-60 seconds (aggregator pattern cloned from `tests/run-all-198.sh`) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-237-<leg>.cjs` for that task's leg, plus the Phase 235 commit-time born-wired gate (fires automatically in every worktree, no separate invocation needed)
- **After every plan wave:** Run `bash tests/run-all-237.sh`
- **Before `/gsd-verify-work`:** Full suite green, plus `node scripts/doctor.cjs --acceptance` and the existing `--check` gates (`build-connector-registry.cjs --check`, etc.)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 237-01-xx | 01 | 1 | REACH-01 | — | Approving a material step's gate causes the resolved command to run; `<roomDir>/exports/hub.html` exists afterward; a mutation restoring log-only `onStep` turns the gate RED | integration + mutation | `node tests/test-237-approve-executes.cjs` | ❌ W0 | ⬜ pending |
| 237-01-xx | 01 | 1 | REACH-01 | — | A methodology (Tier 2) step returns `quality: null` + `requires_host_dispatch: true`, never a fabricated `quality: 'high'` | unit | `node tests/test-237-dispatcher-tiers.cjs` | ❌ W0 | ⬜ pending |
| 237-01-xx | 01 | 1 | REACH-01 | — | Zero unadapted `decideFn(...)` calls remain in `chain-executor.cjs`; `opts.decideFn` seam (used by `act-command.cjs`) still honored | source-fence + unit | `node tests/test-237-decide-census.cjs` | ❌ W0 | ⬜ pending |
| 237-01-xx | 01 | 1 | REACH-01 | — | `act-command.cjs`'s adapted `decideFn` injection still reaches the real `decide()` (regression) | integration | `node tests/test-act-on-runchain.cjs` (existing) | ✅ exists | ⬜ pending |
| 237-01-xx | 01 | 1 | REACH-01 | — | Every command the dispatcher claims executable names a script that exists on disk (seam-liveness) | unit | `node tests/test-237-executable-seam.cjs` via `lib/core/seam-liveness.cjs` | ❌ W0 | ⬜ pending |
| 237-02-xx | 02 | 1/2 | REACH-02 | — | All registry commands classify identically through `framework_run` and `chain_run`; `/mos:ignite`/`/mos:new-project`/`/mos:pipeline` are MATERIAL after the fix; a mutation re-pointing `chain_run` at connector posture turns the gate RED (~48 disagreements) | integration + mutation | `node tests/test-237-autonomy-parity.cjs` | ❌ W0 | ⬜ pending |
| 237-02-xx | 02 | 1/2 | REACH-02 | — | No second classification path (`connector-registry` + `push_forward` in an autonomy context) anywhere in `lib/mcp/tools/*.cjs` or `lib/core/chain-executor.cjs` | source-fence | `node tests/test-237-one-authority-fence.cjs` | ❌ W0 | ⬜ pending |
| 237-02-xx | 02 | 1/2 | REACH-02 | — | Existing `postureForCommand` assertions retargeted to the command-registry authority | unit | `node tests/test-198-chain-run-halt.test.cjs` (**MODIFY**) | ⚠️ exists, wrong authority | ⬜ pending |
| 237-03-xx | 03 | 3 | REACH-03 | — | Two-process: session A seeds `last-cascade.json`; session B's `dispatchSensors` does NOT surface `artifact_filed`; session B's own fresh marker DOES surface; a mutation removing session scoping turns the leg RED | integration + mutation, `fork` | `node tests/test-237-session-scope.cjs` + `tests/test-237-session-scope.worker.cjs` | ❌ W0 | ⬜ pending |
| 237-03-xx | 03 | 3 | REACH-03 | — | Degrade GREEN: a legacy marker with no `session_id`, or an unknown caller session id, still fires (fail-open, not fail-closed) | unit | `node tests/test-237-session-scope-degrade.cjs` | ❌ W0 | ⬜ pending |
| 237-03-xx | 03 | 3 | REACH-03 | — | `sensorArtifactFiled` (the second reader of the same marker file) is scoped too | unit | same file | ❌ W0 | ⬜ pending |
| 237-03-xx | 03 | 3 | REACH-03 | — | `scripts/post-write` stamps `session_id` from hook stdin onto written markers | integration (bash) | `node tests/test-237-post-write-session-stamp.cjs` | ❌ W0 | ⬜ pending |
| 237-xx-xx | all | all | ALL | Canon Part 8 | Zero Brain/network tokens in every touched file | source-fence | extend `tests/test-198-local-only.test.cjs` + `tests/test-sensors-part8-sweep.cjs` | ✅ exists, extend | ⬜ pending |
| 237-xx-xx | all | all | ALL | — | No em-dashes in any new or modified file | source-fence | em-dash sweep leg in `tests/run-all-237.sh` (pattern from `tests/run-all-164.sh`) | ❌ W0 | ⬜ pending |
| 237-xx-xx | all | all | ALL | — | Born-wired / projection / render gates still green | gate | `node scripts/build-connector-registry.cjs --check` etc. | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Exact Task IDs are assigned by the planner; this table is a coverage map derived from RESEARCH.md, not a task-ID-final list.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-237.sh` — SKIP-safe aggregator, clone `tests/run-all-198.sh`'s `run`/`run_if` helpers so it can be authored before code lands and exits clean with SKIPs
- [ ] `tests/test-237-approve-executes.cjs` — REACH-01 SC1 + mutation harness
- [ ] `tests/test-237-dispatcher-tiers.cjs` — REACH-01 tier-2 honesty (no fabricated `quality: 'high'`)
- [ ] `tests/test-237-decide-census.cjs` — REACH-01 call-site census + `decideFn` seam preservation
- [ ] `tests/test-237-executable-seam.cjs` — REACH-01 seam-liveness consumption via `lib/core/seam-liveness.cjs`
- [ ] `tests/test-237-autonomy-parity.cjs` — REACH-02 SC2 parity walk + mutation
- [ ] `tests/test-237-one-authority-fence.cjs` — REACH-02 source fence
- [ ] `tests/test-237-session-scope.cjs` + `tests/test-237-session-scope.worker.cjs` — REACH-03 SC3 two-process test + mutation
- [ ] `tests/test-237-session-scope-degrade.cjs` — REACH-03 fail-open legs
- [ ] `tests/test-237-post-write-session-stamp.cjs` — REACH-03 writer leg
- [ ] `tests/fixtures/237-seeded-room/` — a seeded room fixture (or `mkdtempSync` builder) with enough content for `generate-hub.cjs` to produce a non-trivial `hub.html`
- [ ] **MODIFY** `tests/test-198-chain-run-halt.test.cjs` — retarget the three `postureForCommand` assertions to the command-registry authority
- [ ] Framework install: none — `node:assert` is built in

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per RESEARCH.md's Validation Architecture. Every SC carries a source-grounded automated leg plus an explicit mutation leg (Canon: "a gate that cannot fail is not a gate").*

---

## Mutation-Proof Requirement

Every success criterion carries an explicit mutation leg, named in the SC wording itself ("a mutation restoring log-only execution turns the gate red", "fails on any disagreement or on reintroduction of a second classification path", "removing the session scoping turns that leg red"). Follow the Phase 241/242 precedent: the mutation must be DEMONSTRATED (run it, capture the RED, revert) — never asserted in prose only. Suggested harness shape (matches 241/242): copy the target module to a temp path, apply a textual mutation, `require()` the mutated copy through a cleared `require.cache`, assert the gate goes red, restore. Never mutate the working tree in place.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌ W0) references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (done above)

**Approval:** pending
