---
kind: spec
phase: 172
slug: contextual-invocation-coverage
milestone: v1.14.0
created: 2026-06-22
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
status: spec-locked-recalibrated   # CIRS structural recalibration adopted 2026-06-22; INV-13..17 added; see 172-RECALIBRATION.md
---

# Phase 172 SPEC: Contextual Invocation Coverage + Remote-Graph Counterparts

## North star

The remote Brain graph (and its LOCAL projection) must be able to TRIGGER, CHAIN, and MONITOR the
invocation of EVERY relevant surface - both methodology frameworks AND commands that have no framework.
A surface the engine cannot reach is a hole in the moat. Coverage is enforced by a GATE so it never
silently regresses (the reason prior attempts failed).

**Recalibration (2026-06-22, navigator-directed).** 172 is not a patch — it is a STRUCTURAL change.
It ships the **Command Invocation Ruling System (CIRS)**: a born-wired, gate-enforced, harness-as-code
constitution (R1..R11, below) governing the LIFECYCLE (born / modified / updated / removed) of every
invocable surface across MindrianOS. INV-01..12 are the FIRST application of CIRS; INV-13..17 are the
structural lift. Research-conclusion-driven (see EXTERNAL-RESEARCH.md: control/data-plane + CQRS
projection + T-Box/A-Box + scale-invariant fractal rollup + state-conditioned routing + earned chains
+ drift-detection gate). Built as a harness-as-code Workflow (9-property architecture). Full framing:
172-RECALIBRATION.md.

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

### The Command Invocation Ruling System (CIRS) — the closed ruling set

A closed constitution (constitutional counterpart of Canon Part 3's 10 verbs / Part 4's edge vocab).
Every invocable surface MUST satisfy R1..R11; the gate enforces them; a change to the closed set is a
canon amendment, not a per-phase edit.

- **R1** Two states, no third: WIRED (`connector:` block) or EXCLUDED (`connector:{excluded,reason}`).
- **R2** Born-wired: a new/modified surface fails the gate CLOSED unless it satisfies R1.
- **R3** Context-triggered: trigger keys on navigator problem-state via navigation.cjs; keyword = fallback.
- **R4** One governed path: invocation resolves through dispatchSensors -> decide() -> command-resolver. No second selection brain.
- **R5** Remote counterpart: every surface has an orchestration-projection node with `methodology_tier`; non-framework commands get a `mindrian-operation` counterpart.
- **R6** Earned chains: FEEDS_INTO carries curated confidence (v1), surfaced via the LOCAL projection; absent/uniform confidence is illegal. Learned weights -> SEED-009.
- **R7** Local-only at decide/rank: projection is a CQRS read-model (control plane) with source-version + per-room checkpoint + freshness markers; user data never flows up (Part 8 T-Box/A-Box).
- **R8** Promotion path: dark -> mindrian-operation counterpart -> pws frontier framework, navigator-gated.
- **R9** Enforced: gate wired into pre-commit + release.sh + doctor --acceptance + 171 ingest step-5; warn->report then hard-FAIL once baseline wired/excluded.
- **R10** Lockstep on change: any add/modify/update/remove re-runs the gate and keeps the projection in lockstep (drift-detection).
- **R11** Fractal coverage: coverage + chain monitoring rolls up across nested rooms via ONE scale-invariant operator over NESTED_WITHIN, depth-3 capped, aggregate-only across boundaries.

### Structural requirements (additive — INV-01..12 unchanged)

- **INV-13** CIRS (R1..R11) is a closed ruling set; a change to it is a canon amendment (Part 6 mechanism).
- **INV-14** Born-wired lifecycle gate (R2): a new/modified surface under commands/ skills/ agents/
  fails closed unless wired-or-excluded — enforced in pre-commit + release + doctor --acceptance + the
  171 ingest pipeline. This is the structural cure for the recurring regression (orphaned WARN-only gate).
- **INV-15** 172 is BUILT as a harness-as-code Workflow (9-property canonical architecture: recon-first,
  phased fan-out with barriers Foundation->Surfaces->Chains->Verify, contracts-on-disk bus, exclusive
  file ownership, one shared IFACE, adversarial verify with structured verdict, RULES block per prompt,
  resumable via scriptPath+resumeFromRunId, orchestrator stays in the loop). Ref impl: /mos:bono build.
