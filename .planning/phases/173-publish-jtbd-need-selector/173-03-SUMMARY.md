---
phase: 173-publish-jtbd-need-selector
plan: 03
subsystem: publish-visualize
tags: [jtbd, need-selector, sensor, cirs, part-3, part-8, part-9, part-10, part-11, show-share]
requires:
  - data/publish-needs.json (173-01 -- the JTBD need->command map the flow test asserts)
  - lib/core/publish-needs-default-lane.cjs (173-01 -- defaultLaneForRoleBlend, R6)
  - scripts/check-publish-needs.cjs (173-01 -- the --check validator the flow test re-runs)
  - commands/show.md (173-02 -- the /mos:show selector that declares sensor_triggers [SENS-SHOW])
  - lib/core/sensors/sensor-diffusion-adoption.cjs (SENS-09 -- the verbatim structural precedent)
  - lib/core/sensors/sensor-types.cjs (makeReach, REACH_IDS, POSTURE_IDS, classifyTriggerTier)
  - lib/core/insight-sensors.cjs (the dispatchSensors registry SENS-SHOW registers into)
  - lib/workflow/command-resolver.cjs (Phase 122 -- the registry door the flow test resolves through)
provides:
  - lib/core/sensors/sensor-show-share.cjs (SENS-SHOW -- the show/share intent sensor surfacing context_block naming /mos:show)
  - tests/test-show-share-sensor.cjs (the SENS-SHOW unit suite)
  - tests/test-publish-needs-flow.cjs (the R1-R7 end-to-end proof)
  - tests/run-all-173.sh (the phase aggregator)
affects:
  - the dispatchSensors spine (one new sensor registered; no frozen-set move)
tech-stack:
  added: []
  patterns:
    - "new sensor mirrors sensor-diffusion-adoption.cjs verbatim (signal/context/keyword precedence + classifyTriggerTier + makeReach)"
    - "reuse the existing context_block reach -- no 7th reach minted (D-03; SENS-09 brain_consult precedent)"
    - "selector-front-door dispatch resolves through command-resolver, NOT dispatch-framework-map (keeps the map framework-only + its drift test green)"
    - "phase aggregator mirrors run-all-172.sh: bash PASS/FAIL loop + carried frozen-bank drift fences"
key-files:
  created:
    - lib/core/sensors/sensor-show-share.cjs
    - tests/test-show-share-sensor.cjs
    - tests/test-publish-needs-flow.cjs
    - tests/run-all-173.sh
  modified:
    - lib/core/insight-sensors.cjs
decisions:
  - "dispatch-framework-map.json left UNTOUCHED: the drift test requires every value to be a real framework name; /mos:show is a selector front door, not a framework, so the dispatch resolves through the command-resolver path (the plan's green path)"
  - "signal kind 'show_share_intent' + dispatch 'show-jtbd-selector' chosen as the generic SENS-SHOW handles"
  - "SHOW_SHARE_PROBLEM_TYPES is OUR fixed generic enum allow-list for the CONTEXT branch (Part 8-clean)"
metrics:
  duration: ~20m
  completed: 2026-06-23
  tasks: 2
  files: 5
---

# Phase 173 Plan 03: Show/Share Trigger Sensor + End-to-End Flow Summary

The final 173 plan ships the "show my work" wire (R4): SENS-SHOW, a context sensor
that detects show/present/share intent and surfaces the EXISTING `context_block`
candidate reach naming the `/mos:show` JTBD need-selector, registered in the
dispatchSensors registry. The sensor is context-enriched + thresholded downstream
at the canon 0.70 gate (keyword is the fallback tier per D-03), reuses the existing
reach (NO 7th reach minted), and surfaces a STANDING SUGGESTION at the Decision Gate
(posture `hold` -- never auto-opens UI, Canon Part 3 GUIDED default). The plan also
carries the R12 cross-surface Tri-Polar note and the end-to-end test proving the full
R1-R7 selector flow.

## What shipped

### Task 1 -- lib/core/sensors/sensor-show-share.cjs (SENS-SHOW, R4) + registration

