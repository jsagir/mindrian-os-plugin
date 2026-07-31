---
phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-
plan: 08
subsystem: hmi
tags: [dial, reach-scoring, signal-fusion, render-callsite, telemetry-divergence, requirement-1, canon-part-3, canon-part-7, canon-part-8, mutation-proven, frozen-gate]

# Dependency graph
requires:
  - phase: 158-03
    provides: "the shipped Object.assign reject-discount fold at the render callsite, the precedent this fusion reuses verbatim rather than inventing a new merge mechanism"
  - phase: 245-05
    provides: "trace.brain_pattern_verb, the ungated Brain-verb observation that is this fusion's third input and its ONLY permitted source"
  - phase: 245-07
    provides: "buildSignalNudges, the exported bounded three-input fusion returning FUSED ABSOLUTE scores below FUSION_CEILING 0.69"
provides:
  - "composeDialReachScores(input) in scripts/intent-classifier.cjs: the ONE dial score composition, used by both the live render and the reach_presented telemetry recompute"
  - "the Requirement 1 fusion actually merged into the map buildReachList ranks from (the F-1 corrected plug point)"
  - "tests/test-245-dial-reactivity.cjs: SPEC acceptance 1, 12 checks, mutation-proven"
  - "tests/test-245-brain-verb-not-starved.cjs: SPEC acceptance 2 as amended by D-24, 9 checks, mutation-proven"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two consumers of one derived value get ONE composition helper, not two hand-synced copies: the divergence closes structurally rather than by a comment asking future editors to keep them in step"
    - "A helper that never throws and returns null on catastrophic fault, so each caller degrades to exactly the behavior it had before the helper existed rather than to a new degenerate state"
    - "A regression test whose fixtures hold everything constant except the ONE variable under test, so a pass cannot be explained by anything else"
    - "A test that reads its own fixture inputs out of the shipped table at run time, so a re-derivation of that table reddens the test instead of silently invalidating it"

key-files:
  created:
    - tests/test-245-dial-reactivity.cjs
    - tests/test-245-brain-verb-not-starved.cjs
  modified:
    - scripts/intent-classifier.cjs

key-decisions:
  - "The merge lives at the render callsite, not in the hedge ranker: F-1 proved the ranker is a SIBLING of buildReachList, so a fusion folded into it would pass every unit test and move the dial by nothing"
  - "The telemetry recompute passes reachPenalties: null rather than moving the penalty computation above the emit, because computeReachPenalties counts the very reach_presented rows that block writes - reordering would silently change what the LIVE RENDER sees"
  - "The already-RECOMMENDED marker fixture is seeded through the real 158-03 discountedScores merge seam, because a cortex can never legitimately lift a reach to 0.70 and an all-empty marker control proves almost nothing"
  - "lib/hmi/dial-reach-orchestrator.cjs stays byte-unchanged INCLUDING its now-stale scope-boundary comment; correcting the comment would break the D-03 invariant this plan was told to hold"

patterns-established:
  - "A mutation proof recorded with the observed per-arm failure text, plus the note of which arms survived the mutation and why that is honest rather than a gap"

requirements-completed: [REQ-1]

# Metrics
duration: 42min
completed: 2026-07-31
---

# Phase 245 Plan 08: The Render-Callsite Fusion Summary

**The dial's score map is now composed once, by one helper, from cortex priors plus the turn's fired sensor plus Brain's own verb, so two turns with different intent in one session finally produce two different top cards, and the telemetry that logs what was offered finally sees what the navigator saw.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-07-31T15:05Z
- **Completed:** 2026-07-31T15:47Z
- **Tasks:** 3 of 3
- **Files modified:** 3 (2 created, 1 modified)

## Task Commits

1. **Task 1: extract composeDialReachScores and merge the fusion into it** - `7be95bef` (feat)
2. **Task 2: Requirement 1 acceptance 1, two intents produce two different top cards** - `ad2b86f3` (test)
3. **Task 3: Requirement 1 acceptance 2, the Brain verb is not starved** - `4ed014c4` (test)

