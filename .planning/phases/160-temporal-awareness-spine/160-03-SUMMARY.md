---
phase: 160-temporal-awareness-spine
plan: 03
subsystem: temporal
tags: [recency-decay, leg-d-ranking, reach-signal, golden-file, part-8, part-9]
requires:
  - "getReferenceNow() reference clock (160-01, R1) -- the delta anchor for decay"
provides:
  - "recencyScore / rankByRecency app-side 0.995^(delta-h) decay blend (R5, DECAY_BASE visible)"
  - "Leg D recency-aware projection (created_at/last_seen_at selected; ORDER BY created_at DESC; app-side blend) in room-context.cjs"
  - "sensorRecency registered reach signal -- recency contributes to Engine 1 reach-candidate ordering (R6)"
  - "tests/fixtures/legd-recency-golden.json frozen determinism fixture + golden-file guard"
affects:
  - "Engine 1 reach selection ordering now carries a recency signal"
  - "getRoomContext Leg D output ordering changed from alphabetical (type, id) to recency-aware"
tech-stack:
  added: []
  patterns:
    - "app-side decay blend after a recency-ordered SQL fetch (D-03): visible DECAY_BASE constant, never buried in SQL"
    - "frozen-output golden-file fixture guards a spine hot path under an injected reference clock (options.now seam, D-01a)"
    - "net-new reach signal reuses a frozen reach_id (context_block) + frozen EVENT_TYPE -- mints neither"
key-files:
  created:
    - lib/core/temporal/recency-decay.cjs
    - lib/core/temporal/recency-decay.test.cjs
    - lib/core/sensors/sensor-recency.cjs
    - tests/fixtures/legd-recency-golden.json
    - tests/test-legd-recency-golden.cjs
    - tests/test-160-recency-reach-signal.cjs
  modified:
    - lib/core/navigation/room-context.cjs
    - lib/core/insight-sensors.cjs
decisions:
  - "D-03 app-side decay: the 0.995^(delta-h) blend runs in JS after a recency-ordered SQL fetch, with DECAY_BASE exported as a visible named constant so a frozen golden-file fixture can guard it"
  - "R6 sensorRecency reuses the frozen context_block reach and the existing reach_presented event -- mints NO new reach_id, NO new EVENT_TYPE (honors the 148/150.8 frozen contracts)"
  - "sensorRecency reads only LOCAL recency scalars threaded on ctx; it never re-runs Leg D and never opens room.db (Part 8)"
metrics:
  duration_min: 12
  completed: 2026-06-16
---

# Phase 160 Plan 03: Recency in the Spine + the Larry Reaches Link Summary

One-liner: getRoomContext Leg D stops sorting cortex nodes alphabetically and ranks them recency-aware via an app-side 0.995^(delta-h) decay blend (guarded by a frozen golden-file determinism test), and recency becomes a registered Engine 1 reach signal so a recently-touched node outranks an identical stale node.

## Resume Context

This plan was finished as a RESUME. A prior executor died mid-flight (socket drop) after the R5 work landed; this session detected the already-landed work, verified it, and finished only the R6 remainder.

**Already-green at resume (verified, NOT redone):**
- R5 recency-decay unit (`node --test lib/core/temporal/recency-decay.test.cjs`): 11/11 pass. `recencyScore(newer) > recencyScore(older)`; `rankByRecency` orders the more-recent node first. Landed in commits `4f23d34b` (RED) + `eade05fb` (GREEN, the recency-decay module + the Leg D rewrite).
- R5 Leg D rewrite (`lib/core/navigation/room-context.cjs`, committed in `eade05fb`): SELECT now includes `created_at` + `last_seen_at`, `ORDER BY type, id` replaced by `ORDER BY created_at DESC`, then `rankByRecency` applied app-side using `getReferenceNow()` as the reference. RAW-LOCAL discipline preserved (caller-owned db, no room.db open, no egress import, single degrade-to-[] guard).
- R5 golden-file determinism (`tests/test-legd-recency-golden.cjs`): the fixture + test were left UNTRACKED by the crash but were correct; this session verified them green and committed them rather than rewriting.

