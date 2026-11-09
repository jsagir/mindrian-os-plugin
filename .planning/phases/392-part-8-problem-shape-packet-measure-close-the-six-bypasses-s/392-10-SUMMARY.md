---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 10
subsystem: brain-client
tags: [theo, brain_ask, recommend_chain, directive-envelope, part-8, confidence, pedagogical-rank]

# Dependency graph
requires:
  - phase: 392-05
    provides: wave 3 guard state (every string leaf decided, depth fails closed); the branch base 5f6bb8e26
  - phase: 392-04
    provides: lib/core/brain-shape-packet.cjs validateShapePacket (the opts.shape arm reads it lazily)
  - phase: Theo Phase 48 (plans 48-04, 48-08, Theo commit ac6991af, live sha 3e6946be)
    provides: recommend_chain additive chain_coverage block, evidence, grounding_order, per-step rank
provides:
  - _composeTheoAsk orders options by Theo's pedagogical rank (option_order 'theo_rank'); the command_bearing_first partition is removed
  - documented confidence blend theo_rank_blend, exported as _blendConfidence(rank, degree, top, tied)
  - problem_type_source 'signal' when a structured rung or a validated shape decided the rung; 'heuristic' otherwise; both paths
  - grounding.evidence, grounding.chain_coverage, grounding.coverage_label, grounding.grounding_order kept; the frozen unit under grounding.coverage
  - tests/test-392-compose-envelope.cjs (8 arms, RED then GREEN); test-339 compose and live e2e re-pinned
