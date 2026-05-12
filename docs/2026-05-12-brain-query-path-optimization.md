# Brain query-path optimization — notes

Field findings, 2026-05-12, against MindrianOS v1.13.0-beta.12 + the live Render
Brain (`mindrian-brain.onrender.com`, plan `standard`, verified healthy).

Scope: making sure the **MindrianOS → Brain** query path (`lib/core/brain-client.cjs`,
called by ~36 modules/scripts) is correct and efficient. The server side is fine
(separate report); this is the client.

---

## What's in `brain-client-optimization.patch` (apply this)

Three changes to `lib/core/brain-client.cjs`:

1. **P0 BUG FIX — hard request timeout on every Brain HTTP call.**
   Both `fetch()` calls (`_ensureSession` init handshake + `callTool` tool call)
   had **no `AbortSignal` / timeout**. Node's global `fetch()` never times out.
   A slow or wedged Brain → the `/mos:` command that called it hangs forever.
   Worse: `brain-router.cjs`'s docstring already advertises *"Tier 3: Brain API
   via brain-client.cjs (2s hard timeout)"* — that 2s timeout did not exist.
   Patch adds `signal: AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS)` to both,
   with a module constant defaulting to **20 000 ms**, overridable via
   `MINDRIAN_BRAIN_TIMEOUT_MS`. On timeout `fetch` throws → already caught →
   returns `null` → existing graceful-degradation path. (`AbortSignal.timeout`
   needs Node ≥17.3; plugin requires ≥22.5, so fine.)
   *Worst-case note:* a cold `callTool` does init **then** tool fetch, so it can
   take up to 2× the timeout. The handshake-skip below removes that.

2. **New `ask(question)` — wraps the `brain_ask` MCP tool.**
   `skills/brain-connector/SKILL.md` calls `brain_ask` *"the Primary Tool …
   always use first,"* but the client had no wrapper — callers had to drop to
   `callTool('brain_ask', {question})` by hand. Now a first-class export
   alongside `query()`, with the same null-degrade + passthrough semantics.

3. **`schema()` memoized 30 min process-wide.**
   The teaching graph's label/relationship/property taxonomy is near-static and
   several modules call `brain_schema`. Cheap memo, big saving on repeated calls.

**Apply:**
```
cd ~/MindrianOS-Plugin            # the DEV workspace, not the install cache
git apply --recount /path/to/brain-client-optimization.patch
# fallback if git apply is fussy:
patch -p1 --fuzz=5 < /path/to/brain-client-optimization.patch
node lib/core/brain-client.cjs    # sanity: should not throw on load
# then: bump version + CHANGELOG per docs/release-process.md, ship as beta
```

---

## Optional / higher-risk — NOT in the patch, decide per item

### A. Drop the `initialize` handshake (biggest latency win)

The Render server is **stateless** (`sessionIdGenerator: undefined` in
`server.cjs`; no `Mcp-Session-Id` header is ever returned). Verified live:
`tools/list` works with **no preceding `initialize`** in the request. And the
auth middleware runs on *every* `/mcp` POST, so each `tools/call` re-validates
the key anyway. So `_ensureSession`'s `initialize` round-trip before the first
`tools/call` is pure overhead — **2 round-trips instead of 1** on a cold
session (the 5-min `sessionCache` only amortizes it within a session).

Cleanest fix: in `callTool`, skip `_ensureSession` and POST `tools/call`
directly; treat a `401` from the tool call as `{error:'invalid_key'}` (the same
sentinel `_ensureSession` returns today). Keep `_ensureSession`/`sessionCache`
exported for the existing tests, just don't gate the hot path on it.

```js
// in callTool(), replace the _ensureSession block with a direct call:
async function callTool(toolName, args, opts = {}) {
  const key = getApiKey();
  if (!key) return null;
  const timeoutMs = Number(opts.timeoutMs) || BRAIN_REQUEST_TIMEOUT_MS;
  try {
    const toolRes = await fetch(`${BRAIN_URL}/mcp`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: _nextRpcId++, method: 'tools/call',
                             params: { name: toolName, arguments: args } }),
    });
    if (toolRes.status === 401) return { error: 'invalid_key', message: 'Brain API key is invalid.' };
    if (!toolRes.ok) return null;
    // ...existing SSE parse...
  } catch (err) { return null; }
}
```
**Caveat:** if a future `@modelcontextprotocol/sdk` upgrade re-enables MCP's
"client MUST initialize first" enforcement on the stateless transport, a bare
`tools/call` would start returning 4xx → revert this. Pin it to a known SDK
version or add a tiny smoke test (`tools/call brain_schema` with no init → 200).

The `opts.timeoutMs` param above also lets `brain-router.cjs` pass `2000` so its
"2s hard timeout" docstring becomes true (see C).

### B. General result cache in `brain-client.cjs`

Today only `brain-router.cjs` caches (its `recommend()` results, 10-min TTL).
A small TTL'd LRU keyed on `(toolName, JSON.stringify(args))` inside `callTool`
would dedupe repeated identical Brain calls across all the modules that use the
client within a session (framework-chain lookups during a pipeline, the same
`brain_query` called by `brain-derivation` + `navigation-engine`, etc.). There's
a `lib/memory/brain-cache-lru.test.cjs` referenced in `brain-client.cjs`'s
`_test` export comment — check whether this was already partly scoped.

