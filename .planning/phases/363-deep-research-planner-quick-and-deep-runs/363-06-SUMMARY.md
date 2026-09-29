---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 06
subsystem: research-planner
tags: [minto, mece, pyramid, question-templates, d-00, logic-trees, research-planner, issue-tree]

requires:
  - phase: 363-05
    provides: plan.cjs (LEAF_ORIGINS, BUDGETS.PYRAMID_DEPTH_CAP, the plan-side pyramid and leaf shapes this plan fills)
provides:
  - lib/core/research-planner/question-templates.cjs - six frozen planner templates with closed dimension sets, templateForCommand, templateForFramework, dimensionsFor, validateQuestionSet
  - lib/core/research-planner/pyramid.cjs - buildPyramid, checkPyramid (D-00 gate, coverage, MECE, falsifiers), applyLogicTreeSteps, rollUp, weakestBranch, opportunityCandidates, OPPORTUNITY_KINDS
  - tests/test-363-pyramid.cjs - 21 checks (Y1-Y15)
  - tests/fixtures/363-question-sets/ - seven mos.research-question-set/1 fixtures
affects: [363-07, 363-08, 363-10, 363-11, 363-12, 363-13, 363-14, 363-19, 363-20]

tech-stack:
  added: []
  patterns:
    - "A template is a checklist of the questions a framework says to ask; an unasked item is a question the navigator did not know to ask, listed and never hidden"
    - "issue-tree validators reused through a bridge that maps leaves to { label, test, branches } nodes; exhaustiveness comes from coverage, never from validateMECE alone (Pitfall 19)"
    - "Every warning is surfaced: pyramid.mece.warnings carries MECE, restatement and falsifiability text together, so the F.6 card prints all of them"

key-files:
  created:
    - lib/core/research-planner/question-templates.cjs
    - lib/core/research-planner/pyramid.cjs
    - tests/test-363-pyramid.cjs
    - tests/fixtures/363-question-sets/map-unknowns.json
    - tests/fixtures/363-question-sets/root-cause.json
    - tests/fixtures/363-question-sets/think-hats.json
    - tests/fixtures/363-question-sets/whitespace-quick.json
    - tests/fixtures/363-question-sets/diffusion.json
    - tests/fixtures/363-question-sets/scientific-roadmapping.json
    - tests/fixtures/363-question-sets/restated-only.json
  modified: []

key-decisions:
  - "PYRAMID_DEPTH_CAP is read from plan.cjs BUDGETS (it is not a top-level export); pyramid.cjs throws at load if it is missing rather than silently comparing against undefined."
  - "Governing status follows the plan text literally: all branches supported -> strengthened; any contested branch -> split; else any contradicted -> weakened; else unresolved. A new pyramid starts as restated (the thought as stated, untested)."
  - "The Plan status after checkPyramid is one of wish (D-00 failed), incomplete (template dimension uncovered, missing falsifier or depth breach), needs_lens_leaves (only lens dimensions missing), ready."
  - "Closed dimensions (not researchable with a stated reason) count as covered without a leaf; a researchable leaf on a closed dimension is refused unless its origin is mece_gap (the optional unknown-unknown question)."

patterns-established:
  - "Question-set shape errors are short codes ('leaf_origin_invalid:L3') matched by prefix"
  - "checkPyramid never mutates; applyLogicTreeSteps, rollUp and buildPyramid clone their inputs"

requirements-completed: [DRP363-02]

duration: ~45min
completed: 2026-09-29
---

# Phase 363 Plan 06: Planner templates and the Minto pyramid over issue-tree Summary

**Six planner templates (each a closed checklist of what its framework must ask) and a pyramid builder and checker that turn Larry's question set into MECE-checked, falsifiable leaves, refuse a plan that only restates the navigator (D-00), list every unasked dimension, and roll evidence back up to a governing status, weakest branch and opportunity candidates.**

## PLAN_BASE

