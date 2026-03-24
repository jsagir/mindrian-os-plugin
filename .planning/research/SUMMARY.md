# Project Research Summary

**Project:** MindrianOS-Plugin v3.0 — MCP Platform & Intelligence Expansion
**Domain:** Claude Code plugin with dual-delivery MCP server, collaborative room intelligence, grant discovery, and AI personas
**Researched:** 2026-03-24
**Confidence:** HIGH (stack/architecture), MEDIUM (features/pitfalls)

## Executive Summary

MindrianOS v3.0 is a dual-surface intelligence platform: the existing 41-command Claude Code plugin (CLI surface) gains a parallel MCP server delivery layer so that Desktop and Cowork users receive identical capabilities without any CLI access. The research confirms a clean architectural path: a `mindrian-tools.cjs` shared core wraps existing Bash scripts via `child_process.execSync`, and a `mcp-server/` package exposes that same core as MCP tools + resources + prompts via stdio transport. Only two net-new npm dependencies are justified (`@modelcontextprotocol/sdk@1.27.1` and `cheerio@1.2.0`); everything else is Node.js built-ins or the existing Bash/Python script layer. The "folder IS the orchestration" principle is preserved without compromise.

Two new room sections (`opportunity-bank/` and `funding/`) follow the established ICM pattern — each a sub-room with its own STATE.md. Grant discovery uses the free Grants.gov REST API as the primary data source, supplemented by web search for non-API sources, with Candid API as a paid-tier upgrade deferred until adoption is proven. AI Team Personas are generated directly from room state using De Bono's Six Hats framework as structure; they are perspective lenses that Larry adopts temporarily, not autonomous agents or expert advisors. Remote room access (Streamable HTTP transport + git-based sync) is explicitly scoped to v3.x+ after local MCP is validated.

The dominant risk is architectural: exposing 41 CLI commands as 41 MCP tools will consume 30,000-60,000 tokens of context window and cause LLM tool-selection failures. The research prescribes a hierarchical router pattern (5-8 high-level MCP tools, each taking a `command` enum parameter), MCP Resources for all read-only room data, and a parity matrix in CI to prevent CLI/MCP surface drift. The second major risk is premature abstraction during shared core extraction — the prescription is to treat `scripts/` as the already-existing shared core, point MCP tools directly at those scripts first, and extract upward only after three distinct consumers have emerged (Rule of Three).

---

## Key Findings

### Recommended Stack

The stack splits cleanly between the immutable plugin layer (Markdown + JSON + Bash, zero npm dependencies) and the new MCP server layer (Node.js CJS, `@modelcontextprotocol/sdk`, `zod`, `cheerio`). The SDK version 1.27.1 supports both stdio and Streamable HTTP transports on a single `McpServer` instance, meaning the local stdio v3.0 server can gain remote Streamable HTTP transport in a future phase without any architectural refactor. `zod@^3.25` is a required peer dependency of the SDK. `cheerio@1.2.0` is needed only for scraping non-API grant sources; the Grants.gov search endpoint is fully structured JSON with no scraping required.

**Core technologies:**
- `@modelcontextprotocol/sdk@1.27.1`: MCP server implementation — the only path to Desktop/Cowork users; 34,700+ dependents, MIT license, verified stable
- `zod@^3.25.76`: Input/output schema validation for MCP tool definitions — required by SDK, pin to 3.x for ecosystem compatibility
- `cheerio@1.2.0`: HTML parsing for non-API grant sources (SBIR.gov, state portals) — pure JS, no native bindings, 19,873 dependents
- Grants.gov REST API (v1, free): Primary structured grant data source — no API key needed for search, 60 req/min rate limit, verified 2026-03-24
- Node.js CJS `lib/core/*.cjs`: Shared internals called by both CLI and MCP — mirrors proven GSD pattern, zero additional dependencies
- Existing `scripts/` (20 Bash scripts): Authoritative computation layer — preserved as-is; MCP tools wrap via `child_process.execSync`

