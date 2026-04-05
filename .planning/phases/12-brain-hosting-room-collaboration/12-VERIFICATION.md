---
phase: 12-brain-hosting-room-collaboration
verified: 2026-03-25T00:00:00Z
status: human_needed
score: 8/8 automated must-haves verified
re_verification: false
human_verification:
  - test: "Deploy Brain MCP server to Render and hit the health endpoint"
    expected: "curl https://mindrian-brain.onrender.com/health returns {\"status\":\"ok\"}"
    why_human: "Render deployment is a live infrastructure action — cannot verify programmatically from codebase"
  - test: "Add Brain MCP config to claude_desktop_config.json with a valid API key and restart Claude Desktop"
    expected: "Five Brain tools appear: brain_schema, brain_query, brain_write, brain_search, brain_stats"
    why_human: "Desktop MCP tool registration requires a running Claude Desktop session — not automatable"
  - test: "Invoke brain_search with a natural language query against the live Render endpoint"
    expected: "Either returns semantic results, or returns clear 'Index does not support integrated inference' error with fallback guidance"
    why_human: "Pinecone integrated inference vs external embeddings cannot be resolved without live Pinecone index access"
---

# Phase 12: Brain Hosting and Room Collaboration — Verification Report

**Phase Goal:** Paid-tier users connect to Brain from any surface, and teams share room state through git
**Scope Change:** COLLAB-02 and COLLAB-03 deferred. Only BRAIN-01, BRAIN-02, BRAIN-03 in scope.
**Verified:** 2026-03-25
**Status:** HUMAN NEEDED (all automated checks pass; 3 items require live environment)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Brain MCP server starts and accepts Streamable HTTP requests at /mcp | VERIFIED | `test-brain.cjs` Test 4 PASS; server.cjs lines 17-43 |
| 2 | Requests without valid API key are rejected with 401 and clear error | VERIFIED | `test-brain.cjs` Tests 2+3 PASS; auth.cjs returns 401 with message |
| 3 | Requests with valid API key reach MCP tool handlers | VERIFIED | `test-brain.cjs` Test 4 PASS; auth middleware calls next() on valid key |
| 4 | Neo4j tools (brain_schema, brain_query, brain_write) registered and callable | VERIFIED | `test-brain.cjs` Test 5 PASS — 5 tools confirmed; neo4j-tools.cjs 100 lines |
| 5 | Pinecone tools (brain_search, brain_stats) registered and callable | VERIFIED | `test-brain.cjs` Test 5 PASS — correct names confirmed; pinecone-tools.cjs 83 lines |
| 6 | Render deployment config complete and ready for git-push deploy | VERIFIED | render.yaml: native Node, autoDeploy, rootDir=mcp-server-brain |
| 7 | User documentation explains how to add Brain to claude_desktop_config.json | VERIFIED | docs/brain-setup.md line 15-27: config snippet with URL + Bearer header |
| 8 | Desktop/Cowork user can connect to Brain with one config entry | VERIFIED (automated) | brain-setup.md documents single JSON entry; deployment to Render needs human |

**Score:** 8/8 truths verified (automated) — 3 truths also require human live-environment confirmation

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mcp-server-brain/server.cjs` | Express + StreamableHTTP MCP entry point | VERIFIED | 59 lines; imports auth/neo4j/pinecone; mounts validateApiKey on /mcp; POST /mcp handler wired |
| `mcp-server-brain/lib/auth.cjs` | API key validation middleware | VERIFIED | 29 lines; exports validateApiKey; Bearer header check; BRAIN_API_KEYS env var |
| `mcp-server-brain/lib/neo4j-tools.cjs` | Neo4j MCP tool registrations | VERIFIED | 100 lines; exports registerNeo4jTools; 3 tools registered (schema/query/write) |
| `mcp-server-brain/lib/pinecone-tools.cjs` | Pinecone MCP tool registrations | VERIFIED | 83 lines; exports registerPineconeTools; 2 tools registered (search/stats) |
| `mcp-server-brain/package.json` | Standalone npm project with Brain server deps | VERIFIED | @modelcontextprotocol/sdk, express, neo4j-driver, pinecone, zod all present |
| `mcp-server-brain/test-brain.cjs` | Local smoke test for auth + MCP initialize | VERIFIED | 151 lines; 13 assertions; all 13 PASS on live run |
| `mcp-server-brain/render.yaml` | Render IaC deployment configuration | VERIFIED | 24 lines; name=mindrian-brain; startCommand=node server.cjs; rootDir=mcp-server-brain |
| `mcp-server-brain/.env.example` | Environment variable template | VERIFIED | Documents all 6 env vars; includes key generation command |
| `docs/brain-setup.md` | User-facing Brain connection guide | VERIFIED | 67 lines; claude_desktop_config.json snippet; troubleshooting table; admin key section |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server.cjs` | `lib/auth.cjs` | `app.use('/mcp', validateApiKey)` | WIRED | Line 14: `app.use('/mcp', validateApiKey)` — imported line 6, used line 14 |
| `server.cjs` | `lib/neo4j-tools.cjs` | `registerNeo4jTools(server)` call | WIRED | Line 23: `registerNeo4jTools(server)` — imported line 7, used inside POST /mcp handler |
| `server.cjs` | `lib/pinecone-tools.cjs` | `registerPineconeTools(server)` call | WIRED | Line 24: `registerPineconeTools(server)` — imported line 8, used inside POST /mcp handler |
| `render.yaml` | `server.cjs` | `startCommand: node server.cjs` | WIRED | Line 8 of render.yaml: `startCommand: node server.cjs` |
| `docs/brain-setup.md` | `server.cjs` | Documents /mcp endpoint URL | WIRED | Line 21: `"url": "https://mindrian-brain.onrender.com/mcp"` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| BRAIN-01 | 12-01, 12-02 | Brain MCP server deployed as remote service at brain.mindrian.ai | SATISFIED (automated); HUMAN NEEDED (live deploy) | Server code complete; render.yaml ready; live deployment not yet confirmed |
| BRAIN-02 | 12-02 | Desktop/Cowork users can connect via MCP config | SATISFIED (automated); HUMAN NEEDED (Desktop connection) | docs/brain-setup.md single config entry; Desktop tool registration needs human |
| BRAIN-03 | 12-01 | Brain access gated by API key for paid tier | SATISFIED | auth.cjs validates Bearer token; smoke test Tests 2+3 confirm 401 on invalid/missing keys |
| COLLAB-02 | (deferred) | Room state syncable to git for team collaboration | DEFERRED — v4.0 | Explicitly deferred in REQUIREMENTS.md, not in scope for this phase |
| COLLAB-03 | (deferred) | Git sync handles STATE.md merge conflicts | DEFERRED — v4.0 | Explicitly deferred in REQUIREMENTS.md, not in scope for this phase |

