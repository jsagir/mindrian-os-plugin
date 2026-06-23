---
phase: 172-contextual-invocation-coverage
plan: 07
subsystem: sensor-spine
tags: [cirs, canon-part-11, r3, inv-07, inv-23, trigger-tiering, meadows-systems-model]

# Dependency graph
requires:
  - phase: 143-insight-sensors
    provides: lib/core/insight-sensors.cjs dispatchSensors + normalizeTurn/deriveTurnSignals (the one-seam turn normalization) + lib/core/sensors/sensor-types.cjs makeReach factory + the frozen 6-reach/3-posture banks
  - phase: 170-dual-use-diffusion-ace
    provides: lib/core/sensors/sensor-diffusion-adoption.cjs (the evidence.mode 'signal'|'keyword'|'marker' precedent that the tiering convention generalizes)
  - phase: 109-sql-context-memory-navigation-spine
    provides: lib/core/navigation.cjs (the LOCAL chokepoint that populates the problem-state enums - stage/jtbd/graph_gap - on tuple+ctx; getRoomContext upstream)
provides:
  - "The R3 trigger-tier model: sensor-types.TRIGGER_TIERS (closed ordered set signal/context/keyword) + classifyTriggerTier + readProblemStateEnum + isContextTier - context problem-state is PREFERRED, keyword is a recorded FALLBACK tier (INV-07)"
  - "PROBLEM_STATE_FIELDS read allow-list (stage/jtbd/graph_gap) keeping the tier read enum/scalar-only (Part 8)"
  - "normalizeTurn records a trigger_tier enum on the normalized copy at the one-seam normalization point; tuple threaded through dispatchSensors"
  - "docs/172-SYSTEMS-MODEL.md: the Meadows systems model of the invocation surface (stocks/flows/feedback/leverage/delays/hierarchy; gate AS balancing loop at the highest-leverage point) - INV-23"
  - "tests/test-context-driven-trigger.cjs: the context-first/keyword-fallback fence + the Part-8 enum-only-evidence fence + the Phase-144 fence + the systems-thinking-registry-wired (R1) assertion"
