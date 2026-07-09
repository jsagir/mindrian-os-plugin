# Phase 198: MCP-First Invocation Substrate then SDK - Specification

**Created:** 2026-07-09
**Ambiguity score:** 0.17 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

The governed invocation spine executes through ONE MCP substrate on every surface: a versioned mindrian-core MCP server carries rooms, graph, chains, gates, sensors, and views; the Claude Code plugin shrinks to a thin adapter; the identical session transcript passes on Claude Code CLI and one non-Anthropic MCP host - with a single default-OFF flag guarding byte-identical legacy behavior throughout.

## Background

Two MCP servers ship today (bin/mindrian-mcp-server.cjs - local room tools; bin/mindrian-brain-mcp-client.cjs - Brain proxy) but the invocation spine still runs surface-specific paths (CLI hooks vs Desktop vs Cowork). The load-bearing runtime is verified engine-agnostic (navigation.cjs, command-resolver.cjs, chain-executor.cjs, registries: zero Claude-Code-specific imports; 78.5% of repo files engine-agnostic). Known live defects motivate the prerequisite: the MCP server roomDir freezes at startup and the global active-room field races across sessions (both reproduced 2026-07-08). Navigator decisions at live gates (2026-07-08/09, evidence in ~/MindrianRooms/rethinking-mindrianos/research/2026-07-08-fable-wave2-room-rethink/): MCP-first with the terminal following as flagship client; expand-contract in main, no fork; stack locked for the future client (oclif + Ink + MCP TS SDK); eureka generator stays local in core, critic stays a remote service. Full intent draft: 198-SPEC-DRAFT.md (same directory).

## Requirements

1. **SEED-039 per-session room binding (prerequisite)**: Sessions carry their own room binding; the global active-room race becomes impossible.
   - Current: scripts/room-registry holds ONE global `active` field; MCP server roomDir frozen at startup; stale-room writes reproduced live 2026-07-08
   - Target: per-session binding set (the four designed SEED-039 pillars: binding set, F.7 gate, set-membership write guard, navigation.cjs reconcile events); every MCP tool call resolves the room from ITS session
   - Acceptance: a test spawning two concurrent sessions bound to different rooms performs interleaved writes; each write lands in its own room; the 2026-07-08 failure scenario is reproduced-then-impossible under test

2. **Versioned mindrian-core server contract**: The kernel's tool surface is one versioned MCP contract split by trust boundary.
   - Current: mindrian-mcp-server.cjs exposes partial room tools; no version field; chains/gates/sensors/views not exposed
   - Target: mindrian-core exposes room_bind/room_list/room_state/room_search, graph_query/graph_write (navigation.cjs chokepoint only), memory_event, chain_resolve/chain_run/framework_run, gate_render/gate_answer, suggest_next/reach_candidates/contradiction_check/whitespace_scan, artifact_file/view_compile, status_read - with a contract version string and zod schemas per tool
   - Acceptance: contract-version tool returns a semver; every listed tool callable via MCP Inspector with schema validation passing; graph writes attempted around navigation.cjs are rejected by test

3. **Server-side chain execution honoring postures**: chain_run executes the autonomous_safe prefix and halts at the first material step, returning a gate.
   - Current: runChain (lib/core/chain-executor.cjs, Phase 166) runs in-process on the CLI surface only
   - Target: chain_run wraps runChain server-side; postures joined from the connector registry; material steps return a gate_render payload instead of executing
   - Acceptance: a test chain of 2 autonomous_safe + 1 material step runs the prefix, halts, returns the gate; the material step executes ONLY after gate_answer with an approve verdict

4. **Gate superset schema with the renderer ladder**: One card schema (options + per-option descriptions + ranks + previews + single/multi-select) rendered by capability detection.
   - Current: 307 files assume the Claude Code AskUserQuestion card; no schema exists independent of the host
   - Target: gate_render emits the Mindrian superset schema; renderer ladder: (a) MCP elicitation where the client declares the capability (lossy: titles only per spec - per-option descriptions travel in the app-layer payload), (b) canUseTool/AskUserQuestion via the thin adapter inside Claude Code, (c) structured-text fallback for headless clients
   - Acceptance: the same gate renders end-to-end through (a) on an elicitation-capable client (MCP Inspector or VS Code), (b) inside Claude Code, and (c) as structured text; all three answers arrive as identical gate_answer payloads

5. **Thin-plugin adapter (hooks carry zero business logic)**: The Claude Code plugin becomes wake-up + render adapter only.
   - Current: hooks/hooks.json fires ~39 scripts across 10 event types containing session, filing, and gate logic
   - Target: hook scripts wake and query mindrian-core; business logic (binding, gap scans, gate composition, filing) executes server-side
   - Acceptance: a measured check (line-count budget or import audit) shows hooks/ contains only adapter calls; the plugin-behavior smoke passes with the flag ON routing through the server

6. **Surface parity test**: The same governed session passes identically on two hosts.
   - Current: no cross-surface parity harness exists; CLI/Desktop/Cowork drift is the disease SEED-038 names
   - Target: a scripted transcript (bind room, reach card, chain run with halt, gated write, artifact filed) executes on Claude Code CLI and on one non-Anthropic MCP host (VS Code, elicitation-capable since v1.102)
   - Acceptance: both runs produce the same typed graph writes (node/edge diff empty) and the same gate sequence; the parity script is committed and repeatable

