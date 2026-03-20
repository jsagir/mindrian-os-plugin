---
phase: 1
slug: install-and-larry-talks
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + manual verification (plugin has no test framework — validation is structural and behavioral) |
| **Config file** | none — plugin is markdown/JSON, validation is file existence + hook execution |
| **Quick run command** | `bash scripts/validate-plugin.sh --quick` |
| **Full suite command** | `bash scripts/validate-plugin.sh --full` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/validate-plugin.sh --quick`
- **After every plan wave:** Run `bash scripts/validate-plugin.sh --full`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PLGN-02 | structural | `test -f .claude-plugin/plugin.json` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | LARY-01 | structural | `test -f agents/larry-extended.md` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | PLGN-01 | structural | `jq '.agent' settings.json` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | ROOM-01 | structural | `test -d references/layer-0/rooms/` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | ROOM-02 | script | `bash hooks/session-start --test` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | ROOM-03 | script | `bash hooks/stop --test` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | PLGN-03 | structural | `test -f commands/help.md` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | PLGN-04 | structural | `test -f commands/status.md` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | DEGS-01 | manual | visual inspection | N/A | ⬜ pending |
| 01-03-04 | 03 | 2 | SURF-01 | manual | cross-surface test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/validate-plugin.sh` — validation script checking file existence, JSON validity, hook executability
- [ ] Plugin structure directories exist (commands/, skills/, agents/, hooks/, references/)

*Existing scaffolding covers directory structure. Validation script needs creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Larry responds on first message | PLGN-01 | Requires Claude Code runtime | Install plugin, send first message, verify Larry personality |
| Context budget under 2% | PLGN-05 | Requires Claude Code --debug | Run with --debug, check context consumption |
| SessionStart restores context | ROOM-03 | Requires session lifecycle | Close/reopen Claude, verify room context loads |
| Cross-surface compatibility | SURF-01 | Requires multiple surfaces | Test on CLI, Desktop, and Cowork |
| Graceful degradation | DEGS-01 | Requires runtime without Brain | Verify all features work without Brain MCP |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
