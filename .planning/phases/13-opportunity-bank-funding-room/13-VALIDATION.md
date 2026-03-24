---
phase: 13
slug: opportunity-bank-funding-room
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in + Bash assertions |
| **Config file** | none — Wave 0 creates test fixtures |
| **Quick run command** | `node bin/mindrian-tools.cjs room list-sections tests/test-room \| grep opportunity-bank` |
| **Full suite command** | `bash tests/test-phase-13.sh` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Quick section discovery check
- **After every plan wave:** Full test suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | OPP-01 | integration | `node bin/mindrian-tools.cjs room list-sections tests/test-room \| grep opportunity-bank` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | FUND-01 | integration | `node bin/mindrian-tools.cjs room list-sections tests/test-room \| grep funding` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | OPP-02, OPP-03 | unit | `node -e "require('./lib/core/opportunity-ops.cjs')"` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | OPP-04 | integration | `bash scripts/analyze-room tests/test-room \| grep opportunity` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 3 | FUND-02, FUND-03, FUND-04 | unit | `node -e "require('./lib/core/opportunity-ops.cjs')"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test room extended with opportunity-bank/ and funding/ sample data
- [ ] Golden files updated for new section discovery output

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm-first UX feels natural | OPP-03 | Subjective UX quality | Run /mos:discover-opportunities, verify Larry presents then waits for confirmation |
| MCP tool parity | ALL | Requires Desktop | Test opportunity and funding MCP tools in Claude Desktop |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
