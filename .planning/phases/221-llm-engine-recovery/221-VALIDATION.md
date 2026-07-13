---
phase: 221
slug: llm-engine-recovery
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
planned: 2026-07-13
---

# Phase 221 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 221-SPEC.md acceptance criteria + 221-INPUT-MANUS-RECOVERY.md section 9 (the validation matrix - source of truth for the req->test map).
> Per-task map filled by the planner 2026-07-13 (5 plans, 5 waves).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in assertions + bash harness (no jest/mocha); `tests/test-221-*.cjs` + `tests/run-all-221.sh` |
| **Config file** | none - each test is a standalone `node tests/test-221-*.cjs` returning exit 0/1 |
| **Quick run command** | `node tests/test-221-<slice>.cjs` |
| **Full suite command** | `bash tests/run-all-221.sh` then `node scripts/doctor.cjs --acceptance` |
| **Estimated runtime** | ~30-90 seconds (suite); doctor acceptance ~60s |

---

## Sampling Rate

- **After every task commit:** Run the slice test for the surface touched: `node tests/test-221-<slice>.cjs`
- **After every plan wave:** Run `bash tests/run-all-221.sh` + `node scripts/build-connector-registry.cjs --check`
- **Before `/gsd-verify-work`:** Full suite green + regressions (run-all-211/215/216/219/220) + `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** ~90 seconds (offline suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 221-01-T1 | 221-01 | 1 | REQ-1 envelope contract + injection harness + phase aggregator | T-221-03 harness leak | forced seam requires explicit env/opts, latched once, silent; validator enforces status/failure_class rules deterministically | unit + gate | `node tests/test-221-envelopes.cjs`; `bash tests/run-all-221.sh` | ❌ W0 (created by 221-01-T1, RED-first) | ⬜ pending |
| 221-01-T2 | 221-01 | 1 | REQ-1 research-corpus five collapse sites | T-221-01 empty-collapse; T-221-02 egress soften | typed envelopes replace bare-[]; audit chokepoint byte-untouched (throws pre-dispatch); fetchCorpus legacy contract preserved | unit + grep | `node tests/test-221-envelopes.cjs` | ❌ W0 (extends the same file) | ⬜ pending |
| 221-01-T3 | 221-01 | 1 | REQ-1 driver seam (extends 219-05, verify-landed HARD gate) | T-221-04 caller breakage; T-221-05 cache-as-live | additive per-provider envelopes; research_mode never renamed; cache provenance explicit | unit | `node tests/test-221-envelopes.cjs && bash tests/run-all-221.sh` | ❌ W0 (extends the same file) | ⬜ pending |
| 221-02-T1 | 221-02 | 2 | REQ-2 dispatcher + tier ladder + trigger discipline | T-221-06 cost DoS; T-221-07 write replay; T-221-08 substitute spoof; T-221-09 egress reroute; T-221-10 fabricated recovery | bounded retry consts; IDEMPOTENT_STAGES structural; exact substitute provenance; egress terminal; empty_valid never recovers; cadence skips Tier-3 | unit + grep | `node tests/test-221-dispatcher.cjs` | ❌ W0 (created by 221-02-T1, RED-first) | ⬜ pending |
| 221-02-T2 | 221-02 | 2 | REQ-2 source-lens wiring + acceptance matrix rows | T-221-11 exhaustion-as-success | reroute without infinite retry; honest empty; partial_recovery with explicit unresolved[]; no-failure byte-behavior | unit | `node tests/test-221-dispatcher.cjs && bash tests/run-all-221.sh` | ❌ W0 (extends the same file) | ⬜ pending |
| 221-03-T1 | 221-03 | 3 | REQ-3 atomic case file + schema validators | T-221-18 torn state | tmp+rename atomic; CASE_ARTIFACTS allowlist; path containment; write-ordering invariants (plan-before-execute, claims-before-synthesis) | unit | `node tests/test-221-controller.cjs` | ❌ W0 (created by 221-03-T1, RED-first) | ⬜ pending |
| 221-03-T2 | 221-03 | 3 | REQ-3 7-step controller + profiles + budgets + gated entry | T-221-17 unbounded spend; T-221-18 forensic mutation | pipeline-state journal reused (isNext resume, no re-run); forensic zero-mutation; budgets + early termination; D-20-semantics gated entry; model+version recorded, governance model-independent | unit | `node tests/test-221-controller.cjs` | ❌ W0 (extends the same file) | ⬜ pending |
| 221-03-T3 | 221-03 | 3 | REQ-3 five hard fences (D-06) | T-221-12 egress weaken; T-221-13 unknown->zero; T-221-14 writer bypass; T-221-15 filed-without-readback; T-221-16 injection | each fence an adversarial TEST: policy_blocked terminal; unknown preserved; readback-truth via file-evidence-readback only; injection byte-verbatim data; forced high_effort case file schema-valid | adversarial + grep | `node tests/test-221-controller-fences.cjs && bash tests/run-all-221.sh` | ❌ W0 (created by 221-03-T3) | ⬜ pending |
| 221-04-T1 | 221-04 | 4 | REQ-4 semantics composer + additive seam alignment (verify-landed 219-05/220-02 HARD gates) | T-221-19 false 'recovered'; T-221-20 recovery spoof; T-221-23 seam breakage | recovered ONLY on contracts+readback; llm_engine_recovery disclosed; 219/220 fields unrenamed | unit | `node tests/test-221-matrix.cjs` | ❌ W0 (created by 221-04-T1, RED-first) | ⬜ pending |
| 221-04-T2 | 221-04 | 4 | REQ-4 docs + regenerated mirror + doc-parity | T-221-22 doc drift | mirror generated never hand-edited; 11 tokens parity-grepped both surfaces; 'paid -> native' pinned 0 | gate | `node scripts/build-skill-mirrors.cjs --check && node tests/test-221-matrix.cjs` | ✅ existing (commands/research.md) | ⬜ pending |
| 221-04-T3 | 221-04 | 4 | REQ-5 13-class matrix + permanent vantage fixture | T-221-21 project-nonexistence claim | all 13 annex-9 classes named legs; vantage its own permanent file; regressions green | unit + gate | `node tests/test-221-matrix.cjs && node tests/test-221-vantage.cjs && bash tests/run-all-221.sh && node scripts/doctor.cjs --acceptance` | ❌ W0 (vantage created by 221-04-T3) | ⬜ pending |
| 221-05-T1..T3 | 221-05 | 5 | REQ-6 THE JOINT CUT (autonomous: false) | T-221-25 hand-bump; T-221-26 gate skip; T-221-27 wrong website repo; T-221-28 stale versions | preconditions BLOCK on missing corepower/staging; blocking navigator checkpoint before release.sh; five gates via the script only; VERSION-BUMP fact-check recorded | release + human gate | `scripts/verify-release; git diff --exit-code package.json .claude-plugin/plugin.json (pre-cut); node scripts/doctor.cjs --acceptance` | ✅ existing | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-221.sh` - phase harness (clone run-all-218.sh: file-gated legs, zero-network preload, 211/215/216/219/220 regression legs) - **221-01-T1**
- [ ] `tests/test-221-envelopes.cjs` - REQ-1 envelope contract + injection determinism + five collapse-site conversions + driver seam - **221-01-T1 (RED-first; extended T2/T3)**
- [ ] `tests/test-221-dispatcher.cjs` - REQ-2 tier ladder + trigger discipline + acceptance matrix rows - **221-02-T1 (RED-first; extended T2)**
- [ ] `tests/test-221-controller.cjs` - REQ-3 case file + state machine + profiles + budgets - **221-03-T1 (RED-first; extended T2)**
- [ ] `tests/test-221-controller-fences.cjs` - the five D-06 hard fences + case-file proof + forensic zero-mutation - **221-03-T3**
- [ ] `tests/test-221-matrix.cjs` - REQ-4 semantics + doc-parity + the REQ-5 matrix classes 1-12 - **221-04-T1 (RED-first; extended T2/T3)**
- [ ] `tests/test-221-vantage.cjs` - the PERMANENT authoritative_workspace_unavailable fixture (annex 10) - **221-04-T3**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Navigator cut approval: version + CHANGELOG/README diffs + website capability copy reviewed BEFORE scripts/release.sh runs | REQ-6 / D-10 | The version cut is irreversible (npm publish + tag + marketplace pin + live site); the navigator pre-approved the RUN, not the unreviewed diffs | Plan 221-05 Task 2 (blocking checkpoint); approval recorded in 221-VERIFICATION.md |
| Corepower-isolation Desktop validation (consumed precondition, 219-owned) | REQ-6 gate | Navigator-run on the Windows machine; recorded in 219-VERIFICATION.md by 219-07 - Plan 221-05 Task 1 BLOCKS if the recorded confirmation is absent | Consumed, not re-run: the precondition gate quotes the recorded confirmation verbatim |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (the Plan 05 checkpoint is bracketed by the Task 1 gate sweep and the Task 3 post-cut verification)
- [x] Wave 0 covers all MISSING references (every test file has an owning task; RED-first where tdd applies)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-filled 2026-07-13; execution flips row statuses
