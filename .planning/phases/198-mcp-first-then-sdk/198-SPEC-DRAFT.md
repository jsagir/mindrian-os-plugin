# Phase 198 SPEC (DRAFT for GSD formalization) - MCP-First Substrate, Un-Parked

**Status: DRAFT - written 2026-07-09 from the navigator's decision at a live gate (MCP-first, terminal follows). This draft feeds /gsd-spec-phase; it is not the executable plan. Un-parks Phase 198 from P4 per navigator directive 2026-07-09.**

**Evidence base (standing rule: research composites with rethinking-mindrianos):**
`~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/` - streams 01 (agent-embedding feasibility), 02 (TUI stack/effort), 03 (migration map), 00-TERMINAL-TUI-SYNTHESIS-DECIDED (the F1 re-cut). Mirrored in mindrianOS/research/.

## The decision this phase executes

Ship the **Mindrian MCP server as the product**: @mindrian/core (the verified engine-agnostic runtime - navigation, resolver, chain-executor, registries; 03 §3 grep-clean) exposed behind MCP tools + elicitation, so every MCP host (Claude Code, Claude Desktop, Cursor, Zed) is a Mindrian surface with identical behavior. The mindrian-os terminal follows later as the flagship client. The Claude Code plugin shrinks to a thin adapter (hook wake-up + marketplace distribution), fat logic server-side.

## Hard prerequisite (do first, its own plan)

**SEED-039 promotion: per-session room binding.** The MCP server's roomDir freezes at startup and the global active-room field races across sessions - both bit live on 2026-07-08 (write-scope guard pointed at a stale room). A server serving multiple hosts CANNOT ship on a global active-room. The four designed pillars (per-session binding set, F.7 gate, set-membership write guard, navigation.cjs reconcile events) become the phase's first plan.

## Scope (WHAT, not how)

