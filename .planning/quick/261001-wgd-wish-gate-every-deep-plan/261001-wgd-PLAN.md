---
type: quick
id: 261001-wgd
slug: wish-gate-every-deep-plan
date: 2026-10-01
source: 363-FOLLOW-ONS.md A5 (navigator ruling 2026-10-01, "Apply it to every deep plan")
requirement: DRP363-19
---

# Quick: the wish gate applies to every deep plan

## Goal

Any deep plan with no nameable limiter is a wish and does not run, whatever its template_id.
Quick mode is unaffected. The scientific-roadmapping behavior stays byte-identical.

## Root cause (verify first)

`assess` in lib/core/research-planner/planner.cjs acts on perspective errors only when
`plan.origin.template_id === 'scientific-roadmapping'`. A deep `map-unknowns` plan (0 limiters) therefore came back
`status: ready` although the perspective reported `no_nameable_limiter`.

## Tasks

1. RED: add leg C15 to tests/test-363-cli.cjs. A deep plan from the zero-limiter `map-unknowns` set, in a founder
   and a researcher room, must be `wish` with `no_nameable_limiter`, `cardFor` must not offer `deep_run` or
   `review`, quick mode must not become a wish, and no fetch may happen. Commit `test(quick-wish-gate): ...`.
2. GREEN: add the gate to `assess` for deep, non scientific-roadmapping plans. Update C14 so the zero-limiter
   combination asserts the wish and every combination is exercised. Fix any leg that assumed a limiterless deep
   plan is ready, with a stated reason.
3. Regression: every tests/test-363-*.cjs except live-smoke, then `bash tests/run-all-363.sh`.
4. Docs: mark 363-FOLLOW-ONS.md A5 resolved with the shas, as a separate commit.

## Constraints

`git commit --only -- <paths>`, `git add -f` for .planning paths, no gsd-tools state writers, no network in tests,
no em-dashes or en-dashes.
