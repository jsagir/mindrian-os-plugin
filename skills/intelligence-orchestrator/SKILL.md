---
name: intelligence-orchestrator
description: >
  The reach dispatcher. Consumes the SENS sensor spine (lib/core/insight-sensors.cjs::dispatchSensors),
  maps each candidate-reach to an intelligence sub-mode by READING data/connector-registry.json (never a
  hardcoded routing table), applies posture and one-reach-per-beat gating via the Intelligence Hierarchy,
  surfaces ONE reach as a Shape-F Decision Gate, and never auto-executes. On APPROVE it resolves the real
  command through the WFL-01 resolver and files the result. Active when an insight sensor fires in a room.
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
canon_parts: [Part 2, Part 3, Part 4, Part 8, Part 9]
phase: 143.3
consumes: lib/core/insight-sensors.cjs::dispatchSensors
resolver: lib/workflow/command-resolver.cjs
registry: data/connector-registry.json
dispatch_map: data/dispatch-framework-map.json
reach_ids: [context_block, contradiction, cross_room, brain_consult, deep_research, hats]   # the frozen 6 - NEVER a 7th
posture_ids: [push_forward, hold, pull_back]                                          # the frozen 3
filing: fileEvidenceWithReadback (fallback wireAccept)                                # decision 2
live_call: dispatchSensors, gated behind tier_mode (degrade to doctrine-sim at tier_0) # decision 1
allowed-tools: Read Bash Agent WebSearch WebFetch mcp__pinecone__search-docs mcp__brain_*
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on infra. The ONE spine that READS the connector registry and dispatches reaches; the orchestrator itself is the dispatcher, never a dispatched reach, so it is excluded by construction."
hitl_shape: "F.0"
hitl_why: "Every dispatched reach is offered through the room-proactive APPROVE/REJECT/DEFER mini-gate (F.0) before the resolved command fires; the dispatched reach's own connector.surface governs only what happens after APPROVE."
---

# Intelligence Orchestrator -- The Reach Dispatcher

This skill is the FIRST CONSUMER of the SENS sensor spine and the FIRST READER of
`data/connector-registry.json`. The Phase-143 sensor spine has zero production consumers today:
every SENS-0x fires into the void. This skill closes that gap. It is roughly 90% wiring (Canon
Part 7): it CONSUMES six shipped exports and reads the generated registry; it builds no new engine.

The six exports it consumes (it does NOT reimplement them):

- `lib/core/insight-sensors.cjs::dispatchSensors` -- the sensor spine read.
- `lib/workflow/command-resolver.cjs::commandsForFramework` -- the WFL-01 resolver door (on APPROVE).
- `lib/core/navigation/file-evidence-readback.cjs::fileEvidenceWithReadback` + `surfaceFileEvidenceResult` -- filing + the FILEVAL honesty remind.
- `lib/core/findings-wirer.cjs::wireAccept` -- the filing fallback on readback error.
- `lib/agents/reverse-salient-agent.cjs::surfaceFinding` -- the PUSH-02 F.0 gate render.
- `lib/core/sensors/hat-scoping-table.cjs::hatScopeFor` -- the PUSH-06 hat-scoped web scope.

## REGISTRY-IS-THE-TABLE (ORCH-01)

The orchestrator reads `data/connector-registry.json` and NEVER a hardcoded routing table. The
registry is GENERATED from each surface's `connector:` frontmatter by
`scripts/build-connector-registry.cjs` and CI-checked by the `--check` tripwire, so the routing
table can never drift from the surfaces it routes. This is the Connector Contract: any future skill
or command joins the spine by DECLARING a `connector:` block, never by editing this skill.

On a fired sensor:

1. Take the sensor id (e.g. `SENS-02`).
2. Look it up in the registry `sensor_index` -- this returns the surfaces whose `sensor_triggers`
   include that sensor. The `sensor_index` is the inverse map the generator emits exactly for this
   runtime step.
3. For each matching surface, read its connector record from `connectors[]`: the `reach_id`,
   `sub_mode`, `framework`, `posture`, `hierarchy_rank`, `filing`, `plan_gated`, `web_scope`, and
   `decision_surface`.

