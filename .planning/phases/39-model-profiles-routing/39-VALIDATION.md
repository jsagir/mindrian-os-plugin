---
phase: 39
slug: model-profiles-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 39 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + node inline assertions (no test framework -- this is a plugin with CJS modules) |
| **Config file** | none -- validation via bash script checks |
| **Quick run command** | `node -e "require('./lib/core/model-profiles.cjs')"` |
| **Full suite command** | `bash scripts/validate-model-profiles` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (module loads without error)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | MODEL-01 | unit | `node -e "const m=require('./lib/core/model-profiles.cjs'); console.log(Object.keys(m.MODEL_PROFILES).length)"` | W0 | pending |
| 39-01-02 | 01 | 1 | MODEL-06 | unit | `node -e "const m=require('./lib/core/model-profiles.cjs'); console.log(m.resolveModel('grading', {model_profile:'balanced'}))"` | W0 | pending |
| 39-01-03 | 01 | 1 | MODEL-03 | integration | `grep -q 'model_profile' commands/models.md` | W0 | pending |
| 39-02-01 | 02 | 2 | MODEL-02 | integration | `node -e "const m=require('./lib/core/model-profiles.cjs'); console.log(m.resolveModel('grading', {model_profile:'quality', venture_stage:'Pre-Opportunity'}))"` | W0 | pending |
| 39-02-02 | 02 | 2 | MODEL-04 | integration | Check room/.config.json template in commands/new-project.md | W0 | pending |
| 39-02-03 | 02 | 2 | MODEL-05 | unit | `node -e "const m=require('./lib/core/model-profiles.cjs'); console.log(Object.keys(m.CASCADE_MODELS))"` | W0 | pending |

*Status: pending -- all created in W0*

---

## Wave 0 Requirements

- [ ] `lib/core/model-profiles.cjs` -- MODULE_PROFILES table + resolveModel function
- [ ] `commands/models.md` -- /mos:models command definition

*Wave 0 is the first plan execution -- creates the files that validation checks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stage hints auto-select | MODEL-02 | Requires active room with STATE.md | Create test room with venture_stage, verify resolveModel returns stage-appropriate model |
| Profile persists across sessions | MODEL-04 | Requires session restart | Write room/.config.json, restart Claude, verify /mos:models shows saved profile |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
