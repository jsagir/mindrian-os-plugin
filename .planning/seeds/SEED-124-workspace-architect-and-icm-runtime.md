---
id: SEED-124
title: "Workspace Architect and icm-runtime: what to borrow, read after the room slice shipped"
status: filed
priority: medium
filed: 2026-10-06
source: "brief 2026-10-05 sections 5.2 and 5.3 (BRIEF.md lines 153-175, copied verbatim below), cut into a seed by the 2026-10-05 reconciliation, amendment 5 (AMENDMENTS-RECONCILIATION-2026-10-05.md row 5), parked until 369.3a closed"
depends_on: Phase 369.25 (spoken 369.3a: the room slice, Room Identity and FeyMinto), the 2026-10-05 brief (prove one authority, then generalize)
---

# SEED-124: Workspace Architect and icm-runtime

Filed when 369.3a closed (Phase 369.25), from the brief's text as it stands. The brief stays verbatim; this file is the cut that amendment 5 asked for. Read it after the room slice has shipped, not before: both sections are borrowing guidance for a later phase, and neither proposes a change to this one.

### Borrow from Workspace Architect

The useful source patterns are Product / Factory / Process, explicit Inputs / Process / Outputs, focused context loading, separation of stable references from working artifacts, and editable intermediate outputs. The retrieved skill describes a sequential workspace design method, not an enforcement engine. [S7]

For Mindrian, treat these as stage-authoring guidance inside existing architecture. Do not impose another Layer 0-4 scheme on the current Layer Contract without a mapping. Do not copy a mandatory questionnaire into a session where the needed information already exists. Do not infer actual access control from folder layout.

Adopt **one primary job and one accountable result per stage**, while allowing a result to comprise several named files and graph records. Do not force a complex filing operation into one physical artifact merely to satisfy the external template.

A room is a durable decomposition of a problem; a run is an attempted sequence of transformations. These should be linked, not conflated. Nested sub-rooms should arise from distinct jobs and scope, not automatically from every workflow stage.

### Borrow selectively from icm-runtime

Useful patterns are frozen per-run contracts, explicit stage boundaries, observed tool/argument records, append-only execution history, enforcement-status disclosure, and bounded integrity seals. [S6]

The inspected implementation is not a finished answer to Mindrian's failures:

- `cmd_next`, listing and cleanup use output presence in places, while gate activity uses `stage_done` events. That is not one universal completion definition.
- The Claude hook permits a call when the checker itself fails unexpectedly, while the pi adapter blocks exceptions. Do not import a cross-host policy mismatch.
- Tool argument records are captured before execution. A matching call record is not proof of a successful remote effect.
- Seals cover selected evidence files. They establish detectable changes to those files, not factual validity or blanket integrity of every output.
- The documentation describes advisory-only enforcement on some surfaces, and best-effort transcript/stage attribution with concurrency limitations.

Reuse the ideas in existing Node/MCP execution paths. Do not install a second state-owning `.icm/` runtime beside the room graph and existing planners by default. Frozen contracts should identify the methodology version and authorized inputs without exporting or copying the entire Theo graph.

## Where 369.25 already honored these

The room slice already follows both sets of patterns without importing either tool: the brief's RECORD BASIS is a frozen per-render record of the inputs it rests on (a fingerprint over named files), the proposed, selected, attempted and verified records are kept separate and append-only in the room, the enforcement disclosure is the not-asked reasons and the readiness refusals (every refusal says what is missing), and no second `.icm/` runtime was added beside the room graph and the existing planners.
