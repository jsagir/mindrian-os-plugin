---
title: "MindrianOS Layer Contract and ICM Nested-Part Map"
date: 2026-09-14
status: landed 2026-09-14; open decisions in section 7 remain the navigator's
audience: MindrianOS-Plugin developers, Larry, Theo maintainers
input_to: MindrianOS-Plugin Phase 344 (the layer contract), Phase 343, 345, 346, 347; Theo Phase 21, 22
grounding:
  - "structured note: Graph Engineering vs Loop Engineering (video transcript, 2026) - NOT yet extracted into the langtalks graph; cited directly"
  - "langtalks-graph-expert corpus edges, EXTRACTED confidence, pulled 2026-09-14"
  - "MindrianOS-Plugin repository walk, 2026-09-14, file and line citations inline"
---

# MindrianOS Layer Contract and ICM Nested-Part Map

**Superseded 2026-09-14:** this draft's two successors have landed: docs/LAYER-CONTRACT.md for the five engineering layers (PROMPT, CONTEXT, HARNESS, LOOP, GRAPH), and docs/ICM-NESTED-PART-CONTRACT.md for the ICM nested parts. This draft is retained as the measurement snapshot it always was, with its own file and line citations intact. Its section 7 open decisions now live in the decision ledger in docs/LAYER-DECLARATION-CONTRACT.md.

## 0. Why this document exists

The graph-engineering transcript draws a ladder of five engineering scopes, each one wider than the one before, and states two rules about them: the layers ACCUMULATE, they do not substitute (a good graph node is a well-designed loop; a good loop needs a solid harness), and a loop is a special case of a graph (one node, one self-edge). MindrianOS implements all five rungs and has never named them. The only two places in the plugin that mention the five layers are Phase 343 item 4 and Phase 344, both registered on 2026-09-14 and both unplanned (`.planning/ROADMAP.md:694`, `:705`). Everything else in the repo uses an orthogonal vocabulary, the ICM Layers 0-4 (identity, routing, contracts, reference, artifacts).

This document pins both vocabularies against the code as it is today, so Phase 344 plans from a measured baseline rather than a re-derivation.

## 1. Corpus grounding (langtalks-graph-expert)

What the corpus itself says about how the layers relate. Confidence EXTRACTED unless marked.

| relation | hops | sources |
|---|---|---|
| Memory `part_of` / `builds_on` context engineering | 1 | ep55 Context Engineering; ep57 Memory (Qodo); ep63; ep65; Lex #490; the ICM note |
| Interpretable Context Methodology `builds_on` context engineering | 1 | the ICM note (research) |
| context engineering ... File ... Blast Radius `part_of` Harness Engineering | 3 | Fragmented #307 Harness Engineering |
| Loop engineering ... Verification Loops ... Code Review ... Blast Radius ... Harness Engineering | 4 | Claude blog, Building Verification Loops |
| Orchestration layer ... Agent Harness ... Agent `compares_to` Multi-Agent Systems | 3 | SDS 985 four memory types; ep33 LangGraph |
| prompt engineering | node | ep35, ep55, ep60 |
| graph engineering | ABSENT | not in the corpus yet; extraction of the structured note pending |

Two consequences for the map below: memory is a sub-part of the CONTEXT layer, not a layer of its own; and the ICM note sits on the CONTEXT layer, which means the ICM nested parts are the context layer in file form, and the harness is what reads and writes them.

## 2. The five engineering layers of MindrianOS

For each layer: definition (from the transcript), the core question, what implements it today, what is thin or missing, the owner surface a change must go through, and the phase that carries the gap.

### 2.1 PROMPT - one request. Core question: did I ask well?

| | |
|---|---|
| Implements | Larry persona `agents/larry-extended.md:34-45`; persona variants `agents/larry-extended.md:15-27`; MCP handshake instructions `lib/mcp/runtime-instructions.cjs:24-46` (1944 bytes, host cap 2048, silent truncation, budget test `lib/mcp/no-instructions.test.cjs`); voice references `references/personality/*`; output style `output-styles/destijl.md`; voice enforcement `scripts/check-voice-style.cjs`; per-command firing block injected into all 113 `commands/*.md` |
| Thin or missing | 7 of 10 persona variants are byte-identical to `default`. Persona text lives in five places with no single source (agent frontmatter, MCP instructions, `references/personality/`, `skills/larry-personality/SKILL.md`, the firing block copied into 113 files, an ICM invariant 8 breach: one home per fact) |
| Owner surface | [NAVIGATOR DECISION] none exists today; candidate: `skills/larry-personality/SKILL.md` as the single source, everything else generated |
| Phase | 344 |

