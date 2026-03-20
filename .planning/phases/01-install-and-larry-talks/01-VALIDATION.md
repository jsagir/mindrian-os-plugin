---
phase: 1
slug: install-and-larry-talks
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 1 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + manual verification (plugin has no test framework -- validation is structural and behavioral) |
| **Config file** | none -- plugin is markdown/JSON, validation is file existence + hook execution |
| **Quick run command** | Per-task `<automated>` verify commands (self-contained in each PLAN.md task) |
| **Full suite command** | Run all task verify commands sequentially |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` verify command
- **After every plan wave:** Run all verify commands from completed plans
- **Before `/gsd:verify-work`:** All task verify commands must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 01-01-01 | 01 | 1 | PLGN-02, LARY-01 | structural | `test -f agents/larry-extended.md && wc -c agents/larry-extended.md` | pending |
| 01-01-02 | 01 | 1 | LARY-02, LARY-03 | structural | `test -f skills/larry-personality/SKILL.md && grep -q "description:" skills/larry-personality/SKILL.md` | pending |
| 01-02-01 | 02 | 1 | ROOM-03, ROOM-04 | structural + script | `test -x scripts/session-start && test -x scripts/compute-state && python3 -c "import json; json.load(open('hooks/hooks.json'))"` | pending |
| 01-02-02 | 02 | 1 | ROOM-01, ROOM-02 | structural | `test -f commands/new-project.md && grep -q "compute-state" commands/new-project.md` | pending |
| 01-03-01 | 03 | 2 | PLGN-03, PLGN-04 | structural | `test -f commands/help.md && test -f commands/status.md && test -f commands/room.md` | pending |
| 01-03-02 | 03 | 2 | DEGS-01, SURF-01 | structural | `python3 -c "import json; json.load(open('.claude-plugin/plugin.json'))" && ! grep -r '/home/' agents/ skills/ commands/ hooks/ scripts/ references/ 2>/dev/null \| grep -v '.planning' \| grep -v '^[^:]*:#'` | pending |
| 01-03-03 | 03 | 2 | E2E | manual | Human checkpoint -- full end-to-end flow | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All tasks have self-contained `<automated>` verify commands in their PLAN.md files. No separate validation script is needed -- each task's verify block serves as the Nyquist sampling point. Directory scaffolding already exists in the repo.

Wave 0 is complete: no additional infrastructure needed before execution begins.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Larry responds on first message | PLGN-01 | Requires Claude Code runtime | Install plugin, send first message, verify Larry personality |
| Context budget under 2% | PLGN-05 | Requires Claude Code --debug | Run with --debug, check context consumption |
| SessionStart restores context | ROOM-03 | Requires session lifecycle | Close/reopen Claude, verify room context loads |
| Cross-surface compatibility | SURF-01 | Requires multiple surfaces | Test on CLI, Desktop, and Cowork |
| Graceful degradation | DEGS-01 | Requires runtime without Brain | Verify all features work without Brain MCP |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are manual-only with justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete -- no missing infrastructure
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
