---
phase: 145-scheduled-sensor-activation
plan: 02
subsystem: scheduled-sensors
tags: [SCHED-01, SCHED-02, cadence, tri-polar, session-start, cron, cowork, part-8, part-7-reuse]
canon_parts: ["Part 2 Engine 1", "Part 4", "Part 8"]
requirements: [SCHED-01, SCHED-02]
dependency-graph:
  requires:
    - "Phase 145 Plan 01 (scout-cadence-runner.cjs + scout-cadence-guard.cjs -- the throttled composer + safe-auto-fire guard)"
    - "Phase 140 sentinel-and-instrumentation-hardening (HARD-01/02/03 invariants the runner enforces)"
    - "scripts/session-start (the cadence host; Phase-124 + Phase-143.1 best-effort slot template)"
  provides:
    - "Live CLI session-start-throttled cadence (the runner fires in the background on every session, self-throttled)"
    - "Documented cron-optional path (commands/scout.md)"
    - "Repointed Cowork scout-sentinel task (commands/scheduled-tasks.md Task 6 -> the runner)"
  affects:
    - "Phase 145 Plan 03 (verification suite -- asserts cadence-fires / hardening-holds / zero-egress)"
tech-stack:
  added: []
  patterns:
    - "Best-effort background session-start slot (& + >/dev/null 2>&1 + || true) mirroring the Phase-124 timeline / Phase-143.1 dial-memory slots"
    - "Emergency opt-out env var (SCOUT_CADENCE_SKIP=1) mirroring BRAIN_STALENESS_SKIP"
    - "Throttle lives in the runner's Plan-01 guard, not duplicated in the hook (single source of cadence truth)"
key-files:
  created: []
  modified:
    - "scripts/session-start"
    - "commands/scout.md"
    - "commands/scheduled-tasks.md"
decisions:
  - "session-start owns the THROTTLED default path (no --force); cron and Cowork own the --force path because their scheduler interval IS the throttle"
  - "The cadence slot is gated behind SCOUT_CADENCE_SKIP and a room-resolves check; it runs in the background so it adds zero foreground startup latency"
  - "The throttle is NOT duplicated in the hook -- the runner's Plan-01 guard is the single cadence authority, so the hook stays a thin background invocation"
metrics:
  duration: "~7 minutes"
  completed: "2026-06-08"
  tasks: 2
  files: 3
---

# Phase 145 Plan 02: Tri-Polar Cadence Wiring Summary

Wired the Plan-01 scout-cadence-runner onto all three Tri-Polar surfaces: a self-throttled best-effort session-start slot (CLI default), a documented cron-callable path (CLI power-user option), and the repointed Cowork scout-sentinel scheduled task. The scout suite now fires on a cadence without anyone typing /mos:scout, and the DEFERRED cron note is resolved into a live cadence model.

## What Was Built

### scripts/session-start (Task 1) -- the CLI default cadence slot

A new sentinel-bounded best-effort slot (`# --- BEGIN Phase 145 scout cadence ... ---` / `# --- END Phase 145 scout cadence ---`) placed after the Phase-143.1 dial-memory-refresh slot and before the Phase-87-01a pre-commit hook block. It mirrors the proven 124/143.1 soft-fail slot template:

- Fires `node "${PLUGIN_ROOT}/scripts/scout-cadence-runner.cjs" "${ROOM_DIR}"` in the BACKGROUND (trailing `&`) so it adds zero foreground latency to startup.
- Redirects stdout+stderr to /dev/null and appends `|| true` -- a failure in the scout cadence NEVER blocks or aborts session startup (soft-fail per the hook contract).
- Does NOT pass `--force`: session-start owns the THROTTLED default path. The runner's Plan-01 guard self-throttles to at-most-once-per-interval (default 24h), so most sessions are a sub-millisecond throttle short-circuit.
- No-op when `ROOM_DIR` is empty or not a directory.
- Gated behind the opt-out env var `SCOUT_CADENCE_SKIP=1` (emergency disable), mirroring the `BRAIN_STALENESS_SKIP` convention already in the file.
- Header comment block states the Canon Part 8 LOCAL-only / zero-egress posture (inherited from Plan 01), the soft-fail contract, and that the throttle lives in the runner's guard.

### commands/scout.md (Task 2A) -- DEFERRED resolved into a live cadence

Replaced the `## Cron Integration (DEFERRED)` section with a `## Scheduled Cadence (LIVE)` section documenting the three surfaces:

