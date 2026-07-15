---
phase: 229-huji-pitch-feedback-module
plan: 04
subsystem: api
tags: [recipe-maps, pipeline, chain-executor, build-thesis, rubric, score-and-continue, PWS_grading]

requires:
  - phase: 229-01
    provides: "CONTRACTS.md RECIPE_HOME + PIPELINE_ARG + SCORED_MODE decisions (named-pipeline resolver, NAMED_RECIPES home, prompt-level 6/10 halt neutralization strategy)"
provides:
  - "NAMED_RECIPES frozen map + recipeForName accessor in lib/core/recipe-maps.cjs (posture/order authority for named recipes)"
  - "PWS_grading recipe key in navigator-locked native order (deep-grade -> mullins -> build-thesis -> structure-argument)"
  - "pipelines/PWS_grading/CHAIN.md + 4 stage contracts so /mos:pipeline PWS_grading resolves the chain"
  - "references/methodology/rubric-huji.md (frozen course-tier score-and-continue rubric, primary halt neutralization)"
  - "references/methodology/build-thesis-scored.md (fallback scored non-gating Ten-Questions variant)"
affects: [229-05, 229-07, 229-09]

tech-stack:
  added: []
  patterns:
    - "Named-recipe registration: sibling frozen map + slice-copy accessor (NAMED_RECIPES/recipeForName mirrors SENS10_CAUSE_RECIPES/recipeForCause)"
    - "Prompt-layer gate neutralization: score-and-continue via --append-system-prompt-file frozen rubric, never a command fork or CLI flag"

key-files:
  created:
    - pipelines/PWS_grading/CHAIN.md
    - pipelines/PWS_grading/01-deep-grade.md
    - pipelines/PWS_grading/02-mullins.md
    - pipelines/PWS_grading/03-build-thesis.md
    - pipelines/PWS_grading/04-structure-argument.md
    - references/methodology/rubric-huji.md
    - references/methodology/build-thesis-scored.md
  modified:
    - lib/core/recipe-maps.cjs

key-decisions:
  - "NAMED_RECIPES is a sibling frozen map to SENS10_CAUSE_RECIPES, not a modification of it; recipeForName mirrors recipeForCause exactly (slice-copy, unknown->[], never throws, no fabricated autonomous_safe literals)"
  - "The build-thesis 6/10 halt is neutralized at the PROMPT layer (frozen rubric-huji.md via --append-system-prompt-file), never via a CLI flag or command fork; build-thesis-scored.md is the demo-verified fallback"
  - "CHAIN.md stage order is a MIRROR of the recipe-maps ordering authority, never a competing order"

patterns-established:
  - "Named-recipe home: frozen bare-command map + slice-copy accessor, posture sourced from postureForCommand only"
  - "Score-and-continue: prompt-level score-all-ten override keeps the frozen prefix bit-stable for prompt caching + grade provenance"

requirements-completed: [D3, D5, D7]

duration: 22min
completed: 2026-07-16
---

# Phase 229 Plan 04: PWS_grading Recipe + Score-and-Continue Summary

**Registered the PWS_grading named recipe (recipe-maps NAMED_RECIPES + shipped pipelines/PWS_grading/ CHAIN) in navigator-locked native order, and neutralized the build-thesis 6/10 halt at the prompt layer via a frozen course-tier rubric so the four-command chain runs unattended in score-and-continue mode.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-07-16
- **Tasks:** 2
- **Files modified:** 8 (1 modified, 7 created)

## Accomplishments
- `NAMED_RECIPES` frozen map + `recipeForName(name)` accessor added to `recipe-maps.cjs` as a sibling to `SENS10_CAUSE_RECIPES`, mirroring the `recipeForCause` slice-copy contract exactly (fresh copy, unknown/empty name -> `[]`, never throws, zero fabricated `autonomous_safe` literals).
- `PWS_grading` resolves the 4-command chain in navigator-locked native order: `/mos:deep-grade -> /mos:mullins -> /mos:build-thesis -> /mos:structure-argument` (mullins BEFORE build-thesis; structure-argument last as Minto packaging).
- Shipped `pipelines/PWS_grading/CHAIN.md` + four numbered stage contracts (`01-deep-grade`, `02-mullins`, `03-build-thesis`, `04-structure-argument`) so the `/mos:pipeline PWS_grading` resolver runs the chain; the CHAIN order mirrors the recipe-maps authority.
- `rubric-huji.md`: the frozen course-tier score-and-continue rubric (primary halt neutralization via `--append-system-prompt-file`) - score all ten and continue unconditionally, tier to course depth (not investor), Part 12 tone (formative, credit self-identified gaps, never punish disfluencies), with a marked few-shot slot for the 2 Amnon samples (Plan 09).
- `build-thesis-scored.md`: the fallback scored, non-gating Ten-Questions variant invoked by the recipe only if the demo shows a residual halt.