affects: [172-09 (SENS-09 per-sensor adoption of the tier convention), every later 172 sensor wave that prefers problem-state over keyword, CIRS R3 trigger tier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "trigger-tier model: a closed ORDERED tier vocabulary (signal/context preferred, keyword fallback) recorded as a mode enum in evidence, generalizing the sensor-diffusion-adoption mode precedent"
    - "pure-classifier seam: the LOCAL problem-state read is a pure projection of enums already on tuple+ctx (navigation.cjs populated) - zero new filesystem/Brain read on the hot path"
    - "one-seam tier recording: the trigger_tier enum is attached at normalizeTurn (the single turn-normalization point), not per-sensor - the seam is established; per-sensor adoption is later waves"

key-files:
  created:
    - docs/172-SYSTEMS-MODEL.md
    - tests/test-context-driven-trigger.cjs
  modified:
    - lib/core/sensors/sensor-types.cjs
    - lib/core/insight-sensors.cjs
    - tests/run-all-172.sh

key-decisions:
  - "The tier read is a PURE projection of enums already on tuple+ctx (stage/jtbd/graph_gap), populated upstream by the navigation.cjs chokepoint - so the context tier adds ZERO new non-SQLite read on the dispatch hot path (acceptance criterion + T-172-14 mitigation)"
  - "'signal' and 'context' are BOTH context-tier (both rank above keyword); the binary decision is classifyTriggerTier(...) === 'keyword' (fallback) vs anything else (context)"
  - "The seam is established at normalizeTurn + exposed as exported classifiers; the plan explicitly scopes per-sensor adoption (e.g. SENS-09) to Plan 09 - makeReach + the frozen banks are untouched (no 7th reach, no edge/node type)"
  - "evidence.mode stays the sensor-diffusion-adoption convention; the test asserts any evidence.mode is a TRIGGER_TIERS member so the keyword demotion is legible (Part 8 enum-only)"

patterns-established:
  - "Trigger tiering: classifyTriggerTier(turn, tuple, ctx) -> 'signal'|'context'|'keyword'|null; isContextTier(tier) is the one-line PREFER predicate"
  - "Test fence asserts: context-tier wins over keyword when problem-state present; keyword-only still fires as fallback mode; evidence carries no matched user text; the Phase 144 fence; the systems-thinking R1 registry-wired confirmation; the six-Meadows-dimension doc fence"

requirements-completed: [INV-07, INV-23]

# Metrics
duration: 20min
completed: 2026-06-23
---

# Phase 172 Plan 07: Context-Driven Trigger Tiering + Meadows Systems Model Summary

**Tiers the sensor trigger model so a LOCAL navigator problem-state signal (stage/JTBD/graph-gap, read enum/scalar via the navigation.cjs chokepoint) is the PREFERRED context tier and keyword/lexicon match is a recorded FALLBACK tier (R3/INV-07), and records the invocation surface as a Meadows balancing-loop system while confirming /mos:systems-thinking is CIRS-conformant (INV-23).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 of 2
- **Files:** 2 created, 3 modified

## Accomplishments

- **Task 1 (RED b2f86ca4 -> GREEN 2ffa0bbd, tdd):** Established the R3 trigger-tier seam. `lib/core/sensors/sensor-types.cjs` gains `TRIGGER_TIERS` (the closed ORDERED vocabulary `['signal','context','keyword']` - the order IS the precedence: context preferred, keyword fallback), `PROBLEM_STATE_FIELDS` (the enum read allow-list `stage`/`jtbd`/`graph_gap`), `readProblemStateEnum(turn, tuple, ctx)` (a PURE projection of the LOCAL problem-state enums already on the diagnose tuple + ctx that the navigation.cjs chokepoint populated - zero new fs/Brain read), `classifyTriggerTier` (applies the context-first / keyword-fallback precedence), `isContextTier`, and `hasProblemStateSignal`. All pure, zero-I/O, no `require` added. `lib/core/insight-sensors.cjs` `normalizeTurn` now records a `trigger_tier` enum on the normalized COPY at the one-seam normalization point (tuple threaded through `dispatchSensors`); the helpers are re-exported from the dispatch surface. `makeReach` + the frozen 6-reach/3-posture banks are byte-untouched; the Phase 144 fence (no `routing_source` mutation, no `decide()` call) is preserved.
- **Task 2 (2490baf0):** Authored `docs/172-SYSTEMS-MODEL.md` modeling the invocation surface AS a Meadows system per INV-23: STOCKS (dark/wired/excluded surface counts, un-ranked counterparts, placeholder/absent chains), FLOWS (surfaces born/modified/removed, wired/excluded, chains earned), FEEDBACK (the coverage gate IS the BALANCING loop holding the dark-surface stock at zero; the prior 143.x/144.1 regression was a BROKEN loop - WARN-only + CI-orphaned = weak feedback + long delay), LEVERAGE POINTS (the born-wired hard gate is Meadows #5 rules / #4 self-organization, NOT a #12 parameter tweak), DELAYS (the gate fires at MERGE not audit-time), HIERARCHY (the fractal rollup is Simon near-decomposability, aggregate-SCALAR-only across boundaries). The doc names the gate as the balancing loop placed at the highest-leverage point. Added the Test-5 assertion that `/mos:systems-thinking` appears in `data/connector-registry.json` with `connects_to_spine:true` (CIRS R1-conformant) and the Test-6 six-Meadows-dimension + balancing-loop + no-em-dash doc fence; registered the test in `tests/run-all-172.sh`.

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed RED -> GREEN:
- **RED (b2f86ca4):** `test(172-07): add failing context-driven-trigger fence ...` - 6 of 8 checks FAILED (the TRIGGER_TIERS set, the two helper exports, Tests 1-3 keying on them, and Test 6 the not-yet-written doc). Tests 4 (Phase 144 fence) and 5 (systems-thinking registry-wired) PASSED immediately because both invariants already held. Confirmed exit 1.
- **GREEN (2ffa0bbd):** `feat(172-07): tier the trigger model ...` - the sensor-types helpers + the insight-sensors seam landed; Tests 1-5 went green (only Test 6, Task 2's doc, remained). Then Task 2 (2490baf0) wrote the doc and Test 6 went green (8/8).
- REFACTOR: none needed.

The doc/test were committed across the RED feat/test commits and the Task-2 docs commit; the gate sequence (test commit -> feat commit) is present in git log.

## Verification

| Check | Result |
|-------|--------|
| Task 1+2: `node tests/test-context-driven-trigger.cjs` | 8/8 PASS (exit 0) |
| Task 2 automated: `grep balancing loop && grep leverage && node tests/...` | exit 0 |
| Acceptance: no new non-SQLite fs read in `sensor-types.cjs` | confirmed (grep require/readFileSync/readdirSync/statSync/fetch/http = 0 matches) |
| Acceptance: evidence carries no matched user text (Part 8) | Test 3 PASS (planted-secret enum-only sweep) |
| Acceptance: dispatchSensors never mutates routing_source / never calls decide() | Test 4 PASS (runtime + static source guard) |
| Acceptance: dispatch records a `mode` enum distinguishing context vs keyword tier | Test 2 PASS (diffusion sensor fires mode='keyword' on keyword-only); evidence.mode in TRIGGER_TIERS |
| INV-23: six Meadows dimensions + balancing loop + no em-dash | Test 6 PASS |
| Carried `tests/test-diffusion-adoption-sensor.cjs` | 20/20 PASS |
| Carried `tests/test-sensors-part8-sweep.cjs` | PASS (zero Brain egress over 12 sensor files) |
| Carried `tests/test-sensor-spine-dispatch.cjs` | 6/6 PASS |
| Carried `tests/test-150-5-sensor-firability.cjs` | 22/22 PASS (normalizeTurn signature change is a trailing optional param) |
| Carried `tests/test-reach-ids-drift.cjs` / `test-posture-ids-drift.cjs` | PASS (frozen exactly-6 / exactly-3) |
| `bash tests/run-all-172.sh` | 8/8 PASSED (incl. connector-registry --check tripwire) |

## Frozen-Invariant Compliance

- No 7th reach minted, no new edge type, no new node type, no new Brain wire opened. `makeReach` + `REACH_IDS` (6) + `POSTURE_IDS` (3) are byte-untouched; the carried drift fences ran green inside `run-all-172.sh`.
- `MAX_K=3`, `DIAL_REACH_K=6`, the 0.70/0.15 RECOMMENDED gate, the F.1 keyboard contract: untouched (not in scope - Part 3 governs the demand-side render; this plan governs the supply-side trigger tiering per Part 11).
- Canon Part 8: the context-tier read is a PURE projection of enums (stage/jtbd/graph_gap) already on tuple+ctx (navigation.cjs populated) - it adds NO filesystem/Brain read on the hot path (T-172-14 mitigated, acceptance grep clean). The evidence object carries only enum/scalar; Test 3 asserts no matched user text reaches evidence (T-172-13 mitigated). The systems-model doc carries only generic machinery prose (no `room/` path, no email).
- Keyword is DEMOTED to a recorded fallback tier, not removed (Part 11 R3: keyword is a fallback, not the basis). The diffusion sensor still fires on keyword-only input (mode='keyword'), preserving coverage while making the demotion legible.

## Deviations from Plan

None of substance - plan executed as written. Three minor in-scope notes, none a scope change:

1. **The tiering seam was established at `normalizeTurn` (the one-seam normalization point) + exposed as exported classifiers, not woven into every sensor.** This is exactly what the plan's `<action>` prescribes ("establish the tiering seam + the mode enum convention and apply it where the turn signals are derived; per-sensor adoption (e.g. SENS-09) is Plan 09"). The existing diffusion sensor already carries the `mode` enum, so the convention has a live exemplar; the closed `TRIGGER_TIERS` vocabulary now constrains it.
2. **`normalizeTurn` gained a trailing optional `tuple` parameter** so it can classify the trigger tier at the seam. It is a backward-compatible trailing param (the 150.5 firability suite, which calls `normalizeTurn`/`dispatchSensors`, stays 22/22 green).
3. **Tests 4 and 5 passed at RED** (the Phase 144 fence and the systems-thinking R1 wiring already held). They are kept as standing regression fences, not deviations - INV-23 requires confirming systems-thinking is CIRS-conformant, and it already is.

## Known Stubs

None. The tier model is a real classifier with a closed ordered vocabulary, fenced by `tests/test-context-driven-trigger.cjs`. Per-sensor adoption of `isContextTier` (the PREFER predicate) across the remaining sensors is explicitly scoped to later 172 waves (Plan 09 for SENS-09), not stubbed here - the seam + the convention + the one live exemplar (diffusion sensor mode enum) are the deliverable.

## Threat Flags

None. This plan adds no new network endpoint, auth path, file-access pattern, or trust-boundary schema change. The context-tier read is a pure projection of enums already in hand (zero new fs/Brain read); the evidence stays enum/scalar-only; the systems-model is a doc. The plan's threat register (T-172-13 evidence info-disclosure, T-172-14 hot-path fs read, T-172-SC no installs) is fully covered by Tests 3-4 and the acceptance grep.

## Self-Check: PASSED
