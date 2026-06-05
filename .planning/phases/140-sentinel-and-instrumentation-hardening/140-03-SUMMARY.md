---
phase: 140-sentinel-and-instrumentation-hardening
plan: 03
subsystem: testing
tags: [telemetry, postToolUse-hook, sentinel, deadline-monitor, sqlite-jsonl, canon-part-8, hard-04, hard-05]

# Dependency graph
requires:
  - phase: 88.1-uiux-polish
    provides: "Plan 88.1-16 query-efficiency telemetry hook + scout aggregator + token-estimator (the surfaces this plan repairs)"
  - phase: 109-sql-context-memory-navigation-spine
    provides: "Canon Part 9 room.db schema context (sibling to the sentinel data flow)"
provides:
  - "Relaxed query-efficiency gate measuring ALL turns (HARD-04 / D-01) -- telemetry no longer logs 0 events"
  - "Aggregator --mos-only command-population filter preserving the published 57x-claim denominator (D-01a)"
  - "140-57X-CLAIM-RECONCILIATION.md documenting the denominator shift + release-process flag"
  - "Deadline monitor .planning/STATE.md phase-deadline scan branch (HARD-05) -- the NATO deadline now surfaces"
  - "Two regressions: extended query-efficiency-telemetry.test.cjs (hook-invocation) + new test-deadline-monitor-planning-state.sh"
