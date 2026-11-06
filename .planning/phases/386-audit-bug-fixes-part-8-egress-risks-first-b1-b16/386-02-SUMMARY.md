---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "02"
subsystem: part8-egress-guard
tags: [rca, part8, brain_write, B2, checkpoint]
status: complete
requires: []
provides:
  - RCA for B2 with disposition matrix (hook and callTool), caller chain and root cause
affects: [386-04]
key-files:
  created:
    - .planning/debug/whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds.md
  modified: []
requirements: [B2]
decisions:
  - "B2 owner decision 2026-11-06: option A (block every brain_write, send no room text, report blocked honestly). Plan 386-04 implements option A only."
metrics:
  tasks_done: 2
  tasks_total: 2
  completed: 2026-11-06
---

# Phase 386 Plan 02: B2 RCA and owner decision Summary

Task 1 is done: the RCA proves on synthetic strings that `classify()` returns `ambiguous/unknown` for `brain_write`, `callTool` sends it, the hook allows it on the shim-backed scopes, and `whitespace-to-brain.cjs` counts a refused write as a success. Task 2 is done: the owner chose option A on 2026-11-06 and the RCA holds an `## Owner decision` block with `decision: option-a`. Plan 386-04 implements option A only and needs no revision.

## What was proven (synthetic strings, fetch counter, 0 network calls)

- `classify()` gives `ambiguous/unknown` for `brain_write` under 5 tool names (bare, plugin, project, pws-brain-mcp, theo).
- Hook exit with the Brain available: 0 on plugin and project scopes, 2 on pws-brain-mcp and theo scopes. The bare name never reaches the hook (exit 0).
- `callTool('brain_write')` on `ambiguous`: 2 fetch calls (initialize, tools/call), the tools/call body held the synthetic marker, no sentinel returned.
- `whitespace-to-brain.main()` on a fixture room: 4 tools/call requests, marker in a body. A hypothesis that trips the deny-list gives a refused zone write yet `zones_written` 1 and `errors` 0.
- The 9-row typed-tool check explains the PENDING debug file on pws-brain-mcp (every typed tool is `ambiguous/unknown`, hook exits 2). That file was not changed.

## Deviations from Plan

### Finding that differs from the plan pre-read

**1. [Evidence correction] The hypothesis text is not room title text in the shipped pipeline**
- **Found during:** Task 1, step 5 (caller chain)
- **Issue:** the pre-read says the text comes from the three discover-*-whitespace.py scripts. Their zones go to discovery-cycle-results.json, which `whitespace-to-brain.cjs` does not read. It reads interpretation-results.json, written only by interpret-whitespace.cjs from whitespace-results.json, written only by compute-whitespace-gaps.py. That script builds the text from a Brain framework name.
- **Effect:** the data claim of B2 is PARTIAL. Room-derived values in the Cypher are density_score, strategic_rank and the zone hash input. The seam defect (no block, no positive rule, false success count) is CONFIRMED. Severity stays high.
- **Files modified:** none (recorded in the RCA, Eliminated section)

No product file was changed. No auth gate.

## Known Stubs

None.

## Checkpoint

Task 2 (checkpoint:decision, blocking) was answered: option A. The Owner decision block is in the RCA, so plan 386-04 may run.

## Commits

- acc4940bb: docs(386-02): RCA for B2 (RCA file only)
- 42212a152: docs(386-02): partial summary
- Owner decision commit: see git log for "docs(386-02): record owner decision option A"
