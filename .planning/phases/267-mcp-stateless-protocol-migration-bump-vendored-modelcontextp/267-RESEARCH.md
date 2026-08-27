# Phase 267: MCP Stateless Protocol Migration - Research

**Researched:** 2026-08-27
**Domain:** MCP protocol revision 2026-07-28 (SEP-2575 stateless, SEP-2322 MRTR, SEP-2243 headers) and the TypeScript SDK v1 -> v2 migration, applied to this repo's three MCP servers
**Confidence:** HIGH on every load-bearing claim. Each is traced to a byte-level comparison of two SDK tarballs read on disk, an official GitHub release body, an npm registry probe, a live `require()` smoke test, or a file:line in this repo. Claims that could not be grounded are labelled explicitly.

---

## Summary

**The phase's stated premise is falsified.** The ROADMAP entry says: "Confirmed buildable: 1.30.0 already ships `sessionIdGenerator: undefined` stateless mode in both `streamableHttp.js` and `webStandardStreamableHttp.js`." Both halves of that sentence are true and neither one supports the conclusion. `sessionIdGenerator: undefined` has been in the SDK since long before the 2026-07-28 spec existed - it is documented in the **1.29.0** copy already on disk (`node_modules/@modelcontextprotocol/sdk/dist/cjs/server/streamableHttp.js:29-31`), and it is the *2025-era* Streamable HTTP "stateless mode" idiom, not SEP-2575. `@modelcontextprotocol/sdk@1.30.0` does **not** implement the 2026-07-28 revision at all: I downloaded the 1.30.0 tarball and diffed it against the installed 1.29.0. `dist/cjs/types.js` is **byte-identical** (md5 `a9989adb21fa11708f35cd6f6014d89a` on both), `LATEST_PROTOCOL_VERSION` is still `'2025-11-25'`, and greps for `server/discover`, `inputRequests`, `inputResponses`, `requestState`, `Mcp-Method`, `Mcp-Name`, `ttlMs`, `cacheScope`, and `resultType` return **zero hits across the entire dist**. 1.30.0 is a maintenance release: 8 changed JS files plus two new ones (`server/sseKeepAlive.js`, `shared/mediaType.js` - an SSE keep-alive timer and a Content-Type media-type parser). Bumping 1.29.0 -> 1.30.0 buys this repo nothing protocol-wise.

**The 2026-07-28 spec is real, and the real migration target is a different package family.** `docs/specification/2026-07-28/` exists in the official `modelcontextprotocol/modelcontextprotocol` repo, confirming the 266 research addendum's spec claim. But the TypeScript SDK carrying that revision was released as **v2**, a renamed, re-split package family published 2026-07-27T23:55Z: `@modelcontextprotocol/core`, `/server`, `/client`, `/node`, `/express`, `/fastify`, `/server-legacy`, and an official migration codemod `@modelcontextprotocol/codemod`, all at `2.0.0`. The v2 release body states it plainly: *"First beta release of SDK v2 with support for the MCP 2026-07-28 specification revision."* Two official migration guides exist and I read both in full. So the phase is not a version bump. It is a **package-family migration** that happens to also unlock the protocol revision.

**Two of the phase's four goals are already satisfied, and one of them would be a regression to "fix".** Goal (1), enable stateless mode: `mcp-server-brain/server.cjs:32-46` already builds a fresh `McpServer` + fresh transport per POST with `sessionIdGenerator: undefined` - it is the textbook stateless server, and the v2 guide says a setup shaped exactly like it *"maps directly onto the default entry"*. The local server's flag-OFF HTTP path is also already stateless (`bin/mindrian-mcp-server.cjs:277`). The local server's flag-ON path is deliberately **sessionful** because per-session room binding (`resolveWriteTargetDir(sessionId, ...)`) is keyed on the MCP session id; forcing `sessionIdGenerator: undefined` there would break the D-01 daemon topology Phase 198 paid for. Goal (2), rework gate-render from "held-open-SSE" to MRTR: `lib/mcp/gate-render.cjs` **does not hold a stream open**. It is a pure composition module that returns a card plus a minted `gate_id`; the answer arrives later through a separate `gate_answer` tool call. That is architecturally already MRTR. Only rung (a) (`renderViaElicitation`, `:216-232`) does an inline round trip, via an `elicitInput` function *injected by the caller* (`lib/mcp/tools/gate.cjs:129-131`) and gated on an elicitation capability the 265 audit's live wire probe confirmed no Claude host negotiates. The 266 addendum's "held-open-SSE" characterization is inaccurate and should not be carried into the plan.

**There is one hard blocker for the local server, and it is not in this repo's control.** `@modelcontextprotocol/ext-apps` - used at `lib/mcp/app-views.cjs:25` to register the three MCP Apps tools - declares `@modelcontextprotocol/sdk: ^1.29.0` as a **peer dependency**, at its latest published version `1.7.5` (2026-07-23, four days before v2 shipped). No v2-compatible ext-apps release exists. The v2 guide's boundary rule is explicit and unforgiving: *"objects must not flow between v1-imported and v2-imported code (`instanceof` and nominal types do not cross)."* `registerAppTool(server, ...)` receives the `McpServer` instance directly. A v2 `McpServer` handed to a v1-compiled ext-apps is exactly the forbidden crossing.

**Primary recommendation:** Split this phase along the process boundary the v2 guide itself recommends for staged migrations. Migrate **`mcp-server-brain` to v2 first** - it is a separate package with its own `node_modules`, has no ext-apps dependency, is already stateless, deploys to Render independently of any plugin release, and is server-side so it cannot break the Tri-Polar rule. Adopt the 2026-07-28 revision there via `createMcpHandler` with the default `legacy: 'stateless'`, which serves both eras on one endpoint. Hold the **local `mindrian-os` server on v1** until ext-apps ships a v2-compatible release, and treat "unblock ext-apps" (upstream issue, vendor the two helpers, or gate MCP Apps off) as an explicit decision the navigator makes rather than something a plan quietly assumes. Do the zod 3 -> 4 bump as its own isolated, verifiable step, because its failure mode is silent.

---

## Project Constraints (from CLAUDE.md)

Extracted directives that bind this phase. These carry the same authority as locked decisions.

| # | Directive | Bearing on this phase |
|---|-----------|----------------------|
| C-1 | **Workspace guard.** Every commit, git op, and GSD phase runs from `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/mindrian-os/`. | Any `npm install` for this phase runs in the dev workspace only. |
| C-2 | **Tri-Polar Design Rule (STRONG DEFAULT).** Evaluate every feature through CLI + Desktop + Cowork; a skip is a deliberate stated call, not an oversight. | The three surfaces use three different transports (stdio, stdio, HTTP). A protocol change touches all three differently. Goal (3) of the phase. |
| C-3 | **Canon Part 8 - Graph Boundary.** User data never egresses to the Brain. | `requestState` round-trips through the client. Anything minted into it from a room context is a Part 8 surface. See Pitfall 5. |
| C-4 | **Canon Part 7 - Reuse Before Build.** Justify net-new surface against the 25 existing methodology commands. | Argues for the official codemod over a hand-written migration, and against hand-rolling an MRTR state machine. |
| C-5 | **Canon Part 11 - CIRS.** Every invocable surface is born WIRED or EXCLUDED with a declared HITL shape; `scripts/check-shape-declaration.cjs` lints at commit + release + doctor. | `registerTool` migration must preserve every `connectors` export (e.g. `lib/mcp/tools/gate.cjs:276-291`). Rewriting registration calls must not drop a connector declaration. |
| C-6 | **Release lockstep (5 gates).** CHANGELOG + plugin.json + package.json + git tag + marketplace.json, via `scripts/release.sh <version>`. Never bump by hand. | The plugin-side half of this phase ships through a version cut. `mcp-server-brain` deploys separately to Render and is NOT part of the five-gate lockstep. |
| C-7 | **CJS only, no TypeScript.** `lib/core/*.cjs` ships as source; every output is an inspectable edit surface. No Commander/yargs. | The official codemod is AST-based and TypeScript-oriented. Its value on a CJS `require()` codebase is unverified - see Open Question 3. |
| C-8 | **No em-dashes anywhere.** Hyphens only. Feynman-simplified, JTBD-oriented prose. | Applies to every tool description touched during registration rewrites, and is already enforced for 8 of 36 tools by `tests/test-234-tool-description-floor.cjs`. |
| C-9 | **Dev-Research Compositing.** Every phase touching MindrianOS's own architecture files research in BOTH `.planning/phases/<N>/` and `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked. | This document needs a room-side counterpart entry. Not yet filed. |
| C-10 | **Consult ALL relevant grounding sources.** Context7 for named-library API contracts; claude-api skill / claude-code-guide agent for Claude Code internals; langtalks for agent/LLM concepts. | Grounding used here: official SDK GitHub releases + migration guides (authoritative for the SDK contract), the `anthropics/claude-code` CHANGELOG raw file (authoritative for host behavior), byte-level reads of both SDK tarballs. langtalks was NOT consulted: the 265 audit already established (section 3.3-4) that MCP elicitation and gate design are **not in that corpus**, and a protocol-revision question is a spec/SDK question, not a podcast-corpus one. Saying so explicitly per the rule's own "picking langtalks by default is itself a research gap" clause. |
| C-11 | **Supply-chain allowlist.** `references/security/cve-db.json` `surfaces.supply_chain.allowlist` (15 entries) is scanned by `lib/core/security/agentshield-scanner.cjs`. | Every new `@modelcontextprotocol/*` package needs a VETTED entry or the agentshield supply_chain surface fails. |
| C-12 | **QA/RCA standard.** Findings go to `.planning/debug/<slug>.md` per `docs/RCA-TEMPLATE.md`. | If a migration step surfaces a NEW FAILURE, it gets an RCA doc, not an inline note. |

