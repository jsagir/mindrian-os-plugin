# Phase 267: MCP Stateless Protocol Migration - Research (FORCE-REFRESH)

**Researched:** 2026-09-23 (force-refresh of the 2026-08-27 pass, which had a 14-day validity window and was 27 days past it)
**Domain:** MCP protocol revision 2026-07-28 (SEP-2575 stateless, SEP-2322 MRTR, SEP-2243 headers) and the TypeScript SDK v1 -> v2 package-family migration, applied to the ONE MCP server family this repo still owns: the local `mindrian-os` server plus its two stdio siblings
**Confidence:** HIGH on every load-bearing claim. The new findings rest on live probes run in this session: a Claude Code 2.1.280 wire tee, a dual-era `serveStdio` round trip, a real-server boot under zod 4, the codemod run on a scratch copy, npm tarball diffs, and official release bodies. Anything that could not be grounded is labelled as such.

**Working-tree note (measurement provenance):** every live probe against this repo ran on HEAD `0ddd4fa75` plus a peer session's uncommitted edits to `lib/mcp/tool-router.cjs` and `lib/mcp/tools/sensors.cjs`. This research did not create or touch those edits. All scratch work (tarballs, a v2 install, probes, the codemod run) lived under the session scratchpad. The repo's `package.json`, lockfiles, and `node_modules` were never modified. slopcheck ran in `scan` mode from a scratch directory, not `install` mode in the repo.

---

## Summary

**The one hard blocker is gone, and the reasoning behind it was also partly wrong.** `@modelcontextprotocol/ext-apps` shipped `2.0.0` on **2026-09-08** (not 09-17; that is the npm `modified` stamp). Its peers are now `@modelcontextprotocol/{core,client}: ^2.0.0` (required), `@modelcontextprotocol/server: ^2.0.0` (optional, only for `./server`), and `zod: ^4.2.0`. The release notes say the MCP Apps wire protocol is unchanged, with cross-version interop tested against 1.7.5 in both directions. The prior research said the blocker was a nominal-type crossing, and that part was **wrong in mechanism**. I diffed both tarballs. `registerAppTool` and `registerAppResource` are duck-typed wrappers in **both** 1.7.5 and 2.0.0: they just call `server.registerTool(...)` and `server.registerResource(...)`. The real 1.x coupling was that the bundled `./server` entry imported `@modelcontextprotocol/sdk/...` at load time and declared the v1 peer. The 2.0.0 `./server` entry is 561 bytes with **zero runtime imports**. A live CJS smoke test (ext-apps 2.0.0 against `@modelcontextprotocol/server@2.1.0` on Node 22.23.1) registered, listed, and called all three app tools correctly. The API change 1.7.5 -> 2.0.0 that matters to this repo is small: raw-shape `inputSchema` became a deprecated-but-working overload. The lockfiles actually pin ext-apps **1.5.0**, not 1.7.5.

**The prior primary recommendation (Brain-server-first split) is moot for two independent reasons, and I do not carry it forward.** (1) `mcp-server-brain/` is a **dead service**, per `docs/257-NOTE-part8-enforcement-locus-rulings.md:22`. The live Brain is Theo at `theo-mcp.onrender.com` (`lib/core/brain-client.cjs:40`), a separate repo, and ROADMAP line 615 already moved the Brain half out of this phase. (2) The ext-apps reason for holding the local server back no longer exists. **Fresh recommendation:** one phase, one in-repo target: the local `mindrian-os` server, the brain stdio shim, and the two in-repo MCP clients. Do it as one migration that is **internally staged along process boundaries**, the way the official guide recommends. The small, isolated brain stdio shim goes first as a canary, then the local server over stdio, then the HTTP branches, and v1 is removed last. The codemod is out (see below).

**Three findings change what this phase is actually worth, and the navigator should see them before planning.**
- **Claude Code speaks 2025-11-25 to stdio servers, even ones that offer 2026-07-28.** A live tee in front of a v2 dual-era server showed Claude Code **2.1.280** opening with a plain `initialize` at `2025-11-25`. There was no `server/discover` probe and no probe sibling process. The prior research read the 2.1.238 CHANGELOG line backwards. It says *"Fixed stdio MCP servers receiving a `server/discover` request before `initialize`"*, meaning the host **stopped** probing stdio. The host negotiates 2026-07-28 only with **direct HTTP servers**, by default since before 2.1.274 (the 2.1.274 entry extends that default to Bedrock/Vertex/Foundry/telemetry-off installs). So moving the CLI and Desktop stdio paths to `serveStdio` changes **nothing on the wire today** for Claude Code. It is future-proofing. The 2026 era gets exercised on this repo's HTTP branch.
- **This repo's flag-OFF HTTP branch is broken today, for every client and every era.** It serves exactly **one** HTTP request per process lifetime. `initialize` returns 200, then `notifications/initialized`, `tools/list`, and everything after return 500. The cause is that `bin/mindrian-mcp-server.cjs:318` builds ONE stateless `StreamableHTTPServerTransport` and reuses it, and the SDK has a guard that throws `"Stateless transport cannot be reused across requests"` (`webStandardStreamableHttp.js:142`, present in both 1.27.1 and 1.29.0). `lib/mcp/surface-detect.cjs:36-58` routes every Cowork VM (`CLAUDE_SURFACE=cowork`, `COWORK_SESSION_ID`, or a `/sessions` dir) to this branch. Whether real Cowork reaches it could not be probed from here. `createMcpHandler(createServer)` builds a fresh server per request, so it fixes this **by construction**. That makes the HTTP half of this phase a bug fix with a protocol upgrade attached.
- **Claude Code 2.1.280 now declares `elicitation: {}`.** This reverses the 265 audit's "no Claude host declares elicitation", and it makes the comment at `lib/mcp/tools/gate.cjs:145-152` stale. Result: gate rung (a), the inline `server.server.elicitInput` round trip, is the **live** CLI gate path today, driven by a host change rather than a repo change. The 265 R-5 schema fix already shipped, and `tests/test-265-gate-render-elicit-schema.cjs` passes. On a 2025-era connection, which is what stdio is, v2 keeps `elicitInput` working. So the MRTR rework is **not required** for this phase.

**The zod 3 -> 4 blast radius, which the prior research called "High and unmeasured" (A6), is now measured and LOW at runtime.** I booted the real server under zod 4.6.5 (every `require('zod')` redirected in a scratch preload; the v1 SDK 1.29.0 peer accepts `^3.25 || ^4`). It registered all 42 tools and 9 prompts. Every tool description is byte-identical, and every prompt is identical. `bash tests/run-all-198.sh` gives **identical per-leg outcomes** under zod 3 and zod 4 (21 pass, and the same 3 legs fail, which are pre-existing). The wire-visible change is real, though: `additionalProperties: false` disappears at **38** schema sites across **35 of 42** tools. That is how zod 4 renders default (strip) objects. Runtime stripping behavior is unchanged, and Phase 257's strict-object arms still pass under zod 4. One test-infra break: `tests/test-198-contract-schema.test.cjs:210-212` introspects `_def.typeName`, which is `undefined` in zod 4.

**The official codemod does nothing useful here, and its one action is harmful.** Run on a scratch copy of `bin/` + `lib/` + `package.json`, it rewrote **zero** source files. It **removed** `@modelcontextprotocol/sdk` from `package.json` without adding any v2 package, leaving a manifest that can't resolve. A controlled test showed why: it rewrites ESM `import` only, so `require()` in `.js` and `.cjs` is ignored. This resolves prior Open Question 3 as **negative**: hand-migrate.

**Primary recommendation:** plan Phase 267 as a **local-server-only, unified, internally-staged v2 migration**, with a zod-4 + SDK 1.30.1 Wave 0 that ships green on v1 first. Hand-migrate 51 variadic registration sites (no codemod). Adopt `serveStdio` on the two stdio servers. Replace the broken flag-OFF HTTP branch with `createMcpHandler`. Keep the flag-ON daemon sessionful through the guide's `isLegacyRequest` + `legacy: 'reject'` routing. Keep MRTR, `mcp-server-brain`, and Theo out of scope.

---

## Project Constraints (from CLAUDE.md)

Carried from 2026-08-27, **re-confirmed 2026-09-23** against the current `./CLAUDE.md` and its four `@include` files. Changes are marked.