**Total new npm dependencies for v3.0: 2** (`@modelcontextprotocol/sdk` + `cheerio`; `zod` pulled in by SDK).

**Do not add:** Express/Hono/Fastify (MCP SDK bundles Hono internally), LangChain/CrewAI/AutoGen (fights ICM-native design), SQLite/Redis (creates dual source of truth with filesystem), TypeScript (build step breaks "every output is an edit surface"), Commander/yargs (Claude is the caller, not a human), `dotenv` (plugin inherits env from spawning process).

### Expected Features

**Must have (table stakes — v3.0 launch blockers):**
- MCP Server exposing tools + resources + prompts via stdio — Desktop/Cowork users have zero value without this
- `mindrian-tools.cjs` CLI entry point — enables hook scripts, agent tool calls, and GSD-pattern dual delivery
- MCP Resources for room state (`room://` URI scheme) — read-only room data must not bloat tool context; Resources not Tools
- MCP Prompts for methodology workflows — 25 existing methodology bots map directly to MCP prompts with room-context injection
- Opportunity Bank room section (`room/opportunities/`) — follows exact ICM sub-room pattern; low complexity, high signal
- Funding Room structure (`room/funding/`) with per-grant sub-folders — structure only; intelligence added in v3.x
- Basic grant lifecycle tracking: Discovered > Researched > Applying > Submitted > Awarded/Rejected

**Should have (differentiators — make v3.0 sticky):**
- Proactive grant scouting agent (session-start hook-triggered, not cron) — reads room state, queries Grants.gov API, files discoveries
- Room-aware grant matching using full 8-section DD context, not keyword-only matching
- AI Team Personas auto-generated from room intelligence + De Bono hats framework
- Persona dependency chain (coherence cascade): Market Expert > Technical Expert > Financial Expert > Devil's Advocate
- Room context injection in MCP prompts — prompts arrive pre-loaded with current room state; no other MCP server does this
- Per-grant GSD-style process folder with stage-specific artifacts and Larry assistance per stage

**Defer (v4+):**
- Remote Room collaborative MCP (Streamable HTTP + git sync) — MCP protocol's session state is a 2026 roadmap item; spec is unstable
- Candid API integration — paid tier; defer until grant feature adoption proven
- Full grant submission portal — regulatory liability; document generation only, user submits through official portals
- Persona marketplace or memory across sessions — room IS the persona memory; cross-session state bloats context and creates drift

### Architecture Approach

v3.0 adds two new directories to the existing plugin repo without touching any existing command, skill, agent, or hook. `bin/mindrian-tools.cjs` is a single Node.js CJS entry point (mirroring `gsd-tools.cjs` exactly) backed by `lib/core/*.cjs` modules that wrap existing Bash scripts. `mcp-server/server.cjs` is the stdio MCP server that registers MCP tools as thin Zod-validated wrappers around those same core modules. The existing `scripts/` directory is the de facto shared core; refactoring it is deferred until the Rule of Three is satisfied. Hook scripts remain Bash because their sub-3-second execution requirement rules out Node.js cold start.

**Major components:**
1. `bin/mindrian-tools.cjs` (shared core entry point) — single dispatch hub; called by hook scripts via `node bin/mindrian-tools.cjs <subcommand>` and imported directly by MCP tool handlers
2. `lib/core/*.cjs` (room-ops, state-ops, meeting-ops, graph-ops, persona-ops, opportunity-ops) — business logic wrapping Bash scripts via `child_process.execSync`; surface-agnostic
3. `mcp-server/server.cjs` + `tools/*.js` (MCP tool registrations) — stdio transport, hierarchical router (5-8 top-level tools), thin Zod-validated wrappers over core
4. `room/opportunity-bank/` + `room/funding/` + `room/personas/` (new room sections) — ICM sub-rooms; `compute-state` and `analyze-room` updated to discover sections dynamically
5. `references/personas/` + `references/opportunities/` (new reference sets) — generation templates and grant pattern libraries following existing `references/` structure

