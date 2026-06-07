---
type: strategic-seed
title: MindrianOS as an API-based, multi-coding-agent SDK with the Brain as a first-class key-gated client
seeded: 2026-06-07
status: SEED (not yet a milestone; promote via /gsd-new-milestone or /gsd-explore)
source: navigator directive 2026-06-07 ("seed this; investigate multi-coding-agent use, not only Claude Code; learn from GSD") + a parallel-session architectural analysis + an Explore investigation of GSD multi-runtime + the plugin coupling map
canon_parts: [Part 1, Part 7, Part 8, Part 9]
references:
  - https://gsd-build-get-shit-done.mintlify.app/introduction (GSD official docs - multi-runtime model + distribution; doc index https://mintlify.com/gsd-build/get-shit-done/llms.txt)
---

# Seed: The MindrianOS SDK (multi-runtime + Brain-as-client)

## The one-line invariant (the whole seed in a sentence)

**Ship the client and the contract, never the graph.** The Brain's IP (15,298 nodes / 19,713 rels / 12,401 embeddings + grading + mode-engine calibration) stays a remote, metered service forever; the SDK ships a thin, key-gated Brain CLIENT and the typed wire CONTRACT - never the data.

## The two things both called "the Brain" (the line Part 8 draws)

| "the Brain" | What it is | Ships in SDK? |
|---|---|---|
| Brain DATA / IP | the graph, embeddings, calibration - the moat | NEVER, in any form |
| Brain API surface + client | brain_ask / brain_query / brain_search / brain_schema, the typed packet, auth, key resolution | YES - this IS the SDK seam |

"Brain in the SDK" = the SDK ships a Brain client, not the Brain. Promote the existing wire (Phase 110 typed Brain Context Packet) from an optional MCP bolt-on to the public, versioned API contract.

## The three tiers (the productization shape)

1. **LOCAL core (open, fully in the SDK).** Room graph, navigation chokepoint (`lib/core/navigation.cjs`), connector spine (143.3), resolvers (Phase 122), methodology surfaces. MUST be useful with ZERO Brain access (Tier 0 / Mode B) - Larry's pedagogy is intrinsic, never Brain-dependent (Canon Part 1). Non-negotiable.
2. **Brain client (thin, in the SDK).** `brain.ask()`, `brain.recommendChain()`, `brain.search()` - typed-packet calls over the wire, key-gated. Ships as code, carries NO IP.
3. **Brain service (remote, the IP, never shipped).** Does the reasoning, ENFORCES the boundary server-side, meters by key.

This matches the business model: free = prompt-Larry + Brain MCP; paid = trained-Lawrence model. The API + key is the natural metering/monetization seam - "Brain access" is the thing sold, cleanly separated from the open local core.

## Why API-based fits BETTER than "Brain as a bolt-on MCP"

- **Already ~80% this shape.** Brain is a remote MCP over Streamable HTTP; the key system (`brain_api_keys`, `MINDRIAN_BRAIN_KEY`, `lib/core/resolve-brain-key.cjs`) and the Phase-110 typed packet exist. API-based is just promoting that wire to the public contract.
- **Part 8 gets STRONGER, not weaker.** With an API the boundary becomes a server-side guarantee (the endpoint rejects any packet carrying user content) PLUS a client-side guarantee (see the risk below). Structural enforcement beats the procedural PR-gate audit.
- **It is the monetization seam.** Authenticate, rate-limit, tier - cleanly separated from the open local core.

---

## What we learned from GSD (it already works across 14 runtimes)

GSD's multi-runtime is 4 load-bearing choices. MindrianOS should copy the PATTERN:

1. **Runtime-name canonicalization as a pure read.** `gsd-core/bin/lib/runtime-name-policy.cjs` canonicalizes 14 runtime aliases (claude/copilot/codex/gemini/cursor/windsurf/...); runtime is a READ-ONLY context property, never mutated. -> MindrianOS: add a `runtime` context read; never fork core per runtime.
2. **Spawn abstraction lives in the MARKDOWN layer, not the core.** There are ZERO `Agent()` calls in GSD core CJS - all agent spawns live in workflow markdown; the executor maps `subagent_type=` to the runtime's mechanism (Agent / spawn_agent / sequential-inline). -> MindrianOS: keep orchestration (Skill/Agent invocation) in commands/skills markdown; keep `lib/core` pure.
3. **Tool-name adaptation at CALL-TIME, one shim site.** `shell-command-projection.cjs` adapts per (runtime, platform) at call time (AskUserQuestion -> Skill vs @command vs inlined text). One call site knows runtime-specific tool names. -> MindrianOS: a single shim for the Decision-Gate primitive across runtimes.
4. **One shared executable core.** `gsd-tools.cjs` (`#!/usr/bin/env node`) is a single CJS entrypoint callable via `node gsd-tools.cjs <cmd>` from ANY runtime. -> MindrianOS ALREADY has this: `bin/mindrian-tools.cjs` (CLI) + `bin/mindrian-mcp-server.cjs` (MCP) over the same `lib/core/*.cjs`.

