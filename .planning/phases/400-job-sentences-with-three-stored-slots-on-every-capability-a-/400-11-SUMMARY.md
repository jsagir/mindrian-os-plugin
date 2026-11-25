---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 11
subsystem: problem-axes
tags: [problem-axes, level-wording, wicked-cutoff, suggest-next, ax-01, ax-02, f-06, f-07, part-8]

requires:
  - phase: 400-08
    provides: suggest_next cause_effect field (the omit-when-absent idiom this plan follows)
  - phase: 400-10
    provides: the run-all-400 runner order this plan extends
provides:
  - data/problem-axes-wording.json (schema mos.problem-axes-wording/1) with level_wording v1 (default) and v2 (provisional) and a wicked_cutoff block (state not_fitted)
  - lib/core/problem-axes.cjs LEVEL_WORDING_FLAG, levelWording(), wickedFromProbability(p, opts) (additive, 0 deleted lines)
  - suggest_next problem_level_test, only with MINDRIAN_LEVEL_WORDING=v2
  - scripts/derive-wicked-cutoff.cjs (dev-time fit, --dry-run, --write, --check, fitCutoff export)
affects: [400-12, 400-14]

tech-stack:
  added: []
  patterns:
    - "The real parseRoutingTable source of brain-router.cjs run through new Function on base and current file content, to prove the routing parse is unchanged without exporting a private function"
    - "A stored fitted cut-off with an honest not_fitted state; the accessor answers null until a fit exists"

key-files:
  created:
    - data/problem-axes-wording.json
    - scripts/derive-wicked-cutoff.cjs
    - tests/test-400-problem-axes-wording.cjs
    - tests/fixtures/400/wicked-fit-sample.json
  modified:
    - lib/core/problem-axes.cjs
    - lib/mcp/tools/sensors.cjs
    - references/methodology/problem-types.md
    - tests/run-all-400.sh

key-decisions:
  - "The wicked cut-off ships not_fitted with value null: the two label files are not on this machine, so wickedFromProbability answers null for every p (never a raw 0.5 cut)."
  - "The fit, when it runs, uses two-axis-gemini-78-v2.json: its run script holds the earlier research Well-defined wording; the v3 file holds the F-07 wording. The wicked instruction is the same in both run scripts."
  - "levelWording() also returns status, so the suggest_next field {version, well_defined, wicked_note, status} is a copy of it."
  - "Only the exact env value v2 turns the flag on; any other value (V2, v3, empty, spaces) gives v1."
  - "--check also fails a not_fitted block that carries a value, counts or sources, so a half-written fit is not called honest."

patterns-established:
  - "A dev-time fit script refuses a DO-NOT-OPEN path by name before any read (exit 2)."

requirements-completed: [AX-01, AX-02]

duration: 25min
completed: 2026-11-24
---

# Phase 400 Plan 11: Flagged Level Wording and Wicked Cut-off Summary

The reworded Well-defined test of F-07 ships behind MINDRIAN_LEVEL_WORDING=v2 with the old wording as the default, and a wicked probability becomes yes or no only through a stored fitted cut-off, which ships not_fitted (null answer) because the label files are absent.

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-24
- **Tasks:** 2
- **Files:** 4 created, 4 modified

## Accomplishments

- AX-01: data/problem-axes-wording.json holds v1 ("Clear parameters, specific constraints", status shipped, equal to the table cell) and v2 (the F-07 and O-02 wording, status provisional, basis "F-07, fitted on the same cases; fresh cases deferred"). levelWording() reads the data file lazily (cached) and the env at each call.
- suggest_next carries problem_level_test {version 'v2', well_defined, wicked_note, status 'provisional'} only with the flag v2. With the flag off, the reply has the same keys as before (W4), and the four-value view and the Part 8 guard are unchanged (test-399-problem-axes A8 green).
- references/methodology/problem-types.md: one paragraph after the Axis 1 table, not starting with "|". Every "|" line is byte-identical to base c1e496ae8, and the real parseRoutingTable gives the same map on the base and current content (W3).
- AX-02: wickedFromProbability(p, opts) returns null for a non-number, NaN, or p outside 0..1, and null when no fit is stored. With a fitted block it returns p >= value.
- scripts/derive-wicked-cutoff.cjs reads only case ids and wicked_p from the answers file and the id and wicked field from label lines. It writes only {state, value, fitted_on {cases, wicked_yes, false_yes, missed}, sources [{name, sha256}], status, rule}. The synthetic fixture fits 0.675 (12 cases, 7 wicked yes, 0 false yes, 1 missed); a raw 0.5 cut on the same fixture gives 2 false yes.