### 2.2 CONTEXT - what the model can see this turn. Core question: does it have the right information?

| | |
|---|---|
| Implements | `context_assemble` tool `lib/mcp/tools/context.cjs:36-47` over `getRoomContext` `lib/core/navigation/room-context.cjs:244+` (four legs: room-state summary, session fragments, ranked graph neighborhood, projected cortex with recency decay); SessionStart coordinator `scripts/sessionstart-coordinator.cjs` (2000-char budget) with the 11-rung precedence ladder `lib/sessionstart/precedence-ladder.cjs:22-34`; TRIPLE_CONTEXT formatter `lib/memory/triple-context-formatter.cjs` (5000-token default); UserPromptSubmit hooks (intent classifier, jtbd-update, brain-derivation drain, auto-explore drain, mva-detect, first-install router, operator-update, admin gate); DirectiveEnvelope `lib/core/directive-envelope.cjs:1-40` (six modes, GUIDED default); JTBD state `lib/hmi/jtbd-state.cjs:27`; the files read as context: ROOM.md, STATE.md, USER.md, MINTO.md, BRAIN.md, FEYNMAN.md via `lib/core/folder-memory.cjs:200-303` |
| Thin or missing | Two context assemblers with two budgets and no shared authority: the MCP path (`context_assemble`, tokens) and the CLI hook path (precedence ladder plus formatter, characters). The per-section `CONTEXT.md` contract, the best ICM artifact in the repo, has zero code consumer (see 4.1) |
| Owner surface | [NAVIGATOR DECISION] candidate: `getRoomContext` as the one assembler, the hook path calling it with a budget argument |
| Phase | 344, 347 (per-node scoped context) |

### 2.3 HARNESS - tools, memory, scaffolding. Core question: can it act on the world and remember?

| | |
|---|---|
| Implements | 22 core MCP tools across 13 modules in `lib/mcp/tools/` plus `room_bind` and 9 grouped routers (`lib/mcp/tool-router.cjs:195-376`); two constitutionally distinct chokepoints: READ `lib/core/navigation.cjs` (closed 13-function surface, pre-commit guard, bypass telemetry) and WRITE `lib/core/node-insert.cjs` (Canon Appendix D entry 39); the local graph `<room>/.mindrian/room.db` `lib/core/room-db.cjs:255-257` (node:sqlite, five migrations, typed nodes, 15 edge types); memory: `memory_event` append-only with 60s dedupe, folder memory, cortex packet, governance; gate ledger `lib/mcp/gate-ledger.cjs` (in-memory, session-keyed, single-use, 30-min TTL); hooks `hooks/hooks.json` (12 events, incl. the Part 8 egress guard) |
| Thin or missing | No layer declaration in tool or command frontmatter. The gate ledger is in-memory only: a halted chain is unresumable after a restart. `graph_write`'s CAS guard fails open on a missing node (disclosed, unmeasured). The path `.room-graph/` survives in two stale skip-lists while the real path is `.mindrian/room.db`. `seeds/` exists only in the dev repo, never in a room |
| Owner surface | `navigation.cjs` (read) and `node-insert.cjs` (write); tool registration `lib/mcp/register-core-tools.cjs` |
| Phase | 343 (integrity audit), 273 (chokepoint hardening, existing) |

### 2.4 LOOP - one agent's cycle with a stopping condition. Core question: when does it check its work, and when does it stop?

