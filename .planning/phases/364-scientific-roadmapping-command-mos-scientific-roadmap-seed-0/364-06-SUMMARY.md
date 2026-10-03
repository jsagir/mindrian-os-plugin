---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 06
subsystem: research-planner
tags: [filing, f8-basket, research-plan, proposed-claims, rejection-is-data, tdd]
requires:
  - phase: 364-05
    provides: sr-door.cjs state schema (mos.sr-door-state/1), rubricLines, walkedState fixture
provides:
  - "lib/core/research-planner/sr-filing.cjs: PLAN_REL, HISTORY_REL, buildPlanBasket, planBasketCard, renderPlanMd, filePlan"
  - "filing.cjs exports checkAuthority (one added line)"
  - "tests/test-364-filing.cjs: F1-F13 (49 checks)"
affects: [364-08, 364-09]
key-files:
  created:
    - lib/core/research-planner/sr-filing.cjs
    - tests/test-364-filing.cjs
  modified:
    - lib/core/research-planner/filing.cjs
key-decisions:
  - "Discarded-route basket ids are 1-based: discarded_route:<n> maps to state.discarded[n-1]."
  - "An earlier PLAN.md moves to research-plan/history/<its own filed_on>-<its own run_tag>-PLAN.md (read from the old file's frontmatter, validated by regex; fallback today's date and 'earlier'), with a numeric suffix on collision, so history names describe the old plan, not the new one."
  - "renderPlanMd adds one frontmatter key beyond the contract, filed_on, so history naming and the pure render match the filed file byte for byte."
  - "Step status mapping: done -> run; not_run -> not_run (stand_in shown); declined (systems pass) or a rejected/deferred pending stage -> declined."
requirements-completed: [SRM364-15]
metrics:
  tasks: 2
  files: 3
  completed: 2026-10-03
---

# Phase 364 Plan 06: Plan filing through the F.8 basket Summary

The Scientific Roadmapping plan reaches the room only on the navigator's approved F.8 selection: a door-side basket reuses the 363 card and the one authority rule, and writes `research-plan/PLAN.md` (naming its rung and every step run, not_run or declined, labels from Theo only) plus proposed claim nodes and REJECTED_BECAUSE edges through navigation.

PLAN_BASE: `d511f4c04f0145902cc8354645c060e263507ccc`

## Commits

| Task | Phase | Commit | Files |
|------|-------|--------|-------|
| 1 | export (alone) | 1f4f15803 | lib/core/research-planner/filing.cjs (1 line added, 0 removed) |
| 1 | RED | c3e64b7c8 | tests/test-364-filing.cjs |
| 2 | GREEN | 354b17606 | lib/core/research-planner/sr-filing.cjs |

All made with `git commit --only <paths>`; every sha verified as an ancestor of HEAD; no deletions. TDD order holds (test commit precedes feat).

## What was built

- `buildPlanBasket(state)`: `research_plan` always first, one `step_claim:<stage>` per Stage A stage that is done with an output, one `discarded_route:<n>` per discarded entry. Labels at most 160 characters, room text capped at a 60-character excerpt, dash-free.
- `planBasketCard(items)`: `filing.basketCard` with the heading replaced by `## File this research plan?` and the rest unchanged ("Everything lands as proposed. Only you confirm a claim."). `basketCard` flattens its body to one line, so the plan card restores line breaks (heading, intro, item list, promise) so the first line really is the heading.
- `renderPlanMd(state, {date})`: pure. Frontmatter carries methodology, both frameworks, rung, roadmap_type, entry_step, run_tag, plan_ref, theo_framework_status, review_status proposed and seven `steps` entries (stage, theo_step_id, theo_label, status, stand_in). Body has the seven published sections plus the rubric block labelled "plugin-side rubric, not Theo content". Step labels come only from `state.theo.steps` through `state.theo.map`.
- `filePlan(roomDir, state, selection, {date, db})`: `filing.checkAuthority` runs before any directory, file or node is touched. Then: add research_plan if missing (with a note), open the write handle through navigation (closed in finally when owned), `ensureDirIdentity` for research-plan/ROOM.md, move an earlier PLAN.md to history, atomic write, `writeMemoryArtifactNode`, proposed claims with INFORMS edges to the plan node, discarded routes as decision nodes with REJECTED_BECAUSE edges to the plan node. Never throws.

## Verification (measured)

- `node tests/test-364-filing.cjs`: PASS 49 FAIL 0 (F1-F13). RED run before sr-filing.cjs existed exited non-zero.
- `node tests/test-364-sr-door.cjs`: PASS 70 FAIL 0. `node tests/test-363-filing.cjs`: exit 0.
- `git show 1f4f15803 -- filing.cjs`: 1 added line, 0 removed.
- sr-filing.cjs: zero `fetch(` / `brain-client` / `mcp__theo`, zero dash bytes, `checkAuthority` call (line 354) precedes the first `atomicWrite(` (line 398).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] basketCard flattens newlines**
- **Found during:** Task 2 (card first-line check F11).
- **Issue:** `filing.basketCard` runs its body through a `noDash` that also turns newlines into spaces, so its body_md is a single line; "replace the first line" would have replaced the whole card.
- **Fix:** `planBasketCard` rebuilds the line structure around the same words. filing.cjs stays at its single added export line, as the plan requires.
- **Commit:** 354b17606

**2. [Rule 1 - Bug] Write tool converted dash escapes to literal characters**
- **Found during:** Task 2 (source scan in F12).
- **Issue:** a `–—` regex in the new module landed as literal en/em-dash characters.
- **Fix:** the pattern is built with `new RegExp('[\\u2013\\u2014\\u2212]')` (escaped inside a string), so the file carries no dash byte.
- **Commit:** 354b17606

## Deferred Issues (out of scope, pre-existing)

`bash tests/run-all-364.sh` ends PASSED=54 FAILED=1 SKIPPED=6 KNOWN=3. The one failure is "no em-dash or en-dash in phase 364 files", which lists tests/test-364-registry-gates.cjs, test-364-sr-door.cjs, test-364-sr-entry.cjs and test-364-sr-steps.cjs (literal dash characters in regex literals from earlier plans). Neither file of this plan is listed. Not touched here; a follow-up quick should replace those literals with escaped forms.

## Known Stubs

None. `state.settled_excluded` is read when present; the door does not yet record it, so "Settled, not re-argued" renders "Nothing from an earlier run is carried here." until plan 09 wires the ratchet output into the state.

## Threat Flags

None. T-364-23 (authority before writes: F1, F2), T-364-24 (PLAN_REL constant, run_tag and date regex-validated), T-364-25 (history, F10), T-364-26 (proposed only, F6) mitigated as planned; no network, no new endpoints.

## Notes

Plan 09 depends on the published names exactly as built; `discarded_route:<n>` is 1-based. STATE.md and ROADMAP.md were not touched, per the sequential-executor rules.

## Self-Check: PASSED

- sr-filing.cjs, test-364-filing.cjs: found. Commits 1f4f15803, c3e64b7c8, 354b17606: ancestors of HEAD.
