---
phase: 387-eureka-reachable-on-a-normal-install
plan: "07"
subsystem: eureka-doctor
tags: [doctor, readiness, reporter, tdd]
requires: ["387-03"]
provides:
  - "lib/core/doctor/eureka-engine-readiness-module.cjs (check only) and the registry row eureka-engine-readiness"
affects: []
key-files:
  created:
    - lib/core/doctor/eureka-engine-readiness-module.cjs
    - tests/test-387-eureka-doctor-point.cjs
  modified:
    - data/doctor-modules.json
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 07: Doctor point for engine readiness Summary

`/mos:doctor` now has one module that reports the Eureka engine as not set up (skip), ready for the graph tools (ok) or set up but not ready (warn) with the cause and one fix line. It is a reporter only.

## What was done (TDD)

- RED (9e42b00f5): `tests/test-387-eureka-doctor-point.cjs`, 248 lines, arms D1 to D13.
- GREEN (892ab2de4): the module (138 lines) and one registry row (9 lines) in `data/doctor-modules.json`.

## Verification (run in this session)

- `node tests/test-387-eureka-doctor-point.cjs`: exit 0, 13 passed, 0 failed.
- `bash tests/run-all-387.sh`: exit 0, PASS=13 FAIL=0 SKIPPED=1 (live leak test, env gap).
- Arms: D1 no engine is skip with no spawn; D2 graph ready is ok and names the routes not ready; D3 to D6 saved folder gone, uv missing, Python missing, no environment folder are warn; D7 no mcp package is warn; D8 unreadable layout is warn "not verified", never ok; D9 Node 20 is ok for graph tools and names node-workers not ready; D10 only 3 argv shapes spawn and the source holds no network, no engine spawn and no pyvenv.cfg read; D11 registry row (fix_supported false, cadence always, runner resolves, check only); D12 check never throws; D13 the real doctor with a temp HOME shows the row as skip.

## Deviations from Plan

None found in the commits.

## Known Stubs

None found.

## UNVERIFIED

- A run of the full `/mos:doctor` against a real machine with a real engine. Only D13 (temp HOME, skip) ran.
- The doctor contract-parity gate was not run on its own here; it is covered only if it is part of D11 or the run-all script.

## Risks

- The ok line says "ready for the graph tools" by reading installed package groups. A real engine with an odd layout may report warn (not verified) by design.

## Self-Check: PASSED (as run above)

- Commits 9e42b00f5 and 892ab2de4 exist.
