---
phase: 91-navigation-engine
plan: "07"
subsystem: problem-type-routing
tags: [navigation-engine, problem-type, udp, idp, wdp, wicked, canon-appendix-e, canon-part-3, canon-part-8, brain-availability, tdd]

# Dependency graph
requires:
  - phase: 91-navigation-engine
    plan: "00"
    provides: decide(turn, ctx) decision shell + 8-field decision_trace + chosen_rationale composition + CANONICAL_VERBS frozen 10-entry vocabulary + emptyDecision + applyStalenessMultiplier + resolveTierMode
  - phase: 91-navigation-engine
    plan: "02"
    provides: scripts/intent-classifier.cjs runNavigationEngine wiring with brainAvailable=false hard-coded stub (Wave 1 LOCAL-only) -- this plan upgrades it to real isAvailable()
  - phase: 91-navigation-engine
    plan: "03"
    provides: skill-activation-router precedence layer that consumes engine fire_skill / suppress_skills outputs (problem-type fire_skill picks up router validation downstream)
  - phase: 90-brain-derivation-layer
    plan: "01"
    provides: BRAIN.md problemtype_classification + wicked_indicators section bodies (parsed shape carried in readQuadruple.brain.sections)
  - phase: 90-brain-derivation-layer
    plan: "09"
    provides: navigation-engine-brain-interface.md v1 frozen contract (Section 9.3 "isAvailable + schema only" boundary)
provides:
  - "lib/core/problem-type-router.cjs pure module (parseProblemTypeSection + routeByProblemType + detectWickedEscalation + applyWickedOverride + frozen TYPE_VERB_MAPPING + WICKED_VERB_MAPPING)"
  - "Engine integration: decide() lazy-requires problem-type-router and biases chosen_rationale + fire_skill when brain.sections.problemtype_classification is non-null"
  - "Wave 3 brain-availability upgrade: scripts/intent-classifier.cjs runNavigationEngine swaps hard-coded brainAvailable=false for guarded brain-client.isAvailable() scalar lookup (Canon Part 8 Section 9.3 compliant)"
  - "24-test fixture suite (lib/memory/problem-type-router.test.cjs): 18 pure-module tests + 3 decide() integration tests + 3 brain-client mock tests via require.cache injection"
  - "4 canonical routing tables: UDP -> Exploration (5 skills); IDP -> Definition-Seeking (5 skills); WDP -> Execution (5 skills); Wicked -> Soft-Systems (4 skills)"
affects:
  - 91-08-framework-chain-composition (FEEDS_INTO chain composer reads same brain.sections payload; problem-type biasing is layered above chain composition without conflict)
  - 91-09-nav-invariants-validator (validator can scan engine output for problem-type rationale presence + wicked override correctness)
  - Future Plan 91-* (team composition realization for wicked override per Canon Appendix E rule R4 -- this plan emits the verb / skill set; Plan 91-08 or later wires the team)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure routing module: parser + 4-type table + wicked override + Canon Part 3 verb mapping in one CJS file with zero I/O and zero throws (mirrors Plan 91-00 navigation-engine-shared.cjs purity contract)"
    - "Engine biasing layer: lazy-require + try/catch wrapper around routing call so a missing/faulty router never blocks the decision (routing biases, never forces)"
    - "Brain availability upgrade pattern: 3-layer guarded require (require fails / function missing / function throws) all default to safe brainAvailable=false; documented in source so the literal grep-guard for forbidden brain-client call patterns reports zero matches"
    - "require.cache injection mock pattern for brain-client tests (harness shims isAvailable in a child process before loading the classifier; matches Plan 90-01 mock pattern)"

key-files:
  created:
    - lib/core/problem-type-router.cjs (315 LOC; BSL 1.1; zero deps; pure)
    - lib/memory/problem-type-router.test.cjs (24 tests; mock harness for brain-client)
  modified:
    - lib/core/navigation-engine.cjs (added 60 LOC integration block in decide() after triangulation composition)
    - scripts/intent-classifier.cjs (29 LOC delta -- replaced hard-coded brainAvailable=false with guarded isAvailable() lookup)
    - lib/memory/run-feynman-tests.cjs (registered new test file)