`56685e6571b84a5c6d7e2de3f743cf8de3075773`

## Task commits

1. Task 1 (RED): `f9916a00e` test(363-06): question-set fixtures and failing pyramid legs. Ran non-zero (20 legs failed on the missing modules).
2. Task 2 (GREEN): `efb188bdd` feat(363-06): planner templates and Minto pyramid over issue-tree. All 21 legs pass.

Both commits verified as ancestors of HEAD.

## Template dimension ids (stable API for the command doors and SEED-098)

| Template id | Framework | Door | Dimension ids |
|-------------|-----------|------|---------------|
| map-unknowns | Knowns and Unknowns Matrix Framework | /mos:map-unknowns | mu:known_known, mu:blind_spot, mu:hidden_known (closed), mu:unknown_unknown (closed; optional mece_gap leaf) |
| root-cause | Root Cause Analysis | /mos:root-cause | rc:why_link, and required only when the question set declares `multi_cause: true`: rc:6m_man, rc:6m_machine, rc:6m_method, rc:6m_material, rc:6m_measurement, rc:6m_nature (otherwise closed, reason "single causal chain") |
| think-hats | Six Thinking Hats | /mos:think-hats | hat:white, hat:black, hat:yellow, hat:green, hat:red (closed), hat:blue (closed) |
| whitespace | HSI Semantic Surprise Analysis Assistant (verbatim from commands/whitespace.md) | /mos:whitespace | ws:gap_claim, ws:covered_elsewhere, ws:irrelevant (closed), ws:extraction_failure (local room check) |
| diffusion | Adoption-Capacity Theory | /mos:diffusion | df:first_adopters, df:absorptive_capacity, df:civil_defense_crossing, df:timing |
| scientific-roadmapping | Scientific Roadmapping | /mos:research (explicit_only) | sr:tension, sr:goal, sr:rung (closed), sr:forum_insider (closed), sr:forum_entrant (closed), sr:forum_grounder (closed), sr:paths, sr:paths_10x, sr:limiters, sr:ranking (closed, computed locally) |

Lens ids declared (363-08 `LENS_FAMILY` must cover these): ws.gap, ws.covered_elsewhere, ws.extraction; mu.verify, mu.blind_spot, mu.reveal; rc.why_link, rc.6m; hat.white, hat.black, hat.yellow, hat.green; df.first_adopters, df.absorptive_capacity, df.civil_defense_crossing, df.timing; ci.derivation, ci.retest, ci.scurve, ci.prior_attack. The sr dimensions reuse mu.verify, hat.* and ci.* rather than minting an sr.* lens prefix.

Falsifier template ids used (composer template ids from 363-08): ws.synonym_cover, ws.prior_attempts, ce.counter, ce.prior_success, cl.break, ci.retest. The df dimensions borrow ce.counter because diffusion/v1 declares no falsifier role of its own (disclosed default, tune in 363-20).

## What was built

- **question-templates.cjs.** Frozen `TEMPLATES` keyed by id. Each dimension carries `default_lens`, `default_family` (null for local or closed), `falsifier_template`, `falsifier_default` prose, `perspective_step`, a `prompt` (the question the navigator did not ask) and, for closed dimensions, a non-empty `not_researchable_reason`. Per-template `opportunity_rules` and `perspective_map`. `templateForCommand` skips `explicit_only` templates, so `/mos:research` resolves only through `templateForFramework` or an explicit `template_id`. `dimensionsFor(template, {multi_cause})` resolves the conditional 6M dimensions. `validateQuestionSet` is plain validators with named codes.
- **pyramid.cjs.** `buildPyramid` normalizes leaves to the plan.cjs leaf shape (status open or not_run, empty `queries`, corpus openalex or room), assembles `scqa`, `governing_question`, `governing_status: restated`, `key_line` with `leaf_ids`, `tree_type`, `lenses_selected`, and embeds coverage, MECE and D-00 in the plan.cjs pyramid shape. `checkPyramid` reuses `IssueTreeEngine.validateMECE` and `validateFalsifiability` over a bridged tree (a key-line branch with exactly one childless leaf is folded into that leaf so a one-question dimension does not warn "only 1 branch"). The restatement check runs validateMECE's token-overlap rule on the pair [stated question, leaf question] for non-stated leaves and only warns. `applyLogicTreeSteps` keys on the five exact ledger step names.
- **Fixtures.** Seven generic question sets; scientific-roadmapping.json carries a full D-18 perspective (three ordered forum passes, three paths with one from the 10X resurvey, four limiters of which one physics, unlock chains with a self step and an adoption step, one polyvocal tension) and selects the diffusion lens with a reason.

