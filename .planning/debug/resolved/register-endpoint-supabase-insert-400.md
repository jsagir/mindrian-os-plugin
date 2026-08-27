---
status: resolved
kind: rca
trigger: "register-endpoint-supabase-insert-400"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-08-10T20:55:00Z
updated: 2026-08-10T20:55:00Z
---

## Source-of-Truth Preamble

- CODE claims read against: ProblemsWorthSolving-Brain `origin/main` HEAD @ 2be693e (local checkout in sync, verified same evening)
- WIRE claims probe against: deployed Brain server `pws-brain-mcp.onrender.com` @ 2026-08-10, deploy dep-d9t3dd49v7es73dg9r40 (commit 2be693e) live at 20:39:20Z
- Date of audit: 2026-08-10
- Re-verification rule: source claims verified against origin/main HEAD at filing time.

## Resolution
<!-- OVERWRITE - reflects the final state -->

THREE obstacles, each named live by PostgREST after diagnostic commit 797c6e1
surfaced error codes (never guessed, never assumed):

1. 23502: email NOT NULL without default -> fix ecf3a3b (send email).
2. 23514: brain_api_keys_plan_check did not admit 'install' -> operator DDL
   2026-08-11 (CHECK recreated as free/pro/admin/install).
3. 23503: brain_api_keys_user_id_fkey -> auth.users refuses synthetic install
   UUIDs (nullable but FOREIGN-KEYED - "nullable" from introspection was true
   but incomplete) -> fix 7632c85: installs send NO user_id; the identity
   rides email as <install_id>@install.mindrian.invalid (RFC 2606), which was
   required anyway by obstacle 1. Idempotency scope moved with it.

VERIFIED LIVE 2026-08-11 (deploy of 7632c85): valid UUID -> 200 tier:read
mbr_-shaped token; same UUID -> 200 SAME token; malformed -> 400; and the
minted token authenticates a REAL brain_stats read returning real data
(totalRecordCount present). The SEED-011 silent-identity chain is live end
to end for the first time.

Root lesson (knowledge-base): the mock accepted what production refuses -
a 5/5-green hermetic suite shipped an endpoint that had never once worked.
Schema-shaped mocks must carry the live table's teeth (all three now do),
and OpenAPI introspection CANNOT see CHECK constraints or tell you which
nullable columns are foreign-keyed - only the live error body names those.

## Symptoms
<!-- IMMUTABLE once investigation starts -->

- POST https://pws-brain-mcp.onrender.com/register with a fresh valid UUIDv4 returns
  HTTP 503 {"error":"Registration failed"} - 2 of 2 attempts, 2026-08-10 ~20:39Z.
- Malformed body (non-UUID + extra field) correctly returns HTTP 400 - schema path works.
- /health returns 200 {"status":"ok","graph":true} throughout - /health-is-not-liveness
  proven again, same day as the beta.13 finding.
