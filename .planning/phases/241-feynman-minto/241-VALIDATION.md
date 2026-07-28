---
phase: 241
slug: feynman-minto
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
---

# Phase 241 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Custom CJS test runner (no Jest/Mocha/Vitest) — `lib/memory/run-feynman-tests.cjs`, discovers and runs an explicit `TEST_FILES` array via `node:child_process.spawnSync` per file |
| **Config file** | none (the `TEST_FILES` array in `lib/memory/run-feynman-tests.cjs` itself is the config) |
| **Quick run command** | `node lib/memory/feynman-minto-guardian.test.cjs` (fastest signal for guardian-side changes) |
| **Full suite command** | `node lib/memory/run-feynman-tests.cjs` (full Feynman-MINTO pipeline suite: debouncer + invariants + guardian + post-write-triple) |
| **Estimated runtime** | ~30 seconds (custom CJS test runner over 4-5 files, no framework startup cost) |

---

## Sampling Rate

- **After every task commit:** Run `node lib/memory/feynman-minto-guardian.test.cjs` (or `node lib/memory/minto-debouncer.test.cjs` for F-0 debouncer-side edits)
- **After every plan wave:** Run `node lib/memory/run-feynman-tests.cjs` (full suite)
- **Before `/gsd-verify-work`:** Full suite green, plus the mutation-proof runs the ROADMAP rigor standard requires (disabling each fix must turn its named test red) for all three success criteria
- **Max feedback latency:** ~30 seconds (full suite runtime; no watch-mode, no long-running framework boot)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 241-01 | 01 | 1 | MINTO-01 (F-1, findings reach user + slow-write survives) | see 241-01-PLAN.md threat_model | `scripts/on-stop` folds the guardian systemMessage into its final Stop-hook JSON; `runOnStop` gets a soft walk budget so report-write + ghost-prune always complete | integration | `node lib/memory/guardian-onstop-reaches-user.test.cjs` | ✅ (plan committed) | ⬜ pending execution |
| 241-02 | 02 | 2 (deps: 01) | MINTO-01 (F-0, corrected scope: retire unconditional vacuum, RCA corrected) | see 241-02-PLAN.md threat_model | Both stop-path drains (`scripts/on-stop`, `lib/mcp/stop-gate-handler.cjs`) peek instead of unconditionally draining; production call-site census (bash + cjs, excludes `tests/`) proves the real Phase 88-05 consumer in `scripts/intent-classifier` (bash wrapper) drains-and-acts | integration + structural census | `node lib/memory/minto-debounce-consumer-census.test.cjs` | ✅ (plan committed) | ⬜ pending execution |
| 241-03 | 03 | 2 (deps: 01) | MINTO-02 (F-2, severity ladder) | see 241-03-PLAN.md threat_model | Missing MINTO.md and missing governing_thought both raised to `critical`, reaching the enqueue gate; pre-existing suites reconciled | unit | `node lib/memory/feynman-minto-invariants.test.cjs` + `node lib/memory/feynman-minto-guardian.test.cjs` | ✅ (plan committed) | ⬜ pending execution |
| 241-04 | 04 | 3 (deps: 02, 03) | MINTO-02 (F-3, pre-commit demotion) | see 241-04-PLAN.md threat_model | `runPreCommit` demoted to advisory WARN by default, `--strict`/`MINTO_PRECOMMIT_STRICT` opt-in restores hard-fail; proven by a REAL `git commit` in a scratch repo, both directions | integration (real git commit) | `node lib/memory/precommit-real-commit.test.cjs` | ✅ (plan committed) | ⬜ pending execution |
| 241-05 | 05 | 4 (deps: 01-04) | MINTO-01, MINTO-02 (Tri-Polar parity + phase harness) | see 241-05-PLAN.md threat_model | Shared `stop-gate-handler.cjs` path (Desktop/Cowork/CLI-under-MINDRIAN_MCP_FIRST) now also invokes the guardian; one phase harness rolls up every leg | integration | `bash tests/run-all-241.sh` | ✅ (plan committed) | ⬜ pending execution |

*Status: ⬜ pending execution · ✅ green · ❌ red · ⚠️ flaky*

*Plan-checker VERIFICATION PASSED 2026-07-28 (first pass, no revision loop needed). Table above reflects the actual planner-assigned plan/task structure (5 plans, 4 waves, 14 tasks) superseding the provisional per-finding placeholder rows drafted before planning. Execution (`/gsd-execute-phase 241`) will flip each row's Status from "pending execution" to green/red as `tests/run-all-241.sh` and the individual test files actually run.*

---

## Wave 0 Requirements

- [ ] New integration test driving `scripts/on-stop` as a real subprocess and asserting on its actual final stdout JSON (MINTO-01/F-1, "reaches the user" half)
- [ ] New integration test with an injectable slow-write path proving the timeout can no longer silently drop a report-write/ghost-prune (MINTO-01/F-1, second half)
- [ ] New/extended test per the RCA's own Test 1/Test 2 spec: a production-call-site census (excluding `tests/`) proving a real consumer both enqueues and drains-and-acts (MINTO-01/F-0 fold-in)
- [ ] New integration test running a REAL `git commit` against a scratch repo/worktree with a seeded breach, asserting exit 0 + WARN text (MINTO-02/F-3 — SC3 explicitly requires "a real commit run")
- [ ] Framework install: none needed — the existing custom CJS runner (`lib/memory/run-feynman-tests.cjs`) already exists and is the correct registration point for all of the above

---

## Manual-Only Verifications

*None — all four findings (F-0/F-1/F-2/F-3) have an automatable verification path per RESEARCH.md's Validation Architecture section (real subprocess runs, real git commits, and structural call-site censuses are all scriptable; no behavior in this phase requires a human-only check).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 new integration tests + 1 extended unit-test pair, enumerated above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-28 (plan-checker VERIFICATION PASSED; sign-off pending only actual test-run greens at execute-time)