The registry is the single source of truth for routing. If a sensor has no matching connector in
the `sensor_index`, nothing fires -- silently and honestly (degrade-don't-fabricate). The
orchestrator never invents a reach, never invents a command, and never hardcodes a sensor-to-framework
mapping that the registry does not already carry. Reads the registry; never a hardcoded table.

## The frozen banks (no 7th reach, no 4th posture)

The reach_id is ALWAYS one of the frozen 6, cited verbatim:

`context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`, `hats`.

The posture is ALWAYS one of the frozen 3, cited verbatim:

`push_forward`, `hold`, `pull_back`.

These banks are frozen and drift-tested (`lib/core/sensors/sensor-types.cjs` REACH_IDS / POSTURE_IDS;
the connector `--check` tripwire validates every connector against them). The orchestrator NEVER mints
a 7th reach_id and NEVER mints a 4th posture. The remaining intelligence-tool identities
(reverse-salient, hsi, whitespace, cross-domain-connect, cross-domain-analogy, hat-scoped-research)
live in the `sub_mode` field as a RENDER LABEL under one of the frozen 6 reaches -- they are never a
reach_id. Six-hats is the EXCEPTION: as of Phase 148 D-09 it is no longer a sub_mode render label
under brain_consult; it is now carried by its own first-class `hats` reach (the 6th machine reach).

### Composition rule

- BONO hat sequences ARE the `hats` reach (Phase 148 D-09): six-hats is the 6th machine reach, no
  longer a `sub_mode` render label under `brain_consult`. The team perspective rides the `hats` reach.
- Reverse Salient (RS), HSI, whitespace, and cross-domain analogies compose UNDER `context_block` or
  `brain_consult` as `sub_mode` render labels.
- deep-research IS the `deep_research` reach (the one sanctioned multi-reach exception), not a label
  on another reach.
- There is NO 7th reach_id. `sub_mode` / `whitespace` / cross-domain labels are render labels, period.

## The Part 8 boundary (stated up front)

Every Brain query carries GENERIC framework handles plus phase identifiers plus enum scalars ONLY.
Turn text and artifact bodies NEVER enter `commandsForFramework`, NEVER enter a Brain packet, and
NEVER enter a web query. This is Canon Part 8 (LOCAL data -> BRAIN: NO), stated here once and
reaffirmed in the loop and filing sections below.

Concretely, the orchestrator must never pass user content across these boundaries:

- To the resolver (`commandsForFramework`): pass only the EXACT framework name (a generic
  published-methodology handle) resolved through the dispatch map. Never the turn text, never an
  artifact body, never a slug.
- To the Brain (`mcp__brain_*` / brain-client): pass only generic framework handles, phase ids, and
  enum scalars. Never user-specific strings.
- To the web (WebSearch / WebFetch): pass only a generic topic handle plus the hat and focus from
  `hatScopeFor`. Never the navigator's turn text or artifact body. Web is always hat-scoped (Part 2);
  the Red hat returns `web_enabled: false` (no web at all).

These are not user-content channels. The orchestrator routes generic handles, never user content,
never turn text. Any ambiguity on this boundary defaults to NOT crossing it.

## The 5-step core loop (ORCH-02)

The orchestrator runs one loop per beat. The five steps name the exact shipped functions; there is
no fenced implementation here -- this is directive doctrine, not code.

### STEP 1 -- Read the spine LIVE (tier-gated)

Call `dispatchSensors(turn, tuple, ctx)` (`lib/core/insight-sensors.cjs`). It returns an
`Array<{ reach_id, posture, dispatch, companions, signal, evidence }>`, one entry per fired sensor.
The call is pure, synchronous, and LOCAL; it soft-fails per-sensor (a throwing sensor counts as
"did not fire") and it NEVER mutates `routing_source` and NEVER calls `decide()` (the Phase 144
fence).

GATE: the live `dispatchSensors` result is authoritative ONLY when `brain_md_tier_mode` is `mode_a`
or `mode_b`. At `tier_0` (a cold room) the orchestrator degrades to the doctrine-sim floor -- Larry's
Provoked-table doctrine -- so the skill is safe before Phase 144 lands. This is the ORCH-04 tier
predicate; see the Tier gate section below.

### STEP 2 -- Map each fired reach to its EXACT framework (WFL-01)

For each fired reach, take its `dispatch` handle (and/or the `sub_mode` from the matched connector)
and translate it to the EXACT framework name through `data/dispatch-framework-map.json`. The raw
sensor handle `mos:research` MUST translate to `Hypothesis-Driven Problem Solving` -- never pass the
slug `mos:research` through to the resolver. This is the WFL-01 guard: the dispatch map is the only
sanctioned slug-to-name translation, drift-tested against `data/framework-names.json` so a smuggled
slug or a fake framework fails CI. The `sub_mode` is a render label, never a reach_id; the framework
name is what the resolver keys on.

### STEP 3 -- Gate to ONE (one-reach-per-beat)

When more than one reach fired, rank them by the Intelligence Hierarchy:

Tensions > Bottlenecks > HSI Surprises > Convergences > Blind Spots

then break ties by evidence strength (from each reach's `evidence` scalars and the connector's
`hierarchy_rank`). Exactly ONE reach surfaces per beat. `deep_research` is the SANCTIONED exception:
it MAY chain a multi-angle plan via `composeWorkflow` (plan_gated), so a deep-research escalation can
fan out across hats even though every other reach is one-per-beat.

### STEP 4 -- Offer, never fire

Surface the chosen reach as the connector's `decision_surface` (a Shape-F sub-shape, e.g. F.0 or F.1)
Decision Gate (Canon Part 3). NEVER auto-fire. The orchestrator offers, never fires. Render the gate
using the room-proactive APPROVE / REJECT / DEFER Decision-Capture flow: APPROVE accepts the reach,
REJECT captures the reason (rejection is data, Part 4), DEFER parks it. Generic handles only to the
Brain (Part 8); web is hat-scoped via `hatScopeFor` (Part 2; Red hat = no web). For PUSH-02 the
reach is rendered through `reverse-salient-agent.surfaceFinding` (the F.0 render).

### STEP 5 -- On APPROVE, resolve and fire

On APPROVE, resolve the REAL command via `commandsForFramework("<exact framework name>")`
(`lib/workflow/command-resolver.cjs`) -- the WFL-01 resolver door, the ONLY door. Never hardcode the
`/mos:` slug; never name a command from memory. The framework name passed in is the one the dispatch
map produced in STEP 2. If the resolver returns an empty list, DEGRADE: tell the navigator to "run
<framework> manually" rather than inventing a command. Then fire the resolved command.

This is the resolver discipline copied from brain-connector: the command for a framework is whatever
`commandsForFramework(<framework>)` returns, or "run <framework> manually" when it returns nothing.
Larry never names a `/mos:` from memory.

## Filing (ORCH-03)

After the fired command produces its result, file it via the connector's `filing` field:

- `fileEvidenceWithReadback` -- for evidence-producing families (reverse-salient, hsi, whitespace,
  cross-domain-connect, cross-domain-analogy, hat-scoped-research). Call
  `fileEvidenceWithReadback(db, params)` (`lib/core/navigation/file-evidence-readback.cjs`). On a
  readback error, FALL BACK to `wireAccept(db, params)` (`lib/core/findings-wirer.cjs`) per LOCKED
  decision 2.
- `memory_event_only` -- for surface-only families (six-hats, which surfaces perspectives and produces
  no EvidenceClaim). Write a `memory_event`, no EvidenceClaim.

Then ALWAYS call `surfaceFileEvidenceResult(result)` to remind the navigator exactly what landed --
the FILEVAL honesty rule (report the real readback outcome, never claim a filing that did not happen).

Every decision -- APPROVE, REJECT, or DEFER -- becomes a `memory_event` plus a typed cascade edge in
the LOCAL graph (Canon Part 4 / Part 9). The cascade edge feeds the next cross-relationship scan, so
the loop gets smarter with every decision.

### Part 9 truth-state rule

A filed `EvidenceClaim` lands with `review_status: proposed`, never `confirmed`. Only a human
Decision Gate promotes a truth-claim node from proposed to confirmed (Canon Part 9, role 5). The
orchestrator may PROPOSE; it may never silently confirm. The `memory_event` and cascade-edge writes
are system-bookkeeping nodes (exempt per the Part 9 audit-node carve-out); the EvidenceClaim is a
truth-claim node and stays `proposed` until a human confirms it.

## Tier gate + coexistence (ORCH-04)

### The tier predicate (OPEN-2, LOCKED decision 1)

The live `dispatchSensors` call is authoritative ONLY at `tier_mode` `mode_a` or `mode_b`. At
`tier_0` (a cold room, empty STATE.md, first-session start) the orchestrator degrades to the
doctrine-sim floor (Larry's Provoked-table doctrine) rather than trusting an under-informed live
read. This keeps the skill safe before Phase 144 lands. The gate is the same `brain_md_tier_mode`
predicate the rest of the option-generation surface uses (Mode A / Mode B / Tier 0).

### Coexistence with Phase 144 (engine-side vs prompt-side)

Phase 144 is the ENGINE-side consumer of the same spine: it wires `getRoomContext` into `decide()`
through the navigation chokepoint. This skill is the PROMPT-side consumer of the same spine. The two
COEXIST without double-firing because BOTH honor one-reach-per-beat arbitrated by the Intelligence
Hierarchy: a single reach surfaces per beat regardless of which consumer surfaced it. The
prompt-side orchestrator never calls `decide()` and never flips `routing_source` (the Phase 144
fence); the engine-side consumer owns that. They read the same sensors; the hierarchy is the shared
arbiter that prevents a 144 engine reach and a 143.3 prompt reach from both firing in one beat.

### Coexistence with room-proactive (OPEN-5)

`room-proactive` surfaces CASCADE findings (the Part-4 edges that filing produces); this orchestrator
surfaces SENSOR reaches (Engine 1 / Engine 2). Both want the Decision Gate. The Intelligence
Hierarchy ranks BOTH on the SAME scale: a room-proactive CONTRADICTS finding is a Tension (rank 1)
and outranks a bottleneck reach (rank 2). One-reach-per-beat holds across BOTH skills, not just
within this one.

RESOLUTION (the chosen arbitration): the orchestrator READS `room-proactive`'s
`<roomDir>/.mindrian/last-cascade.json` -- the same LOCAL side-channel file room-proactive itself
reads -- and folds its `newFindings` into the same hierarchy ranking, so one-reach-per-beat holds
across both surfaces from a single ranked pool. This read is LOCAL only (Canon Part 8): it is the
identical side-channel file, never the Brain and never any network surface. If the file is absent or
fails to parse, the orchestrator soft-fails and ranks only the sensor reaches.

### OPEN-4 -- the rs-agent [BRAIN] header vs the local context_block reach

`reverse-salient-agent.surfaceFinding` renders a `[BRAIN]` chip header, but PUSH-02's reach_id is
`context_block` (a LOCAL reach). These do NOT conflict. The `[BRAIN]` chip is a RENDER CHOICE only:
the underlying read is `folder-memory.readQuadruple`, which is LOCAL only per Canon Part 8 (verified
at `reverse-salient-agent.cjs` -- the BRAIN.md quadruple read is local folder-memory, not a Brain
call). The header is a visual label on a LOCAL-only read; it does NOT imply a Brain call and does NOT
contradict the `context_block` LOCAL reach. So the Part-8 check passes: the [BRAIN] header is a
render choice, the read is LOCAL only.

## Tri-Polar surfaces

This skill is conversational doctrine (markdown), so it works across all three surfaces with no new
UI and no surface-specific code:

- CLI: the sensor hook fires the spine; the orchestrator surfaces the chosen reach through the
  existing Shape-F selector (the 143.1 dial-TUI). Full power -- hooks, scripts, file I/O.
- Desktop: Larry surfaces the same reach conversationally, as a natural Decision-Gate offer in the
  flow of the conversation. Personality-driven, no command typing required.
- Cowork: the same SELECTED_REACH gate renders, with a per-actor `{topic}` label so each collaborator
  sees the offer in their shared-room context. Shared state, multi-user.

The selected reach and the Decision Gate are the surface-agnostic core (mirroring the 143.1
surface-agnostic selector). No new UI is introduced on any surface.