## Verification

- `node tests/test-363-pyramid.cjs`: PASS 21, FAIL 0, exit 0 (Y1-Y15; Y10 and Y13 split into sub-legs).
- `node tests/test-363-plan-schema.cjs`: PASS 27, FAIL 0 (plan.cjs untouched).
- `grep -c "require('../issue-tree.cjs')" lib/core/research-planner/pyramid.cjs` is 1.
- No em-dash or en-dash in any file of this plan (byte-level grep; the test spells them with String.fromCharCode). Zero fetch attempts (net guard).
- `bash tests/run-all-164.sh` exits 1 with exactly one failure, `canon-version assertion`. That is the failure recorded at PLAN_BASE in 363-01-SUMMARY and registered as red-at-baseline in tests/run-all-363.sh; issue-tree.cjs is untouched by this plan, so it is not a regression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PYRAMID_DEPTH_CAP imported from the wrong place**
- **Found during:** Task 2 (Y10b: the depth-cap leg failed)
- **Issue:** plan.cjs exposes the cap only as `BUDGETS.PYRAMID_DEPTH_CAP`, not a top-level export. A destructured `{ PYRAMID_DEPTH_CAP }` was `undefined`, so `depth > undefined` was always false and nothing was ever rejected.
- **Fix:** read `require('./plan.cjs').BUDGETS.PYRAMID_DEPTH_CAP` and throw at load if it is not a positive integer.
- **Commit:** efb188bdd (fixed before commit)

**2. [Scope note] Acceptance line for run-all-164**
- The plan says `bash tests/run-all-164.sh` "still exits 0". It exits 1 at PLAN_BASE for an unrelated canon-version assertion (see Verification). The check that matters, that this plan did not change the result, holds.

**3. [Scope note] Shape choices where the plan left room**
- The question-set contract gained one optional field, `multi_cause` (boolean), because the root-cause template's 6M coverage is conditional on it.
- `coverage.uncovered` is a list of card-ready label strings (plan.cjs prints each with "no sub-question covers this yet"); the ids, prompts and source live in `coverage.uncovered_detail`.
- DRP363-11, DRP363-12 and DRP363-20 are listed in the plan frontmatter but only partly delivered here (opportunity rules and lens coverage exist; run-time evidence rows, the ledger and lens selection land in 363-10, 363-11, 363-12, 363-13). Only DRP363-02 is marked complete.

## Known Stubs

None. `untried_intervention` and `mechanism_transfer` are in OPPORTUNITY_KINDS as vocabulary but have no detection rule in this plan (the plan lists rules only for literature_gap, constraint_attack, trend_break and funding_signal); no code path emits them.

## Threat Flags

None beyond the plan's register. T-363-24 (restated-only plan passes as research) is mitigated by the D-00 structural gate plus the restatement warning; T-363-25 (MECE warnings hidden) by returning every warning in `mece.warnings`; T-363-26 (keyword classifier) by using none. The restatement check produces a warning only.

## Downstream contract notes