## What actually changed, in one paragraph

`scripts/intent-classifier.cjs` had two places that built a reach score map and
handed it to `dial-reach-orchestrator.buildReachList`. The live render at the old
`:1274-1345` built cortex priors, folded the Phase 158-03 reject discount over
them, computed the relevance gate, and rendered. The `reach_presented` telemetry
recompute at the old `:2063-2067` built cortex priors and stopped. Both are now
one function, `composeDialReachScores`, and that function is where the Requirement
1 fusion merges in. `buildReachList` never learned anything new: it still receives
`{tierMode, reachScores, suppressedReachIds}` and is byte-identical on disk.

```
BEFORE                                   AFTER
  cortex -> discount -> gate -> render     cortex -> discount -> FUSION -> gate -+-> render
  cortex ----------------------> telemetry                                       +-> telemetry
```

The fusion itself is one line of merge, `Object.assign(reachScores, nudges)`, over
the output of 245-07's `buildSignalNudges`. That function returns FUSED ABSOLUTE
scores rather than deltas, so the callsite performs no arithmetic at all. Every
scoring decision stays inside the shared selection layer, which is what keeps
Canon Part 7's "one selection brain" true.

## Why this seam and not the ranker

This plan exists because 245-RESEARCH.md named the exact way this phase could ship
a false success: fold the fusion into `rankFiredCandidates`, watch every unit test
go green, ship a dial that never moves. Its stated warning sign was "a plan whose
R1 task list contains no edit to `scripts/intent-classifier.cjs`".

F-1's data-flow correction is the reason. The hedge ranker and `buildReachList` are
SIBLING consumers of the same `buildReachScoresFromCortex` output: the ranker reads
the map read-only, returns a reordered array, and nothing downstream of it reaches
the dial. Confirmed again here by enumerating every live call site of
`buildReachList` in the tree:

| Call site | File | Routed through the helper? |
|---|---|---|
| the live dial render | `scripts/intent-classifier.cjs` (`renderEngineDecisionWithDial`) | yes |
| the `reach_presented` telemetry recompute | `scripts/intent-classifier.cjs` (the live engine arm) | yes |
| anywhere else | none exist | n/a |

Two live call sites, both now composed identically.

## The order of the fold, and why it is not arbitrary

```
1. cortex priors            buildReachScoresFromCortex(cortexNodes)
2. the 158-03 reject discount   Object.assign(scores, penalties.discountedScores)
3. the Requirement 1 fusion     Object.assign(scores, buildSignalNudges({...}))
4. the suppression set          reject hard-suppression + the relevance gate
```

Step 3 must come after step 2. The reject discount is computed upstream against
the RAW cortex scores (`discounted = base * (1 - penalty)`), so discounting a
FUSED score would compound a rejection penalty onto a signal the navigator never
rejected. That is also why the third `buildReachScoresFromCortex` call in the file
(the one feeding `computeReachPenalties` on the live engine arm) was deliberately
left alone: it is the discount's base, and it must stay pre-fusion.

## The Brain-verb source, and the trap next to it

`trace.brain_pattern_verb` is the only source read. 245-RESEARCH.md Pitfall 2 names
the two wrong ones explicitly, and the reason is worth restating because it is not
obvious: on any turn where a sensor fires, both `trace.fire_skill` and
`context_assembly.decision_grounding` hold the SENSOR's value, so reading the Brain
term from either measures the sensor twice and silently re-implements the exact
D-24 starvation that 245-05 and this plan exist to fix.

