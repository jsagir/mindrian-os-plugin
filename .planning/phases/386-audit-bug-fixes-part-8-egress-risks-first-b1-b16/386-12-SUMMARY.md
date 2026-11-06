---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "12"
subsystem: memory
tags: [B8, stale-rule, folder-memory, dial-memory]
requires: [386-01]
provides: [B8 fixed]
key-files:
  created: [.planning/debug/dial-memory-rewrite-marks-sections-stale.md, tests/test-386-dial-memory-stale.cjs]
  modified: [lib/core/folder-memory.cjs, lib/core/folder-memory-async.cjs]
requirements-completed: [B8]
completed: 2026-11-06
---

# Phase 386 Plan 12: B8 dial-memory rewrite and staleness Summary

B8 was REPRODUCED on a fixture room, and fixed by excluding the generated FEYNMAN.md from the artifact mtime walk of the stale rule.

## Verdict

REPRODUCED. Before the refresh: fresh. After `refreshSection`: stale with `artifacts_newer_than_minto`. Only FEYNMAN.md moved.

## Root cause

`collectArtifactMtimes` (sync and async) counts every top-level `.md` file not in `RESERVED`. FEYNMAN.md was not reserved, and two automatic writers (timeline-runner, dial-memory-runner) rewrite it at every session start.

## Commits

- d082d322a docs(386-12): RCA, verdict REPRODUCED
- RED test commit: test(386-12) pin that a dial-memory refresh does not mark sections stale
- 3d1f47fed fix(386-12): FEYNMAN.md added to RESERVED in both readers
- RCA resolution commit

## Deviations from Plan

**1. [Rule 1 - Bug] Fix site moved from dial-memory-runner.cjs to the folder-memory readers**
- Found during: Task 3 (RCA).
- Issue: the timeline-runner is a second writer of FEYNMAN.md. A fix in the dial runner alone would leave the same false staleness.
- Fix: add FEYNMAN.md to RESERVED in lib/core/folder-memory.cjs and lib/core/folder-memory-async.cjs. dial-memory-runner.cjs is unchanged.

## Verification

- tests/test-386-dial-memory-stale.cjs: RED (D1 sync and async FAIL, D2 and D3 ok), then GREEN (all ok).
- tests/test-dial-memory-runner.cjs, tests/test-dial-memory-renderer.cjs, lib/memory/folder-memory.test.cjs, lib/memory/folder-memory-quadruple.test.cjs, lib/memory/feynman-minto-guardian.test.cjs: exit 0 before and after.
- Baseline: `bash tests/run-all-386.sh` had 1 FAIL before this plan (a plan 386-02 RED test, A1/A3/A4 brain_write arms). It is not caused by this plan.

## Known Stubs

None.

## Self-Check: PASSED
