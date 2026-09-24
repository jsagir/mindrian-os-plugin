---
status: fixing
kind: rca
trigger: "mcp-http-flag-off-one-request-per-process"
issue_id: ""
severity: high
surfaces: [cowork]
brain_mode: full-loop
canon_parts: [11]
created: 2026-09-24T07:43:32Z
updated: 2026-09-24T07:43:32Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. `bin/mindrian-mcp-server.cjs:318` builds ONE stateless `StreamableHTTPServerTransport` (`sessionIdGenerator: undefined`) at process boot and reuses it for every `/mcp` request for the life of the process. The SDK's own reuse guard throws on the second request, and that throw is silently swallowed into a bare `500` with an empty body by hono's `handleFetchError` (the request framework `@modelcontextprotocol/sdk/server/streamableHttp.js` wraps around).
test: Spawned the flag-OFF HTTP server hermetically, drove `initialize` then `notifications/initialized` then `tools/list` over real HTTP POSTs, and separately instrumented the SDK's `WebStandardStreamableHTTPServerTransport.prototype.handleRequest` (a non-invasive `node -r` preload monkey-patch, no repo file touched) to surface the raw thrown `Error.message` that the wire response never carries.
expecting: (met) request 1 (`initialize`) returns 200; every request after it returns 500 with an empty body; the process's own instrumented log line carries the literal SDK error text.
next_action: NONE for this plan (267-02 is RCA-filing only, no code change). Fix owned by 267-12 (`createMcpHandler` HTTP-branch migration, Wave 3 per 267-RESEARCH.md).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48
- Reported by: Phase 267 research pass (2026-09-23) and 267-02 plan execution (2026-09-24), live-reproduced
- Date first observed: 2026-09-23 (267-RESEARCH.md Summary, second bullet)
- Related debug sessions: none

### Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `782ecc4662edab1b0901788250ba9ed0ff1992f4` (PLAN_BASE for 267-02)
- **WIRE claims probe against:** a hermetically-spawned local instance of `bin/mindrian-mcp-server.cjs` on this same tree, HTTP transport, flag-OFF (`MINDRIAN_MCP_FIRST` unset), port 3847, loopback only
- **Date of audit:** 2026-09-24
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Problem Statement

The local `mindrian-os` MCP server's flag-OFF HTTP branch (the default; the branch every Cowork VM routes to per `lib/mcp/surface-detect.cjs:56-59`) serves exactly one successful request per process lifetime; every request after `initialize` returns HTTP 500 with an empty body, for every client and every protocol era.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: A Cowork client (or any HTTP client) can complete `initialize`, then `notifications/initialized`, then any number of subsequent tool/resource/prompt calls against the same running server process.
actual: `initialize` (request 1) returns HTTP 200 with a valid MCP result. Every request after it (`notifications/initialized`, `tools/list`, and so on) returns HTTP 500 with an empty response body -- no JSON-RPC error envelope reaches the wire at all.
errors: The SDK throws `Stateless transport cannot be reused across requests. Create a new transport per request.` (verbatim, live-captured, see Evidence). This throw never reaches the HTTP response body: hono's `getRequestListener` (`node_modules/@hono/node-server/dist/listener.js`, `handleFetchError`) maps any rejected fetch-handler promise to `new Response(null, { status: 500 })`, so the wire-visible symptom is a bare `500` with a `null` body, and the SDK's own descriptive error text is otherwise invisible outside the server process.
reproduction:
  1. Spawn `MINDRIAN_TRANSPORT=http node bin/mindrian-mcp-server.cjs` in a hermetic env (fresh HOME, `MINDRIAN_ROOMS_HOME`, unreachable `MINDRIAN_BRAIN_URL`), flag-OFF (`MINDRIAN_MCP_FIRST` unset).
  2. POST `initialize` to `http://127.0.0.1:3847/mcp` -- observe HTTP 200, a valid `serverInfo`/`capabilities` result.
  3. POST `notifications/initialized`, then POST `tools/list` -- observe HTTP 500 with an empty body on each.
started: Pre-existing on the currently-shipped v1 SDK (`@modelcontextprotocol/sdk@1.29.0`, installed); not introduced by any Phase 267 change. First named as a NEW FAILURE in `267-RESEARCH.md` (2026-09-23 force-refresh pass), live-reproduced again at 267-02 plan-execution time (2026-09-24).

## Scope and Impact