**Note on absent upstream input:** no `267-CONTEXT.md` exists (`has_context: false`), and `workflow.skip_discuss` is `true` in `.planning/config.json`. There are therefore **no locked user decisions** constraining this research. The navigator directive quoted in the phase brief ("built NOW, not deferred") is the one binding instruction, and it is honored: everything below is scoped as shippable work, not a deferral argument. But the directive was issued on top of a premise this research falsifies, so the **shape** of the work differs from the ROADMAP text. That gap needs a navigator ruling before planning - see Open Question 1.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Protocol era negotiation (`initialize` vs `server/discover`) | MCP host (Claude Code / Desktop / Cowork) | SDK transport layer | The client picks the era. A server can only offer; it never chooses. This is why goal (3) is a host-capability question, not a server-code question. |
| Session identity | MCP transport | Local room-binding store (`lib/core/session-binding.cjs`) | 2025 era: transport-minted `Mcp-Session-Id`. 2026 era: no session at all; identity is per-request in `_meta`. The repo's room binding currently depends on the 2025 answer. |
| Gate state across a HITL round trip | Server process memory (`lib/mcp/gate-ledger.cjs`) | Would become `requestState` (client-echoed) under 2026 | Today's ledger is an in-process `Map`. It survives because the *process* is long-lived, not because the *session* is. |
| Elicitation / structured input | 2025: MCP host UI via server->client request. 2026: server handler return value (`inputRequired`) | `lib/mcp/gate-render.cjs` rung (a) | The 2026 revision deletes the server->client request channel entirely. |
| Tool / resource / prompt registration | `@modelcontextprotocol/server` `McpServer` | `lib/mcp/*.cjs` registrars | Era-independent. Registration API changed between v1 and v2 for reasons unrelated to the protocol revision. |
| Schema -> JSON Schema conversion | zod (authoring instance) | SDK bundled zod fallback | v2 delegates to the authoring zod's `~standard.jsonSchema` (zod >= 4.2.0). This is where the silent zod-3 failure lives. |
| MCP Apps UI resources | `@modelcontextprotocol/ext-apps` | `lib/mcp/app-views.cjs` | An out-of-repo package pinned to SDK v1. The one tier this repo cannot unilaterally move. |
| Brain teaching-graph access | `mcp-server-brain` (remote, Render) | `lib/core/brain-client.cjs` | Separate process, separate manifest, separate deploy. This separation is what makes a staged migration possible. |

---

## Standard Stack

### Core (the actual migration target)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/server` | 2.0.0 | Server implementation: `McpServer`, `createMcpHandler`, `serveStdio`, `inputRequired`, `acceptedContent`, `inputResponse`, `createRequestStateCodec`, `fromJsonSchema` | The only published TypeScript package that implements the 2026-07-28 revision. `[VERIFIED: npm registry + official GitHub release + live require() smoke test]` |
| `@modelcontextprotocol/core` | 2.0.0 | Public Zod `*Schema` constants (spec + OAuth/OpenID), shared across packages so one schema graph is evaluated | v1's `sdk/types.js` split out. Required transitively by `/server` and `/client`. `[VERIFIED: npm registry]` |
| `@modelcontextprotocol/client` | 2.0.0 | Client implementation: `Client`, `StreamableHTTPClientTransport`, `versionNegotiation` | Needed by `lib/mcp/adapter-client.cjs` and `bin/mindrian-mcp-shim.cjs` when they move. `[VERIFIED: npm registry]` |
| `zod` | ^4.2.0 | Schema validation. **Hard requirement** of the v2 packages | v2 declares `zod: ^4.2.0`. zod 3 is no longer supported, and the failure is silent. `[VERIFIED: npm view @modelcontextprotocol/server@2.0.0 dependencies]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@modelcontextprotocol/codemod` | 2.0.0 | Official v1->v2 AST codemod: rewrites import paths, symbol renames, `setRequestHandler` schema->method-string, `extra.*` -> `ctx.*`, `.tool()` -> `registerTool`, and `package.json` | Run first on any file being migrated. Effectiveness on this repo's CJS `require()` style is unverified - Open Question 3. `[VERIFIED: npm registry + official migration guide]` |
| `@modelcontextprotocol/node` | 2.0.0 | Node middleware: `toNodeHandler`, `NodeStreamableHTTPServerTransport`. Depends on `@hono/node-server` | Only if a server needs `createMcpHandler` behind Express/Node HTTP. Applies to `mcp-server-brain` and the local server's HTTP branch. Emits a harmless unmet-peer warning for `hono`. `[VERIFIED: npm registry]` |
| `@modelcontextprotocol/express` | 2.0.0 | Express adapters (peer: `express`) | Alternative to `/node` for `mcp-server-brain`, which is already an Express app. `[VERIFIED: npm registry]` |
| `@modelcontextprotocol/server-legacy` | 2.0.0 | Frozen v1 SSE transport + OAuth AS helpers. Deprecated on arrival | **Not needed here.** This repo does zero MCP OAuth (265 audit item 2.13) and uses no `SSEServerTransport`. Listed only so a planner does not add it reflexively. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| v2 package family | `@modelcontextprotocol/sdk@1.30.0` | **Does not work.** 1.30.0 contains zero SEP-2575 implementation (see Finding F-1). It would satisfy the ROADMAP's literal text while delivering none of its intent. |
| Full v2 cutover on both servers | Brain-server-only v2, local server stays v1 | Recommended. The ext-apps peer pin (F-6) blocks a clean local cutover today; forcing it means dropping MCP Apps or vendoring ext-apps internals. |
| `createMcpHandler` for the local HTTP branch | Keep `StreamableHTTPServerTransport` sessionful | The flag-ON daemon path *needs* sessions for room binding. `createMcpHandler` builds a fresh server per request. Migrating that path is a re-architecture of session-scoped room binding, not a transport swap. |
| `serveStdio(factory)` for stdio surfaces | Keep `server.connect(new StdioServerTransport())` | The v2 guide is explicit: a hand-constructed `Server` on `StdioServerTransport` *"serves only the 2025-era protocol - upgrading the SDK changes nothing about what it puts on the wire."* Serving 2026 on stdio requires `serveStdio`. |
| Hand-rolled MRTR state machine | `inputRequired()` + `createRequestStateCodec()` | v2's legacy shim means one handler written in the 2026 style serves BOTH eras. Hand-rolling forfeits that and re-implements HMAC sealing badly. See Don't Hand-Roll. |
| zod 4 workspace-wide bump | Per-package alias `"zod-v4": "npm:zod@^4.2.0"` | The guide documents the alias escape hatch for zod-3-pinned workspaces. Viable if the repo's ~200 other zod usages make a full bump too risky. Costs a second zod copy. |

**Installation (Brain server first, per the recommendation):**

```bash
# in mcp-server-brain/ (its own manifest and node_modules)
npm install @modelcontextprotocol/server@2.0.0 @modelcontextprotocol/core@2.0.0 \
            @modelcontextprotocol/express@2.0.0 zod@^4.2.0
npm uninstall @modelcontextprotocol/sdk
```

**Version verification performed:**

```
npm view @modelcontextprotocol/sdk version          -> 1.30.0 (published 2026-07-27T17:56:01Z, dist-tag latest)
npm view @modelcontextprotocol/server version       -> 2.0.0
npm view @modelcontextprotocol/core version         -> 2.0.0
npm view @modelcontextprotocol/client version       -> 2.0.0
npm view @modelcontextprotocol/node version         -> 2.0.0
npm view @modelcontextprotocol/codemod version      -> 2.0.0
npm view @modelcontextprotocol/ext-apps version     -> 1.7.5 (published 2026-07-23T11:29:39Z)
```

---

## Package Legitimacy Audit

`slopcheck` was installed and run against all five candidate packages. **Caution for the planner:** `slopcheck install` is not a dry-run - it executes a real `npm install` in the current working directory. It modified this repo's `package.json` and `package-lock.json`; both were reverted with `git checkout --` and `npm install`, and the installed SDK was re-confirmed at 1.29.0 with the working tree clean. Any future slopcheck run in this repo should happen in a scratch directory.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@modelcontextprotocol/core` | npm | 62 days (2026-07-27) | not measured | github.com/modelcontextprotocol/typescript-sdk | `[OK]` (noted "Relatively new") | Approved |
| `@modelcontextprotocol/server` | npm | 62 days | not measured | same monorepo | `[OK]` | Approved |
| `@modelcontextprotocol/client` | npm | 62 days | not measured | same monorepo | `[OK]` | Approved |
| `@modelcontextprotocol/node` | npm | 62 days | not measured | same monorepo | `[OK]` | Approved |
| `@modelcontextprotocol/codemod` | npm | 62 days | not measured | same monorepo | `[OK]` (noted "Relatively new") | Approved |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged `[SUS]`:** none.

**Provenance note (this is why they are `[VERIFIED]`, not `[ASSUMED]`):** these package names were **not** discovered by web search or from training data. They were read off `gh release list --repo modelcontextprotocol/typescript-sdk`, i.e. the official SDK repository's own release tags, each of which resolves to a GitHub release body authored by the SDK maintainers. That is an authoritative source, and the names independently pass registry verification and slopcheck. The scope `@modelcontextprotocol` is already on this repo's VETTED allowlist for two sibling packages.

**Supply-chain gate (C-11).** `references/security/cve-db.json` -> `surfaces.supply_chain.allowlist` currently holds 15 entries, including `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps` as `VETTED`. Every v2 package added to a manifest needs its own allowlist entry with a dated review note, matching the format of the existing `ajv` entry. `lib/core/security/agentshield-scanner.cjs` reads this file; `tests/run-all-199.sh` exercises it.

