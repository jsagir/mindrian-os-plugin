---
kind: spec
phase: 172
slug: contextual-invocation-coverage
milestone: v1.14.0
created: 2026-06-22
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
status: spec-locked-pending-discuss
---

# Phase 172 SPEC: Contextual Invocation Coverage + Remote-Graph Counterparts

## North star

The remote Brain graph (and its LOCAL projection) must be able to TRIGGER, CHAIN, and MONITOR the
invocation of EVERY relevant surface - both methodology frameworks AND commands that have no framework.
A surface the engine cannot reach is a hole in the moat. Coverage is enforced by a GATE so it never
silently regresses (the reason prior attempts failed).

## Definitions

- **Surface** - a command, skill, or agent that could be invoked.
- **Knowledge wire** - a `:Framework` node in the Brain (what a surface teaches). Tier `pws`.
- **Trigger wire** - a `connector:` block mapping a navigator CONTEXT to a surface (sensor_triggers +
  frozen reach_id + framework + posture + hierarchy_rank). What makes the engine REACH.
- **Counterpart node** - a remote-graph node representing a NON-framework surface so it can be
  triggered/chained/monitored. Tier `mindrian-operation` (the "second tier").
- **Frontier framework** - a non-framework surface PROMOTED to a first-class `pws` framework when it
  earns a methodology representation.

## Requirements

### Coverage
- **INV-01** Classify EVERY surface (commands + skills + agents) as one of: WIRE (thinking surface,
  gets a connector), EXCLUDE (utility, correctly manual), or GAP (should be wired, is not). Baseline
  evidence: 54 wired / 9 half-wired / 38 dark (2026-06-22), in 172-CONTEXT.
- **INV-02** Wire every thinking-surface GAP with a connector block. Start with the 9 half-wired; the
  reverse-salient family (`rs-experts/explain/fetch/thesis`) FIRST (Engine-1 pillar, currently dark).
- **INV-03** Maintain an EXPLICIT utility-exclude decision (frontmatter `connector: {excluded:true,
  reason}` preferred over a side file - auditable, local to the surface). No surface is dark by accident.

### Remote-graph counterparts (the new requirement)
- **INV-04** The remote orchestration graph represents ALL invocable surfaces, not only `:Framework`
  nodes. Every command/skill/agent has a node carrying `methodology_tier` (`pws` | `mindrian-operation`)
  - the Part-8 boundary-keeper that makes machinery nodes legal (Canon Part 8 dual-role / Phase 157).
- **INV-05** A non-framework command that should participate in trigger/chain/monitor gets a
  `mindrian-operation` COUNTERPART node (second tier) in the projection, with its connector ranking
  inputs (reach_id, hierarchy_rank, posture, sensor_triggers). It chains via OPERATES / CHAINS /
  PREREQUISITE edges even without a `pws` framework.
- **INV-06** PROMOTION PATH: dark command -> `mindrian-operation` counterpart -> (if it earns a
  methodology) `pws` frontier framework via the Phase 171 ingest pipeline. A proven counterpart can be
  promoted; the path is explicit and navigator-gated.

### Trigger / chain / monitor
- **INV-07** TRIGGER: context-driven, not keyword-only. Sensors key on navigator problem-state (stage,
  JTBD, graph gap) read LOCALLY via navigation.cjs; keyword match is a fallback, not the basis.
- **INV-08** CHAIN: FEEDS_INTO / CHAINS sequences produce USEFUL next-steps, not placeholder edges.
  Confidences are earned (curated or usage-derived), surfaced via the local orchestration-projection in
  suggest-next. Validate on a real venture flow (not a hand-trace).
- **INV-09** MONITOR: coverage + chain health is monitored at the PROJECTION level (UN-WIRED /
  UN-RANKED / STALE checks, chain reachability). Per-user invocation telemetry stays LOCAL (Part 8);
  the remote graph monitors GENERIC machinery shape and chain integrity only.

### The gate (why it sticks this time)
- **INV-10** RETRO-07 COVERAGE GATE: `build-connector-registry --check` and
  `build-orchestration-projection --check` FAIL (not warn) on any surface that is neither WIRED nor
  EXPLICITLY EXCLUDED, and on any `mindrian-operation` counterpart that is UN-RANKED. Roll out as
  warn+report first, flip to hard-fail once the baseline is wired/excluded (CI never RED mid-sweep).

### Reconciliation + locality
- **INV-11** Reconcile Phases 170 + 171 under this contract: ACE/`/mos:diffusion` become
  context-triggered (not keyword-only); the 171 ingest pipeline's step-5 (trigger + chain) becomes a
  thin caller of INV-02/INV-03/INV-10 so every FUTURE methodology is born contextually-invocable.
  170/171 do not RELEASE until reconciled.
- **INV-12** Everything operates Local-Only against the brain-orchestration-projection (no live Brain
  call at decide/rank/route time) - the load-bearing requirement for the upcoming local-graph-critical
  seeds/phases. Brain-on enriches; Brain-off never breaks invocation.

## Success criteria

- Every surface is WIRED or EXPLICITLY EXCLUDED; the coverage gate is hard-fail and green.
- The 9 half-wired thinking surfaces (rs-* first) are contextually triggerable.
- Non-framework commands that warrant it have `mindrian-operation` counterpart nodes and chain.
- The promotion path (dark -> counterpart -> frontier framework) is documented and exercised once.
- A real dual-use venture driven end-to-end shows the right surface reaching at the right moment and a
  useful chained next-step (test, not demo).
- 170/171 reconciled; then released together.

## Out of scope / deferred
- Usage-derived confidence learning (curated weights acceptable for v1).
- Cross-user invocation intelligence (separate product, separate legal review - Part 8).
