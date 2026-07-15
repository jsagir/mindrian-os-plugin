---
phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono
plan: 01
subsystem: bono
tags: [de-bono-hats, governance, persona-research, part8-egress, findings-wirer, source-lens, cjs]

# Dependency graph
requires:
  - phase: 164
    provides: runCellFanout / runDebate / debate-composition injectable seams (deriveFn, onStep, selfCritiqueFn)
  - phase: 131
    provides: findings-wirer.wireAccept (proposed EvidenceClaim + INFORMS through the navigation chokepoint)
  - phase: 196
    provides: part8-egress-guard.classify (fail-closed LOCAL egress judge)
  - phase: 224
    provides: runDerivation CR-01 (throws on a Promise-returning deriveFn) + buildFixtureRoom224 base fixture
provides:
  - lib/core/bono/hat-governance.cjs (HAT_GOVERNANCE, CROSS_CUTTING_RULES, governanceForHat, enforceGovernance, assertHeterogeneity, composeGovernedSeams)
  - lib/core/bono/persona-research.cjs (personaDispatchCell, validateCitations)
  - tests/helpers/fixture-room-223.cjs (buildFixtureRoom223 = 224 base + jtbd-state.json + MINTO.md + opportunity-bank/)
  - tests/test-223-hat-governance.cjs, tests/test-223-part8-egress.cjs