- Render app logs (srv-d9gfa03tqb8s73csfmtg): `[register:error] Error install insert
  failed: 400` at 20:39:36Z, 20:39:37Z, 20:40:04Z (3 occurrences = this probe's calls).

## Evidence
<!-- APPEND-only -->

- 503 body is "Registration failed" (the catch branch, register.mjs:57), NOT
  "Registration unavailable" (:48) => supabaseConfigured() is TRUE on Render; the
  failure is inside queryInstallRow/insertInstallRow, thrown by
  `install insert failed: 400` (supabase-keys.mjs insertInstallRow).
- Insert payload (supabase-keys.mjs): {user_id: installId, api_key_text: token,
  plan: 'install', status: 'active'} - four columns only, no email/name.
- Website insert into the SAME table sends user_id, email, name, api_key_text, plan,
  status, is_active, expires_at, total_requests, request_count, daily_limit, created_by.
- No base-table DDL exists in any local repo (website migration 001 only ALTERs it);
  the base table was born in the Supabase dashboard => nullability is only readable
  from the live schema.
- The brain repo's own handoff commit (2be693e) already names "the register Supabase
  convention" in its owed list - this defect is that owed item surfacing live.
- Classifier precedent: agent-run curls carrying SUPABASE_SERVICE_KEY blocked twice
  (write probe AND read-only OpenAPI fetch). Diagnosis needs an operator keystroke.
- 2026-08-11 post-fix: email fix (ecf3a3b) DEPLOYED (dep-d9t4atrl550s73fn6ifg live
  21:42:10Z) and register STILL 503s with `install insert failed: 400` - a SECOND
  obstacle behind email. OpenAPI introspection cannot see CHECK constraints; prime
  suspect is a CHECK on `plan` that does not admit 'install' (website inserts use
  plan:'free'). Diagnostic commit 797c6e1 surfaces PostgREST code+bounded message
  in the server log to name it definitively.
- Same battery, CONTRACT-05 legs all green: brain_query admitted on read key
  (bounded rows), CALL...YIELD wrapped form executes (ruling wording HOLDS), CREATE
  refused with BoundedReadRefusal.
- 2026-08-11 21:47:37Z DEFINITIVE: diagnostic logging (797c6e1) names obstacle two:
  `install insert failed: 400 code=23514 msg=new row for relation "brain_api_keys"
  violates check constraint "brain_api_keys_plan_check"` - the plan CHECK does not
  admit 'install'. Fix is DDL (operator, Supabase SQL editor): read the constraint
  def, recreate with 'install' added. Code-side fix REJECTED: reusing an admitted
  value like 'free' contaminates install tokens with trial semantics (expires_at
  sweeps, daily limits) - plan='install' is load-bearing for idempotency scoping
  (queryInstallRow filters plan=eq.install) and for D4's key taxonomy.

## Eliminated
<!-- APPEND-only -->

- Supabase env vars missing on Render: eliminated - would produce 503
  "Registration unavailable" (the `!minted` branch), observed body is "Registration failed".
- Deploy not live / old code serving: eliminated - deploy dep-d9t3c2b7uimc73af7p90
  (register commit 01ac1fc) live at 20:36:30Z, before all probe calls; the follow-up
  docs deploy live at 20:39:20Z.
- Rate limiting (429 path): eliminated - status is 503, and only ~3 calls were made.
- Malformed-request handling: eliminated - the 400 leg behaves per contract.

## Scope and Impact

- HONEST-03 / SEED-011 Option A (silent per-install identity): keyless fresh installs
  cannot mint a READ token => the plugin's silent-registration ladder leg lands on a
  dead endpoint. Keyed users unaffected (ladder: keyed users always win).
- v2.0.0-beta.1 release: the release remains the outage fix for KEYED users (beta.13
  dead brain-client leg); register brokenness degrades only the keyless leg. Ship/hold
  is a navigator call.

## Required Code Changes

- Brain repo (after the live schema is read): EITHER widen insertInstallRow to the
  website's column convention (email: '', name: 'install', created_by: 'register',
  is_active: true, plus whatever NOT NULLs surface) - AND resolve the auth.users FK
  question for synthetic install UUIDs - OR create a dedicated brain_install_tokens
  table (the deferred schema-migration path) and point queryInstallRow/insertInstallRow
  at it. The FK question likely FORCES the dedicated-table path if the FK exists.

## Tests

- Brain repo tests/register-endpoint.test.mjs is 5/5 green against a MOCKED Supabase -
  the mock accepted a payload the real table refuses. Add a contract note or a
  schema-shaped fixture so the mock mirrors the live table's required columns once known.
- Live re-probe after fix: valid UUID => 200 {token, tier:'read'}; same UUID => same
  token; malformed => 400; hammering => 429.

## Non-Code Follow-ups

- Operator: read the live brain_api_keys schema (one curl or dashboard glance).
- Cross-file: brain repo owed-list item "the register Supabase convention" resolves
  WITH this RCA; update docs/2026-08-10 handoffs in both repos on resolution.
