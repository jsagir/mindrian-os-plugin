---
type: quick
id: 261001-wgd
slug: wish-gate-every-deep-plan
date: 2026-10-01
requirement: DRP363-19
commits:
  red: f7c62ea03
  green: 6c8821fd4
---

# Quick 261001-wgd: the wish gate applies to every deep plan

**One-liner:** `planner.assess` now turns any deep plan with no nameable limiter into a `wish` (reason `no_nameable_limiter`) for every template, not only scientific-roadmapping; quick mode and the scientific-roadmapping branch are unchanged.

## Root cause (confirmed)

`assess` in lib/core/research-planner/planner.cjs acted on perspective errors only when
`plan.origin.template_id === 'scientific-roadmapping'`. Reproduced over founder and researcher rooms with the
checked-in fixtures: a deep `map-unknowns` plan (0 limiters, perspective errors `no_nameable_limiter`,
`forum_role_missing:*`, `paths_too_few`, and `goal_not_quantified` and `no_10x_resurvey` in a researcher room)
came back `status: ready`. The same held for a deep `whitespace-quick` plan.

## Fix

- New `hasNoLimiter(plan, perr)` and one new branch in `assess`: deep, template not scientific-roadmapping,
  status still ready, and either the fresh perspective errors name `no_nameable_limiter`, the stored tension is a
  wish, or the stored perspective holds no limiter. Result: `wish` plus `no_nameable_limiter`.
- The stored-plan checks matter because `revisePlan` and `escalate` call `assess` with no fresh errors; without
  them an escalated limiterless plan, or a plan whose only limiter was dropped, would still read ready.
- Scope decision (from the A5 scope note): only `no_nameable_limiter` gates outside scientific-roadmapping.
  Missing forum roles, `paths_too_few` and an unquantified goal stay advisory.
- The scientific-roadmapping branch is untouched and the new branch excludes that template, so its behavior is
  byte-identical. Quick mode is excluded by `plan.mode === 'deep'`.

## Commits

| Leg | sha | What |
|-----|-----|------|
| RED | f7c62ea03 | `test(quick-wish-gate)`: C15 in tests/test-363-cli.cjs; failed with "founder in-process status is ready, expected wish" |
| GREEN | 6c8821fd4 | `fix(quick-wish-gate)`: planner.cjs gate, C14, and the legs below |

The docs commit (this summary, the PLAN, and 363-FOLLOW-ONS.md A5) follows; its sha is in the hand-back report.

## Tests

- C15 (new): founder and researcher rooms, in-process and through the CLI. Asserts status `wish`, errors include
  `no_nameable_limiter`, `cardFor` answers `revise` / `no_nameable_limiter` and never `deep_run` or `review`, the
  card offers no run or approve option, quick mode on the same set is not a wish, a fetch tripwire preload records
  nothing in the CLI child, and the net guard saw zero attempts.
- C14 (updated): no longer `continue`s past the zero-limiter set. Sets are now `map-unknowns` (asserts wish and an
  empty ranking), `map-unknowns-limiter` (new fixture, drop_path exercised; dropping its only limiter must leave
  the plan a wish), and `scientific-roadmapping`. All 6 engine and set combinations are asserted, and the leg fails
  if fewer than 6 are exercised.
- C1 (updated): needed a ready deep plan, so it plans from `map-unknowns-limiter`.
- Acceptance whitespace W4, W5, W5b and part8-sweep D2 (updated, reason below). W4b (new) asserts a limiterless
  deep whitespace plan is a wish.

### Why the whitespace legs changed

The 363-20 acceptance legs assumed a deep plan on the limiterless lite whitespace set is ready. Under the ruling
it is a wish, so the legs now name a limiter (`{ limiter: true }`: two limiters on L1 and L2, the two searchable
leaves; L3 is a room-corpus leaf and is never fetched). Naming a limiter in a researcher room makes `isSR` true
(engine scientific-roadmapping and limiters > 0), so the deep run plans per-limiter lanes and drops the whitespace
plurality and counterevidence lanes that W5 and W5b prove. Those three legs (W5, W5b, D2) therefore run in a
founder room, where the lens lanes are kept. W4 (only the review card) stays in a researcher room.

### Counts

Per-file, every tests/test-363-*.cjs except live-smoke, all exit 0: acceptance-diffusion 8, acceptance-whitespace 16
(was 15, +W4b), ambient 19, audit-ledger 6, baseline 8, cache 13, cli 21 (was 20, +C15), command-contract 9,
corpus-honesty 19, evidence-rows 32, families 12, filing 52, grants 14, mcp-tool 16, part8-sweep 21, perspective 17,
plan-schema 28, pyramid 22, run-deep 18, run-quick 19, runner-contract 10, structure 15. Total 395 PASS, 0 FAIL.
`bash tests/run-all-363.sh` final line: `PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10` (exit 0). The one skip is the opt-in live
smoke; the 10 KNOWN are the pre-existing reds outside 363 matched by signature.

## Deviations from Plan

None in approach. Two calls worth naming: the stored-plan limiter checks in `hasNoLimiter` go beyond the fresh
errors the ruling literally covers (needed for revise and escalate), and the deep whitespace legs moved to a
founder room (above).

## Flags for the navigator

1. The whitespace "run deep on this?" offer after a thin quick run now leads to a wish card unless the question
   set names a limiter. `/mos:whitespace research` writes limiterless sets, so escalation from it dead-ends at
   `no_nameable_limiter` until that command names a limiter or the offer is reworded. Not changed here.
2. In a researcher room, naming a limiter switches a whitespace deep run to per-limiter lanes (363-20 isSR fix), which
   drops the whitespace plurality and counterevidence lanes. A researcher-room whitespace deep run is therefore
   either a wish or a limiter-lane run, never the lens-lane run W5 and W5b prove. The ruling and the isSR fix pull in
   different directions there.
3. Residual, deliberately left: a scientific-roadmapping plan that loses all its limiters through `revise` is not
   re-gated, because that template's behavior was required to stay byte-identical.

## Files

- lib/core/research-planner/planner.cjs
- tests/test-363-cli.cjs, tests/test-363-acceptance-whitespace.cjs, tests/test-363-part8-sweep.cjs
- tests/fixtures/363-question-sets/map-unknowns-limiter.json (new)
- .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-FOLLOW-ONS.md (A5 resolved)
