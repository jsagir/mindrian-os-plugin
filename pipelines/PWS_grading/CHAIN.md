---
name: PWS_grading
display_name: PWS Grading Pipeline
description: Turn one pitch's evidence into formative feedback -- deep-grade, Mullins, scored thesis, Minto packaging
stages: 4
estimated_time: 8-12min
venture_stages: [Validation]
problem_types: [well-defined-complex, ill-defined-complex]
hitl_stages:
  - stage: "deep-grade"
    shapes: ["F.8"]
    mode: "ordered"
  - stage: "mullins"
    shapes: ["F.8"]
    mode: "ordered"
  - stage: "build-thesis"
    shapes: ["F.9"]
    mode: "ordered"
  - stage: "structure-argument"
    shapes: ["F.9"]
    mode: "ordered"
hitl_why: "Four ordered stages from a pitch's quote-anchored evidence to packaged formative feedback: deep-grade then mullins then build-thesis (scored, non-gating) then structure-argument, each stage feeding the next. Under the frozen course-tier rubric (references/methodology/rubric-huji.md) the chain runs score-and-continue, never halting on the build-thesis 6/10 gate."
---

# PWS Grading Pipeline

## When to Use

A student's pitch has been extracted into a quote-anchored evidence JSON and a
populated scratch room (Stage A intake), and you need one written formative
feedback artifact tiered to course depth, not investor depth. This is the HUJI
pitch-feedback chain: the batch spawns `/mos:pipeline PWS_grading` once per
submission, and each headless session runs this chain on the shared runChain
spine.

Typical starting point:
- "I have a diarized pitch transcript extracted into evidence and need formative
  feedback a student can act on before the next milestone."

## Stage Sequence

1. **deep-grade** -- Score the room against the calibrated project corpus at course tier
2. **mullins** -- Run the 7-Domains market/venture read (BEFORE build-thesis)
3. **build-thesis** -- Score all ten questions and CONTINUE (non-gating, never halts below 6/10)
4. **structure-argument** -- Package the surviving points as a Minto Pyramid (governing thought first)

The order is navigator-locked (15.7.2026) and MIRRORS the single ordering
authority `NAMED_RECIPES.PWS_grading` in `lib/core/recipe-maps.cjs`. mullins runs
BEFORE build-thesis; structure-argument is last as the Minto packaging step. This
CHAIN.md is a mirror of the recipe-maps list, never a competing order.

## Score-and-Continue Mode

The build-thesis Ten-Questions gate ships as a prompt-level 6/10 "Binary gate."
For a 200-person course that halt would abort the batch ("half the class fails
question 2 and learns nothing"). Two layers neutralize it:

- **Chain-level (code):** all four commands are `autonomous_safe: true`, so
  runChain auto-runs each step and never reaches a material human gate under
  `--permission-mode dontAsk`. `validateChainAutonomy` reports zero blockers.
- **Prompt-level (natural language):** the frozen `${CLAUDE_PLUGIN_ROOT}/references/methodology/rubric-huji.md`,
  appended via `--append-system-prompt-file`, instructs build-thesis to SCORE all
  ten questions and CONTINUE unconditionally, emitting per-question scores as
  feedback input. `${CLAUDE_PLUGIN_ROOT}/references/methodology/build-thesis-scored.md` is the
  demo-verified fallback if the rubric override alone leaves a residual halt.

## What It Produces

After all 4 stages, the scratch Room will have:
- **deep-grades:** calibrated grade artifact at course tier
- **mullins:** 7-Domains read of the venture
- **financial-model:** scored Ten-Questions thesis (non-gating; per-question scores as feedback)
- **argument:** Minto Pyramid packaging the feedback (governing thought + 2-3 branches)

## Chain Provenance

Each artifact includes `pipeline: PWS_grading` and `pipeline_stage: N` in
frontmatter, creating an inspectable provenance chain. This lets a later pass
detect existing pipeline progress and audit which stage produced what.
