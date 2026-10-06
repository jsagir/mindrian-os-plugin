---
phase: quick
plan: 261006-k2k6
subsystem: tests
tags: [test-pin, runner-contract, 363]
key-files:
  modified: [tests/test-363-runner-contract.cjs]
decisions:
  - "K6 allows exactly one scout.md section (plan 369.2-29, commit 64cc85f04); the byte compare against base_sha stays strict"
  - "K2 allows exactly one sentence in the --broad section (plan 369.2-25, commit 3b2936658); every other section stays byte-strict"
metrics:
  tasks: 1
  commits: 1
completed: 2026-10-06
---

# Quick 261006-k2k6: K2 and K6 runner-contract baselines Summary

The 363 runner contract test now allows two later, deliberate edits and still compares every other byte with the base text.

## What changed

- K6: the test finds the single `## Plan-run route (search the literature for what this found)` heading in `commands/scout.md`. It checks the section holds no other `## ` heading and ends at the `## Step 6: Generate Summary` heading. It removes that section and the D-05 pointer. The result must equal `baseScout` byte for byte.
- K2: the test removes the one PatentsView sentence (and its blank line) from the `--broad` section only, when it occurs exactly once there. The section-by-section byte compare then runs unchanged.
- Each allowance has a code comment that names the plan and the commit.

## Verification

- `node tests/test-363-runner-contract.cjs`: PASS 9 FAIL 0 (PROVEN).
- `commands/research.md` and `commands/scout.md` are unchanged by this task.
- UNVERIFIED-BY-EXECUTOR: the `tests/run-all-*.sh` aggregators (not run, by instruction).

## Deviations from Plan

None - plan executed as written.