**The GSD lesson in one line:** reusable pure-CJS core + runtime-specific orchestration layer. The fork point for a new coding agent is HOW it invokes the core's entrypoints, never the core itself.

### Referenced research: the GSD docs (https://gsd-build-get-shit-done.mintlify.app/introduction)

The official GSD docs are the canonical reference for the "one methodology, many coding agents" model. Captured 2026-06-07; doc index at `https://mintlify.com/gsd-build/get-shit-done/llms.txt`.

- **Design philosophy (verbatim):** "The complexity is in the system, not in your workflow." GSD frames itself as structured context engineering against "context rot" / vibecoding. Self-description: "a light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code, OpenCode, Gemini CLI, and Codex" - i.e. a single core with runtime adapters, not per-runtime forks.
- **5-layer architecture:** (1) Context Engineering (`.planning/` files), (2) Multi-Agent Orchestration (research/plan/execute/verify agents), (3) Wave Execution (dependency-graph parallelism), (4) Atomic Git Commits (per-task), (5) Fresh Context per Task ("Each execution plan gets 200k tokens purely for implementation. Zero accumulated garbage, no quality degradation."). MindrianOS already mirrors layers 1-4 via GSD-in-this-repo; the SDK adds the runtime-portability of layer-0.
- **Multi-runtime support (the proof point):** Claude Code / OpenCode / Gemini CLI / Codex, with a UNIFIED command interface that varies only in env-specific syntax: Claude Code `/gsd:command`, OpenCode `/gsd-command`, Codex `$gsd-command`. This is the call-time tool-name shim pattern, documented as a product feature.
- **Distribution model:** npm-based CLI installer - `npx get-shit-done-cc@latest` - choose runtime(s) (single or all) + scope (global/local); semver via the npm registry. This is the template for MindrianOS's standalone-package publish lever.
- **THE DIFFERENTIATOR (what GSD does NOT have):** the docs contain NO public SDK/API, NO plugin system, NO extensibility hooks, NO remote service - GSD is entirely CLI-commands + local markdown + local CJS core. It has nothing to meter because it has no remote IP. **MindrianOS's SDK goes one step beyond GSD precisely here: the key-gated Brain CLIENT + remote Brain SERVICE is the metered API layer GSD has no analog for.** So: copy GSD's multi-runtime PACKAGING + adapter pattern wholesale; then add the thing GSD lacks - the Brain-as-first-class-client API tier (which is the monetization seam and the moat).
- **Automation-first:** GSD documents `--dangerously-skip-permissions` for unattended runs ("GSD is designed for automation") - relevant when MindrianOS surfaces are driven headlessly by non-Claude agents.

**Net for the seed:** GSD validates the architecture (single CJS core + markdown orchestration + per-runtime syntax shim + npm-installer distribution across 4+ agents). MindrianOS should adopt that pattern verbatim for the LOCAL core, and then differentiate with the API tier GSD intentionally has no need for.

## MindrianOS coupling map (what blocks multi-runtime today)

**Claude-Code-coupled (3 surfaces - the only blockers):**
- `.claude-plugin/plugin.json` - Anthropic plugin manifest (install path `claude plugin install ...`).
- `hooks/hooks.json` + hook scripts - SessionStart/PreCompact/PostCompact are Claude Code events.
- `settings.json` / `settings.local.json` - `{agent: larry-extended}`, MCP enablement.

**Already runtime-agnostic (7 cores - the assets):**
- `bin/mindrian-mcp-server.cjs` (stdio+HTTP; surface detection; `MINDRIAN_ROOM` env-configurable) - any MCP-speaking agent can call it.
- `lib/mcp/tool-router.cjs` - Zod-schema MCP tools.
- `lib/core/brain-client.cjs` + `lib/core/resolve-brain-key.cjs` - pure HTTP client + 3-precedence key resolution, zero runtime assumptions.
- `bin/mindrian-brain-mcp-client.cjs` - MCP stdio wrapper around brain-client (6 tools).
- `room/` ICM folder structure + `STATE.md`/`ROOM.md` (YAML+md).
- `lib/core/navigation.cjs` SQLite graph chokepoint.
- `commands/*.md` (markdown + frontmatter, MCP-callable) - the connector spine (143.3) already makes them registry-described.

**The coupling is at the SURFACE layer only. The execution engine is Claude Code; the data/logic layer is not.** CLAUDE.md already states the design: `lib/core/*.cjs` shared internals called by BOTH CLI and MCP.

## Brain-as-SDK-client readiness

