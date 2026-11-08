---
phase: 391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar
plan: 01
subsystem: testing
tags: [radar, changelog, coverage, sanitising, tdd]

requires: []
provides:
  - "lib/core/radar/changelog-slice.cjs: sliceChangelog, sanitizeBullet, compareDotted, isDotted"
  - "tests/helpers/changelog-fixture-391.cjs: run-time changelog builder (buildChangelog, hostileBullets)"
  - "tests/run-all-391.sh: phase 391 aggregator (glob discovery, found-equals-0 guard, dash fence)"
affects: [391-03, 391-06]

tech-stack:
  added: []
  patterns:
    - "Parser returns data plus a coverage object that states complete, truncated, oldest and a reason"
    - "Partial last line at a cap is dropped before header detection"

key-files:
  created:
    - lib/core/radar/changelog-slice.cjs
    - tests/test-391-radar-changelog-slice.cjs
    - tests/helpers/changelog-fixture-391.cjs
    - tests/run-all-391.sh
  modified: []

key-decisions:
  - "complete is true only when a header at or below the mark lies inside the examined text"
  - "A cut inside a header line is ignored (the partial last line is dropped), so '## 2.1.3' from '## 2.1.309' is never a false header"
  - "compareDotted is exported once here; the two older private copies are left alone"

requirements-completed: [CC391-H]

duration: 25min
completed: 2026-11-08
---

# Phase 391 Plan 01: Radar changelog slicer Summary

Pure changelog parser that returns the complete entries newer than a mark plus an honest coverage object, so a read that stopped at the 100000-character WebFetch cap can no longer look complete.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | f79cd2545 | test(391-01): failing slicer test for the radar changelog read (RED) |
| 2 (GREEN) | 198ed4ddd | feat(391-01): pure changelog slicer that reports its own coverage |

## RED output (before the module existed)

Command: `node tests/test-391-radar-changelog-slice.cjs` - exit 1.

```
FAIL - S1: cannot load module under test: Cannot find module '/home/jsagi/dev/MindrianOS-Plugin-release/lib/core/radar/changelog-slice.cjs'
FAIL - S2: cannot load module under test: Cannot find module ...
FAIL - S3 ... S7 (same message)
FAIL - S8: cannot load module under test: Cannot find module ...

8 failure(s)
```

Aggregator guard: `TEST_391_PREFIX=tests/test-391-nonexistent- bash tests/run-all-391.sh` printed `!!! no tests/test-391-nonexistent-* files discovered` and exited 1.

## GREEN output (after the module)

Command: `node tests/test-391-radar-changelog-slice.cjs` - exit 0.

```
110 passed, 0 failure(s)
```

Command: `TEST_391_PREFIX=tests/test-391-radar-changelog-slice bash tests/run-all-391.sh` - exit 0.

```
>>> test-391-radar-changelog-slice.cjs: PASSED
>>> 391 dash fence: PASSED
Phase 391: PASS=2 FAIL=0 SKIPPED=0
```

Capped read of the 40-entry fixture (cap 100000, mark 2.1.304) returns:

```
complete: false, truncated: true, newest: 2.1.340, oldest: 2.1.313, cutMidEntry: 2.1.312, headers: 29
reason: read covers 2.1.340 to 2.1.313 only (the cut fell inside entry 2.1.312); versions below 2.1.313 down to 2.1.304 were not read
```

## Part 7 search (reuse before build)

Searched scripts, lib, bin, hooks, commands, agents and skills for the token CHANGELOG with version-header patterns. Result: no code parses the Claude Code changelog. Hits are readers of this repo's own release notes (scripts/check-update, scripts/session-start, scripts/release.sh, which match `## [x.y.z]` with brackets) and the radar prose in commands/radar.md, which holds the WebFetch prompt that is the bug. Justification: the net-new surface is one pure module plus one script in plan 391-03. No command, agent, skill or pipeline is added, so no Part 11 born-wired declaration is needed. Part 8 holds: the module has no network, file system or child process call; fixtures are built at run time from synthetic text.

## Threat register

- T-391-01 (instruction text reaching the ledger): sanitizeBullet strips markup, links, URLs, control and invisible marks, cuts to 240; arm S4 pins it, including an end-to-end pass.
- T-391-02 (silent skip of unread versions): coverage object; arms S1, S3 and S5 (partial header at the cut) fail on a silent skip.
- T-391-03 (peer sweep): new paths only; `git add -f` and `git commit --only` with exact paths.

## Deviations from Plan

1. [Process] The SUMMARY is committed in a separate docs commit after the GREEN commit, not inside it, because it records the GREEN sha.
2. [Process] The pre-commit worktree guard from the executor rules expects a `worktree-agent-*` branch. This tree is a dedicated worktree on `main` by the task instruction (no isolation branch). I did not rewrite any ref; commits are plain `--only` commits on `main`, not pushed.
3. [Test addition, no plan change] Extra checks inside arms: partial header at a cap (S5), a mark that is not a dotted triple is refused (S8), a cap larger than the text is not a truncation (S2).

Auto-fixed issues: none.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: lib/core/radar/changelog-slice.cjs, tests/test-391-radar-changelog-slice.cjs, tests/helpers/changelog-fixture-391.cjs, tests/run-all-391.sh
- FOUND commits: f79cd2545, 198ed4ddd
- No em dash or en dash in the four files; module has no fs, http, https, net, child_process or dns require.