**New transitive surface.** v1's SDK pulled in 17 direct dependencies (express, hono, cors, ajv, ajv-formats, raw-body, zod-to-json-schema, express-rate-limit, json-schema-typed, ...). v2's `/server` pulls only two (`zod`, `@modelcontextprotocol/core`). This is a **net reduction** in transitive surface, which is a real supply-chain win worth stating. Two dependencies the repo used to get transitively are already declared directly and so are unaffected: `ajv` (`package.json:26`, required by `lib/core/brain-client.cjs` for Phase 110 typed-packet enforcement) and `express` (`package.json`, `^5.1.0`). Verified - no transitive-loss breakage.

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │  MCP HOSTS (era negotiation happens HERE)   │
                    │  Claude Code CLI │ Desktop │ Cowork          │
                    └───────┬──────────────┬─────────────┬────────┘
                            │ stdio        │ stdio       │ HTTP
                            │              │             │
        ┌───────────────────▼──────────────▼─────────────▼──────────────┐
        │  era probe: server/discover ──► modern (2026-07-28)           │
        │             fallback ────────► initialize (2025-11-25)        │
        │  [Claude Code 2.1.238 confirms the host emits server/discover]│
        └───────────────────┬───────────────────────────────────────────┘
                            │
    ┌───────────────────────┴────────────────────────┐
    │                                                │
    ▼ (A) bin/mindrian-mcp-server.cjs                ▼ (B) bin/mindrian-brain-mcp-client.cjs
      ├─ stdio branch  ──► StdioServerTransport         └─ stdio proxy, zero network code
      │    v2 path: serveStdio(factory)                    delegates to lib/core/brain-client.cjs
      └─ http branch                                                    │
           ├─ flag-OFF: ONE stateless transport                         │  HTTPS
           │    (sessionIdGenerator: undefined) ◄── already stateless    │
           └─ flag-ON (daemon): session-keyed transport Map              ▼
                (sessionIdGenerator: randomUUID)              (C) mcp-server-brain/server.cjs
                needs sessions for room binding                   Express + API-key gate
                          │                                       NEW server + NEW transport
                          │                                       per POST, sessionIdGenerator:
                          ▼                                       undefined ◄── already stateless
              bin/mindrian-mcp-shim.cjs                           v2 path: createMcpHandler
              (stdio <-> HTTP bridge for CLI hooks)                        + toNodeHandler
                          │
    ┌─────────────────────┴──────────────────────────────────┐
    │  REGISTRATION SEAMS (all v1 variadic API today)        │
    │  tool-router.cjs (11) │ tools/*.cjs (20) │ inline (2)  │
    │  app-views.cjs (3) ──► @modelcontextprotocol/ext-apps  │
    │                         ▲ PEER-PINNED TO SDK ^1.29.0   │
    │                         └── BLOCKS v2 on server (A)     │
    └─────────────────────┬──────────────────────────────────┘
                          │
    ┌─────────────────────▼──────────────────────────────────┐
    │  HITL GATE PATH (already two-phase, already MRTR-shaped)│
    │  gate_render ──► mint gate_id ──► return card           │
    │       │                                                 │
    │       ├─ rung (a) elicitation: INLINE round trip        │
    │       │    (only path that awaits; capability never     │
    │       │     declared by any Claude host -> dormant)     │
    │       ├─ rung (b) AskUserQuestion (Claude hosts)        │
    │       └─ rung (c) structured text (headless)            │
    │                          │                              │
    │  gate_answer ◄───────────┘ (separate tool call, later)  │
    │       └─ consume gate_id from gate-ledger.cjs           │
    │            IN-PROCESS Map, TTL 30min, session-keyed     │
    │            survives because the PROCESS lives, not      │
    │            because the SESSION does                     │
    └────────────────────────────────────────────────────────┘
```

### Pattern 1: Serve both eras from one factory (HTTP)

**What:** `createMcpHandler(factory)` builds a fresh `McpServer` per request and serves 2026-07-28 natively; the default `legacy: 'stateless'` also serves 2025-era clients through the established stateless idiom on the same endpoint.
**When to use:** `mcp-server-brain`. Its current shape (`new McpServer` + `new StreamableHTTPServerTransport({sessionIdGenerator: undefined})` per POST) is the exact setup the guide says maps directly onto the default entry.

```javascript
// Source: docs/migration/support-2026-07-28.md, "Server over HTTP: createMcpHandler"
// (github.com/modelcontextprotocol/typescript-sdk), transposed to CJS.
const { createMcpHandler, McpServer } = require('@modelcontextprotocol/server');
const { toNodeHandler } = require('@modelcontextprotocol/node');

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'mindrian-brain', version: '1.0.0' },
                               { capabilities: { tools: {} } });
  // register tools once - the SAME factory backs both eras
  return server;
});

app.all('/mcp', toNodeHandler(handler));
```

**Critical caveat, verbatim from the guide:** *"Stateless legacy HTTP (`createMcpHandler` with `legacy: 'stateless'`) builds a fresh instance per request: no initialize handshake, no return path for server->client requests. The shim degrades to the clean capability refusal there - full shim behavior needs stdio (`serveStdio`) or a sessionful legacy wiring."* The Brain server issues no server->client requests today, so this costs nothing there. It would matter on the local server's HTTP branch.

### Pattern 2: Serve both eras on stdio

**What:** `serveStdio(() => buildServer())` from `@modelcontextprotocol/server/stdio`. The opening exchange selects the connection's era; one factory instance is pinned per connection.
**When to use:** the local server's stdio branch (CLI + Desktop), and `bin/mindrian-brain-mcp-client.cjs`.
**Verified on disk:** `require('@modelcontextprotocol/server/stdio')` exports exactly `{ StdioServerTransport, serveStdio }`.

```javascript
// v1 (today, bin/mindrian-mcp-server.cjs:395-396) - 2025 era only, forever
const transport = new StdioServerTransport();
await server.connect(transport);

// v2 - serves BOTH eras; { legacy: 'reject' } refuses 2025 openings
const { serveStdio } = require('@modelcontextprotocol/server/stdio');
serveStdio(() => createServer());
```

**Behavioral consequence to plan for:** on a 2026-pinned connection, `getClientCapabilities()` and `getClientVersion()` return `undefined` - no `initialize` ever runs. `lib/mcp/tools/gate.cjs:87-100` (`detectClientCapabilities`) reads exactly `server.server.getClientCapabilities()`. Under 2026 it silently returns `undefined`, `elicitation` resolves `false`, and the ladder falls to rung (b). That happens to be the *current* behavior anyway, so the practical break is nil - but the code would be reading a permanently-dead field, and per-request identity would need to come from `ctx.mcpReq.envelope` instead.

### Pattern 3: MRTR - one handler, both eras

**What:** return `inputRequired({ inputRequests: {...}, requestState })` from a `tools/call` handler instead of awaiting a server->client request. On 2026 the client retries the original call with `inputResponses`. On 2025 the SDK's **legacy shim** (on by default) issues real `elicitation/create` requests over the live session and re-enters the handler. Same code, both eras.
**When to use:** `lib/mcp/gate-render.cjs` rung (a), if and when the local server reaches v2.

```javascript
// Source: docs/migration/support-2026-07-28.md, "Multi-round-trip requests"
// and "Replacing per-session state: requestState". Transposed to CJS.
const { inputRequired, acceptedContent, createRequestStateCodec } =
  require('@modelcontextprotocol/server');

const stateCodec = createRequestStateCodec({ key: SECRET, ttlSeconds: 1800 });
// ServerOptions: { requestState: { verify: stateCodec.verify } }

async function gateHandler(args, ctx) {
  const state = ctx.mcpReq.requestState();
  if (state === undefined) {
    return inputRequired({
      inputRequests: { choice: inputRequired.elicit({ requestedSchema }) },
      requestState: await stateCodec.mint({ step: 'awaiting-choice', gate_id })
    });
  }
  const picked = acceptedContent(ctx.mcpReq.inputResponses, 'choice', CHOICE_SCHEMA);
  // ratify...
}
```

**Two knobs the plan must set explicitly** (`ServerOptions.inputRequired`): `maxRounds` defaults to `8` on the shim (tighter than the client driver's 10, because the shim holds a live wire request open for the whole flow), and `roundTimeoutMs` defaults to `600_000` because embedded requests are human-paced.

### Pattern 4: Staged migration along a process boundary

**What:** v1 and v2 have **different package names**, so both can be installed in one manifest simultaneously. The guide's safe order: (1) add v2 packages *and* the zod 4 bump while keeping `@modelcontextprotocol/sdk`; (2) rewrite sources incrementally; (3) remove the v1 dependency only when nothing imports it.
**When to use:** this whole phase. The `mcp-server-brain` / plugin split is a natural process boundary where the two sides share only the wire format.
**Guide's own boundary rule:** *"stage along process or transport boundaries where the two sides share only the wire format"* - because *"objects must not flow between v1-imported and v2-imported code."*

### Anti-Patterns to Avoid

- **Bumping 1.29.0 -> 1.30.0 and calling the phase done.** The version numbers move, the CHANGELOG reads plausible, and zero protocol behavior changes. This is the single most likely failure mode of this phase, because it is exactly what the ROADMAP text instructs.
- **Setting `sessionIdGenerator: undefined` on the flag-ON daemon path.** That path is deliberately sessionful. Phase 198-08's comment block (`bin/mindrian-mcp-server.cjs:254-271`) documents the live bug that forced it: a single shared stateful transport answered exactly one session per process lifetime and rejected every later client with "Bad Request: Server already initialized".
- **Running the codemod at the repo root in one pass.** It rewrites the nearest `package.json` walking up - including removing the v1 dependency - which strands every not-yet-migrated import. The guide names this explicitly as the wrong order.
- **Handing a v2 `McpServer` to `@modelcontextprotocol/ext-apps`.** Cross-boundary object flow. `instanceof` and nominal types do not cross.
- **Treating `@modelcontextprotocol/core-internal` as importable.** It is `private: true`, unpublished, and the guide says do not import it directly.
- **Assuming the codemod handles injected SDK surfaces.** It is import-driven. `lib/mcp/tools/*.cjs` receive `server` as a *parameter* and import no SDK at all - the codemod will never touch them, and the v1 idioms there fail at **runtime**, not at load. This repo's disjoint-file tool contract makes this the dominant case, not the edge case.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sealing `requestState` so a client cannot forge it | Custom HMAC wrapper around `JSON.stringify` | `createRequestStateCodec({ key, ttlSeconds, bind })` from `@modelcontextprotocol/server` | `requestState` round-trips through an untrusted client. The helper does HMAC-SHA256 sealing, TTL, and principal binding, and its `verify` plugs straight into `ServerOptions.requestState.verify` so the seam runs it *before* the handler. A failed verify answers `-32602` above the tool funnel. Hand-rolling means re-deriving binding-to-originating-method and expiry semantics. |
| Serving both protocol eras from one endpoint | Branch on a request header and dispatch to two server builds | `createMcpHandler(factory)` (HTTP) / `serveStdio(factory)` (stdio) | One factory, one endpoint, both eras. If a sessionful legacy path must be kept, the guide gives `isLegacyRequest(request)` + `legacy: 'reject'` as the supported routing seam. |
| Making an elicitation handler work on old and new hosts | `if (era === '2026') {...} else {...}` in `gate-render.cjs` | Write once in `inputRequired(...)` style; the built-in legacy shim serves 2025 | The guide's table says explicitly: *"handler shared across both eras - no branch needed."* The shim mirrors the modern client driver's semantics exactly, including per-round `inputResponses` replacement and byte-exact `requestState` echo. |
| Reading elicitation answers out of `inputResponses` | Manual property probing on an untrusted object | `acceptedContent(responses, key, schema)` (schema-aware) or `inputResponse(responses, key)` (discriminated: `missing` / `elicit` / `sampling` / `roots`) | Accepted content is **not** re-validated against `requestedSchema` by the SDK on either era. The schema-aware overload is the intended validation point, and returns `undefined` on mismatch/decline/missing so the handler can re-ask instead of dying. |
| Converting zod schemas to JSON Schema | `zod-to-json-schema` calls in registration code | zod >= 4.2.0's own `~standard.jsonSchema`, or `fromJsonSchema()` for raw JSON Schema | v1's built-in conversion of foreign shapes is **gone** in v2. `schemaToJson`, `parseSchemaAsync`, `getSchemaShape`, `getSchemaDescription`, `isOptionalSchema`, `unwrapOptionalSchema`, and `toJsonSchemaCompat` are all removed. |
| Rewriting v1 import paths and symbol renames by hand | A `sed` sweep over `require()` lines | `npx @modelcontextprotocol/codemod@latest v1-to-v2 <dir>` | The rename mappings are the codemod's own source of truth and are not reproduced in the guide. A hand sweep will miss `ErrorCode` -> `ProtocolErrorCode` splitting into `SdkErrorCode` for local-only members, and `IsomorphicHeaders` -> `Headers` bracket-to-`.get()` semantics. Caveat: do NOT use bare `npx` per this repo's own supply-chain discipline; install the codemod as a devDependency and invoke the local binary. |
| Counting MCP tools / servers for docs | New frozen literals | Runtime enumeration (the Canon Part 11 precedent: "the surface count is enumerated from disk at run time, never a frozen literal") | The 265 audit found six separate stale counts (D-1, D-2, D-8). A registration-API rewrite touching all 36 tools is exactly when a new wrong literal gets typed. |

**Key insight:** the v2 SDK ships the *entire* MRTR mechanism - state sealing, cross-era compatibility shim, typed response readers, round caps - as first-class API. Nearly everything Phase 267 sounds like it should build already exists as a supported export. The genuine engineering work in this phase is **not** implementing statelessness; it is the mechanical package migration, the zod bump, and resolving the ext-apps peer pin.

---

## Runtime State Inventory

This is a migration phase, so this section is mandatory. The canonical question: *after the SDK is swapped and the servers restart, what state was implicitly relying on session or connection continuity?*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **In-process state keyed on session/connection** | `lib/mcp/gate-ledger.cjs:29` `_ledger` Map (30-min TTL, session-keyed, single-use gate mint/consume). `lib/mcp/gate-render.cjs:155` `_firedBindingSessions` Set (D-04 once-per-session binding card). `lib/mcp/session-registry.cjs:31-32` `openSessions` Set + `connectionMap` Map. `lib/mcp/stop-gate-handler.cjs:370` `_sessionDedupState` Map. `lib/mcp/sse-event-bus.cjs:19` `subscribers` Set. `lib/mcp/tool-router.cjs:67,92` `_eurekaCriticDedupeCache`, `_eurekaScanInFlight`. `lib/mcp/brain-router.cjs:26` `cache` Map. | **Analysis, then mostly no-op.** All eight are *module-level* singletons in the Node module cache, so they survive `createMcpHandler`'s per-request `McpServer` construction as long as the **process** persists. They only break under a genuinely multi-process or multi-instance deployment. None of this repo's three servers is deployed that way today (Render runs a single `mcp-server-brain` instance; the local servers are one process per host). **Plan must state this explicitly** rather than migrating state that does not need migrating. The one that would need `requestState` if the Brain server ever scaled horizontally is `gate-ledger.cjs` - but `gate_render`/`gate_answer` live on the LOCAL server, not the Brain, so even that is theoretical today. |
| **Session-keyed persistent data** | `lib/core/session-binding.cjs` (the Phase 194 room-binding store, keyed by MCP session id per the D-02 one-namespace rule). `lib/mcp/session-room.cjs` `resolveSessionRoomDir(sessionId, ctx)`. `lib/mcp/tool-router.cjs:106` `resolveWriteTargetDir(sessionId, ...)`. `bin/mindrian-mcp-shim.cjs` passes `MINDRIAN_SESSION_ID` through as the connection key. | **This is the real coupling.** Under the 2026 era there is no `Mcp-Session-Id` and `getClientCapabilities()` is `undefined`; identity is per-request in `ctx.mcpReq.envelope`. The repo's write-target resolution is keyed on a session id that the 2026 era does not mint. **Do not migrate the local server's flag-ON daemon path to a 2026-era wire without first re-architecting this.** The `MINDRIAN_SESSION_ID` env var path (hook-derived, shim-supplied) is the seam that would survive, because it is *externally* supplied rather than transport-minted. Flag this to the navigator as the largest hidden cost in the phase. |
| **Live service config** | Render service `mindrian-brain` (`mcp-server-brain/render.yaml`) - env vars `BRAIN_API_KEYS`, `BRAIN_CYPHER_MAX_ROWS`, `BRAIN_CYPHER_MAX_BYTES`, `BRAIN_CYPHER_TIMEOUT_MS`, `BRAIN_CYPHER_MAX_ESTIMATED_ROWS`. Marketplace pin `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref`. | **None from the SDK swap.** No env var name changes. The Render deploy is a separate push and is NOT part of the plugin's five-gate release lockstep (C-6) - the plan must not assume `release.sh` ships the Brain server. |
| **Secrets / env vars** | `MINDRIAN_BRAIN_KEY` (env or `~/.mindrian.env`), `MINDRIAN_TRANSPORT`, `MINDRIAN_MCP_FIRST`, `MINDRIAN_MCP_DAEMON`, `MINDRIAN_SESSION_ID`, `MINDRIAN_ROOM`, `MINDRIAN_ROOMS_HOME`. | **None change.** But a **new** secret is introduced if `createRequestStateCodec({ key })` is adopted: the HMAC key for sealing `requestState`. It needs a name, a source, and a rotation story. Not yet decided - Open Question 5. |
| **OS-registered state** | `lib/mcp/daemon-lifecycle.cjs` pidfile + discovered port (flag-ON only). Claude Code's own `.mcp.json` server registrations (`mindrian-os`, `mindrian-brain`, both `alwaysLoad: true`). | **Pidfile:** stale after a daemon restart, already self-managed by `clearOnce()` on SIGTERM/SIGINT/exit. **`.mcp.json`:** unchanged by this phase - the command and args are the same file paths. |
| **Build artifacts / installed packages** | `node_modules/@modelcontextprotocol/sdk@1.29.0` (plugin root), `mcp-server-brain/node_modules/@modelcontextprotocol/sdk@1.27.1` (**note the version skew - the Brain server is two minors behind the plugin**), `dist/generic-claude-dir/.mcp.json` (gitignored, regenerated per machine by `scripts/build-dist-bundles.cjs`). Vendored `node_modules` ships with the plugin. | **Real work.** The vendored `node_modules` rule means the v2 packages ship to every user's install cache. `lib/core/mcp-dep-heal.cjs:172` hard-codes the probe fallback `['@modelcontextprotocol/sdk', 'zod']` and its test `lib/core/mcp-dep-heal.test.cjs:39,85,166,171,210` asserts on those literals plus `@modelcontextprotocol/ext-apps` - all must be updated or the self-heal probes for a package that is no longer there. The `dist/generic-claude-dir` bundle regenerates. `mcp-server-brain`'s own 1.27.1 pin is independent and can move first. |

**Explicitly checked and found nothing:** no ChromaDB/Mem0/Redis keys reference the SDK or a session id. No n8n workflows, Datadog service names, Tailscale ACL tags, Windows Task Scheduler descriptions, launchd plists, or systemd units are implicated - verified by grepping the repo for `@modelcontextprotocol` outside `node_modules` (the full result set is 9 production import sites, listed under Environment Availability, plus doc/test references). No Docker image tags. No compiled binaries.

---

## Common Pitfalls

### Pitfall 1: Bumping the SDK version and believing the protocol changed

**What goes wrong:** `npm install @modelcontextprotocol/sdk@1.30.0`, CHANGELOG entry written, phase marked complete. Nothing on the wire changed.
**Why it happens:** the ROADMAP text asserts 1.30.0 carries stateless mode, and it *does* carry `sessionIdGenerator: undefined` - which is a real, working feature that has nothing to do with SEP-2575. The 266 addendum itself flagged this honestly: *"Whether 1.30.0 itself implements the stateless core ... was NOT verified in this pass ... do not assume 1.30.0 is stateless-compliant without checking."* That warning was correct and was subsequently overwritten by a confident ROADMAP sentence.
**How to avoid:** the falsification test is one command against any candidate SDK version:

```bash
grep -c "2026-07-28" node_modules/@modelcontextprotocol/*/dist/**/types.js
grep -rl "server/discover\|inputRequests\|requestState" node_modules/@modelcontextprotocol/
```

**Warning signs:** `LATEST_PROTOCOL_VERSION` reads `'2025-11-25'`; `types.js` md5 matches the previous version.

### Pitfall 2: The silent zod-3 failure

**What goes wrong:** v2 is installed while `package.json` still declares `zod ^3.25.76`. Everything installs. Everything typechecks (there is no TS here anyway). The server starts. The server connects. Then the **first `tools/list`** answers with an error pointing at `fromJsonSchema()`, while the process keeps running.
**Why it happens:** verbatim from the guide - *"a zod-3 range that satisfied the v1 peer installs and typechecks cleanly under v2 and only fails at runtime - and quietly: registration swallows the conversion failure."* zod >= 4.2.0 self-converts via `~standard.jsonSchema`; zod 4.0-4.1 falls back to the SDK's bundled zod with a one-time `[mcp-sdk]` warning **and drops every `.describe()` field description**. This repo puts load-bearing instructions in `.describe()` calls throughout `tool-router.cjs` and `tools/*.cjs`.
**Confirmed live in this session:** installing the v2 packages alongside the repo's existing `zod@3.25.76` succeeded with **no error at all**, resolving nested `zod@4.4.3` copies inside `@modelcontextprotocol/{core,server,client}` while the root stayed at 3.25.76. That is precisely the configuration that produces the quiet runtime failure.
**How to avoid:** a `tools/list` wire assertion is the only reliable gate. `scripts/doctor.cjs`'s L4 handshake currently does **not** call `tools/list` (265 audit item 2.6 confirms `grep` for `listTools`/`tools/list`/`toolCount` returns nothing in `doctor.cjs`). Adding it is a prerequisite for this phase, not a nice-to-have.
**Warning signs:** a green test suite over a server whose `tools/list` errors; tool descriptions losing their parameter `.describe()` text.

### Pitfall 3: The ext-apps peer pin, discovered at runtime

**What goes wrong:** the local server migrates to v2, `lib/mcp/app-views.cjs:25` still requires `@modelcontextprotocol/ext-apps/server`, and `registerAppTool(server, ...)` receives a v2 `McpServer`. Failure is a nominal-type mismatch inside a third-party package, surfacing as an opaque error at registration or a silently-missing MCP Apps tool on Desktop/Cowork.
**Why it happens:** `@modelcontextprotocol/ext-apps@1.7.5` (latest, published 2026-07-23 - four days *before* v2) declares `@modelcontextprotocol/sdk: ^1.29.0` as a peer. There is no v2-compatible release. The v2 release body even acknowledges the MCP Apps SDK as a `Protocol`-subclassing consumer that needed a compatibility export restored.
**How to avoid:** decide the ext-apps question *before* planning tasks for the local server. Three options, none free: (a) hold the local server on v1 until ext-apps ships v2 support; (b) gate the three MCP Apps tools off and lose Desktop/Cowork room-dashboard / room-wiki / room-graph - a direct Tri-Polar cost; (c) vendor the two helper functions used (`registerAppTool`, `registerAppResource`) - Canon Part 7 makes this a build-not-reuse decision that needs justification.
**Warning signs:** an unmet-peer warning naming `@modelcontextprotocol/sdk` after the v1 package is removed.

### Pitfall 4: The registration API rewrite silently drops a CIRS connector

**What goes wrong:** rewriting 36 `server.tool(name, desc, schema, handler)` calls into `registerTool(name, {description, inputSchema}, handler)` touches every tool module. A module's `connectors` export (Canon Part 11 R1/R16, e.g. `lib/mcp/tools/gate.cjs:276-291`) is a *sibling* of the registration call, easy to leave behind or misalign when a tool name changes shape.
**Why it happens:** `scripts/build-connector-registry.cjs` regenerates `data/mcp-tool-connectors.json` and `data/connector-registry.json` from those exports. `scripts/check-shape-declaration.cjs` runs as an **advisory WARN**, not a block (Phase 210), so a dropped declaration does not fail the build.
**How to avoid:** run `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --strict` after every registration-rewrite commit, not just at release.
**Warning signs:** the declared-surface count moving without an intentional reason.

### Pitfall 5: Putting room content into `requestState` (Canon Part 8)

**What goes wrong:** the MRTR rework threads gate context through `requestState` for convenience, and that context contains room artifacts, venture names, or user claims. `requestState` round-trips **through the client**, and `createRequestStateCodec` is *signed, not encrypted* - the guide says so explicitly: *"the client can base64url-decode the payload."*
**Why it happens:** the multi-step MRTR idiom actively encourages threading "everything it has learned" through `requestState` as a discriminated union of phases.
**How to avoid:** treat `requestState` as a public channel. Carry only opaque handles (a `gate_id`, a phase enum, an integer count) and keep the card body in the process-local ledger. The current `gate-ledger.cjs` design already does exactly this and should not be "improved" into carrying the card.
**Warning signs:** any `stateCodec.mint(...)` call whose payload contains a string that came from a room file.

### Pitfall 6: `_meta` retry-field collision on 2025-era custom methods

**What goes wrong:** a 2025-era peer's custom-method request that uses the bare top-level param names `inputResponses` or `requestState` has them **lifted out of `request.params`** by v2's protocol layer.
**Why it happens:** verbatim from the guide - *"2025-11-25 does not reserve the bare names `inputResponses`/`requestState`, so a 2025 peer's custom-method request that uses them as ordinary top-level params has them lifted."* They remain readable at `ctx.mcpReq.inputResponses` / `ctx.mcpReq.requestState()`.
**Blast radius here:** grep confirms neither name appears anywhere in this repo's tool schemas. **Currently zero.** Documented so a future tool author does not pick those names.

### Pitfall 7: Running the codemod at the repo root

**What goes wrong:** the codemod rewrites the *nearest* `package.json` walking up - **including removing the v1 dependency** - so every not-yet-rewritten import fails module resolution immediately.
**How to avoid:** the guide's staged order is (1) add v2 + zod 4 while keeping v1, (2) rewrite incrementally, (3) remove v1 last. During staged passes, use `--dry-run`, use `--ignore` globs for files that interface with v1-bound dependencies (i.e. `lib/mcp/app-views.cjs`), and review or revert the manifest edit until the final stage.

### Pitfall 8: Assuming the codemod covers `lib/mcp/tools/*.cjs`

**What goes wrong:** the codemod reports success; the eight disjoint-file tool modules are untouched; their v1 idioms fail at runtime.
**Why it happens:** the codemod is **import-driven**. `lib/mcp/tools/gate.cjs`, `room.cjs`, `graph.cjs`, `sensors.cjs`, `chain.cjs`, `status.cjs`, `stop-gate.cjs`, `views.cjs` all receive `server` as a function parameter (`register(server, ctx)`) and import **no SDK symbol at all** - only `zod`. The guide names this case: *"a file that receives the SDK surface as a parameter (dependency injection, factory seams) and has no SDK import is never rewritten, and the v1 idioms there fail at runtime, not compile time."*
**How to avoid:** grep those eight files for `server.tool(`, `server.prompt(`, `server.resource(`, `extra.`, `ErrorCode.` and migrate them by hand. This repo's own Canon Part 11 disjoint-file contract makes the injected-surface case the **majority** of the registration surface (20 of 36 tools), not an edge case.

---

## Code Examples

### Verifying whether an SDK version actually implements 2026-07-28

```bash
# Source: derived from the official spec repo's method vocabulary.
SDK=node_modules/@modelcontextprotocol/sdk/dist/cjs
grep -n "LATEST_PROTOCOL_VERSION" $SDK/types.js
for t in "server/discover" "inputResponses" "inputRequests" "requestState" \
         "Mcp-Method" "Mcp-Name" "ttlMs" "cacheScope" "resultType"; do
  printf "%-18s -> %s files\n" "$t" "$(grep -rl "$t" $SDK 2>/dev/null | wc -l)"
done
```

Run against 1.30.0 this prints `LATEST_PROTOCOL_VERSION = '2025-11-25'` and `0 files` for every marker.
**Do not trust `input_required` as a positive signal:** it appears in 5 files of *both* 1.29.0 and 1.30.0, but as `TaskStatusSchema = z.enum(['working', 'input_required', ...])` - the 2025-11-25 **Tasks** status enum, an unrelated feature that v2 deprecates. This is a live false-positive trap for anyone grepping casually.

### The Brain server, before and after

```javascript
// BEFORE - mcp-server-brain/server.cjs:32-46 (verbatim shape)
app.post('/mcp', async (req, res) => {
  const server = new McpServer({ name: 'mindrian-brain', version: '1.0.0' });
  registerNeo4jTools(server, { plan: req.brainPlan });
  registerPineconeTools(server);
  registerBrainAsk(server);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// AFTER - createMcpHandler, both eras, one endpoint
// Source: docs/migration/support-2026-07-28.md "Server over HTTP"
const { createMcpHandler, McpServer } = require('@modelcontextprotocol/server');
const { toNodeHandler } = require('@modelcontextprotocol/node');

app.all('/mcp', toNodeHandler(createMcpHandler((ctx) => {
  const server = new McpServer({ name: 'mindrian-brain', version: '1.0.0' },
                               { capabilities: { tools: {} } });
  registerNeo4jTools(server, { plan: /* per-request plan, see note */ });
  registerPineconeTools(server);
  registerBrainAsk(server);
  return server;
})));
```

**Note the one real design question this raises:** today `registerNeo4jTools(server, { plan: req.brainPlan })` closes over the **Express request** to carry the API key's plan tier (the D-MOAT-1 admin gate). Under `createMcpHandler` the factory does not receive the Express `req`. The plan tier must reach the factory another way - the handler is web-standards-only (`{ fetch, close, notify, bus }`), so the natural seam is reading the auth header off the web-standard `Request` inside the factory, or keeping `validateApiKey` as Express middleware and threading the result through. **This is the single most load-bearing unknown in the Brain-server migration** and needs a spike before the plan commits to `createMcpHandler`. Flagged as Open Question 4.

### Registration API: v1 -> v2 (applies to all 36 tools)

```javascript
// v1 (today) - variadic, raw zod shape. REMOVED in v2.
server.tool('gate_render', 'Render the Mindrian gate superset card ...',
  { gate_id: z.string().min(1).optional(), options: z.array(gateOptionSchema).min(1) },
  async ({ gate_id, options }, extra) => { ... });

