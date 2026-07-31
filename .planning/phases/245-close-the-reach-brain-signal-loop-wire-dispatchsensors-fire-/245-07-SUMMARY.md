---
phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-
plan: 07
subsystem: workflow
tags: [reach-hedge-ranker, sens-priority, tie-break, signal-fusion, fusion-ceiling, canon-part-3, canon-part-7, requirement-1, requirement-4, mutation-proven, frozen-gate]

# Dependency graph
requires:
  - phase: 222
    provides: "rankFiredCandidates, the ONE shared scored-selection layer, its roomState injection seams and its three non-negotiable invariants"
  - phase: 245-01
    provides: "SENS_PRIORITY + sensorPriorityRank (the doctrine table and its worst-finite-rank contract), and evidence.sensor_id stamped centrally by dispatchSensors"
  - phase: 245-04
    provides: "verbReachAffinity(verb), the zero-I/O verb-to-reach lookup whose null returns and 2-entry split this fusion honors"
  - phase: 245-05
    provides: "trace.brain_pattern_verb, the ungated CANONICAL_VERBS observation that is this fusion's third input"
provides:
  - "A three-level comparator in rankFiredCandidates: combined desc, then SENS_PRIORITY rank asc, then the retained index fallback"
  - "buildSignalNudges({baseScores, sensorReaches, brainVerb, tierMode}) -> a reach_id-keyed fused absolute score map, exported and pure"
  - "FUSION_CEILING (0.69), the navigator-resolved Open Question A3 bound made structural"
  - "DEFAULT_FUSION_BASE, SENSOR_TOP_FRACTION, SENSOR_OTHER_FRACTION, BRAIN_VERB_FRACTION, NUDGE_FRACTION_CAP"
  - "MINDRIAN_SENSOR_TOP_FRACTION and MINDRIAN_BRAIN_VERB_FRACTION, documented in docs/ENV-TUNING.md"
  - "tests/test-245-tiebreak-deterministic.cjs: 7 checks, all 6 permutations under both weight skews"
  - "tests/test-245-nudge-bound.cjs: a 126-combination bound sweep proven end to end through the real buildReachList, mutation-proven twice"
