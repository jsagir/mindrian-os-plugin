---
phase: 241
slug: feynman-minto
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 241-01-01 | 01 | 1 | MINTO-01 (F-1, findings reach user) | — | Seeded triple-health violation's systemMessage appears in `scripts/on-stop`'s FINAL stdout JSON | integration | new test invoking `scripts/on-stop` end-to-end, asserting on the process's actual final stdout line | ❌ W0 | ⬜ pending |
| 241-01-02 | 01 | 1 | MINTO-01 (F-1, slow write survives timeout) | — | Injected slow report-write/ghost-prune still produces `.mindrian/invariant-report.json` and prunes `minto-stale.json`; mutation-prove by restoring the old `timeout 1` and confirming the write is dropped | integration | new test with an injectable delay proving the write survives past the old 1000ms mark | ❌ W0 | ⬜ pending |
| 241-02-01 | 02 | 1/2 | MINTO-01 (F-0 fold-in, debounce consumer wired) | — | A production call site both enqueues AND later drains-and-acts (not merely drains-and-discards), matching the RCA's own Test 1/Test 2 spec (production-only census excluding `tests/`) | integration + structural census | extension of `lib/memory/feynman-minto-guardian.test.cjs` | ❌ W0 | ⬜ pending |
| 241-03-01 | 03 | 2 | MINTO-02 (F-2, severity ladder) | — | Seeded missing MINTO.md and missing governing_thought each aggregate to `critical` and reach the enqueue gate | unit | extend `lib/memory/feynman-minto-invariants.test.cjs` and `lib/memory/feynman-minto-guardian.test.cjs` fixtures | ✅ (extend existing) | ⬜ pending |
| 241-04-01 | 04 | 2 | MINTO-02 (F-3, pre-commit demotion) | — | Same seeded breach at pre-commit produces WARN (stderr) and exit 0, proven by a REAL `git commit` run, not just a `runPreCommit()` function call | integration (real git commit) | new test that stages a seeded breach in a scratch git repo/worktree and runs the actual pre-commit hook | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs above are provisional — the planner assigns the real plan/task numbering; this map exists to guarantee each of the four findings (F-0/F-1/F-2/F-3) gets an explicit, independently-provable verification leg, per RESEARCH.md's Pitfall 1/2/3 warnings against a single test silently covering only part of a success criterion.*

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
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
