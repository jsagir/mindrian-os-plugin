---
phase: 261029-u8x-injection-hotfix-stop-the-python-date-fa
plan: 01
quick_id: 261029-u8x
subsystem: room-scripts
tags: [security, injection, bash, python3, node]
requires: []
provides:
  - "scripts/compute-team and scripts/analyze-room pass room dates to python3 as sys.argv[1] behind a shape guard"
  - "scripts/analyze-room edge formatting passes folder names to node through process.argv after a -- separator"
affects: [phase-381]
key-files:
  created:
    - tests/test-compute-team-date-guard.cjs
    - tests/test-analyze-room-edge-argv.cjs
  modified:
    - scripts/compute-team
    - scripts/analyze-room
    - tests/run-all-363.1.sh
    - CHANGELOG.md
    - .planning/debug/compute-team-analyze-room-python-date-fallback-injection.md
decisions:
  - "R-1 ruling applied: the guard sits only in front of the python3 link, inside a brace group; the date -d and date -j -f links are unchanged"
metrics:
  completed: 2026-10-29
---

# Phase 261029-u8x Plan 01: Injection hotfix Summary

A room file can no longer run code through a date field (compute-team, analyze-room) or a folder name (analyze-room edge formatting). Room values now reach python3 and node as data, never as program text.

## Commits

| Task | Sha | Message |
|------|-----|---------|
| 1 (RED) | c884dcbf7 | test(261029-u8x): add failing tests for the date fallback and folder name injection |
| 2 (GREEN) | 38535163f | fix(261029-u8x): pass room dates and folder names to python3 and node as data |
| 3 (docs) | d93706f69 | docs(261029-u8x): changelog entry and RCA evidence for the injection hotfix |

Nothing was pushed. STATE.md and ROADMAP.md were not touched. This SUMMARY is not committed.

## RED proof (Task 1, unpatched scripts)

Date test, exit 1, 8 not-ok legs:
- A. compute-team and A. analyze-room (function level, crafted value): marker exists
- C. compute-team and C. analyze-room (forced python3, crafted value): marker exists
- D. compute-team whole script (crafted last_active): marker exists
- E. analyze-room whole script (crafted last_updated): marker exists
- F. source pins, both scripts: C-2 link line absent

Edge test, exit 1, 4 not-ok legs:
- A. bash half INFORMS: marker exists
- B. bash half CONTRADICTS: marker exists
- E. python half: marker exists
- F. source pins

Passing before and after (as the plan expects): B legs (unchanged GNU date shapes), C valid-date and ISO legs, D trend leg, E valid FUND_STALE leg, edge C (normal pair) and edge D (leading-dash folder).

## GREEN and parity (Task 2)

- Both tests print ALL PASS.
- Parity dir P: `/tmp/claude-1000/-home-jsagi/3085a95e-3096-40f0-9da6-b0b39fab307a/scratchpad/parity` (capture.sh, analyze-before/after.txt, team-before/after.md).
- Room: copy of tests/fixtures/sample-room-opp, 6 team profiles (plain, -20 days, -60 days, ISO timestamp, trailing space, CR), 2 funding entries (ISO timestamp, CR).
- `cmp analyze-before.txt analyze-after.txt`: no difference.
- `cmp` of TEAM-STATE.md without the `computed:` line: no difference.
- The diff touches 1 line per date function and the 4 edge sites; compute-state is unchanged.

## Verification (Task 3)

| Command | Result |
|---------|--------|
| node tests/test-compute-team-date-guard.cjs | ALL PASS |
| node tests/test-analyze-room-edge-argv.cjs | ALL PASS |
| node tests/test-363.1-compute-state.cjs | rc 0 |
| node tests/test-compute-state-persists.cjs | ALL PASS |
| bash tests/run-all-363.1.sh (before) | Phase 363.1: PASS=10 FAIL=0 SKIP=1 |
| bash tests/run-all-363.1.sh (after) | Phase 363.1: PASS=12 FAIL=0 SKIP=1 |
| dash fence over added lines (CHANGELOG, tests, scripts) | 0 |

## node_modules link

The untracked symlink `node_modules` -> `/home/jsagi/dev/MindrianOS-Plugin/node_modules` stays in the worktree root. It shows as `?? node_modules`. It was never staged. Remove it when the worktree work ends.

## Deviations from Plan

None in the scripts. Additions inside the plan scope: the edge test has one extra leg (D, a folder named `-e-proof`) that proves the `--` separator for threat T-u8x-03. Test temp dirs are removed at the end of each test file instead of in a `finally` block; each leg catches its own errors, so the cleanup always runs.

## Known Stubs

NONE.

## Threat Flags

NONE.

## R-2 note for Phase 381

Plans 381-01 and 381-09 name python-date-injection and node-e-section-name as known divergences. After this hotfix, the bash bodies are safe on both points, so those cases can stop diverging. Plan 381-01 copies the RCA Symptoms payload; that payload does not fire (SyntaxError). The working payloads are in the RCA Evidence entry of 2026-10-29T20:00:00Z. No Phase 381 file was edited.

## Residuals (recorded in the RCA)

- `2026-01- 5` reaches python3 only where both date commands fail; there it now gives 0. GNU date accepts it on this host.
- compute-state: section names are not JSON-escaped in SECTIONS_JSON; analyze-room uses section names as `grep -E` patterns. Neither runs code. Left to Phase 381.
- T-u8x-04 (BSD date reading a leading-dash value as an option) is ASSUMED, not tested; no BSD host.

STATUS: DONE
CHANGED: tests/test-compute-team-date-guard.cjs, tests/test-analyze-room-edge-argv.cjs, tests/run-all-363.1.sh (c884dcbf7); scripts/compute-team, scripts/analyze-room (38535163f); CHANGELOG.md, .planning/debug/compute-team-analyze-room-python-date-fallback-injection.md (d93706f69)
VERIFIED: both new tests ALL PASS; runner PASS=10 -> PASS=12 FAIL=0 SKIP=1; both parity cmp checks report no difference; bash -n passes on both scripts; dash fence 0
UNVERIFIED: macOS bash 3.2 run of the python half on a real macOS host (tested by extracting the heredoc and running it under python3 on Linux); BSD date behavior
RISKS: not live until a release carries it; residual `2026-01- 5` shape on hosts where both date commands fail gives 0
NEXT: review the 3 commits, then merge or push per the push gate; Phase 381 can drop the two known-divergence cases

## Self-Check: PASSED

Files exist: both tests, both scripts, CHANGELOG.md, the RCA. Commits c884dcbf7, 38535163f and d93706f69 exist in `git log`.
