---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 07
subsystem: planning-gates
tags: [owner-cards, answer-gate, eureka, tool-budget]
requires:
  - phase: 374
    provides: 374-gate.cjs (plan 374-04), shared approval gate (plan 374-03)
  - phase: 390
    provides: 390-gate.cjs seal and check-decision
provides:
  - 374-DECISION.md with seven sealed owner cards, all answers PENDING
affects: [374-08, 374-09, 374-10, 374-11, 374-12, 374-13, 374-14]
key-files:
  created:
    - .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-DECISION.md
    - .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-07-SUMMARY.md
  modified: []
key-decisions:
  - "No decision taken. No OWNER-ANSWER line was written. Seven cards G1 to G7, eight items."
requirements-completed: []
duration: 40min
completed: 2026-11-08
---

# Phase 374 Plan 07: Owner decision cards Summary

Status: awaiting owner answer. 374-DECISION.md holds seven sealed cards (G1 to G7, items OD-1 to OD-7 with OD-5A and OD-5B), each with a plain question, tagged facts, options with KEEP first, a recommended token, an undo and the consuming plan. All seven OWNER-ANSWER lines read PENDING.

## Tokens the card recommends

| Card | Item | Recommended | Resolves to |
|------|------|-------------|-------------|
| G1 | OD-1 | RECOMMENDED | KEEP (no router, 0 new tools) |
| G2 | OD-2 | RECOMMENDED | ADD-FORGET-TOOL (+1 tool, 75 to 76) |
| G3 | OD-3 | RECOMMENDED | TOPK-200 (node cap stays 2,500) |
| G4 | OD-4 | RECOMMENDED | USER-DIR (~/.mindrian/eureka-jobs/) |
| G5 | OD-5A, OD-5B | RECOMMENDED | F6 and SCREEN |
| G6 | OD-6 | RECOMMENDED | ENGINE-BUSY-GUARD (one host process only) |
| G7 | OD-7 | RECOMMENDED | PAGE-ARG (0 new tools) |

## Facts where my figure differs from the planner's

1. Node cap sites. The planner wrote "five plugin sites" for 2,500. Command: `grep -n 2500` over lib/mcp/tools/eureka-*.cjs and lib/core/navigation/engine-projection.cjs. I found the 2,500 pattern in 14 files: 13 Eureka tool files plus `MAX_NODE_IDS` in engine-projection.cjs line 10. Written on card G3. A NODES-3000 re-plan must cover all of them.
2. Engine memory comment is at limits.py lines 16 and 17 (not 14 and 15). `MAX_TOP_K` is at limits.py line 11. Minor.
3. HEAD at write time was e18631a6e, not 62e2a4ec9 (peers commit in this tree). Repo version 2.0.0-beta.82 as planned.
4. The Eureka owner lock: the card says it does not exist yet, source the Eureka session's answer of 2026-11-08 (from the caller's brief), and my own grep for owner lock in the engine src and docs found no hit.

Facts re-run and equal to the planner's: test-270 budget line (75 tools, 83,800 bytes, about 20,950 tokens, router 9, atomic 66, 5 passed); no engine CLI command deletes one job (only the embedding cache clear commands); `scout_delete_job` at mcp_server.py line 432; `top_k` max(100) at scout line 71 and no other top_k cap; engine `MAX_TOP_K` 200; `prepare_artifact_bundle` cap 2,500; spawn sites in 3 files.

Facts kept CITED (not re-run): the Eureka family figure of 26 tools and 25,977 bytes (plan 374-13 re-measures), the 23 renamed tools a router would cause, 14 of 14 graph.* coverage, the Part 8 statements, jobs.py `transition()` having no terminal guard. Cowork is UNVERIFIED on every card.

## Gate output

Seal: `SEALED groups=7 head=6a99855b6acde8c25240e105c72a0d5fe160a049` (the draft commit, an ancestor of HEAD).

```
OK check-decision groups=7 items=8
OK check-map plans=7 items=8
```

Selftest of 374-gate.cjs: `selftest passed`. Refusal runs (all exit 1 while PENDING):

```
PLAN-BLOCKED 374-08 BLOCKED-PENDING OD-5A
PLAN-BLOCKED 374-09 BLOCKED-PENDING OD-5A
PLAN-BLOCKED 374-10 BLOCKED-PENDING OD-4
PLAN-BLOCKED 374-11 BLOCKED-PENDING OD-6
PLAN-BLOCKED 374-12 BLOCKED-PENDING OD-3
PLAN-BLOCKED 374-13 BLOCKED-PENDING OD-2
PLAN-BLOCKED 374-14 BLOCKED-PENDING OD-1
```

Part 11 gates (no product file changed): `build-connector-registry.cjs --check` OK, `build-orchestration-projection.cjs --check` OK, `check-render-coverage.cjs` exit 0.

Counts: 8 OPTIONS lines, 7 `OWNER-ANSWER Gn: PENDING` lines, 0 non-ASCII bytes, no sentinel left.

## Commits

- 6a99855b6: draft of G1 to G3 (unsealed), one file.
- Final commit: seal plus G4 to G7 plus this SUMMARY, the two files of files_modified (hash in the report).

## Deviations from Plan

- Two commits instead of one, as the caller asked: a G1 to G3 draft commit at 6a99855b6 so a context reset loses nothing. The final commit holds the two plan files. The commit is on branch main in the named worktree, as the caller said, not on a worktree-agent branch.
- No RED step: the plan has none for this task (a documents-only plan). check-decision and check-map are the checks.

## Known Stubs

None.

## Threat Flags

None. No product file, no network, no Brain call.

## Needs human

NEEDS_HUMAN: Answer the seven card lines in 374-DECISION.md. For each of G1 to G7 reply KEEP-ALL, RECOMMENDED, or CUSTOM with one OD-x=OPTION pair for each item. Recommended: G1 RECOMMENDED, G2 RECOMMENDED, G3 RECOMMENDED, G4 RECOMMENDED, G5 RECOMMENDED, G6 RECOMMENDED, G7 RECOMMENDED.