**Newly finished this session:**
- R6 `sensorRecency` registered in `SENSOR_REGISTRY` (`lib/core/insight-sensors.cjs`) -- the missing step that made recency a LIVE reach signal rather than a dead export.
- R6 unit proof test (`tests/test-160-recency-reach-signal.cjs`, net-new) -- registration + REACH_IDS membership + recent-outranks-stale + dispatchSensors fire/honest-negative + Part 8 LOCAL-scalars-only.
- Committed the untracked T2 work atomically (the sensor file, the golden fixture, the golden test, the registration edit, the new R6 unit test).

## What Was Built

- **`lib/core/temporal/recency-decay.cjs`** (R5, landed `eade05fb`) -- the app-side decay blend. Exports `recencyScore(createdAtMs, referenceMs)` = `DECAY_BASE ^ deltaHours`, `rankByRecency(nodes, referenceMs)` (stable ascending-id tiebreak on equal scores; falls back to `last_seen_at` when `created_at` absent; non-mutating), and the named visible constant `DECAY_BASE = 0.995` (the Generative-Agents constant). D-03: the constant is visible, never buried in a SQL string, so the golden-file fixture can freeze it.
- **Leg D rewrite** in `lib/core/navigation/room-context.cjs` (R5, landed `eade05fb`) -- adds `created_at` + `last_seen_at` to the projection, fetches `ORDER BY created_at DESC`, then blends recency app-side via `rankByRecency` anchored to the injected reference clock. Preserves every Leg D invariant (RAW-LOCAL fields only, no room.db open, no egress import, single try/catch degrade-to-[]).
- **`lib/core/sensors/sensor-recency.cjs`** (R6, this session committed) -- SENS-RECENCY. `sensorRecency(turn, tuple, ctx)` reads the LOCAL recency scalars threaded on ctx (`recencyScore`, or `mostRecentAgeHours` via the shipped `recencyScore` blend, plus optional `recentCortexCount`), and fires the frozen `context_block` reach (posture `push_forward`) when the score is at/above `RECENT_SCORE_THRESHOLD = 0.90` (~21h window). Reuses the shipped `recencyScore` so the sensor score and the Leg D ranking agree. Mints NO new reach_id and NO new EVENT_TYPE. Soft-fails to null; never throws. Mirrors the sibling-sensor routing-fence + Part 8 enum/scalar-only discipline.
- **`SENSOR_REGISTRY` registration** in `lib/core/insight-sensors.cjs` (R6, this session) -- `sensorRecency` imported, appended to the registry, and re-exported. This is the step the crash left undone; without it recency was not a live reach signal.
- **`tests/fixtures/legd-recency-golden.json` + `tests/test-legd-recency-golden.cjs`** (R5 determinism guard, this session committed) -- a frozen 6-node cortex set + frozen injected reference -> a frozen expected ranked id order. The test builds a hermetic room.db (nodes inserted deliberately shuffled), runs Leg D with `{ now: referenceMs }` via the options.now seam, and asserts the cortexNodes id order BYTE-MATCHES `expectedRankedIds`. Also asserts insertion-order independence (run twice), recent-outranks-stale at the spine, and the score-tied ascending-id tiebreak.
- **`tests/test-160-recency-reach-signal.cjs`** (R6 unit proof, net-new this session) -- 6 checks (all green).

## Verification (actual output)

R5 recency-decay unit (`node --test lib/core/temporal/recency-decay.test.cjs`):
```
# tests 11
# pass 11
# fail 0
```

R5 golden-file determinism (`node tests/test-legd-recency-golden.cjs`):
```
  ok   fixture is well-formed (frozen reference + node set + expected order)
  ok   Leg D cortexNodes id order BYTE-MATCHES the frozen golden ranking (D-03 determinism guard)
  ok   determinism: shuffled re-insertion yields the identical ranked order (run twice)
  ok   R5/R6 ordering: a recently-touched node outranks an identical stale node
  ok   score-tied nodes resolve by the deterministic ascending-id tiebreak
  all checks passed
```