- **Build:** `buildPyramid(qs, {template, structure, rung, lensesSelected?, lensTemplates?})` returns `{ok, pyramid, leaves, check, status}` or `{ok:false, errors}` (shape errors are codes). `lensesSelected` defaults to `qs.lens_selection[].lens`; only lens `diffusion` maps to a lens template.
- **Check:** `checkPyramid(pyramid, leaves, {template?, lensTemplates?})` returns `{passes, status ('ready'|'wish'|'incomplete'|'needs_lens_leaves'), d00, coverage, mece, falsifiability, restatement_warnings, missing_lens_dimensions, depth_violations, errors}`. Use `status` as plan.cjs `PLAN_STATUSES`. `passes` is true only for `ready`. MECE, restatement and falsifiability warnings never fail a plan on their own; uncovered dimensions, a missing falsifier, a depth breach and a D-00 failure do.
- **Pyramid shape stored in the plan:** `{template_id, stated_question, scqa, governing_question, governing_status, tree_type, mode_hint, multi_cause, lenses_selected, coverage_notes, key_line [{id,label,dimension,leaf_ids,status?,support_count?}], dropped, coverage {dimensions, uncovered (strings), not_researchable [{dimension, reason, source}]}, mece {warnings (all surfaced), falsifiability, restatement_warnings, passes}, d00 {passes, beyond_stated_leaf_ids}}`. Booleans, not 1/0.
- **Leaf shape:** `{id, parent, question, origin, dimension, lens, source_command, researchable, not_researchable_reason?, falsifier {text, template_id}, slots, corpus, status, queries: [], limiter_id?}`. Compose queries per leaf with `lens`, `slots` and `falsifier.template_id`; `ws:extraction_failure` leaves are `corpus: 'room'`.
- **Logic Trees:** `applyLogicTreeSteps(pyramid, leaves, structure, ctx)` needs `structure.scientific === true` and the step names in `structure.logic_trees_steps` (strings or `{order,name}`), `structure.logic_trees.steps`, or `structure.steps` entries with `framework: 'Logic Trees'`. `ctx = {template, rung, decision_gate?, perspective, supportByLeaf?, drops?: [{id, reason}]}`. Returns `{applied, reason?, tree_type, steps_applied, unmapped_steps, rejected, pruned, refused_prunes, not_actionable, lane_order, check, pyramid, leaves}`. No-op reasons: `not_scientific_structure`, `no_logic_trees_steps`. Tree type: root-cause template -> issue; decision_gate -> decision; rung WellDefined or HDPS in `structure.frameworks` -> hypothesis; else issue. Unlock-chain length ignores `pushed_by: 'self'` steps, matching constraint_attack.
- **Roll-up:** `rollUp(pyramid, leaves, rows, {verdictByLeaf?})` returns `{pyramid, leaves, governing_status, unresolved_branches (labels), contradictions [{leaf_id,row_ids}], weakest_branch}`. Rows use labels supports, contradicts (others do not settle a leaf). `verdictByLeaf` (settled, gap-confirmed, contested, thin, unresolved) overrides the row-derived status, so a whitespace gap-confirmed verdict supports the gap claim with zero rows. `weakestBranch(pyramid)` needs a rolled-up pyramid and returns a key-line entry or null.
- **Opportunities:** `opportunityCandidates(pyramid, leaves, rows, {verdict, perspective, template})` returns `[{kind, leaf_ids, row_ids, reason, limiter_id?, funder?, program?}]`. Rules apply only when the template (or a selected lens template) declares them; funding_signal always applies and needs label funding_signal plus non-empty funder and program.
- **Lens ids** 363-08 must map are listed above; if 363-08 already shipped a narrower `LENS_FAMILY`, add the missing ids there rather than renaming them here.

## Self-Check: PASSED

- lib/core/research-planner/question-templates.cjs, lib/core/research-planner/pyramid.cjs, tests/test-363-pyramid.cjs and the seven fixtures are present.
- Commits f9916a00e and efb188bdd are ancestors of HEAD.