The mutation in Task 3 makes that concrete rather than theoretical. Repointing the
read at `trace.fire_skill` did not merely fail the Brain arms; it also lifted the
FIRED reach from `0.614` to `0.64725`, because `'Run Methodology'` (the fired
reach's own skill family) has a `context_block` affinity entry. The sensor got
counted a second time through the Brain door. That is the defect in numbers.

There are two other `decision_grounding` reads in the file (around `:3296-3309`).
Both belong to the Phase 158-01 offer-to-close keying, a different subsystem on a
different turn boundary, and neither is in the composition path.

## Threading: `reachPenalties` at the telemetry site (the plan asked for this explicitly)

**Outcome: `reachPenalties` was NOT available, is NOT moved, and telemetry passes
`null`. What remains omitted is the Phase 158-03 reject `discountedScores` fold and
the reject hard-suppression set. Nothing else.**

The plan offered two options: move the `reachPenalties` computation above the
telemetry emit, or pass `null` and document precisely what is missing. The first
option was rejected on evidence, not on effort.

`computeReachPenalties` counts `reach_presented` rows
(`lib/workflow/reach-reject-reader.cjs:135-160`, feeding the M-floor and the
periodic-parole counter). The telemetry block is what WRITES those rows. So the
dependency is genuinely circular: whichever runs first is deprived of the other's
output. The shipped order is emit-then-compute, which means the LIVE RENDER's
penalty currently includes this turn's own presentation. Moving the computation
above the emit would change that, silently, for the render. This plan has no
authority over the 158-02/158-03 parole fences, so it did not take it.

The net position, stated honestly:

| Input | live render | telemetry recompute | before 245-08 |
|---|---|---|---|
| tier mode | yes | yes | yes |
| cortex priors | yes | yes | yes |
| 158-03 reject discount | yes | **no** | no |
| Requirement 1 fusion | yes | yes | n/a |
| relevance gate | yes | yes | no |
| reject hard-suppression | yes | **no** | no |

Before this plan the recompute diverged on four inputs. It now diverges on one,
and the reason is written into the code at the call site, not left for a reader to
discover. Logged in `deferred-items.md` item 3 with the design question that would
close it.

## Tri-Polar finding (CLAUDE.md three-surface rule)

Investigated rather than assumed. `grep` for `buildReachList` and `renderDial`
across `lib/` and `scripts/`:

| Surface | Reaches the F.7 dial through | Covered by this fusion? |
|---|---|---|
| **Claude Code CLI** | `scripts/intent-classifier.cjs` `renderEngineDecisionWithDial`, the `UserPromptSubmit` hook path | **yes** |
| **Claude Desktop** | nothing. `lib/mcp/` contains zero calls to `buildReachList` or `renderDial`; the MCP surface exposes ranked reach CANDIDATES (`reach_candidates`, `suggest_next`), never a rendered dial | **n/a, no dial exists to inform** |
| **Cowork** | same as Desktop: the MCP tool surface, no dial render | **n/a, no dial exists to inform** |

This is a deliberate statement, not an omission. The F.7 dial is a CLI render
today; Desktop and Cowork consume the ranked candidate array instead. When either
grows a dial it must call `composeDialReachScores`, and the fact that there is now
exactly ONE composition helper to call is what makes that a small change rather
than a third divergent copy.

**`lib/mcp/tools/sensors.cjs:142` (the plan asked for this specifically):** it
calls `rankFiredCandidates(fired, ...)` and returns the ordered array. It does NOT
render a dial and does NOT call `buildReachList`. So it inherits 245-07's
`SENS_PRIORITY` tie-break automatically (confirmed in the 245-07 SUMMARY by live
execution) but is not a fusion consumer, and correctly so: Phase 222's SPEC
boundary threads no `cortexNodes` on that path, so every candidate sits on the flat
0.5 D4 floor and there is no cortex prior to fuse against.

## The two acceptance tests

### Acceptance 1: `tests/test-245-dial-reactivity.cjs` (12 checks, exit 0)

One fixed cortex reused byte-identically by every fixture, so the base scores can
never be what moved. Two turns, one session, identical tier, one difference: which
sensor fired.

**Observed top card per turn:**

| Fixture | fired sensor reach | Brain verb | **top card** |
|---|---|---|---|
| Turn A | `context_block` | none | **`context_block`** (0.614) |
| Turn B | `cross_room` | none | **`cross_room`** (0.614) |
| no-signal control | none | none | **`cross_room`** (0.5, the registry default) |

The test asserts DIRECTION, not just difference: each turn's top card must be the
reach its own sensor fired. Inequality alone would pass on a coin flip and would
keep passing if the fusion were wired to the wrong reach.

The cortex was chosen so neither fired reach carries a cortex prior, and that is
the harder case, not the easier one. The nudge interpolates toward the ceiling from
wherever the base sits, so a reach with a LOW cortex prior fuses to a LOWER
absolute value than one with none (`0.15 -> 0.474` against `absent -> 0.614`). A
fixture that handed the fired reaches a small prior would have been quietly easier
to reorder in the wrong direction.

Controls: the no-signal fixture's rendered dial is JSON-identical to the un-fused
path; the recommended-marker set is identical across all three fixtures; no fused
score reaches the `RECOMMEND_FLOOR` read off the shipped orchestrator rather than
hand-typed.

Arm 5 exists because an all-empty marker set proves very little. A cortex can never
legitimately lift a reach to 0.70 (the adapter's `CONTRIBUTIONS` table is built so
no single signal solo-crosses the floor), so a NON-EMPTY already-RECOMMENDED prior
is seeded through the real step-2 `discountedScores` merge, and the test asserts the
marker set survives the fusion unchanged while the fired reach still improves its
rank on that same fixture (so the arm cannot pass on a fusion that returns `{}`).

### Acceptance 2: `tests/test-245-brain-verb-not-starved.cjs` (9 checks, exit 0)

A second, distinct test as the SPEC requires. Cortex, fired sensor and tier held
constant; ONLY `brain_pattern_verb` varies.

The verb and its target reach are read from `lib/core/verb-reach-affinity.cjs` at
run time, picking the first verb whose affinity is non-null and does NOT overlap the
fired reach. A table with no such verb FAILS with a clear message rather than
skipping, because a silently skipped acceptance criterion is the false-success shape
this phase exists to close.

**Observed:** fired `context_block`, verb `'Spawn Sub-Agent'`, target `deep_research`.

| Assertion | no verb | with verb |
|---|---|---|
| `deep_research` score | 0 | **0.5665** |
| `deep_research` rank | 5 | **1** |
| `context_block` score (the fired reach) | 0.614 | **0.614** |

Score alone would pass on an invisible change, so rank movement is asserted too.
The fired reach holding at exactly `0.614` across both variants is the D-24
property in one number: the Brain term is ADDITIVE alongside the sensor term, not
a replacement for it and not gated behind sensor silence.

Tier control: in `mode_b` the Brain term does not apply (Canon Part 3: `mode_b` is
local-only) while the SENSOR term still does. Both halves are asserted, because a
`mode_b` arm that only checked the Brain term would also pass if the whole fusion
had been switched off in that tier.

## Mutation proofs (observed exit codes and failure text, not assumed)

Both applied, observed, then reverted with `git diff --stat scripts/intent-classifier.cjs` confirmed empty.

| # | Mutation | Test | Observed failing arms | Exit |
|---|---|---|---|---|
| 1 | Comment out `Object.assign(reachScores, nudges)` inside `composeDialReachScores` | `test-245-dial-reactivity.cjs` | `turn A top: cross_room / turn B top: cross_room`; `expected context_block, got cross_room`; `fused rank 4 vs unfused rank 4` | **1** (3 of 12 arms) |
| 2 | Repoint the Brain-verb read from `trace.brain_pattern_verb` at `trace.fire_skill` (Pitfall 2's named wrong source) | `test-245-brain-verb-not-starved.cjs` | `deep_research: 0 (no verb) -> 0 (verb "Spawn Sub-Agent")`; `deep_research rank: 5 (no verb) -> 5 (verb)` | **1** (2 of 9 arms) |
| - | control, unmutated | both | all checks pass | **0** |

Two notes on what SURVIVED each mutation, because a mutation proof that hides its
misses is not a proof.

Under mutation 1, `turn B's top card IS the reach turn B's own sensor fired` still
PASSED. That is correct and expected: `cross_room` is the registry-default winner
anyway, so turn B's top card is right for the wrong reason with the fusion removed.
It is precisely why turn A's assertion is the load-bearing one, and why the
headline arm asserts A-versus-B rather than either alone. The headline arm reddened
with the literal SPEC failure symptom: the same card both times.

Under mutation 2, the two "sensor still nudged" arms still PASSED, because the
sensor term was untouched by that mutation. What they did not catch, and what the
observed `0.64725` in the printed output shows, is that the fired reach was being
double-counted through the Brain door. The score-and-rank arms caught it.

## Deviations from Plan

### Auto-fixed issues

None. No Rule 1, 2 or 3 fix was needed: nothing was found broken, missing or
blocking within this plan's scope.

### Judgment calls worth naming (not deviations)

- **`composeDialReachScores` takes three inputs the plan's stated signature did
  not name:** `slotContext`, `liveTurnText` and `currentRoomName`. They are not new
  behavior; the plan's own step 4 asks for the relevance gate to be moved "verbatim
  including its fail-open catch", and that gate cannot run without them.
  `buildDialSlotContext` stays exactly where it was at the render callsite, as the
  plan directed, and its output is passed in.
- **The helper returns `null` on a catastrophic fault instead of throwing.** The
  plan said a throw is not acceptable. A helper that swallowed and returned an
  empty score map would have rendered a degenerate dial where today a fault
  returns the plain base block, which is a behavior change. `null` lets each
  caller degrade to exactly what it did before the helper existed: the render
  returns `base`, the telemetry skips its emit.
- **The third `buildReachScoresFromCortex` call in the file was left in place.** It
  is the `computeReachPenalties` input on the live engine arm, not a
  `buildReachList` call site, and it must stay pre-fusion (see the fold-order
  section). The plan's acceptance grep is about the two call sites; this is neither.
- **`lib/hmi/dial-reach-orchestrator.cjs` keeps a comment that is now stale.** Its
  header states the dial ranking is "100 percent cortex-node scoring". That is
  still exactly true of `buildReachList` itself and no longer true of the map it
  receives. Fixing the comment would break the D-03 byte-unchanged invariant this
  plan was told to hold, so it is logged in `deferred-items.md` item 1 instead.

## Verification

| Gate | Result |
|---|---|
| `node tests/test-245-dial-reactivity.cjs` | exit **0**, 12 checks |
| `node tests/test-245-brain-verb-not-starved.cjs` | exit **0**, 9 checks |
| `node tests/test-158-reach-byte-stable.cjs` | exit **0** |
| `node tests/test-158-reach-orchestrator-pure.cjs` | exit 1, **pre-existing and unchanged** (the `act-jtbd-blurb.cjs` require from `ea3ca510`, a docs commit predating this phase; already logged by 245-01 / 245-05 / 245-07 in `deferred-items.md`). Baseline captured BEFORE any edit in this plan: identical exit 1. `git diff lib/hmi/dial-reach-orchestrator.cjs` is EMPTY. |
| `node tests/test-158-reach-presentation-counter.cjs` | exit **0** |
| `node tests/test-158-reach-discount.cjs` | exit **0** |
| `node tests/test-158-reach-hard-suppress.cjs` | exit **0** |
| `node tests/test-209-engine-arm-contract.cjs` | exit **0** |
| `node tests/test-150-5-render-atomicity.cjs` | exit **0** (the SEED-020 source fence over `intent-classifier.cjs`) |
| `node tests/test-222-readonly-rank.cjs` | exit **0** |
| `bash tests/run-all-245.sh` | exit **0**, `PASS=17 FAIL=0 SKIP=0` (15 -> 17: both new tests discovered by the glob, no runner edit needed) |
| `bash tests/run-all-244.sh` | exit **0**, `PASS=9 FAIL=0 SKIP=0` |
| `bash tests/run-all-222.sh` | exit **0**, `PASS=13 FAIL=0 SKIP=0` |
| `node scripts/build-connector-registry.cjs --check` | exit **0**, `connector-registry: OK` |
| `node scripts/build-orchestration-projection.cjs --check` | exit **0**, `orchestration-projection: OK` |
| `node scripts/check-render-coverage.cjs` | exit **0**, `render-coverage: OK` |
| `node scripts/build-harness-manifest.cjs --check` | `harness-manifest: OK`, no digest moved |
| `node scripts/doctor.cjs --acceptance` | 15/16, one failure: `eureka-fts-index-visible`, a stale lexical index in the DEVELOPER's own `jonathan-contractor-motj` room. Machine-local, outside the repo, unreachable by this diff. Logged in `deferred-items.md` item 2. **No new failure.** |
| `git diff lib/hmi/dial-reach-orchestrator.cjs` | **empty** (D-03 byte-unchanged invariant) |
| `git diff docs/MINDRIAN-CANON.md` | **empty** |
| `git diff package.json package-lock.json` | **empty** (T-245-SC: zero package installs, zero install commands run) |
| `grep -cP '\x{2014}'` on all 3 touched files | **0** each |

Plan-specific acceptance greps:

| Check | Result |
|---|---|
| `grep -n "composeDialReachScores" scripts/intent-classifier.cjs` | 1 definition (`:1293`), 2 call sites (`:1462` render, `:2218` telemetry), 1 export (`:3072`) |
| `grep -n "buildReachScoresFromCortex" scripts/intent-classifier.cjs` | 1 executable call inside the helper (`:1308`); the only other executable hit (`:2295`) is the `computeReachPenalties` discount base, not a `buildReachList` call site |
| `grep -n "buildSignalNudges" scripts/intent-classifier.cjs` | matches at `:1359`, inside `composeDialReachScores` |
| `grep -n "trace.fire_skill\|decision_grounding" scripts/intent-classifier.cjs` | no use as a Brain-verb source anywhere in the composition path (the only hits are a warning comment at `:1339` and the unrelated Phase 158-01 offer-to-close keying at `:3296-3309`) |
| the telemetry `buildReachList` call receives `suppressedReachIds` | yes (`:2227-2231`) |
| `composeDialReachScores` with cortex + null penalties + empty facts + null verb | returns a `reachScores` map **JSON-identical** to `buildReachScoresFromCortex(cortexNodes)`, asserted in the test and verified live |
| `grep -n "rankFiredCandidates" tests/test-245-dial-reactivity.cjs` | **no match** (assertions are on the dial, not the fired list) |
| `grep -n "intent-classifier" tests/test-245-dial-reactivity.cjs` | 4 matches (exercises the production composition path) |
| `grep -n "buildSignalNudges" tests/test-245-brain-verb-not-starved.cjs` | **no match** (no direct call; everything goes through the production path) |
| `grep -n "verb-reach-affinity" tests/test-245-brain-verb-not-starved.cjs` | 2 matches (the verb and target are read at run time, not hardcoded) |

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-245-33 (the fusion crossing the frozen 0.70 floor at the render seam) | mitigated | The callsite performs NO arithmetic: `buildSignalNudges` returns fused absolute scores already bounded below `FUSION_CEILING` 0.69 by the shape of its interpolation, and `Object.assign` cannot exceed them. Proven end to end through the real `buildReachList` gate by the marker-set-identical controls in BOTH acceptance tests, including a non-empty already-RECOMMENDED fixture, and by an explicit assertion against the `RECOMMEND_FLOOR` imported from the shipped orchestrator. Max fused value observed anywhere: **0.614**. |
| T-245-34 (reading the Brain verb from the wrong trace field, so the sensor is measured twice) | mitigated | `trace.brain_pattern_verb` is the only source. Asserted by grep and mutation-proven: repointing the read at `trace.fire_skill` reddens `test-245-brain-verb-not-starved.cjs` (exit 1) AND visibly double-counts the fired reach (0.614 -> 0.64725). |
| T-245-35 (prose from `facts[]` evidence reaching the dial) | mitigated | The helper passes `facts` straight to `buildSignalNudges`, whose 245-07 contract reads only `reach_id` and matches it against the frozen `REACH_IDS` enum. `buildContextAssembly` (`lib/core/navigation-engine.cjs:356-395`) already guarantees `facts[]` carries scalars, slugs and enums only, its own Part 8 HARD header. No body text, no signal value, no dispatch string participates. |
| T-245-36 (a fusion fault breaking the dial render or the turn) | mitigated | The fusion require and call are wrapped: any fault leaves `reachScores` at its post-158-03 state, degrading to today's un-fused render. The whole helper is wrapped again and returns `null` on catastrophic fault, so each caller degrades to exactly its pre-helper behavior. The telemetry site remains inside its best-effort swallowed block. |
| T-245-37 (telemetry logging a different offered set than the navigator saw) | mitigated, one input still short, stated | Both call sites route through the ONE helper and both now pass `suppressedReachIds`. The divergence went from four inputs to one. The remaining omission (`reachPenalties`, a genuine circular dependency with the emit) is documented at the call site in code, in the table above, and in `deferred-items.md` item 3. Never left silent. |
| T-245-SC (supply chain) | not applicable | Zero external packages. `git diff package.json package-lock.json` empty. No install command run. |

## Canon Compliance

- **Part 3 (Tri-Context Decision Gate):** `RECOMMEND_FLOOR` 0.70 and
  `MARGIN_THRESHOLD` 0.15 are byte-untouched, and so is the whole orchestrator
  (`git diff` empty). The Brain-verb term applies in `mode_a` only, asserted by
  the `mode_b` tier control. No reach acquires a marker it did not earn, asserted
  on both an empty and a non-empty marker set.
- **Part 7 (Reuse Before Build):** no new selection brain was minted. The MATH
  stayed in `lib/workflow/reach-hedge-ranker.cjs`; this plan added a MERGE, on the
  shipped Phase 158-03 `Object.assign` precedent, at the same seam that precedent
  already occupies. The one genuinely new surface, `composeDialReachScores`,
  DELETES a duplicate rather than adding one: it replaces two divergent
  compositions with a single shared one.
- **Part 8 (Graph Boundary):** the two new inputs are a frozen `REACH_IDS` enum
  member and a frozen `CANONICAL_VERBS` member, both already on the LOCAL decision
  trace. No Brain call, no wire, no egress, no db, no fs. The helper is pure with
  respect to its arguments.
- **Part 9 (Memory Locality):** no SQL was added. The helper opens no handle; both
  call sites run with the db already closed or inside an existing best-effort
  block. The telemetry emit still writes through the `navigation.cjs` chokepoint
  exactly as before.
- **Part 12 (Pedagogy):** the dial's job is to make the next move obvious. A card
  that never changed regardless of what the navigator asked was Larry being
  visible in the worst way, as furniture. This is the fix.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and
no schema change. Every input it introduces is an in-repo frozen enum or a number
already present on the LOCAL decision trace.

## Known Stubs

None. Both call sites are wired, both acceptance tests exercise the production
path, and both mutations redden.

---
*Phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-*
*Completed: 2026-07-31*

## Self-Check: PASSED

All 3 claimed files verified present on disk (`scripts/intent-classifier.cjs`,
`tests/test-245-dial-reactivity.cjs`, `tests/test-245-brain-verb-not-starved.cjs`).
All 3 task commit hashes (`7be95bef`, `ad2b86f3`, `4ed014c4`) verified present in
git history. `git diff` confirms `scripts/intent-classifier.cjs` was actually
touched (239 insertions, 69 deletions). Zero em-dashes in this SUMMARY.
