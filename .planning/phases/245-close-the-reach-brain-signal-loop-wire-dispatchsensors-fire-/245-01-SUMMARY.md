---
phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-
plan: 01
subsystem: sensors
tags: [sensor-registry, reach-dispatch, priority-doctrine, fail-closed-gate, canon-part-8, canon-part-11]

# Dependency graph
requires:
  - phase: 143
    provides: "makeReach + the frozen REACH_IDS / POSTURE_IDS banks (lib/core/sensors/sensor-types.cjs)"
  - phase: 172
    provides: "TRIGGER_TIERS + isContextTier / isFallbackTier, the R3 tier precedence this table's rule 1 is derived from"
  - phase: 244
    provides: "SENS-16 sensorContentRelevance, the 18th registry member and the only pure FALLBACK-tier sensor"
provides:
  - "SENS_PRIORITY: a frozen 18-entry ordered sensor priority table with its authoring doctrine in the file header"
  - "sensorPriorityRank(sensorId): a total, defensive rank lookup (worst finite rank on any non-member)"
  - "SENSOR_REGISTRY_IDS: a frozen array of sensor ids, index-parallel to SENSOR_REGISTRY"
  - "evidence.sensor_id stamped centrally on every reach dispatchSensors emits"
  - "A fail-closed sensor-side completeness gate inside build-connector-registry.cjs --check"
  - "tests/run-all-245.sh: the phase runner, glob discovery with a load-bearing found-eq-0 guard"
