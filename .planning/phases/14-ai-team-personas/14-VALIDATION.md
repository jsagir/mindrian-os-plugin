---
phase: 14
slug: ai-team-personas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in + Bash assertions |
| **Config file** | none — Wave 0 creates test fixtures |
| **Quick run command** | `node -e "require('./lib/core/persona-ops.cjs')"` |
| **Full suite command** | `bash tests/test-phase-14.sh` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Quick module require check
- **After every plan wave:** Full test suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PERS-01, PERS-02 | unit | `node -e "require('./lib/core/persona-ops.cjs')"` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | PERS-04 | integration | `bash tests/test-phase-14.sh` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | PERS-03 | unit | `node -e "require('./lib/core/persona-ops.cjs').analyzeWithPersonas"` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | ALL | integration | `bash tests/test-phase-14.sh && node lib/parity/check-parity.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test room extended with personas/ sample data
- [ ] Golden files updated for persona section discovery

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Persona voice is distinct per hat | PERS-02 | Subjective quality | Generate personas, compare outputs across hats |
| Disclaimer feels natural | PERS-04 | Subjective UX | Read persona output, verify disclaimer doesn't feel jarring |
| MCP tool parity | ALL | Requires Desktop | Test persona MCP tools in Claude Desktop |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
