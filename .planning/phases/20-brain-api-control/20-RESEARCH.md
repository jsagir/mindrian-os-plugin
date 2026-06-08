# Phase 20: Brain API Control - Research

**Researched:** 2026-03-26
**Domain:** Supabase key management, Node.js CLI tooling, Express middleware authorization, Render environment wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Supabase `brain_api_keys` table is the primary key store. Env var `BRAIN_API_KEYS` remains as fallback when Supabase is unreachable.
- **D-02:** Table schema: `id` (uuid pk), `api_key` (uuid, unique), `email` (text), `name` (text), `plan` (text: free/pro/admin), `is_active` (bool), `expires_at` (timestamptz, nullable for permanent keys), `created_at`, `last_used_at`, `request_count` (int), `created_by` (text).
- **D-03:** Lawrence Aronhime gets a permanent key (no expiry). Default expiry for other keys: 30 days.
- **D-04:** Admin tool is `mcp-server-brain/brain-admin.cjs` — a standalone Node.js CLI script. NOT a plugin command (runs directly on server machine or locally).
- **D-05:** Commands: `create --email X --days N --plan free|pro|admin --name "Name"`, `revoke --email X`, `extend --email X --days N`, `list`, `usage [--email X]`.
- **D-06:** Output follows MindrianOS CLI UI patterns — status cards, color discipline, structured output.
- **D-07:** `brain_write` tool checks `req.brainPlan` — only `admin` plan keys can write. All other plans get read-only access.
- **D-08:** Error message for blocked writes: "Write access requires admin key. Contact Jonathan for elevated access."
- **D-09:** Use Supabase Edge Function or simple webhook to send email notification to Jonathan when a new access request arrives.
- **D-10:** Access request form at existing URL writes to a `brain_access_requests` table. Brain-admin.cjs can list pending requests.
- **D-11:** Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to Render env vars via Render MCP tool.
- **D-12:** Existing auth.cjs already has Supabase mode — just needs the credentials and the table to exist.

### Claude's Discretion

- Exact Supabase table column constraints (NOT NULL, defaults)
- RPC function implementation details
- brain-admin.cjs internal architecture
- Error message exact wording (beyond D-08)

### Deferred Ideas (OUT OF SCOPE)

- Web-based admin dashboard (Phase 22)
- Stripe integration for paid Brain access
- Rate limiting per key/plan
- Key rotation / auto-renewal
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAIN-01 | Admin can create time-limited API keys for Brain access via CLI command | brain-admin.cjs `create` subcommand; Supabase REST `INSERT` into brain_api_keys |
| BRAIN-02 | Admin can revoke, extend, and list active Brain keys | brain-admin.cjs `revoke`, `extend`, `list`, `usage` subcommands; Supabase REST `UPDATE`/`SELECT` |
| BRAIN-03 | Supabase `brain_api_keys` table with expiry, usage tracking, plan tier | SQL DDL + `validate_brain_key` RPC function; existing auth.cjs already calls the RPC |
| BRAIN-04 | `brain_write` tool blocked for non-admin API keys | Three-line guard in neo4j-tools.cjs `brain_write` handler; `req.brainPlan` already attached |
| BRAIN-05 | Email notification sent to admin when new access is requested | Supabase Database Webhook → Resend HTTP call; or Edge Function triggered by INSERT on brain_access_requests |
| BRAIN-06 | Supabase credentials wired into Render for production auth | Render MCP tool `mcp__render__update_environment_variables`; add SUPABASE_URL + SUPABASE_SERVICE_KEY |
</phase_requirements>

---

## Summary

Phase 20 is 80% already built. The auth middleware (`auth.cjs`) already speaks the full Supabase protocol — 5-min cache, usage tracking, plan attachment to `req.brainPlan`. What is missing is (1) the Supabase table + RPC function that auth.cjs is already calling, (2) a plan guard inside `brain_write`, (3) a CLI for key lifecycle, and (4) wiring Supabase credentials into Render. The email notification path has two viable options (Database Webhook vs Edge Function) that are equally lightweight.

The biggest integration risk is the Supabase `validate_brain_key` RPC: auth.cjs calls it via `POST /rest/v1/rpc/validate_brain_key` with `{ key }` body and expects an array of rows with `plan` and `email` fields. The SQL function must match this exact contract.

