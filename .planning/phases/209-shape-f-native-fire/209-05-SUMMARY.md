---
phase: 209-shape-f-native-fire
plan: 05
subsystem: sensors
tags: [room-pick, conversational-gate, sens-spine, context_block]

requires:
  - phase: 209-shape-f-native-fire (plan 01)
    provides: "the E1/E2/E3 trailer + contract seams this sensor's rendered envelope ultimately rides through pickShape"
  - phase: 204 (ignite-room-chooser-persona-entry)
    provides: "lib/core/room-chooser.cjs (listRegisteredRooms, hasResumableRooms, renderRoomChooserCard) - the registry adapter and card door this sensor calls, never hand-rolls"
provides:
  - "lib/core/sensors/sensor-room-pick.cjs (SENS-12) - detects the mid-dialogue room resume/switch fork and injects the room-chooser card envelope"
  - "SENSOR_REGISTRY entry in lib/core/insight-sensors.cjs (appended, canonical order preserved)"
  - "tests/test-209-room-pick-sensor.cjs - 7-assertion fire/no-fire/fault-degrade/envelope/spine-ride proof"
affects: [209-06, 209-07]

tech-stack:
  added: []
  patterns:
    - "High-precision lexicon detection with an explicit prior-rooms-exist precondition and an own-command-flow exclusion, rather than a broad keyword scan"
    - "renderRoomChooserCard's return carries rendered.zones (header/body/signals/footer), not a flat rendered.text field - the envelope composer joins zones the same way scripts/intent-classifier.cjs's emitBindingGate bodyLines idiom does"

key-files:
  created:
    - lib/core/sensors/sensor-room-pick.cjs
    - tests/test-209-room-pick-sensor.cjs
  modified:
    - lib/core/insight-sensors.cjs

key-decisions:
  - "The sensor carries the FULL rendered card envelope (text + marker + binding + an imperative instruction) as a single evidence STRING field, departing from the closed-scalar-only evidence convention its two most recent sibling sensors (sensor-expert-skill.cjs SENS-11, sensor-show-share.cjs SENS-SHOW) both use. This is a documented, reasoned departure: the plan's own acceptance criteria (grep for renderRoomChooserCard inside the sensor file; the fired envelope must literally contain the marker/BINDING/instruction substrings) require it, and no downstream context_block-to-rendered-card consumer is wired anywhere in this phase to compose the card from a bare scalar reach instead."
  - "Detection lexicon is a fixed phrase list (resume work on / switch to my / back to my room / which room / etc.), not a broad single-keyword scan, to keep the false-fire rate low (T-209-19) - a bare mention of the word room elsewhere in a sentence must not trigger the card."
  - "The sensor excludes turns already inside the ignite or rooms command flow (ctx.activeCommand) since those commands own their own room-pick gates already."

patterns-established:
  - "buildEnvelope's zones-to-text assembly (header, body, signals, footer in that order) mirrors the E4 emitBindingGate bodyLines idiom exactly, keeping the two envelope-composition sites consistent"

requirements-completed: [E5]

duration: unknown (manual implementation)
completed: 2026-07-02
---

# Phase 209 Plan 05: SENS-12 Room-Pick Sensor (E5) Summary

**The incident's actual fork - a conversationally-reached room resume/switch, no command, no engine dial - now carries a transport: a new sensor detects the pattern and injects the full self-decoding room-chooser card envelope (rendered text + marker + BINDING + an imperative dispatch instruction), minted exclusively through the shipped SEED-020 door.**

## Performance

- **Tasks:** 2 completed
- **Files modified:** 3 (2 new: sensor + test; 1 modified: registry)

## Accomplishments