- Affected surfaces: cowork (the only surface `lib/mcp/surface-detect.cjs` routes to the HTTP branch by default: `CLAUDE_SURFACE=cowork`, `COWORK_SESSION_ID`, or a `/sessions` dir). CLI and Desktop stay on stdio and are unaffected.
- Affected commands: every MCP tool/resource/prompt call issued by an HTTP client after its first request in the same server process.
- Affected users: any real Cowork traffic that reaches this branch. Whether real Cowork traffic reaches it today is UNVERIFIED (267-RESEARCH.md Open Question 2, unresolved) -- the bug is real and reproduced regardless of that open question, and the owning plan (267-12) fixes it unconditionally per the navigator's 267-CONTEXT.md ruling ("fix it regardless of severity; the fix is required either way once the HTTP branch is touched at all").
- Version range: present on `@modelcontextprotocol/sdk@1.29.0` (installed) and confirmed present in `1.27.1` and `1.30.1` per 267-RESEARCH.md's tarball diff (the reuse guard is unchanged across those versions) -- not a version-specific regression, a construction defect in this repo's own usage (one shared transport instance, never replaced).
- Severity: high (every HTTP client is broken after its first request; only the single-request initialize handshake ever succeeds).
- Blast radius: none beyond the flag-OFF `/mcp` HTTP route itself. The flag-ON daemon path (`mcpFirstOn` branch, session-keyed transport map) is architecturally distinct and does not share this defect (Evidence entry below).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: A protocol-era mismatch (v1 vs the 2026-07-28 SDK generation) causes the 500.
  evidence: The thrown error is `WebStandardStreamableHTTPServerTransport`'s own stateless-reuse guard (`webStandardStreamableHttp.js:143`), present identically in 1.27.1, 1.29.0 (installed), and 1.30.1 per 267-RESEARCH.md's tarball diff. This is a construction defect (one transport instance reused across requests), not an era-negotiation defect.
  timestamp: 2026-09-24T07:43:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-24T07:44:10Z
  checked: hermetic live run, `MINDRIAN_TRANSPORT=http node bin/mindrian-mcp-server.cjs`, flag-OFF, three sequential HTTP POSTs to `127.0.0.1:3847/mcp`
  found: |
    Server stderr on boot: `[mindrian-os] MCP server v2.0.0-beta.48 started (cowork, HTTP on 127.0.0.1:3847, room: <hermetic room>)`.
    Request 1 (`initialize`): HTTP status 200, body begins `event: message\ndata: {"result":{"protocolVersion":"2025-11-25", ...`.
    Request 2 (`notifications/initialized`, a notification, no response expected) then request 3 (`tools/list`): HTTP status 500, response body EMPTY (zero bytes).
  implication: Confirms the Symptoms exactly -- request 1 succeeds, every request after it returns a bare 500 with no body on the wire.

- timestamp: 2026-09-24T07:47:00Z
  checked: the same hermetic server, boot with a `node -r <preload>.cjs` that monkey-patches `WebStandardStreamableHTTPServerTransport.prototype.handleRequest` (via `Module.createRequire` resolved from `bin/mindrian-mcp-server.cjs`'s own module graph, so it patches the SAME cached module instance the server requires -- no repo file was edited) to log the raw thrown `Error.message` to stderr before it propagates
  found: |
    Server stderr, twice (once for `notifications/initialized`, once for `tools/list`, both after the one `initialize` call had already consumed `_hasHandledRequest`):
    `[RCA1-PROBE] handleRequest threw: Stateless transport cannot be reused across requests. Create a new transport per request.`
    This is the literal, verbatim text of the guard at `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/webStandardStreamableHttp.js:143` (installed `sdk@1.29.0`), source line:
    `throw new Error('Stateless transport cannot be reused across requests. Create a new transport per request.');`
  implication: Proves the exact root-cause site and confirms the wire-visible empty-500 (prior Evidence entry) is hono's `handleFetchError` swallowing this exact thrown Error into `new Response(null, { status: 500 })` -- the descriptive text never reaches any client, only this repo's own process (and now this instrumented probe) ever sees it.

- timestamp: 2026-09-24T07:43:32Z
  checked: `bin/mindrian-mcp-server.cjs:313-319` (construction site) and `:394` (`server.connect(statelessTransport)`)
  found: |
    ```js
    let statelessTransport;
    let sessionTransports;
    if (mcpFirstOn) {
      sessionTransports = new Map();
    } else {
      statelessTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    }
    ```
    and the `/mcp` handler at `:333-336`:
    ```js
    if (!mcpFirstOn) {
      await statelessTransport.handleRequest(req, res, req.body);
      return;
    }
    ```
    ONE `statelessTransport` instance is built once at server boot (module scope inside `main()`) and reused by every incoming flag-OFF request for the entire process lifetime.
  implication: This is the exact construction defect. The flag-ON branch (same file, `:341-375`) already builds a FRESH `StreamableHTTPServerTransport` per new session (`const sessionServer = createServer(); ... new StreamableHTTPServerTransport({...})`), so the sibling code in this same file demonstrates the correct pattern was already known -- it was simply never applied to the flag-OFF stateless path.

## Technical Root Cause

The real underlying cause in implementation terms.

- Site: `bin/mindrian-mcp-server.cjs:318` (construction), `:333-336` (reuse on every request), function scope: the HTTP-branch closure inside `main()`.
- Cause: a single `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` instance is created once and passed to `handleRequest` on every subsequent `/mcp` POST. The underlying `WebStandardStreamableHTTPServerTransport.handleRequest` (`node_modules/@modelcontextprotocol/sdk/dist/cjs/server/webStandardStreamableHttp.js:139-142`) sets an internal `_hasHandledRequest` flag on its first call and throws on every call after that when `sessionIdGenerator` is `undefined` (stateless mode). The thrown `Error` is never caught anywhere in this repo's request-handling path; it propagates as a rejected promise out of the Express `app.all('/mcp', async (req, res) => {...})` handler, which Express 5's native async-error forwarding hands to hono's `getRequestListener`, whose `handleFetchError` converts ANY rejected fetch-handler promise into `new Response(null, { status: 500 })` -- discarding the error text entirely.
- Why it surfaces now: the bug has been present since the flag-OFF HTTP branch was first written (it is not introduced by this migration), but Phase 267's SDK-version research work is the first pass to actually drive a second sequential HTTP request against this branch and observe the failure; prior phases only smoke-tested `initialize`.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `bin/mindrian-mcp-server.cjs:313-319` and `:333-336`, function scope inside `main()`'s HTTP branch
  - Current behavior: one shared `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` built at boot, reused for every request; the second and every later request throws and returns an empty 500.
  - Required behavior: replace the shared stateless transport with `createMcpHandler(() => createServer(), { legacy: 'stateless' })` (from `@modelcontextprotocol/server`) mounted via `toNodeHandler` (from `@modelcontextprotocol/node`) on the existing Express `/mcp` route -- a fresh server (and transport) is built per request, so the reuse guard never fires. This is the SDK-documented "Server over HTTP" pattern (`docs/migration/support-2026-07-28.md`), already production-proven in this org's own retired PWS Brain (`~/dev/ProblemsWorthSolving-Brain/src/http/app.mjs:323-330`, `createMcpHandler({ legacy: 'stateless' })` behind `toNodeHandler`, serving this very plugin's `brain-client.cjs` in production without incident).
  - Short-term patch: none recommended -- the fresh-transport-per-request approach is itself the minimal fix; there is no smaller stopgap that does not reintroduce the same class of bug.
  - Long-term fix: same as above. Precondition (267-RESEARCH.md Pattern 2): hoist `startTreeWatcher(s, {})` out of `createServer()` BEFORE this change lands, or the per-request factory starts one tree watcher per HTTP request (267-RESEARCH.md Pitfall 10).
