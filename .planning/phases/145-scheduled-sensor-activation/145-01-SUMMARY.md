---
phase: 145-scheduled-sensor-activation
plan: 01
subsystem: scheduled-sensors
tags: [SCHED-01, SCHED-02, cadence, throttle, safe-auto-fire, part-8, part-7-reuse]
canon_parts: ["Part 2 Engine 1", "Part 4", "Part 7", "Part 8"]
requirements: [SCHED-01, SCHED-02]
dependency-graph:
  requires:
    - "Phase 140 sentinel-and-instrumentation-hardening (HARD-01/02/03 invariants)"
    - "Phase 143 insight sensors / dispatchSensors (sensor surfaces composed)"
    - "scripts/sentinel-snapshot, sentinel-health-check, sentinel-deadline-monitor"
    - "lib/core/scheduled-scanner.cjs (buildCompetitorQueries)"
    - "scripts/compute-hsi.py, detect-reverse-salients.py, hsi-to-graph.cjs"
    - "scripts/compute-whitespace-gaps.py, whitespace-to-graph.cjs"
    - "scripts/compute-opportunity-state, lib/core/opportunity-ops.cjs"
    - "scripts/scout-telemetry-aggregator.cjs"
  provides:
    - "scripts/scout-cadence-runner.cjs (the single throttled 10-sensor composer)"
    - "scripts/scout-cadence-guard.cjs (LOCAL throttle + Phase-140 safe-auto-fire guard)"
  affects:
    - "Phase 145 Plan 02 (Tri-Polar cadence wiring -- consumes the runner + guard)"
    - "Phase 145 Plan 03 (verification suite -- asserts cadence-fires / hardening-holds / zero-egress)"
tech-stack:
  added: []
  patterns:
    - "process.argv switch-case CJS (gsd-tools pattern; no commander/yargs)"
    - "child_process execFileSync with stderr/exit captured, not swallowed (scout.md D-03)"
    - "LOCAL last-run timestamp throttle keyed by sha256(roomPath)[0:12] (mirrors session-start daily-cache pattern)"
    - "read-only node:sqlite open for the NULL source_path invariant scan"
key-files:
  created:
    - "scripts/scout-cadence-guard.cjs"
    - "scripts/scout-cadence-runner.cjs"
  modified: []
decisions:
  - "Throttle state lives under $HOME/.mindrian/scout-cadence/last-run-<roomHash>.txt -- LOCAL, never committed, never egressed; room-path hash is identity only, no room content in the path"
  - "HARD-01 is enforced by the runner (it captures the sentinel-health-check exit and passes it to safeAutoFireCheck), not swallowed; HARD-02/HARD-03 are scanned directly by the guard"
  - "competitor-watch is emitted as a hat-scoped public-SIGNAL query plan for the surface layer to execute; the runner itself never fetches, keeping the scheduled path zero-egress"
  - "Missing room.db / missing nodes table / unreadable result files are NOT treated as violations -- a fresh room has no graph yet (scan returns checked:false, not a fabricated violation)"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-07"
  tasks: 2
  files: 2
---

# Phase 145 Plan 01: Scout Cadence Runner + Safe-Auto-Fire Guard Summary

Built the WIRING layer for scheduled scout activation: a single cadence runner that composes the full scout suite plus the four SCHED-02 sensors behind a LOCAL last-run throttle and a Phase-140 safe-auto-fire guard, with zero Brain or web egress on the scheduled path (Canon Part 8) and every sensor reused, not re-implemented (Canon Part 7).

## What Was Built

### scripts/scout-cadence-guard.cjs (the throttle + safe-auto-fire invariant guard)

- `shouldFire(roomDir, intervalHours)` -- reads a LOCAL last-run timestamp at `$HOME/.mindrian/scout-cadence/last-run-<roomHash>.txt` (roomHash = first 12 hex of sha256 of the absolute room path). Returns `{fire:true}` when the file is absent or the interval (default 24h) has elapsed; otherwise `{fire:false, nextEligible}`. Soft-fails open on unreadable/corrupt timestamps because `recordRun` re-arms immediately.
- `recordRun(roomDir)` -- writes the current ISO timestamp (mkdir -p first); soft-fails on write error, never throws.
- `safeAutoFireCheck(roomDir, {healthCheckExit})` -- returns `{ok, violations[]}` where each violation names its HARD-NN invariant:
  - HARD-01: surfaces a non-zero sentinel-health-check exit passed in by the runner (the runner captures it; the guard refuses to let it hide).
  - HARD-02: read-only `node:sqlite` open of `room/.mindrian/room.db`, counts `nodes WHERE source_path IS NULL` -- presence is a provenance breach.
  - HARD-03: scans the latest `.intelligence/*.md|*.json` result set for any `.heal-backup/` path -- presence is backup pollution.