### C. `brain-router.cjs` docstring vs reality

`lib/mcp/brain-router.cjs` header says *"Tier 3: Brain API via brain-client.cjs
(2s hard timeout)"*. Until the timeout exists (this patch) + brain-router passes
`{timeoutMs: 2000}` (needs B/A's `opts` param), that line is aspirational. Fix
the docstring, or wire the 2s through.

### D. `tools/call` JSON-RPC id is hardcoded `id: 2`

Cosmetic — each call is its own HTTP round-trip with its own response, so it
doesn't break anything, but JSON-RPC ids should be unique. Add `let _nextRpcId
= 1;` near the top and use `id: _nextRpcId++` in both `_ensureSession` and
`callTool`. (The handshake-skip snippet above already does this.)

---

## Wiring gaps — "queried properly" also means the plugin *knows* the Brain is reachable

These aren't in `brain-client.cjs`; they're why the Brain can be live-and-valid
yet the plugin still falls to Tier 0 silently (observed on this machine: key in
`~/.mindrian.env`, valid, server healthy — but no warning, and the skill's
detection wouldn't find it).

### E. `scripts/session-start` — Brain-key detection is too narrow

Around line ~1269:
```sh
if [ -n "${MINDRIAN_BRAIN_KEY:-}" ]; then
  # ... grep .mcp.json for "mindrian-brain" ... else: WARN ...
```
It checks only the **shell env var**. But the key normally lives in
`~/.mindrian.env` (that's the "global backup" path `brain-client.cjs:getApiKey()`
reads). So on a standard install — key in `~/.mindrian.env`, no `mindrian-brain`
MCP server — the env var is empty, the block is skipped, and the "loud yellow
WARN beats silent tier_0" line you wrote **never prints**. Resolve the key the
same way `brain-client.cjs` does (source/parse `~/.mindrian.env`, or shell out
to `node -e "process.exit(require('.../brain-client.cjs').isAvailable()?0:1)"`)
before the `[ -n … ]` test.

Also reconsider the WARN's *premise*: it assumes the only path to the Brain is
the MCP server. The `brain-client.cjs` HTTP path makes "no `mindrian-brain` MCP
resolved" a non-error. The check should be "key resolves AND neither MCP server
nor HTTP client can reach the Brain" → WARN. Or replace with a positive line:
`Brain: HTTP client active` vs `Brain: not configured (Tier 0)`.

### F. `skills/brain-connector/SKILL.md` — detection list is missing the HTTP path

Detection order in the skill is: (1) `MINDRIAN_BRAIN_KEY` env var, (2)
`mcp__mindrian-brain__brain_schema` tool, (3) `mcp__neo4j-brain__get_neo4j_schema`
(legacy), (4) "all fail = silent fallback." There's **no branch for
`lib/core/brain-client.cjs`** — and the "Tool Names" table lists only MCP tools.
So a model running this skill on an HTTP-only box (no `mindrian-brain` MCP — the
common CLI case) sees 1–3 fail and silently drops to Tier 0, *with a working
Brain right there*. Add: "if `lib/core/brain-client.cjs` resolves a key
(`isAvailable()`), the Brain is active via HTTP — call it through that module's
`ask()` / `query()` / `search()` / `schema()`, not an MCP tool." Make the CLI
row of the Tool Names table list the `brain-client.cjs` surface. (Step 1's "env
var" check has the same too-narrow problem as E.)

### G. Single source of truth (closes E + F + the `~/.mindrian-last-version`-style bugs)

Pattern across these: the thing that *reads* state reads from a narrower place
than the thing that *writes* it. A single `resolveBrainKey()` helper (mirroring
the existing `lib/core/active-plugin-root.cjs` pattern: env → CWD `.env` →
`~/.mindrian.env`) used by `session-start`, the `brain-connector` skill, and
`brain-client.cjs` would collapse E + F into one.

---

## Verified working (so you don't re-test)

- `mindrian-brain.onrender.com`: plan `standard` (not free → no spin-down),
  `not_suspended`, `/health` → `{status:ok, v1.0.0}`.
- MCP protocol: `initialize` 200; `tools/list` 200 (works standalone, stateless);
  all 6 tools list (`brain_schema/query/write/search/stats/ask`).
- Tool execution: `brain_schema` → full Neo4j schema (~50+ labels); `brain_stats`
  → Pinecone 12 401 records / 6 namespaces, dim 1024; `brain_query` →
  748 `:Framework` nodes; `brain_search` → hits w/ scores; `brain_ask` →
  5 results; `brain_write` → correctly refused for a non-admin key.
- Auth: valid Bearer → 200; no header / wrong scheme → 401 "Missing API key";
  garbage key (UUID and `mbr_` forms) → 401 "Invalid Brain API key"; revoked/
  expired → 403 (per code; not live-tested).
- `brain-client.cjs` correctness: right endpoint, right `Authorization: Bearer`
  header, key resolution (env → CWD `.env` → `~/.mindrian.env`), graceful
  `null`-degrade everywhere, session cache w/ pending-promise race fix, Cypher
  input whitelist + parameterized-Cypher support, `query()` result-shape
  normalization, Pinecone-quota → Neo4j fallback in `smartSearch()`.