affects: [223-03 bono surface, 223-04 intel-pipeline, hat-governance wiring, persona-research citation boundary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "governance-as-frozen-data + thin mechanical enforcement (no runtime), riding runDebate's existing injectable seams"
    - "per-persona wired INFORMS set as the citation boundary (a persona may not assert beyond its own wired sources)"
    - "Brain-bound payloads gated by part8-egress-guard.classify BEFORE dispatch, generic handle only, fail-closed disclosed"

key-files:
  created:
    - lib/core/bono/hat-governance.cjs
    - lib/core/bono/persona-research.cjs
    - tests/helpers/fixture-room-223.cjs
    - tests/test-223-hat-governance.cjs
    - tests/test-223-part8-egress.cjs
  modified: []

key-decisions:
  - "HAT_GOVERNANCE encodes each hat as {discipline, rules[], evidence_policy, discipline_source}; drafted from SPEC Req 1 + BUILD-BRIEF Section 5, zero external design-source reference"
  - "enforceGovernance enforces ONLY the hat's own discipline so the SAME argument object passes/fails differently per hat (the differentiation proof)"
  - "composeGovernedSeams.deriveFn coerces any thenable to [] so no Promise reaches runDerivation (CR-01)"
  - "the Brain leg is optional and injected (ctx.brainFn); every Brain-bound payload passes classify first, generic handle only"

patterns-established:
  - "Phase 210 scope caution stated verbatim-in-intent in the module header: governance is debate-only, never live-conversation enforcement"
  - "SEED-059 disclosed thin-world: an empty wired set is a structural degraded marker, never silent"

requirements-completed: ["Req 1"]

# Metrics
duration: 38min
completed: 2026-07-15
---

# Phase 223 Plan 01: Governed hats + per-persona world-of-knowledge Summary

**Two net-new bono governance modules ride runDebate's existing seams: a frozen 6-hat scrutiny map with per-hat mechanical enforcement (Black ACH disconfirming-first, White cite-or-retract, Red no-justification, Blue anti-convergence) plus the heterogeneity mandate, and a per-(subdomain x hat) research pipe whose wired INFORMS set is the persona's citation boundary, with every Brain-bound payload fail-closed through part8-egress-guard.classify.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-07-15T20:00Z (approx)
- **Completed:** 2026-07-15
- **Tasks:** 3
- **Files created:** 5 (zero shipped files modified)

## Accomplishments
- `hat-governance.cjs`: frozen `HAT_GOVERNANCE` (6 hats) + `CROSS_CUTTING_RULES` (5 rules) as DATA, plus `enforceGovernance` / `assertHeterogeneity` / `composeGovernedSeams` as thin mechanical validators. A governed runDebate run behaves measurably differently per hat, proven by injected-seam legs.
- `persona-research.cjs`: `personaDispatchCell` (the runCellFanout dispatchCell seam) runs extractContext -> runSourceLens -> wireAccept per cell; `wired_sources` is exactly the wireAccept node_ids; `validateCitations` mechanically rejects any assertion outside that set.
- `buildFixtureRoom223`: wraps `buildFixtureRoom224` (Part 7 reuse) and adds `.mindrian/jtbd-state.json` + `MINTO.md` + `opportunity-bank/` for Plans 03/04.
- Part 8 proven at the module boundary: a seeded LOCAL-content breach built from real fixture bytes is never allowed; only the generic handle ever crosses toward the Brain; a block verdict fires zero Brain calls.

## Task Commits

Each task was committed atomically (TDD: failing legs first, then implementation):

1. **Failing legs (Tasks 1+2 shared file)** - `a456894c` (test)
2. **Task 1: hat-governance map + seams** - `60118d81` (feat)
3. **Task 2: persona-research dispatchCell + fixture** - `b8d2cd8c` (feat)
4. **Task 3: Part 8 egress proof** - `135b82bc` (test)

_Note: Tasks 1 and 2 share `tests/test-223-hat-governance.cjs` per 223-VALIDATION (Req 1 has ONE test file); the persona-research section is a labeled block in that file._

## Files Created/Modified
- `lib/core/bono/hat-governance.cjs` - governance map (data) + enforcement selectors + composeGovernedSeams
- `lib/core/bono/persona-research.cjs` - per-cell research pipe + citation-boundary check
- `tests/helpers/fixture-room-223.cjs` - shared phase fixture (wraps 224 base)
- `tests/test-223-hat-governance.cjs` - 6 governance behaviors + 4 persona behaviors (10 checks)
- `tests/test-223-part8-egress.cjs` - Part 8 unit legs + static sweep (4 checks)

## Decisions Made

### The governance-map encoding (CONTEXT discretion item)

`HAT_GOVERNANCE` is a frozen object keyed `white/black/yellow/green/red/blue`; each entry is `{discipline, rules[], evidence_policy, discipline_source}`. The prose is drafted from SPEC Requirement 1 + BUILD-BRIEF Section 5 (Requirement 6 fallback), with no reference to any external design source, not even in comments. `evidence_policy` is a scalar tag (`cite_or_retract`, `disconfirming_first`, `evidence_backed_value`, `provocation_marked`, `no_justification`, `anti_convergence`) that names how each hat weights evidence. `CROSS_CUTTING_RULES` is a frozen list of `{id, rule}` with the five ids: `heterogeneity_mandate`, `anti_premature_convergence`, `key_assumptions_check_first`, `disconfirming_over_confirming`, `strongest_model_judge`.

`enforceGovernance(hat, argument)` operates over `{stance, evidence:[{source, tier, disposition}], confidence, justification?, provocations?, dissent_recorded?}` and enforces ONLY the named hat's discipline: black requires at least one disconfirming item AND the first cited item to be disconfirming; white requires source+tier on every item; yellow requires non-empty evidence; green requires a provocation marker; red rejects justification prose; blue requires a recorded-dissent flag. Violations are short scalar reason strings, never content bytes. An unknown hat returns `{ok:true}` (nothing to enforce) so the map differentiates without ever throwing.

### The exact seam shapes composeGovernedSeams returns

`composeGovernedSeams(opts)` returns `{deriveFn, selfCritiqueFn, onStep}` shaped exactly to runDebate's injectable options:

- **`deriveFn({roomDir, artifactPair, llm}) -> Array`** - SYNCHRONOUS. Wraps `opts.deriveCandidateFn` (Plan 03's stance-aware producer) or a default per-hat `CONVERGES` producer. If a producer returns a thenable, the wrapper coerces to `[]` so no Promise ever reaches the synchronous `runDerivation` composer (CR-01). Verified: `typeof deriveFn(...).then === 'undefined'`.
- **`selfCritiqueFn(step, result) -> {passed, quality, violations?}`** - resolves the step's hat (from `step.hat` or a `bono-argument-<hat>` command), extracts the governed argument from `result.chain_output.argument`, routes it through `enforceGovernance`, and returns `{passed:false, quality:'low', violations}` on any violation. A step with no resolvable hat/argument passes through at the incoming quality.
- **`onStep(step, previousOutput) -> {chain_output, quality}`** - wraps `opts.onStepFn`, tracks material-step order, and flags the debate (`governance_flag: 'kac_not_first'`, quality downgraded to `'low'`) when the FIRST material step is not the Key-Assumptions-Check surface.

## Deviations from Plan

None - plan executed exactly as written. The Part 7 hard rule held: `cell-fanout.cjs`, `debate-composition.cjs`, and `graph-derivation.cjs` were not modified. All five files are added-only.

## Issues Encountered

**`tests/run-all-164.sh` is 17/3, not the plan's expected 20/20 - pre-existing baseline, not a 223-01 regression.** The three failures (`test-issue-tree-edge-remap.cjs`, `test-bono-verdict.cjs`, `canon-version assertion`) import ZERO 223 files and are driven by Phase 224 schema drift (`table edges has no column named review_status`) landing after Phase 164's tests were written. Confirmed by `git diff --name-status`: Plan 223-01 is added-only, so it cannot have caused a failure in shipped test paths it never touches. Logged to `deferred-items.md`; not fixed here (out of scope - Phase 224 migration wiring in shipped test helpers). The plan's own two legs are green: `test-223-hat-governance.cjs` (10 checks) and `test-223-part8-egress.cjs` (4 checks), both exit 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `hat-governance.cjs` seams are ready for Plan 03 (bono surface) to wire into the 8-phase governed flow via runDebate; `opts.deriveCandidateFn` accepts a stance-aware producer.
- `persona-research.cjs` `personaDispatchCell` is ready as runCellFanout's dispatchCell; `validateCitations` is exported for the debate's selfCritiqueFn wiring.
- `buildFixtureRoom223` is available for Plans 03/04.
- The `web_scope: null -> green` change on bono (Plan 03) is de-risked: persona research is confirmed SIGNAL -> LOCAL, and every Brain-bound payload is classify-gated.

---
*Phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono*
*Completed: 2026-07-15*
