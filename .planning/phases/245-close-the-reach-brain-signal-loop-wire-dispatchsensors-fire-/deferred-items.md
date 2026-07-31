# Phase 245 deferred items

Out-of-scope discoveries logged during execution. Per the executor scope
boundary, these were NOT fixed: none was caused by this phase's changes, and
each was proven pre-existing by running the affected test against the
unmodified file and diffing the output byte for byte.

## Pre-existing test failures observed during 245-01 (Task 2 regression sweep)

Method: for each failing test, the working copy of `lib/core/insight-sensors.cjs`
was set aside, the committed HEAD version restored with
`git checkout -- lib/core/insight-sensors.cjs`, the test re-run, the working copy
restored, and the two outputs diffed. IDENTICAL means the failure text matched
exactly (modulo pid / tmpdir noise), so the change under test neither caused nor
worsened it.

| Test | Status | Before vs after | Apparent cause |
|------|--------|-----------------|----------------|
| `tests/test-203-reach-sensor.cjs` | 17/19, pre-existing | IDENTICAL | REJECT-with-reason and DEFER edge writes fail. Consistent with the `edges.review_status` schema drift already recorded in STATE.md against `run-all-205`. |
| `tests/test-209-room-pick-sensor.cjs` | FAIL, pre-existing | IDENTICAL except the printed pid | not investigated (out of scope) |
| `tests/test-220-url-sensor.cjs` | FAIL, pre-existing | IDENTICAL | not investigated (out of scope) |
| `tests/test-205-sens10-circularity.cjs` | FAIL, pre-existing | IDENTICAL | not investigated (out of scope) |
| `tests/test-237-session-scope.cjs` | FAIL, pre-existing | IDENTICAL except the mutated-copy tmpdir name | not investigated (out of scope) |
| `tests/test-158-reach-orchestrator-pure.cjs` | FAIL, pre-existing | IDENTICAL | The purity tripwire asserts the reach orchestrator's only require is `f-selector-ranker.cjs`; a second require, `_actBlurbGen = require('../core/act-jtbd-blurb.cjs')`, has since landed. This test is named in 245-01-PLAN.md's verification block, so it is called out in the SUMMARY too. |

Note on the last row: `tests/test-158-reach-byte-stable.cjs`, the other D-03
purity tripwire named in the plan, passes.

The other 30 tests that exercise `dispatchSensors`
(`grep -rln "dispatchSensors" tests/*.cjs`, 35 files total) all pass after the
`evidence.sensor_id` stamp, including every Part 8 sweep
(`test-158-reach-part8-no-reason`, `test-159-part8-secretreason-sweep`,
`test-213-part8-boundary`, `test-169-brain-boundary`). No Part 8 assertion
needed an allowlist edit: none enumerates a closed set of evidence keys.
