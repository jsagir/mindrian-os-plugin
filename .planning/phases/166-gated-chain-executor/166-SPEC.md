---
kind: spec
phase: 166
slug: gated-chain-executor
title: Gated Chain Executor (runChain spine)
milestone: v1.14.0
status: scoped
sequence: "SECOND in v1.14.0 -- order 163 -> 166 -> 164 -> 165, navigator-LOCKED 2026-06-18. Builds after 163 so the harness shape is proven on a real application; 164/165 then ride the runChain spine."
created: 2026-06-18
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
depends_on:
  - Phase 122 (workflow-layer / command-resolver + command-registry.json)  # SHIPPED
  - Phase 144 (navigation-engine decide())                                  # SHIPPED
  - Phase 141 (getRoomContext + 3 postures + 6 reaches)                     # SHIPPED
  - Phase 109 (navigation.cjs chokepoint + memory_event)                    # SHIPPED
soft_depends_on:
  - Phase 157 (brain-orchestration-projection ranked next-reach)            # PARTIAL (consumption deferred)
related_seeds:
  - SEED-032 (harness-as-code)                  # the manifest this is the runtime FOR
  - SEED-024 (brain-as-orchestration-graph)     # the suggester this consumes
  - SEED-028 (workflow synthesis retry/fallback) # the reliability contract this honors
reuse_ratio: "~80-85% repoint, ~15-20% net-new"
source: navigator session 2026-06-18 (7-lens fan-out analysis)
---

# Phase 166: Gated Chain Executor (the runChain spine)

## Goal

Ship ONE shared runtime, `lib/core/chain-executor.cjs`, that takes a sequence of reaches/commands and runs it as an autopilot-with-gates: invoke a step, capture its structured output, pass that output as context into the next step, and loop. Auto-run steps tagged `autonomous_safe`; HALT at material-decision steps and hand to the Tri-Context Decision Gate (Canon Part 3). Every surface that today hand-rolls its own chain loop (act, pipeline, ignite) and every surface that today only suggests a next step (larry-extended, larry-personality) calls this one spine instead.

This is the missing RUNTIME. SEED-032 declares the harness manifest; SEED-024 / Phase 157 build the graph that knows the right sequence; this phase builds the machine that actually RUNS the sequence under the canon's gate.

## Why now: the reverse salient

A 7-lens fan-out (2026-06-18) established that the executor is ~80-85% already shipped but scattered and unnamed:

- Loop runner + stop-condition + kill-switch: `scripts/act-command.cjs:13-26`
- Posture gate: `lib/workflow/command-resolver.cjs:131-152` (`validateChainAutonomy` reads `autonomous_safe`)
- Model routing: `lib/core/model-profiles.cjs:18-57,119-149` (cheap->haiku / complex->opus already)
- Per-step brick: `agents/framework-runner.md:40-41,120-136` (accepts `previous_output`, returns `chain_output`)
- Posture authority: `data/command-registry.json` (`autonomous_safe` field)

Catalog coverage (live count 2026-06-18): 96 commands, 13 skills, 9 agents; 50 of 96 commands already declare `autonomous_safe` (45 true), 51 carry `posture` + `reach_id`. Over half the catalog is already chain-ready metadata-wise.

The gap is NOT a greenfield engine. The gap is: three divergent copies of the loop (act/pipeline/ignite, ~60 duplicated lines), no single posture-gate authority at runtime, no single chain trace, and `decide()` never consumed in a loop. The reverse salient is the absence of ONE extracted, shared, gated loop runner.

## What it is (Canon Part 7: reuse before build)

REPOINT (do not rebuild):
- Extract the loop body from `scripts/act-command.cjs` into `lib/core/chain-executor.cjs`.
- Call `validateChainAutonomy()` / `composeWorkflow()` from `command-resolver.cjs` for posture + step resolution. The ONE place posture is read.
- Dispatch `agents/framework-runner.md` as the per-step brick (unchanged). Capture `chain_output`, fold into next `previous_output`.
- Read the ranked next-step from `navigation-engine.cjs decide()`; re-call per loop (do NOT change its return shape).
- Persist chain state via `lib/mcp/pipeline-state.cjs` (`room/.mindrian/pipeline-state.json`) through the `navigation.cjs` chokepoint (Part 9).
- Route model tier via `model-profiles.cjs`.