affects: [245-06, 245-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One central registry-driven stamp instead of N hand-maintained per-sensor declarations (Canon Part 7)"
    - "A doctrine constant paired with a fail-closed build gate that enumerates the code side, not a declaration side"

key-files:
  created:
    - lib/core/sensors/sensor-priority.cjs
    - tests/run-all-245.sh
    - tests/test-245-sensor-id-stamped.cjs
    - tests/test-245-priority-complete.cjs
  modified:
    - lib/core/insight-sensors.cjs
    - scripts/build-connector-registry.cjs

key-decisions:
  - "D-21 delivered as ONE central stamp in dispatchSensors, not 18 per-sensor edits: identical observable outcome, structurally impossible for a new sensor to ship unstamped (Canon Part 7)"
  - "The completeness gate enumerates SENSOR_REGISTRY_IDS, never sensor_index (D-22 as corrected by 245-RESEARCH.md F-3)"
  - "A stamp fault soft-fails to the ORIGINAL reach: a stamp is never allowed to cost a reach that already passed the gates"
  - "Exported the two registered-but-unexported sensors sensorRoomPick and sensorExpertSkill so every registry member is reachable by name"

patterns-established:
  - "Index-parallel arrays with a lockstep comment plus TWO fences (build gate + phase test) that both fail closed on divergence"
  - "Mutation proof recorded with observed exit codes, not asserted from reading the code"

requirements-completed: [REQ-4]

# Metrics
duration: 22min
completed: 2026-07-31
---

# Phase 245 Plan 01: Sensor Identity and the Priority Doctrine Table Summary

**Every reach `dispatchSensors` emits now names the sensor that produced it, and a frozen 18-entry `SENS_PRIORITY` doctrine table ranks every registered sensor behind a build gate that fails closed when the two drift apart, with zero ranking-behavior change.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-31T08:47Z
- **Completed:** 2026-07-31T09:10Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

### Task 1 - `lib/core/sensors/sensor-priority.cjs` (commit `15fe4550`)

The problem this fixes, stated plainly: 12 of the 18 registered sensors can fire
the same reach id, `context_block`. When two of them fire on one turn,
`rankFiredCandidates` has no term keyed on the individual sensor (every term it
has is keyed on `reach_id`), so the comparator falls all the way through to the
stable sort's `a.index - b.index`. That index is `SENSOR_REGISTRY` file order.
Today, "which sensor's payload wins" is decided by whoever edited the registry
array last. That is an accident, not a doctrine.

`SENS_PRIORITY` is the doctrine that replaces the accident. It is the sort KEY,
not the sort: nothing in this plan reads it at ranking time. The comparator
branch lands in 245-07.

**The committed order (index 0 = highest priority):**

| Rank | Id | Sensor | Group |
|------|-----|--------|-------|
| 0 | `SENS-08` | memory-cortex | A: confirmed room-state / projected-cortex facts |
| 1 | `SENS-10` | circularity | A |
| 2 | `SENS-11` | expert-skill | A |
| 3 | `SENS-14` | opportunity-harvest | A |
| 4 | `SENS-02` | lagging-component | A |
| 5 | `SENS-RECENCY` | recency | A |
| 6 | `SENS-01` | first-material | B: explicit turn signals + shipped side-channel markers |
| 7 | `SENS-06` | artifact-filed | B |
| 8 | `SENS-13` | eureka | B |
| 9 | `SENS-15` | url-ingest | B |
| 10 | `SENS-12` | room-pick | B |
| 11 | `SENS-07` | gate-approach | B |
| 12 | `SENS-03` | methodology-decision | B |
| 13 | `SENS-05` | jtbd-reweight | C: derived / reweighted intent signals |
| 14 | `SENS-04` | external-fact | C |
| 15 | `SENS-09` | diffusion-adoption | C |
| 16 | `SENS-SHOW` | show-share | C |
| 17 | `SENS-16` | content-relevance | D: the FALLBACK lexical tier |

The three placement rules live in the file header so a future sensor author can
place a new entry without guessing: (1) Canon Part 11 R3 tier precedence
(problem-state beats lexical, which is why `SENS-16` is last), (2) evidence
durability within a tier (confirmed fact beats transient marker beats derived
reweight), (3) remaining ties fall to canonical registry order, so the table is
a documented refinement of shipped behavior rather than a reshuffle.

The header also records why `sensor-temporal-blindness.cjs`, `sensor-types.cjs`
and `hat-scoping-table.cjs` are absent (unregistered module, shared contract,
pure lookup respectively) and that `SENS-RECENCY` / `SENS-SHOW` are real
self-declared non-numeric ids, not placeholders to be tidied into numbers.

`sensorPriorityRank` mirrors `canonicalRegistryRank`'s defensive shape: any
non-string, empty string, or unknown id returns `SENS_PRIORITY.length`, the
worst FINITE rank. Never `Infinity`, never `NaN`, never `-1`. A `NaN` comparator
result corrupts a sort silently instead of failing loudly, which is the exact
class of failure this phase exists to close.

### Task 2 - the central `evidence.sensor_id` stamp (commit `096399ab`)

`SENSOR_REGISTRY_IDS`, a frozen array index-parallel to `SENSOR_REGISTRY`:

| i | Registry entry | Id |
|---|----------------|-----|
| 0 | `sensorFirstMaterial` | `SENS-01` |
| 1 | `sensorArtifactFiled` | `SENS-06` |
| 2 | `sensorLaggingComponent` | `SENS-02` |
| 3 | `sensorMethodologyDecision` | `SENS-03` |
| 4 | `sensorGateApproach` | `SENS-07` |
| 5 | `sensorExternalFact` | `SENS-04` |
| 6 | `sensorJtbdReweight` | `SENS-05` |
| 7 | `sensorMemoryCortex` | `SENS-08` |
| 8 | `sensorRecency` | `SENS-RECENCY` |
| 9 | `sensorDiffusionAdoption` | `SENS-09` |
| 10 | `sensorShowShare` | `SENS-SHOW` |
| 11 | `sensorCircularity` | `SENS-10` |
| 12 | `sensorExpertSkill` | `SENS-11` |
| 13 | `sensorRoomPick` | `SENS-12` |
| 14 | `sensorEureka` | `SENS-13` |
| 15 | `sensorOpportunityHarvest` | `SENS-14` |
| 16 | `sensorUrlIngest` | `SENS-15` |
| 17 | `sensorContentRelevance` | `SENS-16` |

**Why one central stamp and not 18 one-line edits.** D-21 describes the stamp as
"a Part-8-safe one-line add per sensor". This delivers the identical observable
outcome through a single seam on purpose. This repo has already been bitten
twice by hand-maintained parallel sensor declarations drifting from reality:
D-15 found three commands falsely declaring `SENS-05` for the `hats` reach, and
F-3 found `sensor_index` missing four real sensors because it only ever read the
command side. Eighteen per-sensor edits is eighteen more places to forget. A
central stamp makes it structurally impossible for a newly registered sensor to
ship unstamped, which is exactly the invariant the Task 3 gate assumes. Canon
Part 7: one mechanism, not eighteen. The rationale is written into the
`stampSensorId` header, not just here.

Mechanics: the dispatch loop became an indexed loop so identity is read by
registry position rather than inferred. `stampSensorId(reach, i)` rebuilds
through `makeReach` (never mutates the frozen input), preserving `reach_id`,
`posture`, `dispatch`, `companions` and `signal` verbatim. It returns the
ORIGINAL reach unchanged if `makeReach` returns null or if the id is not a
non-empty string, because a stamp fault must never cost a reach that already
passed the membership and turn-stage gates (threat T-245-04).

Canon Part 8: `sensor_id` is read from the frozen in-repo literal array only.
`makeReach` already drops non-primitives and re-freezes, so the struct stays a
flat scalar bag. The stamped test carries a decoy arm proving a turn-supplied
id-shaped string is never stamped.

### Task 3 - the fail-closed gate and the phase runner (commit `c5e19d1d`)

`sensorPriorityCompletenessErrors()` runs inside `--check` and asserts three
relations: the two registry arrays are the same length, every registered id has
a `SENS_PRIORITY` rank, and every `SENS_PRIORITY` entry names a registered
sensor. Failures print the offending id list to stderr and exit non-zero through
the existing `errs` convention.

It reads `SENSOR_REGISTRY_IDS`, never `sensor_index`, and the code comment says
why at length so the next reader does not "fix" it back: `sensor_index` is
derived from command frontmatter `sensor_triggers`, has 13 keys, already omits
`SENS-10` / `SENS-11` / `SENS-12` / `SENS-16` (three of them `context_block`
colliders), and contains ids with no registered implementation. It is a record
of which commands CLAIM a sensor, not of which sensors EXIST. A gate built on it
would report green while exempting the exact sensors Requirement 4 is about.

`tests/run-all-245.sh` mirrors `run-all-244.sh`: glob discovery over
`tests/test-245-*` (`.cjs` and `.sh`), `run_may_skip` for environment self-skips,
the no-em-dash fence over the phase's file set, the 15 mandatory test filenames
enumerated in the header as a reading checklist, and the load-bearing
found-eq-0 guard. One shape change from 244: the discovery prefix reads from an
optional `TEST_245_PREFIX` env var so the found-eq-0 branch is PROVABLE by
running the script rather than by reading it. Production runs never set it.

## Task 3 mutation proof (observed, not assumed)

Mutation: deleted the single line `  'SENS-11',` from `SENS_PRIORITY` in
`lib/core/sensors/sensor-priority.cjs`, leaving the sensor registered.

| Command | Exit code | Output |
|---------|-----------|--------|
| `node scripts/build-connector-registry.cjs --check` | **1** | `SENSOR PRIORITY GATE: registered sensor(s) with NO SENS_PRIORITY entry: SENS-11. Add each to the ordered table in lib/core/sensors/sensor-priority.cjs (its header carries the three placement rules).` |
| `node tests/test-245-priority-complete.cjs` | **1** | `AssertionError [ERR_ASSERTION]: registered sensor(s) with NO SENS_PRIORITY entry: SENS-11` |

Restored, then re-verified: both back to exit **0**, and
`git diff --stat lib/core/sensors/sensor-priority.cjs` empty (the restore was
byte-exact, not approximate).

Empty-discovery proof: `TEST_245_PREFIX=tests/test-245-nonexistent- bash
tests/run-all-245.sh` exits **1** printing
`!!! no tests/test-245-nonexistent-* files discovered`.

## Verification

| Gate | Result |
|------|--------|
| `node scripts/build-connector-registry.cjs --check` | exit 0 (`connector-registry: OK`) |
| `node scripts/build-orchestration-projection.cjs --check` | exit 0 |
| `node scripts/check-render-coverage.cjs` | exit 0 |
| `bash tests/run-all-245.sh` | exit 0, PASS=3 FAIL=0 SKIP=0, 2 test files discovered |
| `git diff --stat data/connector-registry.json` after running the generator | empty (byte-identical) |
| `node tests/test-158-reach-byte-stable.cjs` | exit 0 |
| `node tests/test-158-reach-orchestrator-pure.cjs` | exit 1, **pre-existing**, proven identical before and after (see below) |
| `node tests/test-213-reach-wired.cjs` | exit 0 |
| `node tests/test-160-recency-reach-signal.cjs` | exit 0 |
| `node tests/test-diffusion-adoption-sensor.cjs` | exit 0 (32 assertions) |
| `grep -cP '\x{2014}'` on all 6 touched files | 0 each |

## Existing tests that needed an evidence-shape update

**None.** This is a real finding, not an omission.

The full sweep was run: all 35 test files matching
`grep -rln "dispatchSensors" tests/*.cjs`, plus every Part 8 sweep
(`test-158-reach-part8-no-reason`, `test-159-part8-secretreason-sweep`,
`test-213-part8-boundary`, `test-169-brain-boundary`). 30 of the 35 pass. No
test deep-compares a reach's whole `evidence` object against a literal, and no
Part 8 sweep enumerates a closed allowlist of evidence KEYS (they assert every
evidence VALUE is a scalar / enum and carries no prose, which the added
`sensor_id` satisfies by construction). So no allowlist edit was needed, and no
assertion was loosened.

The 5 failures were each proven pre-existing by the same method: set the working
copy aside, `git checkout -- lib/core/insight-sensors.cjs`, re-run, restore,
diff the two outputs. All five were IDENTICAL apart from pid / tmpdir noise.
They are recorded in `deferred-items.md` in this phase directory:
`test-203-reach-sensor` (17/19, the known `edges.review_status` schema drift),
`test-209-room-pick-sensor`, `test-220-url-sensor`,
`test-205-sens10-circularity`, `test-237-session-scope`. A sixth,
`test-158-reach-orchestrator-pure`, is named in this plan's verification block
and also fails at baseline: its purity tripwire asserts the reach orchestrator's
only require is `f-selector-ranker.cjs`, and a second require
(`act-jtbd-blurb.cjs`) has since landed. Out of scope, not fixed, logged.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 - Missing critical functionality] Exported `sensorExpertSkill` alongside `sensorRoomPick`**