| | |
|---|---|
| Implements | one `/mos:<framework>` run (113 commands); `body_shape` frontmatter (33 methodology, 23 E, 21 "E (Action Report)", 7 C, 6 B, 5 F.1); `hitl_shape` (37 F.1, 33 F.8, 13 F.0, 10 F.9, checked ADVISORY by `scripts/check-shape-declaration.cjs`, 53 conflicts open); `hitl_stages` on pipeline, act, bono; connector frontmatter (the loop-to-graph seam); artifact filing `lib/mcp/tools/views.cjs` (`artifact_file`, typed claim plus SOURCED_FROM); stop condition `stop_gate_check` `lib/mcp/stop-gate-handler.cjs` and the CLI Stop hook `scripts/check-card-fire.cjs`; next move `suggest_next` and `reach_candidates`; the Ask-Tell dial `skills/larry-personality/SKILL.md:30,85,130,153-169`; dial rendering `lib/core/nav-dial.cjs` |
| Thin or missing | `body_shape` has no schema and no validator (two spellings of one shape; a prose sentence leaked into one value). No command declares its engineering layer. `interactive_first_reward` is opted out of on several diagnostic surfaces rather than met |
| Owner surface | `commands/*.md` frontmatter, validated by `scripts/check-shape-declaration.cjs` (extend to body_shape and layer) |
| Phase | 344, 343 item 4 |

### 2.5 GRAPH - multi-agent coordination. Core question: who does what, in what order, and what state is shared?

| | |
|---|---|
| Implements | resolver `lib/workflow/command-resolver.cjs` (`composeWorkflow`, reads only `data/command-registry.json`, never fabricates); posture authority `lib/core/recipe-maps.cjs` (`postureForCommand`, layered joiner, withhold-default); `autonomous_safe` per command; the one gated loop `lib/core/chain-executor.cjs` (`runChain`, halts at the first material step, Tri-Polar parity with CLI); step dispatch and retry; reach decision `lib/core/navigation-engine.cjs` (`decide`, structured decision function, pure local reader, 1696 lines); `SENSOR_REGISTRY` `lib/core/insight-sensors.cjs:721-802` (20 sensors, canonical order; `dispatchSensors` never mutates routing_source and never calls `decide`); the human reviewer node `gate_render` (3-rung ladder) and `gate_answer` with the shared ledger; multi-step commands pipeline, act (best-pick, chain, swarm), bono (governed swarm `lib/core/bono/*`); the five-perspective meeting fan-out `commands/file-meeting.md:348-443` dispatching `agents/meeting-perspective-extractor.md` (read-only tool grant, no MCP, no Write); harness-as-code `data/harness-policies/` (8 policies, `scripts/run-harness.cjs`); workflow consumers `lib/workflow/f*-consumer.cjs`; worker agents `agents/*.md` |
| Thin or missing | One reviewer node (the navigator) and no watcher roles: no counter-metric, no audit node, no strategy node, no arbitration node. The six loop-vs-graph signals are unwritten as a rule. What flows along a chain edge is not a typed contract |
| Owner surface | `dispatchSensors` -> `decide()` -> resolver (`CLAUDE.md:152`, "no second selection brain"); `chain-executor.cjs` for the loop |
| Phase | 343 (audit node, counter-metric), 345 (strategy node), 346 (arbitration node), 347 (shared state) |

### 2.6 The rule that ties them

A single framework run is a loop: one agent, one validator (the filed artifact), a stopping condition (`stop_gate_check`). A chain is a graph. The decisive signal is who verifies: if the agent can check its own output, loop; if an independent reviewer node must, graph. A step is material exactly when it needs the independent reviewer, which is what `autonomous_safe` versus material already encodes. Every chain in MindrianOS is a graph with exactly one reviewer node, the navigator at the gate. Start with the loop; compose a graph only when the six signals fire (task shape, parallelism, tools per step, auditable roles, fault isolation, who verifies).

## 3. The two-layer split: execution above, ontology below

The transcript's second picture: an upper execution-flow network (agents as nodes, control flow as edges) over a lower semantic network (business objects, semantic relations). Employees can be swapped; the enterprise structure stays.

| | upper layer (execution) | lower layer (ontology) |
|---|---|---|
| MindrianOS | Larry, reaches, sensors, chain executor, gates, worker agents | the room graph (`room.db`, typed claims, SOURCED_FROM provenance) and Theo (frameworks, problem types, chapters, MindrianCommand) |
| answers | who does what, in what order, with what handoffs | what exists and how it relates |
| swap test | the model behind Larry can change (Sonnet, Opus, a trained model) and nothing below moves | changing a claim or a framework relation changes what every agent above can see |
| seam | the plugin's command registry -> Theo's command layer; the sensor registry -> Theo's sensor payload; gate shapes -> ops-schema-parity | measured only where both trees exist (Theo Phase 21) |

Rule, from the transcript and now Theo doctrine: knowledge-graph engineering, GraphRAG, and graph engineering are orthogonal. A node in the agent graph calls GraphRAG; the reverse never happens. Theo recommends a chain as an input; the local resolver owns posture; the gate owns approval.