### scripts/scout-cadence-runner.cjs (the 10-sensor composer)

`node scout-cadence-runner.cjs <roomDir> [--interval-hours=N] [--force] [--json]`:

1. Resolve roomDir; soft-fail and exit 0 with a notice when absent (it runs from a hook, never crashes the host).
2. `guard.shouldFire` gate; when throttled (and no `--force`), prints `nextEligible` and exits 0 with zero sensors run.
3. Fires the suite in canonical scout.md order, each step capturing exit + stderr WITHOUT swallowing (D-03): sentinel-snapshot, sentinel-health-check (exit CAPTURED for HARD-01), sentinel-deadline-monitor, competitor-watch (emitted as a public-SIGNAL query plan via `scheduled-scanner.buildCompetitorQueries` -- never fetched), HSI-recompute (compute-hsi.py then detect-reverse-salients.py then hsi-to-graph.cjs with a non-fatal degraded advisory), whitespace recompute (compute-whitespace-gaps.py then whitespace-to-graph.cjs), opportunity-bank scan (compute-opportunity-state + opportunity-ops.listOpportunities), efficiency telemetry (scout-telemetry-aggregator.cjs --json). Each Python step gates on check-hsi-deps and skips with a note when sklearn is absent.
4. Calls `guard.safeAutoFireCheck` with the captured health-check exit; surfaces violations prominently but non-fatally.
5. Calls `guard.recordRun` to arm the throttle.
6. Emits a structured summary `{fired, throttled, steps[], violations, signal_query_plan, findings_to_graph}` (human-readable by default, JSON under `--json`).

## Canon Compliance

- **Part 7 (Reuse Before Build):** No new sensor. Both files compose the Phase-140-hardened sentinel-* scripts, the existing HSI/whitespace/reverse-salient Python pipeline, the opportunity-bank ops, and the scheduled-scanner competitor surface. The runner is the single justified net-new composition point behind a throttle -- none of the 25 methodology commands does scheduled multi-sensor composition.
- **Part 8 (Graph Boundary):** Zero-egress on the scheduled path. The runner makes no Brain query and no web fetch; HSI/whitespace/RS/opportunity are all LOCAL compute; competitor-watch is a public-SIGNAL query plan for the surface layer. The guard makes zero network calls; the room-path hash is LOCAL identity only. Both files pass the comments-filtered grep gate (PART8_CLEAN / RUNNER_OK).
- **Part 4 (Every Choice Is Graph Data):** the runner reports `findings_to_graph` (hsi-edges, whitespace-zones, opportunity-bank:N) for the surface layer to bind as typed edges.

## Acceptance Criteria -- all passed

Task 1 (guard):
- shouldFire fire:true on a fresh room, fire:false within the interval after recordRun, fire:true again after backdating the timestamp 25h -- verified.
- safeAutoFireCheck ok:true on a clean room; HARD-02 entry when a NULL source_path node is present; HARD-03 entry when a .heal-backup/ path appears in the result set; HARD-01 entry on a non-zero health exit -- all four verified.
- Part 8 grep gate prints PART8_CLEAN; zero em-dashes.

Task 2 (runner):
- Real fresh room fires the full 12-step suite (all 6 scout steps + whitespace + reverse-salient + opportunity-bank + competitor query-plan) -- verified.
- Immediate re-run reports throttled:true with zero steps; --force overrides -- verified.
- Summary surfaces safeAutoFireCheck violations -- verified.
- Runner makes zero Brain/web calls (RUNNER_OK); competitor-watch emitted as a SIGNAL query plan, not executed inside the runner -- verified.
- sklearn-absent path skips the three Python steps with a note; suite still completes (10 steps, fired:true) -- verified by temporarily forcing check-hsi-deps to tier:0.
- Zero em-dashes.

## Deviations from Plan

None of Rules 1-4 triggered. The plan executed as written.

Note on the live verification environment: on a real fresh room with sklearn present, the HSI-to-graph step in this environment inserted a node without a source_path, so `safeAutoFireCheck` correctly returned one HARD-02 violation. This is the guard working as designed -- surfacing a real Phase-140 invariant state non-fatally -- not a defect in this plan's code. It is a candidate finding for the HSI-to-graph provenance backfill, out of scope for this wiring plan (the guard's job is to detect and surface, which it did).

## Known Stubs

None. Both files are fully wired: the guard reads/writes real LOCAL throttle state and opens the real room.db; the runner invokes the real shipped sensor scripts and composes their real output.

## Self-Check: PASSED

- scripts/scout-cadence-guard.cjs -- FOUND
- scripts/scout-cadence-runner.cjs -- FOUND
- commit 170c2431 (guard) -- FOUND
- commit f0991905 (runner) -- FOUND
