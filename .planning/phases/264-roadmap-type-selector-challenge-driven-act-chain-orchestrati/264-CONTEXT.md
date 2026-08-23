# Phase 264: Roadmap-Type Selector: challenge-driven act-chain orchestration for the research command family - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Classify a navigator's stated research goal into one of six scientific-roadmapping output
shapes and resolve it to the matching framework chain via the existing `chain_resolve`
seam; wire `find-bottlenecks`'s flagship step onto the already-shipped `ralph_verify`
bounded self-critique seam with a real adversarial critic, proving challenge-driven
execution without touching `chain-executor.cjs`'s B3/Canon-Part-3 stop condition.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `264-SPEC.md` for full requirements, boundaries, and
acceptance criteria (ambiguity 0.18, gate passed). Requirement 2's example was corrected
during this discussion (framework names, not command slugs -- `composeWorkflow` takes
framework names).

Downstream agents MUST read `264-SPEC.md` before planning or implementing. Requirements are
not duplicated here.

**In scope (from SPEC.md):**
- New sensor classifying a research-goal turn into 1-of-6 roadmap types (or none)
- New static, validated data table mapping the six types to framework-name chains
- Wiring the sensor's chain payload to the existing `chain_resolve` seam
- `find-bottlenecks`'s step in the Technical Roadmap chain opting into `ralph_verify` with a
  reused adversarial-panel `selfCritiqueFn` -- ONE flagship chain, proof of the pattern
- Regression proof against `tests/run-all-166.sh`

**Out of scope (from SPEC.md):**
- Any change to `chain-executor.cjs`'s core loop/gate/stop-condition logic
- Extending `ralph_verify`/`selfCritiqueFn` to the other five roadmap-type chains' steps
- Any new UI/reach-card rendering for a multi-step suggested chain
- The research trail's "Brain graph as cultural memory" claim -- no new graph-memory work
- Retroactive reclassification of past sessions

</spec_lock>

<decisions>
## Implementation Decisions