**Key architectural constraint:** CLI commands are instructions to Claude (conversational pipelines). MCP tools are callable functions (structured atomic operations). A multi-step CLI command like `file-meeting.md` decomposes into 4-5 discrete MCP tools. This is not a 1:1 mapping.

### Critical Pitfalls

1. **Tool explosion kills MCP server usability** — 41 flat MCP tools consume 30K-60K tokens of context window; LLM tool-selection accuracy degrades; Cursor hard-caps at 40 total tools. Prevention: hierarchical router pattern with 5-8 high-level tools; use MCP Resources for all read-only data. This architecture must be locked before any tools are implemented — retrofitting a router is a full rewrite.

2. **Shared core extraction breaks existing 41 commands** — Premature abstraction before understanding how MCP tool I/O differs from CLI command I/O creates a shared core that neither surface fits cleanly (Sandi Metz: "duplication is far cheaper than the wrong abstraction"). Prevention: treat `scripts/` as the already-existing shared core; point MCP tools at scripts first; apply Rule of Three (extract only after three distinct consumers); never add a `surface` or `mode` parameter to shared functions.

3. **Remote Room exposes venture-sensitive data without auth** — Meeting transcripts, financial models, and competitive intelligence become network-accessible. Prevention: ship stdio-only for v3.0 (same machine, no network exposure); add OAuth 2.1 + Resource Indicators (RFC 8707) + TLS before any Streamable HTTP transport. Never use HTTP; never store credentials in config files.

4. **Feature parity drift between plugin and MCP surfaces** — Plugin gains commands faster than MCP tools are built; Desktop users get degraded capability silently with no automated detection. Prevention: parity matrix (command name, CLI status, MCP status, last verified date) as a CI-checked file; `mindrian-tools.cjs` shared entry point guarantees automatic parity at the logic level.

5. **AI Personas generate hallucinated expert advice users trust** — Domain-specific hallucination rates: legal 18.7%, medical 15.6% (2026 survey). Persona framing creates false credibility even when outputs are identical to non-persona outputs. Prevention: frame as De Bono perspective lenses, never as named expert advisors; every persona output includes a disclaimer; personas only synthesize from existing room data, never generate new domain facts.

---

## Implications for Roadmap

Based on the dependency graph established in ARCHITECTURE.md and validated by PITFALLS.md, the build order follows a strict dependency chain: shared core enables everything else; MCP server and new room sections can proceed in parallel once core is done; personas require rich room content so they ship last among v3.0 features; remote room is explicitly deferred.

### Phase 10: Shared Core + CLI Tools Layer

**Rationale:** This is the foundation for every subsequent phase. Nothing else — MCP server, opportunity bank, personas — can ship without callable Node.js logic. Phases 11 and 12 can run in parallel only after Phase 10 delivers.
**Delivers:** `bin/mindrian-tools.cjs` with `room-ops`, `state-ops`, `meeting-ops`, `graph-ops`; dynamic section discovery in `compute-state` and `analyze-room` (replaces hardcoded `SECTIONS` array); validated by having existing hook scripts call into `mindrian-tools.cjs` for complex operations
**Addresses:** MCP foundation, `mindrian-tools.cjs` CLI entry point (FEATURES.md P1), room section extensibility
**Avoids:** Pitfall 2 (premature abstraction) — `scripts/` stays as-is; extraction is additive; Pitfall 8 (abstraction obscures debugging) — max 3 layers enforced from the start

### Phase 11: MCP Server (Local, stdio)