**SHIPPED:** key system (`resolve-brain-key.cjs`, SEC-01/02 + 3-precedence), HTTP client (`brain-client.cjs`, session cache + quota fallback + 20s timeout + Zod), typed packet contract (Phase 110), egress audit seam (Phase 117-04 `check-brain-boundary.cjs`), MCP wire (`mindrian-brain-mcp-client.cjs`, 6 tools), Tier-0 graceful fallback (`tier0-messaging.cjs`), Part 8 doctrine (Canon).

**MISSING to make it a public API client:** versioned npm release (`@mindrian_os/brain-client` v1, interface freeze, CHANGELOG), `.d.ts`/JSDoc typings, structured error contract `{code, message, retryable, retryAfterSeconds}` (generalize the quota path), rate-limit/cache docs, a PUBLISHED Part-8 integration test suite, an HTTP-vs-MCP-vs-offline decision-tree doc.

---

## The single biggest LEVER

**Decouple the MCP server + Brain client from the Claude Code plugin metadata and publish them as standalone npm packages** (`@mindrian_os/mcp-server`, `@mindrian_os/brain-client`, `@mindrian_os/core`). Any runtime wires them via `mcp.json` or `npm install` + `node`. Keep the Claude Code plugin as a convenience wrapper that installs + pre-wires the packages and adds the Claude-specific surfaces (hooks/skills/commands). **Effort: LOW-MEDIUM - mostly packaging + docs, little/no code change** (surface detection + env-config already exist).

## The single biggest RISK (and the load-bearing fix)

**Part 8 is currently enforced via a Claude Code PostToolUse hook.** That hook does NOT exist on Copilot / Gemini / Cursor / Codex. A non-Claude agent calling the Brain client with unfiltered user content would breach the constitutional boundary - the moat dies. (`brain-client.cjs` has a `sanitizeCypherInput()` but it strips chars; it does NOT structurally validate the whole payload.)

**Fix (defense in depth, both ends):**
1. **Move the Part-8 boundary check INTO `brain-client` itself** - reject any packet/Cypher carrying artifact bodies, file paths, user names, decision content; allow only generic handles (framework names, phase ids, enums, hashes). Enforced for EVERY runtime, not just Claude Code.
2. **Re-validate server-side at the Brain endpoint** (the API edge) - the endpoint refuses user-content packets regardless of client.
3. **Ship the Part-8 integration test in the package** so any consuming agent can `npm test` and prove they are not leaking.

This is WHY "Brain as public API client" is the safe productization: enforcement migrates from a Claude-only hook to the client+server contract.

---

## Open questions (resolve before a milestone)
- OQ-1: package split - 2 packages (mcp-server + brain-client) or 3 (+ core)? Does `core` ship open, or only via the MCP server surface?
- OQ-2: is the public surface the MCP wire (every agent speaks MCP) OR the npm client (Node-only agents), or both? (Lean: both - MCP for tool-using agents, npm client for code-level use.)
- OQ-3: API/packet versioning policy - semver on the packet schema; how breaking changes propagate to consumers.
- OQ-4: auth + rate-limit + tiering as SDK-level concerns - reuse `brain_api_keys` as-is, or a new public key tier?
- OQ-5: the runtime shim for the Decision Gate (Part 3, Shape F) - what is the AskUserQuestion equivalent per runtime, and where does the single shim site live (mirror GSD's `shell-command-projection.cjs`)?
- OQ-6: graceful-degradation as a CONTRACT - the SDK must promise correct local behavior on 401/timeout/offline (degrade to local, never fail closed on a teaching task - Canon Part 1).

## Candidate path (if promoted)
1. **Spike** (`/gsd-spike`): prove a non-Claude runtime (e.g. a bare Node script or Copilot) drives `bin/mindrian-mcp-server.cjs` + `brain-client.cjs` end-to-end against a fixture room, Brain-less AND Brain-on.
2. **Phase A - Part-8-into-the-client** (the safety prerequisite): move boundary enforcement into brain-client + ship the published Part-8 integration test. This must land BEFORE any public release.
3. **Phase B - package split + versioned release**: `@mindrian_os/brain-client` v1 (typings, error contract, docs) + `@mindrian_os/mcp-server`; plugin becomes the convenience wrapper.
4. **Phase C - runtime adapters**: the Decision-Gate shim + a second-runtime proof (Copilot or Cursor), mirroring GSD's adapter layer.

## Why this is canon-coherent
- Part 1: local-first, Brain-optional pedagogy stays intact (Tier 0 guarantee).
- Part 7: ~all reuse - the cores already exist; the work is packaging + a boundary relocation, not new engines.
- Part 8: enforcement gets STRONGER (client + server, every runtime) - the moat turns from a shipped artifact into a metered service.
- Part 9: the navigation chokepoint + typed packet are the seams that make the wire structurally safe.