A new sensor mirroring `lib/core/sensors/sensor-diffusion-adoption.cjs` (SENS-09)
verbatim in structure: a `SHOW_SHARE_LEXICON` fixed-vocabulary array, a
`SHOW_SHARE_PROBLEM_TYPES` allow-list, `hasShowShareSignal(turn)`,
`textMatchesLexicon(turn)`, `hasShowShareContext(tuple)`, and
`sensorShowShare(turn, tuple, ctx)` with the SIGNAL / CONTEXT / KEYWORD precedence
(Canon Part 11 R3 -- context first, keyword DEMOTED to fallback) and
`classifyTriggerTier` labeling.

The returned reach: `reach_id: 'context_block'` (REUSE the existing reach -- mint NO
7th reach, mirrors SENS-09 reusing `brain_consult`, honoring D-03); `posture: 'hold'`
(a standing SUGGESTION at the Decision Gate, never `push_forward` -- it must NOT
auto-open UI per Canon Part 3 GUIDED default + the "no card unprompted" doctrine);
`dispatch: 'show-jtbd-selector'` (the generic handle the orchestrator routes to
`/mos:show`); `signal: 'show_share_intent'`; `evidence` a flat scalar/enum bag
carrying `{ mode, trigger_tier, problem_type }` ONLY -- never the user's matched text
(Part 8).

The R12 cross-surface Tri-Polar contract is documented as a comment block in the
sensor file: the AskUserQuestion selector `/mos:show` renders is IDENTICAL across
CLI / Desktop / Cowork (host owns the keymap, phase owns the two axes); rendered
RESULTS degrade per the shipped 3-layer model -- inline `ui://` views
(dashboard / wiki / graph, already shipped in `lib/mcp/app-views.cjs`) where Node
cannot run, with an EXPLICIT degradation note (never a silent failure) when a
Node-only result (present / export / snapshot / radar) is requested on
Desktop / Cowork.

Registered in `lib/core/insight-sensors.cjs` exactly as `sensorDiffusionAdoption` is
wired: the require near the other sensor requires, appended to the `SENSOR_REGISTRY`
array, and added to `module.exports`.

Phase 144 fence honored: the file PRODUCES a candidate reach; it never assigns
`routing_source` and never requires/defines `decide()`. Pure / sync / LOCAL-first;
soft-fail to null; never throws.

### Task 2 -- the end-to-end flow test (R1-R7) + the SENS-SHOW unit + the phase aggregator

`tests/test-show-share-sensor.cjs` (32 assertions, mirroring
`test-diffusion-adoption-sensor.cjs`): null without a trigger; fires on
signal / keyword / context with a FROZEN `context_block` reach_id + `hold` posture;
Part-8-clean evidence (scalars/enums, no user prose); registered in
`SENSOR_REGISTRY` + exported from insight-sensors; the dispatch handle is the
`/mos:show` selector route (and is NOT in `dispatch-framework-map.json`);
`dispatchSensors({show turn})` includes a `context_block` reach with
`dispatch: 'show-jtbd-selector'` AND `dispatchSensors({neutral turn})` does not; the
R12 note is present in the sensor file.

`tests/test-publish-needs-flow.cjs` (33 assertions, the R1-R7 proof): (R1) the
selector data renders 4 lanes with zero command-name labels -- every
`publish-needs.json` job label has no `/mos:` token and `_lanes` has exactly 4 ids
matching the frozen `LANES`; (R2/R7) every job `resolves_to` is real (a registry
command or a real `skills/<handle>/` dir) and every job carries a
`connections|gaps` `shows` tag (also re-asserted by re-running the 173-01 validator);
(R3) a job's `resolves_to` resolves via the command-resolver registry door (a
registry member is found; an unknown command resolves to `[]` with no fabrication; a
framework-bearing command roundtrips its declared frameworks); (R4) a
show/share-intent turn fires the `context_block` reach via dispatchSensors at
posture `hold` while a neutral turn does not; (R6) `defaultLaneForRoleBlend({founder:0.7})`
=== `'get-into-world'` and `({researcher:0.8})` === `'find-broken'`.