NET-NEW (the ~15-20%):
- The shared `runChain()` function and its callback contract.
- The posture x evidence-quality gate predicate (the single leverage point).
- The resume-mechanism reconciliation (blocker B1 below).
- Migration of act/pipeline/ignite onto the shared spine.

Explicitly NOT a new orchestration framework. Per Canon and CLAUDE.md tech-stack rules: no LangChain / CrewAI / AutoGen. Claude IS the model; the spine IS the harness. Claude Code's own Task/Agent dispatch is the execution substrate the runner sits on.

## The shared contract

```
// lib/core/chain-executor.cjs
runChain(steps, {
  postureFn,        // (command) -> 'autonomous_safe' | 'material'  (reads command-registry.json via command-resolver)
  gateFn,           // (step, posture, priorOutput) -> 'run' | 'halt'  (the posture x quality predicate)
  onStep,           // (step, previousOutput) -> structured result  (dispatches framework-runner)
  provenanceFn,     // optional (step, result) -> frontmatter  (pipeline needs it; act/ignite pass null)
  maxSteps,         // hard cap (budget brake)
  onHalt,           // (step, contexts) -> renders Tri-Context Decision Gate, returns user verb
}) -> { trace, completed, haltedAt }
```

Every consumer supplies callbacks; no consumer owns a loop.

## Requirements

### EXEC-01: Loop runner
A single function invokes each step's command/skill via the connector spine and captures its structured output. Extracted from `act-command.cjs`; no new dispatch path. Re-calls `decide()` after each step to re-derive the next reach from the navigated graph neighborhood (not a precomputed list).

### EXEC-02: Output passing (with quality signal)
Each step's `chain_output` becomes the next step's `previous_output` (the framework-runner contract already supports this). LOAD-BEARING ADD: the `chain_output` carries framework-runner's `quality` enum forward, so the gate can fire on `quality:low` even for an `autonomous_safe` step. This is what stops garbage-in-garbage-out propagation down the chain (loop R3 in the systems model).

### EXEC-03: Posture x evidence-quality gate (the leverage point)
`gateFn` returns `run` only when the step is `autonomous_safe` AND its inbound `priorOutput.quality` is not `low`. Otherwise `halt`. Posture is read from `data/command-registry.json` via `validateChainAutonomy()` (the ONE authority); the 3-posture vocabulary maps as: `push_forward` -> auto-run, `hold` / `pull_back` -> halt (`lib/core/sensors/sensor-types.cjs:54-58`). On halt, render the Tri-Context Decision Gate (Part 3, Shape F.1) and await one of the 10 verbs. HARD RULE: any irreversible step (sends email, deploys, publishes, external writes) is forced-material regardless of tag.

### EXEC-04: Kill switch + single trace
A `[stop]` verb flushes filed artifacts and ends the chain cleanly (reuse `act.md:276`). Every step (auto-run or gated) appends to ONE chain trace built from `decide()`'s `decision_trace` (`navigation-engine.cjs:731-736`) plus each step's `chain_output`. The trace is the resumable journal and the observability surface for all consumer surfaces.

### Pre-work blockers (resolve BEFORE the loop is built)

- **B1 - Reconcile the two resume mechanisms.** `lib/mcp/pipeline-state.cjs` (`room/.mindrian/pipeline-state.json`, explicit position/gating/history) vs the command-doc artifact-frontmatter scan (`pipeline.md:59-79`). Standardize on `pipeline-state.cjs` as the single source of truth; frontmatter becomes a secondary index. Without this, a resumed chain has two disagreeing memories.
- **B2 - Do NOT change `decide()`'s return shape.** It returns ONE typed decision, not a ranked list (`navigation-engine.cjs:596`); consumers include intent-classifier, skill-activation-router, offer-presenter, mos.md, suggest-next. The executor re-calls `decide()` per loop and joins posture from the registry; it never mutates the engine contract.
- **B3 - Reject the harness "all PASSING -> stop" convergence.** SEED-032 / the imported doc model convergence as "loop until all features pass." Canon Part 3 mandates the chain halt at the first material step. Import the harness STRUCTURE (manifest, declared policy, re-runnable trace) but the stop condition is posture-driven, never autonomous-convergence-driven.

