---
phase: 2
slug: core-methodologies
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash structural checks + manual methodology session testing |
| **Config file** | none — plugin is markdown/JSON |
| **Quick run command** | Per-task `<automated>` verify commands (self-contained) |
| **Full suite command** | Run all task verify commands sequentially |
| **Estimated runtime** | ~10 seconds (25+ file existence checks) |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` verify command
- **After every plan wave:** Run all verify commands from completed plans
- **Before `/gsd:verify-work`:** All task verify commands must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 02-01-01 | 01 | 1 | METH-09, METH-10 | structural | `test -f commands/[first-cmd].md && wc -c commands/[first-cmd].md` | pending |
| 02-01-02 | 01 | 1 | METH-01-08 | structural | file existence + frontmatter checks for Tier 1-2 commands | pending |
| 02-02-01 | 02 | 1 | ALLM-01, ALLM-02 | structural | file existence for all remaining methodology commands + references | pending |
| 02-03-01 | 03 | 2 | PASS-01, PASS-02, PASS-03 | structural + script | hook config check + room-passive skill verification | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All tasks have self-contained `<automated>` verify commands. No separate infrastructure needed. Phase 1 established the plugin structure.

Wave 0 is complete.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Methodology session quality | METH-01-08 | Requires Claude runtime | Invoke each methodology, verify Larry's adaptive conversation flow |
| Artifact filing confirmation | PASS-01 | Requires runtime interaction | Run methodology, verify Larry asks to confirm before filing |
| Problem type classification | ALLM-01 | Requires conversational context | Verify Larry classifies problem type and adapts routing |
| Depth control | METH-09 | Requires user interaction | Verify "quick pass or deep dive?" works correctly |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are manual-only with justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