// v2 - config object, wrapped Standard Schema, ctx not extra
server.registerTool('gate_render',
  { description: 'Render the Mindrian gate superset card ...',
    inputSchema: z.object({ gate_id: z.string().min(1).optional(),
                            options: z.array(gateOptionSchema).min(1) }) },
  async ({ gate_id, options }, ctx) => { ... });
```

**Two free wins to fold in while every registration is being touched anyway** (both from the 265 audit's R-6): `registerTool`'s config object has slots for `title` and `annotations` (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`), which **zero of 36 tools currently declare** because the v1 variadic form had no slot for them. `lib/mcp/app-views.cjs:239-245` is the in-repo precedent. Doing this during the forced rewrite costs almost nothing; doing it later means touching all 36 twice.

**`extra` -> `ctx` remap that matters here:** `extra.sessionId` has no direct `ctx` equivalent on a 2026-era connection. `lib/core/session-binding.cjs`'s `resolveEffectiveSessionId(undefined, extra)` is called at seven sites in `tool-router.cjs` plus both gate tools. On 2025-era connections under v2 it keeps working; on 2026-era it does not. See Runtime State Inventory, row 2.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@modelcontextprotocol/sdk` single package | `@modelcontextprotocol/{core,server,client,node,express,fastify}` | 2026-07-27 (v2.0.0) | Import paths and package names all change. v1 and v2 coexist under different names. |
| `initialize` / `initialized` handshake | `server/discover` probe with `versionNegotiation` | spec 2026-07-28 | No handshake means no connection-scoped negotiated state. |
| `Mcp-Session-Id` header | per-request `_meta` envelope (`io.modelcontextprotocol/{protocolVersion,clientInfo,clientCapabilities,logLevel}`) | spec 2026-07-28 | Any request lands on any instance behind a plain round-robin LB. |
| Server->client requests (`elicitation/create`, `sampling/createMessage`, `roots/list`) | `return inputRequired({...})` from the handler; client retries with `inputResponses` | SEP-2322 (MRTR) | The server->client JSON-RPC channel is **removed** in the 2026 era. |
| Unsolicited `list_changed` / `resources/updated` notifications | `subscriptions/listen` stream the client opens | spec 2026-07-28 | Server never sends an un-requested notification type. `resources/subscribe` is 2025-only. |
| `logging/setLevel` RPC | per-request `_meta.logLevel` envelope key; **absent = opt-out, not "no filter"** | spec 2026-07-28 | The SDK `Client` does not auto-attach `logLevel`, so handler logs on a default 2026 exchange are silently suppressed. |
| POST `notifications/cancelled` | close the request's SSE response stream (Streamable HTTP, 2026 era only) | spec 2026-07-28 | Nothing to change in calling code. |
| `server.tool()` / `.prompt()` / `.resource()` variadic | `registerTool` / `registerPrompt` / `registerResource` with config object | v2.0.0 | The variadic forms are **removed**, not deprecated. |
| zod `^3.25 \|\| ^4.0` peer | `zod ^4.2.0` dependency | v2.0.0 | zod 3 fails quietly at first `tools/list`. |
| `RequestHandlerExtra` (`extra`) | structured `ServerContext` / `ClientContext` (`ctx`), with `ctx.mcpReq.*` and `ctx.http?.*` | v2.0.0 | `ctx.http` is `undefined` on stdio - needs optional chaining. |
| `IsomorphicHeaders` bracket access | Web Standard `Headers` with `.get()` | v2.0.0 | Header *reads* change; headers passed *in* via plain objects are unchanged. |
| `McpError` | `ProtocolError`; `ErrorCode` splits into `ProtocolErrorCode` + `SdkErrorCode` | v2.0.0 | `RequestTimeout` and `ConnectionClosed` move to `SdkErrorCode`. |