Advisor-mode research (3 parallel `gsd-advisor-researcher` agents, `minimal_decisive`
calibration tier per the navigator's `opinionated` vendor-philosophy rating) grounded every
decision below in the actual shipped code, not assumption.

### Classifier placement and mechanism

- **D-01:** The new sensor lives in its own standalone file,
  `lib/core/sensors/sensor-roadmap-type.cjs` -- NOT inline in `insight-sensors.cjs`. This is
  the actual convention (17 of 19 registered sensors are standalone files; the gray area's
  original premise that `sensorLaggingComponent`/`sensorDiffusionAdoption` are inline was
  wrong -- both are already standalone files). The header doctrine at
  `insight-sensors.cjs:56-59` states this as policy, and both safety fences
  (`tests/test-sensors-routing-fence.cjs`, `tests/test-sensors-part8-sweep.cjs`) enumerate
  `lib/core/sensors/*.cjs` from disk, so a standalone file ships born-covered.
  `[auto] Classifier placement — Q: "standalone file vs inline function?" → Selected: "standalone lib/core/sensors/sensor-roadmap-type.cjs" (recommended default -- the only real convention, not a preference)`

- **D-02:** The classifier is a deterministic additive-score classifier, modeled on
  `lib/core/dual-path-detector.cjs`'s 5-feature scoring shape -- NOT any form of model/agent
  judgment call. This is not a preference either: `dispatchSensors` runs synchronously inside
  a 1200ms navigation budget (`navigation-engine.cjs:879`) and silently drops any sensor that
  returns a Promise (`insight-sensors.cjs:897`, `REACH_IDS.indexOf(promise.reach_id)` is `-1`
  -- a no-op, not an error). An LLM-judgment sensor is structurally impossible on this seam,
  not merely slower. Use word-boundary regexes (`sensorLaggingComponent`/`sensorCircularity`'s
  `/\b...\b/i` idiom), not raw `indexOf` substring matching -- the shipped lexicons
  (`SHOW_SHARE_LEXICON`, `DIFFUSION_LEXICON`) already carry `indexOf` over-fire bugs
  ("show" matching "slideshow", "laws" matching "flaws") worth NOT copying.
  `[auto] Classification mechanism — Q: "deterministic scored classifier vs LLM judgment call?" → Selected: "deterministic scored classifier, dual-path-detector.cjs as template" (recommended default -- the sync seam contract makes this the only viable option)`

- **D-03 (structural correction, not a preference):** A reach candidate is a frozen 6-key
  struct (`makeReach` in `lib/core/sensors/sensor-types.cjs:237-277` --
  `reach_id`/`posture`/`dispatch`/`companions`/`signal`/`evidence`; any other top-level key
  is dropped, `evidence` keeps only scalar values, `companions` keeps only strings). SPEC.md
  Requirement 3's "`suggested_chain` field" cannot be a new top-level key. The resolved chain
  array rides `companions` (an array of framework-name strings, directly composable by
  `chain_resolve`), while `evidence.roadmap_type` carries the closed 6-value enum for
  observability/logging. The consumer resolves the actual chain from
  `data/roadmap-type-chains.json` keyed by that enum, OR reads it straight off `companions`
  -- planner's call at plan-phase, both are consistent with the frozen struct.

### Chain-table schema and firing threshold

- **D-04:** `data/roadmap-type-chains.json` is a hand-authored flat map + a standalone drift
  test, mirroring the existing `data/dispatch-framework-map.json` precedent (`_note` key +
  literal map, `tests/test-dispatch-framework-map-drift.cjs`'s 87-line `check()`/exit-code
  idiom) -- NOT a generated file with a `build-*.cjs --check` pre-commit gate. There is no
  frontmatter source of truth to generate the six chains FROM (unlike `command-registry.json`,
  which derives from `commands/*.md` frontmatter); a "generator" over a literal would be
  cargo-culted ceremony with a misleading `generated_note: "do not edit by hand"` header on a
  file whose only content is hand-authored. New: `tests/test-roadmap-type-chains-drift.cjs`
  must be added to `tests/run-all-264.sh` explicitly (the dispatch-map drift test is NOT wired
  into pre-commit by default -- it only runs inside specific `run-all-*.sh` aggregators).
  `[auto] Chain-table schema — Q: "hand-authored flat file vs generated + --check gate?" → Selected: "hand-authored + drift test, dispatch-framework-map.json precedent" (recommended default)`

- **D-05:** The drift/validator test checks every framework name against
  `command-resolver.cjs`'s `framework_index` (via `commandsForFramework`), NOT a separate
  `framework-names.json` allowlist -- a name can pass a bare-name allowlist and still degrade
  to `{command: null, optional: true}` at resolve time (`command-resolver.cjs:110-121`), which
  is exactly the failure Requirement 3's acceptance forbids.

- **D-06:** Firing threshold follows the shipped single-hit tiered pattern (signal > context >
  keyword cascade, verbatim as `sensorDiffusionAdoption`/`sensorShowShare` already do) with
  `posture: 'hold'` absorbing the over-eagerness risk at the Decision-Gate layer -- NOT a
  corroboration/2-signal threshold. The one shipped precedent for a corroboration threshold
  (`sensorPerspectiveLock`'s `THRESHOLD = 2`) exists solely to avoid double-firing against an
  already-firing sibling sensor (SENS-08's `cross_room`); there is no such sibling here, so the
  rationale does not transfer and a 2-of-N bar would mostly produce silence (a dead sensor is
  invisible failure, worse than an occasional over-fire caught by `posture: 'hold'`).
  `[auto] Firing threshold — Q: "single-hit + posture:'hold' vs corroboration threshold?" → Selected: "single-hit tiered fire, posture:'hold'" (recommended default)`

- **D-07:** Negative-fixture discipline exceeds the SPEC's own 2-true-negative floor where
  cheap to do: add one near-miss negative containing a lexicon word in a non-research sense
  (the "laws"/"flaws" bug class already latent in two shipped sensors), plus the flat-scalar-
  evidence assertion (`test-show-share-sensor.cjs:62`'s Part-8 shape check) both comparable
  shipped tests already run.

- **D-08 (registration mechanics, not a preference):** Registration is a 3-array lockstep --
  `SENSOR_REGISTRY` (`insight-sensors.cjs:714`), `SENSOR_REGISTRY_IDS` (`:772`, index-parallel),
  and `SENS_PRIORITY` (`lib/core/sensors/sensor-priority.cjs:133`) -- all three in the SAME
  commit, or `scripts/build-connector-registry.cjs --check` and
  `tests/test-245-priority-complete.cjs` fail closed. Next free sensor id: `SENS-18`. Per
  Canon Part 11 R3, a lexical/keyword-fallback sensor cannot rank above navigator problem-state
  -- this sensor belongs in priority Group C/D, not Group A.

### Challenge-driven execution (find-bottlenecks / ralph_verify)

- **D-09:** The critic adapts `lib/core/bono/reviewer-governance.cjs`'s seam shape into a new
  sibling module (e.g. `lib/core/salient-governance.cjs`) with an RS-native rule table --
  NOT `debate-composition.cjs` (only accepts a critic as pass-through, wrong layer) or
  `persona-research.cjs` (async evidence dispatcher needing citation fields RS findings don't
  have). `reviewer-governance.cjs` is the only one of the three that actually emits the
  `selfCritiqueFn(step, result) -> {passed, quality, violations}` contract chain-executor.cjs
  expects, and the only one already proven wired into a real chain
  (`grade-grant-examine.cjs:517`).
  `[auto] Critic pattern — Q: "which BONO module does the skeptic-panel adapt?" → Selected: "reviewer-governance.cjs, new sibling module" (recommended default)`

- **D-10:** NOT an N-skeptics-majority-refute panel. Take the skeptic count and refute
  threshold from `lib/core/eureka-critic.cjs:462-468`, which already ruled this question
  empirically in-repo: *"EXACTLY two judgeFn calls (neutral, then adversarial), never a panel
  (a 9-judge panel delivered ~2.2 effective votes)"*, with ANY disagreement killing the
  candidate (unanimity required to pass). This is orthogonal to `ralph_verify`'s own cap of 2,
  which governs step RE-RUNS, not judges-per-attempt.

- **D-11 (real blocker, confirmed by direct code read, resolved with the navigator):**
  `chain.cjs`'s `chainRun` (the MCP `chain_run` tool) ALWAYS sets `roomDir`
  (`chain.cjs:269-270,290`), which forces `chain-executor.cjs`'s async `_runChainResilient`
  path (`chain-executor.cjs:455`) -- and `_ralphSafeRetry` is called ONLY inside the SYNC
  `runChain` body (`:596`), never reached from the async path. `ralph_verify` is therefore
  INERT when invoked through the normal `chain_resolve`/`chain_run` MCP seam today.
  **Navigator-confirmed resolution:** this phase's flagship proof calls
  `chainExecutor.runChain()` DIRECTLY (bypassing `chain_run`'s MCP wrapper) for the
  find-bottlenecks acceptance test -- mirroring the exact precedent at
  `debate-composition.cjs:367`. Zero changes to `chain-executor.cjs` or `chain.cjs`. Honest
  consequence, stated plainly for the plan: a navigator running the Technical Roadmap chain
  through the LIVE `chain_resolve -> chain_run` flow will NOT get `ralph_verify` benefits from
  this phase alone -- Requirement 4's acceptance is proven via the scoped direct-`runChain`
  call, not the live end-to-end path. "Make `chain_run`'s async path honor `ralph_verify`" is
  named as a follow-on phase (see Deferred below), NOT done here -- doing it here would reopen
  SPEC.md's own Boundaries (which forbid touching `chain-executor.cjs`'s core logic in this
  phase).

- **D-12:** `tests/test-201-bounded-retry.cjs` verified present on `HEAD`
  (`fix/part8-guard-in-mcp-handlers`, the branch this repo fast-forwards to `main` from) --
  the advisor agent's caution that it exists "only in a worktree" does not apply to this
  branch; Requirement 5's regression gate has a real test to run.

- **D-13:** `argumentFromResult` (`hat-governance.cjs:243-251`) must NOT be reused as a
  drop-in critic for RS findings -- it returns `null` for a Reverse Salient finding's actual
  shape (`reverse-salient-agent.cjs:260-269` has no `stance`, no `evidence[]`), which would
  make every candidate pass silently -- the exact false-success bug class already on this
  repo's watch list. The plan must author real field mapping in the new
  `salient-governance.cjs`, not assume the existing helper works unmodified.

### Room binding (session-scoped, not phase-scoped)

- **D-14 [informational]:** This session is bound to "dev repo only, no room" for the remainder of the
  conversation (navigator-confirmed, remembered for session) -- all Phase 264 work is
  git-tracked dev-repo state in `~/dev/MindrianOS-Plugin`, not a MindrianRoom artifact.

### Claude's Discretion

- Exact `data/roadmap-type-chains.json` key naming (slug vs enum string) and whether
  `evidence.roadmap_type` carries the slug or the display name -- plan-phase's call, both are
  SPEC-compliant.
- Whether `salient-governance.cjs`'s rule table is authored inline or split into a fixture
  file -- follow whatever `reviewer-governance.cjs`'s own test suite already does.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/264-roadmap-type-selector-challenge-driven-act-chain-orchestrati/264-SPEC.md` -- Locked requirements, boundaries, acceptance criteria. MUST read before planning.

### Origin / research trail
- `~/MindrianRooms/rethinking-mindrianos/research/2026-08-23-scientific-roadmapping-orchestrator/2026-08-23-scientific-roadmapping-orchestrator.md` -- the synthesis this phase was scoped from (external sources, initial mapping, B3 finding).

### Orchestration substrate (read before touching any of it)
- `lib/core/chain-executor.cjs` -- `runChain` (sync, has `_ralphSafeRetry`/`_applySelfCritique`), `_runChainResilient` (async, chain_run's actual path, does NOT honor `ralph_verify`), `_isMaterialStep`, B3 doctrine in the file header.
- `lib/mcp/tools/chain.cjs` -- `chain_resolve`/`chain_run` MCP tools; `chainRun` at `:269-270,290` always forces the async path via `roomDir`.
- `lib/workflow/command-resolver.cjs` -- `composeWorkflow`, `commandsForFramework`, `frameworksForCommand`; the "resolver is the only door" doctrine.
- `lib/core/insight-sensors.cjs` -- `SENSOR_REGISTRY`/`SENSOR_REGISTRY_IDS` (3-array lockstep, next free id `SENS-18`), header doctrine on standalone sensor files.
- `lib/core/sensors/sensor-types.cjs` -- `makeReach`'s frozen 6-key reach struct (`:237-277`).
- `lib/core/sensors/sensor-priority.cjs` -- `SENS_PRIORITY`, Group A-D placement, Canon Part 11 R3.
- `lib/core/dual-path-detector.cjs` -- the deterministic additive-score classifier template (D-02).
- `data/dispatch-framework-map.json` + `tests/test-dispatch-framework-map-drift.cjs` -- the hand-authored + drift-test precedent this phase's chain table follows (D-04).
- `data/command-registry.json` + `scripts/build-command-registry.cjs` -- contrast case (generated, frontmatter-derived; why this phase does NOT copy that pattern).

### Challenge-driven critic
- `lib/core/bono/reviewer-governance.cjs` -- the adapted module (D-09), proven `selfCritiqueFn` contract.
- `lib/core/eureka-critic.cjs:462-468` -- the 2-judge unanimous-to-pass ruling this phase's critic reuses verbatim (D-10).
- `lib/core/bono/hat-governance.cjs:243-251` -- `argumentFromResult`, the drop-in-reuse trap to avoid (D-13).
- `lib/core/eureka/grade-grant-examine.cjs:517` -- live precedent of `reviewer-governance.cjs` wired into a real chain.

### Constitution
- `docs/MINDRIAN-CANON.md` Part 3 (Tri-Context Decision Gate) -- the B3 constraint this phase must not violate.
- `docs/MINDRIAN-CANON.md` Part 7 (Reuse Before Build), Part 8 (Graph Boundary), Part 11 R3 (sensor priority tiers).
- `.planning/phases/166-gated-chain-executor/166-SPEC.md` -- B3's original ruling text (`"Canon Part 3 mandates the chain halt at the first material step... the stop condition is posture-driven, never autonomous-convergence-driven"`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/dual-path-detector.cjs` -- classifier template (5-feature additive score -> enum + booleans).
- `data/dispatch-framework-map.json` + its drift test -- chain-table authoring template.
- `lib/core/bono/reviewer-governance.cjs` -- critic contract + implementation to adapt.
- `lib/core/eureka-critic.cjs` -- 2-judge unanimous verdict logic to reuse for panel size/threshold.
- `data/command-registry.json`'s `framework_index` -- the validation target for the chain table.

### Established Patterns
- Every `SENSOR_REGISTRY` entry: standalone file in `lib/core/sensors/`, synchronous, deterministic, registered in 3 lockstepped arrays.
- `ralph_verify`/`selfCritiqueFn`: opt-in per-step (`step.ralph_verify === true`), bounded (cap 2, budget-checked), intra-step only, never a cross-step loop (B3-compliant by construction).
- `debate-composition.cjs:367` -- the existing precedent for calling `chainExecutor.runChain()` directly, bypassing `chain_run`'s MCP wrapper.

### Integration Points
- New sensor registers into `SENSOR_REGISTRY`/`SENSOR_REGISTRY_IDS`/`SENS_PRIORITY` (3-array lockstep).
- New chain table sits beside `data/dispatch-framework-map.json`, validated the same way.
- New critic module sits beside `lib/core/bono/*.cjs` as a sibling, not inside that directory (RS is not a BONO subsystem).
- Flagship proof's `runChain()` direct-call site: new, does not yet exist -- likely a dedicated test/fixture harness rather than a live command path (plan-phase's call).

</code_context>

<specifics>
## Specific Ideas

No UI/visual specifics -- this phase is backend-only (sensor + data + critic wiring), no
rendering changes. The navigator's own words framed the ambition plainly: "we need to
incorporate to use them as an orchestrator in mindrian os" -- resolved into the narrowest
version that is actually buildable without reopening the B3 constitutional constraint.

</specifics>

<deferred>
## Deferred Ideas

- **Make `chain_run`'s async path (`_runChainResilient`) honor `ralph_verify`.** Would make the
  challenge-driven pattern live for every navigator-triggered chain run, not just this phase's
  flagship proof. Explicitly out of THIS phase's SPEC.md boundaries (would touch
  `chain-executor.cjs`'s core logic); candidate for its own future phase once the flagship
  proof is live and the pattern is validated.
- **Extend `ralph_verify` + a reused critic to the other five roadmap-type chains'** `find-connections`/`whitespace`/`find-analogies`/`build-thesis`/etc. steps. Simplifier discipline: flagship-first, generalize later.
- **The 4 deferred graph-edge classes named in the Brain migration payload** (`payloads/scientific-roadmapping.mjs` in `ProblemsWorthSolving-Brain`) -- inbound FEEDS_INTO, PREREQUISITE, COMPLEMENTS, technique-reuse edges -- unrelated to this phase's code but same navigator-originated research thread; needs a read-access session to resolve real target ids before a follow-up payload can emit them.

### Reviewed Todos (not folded)
- `2026-07-08-f7-rescope-212-213-against-registercapability.md` (score 0.9), `2026-07-03-registry-drift-gate...md` (0.6), `2026-07-17-ingest-skill-description...md` (0.6), `2026-07-12-never-git-stash...md` (0.4), `2026-07-29-deck-generation...md` (0.4) -- all 6 `todo.match-phase` hits reviewed; every one is a generic keyword match (plan/rethinking/mindrianos/2026/phase) unrelated to this phase's actual scope (roadmap-type classification, ralph_verify wiring). None folded.

</deferred>

---

*Phase: 264-roadmap-type-selector-challenge-driven-act-chain-orchestrati*
*Context gathered: 2026-08-23*
