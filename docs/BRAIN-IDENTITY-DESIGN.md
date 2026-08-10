# Brain Identity Design: Per-Install Silent Registration

**Status:** ratified, Option A implemented.
**Ruling:** NAVIGATOR RULING 2026-08-10 (REQUIREMENTS.md HONEST-03). SEED-011 Option A
(per-install silent registration) is baked in by default, not a decision checkpoint.
Option B (embedded HMAC key) rejected: extractable from shipped CJS by design
(`cat lib/... | grep KEY`), rotation binds to the release cycle, no per-install identity.
Option C (anonymous degraded tier) is dead by navigator ruling: a keyless tier serving
reduced methodology is exactly the Tier-0 gradient the honesty rail (Phase 250-01, HONEST-01)
kills, and SWEEP-02 inverts the keyless fixture to assert REFUSAL, which directly
contradicts option C's keyless-serves-degraded posture.

## Why this exists

Decision #1's rewritten form ("one-command install; the Brain is part of what installs")
stays true only if the Brain is USABLE without a manual key ceremony. Under the honesty
rail, a keyless session refuses methodology rather than degrading silently, so if key
setup were still a manual step, every fresh install would hit the `no_key` refusal on its
FIRST methodology ask - honesty would become the default nag, not the failure edge. Silent
registration is what keeps refusal rare (the actual failure edge: registration failed or
the Brain is offline) instead of universal (every fresh install, every first ask).

## The endpoint contract

`POST /register` on `pws-brain-mcp.onrender.com`, mounted in
`ProblemsWorthSolving-Brain/src/http/app.mjs` AHEAD of the `/mcp` handler.

- **Unauthenticated by design.** It mints credentials, so it cannot itself require one.
- **Request body, closed schema:** `{"install_id": "<UUIDv4>"}` - install_id ONLY. Any
  missing install_id, non-UUIDv4 string, extra field, or non-JSON body is a `400`. Nothing
  else ever crosses in the registration payload (Part 8 posture - the plugin side's own
  payload audit, tests/test-250-silent-registration.cjs Test 5, asserts the outbound POST
  body carries no room paths, user prose, or env contents).
- **Response, success:** `200 {"token": "<mbr_-prefixed opaque string>", "tier": "read"}`.
- **Idempotent per install_id.** The SAME install_id POSTed twice yields ONE identity -
  the second call returns the identical token, never a second unrelated key. No unbounded
  minting is possible from repeated calls with the same install_id.
- **Rate-limited, register-specific cap.** `registerRateLimit`
  (`src/http/rate-limit.mjs`) is a SEPARATE bucket namespace from the general `/mcp`
  limiter (`perKeyRateLimit`, `DEFAULT_MAX` 120/window for authenticated traffic).
  Registration is a once-per-install event, so its default cap is 5 per window per socket
  address (env-overridable: `BRAIN_HTTP_REGISTER_RATE_WINDOW_MS`,
  `BRAIN_HTTP_REGISTER_RATE_MAX`), keyed off the SAME `clientAddressOf`/`keyOf`
  socket-address-fallback logic the existing limiter uses (the register path is
  unauthenticated, so every caller lands on the `ip:` bucket branch). A keyless burst past
  the cap gets `429` with `Retry-After`.
- **READ-tier ceiling.** Every minted token is issued at `plan: 'install'`, which
  `isAdminPlan()` (`src/http/auth.mjs`) never classifies as admin - only the literal
  `'admin'` plan value crosses into `brain:admin`. A registered token can NEVER reach an
  admin/write tool (`ingest_framework`, `raw_cypher`, `create_snapshot`, `brain_query`,
  `brain_write`); `tierGate` refuses it with the same `403 MoatViolation` shape every other
  non-admin key gets.
- **Minting reuses the EXISTING supabase-keys.mjs machinery** (`mintInstallToken`,
  `src/http/supabase-keys.mjs`) - the same `supabaseConfigured()`, `supabaseHeaders()`,
  `supabaseUrl()`, `boundedFetch`, and `SUPABASE_TIMEOUT_MS` primitives the read-path
  validation (`validateViaSupabase`) already uses. There was no pre-existing minting path
  to call into (every prior key in `brain_api_keys` is issued externally at
  mindrian-os.com/brain-access, inserted directly into Supabase, never through this
  codebase) - "reuse before build" means reusing the module's Supabase primitives, not
  vendoring a second HTTP client or a second key shape.
- **Persistence key.** The `brain_api_keys` table carries no `install_id` column (a schema
  migration is out of scope for a local-commit-only, code-only phase task, and cannot be
  verified from a dev sandbox without live Supabase credentials). Idempotency instead keys
  on the EXISTING generic `user_id` column, scoped by `plan='install'` so it can never
  collide with a real dashboard-issued row (those carry `free`/`pro`/`trial`/`admin`,
  never `'install'`). `install_id` is a fresh UUIDv4 per install; collision risk against
  another caller's `install_id` value in this column is the same birthday-bound risk as
  the UUID itself. If a future migration adds a dedicated `install_id` column, this is a
  drop-in swap inside `mintInstallToken` alone - the endpoint contract does not change.
- **Token never logged.** Only the sha256-16 prefix is logged
  (`token_sha256_16=<prefix> created=<bool>`), matching this repo's existing hashing
  posture (`rate-limit.mjs`'s key-hashing, the plugin's SEC-02 mode-0600 file convention).
