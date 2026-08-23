# Phase 264: Roadmap-Type Selector: challenge-driven act-chain orchestration for the research command family — Specification

**Created:** 2026-08-23
**Ambiguity score:** 0.18 (gate: ≤ 0.20)
**Requirements:** 5 locked

## Goal

A navigator's stated research goal gets silently classified into one of six roadmap
output-shapes (Landscape Analysis / Technical Roadmap / Pipeline Analysis / Opportunity
Analysis / Agenda-Setting Manifesto / Vision Paper) and resolved to the matching
framework-name chain via the existing `chain_resolve`/`chain_run` seam; the flagship
Technical Roadmap chain's `find-bottlenecks` step additionally opts into the already-shipped
`ralph_verify` bounded self-critique seam with an adversarial-panel `selfCritiqueFn`, proving
challenge-driven execution end to end without touching `chain-executor.cjs`'s stop-condition
contract (B3 / Canon Part 3 stays intact, verified not asserted).

## Background

**Origin:** `rethinking-mindrianos/research/2026-08-23-scientific-roadmapping-orchestrator/`
-- a navigator-shared synthesis of Convergent Research's "Scientific Roadmapping" (six
roadmap-type output taxonomy) and Leibo et al.'s "A Manifesto for Multi-Agent Intelligence
Research" (autocurricula / challenge-driven run loops), mapped onto MindrianOS's existing
research command family.

**Current state, grounded in code (this session's scouting):**

- MindrianOS ships the research PRIMITIVES the six roadmap types would chain
  (`find-bottlenecks`/Reverse Salient, `find-connections`, `whitespace`, `find-analogies`,
  `macro-trends`/`explore-futures`, `build-thesis`) but nothing classifies which of the six
  output shapes a navigator is actually after before picking a chain.
- `lib/workflow/command-resolver.cjs::composeWorkflow` (`chain_resolve`) and
  `lib/core/chain-executor.cjs::runChain` (`chain_run`, Phase 166) are the ONE shipped
  chain-resolution/execution seam. `SENSOR_REGISTRY` in `lib/core/insight-sensors.cjs`,
  dispatched by `lib/core/navigation-engine.cjs`, is the ONE shipped reach-candidate seam
  (`sensorX(context) -> candidate|null` functions in a canonical array).
- **Critical grounding correction to the research trail's original framing:** the research
  trail assumed an "autocurriculum run loop" would need new cross-step convergence logic in
  `chain-executor.cjs`. It would not just be new — it would be **already-rejected**.
  `chain-executor.cjs`'s own header names it: *"NO convergence stop (B3): the SEED-032 /
  imported-harness 'loop until all PASSING' convergence branch is REJECTED. The stop
  condition is posture / quality / maxSteps ONLY."* Phase 166's own SPEC.md (`B3`) states the
  reason plainly: *"Canon Part 3 mandates the chain halt at the first material step... the
  stop condition is posture-driven, never autonomous-convergence-driven."* A cross-step
  auto-loop would be a constitutional violation, not an implementation choice.
- **What the scouting also found, which resolves the tension:** `chain-executor.cjs` already
  ships a DIFFERENT, B3-compliant seam for exactly this purpose — `_applySelfCritique` (a
  material-step self-critique gate input, Phase 167/D-167-04) and `_ralphSafeRetry`
  (`ralph_verify: true`, SEED-033 L1, Phase 201-02): a bounded (cap 2, budget-checked)
  retry-with-critique loop that operates **inside one step's own execution**, never across
  steps, and forces a halt (never a silent pass) on exhaustion. Both are explicitly documented
  as gate INPUTS, "no new halt reason, no retry [across steps], no loop [across steps] --
  the verdict is a gate input, never a convergence stop condition (166 B3)."
- This seam is shipped but unused outside its own test fixture (`grep` found `ralph_verify`
  nowhere but `tests/test-201-bounded-retry.cjs`; no real command supplies a
  `selfCritiqueFn` for the research command family). Adjacent subsystems already have
  working adversarial-panel `selfCritiqueFn` implementations worth reusing per Canon Part 7
  (`lib/core/bono/reviewer-governance.cjs`, `lib/core/bono/debate-composition.cjs` --
  N-expert challenge patterns for the BONO research-debate engine).

**The resolved proposal:** the "autocurriculum" ambition from the research trail is real and
achievable, but lives at the RIGHT layer — inside a single chain step's own execution via the
already-shipped `ralph_verify`/`selfCritiqueFn` seam — not as new cross-step convergence logic.
This phase classifies the output shape, resolves the chain, and proves challenge-driven
execution on ONE flagship step, reusing shipped machinery throughout.

## Requirements

1. **Output-shape classifier sensor**: A navigator's stated research goal is silently
   classified into one of the six roadmap output-shapes, or none.
   - Current: No sensor or mechanism performs this classification; a navigator (or Larry)
     picks a research command by improvisation.
   - Target: A new `sensorX(context) -> candidate|null` function, registered in
     `SENSOR_REGISTRY` (`lib/core/insight-sensors.cjs`) following the existing contract used
     by `sensorLaggingComponent`/`sensorDiffusionAdoption` etc., classifies a turn's stated
     research goal into 1-of-6 roadmap types or fires nothing.
   - Acceptance: A fixture table of >=12 sample utterances (2 per roadmap type + 2 turns that
     are not research-shaped) classifies correctly; the 2 negative fixtures produce no
     candidate.

2. **Roadmap-type -> chain lookup table**: Each of the six roadmap types resolves to a real,
   validated framework-name chain.
   - Current: The six mappings exist only as prose in the research-trail entry; no committed
     data artifact encodes them.
   - Target: A new committed data file (e.g. `data/roadmap-type-chains.json`), validated at
     build time the same way `data/command-registry.json` is validated, mapping each roadmap
     type to an ordered FRAMEWORK-NAME array -- `composeWorkflow` takes framework names, not
     command slugs (corrected during discuss-phase; the original draft listed command slugs
     by mistake). Technical Roadmap -> `["Problem Definition Transformation Framework",
     "Reverse Salient Analysis", "Knowns and Unknowns Matrix Framework"]`, verified live via
     `commandsForFramework`/`frameworksForCommand` against `/mos:diagnose`, `/mos:find-bottlenecks`,
     `/mos:map-unknowns`.
   - Acceptance: A validator confirms every framework name in all six chains resolves via
     `commandsForFramework` (command-resolver.cjs) against `framework_index` (not
     `framework-names.json` -- a name can pass a bare allowlist and still degrade to
     `{command: null, optional: true}`) with zero dangling names; exits 0.

3. **Sensor-to-`chain_resolve` wiring**: An approved reach hands off directly to the existing
   Phase 166 chain-resolution seam, no new execution path.
   - Current: Sensors surface a reach candidate as verb/prose text only; nothing hands a
     resolvable chain array to `chain_resolve`.
   - Target: The new sensor's candidate payload carries a `suggested_chain` field (the
     resolved framework-name array from Requirement 2) so `chain_resolve` can compose it
     directly.
   - Acceptance: An integration test drives one sample turn through `dispatchSensors`, the
     new sensor fires, and its `suggested_chain`, passed to `chain_resolve`
     (`composeWorkflow`), returns a plan with no `command: null` on a required (non-optional)
     step.

