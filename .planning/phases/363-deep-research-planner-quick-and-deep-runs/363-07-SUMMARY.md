---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 07
subsystem: research-planner
tags: [scientific-roadmapping, perspective-builder, constraint-layer, ratchet, seed-098, research-planner]

requires:
  - phase: 363-05
    provides: plan.cjs (Plan.perspective shape, planHash)
  - phase: 363-06
    provides: scientific-roadmapping question-set fixture (perspective field names)
provides:
  - lib/core/research-planner/perspective.cjs - the research-perspective builder (Scientific Roadmapping engine), framework-keyed, reusable by SEED-098
  - tests/test-363-perspective.cjs - 17 legs (S1-S17)
affects: [363-08, 363-10, 363-11, 363-13, 363-14, 363-18, 363-22]

tech-stack:
  added: []
  patterns:
    - "Two literal columns for limiters (physics or assumed), no third; physics needs a derivation reference before research and a validated derivation row after"
    - "Catalytic ranking counts only steps the field pushes (adoption steps included); self-pushed dominoes never count"
    - "Ratchet lives in the filed run homes (research/*/plan.json); loadSettled is a tolerant read-only scan"

key-files:
  created:
    - lib/core/research-planner/perspective.cjs
    - tests/test-363-perspective.cjs
  modified: []

key-decisions:
  - "Only evidence-backed classifications settle in nextVersion (a physics limiter with derivation rows, or an assumed one with retest rows). An unclear limiter with no row stays an open question so it can still be asked again."
  - "classifyLimiter: retest rows win over derivation rows (re-tested means assumed), so a re-attacked derivation is not held as physics."
  - "A limiter matching a settled key with no new_evidence ids outside the settled evidence fails reopen_settled_without_new_evidence; any match (even one the question set lists as physics) counts as a reopen."
  - "Alias tolerance: limiter statement reads statement, label or text; derivation reads derivation_claim or derivation.claim; roadmap type compared case-insensitively (363-06 fixture uses label, derivation.claim, lowercase type)."
  - "Depth lite is legal only when options.mode is quick; lite still requires a tension, a falsifier and at least one limiter."

requirements-completed: []

duration: ~35min
completed: 2026-09-29
---

# Phase 363 Plan 07: Research-perspective builder Summary

**The Scientific Roadmapping engine as a pure CJS module: seven operations checked in the constraint layer, limiters sorted physics versus assumed (every assumed one carries a rewritten question), unlock-chain ranking that ignores self-pushed dominoes, S-curve reading, and a ratchet that refuses to reopen a settled constraint without new evidence.**

## PLAN_BASE

`5ba19c8105289c089a50e6ebb277c8079e33e9f1`

## Task commits

1. Task 1 (RED): `790d4d68e` test(363-07): failing research-perspective builder legs. Ran with 16 of 16 legs failing (module absent).
2. Task 2 (GREEN): `7a0074de2` feat(363-07): research-perspective builder, Scientific Roadmapping engine with ratchet (D-18, D-19). All 16 legs pass.
3. Follow-up: `40dff1dd7` fix(363-07): alias tolerance for the 363-06 fixture field names, leg S17.

All verified as ancestors of HEAD.

## Exported API (SEED-098 reuse contract)

`ENGINES, SR_OPERATIONS, FORUM_ROLES, ROADMAP_TYPES, buildPerspective, limiterKey, classifyLimiter, rankByUnlock, nextBindingConstraint, nextVersion, loadSettled, srStepGuide, describeEngine`.

`describeEngine()` returns:

```json
{"template_id":"scientific-roadmapping","engines":["scientific-roadmapping","constraint-layer"],
 "operations":["Tension Qualification","Goal Quantification","Rung Placement and Type Selection","Forum Construction","Path Enumeration","Constraint Interrogation","Catalytic Ranking"],
 "forum_roles":["frustrated_insider","fresh_entrant","physics_grounder"],
 "roadmap_types":{"UnDefined":["Landscape","Vision"],"IllDefined":["Manifesto","Technical Roadmap"],"WellDefined":["Pipeline","Opportunity"],"Wicked":["Landscape"]},
 "api_version":"1"}
```

## Signatures and shapes

- `buildPerspective(qs, {rung, scientific, template, depth, mode, settled, ratchet, supportByLimiter})` -> `{ok, perspective, errors[], warnings[]}`. `qs` = `{tension, goal, rung_phrase, forum[], paths[], limiters[], unlock_chains[]}`; forum entries may carry `contradicts: [{role, text}]` which become `perspective.tensions` verbatim; limiters may carry `derivation_row_id`, `derivation_claim`, `new_evidence[]`, `resolved`.
- `classifyLimiter(limiter, rows)` -> `{column, s_curve, advice route_around|push|unknown, basis_row_ids, reason validated_derivation|re_tested|unclear_filed_as_assumed}`. Rows are 363-11 rows; retracted rows are ignored; labels `derivation`, `retest`, `scurve_ceiling`, `scurve_headroom`.
- `rankByUnlock(perspective, {supportByLimiter})` -> `[{limiter_id, length, support, rank}]` (length desc, weakest support first, id asc). `nextBindingConstraint(perspective)` -> the limiter object or null.
- `nextVersion(plan, {run_id, classifications:[{limiter_id, column, basis_row_ids|evidence_row_ids}], discarded[]})` -> the ratchet skeleton `{version, parent_plan_hash, discarded, settled}` (input not mutated).
- `loadSettled(roomDir)` -> `[{limiter_key, column, evidence[], run_ref}]`; never throws, `[]` when nothing.
- `srStepGuide(ledgerLike)` -> `{source 'ledger'|'local_template', steps:[{order,name,key_question,gates}]}`. Accepts `ledger.frameworks['Scientific Roadmapping'].steps`, `ledger['Scientific Roadmapping'].steps` or `ledger.steps`.

Error codes (matched by prefix downstream): `no_nameable_limiter`, `goal_falsifier_missing`, `goal_not_quantified`, `forum_role_missing:<role>`, `forum_pass_order_duplicate:<n>`, `forum_role_silent:<role>`, `paths_too_few`, `no_10x_resurvey`, `assumed_limiter_question_missing:<id>`, `reopen_settled_without_new_evidence:<id>`, `depth_lite_requires_quick`. Warnings: `climb_rung_honestly`, `rung_unplaced`, `roadmap_type_unfit`, `physics_without_derivation_filed_as_assumed:<id>`, `paths_mece:<issue-tree text>`, `reopened_with_new_evidence:<id>`.

## Deviations from Plan

None - plan executed as written. One additive follow-up commit (alias tolerance plus leg S17) after checking the module against the 363-06 scientific-roadmapping fixture; that fixture then builds with no errors (one `roadmap_type_unfit` warning because it uses "technology roadmap", which is not in the article's type list).

## Known Stubs

None.

## Threat Flags

None. No network, no brain-client, no research-corpus require (leg S16 scans the require calls); loadSettled is read-only and tolerant of malformed files (T-363-30).

## Notes

Requirements DRP363-19 and DRP363-20 are not marked complete here: this plan delivers the engine and the adoption-step counting; the diffusion lens selection (363-10, 363-19) and the run-time synthesis (363-13) finish them.

## Self-Check: PASSED

- FOUND: lib/core/research-planner/perspective.cjs, tests/test-363-perspective.cjs
- FOUND commits 790d4d68e, 7a0074de2, 40dff1dd7 (ancestors of HEAD)
- `node tests/test-363-perspective.cjs`: 17 legs, 0 failed
