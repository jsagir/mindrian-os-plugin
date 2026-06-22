---
name: ingest-methodology
description: Maintainer pipeline to add a methodology to the remote Brain safely
help_jtbd: "Add a new methodology to the Brain so every user can reach it - without ever leaking user data."
teaching: "Maintainer-only. When you want to teach the Brain a new methodology, /mos:ingest-methodology runs the 7-step pipeline - encode, Part-8 boundary gate, graph write, vector write, trigger + chain, register, local refresh - so the framework is reachable by every user and operable Local-Only, with zero user-data egress."
body_shape: "action-report"
kind: utility
autonomous_safe: false
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# /mos:ingest-methodology

You are Larry, in MAINTAINER mode. This is an ADMIN pipeline: it writes a new
methodology to the shared remote Brain (Neo4j + Pinecone). Only an operator with
write-capable Brain access should run it. It is NOT a navigator-facing reach.

It codifies the 7-step process used in Phase 170 (Adoption-Capacity Engine,
Hooked Model, Self-Selling Loop) so every future methodology follows the same
safe path. The engine is `lib/core/methodology-ingest.cjs` (pure, tested).

## Input

A normalized methodology spec (see the JSDoc in `lib/core/methodology-ingest.cjs`
for the shape): name, description, methodology_tier (`pws` | `mindrian-operation`),
mos_command, author, variables/cases/steps/critiques, chains_in, chains_out,
trigger_lexicon. The spec must be GENERIC teaching knowledge - never a specific
venture's data.

## The pipeline (halt at the gate)

1. **Encode.** Load the spec. Build the plan: `ingestPlan(spec)`.

2. **Boundary gate (HARD HALT - Canon Part 8).** Run `auditSpecPart8(spec)`.
   If `clean === false`, STOP and report the violations. Nothing is written to
   the Brain until the spec is clean. The Brain holds generic methodology only;
   user/venture data never crosses this line. This step is non-negotiable.

3. **Graph write (Neo4j).** Take `buildFrameworkCypher(spec)` -> `{cypher, params}`
   and run it via the `my-neo4j` MCP `write_neo4j_cypher` tool (parameterized;
   the framework name is never string-interpolated). This MERGEs the Framework +
   steps + cases + author + FEEDS_INTO chains, idempotently.

4. **Vector write (Pinecone).** Take `buildPineconeRecords(spec)` and upsert via
   the `pinecone` MCP `upsert-records` into index `pws-brain`, namespace `tools`
   (the framework home) AND `core` (the namespace `brain_search` reads). Records
   carry flat scalar/array metadata only (Part 8). Verify with `brain_search`.

5. **Trigger + chain.** If the spec defines a trigger, add a sensor under
   `lib/core/sensors/` reusing a FROZEN reach_id (never mint a new one), register
   it in `lib/core/insight-sensors.cjs`, and add the dispatch handle to
   `data/dispatch-framework-map.json`. Give the framework a connector home
   (a command with a `connector:` block) so it is first-class in the spine.

6. **Register the phase.** Add the framework name to `data/framework-names.json`
   (curated_extras if not yet FEEDS_INTO-linked). Create the phase CONTEXT.md,
   the `docs/CANON-PHASE-MAP.md` row, and the `.planning/ROADMAP.md` train entry.
   If a frozen set moved (new reach/edge/node type), STOP - that requires a canon
   amendment, not this pipeline.

7. **Local step (make it operable Local-Only).** Run
   `bash scripts/methodology-ingest-local.sh`. This regenerates, in order,
   `command-registry.json` -> `connector-registry.json` ->
   `brain-orchestration-projection.json` (the local intelligence cache the
   navigation engine, dial, and f-selector-ranker read), each behind its
   `--check` drift gate. After this the framework is operable by local
   intelligence + invocation mapping with NO live Brain call.

## Output

An action report: the gate result, what was written to Neo4j and Pinecone (with
a `brain_search` retrieval check), the trigger/connector wiring, the registration
triad, and the local-regen `--check` results. End at a Decision Gate: verify
retrieval, or run the release lockstep to ship the plugin-side changes.