4. **Flagship challenge-driven step**: the Technical Roadmap chain's `find-bottlenecks` step
   runs under the shipped `ralph_verify` bounded self-critique seam with a real
   adversarial-panel critic.
   - Current: `ralph_verify`/`selfCritiqueFn` is shipped (Phase 201-02) but exercised only by
     its own test fixture; `find-bottlenecks` runs with no critique step today.
   - Target: The Technical Roadmap chain's `find-bottlenecks` step sets
     `ralph_verify: true` and supplies a `selfCritiqueFn` built by adapting the existing
     adversarial reviewer-panel pattern (`lib/core/bono/reviewer-governance.cjs` /
     `debate-composition.cjs`) — an N-skeptic majority-refute pass against each candidate
     Reverse Salient finding before the step's `chain_output` is finalized.
   - Acceptance: A fixture run where the first candidate fails critique shows exactly one
     retry (cap honored), then either a passing verdict or a forced `LOW_QUALITY` halt at the
     SAME gate point Phase 166's suite already checks; `tests/run-all-166.sh` passes
     unmodified.

5. **B3 / Canon Part 3 compliance is proven, not asserted**.
   - Current: No test in this phase's design has yet been run against the constitutional
     constraint; the compliance claim above is reasoning only.
   - Target: This phase's own test suite (`tests/run-all-264.sh`) runs `tests/run-all-166.sh`
     as a regression gate and adds one assertion that a `ralph_verify` step still halts
     (never silently proceeds) on retry exhaustion, and that every non-opted-in step's
     `haltedAt`/gate behavior is byte-identical to the pre-existing Phase 166 contract.
   - Acceptance: `tests/run-all-166.sh` passes unmodified after this phase's changes land;
     `git diff` for this phase touches zero lines inside `lib/core/chain-executor.cjs`'s
     gate/stop-condition functions (`_isMaterialStep`, the default gate predicate,
     `_ralphSafeRetry`'s loop bound).

## Boundaries

**In scope:**
- New sensor classifying a research-goal turn into 1-of-6 roadmap types (or none)
- New static, validated data table mapping the six types to framework-name chains
- Wiring the sensor's `suggested_chain` to the existing `chain_resolve` seam
- `find-bottlenecks`'s step in the Technical Roadmap chain opting into `ralph_verify` with a
  reused adversarial-panel `selfCritiqueFn` — ONE flagship chain, proof of the pattern
- Regression proof against `tests/run-all-166.sh`

**Out of scope:**
- Any change to `chain-executor.cjs`'s core loop/gate/stop-condition logic — the entire point
  is proving the existing `ralph_verify` seam suffices; if it doesn't, that is a new phase's
  problem, not a silent workaround in this one
- Extending `ralph_verify`/`selfCritiqueFn` to the other five roadmap-type chains' steps —
  flagship proof first (Simplifier discipline), generalize later as a follow-on phase
- Any new UI/reach-card rendering for a multi-step suggested chain — reuses the existing
  Shape F.1 rendering as-is
- The research trail's "Brain graph as cultural memory" claim — `graph_query`/`graph_write`
  are already shipped and untouched by this phase; no new graph-memory work here
- Retroactive reclassification of past sessions — forward-looking classification only

## Constraints

- **Canon Part 3** (Tri-Context Decision Gate): the chain halts at the first material step;
  this phase adds zero cross-step convergence logic (B3 stays rejected, correctly).
- **Canon Part 7** (Reuse Before Build): the classifier reuses the existing `sensorX(context)`
  contract; the critic reuses the existing BONO reviewer-panel pattern; the chain-table
  validator reuses the existing `command-registry.json` build-time validation pattern. No new
  reach-selection brain, no new executor, no new critic architecture.
- **Canon Part 8** (Graph Boundary): the classifier sensor and chain lookup table are LOCAL
  only; zero Brain egress (mirrors every existing `SENSOR_REGISTRY` entry).
- `SENSOR_REGISTRY` function contract must be honored exactly (`sensorX(context) ->
  candidate|null`) so `dispatchSensors`' canonical iteration order handles the new entry
  uniformly with the other ~14 sensors already registered.

## Acceptance Criteria

- [ ] New sensor added to `SENSOR_REGISTRY`; classifies >=12/12 fixture utterances correctly
      (2 per roadmap type + 2 true negatives)
- [ ] `data/roadmap-type-chains.json` committed; all 6 chains' framework names resolve via
      `commandsForFramework` with zero dangling names
- [ ] Sensor's reach candidate carries a `suggested_chain` field that `chain_resolve` composes
      with no `command: null` on a required step
- [ ] `find-bottlenecks`'s Technical Roadmap step runs with `ralph_verify: true` and a real
      adversarial-panel `selfCritiqueFn`; a synthetic weak-candidate fixture shows the bounded
      retry then a passing verdict or forced `LOW_QUALITY` halt
- [ ] `tests/run-all-166.sh` passes unmodified; zero diff inside
      `lib/core/chain-executor.cjs`'s gate/stop-condition functions
- [ ] `tests/run-all-264.sh` (this phase's own suite) passes

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|---------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Two-part, measurable: classify + prove challenge-driven exec on one flagship chain |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit in/out lists; out-of-scope items carry reasoning     |
| Constraint Clarity | 0.75  | 0.65 | ✓      | Canon Parts 3/7/8 named with concrete file-level implications |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 6 pass/fail checkboxes, tied to named test suites              |
| **Ambiguity**      | 0.18  | ≤0.20| ✓      |                                                                 |

Status: all dimensions met minimum; no assumption-flagged requirements.

## Interview Log

| Round | Perspective              | Question summary                                                                 | Decision locked                                                                                     |
|-------|---------------------------|------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| 1     | Researcher (self-directed)| Scouted `chain-executor.cjs`, `command-resolver.cjs`, `SENSOR_REGISTRY`, ROADMAP/REQUIREMENTS/STATE | Found B3's real rejection reason (Canon Part 3) AND the already-shipped `ralph_verify`/`selfCritiqueFn` seam that resolves it |
| 2     | Boundary Keeper / Failure Analyst | Research trail's "autocurriculum run loop" collides with B3 (SEED-032 rejected) — narrow scope, or take it on? | Navigator: take it on — resolved via the shipped intra-step `ralph_verify` seam (never a cross-step loop), reusing the BONO reviewer-panel critic pattern |

---

*Phase: 264-roadmap-type-selector-challenge-driven-act-chain-orchestrati*
*Spec created: 2026-08-23*
*Next step: /gsd-discuss-phase 264 — implementation decisions (exact sensor placement, JSON schema for the chain table, which BONO helper the critic adapts)*
