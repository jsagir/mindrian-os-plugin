---
phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i
plan: 02
subsystem: infra
tags: [doctor, contract-gate, cadence-always, card-fire-health, tdd, d-03, d-05]

# Dependency graph
requires:
  - phase: 217-01
    provides: cadence-gated accumulative engine (always/once split), flag gate, spread-into-report.checks, shared.cjs leaf module
provides:
  - D-03 hard-blocking module contract-parity gate over every doctor-modules.json entry (exit 1 on any declaration/contract gap; proves its own bite)
  - card-fire-health cadence:always doctor module (D-05) verifying the check-card-fire.cjs self-diagnostic instrument, live end-to-end through the Plan-01 engine path
  - --card-fire-health flag (parseArgs init + case + --all activation + usageText + classFlagsActive membership)
affects: [217-03, 217-04, 217-05, 217-06, doctor-check-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-03 gate = declaration completeness (renderer parity is already structural via 260711-nrd); nine rules per module, hard exit 1"
    - "two-way fix declaration parity: fix_supported:true <-> exports fix(); fix_supported:false <-> no fix export"
    - "in-memory negative self-test proves a gate bites without mutating the real registry"
    - "instrument-health module: verify the sibling diagnostic (log exists/valid-JSONL/fresh, library seams, session store) without chasing the open mystery it guards"

key-files:
  created:
    - tests/test-doctor-module-contract-parity.cjs
    - tests/test-doctor-card-fire-health.cjs
    - lib/core/doctor/card-fire-health-module.cjs
  modified:
    - data/doctor-modules.json
    - scripts/doctor.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "introduced_version for card-fire-health corrected from the plan's literal 1.15.3 to 1.15.3-beta.12 (the running version-of-record) -- a stable release sorts AFTER its own prereleases in semver, so 1.15.3 would trip the always-pass deferred-guard (which skips only the watermark lower-bound, NOT the future-version upper-bound) and the module would emit no row, failing the plan's own acceptance criteria and violating Pitfall 1 (anti-silence)"
  - "the D-03 gate's runner rules (6-9) run only after declaration rules (1-5) pass; a check may read real machine state, so rule 9 asserts vocabulary + non-empty detail only, never a specific ok/warn outcome (machine-independent)"
  - "the card-fire-health session store path is derived from the log-path home dir so a scratch ctx.log_path keeps the whole check hermetic (no touch of the real ~/.mindrian)"

requirements-completed: [D-03, D-05]

# Metrics
duration: ~35min
completed: 2026-07-11
---

# Phase 217 Plan 02: D-03 Contract Gate + D-05 Card-Fire-Health Module Summary

**The enforcement mechanism (D-03 hard-blocking contract-parity gate) and the first brand-new cadence:always module (D-05 card-fire-health) both land BEFORE any existing check migrates, so every Plan 03-06 migration is born under the gate and the new engine path is exercised end-to-end by a fresh module.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-11
- **Tasks:** 3 (1 auto, 1 TDD-RED, 1 GREEN)
- **Files:** 6 (3 created, 3 modified)

## Accomplishments

- **D-03 gate live and biting.** `tests/test-doctor-module-contract-parity.cjs` walks every `data/doctor-modules.json` entry and asserts nine rules (kebab id + uniqueness, valid-semver introduced_version, explicit `always|once` cadence, present string/null flag, explicit-boolean `fix_supported`, resolvable runner, exported `check()`, two-way fix declaration parity, and a `check()` invocation returning a vocab status + non-empty detail). Any gap enumerates to stderr and exits 1 (NOT advisory -- Part 11 R16's posture is deliberately not followed per CONTEXT). An in-memory negative self-test proves the gate actually bites (missing `fix_supported`, malformed entry, duplicate id).
- **D-05 module live end-to-end.** `lib/core/doctor/card-fire-health-module.cjs` (cadence:always, fix_supported:false) reports the health of the `scripts/check-card-fire.cjs` self-diagnostic instrument: intercept-log existence, per-line JSONL integrity, freshness (newest `ts` vs a 14-day window, `ctx.staleness_ms` seam), classifier/counter library-seam parity (`classifyCardFire`/`gateReachingEntries`/`computeBackstopHit`/`loadRegistry`), render-coverage registry parse, and session-store readability. It cites the OPEN stale-plugin-cache mystery in a header comment and deliberately does NOT chase it.
- **First cadence:always module through the whole Plan-01 engine path:** flag-gated (`--card-fire-health`), watermark-immune, spread into `report.checks['card-fire-health']`, rendered by the generic loop, tallied by computeSummary, and guarded by the D-03 gate. Verified in `--json`, plain-text, and `--all` runs; absent from a bare run (flag/all-gated, per plan).
- **TDD honored:** RED test committed (fails at require time, module absent) then GREEN implementation. Both new tests registered in the feynman suite.

## Task Commits

1. **Task 1: D-03 hard-blocking contract-parity gate + feynman registration** - `d0b08e44` (feat)
2. **Task 2: RED card-fire-health module test (6 hermetic cases)** - `837e398f` (test)
3. **Task 3: card-fire-health module + registry entry + --card-fire-health flag (GREEN)** - `bc3c2917` (feat)

## Files Created/Modified

- `tests/test-doctor-module-contract-parity.cjs` - NEW. D-03 nine-rule gate + in-memory negative self-test; `process.exit(1)` on any violation.
- `tests/test-doctor-card-fire-health.cjs` - NEW. Six hermetic behavior cases (absent/valid/malformed/stale log, contract, library-seam parity) via `mkdtempSync` scratch dirs; never touches real `~/.mindrian`.
- `lib/core/doctor/card-fire-health-module.cjs` - NEW. `check(ctx)` -> `{status, detail, action_lines?}`; exports `{ check, STALENESS_WINDOW_MS, interceptLogPath }`; no fix export.
- `data/doctor-modules.json` - MODIFIED. Registered `card-fire-health` (cadence:always, flag:cardFireHealth, fix_supported:false, introduced_version 1.15.3-beta.12).
- `scripts/doctor.cjs` - MODIFIED. parseArgs `cardFireHealth:false` init + `--card-fire-health` case + `--all` activation + usageText line; `classFlagsActive` now includes `flags.cardFireHealth`.
- `lib/memory/run-feynman-tests.cjs` - MODIFIED. Registered both new Wave-0 test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected card-fire-health introduced_version to keep the diagnostic live**
- **Found during:** Task 3 (pre-implementation version-resolution check)
- **Issue:** The plan specified `introduced_version: "1.15.3"`, reasoning that cadence:always makes the module "watermark-immune regardless." That is only half true: cadence:always skips the watermark LOWER-bound, but the always-pass STILL applies the future-version DEFERRED-guard (`semver.gt(introduced, running)` at scripts/doctor.cjs:4082). The running version-of-record in this environment resolves to `1.15.3-beta.12` (from the install cache via checkInstallVersion). Because a stable release sorts AFTER its own prereleases in semver, `gt("1.15.3", "1.15.3-beta.12") === true`, so the module would be DEFERRED, emit no `checks['card-fire-health']` row, and fail the plan's own acceptance criteria (`--card-fire-health --json` must show the row) while re-introducing the exact silent-diagnostic failure (Pitfall 1) the phase exists to kill.
- **Fix:** Set `introduced_version` to `1.15.3-beta.12` (== running version-of-record), so `gt` is false, the module is not deferred, and the cadence:always diagnostic is live now and for every install from this beta line forward.
- **Files modified:** data/doctor-modules.json
- **Commit:** bc3c2917

## Authentication Gates

None.

## Verification

- `node tests/test-doctor-module-contract-parity.cjs` -> exit 0 (2 assertions; both registry modules pass all 9 rules; negative self-test proves bite). `grep -c "process.exit(1)"` = 1; feynman registration count = 1.
- `node tests/test-doctor-card-fire-health.cjs` -> exit 0 (all 6 cases GREEN). `mkdtempSync` count = 2; 6 named cases.
- `node scripts/doctor.cjs --card-fire-health --json` -> `checks['card-fire-health']` present, status `ok`, non-empty detail.
- `node scripts/doctor.cjs --card-fire-health` (plain text) -> 1 rendered card-fire-health row.
- `node scripts/doctor.cjs --all --json` -> card-fire-health row present (status ok).
- `node scripts/doctor.cjs --json` (bare) -> card-fire-health ABSENT (flag/all-gated, per plan).
- Regression: test-doctor-fix-renderer (12 PASS), test-doctor-module-selector (19 PASS), class-b, class-f, ui-self-compliant, atomic-swap all PASS; `require('./scripts/doctor.cjs')` clean; `--help` exit 0.
- No em-dashes in any created/modified file (house rule).

## Threat Surface

- T-217-04 (declaration gaps -> Repudiation/DoS): mitigated by the hard-blocking contract-parity test (exit 1) + two-way fix declaration check. Live and biting.
- T-217-06 (Tampering, card-fire log parsing): mitigated -- per-line `JSON.parse` in try/catch; a malformed line becomes a warn finding (named count), never a throw. Verified by Case 3.
- T-217-SC: zero external packages installed (accept).

## Next Phase Readiness

- The D-03 gate now bites on every future migration: Plans 03-06 register each migrated check as a module and the gate fails their build closed if a declaration is missing. The card-fire-health module is the worked example of a cadence:always module running end-to-end through the Plan-01 engine.
- No blockers.

## Self-Check: PASSED

- FOUND: tests/test-doctor-module-contract-parity.cjs, tests/test-doctor-card-fire-health.cjs, lib/core/doctor/card-fire-health-module.cjs
- FOUND commits: d0b08e44 (Task 1), 837e398f (Task 2), bc3c2917 (Task 3)

---
*Phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i*
*Completed: 2026-07-11*
