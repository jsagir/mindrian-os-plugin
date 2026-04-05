---
phase: 9
slug: meeting-knowledge-graph
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + manual verification |
| **Config file** | None |
| **Quick run command** | `bash scripts/build-graph room/ && python3 -c "import json; d=json.load(open('dashboard/graph.json')); print(len(d['elements']['nodes']), 'nodes', len(d['elements']['edges']), 'edges')"` |
| **Full suite command** | Build graph + serve dashboard + visual inspection |
| **Estimated runtime** | ~3 seconds (build-graph) |

---

## Sampling Rate

- **After every task commit:** Verify build-graph produces valid JSON
- **After every plan wave:** Visual inspection of dashboard
- **Before `/gsd:verify-work`:** Full pipeline: file meetings → build-graph → dashboard → export
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | GRAP-01 | smoke | `bash scripts/build-graph room/ && python3 -c "..." grep meeting` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | GRAP-02 | smoke | grep speaker nodes in graph.json | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | GRAP-03 | smoke | grep REINFORCES/CONTRADICTS edges | ❌ W0 | ⬜ pending |
| 09-01-04 | 01 | 1 | GRAP-04 | smoke | grep wikilink edges in graph.json | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | GRAP-05 | manual | Visual: timeline mode in dashboard | N/A | ⬜ pending |
| 09-02-02 | 02 | 2 | DASH-06 | manual | Visual: team nodes in graph | N/A | ⬜ pending |
| 09-03-01 | 03 | 2 | DASH-07 | smoke | grep meeting-report in export.md | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 2 | DOCS-06 | manual | Visual: PDF with speaker attribution | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Test room with 2+ meetings and 3+ speakers for graph testing
- [ ] Updated `scripts/build-graph` with meeting/speaker/concept nodes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timeline mode layout | GRAP-05 | Visual verification | Open dashboard, toggle timeline mode, verify chronological X-axis |
| Team nodes in graph | DASH-06 | Visual verification | Open dashboard, verify speaker nodes connected to sections |
| PDF speaker attribution | DOCS-06 | Visual verification | Run export meeting-report, verify De Stijl speaker badges |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
