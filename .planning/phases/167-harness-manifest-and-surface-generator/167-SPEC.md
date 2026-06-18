---
kind: spec
phase: 167
slug: harness-manifest-and-surface-generator
title: Harness-as-code completion - declared manifest + fable-mode discipline + new-surface generator
milestone: v1.14.0
status: scoped
created: 2026-06-18
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
depends_on:
  - Phase 166 (gated-chain-executor / runChain spine)   # COMPLETE 2026-06-18
  - Phase 122 (command-registry), Phase 143.3 (connector-registry), Phase 157 (orchestration projection)  # the three maps 167 unifies the READ of
realizes_seed: SEED-032 (harness-as-code)
related_seeds: [SEED-024, SEED-028]
source: "navigator 2026-06-18 -- the three-move architecture update (Harness / Larry-PAI / fable-mode), split out of Phase 166 to respect D-166-03 (three-map layering) and the 166 SPEC's deferral of the manifest"
sequence: "THIRD in v1.14.0 -- revised order 163 -> 166 -> 167 -> 164 -> 165, navigator-LOCKED 2026-06-18. Moved ahead of 164/165 (per 167-RESEARCH 4-lens) so they inherit generated wiring (HARN-03) + fable-mode (HARN-02) from birth."
---

# Phase 167: Harness-as-code completion

The navigator's three-move architecture update, mapped onto the three-layer stack
(Harness / Larry-PAI / fable-mode). Phase 166 shipped the EXECUTION runtime
(`runChain`). This phase completes the CONTROL plane (the declared manifest + its
generator) and strengthens the runtime DISCIPLINE (fable-mode), realizing SEED-032.

## Why this is a separate phase (not folded into 166)

Two of the three moves could not land in 166 without tearing up shipped work:
- Move 1 (one declared manifest) would have REVERSED D-166-03 (the locked three-map
  layering shipped in 166 Wave 1). The manifest must sit ON TOP of the three maps as
  a unified READ layer, not replace them.
- Move 3 (the generator) depends on Move 1 existing.
- The 166 SPEC explicitly named the manifest as a follow-on.
Navigator decision 2026-06-18: finish 166 as the tight executor; land all three moves
here. Move 2 (fable-mode) is included here too rather than retrofitting 166 post-verify.

## The three-layer mapping (the navigator's verdict, verbatim intent)

> Keep the connector contract as the wiring SOCKET. Wrap it in the declared MANIFEST
> (harness-as-code). Put the verify/self-critique DISCIPLINE (fable-mode) in the
> runtime. The socket stays a socket; the manifest governs what plugs in; fable-mode
> governs how each thing behaves when it runs.

## Requirements

### HARN-01 (Move 1 - Declaration): the declared harness manifest
Promote the `connector:` block + command frontmatter (posture / reach_id / sub_mode /
autonomous_safe / gates) into ONE declared, versioned harness manifest that the runtime
reads as the single entry point. CRITICAL: the manifest is a unified READ LAYER OVER the
three existing maps (command-registry = posture, connector-registry = wiring,
brain-orchestration-projection = ranked next-reach) per D-166-03 - it does NOT merge or
retire them. `recipe-maps.cjs` (166 W1) becomes the manifest's backing reader. The
manifest is generic machinery metadata only (Part 8): zero user data.

### HARN-02 (Move 2 - Execution): fable-mode step discipline in the runtime
Make fable-mode an explicit contract on `framework-runner` + `runChain`: every chain
step must VERIFY its output and SELF-CRITIQUE before its `chain_output` becomes the next
step's `previous_output`. This NAMES and STRENGTHENS the EXEC-02 quality gate already
built in 166: a step that fails self-critique escalates from `autonomous_safe` to a halt
(the verify/self-critique becomes a gate input alongside posture x quality). Reuse the
runChain `gateFn` + `framework-runner` FRAMEWORK_RUNNER_RESULT; do not fork.

### HARN-03 (Move 3 - Onboarding front door): the /mos:new-surface generator
Ship `/mos:new-surface` - the harness-as-code generator. Given a new command / agent /
skill, it emits the correct manifest entry (connector + frontmatter + posture + gates) so
wiring is never hand-written, and a `--check` gate proves the entry landed and is
well-formed (mirror the shipped `build-connector-registry.cjs --check` tripwire pattern).

## Reuse-before-build (Part 7)
Build on: `data/connector-registry.json` + `build-connector-registry.cjs` + `--check`
(143.3), `data/command-registry.json` + its generator (122), `data/brain-orchestration-
projection.json` + `build-orchestration-projection.cjs` (157), `lib/core/recipe-maps.cjs`
(166 W1), `lib/core/chain-executor.cjs` runChain `gateFn` (166 W2), `agents/framework-
runner.md` (the per-step brick). Net-new: the manifest schema + unifying reader, the
fable-mode verify/self-critique contract, the `/mos:new-surface` generator + `--check`.
No new orchestration framework (Canon: Claude IS the model; the spine IS the harness).

## Canon alignment
- Part 7: unification + repoint of shipped maps; near-zero net-new orchestration.
- Part 8: the manifest is `methodology_tier=mindrian-operation` machinery metadata (the
  Phase 157 amendment sanctioned exactly this projection); zero user-data egress; a
  build-time boundary scan over the manifest + generator proves it by construction.
- Part 9: any state the manifest reader touches goes through the navigation.cjs chokepoint.
- Part 3: fable-mode self-critique feeds the gateFn; the navigator still decides at every
  material/failed step.

## Out of scope / deferred
- Live Brain write of the manifest / continuous sync (Phase 137, deferred).
- Migrating every one of the 96 commands' wiring into the manifest in one pass - the
  generator makes per-surface wiring cheap; a bulk backfill can be its own follow-on.

## Open questions for plan-phase
- Manifest format: YAML/JSON config vs a thin CJS module (the plugin is CJS, no TS build
  step) - SEED-032 open question, decide at discuss-phase.
- Does the manifest read layer wrap recipe-maps.cjs, or does recipe-maps become the
  manifest reader (likely the latter)?
- fable-mode: a hard per-step gate (every step verifies) vs posture-scoped (only
  material/uncertain steps) - the token-cost tradeoff from the 166 token analysis applies.