The admin CLI (`brain-admin.cjs`) needs zero new npm dependencies — Node 20's native `fetch` covers all Supabase REST calls, and the tool already lives in the same directory as the server, making local env var loading via `dotenv` (or manual `.env` read) straightforward.

**Primary recommendation:** Build in four sequential tasks: (1) Supabase schema + RPC, (2) Render env wiring, (3) brain_write guard, (4) brain-admin.cjs CLI. Email notification is a fifth task that can run independently after (1).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js native `fetch` | built-in (Node 20) | Supabase REST API calls from brain-admin.cjs | No extra dependency; already used in auth.cjs server-side |
| Supabase REST API | v1 (stable) | Table CRUD + RPC invocation | Already wired in auth.cjs; service key bypasses RLS |
| Supabase Postgres functions | plpgsql | `validate_brain_key` RPC + `brain_access_requests` trigger | Native to Supabase; called by existing code |
| `crypto.randomUUID()` | built-in (Node 14.17+) | API key generation | No dependency; used in Node 20 everywhere |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | 2.100.0 | Optional — higher-level client | NOT needed for brain-admin.cjs; plain fetch matches existing auth.cjs pattern |
| Resend | 6.9.4 (npm) | Transactional email for access notifications | If Edge Function chosen for BRAIN-05 |
| `dotenv` | built-in pattern via `require` | Load .env for local CLI runs | brain-admin.cjs can read `.env` with a 10-line parser to avoid adding a dependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase REST (plain fetch) | `@supabase/supabase-js` | JS SDK adds 400KB dep and different API shape — plain fetch matches existing auth.cjs code and keeps brain-admin.cjs zero-dependency |
| Resend (for email) | SendGrid | Resend has simpler API + free tier; SendGrid requires domain authentication setup. Either works — Resend recommended by D-09 context. |
| Supabase DB Webhook | Edge Function | Webhook calls an external HTTPS endpoint; Edge Function runs within Supabase. Webhook is simpler (no Deno deploy needed) but requires a public endpoint. Edge Function is self-contained. |