- Owning plan: 267-12 (Wave 3, HTTP flag-OFF migration to `createMcpHandler`, per `267-CONTEXT.md`'s sequencing and `267-RESEARCH.md`'s recommended wave structure).

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-267-mcpv2-http-flag-off.cjs` (267-12 to create; reuses `tests/helpers/mcp-wire-267.cjs` patterns for hermetic env / port-free precheck / SIGKILL-only teardown)
  - Given: the flag-OFF HTTP server running hermetically
  - When: N > 1 sequential HTTP requests are POSTed to `/mcp` after `initialize`, under both the 2025-11-25 and 2026-07-28 protocol eras
  - Then: every request returns a valid JSON-RPC result (never a bare empty 500)
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the version 267-12 ships in ("MCP HTTP flag-OFF branch now serves more than one request per process").
- Release lockstep: applies when 267-12 ships; see `.claude/includes/release-process.md` (the five-place version-consistency rule) and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5.
- Canon: touches Part 11 (CIRS) only incidentally -- the registration surfaces themselves are unchanged by this fix (only the transport construction changes), so no `docs/CANON-PHASE-MAP.md` update is required by this RCA alone.
- knowledge-base.md: on resolve, add the summary block per `docs/RCA-TEMPLATE.md` section 1.
- Docs / monitoring / process notes: none beyond the above.
- **MindrianOS gate answers (docs/RCA-TEMPLATE.md section 5):**
  1. Canon Part 8 (Graph Boundary): the fix touches no Brain wire. `createMcpHandler`/`toNodeHandler` serve local MCP requests only; zero `brain_*` calls, zero `brain-client.cjs` involvement. No user-specific bytes reach the Brain.
  2. Tri-Polar: this bug and its fix are HTTP-branch-only. CLI and Desktop (stdio) are unaffected by construction (they never instantiate `StreamableHTTPServerTransport`). Cowork is the only surface this fix changes; it must be the one verified live once 267-12 lands.
  3. Cross-platform: the fix changes only in-process JS transport construction, no process spawning, no path/shell behavior. Correct on Windows/Mac/Linux by construction; no platform-specific surface introduced.
  4. Release lockstep: named above.
  5. No em-dashes: this file and the eventual fix's commit message, code comments, and CHANGELOG entry all use hyphens only.
  6. Reuse before build (Part 7): the required fix reuses the SDK's own documented `createMcpHandler`/`toNodeHandler` pattern and this org's own production precedent (PWS Brain) rather than hand-rolling a per-request transport factory.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- see Technical Root Cause above.
fix: PENDING - lands in 267-12
verification: PENDING
files_changed: []
commits: PENDING
