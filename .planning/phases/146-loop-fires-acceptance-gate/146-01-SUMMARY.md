---
phase: 146-loop-fires-acceptance-gate
plan: 01
subsystem: acceptance-gate
tags: [dogfood, acceptance, navigation-engine, sensors, hat-scoping, part-6, part-8]
canon_parts: [Part 2, Part 3, Part 6, Part 8]
requirements: [ACPT-01, ACPT-02]
dependency_graph:
  requires:
    - lib/core/navigation-engine.cjs decide() (Phase 144, shipped)
    - lib/core/skill-activation-router.cjs routeActivation (Phase 91, shipped)
    - lib/core/insight-sensors.cjs dispatchSensors + SENS-06 (Phase 143, shipped)
    - lib/core/sensors/sensor-external-fact.cjs (Phase 143-03, shipped)
    - lib/core/sensors/hat-scoping-table.cjs (Phase 143-03, shipped)
    - scripts/explain-decision-command.cjs (Phase 91-05, shipped)
  provides:
    - "ACPT-01 hermetic dogfood driver (engine-fires)"
    - "ACPT-02 hermetic dogfood driver (hat-scoped WebSearch)"
    - "shared synthetic-room fixture builder for every ACPT driver"
  affects:
    - "Phase 146 Plan 04 aggregator (doctor --dogfood-acceptance + run-all-146.sh) -- both suites compose in unchanged"
tech-stack:
  added: []
  patterns:
    - "single node-runnable suite (ok/fail counters + process.exit(failed===0?0:1)), modeled on test-nav01-populated-room-engine-fires.cjs"
    - "REAL-unit-driven acceptance (no stubs of decide()/sensorExternalFact); MOS_NAV_TEST_FIRE_SKILL deleted defensively"
    - "Part-8 fence by whole-object JSON.stringify sentinel-absence assertion"
key-files:
  created:
    - tests/dogfood/fixtures/synthetic-room.cjs
    - tests/test-acpt-01-engine-fires.cjs
    - tests/test-acpt-02-websearch-hat-scoped.cjs
  modified: []
decisions:
  - "ACPT-01 drives the decide()->routeActivation BOUNDARY (the exact production wiring at intent-classifier.cjs:1385), not the classifier hot path, because the hot path builds the engine turn from a conversation seed and has no parameter to thread turn.signals:['artifact_filed'] without setting the forbidden stub."
  - "ACPT-02 is hermetic (a scripted assertion over the LOCAL sensorExternalFact + hatScopeFor path), not a live web call. The hat-scoping (Part 2) + Part-8 no-user-content fence are fully assertable on the LOCAL sensor, so no live WebSearch leg and no autonomous:false marker are needed -- the criterion runs fully autonomously."
metrics:
  duration: ~25m
  completed: 2026-06-08
---

# Phase 146 Plan 01: ACPT-01 + ACPT-02 Dogfood Acceptance Drivers Summary

Two hermetic, fully-autonomous acceptance legs that PROVE the loop FIRES (Canon Part 6) by driving the REAL shipped units, not stubs: ACPT-01 flips routing_source legacy->engine on a REAL fired SENS-06 sensor through the production decide()->routeActivation boundary and renders it via the REAL explain-decision CLI; ACPT-02 proves the REAL sensorExternalFact surfaces a hat-scoped WebSearch reach carrying only a generic topic handle (Part 8). Plus a shared synthetic (obviously-fictional) fixture-room builder.

## What Was Built

### Task 1 -- shared synthetic-room fixture + ACPT-01 engine-fires driver

- `tests/dogfood/fixtures/synthetic-room.cjs` (108 lines) -- `makeSyntheticRoom(opts)` returns an absolute roomDir under `os.tmpdir()` with `.mindrian/` created plus a `cleanup()`. Default slug `acme-fictional-widgets-DOGFOOD` (threat model T-146-03: no real client data). `opts.contradict` writes the shipped SENS-06 CASC-01 side-channel (`.mindrian/last-cascade.json` with a CONTRADICT newFinding); `opts.sentinel` writes a fictional sentinel into the finding body for the Part-8 proof; `opts.activeRegistry` writes a rooms-home + `.rooms/registry.json` so explain-decision's `resolveActiveRoomDir` resolves the fixture.
- `tests/test-acpt-01-engine-fires.cjs` (319 lines) -- Tests A-D + a stub-absence guard:
  - **A (POSITIVE, REAL sensor, no stub):** contradict room -> `engine.decide()` -> `fire_skill === "Devil's Advocate"` (canonical verb) -> `router.routeActivation` -> `source === 'engine'` + `reason === 'engine_fire_skill_set'`. No `MOS_NAV_TEST_FIRE_SKILL` anywhere.
  - **B (TRACE PERSIST + RENDER):** drives the REAL engine, persists a `decision-traces/<session>.json` turn merging `routing_source: engine` + the fired reach (mirroring the intent-classifier merge shape), then spawns the REAL `scripts/explain-decision-command.cjs` (with `MINDRIAN_ROOMS_HOME` + `--session`) and asserts stdout contains `source: engine` AND `contradiction` AND `pull_back`.
  - **C (NEGATIVE, honest):** cold room -> `fire_skill` null -> `source === 'legacy'`. The gate is not a false-green.
  - **D (Part 8 provenance):** the chosen_rationale names reach_id + posture ONLY; the fictional sentinel is absent from both the rationale and the whole decision struct.
