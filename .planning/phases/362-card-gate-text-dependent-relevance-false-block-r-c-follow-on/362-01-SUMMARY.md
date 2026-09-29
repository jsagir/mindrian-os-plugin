VERDICT: STILL_FALSE_BLOCKS
---
phase: 362-card-gate-text-dependent-relevance-false-block-r-c-follow-on
plan: 01
subsystem: card-gate
tags: [card-fire, execution-gate, replay, r-c]
requires: []
provides: [362-REPLAY.md verdict line and REPLAY_SHA]
affects: [362-02, 362-03]
key-files:
  created:
    - .planning/phases/362-card-gate-text-dependent-relevance-false-block-r-c-follow-on/362-REPLAY.md
  modified: []
decisions:
  - "Post-359 code still false-blocks dogfood-0f86dd63-092046 on both surfaces; phase proceeds to the 362-02 structured-signal measurement"
metrics:
  completed: 2026-09-29
  tasks: 2
---

# Phase 362 Plan 01: D-01 AMENDED gate and post-359 replay Summary

The clean-tree gate passed and the replay on post-359 code shows the target still blocks on the CLI and on MCP, with the same reason it had before 359.

- GATE_HEAD: 0892259bad9661337565ca1ac194794c86b8af07
- Gate line: `GATE ok clean: lib/core/gate-relevance.cjs scripts/check-card-fire.cjs tests/test-359-inertness.cjs` (empty `git status --short` on the three paths)
- Entry result: cli block / reached-registry-gate-no-card, mcp block, outcome KNOWN_FALSE_BLOCK, baseline block; identical to the pre-359.json row
- Full corpus: entries 60, false_blocks 0, new_misses 0, parity_mismatches 0, known_false_blocks 1, known_misses 1, unmarked_misses 0, errors 0, exit 0
- Standing tests: test-357-replay PASS 12/12 (exit 0); test-359-inertness Passed 4 / 4 (exit 0); test-359-replay SKIPPED: not on main at GATE_HEAD
- Structural note: overlap is two content tokens (`governance`, `thread`), not the one the 357 reason names

## Commits

- 9fb44fc40 docs(362-01): post-359 replay of dogfood-0f86dd63-092046, VERDICT: STILL_FALSE_BLOCKS (D-02, CARD362-02)

## Deviations from Plan

None - plan executed exactly as written. The scratch directory was created under the session TMPDIR equivalent (`/tmp/claude-1000/replay-362-*`) and removed at the end of the task.

## Self-Check: PASSED

- 362-REPLAY.md exists, line 1 and line 2 match the required forms, and a fresh replay agrees with line 1
- Commit 9fb44fc40 is on main