**Rationale:** The MCP server is the entire reason for v3.0. Desktop and Cowork users are completely blocked without it. Depends on Phase 10's shared core for tool implementations.
**Delivers:** `mcp-server/server.cjs` with hierarchical tool router (5-8 tools max), MCP Resources for `room://` URI scheme, MCP Prompts for methodology workflows with room context injection; validated via `npx @modelcontextprotocol/inspector` and actual Claude Desktop `claude_desktop_config.json` test on all three platforms
**Uses:** `@modelcontextprotocol/sdk@1.27.1`, `zod@^3.25`, `lib/core/*.cjs` from Phase 10
**Implements:** Dual-delivery pattern, all three MCP primitives (tools/resources/prompts), stdio transport with Streamable HTTP hook-point
**Avoids:** Pitfall 1 (tool explosion) — hierarchical router designed before any tools are implemented; Pitfall 4 (surface parity drift) — parity matrix in CI from this phase forward; Pitfall 5 (transport lock-out) — no SSE, dual transport design from day one; Pitfall 11 (cross-platform URI) — `url.pathToFileURL()` for all resource URIs

### Phase 12: New Room Sections (Opportunity Bank + Funding Room)

**Rationale:** These are new ICM sub-rooms following established patterns. They do not depend on the MCP server and can be built in parallel with Phase 11, but require Phase 10's dynamic section discovery. Grant discovery delivers standalone value even before MCP is complete.
**Delivers:** `room/opportunity-bank/` and `room/funding/` sub-rooms with STATE.md, per-grant folders following GSD process structure, basic lifecycle tracking, session-start hook extension for proactive grant scanning via Grants.gov API, new `commands/opportunities.md` and `commands/funding.md`, `agents/opportunity-scanner.md`
**Uses:** Grants.gov free REST API (primary), `cheerio@1.2.0` (secondary), Native `fetch` (Node 18+)
**Implements:** Opportunity Bank as room section; Funding Room as sub-room; hook-driven grant scanning (no cron)
**Avoids:** Pitfall 6 (scope creep into CRM) — scope locked at discovery + connections only; no deadline management, no application form filling; Pitfall 12 (API credit burn) — 7-day cache TTL, re-scan only on room content change; Pitfall 13 (stale status) — Larry conversational reminders at SessionStart, no notification infrastructure; Pitfall 14 (Brain dependency) — every feature tested Brain-disconnected first

### Phase 13: AI Team Member Personas

**Rationale:** Personas require well-populated rooms to produce non-generic output. Building last in the v3.0 sequence means rooms will have opportunity-bank and funding data in addition to the 8 DD sections, producing venture-specific rather than generic personas.
**Delivers:** `lib/core/persona-ops.cjs` for persona generation from room state, `commands/persona.md`, `references/personas/` generation templates, `room/personas/` storage following ICM artifact pattern, Larry persona-lens behavior (De Bono Six Hats framing), `team_persona` tool in MCP server's hierarchical router
**Implements:** Persona generation flow (room analysis > domain extraction > hat assignment > PERSONA.md), selective persona activation (analysis/synthesis tasks only per PRISM research), persona dependency chain via pipeline chaining (coherence cascade)
**Avoids:** Pitfall 7 (hallucinated expert advice) — "perspective lens" framing, not "expert advisor"; disclaimer on every persona output; personas synthesize only from room data; Pitfall 5 anti-pattern (personas as independent agents) — personas are skill context files loaded by Larry, not autonomous agents

### Phase 14: Remote Room Access (Deferred — v3.x+)

**Rationale:** Remote room adds authentication, conflict resolution, Streamable HTTP transport, and real-time sync — each a significant complexity layer. The 2026 MCP roadmap lists session state as active work; building on a shifting spec is high-risk. Local MCP must be battle-tested in production before network complexity is layered on top.
**Delivers:** Streamable HTTP transport alongside existing stdio on same `McpServer` instance (no code refactor — SDK supports dual transports), OAuth 2.1 + Resource Indicators (RFC 8707), git-based room sync for concurrent team access, STATE.md conflict resolution via recompute (derived data, always safe to regenerate)
**Prerequisite:** Phase 11 local MCP validated in production; git-managed `room/`; auth infrastructure decision; re-read MCP session state spec at time of planning
**Avoids:** Pitfall 3 (user data exposure without auth) — never ships without OAuth 2.1; Pitfall 9 (concurrent write conflicts) — git branching as concurrency layer, STATE.md regenerated idempotently on conflict

