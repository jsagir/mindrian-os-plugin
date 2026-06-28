---
kind: summary
phase: 184
slug: reader-decide-projection-offer
milestone: v1.15.0
created: 2026-06-28
canon_parts: [2, 3, 8, 9, 11]
status: built-not-committed
one_liner: "decide() gains a THIRD READER -- it ranks the LOCAL orchestration projection (249 nodes) for the navigator context and surfaces them as Shape F option CONTENT; a reader, never a firer (R4 structural), R2 fail-closed gate, R3 ambient budget, R1 A/B harness with the live reading recorded as a NAMED DEBT."
requires:
  - lib/core/navigation-engine.cjs (decide)
  - data/brain-orchestration-projection.json
  - data/connector-registry.json
provides:
  - lib/core/reader/decide-projection-reader.cjs
  - lib/core/reader/ab-harness.cjs
  - decision_trace.projection_offer
affects:
  - lib/core/navigation-engine.cjs
  - lib/core/navigation-engine-shared.cjs
---

# Phase 184 Plan: READER Decide-Time Projection Offer Summary

decide() now performs a third READ: it ranks the LOCAL orchestration projection's
capabilities for the current navigator context and surfaces them as Shape F
Decision-Gate OPTION CONTENT, calling neither runChain nor any act-command.

## Navigator-authority override (recorded truthfully, no euphemism)

Phase 184 was DEFERRED as evidence-blocked: the Phase 183 METER first reading came
back `subject_class=unknown` / `transfer_uninstrumented` (no live navigator has
reached the decide() gate), and evidence-before-steel discipline reads building READER
now as building ahead of evidence. The navigator (Jonathan Sagir, 2026-06-28)
OVERRODE that deferral and directed 184 into the v1.15.0-beta.9 cut, mirroring the
Appendix D entry-20 navigator-authority-override pattern.

The CODE ships fully and green. The **R1 live grounded-vs-ungrounded A/B remains a
NAMED DEBT**: it cannot return a real result until a live navigator reaches the gate.
The harness is built so it CAN run the live A/B the instant a navigator subject
exists; today it records `subject_class=unknown` / `live_ab.state=uninstrumented` /
`result=null` honestly, never a fabricated live pass (the Phase 183 METER
`transfer_uninstrumented` third-state idiom in `lib/core/meter/two-gauge.cjs`). A
maintainer / dogfood reading does NOT clear the debt (the entry-20 override guard:
only a live navigator subject with a real choice clears the A/B to `measured`).

## What shipped

### Files created
- `lib/core/reader/decide-projection-reader.cjs` -- the READER. `loadProjection`
  (READER-01, LOCAL file read + LOCAL machinery cache), `validateProjection` (R2 gate,
  fail-closed), `rankCapabilities` (READER-02, deterministic), `surfaceAsOptionContent`
  (READER-03, every option `fires:false`), `offerProjectionCapabilities` (the
  decide()-facing entry + R3 budget telemetry). Requires ONLY `node:fs` + `node:path`
  (R4: no firing module).
- `lib/core/reader/ab-harness.cjs` -- the R1 grounded-vs-ungrounded A/B harness.
  `runGroundedVsUngroundedAB` returns `local_measurement` (the structural A/B that runs
  today: choice-shift + per-arm latency) welded with `live_ab` (the named-debt
  uninstrumented third state). Mirrors the two-gauge subject_class + measured/
  uninstrumented honesty.
- `tests/test-reader-184.cjs` -- 39 assertions: R2 rejects 5 malformations + passes the
  real 249-node projection; decide() degrades gracefully (no throw) on missing AND
  malformed projection; R3 budget holds (read_ms <= 50ms, option_count <= 5); ranking
  deterministic + context-aware total order; READER-04 every option fires:false; R1
  local A/B + named-debt uninstrumented + maintainer-does-not-clear + navigator-clears;
  Part 8 no-network sweep over the two production modules; no-em-dash sweep over all
  four new files.
- `tests/test-reader-r4-structural-184.cjs` -- 23 assertions: R4 require allow-list
  over the reader + harness, firing-token sweep (chain-executor / runChain /
  act-command / framework-runner / spawnSync / execSync / child_process / runWorkflow),
  decide() has no chain-executor/act-command require and no `runChain` literal, the
  reader exports no run/fire/execute/invoke surface.