affects: [392-11, 392-12, 392-13, brain-router, rs-chain-feeder, Larry teaching order (Part 12)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source labels decided locally (opts.rung, validated opts.shape), never read from Theo's echo (T-392-28)"
    - "Theo payload fields copied by name as plain objects; derived label by one rule (T-392-29)"
    - "Decorate-then-sort with the chain index as the final key: stable by construction"

key-files:
  created:
    - tests/test-392-compose-envelope.cjs
    - .planning/phases/392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s/deferred-items.md
  modified:
    - lib/core/brain-client.cjs
    - lib/mcp/brain-router.cjs
    - tests/test-339-theo-ask-compose.cjs
    - tests/test-339-theo-ask-e2e-live.cjs

key-decisions:
  - "Blend: primary clamp(0.9 - 0.1 * (rank - 1), 0.5, 0.9); degree only as a tie-break of up to 0.04 between equal ranks; round2; floor 0.5 for a step with no rank"
  - "Rank source on a step: rank, else step, else none; unranked steps sort last by degree descending; theo_rank keeps the DDD-03 index fallback"
  - "grounding_order read from the brain_ask payload first, the recommend_chain reply second, 'lexical' default"
  - "The frozen coverage unit moves from grounding.chain_coverage to grounding.coverage; grounding.chain_coverage now carries Theo's additive block (no lib reader of the old key)"
  - "opts.shape validated through validateShapePacket, lazily required (hook require graph unchanged); a structured rung wins over the shape"

patterns-established:
  - "has_command on each option replaces the partition so the command information is not lost"

requirements-completed: [392-SC4]

# Metrics
duration: ~25min
completed: 2026-11-09
---

# Phase 392 Plan 10: Composed envelope per D-03, D-04, D-05 Summary

**The envelope now shows Theo's pedagogical order with an honest confidence blend and an honest problem_type_source, and keeps Theo's evidence, chain_coverage and grounding_order instead of dropping them.**

## Performance

- **Duration:** about 25 min (ASSUMED start 2026-11-09T19:48Z from the first read; PROVEN commits 19:57:35Z RED and 20:05:43Z GREEN)
- **Started:** 2026-11-09T19:48Z (approx.)
- **Completed:** 2026-11-09T20:12Z
- **Tasks:** 2 of 2
- **Files modified:** 5 (1 created, 4 modified) plus this SUMMARY and deferred-items.md

## Accomplishments

- D-05: options sorted by Theo's rank; `option_order: 'theo_rank'`; `confidence_source: 'theo_rank_blend'`; the `commandBearing.concat(commandLess)` partition code removed (not disabled); `has_command` boolean on each option.
- D-05 and F2: `problem_type_source: 'signal'` when `opts.rung` is a THEO_RUNG_SET member (rung_source `structured`) or `opts.shape` validates (rung_source `signal`); `'heuristic'` otherwise; same labels on the success path, the inner catch (chain unreachable or empty) and the outer catch.
- D-03 and F4: `grounding.evidence` (whole object, e.g. `linked_frameworks_for_type: 46`), `grounding.chain_coverage` (Theo's additive block) and `grounding.coverage_label` (`full | partial | no_lead_for_type | unknown`) kept; the frozen coverage unit untouched under `grounding.coverage`.
- D-04: `grounding.grounding_order` passed through (`shape_boosted` when Theo declares it, `lexical` default).
- `lib/mcp/brain-router.cjs` keeps reading `options[0].confidence`; with the new order that is the rank-1 option; the comment names the rule; the 0.8 default branch is unchanged.

## Task Commits

1. **Task 1: RED envelope test with the live-shaped fixture** - `40ab3e5c1` (test)
2. **Task 2: compose per D-03, D-04, D-05 and re-pin test-339** - `91f7e44ca` (feat)

**Plan metadata:** see the final docs commit (this SUMMARY and deferred-items.md).

A peer commit `6c03a3db6` (plan 392-06, running in parallel) landed between the two; both of this plan's commits used `git commit --only <exact paths>` and swept none of the peer's files.

## RED proof (Task 1, on beta.81 plus waves 1 to 3, before any production change)

Verify line as written: `node tests/test-392-compose-envelope.cjs; echo "exit $?"` printed `exit 1`; node:test counted `tests 8, pass 0, fail 8`. First failing assertion per arm (node:test stops an arm at its first failure):

| Arm | First failing assertion on beta.81 | actual vs expected |
|---|---|---|
| 1 | `grounding.option_order` | `'command_bearing_first'` vs `'theo_rank'` |
| 2 | `grounding.chain_coverage` deep-equal to the additive block | the frozen unit `{matched: 1, status: 'partial', total: 4}` vs `{steps_returned, steps_requested, rank1_leads_total: 0, ...}` |
| 3 | `grounding.grounding_order` | `undefined` vs `'lexical'` |
| 4 | `grounding.problem_type` with a validated shape `Wicked` | `'IllDefined'` vs `'Wicked'` (shape ignored) |
| 5 | `grounding.problem_type_source` on the catch path with a structured rung | `'heuristic'` vs `'signal'` |
| 6 | option order with a missing rank and a tie | `['Beta High', 'Alpha', ...]` vs `['Alpha', 'Beta High', 'Beta Low', 'No Rank']` |
| 7 | `typeof _test._blendConfidence` | `'undefined'` vs `'function'` |
| 8 | `Object.keys(grounding)` | missing `coverage`, `coverage_label`, `evidence`, `grounding_order` |

Note on the plan's RED expectation: the plan text expected beta.81 to put JTBD first "by confidence after the partition identity". beta.81 never sorted by confidence; on this fixture (the first two steps carry commands) the partition is the identity, so the order assertion itself passed on beta.81 and Arm 1 failed first on `option_order`. The real beta.81 defect on the fixture, recorded by a direct probe before the change: options `[Four Lenses 0.6 rank 1], [Jobs to Be Done (JTBD) 0.9 rank 2], [Red Teaming 0.53 rank 3]`, `problem_type_source 'heuristic'` with `rung_source 'structured'`, `chain_coverage` = the frozen unit, `confidence_source 'theo_degree_normalized'`, `option_order 'command_bearing_first'` (F2, F3, F4 reproduced).

## GREEN counts (Task 2)

| Command | Result |
|---|---|
| `node tests/test-392-compose-envelope.cjs` | 8 passed, 0 failed, exit 0 |
| `node tests/test-339-theo-ask-compose.cjs` | 12 passed, 0 failed |
| `bash tests/run-all-339.sh` | PASS=15 FAIL=1 SKIP=0; the one FAIL is "dist bundle staleness (build-dist-bundles.cjs --check-stale)": bundle generated from 2.0.0-beta.52, live plugin 2.0.0-beta.81; pre-existing, version-based, not a source diff (deferred-items.md). The live e2e arm `test-339-theo-ask-e2e-live.cjs` did NOT skip: the Brain was available on this machine, so the runner's own arm ran live and PASSED with the new pins (live Theo order is rank order). |
| `node tests/test-c8j-chain-consumer.cjs` | 22 passed, 0 failed |
| `node tests/test-364-compose-355.cjs` | PASS 21, FAIL 0 (Z1 zero network attempts) |
| `node tests/test-354-theo-router-contract.cjs` | 36 passed, 0 failed |
| `bash tests/run-all-392.sh` | PASS=13 FAIL=0 SKIP=0 (13 files discovered, including the peer's test-392-theo-route-matrix.cjs) |
| `node tests/test-387-eureka-egress.cjs` | 22 passed, 0 failed |
| `tests/test-389-seed-egress.cjs` | absent on this branch (rebase pending, D-07); not run |
| Census check: `node tests/test-254-composition-census.cjs` | 10 passed, 0 failed (no new reach site; _composeTheoAsk adds no callTool) |
| `node scripts/build-brain-census.cjs --check` (as the plan writes it) | the script has no `--check` mode (header lines 13-15); prints usage, exit 1; recorded in deferred-items.md as plan wording |

## The blend as implemented

`_blendConfidence(rank, degree, top, tied)` in lib/core/brain-client.cjs:

```
primary    = Number.isFinite(rank) ? clamp(0.9 - 0.1 * (rank - 1), 0.5, 0.9) : 0.5
tieBreak   = tied ? 0.04 * (1 - clamp(degree / top, 0, 1)) : 0     (degree not finite or top <= 0 -> full 0.04)
confidence = round2(clamp(primary - tieBreak, 0.5, 0.9))
```

`tied` is true only when two or more steps share one rank. Monotonic non-increasing along theo_rank by construction: one rank step is 0.1, the tie-break at most 0.04. The fourth parameter extends the plan's three-parameter signature so the composer can state the tie without a second pass; the first three parameters are as planned.

Values on the fixture: Four Lenses rank 1 degree 159 -> 0.9; Jobs to Be Done (JTBD) rank 2 degree 631 -> 0.8; Red Teaming rank 3 degree 40 -> 0.7. Tie example (Arm 6): two rank-2 steps with degree 400 and 100 over top 900 -> 0.78 and 0.76; a step with no rank -> 0.5, last.

**Exact option order on the fixture (Arm 1):** `['Four Lenses', 'Jobs to Be Done (JTBD)', 'Red Teaming']`, theo_rank `[1, 2, 3]`, confidence `[0.9, 0.8, 0.7]`, has_command `[true, true, false]`, `directive.guided.framework 'Four Lenses'`.

## coverage_label rule

`_coverageLabel(chain_coverage)`: not a plain object -> `unknown`; `rank1_leads_total` not a finite number -> `unknown`; `rank1_leads_total === 0` -> `no_lead_for_type` (canon records no lead for this type, never a partial chain); `full === true` -> `full`; otherwise `partial`.

## Every test-339 pin changed and why (D-05 only)

tests/test-339-theo-ask-compose.cjs:

| Pin | Was | Now | Why |
|---|---|---|---|
| Arm 1 option order | Design Thinking, Red Teaming, Disruptive Innovation, Creative Destruction | Design Thinking, Disruptive Innovation, Red Teaming, Creative Destruction | partition removed; Theo's order (steps 1 to 4) |
| Arm 1 commands by index | [diagnose, build-mvp], [challenge-assumptions], [], [] | [diagnose, build-mvp], [], [challenge-assumptions], [] | follows the order |
| Arm 1 confidence by framework | 0.9, 0.85, 0.83, 0.76 (0.5 + 0.4 * degree/top) | 0.9, 0.8, 0.7, 0.6 (blend) | D-05 blend |
| Arm 1 non-increasing check | per partition only | global, along theo_rank | monotonic by construction again |
| Arm 1 theo_rank | [1, 3, 2, 4] | [1, 2, 3, 4] | sorted by rank |
| Arm 1 option_order | command_bearing_first | theo_rank | D-05 |
| Arm 1 confidence_source | theo_degree_normalized | theo_rank_blend | D-05 |
| Arm 1 new | - | has_command [true, false, true, false] | information kept |
| DDD-1 order and options[0] | Red Teaming first, theo_rank 3 | Design Thinking first, theo_rank 1, has_command false; has_command [false, false, true, false]; options[2].commands [challenge-assumptions] | rank-1 at options[0]; command info kept |
| DDD-1 option_order | command_bearing_first | theo_rank | D-05 |
| DDD-2 | unchanged | unchanged | both chains already in Theo order |
| DDD-3 fixture | Alpha 300, Beta 200 (Beta first by command) | Alpha 200, Beta 300 (Beta first by degree, both unranked) | unranked steps sort by degree; the arm still proves theo_rank keeps the ORIGINAL index [2, 1]; adds confidence [0.5, 0.5] and has_command [true, false] |
| DDD-4 option_order (catch path) | command_bearing_first | theo_rank; plus confidence_source theo_rank_blend | D-05 on the catch path |

tests/test-339-theo-ask-e2e-live.cjs (live arm, deviation 1 below): the check "when any option carries a command, options[0].commands.length > 0" became "options[0].theo_rank is the lowest theo_rank of the list" plus "confidence is non-increasing along the options"; `option_order === 'command_bearing_first'` became `'theo_rank'`; added `confidence_source === 'theo_rank_blend'`.

## Files Created/Modified

- `tests/test-392-compose-envelope.cjs` - 8 arms over `_composeTheoAsk` through the deps seam (invented fixtures: framework names and enum values only; zero network): rank order and blend, coverage_label variants, heuristic path, shape path, catch paths, ties and missing rank, exported blend, Part 8 canary on unnamed reply keys.
- `lib/core/brain-client.cjs` - `_composeTheoAsk` docblock names D-03, D-04, D-05, the blend with its clamp, the coverage_label rule and the chain_coverage key; new `_blendConfidence`, `_coverageLabel`, `_rungFromShape`, `_plainObject`; the compose body per the rules; `ask()` threads `opts.shape`; `_test` exports `_blendConfidence` and `_coverageLabel`.
- `lib/mcp/brain-router.cjs` - comment at the `options[0].confidence` read (:638) names the new rule; no code change.
- `tests/test-339-theo-ask-compose.cjs` - re-pinned as tabled above.
- `tests/test-339-theo-ask-e2e-live.cjs` - live pins re-pinned as above.

## Decisions Made

- The brain_ask payload is the first source of `grounding_order` (Theo puts it there), the recommend_chain reply the second, `lexical` the default. The plan's fixture wording placed it on the recommend_chain reply; both are read.
- `rank` takes precedence over `step` as the rank source: Theo's `step` is the chain position and `rank` the pedagogical rank; they coincide when Theo orders the chain by rank.
- The frozen coverage unit moves to `grounding.coverage` so `grounding.chain_coverage` can carry the additive block the plan test defines. No lib reader of the old key exists (grep over lib and scripts); `.planning/debug/newborn-room-graph-not-connected-2026-09-30.md:131` mentions the old shape as a debugging note only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale live pins in tests/test-339-theo-ask-e2e-live.cjs**
- **Found during:** Task 2
- **Issue:** the live e2e arm pinned the partition and `option_order === 'command_bearing_first'`; after this change a live run would fail. The file is in the test-339 family the plan re-pins but was not in `files_modified`; plan 392-06 does not touch it.
- **Fix:** re-pinned to the rank order (lowest theo_rank at options[0], non-increasing confidence, `option_order 'theo_rank'`, `confidence_source 'theo_rank_blend'`).
- **Verification:** `bash tests/run-all-339.sh` ran the arm live (Brain available on this machine) and it PASSED.
- **Committed in:** 91f7e44ca

**2. [Rule 3 - Blocking] The plan's census command does not exist**
- **Found during:** Task 2 verify
- **Issue:** `node scripts/build-brain-census.cjs --check` prints usage and exits 1; the script header states it has no `--check` mode.
- **Fix:** ran the census gate that exists, `node tests/test-254-composition-census.cjs` (10 passed). Logged in deferred-items.md for the later plans that cite the same command.

**3. [Plan refinement] `brain-router.cjs:398` does not read `options[0].confidence`**
- **Found during:** Task 2
- **Issue:** only one read exists, at :638 (the :398 anchor in the plan and in the old brain-client comment was stale).
- **Fix:** comment updated at :638 only; no code change needed (the reader is correct under the new order).

---

**Total deviations:** 3 (1 Rule 1, 1 Rule 3, 1 plan anchor)
**Impact on plan:** no scope change; D-03, D-04, D-05 as written.

## Issues Encountered

- `bash tests/run-all-339.sh` FAIL=1 on the dist bundle staleness check, pre-existing (bundle from beta.52 against beta.81). Not fixed here (release-lockstep artifact outside this plan); logged in deferred-items.md.
- The plan-mandated runner `run-all-339.sh` ran its live e2e arm against Theo because the Brain was available on this machine; this plan's own test and fixtures use no network.
- `tests/test-389-seed-egress.cjs` is absent on this branch (rebase pending, D-07); not run.

## Deferred Issues

See `deferred-items.md` in this phase directory (dist staleness; the census command wording).

## Known Stubs

None. `opts.shape` is read by `_composeTheoAsk` and `ask()`; plan 392-12 passes it from the router and the shim.

## Threat Flags

None. No new network endpoint, auth path or file access; the envelope copies methodology fields only (T-392-30 accepted in the plan).

## TDD Gate Compliance

RED commit `40ab3e5c1` (test) precedes GREEN commit `91f7e44ca` (feat). No refactor commit.

## Next Phase Readiness

- Plan 392-12 can pass `shape` through `brainClient.ask(question, {problem_type, shape})`; the composer already emits `signal`/`signal` for a validated shape.
- Plan 392-11 (acceptance script, bare vs shaped) can assert `grounding.problem_type_source`, `grounding.grounding_order`, `grounding.chain_coverage`, `grounding.coverage_label` and the rank order from this envelope.

## Self-Check: PASSED

- Files: tests/test-392-compose-envelope.cjs, lib/core/brain-client.cjs, lib/mcp/brain-router.cjs, tests/test-339-theo-ask-compose.cjs, tests/test-339-theo-ask-e2e-live.cjs all FOUND.
- Commits: 40ab3e5c1 FOUND, 91f7e44ca FOUND.
- `grep -c "commandBearing|command_bearing_first|theo_degree_normalized" lib/core/brain-client.cjs` = 0 (partition code removed).
- No em-dash in the five touched files.
