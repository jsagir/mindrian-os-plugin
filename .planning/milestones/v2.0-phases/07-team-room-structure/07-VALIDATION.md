---
phase: 7
slug: team-room-structure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + manual verification |
| **Config file** | None — see Wave 0 |
| **Quick run command** | `bash scripts/compute-team room/ && cat room/team/TEAM-STATE.md` |
| **Full suite command** | `bash scripts/compute-state room/ && cat room/STATE.md` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Verify changed script runs without error
- **After every plan wave:** Run compute-state → compute-team pipeline on test room
- **Before `/gsd:verify-work`:** Full pipeline: new-project → file-meeting → compute-state with team intelligence
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | TEAM-01 | smoke | `ls -la room/team/` after create-speaker-profile | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | TEAM-02 | unit | `grep '^roles:' room/team/*/*/PROFILE.md` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | TEAM-04 | integration | `grep 'attribution:' room/*/2026-*.md` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | ARCH-01 | smoke | `ls room/meetings/*/` verifies all files | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | ARCH-03 | unit | `grep -rl 'speaker_name' room/meetings/*/metadata.yaml` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | TEAM-05 | unit | `bash scripts/compute-team room/ && cat room/team/TEAM-STATE.md` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | TEAM-03 | smoke | Run new-project and verify `room/team/` exists | N/A manual | ⬜ pending |
| 07-03-03 | 03 | 2 | ARCH-02 | smoke | Run status and check meeting + team display | N/A manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test room fixture with 2+ meetings and 3+ speakers for integration testing
- [ ] `scripts/compute-team` — new script (does not exist yet)
- [ ] Updated `scripts/compute-state` to call compute-team
- [ ] Updated `scripts/create-speaker-profile` with extended schema (roles list, status, last_active)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| new-project creates team/ | TEAM-03 | Interactive conversation flow | Run `/mindrian-os:new-project`, verify room/team/ exists |
| Status shows meeting + team info | ARCH-02 | Interactive conversation flow | Run `/mindrian-os:status`, verify meeting count and team profile count |
| Cross-link filing UX | TEAM-04 | Full meeting filing pipeline | File a meeting, verify attribution block + PROFILE.md backlinks |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
