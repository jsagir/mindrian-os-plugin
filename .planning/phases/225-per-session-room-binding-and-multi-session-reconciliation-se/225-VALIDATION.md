---
phase: 225
slug: per-session-room-binding-and-multi-session-reconciliation-se
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
updated: 2026-07-15
---

# Phase 225 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:assert` + bash aggregator (repo convention, no framework install) |
| **Config file** | none — each `tests/test-225-*.cjs` is self-running; registered in `lib/memory/run-feynman-tests.cjs` TEST_FILES (plan 03) |
| **Quick run command** | `node tests/test-225-<name>.cjs` (the file matching the task just touched) |
| **Full suite command** | `bash tests/run-all-225.sh` (created in plan 03; run_if SKIP-safe until then, plus an unconditional `bash tests/run-all-194.sh` regression leg) |
| **Estimated runtime** | ~30-60 seconds (child-process spawns of intent-classifier.cjs and doctor.cjs dominate) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-225-<the-file-just-touched>.cjs`
- **After every plan wave:** Run `bash tests/run-all-225.sh` AND `bash tests/run-all-194.sh` (shipped Phase-194 substrate regression guard)
- **Before `/gsd-verify-work`:** `bash tests/run-all-225.sh` green with FAIL=0 and SKIP=0, plus `node scripts/doctor.cjs --acceptance` green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 225-01-01 | 01 | 1 | REQ-1, REQ-2, REQ-5 | T-225-01 / T-225-05 | Gate never auto-binds; never presents arbitrary best.name; fires once per session over the PD-3 floor only | integration | `node tests/test-225-zero-score-gate.cjs` (created same plan, task 2) | created in 225-01-02 | ⬜ pending |
| 225-01-02 | 01 | 1 | REQ-1, REQ-2, REQ-3 | T-225-03 | Poisoned binding/trace JSON degrades to exit-0 silence (83-07 never-block) | integration + unit | `node tests/test-225-zero-score-gate.cjs && node tests/test-225-gate-degrade.cjs` | self (this task creates both) | ⬜ pending |
| 225-02-01 | 02 | 1 | REQ-4 | T-225-06 / T-225-08 | Advisory fires only on SQLite < 3.51.3 AND live co-session; null on any fault; exit code and report.healthy untouched | unit (injected seams) | `node -e "..." _walResetAdvisory seam probe (inline in plan verify)` | n/a (inline node -e) | ⬜ pending |
| 225-02-02 | 02 | 1 | REQ-4 | T-225-06 / T-225-07 | `doctor --bind-check` exits 0 with a live co-session fixture (never-block) | unit + e2e spawn | `node tests/test-225-wal-advisory.cjs` | self (this task creates it) | ⬜ pending |
| 225-03-01 | 03 | 2 | REQ-6 | T-225-11 | 194 substrate regression leg runs unconditionally inside the phase gate | aggregator | `bash tests/run-all-225.sh` | self (this task creates it) | ⬜ pending |
| 225-03-02 | 03 | 2 | REQ-6 | T-225-10 | Append-only ENV-TUNING/TEST_FILES edits compose with pending 224-04 | doc + gate | `grep -q MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS docs/ENV-TUNING.md && bash tests/run-all-225.sh` | ✅ (docs/ENV-TUNING.md exists) | ⬜ pending |
| 225-03-03 | 03 | 2 | REQ-6 (compositing rider) | T-225-12 | Room filing carries no user data / real names | CLI check | `ls ~/MindrianRooms/rethinking-mindrianos/research/ \| grep -q phase-225` | created by task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0: this phase creates each test file inside the SAME plan (and wave) as
the code it verifies, and `tests/run-all-225.sh` gates every 225 leg with `run_if`
(SKIP-safe), so no task ever references a test that cannot exist yet.

- [x] `tests/test-225-zero-score-gate.cjs` — created by task 225-01-02 (REQ-1, REQ-2, plus PD-1/PD-3 silence legs)
- [x] `tests/test-225-gate-degrade.cjs` — created by task 225-01-02 (REQ-3)
- [x] `tests/test-225-wal-advisory.cjs` — created by task 225-02-02 (REQ-4)
- [x] `tests/run-all-225.sh` — created by task 225-03-01 (REQ-6 aggregator)
- [x] Registration in `lib/memory/run-feynman-tests.cjs` — task 225-03-01

Existing infrastructure reused: `tests/run-all-194.sh` (regression guard leg),
`tests/test-binding-gate-degrade.test.cjs` (degrade-test precedent),
`tests/test-159-integration-2turn-suppress.cjs` (classifier spawn-harness precedent).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendered F.8 gate legibility on Desktop/Cowork (AskUserQuestion trailer) | REQ-1 (Tri-Polar) | Visual surface rendering cannot be asserted from the CLI envelope alone | In a live Desktop session bound to a room, send a long off-domain reframe message; confirm the no-match gate renders with 'continue in <primary>' pre-checked and answering it updates the binding |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or same-plan test-creation dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no orphan test references; run_if SKIP-safe)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-15 (planner); execution sign-off pending
