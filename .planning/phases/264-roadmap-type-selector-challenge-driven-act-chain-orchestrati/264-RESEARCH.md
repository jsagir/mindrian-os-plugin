# Phase 264: Roadmap-Type Selector: challenge-driven act-chain orchestration for the research command family - Research

**Researched:** 2026-08-23
**Domain:** In-repo CJS orchestration substrate (sensor registry, command-resolver chain composition, chain-executor self-critique seam)
**Confidence:** HIGH (every finding below was verified by direct file read or by executing the shipped code in this session; zero training-data claims about this repo)

> **House rule honored:** hyphens only, no em-dashes, anywhere in this file.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `264-CONTEXT.md` `## Implementation Decisions`.

- **D-01:** The new sensor lives in its own standalone file,
  `lib/core/sensors/sensor-roadmap-type.cjs` -- NOT inline in `insight-sensors.cjs`. This is
  the actual convention (17 of 19 registered sensors are standalone files; the gray area's
  original premise that `sensorLaggingComponent`/`sensorDiffusionAdoption` are inline was
  wrong -- both are already standalone files). The header doctrine at
  `insight-sensors.cjs:56-59` states this as policy, and both safety fences
  (`tests/test-sensors-routing-fence.cjs`, `tests/test-sensors-part8-sweep.cjs`) enumerate
  `lib/core/sensors/*.cjs` from disk, so a standalone file ships born-covered.

- **D-02:** The classifier is a deterministic additive-score classifier, modeled on
  `lib/core/dual-path-detector.cjs`'s 5-feature scoring shape -- NOT any form of model/agent
  judgment call. `dispatchSensors` runs synchronously inside a 1200ms navigation budget and
  silently drops any sensor that returns a Promise. An LLM-judgment sensor is structurally
  impossible on this seam, not merely slower. Use word-boundary regexes
  (`sensorLaggingComponent`/`sensorCircularity`'s `/\b...\b/i` idiom), not raw `indexOf`
  substring matching.

- **D-03 (structural correction, not a preference):** A reach candidate is a frozen 6-key
  struct (`makeReach` in `lib/core/sensors/sensor-types.cjs:237-277` --
  `reach_id`/`posture`/`dispatch`/`companions`/`signal`/`evidence`; any other top-level key
  is dropped, `evidence` keeps only scalar values, `companions` keeps only strings). SPEC.md
  Requirement 3's "`suggested_chain` field" cannot be a new top-level key. The resolved chain
  array rides `companions`, while `evidence.roadmap_type` carries the closed 6-value enum for
  observability/logging. The consumer resolves the actual chain from
  `data/roadmap-type-chains.json` keyed by that enum, OR reads it straight off `companions`
  -- planner's call at plan-phase.

- **D-04:** `data/roadmap-type-chains.json` is a hand-authored flat map + a standalone drift
  test, mirroring the existing `data/dispatch-framework-map.json` precedent (`_note` key +
  literal map, `tests/test-dispatch-framework-map-drift.cjs`'s 87-line `check()`/exit-code
  idiom) -- NOT a generated file with a `build-*.cjs --check` pre-commit gate. New:
  `tests/test-roadmap-type-chains-drift.cjs` must be added to `tests/run-all-264.sh`
  explicitly.

- **D-05:** The drift/validator test checks every framework name against
  `command-resolver.cjs`'s `framework_index` (via `commandsForFramework`), NOT a separate
  `framework-names.json` allowlist -- a name can pass a bare-name allowlist and still degrade
  to `{command: null, optional: true}` at resolve time (`command-resolver.cjs:110-121`).

- **D-06:** Firing threshold follows the shipped single-hit tiered pattern (signal > context >
  keyword cascade, verbatim as `sensorDiffusionAdoption`/`sensorShowShare` already do) with
  `posture: 'hold'` absorbing the over-eagerness risk at the Decision-Gate layer -- NOT a
  corroboration/2-signal threshold.

- **D-07:** Negative-fixture discipline exceeds the SPEC's own 2-true-negative floor where
  cheap to do: add one near-miss negative containing a lexicon word in a non-research sense,
  plus the flat-scalar-evidence assertion (`test-show-share-sensor.cjs:62`'s Part-8 shape
  check).

- **D-08 (registration mechanics, not a preference):** Registration is a 3-array lockstep --
  `SENSOR_REGISTRY` (`insight-sensors.cjs:714`), `SENSOR_REGISTRY_IDS` (`:772`, index-parallel),
  and `SENS_PRIORITY` (`lib/core/sensors/sensor-priority.cjs:133`) -- all three in the SAME
  commit, or `scripts/build-connector-registry.cjs --check` and
  `tests/test-245-priority-complete.cjs` fail closed. Next free sensor id: `SENS-18`. Per
  Canon Part 11 R3, a lexical/keyword-fallback sensor cannot rank above navigator problem-state
  -- this sensor belongs in priority Group C/D, not Group A.

- **D-09:** The critic adapts `lib/core/bono/reviewer-governance.cjs`'s seam shape into a new
  sibling module (e.g. `lib/core/salient-governance.cjs`) with an RS-native rule table --
  NOT `debate-composition.cjs` or `persona-research.cjs`. `reviewer-governance.cjs` is the only
  one of the three that actually emits the `selfCritiqueFn(step, result) -> {passed, quality,
  violations}` contract chain-executor.cjs expects, and the only one already proven wired into
  a real chain (`grade-grant-examine.cjs:517`).

- **D-10:** NOT an N-skeptics-majority-refute panel. Take the skeptic count and refute
  threshold from `lib/core/eureka-critic.cjs:462-468`: *"EXACTLY two judgeFn calls (neutral,
  then adversarial), never a panel (a 9-judge panel delivered ~2.2 effective votes)"*, with ANY
  disagreement killing the candidate. This is orthogonal to `ralph_verify`'s own cap of 2,
  which governs step RE-RUNS, not judges-per-attempt.

- **D-11:** `chain.cjs`'s `chainRun` ALWAYS sets `roomDir` (`chain.cjs:269-270,290`), which
  forces `chain-executor.cjs`'s async `_runChainResilient` path (`chain-executor.cjs:455`) --
  and `_ralphSafeRetry` is called ONLY inside the SYNC `runChain` body (`:596`). `ralph_verify`
  is therefore INERT when invoked through the normal `chain_resolve`/`chain_run` MCP seam
  today. **Navigator-confirmed resolution:** this phase's flagship proof calls
  `chainExecutor.runChain()` DIRECTLY for the find-bottlenecks acceptance test -- mirroring the
  precedent at `debate-composition.cjs:367`. Zero changes to `chain-executor.cjs` or
  `chain.cjs`. Honest consequence: a navigator running the Technical Roadmap chain through the
  LIVE `chain_resolve -> chain_run` flow will NOT get `ralph_verify` benefits from this phase.

- **D-12:** `tests/test-201-bounded-retry.cjs` verified present on `HEAD`
  (`fix/part8-guard-in-mcp-handlers`); Requirement 5's regression gate has a real test to run.

- **D-13:** `argumentFromResult` (`hat-governance.cjs:243-251`) must NOT be reused as a
  drop-in critic for RS findings -- it returns `null` for a Reverse Salient finding's actual
  shape, which would make every candidate pass silently. The plan must author real field
  mapping in the new `salient-governance.cjs`.

- **D-14:** This session is bound to "dev repo only, no room" for the remainder of the
  conversation -- all Phase 264 work is git-tracked dev-repo state in `~/dev/MindrianOS-Plugin`.

### Claude's Discretion

- Exact `data/roadmap-type-chains.json` key naming (slug vs enum string) and whether
  `evidence.roadmap_type` carries the slug or the display name -- plan-phase's call, both are
  SPEC-compliant.
- Whether `salient-governance.cjs`'s rule table is authored inline or split into a fixture
  file -- follow whatever `reviewer-governance.cjs`'s own test suite already does.

### Deferred Ideas (OUT OF SCOPE)

- **Make `chain_run`'s async path (`_runChainResilient`) honor `ralph_verify`.** Explicitly out
  of THIS phase's SPEC.md boundaries; candidate for its own future phase.
- **Extend `ralph_verify` + a reused critic to the other five roadmap-type chains'**
  `find-connections`/`whitespace`/`find-analogies`/`build-thesis`/etc. steps. Flagship-first,
  generalize later.
- **The 4 deferred graph-edge classes named in the Brain migration payload** -- unrelated to
  this phase's code.
- Any change to `chain-executor.cjs`'s core loop/gate/stop-condition logic.
- Any new UI/reach-card rendering for a multi-step suggested chain.
- The research trail's "Brain graph as cultural memory" claim.
- Retroactive reclassification of past sessions.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

