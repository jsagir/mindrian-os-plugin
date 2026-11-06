---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "35"
subsystem: egress-guard
tags: [part8, hardening, lazy-require, folder-memory, e-lazy]
requires: ["386-01"]
provides:
  - The timeline runner loads only when extractFeynmanBody (or its async twin) runs
  - Fresh-process module counts before and after for the guard, the hook and the statusline
affects: [386-29, 386-30]
tech-stack:
  added: []
  patterns: [require inside the existing try so a load failure takes the existing fallback]
key-files:
  created:
    - tests/test-386-folder-memory-lazy-timeline.cjs
    - .planning/debug/folder-memory-eager-timeline-runner-widens-guard-dependencies.md
  modified:
    - lib/core/folder-memory.cjs
    - lib/core/folder-memory-async.cjs
key-decisions:
  - "Part 8 hardening only: no speed claim. A lower fresh-process count is the pass."
requirements-completed: [E-LAZY]
duration: 50min
completed: 2026-11-06
---

# Phase 386 Plan 35: Lazy timeline runner (Part 8 hardening) Summary

The timeline runner require moved inside extractFeynmanBody in both folder-memory twins. The guard and the statusline processes load far fewer modules, and navigation is no longer loaded at startup in either. This is hardening. No time gain is claimed.

## Skip rule

`target: PRESENT`. Both files still carried the top-level require. Phase 384 had edited only a scratch copy. The skip did not apply.

## Fresh-process module counts (PROVEN, 3 repeats each, equal in all 3)

| Process | Before | After | Prior figures (labelled) |
|---------|--------|-------|--------------------------|
| guard (require of part8-egress-guard.cjs) | 172 | 10 | audit target 172 to 10 |
| hook (part8-egress-guard-hook.cjs, brain_ask) | 175 | 173 | none |
| statusline (scripts/context-monitor) | 182 | 18 | audit target 181 to 17; Phase 384 scratch result 182 to 18 |

- hook_loads_timeline_runner: yes before; the runner is out of require.cache after.
- navigation in require.cache: guard yes to no, statusline yes to no. In the hook process navigation is still loaded, by scripts/part8-egress-guard-hook.cjs itself (PROVEN with a Module._load probe). This plan does not change the hook.
- Equivalence: 0 mismatches over 6 FEYNMAN.md variants (absent, empty, body only, frontmatter plus body, sentinel block, CRLF), sync and async.
- Fallback: with the runner load forced to throw, folder-memory still loads and returns the trimmed raw buffer (arm LZ4).

## Task Commits

1. Task 1, RCA and before counts: see git log (docs(386-35): RCA and fresh-process module counts before the lazy timeline runner)
2. Task 2, failing test (RED: LZ1, LZ2, LZ4, LZ5, LZ6 fail; LZ3 passes): test(386-35): pin the lazy timeline runner with an equivalence check (RED)
3. Task 3, the move (GREEN): b7323cdc1; the RCA after lines and resolution are in the closing docs commit

## Verification

- node tests/test-386-folder-memory-lazy-timeline.cjs: LZ1 to LZ6 pass.
- node lib/memory/folder-memory-quadruple.test.cjs: 17 of 17. Also exit 0: test-150-feynman-readback, test-195-drift-kind, test-195-xroom-relevance, test-232-room-home, test-241-guardian-tripolar-parity, test-245-drain-budget, test-386-dial-memory-stale, test-reverse-salient-agent, and the two lib/memory brain tests.
- bash tests/run-all-196.sh: 7 passed, 0 failed. node tests/test-3692-guard-survey-gate.cjs: GATE PASS, MEASURED_SHA256 unchanged (1b2fc844...dd00). bash tests/run-all-386.sh: all PASSED.
- Known reds, not caused by this plan: tests/test-252-guard-census.cjs census.1 and census.5b (same set before and after).

## Deviations from Plan

None.

## Known Stubs

None.

## Threat Flags

None. No verdict changes and no new surface.

## Self-Check: PASSED