`tests/run-all-173.sh` (the phase aggregator, mirroring `run-all-172.sh`): runs
`test-publish-needs-map.cjs` (173-01), `test-show-share-sensor.cjs`,
`test-publish-needs-flow.cjs`, AND the carried frozen-bank drift fences
(`test-reach-ids-drift.cjs` / `test-posture-ids-drift.cjs` /
`test-dispatch-framework-map-drift.cjs`) plus the Part-8 sensor sweep
(`test-sensors-part8-sweep.cjs`) to prove 173 is ADDITIVE -- no frozen-set move --
exiting non-zero if any fail.

## Verification

- `bash tests/run-all-173.sh` exits 0: 7/7 suites GREEN (proving the full R1-R7 flow
  + the additive frozen-bank fences).
- The Task 1 plan verify node one-liner passes: SENS-SHOW fires on show/share, null
  on neutral, `context_block` reused.
- REACH_IDS stays length 6; POSTURE_IDS stays length 3 (no 7th reach; D-03 honored).
- `tests/test-dispatch-framework-map-drift.cjs` stays green (the map is untouched --
  the selector dispatch resolves through command-resolver, not the framework map).
- `tests/test-sensors-part8-sweep.cjs` spans the new sensor (13 files, zero Brain
  egress).
- `node scripts/build-connector-registry.cjs --check` exits 0 (the registry is not
  stale; SENS-SHOW needs no connector of its own -- the /mos:show command already
  declares sensor_triggers [SENS-SHOW] from 173-02).
- `bash tests/run-all-172.sh` stays 20/20 (the SENSOR_REGISTRY addition does not break
  the CIRS suite or the reach/posture drift / adversarial verifier).
- No em-dashes in any new or changed file.

## Deviations from Plan

### Auto-fixed / judgment calls

**1. [Rule 3 - Blocking, anticipated by the plan] dispatch-framework-map.json left untouched**
- **Found during:** Task 1 (read `tests/test-dispatch-framework-map-drift.cjs` first, per the plan's explicit direction)
- **Issue:** The drift test requires EVERY mapped value to be a real framework name
  in `data/framework-names.json`. `/mos:show` is a selector front door, not a Brain
  framework, so adding a `show-jtbd-selector` entry would either fail the drift test
  (fake framework) or smuggle a slug.
- **Fix:** Routed the dispatch through the command-resolver path and left
  `dispatch-framework-map.json` untouched -- exactly the green path the plan's
  behavior block prescribed ("If the existing drift test requires every value to be a
  framework-names.json member, route the dispatch through the command-resolver path
  instead and leave dispatch-framework-map untouched"). The flow test asserts the
  selector resolves through `command-resolver.frameworksForCommand` (the registry
  door), and the unit test asserts `show-jtbd-selector` is absent from the map.
- **Files modified:** none (the map was deliberately NOT touched)
- **Commit:** d342bd19

No other deviations -- the plan executed as written.

## Authentication Gates

None.

## Known Stubs

None. SENS-SHOW fires on real show/share intent and surfaces the real, shipped
`context_block` reach naming the live `/mos:show` command (173-02). The lexicon and
the problem-type allow-list are OUR fixed generic vocabulary (Part 8-clean enums),
not stubbed user data. The evidence bag carries only scalars/enums.

## Threat Flags

None. The sensor introduces no new network endpoint, no Brain wire, and no new trust
boundary beyond the `navigator turn -> sensor -> dispatchSensors` boundary the
threat model already covers (T-173-04/05/06 all mitigated: evidence is frozen to
scalar/enum primitives via makeReach; no second selection brain; reach_id stays
`context_block` and the carried reach-id drift fence in run-all-173.sh fails on any
add).

## Self-Check: PASSED

Files (all FOUND):
- lib/core/sensors/sensor-show-share.cjs
- tests/test-show-share-sensor.cjs
- tests/test-publish-needs-flow.cjs
- tests/run-all-173.sh
- lib/core/insight-sensors.cjs (SENS-SHOW registered in SENSOR_REGISTRY + module.exports)

Commits (verified in git log):
- d342bd19: feat(173-03): author sensor-show-share.cjs (SENS-SHOW, R4) + register in dispatchSensors
- 7122176d: test(173-03): end-to-end R1-R7 flow test + SENS-SHOW unit + phase aggregator