R6 recency reach signal (`node tests/test-160-recency-reach-signal.cjs`):
```
  ok   sensorRecency is registered in SENSOR_REGISTRY
  ok   sensorRecency emits a reach_id in the frozen REACH_IDS bank (no new reach_id)
  ok   a recently-touched node yields a higher reach score than an identical stale node (R6)
  ok   recency reach FIRES through dispatchSensors when ctx carries a recent scalar
  ok   recency reach does NOT fire through dispatchSensors for a stale scalar (honest negative)
  ok   the recency reach carries only LOCAL scalars (Canon Part 8 -- no node id/type/body)
  all 6 checks passed
```

Regression fences held (shared-file safety -- `insight-sensors.cjs` is consumed by `decide()`):
- `tests/test-sensors-part8-sweep.cjs`: 1 passed, 0 failed over 10 file(s) (the sweep auto-globs `lib/core/sensors/*.cjs`, so it now spans `sensor-recency.cjs`).
- `tests/test-sensors-routing-fence.cjs`: 2 passed, 0 failed over 10 file(s) (Phase 144 fence -- sensor-recency assigns no routing_source, requires no engine).
- `tests/test-150-5-sensor-firability.cjs`: 22 passed, 0 failed (the firability suite auto-discovers the registry; the new sensor is covered without breaking the count).
- `tests/test-decide-sensor-fire.cjs`, `tests/test-decide-part8-invariant.cjs`, `tests/test-nav01-populated-room-engine-fires.cjs`, `tests/test-spine-navigates-decide.cjs`: all PASS.
- `tests/test-room-context-part8-invariant.cjs`: PASS (Leg D RETR-03 Part-8 source sweep).
- `tests/test-orchestration-projection-part8-boundary.cjs` (Phase 157 Part 8 boundary): 6 passed, 0 failed -- stays GREEN.

## Acceptance Criteria Status

| Criterion | Requirement | Status |
|-----------|-------------|--------|
| R5 part 1 | recencyScore monotonic + rankByRecency orders recent first | ALREADY-GREEN at resume |
| R5 SELECT | Leg D selects created_at/last_seen_at, recency-aware (no ORDER BY type, id) | ALREADY-GREEN at resume |
| R5 RAW-LOCAL | Leg D returns RAW-LOCAL only, never opens room.db | ALREADY-GREEN at resume |
| R5 part 2 | frozen golden-file determinism guard GREEN | NEWLY VERIFIED + committed this session |
| R6 registration | sensorRecency registered in SENSOR_REGISTRY | NEWLY FINISHED this session |
| R6 REACH_IDS | reach_id in frozen REACH_IDS (context_block); no new reach_id/EVENT_TYPE | NEWLY FINISHED this session |
| R6 ordering | recently-touched node outranks identical stale node | NEWLY FINISHED + already at the spine |
| Part 8 | sensor output enums + scalars only; boundary scan GREEN | VERIFIED (sweep + boundary scan green) |

## Deviations from Plan

None of substance. The plan's Task 1 (R5) was already complete at resume; Task 2 (R6) was partially landed (the sensor file + golden fixture/test were written but uncommitted, and the registry registration was undone by the crash). This session finished the registration, added the R6 unit proof test, and committed the untracked work atomically. No bugs, missing-functionality, or blocking issues were found (no Rule 1/2/3 deviations); no architectural changes (no Rule 4). No new dependencies. No `--no-verify`. No em-dashes.

## Known Stubs

None. The recency signal is fully wired: Leg D ranks recency-aware app-side, and `sensorRecency` is a live member of the dispatch registry consumed by both the prompt-side orchestrator and the engine-side `decide()`.

## Hard-Rule Compliance

- **D-03**: app-side decay with a visible `DECAY_BASE` constant; the frozen golden-file fixture (`tests/fixtures/legd-recency-golden.json`) guards the Leg D hot path; the determinism test passes and is committed.
- **Part 8 (Graph Boundary)**: sensor reads only LOCAL ctx scalars, emits only a recency score + count; the Part-8 sensor sweep spans `sensor-recency.cjs` and is green; Phase 157 boundary scan stays GREEN.
- **Part 9**: no temporal egress; the recency signal rides only LOCAL scalars; no node id/type/body on the reach evidence.
- **House rules**: hyphens only (no em-dashes, verified on the staged diff); CJS; pre-commit gates passed without `--no-verify`; no new dependencies.

## Self-Check: PASSED