- **Found during:** Task 2, step 3
- **Issue:** The plan named `sensorRoomPick` as the one registered-but-unexported
  sensor. Enumerating the exports block against `SENSOR_REGISTRY` found the gap
  is two wide, not one: `sensorExpertSkill` (SENS-11, Phase 203-03) is also
  registered and also absent from `module.exports`. Fixing only the named one
  would leave the identity array claiming 18 sensors while 17 are reachable by
  name, which is the same "declaration diverges from reality" shape the whole
  plan is built to prevent.
- **Fix:** Exported both, each with a comment naming its phase of origin.
- **Files modified:** `lib/core/insight-sensors.cjs`
- **Commit:** `096399ab`

### Additive shape change, not a deviation

`tests/run-all-245.sh` reads its discovery prefix from an optional
`TEST_245_PREFIX` env var. The plan's acceptance criterion offered a choice:
prove the found-eq-0 branch by temporarily repointing the glob, or by asserting
the branch exists in the source. The env var makes the stronger option
(actually running it and observing exit 1) available without editing the file,
so the guard is proven by execution rather than by reading. Default behavior is
byte-identical to `run-all-244.sh`.

## Threat model coverage

| Threat ID | Disposition | Where it landed |
|-----------|-------------|-----------------|
| T-245-01 (info disclosure via the stamp) | mitigated | Stamp reads the frozen literal array only; `test-245-sensor-id-stamped.cjs` asserts strict membership plus a decoy arm proving a turn-supplied id-shaped string is never stamped |
| T-245-02 (SENS_PRIORITY tampering) | mitigated | `Object.freeze`; duplicate-free and complete asserted at build time and test time; ordering doctrine in the file header so a silent reshuffle is reviewable |
| T-245-03 (a sensor ships unranked) | mitigated | Fail-closed `--check` gate, mutation-proven above with observed exit codes |
| T-245-04 (a stamp fault drops a reach) | mitigated | `stampSensorId` returns the ORIGINAL reach on a null rebuild or a bad id; the per-sensor try/catch is untouched |
| T-245-SC (supply chain) | not applicable | Zero package installs; `package.json` untouched |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern
and no schema change. Every byte it introduces is an in-repo frozen literal or a
pure array lookup.

