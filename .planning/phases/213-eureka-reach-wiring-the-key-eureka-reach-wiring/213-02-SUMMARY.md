---
phase: 213-eureka-reach-wiring
plan: 02
subsystem: eureka
tags: [eureka, sensor, sens-13, guard-gate, side-channel, seed-049]

# Dependency graph
requires:
  - phase: 211-eureka-eval-gold-set
    provides: scoreMeasured (measured differential, bands, EUREKA_DIFF_FLOOR) + the tri-modal substrate
  - phase: 212-eureka-substrate-grounding-guard
    provides: the eureka-critic contract (stageA, assembleCriticPayload, criticRule, loadCriticTags, VERDICTS) + the closed reasoning_tags/domain_tags enums
provides:
  - "lib/core/sensors/sensor-eureka.cjs: SENS-13 detector -- rides the FROZEN deep_research reach, posture hold, POST-GuardGate, side-channel read, enum/handle-only evidence"
  - "lib/core/eureka/eureka-reach-runner.cjs: the async side-channel producer -- probeGuard (live-module probe) + the Stage-A runtime guard gate + the closed-schema writer, born invoked from auto-explore-fire"
affects: [213-03, eureka-reach-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 3 probe (probe the LIVE module for guard availability, never fs.existsSync)"
    - "closed-key side-channel writer as the Part-8 fence (exact key set + enum/handle/quantized values, reject-on-drift)"
    - "no-guard -> no-fire honest degrade (never no-guard -> unguarded-fire)"
    - "injection-seam substrate resolution (Canon Part 9: a lib/core module never opens room.db)"

key-files:
  created:
    - lib/core/sensors/sensor-eureka.cjs
    - lib/core/eureka/eureka-reach-runner.cjs
    - tests/test-213-sensor-eureka.cjs
    - tests/fixtures/213/last-eureka.json
  modified:
    - scripts/auto-explore-fire.cjs
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "The runtime guard gate is the 212 critic's Stage A (deterministic, NO LLM) plus the criticRule confidence band -- Stage B's two rubric passes are session/eval-side and OUT of the fire-and-forget runtime path (the flagged Decision-Gate item, RESEARCH OQ2). Reconciliation flagged for navigator sign-off below."
  - "The runner never opens room.db (Canon Part 9 chokepoint / CLAUDE.md hard constraint). The 211 tri-modal derivation lands as an injected deriveFn a later wiring plan threads through navigation.cjs; with no pair/deriveFn the runner honestly returns substrate_unavailable."
  - "Does NOT touch lib/core/insight-sensors.cjs SENSOR_REGISTRY or decide() -- that is plan 03's scope (registry + reachability proof)."

requirements-completed: [EUREKA-01, EUREKA-07]

# Metrics
duration: ~25min
completed: 2026-07-10
---

# Phase 213 Plan 02: The KEY's Detector Half (SENS-13 eureka sensor + side-channel producer) Summary

**SENS-13 rides the FROZEN deep_research reach and fires POST-GuardGate off a fresh, closed-schema side-channel; its async producer probes the LIVE 212 critic, gates on Stage A, writes an enum/handle-only last-eureka.json, and is born invoked from the shipped auto-explore fire path -- with plan 03 left exactly two edits (registry + reachability proof).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-10
- **Tasks:** 3 (Task 1 co-tested in Task 3 per the plan's structure)
- **Files created:** 4 (2 source modules + 1 test + 1 fixture); 1 modified (auto-explore-fire seam)

## Accomplishments

- **SENS-13 detector (the sensor is the KEY, SEED-049):** rides the FROZEN deep_research reach (member 5, no 7th reach minted; CIRS R3), posture `hold` (a standing suggestion at the Decision Gate, never auto-opens; the SENS-SHOW precedent). Reads `<roomDir>/.mindrian/last-eureka.json` via locally-replicated `readJsonSafe` + `isFreshFile` (NOT an insight-sensors import; that would be circular). Fires only when the full precondition set holds and soft-fails to null on every malformed input.
- **POST-GuardGate lock (the flagged firing precondition):** a restatement never becomes an offer. The sensor fires only on `guard.available === true && guard.verdict === 'transferable'`; an absent/unavailable guard or a restatement/pseudoscience/general_shallow verdict returns null (no guard = no fire).
- **Stale-proof (T-213-06):** the 30-minute `EUREKA_SIGNAL_FRESHNESS_MS` window plus the WR-01 non-negative-age (future-mtime) guard; a stale or clock-skewed side-channel never re-fires.
- **Part-8 closed at the side-channel (T-213-04):** evidence and the written file carry enums, opaque room.db node-id HANDLES (`a_handle`/`b_handle`, never titles or text), and quantized scalars only. The runner's `validateClosedSchema` enforces the EXACT key set and rejects any extra key or non-enum/non-handle/non-quantized value (`schema_violation`, writes nothing).
- **The producer is born WIRED:** the runner is invoked from the shipped `scripts/auto-explore-fire.cjs` fire path (additive, opt-in, fire-and-forget with catch-swallow) in this same plan, not left an orphan module. A runner fault can never change auto-explore's exit code or its finding write (the Phase 117 exit-0 discipline holds; T-213-07).
- **Live-module guard probe (Pattern 3, the vec0 lesson):** `probeGuard` probes the live `eureka-critic` (asserts `criticRule` is a function and `loadCriticTags().schema_version === 1`), never `fs.existsSync`. `criticProbeFn` is the hermetic test seam.
- **Consumes, never rebuilds:** `scoreMeasured` (211) for the measured differential + `resolveEurekaDiffFloor` for the floor (zero new env vars, reuses `EUREKA_DIFF_FLOOR`); the 212 critic contract (`stageA`, `assembleCriticPayload`, `criticRule`) for the guard gate.

## Task Commits

1. **Task 1: sensor-eureka.cjs + schema-v1 fixture** -- `e724b6ed`
2. **Task 2: eureka-reach-runner.cjs (producer + Stage-A guard gate + closed-schema writer)** -- `b764d94c`
3. **Task 3: born-wired auto-explore seam + hermetic 11-arm suite** -- `78f95832`

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified

- `lib/core/sensors/sensor-eureka.cjs` -- `sensorEureka` (SENS-13), `EUREKA_SIGNAL_FRESHNESS_MS`, `FIRING_BANDS`, `FIRING_SURPRISE_TYPES`, `GUARD_FIRING_VERDICT`, signal kind `eureka_bridge`, dispatch handle `eureka-bridge-offer (211 tri-modal substrate)`.
- `lib/core/eureka/eureka-reach-runner.cjs` -- `runEurekaScan`, `probeGuard`, `SIDE_CHANNEL_FILE='last-eureka.json'`, `SIDE_CHANNEL_SCHEMA_VERSION=1`, `REASONS` (closed reason enum), plus `runGuardGate`/`validateClosedSchema` for the suite + plan 03.
- `scripts/auto-explore-fire.cjs` -- the opt-in fire-and-forget seam after Step 6.
- `tests/test-213-sensor-eureka.cjs` -- 11 hermetic arms (7 sensor + 4 runner), exit 0.
- `tests/fixtures/213/last-eureka.json` -- valid schema-v1 payload (transferable, breakthrough, handles n042/n317).

## Acceptance Criteria (all objective gates hold)

- `node tests/test-213-sensor-eureka.cjs` -> exit 0 (PASS=11)
- `grep -c "deep_research" lib/core/sensors/sensor-eureka.cjs` -> 5 (>=1) AND the other-reach-literal grep exits 1 (fires deep_research only)
- `grep -c "SENS-13" ...` -> 7 (>=1)
- `grep -cE "require\(.*(decide|navigation-engine|chain-executor)" ...` -> 0 (Phase 144 fence)
- `grep -c "eureka-reach-runner" scripts/auto-explore-fire.cjs` -> 1 (born wired)
- the probeGuard no-guard-no-fire one-liner prints ok
- em-dash scan -> 0 on every touched file
- auto-spanning gates: `tests/test-sensors-part8-sweep.cjs` (17 files) + `tests/test-sensors-routing-fence.cjs` (17 files) both green (the new sensor is auto-covered)
- regression: `bash tests/run-all-211.sh` PASS=10, `bash tests/run-all-212.sh` PASS=6 (the seam is additive)

## TDD Gate Compliance

Task 1 was marked `tdd="true"`, but the plan's own structure places the SENS-13 unit suite in Task 3's file ("Test (in task 3's file)"). Executed per that structure: Task 1 shipped the detector + fixture with its inline `node -e` verify (loads + null-degrades) as the immediate gate; the full RED/GREEN behavior suite lands in Task 3 (`tests/test-213-sensor-eureka.cjs`, 11 arms, exit 0), which also asserts the runner-written file re-fires the sensor (the two halves agree end to end). This is the plan's prescribed layout, not a deviation from TDD intent.

## Decisions Made / Reconciliations (flagged for navigator sign-off)

1. **Runtime guard gate = Stage A + criticRule confidence (Stage B excluded).** The plan's `<action>` text lists "classifyCandidate + criticRule", but `classifyCandidate` runs the Stage B two-pass rubric, which needs a live LLM judge that does not exist in a fire-and-forget hook path (it would throw). The plan's FLAGGED Decision-Gate item is explicit: "the RUNTIME gate is the 212 critic's Stage A ... because Stage B's two rubric passes are session-run and eval-side; a candidate Stage A cannot clear does NOT fire." Reconciled toward the flag: `runGuardGate` calls `critic.stageA` directly (deterministic, no LLM); a Stage-A-clearing candidate whose `criticRule` confidence is not `unknown` is the runtime `transferable` precondition the side-channel records, and a Stage-A-failing candidate carries its gate route and does not fire. This matches the key_link "Stage-A verdict" in the plan frontmatter. **If the navigator wants Stage B in the runtime path instead, that is the flagged scope change -- say so and I will rewire.**
2. **The runner never opens room.db (Canon Part 9 / CLAUDE.md chokepoint).** The plan's `<action>` describes deriving the pair via "hybrid-retrieve over roomDir's room.db". A `lib/core/*` module directly requiring `room-db.cjs` violates the navigation.cjs single-chokepoint discipline (enforced by `scripts/check-schema-aliases.cjs`). Reconciled: the candidate pair is resolved via injection seams (`opts.pair` for explicit/test callers, `opts.deriveFn` for a later wiring plan that threads the 211 tri-modal derivation through navigation.cjs); with neither, the runner honestly returns `substrate_unavailable`. This keeps the born-wired producer chokepoint-clean and defers the graph-derivation wiring rather than fabricating an untested room-db path.

## Deviations from Plan

Both items above are reconciliations of internally-tense or CLAUDE.md-constrained plan text, flagged explicitly, not silent deviations. No auto-fixed bugs (Rules 1/3) were needed; the Part-9 chokepoint adjustment is a CLAUDE.md-precedence adjustment (documented). Otherwise the plan executed as written.

## Scope Boundary Honored

This plan does NOT touch `lib/core/insight-sensors.cjs` (its `SENSOR_REGISTRY` or `decide()` wiring) -- verified untouched. Plan 03 owns the spine registration + the decide() reachability proof, and is left exactly those two edits.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary schema beyond the plan's own `<threat_model>` (T-213-04..07, all mitigated as designed): the closed-key writer, posture `hold` + Phase 144 fence, the freshness + schema_version gates, and the fire-and-forget catch-swallow.

## Known Stubs

- **Substrate auto-derivation is an injected seam, not yet a wired graph query.** `runEurekaScan` resolves the candidate pair from `opts.pair` or `opts.deriveFn`; the born-wired auto-explore call passes neither, so in production it currently degrades to `substrate_unavailable` (honest no-fire) until a later plan injects the 211 tri-modal `deriveFn` through the navigation chokepoint. This is intentional (Canon Part 9, decision above), not a rendering stub -- no user-facing surface shows placeholder data, and the producer is genuinely born invoked.

## Issues Encountered

None. The SQLite ExperimentalWarning on stderr is from a transitive require in the 211 scorer chain and is harmless (does not affect exit codes or output).

## Next Phase Readiness

- Plan 03 (the spine) can now register `sensorEureka` into `SENSOR_REGISTRY` and add the decide() reachability proof + the no-force suite (T-213-05), inheriting a detector that already passes the routing fence and the Part-8 sweep.
- A later wiring plan supplies the `deriveFn` that turns the born-invoked producer from `substrate_unavailable` into a live bridge scan.

## Self-Check: PASSED

All 4 created files + the SUMMARY exist on disk; all 3 task commits (`e724b6ed`, `b764d94c`, `78f95832`) are in the log; `lib/core/insight-sensors.cjs` is untouched (last touched by 209-05, no working-tree change). The suite re-runs at exit 0 (PASS=11); the 211/212 suites are green (PASS=10 / PASS=6).

---
*Phase: 213-eureka-reach-wiring*
*Completed: 2026-07-10*
