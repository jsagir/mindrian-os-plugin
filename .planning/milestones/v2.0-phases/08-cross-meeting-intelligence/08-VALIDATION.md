---
phase: 8
slug: cross-meeting-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + manual verification |
| **Config file** | None — bash scripts tested via execution |
| **Quick run command** | `bash scripts/compute-meetings-intelligence room/ && cat room/MEETINGS-INTELLIGENCE.md` |
| **Full suite command** | File 3+ test meetings, run compute-state, verify all output files |
| **Estimated runtime** | ~5 seconds (compute scripts) |

---

## Sampling Rate

- **After every task commit:** Verify modified files parse correctly
- **After every plan wave:** Run compute-state on test room, verify MEETINGS-INTELLIGENCE.md and action-items.md
- **Before `/gsd:verify-work`:** Full pipeline test: file 3 meetings, verify convergence/contradiction/action-item detection
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | XMTG-01 | manual | File 3+ meetings with shared topic, verify summary | N/A | ⬜ pending |
| 08-01-02 | 01 | 1 | XMTG-02 | manual | File meetings with conflicting claims, verify flagging | N/A | ⬜ pending |
| 08-01-03 | 01 | 1 | XMTG-03 | smoke | `grep "open" room/action-items.md` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | XMTG-04 | smoke | `cat room/MEETINGS-INTELLIGENCE.md` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | RDAI-01 | manual | Run setup meetings, verify .mcp.json | N/A | ⬜ pending |
| 08-02-02 | 02 | 1 | RDAI-02 | manual | Run file-meeting --latest with Read AI | N/A | ⬜ pending |
| 08-02-03 | 02 | 1 | RDAI-03 | smoke | `grep "read-ai" .mcp.json` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test room with 3+ meetings for integration testing
- [ ] `scripts/compute-meetings-intelligence` — new script (does not exist yet)
- [ ] Verify action-items.md aggregation works with varying meeting counts

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Convergence in meeting summary | XMTG-01 | Requires filing 3+ meetings with Larry | File 3 meetings with shared topic, check summary |
| Contradiction flagging | XMTG-02 | Requires filing meetings with conflicting claims | File 2 meetings where speaker changes position |
| Read AI setup | RDAI-01 | Requires MCP connection | Run `/setup meetings`, verify .mcp.json |
| --latest auto-fetch | RDAI-02 | Requires live Read AI MCP | Run `--latest` with Read AI configured |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
