---
phase: 16
slug: reasoning-engine
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-25
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in + Bash assertions |
| **Config file** | none — Wave 0 creates test fixtures |
| **Quick run command** | `node -e "require('./lib/core/reasoning-ops.cjs')"` |
| **Full suite command** | `bash tests/test-phase-16.sh` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Quick module require check
- **After every plan wave:** Full test suite + parity check
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | REASON-01, REASON-05 | integration | `bash tests/test-phase-16.sh` | tests/test-phase-16.sh | pending |
| 16-01-02 | 01 | 1 | REASON-01 | unit | `node -e "require('./lib/core/reasoning-ops.cjs').generateReasoning"` | lib/core/reasoning-ops.cjs | pending |
| 16-02-01 | 02 | 2 | REASON-02 | unit | `node -e "require('./lib/core/reasoning-ops.cjs').executeMethodologyRun"` | lib/core/reasoning-ops.cjs | pending |
| 16-02-02 | 02 | 2 | REASON-03 | integration | `bash tests/test-phase-16.sh` | tests/test-phase-16.sh | pending |
| 16-03-01 | 03 | 3 | REASON-04 | integration | `node bin/mindrian-tools.cjs reasoning list tests/fixtures/test-room-reasoning` | bin/mindrian-tools.cjs | pending |
| 16-03-02 | 03 | 3 | REASON-04 | unit | `node lib/parity/check-parity.cjs` | lib/parity/check-parity.cjs | pending |

---

## Wave 0 Requirements

- [x] Test room fixtures with .reasoning/ directory (created in Plan 01 Task 1)
- [x] Reasoning template at references/reasoning/ (created in Plan 01 Task 1)
- [x] tests/test-phase-16.sh test suite (created in Plan 01 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Larry produces quality Minto/MECE reasoning | REASON-01 | Subjective quality | Run /mos:reason on a populated section, review output structure |
| Methodology run chains correctly | REASON-02 | Requires conversational flow | Run /mos:reason run and verify Larry chains frameworks |
| Thinking traces feel natural on Desktop | REASON-04 | Requires Desktop UI | Test MCP reasoning tools in Claude Desktop |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
