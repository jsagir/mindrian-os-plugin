---
kind: context
phase: 172
slug: contextual-invocation-coverage
milestone: v1.14.0
created: 2026-06-22
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
spec_loaded: true
status: context-captured
severity: CRITICAL
sequence: "MAJOR FOUNDATIONAL phase, navigator-designated FIRST 2026-06-22. Phases 170 + 171 FOLLOW and reconcile UNDER this phase's coverage contract; the 170/171 release is ON HOLD until reconciled. Load-bearing for upcoming local-graph-critical seeds/phases."
---

# Phase 172 Context: Contextual Invocation Coverage (the reach surface, fully wired)

<domain>
The moat is not the methodology catalog. It is the engine that knows WHEN to reach for WHICH
capability, in WHAT sequence (CLAUDE.md moat formula). Today that engine is full of holes: many
relevant commands are never contextually triggered. This phase closes the holes and adds a GATE so
they can never silently reopen. It supersedes the ad-hoc, per-phase wiring that has been attempted
several times and always regressed because there was no coverage contract.
</domain>

<why_now>
1. Recurring failure: contextual invocation has been wired piecemeal multiple times (Phase 143.x
   connector spine, 144.1 connector-retrofit-sweep RETRO-07 - scoped, never fully executed) and keeps
   regressing because new surfaces ship dark with only a non-blocking "opt-in nudge" warning.
2. ACE (Phase 170) exposed it: we ingested a methodology, wired ONE trigger, and discovered the
   broader truth - knowledge (a Brain methodology node) and trigger (a connector + sensor) are TWO
   SEPARATE WIRES, and the system only reaches for surfaces that have the TRIGGER wire.
3. Local-graph criticality: upcoming seeds/phases make the local graph (room.db + the
   brain-orchestration-projection) the primary substrate. Contextual invocation must work Local-Only,
   against the local projection, with no live Brain dependency. A broken reach surface there is fatal.
</why_now>

<coverage_baseline_2026-06-22>
Measured from data/command-registry.json x data/connector-registry.json (101 commands):
- FULLY WIRED (connector -> contextually reachable): 54 (51 with a sensor trigger / proactively fired)
- HALF-WIRED (declares a framework -> a thinking tool -> but NO connector, so never auto-fires): 9
    /mos:causal, /mos:diagnostics, /mos:hat-briefing, /mos:persona,
    /mos:rs-experts, /mos:rs-explain, /mos:rs-fetch, /mos:rs-thesis, /mos:validate-proposition
    (NOTE: the ENTIRE reverse-salient rs-* family is un-triggered, though Reverse Salient is a
    Canon Engine-1 pillar.)
- DARK (no framework, no connector -> manual only): 38, MOST of which are correctly-manual UTILITIES
    (doctor, admin, models, setup, help, export, publish, rooms, snapshot, ingest-methodology, ...).
The sin is not being dark. The sin is being dark WITHOUT A DECISION. RETRO-07: every surface is
WIRED or EXPLICITLY EXCLUDED.
</coverage_baseline>

<the_two_wires>
- KNOWLEDGE wire: a :Framework node in the Brain (what the command teaches). Filled by the Phase 171
  methodology-ingest pipeline.
- TRIGGER wire: a connector block (sensor_triggers + reach_id [frozen] + framework + posture +
  hierarchy_rank) that maps a navigator CONTEXT to the command. This is what makes the engine reach.
  A command can have knowledge (or not need it) and still be DARK with no trigger wire.
This phase owns the TRIGGER wire across ALL surfaces (commands + skills + agents).
</the_two_wires>

<scope>
1. Classify every surface (command/skill/agent) as WIRE | EXCLUDE-UTILITY | GAP.
2. Wire every thinking-surface GAP with a connector block (start with the 9 half-wired; rs-* first).
3. Maintain an explicit utility EXCLUDE allowlist (a committed file), so "dark" is always a decision.
4. Upgrade invocation from keyword-only to CONTEXT-DRIVEN where it matters: triggers keyed on the
   navigator's problem state (stage, JTBD, graph gap), not only string match.
5. Validate CHAINING quality: FEEDS_INTO chains must produce useful sequences, not placeholder edges;
   the local orchestration-projection ranks them; confidences are earned, not uniform defaults.
6. Add the RETRO-07 COVERAGE GATE: build-connector-registry --check FAILS (not warns) on any
   surface that is neither wired nor explicitly excluded. This is what makes the fix STICK.
7. Reconcile Phases 170 + 171 under the contract (ACE/diffusion context-triggered, not keyword-only;
   the ingest pipeline's step-5 trigger wiring enforces this phase's rules).
</scope>

<relationship_to_170_171>
170 (ACE ingestion + /mos:diffusion) and 171 (methodology-ingest pipeline) are the FIRST reconciliation
targets, not prerequisites. They are committed on branch phase-170-171-ace-diffusion-pipeline and the
release is ON HOLD until they conform to this phase's coverage contract (context-driven trigger +
coverage-gate membership). The 171 pipeline's "step 5 (trigger + chain)" becomes a thin caller of this
phase's wiring rules so every FUTURE methodology is born contextually-invocable, never dark.
</relationship_to_170_171>

<open_decisions_for_spec_discuss>
- (a) Where the utility EXCLUDE allowlist lives (data/connector-exclude-allowlist.json vs a frontmatter
  flag connector: {excluded: true, reason}). Frontmatter-local is more auditable.
- (b) Context-trigger model: how a sensor reads navigator problem-state (stage/JTBD/graph-gap) within
  Part 8/9 (LOCAL only, via navigation.cjs; enum/scalar evidence only).
- (c) Reach assignment for the 9 half-wired: which of the 6 frozen reaches each maps to (rs-* family
  -> brain_consult? deep_research? context_block?), and the sensor_triggers per command.
- (d) Chaining-confidence source: keep curated FEEDS_INTO weights vs derive from usage; how the
  orchestration-projection surfaces them in suggest-next.
- (e) Gate severity rollout: warn -> fail. Land as warn+report first, flip to hard fail once the
  baseline is wired/excluded (so CI never goes RED mid-sweep).
</open_decisions_for_spec_discuss>

<part8_9_discipline>
All trigger wiring reads LOCAL context only (navigation.cjs chokepoint); sensor evidence is enum/scalar;
no user content crosses to Brain. The coverage works against the LOCAL brain-orchestration-projection so
contextual invocation holds in Local-Only mode (the load-bearing requirement for the upcoming
local-graph-critical phases).
</part8_9_discipline>