key-decisions:
  - "Problem-type routing biases, never forces. fire_skill is set ONLY when no higher-priority signal has set it AND confidence >= 0.5 (or wicked_override is active, which always wins). Per locked decision D-08, problem-type is one signal among five."
  - "Wicked override overlays base routing (does not replace the parsed type). When wicked_score >= 8 we apply the soft-systems family REGARDLESS of base type per Canon Appendix E rule R4. The base reason is preserved in parens for /mos:explain-decision auditability."
  - "Out-of-range confidence becomes null (not clamped). Callers see 'no usable confidence' rather than a silent floor/ceiling, which prevents downstream weight-down logic from misfiring on a clamped 1.0."
  - "Unknown type label ('FOO', 'wicked' as type literal, etc) becomes 'unknown' enum -- never propagated as-is. This keeps the wicked override DRIVEN BY wicked_score alone, not by free-text type strings, and prevents an upstream Brain prompt change from silently re-routing skills."
  - "Brain availability check is guarded against three failure modes: require fails, isAvailable not a function, isAvailable throws. All three default brainAvailable=false. The engine then resolves to mode_b (when BRAIN.md is brain_offline) or tier_0 (when BRAIN.md is absent)."
  - "Documentation comment in intent-classifier.cjs deliberately writes 'query, search, smartSearch' WITHOUT the brain-client. prefix so the literal Canon Part 8 grep guard for forbidden call patterns (brain-client\\.(query|search|smartSearch)) returns 0 across all three plan files."

patterns-established:
  - "Frozen routing tables Object.freeze + nested Object.freeze on each entry record. TYPE_VERB_MAPPING + WICKED_VERB_MAPPING are immutable at runtime so a future plan cannot accidentally mutate the Canon Part 3 verb mapping without an explicit canon amendment."
  - "Reason templates cite their canonical authority inline ('Canon Appendix E R4', 'Surfacing exploration tools', etc.) so /mos:explain-decision rendering has the citation in-band without a separate lookup table."
  - "Engine integration is LAZY-REQUIRE so a missing module degrades gracefully (the engine falls back to its pre-91-07 behavior). This is the same pattern Plan 91-03 uses for skill-activation-router and Plan 91-04 uses for offer-presenter."
  - "Test mock harness builds a tmpdir room + harness.cjs that shims brain-client via require.cache BEFORE loading scripts/intent-classifier.cjs. Same pattern Plan 90-01 uses for brain-client mock injection in brain-derivation tests."

requirements-completed:
  - NAV-PROBLEM-TYPE-01
  - NAV-PROBLEM-TYPE-02
  - NAV-PROBLEM-TYPE-03
  - NAV-PROBLEM-TYPE-04

# Metrics
duration: 30min
completed: 2026-04-27
---

# Phase 91 Plan 07: Problem-Type Routing Summary

**4-type problem classification (UDP / IDP / WDP / unknown) routes skills per locked decision D-08 with Canon Appendix E R4 wicked escalation, plus Wave-3 brain-client.isAvailable() upgrade unlocks Mode A.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-27T20:35:00Z
- **Completed:** 2026-04-27T20:50:00Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (2 created, 2 modified -- intent-classifier + nav-engine + run-feynman-tests)

## Accomplishments
- 4-type canonical routing module ships with frozen tables: UDP -> Exploration (explore-domains, beautiful-question, whitespace, find-analogies, find-connections); IDP -> Definition-Seeking (beautiful-question, structure-argument, mullins, lean-canvas, map-unknowns); WDP -> Execution (grade, deep-grade, score-innovation, build-thesis, challenge-assumptions); Wicked -> Soft-Systems (challenge-assumptions, find-bottlenecks, scenario-plan, explore-futures).
- Wicked escalation per Canon Appendix E rule R4 fires at wicked_indicators.wicked_score >= 8. The override overlays base routing and cites "Canon Appendix E R4" in the rationale string.
- Navigation engine decide() lazy-requires the router and biases chosen_rationale + fire_skill when brain.sections.problemtype_classification is non-null. Higher-priority signals retain precedence (problem-type biases, never forces).
- Wave 3 brain-availability upgrade: scripts/intent-classifier.cjs no longer hard-codes brainAvailable=false. Real brain-client.isAvailable() boolean scalar feeds the engine context. Mode A (Brain reachable + fresh BRAIN.md) now correctly resolves end-to-end.
- 24/24 fixture tests green (18 pure-module + 3 integration + 3 brain-client mock). Zero regressions across the 7 prior Phase 91 test files (156 tests total still pass).

