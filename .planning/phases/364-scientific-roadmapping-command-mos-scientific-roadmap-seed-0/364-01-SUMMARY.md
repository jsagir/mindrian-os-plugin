---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 01
subsystem: requirements, phase-gate
tags: [requirements, aggregator, phase-gate, wave-0]
requires: []
provides:
  - "21 open SRM364-01..21 rows in .planning/REQUIREMENTS.md"
  - "tests/run-all-364.sh, the phase aggregator, written once"
affects: [364-02, 364-03, 364-04, 364-05, 364-06, 364-07, 364-08, 364-09, 364-10, 364-11, 364-12]
key-files:
  created:
    - tests/run-all-364.sh
  modified:
    - .planning/REQUIREMENTS.md
decisions:
  - "Aggregator sandboxes HOME, USERPROFILE and MINDRIAN_ROOMS_HOME to mktemp -d for every leg; only the opt-in live smoke sees the real HOME"
metrics:
  tasks: 2
  files: 2
  completed: 2026-10-02
requirements: [SRM364-21]
---

# Phase 364 Plan 01: Requirements floor and phase aggregator Summary

Minted the 21 SRM364 requirement rows (pure additions, own commit) and wrote `tests/run-all-364.sh` once with every planned 364 leg named, green at base.

PLAN_BASE: `cce8abbbee83ee74dbff39466fe627594825bb63`

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Mint SRM364 rows | a9c075851 | .planning/REQUIREMENTS.md (+47, 0 removed) |
| 2 | Aggregator | 509ddb38d | tests/run-all-364.sh (new, executable) |

Both commits were made with `git commit --only <path>` and verified as ancestors of HEAD.

## What was built

- Task 1: a `### Phase 364 - Scientific Roadmapping command ...` section with intro paragraph and 21 `- [ ]` rows (each naming its plan) inserted directly before `## Traceability`, plus one new traceability line `Also SRM364-01..21 ...` directly after the `plus DRP363-01..20 ...` line. Diff is 47 insertions, zero removed lines, no em-dash or en-dash.
- Task 2: `tests/run-all-364.sh` with `run`, `run_if`, `run_known_if` (verbatim from run-all-366.sh) and a new `run_optin`. Sections: 13 phase legs behind `run_if`; the opt-in `test-364-live-smoke` (runs only with `MOS_364_LIVE=1`, then with the real HOME); 35 regression legs; 10 generator gates; 3 known reds via `run_known_if` with literal signatures; CIRS leg over `364-*-PLAN.md`; em-dash and en-dash fence over the 364 path list.

## Verification (measured)

`bash tests/run-all-364.sh` at PLAN_BASE plus these commits: `PASSED=47 FAILED=0 SKIPPED=14 KNOWN=3`, exit 0. The 14 skips are the 13 not-yet-landed phase legs (each `SKIPPED (missing ...)`) plus the opt-in smoke (`SKIPPED (opt-in, MOS_364_LIVE unset)`). The 3 known reds matched their signatures (`plugin_version drift` x2, `connector mcp:artifact_file carries off-schema field "layer"`). All acceptance greps pass: 13 `run_if "` lines, 6 `run_known_if` mentions, zero dash bytes, file executable.

## Deviations from Plan

None - plan executed exactly as written. The CIRS leg passes all `364-*-PLAN.md` plans present at run time (13 plan files existed).

## Known Stubs

None.

## Threat Flags

None. T-364-01 mitigated (zero removed lines asserted, `--only` commit, dirty-file precheck clean); T-364-02 mitigated (reds pass only through `run_known_if` with a literal signature).

## Notes for the orchestrator

STATE.md and ROADMAP.md were not touched (orchestrator-owned this phase). No peer-owned file was staged or modified.

## Self-Check: PASSED

- FOUND: tests/run-all-364.sh
- FOUND: Phase 364 section and 21 rows in .planning/REQUIREMENTS.md
- FOUND commits: a9c075851, 509ddb38d (both ancestors of HEAD)