## 4. ICM nested parts of a room: IS, NEEDS TO BE, GAP

Reference form (icm-architect skill, `references/core.md`): ten invariants, of which the load-bearing ones here are 1 (one folder, one job, stated inside itself), 2 (entry file routes, holds no content), 4 (every working folder carries a `CONTEXT.md`: Inputs, Process, Outputs, Human check), 8 (one home per fact), 9 (the filesystem is the state machine; generated indexes are rebuilt by script, never hand-edited). Five-layer hierarchy: L0 `CLAUDE.md` where am I; L1 root `CONTEXT.md` where do I go; L2 stage `CONTEXT.md` what do I do (the control point); L3 `references/` what rules apply; L4 `output/`. The system-map form adds objects, processes, change-impact cards, and index files.

| part | IS today | NEEDS TO BE | gap |
|---|---|---|---|
| `ROOM.md` (per dir, L0) | identity frontmatter; scaffold `lib/core/room-skeleton-scaffold.cjs:545-620`; read by folder-memory and the engine | L0 identity only, no content | inline-content drift: 5 of 12 sections in the audited dogfood room carried content; Phase 275 shipped drift reporting only |
| `STATE.md` (room, opportunity-bank, funding) | frontmatter phase, role_blend, journey_stage, venture; scaffold plus `compute-state` | generated index, never hand-edited (invariant 9) | half generated, half authored (`isHumanAuthored` skip on `auto_created`); nested STATE.md inside two sections is a second state machine |
| `USER.md` | per-room identity and working style; `lib/core/user-md-ops.cjs` atomic writes | per-user factory material (L3), one home | `identity_write` writes one home-directory file every room reads: two homes for one fact |
| `MINTO.md` (room and per section) | sentinel-bounded governing thought; producer `/mos:mos-reason`; read as leg 3 of the triple | [NAVIGATOR DECISION] a reasoning artifact, or the L2 contract? | three incompatible claims of what L2 is: `templates/icm/CLAUDE.md:16` (STATE.md), `docs/ARCHITECTURE-DEEP-DIVE.md:11` (per-methodology CONTEXT.md), Phase 275 (per-section CONTEXT.md) |
| `CONTEXT.md` (per section, L2) | fixed heading order: Statement, One job, Inputs (working/reference, Do NOT load), Process, Outputs, Human check (Feynman and Minto dual test), Commands that write here; 11 templates; scaffold `room-skeleton-scaffold.cjs:314-380` | the control point of the whole system | the best-realized ICM artifact in the repo, and nothing reads it programmatically: no context leg, no command, no test |
| `references/` (per room, L3) | `SECTION-SCHEMA.md`, `SUB-SCHEMAS.md`; frozen 2-item allowlist | 500-2k tokens of rules read every run: voice, brand, schema, taxonomy | the plugin root holds 22 subdirectories of exactly this and none of it reaches a room |
| `FEYNMAN.md` (per section) | human body plus sentinel-bounded auto timeline; producer `/mos:feynman-timeline-refresh`; renderer and runner in `lib/core/feynman/`; healed by `graph-self-heal.cjs` | generated index, script-rebuilt; it is | two writers on one file (timeline-runner, dial-memory-runner); `connector.excluded` so it never fires contextually |
| `BRAIN.md` (per section) | flat-scalar frontmatter, `author` frozen to "brain"; producer `/mos:brain-derive`; three triggers; read only through `readQuadruple` (Part 8 fence) | L3 reference, derived not authored | `filing: memory_event_only`: the derivation writes no claim node |
| `.reasoning/<section>/REASONING.md` | Minto/MECE from `references/reasoning/*`; `lib/core/reasoning-ops.cjs:378-416`; consumed by `room_graph` reasoning actions and `/mos:grade` | one home per fact | three paths for one idea: `mos-reason` declares `room/**/reasoning/*`, writes per-section `MINTO.md`, `reasoning-ops` writes `.reasoning/<section>/REASONING.md` |
| `.mindrian/room.db` | SQLite nodes and edges, provenance, bitemporal, review_status | a queryable graph with measured integrity | integrity unmeasured (Phase 343); stale `.room-graph/` name in two skip-lists |
| `.snapshots/` | dated STATE copies; `scripts/generate-snapshot.cjs` | an underscore-prefixed meta folder with an index of what changed | dot-prefixed; no change index |
| `.context/` | last-session, methodology-history, rejection-log, weekly-digest | its own CONTEXT.md, declared producers and consumers | none declared |
| `.intelligence/` | sentinel alerts and digests from `/mos:scout` | a product (L4) folder | sits in a dot-dir beside meta dirs |
| three memory layers | within-session `.mindrian/jtbd-state.json`; across-session `~/MindrianRooms/.memory/jtbd-history.json`; cross-room Brain Mode A plus filesystem Mode B | memory as part of the context layer (corpus edge) | only layer 1 lives in the room; `/mos:memory` files nothing back |
| `opportunity-bank/`, `funding/` | real sections since Phase 275; sub-schemas in `references/SUB-SCHEMAS.md`; `lib/core/opportunity-ops.cjs` | one sequential pipeline, both directions in both L2 contracts | funding covers the non-dilutive half only; nested STATE.md |
| `personas/` | six-hat lens files from `/mos:persona` | one home | path drift: declares `room/team/ai-personas/*`, reads `room/personas/` |
| vault MANIFEST | export-time JSON inside the snapshot generator only | a generated room index | no MANIFEST file exists in a room |
| `seeds/` | does not exist in a room (dev repo only) | [NAVIGATOR DECISION] a room part at all? | listed in Phase 344 (2); zero implementation |
| fleet root `CLAUDE.md`, `INDEX.md` | `templates/icm/CLAUDE.md` (31 lines, routing only, correct L0); `INDEX.md` hand-maintained table shipped empty; `.rooms/registry.json` the machine index | L1 generated, never hand-edited | duplicated entry files that drift (the anti-pattern named at `icm-architect/SKILL.md:106`); a third incompatible L0-L4 mapping |

