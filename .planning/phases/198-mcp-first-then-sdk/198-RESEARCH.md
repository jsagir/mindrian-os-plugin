# Phase 198: MCP-First Invocation Substrate then SDK - Research

**Researched:** 2026-07-09
**Domain:** MCP server substrate (daemon + stdio), per-session room binding, gate-render ladder, thin-plugin adapter, cross-surface parity
**Confidence:** HIGH (verified against vendored SDK source + shipped code at file:line; room evidence cited)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Durable daemon + stdio shim. One long-lived localhost server (the opencode pattern: HTTP + SSE event bus for live segments); stdio clients connect through a thin proxy. Sessions survive terminal restarts; multiple clients (CLI + Desktop) attach to the same server concurrently; the future mindrian-os terminal reconnects to the same brain.
- **D-02:** SEED-039's per-session binding is designed ONCE against the daemon topology (session = a connection with its own binding), not twice.
- **D-03:** Explicit-bind-wins, cwd-default, card-only-on-ambiguity. room_bind tool call wins when made; launching inside a room directory auto-binds silently; the F.7 binding card fires ONCE per session and ONLY when genuinely ambiguous (outside any room, or conflicting signals). Desktop (no meaningful cwd) gets the card once at session start.
- **D-04:** The legacy global `active` field gets a compat shim during transition: reads fall back to it when a session has no binding; writes to it are deprecated and logged. The per-turn binding-card noise (navigator's logged regression) is retired BY DESIGN through this decision.
- **D-05:** Statusline + SessionStart migrate server-side FIRST (lowest risk, most visible payoff). Stop-gate enforcement migrates LAST, and only after server-side gate dedup + relevance machinery exists - the card-misfire regression class must be fixed by the move, never re-created by it.
- **D-06:** "Adapter-only" is a measured budget: hooks/ scripts may wake, query, and render server responses; an import audit (no lib/core business modules from hook scripts) plus a line-count budget enforce it in CI.
- **D-07:** Per-surface flag values: MINDRIAN_MCP_FIRST accepts a surface list (e.g. `cli`, then `cli,desktop`, then `all`). CLI cuts over first on the navigator's own install (dogfood), each surface earns its cutover through its own parity gate + smoke; unset/empty = byte-identical legacy everywhere.

### Claude's Discretion
- Internal server module layout, transport wiring details, zod schema organization, SSE event vocabulary, and test harness structure - within the locked stack (CJS, Node >=22.5, @modelcontextprotocol/sdk ^1.29.0) and the one-chokepoint rule.

### Deferred Ideas (OUT OF SCOPE)
- Warp-as-channel (Mindrian as agent inside Warp's harness) - parked with fork F8 triggers (room file 04-warp-teardown.md)
- MCP experimental tasks API (callToolStream/getTaskResult) for long-run resume - revisit when the API stabilizes; opencode session-store pattern meanwhile
- Hub-level site licenses / sprint motion - GTM track, runs in parallel, never blocks this phase
- Terminal v1 (oclif + Ink), Gemini/Codex adapters, npm SDK packaging, eureka generator/critic internals (all named OUT of scope in SPEC).
</user_constraints>

<phase_requirements>
## Phase Requirements

The SPEC locks 8 requirements (no separate REQ-ID registry exists for 198; the SPEC numbering is authoritative - referenced here as SPEC-1..SPEC-8).

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEC-1 | SEED-039 per-session room binding (prerequisite): sessions carry their own binding; global active-room race impossible | **CORRECTION section below** - Phase 194 SHIPPED all four pillars as tested primitives; the MCP daemon does NOT consume them. This is a WIRE-AND-CONSUME task, not a BUILD. |
| SPEC-2 | Versioned mindrian-core server contract split by trust boundary | `bin/mindrian-mcp-server.cjs` + `lib/mcp/tool-router.cjs` (9 grouped tools, 64 commands) are the seam; add contract-version tool + per-tool zod; new tools each need a connector-registry + HITL-shape entry (Part 11) |
| SPEC-3 | Server-side chain execution honoring postures (chain_run halts at first material step) | `lib/core/chain-executor.cjs` runChain (Phase 166) already halts-at-material in-process; wrap it as a tool, join postures from connector registry |
| SPEC-4 | Gate superset schema + renderer ladder (elicitation / thin-adapter card / structured text) | SDK 1.29.0 `server.elicitInput()` exists but is lossy (titles/enumNames only, no per-option descriptions); superset carries descriptions/ranks/previews app-side; renderers compose from `lib/hmi/shape-f*-renderer.cjs` + `selector-dispatcher.cjs` |
| SPEC-5 | Thin-plugin adapter (hooks carry zero business logic) | `scripts/statusline-mos-dispatch` is the shipped "zero logic by design" precedent to generalize; measured by import audit + line-count budget (D-06) |
| SPEC-6 | Surface parity test (same session on CLI + one non-Anthropic MCP host) | VS Code elicitation-capable; parity = identical typed graph writes (node/edge diff empty) + identical gate sequence |
| SPEC-7 | Reversibility contract (one flag OFF-default, additive commits, snapshots, rehearsed rollback) | MINDRIAN_MCP_FIRST does NOT exist yet (greenfield); heal-command backup + migration-snapshot ledger are the shipped precedents |
| SPEC-8 | Plurai eval gate (one-path invocation parity judge) | `scripts/189-plurai-gate-check.cjs` is the reusable gate pattern; `evals/plurai/*.csv` baselines from Phase 196/189 |
</phase_requirements>

## Summary

Phase 198 collapses the governed invocation spine onto ONE MCP substrate. The load-bearing runtime (`lib/core/navigation.cjs`, `command-resolver.cjs`, `chain-executor.cjs`, registries) is already engine-agnostic and already reachable through two shipped MCP servers - so this phase WRAPS and CONSUMES, it does not rebuild. The single biggest correction to the incoming record: SEED-039 is NOT unbuilt. Phase 194 (2026-07-01) shipped all four pillars as tested, consumer-free primitives wired into the CLI hook path. The gap is that the MCP server never consumes them - it freezes `roomDir` at startup (`bin/mindrian-mcp-server.cjs:65`) and, when it does re-resolve per write, calls the RACY global `resolveActiveRoom` (`lib/mcp/tool-router.cjs:59-66`), not the session-aware `resolveWriteRoom` Phase 194 built. SPEC-1 is therefore a WIRE-AND-CONSUME task against a daemon that also needs real per-connection session identity (the current HTTP transport is stateless: `sessionIdGenerator: undefined`, line 163).

The daemon topology (D-01) is largely greenfield on top of the current single-shot server: there is no pidfile, no port discovery, no crash recovery, no reconnect, and no SSE event bus today - port 3847 is hardcoded and the server exits with its client. The stack to build it is fully vendored (`@modelcontextprotocol/sdk` 1.29.0, `zod` 3.25.76, `express`) with both `StreamableHTTPServerTransport` and `StdioServerTransport` present, and server-side `elicitInput()` confirmed in the SDK - so the gate renderer ladder's elicitation rung is real, just lossy (per-option descriptions travel app-side in Mindrian's superset). The thin-adapter target already has a shipped exemplar: `scripts/statusline-mos-dispatch` is a "zero logic by design" shim, exactly the shape SPEC-5 generalizes to SessionStart and the statusline.

**Primary recommendation:** Sequence the phase as the SPEC already implies - Plan 1 WIRES the shipped SEED-039 primitives into the MCP daemon by threading a per-connection sessionId into `resolveWriteRoom` and stamping every tool call with its session's binding; only THEN build the versioned contract, the gate ladder, the thin adapter (statusline/SessionStart first, Stop-gate last per D-05), and the parity + Plurai gates. Never mint a second resolver, a second executor, or a second selection brain (Canon Part 11 R4); wrap `navigation.cjs`, `command-resolver.cjs`, `chain-executor.cjs`, `resolve-active-room.cjs` as-is.

---

## PRIORITY-ONE CORRECTION: SEED-039 is BUILT (as primitives), UNCONSUMED (by the MCP daemon)

> This section corrects stream 03's SEED-039 claim in the room evidence (`~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/03-migration-map.md`), which the prior researcher flagged as reading "SEED-039 UNBUILT." That framing is **wrong for the primitives and right only for the MCP consumption path.** The distinction changes SPEC-1 from a BUILD to a WIRE-AND-CONSUME.

### (a) Which of SEED-039's four pillars exist today?

Phase 194 (`.planning/phases/194-per-session-room-binding/`, VERIFICATION verdict PASSED 2026-07-01, `bash tests/run-all-194.sh` 14/0/0) shipped **all four pillars** as tested CJS primitives:

| SEED-039 Pillar | Shipped Artifact (file:line) | Status | Provenance |
|-----------------|------------------------------|--------|------------|
| **P1 - Per-session binding SET + primary + sticky** | `lib/core/session-binding.cjs` (`readSessionBinding`/`writeSessionBinding` over `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sid>.json`; atomic, corruption-safe, `..`-traversal guarded) | BUILT + tested | [VERIFIED: 194-02-SUMMARY.md, git 50d5ea37] |
| **P2 - Tripwire graduates to F.8 binding gate** | `lib/workflow/session-binding-consumer.cjs` (`runBindingGate`/`consumeSessionBinding`); `resolveSessionScope` in `resolve-active-room.cjs:266`; F.8 renderer `lib/hmi/shape-f8-renderer.cjs` | BUILT + tested | [VERIFIED: 194-04-SUMMARY, git 70b53cc8/03806baf] |
| **P3 - Write-guard set-membership (not single-equality)** | `scripts/write-scope-check.cjs` flipped to `isRoomInWriteScope` + `readSessionBinding`; wired into the hook block decision | BUILT + tested (near-miss caught: predicate was committed unwired, then wired in git 4a005baa) | [VERIFIED: 194-05-SUMMARY, 194-VERIFICATION.md] |
| **P4 - navigation.cjs reconcile events (lost-update)** | `reconcile-guard` `checkLostUpdate` on `last_modified_at` CAS token; F.9 gate adapter `lib/hmi/shape-f9-renderer.cjs`; the CAS token was first repaired across 4 read-merge-write UPDATE sites | BUILT + tested | [VERIFIED: 194-06-SUMMARY, git 5633aae4/5c068802/c788c19f] |

Supporting spine (per-room presence ledger + doctor cadence) also shipped: `lib/core/session-presence.cjs` (`registerPresence`/`hasCoSession`/`reapStalePresence`) + `doctor --bind-check`. Requirement coverage PSB-01..16 all satisfied. [VERIFIED: 194-VERIFICATION.md]

**Nuance the room evidence missed:** Phase 194 named the gates F.8/F.9 (SEED-039 called them "F.7"). This is a naming drift, not a missing pillar - the F.7 label in SPEC-4/D-03 refers to the same binding gate that shipped as F.8. Do not double-build.

### (b) Does `bin/mindrian-mcp-server.cjs` consume the session binding, or still freeze roomDir at startup?

**It still freezes roomDir, and it never touches session binding.** Three concrete facts:

1. **Boot-frozen roomDir.** `bin/mindrian-mcp-server.cjs:65`:
   `const roomDir = path.resolve(process.env.MINDRIAN_ROOM || './room');`
   That `roomDir` is closed over into every tool at line 88 (`registerRouterTools(server, roomDir, ...)`), resources (129), prompts (133), capabilities (136). A long-lived server serving multiple hosts is frozen to one room from spawn.

2. **The one per-call re-resolution it DOES have uses the RACY global field, not the session binding.** `lib/mcp/tool-router.cjs:38-66` added (todo `2026-07-06-room-content-file-opportunity-misroutes-active-room`) a `resolveWriteTargetDir(fallbackRoomDir)` that per write call calls `resolveActiveRoom()` - the SINGLE GLOBAL `reg.active` field that SEED-039 exists to demote. It does NOT call `resolveWriteRoom({sessionId})` (the session-aware precedence Phase 194 shipped at `resolve-active-room.cjs:201`). So the MCP write path is exactly the race SEED-039 kills for the hook path, still live.

3. **No per-connection session identity exists.** The HTTP transport is created stateless: `bin/mindrian-mcp-server.cjs:163` `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`. There is no MCP session id per client connection to key a binding on. `resolveWriteRoom` needs a `sessionId`; the daemon has none to give it.

### (c) Verdict for Phase 198's first plan

**WIRE-AND-CONSUME (primitives shipped and tested; the MCP daemon does not consume them).**

Plan 1 does NOT rebuild session-binding, the F.8 gate, the write guard, or the reconcile guard. It:
1. Gives the daemon real per-connection session identity (set `sessionIdGenerator` to a real generator; map each MCP connection/transport session to a `sessionId` key).
2. Threads that `sessionId` into every tool handler so writes call `resolveWriteRoom({ filePath, sessionId, home })` (`resolve-active-room.cjs:201`) instead of the frozen `roomDir` or the global `resolveActiveRoom` (`tool-router.cjs:61`).
3. Adds `room_bind` as the daemon front door writing `writeSessionBinding` (D-03 precedence: explicit bind > cwd auto-bind > F.8 card on ambiguity).
4. Applies the D-04 compat shim: reads fall back to `reg.active` only for a binding-less session; writes to `reg.active` are deprecated + logged.
5. Reuses the shipped concurrency integration test (`tests/test-194-concurrency-integration.test.cjs`) as the shape for the SPEC-1 two-session acceptance test, now driven through the MCP tool surface.

**D-02 is the design pin:** Phase 194's `sessionId` came from the hook path (`intent-classifier.cjs resolveSessionId`). The daemon's session is an MCP connection. Design the mapping ONCE so a connection's session id IS the binding key - do not create a second session namespace.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-session room binding | mindrian-core daemon (API) | Client (passes session id) | Binding must survive the connection; the daemon owns the session->room map (SPEC-1) |
| Graph read/write | mindrian-core, via `navigation.cjs` chokepoint | - | Part 9: one SQL chokepoint; graph_write wraps it, nothing bypasses (SPEC-2) |
| Chain composition + execution | mindrian-core (server-side runChain) | - | Part 11: execution unifies on the substrate; postures honored server-side (SPEC-3) |
| Gate composition (superset schema) | mindrian-core (gate_render) | - | One card schema independent of host; server emits, host renders |
| Gate rendering | Client tier (renderer ladder) | mindrian-core (structured-text fallback) | Elicitation on capable clients; AskUserQuestion inside Claude Code; text for headless (SPEC-4) |
| Statusline / SessionStart | Client hook (thin adapter) | mindrian-core (data) | D-05/D-06: hooks wake + render only; business logic server-side (SPEC-5) |
| Stop-gate enforcement | mindrian-core (dedup + relevance) | Client hook (render) | D-05: migrates LAST, after server-side dedup exists |
| Brain enrichment | mindrian-brain remote proxy | - | Part 8: schema accepts NO room content; generic handles only |
| Spend/cap visibility | mindrian-core (status_read segment) | Client statusline | First-class segment from day one (the Warp lesson) |

---

## Standard Stack

### Core (ALL VENDORED - zero new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.29.0 (vendored) | McpServer, StdioServerTransport, StreamableHTTPServerTransport, `server.elicitInput()` | The one MCP substrate; both transports on one McpServer instance [VERIFIED: node_modules/@modelcontextprotocol/sdk/package.json = 1.29.0] |
| `zod` | 3.25.76 (vendored) | Per-tool input schemas; elicitation response validation | Required by the SDK; already the tool-router's validation layer [VERIFIED: package.json] |
| `express` | (vendored, lazy-required) | HTTP host for the durable daemon (`app.all('/mcp')`) | Already used for the Cowork HTTP transport [VERIFIED: bin/mindrian-mcp-server.cjs:149] |
| Node.js CJS core | Node >=22.5.0 | `lib/core/*.cjs` shared by CLI + server | The engine-agnostic runtime; CJS-only house rule |

### Supporting (shipped runtime being WRAPPED - Canon Part 7, never rebuilt)
| Library / Module | Purpose | When to Use |
|------------------|---------|-------------|
| `lib/core/navigation.cjs` | THE single SQL graph chokepoint | graph_write/memory_event wrap this; nothing writes around it (Part 9) |
| `lib/core/resolve-active-room.cjs` | `resolveWriteRoom` / `resolveSessionScope` (session-aware, PSB-02/03) | The daemon calls these instead of the frozen roomDir / global `resolveActiveRoom` |
| `lib/core/session-binding.cjs` | `readSessionBinding` / `writeSessionBinding` | room_bind writes here; every tool resolves its room from here |
| `lib/core/chain-executor.cjs` | `runChain` (Phase 166, halts-at-material) | chain_run wraps this server-side |
| `lib/workflow/command-resolver.cjs` | `composeWorkflow` / the one governed reach path | chain_resolve wraps this; do NOT mint a second resolver (R4) |
| `lib/mcp/tool-router.cjs` | 9 grouped tools -> 64 commands | The existing tool surface to version + extend |
| `lib/hmi/selector-dispatcher.cjs` + `shape-f1..f9-renderer.cjs` | Gate composition + shape renderers | gate_render's superset composes from these; F.8=binding, F.9=reconcile |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Durable daemon (D-01) | Spawn-per-client stdio (today's model) | REJECTED by D-01: no shared state across clients, roomDir frozen per spawn, no reconnect; the disease this phase cures |
| Real MCP elicitation for gates | Elicitation-only | REJECTED: only ~13/101 clients implement it; Claude Code + Desktop do NOT (issue #2799) - hence the 3-renderer ladder [CITED: room stream 05, 01] |
| A second resolver for the daemon | resolveWriteRoom reuse | FORBIDDEN by Part 11 R4 + SEED-034 "four guessers" lesson - one reader only |

**Installation:** None. `@modelcontextprotocol/sdk` 1.29.0, `zod` 3.25.76, `express` are all vendored (verified in `node_modules/`). Node >=22.5 required (`package.json engines`).

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every dependency (SDK, zod, express, sqlite-vec, transformers) is already vendored and in production use. The Package Legitimacy Gate is therefore N/A - there is nothing to slopcheck. Disposition for all: pre-existing, in-tree, no action.

If a plan later proposes ANY new install, it must run the Package Legitimacy Gate before install and gate it behind a `checkpoint:human-verify` task (the local-testing-only + release.sh-is-the-only-door rule already forbids silent additions to the user surface).

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────────────────────────────────────┐
   Claude Code CLI ──┤ stdio shim (thin proxy) ─┐                    │
   Claude Desktop  ──┤ stdio shim ──────────────┤                    │
   VS Code (parity)──┤ StreamableHTTP ───────────┼──> mindrian-core  │
   future terminal ──┤ StreamableHTTP + SSE ─────┘    DURABLE DAEMON │
                     └────────────────────────────────┐  127.0.0.1  │
                                                       │  (pidfile,   │
   per connection ──> sessionId ──> session binding ──┤   port disc.) │
                                                       │              │
   TOOL SURFACE (versioned contract, zod per tool):    │              │
     room_bind/list/state/search ──> session-binding.cjs + resolveWriteRoom
     graph_query/graph_write/memory_event ──> navigation.cjs (Part 9 chokepoint)
     chain_resolve ──> command-resolver.composeWorkflow
     chain_run ──> chain-executor.runChain ──halt@material──> gate_render
     gate_render ──> superset schema ──┐
                                        ├─(a) elicitInput()  [capable clients]
                                        ├─(b) AskUserQuestion [Claude Code adapter]
                                        └─(c) structured text [headless]
     gate_answer ──ratify──> navigation.cjs write
     suggest_next/reach_candidates/contradiction_check/whitespace_scan (sensors as pull)
     artifact_file/view_compile/status_read (incl. spend/cap segment)
                                                       │              │
   mindrian-brain (remote proxy, read-only) <─────────┘  Part 8: schema accepts
     brain_ask/brain_search/brain_schema                 NO room content
```

Data flow to trace (the parity transcript, SPEC-6): client connects -> gets sessionId -> room_bind (or cwd auto-bind) writes session binding -> reach card via gate_render (renderer ladder) -> chain_run executes autonomous_safe prefix, HALTS at first material step returning a gate -> gate_answer approve -> the material write lands through navigation.cjs stamped with THIS session's room -> artifact filed. The same transcript on CLI and VS Code must produce an empty node/edge diff and an identical gate sequence.

### Recommended Server Module Layout (Claude's discretion - within one-chokepoint rule)
```
bin/
├── mindrian-mcp-server.cjs   # EXISTING - becomes/spawns the durable daemon
└── mindrian-mcp-shim.cjs     # NEW - stdio->HTTP thin proxy (opencode pattern)
lib/mcp/
├── tool-router.cjs           # EXISTING 9 tools - extend + version, do not fork
├── daemon-lifecycle.cjs      # NEW - pidfile, port discovery, crash recovery
├── session-registry.cjs      # NEW - MCP connection <-> sessionId <-> binding
├── gate-render.cjs           # NEW - superset schema + 3-renderer ladder
└── contract-version.cjs      # NEW - semver tool for SPEC-2
```

### Pattern 1: Per-connection session identity feeding resolveWriteRoom
**What:** Every MCP connection gets a stable sessionId; every write tool resolves its room from that session's binding.
**When to use:** SPEC-1, the first plan.
```javascript
// Replace tool-router.cjs:59-66 resolveWriteTargetDir (which uses the RACY global
// resolveActiveRoom) with the session-aware precedence Phase 194 already shipped:
const { resolveWriteRoom } = require('../core/resolve-active-room.cjs'); // :201
function resolveWriteTargetDir(sessionId, fallbackRoomDir) {
  try {
    const r = resolveWriteRoom({ sessionId, home: process.env.MINDRIAN_ROOMS_HOME });
    return (r && r.abs_path) || fallbackRoomDir; // D-04 compat: reg.active is leg 3 inside
  } catch (_e) { return fallbackRoomDir; }
}
// sessionId comes from the daemon's session-registry, keyed on the MCP connection.
```

### Pattern 2: Durable daemon with real session ids (fixes the stateless transport)
**What:** Give the HTTP transport a real sessionIdGenerator so concurrent clients get distinct sessions.
```javascript
// bin/mindrian-mcp-server.cjs:163 today: sessionIdGenerator: undefined (stateless).
// Durable daemon needs per-connection sessions:
const { randomUUID } = require('node:crypto');
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),        // real per-connection sessions
  onsessioninitialized: (sid) => sessionRegistry.open(sid),
  onsessionclosed:      (sid) => sessionRegistry.close(sid), // deregisterPresence
});
// Source: @modelcontextprotocol/sdk 1.29.0 StreamableHTTPServerTransport (vendored)
```

### Pattern 3: Gate renderer ladder (superset schema, lossy elicitation)
**What:** One superset card; capability detection picks the renderer.
```javascript
// SDK 1.29.0 elicitInput requestedSchema supports enum + enumNames (titles) + a
// field-level description, but NO per-option descriptions/ranks/previews. The
// superset carries those app-side; elicitation is the LOSSY rung.
// Source: node_modules/@modelcontextprotocol/sdk types.d.ts ElicitRequestFormParamsSchema
if (clientDeclaresElicitation) {
  await server.server.elicitInput({ message, requestedSchema }); // (a) lossy
} else if (insideClaudeCode) {
  renderAskUserQuestion(supersetCard);                           // (b) full via adapter
} else {
  emitStructuredTextThenNextMessage(supersetCard);              // (c) headless
}
// All three MUST return an identical gate_answer payload (SPEC-4 acceptance).
```

### Pattern 4: Thin adapter (generalize the statusline shim)
**What:** `scripts/statusline-mos-dispatch` is already "DEPLOYED SHIM. DO NOT EDIT. Zero logic by design." Generalize that shape: hook -> wake daemon -> HTTP query -> render. SessionStart + statusline FIRST (D-05).

### Anti-Patterns to Avoid
- **Second resolver / second executor / second selection brain** (Part 11 R4): wrap `resolveWriteRoom`, `runChain`, `composeWorkflow`; never re-implement.
- **Writing room.db outside navigation.cjs** (Part 9 breach): every graph_write routes through the chokepoint.
- **Any room content in a brain_* tool schema** (Part 8 breach): the brain proxy schema accepts generic handles only, enforced by the contract not by behavior.
- **Re-freezing roomDir** anywhere in the daemon: the whole point is per-session resolution.
- **Re-creating the per-turn binding-card noise** (D-04/D-05): the F.8 card fires ONCE per session, only on genuine ambiguity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session->room resolution | A new active-room resolver | `resolveWriteRoom` (resolve-active-room.cjs:201) | SEED-034 "four guessers" bug; one-reader rule (D-02) |
| Per-session binding file | A new session store | `session-binding.cjs` (shipped, atomic, tested) | Phase 194 already did it; consumer-free by design |
| Chain halt-at-material | A new posture engine | `chain-executor.runChain` (Phase 166) | Halt semantics already exist in-process |
| Lost-update reconcile | A new CAS/version scheme | `reconcile-guard checkLostUpdate` on `last_modified_at` | Phase 194 shipped it + repaired the 4 bypassing UPDATE sites |
| Gate shapes | New card renderers | `shape-f1..f9-renderer.cjs` + `selector-dispatcher.cjs` | 307-file AskUserQuestion surface collapses onto these |
| Plurai gate | A new eval judge | `scripts/189-plurai-gate-check.cjs` pattern + `evals/plurai/*.csv` | Reusable baseline-parity gate already shipped |
| Born-wired check | Manual tool registration audit | `scripts/build-connector-registry.cjs --check` + `check-shape-declaration.cjs` | Regenerates in memory, exits 1 on drift (Part 11) |
| Statusline thin adapter | New shim logic | Generalize `scripts/statusline-mos-dispatch` | Already "zero logic by design" |
| Migration backup | New snapshot code | heal-command backup + migration-snapshot ledger | The reversibility precedents SPEC-7 names |

**Key insight:** ~78.5% of the repo is engine-agnostic and the invocation-critical modules are 100% grep-clean of Claude-Code imports (stream 03). This phase is almost entirely composition. The net-new code is the daemon lifecycle (pidfile/port/reconnect/SSE), the session registry, the gate-render ladder, the versioned contract wrapper, and the parity + Plurai harnesses - everything else is wiring shipped modules through the substrate.

## Runtime State Inventory

> This is a substrate-migration phase (per-session binding + daemon topology + flag cutover). Runtime state matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `$MINDRIAN_ROOMS_HOME/.rooms/registry.json` global `active` field (the race source); per-session binding files `.rooms/sessions/<sid>.json` (Phase 194 format); per-room presence ledger `<room>/.mindrian/sessions/<sid>.json`; `room.db` per room with `last_modified_at` CAS tokens | D-04 compat shim on `reg.active` (read-fallback, write-deprecate+log); daemon must key bindings on the SAME session-file format Phase 194 wrote - do NOT introduce a second session namespace (D-02). room.db changes expand-only (SPEC-7). |
| **Live service config** | The MCP server: no pidfile, no port registry today; port 3847 hardcoded (`bin/mindrian-mcp-server.cjs:169`). Claude Desktop config points at `bin/mindrian-mcp-server.cjs` via stdio with a per-config `MINDRIAN_ROOM` env (the frozen room). `.mcp.json` / settings register the server. | Daemon needs a pidfile + port discovery so stdio shims + HTTP clients find the SAME server; the frozen `MINDRIAN_ROOM` env stops being authoritative once per-session binding lands. |
| **OS-registered state** | Statusline deployed shim at `~/.claude/statusline-mos` (copied by session-start, resolves active plugin at runtime); `~/.claude/settings.json` statusLine command | None for rename; the thin-adapter migration REUSES this runtime-resolving shim - do not re-stamp its form. |
| **Secrets/env vars** | `MINDRIAN_MCP_FIRST` does NOT exist yet (greenfield flag); `MINDRIAN_ROOM`, `CLAUDE_ACTIVE_ROOM`, `MINDRIAN_ROOMS_HOME`, `MINDRIAN_TRANSPORT` read across bin/lib/scripts | Introduce `MINDRIAN_MCP_FIRST` as an OFF-default per-surface list (D-07); unset/empty = byte-identical legacy. Establish where it is read (single flag-reader module recommended). |
| **Build artifacts** | Connector registry JSON + orchestration projection (regenerated by `build-connector-registry.cjs`/`build-orchestration-projection.cjs`); vendored `node_modules` (SDK/zod already present) | Each NEW tool (room_bind, gate_render, chain_run, etc.) requires a connector-registry entry + HITL-shape declaration; `--check` must regenerate CLEAN before commit (Part 11 born-wired). |

**Explicitly nothing found:** No Windows Task Scheduler / launchd / systemd registration for the MCP server (verified: only hardcoded port 3847, no pidfile/daemon references in scripts/lib/bin). No cross-machine registry. No SOPS/keyring dependency for this phase.

## Common Pitfalls

### Pitfall 1: Treating SEED-039 as unbuilt
**What goes wrong:** Re-building session-binding / F.8 gate / write-guard / reconcile-guard that Phase 194 already shipped and tested.
**Why it happens:** Room stream 03 reads "SEED-039 UNBUILT"; the naming drift (F.7 in seed vs F.8/F.9 shipped) hides the match.
**How to avoid:** Consume the primitives (see CORRECTION). SPEC-1 is WIRE-AND-CONSUME. Grep `lib/core/session-binding.cjs` and `resolve-active-room.cjs:201` before writing any binding code.
**Warning signs:** A plan task that creates a new session file format or a new active-room resolver.

### Pitfall 2: The daemon writes to the wrong room (the live 2026-07-08 defect, re-created)
**What goes wrong:** A tool resolves `roomDir` from the boot closure or from the global `resolveActiveRoom`, so a concurrent session's write lands in a stale room.
**Why it happens:** `bin/mindrian-mcp-server.cjs:65` freezes roomDir; `tool-router.cjs:61` re-resolves via the RACY global field, not the session binding.
**How to avoid:** Thread sessionId into every write handler; call `resolveWriteRoom({sessionId})`. The SPEC-1 two-session concurrent-write test IS the guard.
**Warning signs:** Any tool handler using the closure `roomDir` for a WRITE, or calling `resolveActiveRoom()` instead of `resolveWriteRoom()`.

### Pitfall 3: Stateless transport = no session identity
**What goes wrong:** With `sessionIdGenerator: undefined` (current line 163), concurrent HTTP clients share one anonymous session - bindings collide.
**How to avoid:** Set a real `sessionIdGenerator` and register/deregister sessions on connect/close (Pattern 2).
**Warning signs:** Two clients see each other's binding; presence ledger has one entry for N clients.

### Pitfall 4: Expecting elicitation to carry the full card
**What goes wrong:** Per-option descriptions/ranks/previews vanish because MCP elicitation only carries enum + enumNames (titles).
**Why it happens:** SDK supports `elicitInput` but the schema is primitive; and Claude Code/Desktop do not implement the client capability at all.
**How to avoid:** Superset schema is Mindrian's own; elicitation is the lossy rung (a); AskUserQuestion (b) carries the full card inside Claude Code. [CITED: room stream 05; VERIFIED: SDK types.d.ts]
**Warning signs:** Gate answers differ across renderers; the SPEC-4 identical-payload acceptance fails.

### Pitfall 5: Business logic creeping back into hooks
**What goes wrong:** The thin adapter imports a `lib/core` business module, re-fattening the plugin.
**How to avoid:** The D-06 import audit + line-count budget in CI; hooks may only wake/query/render.
**Warning signs:** A `require('../lib/core/...')` business import inside a hook script; hook line count climbs.

### Pitfall 6: A new tool ships un-wired (Part 11 born-wired breach)
**What goes wrong:** room_bind/gate_render/chain_run added without a connector-registry entry + HITL-shape declaration; `--check` goes red.
**How to avoid:** Every new tool declares its connector + `hitl_shape`/`hitl_why`; run `build-connector-registry.cjs --check` + `check-shape-declaration.cjs` before commit.
**Warning signs:** `--check` exits 1 on stale JSON; doctor --acceptance red.

### Pitfall 7: Stop-gate migrated before server-side dedup exists (D-05 violation)
**What goes wrong:** Moving Stop-gate enforcement early re-creates the card-misfire regression class server-side.
**How to avoid:** Statusline + SessionStart first; Stop-gate LAST, only after gate dedup + relevance machinery exists.
**Warning signs:** A plan sequences Stop-gate before the dedup machinery.

## Code Examples

### Verify SEED-039 primitives are present before planning Plan 1
```bash
# All should exist (Phase 194); if any missing, escalate:
grep -n "resolveWriteRoom\|resolveSessionScope" lib/core/resolve-active-room.cjs   # :201 :266
grep -n "readSessionBinding\|writeSessionBinding" lib/core/session-binding.cjs
grep -n "checkLostUpdate\|last_modified_at" lib/core/navigation.cjs
bash tests/run-all-194.sh   # expect 14/0/0
```

### Plurai gate pattern to clone for SPEC-8
```javascript
// scripts/189-plurai-gate-check.cjs is the template: load evals/plurai/<phase>-baseline.json,
// reconstruct the fixture candidate_set, call the renderer, assert membership == baseline
// verdict, print <GATE>_OK + exit 0 on match, diff + exit 1 on mismatch. The 198 suite
// scores invocation parity across CLI + one MCP host against the transcript corpus.
// Source: scripts/189-plurai-gate-check.cjs (verified in-tree)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spawn-per-client stdio MCP, roomDir frozen at boot | Durable localhost daemon, per-connection sessions, reconnecting clients | This phase (D-01) | Shared state; roomless race dies; terminal reconnects later |
| Global `reg.active` single mutable room | Per-session binding set + primary + sticky | Phase 194 (primitives); THIS phase (MCP consumes) | The 2026-07-08 stale-write defect becomes impossible |
| Two execution paths (CLI hooks vs MCP) over one core | One MCP execution substrate | This phase (SEED-038) | One governed path sensor-to-side-effect (Part 11) |
| Host-specific AskUserQuestion card (307 files) | Gate superset schema + renderer ladder | This phase (SPEC-4) | Same gate on any MCP host |
| Fat hooks (~39 scripts, 10 event types, business logic) | Thin adapter (wake + render only) | This phase (D-05/D-06) | Dual-maintenance disappears when the adapter stays thin |

**Deprecated/outdated in the incoming record:**
- Room stream 03 "SEED-039 UNBUILT": corrected above - primitives shipped in Phase 194; only MCP consumption is missing.
- Room stream 05 "MCP TS SDK v1.20 elicitation": the vendored SDK is 1.29.0 and DOES expose server-side `elicitInput`; the lossy-schema and client-sparsity conclusions still hold. [VERIFIED: package.json]
- SEED-038 frontmatter "promoted_to: Phase 188": stale - CONTEXT.md notes the real graduation is Phase 198.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The MCP connection's session id can serve as the Phase-194 binding key without a second namespace (D-02 achievable as designed) | CORRECTION (c), Pattern 1/2 | If the hook-derived sessionId and MCP-connection sessionId cannot be unified, Plan 1 needs a mapping layer - still WIRE, not BUILD, but more surface |
| A2 | Claude Code + Desktop still do NOT implement the elicitation CLIENT capability (issue #2799 open) | Pitfall 4, SPEC-4 | If Claude Code shipped elicitation since the room evidence (2026-07-08), renderer (b) could narrow - verify at plan time; the ladder still needs (c) for headless |
| A3 | `express` is vendored and importable (lazy-required today) | Standard Stack | If absent in a fresh cache, the mcp-dep-heal self-install covers it; low risk |
| A4 | No OS-level daemon registration exists to migrate (no systemd/launchd/Task Scheduler) | Runtime State Inventory | If a machine-specific daemon wrapper exists outside the repo, port/pidfile design must account for it |
| A5 | The 8 SPEC requirements are the authoritative working set (no separate REQ-ID registry for 198) | Phase Requirements | If REQUIREMENTS.md gains 198 IDs before planning, map SPEC-1..8 to them |

## Open Questions

1. **MCP connection session <-> Phase-194 sessionId unification (D-02)**
   - What we know: Phase 194 sessions come from `intent-classifier.resolveSessionId` (hook path); the daemon's session is an MCP connection; the binding file is keyed on a sessionId string.
   - What's unclear: whether the daemon can derive/accept the same sessionId a hook would, so a CLI session and its MCP daemon connection share ONE binding.
   - Recommendation: design the session-registry mapping in Plan 1 as the D-02 pin; a stdio shim can pass the hook sessionId through as the connection key.

2. **Elicitation client capability status as of plan time (A2)**
   - What we know: room evidence (2026-07-08) says Claude Code does not implement it (issue #2799).
   - Recommendation: re-check at plan time via the client's declared capabilities; keep the ladder regardless (headless clients need (c)).

3. **SSE event bus vocabulary (Claude's discretion)**
   - What we know: D-01 wants an SSE `/event` bus for live statusline segments (opencode pattern); none exists today.
   - Recommendation: define a minimal event set (status segment, gate-fired, reconcile-raised) in the daemon plan; keep it additive.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | ✓ (assumed dev machine) | >=22.5 required | none - hard requirement |
| `@modelcontextprotocol/sdk` | daemon + tools | ✓ vendored | 1.29.0 | mcp-dep-heal self-install |
| `zod` | tool schemas | ✓ vendored | 3.25.76 | mcp-dep-heal |
| `express` | HTTP daemon | ✓ vendored (lazy) | - | stdio-only fallback already coded (line 151) |
| MCP Inspector | SPEC-2 tool validation | ✗ (external, npx) | - | manual JSON-RPC probe |
| VS Code (elicitation-capable host) | SPEC-6 parity | ✗ on this machine (assumed) | v1.102+ needed | any elicitation-capable client (MCP Inspector) |

**Missing with fallback:** MCP Inspector and VS Code are test-time hosts, not build deps - a plan can substitute any elicitation-capable client for the parity leg.
**Missing, blocking:** none for the build; the parity host (SPEC-6) is a test-execution dependency the navigator supplies locally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `assert` + bash aggregators (`tests/run-all-<phase>.sh`, SKIP-safe run/run_if) |
| Config file | none - convention-based (`tests/*.test.cjs` + `tests/run-all-*.sh`) |
| Quick run command | `node tests/test-<name>.test.cjs` (single file) |
| Full suite command | `bash tests/run-all-198.sh` (Wave 0 creates it, cloned from run-all-194.sh) |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SPEC-1 | Two concurrent sessions, interleaved writes each land in own room; 2026-07-08 failure reproduced-then-impossible | integration | `node tests/test-198-concurrency-mcp.test.cjs` | ❌ Wave 0 (clone `test-194-concurrency-integration.test.cjs`) |
| SPEC-2 | contract-version returns semver; every tool schema-valid | integration | `node tests/test-198-contract-schema.test.cjs` | ❌ Wave 0 |
| SPEC-2 | graph write around navigation.cjs rejected | unit | `node tests/test-198-chokepoint-guard.test.cjs` | ❌ Wave 0 |
| SPEC-3 | 2 safe + 1 material chain halts, returns gate, executes only after approve | integration | `node tests/test-198-chain-run-halt.test.cjs` | ❌ Wave 0 |
| SPEC-4 | same gate -> identical gate_answer via 3 renderers | integration | `node tests/test-198-gate-renderers.test.cjs` | ❌ Wave 0 |
| SPEC-5 | hooks/ adapter-only (import audit + line budget) | unit | `node tests/test-198-adapter-budget.test.cjs` | ❌ Wave 0 |
| SPEC-6 | identical graph writes + gate sequence CLI vs VS Code | integration/manual | `bash tests/parity-198.sh` (scripted transcript) | ❌ Wave 0 |
| SPEC-7 | flag OFF = byte-identical legacy; rollback rehearsal green | integration | `node tests/test-198-flag-off-parity.test.cjs` | ❌ Wave 0 |
| SPEC-8 | 198 Plurai baseline passes | gate | `node scripts/198-plurai-gate-check.cjs` (clone 189) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single new test file for the task + `node scripts/build-connector-registry.cjs --check` (born-wired stays clean).
- **Per wave merge:** `bash tests/run-all-198.sh` + the plugin-behavior smoke with flag OFF (SPEC-7 byte-identical guard).
- **Phase gate:** full 198 suite + parity transcript on two hosts + `node scripts/198-plurai-gate-check.cjs` + `node scripts/doctor.cjs --acceptance` all green.

### Wave 0 Gaps
- [ ] `tests/run-all-198.sh` - SKIP-safe aggregator (clone run-all-194.sh)
- [ ] All 9 test files above - SKIP-safe stubs, each run_if-gated on the module its wave lands
- [ ] `tests/test-198-concurrency-mcp.test.cjs` - clone the shipped `test-194-concurrency-integration.test.cjs` and drive it through the MCP tool surface
- [ ] `evals/plurai/198-baseline.json` + `scripts/198-plurai-gate-check.cjs` - clone the 189 gate pattern
- [ ] Part 8 local-only source-grep floor for any new lib/mcp modules (clone `test-194-local-only.test.cjs`)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Per-session binding = write authorization boundary; set-membership write guard (Phase 194) |
| V5 Input Validation | yes | zod per-tool schemas; `SECTION_RE` + `safeResolveSection` path-traversal guard (tool-router.cjs:84-107); `..`-traversal guard in session-binding.cjs |
| V6 Cryptography | no | No secrets minted; sessionId via `crypto.randomUUID` (not security-critical, local only) |
| V9 Communications | yes | Daemon binds 127.0.0.1 ONLY (never 0.0.0.0); no remote listener |
| V13 API/Web Service | yes | Versioned MCP contract; brain proxy schema accepts NO room content (Part 8 by contract) |

### Known Threat Patterns for MCP-daemon + local room
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via section/room slug | Tampering | `SECTION_RE` regex + `safeResolveSection` + `..` reject (all shipped) |
| Cross-session room clobber (the live defect) | Tampering | Per-session binding + set-membership write guard + reconcile CAS (Phase 194) |
| LOCAL room data egress to Brain | Information Disclosure | Part 8: brain_* tool schemas accept generic handles only; `build-connector-registry.cjs --check` + brain-boundary scan |
| Graph write bypassing the chokepoint | Tampering / Repudiation | Part 9: all writes through navigation.cjs; test rejects out-of-band writes (SPEC-2) |
| Daemon bound to a public interface | Info Disclosure / EoP | Bind 127.0.0.1 only (as the current server does, line 169) |
| Unwired tool reachable without governance | EoP | Part 11 born-wired: connector + HITL-shape declaration, `--check` fails closed |

## Sources

### Primary (HIGH confidence)
- Shipped code inspected at file:line: `bin/mindrian-mcp-server.cjs` (:65 frozen roomDir, :163 stateless transport, :169 port 3847), `lib/mcp/tool-router.cjs` (:38-66 racy re-resolution), `lib/core/resolve-active-room.cjs` (:201 resolveWriteRoom, :266 resolveSessionScope, :304 exports), `lib/core/session-binding.cjs`, `lib/workflow/session-binding-consumer.cjs`, `scripts/statusline-mos-dispatch`, `scripts/189-plurai-gate-check.cjs`
- `@modelcontextprotocol/sdk` 1.29.0 vendored source: `package.json` version, `server/index.d.ts` (elicitInput:158), `types.d.ts` (ElicitRequestFormParamsSchema enum/enumNames/description), transports present
- Phase 194 artifacts: `194-VERIFICATION.md` (PASSED, 14/0/0), `194-01..07-SUMMARY.md`, git hashes 50d5ea37/bc590f1e/aabc4459/d4785728/70b53cc8/03806baf/4a005baa/5633aae4/c788c19f
- CLAUDE.md Canon Parts 3/7/8/9/11; `.planning/config.json` (nyquist_validation: true)

### Secondary (MEDIUM confidence)
- 198-SPEC.md (8 locked requirements), 198-CONTEXT.md (D-01..D-07), 198-SPEC-DRAFT.md (MCP inventory, reversibility contract), SEED-039, SEED-038

### Tertiary (CITED - room evidence, per dev-research rule not re-verified except where corrected)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/` streams 01 (elicitation client sparsity ~13/101, Claude Code issue #2799), 02 (opencode daemon 127.0.0.1+SSE), 03 (migration map - SEED-039 claim CORRECTED here), 05 (elicitation schema limits -> superset decision)

## Metadata

**Confidence breakdown:**
- SEED-039 build status / CORRECTION: HIGH - verified against Phase 194 SUMMARYs + VERIFICATION + shipped code at file:line
- Standard stack: HIGH - SDK/zod versions read from vendored node_modules; no new installs
- Daemon seam: HIGH - current single-shot/stateless state read directly from bin source; the durable-daemon target is greenfield (well-scoped)
- Gate elicitation limits: HIGH (SDK schema verified) / MEDIUM (client capability status - re-check at plan time, A2)
- Architecture patterns: HIGH - all wrap shipped modules
- Pitfalls: HIGH - each maps to a verified code fact or a Canon part

**Research date:** 2026-07-09
**Valid until:** 2026-08-08 (stable in-repo facts) / 2026-07-16 for A2 (elicitation client capability, fast-moving upstream)

## RESEARCH COMPLETE
