---
phase: 143-insight-sensors-the-7-row-trigger-map
plan: 03
subsystem: sensors
tags: [insight-sensors, trigger-map, sens-04, sens-05, external-fact, hat-scoping, mcp-stack-ask, jtbd-reweight, part-8, phase-144-fence, loop-fires]

# Dependency graph
requires:
  - phase: 143-01
    provides: the SENSOR_REGISTRY dispatch chokepoint + makeReach candidate-reach factory + the Phase 144 routing fence + Part-8 5-tripwire sweep + run-all-143.sh aggregator
  - phase: 143-02
    provides: the registry append convention + the 8-suite run-all-143.sh this plan extends to 10
  - phase: 100-jtbd-inference-engine
    provides: lib/hmi/jtbd-state.cjs (getCurrent/setCurrent/history) -- the shipped-but-unconsumed Phase 104 JTBD signal SENS-05 consumes
  - phase: 122-workflow-layer
    provides: lib/workflow/f-selector-ranker.cjs (the serves_jtbd consumer SENS-05 surfaces the re-weight signal to)
provides:
  - lib/core/sensors/hat-scoping-table.cjs -- the six-hat web-tool scope table (Canon Part 2)
  - lib/core/sensors/sensor-external-fact.cjs -- SENS-04 external-fact detector + hat-scoped WebSearch dispatch + MCP-stack-ask Decision Gate
  - lib/core/sensors/sensor-jtbd-reweight.cjs -- SENS-05 JTBD set/changed re-weight consumer over the shipped jtbd-state
  - 2 net registrations into SENSOR_REGISTRY + 2 appended suites in run-all-143.sh (now 10 suites)
