---
phase: 213-eureka-reach-wiring
plan: 03
subsystem: api
tags: [eureka, born-wired, decide, reachability, sensor-spine, SENS-13, deep_research]

# Dependency graph
requires:
  - phase: 213-02
    provides: "SENS-13 detector (lib/core/sensors/sensor-eureka.cjs) + the side-channel producer (lib/core/eureka/eureka-reach-runner.cjs), born-invoked from scripts/auto-explore-fire.cjs; both left the SENSOR_REGISTRY registration + reachability proof out of scope for exactly this plan"
  - phase: 144
    provides: "the decide() sensor-consumption chokepoint (dispatchSensors -> resolveFireSkill -> reachIdToSkillFamily) that this plan wires SENS-13 into"
  - phase: 148
    provides: "the frozen REACH_IDS six; deep_research is member 5, mapping to the canonical verb Spawn Sub-Agent"
  - phase: 177
    provides: "the BCH-S5 turn-stage gate (deep_research suppressed turns 1-2, unlocked at 3) that the born-wired path is proven to honor"
provides:
  - "SENS-13 registered in SENSOR_REGISTRY (position 15, canonical-last) + exported; header roster names SENS-13"
  - "the FIRST born-wired-at-feature-time runtime reachability proof (tests/test-213-reach-wired.cjs) - the eureka reach is provably reachable through the REAL decide(), fails-closed on regression"
  - "the recommend-never-trigger adversarial suite (tests/test-213-no-force.cjs) - structural + behavioral + vocabulary + posture fences"
