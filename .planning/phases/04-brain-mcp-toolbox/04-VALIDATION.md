---
phase: 4
slug: brain-mcp-toolbox
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + grep (file existence, content verification, agent/skill structure) |
| **Config file** | none — markdown file structure validation |
| **Quick run command** | `bash -c 'test -f skills/brain-connector/SKILL.md && test -f agents/brain-query.md && test -f references/brain/query-patterns.md && echo PASS'` |
| **Full suite command** | `bash -c 'cd /home/jsagi/MindrianOS-Plugin && ls agents/*.md | wc -l && ls commands/*.md | wc -l && grep -q "neo4j" skills/brain-connector/SKILL.md && grep -q "brain" commands/setup.md && echo ALL_PASS'` |
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
| 04-01-01 | 01 | 1 | BRAN-01, BRAN-10 | file+content | `test -f commands/setup.md && test -f references/brain/schema.md && test -f references/brain/query-patterns.md` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | BRAN-02, BRAN-03 | file+content | `test -f skills/brain-connector/SKILL.md && grep -q "passive" skills/brain-connector/SKILL.md && grep -q "proactive" skills/brain-connector/SKILL.md` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | BRAN-04, BRAN-05, BRAN-06, BRAN-07 | file+content | `test -f agents/brain-query.md && test -f agents/grading.md && test -f agents/research.md && test -f agents/investor.md` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | BRAN-08 | file+content | `test -f commands/suggest-next.md && test -f commands/deep-grade.md && test -f commands/research.md && test -f commands/find-connections.md && test -f commands/compare-ventures.md` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | BRAN-09 | file+content | `grep -q "brain" commands/diagnose.md && grep -q "brain" commands/help.md && grep -q "brain" commands/grade.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No new dependencies. All MCP tools (Neo4j, Pinecone, Tavily) already available. Only markdown files created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Brain connection works with live credentials | BRAN-01 | Requires Neo4j Aura + Pinecone credentials | Run `/mindrian-os:setup brain`, provide credentials, verify test query succeeds |
| Passive enrichment in Larry's responses | BRAN-03 | Requires conversational interaction with Brain connected | Talk to Larry about a venture, verify response references graph patterns naturally |
| Proactive surfacing after room changes | BRAN-03 | Requires room modification + Brain connection | Add artifact, verify Larry mentions contradiction/gap from Brain data |
| Grading Agent produces calibrated scores | BRAN-05 | Requires Brain with real calibration data | Run `/mindrian-os:deep-grade` with populated room, verify percentile ranking |
| Investor Agent voice is distinct from Larry | BRAN-07 | Subjective voice quality check | Trigger Investor Agent, verify it speaks in investor voice not Larry voice |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
