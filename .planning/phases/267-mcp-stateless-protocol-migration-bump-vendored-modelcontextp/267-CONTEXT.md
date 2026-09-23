# Phase 267: MCP Stateless Protocol Migration - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Source:** Navigator decisions given live, after a force-refreshed research pass (`267-RESEARCH.md`, 2026-09-23) overturned the 2026-08-27 research's premise and primary recommendation.

<domain>
## Phase Boundary

A **local-server-only, unified, internally-staged** MCP SDK v1 -> v2 migration. In scope: `bin/mindrian-mcp-server.cjs` (the local `mindrian-os` server, both stdio and HTTP branches), `bin/mindrian-brain-mcp-client.cjs` (the brain stdio shim), `bin/mindrian-mcp-shim.cjs` and `lib/mcp/adapter-client.cjs` (the two in-repo MCP clients), and all 14 files under `lib/mcp/tools/` plus `lib/mcp/*.cjs` registrars (51 variadic registration sites total: 39 `server.tool(`, 3 `server.prompt(`, 9 `server.resource(`, plus 6 existing `server.registerPrompt(` and 3 ext-apps `registerAppTool` calls to verify, and 6 `registerTool` calls in the brain shim).

**Explicitly OUT of scope:** `mcp-server-brain/` (dead service, per `docs/257-NOTE-part8-enforcement-locus-rulings.md:22` -- do not touch, do not migrate). Theo (`/home/jsagi/Theo`, a separate repo with its own deliberate v1-pin decision, D-04 in its own `08.4-CONTEXT.md` -- nothing here blocks on or waits for Theo). `lib/core/brain-client.cjs` (a hand-rolled 2025-era JSON-RPC client to Theo that uses no SDK at all -- MUST NOT be touched by this migration). MRTR / `requestState` rework of `lib/mcp/gate-render.cjs` rung (a) -- not required, since Claude Code stays 2025-era on stdio and `elicitInput` keeps working there under v2.

</domain>

<decisions>
## Implementation Decisions

