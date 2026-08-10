# ADDENDUM 2026-08-10: the Lane B / admin-key assumption is WRONG - read before 249-03 / 247-03

Source: `docs/brain-audit-2026-08-10/2026-08-10-HANDOFF-brain-service-audit.md` (sections 5, 13),
the Brain SERVICE audit from the Windows machine, filed after the 246/247/249 plans were written.

## What changes

The 246-02 Lane B checkpoint and the 249-03/247-03 admin ceremonies instruct the operator to
"read a key from Render BRAIN_HTTP_ADMIN_KEYS". That path DOES NOT EXIST as assumed:

- `src/http/app.mjs:36`: admin tools register over HTTPS only when `loopback` OR
  `process.env.BRAIN_HTTP_ADMIN === 'allow'`. Render sets `BRAIN_HTTP_HOST=0.0.0.0`
  (non-loopback) and NEVER declares `BRAIN_HTTP_ADMIN`.
- Therefore `registerAdminTools()` returns empty over HTTPS: `brain_query` and `brain_write`
  are not admin-KEYED on the public surface, they are NOT REGISTERED at all.
- Over stdio (loopback) they exist. The 403s observed on 2026-08-10 were
  authenticated-and-forbidden responses, consistent with this gate.

## The operator's real options for Lane B / the enrichment writes (navigator decision,
handoff section 13 item 1 - "nothing else is worth doing first"):

- **(a) Bounded read tier** (the handoff's implied preferred direction): moat-capped Cypher
  without admin, a security DESIGN change in the brain repo, not a toggle.
- **(b) `BRAIN_HTTP_ADMIN=allow` on Render**: exposes raw Cypher (and brain_write) on a public
  key. Fast, dangerous; if chosen, scope it to a temporary window for the ceremony.
- **(c) Local twin execution**: run the census/collapse/ingest against the local Memgraph twin
  and re-migrate, accepting drift risk (the 246-02 fallback Option B).
- **(d) stdio on a loopback tunnel to the Render box**: not available on Render's platform.

Until the navigator rules, 249-03 Task 3 and 247-03 Task 2 CANNOT run as written. The
enrichment dry-run/diff machinery (249-02) and everything read-tier is unaffected.

## Also folded from the audit (smaller, same repos)

- `text2cypher` is one env var (`OLLAMA_BASE_URL`) from executing model-authored raw Cypher
  with NO moat caps on a public read key - strengthens 247's retire decision; hard-gate or
  delete, never leave as-is.
- Four tool descriptions in `bin/mindrian-brain-mcp-client.cjs` still name Pinecone/Neo4j
  (retired 2026-07-23). Free fix; fold into the next plugin-side executor pass.
- The corrected five-step test prompt (audit section 12, PASS/FAIL/BLOCKED semantics including
  the expected-BLOCKED brain_query leg) SUPERSEDES the three-call prompt in the 246-01
  checkpoint text.
