---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 20
subsystem: research-planner-acceptance
tags: [acceptance, whitespace-slice, openalex, both-modes, part-8-sweep, live-smoke, floor-ledger, d-06, d-11, d-19]

requires:
  - phase: 363-15
    provides: research-planner CLI and the planner facade
  - phase: 363-16
    provides: room-started (ambient) quick runs
  - phase: 363-17
    provides: research_run MCP tool
  - phase: 363-18
    provides: /mos:research one runner
  - phase: 363-19
    provides: five commands as research planners
provides:
  - tests/test-363-acceptance-whitespace.cjs (W1-W9b, 14 checks, prints ACCEPTANCE_METRICS)
  - tests/test-363-acceptance-diffusion.cjs (F1-F4, 7 checks)
  - tests/test-363-part8-sweep.cjs (setup, D1-D7, S1-S9, 20 checks)
  - tests/test-363-live-smoke.cjs (opt-in, exits 77 without MOS_363_LIVE=1)
  - 363-ACCEPTANCE.md (verdicts, measured values, floor decisions, ENV GAPs, known limitation)
  - a deep-run fix (limiter-less scientific plans get lens lanes) with E14 in test-363-run-deep
affects: [363-21, 363-22]

tech-stack:
  added: []
  patterns:
    - "Acceptance runs the real doors: spawned CLI with a replay preload, the MCP register seam, the ambient branch; the net guard counter is the last check"
    - "A sweep snapshots what already carries the planted marker at room creation and proves no door added to it (files by count, room.db by node count)"
    - "A live smoke that can only pass honestly: exit 77 on any typed environment gap, exit 1 on a live contract break"

key-files:
  created:
    - tests/test-363-acceptance-whitespace.cjs
    - tests/test-363-acceptance-diffusion.cjs
    - tests/test-363-part8-sweep.cjs
    - tests/test-363-live-smoke.cjs
    - .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-ACCEPTANCE.md
  modified:
    - lib/core/research-planner/deep.cjs
    - tests/test-363-run-deep.cjs
    - data/floor-ledger.json
    - data/render-coverage-registry.json

key-decisions:
  - "The live smoke was NOT run against real OpenAlex. MOS_363_LIVE was unset and the caller said not to turn live calls on; the outcome is recorded as pending human/env in 363-ACCEPTANCE.md with the exact command. No live number is invented."
  - "All 14 research-planner floor rows stay disclosed, none changed. The ledger allows only disclosed or calibrated, calibrated needs gold labels and n, and offline replay timing (engine and process overhead, no network) cannot justify moving a default. Each row's provenance now names 363-ACCEPTANCE.md and the measurement."
  - "zone_term is not implemented here: this plan's scope has no ambient.cjs, planner or CLI change. The gap is stated as a known limitation and pinned by W9b; the 363-19 sidecar design is reproduced in the acceptance doc as the follow-on."
  - "isSR in deep.cjs now also requires at least one limiter, so a lite whitespace plan built in a researcher room (scientific-roadmapping engine, no limiters) runs on lens lanes."

patterns-established:
  - "Fixture-room acceptance for a two-section cohort: the same question set runs through CLI, MCP and ambient doors and must give the same verdict"

requirements-completed: [DRP363-17, DRP363-20, DRP363-04]
requirements-progressed: [DRP363-16]

duration: ~3h
completed: 2026-09-30
---

# Phase 363 Plan 20: Acceptance, Part 8 sweep, live smoke and floors Summary

**The Whitespace plus OpenAlex slice now passes offline in both modes through the CLI, MCP and ambient doors, the diffusion lens is selected by the local rule and read in the deep run, and a Part 8 sweep over every door finds no marker and no key leak; the live smoke is built but was not run (pending human or env), and the 14 disclosed floors were reviewed and kept.**

## PLAN_BASE

