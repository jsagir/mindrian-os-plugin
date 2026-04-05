---
phase: 12
slug: brain-hosting-room-collaboration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> NOTE: COLLAB-02 and COLLAB-03 deferred — room stays local only for v3.0.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in + curl for HTTP smoke tests |
| **Config file** | none — Wave 0 creates |
| **Quick run command** | `cd mcp-server-brain && node -e "require('./server.cjs')" && echo "OK"` |
| **Full suite command** | `cd mcp-server-brain && node test-brain.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Quick module require check
- **After every plan wave:** Full HTTP smoke test against local server
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | BRAIN-01 | smoke | `cd mcp-server-brain && node -e "require('./server.cjs')"` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | BRAIN-03 | unit | `curl -s -H "Authorization: Bearer invalid" http://localhost:3001/mcp \| grep -q "401"` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | BRAIN-02 | integration | `curl -s -H "Authorization: Bearer test-key" http://localhost:3001/mcp -d '...' \| grep -q "result"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mcp-server-brain/package.json` — npm project with SDK + neo4j-driver + pinecone
- [ ] Test API key configured in env for local testing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop user connects to Brain via config | BRAIN-02 | Requires Claude Desktop UI | Add Brain MCP to claude_desktop_config.json, verify enriched responses |
| Render deployment works | BRAIN-01 | Requires Render deploy | Push to Render, test URL responds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