### Phase Ordering Rationale

- Phase 10 is the single prerequisite for everything: `mindrian-tools.cjs` is the shared truth that guarantees CLI/MCP parity. Building MCP tools before this exists means duplicating logic that will need extraction later.
- Phases 11 and 12 run in parallel: No dependency between MCP server and room sections. Both depend only on Phase 10. Parallel execution compresses the v3.0 timeline.
- Phase 13 after 12: Personas need room content. Opportunity Bank and Funding Room data makes personas meaningfully venture-specific rather than generic.
- Phase 14 as a separate release: Remote access complexity is high enough to constitute a distinct release. Shipping it within v3.0 would extend the timeline and risk the solid foundation established by Phases 10-13.
- This ordering directly mirrors ARCHITECTURE.md's Phase 10-14 build order, which was derived from codebase dependency analysis.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 11 (MCP Server):** Tool decomposition design requires per-command analysis. Each multi-step CLI command must be mapped to its atomic MCP tool equivalents before implementation. The `file-meeting.md` decomposition alone (4-5 tools) is a non-trivial design task. Recommend a pre-phase mapping session covering all 41 commands before writing any tool handler.
- **Phase 14 (Remote Room):** OAuth 2.1 + Resource Indicators (RFC 8707) in MCP context is new territory. The 2026 MCP session state spec is still evolving. Fresh research on the spec state at time of planning is mandatory before any design decisions.
- **Phase 12 (Grant APIs):** Candid API pricing tiers, Grants.gov rate limit handling at scale, and Apify SBIR scraper reliability need validation before building the discovery agent. The free Grants.gov path is well-documented; everything beyond it needs API research at implementation time.

Phases with standard patterns (skip research-phase):

- **Phase 10 (Shared Core):** GSD's `gsd-tools.cjs` is a verified production reference available at `~/.claude/get-shit-done/bin/gsd-tools.cjs`. The pattern is fully documented and proven at 40+ subcommands. No new research needed — replicate what works.
- **Phase 13 (Personas):** De Bono's Six Hats is a mature framework already implemented in `commands/think-hats.md`. PRISM (arXiv 2603.18507) and Mandal (2026) provide clear design principles with no ambiguity about implementation approach. Standard prompt engineering — no research phase needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against npm registry and official SDK docs as of 2026-03-24. Version compatibility confirmed. Only 2 net-new dependencies. Alternatives considered and rejected with clear rationale. |
| Features | MEDIUM | MCP patterns HIGH. Grant API landscape MEDIUM (Grants.gov free tier verified; Candid API pricing not fully validated). Remote Room LOW (MCP session state spec is a 2026 roadmap item, not yet stable). |
| Architecture | HIGH | Based on existing codebase analysis + MCP SDK official docs + GSD production reference. Component boundaries are clear. Build order validated against dependency analysis. Anti-patterns grounded in real plugin code inspection. |
| Pitfalls | MEDIUM | Tool explosion data sourced from community discussions (MEDIUM). Hallucination statistics from 2026 survey (MEDIUM, not peer-reviewed). Auth and concurrency pitfalls sourced from official MCP spec and Sandi Metz — HIGH on those two. |

**Overall confidence:** HIGH for v3.0 scope (Phases 10-13). MEDIUM for Phase 14 (Remote Room) due to evolving MCP spec.

### Gaps to Address