- **INV-16** Fractal coverage rollup (R11) over NESTED_WITHIN, depth-3 capped, one scale-invariant operator.
- **INV-17** 170 + 171 conform to CIRS via their own GSD plans BEFORE release; 172 owns that gate.
- **INV-18** /mos:act collapses to ONE governed selection brain (navigator-LOCKED 2026-06-22): a
  `connector:` block on act.md (autonomous_safe stays false) AND act --chain feeds the real
  navigation-engine decide() as its decideFn (drop the `()=>null` at act-command.cjs:219), so the chain's
  per-step next-reach comes from the SAME spine. /mos:pipeline + act --swarm are each WIRED-or-EXCLUDED
  under the gate. This is R4 made concrete.
- **INV-19** /mos:act is an ALWAYS-ON standing suggestion (additive — navigator-LOCKED 2026-06-22).
  Larry ALWAYS surfaces /mos:act in the suggest-next / dial host as a PINNED additive option, positioned
  first OR last, that NEVER displaces the MAX_K=3 ranked context-reaches and is NOT a 7th reach (the
  frozen DIAL_REACH_K=6 / MAX_K=3 contracts are untouched — act is a standing UI suggestion to invoke a
  command, not a new reach_id). It renders a JTBD-CONTEXTUALIZED blurb derived from the active JTBD
  (/mos:jtbd state) + STATE.md + MINTO.md: in THIS specific case (this JTBD / problem-state) it states
  (a) WHAT /mos:act would do, (b) WHAT it can help with, (c) HOW (which framework/chain it would run and
  why). This makes the one governed autonomous-execution path (INV-18) always available and
  self-explaining per room state. The blurb is LOCAL-derived (Part 8: enum/scalar + local state only;
  no Brain egress to compose it). Add a `hats`-style render family in the dial-label composer for the
  pinned act row (render-only, no `{framework}` egress slot), mirroring the Phase-148 non-egress family.
- **INV-20** /mos:act renders through the canonical Shape F.1 selector host (navigator-LOCKED 2026-06-22).
  BOTH (a) the pinned always-on act standing suggestion (INV-19) AND (b) act's own next-step/option
  presentation use the shipped Shape F.1 renderer (lib/hmi/shape-f1-renderer.cjs) and honor the FROZEN
  F.1 keyboard contract: UP/DOWN option navigation + SIDE toggle of the toggleable archetype components
  (lib/hmi/reach-component-map.json). act's current bespoke `body_shape: E` `yes / pick another / cancel`
  prose gate (act.md:192-196) is REPLACED by / unified onto the F.1 host — consistent with the Phase-148
  "suggest surfaces unify onto the F.1 host" contract. The frozen F.1 keyboard contract, MAX_K=3, and
  DIAL_REACH_K=6 are UNTOUCHED; act is a pinned additive row ON the F.1 host, rendered via
  AskUserQuestion (the Shape F.1 primitive), never a hand-rolled selector.
- **INV-21** /mos:act carries an INTERNAL discuss / intent-calibration phase (navigator-LOCKED
  2026-06-22). Before act SELECTS or EXECUTES anything, it runs a short INTENT-CALIBRATION step — a
  lightweight internal discuss phase (reusing the discuss-phase pattern + the Shape F.1 gate) that
  calibrates with the navigator's ACTUAL intent (what they want act to do in this room state, scope,
  constraints, what "done" looks like) BEFORE routing through the F.1 selector -> decide() -> runChain.
  act NEVER acts on a presumed intent: it confirms intent first via the F.1 gate, then acts. This is
  the calibration gate that makes act's autonomy safe (Canon Part 3 Decision Gate + Part 10 conversation
  -as-product + the post-gate runChain handoff: calibrate -> approve -> auto-run the autonomous_safe
  prefix -> halt at the first material step). Calibration reads LOCAL state only (active JTBD + STATE.md
  + MINTO.md); no Brain egress to calibrate (Part 8). The calibration outcome is journaled as a
  workflow_stage / memory_event through navigation.cjs (Part 9), so the intent that drove the run is
  auditable.

## Success criteria

- CIRS (R1..R11) is the enforced ruling system; INV-13..18 are met.
- The born-wired gate (INV-14) is wired into pre-commit + release + doctor + ingest and is hard-fail green.
- /mos:act resolves through the one governed path (INV-18); no second selection brain remains.
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