No `REQUIREMENTS.md` requirement IDs track this phase (it sits outside the v2.1.0 "Green the
Floor" milestone's ID scheme). The five locked requirements from `264-SPEC.md` are addressed
by number.

| ID | Description (abridged from SPEC.md) | Research Support |
|----|-------------------------------------|------------------|
| R1 | Output-shape classifier sensor: >=12 fixture utterances (2 per type + 2 true negatives) | F-01 (real sensor signature, corrects SPEC's `sensorX(context)`), F-02 (async drop proven empirically), F-03 (makeReach frozen struct), F-04 (SENS_PRIORITY placement mechanics), F-05 (verbatim `sensorDiffusionAdoption` template), F-16 (turn-stage eligibility trap) |
| R2 | `data/roadmap-type-chains.json` mapping six types to framework-NAME arrays, validated by `commandsForFramework` with zero dangling names | F-06 (live resolution of all six candidate chains, executed this session), F-07 (three chain-authoring traps: cmds[0] surprise, duplicate framework, no-framework command), F-08 (`dispatch-framework-map.json` + drift-test template read in full) |
| R3 | Sensor-to-`chain_resolve` wiring; candidate payload carries the resolvable chain | F-03 (frozen 6-key struct), F-09 (**the only shipped `companions` consumer ignores bare framework names** -- D-03's `companions` option is currently a dead wire), F-10 (`chainResolve` is a 1-line `composeWorkflow` wrapper; step objects are `{step, framework, command, optional}`) |
| R4 | Flagship `find-bottlenecks` step under `ralph_verify` with a real adversarial-panel critic | F-11 (`ralph_verify` fires ONLY on NON-material steps; `/mos:find-bottlenecks` is `autonomous_safe:true` so it qualifies), F-12 (**the critic must be SYNCHRONOUS**; `eureka-critic.cjs::runRubric` is `async` and cannot be reused as-is), F-13 (`reviewer-governance.cjs` exact contract), F-14 (`argumentFromResult` returns null for RS findings -- D-13 confirmed by direct read of both shapes), F-15 (`debate-composition.cjs:367` exact direct-`runChain` pattern) |
| R5 | B3 / Canon Part 3 compliance proven; `tests/run-all-166.sh` passes unmodified | F-17 (`tests/test-201-bounded-retry.cjs` is the exact assertion template), F-18 (`run-all-158.sh:187-188` is the shipped precedent for embedding another `run-all-*.sh` as a regression gate), F-19 (`run-all-166.sh` invokes suites with bare `node`, not `node --test`) |

</phase_requirements>

---

## Summary

This phase touches no external dependency. Every mechanism it needs is already on disk in this
repo, and every claim below was verified by reading the actual file or by executing the shipped
code in this session. That makes the research unusually high-confidence, and it shifts the risk
from "do we know the library" to "do we know the exact seam contracts". This document is
therefore mechanics-first: it names the exact function signatures, the exact struct shapes, and
the six places where a reasonable-looking implementation would silently do nothing.

Three findings materially change what the plan must say, beyond what CONTEXT.md already locked.
**First (F-12), the adversarial critic must be synchronous.** `chain-executor.cjs` calls
`selfCritiqueFn(step, result)` inside a synchronous `while` loop and never awaits it; a Promise
verdict is truthy but has neither `.passed === false` nor `.quality === 'low'`, so
`_critiqueFailed` returns false and **every candidate silently passes** - the same false-success
bug class D-13 flags and the same one already on this repo's watch list. `eureka-critic.cjs`'s
2-judge harness (`runRubric`) is `async function` and `await`s `judgeFn` twice, so D-10's
"reuse the 2-judge ruling" must be read as *reuse the RULING (two passes, unanimity required),
not the FUNCTION*. **Second (F-09), D-03's `companions` route is currently a dead wire.** The
only shipped consumer of `reach.companions` (`lib/brain/chain-recommender.cjs::parseChainCompanions`)
skips any companion string that is not `brain_framework_chain:`-prefixed, and deliberately
ignores the third `:<framework>` segment where framework names would live. Bare framework-name
strings on `companions` reach nobody. **Third (F-07), three of the six roadmap chains as drafted
in the research trail do not resolve the way the trail assumes** - `whitespace` resolves to
`/mos:diagnostics`, `present` has no framework name at all, and the Vision Paper chain contains
the same framework name twice.

The good news is that the flagship proof (Requirement 4) is genuinely reachable.
`/mos:find-bottlenecks` is `autonomous_safe: true` in `data/command-registry.json`, which makes
`_isMaterialStep` return false, which is the exact precondition `_ralphSafeRetry` requires. The
Technical Roadmap chain's three frameworks all resolve cleanly and all three commands are
autonomous-safe, so `validateChainAutonomy` returns `runnable: true`. `tests/test-201-bounded-retry.cjs`
already contains, assertion for assertion, the harness Requirement 4 and Requirement 5 need.

**Primary recommendation:** Build the sensor as a verbatim structural clone of
`lib/core/sensors/sensor-diffusion-adoption.cjs` (signal/context/keyword/marker cascade,
`makeReach` return, flat-scalar `evidence`), place `SENS-18` in `SENS_PRIORITY` Group C
immediately before `SENS-16`, author the chain table against the corrected framework names in
F-06, carry the roadmap type on `evidence.roadmap_type` as the load-bearing field (treat
`companions` as observability-only until a consumer exists), write the critic as a **pure
synchronous** two-pass function in a new `lib/core/salient-governance.cjs` with hand-authored RS
field mapping, and prove Requirement 4 with a direct synchronous `runChain()` call cloned from
`tests/test-201-bounded-retry.cjs`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classify a turn into 1-of-6 roadmap types | Sensor layer (`lib/core/sensors/`) | - | `dispatchSensors` is the ONE shipped reach-candidate seam; a second classifier would be a second selection brain (Canon Part 7, connector-spine doctrine) |
| Hold the six type-to-chain mappings | Committed data (`data/`) | Drift test (`tests/`) | Mirrors `dispatch-framework-map.json`; the data is the contract, the test is the fence |
| Turn framework names into commands | Resolver (`lib/workflow/command-resolver.cjs`) | - | "The resolver is the only door" doctrine; the sensor must never name a command directly |
| Decide autonomy of a step | `lib/core/recipe-maps.cjs::postureForCommand` | `command-resolver.cjs::validateChainAutonomy` | The ONE autonomy authority (Phase 237-02 fence, `tests/test-237-one-authority-fence.cjs`) |
| Execute the chain and halt at the gate | `lib/core/chain-executor.cjs::runChain` (SYNC path) | - | Out of scope to modify; this phase is a CALLER only |
| Adversarially critique an RS finding | New sibling `lib/core/salient-governance.cjs` | `lib/core/bono/reviewer-governance.cjs` (shape donor) | RS is not a BONO subsystem; the seam shape is reused, the rule table is net-new |
| Prove B3 is intact | `tests/run-all-264.sh` | `tests/run-all-166.sh` (embedded) | Requirement 5 explicitly demands the 166 suite as a regression gate |

---

## Project Constraints (from CLAUDE.md)

Actionable directives extracted from `./CLAUDE.md` and its four `@include` files. These carry
the same authority as CONTEXT.md's locked decisions.

| # | Directive | Where it bites in Phase 264 |
|---|-----------|------------------------------|
| C-01 | **No em-dashes anywhere; hyphens only.** | Every new `.cjs`, `.json` `_note`, `.sh` file. `run-all-259.sh` and `run-all-166.sh` both ship a self-referential em-dash sweep; `run-all-264.sh` should carry one for its own touched files. |
| C-02 | **CJS only, no TypeScript.** `lib/core/*.cjs` ships as source. | New sensor, new critic module, new tests are all `.cjs`. |
| C-03 | **CLI entry points parse `process.argv` with a switch-case router; no Commander/yargs.** | Not applicable (no new CLI entry point in this phase). |
| C-04 | **Canon Part 8 - Graph Boundary.** User data NEVER egresses to the Brain; only generic methodology handles cross. | The sensor's `evidence` must be flat scalars/enums only; the critic must not read room prose. `tests/test-sensors-part8-sweep.cjs` enforces this on `lib/core/sensors/*.cjs` automatically. |
| C-05 | **Canon Part 3 - Tri-Context Decision Gate.** Material choices halt. | Zero cross-step convergence logic. This IS SPEC Requirement 5. |
| C-06 | **Canon Part 7 - Reuse Before Build.** | The sensor reuses the `sensorX` contract, the critic reuses the `selfCritiqueFn` shape, the chain table reuses the `dispatch-framework-map.json` idiom. |
| C-07 | **Canon Part 11 R1/R2 - born WIRED or EXCLUDED.** The born-wired gate fails the build closed. | `node scripts/build-connector-registry.cjs --check` must pass after the 3-array lockstep lands. |
| C-08 | **Canon Part 11 R3 - sensor priority tiers.** A lexical/keyword-fallback trigger cannot rank above navigator problem-state. | `SENS-18` goes in Group C or D of `SENS_PRIORITY`, never Group A. |
| C-09 | **Tri-Polar Design Rule** (CLI / Desktop / Cowork). | This phase is backend-only CJS shared core, so all three surfaces are served identically. State this explicitly rather than skipping it. |
| C-10 | **Run the relevant suite after edits, before declaring a task done.** | `bash tests/run-all-264.sh`, `node scripts/build-connector-registry.cjs --check`, `node scripts/doctor.cjs --acceptance`. |
| C-11 | **Dev-Research Compositing.** Every GSD phase touching MindrianOS's own architecture files research in BOTH `.planning/phases/` AND `~/MindrianRooms/rethinking-mindrianos/research/`. | This RESEARCH.md should be cross-linked from the existing `2026-08-23-scientific-roadmapping-orchestrator` room entry when the phase closes. |
| C-12 | **GSD Workflow Enforcement.** No direct repo edits outside a GSD workflow. | Execution must run through `/gsd-execute-phase`. |
| C-13 | **Consult ALL relevant grounding sources.** | See Open Question OQ-04 - the langtalks leg was not reachable from this agent's tool surface. |
| C-14 | **Every directory gets a `ROOM.md`.** | `data/` already has one; no new directories are created by this phase. |

---

## Standard Stack

### Core

**No new packages. This phase adds zero dependencies.** Every mechanism is an existing in-repo
module.

| Module | Purpose | Why standard |
|--------|---------|--------------|
| `lib/core/sensors/sensor-types.cjs` | `makeReach` frozen 6-key struct factory + `classifyTriggerTier` | The ONE candidate-reach contract; every sensor returns through it [VERIFIED: read in full, lines 200-294] |
| `lib/core/insight-sensors.cjs` | `SENSOR_REGISTRY` / `SENSOR_REGISTRY_IDS` / `dispatchSensors` | The ONE reach-candidate dispatch chokepoint [VERIFIED: read lines 40-80, 700-800, 860-940] |
| `lib/core/sensors/sensor-priority.cjs` | `SENS_PRIORITY` doctrine table | The ONE same-reach collision tiebreak [VERIFIED: read in full, 181 lines] |
| `lib/workflow/command-resolver.cjs` | `commandsForFramework`, `composeWorkflow`, `validateChainAutonomy` | "The resolver is the only door" [VERIFIED: read in full, 155 lines] |
| `lib/core/chain-executor.cjs` | `runChain` (sync), `_ralphSafeRetry`, `_applySelfCritique` | The ONE chain execution seam; read-only for this phase [VERIFIED: read lines 185-330, 410-480, 560-650] |
| `lib/core/bono/reviewer-governance.cjs` | `composeReviewerGovernedSeams` shape donor | The only shipped module emitting the exact `selfCritiqueFn` contract [VERIFIED: read in full, 331 lines] |
| `lib/core/dual-path-detector.cjs` | Additive-score classifier template | 5-feature scoring shape D-02 names [VERIFIED: read in full, 84 lines] |
| `node:fs`, `node:path`, `node:crypto`, `node:assert/strict` | Node built-ins | The only requires the sensor layer permits |

### Supporting (read-only reference, not modified)

| Module | Purpose |
|--------|---------|
| `data/command-registry.json` | `framework_index` (28 names) + `commands` (113 entries) with `autonomous_safe` flags |
| `data/dispatch-framework-map.json` | The 18-line hand-authored map this phase's chain table mirrors |
| `lib/core/recipe-maps.cjs::postureForCommand` | The ONE autonomy authority |
| `lib/brain/chain-recommender.cjs::parseChainCompanions` | The only shipped `companions` consumer (see F-09) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new standalone sensor file | An inline function in `insight-sensors.cjs` | Rejected by D-01. Also loses automatic coverage: both safety fences enumerate `lib/core/sensors/*.cjs` from disk, so a standalone file is born-covered while an inline one is not. |
| Hand-authored `roadmap-type-chains.json` | A `scripts/build-roadmap-type-chains.cjs --check` generator | Rejected by D-04. There is no frontmatter source of truth to generate FROM. |
| A new `lib/core/salient-governance.cjs` | Reusing `hat-governance.cjs::composeGovernedSeams` directly | Rejected by D-13 and confirmed in F-14: `argumentFromResult` returns `null` for the RS finding shape, and a `null` argument makes `selfCritiqueFn` return `{passed: true}` unconditionally. |
| Direct synchronous `runChain()` for the flagship proof | Going through `chain_run`'s MCP tool | Rejected by D-11 and confirmed in F-11: `chainRun` always forces the async path, AND never passes a `selfCritiqueFn` at all. |

**Installation:** none. `npm install` adds nothing for this phase.

---

## Package Legitimacy Audit

**Not applicable: this phase installs zero external packages.**

Verified by reading `264-SPEC.md`'s Boundaries (all in-scope items are in-repo files) and by
confirming every module named in the Standard Stack table already exists on disk in this
working tree. `slopcheck` was therefore not run: there is no package name to check. If the
planner introduces a package during plan-phase, this section must be re-run before that
package is installed.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | - | N/A - phase adds no dependencies |

---

## Architecture Patterns

### System Architecture Diagram

```
  navigator turn text
         |
         v
  +----------------------------+
  | navigation.cjs chokepoint  |  populates tuple.problem_type + ctx enums
  +----------------------------+
         |
         v
  +----------------------------+
  | dispatchSensors(turn,      |  SYNCHRONOUS. iterates SENSOR_REGISTRY in order.
  |   tuple, ctx)              |  a Promise return is silently dropped (F-02).
  +----------------------------+
         |
         |  for each sensor i:  sensor(normalizedTurn, tuple, ctx) -> reach|null
         |
         v
  +----------------------------+
  | sensorRoadmapType   NEW    |  cascade: signal > context > keyword (D-06)
  | (SENS-18)                  |  returns makeReach({ reach_id, posture:'hold',
  +----------------------------+                      dispatch, companions,
         |                                            signal, evidence })
         |  reach.evidence.roadmap_type = one of 6 enum values   <-- LOAD-BEARING
         |  reach.companions = [framework names]                 <-- OBSERVABILITY ONLY (F-09)
         v
  +----------------------------+
  | REACH_IDS membership check |  drops anything whose reach_id is not in the frozen 6
  | + isReachEligibleForTurn   |  drops brain_consult / deep_research on turns 1-2 (F-16!)
  | + stampSensorId            |  writes evidence.sensor_id = 'SENS-18'
  +----------------------------+
         |
         v
  +----------------------------+
  | decide() / reach-hedge-    |  SENS_PRIORITY breaks same-reach collisions
  | ranker  (SENS_PRIORITY)    |
  +----------------------------+
         |
         v  navigator approves the reach at a Decision Gate
         |
  +----------------------------+
  | data/roadmap-type-chains   |  roadmap_type enum -> ordered framework-NAME array
  | .json               NEW    |  drift-tested against framework_index (D-05)
  +----------------------------+
         |
         v
  +----------------------------+
  | chain_resolve  ==          |  returns [{ step, framework, command|null, optional }]
  | composeWorkflow(names)     |  cmds[0] per framework (F-07 trap lives here)
  +----------------------------+
         |
         +--------------------------------+--------------------------------+
         |                                                                 |
         v  LIVE PATH (unchanged)                       v  FLAGSHIP PROOF PATH (this phase)
  +----------------------------+                 +--------------------------------------+
  | chain_run (MCP)            |                 | chainExecutor.runChain(steps, {      |
  |  -> always sets roomDir    |                 |    postureFn, onStep,                |
  |  -> _runChainResilient     |                 |    selfCritiqueFn, onHalt })         |
  |     (ASYNC)                |                 |  NO roomDir/journal/retries/resume/  |
  |  ralph_verify INERT (D-11) |                 |  sleep  ==> SYNC path                |
  +----------------------------+                 +--------------------------------------+
                                                          |
                                                          v  step.ralph_verify === true
                                                             AND selfCritiqueFn present
                                                             AND !_isMaterialStep(step,posture)
                                                  +--------------------------------------+
                                                  | _ralphSafeRetry                      |
                                                  |  cap = min(2, budgetRemaining)       |
                                                  |  loop: critique -> re-run onStep     |
                                                  |  exhausted -> quality = 'low'        |
                                                  |            -> haltedAt.reason =      |
                                                  |               retry_exhausted |      |
                                                  |               budget_brake           |
                                                  +--------------------------------------+
                                                          |
                                                          v  calls (SYNCHRONOUSLY)
                                                  +--------------------------------------+
                                                  | salient-governance.cjs        NEW    |
                                                  |  selfCritiqueFn(step, result)        |
                                                  |   1. findingFromResult(result)       |
                                                  |      (NEW - argumentFromResult       |
                                                  |       returns null here, F-14)       |
                                                  |   2. neutral pass  -> violations[]   |
                                                  |   3. adversarial pass -> violations[]|
                                                  |   4. ANY disagreement => fail (D-10) |
                                                  |  returns { passed, quality,          |
                                                  |            violations } SYNCHRONOUSLY|
                                                  +--------------------------------------+
```

### Recommended Project Structure

```
lib/core/sensors/
  sensor-roadmap-type.cjs         NEW   SENS-18, the 1-of-6 classifier
  sensor-priority.cjs             EDIT  add 'SENS-18' to Group C (before 'SENS-16')
lib/core/
  insight-sensors.cjs             EDIT  3 edits: require, SENSOR_REGISTRY, SENSOR_REGISTRY_IDS,
                                        plus module.exports entry
  salient-governance.cjs          NEW   the synchronous RS adversarial critic
data/
  roadmap-type-chains.json        NEW   6 roadmap types -> framework-name arrays
tests/
  test-roadmap-type-sensor.cjs    NEW   >=12 fixture utterances + Part-8 shape check
  test-roadmap-type-chains-drift.cjs  NEW   framework_index validation (D-05)
  test-264-salient-critic.cjs     NEW   critic unit tests incl. the sync contract
  test-264-flagship-ralph.cjs     NEW   direct runChain() proof (Requirement 4 + 5)
  run-all-264.sh                  NEW   aggregator, embeds run-all-166.sh
```

### Pattern 1: The sensor cascade (D-02 + D-06), verbatim from the shipped template

`lib/core/sensors/sensor-diffusion-adoption.cjs` is the closest structural match and should be
cloned almost line for line. Its cascade at `:181-224`:

```javascript
function sensorDiffusionAdoption(turn, tuple, ctx) {
  let mode = '';
  if (hasDiffusionSignal(turn))      mode = 'signal';
  else if (hasDiffusionContext(tuple)) mode = 'context';
  else if (textMatchesLexicon(turn)) mode = 'keyword';
  else if (hasFreshMarker(ctx))      mode = 'marker';
  if (!mode) return null;

  const pt = problemTypeOf(tuple);
  let trigger_tier = null;
  try { trigger_tier = classifyTriggerTier(turn, tuple, ctx); }
  catch (_e) { trigger_tier = null; }

  return makeReach({
    reach_id: 'brain_consult',
    posture: 'push_forward',
    dispatch: 'adoption-capacity',
    companions: ['brain_framework_chain:adoption-capacity'],
    signal: 'diffusion_detected',
    evidence: { framework: 'adoption-capacity', mode, trigger_tier, problem_type: pt },
  });
}
```
Source: `lib/core/sensors/sensor-diffusion-adoption.cjs:181-224` [VERIFIED: read in full]

**What Phase 264 changes from this template:** `posture: 'hold'` (D-06), a `roadmap_type` enum
in `evidence`, and word-boundary regexes instead of `indexOf` (D-02). Note that this very file
carries the `indexOf` over-fire bug D-02 warns about: `DIFFUSION_LEXICON` contains `'laws'`,
which `indexOf` matches inside `'flaws'` [VERIFIED: line 68, `textMatchesLexicon` at :105-112].

### Pattern 2: The synchronous `selfCritiqueFn` contract

```javascript
function selfCritiqueFn(step, result) {
  const category = hatGovernance.hatForStep(step);
  const argument = hatGovernance.argumentFromResult(result);
  if (!category || !argument) {
    const q = (result && typeof result === 'object' && result.quality) ? result.quality : 'high';
    return { passed: true, quality: q };          // <-- the silent-pass branch (D-13's trap)
  }
  const verdict = enforceReviewerGovernance(category, argument);
  if (!verdict.ok) return { passed: false, quality: 'low', violations: verdict.violations };
  return { passed: true, quality: 'high' };
}
```
Source: `lib/core/bono/reviewer-governance.cjs:292-305` [VERIFIED: read in full]

**Note the return type: a plain object, never a Promise.** See F-12 for why this is
load-bearing rather than stylistic.

### Pattern 3: The direct synchronous `runChain()` call (D-11's named precedent)

```javascript
const chain = runChainFn(steps, {
  postureFn: resolvedPostureFn,
  gateFn: gateFn,
  onStep: onStep,
  provenanceFn: provenanceFn,
  onHalt: resolvedOnHalt,
  selfCritiqueFn: selfCritiqueFn,
  seedPreviousOutput: { kind: 'cells', cells: cells },
});
```
Source: `lib/core/bono/debate-composition.cjs:367-375` [VERIFIED: read directly]

The load-bearing property is what is **absent**: no `roomDir`, no `journal`, no `retries`, no
`resume`, no `sleep`. `runChain`'s dispatch branch at `chain-executor.cjs:448-456` routes to
`_runChainResilient` if ANY of those five is present. Omitting all five keeps the call on the
synchronous path where `_ralphSafeRetry` lives.

The same file also shows the injected-`postureFn` idiom for controlling which steps are material
(`debate-composition.cjs:344-349`):
```javascript
function defaultPostureFn(command) {
  if (command === HYPOTHESIS_STEP || command === RULING_STEP) {
    return { command: command, autonomous_safe: false, posture: 'halt' };
  }
  return { command: command, autonomous_safe: true, posture: 'run' };
}
```

### Anti-Patterns to Avoid

- **Returning a Promise from the sensor.** Silently dropped, no error. Proven empirically in F-02.
- **Returning a Promise from `selfCritiqueFn`.** Silently treated as a PASS. See F-12.
- **Adding a top-level key to the reach struct.** `makeReach` drops it. See F-03.
- **Putting a non-scalar in `evidence`.** `makeReach` drops it silently (`sensor-types.cjs:258-267`).
- **Reading `connector.posture` as an autonomy answer.** Structurally fenced by
  `tests/test-237-one-authority-fence.cjs`; `chain.cjs`'s header calls this out as a category error.
- **Naming a command directly in the chain table.** The table holds framework NAMES; the resolver
  is the only door.
- **Assuming `commandsForFramework(name)[0]` is the command you meant.** See F-07.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Framework name -> command | Any direct lookup into `command-registry.json` | `command-resolver.cjs::commandsForFramework` / `composeWorkflow` | "The resolver is the only door"; a direct read bypasses the degrade-not-fabricate contract |
| Is this step autonomous | A local `autonomous_safe` read | `recipe-maps.cjs::postureForCommand` | Phase 237-02 measured 48/112 commands disagreeing between two authorities; a source fence now forbids a second one |
| Candidate reach construction | A hand-built object literal | `sensor-types.cjs::makeReach` | Freezes the struct, filters `companions` to strings, filters `evidence` to scalars - the Part-8 guarantee is IN the factory |
| Bounded retry-with-critique | A `while` loop in the new critic | `chain-executor.cjs::_ralphSafeRetry` via `step.ralph_verify: true` | Bounded twice (cap AND EXEC-06 budget), emits distinct `retry_exhausted` vs `budget_brake` halt reasons, B3-compliant by construction |
| Sensor id -> priority rank | An `indexOf` in the new sensor | `sensor-priority.cjs::sensorPriorityRank` | Defensive: unknown id returns `SENS_PRIORITY.length`, never `-1`/`Infinity`/`NaN`, so a comparator cannot silently corrupt a sort |
| Drift/validation test scaffolding | A bespoke assertion runner | `tests/test-dispatch-framework-map-drift.cjs`'s `check(cond, msg)` + exit-code idiom | 87 lines, already the house pattern for a data-file-vs-frozen-source pin |
| Panel size / refute threshold | A fresh N-judge design | The 2-pass unanimous ruling at `eureka-critic.cjs:462-468` | Already ruled empirically IN THIS REPO: a 9-judge panel delivered ~2.2 effective votes |
| Test aggregator | A fresh bash harness | `tests/run-all-259.sh` (glob style) or `tests/run-all-166.sh` (explicit-list style) | Both ship the found-eq-0 guard and the self-referential em-dash fence |

**Key insight:** In this repo the seam contracts are where the bugs live, not the algorithms.
Six of the eight rows above exist because a plausible hand-rolled version fails *silently*
rather than loudly. The house discipline is soft-fail everywhere (a throwing sensor "did not
fire", a throwing critic "fails open"), which is correct for resilience and hostile to
debugging. Every new surface this phase adds must therefore be pinned by a test that asserts the
positive behavior, because the absence of an error proves nothing here.

---

## Common Pitfalls

### Pitfall 1: An async critic makes every candidate pass silently (F-12)

**What goes wrong:** `selfCritiqueFn` returns a Promise. `_critiqueFailed(verdict)` evaluates
`verdict.quality === 'low' || verdict.passed === false` against a Promise object; both are
`undefined`, so it returns `false`, so the retry loop never runs and the step proceeds at its
original quality. The adversarial critic is inert and nothing reports an error.

**Why it happens:** D-10 says to reuse `eureka-critic.cjs:462-468`'s ruling. That function,
`runRubric`, is declared `async function runRubric(candidate, opts)` and contains
`await judgeFn(buildNeutralPrompt(candidate))` and `await judgeFn(buildAdversarialPrompt(candidate))`
[VERIFIED: `lib/core/eureka-critic.cjs:469-503`]. A copy-paste reuse produces an async critic.

**How to avoid:** Reuse the *ruling* (exactly two passes, any disagreement kills the candidate),
not the *function*. The new `salient-governance.cjs` must be pure and synchronous, exactly like
`enforceReviewerGovernance` (a mechanical validator over an already-materialized structured
shape, no I/O, no model call). If a model judgment is ever wanted, it must be produced upstream
by `onStep` and land on `result.chain_output` before the critic runs.

**Warning signs:** the word `async` or `await` anywhere in `salient-governance.cjs`; a test that
passes but never observes `haltedAt.reason === 'retry_exhausted'`.

**Suggested fence:** add an assertion to `tests/test-264-salient-critic.cjs` that
`typeof selfCritiqueFn(step, result).then !== 'function'` - the same CR-01 thenable-never-escapes
discipline `hat-governance.cjs:299-300` already applies to `deriveFn`.

### Pitfall 2: `argumentFromResult` returns null for RS findings, so the critic passes everything (F-14, confirms D-13)

**What goes wrong:** The natural reuse is
`const argument = hatGovernance.argumentFromResult(result)`. For a Reverse Salient finding it
returns `null`, and both shipped `selfCritiqueFn`s then take the pass-through branch
`return { passed: true, quality: q }`.

**Why it happens, proven by reading both shapes:**

`argumentFromResult` (`hat-governance.cjs:243-251`) returns non-null only when
`result.chain_output` is an object AND (`chain_output.argument` is an object OR
`typeof chain_output.stance === 'string'` OR `Array.isArray(chain_output.evidence)`).

The RS finding (`lib/agents/reverse-salient-agent.cjs:260-269`, note the corrected path) is:
```javascript
return {
  id,                       // sha256(source|target|direction).slice(0,32)
  source_artifact_id,       // string
  target_artifact_id,       // string
  direction,                // string
  signed_diff,              // number
  abs_diff,                 // number
  body_text,                // composed prose string
  brain_chain_text,         // string, possibly ''
};
```
No `argument`, no `stance`, no `evidence` array. All three predicates fail. Returns `null`.

**How to avoid:** author `findingFromResult(result)` in `salient-governance.cjs` mapping the
eight real fields above, and make the "nothing to critique" branch return
`{ passed: false, quality: 'low', violations: ['rs_finding_unrecognized'] }` rather than the
BONO modules' `{ passed: true }`. A critic that cannot parse its input should fail the
candidate, not wave it through - the opposite of the BONO default, and the right call here
because this repo's own watch list names silent false-success as a recurring bug class.

**Warning signs:** a fixture with a deliberately malformed finding that still reports `completed: true`.

### Pitfall 3: The chain table's framework names do not resolve to the commands the research trail names (F-07)

**What goes wrong:** `composeWorkflow` takes `commandsForFramework(fw)[0]`. Three of the six
drafted chains produce a different command than intended.

| Trail says | Framework name | `composeWorkflow` actually yields |
|------------|----------------|-----------------------------------|
| `whitespace` | HSI Semantic Surprise Analysis Assistant | **`/mos:diagnostics`** (the framework has 3 commands: `/mos:diagnostics`, `/mos:score-innovation`, `/mos:whitespace`; `[0]` wins) |
| `structure-argument` | The Pyramid Principle | **`/mos:mos-reason`** (use `MECE (Mutually Exclusive, Collectively Exhaustive)` instead to get `/mos:structure-argument`) |
| `present` | (none) | `/mos:present` has **no `frameworks` entry at all**, so it cannot be named in a framework-name chain |
| `scenario-plan` + `explore-futures` | Scenario Planning (both) | The same framework name twice, both resolving to `/mos:explore-futures` - a duplicate step |

**How to avoid:** author the table against F-06's verified resolutions, and add a drift-test arm
asserting **no duplicate framework name within a single chain** (beyond D-05's dangling-name
check). The SPEC's acceptance only forbids `command: null` on a required step, so a duplicate
would pass the letter of the acceptance while shipping a nonsense chain.

### Pitfall 4: `ralph_verify` never fires because the step is material (F-11)

**What goes wrong:** The opt-in branch at `chain-executor.cjs:591-592` requires
`!_isMaterialStep(step, posture)`. A step is material if it is irreversible, if
`step.material === true`, or if `posture.posture !== 'run'`. An **absent** posture is treated as
uncertain and therefore material (withhold-default). So a step object composed without a
resolvable posture never retries.

**How to avoid:** `/mos:find-bottlenecks` is `autonomous_safe: true` in
`data/command-registry.json` [VERIFIED: read directly], so the shipped `_defaultPostureFn` gives
it `posture: 'run'` and the branch fires. But if the flagship test injects its own `postureFn`
(as `test-201-bounded-retry.cjs` does), it must return `{ autonomous_safe: true, posture: 'run' }`.
Also confirm the step command contains none of the frozen `IRREVERSIBLE_HINTS`
(`email`, `deploy`, `publish`, `send`, `release`, `external-write`, `external_write`) -
`find-bottlenecks` contains none [VERIFIED: `chain-executor.cjs:196-204`].

**Warning signs:** `onStep.count() === 1` in a test that expected retries;
`haltedAt.reason === 'forced_material'`.

### Pitfall 5: The reach is dropped on turns 1-2 by the turn-stage gate (F-16)

**What goes wrong:** `dispatchSensors` filters the emitted reaches through
`isReachEligibleForTurn(reach.reach_id, turnCount)`. `brain_consult` and `deep_research` are
suppressed when `turnCount < 3` [VERIFIED: `insight-sensors.cjs:509-528`]. A navigator stating a
research goal usually does so in the first turn or two - exactly when those two reach ids are
gated off.

**How to avoid:** choose `context_block` (never suppressed) as the sensor's `reach_id` unless
there is a strong reason to use a deep reach; if a deep reach is chosen, the fixture tests must
set `turn_count >= 3` and the plan must state the early-turn silence as an accepted consequence.
Note that `turnCountOf` returns `undefined` when neither `turn.turn_count` nor `ctx.turn_count`
is a finite number, and an absent counter is a **no-op** (eligible), so a naive test that omits
`turn_count` will pass while production silently drops the reach.

### Pitfall 6: The 3-array lockstep is enforced by two gates that both fail closed (D-08)

**What goes wrong:** adding `sensorRoadmapType` to `SENSOR_REGISTRY` without the matching
`SENSOR_REGISTRY_IDS` entry and the `SENS_PRIORITY` entry reddens
`node scripts/build-connector-registry.cjs --check` (a release/commit gate) and
`node tests/test-245-priority-complete.cjs` (a phase-suite gate). This is deliberate double
pinning [VERIFIED: `tests/test-245-priority-complete.cjs:8-19` states the rationale explicitly].

**How to avoid:** treat the three edits as one atomic task in the plan, never three.

### Pitfall 7: The Part-8 sweep forbids `sha256`/`createHash` in the sensor directory

**What goes wrong:** if the sensor wants a deterministic id (the RS agent's idiom),
`tests/test-sensors-part8-sweep.cjs` tripwire (3) fails the build on any unmarked
`sha256`/`createHash` call site under `lib/core/sensors/`.

**How to avoid:** do not hash in the sensor. If unavoidable, the documented exception requires
the literal marker `PART8-SAFE-HASH` on the call line or the line immediately before, plus a
human-authored comment explaining why the hash input is never user content (see
`lib/core/sensors/sensor-url-ingest.cjs` for the shipped example) [VERIFIED: read
`tests/test-sensors-part8-sweep.cjs:1-50`].

---

## Code Examples

### F-01: The real sensor signature (SPEC.md's `sensorX(context)` is wrong)

`264-SPEC.md` Requirement 1 and Constraints both write the contract as
`sensorX(context) -> candidate|null`. The shipped contract is **three arguments**:

```javascript
reach = sensor(normalized, tuple, ctx);
```
Source: `lib/core/insight-sensors.cjs:894` inside `dispatchSensors` [VERIFIED: read directly]

`insight-sensors.cjs:712` states it as doctrine: *"each entry is a
`sensorFn(turn, tuple, ctx) -> candidate-reach|null`"*. The planner must write the new sensor
with three parameters. This is a documentation error in SPEC.md, not a design choice; it does
not change any locked decision.

### F-02: An async sensor is dropped silently (D-02 confirmed empirically)

Executed in this session against the live tree:

```javascript
const s = require('./lib/core/insight-sensors.cjs');
s.SENSOR_REGISTRY.push(async function fake() {
  return { reach_id: 'context_block', posture: 'hold', dispatch: 'x',
           companions: [], signal: 's', evidence: {} };
});
const out = s.dispatchSensors({ text: 'hello world', signals: [], turn_count: 5 }, {}, {});
// => async sensor dropped silently: true | reaches fired: 0
```

The mechanism is `insight-sensors.cjs:897`:
`if (reach && typeof reach === 'object' && REACH_IDS.indexOf(reach.reach_id) !== -1)`. A Promise
satisfies `typeof === 'object'` but `promise.reach_id` is `undefined`, so
`REACH_IDS.indexOf(undefined) === -1` and the reach is skipped. No throw, no log. [VERIFIED:
executed]

### F-03: `makeReach` is the frozen 6-key struct (D-03 confirmed)

```javascript
const companions = Array.isArray(opts.companions)
  ? opts.companions.filter(function (c) { return typeof c === 'string'; })
  : [];

const evidence = {};
if (opts.evidence && typeof opts.evidence === 'object' && !Array.isArray(opts.evidence)) {
  for (const k of Object.keys(opts.evidence)) {
    const v = opts.evidence[k];
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') evidence[k] = v;
  }
}

return Object.freeze({
  reach_id, posture, dispatch,
  companions: Object.freeze(companions),
  signal,
  evidence: Object.freeze(evidence),
});
```
Source: `lib/core/sensors/sensor-types.cjs:252-277` [VERIFIED: read in full]

Exact field types for D-03's two carriers:
- `companions`: `Readonly<string[]>`. Non-strings are filtered out. No length limit, no format
  check. `null` and `undefined` elements are dropped.
- `evidence`: `Readonly<Record<string, string|number|boolean>>`. Note that `null` is **dropped**
  (`typeof null === 'object'`), which matters because `sensorDiffusionAdoption` passes
  `trigger_tier: null` on the soft-fail path and that key therefore silently vanishes from the
  struct. `test-show-share-sensor.cjs:58-62` accounts for this by allowing `v === null` in its
  scalar assertion.

Valid `reach_id` values (frozen, exactly 6): `context_block`, `contradiction`, `cross_room`,
`brain_consult`, `deep_research`, `hats`. Valid `posture` values (frozen, exactly 3):
`push_forward`, `hold`, `pull_back`. `makeReach` returns `null` (never throws) if either is
outside its bank [VERIFIED: `sensor-types.cjs:43-58, 243-244`].

### F-04: Exact `SENS_PRIORITY` placement for a Group C/D lexical-fallback sensor

The table is a flat frozen array of id strings with group comments. The relevant tail:

```javascript
  // Group C -- derived / reweighted intent signals
  'SENS-05',
  'SENS-04',
  'SENS-09',
  'SENS-SHOW',
  // Group D -- the FALLBACK lexical tier (last by doctrine, Canon Part 11 R3)
  'SENS-16',
]);
```
Source: `lib/core/sensors/sensor-priority.cjs:150-157` [VERIFIED: read in full, 181 lines]

There is no object, no rank number, no metadata: **an entry is a bare quoted string on its own
line, comma-terminated.** The array index IS the rank (index 0 = highest).

**Recommended placement:** `'SENS-18',` as the last line of Group C, immediately after
`'SENS-SHOW',` and immediately before the `// Group D` comment. Rationale from the file's own
stated ordering rules (`:26-47`): rule 1 (Canon Part 11 R3 trigger-tier precedence) puts a
sensor that can fire on a lexical match below every context-tier sensor. But this sensor is not
a *pure* fallback-tier member the way SENS-16 is - D-06's cascade means it fires on `signal` and
`context` tiers first and only falls back to `keyword`. SENS-16 is documented as *"the only pure
FALLBACK-tier member of the registry"* (`:35-37`), so placing SENS-18 in Group D would either
displace that claim or require amending the comment. Group C's own description ("derived /
reweighted intent signals... recomputed from other signals rather than carrying independent
evidence") fits a classifier over turn text plus problem-state enums.

The planner must also update the prose comment block at `:120-132` to name SENS-18 in the Group
C list, since the block enumerates every member by hand.

**Also required in the same commit** (D-08): `SENSOR_REGISTRY` append in
`insight-sensors.cjs:714-760`, `SENSOR_REGISTRY_IDS` append at `:772-792` at the **same index**,
a `require` at the top of `insight-sensors.cjs`, and a `module.exports` entry (the show-share
test asserts `typeof sensors.sensorShowShare === 'function'`, so the new sensor should be
exported the same way).

### F-05: A registry entry looks like this

```javascript
  // Phase 245 Plan 06 detector (SENS-17 -- perspective-lock -> the hats reach, REQ-3):
  sensorPerspectiveLock,
];
```
```javascript
  'SENS-16',        // sensorContentRelevance
  'SENS-17',        // sensorPerspectiveLock
]);
```
Source: `lib/core/insight-sensors.cjs:757-758, 790-792` [VERIFIED: read directly]

### F-06: Live resolution of all six chains (executed this session)

Run against the live `data/command-registry.json` via `command-resolver.cjs`:

| Roadmap type | Recommended framework-name chain | Resolves to | `validateChainAutonomy` |
|--------------|----------------------------------|-------------|-------------------------|
| Landscape Analysis | `["Usher's Model of Cumulative Synthesis", "HSI Semantic Surprise Analysis Assistant"]` | `/mos:find-connections`, `/mos:diagnostics` | runnable: true |
| Technical Roadmap | `["Problem Definition Transformation Framework", "Reverse Salient Analysis", "Knowns and Unknowns Matrix Framework"]` | `/mos:diagnose`, `/mos:find-bottlenecks`, `/mos:map-unknowns` | runnable: true |
| Pipeline Analysis | `["Systems Thinking", "Reverse Salient Analysis", "S-Curve Analysis"]` | `/mos:analyze-systems`, `/mos:find-bottlenecks`, `/mos:analyze-timing` | runnable: true |
| Opportunity Analysis | `["PWS Value Proposition"]` | `/mos:build-thesis` | runnable: true |
| Agenda-Setting Manifesto | `["Beautiful Question Framework", "MECE (Mutually Exclusive, Collectively Exhaustive)"]` | `/mos:beautiful-question`, `/mos:structure-argument` | runnable: true |
| Vision Paper | `["Scenario Planning", "Four Lenses of Innovation"]` | `/mos:explore-futures`, `/mos:find-analogies` | runnable: true |

[VERIFIED: executed `composeWorkflow` + `validateChainAutonomy` on each chain in this session]

The Technical Roadmap row matches `264-SPEC.md` Requirement 2's worked example exactly, byte for
byte, including the three commands it names. The other five rows are corrected against the
research trail's prose (see Pitfall 3 for what changed and why).

**Two framework names in the registry are NOT autonomous-safe** and would produce a
`runnable: false` chain if used: `Futures Wheel` (`/mos:futures`) and `Six Thinking Hats`
(`/mos:bono`). Neither appears in the recommendations above. The drift test should consider
asserting `validateChainAutonomy(composeWorkflow(chain)).runnable === true` for all six as a
third arm.

**The complete `framework_index` is 28 names** (the full allowlist the chain table may draw
from) [VERIFIED: enumerated from `data/command-registry.json` this session].

### F-08: The chain-table template (`data/dispatch-framework-map.json`, 18 lines)

```json
{
  "_note": "OPEN-1 WFL-01 translation layer: each raw sensor dispatch handle / sub_mode maps to its EXACT framework name (data/framework-names.json), never a slug. ... Drift-tested against data/framework-names.json (tests/test-dispatch-framework-map-drift.cjs) so a smuggled slug or a fake framework fails CI.",
  "mos:research": "Hypothesis-Driven Problem Solving",
  "find-bottlenecks": "Reverse Salient Analysis",
  ...
}
```
Source: `data/dispatch-framework-map.json` [VERIFIED: read in full]

Shape: a single flat object, one `_note` key carrying the full rationale plus a pointer to its
own drift test, then literal key-value pairs. **No nesting, no schema version, no
`generated_note`.** Phase 264's file differs in that its values are arrays of framework names
rather than single strings, but the `_note`-plus-literals shape should be preserved.

The drift test's idiom (`tests/test-dispatch-framework-map-drift.cjs`, 87 lines):

```javascript
let failures = 0;
function check(cond, msg) {
  if (cond) { process.stdout.write('  ok  ' + msg + '\n'); }
  else { process.stderr.write('  FAIL  ' + msg + '\n'); failures += 1; }
}
// ... arms ...
const handles = Object.keys(map).filter((k) => k !== '_note');
// ...
if (failures > 0) {
  process.stderr.write('dispatch-framework-map drift: ' + failures + ' FAILURE(S)\n');
  process.exit(1);
}
process.stdout.write('dispatch-framework-map drift: PASS (' + handles.length + ' handles)\n');
process.exit(0);
```
[VERIFIED: read in full]

Note the `_note`-filter line: Phase 264's test needs the identical guard, or the `_note` string
will be treated as a chain and fail every arm.

The existing test has three arms. Phase 264's should have at least five: (1) every framework
name resolves via `commandsForFramework` with a non-empty result, (2) no name is a slug
(no `mos:` prefix), (3) exactly six keys besides `_note`, (4) no duplicate framework name within
a chain, (5) `validateChainAutonomy(composeWorkflow(chain)).runnable === true`.

### F-09: The only shipped `companions` consumer ignores bare framework names

D-03 offers two carriers for the resolved chain. Only one of them is currently wired to
anything.

```javascript
function parseChainCompanions(reach) {
  if (!reach || typeof reach !== 'object' || !Array.isArray(reach.companions)) return [];
  const out = []; const seen = new Set();
  for (const c of reach.companions) {
    if (typeof c !== 'string' || c.length === 0) continue;
    const parts = c.split(':');
    if (parts.length < 2) continue;                       // <-- bare name: SKIPPED
    if (parts[0] !== CHAIN_COMPANION_HANDLE) continue;    // <-- 'brain_framework_chain'
    const handle = parts[1].trim();
    if (handle.length === 0) continue;
    if (seen.has(handle)) continue;
    seen.add(handle); out.push(handle);
    // parts[2+] ... is deliberately ignored -- see docblock above.
  }
  return out;
}
```
Source: `lib/brain/chain-recommender.cjs:526-543`, `CHAIN_COMPANION_HANDLE = 'brain_framework_chain'`
at `:103` [VERIFIED: read directly]

Consequences the planner must know:
1. A bare framework name (`"Reverse Salient Analysis"`) has no colon, so `parts.length < 2` and
   it is skipped. Bare framework names on `companions` reach nobody today.
2. A `brain_framework_chain:<problem_type>:<framework_name>` companion IS the shipped precedent
   for carrying framework names (`sensor-methodology-decision.cjs:103-111`), but the third
   segment is **explicitly, deliberately ignored** by the parser - documented as a named
   follow-up, not a silent drop.
3. Prefixing the chain as `brain_framework_chain:<something>` would cause the parser to feed
   `<something>` to the Brain chain recommender as a **problem_type handle**, which is the wrong
   semantics and would produce wrong Brain queries.

**Recommendation:** make `evidence.roadmap_type` (a closed 6-value scalar enum) the load-bearing
field, and let the consumer resolve the chain from `data/roadmap-type-chains.json`. This is the
second of the two options D-03 explicitly leaves to the planner, and it is the only one with a
working path today. `companions` may still carry the framework names for observability, but the
plan should say plainly that nothing reads them yet, rather than implying a wire that does not
exist.

### F-10: `chain_resolve` is a one-line wrapper; step objects carry no `ralph_verify`

```javascript
function chainResolve(frameworkChain) {
  return composeWorkflow(frameworkChain);
}
```
Source: `lib/mcp/tools/chain.cjs:155-157` [VERIFIED: read directly]

So a resolved step is exactly `{ step: <1-based int>, framework: <string>, command: <string|null>,
optional: <boolean> }` and nothing else. `composeWorkflow` never emits `ralph_verify`.

**What a `ralph_verify` step object actually looks like in practice**, from the shipped test:

```javascript
runChain(
  [{ step: 1, command: 'c', ralph_verify: true }],
  { onStep, postureFn: safePosture, selfCritiqueFn: critic, onHalt: () => 'defer', ralphRetryCap: 2 }
);
```
Source: `tests/test-201-bounded-retry.cjs:50-53` [VERIFIED: read in full]

The flagship harness therefore must **augment** the `composeWorkflow` output before calling
`runChain`, e.g.:

```javascript
const steps = composeWorkflow(TECHNICAL_ROADMAP_CHAIN).map(function (s) {
  return (s.command === '/mos:find-bottlenecks') ? Object.assign({}, s, { ralph_verify: true }) : s;
});
```

`/mos:find-bottlenecks` is a prompt-backed methodology command (`commands/find-bottlenecks.md`
exists; its registry entry has `executable: null`, `kind: "methodology"`,
`body_shape: "methodology"`, `produces: "room/**/reverse-salients/*"`). Because it is
prompt-backed, `chain-step-dispatcher.cjs`'s default `onStep` would return a null verdict plus a
`requires_host_dispatch` directive - the MCP server cannot invoke a Claude Code slash command.
That is a further reason the flagship proof must inject its own `onStep` (as
`test-201-bounded-retry.cjs` does with `makeOnStep`) rather than relying on the shipped
dispatcher. [VERIFIED: registry entry read directly; dispatcher rationale read at
`lib/mcp/tools/chain.cjs:160-181`]

### F-11: `ralph_verify` opt-in preconditions, and `chain_run`'s double inertness

```javascript
if (step && step.ralph_verify === true && typeof selfCritiqueFn === 'function' &&
    !_isMaterialStep(step, posture)) {
  const budgetRemaining = Math.max(0, maxSteps - stepsRun - 1);
  const cap = (typeof o.ralphRetryCap === 'number' && o.ralphRetryCap >= 0)
    ? Math.floor(o.ralphRetryCap) : RALPH_RETRY_CAP_DEFAULT;   // default 2
  const r = _ralphSafeRetry({ step, selfCritiqueFn, onStep, previousOutput,
                              initialResult: result, initialQuality: quality,
                              cap, budgetRemaining });
```
Source: `lib/core/chain-executor.cjs:591-600` [VERIFIED: read directly]

**Three preconditions, all required.** `_isMaterialStep(step, posture)` returns true if
`isIrreversibleStep(step)` OR `step.material === true` OR `posture.posture !== 'run'` (an absent
posture counts as material) [VERIFIED: `chain-executor.cjs:230-238`].

`/mos:find-bottlenecks` registry entry has `autonomous_safe: true`, so `postureForCommand`
returns `posture: 'run'`, so `_isMaterialStep` is false, so the branch fires. The other two
Technical Roadmap commands are also `autonomous_safe: true`. [VERIFIED: read
`data/command-registry.json` directly]

**D-11 confirmed, and it is worse than stated.** `chain.cjs:269`:
```javascript
const roomDir = (typeof o.roomDir === 'string' && o.roomDir.length > 0) ? o.roomDir : process.cwd();
```
`roomDir` is **always** a non-empty string (it falls back to `process.cwd()`), and it is passed
unconditionally at `:290`, which trips `runChain`'s async dispatch at `:448-456`. Additionally,
**`chainRun` never passes `selfCritiqueFn` at all** - the opts object it builds contains
`postureFn`, `onStep`, `maxSteps`, `roomDir`, `onHalt` and nothing else. So `ralph_verify` is
inert through `chain_run` for two independent reasons, not one. Both are out of scope to fix
here; the plan should state both.

### F-12: `_ralphSafeRetry`'s loop is synchronous and never awaits

```javascript
function _safeCritique(selfCritiqueFn, step, result) {
  try { return selfCritiqueFn(step, result); } catch (_e) { return null; }
}
function _critiqueFailed(verdict) {
  return !!(verdict && (verdict.quality === LOW_QUALITY || verdict.passed === false));
}
function _ralphSafeRetry(params) {
  ...
  const maxRetries = Math.max(0, Math.min(cap, budgetRemaining));
  let attempts = 0;
  let verdict = _safeCritique(selfCritiqueFn, step, result);
  while (_critiqueFailed(verdict) && attempts < maxRetries) {
    attempts += 1;
    let retried;
    try { retried = onStep(step, previousOutput); } catch (_e) { break; }
    result = retried || {};
    quality = (typeof result.quality === 'string') ? result.quality : quality;
    verdict = _safeCritique(selfCritiqueFn, step, result);
  }
  const exhausted = _critiqueFailed(verdict);
  let haltReason = null;
  if (exhausted) {
    quality = LOW_QUALITY;
    haltReason = (budgetRemaining < cap) ? 'budget_brake' : 'retry_exhausted';
  }
  return { result, quality, attempts, exhausted, haltReason };
}
```
Source: `lib/core/chain-executor.cjs:287-327` [VERIFIED: read in full]

No `await` anywhere. A Promise verdict has `verdict.quality === undefined` and
`verdict.passed === undefined`, so `_critiqueFailed` returns `false` and the loop is skipped.
This is Pitfall 1.

Note also `onStep` is called synchronously inside the retry loop, so the flagship harness's
`onStep` must be synchronous too.

### F-13: `reviewer-governance.cjs`'s exact exported contract

```javascript
module.exports = {
  REVIEWER_GOVERNANCE,                 // frozen map: category -> { discipline, hard_gate,
                                       //   rules[], evidence_policy, discipline_source }
  governanceForCategory,               // (category) -> frozen entry | null, never throws
  enforceReviewerGovernance,           // (category, argument) -> { ok: boolean, violations: string[] }
  composeReviewerGovernedSeams,        // (opts) -> { deriveFn, selfCritiqueFn, onStep }
  assertHeterogeneity,                 // re-exported from hat-governance.cjs
  lensDescriptor,                      // re-exported from hat-governance.cjs
};
```
Source: `lib/core/bono/reviewer-governance.cjs:322-331` [VERIFIED: read in full, 331 lines]

`composeReviewerGovernedSeams(opts)` accepts `{ hats, deriveCandidateFn, onStepFn }` and returns
three functions. Only `selfCritiqueFn` is relevant to Phase 264. `enforceReviewerGovernance`'s
verdict shape is `{ ok, violations }` where `violations` are **short scalar reason strings that
never carry content bytes** (e.g. `'eligibility_no_evidence'`, `'budget_no_reconciliation_check'`,
`'market_confirming_before_disconfirming'`) - the new RS rule table should follow the same
`<category>_<reason>` naming convention.

The one mechanical validator is a plain if/else-if chain over a normalized category key with an
explicit `else` fallthrough returning `ok: true` for an unknown category. Its rules are entirely
structural (is there at least one evidence item, does the first item carry
`disposition === 'disconfirming'`, does a `stance === 'supports'` claim carry a reconciliation
marker) - **it never interprets prose**. That posture is what makes it synchronous and pure, and
it is exactly what the RS critic should copy.

The file also documents (`:38-41`) a scope caution the plan should mirror verbatim: *"these
rules govern the grade-grant reviewer-panel DEBATE steps ONLY. They are NEVER wired into
live-conversation enforcement."* The new `salient-governance.cjs` should carry the equivalent
caution for the chain-step surface.

The live-wiring precedent named in D-09 is `lib/core/eureka/grade-grant-examine.cjs:517`
[NOTE: the file exists at `lib/core/eureka/grade-grant-examine.cjs`; the planner should read
that call site to confirm the exact injection point].

### F-14: `eureka-critic.cjs`'s 2-judge harness (D-10's source), with its async caveat

```javascript
async function runRubric(candidate, opts) {
  const options = opts || {};
  const judgeFn = options.judgeFn;
  if (typeof judgeFn !== 'function') {
    throw new TypeError('runRubric: opts.judgeFn must be a function');
  }
  const neutral     = parseRubricResponse(await judgeFn(buildNeutralPrompt(candidate)));
  const adversarial = parseRubricResponse(await judgeFn(buildAdversarialPrompt(candidate)));

  let disagreement = false; const agreed = {}; let pattern = '';
  for (let i = 0; i < RUBRIC_KEYS.length; i += 1) {
    const k = RUBRIC_KEYS[i];
    if (neutral[k] === adversarial[k]) { agreed[k] = neutral[k]; pattern += neutral[k] ? '1' : '0'; }
    else { disagreement = true; agreed[k] = null; pattern += 'x'; }
  }

  let verdict, reasoning_tag;
  if (disagreement) { verdict = 'general_shallow'; reasoning_tag = 'rubric_disagreement'; }
  else { verdict = verdictFromRubric(agreed); reasoning_tag = reasoningTagFromItems(agreed); }
  return { rubric_pattern: pattern, disagreement, items: agreed, calls: 2, verdict, reasoning_tag };
}
```
Source: `lib/core/eureka-critic.cjs:469-503`, header comment at `:462-468` [VERIFIED: read in full]

**The ruling to reuse** (from `:463-468`): *"EXACTLY two judgeFn calls (neutral, then
adversarial), never a panel (a 9-judge panel delivered ~2.2 effective votes). Compare the two
passes item-by-item: ANY per-item disagreement routes general_shallow with tag
rubric_disagreement."*

**The function NOT to reuse:** `judgeFn` is awaited twice. The verdict shape is also different
from `selfCritiqueFn`'s (`{rubric_pattern, disagreement, items, calls, verdict, reasoning_tag}`
vs `{passed, quality, violations}`), so it would need translation even if it were synchronous.

The prompt-building discipline is worth mirroring in spirit (`:411-417`): *"The prompts carry
the mechanism text and the proposed mapping and NOTHING else... Exposing the candidate's
persuasive framing to the judge reopens the sycophancy channel."* For a synchronous rule-based
RS critic the analog is: the adversarial pass must evaluate the SAME finding fields under a
stricter rule set, never a different or richer input.

### F-15: the direct-`runChain` precedent (already shown as Pattern 3)

`lib/core/bono/debate-composition.cjs:367-375`. The file is at
`lib/core/bono/debate-composition.cjs` (CONTEXT.md's shorthand `debate-composition.cjs:367` is
correct once the `bono/` directory is supplied).

### F-17: the flagship test template (`tests/test-201-bounded-retry.cjs`, 118 lines)

The whole file is a plain `node` script (not `node:test`), using
`const assert = require('node:assert/strict')` and a tiny `ok(desc, fn)` counter. It contains
seven cases, five of which map directly onto Requirements 4 and 5:

| Case | Assertion | Serves |
|------|-----------|--------|
| `opted-in safe step retries until the critique passes, then proceeds` | `completed === true`, `onStep.count() >= 2`, `trace[0].quality === 'ok'` | R4 "then a passing verdict" |
| `opted-in safe step that never passes halts as retry_exhausted after exactly the cap` | `completed === false`, `haltedAt.reason === 'retry_exhausted'`, `trace[0].quality === 'low'`, `onStep.count() === 3` | R4 "exactly one retry (cap honored)" + R5 "still halts on retry exhaustion" |
| `DEFAULT (no ralph_verify): safe step is NOT critiqued or retried` | `onStep.count() === 1` | R5 "every non-opted-in step's gate behavior is byte-identical" |
| `MATERIAL step with ralph_verify is NOT retried (B3 intact)` | `onStep.count() === 0` | R5 B3 proof |
| `IRREVERSIBLE step with ralph_verify never retries` | `haltedAt.reason === 'forced_material'` | R5 B3 proof |

Its two helpers are directly reusable:
```javascript
const safePosture = function () { return { command: 'c', autonomous_safe: true, posture: 'run' }; };
function makeOnStep(passAt) {
  let attempt = 0;
  const fn = function () {
    attempt += 1;
    return { chain_output: 'out#' + attempt, quality: attempt >= passAt ? 'ok' : 'low', attempt };
  };
  fn.count = function () { return attempt; };
  return fn;
}
```
[VERIFIED: read in full]

Phase 264's flagship test differs in exactly three ways: the step list comes from
`composeWorkflow(TECHNICAL_ROADMAP_CHAIN)` with `ralph_verify: true` grafted onto the
find-bottlenecks step, `onStep` emits a synthetic RS finding shaped like
`reverse-salient-agent.cjs:260-269`, and `selfCritiqueFn` is the new
`salient-governance.cjs`-built critic instead of the two-line inline `critic`.

Note the SPEC's phrase *"exactly one retry (cap honored)"* against the shipped default cap of
`RALPH_RETRY_CAP_DEFAULT = 2`. A fixture whose first candidate fails and whose second passes
produces exactly one retry; that is the scenario to build. Do not lower `ralphRetryCap` to 1 to
force it - that would change the tested contract.

### F-18: embedding `run-all-166.sh` as a regression gate (Requirement 5)

Shipped precedent, `tests/run-all-158.sh:187-188`:
```bash
echo "--- Running: frozen-148 passthrough (bash tests/run-all-148.sh) ---"
if bash "$REPO_ROOT/tests/run-all-148.sh"; then
```
Other instances: `run-all-155.sh:212,222,232`, `run-all-216.sh:95`, `run-all-223.sh:223`.
[VERIFIED: grepped and read]

### F-19: `run-all-166.sh` invokes its suites with bare `node`, not `node --test`

```bash
for c in "${CJS_SUITES[@]}"; do
  ((TOTAL++))
  p="$SCRIPT_DIR/$c"
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING (FAIL)"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done
```
Source: `tests/run-all-166.sh:94-107` [VERIFIED: read directly]

**Two competing aggregator styles ship in this repo.** `run-all-166.sh` (462 lines) uses an
explicit `CJS_SUITES` array with bare `node` and a missing-file-is-a-FAIL guard.
`run-all-259.sh` (136 lines, the most recent) uses **glob discovery with `node --test`** plus a
`found -eq 0` guard and a `TEST_259_PREFIX` override so the guard is itself provable.

**Recommendation for `run-all-264.sh`:** mirror `run-all-259.sh`'s structure (it is newer,
shorter, and self-proving) but invoke with bare `node` rather than `node --test`, because every
sibling suite this phase will write (`test-201-bounded-retry.cjs`,
`test-dispatch-framework-map-drift.cjs`, `test-245-priority-complete.cjs`,
`test-show-share-sensor.cjs`) is a plain script that calls `process.exit(1)` or throws, not a
`node:test` file. Then append the `run-all-166.sh` passthrough per F-18, plus the em-dash fence
from `run-all-259.sh:96-129`.

If glob discovery is used, note that the new drift test and sensor test would need `264-` in
their filenames to be discovered (`tests/test-264-roadmap-type-chains-drift.cjs` rather than
`tests/test-roadmap-type-chains-drift.cjs`). D-04 names the file as
`tests/test-roadmap-type-chains-drift.cjs` without the phase prefix; the planner must reconcile
naming with the discovery mechanism, or use the explicit-list style instead.

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| `chain_run` minted its own posture/autonomy classifier from connector `posture` | `recipe-maps.cjs::postureForCommand` is the SOLE authority, delegating to `validateChainAutonomy` | Phase 237-02 (REACH-02) | Never read `connector.posture` as autonomy; `tests/test-237-one-authority-fence.cjs` is a source fence against reintroduction |
| `chain_run`'s `onStep` was a log-only stub reporting a fabricated top verdict | `lib/core/chain-step-dispatcher.cjs::makeChainStepDispatcher`, two-tier honest dispatcher | Phase 237-08 (REACH-01) | A prompt-backed methodology step returns a NULL verdict + `requires_host_dispatch`, never a fabricated success. The flagship harness must inject its own `onStep`. |
| Same-reach collisions resolved by `SENSOR_REGISTRY` file order (an accident) | `SENS_PRIORITY` doctrine table + `sensorPriorityRank` | Phase 245-01 (D-20) | The 3-array lockstep (D-08) exists because of this |
| Sensors could be added to `SENSOR_REGISTRY` alone | Two independent fail-closed gates (`build-connector-registry.cjs --check` + `test-245-priority-complete.cjs`) | Phase 245-01/245-06 | Registration is atomic or the build reddens |
| Keyword match was a first-class sensor trigger | Canon Part 11 R3: problem-state first, keyword DEMOTED to fallback tier | Phase 172-07, navigator decision 2026-06-23 | D-06's cascade order is doctrine, not preference |
| Cross-step convergence loop ("loop until all PASSING") | REJECTED (B3 / Canon Part 3); intra-step `ralph_verify` only | Phase 166, SEED-032 | The whole framing of Requirement 4 |

**Deprecated / not to be copied:**
- `indexOf`-based lexicon matching (`DIFFUSION_LEXICON` `'laws'` matching `'flaws'`,
  `SHOW_SHARE_LEXICON` `'show'` matching `'slideshow'`). Use `/\b...\b/i` word boundaries
  (D-02). Both bugs are latent in shipped sensors and should not be propagated.
- `data/framework-names.json` as the validation target for a chain table. D-05 correctly
  redirects to `framework_index`, because a name can pass a bare allowlist and still resolve to
  `{command: null, optional: true}`.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `SENS-18` is the next free sensor id | F-04 / D-08 | Low. `SENSOR_REGISTRY_IDS` maxes at `SENS-17` on this branch [VERIFIED by read], but a concurrent phase could claim 18. The build gate would catch a collision. |
| A2 | Group C (not Group D) is the right `SENS_PRIORITY` placement | F-04 | Low/medium. Both satisfy Canon Part 11 R3 and D-08. Group D would require amending the "only pure FALLBACK-tier member" comment about SENS-16. Planner's call; state the choice explicitly in the plan. |
| A3 | `context_block` is the right `reach_id` for the new sensor | F-16 / Pitfall 5 | Medium. CONTEXT.md does not lock a reach id. `deep_research` reads semantically closer to "run a research chain" but is turn-stage-gated off in turns 1-2, which is when the trigger utterance usually arrives. This needs a plan-phase decision. |
| A4 | The corrected six chains in F-06 are the intended mappings | F-06 / Pitfall 3 | Medium. The Technical Roadmap row is locked by SPEC.md verbatim. The other five are my corrections of the research trail's prose to make them resolvable; the navigator may prefer different substitutions (especially dropping `present` from Agenda-Setting). |
| A5 | The flagship harness lives in a test file rather than a live command path | Architecture / F-17 | Low. CONTEXT.md's Integration Points says "likely a dedicated test/fixture harness rather than a live command path (plan-phase's call)". D-11's honest consequence makes a live path pointless anyway. |
| A6 | `run-all-264.sh` should use bare `node` rather than `node --test` | F-19 | Low. Verified that every sibling suite is a plain script. `node --test` on a plain script generally still surfaces a non-zero exit, but the explicit style is what `run-all-166.sh` uses and what this phase must embed. |
| A7 | The RS critic's rule table should fail-closed on an unparseable finding | Pitfall 2 | Medium. This INVERTS the BONO modules' fail-open default. It is the right call given the repo's false-success watch list, but it is a deliberate divergence from the donor module and should be stated as such in the plan, not slipped in. |

---

## Open Questions

1. **Which `reach_id` should SENS-18 emit?**
   - What we know: `makeReach` accepts exactly six; `brain_consult` and `deep_research` are
     suppressed on turns 1-2 by `isReachEligibleForTurn`; `context_block` is never suppressed
     and is what 12 of 19 sensors already fire.
   - What is unclear: whether early-turn silence is acceptable for this sensor.
   - Recommendation: `context_block` with `posture: 'hold'` (D-06). If `deep_research` is
     preferred, the plan must state the turns 1-2 dead zone as an accepted consequence and the
     fixtures must set `turn_count >= 3`.

2. **Does the chain array need to reach a consumer at all in this phase?**
   - What we know: F-09 proves no shipped consumer reads bare framework names off `companions`.
     SPEC Requirement 3's acceptance is *"an integration test drives one sample turn through
     `dispatchSensors`, the new sensor fires, and its `suggested_chain`, passed to
     `chain_resolve`, returns a plan with no `command: null` on a required step"* - which the
     TEST can satisfy by reading `evidence.roadmap_type` and looking up the table itself.
   - What is unclear: whether the navigator expects a live wire or a proven-composable payload.
   - Recommendation: satisfy the acceptance via `evidence.roadmap_type` + table lookup in the
     integration test; carry `companions` as observability; name "wire a live consumer" as a
     follow-on, the same way D-11 names the async-path fix.

3. **Should `/mos:present` be dropped from Agenda-Setting Manifesto, or should a framework be added for it?**
   - What we know: `/mos:present` has an empty `frameworks` array, so it cannot appear in a
     framework-name chain at all; adding one would mean editing command frontmatter and
     regenerating `data/command-registry.json`, which is outside this phase's boundaries.
   - Recommendation: drop it, ship the 2-step chain in F-06, and note the gap.

4. **The langtalks-graph-expert grounding leg was not executed.**
   - What we know: `./CLAUDE.md` mandates consulting langtalks-graph-expert for agent/LLM
     engineering concepts (adversarial critic design, self-critique loops, autocurricula are all
     in scope for its corpus). MCP tools were not present in this research agent's tool surface
     and `claude mcp list` timed out from the sandbox.
   - What is unclear: whether external corpus evidence would refine D-10's panel-size ruling.
   - Recommendation: D-10's ruling is already grounded in an in-repo empirical measurement
     (a 9-judge panel delivering ~2.2 effective votes), which is stronger evidence for THIS
     codebase than a general corpus would be. If external grounding is wanted, the navigator or
     the planner should run `relationship_path` on "adversarial critic" / "self-critique" during
     plan-phase. Flagging honestly rather than papering over it.

5. **CONTEXT.md's Canonical References contain two wrong paths.**
   - `lib/core/reverse-salient-agent.cjs` does not exist; the file is
     **`lib/agents/reverse-salient-agent.cjs`** (the `:260-269` line reference is correct
     against that file).
   - `debate-composition.cjs` is at **`lib/core/bono/debate-composition.cjs`** (the `:367` line
     reference is correct).
   - Recommendation: the planner should use the corrected paths and may want to amend
     CONTEXT.md's reference block so a future reader is not sent to a missing file.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | All `.cjs` modules and tests | yes | v22.23.1 (floor is >=22.16.0) | none needed |
| bash | `tests/run-all-264.sh`, `tests/run-all-166.sh` | yes | 5.2.21 | none needed |
| `grep -P` | The em-dash fence in `run-all-*.sh` | yes (GNU grep on this WSL2 host) | - | `run-all-259.sh` already treats a `grep -P` failure (rc >= 2) as a FAIL rather than a silent pass; copy that guard |
| `data/command-registry.json` | Chain-table drift test, `composeWorkflow` | yes | 113 commands, 28 framework_index entries | none; a missing registry degrades every resolver call to empty (fail-visible) |
| `tests/run-all-166.sh` | Requirement 5 regression gate | yes | 462 lines | none |
| `tests/test-201-bounded-retry.cjs` | Requirement 5 regression gate (D-12) | yes | 118 lines, 7 cases | none |
| Brain MCP / network | - | **not required** | - | This phase makes zero network calls; Canon Part 8 forbids any |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

**Branch note:** HEAD is `fix/part8-guard-in-mcp-handlers` at `24972327`. Per the repo's own
handoff docs this is the branch `main` fast-forwards from, and D-12's presence check for
`tests/test-201-bounded-retry.cjs` was verified against this working tree.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None.** Plain `node` scripts with `node:assert/strict` and hand-rolled `ok()` counters. The house pattern, used by `test-201-bounded-retry.cjs`, `test-245-priority-complete.cjs`, `test-dispatch-framework-map-drift.cjs`, `test-show-share-sensor.cjs`. A minority of newer suites use `node --test` (`run-all-259.sh` globs with it). |
| Config file | none |
| Quick run command | `node tests/test-264-<name>.cjs` (a single suite, sub-second) |
| Full suite command | `bash tests/run-all-264.sh` |

### Phase Requirements to Test Map

| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|-------------|
| R1 | >=12 fixture utterances classify correctly (2 per type + 2 true negatives + 1 near-miss per D-07) | unit | `node tests/test-roadmap-type-sensor.cjs` | Wave 0 |
| R1 | `evidence` is flat scalars only (Part-8 shape) | unit | same file (mirror `test-show-share-sensor.cjs:58-67`) | Wave 0 |
| R1 | Sensor is present in `SENSOR_REGISTRY` and exported | unit | same file (mirror `test-show-share-sensor.cjs:70-72`) | Wave 0 |
| R1 | Sensor returns a non-thenable (sync contract) | unit | same file | Wave 0 |
| R1 | 3-array lockstep holds | integration | `node tests/test-245-priority-complete.cjs` | **exists** |
| R1 | Born-wired build gate | integration | `node scripts/build-connector-registry.cjs --check` | **exists** |
| R1 | No routing_source flip, no navigation-engine require | fence | `node tests/test-sensors-routing-fence.cjs` | **exists** (auto-covers the new file) |
| R1 | No Brain egress from the sensor directory | fence | `node tests/test-sensors-part8-sweep.cjs` | **exists** (auto-covers the new file) |
| R2 | All 6 chains' framework names resolve via `commandsForFramework`, zero dangling | unit | `node tests/test-264-roadmap-type-chains-drift.cjs` | Wave 0 |
| R2 | No slug leaks into a chain value | unit | same file (arm 2 of the dispatch-map template) | Wave 0 |
| R2 | Exactly six keys besides `_note`; no intra-chain duplicate framework | unit | same file | Wave 0 |
| R2 | `validateChainAutonomy(composeWorkflow(chain)).runnable === true` for all six | unit | same file | Wave 0 |
| R3 | `dispatchSensors` fires the sensor on a sample turn; the resolved chain composes with no `command: null` on a required step | integration | `node tests/test-264-sensor-to-chain-resolve.cjs` | Wave 0 |
| R4 | Critic returns a plain object, never a thenable | unit | `node tests/test-264-salient-critic.cjs` | Wave 0 |
| R4 | Critic fails a malformed / unparseable RS finding (does NOT silently pass) | unit | same file | Wave 0 |
| R4 | Two-pass unanimity: any disagreement between the neutral and adversarial pass fails the candidate | unit | same file | Wave 0 |
| R4 | Weak-candidate fixture shows exactly one retry then a passing verdict | integration | `node tests/test-264-flagship-ralph.cjs` | Wave 0 |
| R4/R5 | Never-passing fixture halts with `haltedAt.reason === 'retry_exhausted'` after exactly cap+1 `onStep` calls | integration | same file | Wave 0 |
| R5 | Material step with `ralph_verify` is never retried (B3 intact) | integration | same file (clone `test-201-bounded-retry.cjs:74-83`) | Wave 0 |
| R5 | Non-opted-in step behavior byte-identical | integration | `node tests/test-201-bounded-retry.cjs` | **exists** |
| R5 | Phase 166 contract unbroken | regression | `bash tests/run-all-166.sh` | **exists** |
| R5 | Zero diff inside `chain-executor.cjs`'s gate/stop-condition functions | manual/grep | `git diff -- lib/core/chain-executor.cjs` must be empty | Wave 0 (add a grep arm to `run-all-264.sh`) |
| C-01 | No em-dashes in any file this phase touches | fence | em-dash arm inside `run-all-264.sh` (clone `run-all-259.sh:96-129`) | Wave 0 |

### Sampling Rate

- **Per task commit:** the single relevant `node tests/test-264-*.cjs` (sub-second) plus
  `node scripts/build-connector-registry.cjs --check` whenever the 3-array lockstep is touched.
- **Per wave merge:** `bash tests/run-all-264.sh` (includes the embedded `run-all-166.sh`).
- **Phase gate:** `bash tests/run-all-264.sh` green, plus `node scripts/doctor.cjs --acceptance`,
  before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/run-all-264.sh` - the aggregator (does not exist; verified)
- [ ] `tests/test-roadmap-type-sensor.cjs` - covers R1
- [ ] `tests/test-264-roadmap-type-chains-drift.cjs` - covers R2 (reconcile the filename with the
      discovery mechanism per F-19; D-04 names it without the `264-` prefix)
- [ ] `tests/test-264-sensor-to-chain-resolve.cjs` - covers R3
- [ ] `tests/test-264-salient-critic.cjs` - covers R4 critic unit contract
- [ ] `tests/test-264-flagship-ralph.cjs` - covers R4 + R5 execution proof
- [ ] Framework install: **none needed** (plain `node`, no test framework)

Everything else the phase needs to verify already ships: `test-201-bounded-retry.cjs`,
`test-245-priority-complete.cjs`, `test-sensors-routing-fence.cjs`,
`test-sensors-part8-sweep.cjs`, `run-all-166.sh`, `build-connector-registry.cjs --check`.

---

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control in this repo |
|---------------|---------|-------------------------------|
| V2 Authentication | no | This phase adds no auth surface; it is pure in-process CJS |
| V3 Session Management | no | No session surface touched. `chain.cjs`'s session-keyed gate ledger is read-only context here |
| V4 Access Control | **yes (narrow)** | Canon Part 3 / B3: the chain must halt at the first material step. `_ralphSafeRetry` is guarded by `!_isMaterialStep`, which IS the access-control boundary. Requirement 5 is the test for it |
| V5 Input Validation | **yes** | `makeReach` is the validating factory (closed reach_id / posture banks, string-only `companions`, scalar-only `evidence`). `enforceReviewerGovernance`'s structural-only checks are the model for the RS critic. No `zod`/`joi` in this repo; validation is hand-rolled and fenced by tests |
| V6 Cryptography | no (avoid) | `tests/test-sensors-part8-sweep.cjs` tripwire (3) forbids unmarked `sha256`/`createHash` under `lib/core/sensors/`. Do not introduce hashing in the sensor |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation in this repo |
|---------|--------|----------------------------------|
| Content smuggling into the Brain via a reach struct | Information Disclosure | `makeReach`'s scalar-only `evidence` filter + `tests/test-sensors-part8-sweep.cjs`'s 3 tripwires (no packet/brain-client require, no projection tokens, no unmarked hashing) |
| Slug spoofing in a data map (T-143.3-03) | Spoofing | The drift test's arm 2: no value may start with `mos:` or contain `/mos:`. Phase 264's chain table needs the same arm |
| Autonomy escalation - a material step auto-running | Elevation of Privilege | ONE autonomy authority (`recipe-maps.cjs::postureForCommand`), fenced by `tests/test-237-one-authority-fence.cjs`; `isIrreversibleStep` is the unconditional first check in `gateFn` |
| Unbounded self-critique loop burning budget | Denial of Service | `_ralphSafeRetry` is bounded twice: `Math.min(cap, budgetRemaining)` where cap defaults to 2 and `budgetRemaining = maxSteps - stepsRun - 1` |
| Silent false-success (a critic that passes everything) | Repudiation | Pitfalls 1 and 2. This is the named recurring bug class on this repo's watch list; the plan must add positive assertions, not just absence-of-error |
| Attacker-influenced `companions` strings | Tampering | `parseChainCompanions`'s own docblock names this: *"reach.companions strings are attacker-influenceable in the sense that tuple.problem_type originates from the diagnose-command classification over room text"*. The new sensor's `companions` should carry only values drawn from the committed chain table, never anything derived from turn text |

---

## Sources

### Primary (HIGH confidence) - direct file reads and executions in this session

Files read in full:
- `lib/core/sensors/sensor-priority.cjs` (181 lines)
- `lib/core/bono/reviewer-governance.cjs` (331 lines)
- `lib/workflow/command-resolver.cjs` (155 lines)
- `lib/core/dual-path-detector.cjs` (84 lines)
- `lib/core/sensors/sensor-diffusion-adoption.cjs` (231 lines)
- `tests/test-201-bounded-retry.cjs` (118 lines)
- `tests/test-dispatch-framework-map-drift.cjs` (87 lines)
- `tests/run-all-259.sh` (136 lines)
- `data/dispatch-framework-map.json` (18 lines)
- `.planning/phases/264-.../264-SPEC.md`, `264-CONTEXT.md`
- `./CLAUDE.md` + `.claude/includes/{architecture,moat,decisions,release-process}.md`

Files read in relevant part:
- `lib/core/chain-executor.cjs` (:185-330, :410-480, :560-650)
- `lib/core/insight-sensors.cjs` (:40-80, :505-545, :700-800, :860-940)
- `lib/core/sensors/sensor-types.cjs` (:1-120, :200-294)
- `lib/core/bono/hat-governance.cjs` (:200-367)
- `lib/core/eureka-critic.cjs` (:400-600)
- `lib/agents/reverse-salient-agent.cjs` (:228-290)
- `lib/core/bono/debate-composition.cjs` (:330-400)
- `lib/mcp/tools/chain.cjs` (:1-90, :155-215, :255-300)
- `lib/core/recipe-maps.cjs` (:160-220)
- `lib/brain/chain-recommender.cjs` (:100-110, :505-545)
- `lib/core/sensors/sensor-methodology-decision.cjs` (:100-120)
- `tests/run-all-166.sh` (:1-110, tail structure)
- `tests/test-sensors-routing-fence.cjs` (:1-60), `tests/test-sensors-part8-sweep.cjs` (:1-50),
  `tests/test-245-priority-complete.cjs` (:1-40), `tests/test-show-share-sensor.cjs` (:50-80)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-08-23-scientific-roadmapping-orchestrator/2026-08-23-scientific-roadmapping-orchestrator.md` (:30-60)

Code executed against the live tree:
- `dispatchSensors` with an injected async sensor (F-02, async-drop proof)
- `composeWorkflow` + `validateChainAutonomy` over all 28 `framework_index` names and all six
  candidate chains (F-06, F-07)
- `frameworksForCommand` over the 14 commands the research trail names (F-07)
- `node --version`, `bash --version`, `git rev-parse`

### Secondary (MEDIUM confidence)

- `gsd-tools graphify status`: the knowledge graph exists but is **747 hours stale and 905
  commits behind** (built at `861fddb`, HEAD is `2497232`). No graph queries were run, because
  semantic relationships derived from a 905-commit-old snapshot would be actively misleading for
  a phase whose whole risk surface is exact current seam contracts. Noted rather than silently
  skipped.

### Tertiary (LOW confidence) / not obtained

- **langtalks-graph-expert corpus:** not reachable from this agent's tool surface (MCP tools not
  exposed; `claude mcp list` timed out). See Open Question 4. No external agent-engineering
  grounding was substituted in its place, and no WebSearch was fired (the standing
  MCP-stack-awareness rule requires asking before silent web research).