`28e5e5e982264f7b7b489ac12d2396696ca389f8` (HEAD before the first edit).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 | 8b97fc028 | tests/test-363-acceptance-whitespace.cjs, tests/test-363-acceptance-diffusion.cjs |
| 1 (fix found by acceptance; E14 red first) | 8f0dbba00 | lib/core/research-planner/deep.cjs, tests/test-363-run-deep.cjs, data/render-coverage-registry.json |
| 2 + 3 | 9769f1e7f | tests/test-363-part8-sweep.cjs, tests/test-363-live-smoke.cjs, data/floor-ledger.json, 363-ACCEPTANCE.md |

All three are ancestors of HEAD (`git merge-base --is-ancestor`).

## Tests

- `node tests/test-363-acceptance-whitespace.cjs`: PASS 14, FAIL 0 (W1-W9b, W5b, guards); prints `ACCEPTANCE_METRICS`.
- `node tests/test-363-acceptance-diffusion.cjs`: PASS 7, FAIL 0 (F1-F4, guards).
- `node tests/test-363-part8-sweep.cjs`: PASS 20, FAIL 0. A scratch mutation planting the marker in a search term made S1, S2, S6, S7 and S9 fail, so the sweep can fail.
- `node tests/test-363-live-smoke.cjs` without the flag: `ENV GAP: MOS_363_LIVE unset`, exit 77.
- `node tests/test-363-run-deep.cjs`: PASS 17 (E14 added; red first).
- `node scripts/check-floor-ledger.cjs --check`: PASS (51 rows, 0 unresolved).
- `bash tests/run-all-363.sh`: **PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10** (the one SKIPPED leg is the live smoke, MOS_363_LIVE unset).

## Live smoke outcome

NOT RUN. `MOS_363_LIVE` was unset and the instruction was not to enable live calls. Recorded as pending
human/env, not faked. To run it once (at most 3 quick and 16 deep searches, about $0.02 keyless):
`MOS_363_LIVE=1 node tests/test-363-live-smoke.cjs`. Exit 0 with `LIVE_METRICS {...}` is a real pass;
exit 77 is a typed environment gap (no network, 429, exhausted budget, timeout, HTTP error); exit 1 is a
live contract break.

## Measured (offline replay only; no network time)

Four consecutive runs, n=6 quick calls and n=3 deep loops per run; ranges are lowest to highest run.

| Measure | p50 | p90 |
|---------|-----|-----|
| `run-quick` CLI call | 108 to 165 ms | 113 to 243 ms |
| `plan` CLI call | 102 to 173 ms | 116 to 209 ms |
| `grant approve` CLI call | 118 to 178 ms | 130 to 213 ms |
| one deep-loop CLI call (12 per whitespace deep run) | 99 to 125 ms | 103 to 147 ms |
| whole whitespace deep loop | 1.19 to 1.50 s | 1.20 to 1.61 s |
| MCP `run_quick` in process | 8.6 to 19.5 ms | one sample per run |

Searches per deep run: whitespace 3 of 16 (stop `saturation`); Scientific Roadmapping 15 of 16 (stop
`cap`). Rows per query on the replay: 0 (gap route) or 5 (hit routes, at the 5-row cap). Live latency,
counts and remaining budget: not measured.

## Floor decisions

All 14 `research-planner-*` rows: keep, status stays `disclosed`, `provenance` now a one-line reference
to 363-ACCEPTANCE.md and the measurement. Grant expiry 30 days (mirrors the 30-day cache TTL) and the
1-per-hour throttle (cost policy, not throughput; a quick run is 3 searches) are kept; `DEEP_MAX_SEARCHES`
16 binds for scientific runs and not for whitespace; `GAP_COUNT_FLOOR` 3 stays unmeasured on real
OpenAlex until the live smoke and a labelled sample. No module constant changed. Full table in
363-ACCEPTANCE.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Whitespace deep run in a researcher room had no lanes**
- **Found during:** Task 1 (W5, escalate from a thin quick run)
- **Issue:** A researcher room gives every plan the `scientific-roadmapping` engine, including a lite whitespace plan with no limiters. `deep.laneSpecs` took the limiter-lane path with nothing to lane on, so `escalate` returned `revise` with `no_search_terms` and the deep run could not start.
- **Fix:** `isSR` in `deep.cjs` also requires at least one limiter; E14 added to `tests/test-363-run-deep.cjs` first (red: no round-one lanes), then green (17/17). The SR path (E1-E13, F3) is unchanged.
- **Files modified:** lib/core/research-planner/deep.cjs, tests/test-363-run-deep.cjs
- **Commit:** 8f0dbba00

