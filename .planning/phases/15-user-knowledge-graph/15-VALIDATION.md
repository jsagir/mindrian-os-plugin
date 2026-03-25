---
phase: 15
slug: user-knowledge-graph
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-25
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in + Bash assertions |
| **Config file** | none — Wave 0 creates test fixtures |
| **Quick run command** | `node -e "require('./lib/core/lazygraph-ops.cjs')"` |
| **Full suite command** | `bash tests/test-phase-15.sh` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Quick module require check
- **After every plan wave:** Full test suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | GRAPH-01 | integration | `node -e "const lg = require('./lib/core/lazygraph-ops.cjs'); lg.openGraph('/tmp/test-lg')"` | tests/test-phase-15.sh | ⬜ pending |
| 15-01-02 | 01 | 1 | GRAPH-02 | integration | `bash tests/test-phase-15.sh` | tests/test-phase-15.sh | ⬜ pending |
| 15-02-01 | 02 | 2 | GRAPH-05 | integration | `bash tests/test-phase-15.sh` | tests/test-phase-15.sh | ⬜ pending |
| 15-02-02 | 02 | 2 | GRAPH-03 | unit | `node bin/mindrian-tools.cjs graph query tests/fixtures/test-room-graph "MATCH (a:Artifact) RETURN a.id"` | tests/test-phase-15.sh | ⬜ pending |
| 15-03-01 | 03 | 2 | GRAPH-04 | unit | `node -e "require('./lib/core/lazygraph-ops.cjs').embedArtifact"` | lib/core/lazygraph-ops.cjs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kuzu` npm package installed (native binary)
- [ ] Test room at `tests/fixtures/test-room-graph/` with .lazygraph/ directory
- [ ] `tests/test-phase-15.sh` test suite

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Natural language query quality | GRAPH-03 | Subjective Cypher translation | Ask Larry "What contradicts my market analysis?" and verify relevance |
| Dashboard graph visualization | GRAPH-01 | Requires browser | Open dashboard, verify KuzuDB-sourced graph renders |
| MCP tool parity | ALL | Requires Desktop | Test graph MCP tools in Claude Desktop |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