- `lib/core/sensors/sensor-room-pick.cjs`: `sensorRoomPick(turn, _tuple, ctx)` fires only when a fixed room-pick lexicon matches the turn text, the turn is not already inside ignite/rooms' own gate, and at least one resumable room exists. Mints the card via `lib/core/room-chooser.cjs::renderRoomChooserCard` only (zero direct per-shape renderer calls, zero new dispatcher branch).
- Rides the existing `context_block` reach (Phase 148 lockstep, no 7th reach minted), registered in `SENSOR_REGISTRY` (appended after `sensorExpertSkill`, canonical order preserved).
- 7 assertions cover: fire on signal + prior rooms; no-fire on no-signal / no-rooms / inside-own-flow / all-archived; fault degrade on a throwing registry AND malformed turn/ctx (never throws); envelope content (marker, BINDING, imperative instruction, names the tool); the `dispatchSensors` spine ride (collects the reach on a matching turn, unaffected on a non-matching one, fault isolation); and a regression check against an existing sensor's test suite.

## Task Commits

Both tasks landed in one commit (implemented directly, not via TDD RED/GREEN pairs, since the sensor's behavior was verified interactively against the shipped `room-chooser.cjs` API before the test was finalized):

1. **Task 1 + Task 2: sensor + registration + tests**
   - `2a7154e0` feat(209-05): SENS-12 room-pick sensor - the conversational-gate bridge (E5)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `lib/core/sensors/sensor-room-pick.cjs` - the sensor, its lexicon, the registry-read seam (`ctx.__listRegisteredRooms` test hook), and `buildEnvelope`.
- `lib/core/insight-sensors.cjs` - `sensorRoomPick` required and appended to `SENSOR_REGISTRY`.
- `tests/test-209-room-pick-sensor.cjs` - 7 assertions, in-memory fixtures throughout (never touches the real rooms registry or filesystem).

## Decisions Made

See key-decisions in frontmatter. The most consequential: the deliberate departure from the closed-scalar evidence convention, made explicit in the module's own header comment so a future reader does not mistake it for an oversight.

## Deviations from Plan

None in substance. One implementation correction discovered while wiring `buildEnvelope`: `renderRoomChooserCard`'s return shape carries `rendered.zones` (an object with `header`/`body`/`signals`/`footer`), not a flat `rendered.text` string as an early draft assumed - fixed by joining the zones the same way the E4 `emitBindingGate` seam does (verified against the live `scripts/intent-classifier.cjs` code, not guessed).

## Issues Encountered

While verifying the "existing sensor suites still green" acceptance criterion, `tests/test-205-sens10-circularity.cjs`'s `"SENS-10 is the LAST registry entry"` assertion was found to already be failing on the pre-209 tree (confirmed via `git stash` + direct run against the prior commit) - Phase 203's `sensorExpertSkill` registration was appended after `sensorCircularity`, breaking that assertion before this plan ever touched the file. This is a pre-existing, unrelated latent bug, not a regression introduced here; the plan's regression check was pointed at `tests/test-203-reach-sensor.cjs` instead (19/19 passing), and the stale assertion is logged in this SUMMARY and in the test's own comment for a future pass to fix.

## Verification Results

- `node tests/test-209-room-pick-sensor.cjs` - exits 0, 7/7 assertions
- `grep -c "renderRoomChooserCard" lib/core/sensors/sensor-room-pick.cjs` = 4 (>= 1)
- `grep -c "renderShapeF" lib/core/sensors/sensor-room-pick.cjs` = 0
- `grep -c "sensor-room-pick" lib/core/insight-sensors.cjs` = 1
- `grep -rn "brain"` on the sensor file - empty (Part 8 proof)
- `bash tests/run-all-209.sh` - PASS=5 FAIL=0 SKIP=4 (209-01/02/03/04/05 green; 06 x2/07 x2 correctly SKIP)
- No em-dashes across all touched files

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 209-06 (H3 PRIMARY side-channel + H4 session-start fix) and 209-07 (H1+H2 backstop tuning + incident replay) can proceed independently; neither shares files with this plan's changes. 209-07's incident-replay test can now exercise this sensor as part of its end-to-end assertion.

---
*Phase: 209-shape-f-native-fire*
*Completed: 2026-07-02*