## Wicked cut-off state (F-06, OPEN)

- The search by exact name (find over ~/MindrianOS and ~/MindrianRooms, no file content read) found neither theo-routing-labels-two-axis-60.md nor theo-routing-labels-two-axis-batch4-larry.md.
- The shipped block is state not_fitted, value null, fitted_on null, sources null. wickedFromProbability(0.5) is null. No raw 0.5 cut exists anywhere.
- Answers file to fit on: two-axis-gemini-78-v2.json (78 answers, 78 with wicked_p). The v2 run script holds the earlier research Well-defined wording; the v3 run script holds the F-07 wording (the repo v2). The repo default v1 wording was not run in either file.
- UNVERIFIED: label files absent; NEEDS_HUMAN: copy theo-routing-labels-two-axis-60.md and theo-routing-labels-two-axis-batch4-larry.md from the research machine, then run node scripts/derive-wicked-cutoff.cjs --answers <file> --labels <file> --labels <file> --write

## Task Commits

1. **Task 1: The flagged level wording (AX-01)**
   - RED `defb39316` test(400-11): add failing legs W1 to W5 for the flagged level wording
   - GREEN `2fe19a1d9` feat(400-11): ship the reworded Well-defined test behind MINDRIAN_LEVEL_WORDING=v2 (AX-01)
2. **Task 2: The wicked cut-off accessor and its dev-time fit (AX-02)**
   - RED `45d20ad1a` test(400-11): add failing legs W6 to W10 for the wicked cut-off accessor and its fit
   - GREEN `8b54620a3` feat(400-11): add the wicked cut-off accessor and its dev-time fit (AX-02)

## Files Created/Modified

- `data/problem-axes-wording.json` - level wording versions and the wicked_cutoff block.
- `lib/core/problem-axes.cjs` - LEVEL_WORDING_FLAG, levelWording, wickedFromProbability (additions only).
- `lib/mcp/tools/sensors.cjs` - problemLevelTestFor and the problem_level_test key of suggest_next (omit when absent).
- `references/methodology/problem-types.md` - the flagged-wording paragraph after the Axis 1 table.
- `scripts/derive-wicked-cutoff.cjs` - the dev-time fit and --check.
- `tests/test-400-problem-axes-wording.cjs` - legs W1 to W10.
- `tests/fixtures/400/wicked-fit-sample.json` - synthetic 12-case sample with hand-computed _expected.
- `tests/run-all-400.sh` - the new test and the derive-wicked-cutoff.cjs --check drift check.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

1. **[Rule 2 - Correctness] levelWording returns status too.** The plan W2 lists {version, well_defined, wicked_note}. The function also returns status, so suggest_next copies one object and W4 sees status provisional. Commit 2fe19a1d9.
2. **[Rule 2 - Correctness] --check is stricter than W10.** It also fails a not_fitted block that carries a value, counts or sources, and a fitted block with a bad count or hash. Commit 8b54620a3.
3. **[Rule 1 - Bug] Gap ties compare at 9 decimals.** Float noise (0.6 - 0.4 against 0.4 - 0.2) broke the "then the lower candidate" rule; W8 tests both tie rules on the exported fitCutoff. Commit 8b54620a3.

## Issues Encountered

- The pre-commit hook prints the known tool-honesty advisory WARN lines (room_list, room_search). They do not block and do not come from this plan.
- lib/memory/problem-type-router.test.cjs gives 21/24; the failures are tests 22 to 24, the pre-existing failures named in the phase rules.

## Known Stubs

- data/problem-axes-wording.json wicked_cutoff: state not_fitted, value null. This is intentional and honest (F-06 OPEN); the fit needs the two label files (NEEDS_HUMAN above). No consumer reads a wicked probability yet, so no user-visible surface depends on it.

## Threat Flags

None. The script has no network, reads only ids and probabilities, and writes only counts and hashes (T-400-28); the default wording is unchanged (T-400-29); nothing is sent to Theo or a provider (T-400-30).

## Next Phase Readiness

- Plans 400-12 and 400-14 can read levelWording and wickedFromProbability.
- The cut-off fit is one command once the label files are on this machine.

## Self-Check: PASSED

- FOUND: data/problem-axes-wording.json, scripts/derive-wicked-cutoff.cjs, tests/test-400-problem-axes-wording.cjs, tests/fixtures/400/wicked-fit-sample.json
- FOUND commits: defb39316, 2fe19a1d9, 45d20ad1a, 8b54620a3