affects: [245-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A bound expressed as an INTERPOLATION toward a ceiling rather than an addition plus a clamp: base + fraction * (CEILING - base) with fraction < 1 is strictly below CEILING for every base, so the bound is a property of the formula rather than a guard that can be forgotten"
    - "The math lives in the shared selection layer, the merge lives at the render callsite: one selection brain (Canon Part 7) without pretending the ranker is upstream of a sibling consumer"
    - "A tunable read at CALL time rather than module-load time, so its own safety test can actually exercise the fallback"
    - "A test that reads every threshold off the shipped modules (RECOMMEND_FLOOR from the orchestrator, the fractions from the ranker) so a future constant change reddens it instead of silently invalidating it"

key-files:
  created:
    - tests/test-245-tiebreak-deterministic.cjs
    - tests/test-245-nudge-bound.cjs
  modified:
    - lib/workflow/reach-hedge-ranker.cjs
    - docs/ENV-TUNING.md
    - tests/run-all-222.sh

key-decisions:
  - "buildSignalNudges is a SEPARATE export, not a change to rankFiredCandidates' combined computation: F-1 proved the two are sibling consumers, so a fusion folded into the ranker would pass every test and move the dial by nothing"
  - "A same-reach_id collision contributes its sensor fraction ONCE, at the top rate, never once per co-firing sensor: stacking would inflate a reach by how many sensors happen to be registered against it, which is Requirement 4's accident in different clothes"
  - "SENSOR_OTHER_FRACTION is deliberately NOT env-overridable; a third knob whose only job is to sit between the other two invites an inverted configuration with no legitimate use"
  - "DEFAULT_FUSION_BASE is 0.5, the same flat floor d4For already uses, because nudging from the orchestrator's absent-reach 0 could never out-rank cross_room's 0.5 registry default and the dial would never reorder"
  - "The env tunables are read at call time through fractionFromEnv, mirroring updateN / updateEta rather than the module-load AFFINITY_MARGIN shape"

patterns-established:
  - "Mutation proof recorded with the OBSERVED failing assertion text and exit code, including a second variant that neutralizes the cheap precondition arm so the deep arms are proven sensitive in their own right"
  - "A 'no assertion needed updating' finding is defended by naming every grep hit and stating why each is about a different thing, rather than by silence"

requirements-completed: [REQ-1, REQ-4]

# Metrics
duration: 25min
completed: 2026-07-31
---

# Phase 245 Plan 07: The Tie-Break and the Bounded Fusion Summary

**A same-reach collision now resolves by doctrine instead of by whoever edited the sensor registry last, and the Requirement 1 fusion math ships as an exported pure function whose output is strictly below the frozen 0.70 RECOMMENDED floor by the shape of the formula, not by a comment.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-31T14:00Z
- **Completed:** 2026-07-31T14:25Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (2 created, 3 modified)

## Task Commits

1. **Task 1: SENS_PRIORITY tie-break replaces registration order** - `56473f7d` (feat)
2. **Task 2: export buildSignalNudges, the bounded three-input fusion** - `1560377b` (feat)
3. **Task 3: pin the below-0.70 bound as a swept invariant** - `6e2068e3` (test)

## Task 1: the tie-break, and the live turn that proves it bites

The comparator went from two levels to three:

```
primary   b.combined - a.combined          (unchanged)
secondary a.priorityRank - b.priorityRank  (NEW: lower SENS_PRIORITY rank wins)
tertiary  a.index - b.index                (RETAINED, not deleted)
```

`priorityRank` is `sensorPriorityRank(reach.evidence.sensor_id)`, read off the
central stamp 245-01 put in `dispatchSensors`. A sensor cannot write its own
priority key (T-245-30), and an absent or non-string stamp becomes `null`, which
`sensorPriorityRank` answers with the worst FINITE rank rather than `NaN`.

**This is not a hypothetical.** A real turn, run through the shipped dispatch
path with no fixtures:

```
turn text: "the data pipeline is the bottleneck"
dispatch order: SENS-02, SENS-10
ranked  order: SENS-10, SENS-02
```

Both fire `context_block`, so every reach_id-keyed scoring term is identical and
the comparator used to fall through to registry order. SENS-02
(lagging-component) sits earlier in `SENSOR_REGISTRY`; SENS-10 (circularity) sits
higher in `SENS_PRIORITY` (rank 2 against rank 5, both Group A, decided by
evidence durability). The winner flips. What flips with it is the winning reach's
`dispatch` and `signal` payload, not `fire_skill`: both reaches carry the same
`reach_id`, so `reachIdToSkillFamily` returns `'Run Methodology'` either way.

### Tests asserting a registration-order outcome: the honest finding

The plan asked for every test found by
`grep -rln "SENSOR_REGISTRY order\|canonical order\|CANONICAL-ORDER" tests/` to
be updated to a `SENS_PRIORITY` expectation, and for each to be named with its
old and new expected winner.

**Zero needed updating, and none was weakened.** Eight files match the grep; each
was read and run. Every one still exits 0 unchanged, because none of them
actually asserts a ranker TIE-BREAK outcome:

| Test | What its match actually asserts | Reached by the tie branch? |
|---|---|---|
| `test-213-reach-wired.cjs:187` | The top reach of a raw `dispatchSensors` array on a co-fire turn is `context_block`. `dispatchSensors` never calls `rankFiredCandidates` (an acceptance criterion of this plan, re-verified: `grep -rn "rankFiredCandidates" lib/core/insight-sensors.cjs` returns nothing). This is an assertion about DISPATCH order, which Requirement 4 does not touch. | No |
| `test-222-reach-wired.cjs:198` | `reach_candidates` returns combined-SCORE order (`deep_research` ahead of `context_block`). Two DIFFERENT reach_ids with different `combined` values, so the primary comparator decides and the tie branch is never consulted. | No |
| `test-222-readonly-rank.cjs:613` | The same claim on the read-only pull path. | No |
| `test-150.10-systems-thinking-repertoire.cjs:122` | `REACH_IDS` equals the frozen-6 bank in canonical order. About the reach bank, not sensors. | No |
| `test-sensor-spine-dispatch.cjs:48,58,112` | `REACH_IDS` / `POSTURE_IDS` bank order and that dispatch runs sensors in registry order. About dispatch, not ranking. | No |
| `test-decoy-tier.cjs:162` | `PERTURBATION_AXES` has 5 entries in canonical order. Unrelated subsystem. | No |
| `test-auto-explore-canonical-order.cjs` | Composer result ordering. Unrelated subsystem. | No |
| `test-114-substrate-preload.sh:32` | Agent frontmatter `skills:` list order. Unrelated subsystem. | No |

The reason no shipped test asserted the behavior Requirement 4 replaces is worth
stating plainly, because it is the same finding 245-01 recorded from the other
side: the tie-break was never a DECIDED behavior anyone pinned. It was the
residue of a comparator running out of terms. That is exactly why it was worth
replacing, and it is also why replacing it broke nothing.

Per the plan's instruction, no assertion was weakened, and nothing was adjusted
to match the code.

### What `lib/mcp/tools/sensors.cjs:142` passes (recorded as asked)

It passes `fired`, which is `dispatchSensors(turn, tuple, ctx)` filtered only for
array-ness (`sensors.cjs:109-110`). That is the stamped path: `dispatchSensors`
applies `stampSensorId` centrally to every reach it emits, so **yes, the reaches
at this call site carry `evidence.sensor_id`** and inherit the new tie-break
automatically with no edit to that file. Verified by execution, not by reading:
the live dispatch above returns `sensor_id` on both reaches, and that turn is
routed through this exact function by the `suggest_next` / `reach_candidates`
pull tools.

The second call site, `lib/core/navigation-engine.cjs:1066`, likewise passes the
`dispatchSensors` output straight through.

## Task 2: the fusion, and why it is a separate export

The plan's own words for the anti-pattern were the operating instruction: folding
the nudge into `rankFiredCandidates`'s local `combined` would reorder the fired
list, pass every new unit test, and move the dial by exactly nothing, because F-1
established that `rankFiredCandidates` and `buildReachList` are SIBLING consumers
of the same `buildReachScoresFromCortex` output. So the math is here, in the one
shared selection layer, as an independent export with an independent consumer
(245-08), and `rankFiredCandidates`'s return contract is untouched.

### The six constants, as shipped

| Constant | Value | Env override | Role |
|---|---|---|---|
| `FUSION_CEILING` | **0.69** | none (a Canon Part 3 change, not a tuning knob) | The asymptote every fused score approaches and never reaches. Strictly below the frozen `RECOMMEND_FLOOR` 0.70. Exported. |
| `DEFAULT_FUSION_BASE` | **0.5** | none | The base for a reach_id absent from the supplied map. Same flat floor `d4For` already uses. |
| `SENSOR_TOP_FRACTION` | **0.60** | `MINDRIAN_SENSOR_TOP_FRACTION` | Headroom share for the TOP fired reach (index 0, so Task 1's tie-break feeds it directly). |
| `SENSOR_OTHER_FRACTION` | **0.25** | none (deliberate) | Headroom share for every OTHER DISTINCT fired reach. |
| `BRAIN_VERB_FRACTION` | **0.35** | `MINDRIAN_BRAIN_VERB_FRACTION` | Headroom share for the reach_ids `verbReachAffinity` names, times that entry's weight. |
| `NUDGE_FRACTION_CAP` | **0.95** | none | Cap on the summed fraction for any one reach. Strictly below 1, which is what makes the bound structural. |

### Why 0.69 is a bound and not a clamp

`fused = base + fraction * (FUSION_CEILING - base)`.

Because `fraction <= 0.95 < 1`, the result is strictly below `FUSION_CEILING` for
every finite base below it, and `FUSION_CEILING < RECOMMEND_FLOOR`. A clamp of
the form `Math.min(0.69, base + fraction)` would also stay under the floor, but a
large enough input would land exactly ON 0.69 and several reaches would TIE
there, destroying the ordering the fusion exists to create. The interpolation
form is also strictly monotone in both arguments, so two reaches with different
bases or different fractions can never collide at one fused value. Both
properties are swept in Task 3, not asserted in prose.

A reach whose base is already at or above the ceiling is passed through
UNCHANGED, so the fusion can neither create a RECOMMENDED marker nor inflate an
existing one.

### The two integration traps, handled explicitly

Both were flagged by the dependency plans and both are live in this code:

1. **`verbReachAffinity` returns `null` for 5 of the 10 canonical verbs.** The
   implementation treats a `null` return as "contribute NO verb term", never as
   "contribute zero to every reach": the affinity block is skipped entirely and
   no key is created. Asserted directly (`'Defer'` in `mode_a` with no sensors
   yields `{}`).
2. **`'Run Methodology'` returns a TWO-entry split.** The Brain term iterates
   `Object.keys(affinity)` and multiplies `BRAIN_VERB_FRACTION` by each entry's
   weight, so the most common verb in the vocabulary splits its 0.35 into two
   0.175 shares across `context_block` and `brain_consult` instead of dropping
   half its weight. Verified live: `{context_block: 0.53325, brain_consult: 0.53325}`.

The third trap, from 245-05: `brain_pattern_verb` is routed through
`verbReachAffinity` to obtain reach_ids and is **never compared against
`fire_skill`**. On the sensor-fired path `fire_skill` is a skill-family slug
while `brain_pattern_verb` is always a canonical verb, so an equality test
between them is meaningless. The reason is written into the function header so a
future reader does not reintroduce it.

### Verified fusion values

| Input | Output |
|---|---|
| top fired reach, base absent | `0.614` (`0.5 + 0.60 * 0.19`), which strictly exceeds `cross_room`'s 0.5 registry default, so a reorder is achievable |
| base `0.72` | `0.72`, unchanged |
| `mode_b` + a non-null verb + no fired sensors | `{}` |
| `mode_a` + `'Run Methodology'` + no sensors | `{context_block: 0.53325, brain_consult: 0.53325}` |
| `mode_a` + `'Defer'` (no preimage) | `{}` |
| off-enum `reach_id` on a fired reach | `{}` |
| maximum stack, base 0 | `0.6555` (`0.95 * 0.69`) |

## Task 3: the bound as a swept, mutation-proven invariant

`tests/test-245-nudge-bound.cjs`, 6 checks, **126 swept combinations** (21 bases
from 0.00 to 1.00 by 0.05, crossed with 6 achievable fraction cases: sensor-top
alone, sensor-other alone, brain-verb alone, top+brain, other+brain, and the
`NUDGE_FRACTION_CAP` maximum forced by setting both env tunables to 1).

Every threshold is read off the shipped modules. `RECOMMEND_FLOOR` is imported
from `lib/hmi/dial-reach-orchestrator.cjs` rather than hardcoded, so a future gate
change reddens this test instead of silently invalidating it.

The end-to-end arm is the one that matters. It builds a realistic score map
through the real `cortex-reach-adapter.buildReachScoresFromCortex`, applies the
fusion, merges, calls the REAL `buildReachList({tierMode: 'mode_a', reachScores})`,
and asserts the set of `recommended === true` reaches is IDENTICAL with and
without the fusion. It runs on TWO fixtures, because an identical EMPTY set
proves very little: the second fixture adds an already-RECOMMENDED-class prior
(`contradiction: 0.82`, `brain_consult: 0.74`) so the claim is asserted on a
non-empty marker set too. And it asserts the render ORDER genuinely CHANGES on
the first fixture, so the arm cannot pass with a fusion that returns `{}`.

### Mutation proofs (observed exit codes and failure text, not assumed)

Four mutations across the two test files. Each was applied, observed to redden,
then reverted with `git diff --stat` confirmed empty afterwards.

| # | Mutation | Test | Observed failure | Exit code |
|---|---|---|---|---|
| 1 | Delete the `priorityRank` line from the comparator (Task 1's whole substance) | `test-245-tiebreak-deterministic.cjs` | `AssertionError` on the permutation arm | **1** |
| 2 | `FUSION_CEILING = 0.95` | `test-245-nudge-bound.cjs` | `A3 BREACH: FUSION_CEILING (0.95) must be strictly below RECOMMEND_FLOOR (0.7)` (arm 0) | **1** |
| 2b | `FUSION_CEILING = 0.95` WITH arm 0 neutralized, so the deep arms are proven sensitive in their own right rather than hiding behind a cheap precondition | `test-245-nudge-bound.cjs` | `FLOOR CROSSING: case "sensor-top alone" at base 0.35000000000000003 fused to 0.71, which is at or above the frozen RECOMMEND_FLOOR 0.7` (arm 1) | **1** |
| 3 | Replace the ceiling passthrough and the interpolation with unconditional additive stacking, `Math.min(1, base + fraction)` | `test-245-nudge-bound.cjs` | `FLOOR CROSSING: case "sensor-top alone" at base 0.1 fused to 0.7` (arm 1) | **1** |
| - | (control) unmutated | both | all checks pass | **0** |

Mutation 2b was added beyond the plan's ask. Mutation 2 alone would have proven
only that the precondition arm reads two constants; 2b proves the 126-combination
sweep itself catches the crossing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `tests/run-all-222.sh`'s Part 9 ranker sweep was flaky, and this plan's verification block depends on it**

- **Found during:** Task 1 baseline capture, before any edit.
- **Issue:** `bash tests/run-all-222.sh` exited 1 at HEAD with
  `MISSING navigation.cjs chokepoint require in: lib/workflow/reach-hedge-ranker.cjs`,
  even though line 31 of that file is exactly that require. Re-running the same
  command on the same byte-identical tree gave three consecutive PASSes, then
  another FAIL. Root cause, not a guess: `strip_comments "$RANKER" | grep -q ...`
  under `set -o pipefail`. `grep -q` exits as soon as it matches without draining
  its input, which SIGPIPEs the upstream `strip_comments` and makes the pipeline
  report 141 even though the pattern WAS found. The file's own block (b2) already
  documents this race verbatim, calling it "a real, reproducible race observed on
  the pre-existing ranker sweep above", and fixes only its own leg.
- **Why in scope rather than deferred:** this plan's verification block requires
  `bash tests/run-all-222.sh` to exit 0. A non-deterministic gate makes my own
  verification unfalsifiable in both directions, which is a blocking issue for
  the task rather than an unrelated pre-existing failure I merely noticed.
- **Fix:** applied the identical here-string fix block (b2) already carries, to
  the leg that comment was written about. Capture `strip_comments` output to
  `RANKER_STRIPPED` first, then grep via `<<<`.
- **Proof it is not now a no-op gate:** the navigation require was temporarily
  rewritten to a concatenated string so the literal pattern no longer matched;
  the sweep printed `MISSING navigation.cjs chokepoint require` and FAILED,
  exactly as it should. Restored, then 5 consecutive `run-all-222.sh` runs at
  exit 0.
- **Files modified:** `tests/run-all-222.sh`
- **Committed in:** `56473f7d`

**2. [Rule 2 - Missing critical functionality] A same-reach_id collision must contribute its sensor fraction ONCE**

- **Found during:** Task 2, writing the sensor term.
- **Issue:** A literal reading of "SENSOR_OTHER_FRACTION for every OTHER fired
  reach" stacks 0.25 per co-firing sensor. Twelve sensors can fire
  `context_block` on one turn (D-19), so that reach would reach the fraction cap
  purely by how many sensors happen to be registered against it. The bound would
  still hold, but the RANKING would be decided by registration density, which is
  Requirement 4's accident wearing different clothes.
- **Fix:** the top reach's id is counted once at `SENSOR_TOP_FRACTION`; every
  other DISTINCT id is counted once at `SENSOR_OTHER_FRACTION`; a repeat of an
  already-counted id contributes nothing. Rationale written into the function
  header.
- **Files modified:** `lib/workflow/reach-hedge-ranker.cjs`
- **Committed in:** `1560377b`

### Judgment calls worth naming (not deviations)

- **`SENSOR_OTHER_FRACTION` and `NUDGE_FRACTION_CAP` are not env-overridable.**
  The plan named env overrides only for the top and Brain fractions. A third knob
  whose only job is to sit between the other two invites an inverted
  configuration (`other > top`) with no legitimate use, and an overridable cap
  would be a knob for loosening the A3 bound. Both are stated in the code.
- **The tunables are read at CALL time** (`fractionFromEnv`), mirroring
  `updateN` / `updateEta` in the same module rather than the module-load
  `AFFINITY_MARGIN` shape in `verb-reach-affinity.cjs`. The plan specified the
  `updateN` / `updateEta` idiom, and call-time reads are also what make the
  env-safety arm of the bound test able to exercise the fallback at all.
- **`verb-reach-affinity.cjs` is required LAZILY** inside the function rather than
  at module top. It has zero requires of its own, so a top-level require would
  create no cycle, but a top-level require of a missing or broken module would
  break the whole ranker at load time, whereas the plan's stated intent is that a
  missing affinity module degrade only the Brain term.

## Verification

| Gate | Result |
|---|---|
| `node tests/test-245-tiebreak-deterministic.cjs` | exit **0**, 7 checks, 6 permutations reported |
| `node tests/test-245-nudge-bound.cjs` | exit **0**, 6 checks, **126** swept combinations reported |
| `node tests/test-158-reach-byte-stable.cjs` | exit **0** |
| `node tests/test-158-reach-orchestrator-pure.cjs` | exit 1, **pre-existing**, already logged in this phase's `deferred-items.md` by 245-01 and 245-05 (a second require, `act-jtbd-blurb.cjs`, landed in `ea3ca510`, a docs commit predating this phase; `git diff lib/hmi/dial-reach-orchestrator.cjs` is EMPTY here) |
| `node tests/test-222-readonly-rank.cjs` | exit **0** |
| `bash tests/run-all-222.sh` | exit **0**, `PASS=13 FAIL=0 SKIP=0`, stable across 5 consecutive runs after the de-flake |
| `bash tests/run-all-245.sh` | exit **0**, `PASS=15 FAIL=0 SKIP=0` (both new tests discovered) |
| `bash tests/run-all-244.sh` | exit **0**, `PASS=9 FAIL=0 SKIP=0` |
| `git diff lib/hmi/dial-reach-orchestrator.cjs` | **empty** (D-03 byte-unchanged invariant) |
| `node scripts/build-connector-registry.cjs --check` | exit **0** |
| `node scripts/build-orchestration-projection.cjs --check` | exit **0** (`orchestration-projection: OK`) |
| `node scripts/check-render-coverage.cjs` | exit **0** (16 covered, 0 gap; 202 wired, 0 unwired) |
| `node scripts/build-harness-manifest.cjs --check` | `harness-manifest: OK` (the ranker is not a declared harness surface, so no digest moved) |
| `git diff package.json package-lock.json` | **empty** (T-245-SC: zero package installs) |
| `grep -cP '\x{2014}'` on all 5 touched files | **0** each |

Plan-specific acceptance greps:

| Check | Result |
|---|---|
| `grep -n "a.index - b.index" lib/workflow/reach-hedge-ranker.cjs` | matches (line 528, the retained tertiary fallback) |
| `grep -n "sensorPriorityRank" lib/workflow/reach-hedge-ranker.cjs` | matches (line 521, inside the decorated record feeding the comparator) |
| `grep -rn "rankFiredCandidates" lib/core/insight-sensors.cjs` | no match (no second selection brain inside dispatch) |
| `grep -n "MINDRIAN_SENSOR_TOP_FRACTION\|MINDRIAN_BRAIN_VERB_FRACTION" docs/ENV-TUNING.md` | matches for both |
| `r.FUSION_CEILING === 0.69` and absent-signal no-op one-liner | prints `ok` |

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-245-28 (a poisoned enum lifts the dial) | mitigated | `addFraction` returns early unless the id is a member of this module's frozen local `REACH_IDS`. The Brain verb reaches the fusion only through `verbReachAffinity`, whose key set is the frozen `CANONICAL_VERBS`. Asserted: an off-enum `reach_id` on a fired reach produces `{}`. |
| T-245-29 (crossing the frozen 0.70 floor) | mitigated | Structural bound, swept over 126 combinations against the REAL imported `RECOMMEND_FLOOR`, proven end to end through the real `buildReachList` on two fixtures (empty and non-empty marker sets), and demonstrated with three mutations. |
| T-245-30 (a sensor gaming its own rank) | mitigated | The comparator reads `evidence.sensor_id`, stamped centrally by `dispatchSensors` from the frozen `SENSOR_REGISTRY_IDS` array (245-01). A sensor never writes its own key. An unstamped reach sorts LAST, asserted across 4 input orders. |
| T-245-31 (a fusion or comparator fault breaking the turn) | mitigated | `buildSignalNudges` soft-fails to `{}` (an unfused render, today's behavior, is the degraded state). `rankFiredCandidates` keeps its hot-path soft-fail returning the original array untouched. `sensorPriorityRank` returns the worst FINITE rank rather than throwing, so the comparator can never see `NaN`. |
| T-245-32 (prose riding into the ranking layer) | mitigated | The only new inputs are a `reach_id` enum, a `CANONICAL_VERBS` enum member, and numbers. No body text, no signal value, no dispatch string participates in the math. The Part 8 sweep in `run-all-222.sh` passes over the modified ranker. |
| T-245-SC (supply chain) | not applicable | Zero external packages. `git diff package.json package-lock.json` empty. No install command run. |

## Canon Compliance

- **Part 3:** `RECOMMEND_FLOOR` 0.70 and `MARGIN_THRESHOLD` 0.15 are byte-untouched
  (`git diff lib/hmi/dial-reach-orchestrator.cjs` empty). The Brain-verb term
  applies only in `mode_a`, because `mode_b` is local-only and `tier_0` is the
  Brain-absent fallback.
- **Part 7:** the fusion lives in the ONE shared selection layer. No second
  selection brain was minted, in `dispatchSensors` or anywhere else.
- **Part 8:** enums and numbers only. No prose, no Brain call, no egress.
- **Part 9:** the ranker's sole SQL surface is still the `navigation.cjs`
  chokepoint. The one module added to its require list, `sensor-priority.cjs`, is
  a frozen literal plus an array lookup with zero I/O. The Part 9 sweep in
  `run-all-222.sh` passes (and is now deterministic).

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern
and no schema change. Every input it introduces is an in-repo frozen enum or a
number.

## Known Stubs

None. `buildSignalNudges` is fully implemented and independently tested; it
simply has no production consumer until 245-08 merges its output at the render
callsite, which is the plan's stated division of labor (F-1) rather than a stub.

## Notes for 245-08

1. **The consumer is the render callsite, not this module.** `buildSignalNudges`
   returns FUSED ABSOLUTE SCORES, not deltas, so merge with
   `Object.assign({}, reachScores, nudges)` (the Phase 158-03 `discountedScores`
   precedent), never by adding.
2. **Feed it `rankFiredCandidates`'s output, in order.** Index 0 is load-bearing:
   it is what earns `SENSOR_TOP_FRACTION`, and Task 1's doctrine tie-break is
   what decides index 0 on a collision turn.
3. **`brainVerb` comes from `decision.decision_trace.brain_pattern_verb`** (245-05),
   never from `fire_skill` and never from `context_assembly.decision_grounding`.
4. **The telemetry recompute is still divergent.** 245-RESEARCH.md Pitfall 7 /
   D-04: `scripts/intent-classifier.cjs:2063` recomputes `buildReachList` with
   only `{tierMode, reachScores}` and already omits the reject discount, the
   suppressed set and the relevance gate. It will now also omit the fusion unless
   245-08 threads it there too. Named, not fixed here: this plan owns no line of
   `intent-classifier.cjs`.
5. **`FUSION_CEILING` is exported.** Assert against it rather than hand-typing
   0.69, and note it is deliberately NOT env-overridable.

---
*Phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-*
*Completed: 2026-07-31*

## Self-Check: PASSED

All 5 claimed files verified present on disk. All 3 task commit hashes
(`56473f7d`, `1560377b`, `6e2068e3`) verified present in git history. Zero
em-dashes in this SUMMARY.