### Scope and sequencing (navigator-approved 2026-09-23)
- **The prior Brain-server-first split is WITHDRAWN**, not carried forward. `mcp-server-brain` is dead; the live Brain is Theo, a separate repo out of scope. One phase, one target: the local server family.
- **Wave order (research's own "Fresh recommendation"):** Wave 0 ships `zod@^4.2.0` + `@modelcontextprotocol/sdk@1.30.1` green on v1 first (de-risk the dependency bump before touching any registration code -- measured LOW runtime risk, but ship it in isolation anyway). Then the brain stdio shim (`bin/mindrian-brain-mcp-client.cjs`) migrates first as the **canary** (smallest, most isolated stdio surface). Then the local server's stdio branch. Then the HTTP branches (fixing the real, independently-broken one-request-per-process bug as part of the `createMcpHandler` adoption). v1 dependency (`@modelcontextprotocol/sdk`) is removed from `package.json`/`package-lock.json`/`npm-shrinkwrap.json` LAST, only once nothing imports it.
- **No codemod.** `@modelcontextprotocol/codemod` measured this session: zero source-file rewrites on this repo's CJS `require()` style, and it destructively removes the v1 dependency from `package.json` without adding v2. Hand-migrate all 51 sites.
- **`serveStdio` adoption is future-proofing, not a behavior change today.** Live-verified: Claude Code 2.1.280 opens stdio connections with a plain 2025-11-25 `initialize`, never a `server/discover` probe. Adopt `serveStdio` anyway (the guide's supported dual-era pattern), but do not expect or test for a wire-visible change on stdio.
- **Flag-ON daemon path stays sessionful, 2025-era, unchanged in architecture.** Per the icm-architect consult: do not re-architect room binding in this phase. Route it through the guide's supported `isLegacyRequest(request)` + `createMcpHandler(factory, { legacy: 'reject' })` pattern so the existing session-keyed `lib/core/session-binding.cjs` binding keeps working exactly as today. A future ICM-native redesign (an explicit per-request room/session handle instead of transport-minted identity) is a **follow-up seed**, not work for this phase -- do not attempt it here.
- **Flag-OFF HTTP branch: real, independent bug, fix it as part of this phase.** `bin/mindrian-mcp-server.cjs:318` reuses one stateless `StreamableHTTPServerTransport` across requests; the SDK throws after the first request ("Stateless transport cannot be reused across requests"). This is broken TODAY, independent of any protocol-era question. `createMcpHandler(factory)` fixes it by construction (fresh server per request). Whether real Cowork traffic reaches this branch today is unverified (Open Question 2, unresolved) -- fix it regardless of severity; the fix is required either way once the HTTP branch is touched at all.

### Elicitation gate UX (navigator-approved 2026-09-23)
- **Let elicitation take over on CLI.** Claude Code 2.1.280 now declares `elicitation: {}` (live-verified via wire tee) -- gate rung (a), the inline `elicitInput` round trip in `lib/mcp/gate-render.cjs`, is now the **live** CLI gate path, not dormant. Update the stale comment at `lib/mcp/tools/gate.cjs:145-152` (currently asserts "no Claude host declares elicitation," now false). This is a NEW FAILURE (stale/incorrect code comment asserting a false premise) -- file an RCA per `docs/RCA-TEMPLATE.md` and fix in this phase. Do not suppress or force rung (b) AskUserQuestion instead.

### zod boundary discipline (navigator-stated principle, applies beyond this phase too)
- **zod belongs only at true external-input boundaries**: where bytes arrive from outside the process (an MCP client's tool call, the Jev/TypeSafe API). It must NOT be used for internal data structures, and must NOT be used for egress-guard vocabulary/allow-lists that need to stay a plain, grep-auditable object (e.g. `jev-devtime-client.cjs`'s `EGRESS_PROFILES` -- a zod schema there would hide the vocabulary from Part 8's grep-based sweep). This phase's 51 tool-registration sites (MCP client input) are exactly the correct place for zod and are unaffected by this principle -- it is a constraint on what this phase must NOT introduce elsewhere, not a change to what it's already doing.
- **zod 3 -> 4 schema strictness: accept the looser default.** Measured this session: the bump drops `additionalProperties: false` at 38 schema sites across 35 of 42 tools (zod 4's default object behavior is strip, not the v3 default's implicit constraint). Runtime stripping behavior is unchanged; this is a wire-contract looseness, not a security control (no tool handler treats unexpected extra fields as a trust boundary). Accept this as shipped; do not spend this phase's budget auditing which of the 35 tools should be hand-tightened to `z.strictObject`. Revisit only if a concrete problem surfaces later.

### Three NEW FAILURES found during research -- each needs its own RCA per `docs/RCA-TEMPLATE.md`, filed to `.planning/debug/`, and each is in scope to fix in this phase
1. **Flag-OFF HTTP one-request-per-process bug** (`bin/mindrian-mcp-server.cjs:318`) -- fixed as part of the `createMcpHandler` HTTP-branch migration wave (see Sequencing above).
2. **`lib/mcp/app-views.cjs` lines 242/267/296 pass `schema:` instead of `inputSchema:`** -- all three MCP Apps tools (`room-dashboard`, `room-wiki`, `room-graph`) currently publish EMPTY input schemas on both v1 and v2, so their `room_path`/`section`/`layout` arguments never arrive. This is a pre-existing bug, unrelated to the SDK version, found while reading this code for the migration. Fix it in the same commit that touches `app-views.cjs` for the registration-API rewrite.
3. **Stale `gate.cjs` elicitation comment** -- see "Elicitation gate UX" above.

### Cross-repo boundaries (hard constraints, do not cross)
- **Theo** (`/home/jsagi/Theo`): read-only for this phase, per THEO-04's already-shipped routing rule. Theo made its own deliberate v1-pin decision (D-04, dependency minimalism, not a blocker) and this phase does not wait on or influence it. If Theo ever migrates to v2, it must keep `legacy: 'stateless'` (never `'reject'`) or every installed plugin's Brain access goes dark -- record this as a note for whoever eventually plans Theo's own migration, not as work here.
- **`lib/core/brain-client.cjs`**: hand-rolled 2025-era JSON-RPC client (not SDK-based) that talks to Theo. Explicitly out of scope -- do not touch, do not "modernize" it as part of this migration.
- **`mcp-server-brain/`**: dead service. Do not migrate it, do not resurrect it, do not reference it as a precedent target (it remains useful only as a **pattern precedent** -- see below).

### Reuse precedent (Canon Part 7)
- The retired PWS Brain (a sibling but separate repo, `~/dev/ProblemsWorthSolving-Brain`) ran `createMcpHandler((ctx) => buildBrainServer({...ctx, adminAllowed}), { legacy: 'stateless' })` behind `toNodeHandler`, with auth reaching the factory as `ctx.authInfo` via `req.auth`, in production, serving this very plugin's released `brain-client.cjs` (a 2025-era hand-rolled client) without incident. This is real, production-proven evidence that `legacy: 'stateless'` correctly serves this repo's own 2025-era client shape -- cite it directly if the plan needs to justify the `createMcpHandler` HTTP-branch approach rather than re-deriving confidence from the guide's prose alone.

### Supply-chain and release gates (unchanged obligations, now with current facts)
- New VETTED entries needed in `references/security/cve-db.json`'s `surfaces.supply_chain.allowlist` for `@modelcontextprotocol/{server,core,client}` (and `node` if the HTTP branch uses it) at whatever exact version is pinned when the plan executes (the family was at 2.1.0 as of 2026-09-23T15:43Z and had moved within the research session itself -- re-check the exact version at plan/execute time, do not hardcode 2.0.0 or 2.1.0 into the plan).
- Phase 341 retired vendored `node_modules`; dependencies now ship via `npm-shrinkwrap.json` (tracked) installed per-machine by the loader. The v2 packages must land in `package.json`, `package-lock.json`, AND `npm-shrinkwrap.json`. `scripts/check-release-payload-ceiling.cjs` must stay green.
- Run `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --strict` after every registration-rewrite commit (51 sites, each with a sibling `connectors` export that's easy to leave behind or misalign).

### Claude's Discretion
- **Tool annotations** (`title`, `annotations.{readOnlyHint,destructiveHint,idempotentHint,openWorldHint}`): zero of 42 tools currently declare them (the v1 variadic form had no slot). `registerTool`'s config object does. Adding them costs little while every registration is being touched anyway (vs. touching all 42 twice later) -- planner's call whether to fold this into the registration-rewrite wave or defer. If added, `destructiveHint` can be derived from Phase 356's already-shipped `data/command-irreversibility-ledger.json` instead of any new judgment call.
- **Claude Desktop's actual protocol/elicitation behavior is still unverified** (no public changelog; CLI-only data so far, assumption A2 still open). Whether this needs a Wave 0 manual-probe task or can be deferred to a later verification wave is the planner's call -- but it must be verified at some point in this phase before claiming Tri-Polar coverage, not assumed identical to CLI.
- Exact wave/plan count and task granularity within the locked sequencing above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (primary)
- `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-RESEARCH.md` (2026-09-23 force-refresh) -- READ IN FULL. Contains the delta ledger against the 2026-08-27 pass, the four mandatory grounding consults (Theo, langtalks, icm-architect, Jev), the full Runtime State Inventory, Security Domain, and complete production SDK import-site table (51 registration sites + the full file:line list).
- `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-RESEARCH-stateless-spec-update.md` -- the earlier spec-addendum research, superseded but may carry supplementary context.

### Canon and architecture
- `docs/MINDRIAN-CANON.md` Part 7 (Reuse Before Build), Part 8 (Graph Boundary -- corrected scope this phase, see research's C-3), Part 9 (Memory Locality), Part 11 (CIRS -- 51 registration rewrites each touch a sibling `connectors` export).
- `.claude/includes/release-process.md` (Phase 341's `npm-shrinkwrap.json` supersession of vendored `node_modules`).
- `docs/RCA-TEMPLATE.md` (the format for the three new-failure RCA docs this phase must file).
- `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 (release lockstep count).

</canonical_refs>

<specifics>
## Specific Ideas

- Sequence registration-rewrite commits by file, and run `build-connector-registry.cjs --check` + `check-shape-declaration.cjs --strict` after each, not just at the end -- the research's own Pitfall (carried from the 2026-08-27 pass) specifically warns this class of rewrite silently drops CIRS connector declarations.
- The brain stdio shim (`bin/mindrian-brain-mcp-client.cjs`) is explicitly named as the canary -- smallest, most isolated stdio surface, migrate and fully verify it FIRST before touching the larger local server, to catch migration-pattern mistakes cheaply.
- `zod` needs to land at exactly the version the v2 family's `peerDependencies` requires at execute time (was `^4.2.0` as of the research pass) -- re-check, the family itself moved mid-research-session (2.0.0 -> 2.1.0 in one day).

</specifics>

<deferred>
## Deferred Ideas

- MRTR rework of `gate-render.cjs` rung (a) -- not required; stdio stays 2025-era for Claude Code, and `elicitInput` keeps working there under v2's legacy shim.
- A future ICM-native redesign of the flag-ON daemon's room-binding identity (an explicit per-request handle instead of transport-minted state) -- recorded as a follow-up seed by the icm-architect consult, not work for this phase.
- Any Theo-repository-side migration decision -- entirely out of scope, Theo's own call in Theo's own repo.
- `mcp-server-brain/` -- dead, not resurrected, not migrated.

</deferred>

---

*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Context gathered: 2026-09-23, navigator decisions given live via AskUserQuestion after the force-refreshed research pass*