1. CLI default = session-start-throttle (the hook fires the runner in the background, self-throttled, no manual /mos:scout; opt out with `SCOUT_CADENCE_SKIP=1`).
2. Cron optional (CLI power users) = an exact crontab line calling `node <plugin>/scripts/scout-cadence-runner.cjs <room> --force`, noting `--force` bypasses the session throttle because cron owns the cadence.
3. Cowork = the scout-sentinel scheduled task, cross-referencing scheduled-tasks.md Task 6.

The section names the Phase-140 safe-auto-fire guard and the Canon Part 8 zero-egress posture, and states that `/mos:scout` remains the manual on-demand trigger. The existing Tri-Polar Notes section is intact.

### commands/scheduled-tasks.md (Task 2B) -- Cowork scout-sentinel repointed

Task 6 "Scout Sentinel" Execution block now calls the single runner:

```bash
node "${PLUGIN_ROOT}/scripts/scout-cadence-runner.cjs" "$ROOM_DIR" --force
```

`--force` is used because the Cowork scheduler owns the cadence (the scheduler interval IS the throttle). The "What It Does" list now names the SCHED-02 four (whitespace recompute, reverse-salient, opportunity-bank scan, competitor watch) alongside the scout sub-sensors, all behind the Phase-140 safe-auto-fire guard. The Output section mentions the structured summary plus the safeAutoFireCheck violations surface. The Requirements line adds SCHED-01.

## Canon Compliance

- **Part 7 (Reuse Before Build):** No new sensor and no new runner. This plan wires the Plan-01 runner into three EXISTING surfaces. The session-start cadence slot is the only net-new wiring, and it reuses the exact soft-fail slot template already proven twice (Phase 124 timeline, Phase 143.1 dial-memory).
- **Part 8 (Graph Boundary):** Zero-egress preserved. The session-start slot is a thin background invocation of the runner, which is zero-egress per Plan 01 (no Brain query, no web fetch; competitor-watch is a public-SIGNAL query plan for the surface layer). Repointing the Cowork task at the runner inherits the same posture.
- **Part 4 / Part 2 Engine 1:** The runner reports findings-to-graph for the surface layer to bind as typed edges; this plan does not change that contract, only the surfaces that invoke it.

## Acceptance Criteria -- all passed

Task 1 (session-start slot):
- The slot invokes scout-cadence-runner.cjs in the background with ROOM_DIR, soft-fails with `|| true`, and is bounded by BEGIN/END sentinels -- verified by grep.
- `bash -n scripts/session-start` parses clean (SLOT_OK) -- verified.
- SCOUT_CADENCE_SKIP=1 short-circuits the slot; no-op when no room resolves; would-fire when a room resolves -- all three branches proven in isolation (SKIPPED / NOOP_NO_ROOM / WOULD_FIRE).
- No em-dashes in the added block -- verified.

Task 2 (docs):
- scout.md documents all three surfaces (session-start-throttle default, cron-optional with an exact crontab line, Cowork cross-reference) and no longer carries a "Cron Integration (DEFERRED)" header (DOCS_OK; `! grep -q 'DEFERRED'` passes).
- scheduled-tasks.md Task 6 Execution calls scout-cadence-runner.cjs --force and names the SCHED-02 four sensors it composes -- verified.
- Both docs name the Phase-140 safe-auto-fire guard -- verified (GUARD_NAMED_BOTH; Phase-140 grep count 1 in scout.md, 2 in scheduled-tasks.md).
- No em-dashes in either edited file -- verified.

Plan-level verification block: session-start + scheduled-tasks.md reference the runner; scout.md documents session-start-throttle; bash -n parses clean; DEFERRED header gone; zero em-dashes across all three edited files (NO_EMDASHES_IN_ANY_EDITED_FILE).

## Deviations from Plan

None of Rules 1-4 triggered. The plan executed exactly as written.

## Known Stubs

None. All three surfaces are fully wired: the session-start slot invokes the real shipped runner in the background; scout.md documents the live cadence with a real crontab line; the Cowork Task 6 Execution block calls the real runner with --force.

## Self-Check: PASSED

- scripts/session-start (Phase 145 scout cadence slot) -- FOUND (grep scout-cadence-runner + SCOUT_CADENCE_SKIP)
- commands/scout.md (Scheduled Cadence LIVE) -- FOUND (grep session-start-throttle; DEFERRED absent)
- commands/scheduled-tasks.md (Task 6 repointed) -- FOUND (grep scout-cadence-runner --force)
- commit 2c30241a (Task 1 session-start) -- FOUND
- commit 34dbf613 (Task 2 docs) -- FOUND
