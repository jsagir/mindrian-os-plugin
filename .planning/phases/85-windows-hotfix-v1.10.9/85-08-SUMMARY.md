---
phase: 85
plan: 85-08
subsystem: brain-client
tags: [regression, schema-drift, finding-i, brain-mcp, tests]
requires: []
provides:
  - tests/test-brain-client-params.cjs
  - param-audit-table for all 5 Brain MCP tools
affects:
  - lib/memory/run-feynman-tests.cjs
tech-stack:
  added: []
  patterns:
    - mock-http-server regression fence for MCP argument shapes
    - gated live-integration smoke test (BRAIN_LIVE_TESTS=1)
key-files:
  created:
    - tests/test-brain-client-params.cjs
  modified:
    - lib/memory/run-feynman-tests.cjs
decisions:
  - Regression test uses Node built-in http + assert, zero new deps
  - Live smoke test gated behind BRAIN_LIVE_TESTS=1 + MINDRIAN_BRAIN_KEY
metrics:
  duration: ~8 minutes
  tasks: 7
  files: 2
  completed: 2026-04-15
---

# Phase 85 Plan 85-08: Brain Query Param Name Fix (Finding I) Summary

One-liner: Locked the Brain MCP argument shape for every brain-client.cjs wrapper behind a mock-HTTP regression fence so Finding I and its mirror in brain_write cannot silently return.

## What Shipped

1. **Verification of in-tree fixes.** Confirmed `lib/core/brain-client.cjs` line 155 sends `{ cypher: cypher }` to `brain_query` and line 536 sends `{ cypher: cypher }` to `brain_write`. Both Finding I comment blocks are present and explain the param-name distinction so no one silently reverts them during a refactor. The fixes landed on main in commit 3bcf83d prior to this plan; 85-08 formalizes them with tests.

2. **Param expectation audit table.** Cross-referenced every `callTool(...)` site in `lib/core/brain-client.cjs` against the Brain MCP tool registrations in `mcp-server-brain/lib/neo4j-tools.cjs` and `mcp-server-brain/lib/pinecone-tools.cjs`. Zero mismatches remain.

| Tool          | Source registration                               | Required        | Optional                  | Client site (brain-client.cjs) | Client sends                           | Status |
| ------------- | ------------------------------------------------- | --------------- | ------------------------- | ------------------------------ | -------------------------------------- | ------ |
| brain_schema  | neo4j-tools.cjs L28, empty schema `{}`            | (none)          | (none)                    | L211 `schema()`                | `{}`                                   | OK     |
| brain_query   | neo4j-tools.cjs L55, `{ cypher, params? }`        | `cypher`        | `params`                  | L155 `query(cypher)`           | `{ cypher: cypher }`                   | OK (Finding I fixed) |
| brain_write   | neo4j-tools.cjs L77, `{ cypher, params? }`        | `cypher`        | `params`                  | L536 `write(cypher)`           | `{ cypher: cypher }`                   | OK (Finding I sibling fixed) |
| brain_search  | pinecone-tools.cjs L27, `{ query, namespace?, topK?, filter? }` | `query`         | `namespace`, `topK`, `filter` | L163 `search(q, opts)`         | `{ query, namespace, topK }`           | OK (brain_search legitimately takes `query`) |
| brain_stats   | pinecone-tools.cjs L70, empty schema `{}`         | (none)          | (none)                    | L218 `stats()`                 | `{}`                                   | OK     |

**Zero drift detected.** Every client call site matches its tool-side registration exactly.

3. **Regression test `tests/test-brain-client-params.cjs`.** New 300-line CJS test that:
   - Spins up a mock HTTP server on a random loopback port using Node built-in `http`
   - Overrides `MINDRIAN_BRAIN_URL` before requiring brain-client (module-scoped BRAIN_URL at line 21)
   - Invokes every exported wrapper (`query`, `write`, `search`, `schema`, `stats`)
   - Captures each outgoing JSON-RPC `tools/call` body and asserts the `arguments` object matches the Brain MCP schema: required keys present, no unexpected keys, string values round-trip untouched
   - Includes two dedicated Finding I regression assertions that fail loudly if anyone reintroduces `{ query: cypher }` into brain_query or brain_write
   - Covers an exhaustiveness check asserting all five expected wrappers are exported (forces future authors of a new wrapper to extend this file)

4. **Live-integration smoke test.** Gated behind `process.env.BRAIN_LIVE_TESTS === '1'` with a `MINDRIAN_BRAIN_KEY` presence check. Tears down the mock, re-requires brain-client against the real Brain URL, runs `brain.query('RETURN 1 AS n')` and asserts a non-null result. SKIPs cleanly with a clear reason on normal runs so CI stays green without a real key.

5. **Registered in `lib/memory/run-feynman-tests.cjs`.** Added after the 85-04 run-hook.cmd test with a `Phase 85-08 (WIN-FIX-I)` comment. Runner now reports **15/15 test files passed**, up from 14/14.

## Test Run

```
$ MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs
...
PASS tests/test-run-hook-cmd.cjs
brain-client param schema regression suite
  ok  brain.query sends { cypher } not { query }
  ok  brain.write sends { cypher } not { query }
  ok  brain.search sends { query, namespace, topK } per brain_search schema
  ok  brain.schema sends {} (no params)
  ok  brain.stats sends {} (no params)
  ok  brain-client exported wrappers are fully covered
  SKIP live brain smoke test (set BRAIN_LIVE_TESTS=1 and MINDRIAN_BRAIN_KEY to run)

brain-client params suite: PASS (0 failures)
PASS tests/test-brain-client-params.cjs

Feynman test runner: 15/15 test files passed
```

## Deviations from Plan

None. Plan executed as written. Task 8 (CHANGELOG entry) and task 9 (commit message format) are handled by 85-07 release gate, not by this plan; the fix itself ships with the release commit, and 85-08's scope is test infrastructure only.

## Constraint compliance

- No em-dashes in any new file or this summary. Hyphens used throughout.
- CJS only. No new runtime deps. Node built-in `http` and `node:assert/strict` only.
- Workspace verified as `/home/jsagi/MindrianOS-Plugin/` before any edits.

## Files Touched

- `tests/test-brain-client-params.cjs` (new, 310 lines)
- `lib/memory/run-feynman-tests.cjs` (+2 lines: registration)

## Self-Check: PASSED

- tests/test-brain-client-params.cjs exists and runs green standalone
- lib/memory/run-feynman-tests.cjs registers the new test file
- Full feynman suite reports 15/15 green
- brain-client.cjs line 155 confirmed `{ cypher: cypher }`
- brain-client.cjs line 536 confirmed `{ cypher: cypher }`
- All five Brain MCP tool registrations matched against client call sites with zero drift
