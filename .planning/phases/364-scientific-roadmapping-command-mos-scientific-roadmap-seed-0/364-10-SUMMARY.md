---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 10
subsystem: theo-handoff
tags: [theo-awareness, handoff, theo-notify, open-handoffs, folder-contract, tdd]
requires: [364-02, 364-06, 364-07, 364-08, 364-14]
provides:
  - "docs/2026-10-03-PHASE-364-THEO-NOTIFY.md: the plugin-side Theo handoff (slug, frameworks, connector, two chains, recipes unchanged at 5, command count 113 to 114, the alias row Theo must add, the live NULL label/runIt state, release mechanism, the handoff-log line)"
  - "docs/OPEN-HANDOFFS.md: newest-first cross-repo row linking the doc"
  - "lib/core/research-planner/CONTEXT.md: sr-steps, sr-entry, sr-door, sr-filing file-map rows and the /mos:scientific-roadmap reuse row"
  - "tests/test-364-theo-handoff.cjs: T1-T8, all green"
affects: [364-11, 364-12, 364-13]
key-files:
  created:
    - docs/2026-10-03-PHASE-364-THEO-NOTIFY.md
    - tests/test-364-theo-handoff.cjs
  modified:
    - docs/OPEN-HANDOFFS.md
    - lib/core/research-planner/CONTEXT.md
key-decisions:
  - "The notify doc is dated 2026-10-03 (the real execution date), not 2026-10-02 as the plan's example name; the test matches any date."
  - "The alias row is given as a skeleton with evidence and note left for Theo to fill; the chapter choice (null vs the bottleneck anchor) is Theo's ruling."
requirements-completed: [SRM364-20]
metrics:
  tasks: 2
  completed: 2026-10-03
---

# Phase 364 Plan 10: Theo notify, handoff row, folder-contract rows Summary

Theo now has one tracked, plugin-side document naming everything its sync will read from the command, the one alias-table row it must add, the plain statement that Scientific Roadmapping's seven steps still come back NULL so the command refuses until Phase 25, and the exact log line to append; nothing was written under the Theo repo.

PLAN_BASE: `2bee32644055431a577c1393f6bc8f7021bdcf78`

## Commits (ancestors of HEAD, both made with `git commit --only`)

| Task | Sha | Files |
|------|-----|-------|
| 1 RED legs | 3431dfbdf | tests/test-364-theo-handoff.cjs |
| 2 GREEN doc, row, contract rows | 16979d979 | docs/2026-10-03-PHASE-364-THEO-NOTIFY.md, docs/OPEN-HANDOFFS.md, lib/core/research-planner/CONTEXT.md |

## RED proof (3431dfbdf)

7 failures (T1-T7), T8 and the network-guard check pass: 2 pass / 7 fail. After 16979d979: 9 pass / 0 fail. Eight distinct `check('T` legs.

## What the doc covers (orchestrator additions included)

- Slug, both frameworks (Scientific Roadmapping primary), connector (context_block, hold, hierarchy_rank 6, no sensor triggers), both curated chains with confidences and transforms, copied from the registries and pinned by T3 and T4.
- Recipes unchanged: NAMED_RECIPES 1 + SENS10_CAUSE_RECIPES 4 = 5 = EXPECTED_RECIPE_COUNT.
- MindrianCommand count: 114 measured 2026-10-03 against 113 without this command.
- 364-14: a stamped eureka finding enters at step 6 (Constraint Interrogation) with its stamp verbatim; the eureka handoff resolves Scientific Roadmapping to `/mos:scientific-roadmap` through the existing command resolver (no code needed, pinned by H1-H4).
- 364-02 canon snapshot: 414 names including Scientific Roadmapping, 80/20 Rule, Babson Model (Magical Thinking), Systematic Inventive Thinking (SIT), with a theo_stamp.
- Live Theo state (2026-10-02): NULL label and runIt for all 7 steps; the command refuses with "Theo has not authored this step yet" until Phase 25 authors them.
- Theo's alias table has no Scientific Roadmapping row, so its USES_FRAMEWORK edge needs that row Theo-side (fail-closed `framework_unresolved` until then).
- Release: release-cut-listener, Step 0.55, Step 5.6 retired, snapshot stamp rule; release id left to the release session.

## Verification

- `node tests/test-364-theo-handoff.cjs`: exit 0, 9 pass.
- Additions only: `git show 16979d979 -- docs/OPEN-HANDOFFS.md lib/core/research-planner/CONTEXT.md | grep -c '^-[^-]'` prints 0.
- Theo repo `git status --porcelain` byte-identical before and after (captured to the scratchpad; the repo already had one unrelated dirty entry, untouched).
- No deletions in the commit; STATE.md and ROADMAP.md untouched; `tests/run-all-364.sh` already carried the `364 theo handoff` leg.
- docs/OPEN-HANDOFFS.md was clean before the edit (no peer dirt).

## Deviations from Plan

**1. [Naming] Doc dated 2026-10-03 instead of 2026-10-02.** The plan said to record a rename if the execution date differs; today is 2026-10-03. The live Theo NULL-steps reading is still cited as the 2026-10-02 probe, as the orchestrator stated it. Test T1 matches any date.

Otherwise none: the plan executed as written.

## Known Stubs

The alias-row skeleton in the doc leaves `evidence` and `note` as `<Theo to fill>`. This is intentional: those fields cite Theo's own live read and belong to the Theo session. No stub reaches any UI or code path.

## Threat Flags

None. No network endpoint, auth path or schema change; docs and a static test only.

## Self-Check: PASSED

Files found: docs/2026-10-03-PHASE-364-THEO-NOTIFY.md, tests/test-364-theo-handoff.cjs, this SUMMARY. Commits 3431dfbdf and 16979d979 are ancestors of HEAD.
