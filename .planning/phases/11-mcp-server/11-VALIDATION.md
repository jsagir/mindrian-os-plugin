---
phase: 11
slug: mcp-server
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in + MCP Inspector |
| **Config file** | none — Wave 0 creates |
| **Quick run command** | `node lib/parity/check-parity.cjs` |
| **Full suite command** | `node lib/parity/check-parity.cjs && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \| timeout 5 node bin/mindrian-mcp-server.cjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node lib/parity/check-parity.cjs`
- **After every plan wave:** Full parity + MCP server smoke test
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | MCP-04 | smoke | `echo '{"jsonrpc":"2.0",...}' \| timeout 5 node bin/mindrian-mcp-server.cjs` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | MCP-01 | unit | `node -e "require('./lib/mcp/tool-router.cjs')"` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | MCP-02 | unit | `node -e "require('./lib/mcp/resources.cjs')"` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | MCP-03, MCP-05 | unit | `node -e "require('./lib/mcp/prompts.cjs')"` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 3 | CORE-03 | unit | `node lib/parity/check-parity.cjs` | ❌ W0 | ⬜ pending |
| 11-03-02 | 01 | 1 | COLLAB-01 | unit | `MINDRIAN_ROOM=/tmp node -e "const p=require('path');const r=p.resolve(process.env.MINDRIAN_ROOM);if(r!=='/tmp')process.exit(1);console.log('PASS')"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — npm init + @modelcontextprotocol/sdk dependency
- [ ] `lib/parity/check-parity.cjs` — parity check script (commands/ vs tool router enums)
- [ ] MCP Inspector installed globally or via npx for manual verification

*Wave 0 creates test infrastructure before plans execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude Desktop sees all tools | MCP-04 | Requires Claude Desktop UI | Add to claude_desktop_config.json, restart, verify tools list |
| Resources browsable in Desktop | MCP-02 | Requires Desktop resource browser | Browse room:// URIs in Claude Desktop |
| Larry personality in MCP | MCP-05 | Subjective voice quality | Chat with Larry in Desktop, compare to CLI experience |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
