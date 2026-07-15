---
phase: 225-per-session-room-binding-and-multi-session-reconciliation-se
plan: 02
subsystem: infra
tags: [doctor, bind-check, sqlite, wal-reset, session-presence, canon-part-8, phase-218, never-block]

# Dependency graph
requires:
  - phase: 194-per-session-room-binding
    provides: "doctor.cjs --bind-check never-block block; session-presence.cjs hasCoSession co-session probe; the presence ledger schema"
  - phase: 218
    provides: "the WAL-reset corruption finding (commit 298a1c84); the SQLITE_BUSY fix (D-05) that this advisory deliberately does NOT re-touch"
provides:
  - "_walResetAdvisory(opts): a never-block doctor finding that fires only on bundled SQLite < 3.51.3 AND a live co-session"
  - "_sqliteVersionLt(a, b): a zero-dep numeric-segment version compare (catches the lexicographic 3.51.10<3.51.3 trap)"
  - "--bind-check wiring that appends the WAL finding to report.findings without ever touching report.healthy or the exit code"
  - "tests/test-225-wal-advisory.cjs (5 legs)"
affects: [225-03, doctor, run-all-225]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Environment-watch findings ride the existing --bind-check door as a findings-row only, never a health verdict (report.healthy is a room-STRUCTURAL signal; an unrepairable environment condition must not degrade the statusline glyph)"
    - "Injectable seams (sqliteVersion, hasCoSession) make an environment-dependent probe hermetically unit-testable; production defaults resolve inside the same single try/catch"
    - "Numeric-segment version compare, not lexicographic: '3.51.10' is NEWER than '3.51.3' and must not false-fire"

key-files:
  created:
    - tests/test-225-wal-advisory.cjs
  modified:
    - scripts/doctor.cjs

key-decisions:
  - "PD-2: doctor advisory ONLY this phase - NO extraction-worker hasCoSession guard. The drain-worker files are Phase 224's in-flight surface (224-03/04 pending at plan-time), so a guard there is a live cross-phase collision; the WAL-reset leg is upstream/code-unfixable anyway, so detect-only is the honest move."
  - "The advisory is a findings-row WATCH item, never a health verdict: report.healthy and the exit code are provably untouched, so the statusline room-health glyph is not degraded for a condition the user cannot repair locally."
  - "Hand-rolled _sqliteVersionLt (not the file's existing semver import): the SQLite version literal is a plain numeric triple with no prerelease/caret semantics, and a segment compare has nothing to get wrong; garbage input returns false so it can never fire."

patterns-established:
  - "Clone the doctor.cjs:2578 --bind-check never-block contract for any new bind-time environment check: push a WARN string, never flip healthy, keep the unconditional process.exit(0) byte-identical"
  - "One try/catch around the whole advisory body returning null in catch: any probe/require/presence fault degrades to no-finding (never-crash, never-block, T-194-19)"

requirements-completed: [REQ-4]

# Metrics
duration: ~15min
completed: 2026-07-15
---

# Phase 225 Plan 02: WAL-reset corruption doctor advisory Summary

**`doctor --bind-check` now prints a never-block WARN when the bundled SQLite is inside the upstream WAL-reset corruption window (< 3.51.3, fixed in commit 298a1c84) AND a live co-session is present in the room - the exact moment the 2-connection precondition becomes true - while provably leaving report.healthy and the exit code untouched, because the corruption is upstream and code-unfixable here (Node bundles SQLite) so detection is the only honest action.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files:** 2 (1 modified, 1 created)

## Accomplishments

- Added `_walResetAdvisory(opts)` to `scripts/doctor.cjs`: fires a single WARN finding ONLY when `_sqliteVersionLt(version, '3.51.3')` AND a live co-session is present. Both `sqliteVersion` and `hasCoSession` are injectable test seams; production defaults resolve inside one try/catch (in-memory `node:sqlite` `sqlite_version()` probe holding zero user bytes, and a lazy `require` of `session-presence.cjs::hasCoSession` called with `{ roomDir, sessionId }` so the binding session never counts itself as its own co-session).
- Added `_sqliteVersionLt(a, b)`: a zero-dependency numeric-segment version compare. It deliberately does NOT reuse the file's existing `semver` import (the SQLite version is a plain numeric triple); non-string / unparseable input returns false so a garbage version can never fire the advisory. This is the leg that defeats the lexicographic trap where `'3.51.10' < '3.51.3'` as strings.
- Wired the advisory into the existing `if (flags.bindCheck)` block AFTER the room-health-cache persist (so the statusline glyph maps the UNMODIFIED report), pushing the finding onto `report.findings` only. `report.healthy` is never written and the block's unconditional `process.exit(0)` is byte-identical (never-block, T-194-19).
- Additive export of `_walResetAdvisory` and `_sqliteVersionLt` (existing keys never reordered).
- `tests/test-225-wal-advisory.cjs`: 5 legs (fire / no-fire version / no-fire co-session / never-crash / e2e never-block), self-running `node:assert`, SKIP-safe.