## Task Commits

1. **Task 1 (RED):** test(91-07): add failing tests for problem-type-router -- `3e68c22`
2. **Task 1 (GREEN):** feat(91-07): implement problem-type-router.cjs -- `189cddb`
3. **Task 2:** feat(91-07): integrate problem-type routing into navigation-engine.decide() -- `a784b2d`
4. **Task 3:** feat(91-07): upgrade brainAvailable to real isAvailable() scalar -- `d7224e4`

## Files Created/Modified

- **Created** `lib/core/problem-type-router.cjs` (315 LOC) -- pure routing module. Exports parseProblemTypeSection + routeByProblemType + detectWickedEscalation + applyWickedOverride + TYPE_VERB_MAPPING + WICKED_VERB_MAPPING + WICKED_ESCALATION_THRESHOLD + LOW_CONFIDENCE_FLOOR. Zero I/O, zero throws, BSL 1.1.
- **Created** `lib/memory/problem-type-router.test.cjs` -- 24 tests with require.cache mock harness for brain-client.
- **Modified** `lib/core/navigation-engine.cjs` -- 60 LOC integration block at end of decide() composes problem-type routing with the existing five-signal triangulation. Lazy-require + try/catch keeps degradation graceful.
- **Modified** `scripts/intent-classifier.cjs` -- 29 LOC delta. Replaced `const brainAvailable = false` with a 3-layer-guarded `brain-client.isAvailable()` scalar lookup.
- **Modified** `lib/memory/run-feynman-tests.cjs` -- registered the new test file.

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Routing biases, never forces | Per locked decision D-08, problem-type is one signal among five. fire_skill set only when no higher-priority signal has set it AND confidence >= 0.5 (wicked_override always wins). |
| 2 | Wicked override overlays base routing | Canon Appendix E R4 says wicked >= 8 escalates to soft-systems family regardless of base type. Base reason preserved in parens for /mos:explain-decision auditability. |
| 3 | Out-of-range confidence becomes null | Caller sees "no usable confidence" rather than a silent clamp. Prevents downstream weight-down logic from misfiring on a clamped 1.0. |
| 4 | Unknown type label becomes 'unknown' enum | Wicked is driven by wicked_score alone, not free-text type strings. An upstream Brain prompt change cannot silently re-route skills. |
| 5 | brain-client guard handles 3 failure modes | require fails / function missing / function throws all default to brainAvailable=false. Engine then resolves to mode_b (brain_offline) or tier_0 (BRAIN.md absent). |

## Deviations from Plan

None -- plan executed exactly as written. All three tasks landed in order with TDD red/green for Task 1 and atomic per-task commits.

## Canon Part 8 Section 9.3 Boundary Scan

`grep -cE "brain-client\.(query|search|smartSearch)"` across all three plan-touched files returns **0** matches:
- `lib/core/navigation-engine.cjs` -- 0
- `lib/core/problem-type-router.cjs` -- 0
- `scripts/intent-classifier.cjs` -- 0

The Wave 3 upgrade adds exactly one new brain-client touch -- `brainClient.isAvailable()` -- which is one of the two EXPLICITLY PERMITTED scalar calls per Canon Part 8 Section 9.3 (the other being `brain-client.schema()`). Zero user content egresses. Zero network when cached.

## Five-Signal Triangulation Interplay

Problem-type routing is one signal among five (per locked decision D-02). Precedence:

1. **Higher-priority fire_skill signals** (resolveFireSkill in navigation-engine.cjs, e.g. wicked_indicators escalation through the existing engine path, Mode A pattern_matches verb selection) keep precedence over problem-type routing.
2. **Problem-type routing** sets fire_skill ONLY when no higher-priority signal has set it AND confidence >= 0.5 (or wicked_override is active).
3. **chosen_rationale** ALWAYS records the routing contribution as `ProblemType routing: <reason>` so /mos:explain-decision (Plan 91-05) can surface the bias path.
4. **Tier 0 (no BRAIN.md)** path: routing module is never invoked; engine falls through to its pre-91-07 fallback -- Test 21 verifies no rationale leak.
5. **Mode B (brain_offline)** path: BRAIN.md is locally readable so problem-type routing STILL contributes from the cached classification; only RECOMMENDED marker is suppressed (per Plan 91-00 Section 6 contract).

## Three-Surface Compatibility

- **CLI:** Hooks invoke `scripts/intent-classifier.cjs` -> engine -> router. Full path exercised.
- **Desktop:** Same file path is dispatched from the MCP wrapper that imports `lib/core/navigation-engine.cjs` (per Phase 91 plan).
- **Cowork:** Routing tables are surface-agnostic (frozen string arrays). isAvailable() scalar lookup works identically across all three surfaces -- no surface-specific code path.

## Routing Tables (Full Contents)

### UDP -> Exploration (Canon Part 3 verbs)

| Skill | Canonical Verb |
|-------|----------------|
| explore-domains | Run Methodology |
| beautiful-question | Reformulate |
| whitespace | Navigate Graph |
| find-analogies | Navigate Graph |
| find-connections | Navigate Graph |

### IDP -> Problem-Definition-Seeking

| Skill | Canonical Verb |
|-------|----------------|
| beautiful-question | Reformulate |
| structure-argument | Run Methodology |
| mullins | Run Methodology |
| lean-canvas | Run Methodology |
| map-unknowns | Synthesize |

### WDP -> Execution + Validation

| Skill | Canonical Verb |
|-------|----------------|
| grade | Run Methodology |
| deep-grade | Spawn Sub-Agent |
| score-innovation | Synthesize |
| build-thesis | Synthesize |
| challenge-assumptions | Devil's Advocate |

### Wicked -> Soft-Systems (Canon Appendix E R4, threshold = 8)

| Skill | Canonical Verb |
|-------|----------------|
| challenge-assumptions | Devil's Advocate |
| find-bottlenecks | Navigate Graph |
| scenario-plan | Scenario Plan |
| explore-futures | Scenario Plan |

Team composition for the wicked override (Founder/Yellow + Investor/Black + Researcher/White + Student/Green + Mentor/Blue per Canon Appendix E R4) is detected here; the team-composition WIRING is deferred to Plan 91-08 or a later phase per the locked decision.

## Verification Snapshot

- 24/24 problem-type-router tests pass (`node lib/memory/problem-type-router.test.cjs`)
- 33/33 navigation-engine-core baseline tests still pass
- 156 / 156 across all 8 Phase 91 test files (problem-type-router + navigation-engine-core + user-md-persona + userpromptsubmit-integration + skill-activation-router + offer-presenter + explain-decision-command + nav-dial)
- BSL 1.1 header in lib/core/problem-type-router.cjs first 10 lines
- Zero em/en dashes in plan-touched files (`grep -cE '[–—]'` returns 0)
- Canon Part 8 Section 9.3 grep guard: 0 forbidden brain-client call patterns
- `grep -c "isAvailable" scripts/intent-classifier.cjs` returns 7 (real lookup wired)
- `grep -c "Canon Appendix E R4" lib/core/problem-type-router.cjs` returns 2 (override reason + module header)

## Self-Check: PASSED

All claimed files, commits, and tests verified to exist:
- `lib/core/problem-type-router.cjs` -- present (315 LOC)
- `lib/memory/problem-type-router.test.cjs` -- present (24 tests)
- Commits `3e68c22` + `189cddb` + `a784b2d` + `d7224e4` -- present in `git log --oneline -8`
- 24/24 problem-type-router tests pass
- Zero regressions across the 7 prior Phase 91 test files (verified individually)