**Deprecated / removed, relevant here:**
- **Sampling, Roots, Logging** - deprecated per SEP-2577 (per the 266 addendum's Tavily sourcing). This repo uses none of them. `[CITED: 266-RESEARCH-stateless-spec-update.md, not independently re-verified in this pass]`
- **Tasks** (`tasks/*`, `TaskStatus` incl. `input_required`) - deprecated wire vocabulary, excluded from v2's typed method maps; inbound `tasks/*` on a 2026 connection gets `-32601`. This repo does not implement tasks (`lib/mcp/capability-registry.cjs` names Tasks as a Phase 58/60 hook point, never built).
- **`SSEServerTransport`** - removed; frozen copy in `@modelcontextprotocol/server-legacy/sse`. Not used here.
- **`WebSocketClientTransport`** - removed. Not used here.
- **`LegacyTitledEnumSchemaSchema`** (`enum` + `enumNames`) - the shape `lib/mcp/gate-render.cjs:189-201` emits today, carrying a removal notice in SDK 1.29.0. The 265 audit's R-5 already scoped this fix. **Sequencing note:** R-5 rewrites the elicitation schema in the v1 idiom; Pattern 3 above rewrites the same code in the v2 idiom. Doing both is wasted work - decide which one this phase does.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 2026-07-28 spec deprecates Sampling, Roots, and Logging (SEP-2577) with a 12-month backward-compatibility window | State of the Art | Low. Not used by this repo either way. Sourced from the 266 addendum's Tavily pass; I confirmed the *spec revision* exists via the official repo but did not read SEP-2577 itself. |
| A2 | Claude Desktop and Cowork ship the same MCP client era-negotiation behavior as Claude Code CLI | Tri-Polar / Environment | **Medium-high.** I verified Claude Code CLI's behavior from its public CHANGELOG. There is no equivalent public changelog for Desktop or Cowork. If Desktop lags on era support, a `legacy: 'reject'` anywhere breaks that surface silently. This is a Tri-Polar gap that needs a live probe on each surface, not an inference. |
| A3 | The `@modelcontextprotocol/codemod` package produces useful output on CJS `require()` source | Standard Stack / Pitfall 8 | Medium. The guide is written for TypeScript ESM. It explicitly says import-less injected surfaces are never rewritten, which covers 20 of this repo's 36 tools. The codemod may still handle the 9 direct-import sites well. **Not tested in this pass** - a dry run is the cheapest possible spike. |
| A4 | Migrating `mcp-server-brain` to v2 does not change what any plugin-side client sees on the wire | Recommendation | Medium. Rests on `createMcpHandler`'s default `legacy: 'stateless'` serving 2025 clients identically. The guide asserts it; I did not run a live cross-version probe. A `legacy: 'stateless'` regression would take the Brain offline for every installed user, which is the highest-blast-radius outcome in this phase. |
| A5 | No published `@modelcontextprotocol/ext-apps` release supports SDK v2 | Pitfall 3 | Low. Verified `1.7.5` is `latest` and its peer is `^1.29.0`, and it predates v2 by four days. Could change any day - **re-check at plan time**, not at execute time. |
| A6 | The repo's ~200 other zod call sites are compatible with a zod 3 -> 4 bump | Standard Stack / Pitfall 2 | **High and unmeasured.** I verified v2 *requires* zod 4 but did **not** audit this repo's own zod usage for v3-to-v4 breaking changes (`z.ZodTypeDef` removed, `z.ZodType` generics changed, `.regex()` / `.positive()` behavior). This is the biggest un-sized item in the phase. |

---

## Open Questions

1. **Does the navigator still want this phase, given the premise is falsified?**
   - What we know: the directive was "build now, not a dormant ledger candidate," issued on the belief that a 1.29 -> 1.30 bump delivers stateless. It does not. The real work is a package-family migration with a hard third-party blocker.
   - What's unclear: whether "build now" survives contact with a 3-5x larger, partially-blocked scope.
   - Recommendation: surface this before planning. The honest framing is not "should we defer" but "the phase is real and worth doing, and it is a different, larger phase than the ROADMAP describes." Propose the Brain-server-first split (which is genuinely shippable now, independently, with low blast radius) as the Phase 267 the navigator actually gets, and let the local-server half become 267b gated on ext-apps.

2. **What is the ext-apps ruling?**
   - What we know: no v2-compatible release; the three MCP Apps tools are Desktop/Cowork-only surfaces (`room-dashboard`, `room-wiki`, `room-graph`).
   - What's unclear: whether losing them temporarily is acceptable, and whether an upstream issue has been filed.
   - Recommendation: file an upstream issue against `modelcontextprotocol/ext-apps` regardless (it costs nothing and starts the clock), and default to holding the local server on v1 rather than dropping a Tri-Polar surface.

3. **Does the official codemod do anything useful on CJS?**
   - Recommendation: cheapest possible spike. `npx`-free: install `@modelcontextprotocol/codemod` as a devDependency in a scratch clone and run `v1-to-v2 --dry-run` against `mcp-server-brain/`. Fifteen minutes, and it sizes the whole manual-rewrite estimate.

4. **How does the API-key plan tier reach a `createMcpHandler` factory?**
   - What we know: `registerNeo4jTools(server, { plan: req.brainPlan })` closes over the Express request today; `createMcpHandler`'s factory does not receive it. The D-MOAT-1 admin gate on `brain_query` depends on this.
   - What's unclear: the exact factory signature and whether the web-standard `Request` is reachable from it.
   - Recommendation: **this is a spike, not a task.** A moat guard is on the line (`mcp-server-brain/CLAUDE.md`, D-MOAT-1). Prove the seam before writing the plan.

5. **Where does the `requestState` HMAC key come from, if MRTR is adopted?**
   - What's unclear: env var name, generation, rotation, and behavior when absent. A per-process random key is the safe default for a single-instance deployment but breaks the moment a second instance exists.
   - Recommendation: defer entirely. MRTR only matters on the local server, which is blocked on ext-apps anyway.

6. **Does any Claude host actually declare the elicitation capability now?**
   - What we know: two data points in tension. Claude Code **2.1.76** added MCP elicitation support per its own CHANGELOG; the 265 audit's **live wire probe on 2026-08-27** found no elicitation capability negotiated, and `lib/mcp/tools/gate.cjs:9-11` cites issue #2799 as still open.
   - Why it matters: if elicitation is live, rung (a) is live, and the deprecated `enumNames` schema (265 R-5) becomes a **real user-facing bug** rather than a latent one - and MRTR stops being theoretical.
   - Recommendation: a fresh wire probe of `initialize` on all three surfaces is a Wave 0 task. It is a five-minute check that changes the priority of two separate findings.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | v2 requires >= 20; repo engine floor is >= 22.16.0 | yes | v22.23.1 | none needed |
| npm | manifest edits, install | yes | bundled | none needed |
| `@modelcontextprotocol/sdk` | current v1 servers | yes (installed) | 1.29.0 (plugin), 1.27.1 (mcp-server-brain) | n/a |
| `@modelcontextprotocol/server@2.0.0` | the migration | installable + **CJS `require()` verified working** | 2.0.0 | none |
| `@modelcontextprotocol/ext-apps` | `lib/mcp/app-views.cjs` MCP Apps | yes, but **peer-pinned to SDK ^1.29.0** | 1.7.5 (latest) | **no v2-compatible fallback exists** |
| `zod` | all tool schemas | yes | 3.25.76 (repo declares `^3.25.76`) | v2 needs `^4.2.0`; alias `"zod-v4": "npm:zod@^4.2.0"` is the documented escape hatch |
| `express` | both HTTP servers | yes, **direct dep** | `^5.1.0` | unaffected by SDK swap |
| `ajv` | `lib/core/brain-client.cjs` Phase 110 typed packets | yes, **direct dep** | `^8.18.0` | unaffected (was transitive via v1 SDK; already declared directly, so no loss) |
| `slopcheck` | package legitimacy gate | yes | installed this session | n/a |
| `gh` CLI | reading official SDK release bodies and migration guides | yes, authenticated | n/a | WebFetch (returned 404 on the SDK's `CHANGELOG.md` - the repo has no root changelog; releases are the source) |

**Complete production SDK import surface (9 sites, the full migration blast radius):**

| File:line | Symbols |
|---|---|
| `bin/mindrian-mcp-server.cjs:55,56,223` | `McpServer`, `StdioServerTransport`, `StreamableHTTPServerTransport` |
| `bin/mindrian-brain-mcp-client.cjs:40,41` | `McpServer`, `StdioServerTransport` |
| `bin/mindrian-mcp-shim.cjs:36,37` | `StdioServerTransport`, `StreamableHTTPClientTransport` |
| `lib/mcp/adapter-client.cjs:21,22` | `Client`, `StreamableHTTPClientTransport` |
| `lib/mcp/resources.cjs:21` | `ResourceTemplate` (**note: the codemod renames the *type* to `ResourceTemplateType` but keeps the URI-template *class* name - this is the class, so no rename**) |
| `mcp-server-brain/server.cjs:4,5` | `McpServer`, `StreamableHTTPServerTransport` |
| `lib/core/mcp-dep-heal.cjs:172` | package-name string literal in the probe fallback array |
| `lib/mcp/app-views.cjs:25` | `@modelcontextprotocol/ext-apps/server` (indirect SDK coupling) |
| JSDoc type refs (no runtime effect) | `capability-registry.cjs:32`, `app-views.cjs:232`, `tool-router.cjs:632`, `prompts.cjs:91` |

**Missing dependencies with no fallback:** an ext-apps release compatible with SDK v2. This is the only genuine blocker and it is upstream.
**Missing dependencies with fallback:** zod 4 (per-package alias available).

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in (`node:assert` + `node:test` in `.test.cjs` files) and bare `node <file>.cjs` scripts printing `PASS:` / `FAIL:` |
| Config file | none - `tests/run-all-<phase>.sh` shell drivers are the aggregation seam |
| Quick run command | `node tests/test-198-gate-renderers.test.cjs` (verified green this session) |
| Full suite command | `bash tests/run-all-198.sh` (gate/MCP layer), `node scripts/doctor.cjs --acceptance` (roll-up) |

### Phase Requirements -> Test Map

`.planning/REQUIREMENTS.md` contains **no 267-prefixed requirement IDs** (grep returns nothing) and the ROADMAP entry says `**Requirements**: TBD`. The map below is therefore derived from the four ROADMAP goals, and the planner should mint real IDs.

| Derived Req | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| G1a | The chosen SDK version actually implements 2026-07-28 (guards Pitfall 1) | unit | `node tests/test-267-sdk-era-assert.cjs` | ❌ Wave 0 |
| G1b | Brain server answers `tools/list` with 6 tools over the wire (guards Pitfall 2, the silent zod-3 failure) | integration | `node tests/test-267-brain-tools-list.cjs` | ❌ Wave 0 |
| G1c | Local server answers `tools/list` with the full tool set over stdio | integration | extend `scripts/doctor.cjs` L4 with a `tools/list` + count + zero-tool assertion (265 R-7) | ❌ Wave 0 |
| G2 | Gate answer identity holds across all three rungs after any gate-render change | unit | `node tests/test-198-gate-renderers.test.cjs` | ✅ green today |
| G2b | Elicitation `requestedSchema` uses the current titled form, not `enumNames` | unit | `tests/test-198-gate-renderers.test.cjs:60` currently asserts the **legacy** shape and must be updated | ✅ exists, asserts wrong thing |
| G3a | Every declared MCP surface survives a registration-API rewrite | gate | `node scripts/build-connector-registry.cjs --check` | ✅ exists |
| G3b | Every surface keeps its HITL shape declaration | gate | `node scripts/check-shape-declaration.cjs --strict` | ✅ exists (advisory by default) |
| G3c | Tri-Polar: all three surfaces connect and negotiate cleanly | manual + probe | live probe per surface - **no automated harness exists**; see Wave 0 | ❌ Wave 0 |
| G4a | Tool descriptions keep their prose contract across the rewrite | unit | `node tests/test-234-tool-description-floor.cjs` (covers 8 of 36 - 265 R-3 widens it) | ✅ exists, partial |
| G4b | Dependency self-heal still probes for packages that exist | unit | `node lib/core/mcp-dep-heal.test.cjs` - **will fail** once the SDK package name changes | ✅ exists, needs update |
| G4c | Supply-chain allowlist covers every new package | gate | `bash tests/run-all-199.sh` (agentshield) | ✅ exists |
| G4d | Flag-OFF byte-identical parity preserved | integration | `node tests/test-198-flag-off-parity.test.cjs`, `bash tests/parity-198.sh` | ✅ exists |
| G4e | Concurrent multi-session HTTP still works (guards the 198-08 regression) | integration | `node tests/test-198-concurrency-mcp.test.cjs` | ✅ exists |

### Sampling Rate

- **Per task commit:** `node tests/test-198-gate-renderers.test.cjs && node scripts/build-connector-registry.cjs --check`
- **Per wave merge:** `bash tests/run-all-198.sh && bash tests/run-all-234.sh && bash tests/run-all-199.sh`
- **Phase gate:** `node scripts/doctor.cjs --acceptance` green, plus the new `tools/list` wire assertions green on all three surfaces, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/test-267-sdk-era-assert.cjs` - asserts the installed SDK's `LATEST_PROTOCOL_VERSION` and the presence of the 2026 method vocabulary. The single cheapest guard against Pitfall 1, and it fails today by design.
- [ ] `tests/test-267-brain-tools-list.cjs` - spawns/dials the Brain server and asserts `tools/list` returns 6 tools with non-empty descriptions. Guards the silent zod-3 failure (Pitfall 2). Extends the existing `mcp-server-brain/test-brain.cjs`.
- [ ] `scripts/doctor.cjs` L4 extension - add `tools/list`, report the count, fail on zero. This is 265 recommendation R-7, and it is a **prerequisite** here rather than a nice-to-have, because it is the only thing that catches a server that connects but registers nothing.
- [ ] **Fresh `initialize` wire probe on all three surfaces**, recording negotiated protocol version and declared client capabilities (especially `elicitation`). Resolves Open Question 6 and assumption A2 in one pass. No harness exists; `tests/test-248-surface-probes.cjs` is the closest precedent to extend.
- [ ] `lib/core/mcp-dep-heal.test.cjs` update - its `FALLBACK` literal and four fixture manifests hard-code `@modelcontextprotocol/sdk`.
- [ ] Codemod dry-run spike (Open Question 3) - not a test, but it sizes every downstream estimate.

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (Brain server only) | Static API key via `mcp-server-brain/lib/auth.cjs` `validateApiKey`, Express middleware on `/mcp`. **The `createMcpHandler` migration moves this seam** - see Open Question 4. The local servers are stdio with no auth. |
| V3 Session Management | yes | The 2026 era **deletes sessions**. `lib/mcp/gate-ledger.cjs`'s session-keyed, single-use, TTL-bounded mint/consume is the anti-replay control and must survive any migration intact (T-198-10 / T-198-12 doctrine). |
| V4 Access Control | yes | D-MOAT-1: `brain_query` and `brain_write` are admin-plan-gated. `req.brainPlan` is the carrier. **This is exactly what Open Question 4 puts at risk** - a factory that cannot see the plan tier silently ungates the moat. Treat any `createMcpHandler` task as touching an access-control boundary. |
| V5 Input Validation | yes | zod schemas on every tool input; `validateChosenAgainstCard` (`gate-render.cjs:262`) is the GATE-01 G-2 value-domain check. Under v2, `acceptedContent(responses, key, schema)` is the analogous control for MRTR responses - the SDK does **not** re-validate accepted elicitation content against `requestedSchema` on either era. |
| V6 Cryptography | yes, if MRTR is adopted | `createRequestStateCodec` (HMAC-SHA256, signed **not encrypted**). Never hand-roll. Key management is Open Question 5. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged / replayed `gate_id` reaching `navigation.cjs` | Spoofing | Existing: `gate-ledger.cjs` single-use, session-keyed, 30-min TTL (T-198-10). **Must not regress during migration.** |
| Forged `requestState` on retry | Tampering | `ServerOptions.requestState.verify` hook runs before the handler on every round, including the legacy shim path; a rejection answers `-32602` above the tool funnel. |
| Room content leaking through `requestState` | Information Disclosure / **Canon Part 8 breach** | `requestState` is client-visible base64url. Carry opaque handles only. See Pitfall 5. |
| Unbounded MRTR round loop | Denial of Service | `inputRequired.maxRounds` (client driver default 10, shim default 8); `SdkError(InputRequiredRoundsExceeded)`. Set explicitly rather than relying on defaults. |
| `Mcp-Param-*` header / body disagreement | Tampering | `createMcpHandler` rejects with `400` + JSON-RPC `-32020` (`HeaderMismatch`). Automatic; no repo code needed. |
| Cypher injection via `brain_query` | Tampering / Info Disclosure | Existing D-MOAT-1 admin gate + D-MOAT-2 caps (`BRAIN_CYPHER_MAX_ROWS/BYTES/TIMEOUT_MS/MAX_ESTIMATED_ROWS`). Unchanged by the SDK swap, **but see V4 above** - the gate's carrier changes. |
| Supply-chain: new scoped packages | Tampering | `references/security/cve-db.json` allowlist + `lib/core/security/agentshield-scanner.cjs`. Every v2 package needs a VETTED entry. slopcheck clean (see audit). |
| Tool output trusted as instruction | Elevation of Privilege | Named by the 265 audit's corpus grounding as an unmitigated class on `artifact_file` / `meeting` ingest. **Out of scope for this phase**, noted so it is not lost. |

---

## Sources

### Primary (HIGH confidence)

- `gh release view "@modelcontextprotocol/server@2.0.0" --repo modelcontextprotocol/typescript-sdk` - the v2 release body, read in full. Establishes 2026-07-28 support, CJS builds, `inputRequired.elicit()`, the spec PR #3002 final-revision alignment, and the SEP-2243 header work.
- `gh release list --repo modelcontextprotocol/typescript-sdk --limit 8` - the eight v2 package tags, all 2026-07-27T23:55Z.
- `docs/migration/upgrade-to-v2.md` (1,874 lines) - fetched via `gh api`, read in full for Packaging & runtime, Imports & transports, Low-level protocol / `ctx`, and Server registration API.
- `docs/migration/support-2026-07-28.md` (723 lines) - fetched via `gh api`, read in full. Every MRTR, `requestState`, `createMcpHandler`, `serveStdio`, and legacy-shim claim above comes from here.
- `gh api repos/modelcontextprotocol/modelcontextprotocol/contents/docs/specification` - confirms `2026-07-28/` exists alongside `2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25`, `draft`.
- **Byte-level comparison of SDK 1.29.0 (on disk) vs 1.30.0 (`npm pack`, extracted to scratch).** md5 of `dist/cjs/types.js` identical on both. `find`-based file-list diff and per-file md5 sweep yielding exactly 8 changed JS files + 2 new. Marker greps for the nine 2026-era vocabulary tokens. This is the evidence for Finding F-1 and it is reproducible.
- `npm view` against the registry for versions, dist-tags, publish times, engines, dependencies, and peerDependencies of `@modelcontextprotocol/{sdk,core,server,client,node,codemod,ext-apps}`.
- **Live `require()` smoke test** of the installed v2 packages: `@modelcontextprotocol/server` exports `McpServer, acceptedContent, createMcpHandler, createRequestStateCodec, fromJsonSchema, inputRequired, inputResponse`; `@modelcontextprotocol/server/stdio` exports `StdioServerTransport, serveStdio`. CJS `require()` confirmed working.
- `anthropics/claude-code` `CHANGELOG.md` raw (5,930 lines, curl'd, version attribution derived with an `awk` pass tracking the enclosing `## <version>` heading, per the 265 audit's documented method). Establishes 2.1.238 (`server/discover` to stdio servers) and 2.1.76 (elicitation support added).
- This repo, read directly: `bin/mindrian-mcp-server.cjs` (404 lines, full), `lib/mcp/gate-render.cjs` (425 lines, full), `lib/mcp/tools/gate.cjs` (303 lines, full), `mcp-server-brain/server.cjs` (86 lines, full), `bin/mindrian-mcp-shim.cjs`, `lib/mcp/gate-ledger.cjs` (head), `lib/mcp/session-registry.cjs` (head), `scripts/doctor.cjs:1298-1360`, `package.json`, `mcp-server-brain/package.json`, `references/security/cve-db.json`, `CLAUDE.md` + its four `@include` files, `mcp-server-brain/CLAUDE.md`.
- `slopcheck install` against all five candidate v2 packages: 5 OK, 0 SLOP, 0 SUS.

### Secondary (MEDIUM confidence)

- `.planning/phases/265-.../265-RESEARCH-mcp-layer-audit.md` - the MCP layer audit. Its wire measurements (36 + 6 tools, description byte counts, zero annotations, no elicitation capability negotiated) are treated as authoritative for repo state as of 2026-08-27 and were not re-measured here.
- `.planning/phases/266-.../266-RESEARCH-stateless-spec-update.md` - the spec addendum. Its spec-revision claim is **confirmed** by the official repo. Its 1.30.0 speculation was correctly hedged and is now **resolved as negative**. Its "held-open-SSE" characterization of `gate-render.cjs` is **corrected** by direct code reading.

### Tertiary (LOW confidence)

- SEP-2577 (Sampling/Roots/Logging deprecation) and the 12-month compatibility window - carried from the 266 addendum's Tavily pass, not independently verified here. Immaterial: this repo uses none of the three.
- Claude Desktop and Cowork MCP client era-negotiation behavior - **no public source found**. Inferred from Claude Code CLI only. This is assumption A2 and it is the weakest link in the Tri-Polar analysis.

---

## Metadata

**Confidence breakdown:**
- **Falsification of the phase premise (1.30.0 is not stateless):** HIGH. Byte-level md5 comparison of two tarballs, reproducible in one command.
- **Correct migration target (v2 package family):** HIGH. Official release bodies plus two official migration guides read in full plus a live `require()` smoke test.
- **Repo state (what is already stateless, what gate-render actually does):** HIGH. Every claim is file:line from a full read.
- **ext-apps blocker:** HIGH on the peer pin (registry-verified at the latest version). MEDIUM on the consequence, since the exact failure mode was reasoned from the guide's boundary rule rather than reproduced.
- **zod 3 -> 4 blast radius inside this repo:** LOW. The v2 requirement is HIGH-confidence; this repo's own ~200 zod call sites were **not** audited. Largest un-sized risk in the phase.
- **Tri-Polar backward compatibility:** MEDIUM for Claude Code CLI (public changelog). LOW for Desktop and Cowork (no source; inferred). The phase's goal (3) cannot be closed on inference - it needs a live probe per surface.
- **Architecture patterns and MRTR mechanics:** HIGH. Direct from `support-2026-07-28.md`.

**Research date:** 2026-08-27
**Valid until:** 2026-09-10 (14 days). Short deliberately: the v2 packages are 62 days old and moving, and the single biggest blocker - an ext-apps release supporting v2 - could land any day and change the whole recommended shape of the phase. **Re-run `npm view @modelcontextprotocol/ext-apps@latest peerDependencies` before planning.**

**Working-tree note:** slopcheck's `install` subcommand performed a real `npm install` in this repo. `package.json` and `package-lock.json` were reverted via `git checkout --`, `npm install` was re-run, and `@modelcontextprotocol/sdk@1.29.0` was re-confirmed on disk with `node_modules/@modelcontextprotocol/` containing exactly `ext-apps` and `sdk`. The only remaining working-tree modifications are `.planning/ROADMAP.md` and `.planning/STATE.md`, which were touched by `gsd-tools query init.phase-op 267`, not by this research.