## Task Commits

1. **Task 1: _walResetAdvisory + _sqliteVersionLt + --bind-check wiring + exports** - `9169b5a3` (feat)
2. **Task 2: tests/test-225-wal-advisory.cjs (5 legs)** - `f37bdf21` (test)

_Note: this plan ran sequentially on the shared main working tree alongside a concurrent Phase-224 session; only `scripts/doctor.cjs` and `tests/test-225-wal-advisory.cjs` were staged (per-file `git add`), never a wildcard._

## Files Created/Modified

- `scripts/doctor.cjs` - Added `_sqliteVersionLt`, `_walResetAdvisory`, the `--bind-check` advisory wiring, and the additive export.
- `tests/test-225-wal-advisory.cjs` - The 5-leg proof.

## Decisions Made

- **PD-2 honored verbatim:** no extraction-worker guard ships this phase; zero Phase-224 files were touched. The advisory is the entire scope.
- **Findings-row, not a verdict:** the WAL window is an environment condition the user cannot repair locally, so flipping `report.healthy` would wrongly degrade the room-health glyph. The advisory only appends to `report.findings`.
- **Hand-rolled segment compare over the `semver` import:** simpler, dependency-clean for a plain numeric triple, and the no-string-parse-false-fire guard is explicit.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `node --check scripts/doctor.cjs` - passes
- Seam behavior: `_walResetAdvisory` fires a WARN naming `3.51.3` on `{sqliteVersion:'3.51.2', hasCoSession:()=>true}`; returns null on `3.51.3` (fixed), on `hasCoSession:()=>false`, and on a throwing `hasCoSession` (never-crash) - all confirmed
- Segment compare: `_sqliteVersionLt('3.51.10','3.51.3')` is false (no lexicographic false-fire); `'3.51.2'<'3.51.3'` true; `'4.0.0'`/`null` do not fire - confirmed
- `node scripts/doctor.cjs --bind-check /tmp/nonexistent-room; echo $?` prints `0` (never-block intact)
- `node tests/test-225-wal-advisory.cjs` - PASS (all 5 legs), exit 0
- `grep -c "_walResetAdvisory" scripts/doctor.cjs` = 3 (definition + bindCheck call site + export)
- `node scripts/check-render-coverage.cjs` = 0 gap; `node scripts/build-connector-registry.cjs --check` = OK (my surfaces green - no new invocable surface, the check rides the existing --bind-check door, REQ-5 Part 11)

## Deferred Issues (pre-existing, NOT this plan's regressions)

`node scripts/doctor.cjs --acceptance` reports 13/15 with two failures, both baseline-confirmed as pre-existing and out of this plan's scope:
- `verify-release-clean-tree` - tracked-file drift: `dashboard/graph.json` was already modified at session start (not touched by this plan).
- `coverage-gate` - the `skill-mirrors` sub-gate exited 1; my own surfaces (`render-coverage`, `connector-registry`) both pass green, so this is a skill-mirror drift unrelated to `doctor.cjs`.

These match the documented Phase-224 environmental acceptance baseline `{coverage-gate, verify-release-clean-tree}`. Logged as environmental; no NEW regression introduced by this plan.

## Next Phase Readiness

- Plan 225-03 (`run-all-225.sh` aggregator + `run-feynman-tests` registration + ENV-TUNING doc + rethinking-mindrianos compositing filing) remains; this plan's `test-225-wal-advisory.cjs` already runs standalone via `node` and is ready to be registered as a `run_if` leg.

---
*Phase: 225-per-session-room-binding-and-multi-session-reconciliation-se*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: scripts/doctor.cjs
- FOUND: tests/test-225-wal-advisory.cjs
- FOUND commit: 9169b5a3 (Task 1 feat)
- FOUND commit: f37bdf21 (Task 2 test)
