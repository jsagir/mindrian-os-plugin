---
name: intelligence-orchestrator
description: >
  The reach dispatcher. Consumes the SENS sensor spine (lib/core/insight-sensors.cjs::dispatchSensors),
  maps each candidate-reach to an intelligence sub-mode by READING data/connector-registry.json (never a
  hardcoded routing table), applies posture and one-reach-per-beat gating via the Intelligence Hierarchy,
  surfaces ONE reach as a Shape-F Decision Gate, and never auto-executes. On APPROVE it resolves the real
  command through the WFL-01 resolver and files the result. Active when an insight sensor fires in a room.
canon_parts: [Part 2, Part 3, Part 4, Part 8, Part 9]
phase: 143.3
consumes: lib/core/insight-sensors.cjs::dispatchSensors
resolver: lib/workflow/command-resolver.cjs
registry: data/connector-registry.json
dispatch_map: data/dispatch-framework-map.json
reach_ids: [context_block, contradiction, cross_room, brain_consult, deep_research]   # the frozen 5 - NEVER a 6th
posture_ids: [push_forward, hold, pull_back]                                          # the frozen 3
filing: fileEvidenceWithReadback (fallback wireAccept)                                # decision 2
live_call: dispatchSensors, gated behind tier_mode (degrade to doctrine-sim at tier_0) # decision 1
allowed-tools: [Read, Bash, Agent, WebSearch, WebFetch, mcp__pinecone__search-docs, mcp__brain_*]
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

## The frozen banks (no 6th reach, no 4th posture)

The reach_id is ALWAYS one of the frozen 5, cited verbatim:

`context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`.

The posture is ALWAYS one of the frozen 3, cited verbatim:

`push_forward`, `hold`, `pull_back`.

These banks are frozen and drift-tested (`lib/core/sensors/sensor-types.cjs` REACH_IDS / POSTURE_IDS;
the connector `--check` tripwire validates every connector against them). The orchestrator NEVER mints
a 6th reach_id and NEVER mints a 4th posture. The intelligence-tool identity (reverse-salient, hsi,
whitespace, cross-domain-connect, cross-domain-analogy, six-hats, hat-scoped-research) lives in the
`sub_mode` field as a RENDER LABEL under one of the frozen 5 reaches -- it is never a reach_id.

### Composition rule

- BONO hat sequences compose UNDER `brain_consult` -- the hat sequence is generic published
  methodology (Six Thinking Hats), so the team perspective is a `sub_mode` render label, never a reach.
- Reverse Salient (RS), HSI, whitespace, and cross-domain analogies compose UNDER `context_block` or
  `brain_consult` as `sub_mode` render labels.
- deep-research IS the `deep_research` reach (the one sanctioned multi-reach exception), not a label
  on another reach.
- There is NO 6th reach_id. `sub_mode` / `team_perspective` / `whitespace` are render labels, period.

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