affects: [144-navigation-engine-routing-flip, 146-loop-fires-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SENS-04 is the gate-relevant web sensor: a hat-scope table (Canon Part 2) selects the tool set; Green folds in the deep_research escalation lane (reach_id deep_research vs context_block) as a non-gate-blocking lane"
    - "MCP-stack-ask rule encoded as a tool_choice_gate evidence flag + a tool_choice:Tavily/Firecrawl/Exa companion, set UNLESS ctx.hat_tool_preconfigured names the hat -- never a silent WebSearch dispatch"
    - "SENS-04 web query is public SIGNAL: the reach carries only a generic public TOPIC HANDLE (an external-fact category enum classified from the turn), never the turn text or artifact bytes (Part 8 SIGNAL->Brain: NO)"
    - "SENS-05 is a pure CONSUMER over shipped jtbd-state: reads getCurrent + history, detects current-slug != prior-transition, surfaces serves_jtbd + ADDRESSES_PROBLEM_TYPE handles; reads only slug/transition fields, never the evidence array"

key-files:
  created:
    - lib/core/sensors/hat-scoping-table.cjs
    - lib/core/sensors/sensor-external-fact.cjs
    - lib/core/sensors/sensor-jtbd-reweight.cjs
    - tests/test-sens04-external-fact-fires.cjs
    - tests/test-sens05-jtbd-reweight-fires.cjs
  modified:
    - lib/core/insight-sensors.cjs
    - tests/run-all-143.sh

decisions:
  - "SENS-04 posture is push_forward -- an external-fact reference is a signal to push outward for public SIGNAL evidence, not pull back"
  - "Green-hat external-fact reach uses reach_id deep_research (the escalation lane); every other web-enabled hat uses context_block (the shallow lookup)"
  - "Red Hat returns null (intuition only); hatScopeFor sets web_enabled=false for Red so the detector short-circuits before constructing a reach"
  - "Unknown/absent hat falls back to a White-like data lane WITH the tool-choice gate active (never auto-deep-research, never silent) so an unrecognized hat still asks"
  - "SENS-05 posture is hold -- a JTBD change re-weights the menus and holds for the navigator's next Decision Gate selection; the sensor surfaces the slug, f-selector-ranker re-ranks"
  - "SENS-05 change-detection reads the most-recent history row whose `to` equals the current slug and compares its `from`; a first-ever set or a re-set to the same slug is not a change (no spurious re-weight)"

metrics:
  duration: ~6m
  completed: 2026-06-06
  tasks: 2
  files: 7
  tests: 2 new suites / 11 assertions; full run-all-143.sh = 10 suites, all green
---

# Phase 143 Plan 03: SENS-04 / SENS-05 Detectors Summary

The two remaining detection paths of the 7-row trigger map. SENS-04 is the
gate-relevant net-new web sensor (external-fact reference -> hat-scoped WebSearch,
honoring the MCP-stack-ask rule, public SIGNAL only). SENS-05 is the consumer over
the shipped-but-unconsumed Phase 104 JTBD signal (set/change -> re-weight the
selector menus + Brain queries). After this plan every row of the 7-row map has a
sensor that FIRES on its signal; the full Phase 143 acceptance surface (7 SENS
suites + the Phase 144 routing fence + the Part-8 sweep) is composable by Phase 146.

## What Shipped

- **lib/core/sensors/hat-scoping-table.cjs**: `hatScopeFor(hat)` returns the hat's
  web scope per Canon Part 2 EXTERNAL WEB affordance -- White=Tavily+arxiv (data),
  Green=patents+arxiv+deep-research (innovation), Black=failure/risk, Yellow=
  success/benefit, Red=intuition-only (web_enabled=false), Blue=synthesis. Pure
  lookup, zero I/O, no user content.

- **lib/core/sensors/sensor-external-fact.cjs (SENS-04)**: the gate-relevant web
  sensor. Classifies WHICH external-fact category was named (competitor / market /
  state-of-the-art / benchmark / prior-art / incumbents) into a generic public
  TOPIC HANDLE, looks up the active hat's scope, and surfaces a hat-scoped
  `/mos:research` (WebSearch) reach. Green -> `deep_research` lane; other
  web-enabled hats -> `context_block`. Red -> null. The MCP-stack-ask gate sets a
  `tool_choice_gate` flag + a `tool_choice:Tavily/Firecrawl/Exa` companion UNLESS
  `ctx.hat_tool_preconfigured` names the hat; never a silent WebSearch. The reach
  payload carries ONLY the generic topic handle (Part 8 SIGNAL->Brain: NO) --
  never the turn text or artifact bytes.

- **lib/core/sensors/sensor-jtbd-reweight.cjs (SENS-05)**: the consumer over the
  shipped Phase 104 `jtbd-state` (getCurrent + history). Detects a set/change
  event (current jtbd slug differs from what it transitioned FROM) and surfaces a
  `context_block` / `hold` reach carrying `serves_jtbd:<slug>` (the selector-menu
  re-weight `f-selector-ranker` consumes as `roomState.activeJtbd`) +
  `ADDRESSES_PROBLEM_TYPE:<enum>` (the Brain-query weighting, generic enum only).
  No-change returns null. Reads only the slug + transition fields -- never the
  evidence array -- so no user content rides the reach. Does NOT re-rank inline.

- **2 new loop-fires suites** (11 assertions) + **run-all-143.sh** appended (now 10
  suites: all 7 SENS + the spine dispatch + the routing fence + the Part-8 sweep).

## Hard Fences Honored

- **Phase 144 fence (no routing_source flip):** neither Plan-03 detector assigns
  `routing_source = 'engine'`, requires `navigation-engine.cjs`, or defines/calls
  `decide()`. The inherited `test-sensors-routing-fence.cjs` spans both new files
  and passes; the verification grep
  `routing_source\s*[:=]\s*['"]engine['"]` over `lib/core/sensors/` returns zero.
- **Part 8 (SENS-04 web is public SIGNAL; SIGNAL->LOCAL yes, SIGNAL->Brain no):**
  SENS-04's web-query payload carries only the generic public topic handle; the
  no-leak test injects secret artifact text into turn/tuple/ctx and asserts none
  of it appears in the reach. SENS-05 carries only the JTBD slug + problem-type
  enum. The inherited Part-8 5-tripwire sweep (no packet/brain-client require, no
  projection token, no hashing call site) passes over all six sensor files.
- **MCP-stack-ask rule (no silent WebSearch):** SENS-04 surfaces a tool-choice
  Decision Gate unless the hat is pre-configured; `/silent/i` matches nowhere in
  the reach.
- **Reuse before build (Part 7):** SENS-04 dispatches the shipped `/mos:research`
  + WebSearch via a handle; SENS-05 reads the shipped Phase 104 jtbd-state and
  surfaces the signal `f-selector-ranker` already consumes. Neither re-implements
  its engine.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes (Rules 1-3) were needed; no
architectural decisions (Rule 4) arose. No authentication gates. No package
installs.

## TDD Gate Compliance

Both tasks followed the RED -> GREEN cycle. Each has a `test(...)` (RED) commit
preceding its `feat(...)` (GREEN) commit in git log:
- SENS-04: `1adf147d` test -> `46527ea4` feat
- SENS-05: `9d26cd30` test -> `8f99f94b` feat

No refactor commit was needed.

## Verification

- `bash tests/run-all-143.sh` -> Total 10, Passed 10, Failed 0, exit 0.
- `node tests/test-sensors-part8-sweep.cjs` -> PASS over all six sensor files
  (spine + 5 detectors).
- `node tests/test-sensors-routing-fence.cjs` -> PASS over all six sensor files.
- `grep -rEn "routing_source\s*[:=]\s*['"]engine['"]" lib/core/sensors/` -> 0 matches.
- Zero new dependencies (pure CJS, node built-ins + project libs).
- Zero em-dashes across all touched files.

## Commits

- `1adf147d` test(143-03): failing SENS-04 external-fact loop-fires test
- `46527ea4` feat(143-03): SENS-04 external-fact detector + hat-scoping table + MCP-stack-ask gate
- `9d26cd30` test(143-03): failing SENS-05 jtbd-reweight loop-fires test
- `8f99f94b` feat(143-03): SENS-05 JTBD re-weight consumer + register both Plan-03 suites

## Self-Check: PASSED

All 5 created files + the SUMMARY exist on disk; all 4 task commits present in git log.