| # | Directive | Bearing on this phase |
|---|-----------|----------------------|
| C-1 | **Workspace guard.** Every commit, git op, and GSD phase runs from `/home/jsagi/dev/MindrianOS-Plugin/`. | Re-confirmed: `pwd` = dev workspace; `git fetch origin main` shows zero ahead and zero behind. Use `node lib/core/repo-version.cjs` for the version (reads `2.0.0-beta.48`), never a tree search. |
| C-2 | **Tri-Polar Design Rule.** Evaluate every feature through CLI + Desktop + Cowork. | **Sharpened this session:** CLI stdio is 2025-era by host choice (verified live). Desktop is unknown (no public changelog, A2). Cowork routes to the HTTP branch, which is broken today (verified live). |
| C-3 | **Canon Part 8 - Graph Boundary.** User data never egresses to the Brain. | **Corrected scope:** `requestState` minted by the LOCAL server goes back to the MCP host, which already holds the tool results. It is a tamper surface (V5/V6), not a Brain-egress surface. Part 8 still binds anything this phase touches on the brain stdio shim (`bin/mindrian-brain-mcp-client.cjs`) and `lib/core/part8-egress-guard.cjs`. |
| C-4 | **Canon Part 7 - Reuse Before Build.** | Argues for reusing Phase 356's shipped `data/command-irreversibility-ledger.json` if tool annotations are added, and for the SDK's `createRequestStateCodec` over a hand-rolled one. |
| C-5 | **Canon Part 11 - CIRS.** Every surface is born WIRED or EXCLUDED with a HITL shape; `scripts/check-shape-declaration.cjs` lints (advisory WARN by default). | 51 registration rewrites touch every tool module's sibling `connectors` export. Run `build-connector-registry.cjs --check` and `check-shape-declaration.cjs --strict` per commit. |
| C-6 | **Release lockstep** via `scripts/release.sh <version>` (RULE 5 in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` carries the count). Never bump by hand. | **Changed since 08-27:** Phase 341 retired vendored `node_modules`. Dependencies now ship as `npm-shrinkwrap.json` (tracked) and install per machine via the loader's `npm ci --ignore-scripts`. The v2 packages must land in `package.json`, `package-lock.json`, **and** `npm-shrinkwrap.json`. `scripts/check-release-payload-ceiling.cjs` (20,000 entries / 256 MiB) must stay green. |
| C-7 | **CJS only, no TypeScript.** | **Now measured:** the codemod does not touch CJS `require()`. All migration is by hand. |
| C-8 | **No em-dashes anywhere.** Hyphens only. Feynman, JTBD prose. | Applies to every tool description touched. `tests/test-234-tool-description-floor.cjs` enforces part of it. |
| C-9 | **Dev-Research Compositing.** Research goes in BOTH the phase dir and `~/MindrianRooms/rethinking-mindrianos/research/`, cross-linked. | Room mirror filed this session. Filing status and path are in the return message and below under Sources. |
| C-10 | **Consult ALL relevant grounding sources** (six standing sources). | Done this pass: Theo, langtalks, icm-architect, the Jev spike skill, the official SDK/spec/ext-apps releases, and the Claude Code CHANGELOG. See "Grounding Consults". Context7 CLI (`ctx7`) is not installed. Zod facts come from the official `zod.dev/v4/changelog` via WebFetch and were then **measured live** against zod 4.6.5. |
| C-11 | **Supply-chain allowlist** `references/security/cve-db.json` `surfaces.supply_chain.allowlist` (15 entries). | Re-confirmed: `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, and `zod` are VETTED. `@modelcontextprotocol/{server,core,client}` (and `node` if used) each need a new VETTED entry. |
| C-12 | **QA/RCA standard.** A NEW FAILURE gets `.planning/debug/<slug>.md` per `docs/RCA-TEMPLATE.md`. | **Three NEW FAILURES found this session**, each needing an RCA: (1) flag-OFF HTTP one-request lifetime; (2) `app-views.cjs` `schema:` key drops all three MCP Apps input schemas; (3) the `gate.cjs` elicitation premise is stale, so rung (a) is live on CLI. Two pre-existing test failures were also observed: `test-257` Arm F (stale `brain_ask` description fixture) and Arm B (a flaky `theo_health` boot race). |
| C-13 (new) | **Theo routing rule (THEO-04).** Questions about Theo's own repo, schema, or code may read `/home/jsagi/Theo` directly. Anything carrying room content goes through the guarded `mindrian-brain` shim. | This research read only Theo's own `package.json`, `src/`, and `.planning/`. No room content was involved. |

**Upstream input:** no `267-CONTEXT.md` (`workflow.skip_discuss: true`). The binding navigator rulings in `ROADMAP.md` are: (a) "built NOW"; (b) 2026-09-01 "WAIT UPSTREAM", whose condition is now **satisfied**, since ext-apps 2.0.0 is out; (c) ROADMAP line 615, "the Brain-server half does not belong to MindrianOS-Plugin". No vendor-vs-gate-off question needs re-opening, because upstream shipped.

---

## What Changed Since 2026-08-27 (delta ledger)

Every load-bearing claim from the prior pass, with its current status.

| Prior claim / item | Status 2026-09-23 | Evidence |
|---|---|---|
| F-1: `sdk@1.30.0` does not implement 2026-07-28 | **RE-CONFIRMED, extended to 1.30.1.** `dist/cjs/types.js` md5 `a9989adb21fa11708f35cd6f6014d89a` is identical across 1.29.0 (installed), 1.30.0, and 1.30.1. `LATEST_PROTOCOL_VERSION = '2025-11-25'`. All 10 markers (`server/discover`, `inputResponses`, `inputRequests`, `requestState`, `Mcp-Method`, `Mcp-Name`, `ttlMs`, `cacheScope`, `resultType`, `2026-07-28`) have 0 hits. 1.30.1 changed 3 JS files and added `server/requestBody.js`. | `npm pack` of both, md5 plus grep; release body `1.30.1`: "[v1.x] fix(server): read HTTP request bodies with a size limit and bound JSON-RPC batch length" (#2717) plus an auth resource-URI fix. |
| v2 family is at 2.0.0 | **UPDATED:** `server`, `core`, `client`, `node`, `codemod`, and `server-legacy` are at **2.1.0** (published **today**, 2026-09-23T15:43Z). `express` and `hono` are 2.0.1; `fastify` is 2.0.0. `server@2.1.0` pins `core` **exactly** at `2.1.0`. | `npm view`, `gh release list`. |
| ext-apps hard blocker (Pitfall 3, OQ2, A5) | **RESOLVED.** 2.0.0 was published 2026-09-08. Peers are listed above. The prior "nominal-type crossing" mechanism was **wrong**: the helpers are duck-typed in both versions (see Summary). Live CJS smoke test passes. | Tarball diff of `dist/src/server/index.{js,d.ts}`; ext-apps `v2.0.0` release body; scratch smoke test. |
| Lockfile ext-apps version | **CORRECTED:** `package-lock.json` and `npm-shrinkwrap.json` pin `@modelcontextprotocol/ext-apps@1.5.0` (manifest `^1.5.0`), not 1.7.5. | lockfile read. |
| Primary rec: migrate `mcp-server-brain` first | **WITHDRAWN.** It is dead (`docs/257-NOTE...md:22`). The live Brain is Theo, a separate repo. | See Summary. |
| OQ1: does the navigator still want the Brain-first split | **MOOT.** Replaced with the fresh local-server recommendation above. | - |
| OQ3: codemod on CJS | **RESOLVED NEGATIVE.** Zero source rewrites. It strips the v1 dependency from the manifest without adding v2. It rewrites ESM `import` only. | Scratch run on a repo copy plus a controlled 3-file test (`.mjs` rewritten; `.js` and `.cjs` with `require` untouched). |
| OQ4: D-MOAT-1 plan-tier seam through `createMcpHandler` | **MOOT for this repo.** It was about the dead `mcp-server-brain`. Theo is keyless with no tiers (Theo `08.4-MOS-LEARNING.md`). **Precedent found anyway:** the retired PWS Brain ran `createMcpHandler((ctx) => buildBrainServer({...ctx, adminAllowed}), { legacy: 'stateless' })` behind `toNodeHandler`, with auth reaching the factory as `ctx.authInfo` via `req.auth` (`~/dev/ProblemsWorthSolving-Brain/src/http/app.mjs:13-14,323-330`). | Cross-repo reads. |
| OQ5: `requestState` HMAC key source | **DEFERRED, still.** MRTR is out of scope (see OQ6). | - |
| OQ6: does any Claude host declare elicitation | **RESOLVED for CLI: YES.** Claude Code 2.1.280 `initialize` carries `capabilities: {"roots":{"listChanged":true},"elicitation":{}}` (print mode, live tee). Desktop and Cowork are still unprobed. | Live wire tee, see Environment. |
| A1: SEP-2577 deprecates Sampling, Roots, Logging | **VERIFIED** from the spec itself. `schema/2026-07-28/schema.ts` marks `roots`/`sampling` capabilities `@deprecated Deprecated as of protocol version 2026-07-28 (SEP-2577). Remains in the specification for at least twelve months`. | `gh api` spec read. |
| A2: Desktop and Cowork share the CLI's era behavior | **STILL OPEN.** It now matters less, because the CLI itself stays 2025 on stdio. | - |
| A3: codemod useful on CJS | **FALSIFIED** (OQ3). | - |
| A4: `legacy: 'stateless'` serves the plugin's 2025 client identically | **STRONGLY SUPPORTED.** The retired PWS Brain served this plugin's released `brain-client.cjs` through v2 `createMcpHandler({legacy:'stateless'})` in production (on `2.0.0-beta.4`). Still relevant as a **cross-repo** constraint on Theo, not as plugin work. | See OQ4 row. |
| A6: zod 3 -> 4 blast radius "High and unmeasured" | **MEASURED: LOW at runtime, MEDIUM on the wire contract.** See Summary and Pitfall 2. | Scratch preload boot plus `run-all-198` under both zods, plus `test-257` under both. |
| Pitfall 5: `requestState` = Canon Part 8 surface | **CORRECTED** (see C-3). Opaque-handles-only stays good hygiene for integrity and size reasons. | Canon Part 8 text: LOCAL -> BRAIN. |
| Claude Code 2.1.238 "emits server/discover to stdio" | **CORRECTED (read backwards).** 2.1.238 *stopped* doing that. 2.1.280 sends plain `initialize` at 2025-11-25 over stdio. | CHANGELOG raw plus live tee. |
| "36 tools" registration count | **UPDATED:** live `tools/list` returns **42 tools, 9 prompts, 61 resources, 3 resource templates, 0 annotations**. Registration forms: 39 `server.tool(`, 3 `server.prompt(`, 9 `server.resource(` (**51 variadic sites**), 6 `server.registerPrompt(`, 3 ext-apps `registerAppTool`, and 6 `registerTool` in the brain shim. `lib/mcp/tools/` grew from 8 to 14 files. | Live stdio `tools/list` plus grep. |
| Vendored `node_modules` ships with the plugin | **SUPERSEDED by Phase 341:** npm-source artifact with `npm-shrinkwrap.json`. | `.claude/includes/release-process.md`. |
| Runtime State Inventory, Security Domain, import-site table | **Carried forward and updated below.** Changed rows are marked. | - |

---

## Grounding Consults (the four the navigator named)

### 1. Theo (`/home/jsagi/Theo`, standing consult; read-only, Theo's own repo/code only, per C-13)

- **Theo's MCP SDK:** `@modelcontextprotocol/sdk` **1.30.0 exact pin**, `zod` **4.4.3 exact pin**, ESM TypeScript, `src/http/serve.ts:105-252` v1 `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` and a fresh transport per request. **Theo has NOT migrated to v2.**
- **Theo's own v1-vs-v2 decision exists and is deliberate:** `Theo/.planning/phases/08.4-remote-hosting-mcp-server/08.4-CONTEXT.md` **D-04**: "Use `@modelcontextprotocol/sdk@1.30.0`'s own `StreamableHTTPServerTransport` ... **No new HTTP framework dependency** -- do not add `express` or `@modelcontextprotocol/server`." The reason is dependency minimalism, not a technical blocker.
- **The zod precedent is weaker than ROADMAP line 615 implies.** Theo was **born** on zod 4.4.3 at scaffold (`b97738f`, 2026-08-23). It never performed a zod 3 -> 4 migration, so there is no Theo migration learning to reuse for the zod bump. The measurement in this document replaces it.
- **The wire contract binds both repos (Theo `REQUIREMENTS.md` HOST-01):** Theo accepts "a bare `tools/call` with no prior `initialize` and no `mcp-session-id`" because the released `lib/core/brain-client.cjs` sends exactly that. The client hand-rolls `initialize` at `protocolVersion: '2024-11-05'` (`brain-client.cjs:486-503`), then bare `tools/call` with hardcoded `id: 2`, no `MCP-Protocol-Version` header, and no `_meta` envelope (`:706-720`). **Consequence for the plugin:** `brain-client.cjs` is a hand-rolled 2025-era client outside the SDK migration surface, so this phase must NOT touch it. **Cross-repo note for Theo:** if Theo ever moves to v2 `createMcpHandler`, it must keep `legacy: 'stateless'` (never `'reject'`), or every installed plugin's Brain goes dark.
- **MOS-LEARNING files:** 10 exist in `Theo/.planning/phases/*/`. The relevant one is `08.4-MOS-LEARNING.md` (Theo is keyless, SSE-framed, bare `tools/call`, `/register` is a compatibility shim). **None covers SDK v2 or 2026-07-28** (grep of Theo `.planning/` for `2026-07-28|SEP-2575|createMcpHandler` returns only the D-04/D-05 references above).
- **Theo-side analog, stated per CLAUDE.md:** yes, a parallel decision is pending in Theo (stay on v1 per D-04, or move later). It is Theo's call in Theo's repo. Nothing here blocks on it, and nothing here should wait for it.

### 2. langtalks-graph-expert (queried live over its stdio MCP server, `graph_stats`: 9,477 nodes / 21,725 edges / 47 sources)

Queries run, with the actual answers:
- `query_relationship("How does MCP protocol versioning or a stateless MCP transport relate to session state and backward compatibility between MCP clients and servers?")` returned 523 loosely matched nodes (`stateless` from a Redis/agent-memory episode, `Versioning`/`Compatibility` from a Databricks episode, `Session`/`protocol` from an ICM note). **None is about MCP transports.**
- `get_entity("MCP")` was **found**: episodes 44 (MCP intro, 2025-03-31), 50 (A2A), 55 (Context Engineering), 57 (Memory), 70 (Claude Code tips).
- `get_entity` returned **`found: false`** for `protocol versioning`, `elicitation`, `Streamable HTTP`, and `backward compatibility`.
- `relationship_path(MCP, session)` and `(MCP, stateless)` were found only as **2-hop episode co-mentions** (`mentioned_in_episode`). There is no semantic edge. `multihop_query(MCP, migration)` returned 0 shared episodes.
- **Verdict: "Not in the corpus yet"** for MCP protocol versioning, era negotiation, stateless-vs-sessionful transports, and elicitation. This matches Theo's own 08.4 langtalks consult (F2: "The corpus's transport picture is a generation behind ... Streamable HTTP ... does not appear in the corpus"; F3: "the corpus is empty"). Per CLAUDE.md this is a valid answer. The authoritative sources for this phase are the SDK, the spec, and the host CHANGELOG.

### 3. icm-architect (skill read in full; applied to the room-binding question the navigator raised)

**The question:** how does room binding survive a protocol era with no `Mcp-Session-Id`, and is there an ICM-native way to carry room identity?

**What the code says first (verified):** on stdio, which covers CLI and Desktop, `extra.sessionId` is **already `undefined` today**. `lib/core/session-binding.cjs:139-140` resolves identity as `explicit > extra.sessionId > process.env.CLAUDE_CODE_SESSION_ID > null`. That is a host-supplied, process-scoped identity, not a transport-minted one. The live dual-era probe confirmed `ctx.sessionId` is `undefined` on stdio in **both** eras under v2. **So the 2026 era costs the stdio surfaces nothing on room binding.** The only transport-minted identity is the flag-ON daemon (`MINDRIAN_MCP_FIRST`, **default OFF**, `lib/mcp/mcp-first-flag.cjs`). There, `randomUUID()` sessions plus the shim's pre-seeded `clientOpts.sessionId = MINDRIAN_SESSION_ID` (`bin/mindrian-mcp-shim.cjs:63-68`) carry the D-02 one-namespace binding.

**ICM-native reading (invariants 1, 8, 9):** the binding store is already ICM-native. It is a plain file per session at `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json`, so the filesystem is the state machine. What is not ICM-native is where the **key** comes from on the daemon path: an opaque token minted by the transport. The ICM answer is that identity should be a **named, explicit handle the caller carries per request** (the room slug, which is a folder, is the most natural ICM identity), resolved against that file. It should never be connection state. That lines up with the 2026 model (self-describing requests) and with the existing `room_bind` override args (`room`, `sessionId`). icm-architect's own guardrail also applies: *"Know where ICM loses: ... high-concurrency multi-user serving ... genuinely need framework code."* The flag-ON multi-client daemon is exactly that case.

**Recommendation from this consult:** (a) do **not** re-architect room binding in this phase. Keep the flag-ON daemon sessionful and 2025-era through the guide's supported `isLegacyRequest(request)` + `createMcpHandler(factory, { legacy: 'reject' })` routing, so the session-keyed binding keeps working unchanged. (b) Record, as a follow-up seed rather than work here, that a future 2026-native daemon should carry the binding key as an explicit per-request handle: a reverse-DNS custom `_meta` key such as `io.mindrian/sessionId`, or the existing explicit `room`/`sessionId` tool args, resolved against the same session file. Never transport state. This is `[ASSUMED]` design direction, not a verified SDK capability: I did not verify that custom `_meta` keys survive v2's envelope lift on requests. Verify that before seeding.

### 4. Jev / TypeSafe (`.claude/skills/spike-findings-MindrianOS-Plugin/`, SKILL.md plus all three references read in full)

**The seat test used** (Phase 354 discipline, from the skill): a finite input space, scored once, shipped as data, a typed choice/score with no text generation; never a live runtime call, and never near an egress or security boundary. Plus the parity reference's rule: *"Use code, not Jev, when the inputs are already booleans."*

| Candidate surface in this phase | Seat? | Reasoning |
|---|---|---|
| **zod 3 -> 4 blast-radius audit** (the one the navigator asked about specifically) | **NO** | The input space is finite (43 zod-importing files, 388 `z.<factory>(` calls), so the first test passes. It fails the parity rule. The official changelog defines the breaking set as **syntactic patterns** (`.errors`, `invalid_type_error`, `errorMap`, single-arg `z.record`, `._def`, `z.coerce`, and so on). A deterministic scan classifies every site exactly, for free, and reproducibly (run this session). Beyond that, the question that matters ("does it still work?") is answered by **execution**, not judgment: booting the real server under zod 4 and diffing `tools/list`, which found things no classifier would predict (38 dropped `additionalProperties:false`, and 4.6.5 still accepting single-arg `z.record` despite the changelog saying "removed"). A probabilistic scorer adds error to a question code answers exactly. It is also a one-time audit whose output is not shipped as runtime data. |
| Codemod dry-run (OQ3) | **NO** | A one-time tooling spike, as the navigator already noted. Resolved by execution this session. |
| `readOnlyHint` / `destructiveHint` annotations for the 42 tools (a free win if registrations are rewritten anyway) | **No NEW seat; REUSE existing Jev data** | This is the closest structural fit: 42 finite inputs, labels shipped as static data, typed booleans. But `destructiveHint`/`readOnlyHint` feed host permission and auto-approval behavior, which is near a security boundary, and that fails the seat test for a fresh Jev call. Canon Part 7 points to a better answer: **Phase 356 already shipped a dev-time Jev Noul per command** (`data/command-irreversibility-ledger.json`, 113 entries, `p_irreversible` + `flag`, navigator-verified 2026-09-23). The 11 router tools in `tool-router.cjs` dispatch to `command` enums, so their `destructiveHint` can be **derived** as the OR of the ledger's `flag` over each tool's enum. The 31 direct tools get human-reviewed labels from reading the handler code (does it write `room.db` or the filesystem?). `readOnlyHint: true` should be asserted only from a code reading, never inferred. Jev's cost was already paid, and nothing new crosses to TypeSafe. |
| Anything at runtime (era detection, capability routing, gate rung choice) | **NO** | These are deterministic protocol facts. A vendor call in the connect path would also be a second vendor in every turn loop, which the skill forbids. |

**Plain verdict:** Jev has **no new seat** in Phase 267. The only Jev-adjacent move is optional reuse of Phase 356's already-shipped ledger data for tool annotations, gated on a navigator decision to add annotations at all. This matches Phase 354's precedent of excluding Jev where code or execution answers the question exactly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Protocol era negotiation | MCP host | SDK serving entry (`serveStdio` / `createMcpHandler`) | The client picks. **Verified:** Claude Code picks 2025 on stdio and 2026 on direct HTTP. |
| Session / room identity | Host env (`CLAUDE_CODE_SESSION_ID`) on stdio; transport session on the flag-ON daemon | `lib/core/session-binding.cjs` file store | See icm-architect consult. |
| Gate state across a HITL round trip | `lib/mcp/gate-ledger.cjs` (process memory) | - | Unchanged by the migration. The ledger lives as long as the process does. |
| Elicitation | Host (declares `elicitation`) | `gate-render.cjs` rung (a) via `server.server.elicitInput` | **Live on CLI now.** It survives v2 on 2025-era connections. |
| Tool/resource/prompt registration | `@modelcontextprotocol/server` `McpServer.register*` | `lib/mcp/*.cjs` registrars | The variadic forms are gone in v2 (`server.tool` is `undefined`, verified). |
| Schema -> JSON Schema | zod 4 `toJSONSchema` (draft 2020-12 under v2) | - | Under v1 plus zod 4 it is still draft-07, converted by the SDK. |
| MCP Apps UI resources | `@modelcontextprotocol/ext-apps@2.0.0` `./server` (duck-typed) | `lib/mcp/app-views.cjs` | **Unblocked.** |
| Brain access | Theo (remote, separate repo) | `lib/core/brain-client.cjs` (hand-rolled 2025 client) + `bin/mindrian-brain-mcp-client.cjs` (stdio shim, SDK) | Only the stdio shim is in scope. `brain-client.cjs` is not an SDK consumer. |
| `mcp-server-brain/` | **None (dead service)** | - | Out of scope. Separate cleanup candidate. |

---

## Standard Stack

### Core (migration target)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/server` | **2.1.0** (2026-09-23) | `McpServer`, `createMcpHandler`, `isLegacyRequest`, `inputRequired`, `acceptedContent`, `createRequestStateCodec`, `DEFAULT_MAX_REQUEST_BODY_SIZE`, `InMemoryTransport`, `ResourceTemplate`. `./stdio` exports `StdioServerTransport`, `serveStdio`. | The only TS SDK that implements 2026-07-28. `[VERIFIED: npm registry + official GitHub release + live require() smoke test]` |
| `@modelcontextprotocol/core` | **2.1.0** | Shared schemas. **Exact-pinned** by `server@2.1.0`. | `[VERIFIED: npm view dependencies]` |
| `@modelcontextprotocol/client` | **2.1.0** | `Client`; `StreamableHTTPClientTransport`; `./stdio` exports `StdioClientTransport`. **Required peer of ext-apps 2.0.0.** | `[VERIFIED]` |
| `@modelcontextprotocol/ext-apps` | **2.0.0** (2026-09-08) | `registerAppTool`, `registerAppResource`, `RESOURCE_MIME_TYPE`. The `./server` entry has zero runtime imports. | `[VERIFIED: tarball read + release body + live smoke]` |
| `zod` | **^4.2.0** (latest 4.6.5) | Schema validation. v2 floor is `^4.2.0`. | `[VERIFIED + measured]` |

### Supporting

| Library | Version | When to Use |
|---------|---------|-------------|
| `@modelcontextprotocol/node` | 2.1.0 | `toNodeHandler(handler)` to mount `createMcpHandler` on the existing Express app. Depends on `@hono/node-server`; peer `hono ^4.11.4` gives an unmet-peer warning unless added. Precedent: the retired PWS Brain. |
| `@modelcontextprotocol/sdk` | **1.30.1** (Wave 0 only) | Interim bump **on v1** before the v2 cutover. It adds a 4 MiB request-body limit and a 100-message batch bound (a security patch). v1.x is still receiving backports, and the guide states no v1 EOL date. |
| ~~`@modelcontextprotocol/codemod`~~ | - | **Do not use** (measured: zero CJS rewrites, harmful manifest edit). Its transform list is useful only as a checklist: `imports, symbols, removed-apis, mcpserver-api, handlers, schema-params, context, completable-nesting, mock-paths`. |
| ~~`@modelcontextprotocol/server-legacy`~~ | - | Not needed. No SSE transport, no MCP OAuth. |
| ~~`@modelcontextprotocol/express`~~ | - | Not needed. `toNodeHandler` from `/node` works on Express 5, as the precedent shows. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| v2 migration | Stay on v1 at 1.30.1 and only fix the HTTP bug by building a transport per request on v1 | Honest option. It fixes the live bug with minimal change, but adopts nothing from 2026-07-28, which is the phase goal and the navigator's "build now". It is a valid **Wave 0**, not a substitute for the phase. |
| Unified, internally staged | Staged by server with v1 kept for months | There is no longer a reason to hold any server back. v1 and v2 coexist in one manifest under different names, so staging is cheap. |
| Hand migration | Codemod | Codemod measured useless on CJS. |
| `createMcpHandler` for the flag-ON daemon | Keep the v1-style sessionful transport map, re-expressed on v2 transports behind `isLegacyRequest` | Recommended. `createMcpHandler` alone is per-request stateless and would break session-keyed room binding. |
| MRTR rework of gate rung (a) now | Keep inline `elicitInput` (2025 era) | Recommended. No Claude host negotiates 2026 on stdio, and `elicitInput` works on 2025 connections under v2. MRTR can land later without a rewrite, because the legacy shim runs one `inputRequired` handler on both eras. |

**Installation (Wave 0, on v1, measured safe):**
```bash
npm install zod@^4.2.0 @modelcontextprotocol/sdk@1.30.1
# then regenerate npm-shrinkwrap.json per RULE 8 / release.sh Step 6.7-successor
```
**Installation (v2 waves, v1 kept until the last wave):**
```bash
npm install @modelcontextprotocol/server@2.1.0 @modelcontextprotocol/core@2.1.0 \
            @modelcontextprotocol/client@2.1.0 @modelcontextprotocol/node@2.1.0 \
            @modelcontextprotocol/ext-apps@2.0.0
# final wave only:
npm uninstall @modelcontextprotocol/sdk
```

---

## Package Legitimacy Audit

`slopcheck scan` (non-installing) ran from a **scratch directory** against a probe `package.json`. The repo was not touched.

| Package | Registry | Age | Downloads/wk | Source Repo | Install scripts | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------------|-----------|-------------|
| `@modelcontextprotocol/server@2.1.0` | npm | v2 line since 2026-04-01 alpha; 2.1.0 today | 4,319,675 | github.com/modelcontextprotocol/typescript-sdk | none | `[OK]` | Approved |
| `@modelcontextprotocol/core@2.1.0` | npm | same | 5,482,161 | same | none | `[OK]` | Approved |
| `@modelcontextprotocol/client@2.1.0` | npm | same | 3,631,483 | same | none | `[OK]` | Approved |
| `@modelcontextprotocol/node@2.1.0` | npm | same | 1,402,024 | same | none | `[OK]` | Approved |
| `@modelcontextprotocol/ext-apps@2.0.0` | npm | line since 2025; 2.0.0 on 2026-09-08 | 3,033,000 | github.com/modelcontextprotocol/ext-apps | none | `[OK]` | Approved |
| `zod@4.6.5` | npm | years | 211,933,203 | github.com/colinhacks/zod | none | `[OK]` | Approved |
| `@modelcontextprotocol/codemod@2.1.0` | npm | same monorepo | 2,275 | same | none | `[OK]` | Not recommended (no value on CJS) |

**Removed ([SLOP]):** none. **Flagged ([SUS]):** none.
**Provenance:** the package names come from the official SDK repo's own release tags (`gh release list`), the ext-apps release body, and the npm registry. None came from web search or training data. That is why they are tagged VERIFIED.
**Supply-chain gate (C-11):** add VETTED entries for `server`, `core`, `client`, and `node` (if used) in `references/security/cve-db.json`, dated, in the `ajv` entry's format. Transitive surface **shrinks**: v2 `server` depends only on `zod` + `core`, versus v1's 17 direct dependencies.

---

## Architecture Patterns

### System Architecture Diagram (current reality, verified)

```
  HOSTS                     CLI (Claude Code 2.1.280)     Desktop (unprobed)      Cowork VM
                              stdio, 2025-11-25              stdio, era ?           surface-detect -> HTTP
                              declares elicitation:{}        (A2)                   (CLAUDE_SURFACE=cowork |
                              NO server/discover on stdio                            COWORK_SESSION_ID | /sessions)
                                   |                             |                        |
                                   v                             v                        v
  ENTRY        bin/mindrian-mcp-server.cjs  detectSurface() -> transport
               |-- stdio branch: server.connect(StdioServerTransport)   --> v2: serveStdio(createServer)
               |                                                             (one factory call per connection;
               |                                                              serves 2025 AND 2026)
               '-- http branch (Express, 127.0.0.1)
                    |-- flag-OFF (default): ONE shared stateless transport
                    |      ** BROKEN TODAY: serves 1 request per process, then 500 **
                    |      --> v2: app.all('/mcp', toNodeHandler(createMcpHandler(factory)))
                    |          fresh server per request = bug fixed by construction; both eras
                    '-- flag-ON (MINDRIAN_MCP_FIRST, default OFF): session-keyed transport map
                           randomUUID sessions -> room binding (D-02)
                           --> v2: isLegacyRequest(req) ? existing sessionful legacy path
                                                        : createMcpHandler(factory,{legacy:'reject'})

               bin/mindrian-mcp-shim.cjs (stdio <-> daemon HTTP bridge, verbatim)  --> v2 Client, default legacy mode
               lib/mcp/adapter-client.cjs (hook -> daemon queries)                 --> v2 Client, default legacy mode
               bin/mindrian-brain-mcp-client.cjs (stdio, 6 registerTool)           --> v2 serveStdio  [CANARY, wave 1]
                    '-- lib/core/brain-client.cjs  hand-rolled 2025 JSON-RPC over fetch --> Theo (keyless, v1 1.30.0)
                         NOT an SDK consumer: DO NOT MIGRATE in this phase

  REGISTRATION (inside createServer() -- already a factory, bin/mindrian-mcp-server.cjs:158)
    tool-router.cjs (11 server.tool) | tools/*.cjs (27 server.tool) | contract-version.cjs (1)
    prompts.cjs (3 server.prompt + 6 registerPrompt) | resources.cjs (9 server.resource)
    app-views.cjs (3 registerAppTool, ** `schema:` key bug: all 3 publish empty input schemas **)
    startTreeWatcher(s) <-- SIDE EFFECT INSIDE THE FACTORY: must move out before createMcpHandler

  GATE PATH (unchanged by the migration)
    gate_render -> detectClientCapabilities(server.server.getClientCapabilities())
       elicitation declared (CLI today) -> rung (a) inline elicitInput  [works on 2025-era under v2]
       2026-pinned connection -> getClientCapabilities() === undefined -> rung (b)/(c)
    gate_answer -> gate-ledger.cjs in-process Map (TTL 30 min, single-use)
```

### Pattern 1: stdio, one factory, both eras (`serveStdio`)
**What:** replace `server.connect(new StdioServerTransport())` with `serveStdio(() => server)` (the stdio process serves one connection, so the module-level singleton is fine) or `serveStdio(createServer)`.
**Verified live:** a v2 client in `auto` mode negotiated `2026-07-28`, `instructions` was delivered, `getClientCapabilities()`/`getClientVersion()` returned `undefined`, the envelope carried `protocolVersion`, `clientInfo`, and `clientCapabilities`, and the factory was called once per connection. A default-mode v2 client and the repo's v1 client both negotiated `2025-11-25` with `instructions` delivered.
**Note:** on the SDK's own `StdioClientTransport` in `auto` mode, the probe runs on a **disposable sibling process**, so the server boots twice. That only matters for in-repo tests that spawn the server with a v2 client in `auto` mode, because this server has boot side effects (dep-heal, tree watcher, session catch-up). Claude Code does not do this (verified).

### Pattern 2: HTTP flag-OFF, per-request factory (`createMcpHandler`)
```javascript
// Source: typescript-sdk docs/migration/support-2026-07-28.md "Server over HTTP";
// in-house precedent ~/dev/ProblemsWorthSolving-Brain/src/http/app.mjs:323-330. CJS transposition.
const { createMcpHandler } = require('@modelcontextprotocol/server');
const { toNodeHandler } = require('@modelcontextprotocol/node');
const handler = createMcpHandler(() => createServerForRequest(), { legacy: 'stateless' });
app.all('/mcp', toNodeHandler(handler, { onerror: (e) => process.stderr.write('[mcp] ' + e.message + '\n') }));
```
**Preconditions:** (1) move `startTreeWatcher(s, {})` out of `createServer()`, or it starts one watcher **per request**. Under 2026 era, `list_changed` goes through `handler.notify.resourcesChanged()` over the handler's bus. (2) Measure `createServer()` cost per request (42 tools + 61 resources + 9 prompts rebuilt every POST). Not measured this session. (3) Keep `express.json()` off `/mcp` or pass the parsed body. The precedent passes `req.body` as the positional third argument to avoid the double-body-read trap. 2.1.0 enforces a 4 MiB default body limit unless a pre-parsed body is passed.

### Pattern 3: HTTP flag-ON, keep sessions for room binding
```javascript
// Source: support-2026-07-28.md, sessionful-legacy routing example.
const modern = createMcpHandler(factory, { legacy: 'reject' });
app.all('/mcp', async (req, res) => {
  // isLegacyRequest works on a web Request; toNodeHandler / toWebRequest adapts. Plan-time spike:
  // confirm the cleanest Node-side seam (the guide's example is fetch-shaped).
  if (await isLegacyRequest(webReq)) return existingSessionfulLegacyPath(req, res);
  return toNodeHandler(modern)(req, res, req.body);
});
```
**Why:** it keeps D-02 one-namespace session binding intact without re-architecting, per the icm-architect consult. The flag defaults OFF, so this is low-traffic code, but test `tests/test-198-concurrency-mcp.test.cjs` pins it.

### Pattern 4: registration rewrite (51 sites, by hand)
```javascript
// v1 (today) - REMOVED in v2: server.tool is undefined (verified)
server.tool('room_bind', 'desc...', { room: z.string().optional() }, async (args, extra) => {...});
// v2 - raw shapes still accepted by registerTool (verified), so the minimal rewrite is mechanical:
server.registerTool('room_bind', { description: 'desc...', inputSchema: { room: z.string().optional() } },
  async (args, ctx) => {...});   // extra -> ctx; ctx.sessionId still present on legacy HTTP sessions
```
The `title` and `annotations` config slots become available. See the Jev consult for the annotation-source rule.

### Pattern 5: clients stay 2025 by default
`lib/mcp/adapter-client.cjs` and `bin/mindrian-mcp-shim.cjs` move to `@modelcontextprotocol/client`. **Do not** set `versionNegotiation: 'auto'`. The default is byte-identical 2025 `initialize`, which is what the flag-ON daemon's sessionful legacy path expects.

### Recommended wave structure (for the planner)
```
Wave 0 (on v1, independently shippable):
  - tests/test-267-sdk-era-assert.cjs, doctor L4 tools/list count assertion (Pitfall 1/2 guards)
  - zod ^4.2.0 + sdk 1.30.1; update tests/test-198-contract-schema.test.cjs introspection
    (_def.typeName -> _zod.def.type or toJSONSchema-driven samples); decide the
    additionalProperties:false question (Pitfall 2b)
  - app-views.cjs schema: -> inputSchema: (3 tools)          [RCA 2]
  - flag-OFF HTTP one-request bug RCA                        [RCA 1]; gate.cjs stale premise RCA [RCA 3]
Wave 1 (canary): bin/mindrian-brain-mcp-client.cjs -> v2 serveStdio (6 registerTool, Part 8 guard intact)
Wave 2: local server stdio -> serveStdio; 51 registration rewrites; ext-apps 2.0.0; 25 server.server.* reads audited;
        9 extra.sessionId sites -> ctx; requireWithHeal paths + mcp-dep-heal FALLBACK
Wave 3: HTTP flag-OFF -> createMcpHandler (tree watcher out of factory); flag-ON -> isLegacyRequest routing;
        shim + adapter-client -> v2 Client (legacy mode)
Wave 4: remove @modelcontextprotocol/sdk; allowlist; shrinkwrap; payload ceiling; Tri-Polar wire probes; doctor --acceptance
```

### Anti-Patterns to Avoid
- **Running the codemod on this repo.** Measured: zero rewrites, and it deletes the v1 dependency without adding v2.
- **Bumping to 1.30.1 and calling 2026-07-28 adopted.** Its `types.js` is byte-identical to 1.29.0.
- **`createMcpHandler` on the flag-ON daemon path.** It silently kills session-keyed room binding.
- **Calling `createServer()` per request with `startTreeWatcher` still inside.** That leaks a watcher per request.
- **Touching `lib/core/brain-client.cjs`.** It is not an SDK consumer, and Theo's wire contract pins its exact shape.
- **Migrating `mcp-server-brain/`.** It is dead code.
- **Setting `versionNegotiation: 'auto'` on in-repo clients.** It adds a probe round trip, and on stdio it spawns a sibling server process.
- **Trusting the `lib/mcp/tools/gate.cjs:145-152` comment** that says no Claude host declares elicitation. It is false as of 2.1.280.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Serving two protocol eras | Header-sniffing dispatch | `serveStdio(factory)` / `createMcpHandler(factory)`; `isLegacyRequest` + `legacy:'reject'` for the sessionful path | Verified live on stdio; guide-documented for HTTP. |
| Request-body limits on the HTTP branch | Custom Express limit tuned by guesswork | SDK 2.1.0 / 1.30.1 built-in 4 MiB limit (`maxRequestBodySize`) plus the 100-message batch bound | Security patch in both lines. |
| `requestState` sealing (if MRTR ever lands) | HMAC wrapper | `createRequestStateCodec` | Unchanged from the prior pass. |
| Elicitation answer parsing on 2026 | Manual `inputResponses` probing | `acceptedContent(responses, key, schema)` | Unchanged from the prior pass. |
| v1->v2 source rewrite | **The official codemod** (a reversal of the prior pass) | A deterministic grep checklist over `server.tool(`, `server.prompt(`, `server.resource(`, `extra.`, `server.server.`, `requireWithHeal('@modelcontextprotocol/sdk`, `require('@modelcontextprotocol/sdk` | The codemod ignores `require()`. |
| zod breaking-change audit | A Jev classifier, or manual reading | The deterministic scan plus **the real-server boot under zod 4 with a `tools/list` diff** (both run this session; reproduce in Wave 0) | Execution is exact. |
| Tool `destructiveHint` labels | New Jev scoring | Derive from `data/command-irreversibility-ledger.json` (Phase 356) for router tools; code-read for the rest | Reuse before build; no new egress. |
| Counting tools for docs | Frozen literals | Runtime enumeration (`tools/list`) | Count moved 36 -> 42 in 27 days. |

**Key insight:** the SDK work is mechanical. The genuine engineering is (1) the HTTP branch, which is broken today and gets fixed by the per-request factory, (2) keeping session-keyed room binding on the flag-ON daemon, and (3) deciding what the wire contract should advertise now that zod 4 renders `additionalProperties` differently.

---

## Runtime State Inventory

The canonical question: after the SDK is swapped and servers restart, what state was implicitly relying on session or connection continuity?

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **In-process state** (re-confirmed 2026-09-23) | `gate-ledger.cjs` `_ledger` Map; `gate-render.cjs` `_firedBindingSessions`; `session-registry.cjs` `openSessions`/`connectionMap`; `stop-gate-handler.cjs` `_sessionDedupState`; `sse-event-bus.cjs` `subscribers`; `tool-router.cjs` Eureka caches; `brain-router.cjs` `cache`. **New:** `tree-watcher.cjs` watcher handle, started **inside** `createServer()`. | Module-level singletons survive per-request factories within one process, so no migration is needed. **Except the tree watcher:** hoist it out of the factory before `createMcpHandler` (Pattern 2). |
| **Session-keyed persistent data** (updated) | `lib/core/session-binding.cjs` file store keyed by `explicit > extra.sessionId > CLAUDE_CODE_SESSION_ID`. On stdio, `extra.sessionId` is already undefined (verified in both eras). Transport-minted ids exist only on the flag-ON daemon (default OFF), fed by the shim's `clientOpts.sessionId = MINDRIAN_SESSION_ID`. | **Stdio: no action.** Flag-ON: keep sessionful legacy (Pattern 3). The 9 `extra.sessionId` sites become `ctx.sessionId`, which v2 still populates on legacy sessions and leaves `undefined` on stdio and 2026. |
| **Live service config** | Theo on Render (not this repo). `mcp-server-brain/render.yaml` belongs to a **dead** service. Marketplace `source.version` pin. | None from the swap. Do not redeploy `mcp-server-brain`. |
| **Secrets / env vars** | `MINDRIAN_BRAIN_KEY`, `MINDRIAN_TRANSPORT`, `MINDRIAN_MCP_FIRST`, `MINDRIAN_MCP_DAEMON`, `MINDRIAN_SESSION_ID`, `CLAUDE_CODE_SESSION_ID`, `MINDRIAN_ROOM`, `MINDRIAN_ROOMS_HOME`. | None change. No `requestState` key is needed, because MRTR is out of scope. |
| **OS-registered state** | Daemon pidfile (flag-ON). `.mcp.json` registrations (`mindrian-os`, `mindrian-brain`, both `alwaysLoad: true`, stdio). **New observation:** the server's SIGTERM handler does **not** exit in HTTP mode. A test server survived `timeout 40` (SIGTERM) and needed SIGKILL. v2 2.1.0's "`StdioServerTransport` closes on stdin EOF" fix addresses the stdio side. | `.mcp.json` is unchanged. Add a Wave 4 check that the HTTP-mode process exits on SIGTERM (a lifecycle regression guard, related to the release note's Windows zombie story). |
| **Build artifacts / installed packages** (updated) | `package.json` (sdk `^1.29.0`, ext-apps `^1.5.0`, zod `^3.25.76`); **`npm-shrinkwrap.json` (tracked, Phase 341)** plus `package-lock.json` (both pin ext-apps 1.5.0, sdk 1.29.0, zod 3.25.76); `mcp-server-brain/node_modules` sdk 1.27.1 (dead, ignore); `lib/core/mcp-dep-heal.cjs:364` FALLBACK `['@modelcontextprotocol/sdk','zod']`; `lib/core/mcp-dep-heal.test.cjs:39,85-86,99,116`; `requireWithHeal('@modelcontextprotocol/sdk/...')` at `bin/mindrian-mcp-server.cjs:86-87` and `bin/mindrian-brain-mcp-client.cjs:58-59`. | Update all of them. `mcp-dep-heal` probes by **directory existence** (`fs.existsSync(path.join(nm, ...dep.split('/')))`, `:420`), so v2 packages not exporting `./package.json` (verified) does not break it. Regenerate shrinkwrap per RULE 8. |

**Explicitly checked, nothing found:** no datastore keys reference the SDK; no Docker tags or compiled binaries; nothing in the repo resolves `@modelcontextprotocol/*/package.json` (grep: 0 hits).

---

## Common Pitfalls

### Pitfall 1: Bumping the SDK version and believing the protocol changed (re-confirmed)
Holds for 1.30.1 too. Guard: `tests/test-267-sdk-era-assert.cjs` (Wave 0) asserting the installed server's modern vocabulary. **Trap:** `input_required` appears in v1 as the Tasks status enum, so it is a false positive.

### Pitfall 2: zod 4 changes the ADVERTISED contract, not the runtime (measured)
**What goes wrong:** after the bump, 35 of 42 tools stop advertising `additionalProperties: false` (38 sites). Hosts and models may then send extra keys. Runtime behavior is the same as today (strip), but `tests/test-257-strict-input-shapes.cjs` Arm F asserts `additionalProperties:false` on the brain-shim tools, and any test that snapshots schemas will move.
**Also:** 3 `z.record` sites gain `propertyNames:{type:string}`, and 1 `.int()` gains safe-integer bounds. Under v2 the `$schema` becomes draft 2020-12, versus draft-07 under v1. Descriptions are preserved everywhere (0 description diffs). The zod 4.0-4.1 `.describe()`-dropping trap does not apply at `^4.2.0`.
**Pitfall 2b, decision needed:** either accept the looser advertisement, or convert tools whose undeclared-key rejection matters to `z.strictObject` (the Phase 257 mechanism, which still works under zod 4, verified: Arms Z2, Z3, Z4, and A pass).
**Test infra:** `tests/test-198-contract-schema.test.cjs:205-213` walks `_def.typeName`, which is `undefined` in zod 4 (`_def.type` holds `'object'`). It already fails on zod 3 today (at `context_assemble`) and fails earlier under zod 4 (at `chain_resolve`). Rewrite it against `_zod.def.type` or `z.toJSONSchema`.
**Live-verified oddity:** zod 4.6.5 still **accepts** single-argument `z.record(z.unknown())`, even though the changelog lists it as removed. Do not spend effort on those 4 live sites. Do not rely on it forever either.

### Pitfall 3 (REPLACED): ext-apps is not a blocker, but `app-views.cjs` has its own bug
**What goes wrong:** `lib/mcp/app-views.cjs:242,267,296` pass `schema:` instead of `inputSchema:`. `registerTool` destructures `inputSchema` (`sdk/dist/cjs/server/mcp.js:706`), so the key is ignored. All three MCP Apps tools publish `{"type":"object","properties":{}}` (verified live on v1 **and** v2), and their handlers receive the request context as `args`. That means `room_path`, `section`, and `layout` are unreachable, and every call falls back to `roomDir`.
**Fix:** rename to `inputSchema:`. Verified under v2: the schema publishes and args arrive correctly. Ship it in Wave 0 on v1. It is independent of the migration.

### Pitfall 4: A registration rewrite drops a CIRS connector (carried from 2026-08-27)
It now spans 51 sites across 16 files. Run `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --strict` per commit.

### Pitfall 5 (CORRECTED): `requestState` is a tamper surface, not a Part 8 surface
It only matters if MRTR is adopted, which it is not in this phase. Keep opaque handles only.

### Pitfall 6: `_meta` retry-field collision (carried)
Zero exposure: grep shows no tool schema uses `inputResponses` or `requestState` as a param name.

### Pitfall 7 (UPGRADED): the codemod is harmful here, not merely incomplete
It removes `@modelcontextprotocol/sdk` from `package.json` without adding v2 packages, because it detects no ESM imports. Never run it at the repo root.

### Pitfall 8: Injected surfaces and `requireWithHeal` are invisible to any import-driven tool (extended)
Beyond the 14 `lib/mcp/tools/*.cjs` modules that receive `server` as a parameter, the two bins load the SDK through `requireWithHeal('<path>')`, not `require()`. Any grep-based checklist must include `requireWithHeal(`. `tests/test-266-connect-path-process-budget.cjs` counts at least 4 connect-path heal calls in `bin/mindrian-mcp-server.cjs`, so keep that census true when paths change.

### Pitfall 9 (NEW): the flag-OFF HTTP branch can't serve a second request
Covered in the Summary. **Warning sign:** a Cowork session that connects and then fails on its first `tools/list`. **Testing trap:** a stale test server (the SIGTERM handler doesn't exit) keeps port 3847 bound, and later test servers fail to bind silently. That produced false readings during this research. Test harnesses must kill by PID with SIGKILL and assert the port is free before each case.

### Pitfall 10 (NEW): a per-request factory with side effects
`createServer()` starts the tree watcher and rebuilds 42 tools + 61 resources + 9 prompts. Under `createMcpHandler` that runs **every POST**. Hoist side effects out, and measure build latency before committing to per-request construction on a hot path (the statusline queries the daemon on every render, per the 198-08 comments).

### Pitfall 11 (NEW): the host already changed the gate path
Rung (a) elicitation is live on CLI (host declares `elicitation:{}`). UX consequence: gate cards render as the host's elicitation dialog, not the AskUserQuestion card. This came from the host, not from this repo, and it needs a navigator/design look (C-12 RCA 3). Migration must keep `server.server.elicitInput` working on 2025-era connections (it does under v2, verified).

---

## Code Examples

### Falsification test for any candidate SDK (re-run 2026-09-23 on 1.30.1)
```bash
SDK=node_modules/@modelcontextprotocol/sdk/dist/cjs
grep -n "LATEST_PROTOCOL_VERSION =" $SDK/types.js          # '2025-11-25' on 1.29.0 / 1.30.0 / 1.30.1
for t in server/discover inputResponses inputRequests requestState Mcp-Method Mcp-Name ttlMs cacheScope resultType 2026-07-28; do
  printf "%-16s %s\n" "$t" "$(grep -rl "$t" $SDK | wc -l)"; done   # all 0 on v1
```

### Measuring the zod 4 blast radius without touching the repo (reproducible)
```javascript
// preload: redirect every require('zod'|'zod/...') to a scratch zod@4 install
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...r) {
  if (req === 'zod' || req.startsWith('zod/')) return orig.call(this, req, { ...parent, paths: [Z4_NODE_MODULES] }, ...r);
  return orig.call(this, req, parent, ...r);
};
// run: NODE_OPTIONS="-r ./zod4-preload.cjs" bash tests/run-all-198.sh   (NODE_OPTIONS so spawned children inherit)
// and: boot bin/mindrian-mcp-server.cjs under the preload, diff tools/list against a zod-3 run (key-order-insensitive)
```

### ext-apps 2.0.0 from CJS against v2 (verified live)
```javascript
const { McpServer } = require('@modelcontextprotocol/server');
const { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server');
registerAppTool(server, 'room-wiki', {
  title: 'Data Room Wiki', description: '...',
  inputSchema: z.object({ room_path: z.string().optional().describe('Path to room directory') }), // NOT `schema:`
  _meta: { ui: { resourceUri: 'ui://mindrian-os/room-wiki' } }
}, async (args) => ({ content: [{ type: 'text', text: '...' }] }));
// tools/list -> _meta {"ui":{"resourceUri":...},"ui/resourceUri":...}; args -> {"room_path":"/tmp/r"}
```

### Live host wire probe (the Wave 0 Tri-Polar harness seed)
A transparent stdio tee in front of any server logs `initialize` / `server/discover` params (method, protocol version, clientInfo, capabilities only, with no content), driven by `claude -p ... --mcp-config <tee.json> --strict-mcp-config`. It produced the 2.1.280 facts above. Extend `tests/test-248-surface-probes.cjs` with this for CLI. Desktop and Cowork need a manual run on those hosts.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact here |
|--------------|------------------|--------------|-------------|
| `@modelcontextprotocol/sdk` monolith | `@modelcontextprotocol/{core,server,client,node,...}` | 2.0.0 on 2026-07-27; **2.1.0 on 2026-09-23** | Import paths change; v1 and v2 coexist by name. |
| ext-apps on SDK v1 | ext-apps 2.0.0 on v2 split packages; MCP Apps wire unchanged | 2026-09-08 | Blocker gone. |
| Host probes stdio with `server/discover` | Host sends plain `initialize` to stdio; probes/negotiates 2026 only for direct HTTP | CC 2.1.238 (stdio fix); 2.1.274 HTTP default widened | 2026 is live on HTTP only. |
| No Claude host elicitation | CC declares `elicitation:{}`; URL-mode elicitation on 2026 connections (2.1.281) | by 2.1.280 / 2.1.281 | Rung (a) is live on CLI. |
| Unbounded HTTP bodies | 4 MiB default + 100-message batch cap | v1 1.30.1 and v2 2.1.0 (both today) | Free hardening on either line. |
| Unsolicited `list_changed` | `subscriptions/listen`; `serveStdio` routes existing `send*ListChanged()` automatically | spec 2026-07-28 | Tree watcher keeps working on stdio; on HTTP use `handler.notify`. |
| `initialize` carries `instructions` | `DiscoverResult.instructions` carries it too | spec 2026-07-28 | `RUNTIME_INSTRUCTIONS` survives in both eras (verified live). |

**Deprecated (verified from the spec this session):** `roots` and `sampling` client capabilities (SEP-2577, 12+ months). This repo uses neither.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A2 | Claude Desktop's stdio client negotiates like Claude Code's (2025 on stdio) | Tri-Polar | Medium. If Desktop negotiates 2026 on stdio, `getClientCapabilities()` returns `undefined` there, and the gate ladder falls to rung (b)/(c) on Desktop after migration. Needs a manual Desktop tee probe. |
| A7 | Real Cowork launches the local server so that `surface-detect` picks HTTP (and so hits the one-request bug) | Pitfall 9 | Medium-high for prioritization. If Cowork actually talks stdio, the HTTP bug is latent, not live. Either way it is a bug. Needs a Cowork-side probe. |
| A8 | Claude Code interactive mode sends the same `initialize` capabilities as print mode (`elicitation:{}`) | OQ6 | Low-medium. Same client binary. The probe used `-p`. |
| A9 | Custom reverse-DNS `_meta` keys (for example `io.mindrian/sessionId`) survive v2's envelope lift on requests | icm-architect consult | Low for this phase (seed only). Verify before any 2026-native daemon design. |
| A10 | `createServer()` per-request cost is acceptable on the HTTP flag-OFF path | Pattern 2 | Medium. Not measured. Wave 3 spike. |
| A11 | v2 legacy-stateless leg accepts header-less 2025 POSTs the way v1 does (relevant only to Theo's future choice) | Theo consult | Low for this repo (cross-repo note only). Production precedent on 2.0.0-beta.4. |

---

## Open Questions

1. **Navigator: approve the reshaped scope?** The recommendation is a local-server-only, unified, internally-staged migration with a v1 Wave 0, and it drops the Brain-first split. What we know: the blocker is gone, and the Brain half is dead or belongs to Theo. Recommendation: approve in one word, then plan.
2. **Is the flag-OFF HTTP branch reachable by real Cowork today (A7)?** Recommendation: file RCA 1 now regardless (the bug is real), and run a Cowork-side probe as a Wave 0 manual checkpoint to set its severity.
3. **Advertised strictness after zod 4 (Pitfall 2b):** accept that `additionalProperties:false` disappears on 35 tools, or move sensitive tools to `z.strictObject`? Recommendation: the navigator picks the principle; the default is to preserve today's advertised contract for tools that accept free text or ids, via `z.strictObject`.
4. **Gate UX now that CLI elicitation is live (Pitfall 11):** is the host's elicitation dialog the intended CLI gate experience, or should Claude hosts stay on rung (b)? This is a design question, not an SDK one. It is independent of the migration, but the planner should not "fix" the ladder silently.
5. **Tool annotations:** fold into the 51-site rewrite (sourced from the 356 ledger plus code reading, per the Jev consult) or defer? Recommendation: fold `title` in now (free). Annotations only with a navigator ruling, because they touch host permission behavior.
6. **`mcp-server-brain/` disposition:** delete or archive in a separate cleanup phase. Out of scope here. Registering it avoids a future session re-litigating it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | v2 needs >= 20; repo floor >= 22.16.0 | yes | v22.23.1 | - |
| npm | installs, shrinkwrap | yes | bundled | - |
| Claude Code CLI | Tri-Polar wire probe | yes | 2.1.280 (2.1.281 released) | - |
| `@modelcontextprotocol/server@2.1.0` + ext-apps 2.0.0 | migration | installable; **CJS require verified** | 2.1.0 / 2.0.0 | - |
| `@modelcontextprotocol/sdk` | current servers | installed | 1.29.0 (1.30.1 available) | - |
| zod | all schemas | installed 3.25.76 | 4.6.5 available | - |
| `gh` CLI | release bodies, spec reads | yes, authenticated | - | WebFetch |
| slopcheck | legitimacy gate | yes | scan mode used | - |
| ctx7 (Context7 CLI) | library docs | **no** | - | Official zod changelog via WebFetch plus live measurement |
| Claude Desktop / Cowork hosts | A2 / A7 probes | **not probeable from this shell** | - | Manual checkpoint tasks |

**Production SDK import surface (updated; all must move):**

| File:line | Symbols / form |
|---|---|
| `bin/mindrian-mcp-server.cjs:86,87` | `McpServer`, `StdioServerTransport` via **`requireWithHeal`** |
| `bin/mindrian-mcp-server.cjs:264` | `StreamableHTTPServerTransport` (lazy `require`) |
| `bin/mindrian-brain-mcp-client.cjs:58,59` | `McpServer`, `StdioServerTransport` via **`requireWithHeal`** |
| `bin/mindrian-mcp-shim.cjs:36,37` | `StdioServerTransport`, `StreamableHTTPClientTransport` |
| `lib/mcp/adapter-client.cjs:21,22` | `Client`, `StreamableHTTPClientTransport` |
| `lib/mcp/resources.cjs:21` | `ResourceTemplate` (class exists in v2 `@modelcontextprotocol/server`, verified) |
| `lib/mcp/app-views.cjs:25` | `@modelcontextprotocol/ext-apps/server` |
| `lib/core/mcp-dep-heal.cjs:364` | FALLBACK literal |
| Injected-surface idioms | 39 `server.tool(` + 3 `server.prompt(` + 9 `server.resource(`; 25 `server.server.*` reads (`elicitInput` x4 files, `getClientCapabilities` x4, `getClientVersion` x5); 9 `extra.sessionId`; `sendResourceListChanged` in `tree-watcher.cjs` |
| Tests importing the v1 SDK | 11 files (`tests/test-354-*` x6, `test-248`, `test-257`, `test-265`, `test-276`, `scripts/build-brain-packet-schema.cjs`), plus `docs/reviews/phase-354-probes/*.cjs` |
| `mcp-server-brain/server.cjs:4,5` | **dead, out of scope** |

---

## Validation Architecture

`workflow.nyquist_validation: true`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-ins (`node:assert`, `node:test`) plus bare `node <file>.cjs` PASS/FAIL scripts |
| Config file | none; `tests/run-all-<phase>.sh` aggregators |
| Quick run command | `node tests/test-198-gate-renderers.test.cjs && node tests/test-265-gate-render-elicit-schema.cjs` (both green 2026-09-23) |
| Full suite command | `bash tests/run-all-198.sh` (baseline today: 21 PASS / 3 FAIL pre-existing: Part 8 local-only floor, SPEC-2 contract-schema, SPEC-5 adapter budget); `node scripts/doctor.cjs --acceptance` |

### Phase Requirements -> Test Map
No 267 IDs exist. The planner should mint them (suggested prefix `MCPV2-`). Derived:

| Req | Behavior | Type | Command | Exists? |
|-----|----------|------|---------|---------|
| MCPV2-01 | Installed server package implements 2026-07-28 (Pitfall 1) | unit | `node tests/test-267-sdk-era-assert.cjs` | ❌ W0 |
| MCPV2-02 | Local server `tools/list` = runtime count, non-empty descriptions, both eras | integration | new `tests/test-267-dual-era-tools-list.cjs` (stdio, v2 client default + `auto`) + doctor L4 count | ❌ W0 |
| MCPV2-03 | zod 4: descriptions byte-identical; advertised-strictness policy held | integration | new `tests/test-267-zod4-schema-contract.cjs` (tools/list snapshot diff) + `test-257` Arms Z2-Z4/A | ❌ W0 / ✅ |
| MCPV2-04 | MCP Apps tools publish real input schemas and receive args | integration | new `tests/test-267-app-views-schema.cjs` | ❌ W0 |
| MCPV2-05 | HTTP flag-OFF serves N>1 sequential requests and both eras | integration | new `tests/test-267-http-multi-request.cjs` (fresh port, kill by PID) | ❌ W0 |
| MCPV2-06 | Flag-ON daemon keeps session-keyed binding and concurrency | integration | `node tests/test-198-concurrency-mcp.test.cjs`, `tests/parity-198.sh` | ✅ |
| MCPV2-07 | Gate answer identity across rungs; elicitation schema current | unit | `test-198-gate-renderers`, `test-265-gate-render-elicit-schema` | ✅ green |
| MCPV2-08 | CIRS connectors and HITL shapes survive 51 rewrites | gate | `build-connector-registry.cjs --check`, `check-shape-declaration.cjs --strict` | ✅ |
| MCPV2-09 | Dep self-heal probes real packages | unit | `node lib/core/mcp-dep-heal.test.cjs` (update literals) | ✅ needs update |
| MCPV2-10 | Supply-chain allowlist covers new packages | gate | `bash tests/run-all-199.sh` | ✅ |
| MCPV2-11 | Brain stdio shim unchanged on the wire (6 tools, Part 8 guard) | integration | `tests/test-257-strict-input-shapes.cjs` Arms A-E, G | ✅ (Arm F stale, Arm B flaky, both pre-existing) |
| MCPV2-12 | Payload ceiling holds after dependency swap | gate | `node scripts/check-release-payload-ceiling.cjs` | ✅ |
| MCPV2-13 | Tri-Polar: CLI wire probe records era + capabilities; Desktop/Cowork manual | probe/manual | extend `tests/test-248-surface-probes.cjs` with the stdio tee | ❌ W0 |
| MCPV2-14 | HTTP-mode process exits on SIGTERM | integration | new lifecycle check | ❌ W4 |

### Sampling Rate
- **Per task commit:** quick run + `build-connector-registry.cjs --check`
- **Per wave merge:** `run-all-198`, `run-all-234`, `run-all-199`, `test-257`, `mcp-dep-heal.test.cjs`
- **Phase gate:** `doctor --acceptance` green; MCPV2-02/05/13 green; pre-existing reds unchanged, or fixed and noted

### Wave 0 Gaps
- [ ] `tests/test-267-sdk-era-assert.cjs`
- [ ] `tests/test-267-dual-era-tools-list.cjs` + doctor L4 `tools/list` count (265 R-7)
- [ ] `tests/test-267-zod4-schema-contract.cjs`
- [ ] `tests/test-267-app-views-schema.cjs`
- [ ] `tests/test-267-http-multi-request.cjs` (PID-kill + port-free assertions, Pitfall 9)
- [ ] Rewrite `tests/test-198-contract-schema.test.cjs` introspection (zod 4)
- [ ] Stdio tee harness into `tests/test-248-surface-probes.cjs`
- [ ] Three RCA docs under `.planning/debug/` (C-12)

---

## Security Domain

`security_enforcement` is not `false`, so this section applies.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **no (changed)** | The local servers are stdio or loopback HTTP with no auth. The Brain auth question (old OQ4) belonged to the dead `mcp-server-brain`, and Theo is keyless by design. |
| V3 Session Management | yes | The flag-ON daemon keeps sessions (Pattern 3). `gate-ledger.cjs` single-use, session-keyed, 30-min TTL (T-198-10) must not regress. |
| V4 Access Control | yes | Room write-scope (`isRoomInWriteScope`) keyed by the session binding. Unchanged by the stdio migration. |
| V5 Input Validation | yes | zod on every tool; `validateChosenAgainstCard`. **New:** the zod 4 advertised-strictness change (Pitfall 2) and the app-views empty-schema bug (Pitfall 3). Phase 257's `z.strictObject` mechanism is verified under zod 4. |
| V6 Cryptography | no (this phase) | MRTR and `requestState` are deferred. |
| V12 / resource limits | **yes (new)** | 4 MiB body limit and 100-message batch bound, from 1.30.1 (v1) or 2.1.0 (v2). The HTTP branch has no limit today beyond Express's default `express.json()` 100 KB. Note the interaction: `express.json()` runs before the SDK. |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Forged/replayed `gate_id` | Spoofing | Existing ledger (unchanged). |
| Undeclared-key smuggling | Tampering / Info disclosure | Phase 257 `z.strictObject` on the brain shim tools (verified under zod 4). Decide policy for local tools (OQ3). |
| Oversized body / batch flood on loopback HTTP | DoS | SDK body and batch bounds (Wave 0 via 1.30.1). |
| DNS-rebinding against 127.0.0.1:3847 | Spoofing | Consider `localhostHostValidation()`/`localhostOriginValidation()` from `@modelcontextprotocol/node` (the retired PWS Brain used them). `[ASSUMED]` applicable; verify at plan time. |
| Stale process holding the port (SIGTERM ignored) | DoS / integrity of tests | MCPV2-14 lifecycle check. |
| Supply chain | Tampering | Allowlist entries; slopcheck clean; no install scripts on any package. |

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view` versions, time, peers, deps, scripts, repository) for sdk, server, core, client, node, express, fastify, codemod, server-legacy, ext-apps, zod; npm downloads API.
- `npm pack` tarball diffs: sdk 1.30.0 vs 1.30.1 (md5 of every JS file; marker greps); ext-apps 1.7.5 vs 2.0.0 (`dist/src/server/index.{js,d.ts}`).
- GitHub releases (`gh release view`): `1.30.1`; `@modelcontextprotocol/{server,core,client,node,codemod}@2.1.0`; ext-apps `v2.0.0`.
- `docs/migration/support-2026-07-28.md` (725 lines, last touched 2026-08-28) and `upgrade-to-v2.md` (1,881 lines), fetched fresh via `gh api`.
- Spec: `modelcontextprotocol/modelcontextprotocol` `schema/2026-07-28/schema.ts` (DiscoverResult `instructions`; SEP-2577 deprecations).
- `anthropics/claude-code` CHANGELOG raw (7,453 lines): 2.1.238, 2.1.274, 2.1.281, 2.1.76, 2.1.117 entries.
- Live probes this session: Claude Code 2.1.280 stdio tee; dual-era `serveStdio` (v2 auto, v2 default, v1 client); ext-apps 2.0.0 CJS smoke; v2 API surface check; real server `tools/list` (42/9/61/3/0 annotations); zod-4 preload boot plus key-order-insensitive diff; `run-all-198` under both zods; `test-257` under both zods (x2); `test-198-contract-schema` under both; flag-OFF HTTP clean per-case probes; codemod on a repo copy plus a controlled 3-file test; langtalks MCP queries.
- `https://zod.dev/v4/changelog` (WebFetch), cross-checked by live measurement against zod 4.6.5.
- Repo reads: `bin/mindrian-mcp-server.cjs`, `lib/mcp/app-views.cjs`, `lib/mcp/tools/gate.cjs`, `lib/core/session-binding.cjs`, `lib/core/brain-client.cjs`, `bin/mindrian-mcp-shim.cjs`, `lib/mcp/surface-detect.cjs`, `lib/mcp/mcp-first-flag.cjs`, `lib/core/mcp-dep-heal.cjs`, `package.json`, lockfiles, `references/security/cve-db.json`, `docs/257-NOTE-part8-enforcement-locus-rulings.md`, `.planning/ROADMAP.md` (Phase 267 at lines 609-620 and 984-991), `data/command-irreversibility-ledger.json`.
- Cross-repo (read-only): `/home/jsagi/Theo` (`package.json`, `src/http/serve.ts`, `.planning/phases/08.4-*/{CONTEXT,MOS-LEARNING,LANGTALKS-CONSULT}.md`, `REQUIREMENTS.md` HOST-01); `/home/jsagi/dev/ProblemsWorthSolving-Brain/src/http/app.mjs`.

### Secondary (MEDIUM)
- The 2026-08-27 `267-RESEARCH.md` pass (superseded by this file; carried rows marked).
- `267-RESEARCH-stateless-spec-update.md` (spec addendum; its spec claims re-confirmed; its "held-open-SSE" characterization was already corrected in the prior pass).

### Tertiary (LOW)
- Desktop and Cowork era behavior: no source found (A2, A7).

### Room mirror (Dev-Research Compositing, C-9)
- Direct write to `~/MindrianRooms/rethinking-mindrianos/research/` was **refused** by the `write-scope-check` hook (active room `motj-ecosystem`), the same refusal Phase 354-16 hit. Following that precedent, I did not route around it. Filed at the documented plugin-side fallback: `/home/jsagi/MindrianOS/research/2026-09-23-mcp-sdk-v2-migration-refresh-267.md` with `mirror_status: PENDING`. Follow-up: `/mos:rooms switch rethinking-mindrianos`, then file the identical content under the same filename in that room's `research/`.

---

## Metadata

**Confidence breakdown:**
- **ext-apps unblock and API delta:** HIGH (tarball read, release body, live smoke).
- **1.30.1 non-implementation:** HIGH (byte-level).
- **Host era and elicitation behavior on CLI:** HIGH for 2.1.280 print mode (live wire); MEDIUM for interactive (A8); LOW for Desktop/Cowork (A2/A7).
- **zod 4 blast radius:** HIGH (execution-measured on the real server and suites).
- **Codemod verdict:** HIGH (execution).
- **flag-OFF HTTP bug:** HIGH on mechanism (clean per-case repro plus SDK source line); MEDIUM on production reachability (A7).
- **Architecture patterns:** HIGH for stdio (live); MEDIUM-HIGH for HTTP (guide plus in-house production precedent; per-request cost unmeasured).

**Research date:** 2026-09-23
**Valid until:** 2026-10-07 (14 days). The v2 line shipped 2.1.0 today, and Claude Code ships MCP behavior changes almost weekly (2.1.281 today). Before planning, re-run `npm view @modelcontextprotocol/server version`, `npm view @modelcontextprotocol/ext-apps version peerDependencies`, and the stdio tee against the then-current `claude --version`.