- **Context7:** not consulted. This phase names no external library, runtime API, or SDK; every
  dependency is an in-repo CJS module read directly. Consulting Context7 here would produce
  nothing the source files do not already answer more authoritatively.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Zero external packages; every module verified present and read |
| Sensor mechanics (F-01..F-05, F-16) | HIGH | Every claim from a direct read; the async-drop claim proven by execution |
| Chain table + resolution (F-06..F-08) | HIGH | All six chains resolved by executing the shipped resolver this session |
| `companions` dead-wire finding (F-09) | HIGH | The single consumer read in full; the skip branch is unambiguous |
| `ralph_verify` seam (F-11, F-12) | HIGH | Preconditions and the synchronous loop read line by line |
| Critic contracts (F-13, F-14) | HIGH | Both donor modules read in full; the RS finding shape read directly |
| Test scaffolding (F-17..F-19) | HIGH | Templates read in full; the nested-`run-all` precedent grepped and confirmed |
| Chain naming / enum discretion | MEDIUM | Explicitly left to plan-phase by CONTEXT.md; A4 flags the five corrected chains |
| Reach-id choice | MEDIUM | Not locked anywhere; OQ-01 raises it as a real decision |
| External agent-engineering grounding | LOW | Not obtained (OQ-04); mitigated by the in-repo empirical ruling D-10 already cites |

**Research date:** 2026-08-23
**Valid until:** 2026-09-22 for the doctrinal findings (Canon parts, seam contracts, priority
doctrine). **7 days** for the file-and-line references, because this working tree is shared by
two active sessions on a fast-moving branch and `data/command-registry.json` is a generated
artifact that any command-frontmatter change regenerates. Re-run F-06's resolution before
authoring the chain table if more than a week has passed.

---

*Phase: 264-roadmap-type-selector-challenge-driven-act-chain-orchestrati*
*Research completed: 2026-08-23*