affects: [214-find-analogies, build-time-spine-routing-gate, eureka-offer-plan-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Born-wired-at-feature-time proof: a sensor is registered into dispatchSensors -> decide() AND proven reachable by a runtime test IN THE SAME PHASE that builds it, not left as a registered-but-unreachable orphan (the M4 placeholder countermeasure)"
    - "Phase 185 assert-through-the-real-read-path discipline applied to the sensor plane: the proof calls the shipped decide()/dispatchSensors, never a mock engine or a parallel ranker"
    - "Recommend-never-trigger made mechanical: comment-stripped source fences + a poisoned-runChain behavioral arm + a forcing-vocabulary fence + a posture pin"

key-files:
  created:
    - tests/test-213-reach-wired.cjs
    - tests/test-213-no-force.cjs
  modified:
    - lib/core/insight-sensors.cjs

key-decisions:
  - "decide() is BYTE-UNCHANGED: the wiring is one SENSOR_REGISTRY entry + require + export; no engine edit, no second selection brain (a hard must_have)"
  - "The observable born-wired value at decide()'s output is the canonical VERB 'Spawn Sub-Agent' (= the shipped reachIdToSkillFamily('deep_research') map), NOT the skill family 'subagent-dispatcher'. The plan's acceptance literal conflated the two ends of the deep_research -> Spawn Sub-Agent -> subagent-dispatcher chain; the test asserts the value the REAL engine returns (Phase 185 rule), against the shipped map rather than a hand-typed literal"

patterns-established:
  - "Fails-closed reachability proof: a mutation that starves the reach (unregistering SENS-13) makes ARM 1 emit the exact BORN-WIRED BREACH message and exit non-zero (verified by mutation test)"
  - "Co-fire empirically pinned, not assumed: a same-turn context_block sensor outranks the eureka offer by canonical SENSOR_REGISTRY order; the offer surfaces on quiet turns and yields on context turns (RESEARCH Pitfall 2)"

requirements-completed: [EUREKA-02, EUREKA-03]

# Metrics
duration: ~35min
completed: 2026-07-10
---

# Phase 213 Plan 03: Wiring the Key - SENS-13 Spine Registration + the Born-Wired Reachability Proof Summary

**The eureka reach is provably reachable through the REAL decide() at runtime - the room's FIRST born-wired-at-feature-time proof, wired with one SENSOR_REGISTRY entry (decide() byte-unchanged) and locked by a runtime test that fails closed if the reach is ever starved.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- **SENS-13 is on the spine.** `sensorEureka` is required, appended LAST in `SENSOR_REGISTRY` (canonical order, position 15), and exported; the header roster names SENS-13. `dispatchSensors`, `normalizeTurn`, eligibility gating, and `decide()` are all byte-identical - the wiring is purely additive.
- **The born-wired proof is on disk.** `tests/test-213-reach-wired.cjs` (5 arms, 218 lines) calls the SHIPPED `decide()` and `dispatchSensors` - no engine mock, no parallel ranker - and proves a fresh guard-cleared side-channel surfaces the eureka reach through `decide()`. It FAILS closed on any future edit that starves the reach (mutation-verified: unregistering SENS-13 yields the exact `BORN-WIRED BREACH` message and a non-zero exit).
- **Recommend-never-trigger is mechanical.** `tests/test-213-no-force.cjs` (4 invariants, 173 lines) locks the constraint structurally (producers require no router/executor in CODE), behaviorally (a poisoned `runChain` proves the fired reach executes nothing), lexically (zero forcing vocabulary in CODE), and by posture (the fired reach is `hold` exactly).

## Task Commits

Each task was committed atomically:

1. **Task 1: Register SENS-13 in the sensor spine** - `508af397` (feat)
2. **Task 2: tests/test-213-reach-wired.cjs - the born-wired reachability proof** - `cedfe369` (test)
3. **Task 3: tests/test-213-no-force.cjs - the recommend-never-trigger suite** - `4b3b05fd` (test)

## Files Created/Modified
- `lib/core/insight-sensors.cjs` - added the `sensorEureka` require block (SENS-13 house comment), the canonical-last `SENSOR_REGISTRY` entry, and the export; header roster names SENS-13. Zero behavior-body change (dispatch chokepoint + turn-stage gate untouched).
- `tests/test-213-reach-wired.cjs` - the 5-arm runtime reachability proof against the real `decide()`/`dispatchSensors`.
- `tests/test-213-no-force.cjs` - the 4-invariant recommend-never-trigger adversarial suite (plan-04 `eureka-offer.cjs` arm SKIP-logs when absent).

## Decisions Made
- **decide() stays byte-unchanged.** The must_have was explicit: the wiring is one registry entry + require + export; no engine edit, no second selection brain. The frozen-six + BCH-S5 turn-stage gates already span `deep_research`, so no new suppression logic was needed.
- **Assert the value the REAL engine returns.** See the deviation below - the tier_0 sensor path resolves `fire_skill` to the canonical VERB, and the proof asserts that against the shipped map (Phase 185 no-parallel-reimplementation rule) rather than the plan's assumed skill-family literal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan acceptance literal `fire_skill === 'subagent-dispatcher'` corrected to the real read-path value `'Spawn Sub-Agent'`**
- **Found during:** Task 2 (writing the reachability proof, empirical probe of the real `decide()`)
- **Issue:** The plan's ARM-1 acceptance and a must_have truth asserted `decide()` returns `fire_skill === 'subagent-dispatcher'`. Empirically, the tier_0 sensor path (`context = { roomDir }`, no quadruple) resolves `fire_skill` via `resolveFireSkill` -> `reachIdToSkillFamily('deep_research')`, which returns the canonical VERB `'Spawn Sub-Agent'`. The skill-family value `'subagent-dispatcher'` is produced only by `verbToSkillFamily('Spawn Sub-Agent')`, which is neither exported nor on the tier_0 sensor path - it is a downstream router-layer mapping. The plan conflated the two ends of the frozen `deep_research -> Spawn Sub-Agent -> subagent-dispatcher` chain.
- **Fix:** Asserted `decision.fire_skill === nav.reachIdToSkillFamily('deep_research')` and pinned that value to `'Spawn Sub-Agent'` against the SHIPPED map (never a hand-typed literal). The full chain is documented link-by-link in the test header: `deep_research` (reach) -> `Spawn Sub-Agent` (canonical verb the router validates) -> `subagent-dispatcher` (skill family downstream). This is the Phase 185 discipline the plan itself invoked: assert through the real read path, do not change the engine to match an assumed literal. **Changing `decide()` to emit `subagent-dispatcher` would have violated the hard `decide()`-byte-unchanged must_have** - so the honest resolution was to correct the test expectation, not the engine.
- **Files modified:** tests/test-213-reach-wired.cjs (test expectation only; no source change)
- **Verification:** `node tests/test-213-reach-wired.cjs` exit 0; mutation test confirms fail-closed
- **Committed in:** `cedfe369`

**2. [Rule 3 - Blocking] `signal 'eureka_bridge'` asserted at its source, not off the trace**
- **Found during:** Task 2
- **Issue:** The plan wanted ARM 1 to assert the trace's sensor reaches carry `signal 'eureka_bridge'`. By Part-8 design, `decide()`'s `trace.context_assembly.facts` deliberately DROP `reach.signal` (it is a user-derived value); it carries `reach_id` + `posture` + the scalar `evidence` bag only. The signal is therefore not observable off the trace.
- **Fix:** Asserted `signal === 'eureka_bridge'` at its source through the REAL `dispatchSensors` chokepoint that `decide()` itself calls (still the real read path, not a parallel ranker), and asserted the trace fingerprint via the scalar evidence bag (`guard_verdict: transferable`, `band: breakthrough`) + `decision_grounding === 'deep_research'`.
- **Files modified:** tests/test-213-reach-wired.cjs
- **Verification:** exit 0
- **Committed in:** `cedfe369`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** Both are test-expectation corrections that make the proof assert the REAL engine's behavior. No source/engine change; the `decide()`-byte-unchanged must_have is preserved. No scope creep.

## Co-Fire Verdict (recorded per plan Task 2, for the SUMMARY)

Empirically pinned (not assumed): on a turn that ALSO fires a `context_block` sensor (SENS-03 lagging-component on "bottleneck"), the eureka offer YIELDS - `context_block` outranks it by canonical `SENSOR_REGISTRY` order (context_block sensors sit earlier than SENS-13). `deep_research` is STILL present in the full reach list, so the offer is present-but-not-top: it surfaces on a QUIET turn and defers to a same-turn context sensor - the correct posture for a `hold` standing suggestion. If a future run ever showed the reach NEVER surfaces in realistic mixes, the fix belongs in SENS-13's FIRING CONDITION (tighten band/guard), NEVER in reordering the frozen `REACH_IDS` or bypassing `decide()` (RESEARCH Pitfall 2 doctrine).

## Issues Encountered
- A regression run refreshed `evals/plurai/211-baseline.json`'s `date` field (a known network-probe test side-effect, reverted in prior plans too). Reverted before committing - out of scope, not my task's output.

## Verification (all objective gates hold)
- `node tests/test-213-reach-wired.cjs` exit 0 (5 arms)
- `node tests/test-213-no-force.cjs` exit 0 (4 invariants; plan-04 arm SKIP-logged)
- `grep -c "sensorEureka" lib/core/insight-sensors.cjs` = 3 (require + registry + export)
- `grep -c "SENS-13" lib/core/insight-sensors.cjs` = 3
- registry one-liner: 15 sensors, `sensorEureka` is a function, canonical-last
- `node tests/test-148-engine-reaches.cjs` exit 0 (frozen-six unchanged)
- `test-sensors-part8-sweep` + `test-sensors-routing-fence` green over 17 files (new files auto-spanned)
- `node tests/test-213-sensor-eureka.cjs` exit 0 (213-02 detector suite, no regression)
- em-dashes: 0 on every touched file
- **Fails-closed proof:** unregistering SENS-13 makes ARM 1 emit `BORN-WIRED BREACH` and exit 1; restore -> exit 0

## Next Phase Readiness

The first born-wired-at-feature-time proof is on disk. **Recommended SECOND born-wired proof phase (RESEARCH Open Question 3): Phase 214's find-analogies leg riding the same `deep_research` reach** is the natural candidate - it exercises the identical reach-to-verb chain through a different detector, so a second proof confirms the pattern generalizes beyond one sensor. After that second proof lands, mint the BUILD-TIME spine-routing gate (04-synthesis Step 2): make "a registered sensor MUST have a passing reachability proof" a commit/doctor gate, turning the M4-orphan countermeasure from a per-phase test into a structural invariant.

A later plan still owes the `deriveFn` that turns the born-invoked producer (213-02) from `substrate_unavailable` into a live bridge scan (threaded through navigation.cjs), and plan 04 supplies `lib/core/eureka/eureka-offer.cjs` (the no-force suite's SKIP-logged arm activates automatically when it lands).

## Self-Check: PASSED

All created/modified files exist on disk; all three task commits (`508af397`, `cedfe369`, `4b3b05fd`) are in the git log.

---
*Phase: 213-eureka-reach-wiring*
*Completed: 2026-07-10*