7. **Reversibility contract enforced**: One flag, additive commits, snapshots, rehearsed rollback.
   - Current: no MINDRIAN_MCP_FIRST flag; no rollback rehearsal exists
   - Target: MINDRIAN_MCP_FIRST defaults OFF (flag off = byte-identical legacy, verified per commit by the plugin smoke); last-known-good tag on the v1.15.3-beta line before the first phase commit; room.db changes expand-only until cutover + navigator sign-off, with pre-migration snapshots
   - Acceptance: the rollback rehearsal passes: flip the flag OFF after cutover, restore one room from snapshot, re-run the legacy parity transcript green; a commit with the flag off failing the smoke blocks the phase

8. **Plurai eval gate (roadmap mandate)**: One judge for one-path invocation parity.
   - Current: Phase 196 plurai-baseline harness exists; no 198 suite
   - Target: a Plurai eval suite reusing the 196 harness; the judge scores invocation parity across CLI + one MCP host against the transcript corpus
   - Acceptance: the 198 Plurai baseline passes; the phase cannot close without it (roadmap GATE clause honored)

## Boundaries

**In scope:**
- SEED-039 promotion and implementation (the phase's first plan)
- The mindrian-core versioned tool contract and server-side chain execution
- The gate superset schema + three renderers (elicitation, thin-adapter card, structured text)
- Thin-adapter refactor of hooks
- Parity harness, reversibility mechanics, Plurai eval suite

**Out of scope:**
- Terminal v1 (mindrian-os cockpit) - follows as flagship client once this contract is stable; stack already locked (oclif + Ink + npm) in 198-SPEC-DRAFT.md
- Gemini/Codex engine adapters - F4 decision: Claude depth first; Codex second in a later phase
- npm SDK packaging (@mindrian/core publish) - the dividend AFTER the substrate holds; Phase 197 separate-repo precedent available then
- Eureka generator/critic internals - Phase 211/212 track; this phase only guarantees the capability-registration seam they will land on
- Marketplace/distribution changes - release lockstep untouched

## Constraints

- Canon Part 8: brain proxy tools accept NO room content by schema; Part 9: graph writes only via navigation.cjs; Part 11: every new tool surface born WIRED with declared HITL shape; Part 7: reuse the shipped runtime, no second resolver/executor
- Expand-contract in main, NO fork (navigator-decided 2026-07-09); main green on every commit (existing suites + plugin smoke)
- CJS only, Node >=22.5, @modelcontextprotocol/sdk (^1.29.0 already vendored), zod schemas
- No em-dashes anywhere; three-surface rule holds (Desktop/Cowork become MCP clients of the same server)
- Local testing only on the navigator's install; release.sh is the only door to users

## Acceptance Criteria

- [ ] Two-session concurrent-write test passes; stale-room failure reproduced-then-impossible
- [ ] mindrian-core contract-version tool live; all listed tools schema-valid via MCP Inspector
- [ ] chain_run halts at material steps; execution only after gate_answer approve
- [ ] One gate renders end-to-end via all three renderers with identical answer payloads
- [ ] hooks/ measured adapter-only; plugin smoke green with flag ON and OFF
- [ ] Parity transcript: identical graph writes + gate sequence on Claude Code CLI and VS Code
- [ ] Rollback rehearsal green (flag off + snapshot restore + legacy parity)
- [ ] 198 Plurai baseline passes (one-path invocation parity judge)
- [ ] Born-wired, projection, and render-coverage gates regenerate clean; doctor --acceptance green

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                            |
|--------------------|-------|------|--------|--------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | OK     | One-substrate goal + parity target measurable    |
| Boundary Clarity   | 0.85  | 0.70 | OK     | Explicit in/out lists from navigator gates       |
| Constraint Clarity | 0.80  | 0.65 | OK     | Canon parts, no-fork, flag, stack all locked     |
| Acceptance Criteria| 0.80  | 0.70 | OK     | 9 pass/fail checks incl. rehearsed rollback      |
| **Ambiguity**      | 0.17  | <=0.20| OK    | Gate passed pre-interview                        |

## Interview Log

The Socratic work happened at navigator-answered live gates across 2026-07-08/09 (evidence: rethinking-mindrianos wave2 track, streams 01-05 + decided synthesis); the interview loop was therefore pre-satisfied and the gate passed at round zero.

| Round | Perspective     | Question summary                       | Decision locked                                        |
|-------|-----------------|----------------------------------------|--------------------------------------------------------|
| 0     | (gates 07-08)   | Host posture? Terminal vs plugin?      | Terminal-now, re-cut 07-09 to MCP-first, terminal follows |
| 0     | (gates 07-08)   | Phase 198 unpark?                      | Unpark with SEED-039 first                              |
| 0     | (gates 07-09)   | Stack? Engine scope?                   | oclif+Ink+npm locked; Claude depth first, Codex second  |
| 0     | (gates 07-09)   | Isolation? Reversibility?              | Expand-contract in main, no fork; flag + snapshots + rehearsed rollback |
| 0     | (spec pass)     | Parity host? Eval gate?                | VS Code (elicitation-capable); Plurai parity judge per roadmap |

---

*Phase: 198-mcp-first-then-sdk*
*Spec created: 2026-07-09*
*Next step: /gsd-discuss-phase 198 - implementation decisions (how to build what's specified above)*
