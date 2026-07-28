---
name: ingest-methodology
description: Maintainer pipeline to add a methodology to the remote Brain safely
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
compatibility: Requires Claude Code (or a host implementing disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.
help_jtbd: "Add a new methodology to the Brain so every user can reach it - without ever leaking user data."
serves_jtbd: ["build"]
teaching: "Maintainer-only. When you want to teach the Brain a new methodology, /mos:ingest-methodology runs the 7-step pipeline - encode, Part-8 boundary gate, graph write, vector write, trigger + chain, register, local refresh - so the framework is reachable by every user and operable Local-Only, with zero user-data egress."
body_shape: "action-report"
hitl_shape: "F.9"
hitl_why: "A methodology is parsed and registered through ordered steps, a fixed-order walk."
kind: utility
autonomous_safe: false
disable-model-invocation: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 172-12 connector frontmatter (CIRS R1 WIRED / R2 born-wired) ---
# /mos:ingest-methodology is the maintainer surface for the CIRS born-wired
# pipeline itself (lib/core/methodology-ingest.cjs ingestPlan step-5). It is WIRED
# to the spine so the pipeline that makes every FUTURE methodology born-wired is
# itself first-class in the coverage gate (the last gap -> 0). It is an admin
# maintainer command (disable-model-invocation: true, autonomous_safe: false), so
# it carries no sensor trigger (sensor_triggers: []) -- it declares the reach but
# is not navigator-sensor-fired. It reuses the FROZEN brain_consult reach (the
# methodology-lookup reach); NO 7th reach minted. framework:null (additive-degrade,
# CONNECTOR-CONTRACT section 4) because the pipeline is methodology-agnostic -- it
# ingests ANY framework, so no single resolvable :Framework name applies.
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: brain_consult
  sub_mode: methodology-ingest
  framework: null
  posture: push_forward
  hierarchy_rank: 60
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

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

5. **Born-wired (CIRS R2 - Canon Part 11).** `ingestPlan(spec)` step-5 is a THIN
   CALLER of the CIRS born-wired wiring rules: it emits the exact `connector:`
   block (`step.connector`) the framework's command surface must carry to be born
   contextually-invocable, and asserts it would pass the coverage gate
   (`step.coverage_gate.gate_pass`). The block reuses a FROZEN reach_id (default
   `brain_consult`, the SENS-09 precedent - never mint a new one). Apply it: add
   the `connector:` block to the framework's command home, add a sensor under
   `lib/core/sensors/` (reusing that frozen reach), register it in
   `lib/core/insight-sensors.cjs`, add the dispatch handle to
   `data/dispatch-framework-map.json`, and chain FEEDS_INTO neighbors. The
   methodology is now born WIRED, not dark.

6. **Register the phase.** Add the framework name to `data/framework-names.json`
   (curated_extras if not yet FEEDS_INTO-linked). Create the phase CONTEXT.md,
   the `docs/CANON-PHASE-MAP.md` row, and the `.planning/ROADMAP.md` train entry.
   If a frozen set moved (new reach/edge/node type), STOP - that requires a canon
   amendment, not this pipeline.

7. **Local step (make it operable Local-Only).** Run
   `bash "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/methodology-ingest-local.sh"`. This regenerates, in order,
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
