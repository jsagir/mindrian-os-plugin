---
phase: 3
slug: pipeline-chaining-proactive
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + grep (shell-based validation — no test framework needed for markdown/skill plugin) |
| **Config file** | none — pure file existence and content verification |
| **Quick run command** | `bash -c 'cd /home/jsagi/MindrianOS-Plugin && ls pipelines/*.md skills/room-proactive/SKILL.md 2>/dev/null'` |
| **Full suite command** | `bash -c 'cd /home/jsagi/MindrianOS-Plugin && echo "=== Pipeline contracts ===" && ls pipelines/ && echo "=== Proactive skill ===" && cat skills/room-proactive/SKILL.md | head -5 && echo "=== Pipeline command ===" && grep -q "pipeline" commands/pipeline.md 2>/dev/null && echo PASS || echo MISSING'` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PIPE-01 | file+content | `test -f pipelines/discovery-pipeline.md && grep -q "stage_contract" pipelines/discovery-pipeline.md` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PIPE-02, PIPE-03 | file+content | `test -f pipelines/thesis-pipeline.md && grep -q "stage_contract" pipelines/thesis-pipeline.md` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PIPE-04 | file+content | `test -f commands/pipeline.md && grep -q "provenance" commands/pipeline.md` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | PROA-01 | file+content | `grep -q "gap" skills/room-proactive/SKILL.md` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | PROA-02, PROA-03 | file+content | `grep -q "contradiction" skills/room-proactive/SKILL.md && grep -q "convergence" skills/room-proactive/SKILL.md` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | PROA-04 | file+content | `grep -q "confidence" skills/room-proactive/SKILL.md && grep -q "gated" skills/room-proactive/SKILL.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — Phase 2 established the methodology pattern, hooks, and room-passive filing. No new test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline chaining flows naturally in conversation | PIPE-02 | Requires Larry personality + conversational UX | Run `/mindrian-os:pipeline discovery` and verify each stage's output feeds the next |
| Proactive alerts don't overwhelm user | PROA-04 | Subjective noise threshold | Start session with populated room, verify max 2 HIGH alerts in greeting |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