**2. [Rule 3 - Blocking] Stale render coverage registry blocked the lib/core commit**
- **Found during:** committing the fix above
- **Issue:** 363-18 moved `commands/research.md` and `skills/research/SKILL.md` to Form B `hitl_stages`, so their two F.8 entries in `data/render-coverage-registry.json` were stale; the pre-commit render-coverage gate blocks any `lib/core` commit (`--check` red, plain check green).
- **Fix:** `node scripts/build-render-coverage.cjs`; the diff is exactly those two entries and two counts.
- **Files modified:** data/render-coverage-registry.json
- **Commit:** 8f0dbba00

**3. [Interpretation] Live smoke not run**
- Task 3 says run it once. The caller instruction (no live calls without the flag, record pending rather than fake) was followed; see "Live smoke outcome".

**4. [Interpretation] "Answer line names both halves"**
- Each verdict's line names its own half (W1: no published work turned up; W2: already studied under another wording), so the two runs together cover both halves. No product text changed.

No auth gates.

## Carry-forward: zone_term

Not closed. Production `whitespace-results.json` has no `zone_term`; ambient runs on real rooms answer
`context_insufficient` / `no_zone_term` (pinned by W9b). Follow-on (363-19 design): room-local sidecar
`.mindrian/whitespace-zone-terms.json` written only after F.0 approval; `ambient.zoneTermOf` reads
`gap.zone_term`, then the sidecar, then falls back. Not in this plan's scope.

## Bookkeeping catch-up (363-19 and this plan)

- ROADMAP.md: 363-19 and 363-20 ticked; `Plans:` count set to 20/22.
- STATE.md: frontmatter progress and Current Position updated by hand (no state.* writer).
- REQUIREMENTS.md: DRP363-13, DRP363-19, DRP363-20 and DRP363-02 were already `[x]`; each re-verified against landed code and tests this plan (command-contract 8/8, runner-contract 9/9, pyramid 21, perspective 17, structure 14, families 11, plan-schema 27, F1-F4). No edit was needed.
- Flag for phase close (363-22): DRP363-16 is ticked but is not fully satisfied (live smoke not run; human D-06 check 363-21 pending); DRP363-05 (audit ledger) is still `[ ]` although 363-09 delivered it and the sweep (S6) verifies it.

## What 363-21 (the human D-06 check) needs from this plan

- The offline acceptance is green; nothing here scores question quality. The rubric check is on the `/mos:map-unknowns` plan, not the run.
- A researcher-role room now also works for a whitespace deep run (the bug above), so 363-21's second (researcher, scientific-roadmapping engine) plan is not affected by the lane fix: it only changes lane selection at run time, not plan assembly.
- The live smoke command (above) is the one open acceptance item; run it when the navigator allows live calls and paste `LIVE_METRICS` into 363-ACCEPTANCE.md.

## Known Stubs

None. Every acceptance leg drives live engine code; the only simulated part is the lane analyst's rows (deterministic quotes of fetched records), stated in 363-ACCEPTANCE.md.

## Threat Flags

None new. The sweep covers T-363-17 and T-363-09; the live smoke covers T-363-51 (77 on any gap, never PASSED); T-363-10 accepted as planned and not exercised.

## Self-Check: PASSED

Found: the four test files, 363-ACCEPTANCE.md, deep.cjs, floor-ledger.json. Commits 8b97fc028, 8f0dbba00 and 9769f1e7f are ancestors of HEAD. `grep -P '[\x{2013}\x{2014}]'` over every written file: no hits.