- Result: 5/5 checks pass, exits 0.

### Task 2 -- ACPT-02 hat-scoped WebSearch driver (Part 2 + Part 8)

- `tests/test-acpt-02-websearch-hat-scoped.cjs` (236 lines) -- Tests A-E, driving the REAL `sensorExternalFact` + `hatScopeFor`:
  - **A (White):** competitor/market turn -> reach reflecting `hatScopeFor('White')` (Tavily + arxiv); reach_id `context_block`; topic_handle `competitor`.
  - **B (varies by hat):** Green -> `deep_research` lane reflecting patents + arxiv + deep-research; Red -> null (web_enabled=false, no external tool per Canon Part 2).
  - **C (Part 8, load-bearing):** a turn carrying `SECRET-MARGIN-42pct-FICTIONAL` -> `JSON.stringify(reach)` does NOT contain the sentinel; only the generic `competitor` handle rides.
  - **D (MCP-stack-ask gate):** un-preconfigured hat -> `tool_choice_gate: true` + a `tool_choice:` offer (no silent dispatch); preconfigured hat -> gate skipped, `tool_preconfigured:` handle rides.
  - **E (no-match negative):** a non-external-fact turn returns null (no over-fire).
- Result: 7/7 checks pass, exits 0.

## Verification

| Criterion | Result |
|-----------|--------|
| `node tests/test-acpt-01-engine-fires.cjs` exits 0 | PASS (5/5) |
| `node tests/test-acpt-02-websearch-hat-scoped.cjs` exits 0 | PASS (7/7) |
| em-dash (U+2014) count across all three created files | 0 |
| Both suites delete `MOS_NAV_TEST_FIRE_SKILL` defensively | PASS (both) |
| Drive REAL shipped units (no stubs of decide()/sensorExternalFact) | PASS |
| min_lines (90 / 80 / 40) | 319 / 236 / 108 |
| ACPT-01 honest-negative (cold room -> legacy) | PASS |
| ACPT-02 hat-scoping varies + Part-8 fence + no over-fire | PASS |

## Canon Compliance

- **Part 6 (Product-as-Venture / dog-fooding):** both legs prove the loop FIRES against the REAL shipped units, not stubs -- the prove-it-fires-not-exists mandate.
- **Part 8 (Graph Boundary):** ACPT-01 Test D + ACPT-02 Test C assert (by whole-object stringify) that no fictional user-content sentinel rides the trace/reach; only generic enums (reach_id, posture, topic_handle) flow.
- **Part 2 (Team / hat-scoped External Web):** ACPT-02 proves White/Green/Red hat scoping via the shipped `hat-scoping-table.cjs`.
- **Part 3 (Decision Gate):** ACPT-02 Test D proves the MCP-stack-ask `tool_choice_gate` -- no silent WebSearch dispatch.
- **Part 7 (Reuse Before Build):** zero production code added; the units under test (decide / sensors / explain-decision) all shipped in Phases 91/143/144. This plan adds only the acceptance harness. The fixture is modeled on the existing `makePopulatedContradictRoom` (test-nav01).

## TDD Gate Compliance

Per Canon Part 7 reuse, the units under test shipped GREEN in Phases 143/144. There was no RED phase to author here -- the tests assert already-shipped behavior, so both commits are `test(...)` (no separate `feat(...)` GREEN commit). This mirrors the Phase 145 Plan 03 precedent (a verification suite over already-green units). The behavior-adding source code is owned by the prior phases; this plan is test-only.

## Deviations from Plan

None - plan executed exactly as written. Both drivers and the fixture match the plan's behavior blocks and acceptance criteria; both suites exit 0 on the first authored run.

## Commits

- `d9f12218` test(146-01): ACPT-01 engine-fires driver + synthetic-room fixture
- `307cca84` test(146-01): ACPT-02 hat-scoped WebSearch driver (Part 2 + Part 8)

## Self-Check: PASSED

- FOUND: tests/dogfood/fixtures/synthetic-room.cjs
- FOUND: tests/test-acpt-01-engine-fires.cjs
- FOUND: tests/test-acpt-02-websearch-hat-scoped.cjs
- FOUND commit: d9f12218
- FOUND commit: 307cca84