## Known Stubs

None.

## Notes for the next plan

- `SENS-17` is deliberately absent from `SENS_PRIORITY`. 245-06 mints
  `sensorPerspectiveLock` as SENS-17; the moment it is appended to
  `SENSOR_REGISTRY` + `SENSOR_REGISTRY_IDS`, `--check` and
  `test-245-priority-complete` both go red until a rank is added. That is the
  gate working, not a break.
- 245-07 consumes `sensorPriorityRank(reach.evidence.sensor_id)` as the tie
  branch in `rankFiredCandidates`. Both inputs it needs now exist and are
  fenced.
- `node scripts/build-connector-registry.cjs --check` now emits Node's
  `ExperimentalWarning: SQLite is an experimental feature` on stderr, because
  the new gate requires `insight-sensors.cjs`, which pulls `node:sqlite`
  transitively. Exit code and stdout are unchanged. The dependent gates were
  re-run after the change: `doctor --acceptance` scores 14/16 with its
  `coverage-gate` point (which is the one that runs connector +
  orchestration-projection + render-coverage) PASSING. Its two failures are
  both pre-existing and unrelated: `verify-release-clean-tree` (the 1 tracked
  file drifting is `.planning/STATE.md`, modified by the orchestrator at phase
  start) and `eureka-fts-index-visible` (the two stale-index rooms already
  recorded in STATE.md against Phase 244, a navigator action item).