## 5. Cross-cutting ICM gaps

1. No room-level `CONTEXT.md` (L1). Phase 275 shipped L1 as a per-section STATEMENT field and L2 as per-section `CONTEXT.md`; the room root has identity, state, reasoning and user files and no router.
2. No objects, processes, or change-impact cards. Nothing answers "what else moves if I change X"; the room graph could, no artifact does.
3. The L2 contracts have no consumer. The best ICM artifact in the codebase is inert.
4. Four incompatible statements of what ICM L0-L4 map to: `.claude/includes/architecture.md:7-11`, `docs/ARCHITECTURE-DEEP-DIVE.md:9-13` (names a `ROUTING.md` that does not exist), `templates/icm/CLAUDE.md:13-17`, `docs/MINDRIAN-CANON.md:759-768`. [NAVIGATOR DECISION] which one is canonical; the other three become links.
5. Phase 275 left L4 (the factory-product split) report-only by design; invariant 5 is declared, not enforced.
6. Phases 290 (fractal memory contract), 332 (provenance sidecar), 334 (room walk-test against the ICM reference form) are registered and unbuilt; the walk test, ICM's own validation instrument, has never run against a MindrianOS room as a gate.

## 6. Learning to phase trace

| transcript learning | phase |
|---|---|
| five-rung ladder; accumulation not substitution | Plugin 344 |
| loop as a special case of graph | Plugin 344, 343.4 |
| Goodhart: pair every metric with a watcher | Plugin 343.3; Theo 22 (guarded_by, queued) |
| blind upward movement: a slower strategy node | Plugin 345 |
| conflict: an arbitration node | Plugin 346 |
| measurement decay: an independent audit node | Theo 21; Plugin 343.1-2 |
| six loop-vs-graph signals; material = needs the reviewer | Plugin 343.4 |
| node, edge, shared state; clean context per node; readable routing | Plugin 347 |
| orthogonality; ontology is the lower layer, agents swap | Theo CLAUDE.md rules 1 and 5 (doctrine) |

## 7. Open decisions for the navigator

- [NAVIGATOR DECISION] Canonical L0-L4 mapping (gap 5.4).
- [NAVIGATOR DECISION] Is `MINTO.md` the L2 contract, or is per-section `CONTEXT.md`, with MINTO a reasoning product under it?
- [NAVIGATOR DECISION] Single owner surface for the PROMPT layer.
- [NAVIGATOR DECISION] Does a room carry `seeds/` at all?
- [NAVIGATOR DECISION] One context assembler, or two with a shared budget authority?