**Installation (for email path only, if chosen):**
```bash
# No new dependencies needed for brain-admin.cjs
# If adding email via Edge Function (Deno, no npm):
# Resend is imported via URL in the Edge Function directly
```

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
mcp-server-brain/
├── lib/
│   ├── auth.cjs              # EXISTING — no changes needed
│   └── neo4j-tools.cjs       # MODIFY — add plan guard to brain_write
├── brain-admin.cjs           # NEW — standalone CLI for key management
├── sql/
│   └── 01-brain-api-keys.sql # NEW — table DDL + RPC function
├── server.cjs                # EXISTING — no changes needed
└── render.yaml               # MODIFY — add SUPABASE_URL + SUPABASE_SERVICE_KEY
```

Supabase side:
```
Supabase project (ulmymxxmvsehjiyymqoi):
├── brain_api_keys table       # NEW — key store
├── brain_access_requests table # NEW — access request queue
├── validate_brain_key() RPC   # NEW — called by auth.cjs
└── DB Webhook / Edge Function # NEW — email on new request
```

### Pattern 1: Supabase RPC Function Contract

The `validate_brain_key` function is called by auth.cjs as:
```
POST https://ulmymxxmvsehjiyymqoi.supabase.co/rest/v1/rpc/validate_brain_key
Headers: apikey: <service_key>, Authorization: Bearer <service_key>
Body: { "key": "<uuid>" }
Response: array of { plan, email } rows (empty array = invalid key)
```

The function must also update `last_used_at` and increment `request_count`. This side-effect MUST happen inside the SQL function — auth.cjs does not make a separate UPDATE call.

```sql
-- Source: Supabase Postgres Functions documentation
CREATE OR REPLACE FUNCTION validate_brain_key(key uuid)
RETURNS TABLE(plan text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update usage stats atomically
  UPDATE brain_api_keys
  SET last_used_at = now(),
      request_count = request_count + 1
  WHERE api_key = key
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  -- Return the matching row's plan + email (empty if no match)
  RETURN QUERY
  SELECT b.plan, b.email
  FROM brain_api_keys b
  WHERE b.api_key = key
    AND b.is_active = true
    AND (b.expires_at IS NULL OR b.expires_at > now());
END;
$$;
```

**Key insight:** The UPDATE + SELECT must be in the same function because auth.cjs only makes ONE call. The SECURITY DEFINER clause is required so the function can bypass RLS when called with the anon key — but since we call with the service key, either works. Use SECURITY DEFINER for robustness.

### Pattern 2: brain_write Plan Guard

The guard is 4 lines inserted at the top of the brain_write tool handler. The `req` object is not passed to tool handlers by the MCP SDK — the guard must happen at the route level, not inside the tool itself.

**Critical finding:** The MCP server creates a new `McpServer` instance per request (stateless), but `req.brainPlan` is available at the Express route level. Tool handlers in `registerNeo4jTools(server)` do NOT have access to `req` — the server object is just a tool registry.

**Solution:** Pass the plan as context during server construction, or check plan before registering `brain_write`. The clearest pattern:

```javascript
// In server.cjs — pass plan when registering tools
app.post('/mcp', async (req, res) => {
  const server = new McpServer({ name: 'mindrian-brain', version: '1.0.0' });

  registerNeo4jTools(server, { plan: req.brainPlan });  // pass plan
  registerPineconeTools(server);
  registerBrainAsk(server);
  // ...
});
```

```javascript
// In neo4j-tools.cjs — accept options, guard brain_write
function registerNeo4jTools(server, options = {}) {
  const { plan } = options;
  // ... brain_schema and brain_query registrations unchanged ...

  server.tool('brain_write', '...', { cypher, params }, async ({ cypher, params }) => {
    if (plan !== 'admin') {
      return {
        content: [{ type: 'text', text: 'Write access requires admin key. Contact Jonathan for elevated access.' }],
        isError: true
      };
    }
    // existing write logic...
  });
}
```

This is the minimal change — two files touched, no middleware added.

### Pattern 3: brain-admin.cjs CLI Structure

```javascript
#!/usr/bin/env node
'use strict';

// Load .env manually (no dotenv dependency)
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#') && !process.env[k]) {
      process.env[k] = v.join('=').trim();
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Supabase REST helper (no SDK needed)
async function supa(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// Command dispatch
const [,, cmd, ...args] = process.argv;
// parse args into flags object...
// dispatch to create/revoke/extend/list/usage functions
```

### Pattern 4: Supabase Database Webhook for Email

Supabase Database Webhooks (available on all plans) fire an HTTP POST to a URL on INSERT/UPDATE/DELETE. For BRAIN-05:

1. Create table `brain_access_requests` with columns: `id`, `email`, `name`, `message`, `created_at`
2. Create a Database Webhook in Supabase Dashboard → Database → Webhooks
3. Trigger: INSERT on `brain_access_requests`
4. Target: `https://api.resend.com/emails` with Resend API key in headers

The Supabase webhook body format:
```json
{
  "type": "INSERT",
  "table": "brain_access_requests",
  "record": { "email": "...", "name": "...", "message": "..." },
  "schema": "public"
}
```

**Alternative (simpler):** Supabase Edge Function triggered by webhook. Deno runtime, deploy via Supabase CLI. Adds Supabase CLI as a dependency. The Database Webhook → Resend HTTP call approach has no additional tooling requirement.

### Anti-Patterns to Avoid

- **Registering brain_write without context:** The default `registerNeo4jTools(server)` call in server.cjs currently passes no plan. If you only add the guard in neo4j-tools.cjs without changing the server.cjs call signature, the plan will always be `undefined` and all writes will be blocked — including admin keys.
- **Using the anon key for admin CLI:** brain-admin.cjs MUST use the `SUPABASE_SERVICE_KEY` (service role), not the anon key. The service key bypasses RLS and can write to the table. Never put the service key in client-side code.
- **Caching invalidation gap:** auth.cjs caches keys for 5 minutes. After `revoke`, the old key may still work for up to 5 minutes. This is documented behavior — acceptable for this phase. Do not try to clear the cache remotely.
- **UUID vs string key format:** The `api_key` column is type `uuid`. The `validate_brain_key` RPC parameter is also `uuid`. Lawrence's existing key (`4131ed5b-6001-483e-bb2c-2c4d7a3c8e05`) is already UUID-format — the seed INSERT for Lawrence's key must match exactly. Do NOT cast as text.
- **render.yaml vs Render MCP:** render.yaml already lists `BRAIN_API_KEYS sync: false` — it does NOT list SUPABASE_URL or SUPABASE_SERVICE_KEY. Adding them to render.yaml would expose the service key in git. Use the Render MCP tool to set them, or document as manual dashboard step. Do NOT add SUPABASE_SERVICE_KEY to render.yaml.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | custom random string | `crypto.randomUUID()` | Built-in, RFC 4122 compliant, matches column type |
| Expiry calculation | date arithmetic | `new Date(Date.now() + days * 86400000).toISOString()` | One-liner; Supabase stores as timestamptz |
| Supabase REST calls | custom HTTP wrapper | Plain `fetch` with the 4-header pattern already in auth.cjs | Consistent with existing code; zero deps |
| Table migrations | raw SQL run manually | Capture in `sql/01-brain-api-keys.sql` committed to repo | Reproducible; documents the schema |
| Key validation logic | rewriting auth.cjs | The RPC function — auth.cjs already calls the correct endpoint | auth.cjs is already correct; just build what it calls |

**Key insight:** The hardest part of this phase (auth middleware) is already done. The remaining work is database setup + a thin CLI wrapper around REST calls.

---

## Runtime State Inventory

> This is not a rename/refactor phase. However, there is one runtime state item that must be addressed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Lawrence's key `4131ed5b-6001-483e-bb2c-2c4d7a3c8e05` in `BRAIN_API_KEYS` env var on Render | INSERT into brain_api_keys with `expires_at = NULL`, `plan = 'admin'`, `is_active = true` to match |
| Live service config | Render env var `BRAIN_API_KEYS` — remains as fallback, value unchanged | No change to env var; just add SUPABASE_URL and SUPABASE_SERVICE_KEY alongside it |
| OS-registered state | None | None |
| Secrets/env vars | `SUPABASE_SERVICE_KEY` — must be set in Render but NOT committed to git or render.yaml | Set via Render MCP tool only |
| Build artifacts | None | None |

**Critical:** If Lawrence's key is not seeded into `brain_api_keys` table with `plan = 'admin'`, he will lose write access once Supabase is wired in. His key must be in BOTH the env var (fallback) AND the table (primary). Auth.cjs tries Supabase first, then falls back to env var — so during the transition window before the table exists, env var fallback keeps him working.

---

## Common Pitfalls

### Pitfall 1: MCP Tool Handlers Have No Request Context

**What goes wrong:** Developer adds `if (req.brainPlan !== 'admin')` inside the `brain_write` async handler — `req` is undefined, the check throws, all writes fail with a 500.

**Why it happens:** The MCP SDK tool handlers are registered on a `McpServer` instance. The MCP server is created inside the Express route handler (`app.post('/mcp', ...)`) but tool handlers are pure functions with no closure over `req`.

**How to avoid:** Pass `plan` as a parameter to `registerNeo4jTools(server, { plan: req.brainPlan })`. The plan value closes over the handler function when the tool is registered on that request's server instance.

**Warning signs:** `ReferenceError: req is not defined` inside the brain_write callback, or silent plan = undefined causing all writes to be blocked.

### Pitfall 2: validate_brain_key Returns Wrong Shape

**What goes wrong:** auth.cjs expects `rows[0].plan` and `rows[0].email`. If the RPC returns a single object instead of an array, `rows[0]` is undefined and all keys fail validation (401 on every request).

**Why it happens:** Postgres `RETURNS TABLE` functions return arrays via REST. `RETURNS RECORD` or `RETURNS SETOF` with different syntax returns differently shaped JSON. Using `RETURNS TABLE(plan text, email text)` + `RETURN QUERY SELECT...` is the correct pattern.

**How to avoid:** Test the RPC directly with curl before wiring Supabase credentials into Render:
```bash
curl -X POST 'https://ulmymxxmvsehjiyymqoi.supabase.co/rest/v1/rpc/validate_brain_key' \
  -H 'apikey: <service_key>' \
  -H 'Authorization: Bearer <service_key>' \
  -H 'Content-Type: application/json' \
  -d '{"key": "4131ed5b-6001-483e-bb2c-2c4d7a3c8e05"}'
# Expected: [{"plan":"admin","email":"lawrence@..."}]
```

**Warning signs:** Empty array `[]` returned for a key you know is valid; `rows.length === 0` branch always taken.

### Pitfall 3: Render Cold Start Invalidates the 5-Min Cache

**What goes wrong:** Render free tier spins down after 15 minutes idle. On cold start, the in-memory `keyCache` Map is empty. First request hits Supabase — this is correct. But if Supabase is slow (>5s) on first hit, the request times out and falls back to env var. This is acceptable behavior and by design (D-01 fallback).

**Why it happens:** In-memory cache is process-local. Render free tier restarts processes.

**How to avoid:** No action needed — the fallback chain in auth.cjs already handles this correctly. Document it in `docs/brain-setup.md` under Troubleshooting.

**Warning signs:** Users report intermittent auth failures on first request after a long idle period — this is expected, not a bug.

### Pitfall 4: Supabase Service Key in Git

**What goes wrong:** Developer adds `SUPABASE_SERVICE_KEY` to `render.yaml` for convenience. The key is now in version history. Anyone with repo access can write to the brain_api_keys table.

**Why it happens:** render.yaml is the obvious place to add env vars.

**How to avoid:** render.yaml uses `sync: false` for secrets — this means Render knows the variable exists but doesn't expose it in the file. However, the VALUE must be set via the Render dashboard or Render MCP tool. Never put the actual key value in render.yaml.

**Warning signs:** `git diff render.yaml` shows a line with `SUPABASE_SERVICE_KEY: eyJ...`.

### Pitfall 5: brain_access_requests Table Not Created Before Webhook

**What goes wrong:** The Database Webhook fires on INSERT to `brain_access_requests`, but if the Vercel access request form already has users submitting — and the table doesn't exist yet — requests are silently lost.

**Why it happens:** BRAIN-05 depends on BRAIN-03 (table creation). The access form URL is already live.

**How to avoid:** Create both `brain_api_keys` AND `brain_access_requests` in the same SQL migration (task 1). Don't wait for a later task to create the second table.

---

## Code Examples

Verified patterns from existing code + Supabase REST documentation:

### Creating a Key (brain-admin.cjs `create` command)

```javascript
// Source: auth.cjs pattern + Supabase REST v1 docs
async function createKey({ email, name, plan, days }) {
  const apiKey = crypto.randomUUID();
  const expiresAt = days
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const rows = await supa('POST', 'brain_api_keys', {
    api_key: apiKey,
    email,
    name,
    plan,
    is_active: true,
    expires_at: expiresAt,
    request_count: 0,
    created_by: 'jonathan',
  });

  return { apiKey, expiresAt, rows };
}
```

### Revoking a Key (brain-admin.cjs `revoke` command)

```javascript
// Supabase REST PATCH with eq filter in query string
async function revokeKey(email) {
  return supa('PATCH', `brain_api_keys?email=eq.${encodeURIComponent(email)}`, {
    is_active: false,
  });
}
```

### Listing Keys (brain-admin.cjs `list` command)

```javascript
// SELECT with ordering — Supabase REST GET with query params
async function listKeys() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/brain_api_keys?select=email,name,plan,is_active,expires_at,last_used_at,request_count&order=created_at.desc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  return res.json();
}
```

### brain_write Plan Guard (neo4j-tools.cjs)

```javascript
// Source: existing brain_write handler + req.brainPlan pattern from auth.cjs
function registerNeo4jTools(server, options = {}) {
  const { plan } = options;

  // brain_schema + brain_query registrations unchanged...

  server.tool(
    'brain_write',
    'Write data to the Brain knowledge graph (creates/updates nodes and relationships)',
    {
      cypher: z.string().describe('Write Cypher query'),
      params: z.record(z.any()).optional().describe('Query parameters'),
    },
    async ({ cypher, params }) => {
      if (plan !== 'admin') {
        return {
          content: [{ type: 'text', text: 'Write access requires admin key. Contact Jonathan for elevated access.' }],
          isError: true,
        };
      }
      // existing write logic unchanged
      const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
      // ...
    }
  );
}
```

### SQL DDL for brain_api_keys Table

```sql
-- Creates the table that validate_brain_key() reads from
CREATE TABLE IF NOT EXISTS brain_api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key       uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL DEFAULT '',
  plan          text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'admin')),
  is_active     boolean NOT NULL DEFAULT true,
  expires_at    timestamptz,          -- NULL = permanent
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  request_count integer NOT NULL DEFAULT 0,
  created_by    text NOT NULL DEFAULT 'jonathan'
);

-- Seed Lawrence's permanent key
INSERT INTO brain_api_keys (api_key, email, name, plan, is_active, expires_at)
VALUES (
  '4131ed5b-6001-483e-bb2c-2c4d7a3c8e05',
  'lawrence@mindrian-os.com',   -- confirm actual email
  'Lawrence Aronhime',
  'admin',
  true,
  NULL                      -- permanent
) ON CONFLICT (api_key) DO NOTHING;
```

### SQL DDL for brain_access_requests Table

```sql
CREATE TABLE IF NOT EXISTS brain_access_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  name        text NOT NULL DEFAULT '',
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed    boolean NOT NULL DEFAULT false
);
```

### validate_brain_key RPC Function

```sql
CREATE OR REPLACE FUNCTION validate_brain_key(key uuid)
RETURNS TABLE(plan text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atomically track usage
  UPDATE brain_api_keys
  SET last_used_at = now(),
      request_count = request_count + 1
  WHERE api_key = key
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  -- Return matching row (empty set = invalid/expired/inactive)
  RETURN QUERY
  SELECT b.plan::text, b.email::text
  FROM brain_api_keys b
  WHERE b.api_key = key
    AND b.is_active = true
    AND (b.expires_at IS NULL OR b.expires_at > now());
END;
$$;
```

### render.yaml Addition (safe pattern — no secret value)

```yaml
# Add to existing envVars list in render.yaml:
- key: SUPABASE_URL
  value: https://ulmymxxmvsehjiyymqoi.supabase.co   # safe — public URL
- key: SUPABASE_SERVICE_KEY
  sync: false   # value set via Render dashboard/MCP tool, NEVER in this file
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Env var key list (BRAIN_API_KEYS) | Supabase table + RPC with expiry/tracking | This phase | Enables key lifecycle management without server redeploy |
| No write protection | Plan-based `brain_write` guard | This phase | Admin keys only can write; free/pro keys read-only |
| Manual key provisioning (generate UUID, copy to Render) | brain-admin.cjs CLI | This phase | Jonathan can create/revoke/extend in seconds from terminal |

**Env var fallback remains:** The existing BRAIN_API_KEYS env var continues to work as the last-resort fallback. Lawrence's key works even if Supabase is unreachable. This is a deliberate design choice (D-01).

---

## Open Questions

1. **Lawrence's actual email address**
   - What we know: Key `4131ed5b-6001-483e-bb2c-2c4d7a3c8e05` is seeded in BRAIN_API_KEYS. The docs reference `support@mindrian-os.com` for contact.
   - What's unclear: The exact email to put in the `email` column for Lawrence's row.
   - Recommendation: Use `lawrence@mindrian-os.com` as placeholder; Jonathan knows the correct value and should verify before running the seed INSERT.

2. **Email service for BRAIN-05: Supabase Webhook vs Edge Function**
   - What we know: D-09 says "Supabase Edge Function or simple webhook." Both are viable.
   - What's unclear: Whether Jonathan has a Resend account/API key already.
   - Recommendation: Default to Supabase Database Webhook → direct Resend HTTP POST (no Deno required). If Jonathan has no Resend account, use the `brain_access_requests` table + `brain-admin.cjs list-requests` command as the notification path (pure CLI, no email dependency). BRAIN-05 can be implemented as "list pending requests" in the CLI first, with email as a follow-up.

3. **Access request form at Vercel — does it write to brain_access_requests today?**
   - What we know: D-10 says the form at `mindrianos-jsagirs-projects.vercel.app/brain-access` writes to `brain_access_requests`. The table doesn't exist yet.
   - What's unclear: Does the Vercel frontend currently write to Supabase, or is it a static form?
   - Recommendation: Check the Vercel frontend code before creating the table. If the form currently just shows contact info (email Jonathan directly), the `brain_access_requests` table + webhook is net-new work. If it already calls Supabase, the table creation unblocks pending requests.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | brain-admin.cjs | ✓ | v20.19.5 | — |
| npm | package installs | ✓ | 10.8.2 | — |
| Native `fetch` | Supabase REST calls | ✓ | built-in (Node 20) | — |
| `crypto.randomUUID()` | Key generation | ✓ | built-in (Node 14.17+) | — |
| Supabase project | brain_api_keys table | ✓ | Project ID: ulmymxxmvsehjiyymqoi | — |
| Render MCP tool | BRAIN-06 env wiring | ✓ | Available in MCP context | Manual Render dashboard |
| Resend account/API key | BRAIN-05 email | unknown | — | CLI list-requests command |

**Missing dependencies with no fallback:** None that block execution.

**Missing dependencies with fallback:**
- Resend API key: If unavailable, BRAIN-05 implemented as CLI `list-requests` command instead of email push notification.

---

## Validation Architecture

> nyquist_validation key absent from config — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (existing test-brain.cjs pattern) |
| Config file | none — tests are standalone scripts |
| Quick run command | `node mcp-server-brain/test-brain.cjs` |
| Full suite command | `node mcp-server-brain/test-brain.cjs` (same — single file) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAIN-01 | `create` command inserts key into Supabase | integration (mocked) | manual — requires live Supabase | ❌ Wave 0 |
| BRAIN-02 | `revoke`/`extend`/`list` modify correct rows | integration (mocked) | manual — requires live Supabase | ❌ Wave 0 |
| BRAIN-03 | `validate_brain_key` returns plan+email for valid key, empty for invalid | smoke | curl test against live Supabase | ❌ Wave 0 |
| BRAIN-04 | `brain_write` returns error for non-admin keys | unit | `node mcp-server-brain/test-brain.cjs` (extend) | ❌ Wave 0 |
| BRAIN-05 | Email sent or request appears in list | manual | manual observation | manual-only |
| BRAIN-06 | Render responds with 200 on /health after env wiring | smoke | `curl https://mindrian-brain.onrender.com/health` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node mcp-server-brain/test-brain.cjs`
- **Per wave merge:** full curl smoke test against live Brain endpoint
- **Phase gate:** All 6 BRAINs verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Extend `test-brain.cjs` to test brain_write rejection when plan = 'free'
- [ ] Add smoke curl commands to `docs/brain-setup.md` For Administrators section
- [ ] No framework install needed — existing test pattern suffices

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `mcp-server-brain/lib/auth.cjs` — confirmed Supabase RPC call signature, cache behavior, fallback chain, `req.brainPlan` attachment
- Direct code reading: `mcp-server-brain/lib/neo4j-tools.cjs` — confirmed no plan guard exists, tool registration pattern, handler signature
- Direct code reading: `mcp-server-brain/server.cjs` — confirmed stateless per-request server instantiation, `registerNeo4jTools(server)` call without options
- Direct code reading: `mcp-server-brain/.env.example` — confirmed Supabase project URL `ulmymxxmvsehjiyymqoi`, env var names
- Direct code reading: `mcp-server-brain/render.yaml` — confirmed `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` NOT present, `BRAIN_API_KEYS` is present

### Secondary (MEDIUM confidence)
- npm registry: `@supabase/supabase-js@2.100.0`, `resend@6.9.4` — current as of research date
- Node.js 20 docs: native `fetch` and `crypto.randomUUID()` available without import

### Tertiary (LOW confidence)
- Supabase REST API shape for `RETURNS TABLE` functions — standard plpgsql pattern, consistent across versions but not verified against live endpoint in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — auth.cjs already uses the pattern; Node 20 native fetch confirmed
- Architecture: HIGH — code was read directly; the MCP tool handler / req context pitfall is a concrete finding from reading server.cjs
- Pitfalls: HIGH — pitfall 1 (req not in scope) discovered from direct code analysis, not assumed
- SQL schema: HIGH — follows exact column names referenced in auth.cjs (`plan`, `email`, `is_active`, `expires_at`)
- Email notification: MEDIUM — Supabase Webhook mechanism is standard but not verified against live Supabase project

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable Supabase REST API; 30 days)
