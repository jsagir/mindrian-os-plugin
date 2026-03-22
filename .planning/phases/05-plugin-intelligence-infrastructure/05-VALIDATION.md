---
phase: 5
slug: plugin-intelligence-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + grep (file existence, content checks) |
| **Config file** | none |
| **Quick run command** | `bash -c 'test -f commands/update.md && test -f skills/context-engine/SKILL.md && test -f references/capability-radar.md && echo PASS'` |
| **Full suite command** | `bash -c 'cd /home/jsagi/MindrianOS-Plugin && grep -q "version" commands/update.md && grep -q "context" skills/context-engine/SKILL.md && grep -q "model" skills/context-engine/SKILL.md && echo ALL_PASS'` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | UPDT-01, UPDT-02 | file+content | `test -f commands/update.md && grep -q "backup" commands/update.md && grep -q "changelog" commands/update.md` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | CTXW-01, CTXW-02 | file+content | `test -f skills/context-engine/SKILL.md && grep -q "model" skills/context-engine/SKILL.md && grep -q "compress" skills/context-engine/SKILL.md` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | RADR-01, RADR-02 | file+content | `test -f references/capability-radar.md && grep -q "domain" references/capability-radar.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No new dependencies. All bash + markdown.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Update detects version and shows changelog | UPDT-01 | Requires marketplace interaction | Run `/mindrian-os:update`, verify version display and changelog |
| Context awareness adapts to model | CTXW-02 | Requires switching between Sonnet and Opus | Run on Sonnet, verify compression; run on Opus, verify richer context |
| Capability radar surfaces relevant features | RADR-01 | Requires web fetch of changelog | Run `/mindrian-os:radar`, verify it fetches and parses releases |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