- **MCP session state spec (Phase 14):** The 2026 MCP roadmap lists this as active work. At time of Phase 14 planning, re-read the spec to understand what is finalized. The current design (git-as-concurrency-layer) is a sound fallback regardless of spec evolution, but the official path may be cleaner.
- **Candid API cost model (Phase 12):** Candid's tiered pricing is not fully documented publicly. Needs a pricing conversation with Candid or a test of the free tier to understand viable discovery scope before committing to it as a data source. Start with Grants.gov free tier exclusively; add Candid only when federal grants prove insufficient.
- **Windows path handling for MCP config (Phase 11):** stdio MCP servers on Windows require a `cmd /c` wrapper in `claude_desktop_config.json`. The development environment is Linux (WSL2) and this gap will not surface naturally. Must test on Windows explicitly during Phase 11.
- **Node.js cold start vs. hook timeout (Phase 10):** The 2-3 second hook timeout assumption for Bash scripts needs validation against actual `mindrian-tools.cjs` execution time on a cold Node.js process. If cold start exceeds the budget, hook scripts must stay pure Bash and only call `mindrian-tools.cjs` for non-hook-triggered operations.
- **Brain MCP Tier 0 validation (standing):** PITFALLS.md flags that every Phase 12-13 feature must be tested Brain-disconnected first (Pitfall 14). This is a standing validation requirement. The developer always has Brain connected — this gap will not surface naturally without explicit Tier 0 test runs.

---

## Sources

### Primary (HIGH confidence)
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — v1.27.1 dependencies, peer deps, engine requirements
- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — McpServer API, registerTool with Zod, StdioServerTransport
- [MCP Transports Spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — SSE deprecated, Streamable HTTP standard
- [Grants.gov API](https://www.grants.gov/api) + [API Guide](https://grants.gov/api/api-guide) — free search endpoint, rate limits, JSON structure
- [MCP Authorization Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization) — OAuth 2.1 official guidance
- [MCP Resources Spec](https://modelcontextprotocol.info/docs/concepts/resources/) — read-only, application-controlled distinction from Tools
- [PRISM: Expert Personas (arXiv 2603.18507)](https://arxiv.org/html/2603.18507) — personas improve alignment, damage accuracy on knowledge retrieval
- [PersonaCite (arXiv 2601.22288)](https://arxiv.org/html/2601.22288v1) — personas generated from data vs. templates
- [The Wrong Abstraction — Sandi Metz](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) — premature abstraction costs
- GSD reference implementation (`~/.claude/get-shit-done/bin/gsd-tools.cjs`) — proven CJS single-entry-point pattern, 40+ subcommands, process.argv routing

### Secondary (MEDIUM confidence)
- [Fundsprout: 12 Best Grant Discovery Platforms 2026](https://www.fundsprout.ai/resources/grant-discovery-platforms) — competitive landscape for grant tools
- [MCP Tool Count Discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1251) — ~50 tool practical limit, Cursor 40-tool hard cap
- [Why MCP Tool Overload Happens](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents) — 30-60K token cost data for tool definitions
- [Mandal (2026): Role-Based Agent Personas](https://www.sagarmandal.com/2026/03/15/agentic-engineering-part-3-role-based-agent-personas-why-specialization-beats-generalization/) — coherence cascade pattern, 10-step dependency chain
- [MCP Security Survival Guide](https://towardsdatascience.com/the-mcp-security-survival-guide-best-practices-pitfalls-and-real-world-lessons/) — 492 exposed servers without auth
- [2026 MCP Roadmap](http://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — session state as active work item
- [Specmatic MCP Schema Drift Detector](https://specmatic.io/updates/testing-mcp-servers-how-specmatic-mcp-auto-test-catches-schema-drift-and-automates-regression/) — parity testing approach
- [Cheerio on npm](https://www.npmjs.com/package/cheerio) — v1.2.0, 19,873 dependents, pure JS

### Tertiary (LOW confidence — needs validation)
- [Candid Grants API Developer Portal](https://developer.candid.org/) — exists and documented; pricing tiers not fully validated
- [AI Hallucination Statistics 2026](https://suprmind.ai/hub/insights/ai-hallucination-statistics-research-report-2026/) — domain-specific rates; survey methodology, not peer-reviewed
- [Apify SBIR Grants Scraper](https://apify.com/parseforge/sbir-government-grants-scraper/api) — data quality and freshness not independently verified

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
