---
phase: 10
slug: shared-core-cli-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + Node.js assertion (no test framework — validate via golden file diffs and CLI output checks) |
| **Config file** | none — Wave 0 creates test fixtures |
| **Quick run command** | `node bin/mindrian-tools.cjs room list-sections ./room && echo "OK"` |
| **Full suite command** | `bash scripts/compute-state ./room > /tmp/test-state.md && diff /tmp/test-state.md tests/golden/compute-state.md` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node bin/mindrian-tools.cjs room list-sections ./room`
- **After every plan wave:** Run full golden file diff for compute-state and analyze-room
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | CORE-01 | smoke | `node bin/mindrian-tools.cjs room list-sections ./room` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | CORE-01 | integration | `node bin/mindrian-tools.cjs state compute ./room \| diff - <(bash scripts/compute-state ./room)` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | CORE-02 | integration | `mkdir -p /tmp/test-room/new-section && echo "# Test" > /tmp/test-room/new-section/entry.md && node bin/mindrian-tools.cjs room list-sections /tmp/test-room \| grep new-section` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | CORE-02 | integration | `bash scripts/analyze-room /tmp/test-room \| grep new-section` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/golden/compute-state.md` — golden file for compute-state output on test room
- [ ] `tests/golden/analyze-room.txt` — golden file for analyze-room output on test room
- [ ] `tests/test-room/` — minimal test room with 2-3 sections for automated testing
- [ ] Validation script that runs mindrian-tools.cjs subcommands and checks output

*Wave 0 creates test infrastructure before any plans execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 41 CLI commands work identically | CORE-01 | Too many commands for automated regression in Phase 10 | Run 5 representative commands before/after, compare output |
| Hook timing stays under 2-3s | CORE-01 | Requires real session-start hook execution | Time `bash hooks/session-start` before and after changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
