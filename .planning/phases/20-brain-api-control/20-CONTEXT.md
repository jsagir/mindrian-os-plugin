# Phase 20: Brain API Control - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a complete Brain API key management system: Supabase table for key storage with expiry/usage tracking, admin CLI tool for key lifecycle (create/revoke/extend/list/usage), wire Supabase credentials into Render, block brain_write for non-admin keys, and email notification on new access requests.

</domain>

<decisions>
## Implementation Decisions

### Key Storage
- **D-01:** Supabase `brain_api_keys` table is the primary key store. Env var `BRAIN_API_KEYS` remains as fallback when Supabase is unreachable.
- **D-02:** Table schema: `id` (uuid pk), `api_key` (uuid, unique), `email` (text), `name` (text), `plan` (text: free/pro/admin), `is_active` (bool), `expires_at` (timestamptz, nullable for permanent keys), `created_at`, `last_used_at`, `request_count` (int), `created_by` (text).
- **D-03:** Lawrence Aronhime gets a permanent key (no expiry). Default expiry for other keys: 30 days.
- [auto] Selected recommended: Supabase RPC function `validate_brain_key(key)` already referenced in auth.cjs — create the matching function + table.

### Admin CLI Tool
- **D-04:** Admin tool is `mcp-server-brain/brain-admin.cjs` — a standalone Node.js CLI script. NOT a plugin command (runs directly on server machine or locally).
- **D-05:** Commands: `create --email X --days N --plan free|pro|admin --name "Name"`, `revoke --email X`, `extend --email X --days N`, `list`, `usage [--email X]`.
- **D-06:** Output follows MindrianOS CLI UI patterns — status cards, color discipline, structured output.
- [auto] Selected recommended: CLI tool over web admin panel — faster to build, Jonathan uses terminal.

### Write Protection
- **D-07:** `brain_write` tool checks `req.brainPlan` — only `admin` plan keys can write. All other plans get read-only access (brain_query, brain_schema, brain_search, brain_ask, brain_stats).
- **D-08:** Error message for blocked writes: "Write access requires admin key. Contact Jonathan for elevated access."
- [auto] Selected recommended: Plan-based gating in neo4j-tools.cjs, not a separate middleware layer.

### Email Notification
- **D-09:** Use Supabase Edge Function or simple webhook to send email notification to Jonathan when a new access request arrives.
- **D-10:** Access request form at existing URL (mindrianos-jsagirs-projects.vercel.app/brain-access) writes to a `brain_access_requests` table. Brain-admin.cjs can list pending requests.
- [auto] Selected recommended: Supabase DB webhook + Resend/SendGrid for email — lightweight, no additional server.

### Render Wiring
- **D-11:** Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to Render env vars via Render MCP tool.
- **D-12:** Existing auth.cjs already has Supabase mode — just needs the credentials and the table to exist.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Brain Server
- `mcp-server-brain/lib/auth.cjs` — Existing auth middleware with Supabase + env var fallback. Already references validate_brain_key RPC.
- `mcp-server-brain/lib/neo4j-tools.cjs` — brain_write tool that needs plan-based gating.
- `mcp-server-brain/server.cjs` — Express server setup, route wiring.
- `mcp-server-brain/render.yaml` — Render deployment config.
- `mcp-server-brain/.env.example` — Env var reference including SUPABASE_SERVICE_KEY.

### Plugin Docs
- `docs/brain-setup.md` — User-facing Brain setup documentation (needs update after this phase).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `auth.cjs`: Full Supabase validation with 5-min cache, usage tracking, plan attachment to req — just needs the table + credentials.
- `validateViaSupabase()`: Already calls `validate_brain_key` RPC — we create the matching function.
- `validateViaEnvVar()`: Fallback mode works — Lawrence's key already added to BRAIN_API_KEYS env var.
- Render MCP tools available (`mcp__render__update_environment_variables`) — can wire Supabase creds programmatically.

### Established Patterns
- Express middleware chain: auth → route handler → MCP tool execution.
- `req.brainPlan` and `req.brainEmail` already attached by auth middleware — downstream tools can check these.
- GSD `gsd-tools.cjs` pattern for CLI tools — can follow same structure for brain-admin.cjs.

### Integration Points
- `server.cjs` applies `validateApiKey` middleware to POST /mcp route.
- `neo4j-tools.cjs` `brain_write` tool needs plan check added (currently no authorization beyond key validation).
- Render dashboard env vars — need SUPABASE_URL and SUPABASE_SERVICE_KEY added.

</code_context>

<specifics>
## Specific Ideas

- Admin panel must self-teach — every invocation explains what each action does before executing (from UI ruling system design).
- Lawrence Aronhime has permanent access (key: 4131ed5b-6001-483e-bb2c-2c4d7a3c8e05, already deployed to Render BRAIN_API_KEYS).
- Jonathan is the sole admin — identity-based, not password-based.
- The admin CLI should follow the same visual patterns as MindrianOS terminal output (status cards, color discipline, structured output).

</specifics>

<deferred>
## Deferred Ideas

- Web-based admin dashboard (Phase 22 — Admin Panel covers the self-teaching UX)
- Stripe integration for paid Brain access (out of scope for v4.0)
- Rate limiting per key/plan (future enhancement)
- Key rotation / auto-renewal (future enhancement)

</deferred>

---

*Phase: 20-brain-api-control*
*Context gathered: 2026-03-26*
