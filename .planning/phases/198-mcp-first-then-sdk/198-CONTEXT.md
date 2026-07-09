# Phase 198: MCP-First Invocation Substrate then SDK - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The governed invocation spine moves onto ONE MCP substrate: a versioned mindrian-core server carries rooms, graph, chains, gates, sensors, and views; the Claude Code plugin shrinks to a thin adapter; parity is proven on Claude Code CLI plus one non-Anthropic MCP host - all behind default-OFF flags with a rehearsed rollback. Terminal v1, other engine adapters, and SDK packaging follow in later phases.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `198-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `198-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** SEED-039 promotion and implementation (first plan); the mindrian-core versioned tool contract and server-side chain execution; the gate superset schema + three renderers (elicitation, thin-adapter card, structured text); thin-adapter refactor of hooks; parity harness, reversibility mechanics, Plurai eval suite.
**Out of scope (from SPEC.md):** Terminal v1 (follows as flagship client; stack locked); Gemini/Codex adapters (Claude depth first); npm SDK packaging (the dividend after); eureka generator/critic internals (Phase 211/212 track; this phase only guarantees their capability-registration seam); marketplace/distribution changes.

</spec_lock>

<decisions>
## Implementation Decisions

### Server topology + lifecycle
- **D-01:** Durable daemon + stdio shim. One long-lived localhost server (the opencode pattern: HTTP + SSE event bus for live segments); stdio clients connect through a thin proxy. Sessions survive terminal restarts; multiple clients (CLI + Desktop) attach to the same server concurrently; the future mindrian-os terminal reconnects to the same brain.
- **D-02:** SEED-039's per-session binding is designed ONCE against the daemon topology (session = a connection with its own binding), not twice.

### Room binding UX
- **D-03:** Explicit-bind-wins, cwd-default, card-only-on-ambiguity. room_bind tool call wins when made; launching inside a room directory auto-binds silently; the F.7 binding card fires ONCE per session and ONLY when genuinely ambiguous (outside any room, or conflicting signals). Desktop (no meaningful cwd) gets the card once at session start.
- **D-04:** The legacy global `active` field gets a compat shim during transition: reads fall back to it when a session has no binding; writes to it are deprecated and logged. The per-turn binding-card noise (navigator's logged regression) is retired BY DESIGN through this decision.

### Hook migration order + card noise
- **D-05:** Statusline + SessionStart migrate server-side FIRST (lowest risk, most visible payoff). Stop-gate enforcement migrates LAST, and only after server-side gate dedup + relevance machinery exists - the card-misfire regression class must be fixed by the move, never re-created by it.
- **D-06:** "Adapter-only" is a measured budget: hooks/ scripts may wake, query, and render server responses; an import audit (no lib/core business modules from hook scripts) plus a line-count budget enforce it in CI.

### Flag granularity + cutover
- **D-07:** Per-surface flag values: MINDRIAN_MCP_FIRST accepts a surface list (e.g. `cli`, then `cli,desktop`, then `all`). CLI cuts over first on the navigator's own install (dogfood), each surface earns its cutover through its own parity gate + smoke; unset/empty = byte-identical legacy everywhere.

### Claude's Discretion
- Internal server module layout, transport wiring details, zod schema organization, SSE event vocabulary, and test harness structure - within the locked stack (CJS, Node >=22.5, @modelcontextprotocol/sdk ^1.29.0) and the one-chokepoint rule.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase intent + requirements
- `.planning/phases/198-mcp-first-then-sdk/198-SPEC.md` - Locked requirements - MUST read before planning
- `.planning/phases/198-mcp-first-then-sdk/198-SPEC-DRAFT.md` - Navigator intent draft: MCP inventory by trust boundary, stack lock, reversibility contract, eureka placement

### Seeds this phase executes
- `.planning/seeds/SEED-038-mcp-first-invocation-then-sdk.md` - The substrate mandate (note: frontmatter stale - real graduation is THIS phase, not 188)
- `.planning/seeds/SEED-039-per-session-room-binding-and-multi-session-reconciliation.md` - The four binding pillars; hard prerequisite, first plan

### Composited room evidence (dev-research rule: same finding, two homes)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/01-agent-embedding-feasibility.md` - SDK depth, ACP state, elicitation client sparsity (~13/101; Claude Code NOT yet - issue #2799), billing overhang
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/02-tui-stack-effort.md` - opencode daemon reference architecture (127.0.0.1 + SSE), effort benchmarks
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/03-migration-map.md` - KEEP/REBUILD/LOSE per category; 307-file card dependency; runtime verified clean
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/05-framework-selection-report.md` - MCP TS SDK v1.20 elicitation schema limits (no per-option descriptions -> superset schema decision)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/00-TERMINAL-TUI-SYNTHESIS-DECIDED.md` - The decision ledger (F1-F4 + re-cut + isolation)

### Runtime being wrapped (reuse, never rebuild - Canon Part 7)
- `lib/core/navigation.cjs` - THE graph chokepoint; graph_write wraps this, nothing bypasses it
- `lib/workflow/command-resolver.cjs` + `lib/core/chain-executor.cjs` - chain_resolve/chain_run wrap these
- `bin/mindrian-mcp-server.cjs` + `bin/mindrian-brain-mcp-client.cjs` - the two shipped servers this phase extends/absorbs
- `docs/MINDRIAN-CANON.md` Parts 3, 7, 8, 9, 11 - the constitutional constraints named in SPEC

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The entire lib/core runtime is grep-verified free of Claude-Code-specific imports (stream 03): navigation (9,541 lines behind one require surface), resolver, chain-executor, registries, memory_event - the server wraps, never rewrites
- `@modelcontextprotocol/sdk` ^1.29.0 already vendored; zod already a dependency
- Phase 196 plurai-baseline harness - the 198 eval suite reuses it (roadmap GATE)
- Phase 166 runChain posture semantics - chain_run's halt-at-material behavior already exists in-process

### Established Patterns
- One governed reach path (dispatchSensors -> decide() -> resolver); the server must not mint a second selection brain (Part 11 R4)
- Sentinel-source generation + born-wired gates: every new tool surface declares its connector + HITL shape; build gates must regenerate clean
- heal-command backup + dry-run and migration-snapshot ledger - the reversibility mechanics compose from these shipped precedents

### Integration Points
- hooks/hooks.json (10 event types, ~39 scripts) - the thin-adapter refactor's surface; statusline + SessionStart first, Stop-gate last (D-05)
- scripts/room-registry global `active` field - D-04's compat shim wraps it
- The AskUserQuestion card path in commands/skills (307 files) - collapses onto gate_render's superset schema via the thin adapter

</code_context>

<specifics>
## Specific Ideas

- "Like opencode": durable server at localhost, TUI/clients as reconnecting HTTP/SSE consumers; `/event` bus pattern for statusline segments
- The binding-card noise the navigator logged all week (feedback_1_15_enforcement_regression_watch) is a NAMED target: D-03/D-04/D-05 exist to retire it structurally
- Spend/cap visibility as a first-class statusline segment (the Warp lesson from the room's teardown) - status_read carries it from day one

</specifics>

<deferred>
## Deferred Ideas

- Warp-as-channel (Mindrian as agent inside Warp's harness) - parked with fork F8 triggers (room file 04-warp-teardown.md)
- MCP experimental tasks API (callToolStream/getTaskResult) for long-run resume - revisit when the API stabilizes; opencode session-store pattern meanwhile
- Hub-level site licenses / sprint motion - GTM track, runs in parallel, never blocks this phase

</deferred>

---

*Phase: 198-mcp-first-then-sdk*
*Context gathered: 2026-07-09*