affects: [Phase 145 scheduled-sensors, release-process 57x-claim gate, scout suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook-invocation test pattern: spawn the real PostToolUse hook with a throwaway HOME + .room-root fixture and assert on the written JSONL"
    - "Env-var test seam (PLANNING_STATE_FILE) so a bash sentinel can be exercised against a fixture without touching live state"

key-files:
  created:
    - .planning/phases/140-sentinel-and-instrumentation-hardening/140-57X-CLAIM-RECONCILIATION.md
    - tests/test-deadline-monitor-planning-state.sh
  modified:
    - scripts/query-efficiency-telemetry.cjs
    - scripts/scout-telemetry-aggregator.cjs
    - scripts/sentinel-deadline-monitor
    - lib/memory/query-efficiency-telemetry.test.cjs

key-decisions:
  - "command field set to '' (not null) for the all-turns case so the 8-field validateEventShape contract still holds without adding a field (Canon Part 8)"
  - "Aggregator default stays all-turns; --mos-only is opt-in so both populations coexist and the published number is never silently redefined"
  - "Deadline monitor resolves .planning/STATE.md via PLANNING_STATE_FILE env seam (else repo-root), reusing portable_date_to_epoch + the epoch==0 skip guard"

patterns-established:
  - "Pattern: relax a too-tight instrumentation gate by widening the population, not by adding fields -- preserves the scalar-only Part-8 invariant"
  - "Pattern: when a denominator change can move a published number, keep BOTH population views and document the reconciliation rather than overwrite"

requirements-completed: [HARD-04, HARD-05]

# Metrics
duration: ~45 min
completed: 2026-06-05
---

# Phase 140 Plan 03: Telemetry Gate Relaxation + Deadline-Monitor Phase Scan Summary

**Relaxed the query-efficiency PostToolUse hook to measure all turns (HARD-04/D-01) while keeping a --mos-only aggregator view so the published "up to 57x" claim stays measurable on its original denominator (D-01a), and taught the deadline monitor to read .planning/STATE.md phase deadlines so the NATO 2026-06-01 deadline surfaces as OVERDUE instead of CLEAR (HARD-05).**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-05T03:30:00Z (approx)
- **Completed:** 2026-06-05T04:16:23Z
- **Tasks:** 3 (all TDD or test-backed)
- **Files modified:** 4 modified, 2 created

## Accomplishments

- HARD-04 closed: removed the `if (!command) return exitSilent()` early-return so a Read/Grep/Glob turn in a resolvable room writes a JSONL line even with no `/mos:` context. The tool gate, room gate, and tokensUsed>0 gate all stay. The hook had been logging 0 events because nothing in the repo ever set the `/mos:` signal it required.
- D-01a satisfied: added `--mos-only` + `filterCommandPopulation()` to the scout aggregator so the median/top-5/threshold can be measured on the `/mos:` command population the "up to 57x" claim was defined against. `RELEASE_GATE_THRESHOLD_X` unchanged at 40. Wrote `140-57X-CLAIM-RECONCILIATION.md` with NO_DATA evidence (the JSONL is absent on this box, matching the HARD-04 symptom) plus a synthetic proof that the all-turns denominator materially shifts the median (26.5x RETUNE vs 53.5x PASS) and a release-process flag.
- HARD-05 closed: added a `.planning/STATE.md` phase-deadline scan branch reusing `portable_date_to_epoch` + the epoch==0 skip guard, pushing a distinct `phase`-source alert through the existing report path. Verified against the LIVE `.planning/STATE.md`: the real NATO 2026-06-01 Hard deadline now surfaces as OVERDUE (it previously read CLEAR); the `Soft deadline: --` placeholder is correctly skipped.
- Two regressions added: 6 hook-invocation tests extending `lib/memory/query-efficiency-telemetry.test.cjs` (18/18 green) and a new `tests/test-deadline-monitor-planning-state.sh` (RED-before / GREEN-after, distinct-source-label + absent-file resilience assertions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Relax the telemetry gate to all turns + extend the existing test (HARD-04 / D-01)** - `e14f3b66` (fix)
2. **Task 2: Preserve the 57x-claim population in the aggregator + reconciliation note (D-01a)** - `9453da10` (feat)
3. **Task 3: Add the .planning/STATE.md phase-deadline scan branch to the deadline monitor (HARD-05)** - `3832ec2b` (feat)

_TDD note: Task 1 and Task 3 followed RED then GREEN inline; both source edits were preceded by a failing regression. They are committed as single task commits (test + source together) per the sequential-executor commit cadence, with RED/GREEN narrated in the execution log._

## Files Created/Modified

- `scripts/query-efficiency-telemetry.cjs` - removed the command early-return; command now defaults to '' for all-turns; warn advisory falls back to tool name
- `scripts/scout-telemetry-aggregator.cjs` - `--mos-only` flag + `filterCommandPopulation()` + population label in human/JSON output
- `scripts/sentinel-deadline-monitor` - `.planning/STATE.md` phase-deadline scan branch (env-seam resolvable), `phase` source label
- `lib/memory/query-efficiency-telemetry.test.cjs` - +6 hook-invocation tests (all-turns, /mos: preserved, tool/room/tokens gates, Part-8 field-set)
- `tests/test-deadline-monitor-planning-state.sh` - new HARD-05 bash smoke harness
- `.planning/phases/140-sentinel-and-instrumentation-hardening/140-57X-CLAIM-RECONCILIATION.md` - D-01a reconciliation note

## Decisions Made

- Used `command: command || ''` rather than null so the existing `validateEventShape` 8-field contract holds without weakening the validator or adding a field (Canon Part 8 invariant preserved).
- Kept the aggregator default as all-turns and made `--mos-only` opt-in, so both denominators are always available and the published number is never silently redefined.
- Resolved `.planning/STATE.md` via a `PLANNING_STATE_FILE` env seam (falling back to repo-root) so the bash sentinel is testable against a fixture and the live dogfood file both work.

## Deviations from Plan

None - plan executed exactly as written. The plan's Task 1 `<read_first>` cited specific line ranges that had drifted slightly from the live file, but the gate-chain and event-build edits landed exactly as specified; no behavioral deviation.

## D-01a 57x Reconciliation Finding

- On this box the telemetry JSONL is ABSENT, so both `--all` and `--all --mos-only` report NO_DATA. There is no live all-turns-vs-/mos:-only delta to report yet; the relaxation is what enables future accumulation.
- Synthetic controlled data (2 high-ratio /mos: turns + 2 cheap non-/mos: Reads) proves the concern is real and material: all-turns median = 26.5x (RETUNE, below the 40x gate) versus /mos:-only median = 53.5x (PASS). The cheap non-/mos: Reads deflate the denominator.
- Conclusion: the published "up to 57x" claim LANGUAGE does NOT need to change (it remains a /mos:-specific claim, still measurable via `--mos-only`). One release-process flag raised: when the release "consumes the 57x claim before tagging" it MUST run the aggregator with `--mos-only`, not the bare all-turns median. Any actual README/CHANGELOG copy rewrite is DEFERRED per CONTEXT Deferred Ideas and was NOT performed.

## Known Stubs

None. No stub/placeholder data introduced. The NO_DATA telemetry state is a real runtime condition (the JSONL has never been written on this box), not a stub; the relaxed gate is what will populate it going forward.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary surface introduced. The relaxed gate adds no JSONL field and no network call (Canon Part 8 verified: zero fetch/http/curl/brain/tavily call surface in both touched .cjs files). The deadline date parsing reuses the existing epoch==0 input-validation guard (T-140-08 mitigated).

## Issues Encountered

- The existing `query-efficiency-telemetry.test.cjs` tested only the pure token-estimator math, not the hook itself. Extending it required adding a hook-invocation harness (spawn the real hook with a throwaway HOME + `.room-root` fixture and assert on the written JSONL). This stayed within "extend the existing file" (Canon Part 7) -- no parallel test file created.

## User Setup Required

None - no external service configuration required. All edits are LOCAL script/hook changes.

## Next Phase Readiness

- Phase 145 (scheduled sensors) prerequisite advanced: HARD-04 and HARD-05 of the 5-bug scout-safety set are now closed and regression-locked. The remaining HARD-01/02/03 are other plans in Phase 140.
- Release-process owners: note the D-01a flag -- run `node scripts/scout-telemetry-aggregator.cjs --mos-only` when validating the 57x claim before tagging.

---
*Phase: 140-sentinel-and-instrumentation-hardening*
*Completed: 2026-06-05*

## Self-Check: PASSED

- key-files.created exist on disk: `140-57X-CLAIM-RECONCILIATION.md` FOUND, `tests/test-deadline-monitor-planning-state.sh` FOUND.
- key-files.modified exist on disk: all four FOUND.
- Task commits exist: e14f3b66 FOUND, 9453da10 FOUND, 3832ec2b FOUND.
- Plan verification re-run: telemetry test 18/18 pass; `--mos-only` runs + note exists; deadline-monitor test GREEN; zero network call surface; zero em-dashes.