## Task Commits

1. **Task 1: Register PWS_grading recipe + shipped pipeline definition** - landed in `ae315779` (feat; swept into a concurrent version-bump commit by the shared-index race - see Issues; content verified clean vs HEAD and behaviorally correct)
2. **Task 2: Score-and-continue mechanism (rubric + fallback)** - `1427c830` (feat)

## Files Created/Modified
- `lib/core/recipe-maps.cjs` - NAMED_RECIPES frozen map + recipeForName accessor + module.exports, mirroring the SENS-10 pattern
- `pipelines/PWS_grading/CHAIN.md` - shipped named-pipeline definition (4 stages, venture_stages [Validation], hitl_stages, score-and-continue note)
- `pipelines/PWS_grading/01-deep-grade.md` .. `04-structure-argument.md` - the four numbered stage contracts in native order, each declaring Input Extraction / Stage Instructions / Output Contract + room_section handoff
- `references/methodology/rubric-huji.md` - frozen course-tier rubric, primary score-and-continue override
- `references/methodology/build-thesis-scored.md` - fallback scored non-gating Ten-Questions variant

## Decisions Made
- Followed CONTRACTS.md RECIPE_HOME/PIPELINE_ARG/SCORED_MODE exactly. NAMED_RECIPES is a new sibling const (the registry `curated_chains` has no PWS_grading and `thesis` is a different set/order), not a change to SENS10_CAUSE_RECIPES.
- Neutralized the halt only at the prompt layer, keeping the shipped `commands/build-thesis.md` and `references/methodology/build-thesis.md` untouched (no fork, no drift, frozen-prefix cache preserved).
- Stage `room_section` values sourced from each command's `produces` frontmatter: deep-grades, mullins, financial-model (build-thesis, matching the thesis chain), argument.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes (Rules 1-3) were required; both `--check` gates (connector-registry, recipe-maps authority test 4/4, 205 pipelining 10/10) passed unchanged.

## Issues Encountered

**Shared-index commit race (environment, not a code defect).** A concurrent session (phases 223/227/release-cut) is committing to the same shared main branch and working tree. During Task 1's commit, the shared git index caused (a) my first commit attempt to fail with a ref-lock error, and (b) my staged Task 1 files (recipe-maps.cjs + 5 pipeline files) to be swept into the concurrent session's version-bump commit `ae315779`, while my own commit `39fc72f3` swept up a concurrent 227-SWEEP-FINDINGS.md file. Net effect: all 8 of my declared files are committed to git history, clean vs HEAD, and behaviorally verified (recipeForName order match, unknown->[], slice-copy all true; both rubric files pass their greps + em-dash check). Commit boundaries blurred but no content was lost. Task 2 committed cleanly (`1427c830`) with exactly its two files. This matches the sequential-executor note that concurrent commits touching files outside my plan are expected.

## Next Phase Readiness
- Both seams (d) recipe registration and (c) score-and-continue exist, so the single-submission runner (Plan 07) can drive `/mos:pipeline PWS_grading` unattended.
- The rubric few-shot slot is intentionally empty and marked; Plan 09 embeds the 2 Amnon-approved samples after the demo.
- The `--suite demo` run (Plan 07+) is the arbiter of whether the rubric-file override alone stops the halt or the `build-thesis-scored.md` fallback is adopted.

## Self-Check: PASSED

All 8 declared files exist on disk. All task/summary commits (ae315779 Task 1 content, 1427c830 Task 2, 33b28925 SUMMARY) present in git history.

---
*Phase: 229-huji-pitch-feedback-module*
*Completed: 2026-07-16*
