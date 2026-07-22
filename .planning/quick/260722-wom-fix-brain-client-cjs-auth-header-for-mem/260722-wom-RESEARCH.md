# Quick Task 260722-wom: Research

**Task:** Fix brain-client.cjs auth header for Memgraph brain migration step 1 (verify/fix double-Bearer-prefix, confirm MINDRIAN_BRAIN_URL override path is clean)

## Context

Migration brief (source of record: `ProblemsWorthSolving-Brain/docs/2026-07-22-MIGRATION-BRIEF-swap-aura-brain-for-memgraph.md`, verified 2026-07-22) proposes retiring Neo4j Aura + Pinecone in favor of `pws-brain-mcp.onrender.com` (Memgraph + native e5 vectors), reachable via the same Supabase `brain_api_keys` Bearer contract every user already holds. Jonathan approved a phased cutover (dark-ship, prove on all 3 surfaces, resolve `brain_write` blocker, then flip default). This quick task is step 1 of that sequence: dark-ship prep, no default flip.

## Correction to the brief

The brief's section 04 claims the env-overridable `BRAIN_URL` constant lives in `bin/mindrian-brain-mcp-client.cjs` and shows this diff:

```
- const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || "https://mindrian-brain.onrender.com";
+ const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || "https://pws-brain-mcp.onrender.com";
```

This is **incorrect**. I read `bin/mindrian-brain-mcp-client.cjs` in full: it is a pure stdio-transport shim (Canon Part 7, "~85% reuse of brain-client.cjs -- this file is JUST a stdio transport wrapper. It contains zero network code"). It has no `BRAIN_URL` constant anywhere.

The real constant, confirmed via grep across the whole repo (excluding node_modules/tests), lives at:

```
lib/core/brain-client.cjs:23
const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://mindrian-brain.onrender.com';
```

`brain-client.cjs`'s own header comment (lines 3-6) already documents this as an intentional override point ("override via the MINDRIAN_BRAIN_URL env var for staging / self-hosted"). **The env-override mechanism the brief's step 1 asks for already exists in production.** No new override needs to be added. Do not touch `bin/mindrian-brain-mcp-client.cjs` — there is nothing there to change.

`BRAIN_URL` is consumed at exactly two call sites, both in `lib/core/brain-client.cjs`:
- line ~214: `fetch(`${BRAIN_URL}/mcp`, ...)` (session init handshake)
- line ~283: `fetch(`${BRAIN_URL}/mcp`, ...)` (tool call)

Both derive from the single top-of-file constant, so setting `MINDRIAN_BRAIN_URL` env var already redirects both call sites consistently. Grep confirmed no other file in the repo hardcodes `mindrian-brain.onrender.com` as a live network target (the only other hits are code comments in `scripts/rs-thesis-command.cjs`, `scripts/rs-experts-command.cjs`, `scripts/sessionstart-post-update-preflight.cjs`, and `lib/core/mcp-profiles.cjs` — all descriptive prose, not URL constants).

## The one open question this quick task must resolve

The brief flags a live gotcha:

> In at least one live env, `MINDRIAN_BRAIN_KEY` holds the whole header (`Authorization: Bearer <uuid>`), not a bare token. If the shim wraps it again as `Bearer ${key}` it double-prefixes and the server returns a misleading `401 {"error":"Invalid API key"}` on a perfectly valid key.

This has NOT yet been verified against the actual code in `lib/core/brain-client.cjs`. The planner/executor MUST:
1. Read the full auth-header construction in `lib/core/brain-client.cjs` (the `Authorization` header build, likely near both `fetch()` call sites, and `resolveBrainKey()` in `lib/core/resolve-brain-key.cjs` which is the single key-resolution chokepoint per the file's own header comment at lines 54-58).
2. Determine whether the key value returned by `resolveBrainKey()` can ever already include an `Authorization:` / `Bearer ` prefix (check any docs/env examples for `MINDRIAN_BRAIN_KEY`, and any tests referencing this).
3. If the code already normalizes (e.g. strips an existing `Bearer ` prefix before re-wrapping, or the key is guaranteed bare by the resolver's own contract), no fix is needed — document that finding instead of guessing.
4. If the code blindly does `` `Bearer ${key}` `` with no defensive stripping, and a real code path can hand it a pre-prefixed value (env file examples, legacy key format, etc.), add a minimal, defensive normalization: strip any leading `Authorization: ` and/or `Bearer ` (case-insensitive) from the resolved key before building the header, so the final header is always exactly one `Bearer <token>`.

## Constraints (Canon + repo conventions)

- **Canon Part 8 (Graph Boundary):** this fix touches only transport/auth plumbing (URL + header construction). It must not add, read, or forward any user/room-specific content to Brain. Confirm the diff has zero touchpoints outside `lib/core/brain-client.cjs` (and its auth helper `lib/core/resolve-brain-key.cjs` if the normalization belongs there instead).
- **No em-dashes** in any file touched (hyphens only) — this repo hard-rules it in CLAUDE.md and in `brain-client.cjs`'s own comments.
- **Do NOT** change the `BRAIN_URL` default fallback value. This is a dark-ship step — the default must remain `https://mindrian-brain.onrender.com` until a later, separate step flips it (per the approved phased-cutover plan).
- **Do NOT** touch `brain_query` -> `text2cypher` renaming or `brain_write` (both are explicitly later/blocked steps in the approved sequence, out of scope here).
- **Do NOT** hand-bump any version file (`package.json`, `plugin.json`, `CHANGELOG.md`) — this is not a release.
- Tri-Polar (CLI/Desktop/Cowork) live verification against the real `pws-brain-mcp.onrender.com` endpoint is explicitly OUT OF SCOPE for this quick task (that is step 2 of the brief's sequence — requires a live `MINDRIAN_BRAIN_URL` override + a real Bearer key in a dev session, a separate follow-up task). This quick task is a static code-correctness fix/verification only.

## Recommended task shape for the planner

1 focused task: read `lib/core/brain-client.cjs` (header build + both fetch call sites) and `lib/core/resolve-brain-key.cjs` (key resolution contract), determine whether the double-Bearer-prefix bug is real, and either (a) apply a minimal defensive fix normalizing the key before header construction, with a short code comment explaining why (referencing this quick task and the migration brief), or (b) leave code unchanged and instead write a one-paragraph finding into SUMMARY.md documenting why the existing code is already safe. Either outcome is a valid "done" for this quick task — the goal is a verified, correct answer, not a forced code change.