- **When Supabase is not configured** on a deploy, `/register` returns `503` - an honest
  unavailability, never a fabricated `200`.

## The plugin-side ladder

`lib/core/resolve-brain-key.cjs` gained a FOURTH ladder leg, lowest precedence, after the
three existing ones:

1. `MINDRIAN_BRAIN_KEY` env var - source `'env'`.
2. `~/.mindrian.env` - source `'mindrian-env-file'`.
3. CWD `.env` - source `'cwd-env-file'`.
4. **NEW:** `~/.mindrian-install.json` (mode 0600, the SEC-02 posture the key file
   already gets) - source `'install-token'`.

**Existing keyed users are provably untouched.** The first three legs resolve
byte-identically to before this phase; a cached install token NEVER overrides an
explicit key. The resolver leg is read-only: minting lives in `brain-client.cjs`, not the
resolver, so the resolver stays a pure function of what is already on disk/in-env.

`lib/core/brain-client.cjs` performs a lazy, one-shot registration at the FIRST Brain
consult when the ladder resolves nothing AND `MINDRIAN_DISABLE_AUTO_REGISTER` is unset:
mint `crypto.randomUUID()`, `POST /register`, on `200` write the cache file at mode `0600`
and proceed with the consult; on any failure (non-200, network error, timeout) record the
honest reason, cap the attempt at ONCE per process (never hammer, never block), and fall
through to the `no_key` failure-edge refusal. This NEVER fires at session start, NEVER in
`sensors/`or `decide()` (the hot-path fence binds identically to the refusal rail) - the
registration attempt rides the consult that needed it.

**The AVAIL-02 retry budget does NOT apply to `/register`.** A failed registration is the
failure edge, not a transient worth hammering; one attempt per process is the whole cap.

## Threat model

See the phase's STRIDE register (250-04-PLAN.md `<threat_model>`) for the full table;
summarized here for the standalone doc:

| Threat | Mitigation |
|---|---|
| Token farming via unauthenticated `/register` | Strict UUIDv4-only closed schema, idempotency per install_id (repeated calls never mint more than one identity), register-specific rate cap (~5/window/socket address) inside the existing limiter, Cloudflare/WAF at the Render edge as the outer bound |
| Elevation of privilege (registered token reaching write tools) | READ-tier ceiling minted through the existing supabase-keys.mjs machinery (`plan: 'install'`, never `'admin'`); proven live by `register-endpoint.test.mjs` Test 5 |
| Information disclosure via the registration payload | Body carries `install_id` ONLY; the endpoint rejects extra fields server-side (400), and the plugin-side payload audit (`test-250-silent-registration.cjs` Test 5) asserts the outbound POST never carries room paths, user prose, or env contents |
| Token at rest / in logs | Cache file mode `0600` (SEC-02 posture); token never logged on either side, only a sha256-16 prefix |
| Denial of service via registration retries | Once-per-process attempt cap on the plugin side; the AVAIL-02 retry budget explicitly does NOT apply to `/register` |
| Untracked identity decisions (repudiation) | This document carries the ruling citation, the endpoint contract, the threat model, and the revocation path on the record |

## Revocation path

Per-install identity (rather than a single embedded key shared by every install, option B)
makes revocation and rate-limiting granular to ONE install: an operator can flip a single
`brain_api_keys` row's `status` to `'revoked'` (the same lifecycle field
`validateViaSupabase` already reads for holder keys) without affecting any other install's
token. This is the seed's own rationale for preferring option A (SEED-011, "Pros: each
install has unique identity - good for telemetry + per-install rate-limit + revocation").

## Telemetry note

Per-install identity means future telemetry (SEED-002's corpus) can attribute events per
install without a manual key, the same attribution property option A always offered. No
telemetry pipeline is wired by this phase; this note records the property so a future
phase does not need to re-derive it.

## Opt-out contract

`MINDRIAN_DISABLE_AUTO_REGISTER=1` suppresses the fourth ladder leg's minting path
entirely: no UUID is minted, no `POST /register` fires, and a keyless session resolves
exactly as it did before this phase (deterministic for harnesses and the existing
degradation test suite). This is the escape hatch for CI/test environments and any
environment where an outbound registration call is undesirable.

## The ceremony statement (what does NOT change)

Manual keys remain the OVERRIDE path and ALWAYS win the ladder. A user who wants an
explicit, non-anonymous identity (or who is on a paid/admin tier) still requests a key at
`mindrian-os.com/brain-access`, drops it in `~/.mindrian.env` (`chmod 600`) or sets
`MINDRIAN_BRAIN_KEY`, and restarts. That path resolves at legs 1-3, ahead of the
install-token leg, unconditionally. Silent registration does not replace the manual key
ceremony; it removes the ceremony's MANDATORY status for a fresh install that has not
opted into one.

## Deploy status

The endpoint ships with local commits in the brain repo only, per this phase's Task 1
scope. It is NOT live until the operator deploy ceremony (this phase's Task 3 checkpoint):
push the brain repo, confirm Render redeploys `pws-brain-mcp`, and probe `/register` live
(200/429/400 legs) before any surface claims silent registration works in production.

---
*Filed: Phase 250-04 (Honesty Rail + Doctrine Amendment), 2026-08-10.*