**Orphaned requirements check:** COLLAB-02 and COLLAB-03 appear in the REQUIREMENTS.md phase mapping table as Phase 12 / Pending. Per the scope change instruction for this verification, they are correctly marked deferred in the requirements file itself and do not constitute a gap.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| (none) | — | — | — |

Zero TODO/FIXME/placeholder patterns found across all 6 phase-12 files. All tool handlers have real implementations — no empty returns, no console.log stubs, no `return null` patterns.

---

## Smoke Test Results (Live Run)

```
Starting Brain MCP smoke tests...

Test 1: Health check
  PASS: status 200
  PASS: status ok

Test 2: Missing auth → 401
  PASS: status 401
  PASS: error message

Test 3: Invalid key → 401
  PASS: status 401
  PASS: error message

Test 4: MCP initialize with valid key
  PASS: status 200
  PASS: has result
  PASS: server name

Test 5: tools/list returns 5 tools
  PASS: status 200
  PASS: has tools array
  PASS: 5 tools registered
  PASS: correct tool names

========================================
Results: 13 passed, 0 failed
========================================
```

---

## Human Verification Required

### 1. Render Deployment

**Test:** Push the current branch to main and create a Render Web Service from the MindrianOS-Plugin repo. Set root directory to `mcp-server-brain` and configure all env vars from `.env.example`.

**Expected:** `curl https://mindrian-brain.onrender.com/health` returns `{"status":"ok","server":"mindrian-brain","version":"1.0.0"}`

**Why human:** Render deployment is a live infrastructure action requiring dashboard access and real credentials (Neo4j, Pinecone, BRAIN_API_KEYS). Cannot verify from codebase.

---

### 2. Claude Desktop Brain Tool Appearance

**Test:** Add the `mindrian-brain` MCP config entry from `docs/brain-setup.md` to `~/Library/Application Support/Claude/claude_desktop_config.json` (or Windows equivalent), substituting a real API key. Restart Claude Desktop.

**Expected:** Five tools appear in Claude Desktop: `brain_schema`, `brain_query`, `brain_write`, `brain_search`, `brain_stats`.

**Why human:** Desktop MCP tool registration requires a running Claude Desktop session against a live Render endpoint. Not automatable from the repository.

---

### 3. Pinecone Integrated Inference Behavior

**Test:** With Desktop connected to Brain, invoke `brain_search` with a query like "how to identify assumptions in a venture".

**Expected:** Either returns ranked semantic results, or returns the clear fallback message: "Index does not support integrated inference. To search with external embeddings, use brain_query with a vector."

**Why human:** The Pinecone `neo4j-knowledge-base` index type (integrated vs external embeddings) determines which path executes. This is a live-index validation that cannot be resolved from the codebase. The code handles both paths correctly — the question is which path fires.

---

## Gaps Summary

No automated gaps. All 8 observable truths verified, all 9 artifacts pass all three levels (exists, substantive, wired), all 5 key links confirmed wired, all 3 in-scope requirements satisfied in code. The 3 human-verification items are live-environment confirmations of code that is fully implemented — not missing implementations.

The phase goal "paid-tier users connect to Brain from any surface" is architecturally complete. The server enforces API key gating (BRAIN-03), the documentation enables one-config Desktop/Cowork setup (BRAIN-02), and the Render blueprint enables self-service deployment (BRAIN-01). The remaining work is a deploy action, not a code action.

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