1. **Server contract**: rooms, graph reads, chain composition/execution (resolve via command-resolver, run via runChain, autonomous_safe prefix honored server-side), Brain proxy (generic handles only - Part 8 unchanged), memory events - as versioned MCP tools.
2. **Gates via the card-primitive SUPERSET schema with THREE renderers** (corrected 2026-07-09 by the framework-selection deep-research, stream 05): MCP elicitation cannot carry the full card - the spec supports titled oneOf/anyOf but NO per-option descriptions and NO ranked dial, and only ~13 of 101 MCP clients implement elicitation (Claude Code and Claude Desktop do NOT - claude-code issue #2799). Therefore: the gate schema is Mindrian's own superset (options + descriptions + ranks + previews), rendered by (a) MCP elicitation where supported (lossy transport, VS Code etc.), (b) canUseTool/AskUserQuestion interception inside Claude Code via the thin adapter, (c) structured-tool-result + next-message fallback for headless clients. The future terminal renders the superset natively as renderer (d). This remains the 307-file dependency collapsed to one interface.
3. **Thin-plugin adapter**: SessionStart/statusline hooks wake and query the server; no business logic remains hook-side.
4. **Surface parity test**: the same session transcript (bind room, reach card, chain run, gated write) passes identically on Claude Code CLI and one non-Anthropic MCP host.

## The MCP inventory (navigator-reviewed 2026-07-09)

Three servers, split by TRUST BOUNDARY not feature:

1. **mindrian-core** (local; stdio + durable HTTP): room_bind (per-session, SEED-039 as the front door) / room_list / room_state / room_search; graph_query / graph_write (navigation.cjs chokepoint - nothing writes around it) / memory_event; chain_resolve (composeWorkflow) / chain_run (runChain - autonomous_safe prefix server-side, HALTS at material steps returning a gate) / framework_run (the 107 commands become parameters, not surfaces); gate_render (superset card schema, renderer ladder) / gate_answer (ratification); suggest_next / reach_candidates / contradiction_check / whitespace_scan (sensors as pull); artifact_file / view_compile (view registry exposed); status_read (navigator segments incl. per-engine spend/cap for any host).
2. **mindrian-brain** (remote proxy, read-only; ships today): brain_ask / brain_search / brain_schema - generic handles only; NO tool in its schema accepts room content, so Part 8 is enforced by the contract, not by behavior.
3. **mindrian-critic** (later; Phase 212 / SEED-050): critic_score - scalars + enums in, calibrated verdict out; no text parameter exists, so embedding/text egress is structurally unexpressible.

**Eureka engine placement (navigator-reviewed 2026-07-09):** the GENERATOR (Phase 211 - bridge_measure / eureka_generate / whitespace_scan; local embeddings, sqlite-vec, same-meaning/different-words measure) lives in mindrian-core and ships in the SDK (the open half). The CRITIC stays the remote subscription service (the moat's delivery vehicle - calibrated against the graded corpus, compounds cross-user). Status honesty: Phase 211 is designed + diligenced but ZERO code (shipped as an empty folder per the 2026-07-05 room audit); on this substrate it becomes the FIRST new capability registered through the capability lifecycle rather than hand-rolled wiring - the eureka engine is the substrate's first-born, not an afterthought.

## Explicitly OUT of scope

Terminal v1 (follows as a client once the contract is stable), Gemini/Codex adapters (F4: Claude depth first, Codex second - separate phase), SDK npm packaging (the dividend AFTER the substrate holds), eureka critic internals (Phase 212 track).

## Isolation strategy (**navigator-decided 2026-07-09**): expand-contract in main, NO fork

The live build (v1.15.x - real ventures and testers inside) is never compromised: the MCP server lands ADDITIVELY in the same repo behind feature flags; plugin behavior stays byte-identical until each per-surface cutover gate passes; main remains shippable every day. A true fork was considered and rejected by name (dual-maintenance is the disease this phase cures); the Phase 197 separate-repo precedent remains available later for the SDK packaging step if cross-repo boundaries earn their cost. Guard: every plan in this phase carries a "main is still green" verification step - the existing test suite plus a plugin-behavior smoke must pass on every commit, not at the end.

## Reversibility contract (**navigator-directed 2026-07-09**: everything reversible to the current build, always)

1. **Kill switch:** all MCP-first behavior gated behind a single flag (MINDRIAN_MCP_FIRST, default OFF). Flag off = byte-identical legacy behavior, verified by the per-commit plugin smoke. Rollback at runtime = unset one flag, zero code changes.
2. **Git:** tag last-known-good (current v1.15.3-beta line) before the first phase commit. All phase work is ADDITIVE commits (new files, flag-gated branches) - reverting is a clean git revert, never surgery.
3. **Data (room.db):** expand-contract only - additive tables/columns during the phase; DESTRUCTIVE contract steps forbidden until the cutover gate passes AND a navigator sign-off. Before any migration: automatic backup via the shipped heal-command backup + dry-run precedent, logged in the migration-snapshot ledger. Rollback = restore snapshot. Rooms additionally carry the data-room-autocommit git history.
4. **Release door:** the ONLY path to users is release.sh (the 6-place npm lockstep). Local testing on the navigator's own install first; no publish until the navigator is satisfied. The plugin cache means dev-repo work cannot leak into the live surface by accident.
5. **Test-of-the-rollback, not just the roll-forward:** the completion gate includes one rehearsed reversal - flip the flag off after cutover, restore a room from snapshot, and verify the legacy path still passes the parity transcript. A rollback that was never rehearsed is a hope, not a contract.

## Completion gate

- SEED-039 pillars shipped and the 2026-07-08 stale-room failure reproduced-then-impossible under test
- Server contract versioned; the parity test green on two hosts
- One gate rendered via elicitation end-to-end (fired by the server, answered in the host, write ratified through navigation.cjs)
- Plugin hook layer reduced to adapter-only (measured: zero business logic in hooks/)

## Stack verdict for the flagship client (**LOCKED by navigator 2026-07-09** at a live gate; flip-trigger below stays armed)

oclif + Ink v5 + bespoke gate-card layer (~200-300 LOC over @inkjs/ui) + MCP TypeScript SDK v1.20 (StdioClientTransport local / StreamableHttpClientTransport durable) + npm global distribution (npx -y zero-install first-run; single-binary deferred). Server manages the engine subprocess (opencode resolution to the raw-mode HIGH risk); TUI never shares a TTY with the engine. Flicker: token-boundary redraws (~512 tokens/500ms), color blocks frozen during streams. NEW REQUIREMENT: RTL/Hebrew - Ink does no BiDi; ship Unicode Bidi isolate wrapping (LRI/FSI/PDI) at the output layer + a documented supported-terminal list (works: Windows Terminal/iTerm2/Terminal.app; fails: Ghostty/Alacritty).

## Risks carried in (named, from the research)

- MCP elicitation support varies by host - fallback text-prompt renderer required (degrade gracefully, never silently)
- The Anthropic Agent-SDK billing overhang (01 §5) does not touch this phase (MCP server != SDK host) - it returns at terminal time (parked fork F7)
- Dual-maintenance disappears only when the thin-plugin adapter truly stays thin - CIRS-style check: hooks/ line-count budget

Ratification: status DRAFT-FOR-GSD / owner: navigator / target: /gsd-spec-phase 198 then /gsd-plan-phase / strength: three-stream primary-source research + two live navigator gates (2026-07-08 terminal-now, 2026-07-09 MCP-first re-cut).