## Surface migration (the blast radius)

| Surface | Action | Why |
|---------|--------|-----|
| `commands/act.md` + `scripts/act-command.cjs` | MODIFY (donor) | Its loop becomes the extracted spine; act becomes the thinnest caller |
| `commands/pipeline.md` + `lib/mcp/pipeline-state.cjs` | MODIFY (consumer) | Calls runChain with `provenanceFn`; ~60 lines de-duped; keeps resume |
| `commands/ignite.md` | MODIFY -> CONSUMER | Its hand-rolled B1->B3 birth gates re-host on the spine |
| `agents/larry-extended.md` | MODIFY (handoff seam) | After a gate-approved step, hands the resolved chain to the executor instead of waiting for re-typed commands |
| `skills/larry-personality/SKILL.md` | MODIFY (contract) | The "suggest, gate, wait" contract gains an auto-sequence branch; gateFn MUST still halt on every non-`autonomous_safe` step (SKILL.md:59 "the navigator always decides") |
| `agents/framework-runner.md` | BENEFIT (no change) | Already the per-step brick |
| `~40 framework commands` (lean-canvas, think-hats, mullins, ...) | BENEFIT (zero per-command code) | Instantly chainable as step-bricks; only ~46 untagged commands need a `posture` tag added |
| `mva-brief` / `mva-option` / dashboards / wiki / present | BENEFIT / ORTHOGONAL | Different abstraction (swarm/router) or render-only |

## Canon alignment

- Part 3: the gate halts at material steps via Shape F.1 and the 10 verbs. Auto-run is strictly the registry-blessed `autonomous_safe` subset.
- Part 4: every step's decision (auto-run or gated) files a typed edge; the chain trace is graph data.
- Part 6: the plugin dog-foods its own harness - act/pipeline/ignite stop being three divergent loops and honor one declared runtime.
- Part 7: ~80-85% repoint of shipped code; net-new is the contract + gate + reconciliation + migration.
- Part 8: posture is joined from the LOCAL `command-registry.json`; zero Brain egress; `decide()` is unchanged and Part-8-clean.
- Part 9: chain state persists in `room.db` / `pipeline-state.json` through the `navigation.cjs` chokepoint; SQL is the chain's memory.
- Part 10: the navigator talks to Larry; the chain runs underneath as machinery, surfacing only at material gates.

## Out of scope (deferred)

- The full SEED-032 harness MANIFEST schema (this phase ships the runtime the manifest will later declare; the manifest is a follow-on).
- Live Brain consumption of the Phase 157 projection for ranked next-reach (deferred with 157; the executor reads `decide()` locally until then).
- SEED-028 retry/backoff on transient 5xx is RECOMMENDED to fold in here as `onStep` retry, but can ship as a fast-follow if it expands scope.

## Acceptance / tests

1. A chain of 3 `autonomous_safe` framework steps runs end to end with NO gate, output passed each hop, one trace emitted.
2. A chain with a `hold`-tagged step at position 2 auto-runs step 1, HALTS at step 2 rendering the Tri-Context gate, resumes step 3 after APPROVE.
3. A step returning `quality:low` forces a halt even though it is `autonomous_safe`.
4. An irreversible step (e.g. a publish/email command) forces a halt regardless of tag.
5. `[stop]` mid-chain flushes filed artifacts and ends cleanly with a complete trace.
6. Resume: kill a chain at step 2, resume from `pipeline-state.json`, step 1 is not re-run.
7. Part 8 sweep: no user bytes reach the Brain; posture joined from local registry only.
8. Regression: act/pipeline/ignite existing tests stay green after migration onto the spine.

## Open questions for plan-phase

- Does `runChain` live purely in `lib/core/` (CLI + MCP shared) with thin command wrappers, confirming Tri-Polar parity (CLI / Desktop / Cowork)?
- Should the SEED-028 retry contract be a hard requirement (EXEC-05) or a fast-follow?
- Migration order: act (donor) first, then pipeline, then ignite, then the larry-extended/larry-personality handoff seam - one surface per wave to keep CI green?
