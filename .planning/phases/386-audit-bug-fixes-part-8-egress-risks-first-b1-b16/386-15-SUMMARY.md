---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "15"
subsystem: post-write-cascade
tags: [rca, b7, post-write, cascade-status, completion-detector]
status: complete
requires: ["386-06"]
provides:
  - last-cascade.json cascade_status tells the truth (skipped, failed, complete)
  - the post-write advisory does not say queued or complete for a skipped or failed cascade
  - memory-completion-detector counts a cascade record once
affects: []
key-files:
  created:
    - .planning/debug/post-write-reports-cascade-complete-when-skipped.md
    - .planning/debug/memory-completion-detector-duplicate-completions.md
    - tests/test-386-cascade-status-and-completion.cjs
  modified:
    - scripts/post-write
    - scripts/memory-completion-detector.cjs
    - tests/test-cascade-side-channel.cjs
    - tests/test-cascade-surface-e2e.cjs
requirements: [B7]
decisions:
  - "No new key in last-cascade.json: the 8-key contract is pinned by older tests. The detector identity is timestamp|file_path, stored as a scalar in <room>/.mindrian/last-cascade-counted."
  - "isRoomFile in intelligence-cascade.cjs was not widened and no bash pre-check was added (Phase 384 and 385 own the skip)."
metrics:
  tasks_done: 3
  tasks_total: 3
  completed: 2026-11-06
---

# Phase 386 Plan 15: B7 cascade status and duplicate completions Summary

## Skip rule

Both targets PRESENT (`target: PRESENT` in each RCA). No skip.

## Commits

- 48d198d26 docs(386-15): RCA for both defects
- 280cc9562 test(386-15): RED (W1, W3, W4 x2, W5 fail; W2, W6 pass)
- 84151d83e fix(386-15): GREEN
- a625d16fb docs(386-15): RCA resolution blocks

## Root causes (PROVEN on fixtures)

- Status: write_cascade_side_channel hard-coded `cascade_status: "complete"`, and the advisory text depended only on the section name. Default layout (cascade returns skipped true), rooms layout and a forced child failure all gave `complete` and `queued MINTO regen for`.
- Duplicates: the detector keeps no memory of the record it counted. Fixture counts: run 1 gives 1, run 2 on the same record gives 2, run 3 on an unchanged file gives 3, a new record gives 4.

## Fix

- scripts/post-write: `cascade_status_of` reads the cascade output (failed, skipped, complete). The writer takes the status. Non-JSON output now overwrites the old record as failed. The advisory says `post-write: cascade skipped for <file>` or `cascade failed for <file>`. The complete texts are unchanged.
- scripts/memory-completion-detector.cjs: skips a record whose `timestamp|file_path` equals the stored scalar, and stores it after a completion.

## Verification (PROVEN)

Baseline taken first. Before: test-connector-tier-d-hooks.cjs CHECK 4 (Part 8 egress in the fire path) already failed (pre-existing, not touched by this plan; it still fails). Everything else named by the plan was green.
- node tests/test-386-cascade-status-and-completion.cjs: W1 to W6 all ok.
- Exit 0: lib/memory/post-write-triple.test.cjs, tests/test-237-post-write-session-stamp.cjs, test-237-session-scope-degrade, test-261029-qef-hook-timeouts, test-acpt-04-filing-cascade-surfaces, test-cascade-side-channel, test-cascade-surface-e2e, test-cascade-surface-loop-fires, test-hook-envelope-shape, test-jtbd-taxonomy, test-memory-hook-integration, test-nav01-populated-room-engine-fires, test-sens06-artifact-filed-fires, test-trigger-invariant, test-room-proactive-side-channel, test-386-registry-readers.
- bash -n scripts/post-write: ok.
- bash tests/run-all-386.sh: PASS=22 FAIL=0 (includes peer test files present at run time).
- scripts/on-stop stays at 674 lines.

## Deviations from Plan

- [Rule 1 - Bug] tests/test-cascade-side-channel.cjs and tests/test-cascade-surface-e2e.cjs used fixtures at a path without /room/ or /rooms/ and asserted `cascade_status` equal to `complete`. That pinned the bug. They now expect `skipped`. The trigger-prefix invariant in test-cascade-side-channel.cjs also accepts the 2 new honest prefixes. The room-proactive skill keys off the 2 old prefixes only, so it does not trigger on a skipped or failed cascade.
- The plan suggested a per-cascade identity; no new key was added because 2 older tests pin the 8-key contract. Limit: 2 writes of the same file in the same second share the identity and count once.

## UNVERIFIED

- The host order of the 2 PostToolUse hooks (post-write and the detector). If they run in parallel, a record can be counted one write late. The identity check keeps it at once per record.

## Known Stubs

None.

## Self-Check: PASSED

Files and commits above exist (git log --grep 386-15 shows 4 commits).
