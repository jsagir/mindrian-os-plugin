# The Layer Contract

Status: Active
Sibling contract: `docs/LAYER-DECLARATION-CONTRACT.md` (the frontmatter mechanics: which surfaces declare, the closed vocabulary's home, the WD-1 through WD-12 decision ledger)
Vocabulary home: `data/layer-declaration-schema.json` (the closed `layer_vocabulary` and the six-step classification rubric; this document explains that schema in prose, it does not restate it)
Superseded draft: `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` (the dated measurement this contract promotes; keep it as the historical baseline, do not re-derive from it)
Implementing phase: 344 (the layer contract: name, describe, and pin every engineering layer of MindrianOS)

This is the architecture half of a two-part doctrine. `docs/LAYER-DECLARATION-CONTRACT.md` is the mechanical half: it says which surfaces carry a `layer:` scalar and where. This document says what each rung means, what implements it today with real file paths, what is thin, and which single surface a future change to that rung must go through.

---

## 1. Why the layers exist and what accumulates

The graph-engineering transcript this phase is grounded in draws a ladder of five engineering scopes, each one wider than the one before it, and states two rules about how they relate:

1. **The layers accumulate, they do not substitute.** A good graph node is a well-designed loop; a good loop needs a solid harness. Skipping a lower rung does not make a higher rung easier, it makes it fragile.
2. **A loop is a special case of a graph:** one node, one self-edge. The two are not different families of thing; a loop is what a graph looks like when it never needs a second node.

The consequence this repo cares about follows directly from the corpus grounding in section 2 below: the ICM nested parts (`ROOM.md`, `STATE.md`, per-section `CONTEXT.md`, and the rest) are the CONTEXT layer in file form, and the harness is the machinery that reads and writes them. A room's folder structure is not a separate invention sitting beside the five-rung ladder; it is what CONTEXT looks like when CONTEXT is implemented as files on a disk instead of tokens in a window.

---

## 2. Corpus grounding

What the langtalks corpus itself says about how the five rungs relate, pulled in `344-LANGTALKS-CONSULT.md` (2026-09-14, confidence EXTRACTED unless marked). Every claim below carries its hop count and its source; a row that rests on one source says so in the row, per honesty clause 1 and honesty clause 2.

| relation | hops | sources | what it licenses this document to claim |
|---|---|---|---|
| Prompt Engineering `part_of` context engineering | 1 | the corpus edge, `relationship_path` | PROMPT may be read as nested inside CONTEXT rather than a fully independent peer rung; section 3 keeps both as separate rung sections and cites this edge as the reason they sit adjacent |
| Harness Engineering `builds_on` context engineering | 1, single-sourced | the graph-engineering note only. Before that note was ingested, no source connected the two directly: `Fragmented #307` reached context engineering only at 3 hops, via Blast Radius and File | the CONTEXT-to-HARNESS seam is grounded, but this document must say plainly that it rests on exactly one source (see the paragraph below the table) |
| Loop engineering `builds_on` Harness Engineering | 1 | the corpus edge, `relationship_path` | the HARNESS-to-LOOP seam sits on ordinary corpus footing, no single-source caveat needed |
| Graph engineering `builds_on` / `compares_to` Loop engineering | 1 | the corpus edge, `relationship_path` | the LOOP-to-GRAPH seam is grounded; the `compares_to` half of the edge is what licenses the inclusion claim in section 1 (a loop is a special case of a graph) |
| Graph engineering x Interpretable Context Methodology (ICM) | 3-hop only | 0 shared sources at 1 hop; the only path found is a 3-hop route via Agent and context engineering, `multihop` | there is no direct corpus claim connecting the agent-graph rung to ICM as room-as-context; this document does not assert one. Closing this gap is a named follow-up (see the note at the end of this section), not something this document may quietly answer |
| Memory `part_of` / `builds_on` context engineering; Shared state `builds_on` Memory | 1 | ep55 Context Engineering; ep57 Memory (Qodo); ep63; ep65; Lex #490; the graph-engineering note | licenses stating memory as a sub-part of CONTEXT rather than a rung of its own, and licenses GRAPH's shared-state claim (section 3) as resting on this same grounding |
| Graph engineering `compares_to` Knowledge Graph Engineering; `compares_to` GraphRAG | 1 hop each | the corpus edges, `relationship_path` | licenses the orthogonality rule in section 5: a node in the agent graph calls GraphRAG, never the reverse |
| Graph engineering `builds_on` Execution layer; `compares_to` Ontology; Ontology `part_of` Ontology layer | node-level | `query_relationship` (filtered) over the corpus nodes | licenses the two-layer split in section 5 as a corpus fact, not just this document's own reading of the transcript |
| Counter-metric reviewer node, Strategy node, Arbitration node, Audit node, and a checks-and-balances node `part_of` Graph engineering | node-level | `query_relationship` (filtered) over the corpus nodes | licenses naming these watcher roles in section 4 as corpus-grounded, for Phases 343, 345, 346 and Theo 21 to build the operating rule on, not invented here |
| Agent Harness sources | direct | `get_entity`: SDS 985 (four memory types), Vanishing Gradients 57 (LLM judges), the graph-engineering note; and separately for Blast Radius: `Fragmented #307`, ep68 AI-SDLC, Graphify-vs-GitNexus | licenses the HARNESS rung's own citation list in section 3 |
| Graph engineering as extracted corpus content | ABSENT | not in the corpus yet as structured content. The video transcript note exists as a source the corpus can point at (it is the single source behind the context-to-harness seam above), but its own claims, the watcher roles, the six loop-vs-graph signals, the loop-is-a-special-case-of-graph rule, have not landed as extracted, corroborated nodes the way HARNESS's citation list has | the GRAPH rung in section 3 cites the structured transcript note directly rather than the corpus, and says so, because the extraction has not landed (honesty clause 3) |

**Applying honesty clause 2 by name:** the context-to-harness seam is the one place in this table where a rung's own grounding rests on a single source. Before the graph-engineering note entered the corpus, nothing connected context engineering to Harness Engineering directly; the closest path, through `Fragmented #307`, reached context engineering only at 3 hops via Blast Radius and File, which is not a direct claim. The note is the sole bridge. This document treats the CONTEXT-to-HARNESS rung boundary as real and citable, but single-sourced, and states that here rather than letting the table's format imply the same multi-source confidence the rows above and below it carry.

A named follow-up, not part of this phase: after this contract lands, a fresh multihop query of graph engineering against Interpretable Context Methodology still returns 0 shared sources until this contract document itself is ingested into the corpus as a research note. Ingesting it is a separate, later act.

---

## 3. The five rungs

Five sections, one per member of `data/layer-declaration-schema.json`'s `layer_vocabulary` excluding `none`. Each carries the same six subsections in the same order. Where the superseded draft carried an open `[NAVIGATOR DECISION]` marker in the owner-surface cell, the marker stays and a dated ruling line is added beneath it once the 344-03 checkpoint ruled that row, per honesty clause 4: a marker stays a marker, a ruling is added beneath it, never in place of it.

## PROMPT

### Definition
One request. The wording, persona, and voice the model receives before it reasons about anything else.

### Core question
Did I ask well?

### Implemented by
- Larry persona, `agents/larry-extended.md:34-45`
- Persona variants, `agents/larry-extended.md:15-27`
- MCP handshake instructions, `lib/mcp/runtime-instructions.cjs:24-46` (a fixed byte budget, silent truncation past the host cap, guarded by its own budget test `lib/mcp/no-instructions.test.cjs`)
- Voice references, `references/personality/*`
- Output style, `output-styles/destijl.md`
- Voice enforcement, `scripts/check-voice-style.cjs`
- The per-command firing block injected into every `commands/*.md` file (count it at any time with `node scripts/check-layer-declaration.cjs --json`'s `by_class.command` key; never a number frozen into this document)

### Above and below
PROMPT has no rung below it; it is the innermost scope. Above it sits CONTEXT, via the corpus edge Prompt Engineering `part_of` context engineering (1 hop, section 2).

### What is thin or missing
Most persona variants are byte-identical to the default persona; the variation the vocabulary implies mostly does not exist yet. Persona text itself lives in five different places with no single source: agent frontmatter, the MCP handshake instructions, `references/personality/`, `skills/larry-personality/SKILL.md`, and the firing block copied into every command file. That is an ICM invariant 8 breach, one home per fact, broken five ways for the same fact.

### Single owner surface
`[NAVIGATOR DECISION]` none exists today; candidate: `skills/larry-personality/SKILL.md` as the single source, everything else generated from it.

RULED 2026-09-14 (WD-3, ratified at the 344-03 checkpoint): the PROMPT owner surface is `skills/larry-personality/SKILL.md` as the single source, everything else generated. The ruling is scoped to a declaration only; the generation step, making the other four homes actually generated FROM that file instead of independently authored, is a follow-up phase's work, not this document's.

## CONTEXT

### Definition
What the model can see this turn. Every fact assembled into the window before it starts reasoning.

### Core question
Does it have the right information?

### Implemented by
- `context_assemble` tool, `lib/mcp/tools/context.cjs:36-47`, over `getRoomContext`, `lib/core/navigation/room-context.cjs:244+` (four legs: room-state summary, session fragments, ranked graph neighborhood, projected cortex with recency decay)
- SessionStart coordinator, `scripts/sessionstart-coordinator.cjs`, driven by the precedence ladder `lib/sessionstart/precedence-ladder.cjs:22-34`
- TRIPLE_CONTEXT formatter, `lib/memory/triple-context-formatter.cjs`
- UserPromptSubmit hooks: the intent classifier, jtbd-update, brain-derivation drain, auto-explore drain, mva-detect, first-install router, operator-update, and the admin gate
- DirectiveEnvelope, `lib/core/directive-envelope.cjs:1-40` (six declared modes, GUIDED default)
- JTBD state, `lib/hmi/jtbd-state.cjs:27`
- The files read as context: `ROOM.md`, `STATE.md`, `USER.md`, `MINTO.md`, `BRAIN.md`, `FEYNMAN.md`, all via `lib/core/folder-memory.cjs:200-303`

### Above and below
Below it, nested inside it, is PROMPT (the same corpus edge cited in PROMPT's own "Above and below"). Above it is HARNESS, via Harness Engineering `builds_on` context engineering (1 hop, single-sourced, honesty clause 2 applies, see section 2).

### What is thin or missing
Two context assemblers exist with two different budgets and no shared authority: the MCP path (`context_assemble`, token-budgeted) and the CLI hook path (the precedence ladder plus the formatter, character-budgeted). They can disagree about what the model sees depending on which surface is running. Separately, the per-section `CONTEXT.md` contract, the single best-realized ICM artifact in this repo, has zero code consumer: nothing reads it as a context leg, no command loads it, no test checks it.

### Single owner surface
`[NAVIGATOR DECISION]` candidate: `getRoomContext` as the one assembler, with the hook path calling it and passing a budget argument instead of running its own parallel logic.

RULED 2026-09-14 (WD-5, ratified at the 344-03 checkpoint): one context assembler is the goal. This phase declares that goal and measures the two existing budgets; it changes no assembly path. The marker stays open on the code question because the unification itself has not been built, only the target has been ruled.

## HARNESS

### Definition
Tools, memory, and scaffolding. What lets an agent act on the world and remember what it did.

### Core question
Can it act on the world and remember?

### Implemented by
- Core MCP tools across `lib/mcp/tools/`, plus `room_bind` and the grouped routers in `lib/mcp/tool-router.cjs:195-376`
- Two constitutionally distinct chokepoints: READ through `lib/core/navigation.cjs` (a closed function surface, guarded at pre-commit, with bypass telemetry) and WRITE through `lib/core/node-insert.cjs` (Canon Appendix D entry 39)
- The local graph, `<room>/.mindrian/room.db`, `lib/core/room-db.cjs:255-257` (`node:sqlite`, typed nodes, many edge types)
- Memory: `memory_event` append-only with a 60-second dedupe window, folder memory, the cortex packet, governance
- The gate ledger, `lib/mcp/gate-ledger.cjs` (in-memory, session-keyed, single-use, time-limited)
- Hooks, `hooks/hooks.json` (the Part 8 egress guard among them)

### Above and below
Below it is CONTEXT (the same context-to-harness edge cited above, single-sourced per honesty clause 2). Above it is LOOP, via Loop engineering `builds_on` Harness Engineering (1 hop, section 2).

### What is thin or missing
The frontmatter layer-declaration gap this section of the draft originally flagged (no command or tool stated its own engineering layer) is the gap this same phase closes in `344-02` through `344-04`; `node scripts/check-layer-declaration.cjs` now reports zero undeclared surfaces, so that specific item is resolved rather than repeated here as still-open. What remains genuinely thin: the gate ledger is in-memory only, so a halted chain is unresumable across a process restart. `graph_write`'s CAS guard fails open on a missing node, a disclosed and unmeasured risk. The path `.room-graph/` survives in two stale skip-lists while the real path is `.mindrian/room.db`. `seeds/` exists only in the dev repo, never inside an actual room (and per WD-4, is ruled out of the ICM part list entirely, not a room part awaiting implementation).

### Single owner surface
`lib/core/navigation.cjs` for every read, `lib/core/node-insert.cjs` for every write, the two chokepoints Canon Appendix D entry 39 names as constitutionally distinct. Both are reached only through one registration door, `lib/mcp/register-core-tools.cjs`: a new HARNESS surface forks into a read half and a write half, but has exactly one place it is wired in.

## LOOP

### Definition
One agent's cycle with a stopping condition. A single bounded run that checks its own work and knows when to stop.

### Core question
When does it check its work, and when does it stop?

### Implemented by
- One `/mos:<framework>` run, the shape every file in `commands/*.md` uses
- `body_shape` frontmatter (methodology, E, "E (Action Report)", C, B, F.1, and other values; see `data/layer-declaration-schema.json`'s own `body_shape_vocabulary_note` for the measured census and the exact command that produced it; normalizing this vocabulary is WD-9, deliberately deferred)
- `hitl_shape` frontmatter across its declared values, checked ADVISORY by `scripts/check-shape-declaration.cjs`
- `hitl_stages` on multi-stage surfaces (pipeline, act, bono)
- Connector frontmatter, the loop-to-graph seam
- Artifact filing, `lib/mcp/tools/views.cjs` (`artifact_file`, a typed claim plus `SOURCED_FROM` provenance)
- The stop condition: `stop_gate_check`, `lib/mcp/stop-gate-handler.cjs`, and the CLI Stop hook `scripts/check-card-fire.cjs`
- The next-move surfaces: `suggest_next` and `reach_candidates`
- The Ask-Tell dial, `skills/larry-personality/SKILL.md`, rendered by `lib/core/nav-dial.cjs`

### Above and below
Below it is HARNESS (the same harness-to-loop edge cited above). Above it is GRAPH, via Graph engineering `builds_on` / `compares_to` Loop engineering (1 hop, section 2); the `compares_to` half of that same edge is what licenses "a loop is a special case of a graph" in section 1.

### What is thin or missing
`body_shape` has no schema and no validator: two spellings of what should be one shape exist side by side, and a full prose sentence leaked into one value where a short label belonged. The layer-declaration gap this section of the draft originally named here (no command declares its engineering layer) is the exact gap `344-02` through `344-04` closed; it is not repeated as open. What remains thin: `interactive_first_reward` is opted out of on several diagnostic surfaces rather than genuinely met.

### Single owner surface
`commands/*.md` frontmatter, its `layer:` field validated by `scripts/check-layer-declaration.cjs` (shipped in `344-02`). That gate is a sibling of `scripts/check-shape-declaration.cjs`, not an extension of it, a deliberate 344-01 decision so a brand-new fail-closed signal is not buried inside a gate that already carries dozens of open advisory warnings.

## GRAPH

### Definition
Multi-agent coordination. More than one step over shared state, with an independent reviewer at the material forks.

### Core question
Who does what, in what order, and what state is shared?

### Implemented by
- The resolver, `lib/workflow/command-resolver.cjs` (`composeWorkflow`, reads only `data/command-registry.json`, never fabricates a step)
- Posture authority, `lib/core/recipe-maps.cjs` (`postureForCommand`, a layered joiner with a withhold-by-default posture)
- `autonomous_safe` per command
- The one gated loop, `lib/core/chain-executor.cjs` (`runChain`, halts at the first material step, Tri-Polar parity with the CLI)
- Step dispatch and retry
- Reach decision, `lib/core/navigation-engine.cjs` (`decide`, a pure local reader, a structured decision function)
- The sensor registry, `lib/core/insight-sensors.cjs:721-802` (canonical order; `dispatchSensors` never mutates `routing_source` and never calls `decide` itself)
- The human reviewer node, `gate_render` (a graduated ladder) and `gate_answer`, sharing the gate ledger
- Multi-step commands: pipeline, act (best-pick, chain, swarm), bono (a governed swarm, `lib/core/bono/*`)
- The five-perspective meeting fan-out, `commands/file-meeting.md:348-443`, dispatching `agents/meeting-perspective-extractor.md` (a read-only tool grant, no MCP, no Write)
- Harness-as-code, `data/harness-policies/`, run by `scripts/run-harness.cjs`
- Workflow consumers, `lib/workflow/f*-consumer.cjs`
- Worker agents, `agents/*.md`

### Above and below
Below it is LOOP (the same loop-to-graph edge cited above). There is no sixth rung above GRAPH in the corpus ladder. The corpus does hold a path from GRAPH toward Interpretable Context Methodology, but only at 3 hops with 0 shared sources at the direct level (section 2); this document does not treat that as a grounded adjacency, only as the gap that motivated ingesting the graph-engineering note in the first place.

### What is thin or missing
One reviewer node exists today, the navigator at the gate, and none of the watcher roles the corpus names exist yet: no counter-metric node, no strategy node, no arbitration node, no audit node. The six loop-versus-graph signals (see section 4) are unwritten as an operating rule anywhere in the repo. What flows along a chain edge from one step to the next is not a typed contract today, it is whatever shape the previous step happened to produce.

### Single owner surface
The one governed reach path, `dispatchSensors` -> `decide()` -> the resolver (`CLAUDE.md`'s own "no second selection brain" rule). `lib/core/chain-executor.cjs` walks a chain this path has already resolved; it does not select one. A new coordination path is wired through the same reach path, never a second one.

---

## 4. The rule that ties them

Who verifies is the decisive signal. A single framework run is a loop: one agent, one validator (the artifact it files), a stopping condition (`stop_gate_check`). A chain is a graph. If the agent can check its own output, it is a loop; if an independent reviewer node must check it, it is a graph. A step is material exactly when it needs that independent reviewer, which is what `autonomous_safe` versus a material step already encodes today. Every chain in MindrianOS is currently a graph with exactly one reviewer node: the navigator, at the gate.

Start with the loop. Compose a graph only when the corpus's six signals fire: task shape, parallelism, tools per step, auditable roles, fault isolation, and who verifies. The corpus separately names watcher roles that a graph can carry beyond the one reviewer it has today: a counter-metric reviewer node, a strategy node, an arbitration node, and an audit node (section 2). Writing the six signals and the watcher roles up as an operating rule other surfaces can consult is Phase 343 item 4's deliverable. This document names the rule and its grounding; it does not build the rule engine.

---

## 5. Execution above, ontology below

The transcript's second picture, corpus-grounded (section 2, the two-layer split edge): an upper execution-flow network, agents as nodes and control flow as edges, sits over a lower semantic network, business objects and their relations. Employees can be swapped; the structure underneath stays.

| | upper layer (execution) | lower layer (ontology) |
|---|---|---|
| In MindrianOS | Larry, reaches, sensors, the chain executor, gates, worker agents | the room graph (`room.db`, typed claims with `SOURCED_FROM` provenance) and Theo (frameworks, problem types, chapters, MindrianCommand) |
| Answers | who does what, in what order, with what handoffs | what exists and how it relates |
| The swap test | the model behind Larry can change (a different Claude generation, a trained model) and nothing below it has to move | changing a claim or a framework relation changes what every agent above can see |
| Where the seam sits | the plugin's command registry meets Theo's command layer; the sensor registry meets Theo's sensor payload; gate shapes meet ops-schema-parity | measured only where both trees exist today (Theo Phase 21) |

The corpus's own orthogonality rule (section 2): knowledge-graph engineering, GraphRAG, and graph engineering are three different, non-overlapping things. A node in the agent graph calls GraphRAG; the reverse never happens, a node inside the ontology never reaches up and calls the execution layer. Theo recommends a chain as an input; the local resolver owns the posture; the gate owns the approval. Each stays on its own side of the seam.

---

## 6. Layer is not lane

`data/help-groups.json` carries a `lane` axis (`start`, `methodology`, `explore`, `view`) answering "what is the user trying to do right now." `layer` answers a different question entirely: "what scope of the system does this surface engineer." The two axes sit over the same command set and neither one can be derived from the other. A `start`-lane command can engineer any of the five rungs; a `methodology`-lane command is usually a LOOP but nothing requires it to be one. This document does not collapse the two axes into one, and section 7 names the one place they meet without merging.

---

## 7. The help family map interface

The layer label the help family map will use is READ from `data/command-registry.json`'s `layer` field, which is itself generated from each command's own frontmatter, never hand-typed a second time. `data/help-groups.json` is NOT modified by this phase and must not gain a `layer` key. Adding one there would put a fact about a single command somewhere other than that command's own file, it would add a seventh hard-fail condition to a coverage gate (`scripts/check-help-coverage.cjs`) that already blocks commits on six, and it would create a hand-maintained duplicate of a fact the command registry already generates. One home per fact holds here the same way it holds everywhere else in this contract.

The join site is `scripts/help-renderer.cjs`: a per-command map keyed on the `/mos:<name>` form, built once at the top of the renderer, the same shape `commandsForLane` and `groupsForLane` already use to join `data/help-groups.json` against each command's `help_jtbd` frontmatter. Building that render, extending the renderer to actually show a layer label per card, is Phase 343 item 4's work; this document names the interface, it does not build against it.

The read-time proof, rather than a stored number: `node scripts/check-layer-declaration.cjs --json` emits `total`, `declared`, `undeclared`, `exempt`, a `by_layer` object with one integer per vocabulary member, and a `by_class` object with one integer per surface class (`command`, `agent`, `pipeline`, `skill`, `mcp-tool`). That command, run fresh, is where a per-layer count comes from. This document does not freeze a number from it; the observed distribution at the time this document was written is recorded in `344-06-SUMMARY.md`, not here, because a summary is a dated snapshot and this contract is not.

---

## 8. Amendment ledger

A change to a rung's owner surface or to the vocabulary itself requires a new row in this ledger, dated and with a stated reason. A change to a cited file path that simply moved is a correction, not an amendment, and is fixed inline without a ledger row. This contract is a repo contract, not a Canon amendment: promoting the layer mandate to a Canon Part 11 born-clause is a separate, later, navigator-governed act, tracked as WD-8 in the sibling declaration contract and handed to Phase 340's own governance process, not decided here.

| date | amendment | reason | ruled by |
|---|---|---|---|
| 2026-09-14 | Created from `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` under Phase 344 | Promotes the dated measurement draft into a pinned contract: one section per rung, every claim cited by file path or by corpus source and hop count, one owner surface per rung, an amendment trail so the document can change the way a contract changes rather than the way a note changes | Phase 344 |
| 2026-10-06 | Section 9 added (ownership and readback, the extracted contract) | The extracted ownership and readback contract from the Room Identity exemplar (the 2026-10-05 brief, section 4), filled for the room identity and for a nest's FeyMinto and mapped onto the rungs above, so waves 2-4 of the operation ledger and the next consolidation phase carry one template instead of each inventing a shape | the navigator, through Phase 369.25 |

## 9. Ownership and readback (the extracted contract, Phase 369.25)

Sections 3 through 7 say which rung a thing sits on and which single surface a change to that rung goes through. They do not say, for one piece of state, who may change it, what proves it changed, who reads it back, and what the system does when the readback fails. Phase 369.25 (the room identity and FeyMinto slice) had to answer those five questions twice, once for the room's identity and once for a nest's reasoning layer, and the answers are the same shape both times. This section keeps that shape so the next phase does not rediscover it.

### The template

One row per piece of state, seven columns, read left to right as a chain: a state has one owner; the owner's evidence is what a reader can check without trusting the owner; a legal transition is the only door that changes the state; the readback is a read by someone other than the writer; the failure behavior is what happens when the readback disagrees; projections are copies that may be rewritten from the state and are never authority.

| state | owner | evidence | legal transition | readback | failure behavior | projections |
|---|---|---|---|---|---|---|
| Room identity: the seven `room.*` keys (`room.room_id`, `room.slug`, `room.canonical_path`, `room.parent`, `room.depth`, `room.created_at`, `room.birth_version`) and the Room node `room:<slug>` in `<room>/.mindrian/room.db` | `lib/core/navigation/room-birth.cjs`, writing only through `writeRoomIdentity` in `lib/core/navigation/room-identity.cjs` | the seven key rows and the Room node in room.db; a value with no source is the literal `unknown`, never a guess; the id is an opaque uuid | birth STEP 2 (one transaction, rolled back with the whole birth on any failure); an approved `repairRoomIdentity` (sources: the registry, `.room-root`, ROOM.md; invents nothing; a minted id is named `minted_by_repair`); an approved recovery through the heal net (`runDeriveBackfill`, behind its existing approval) | `readRoomIdentity` by the writer on a fresh connection before birth reports ok (STEP 4b, the copy door); a different reader: `doctor --icm-walk` through the read-only door with its own SQL, never the writer's library (`lib/core/doctor/icm-walk-module.cjs`); the working sequence create, register, bind, inspect, write, read back, restart, inspect again (`tests/test-36925-working-sequence.cjs`) | `not_ready` with one typed reason (`room_db_missing`, `room_db_unreadable`, `identity_missing`, `identity_incomplete`, `identity_path_mismatch`, `registry_missing_room`), plus `room_db_not_writable` and `room_graph_lost` from the readiness layer; refusal is per operation (governed write, research, the FeyMinto face; status is never blocked) through `lib/core/room-readiness.cjs`; a recovery card answered through `gate_answer` (`lib/mcp/room-readiness-gate.cjs`); a legacy room with no recorded id keeps working and shows the gap; the release gate proves the research doors refuse (the negative leg, below) | ROOM.md `icm_self.room_id`, `.room-root`, the registry entry, the room-map root node, and the `room_id` the MCP resolvers and tool answers report; all regenerated from room.db, none read as authority |
| A nest's FeyMinto: the three faces `MINTO.md`, `FEYNMAN.md`, `BRAIN.md` (the Theo face), keyed to the room id, and the generated `BRIEF.md` | the MINTO generator (`scripts/vault-section-minto-generator.cjs`) for `MINTO.md` and the `FEYNMAN.md` blocks (`lib/core/feyminto/feynman-blocks.cjs`); `lib/core/brain-derivation.cjs` for `BRAIN.md`, composed by `lib/core/feyminto/theo-ask.cjs` and `theo-face.cjs`; `renderBriefForSection` over `lib/core/feyminto/brief.cjs` for `BRIEF.md`; the one next move in `lib/core/feyminto/next-move.cjs` | per-face frontmatter: the room id, which fields a person may edit and where the edit is recorded, and for the Theo face the handles sent, the query count and the time or the reason it was not asked; the brief's record-basis fingerprints over its input files; invariants FEYNMINTO-11 (the face names the room.db id), FEYNMINTO-01 (the FEYNMAN size contract) and FEYNMINTO-12 (the MINTO size contract) in `lib/core/feynman-minto-invariants.cjs` | the debouncer regeneration and `generator --write`; the staleness queue for the Theo face; the on-stop render of `BRIEF.md`, rewritten only when its record basis moved; the guardian's session-start enqueue for a critical identity violation | the guardian validators (`lib/memory/validators/room-identity-invariants.cjs`, `minto-invariants.cjs`); `doctor --icm-walk` rows I6, I8b and I8c; session start recomputing the record basis against the brief file before it injects | `not asked` with one reason from a closed set (at birth, offline, Theo unavailable, egress blocked, no handle to send, room not ready), never `(no signal)` for a question that was not asked; a stale brief says which input moved; a violation of the identity invariant is critical and names the repair; the face is read at tier 0 while it holds no Theo content | `BRIEF.md`; the active nest's first three blocks at session start and in `context_assemble` (`feyminto_brief`); `suggest_next`'s `next_move`; `decide()`'s `ctx.tierCandidates`; the tool footers that now point at one decision path |

### Where each state sits on the rungs

The Layer Contract's rungs come from `data/layer-declaration-schema.json`; this table names the rung from that vocabulary, the owner surface that already sits there, and the test that proves the row. It uses the brief's component-map columns (section 3 of the 2026-10-05 brief).

| job | existing component | layer | decision owner | transition writer | evidence and readback | consumers | failure state | test |
|---|---|---|---|---|---|---|---|---|
| Name the room and prove it exists | the room identity in room.db | HARNESS (the local graph and its single write chokepoint) | the navigator, by approving birth or a repair | `room-birth.cjs` through `room-identity.cjs` | the seven keys and the Room node; read back by `readRoomIdentity` and, from a different door, `doctor --icm-walk` | binding (`session-binding.cjs`), the MCP resolvers (`lib/mcp/session-room.cjs`), the guardian, FeyMinto | `not_ready` with a typed reason; `room_graph_lost` | `tests/test-36925-rid-birth.cjs`, `rid-repair`, `rid-reader`, `working-sequence`, `readiness-gate` |
| Refuse work on a room that cannot hold it | the readiness layer | HARNESS (tools and hooks) | the navigator, by answering the recovery card | `lib/core/room-readiness.cjs`, `lib/mcp/room-readiness-gate.cjs` | the requirement line on every refusal; the tree unchanged after a refusal | `resolveMcpWriteRoom`, the research planner CLI, `context_assemble`, session start | refusal naming the failed requirement; a card for the recoverable reasons | `tests/test-36925-readiness-gate.cjs`, `tests/test-36925-negative-leg.cjs` |
| Say what a nest currently thinks and what it asked | a nest's FeyMinto faces | CONTEXT (the files read as context, section 3) | the person, in the governing thought and the YOUR DECISION block only | the generator, `brain-derivation.cjs`, the debouncer | per-face frontmatter and invariants FEYNMINTO-01, -11 and -12; read back by the guardian and the walk | session start, `context_assemble`, the navigation engine | `not asked` with a reason; a critical identity violation | `tests/test-36925-feyminto-identity.cjs`, `feyminto-faces`, `theo-wiring` |
| Show a returning person the nest on one page | `BRIEF.md` | CONTEXT | the person (the one editable block) | `renderBriefForSection` on stop and after a MINTO write | the record-basis fingerprints; recomputed at session start | session start, `context_assemble`, `suggest_next` | a stale marker naming the moved input | `tests/test-36925-brief-wiring.cjs`, `injection`, `practical` |
| Offer one next move | `nextMoveForSection` and `decide()` | GRAPH (the one reach path, section 3) | the person, on a card named by its job | `next-move.cjs`, read by `navigation-engine.cjs` | the move's sources, listed beside it | `decide()`, `suggest_next`, the tool footers | `no_runnable_primary`, then the ledger as the labeled fallback | `tests/test-36925-next-move.cjs` |

### The negative leg

A readback proves a state exists when it should. The negative leg proves the opposite: that a failure reports as a failure. The release rule's real-room run now builds rooms whose record is broken on purpose (room.db missing, room.db corrupted, room.db deleted and silently recreated empty) and requires every research door (quick, deep, Eureka, analogies) to refuse each one with a typed reason and to write nothing. The receipt records the leg and release.sh Step 2.6 refuses a receipt whose leg is missing or in which any job ran. Any future state with a readback gets a matching broken-on-purpose case here.

### How later phases carry it

The operation ledger (369.2 waves 2 to 4) and the next consolidation phase carry this template under their own names. A new piece of state arrives with a filled row (one owner, its evidence, its only legal transition, a readback by a different reader, its failure behavior and its projections) and the rung it sits on from `data/layer-declaration-schema.json`, and it is not called finished until the readback and the failure case both have a test. This section is the extracted contract; the Room Identity row is its exemplar, and the surface registry in `data/command-registry.json` is where an invocable surface is declared, not where state is owned.