- `tests/run-all-184.sh` -- the phase aggregator (Passed/Failed summary, non-zero exit
  on failure).
- `.planning/phases/184-reader-decide-projection-offer/184-CONTEXT.md` (canon_parts 2,
  3, 8, 9, 11; cirs_relationship block: READER CONSUMES the spine read-model, adds no
  surface/gate).

### Files modified
- `lib/core/navigation-engine.cjs` -- decide() computes the projection offer ONCE
  (before any return path, beside the navigated-neighborhood read) and assigns
  `trace.projection_offer` on both the tier_0 early-return path and the main path.
  Wrapped in try/catch: a fault degrades to a null offer; decide() never throws.
- `lib/core/navigation-engine-shared.cjs` -- `emptyDecisionTrace()` gains
  `projection_offer: null` so the trace shape is stable across every path (tier_0 /
  legacy / mode_a / fault).

## Integration point

`lib/core/navigation-engine.cjs:852` (inside `decide()`, immediately after the
navigated-neighborhood read and before the main `try {`). The offer is computed once
there from `{ reach_id from the top fired sensor reach, firingSensors, sensorReaches }`
and assigned to `trace.projection_offer` on both return paths; it touches neither
`fire_skill`, `suppress_skills`, nor any frozen Part 3 contract.

## The four acceptance rules -- status

- **R1** grounded-vs-ungrounded A/B harness built; LOCAL measurement GREEN today; LIVE
  navigator reading is the NAMED DEBT (subject_class=unknown / uninstrumented), built
  to run when a subject exists.
- **R2** projection-correctness gate runs on the 249 nodes BEFORE the read, fails
  CLOSED on malformed (5 malformations tested); PASSES the real projection today.
- **R3** ambient-turn latency budget (READER_BUDGET_MS=50) + context-weight budget
  (READER_MAX_OPTIONS=5) asserted; the build fails if the read is too slow / heavy.
- **R4** structural guard: decide() and the reader have no firing path; a test fails if
  one is introduced.

## Test results

- `bash tests/run-all-184.sh` -> Total 2, Passed 2, Failed 0 (39 + 23 assertions).
- `bash tests/run-all-144.sh` -> Total 5, Passed 5, Failed 0 (no regression to the
  load-bearing navigation-engine gate, including the Part-8 CASC-02 invariant which
  confirms decide()'s new code adds zero Brain egress).
- `bash tests/run-all-148.sh` -> green (frozen selector contracts intact).

## Frozen-contract confirmation

MAX_K=3 (`lib/workflow/f-selector-ranker.cjs:78`) and DIAL_REACH_K=6
(`lib/hmi/dial-reach-orchestrator.cjs:112`) UNCHANGED; the 0.70/0.15 RECOMMENDED gate,
the 6-reach bank, and the render contract UNTOUCHED. READER surfaces capability OPTIONS
as decision-gate CONTENT; it mints no 7th reach and touches no render contract.

## Deviations from Plan

None affecting the deliverable. One process note (not a code deviation): during
regression verification a `git stash` was used to confirm the 150.5
connector-filing-sweep failure is PRE-EXISTING (it is -- in `/mos:file-meeting`
frontmatter + connector coverage, files this phase never touched). The stash push
aborted on untracked pathspecs and the subsequent pop accidentally applied a
concurrent-agent stash, producing transient UU conflicts in `lib/core/lazygraph-ops.cjs`
and `tests/run-all-169.sh`. Recovered immediately: those files were restored to HEAD and
the concurrent agent's `stash@{0}` was PRESERVED intact (not dropped). No READER file
was affected.

## Known Stubs

The R1 LIVE grounded-vs-ungrounded A/B is intentionally uninstrumented (the named debt
above). This is NOT a stub that blocks the plan goal: READER's CODE (the projection
read, ranking, R2/R3/R4 guards, and the LOCAL structural A/B) is fully wired and green.
The LIVE reading is structurally blocked on a real-world precondition (a live navigator
reaching the gate) that no code can manufacture; it is recorded honestly and will
return a real result the instant a subject exists.

## Part 8 / boundary

Zero Brain egress added. The projection is a LOCAL derived machinery cache read from
disk; the only "brain" tokens in the new files are the projection FILENAME
(`brain-orchestration-projection.json`). The 144 CASC-02 Part-8 invariant test passes,
confirming decide()'s additions carry no packet/brain-client require, no egress
projection token, and no hashing call site.
