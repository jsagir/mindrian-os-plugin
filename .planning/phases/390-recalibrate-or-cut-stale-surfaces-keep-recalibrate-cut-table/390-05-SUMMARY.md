---
phase: 390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table
plan: 05
subsystem: planning
tags: [owner-card, answer-gate, keep-recalibrate-cut, part-11, read-only]
requires:
  - phase: 390
    provides: 390-TABLE.md, 390-SCAN.md, 390-gate.cjs (plans 390-01, 390-02, 390-04)
provides:
  - 390-DECISION.md with 6 groups, 20 item cards and 6 OWNER-ANSWER gates, all PENDING and sealed
affects: [later Phase 390 wave plans, one set per answered group]
tech-stack:
  added: []
  patterns: ["one owner answer line per group, sealed by an options hash and a HEAD ancestor check"]
key-files:
  created:
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-DECISION.md
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-05-SUMMARY.md
  modified: []
key-decisions:
  - "No recommendation was changed from the planner default. OD-12 stays KEEP because the side-by-side read shows different methods and different room sections."
  - "OD-11 Desktop check is CLEAN, so the OD-11 RECOMMENDED value is CUT-VISUALIZE."
requirements-completed: []
duration: about 60 min
completed: 2026-11-08
---

# Phase 390 Plan 05: Owner decision cards Summary

Status: awaiting owner answer. 390-DECISION.md holds six groups and 20 item cards with facts, costs, a recommendation and one sealed OPTIONS line each. All six OWNER-ANSWER lines read PENDING. No product file changed.

## Group tokens the card recommends

| Group | Items | Token | Why |
|-------|-------|-------|-----|
| G1 orphan modules | OD-1, OD-2, OD-3, OD-14 | RECOMMENDED | OD-2 DEADLINE-90D (a dated file, no product edit); the rest KEEP |
| G2 behaviour gaps | OD-4A, OD-4B | RECOMMENDED | both FIX-PROSE |
| G3 skills | OD-5, OD-6 | KEEP-ALL | both KEEP; RECOMMENDED would equal KEEP-ALL |
| G4 agents | OD-7, OD-8A, OD-8B, OD-8C, OD-8D, OD-8F | RECOMMENDED | OD-8A BUILD (a doc edit); the rest KEEP |
| G5 command groups | OD-9, OD-10, OD-11, OD-12, OD-15 | RECOMMENDED | OD-11 CUT-VISUALIZE (Desktop check CLEAN); the rest KEEP |
| G6 Pinecone files | OD-13 | RECOMMENDED | PROVE-FIRST, deletes nothing |

## Recommendations changed from the planner default

None.

## Checks (PROVEN, run at the end of Task 2)

- `node 390-gate.cjs seal 390-DECISION.md`: `SEALED groups=6 head=da344de662a160ae718f3e9e996820c1ac3c4b57`.
- `node 390-gate.cjs check-decision 390-DECISION.md --expect-pending`: `OK check-decision groups=6 items=20`, exit 0.
- `node 390-gate.cjs gate-group 390-DECISION.md G1`: `BLOCKED-PENDING group G1 has no owner answer`, exit 1.
- Six lines `OWNER-ANSWER G<n>: PENDING`; 20 lines `OPTIONS OD-`; no sentinel line left; no non-ASCII byte (no em dash, no en dash).
- `node scripts/build-connector-registry.cjs --check`: `connector-registry: OK`. `node scripts/build-orchestration-projection.cjs --check`: `orchestration-projection: OK`. `node scripts/check-render-coverage.cjs`: `17 covered, 0 excluded, 0 gap` and `198 wired, 2 excluded, 0 unwired`. All exit 0.
- OD-11 Desktop check line (PROVEN, 2026-11-08): `git grep -n -w visualize -- ui lib/mos-face lib/mcp` gave 15 hits in 5 files. 6 name the bare word (the deprecated entry, its generated copies, one router name-list entry and one comment). 9 name the live visualize-room, visualize-graph and visualize-chain sub-commands. Result CLEAN.

## Phase 389 state copied into the card (PROVEN, 05:35 UTC, 2026-11-08)

14 PLAN files, 4 SUMMARY files (389-01, 389-02, 389-03, 389-05). Part executed. Read live at write time; 390-SCAN.md section 6 holds the overlap list. The OD-4A and OD-11 cards carry the rule that a later wave runs only after the 389 plan editing the same file has a SUMMARY file. OD-4A: 389-05 has a SUMMARY. OD-11: 389-08, 389-09 and 389-11 have none yet.

## Findings that differ from the research or the audit

- OD-9: the audit said scenario-plan feeds value-proposition. The files show the reverse: commands/value-proposition.md line 115 offers scenario-plan as a fallback; commands/scenario-plan.md does not name value-proposition. The futures command does hand off to explore-futures, scenario-plan and explore-trends (commands/futures.md lines 75 to 77). explore-trends sits in 15 tracked data files (research said 13).
- OD-13: mcp-server-brain/lib/pinecone-tools.cjs is not dead. mcp-server-brain/server.cjs line 8 requires it and line 39 registers its tools.
- OD-4B: "WIRED" in the ingest-methodology prose means born-wired in the Part 11 sense (true). The local script runs four generator steps and does not call the module.
- OD-12: the two commands differ in method (process mapping against JTBD), reference file, input and written section. The card recommends KEEP.
- OD-2: the plurai baseline files under evals/plurai also name the two synthetic-expert gates and ralph-loop-gate.
- OD-12 and OD-15: user-needs, analyze-needs and lean-canvas sit in METHODOLOGY_COMMANDS (tool-router.cjs lines 352 to 356, enum at line 1540), so a cut or a redirect there is an enum edit.

## Commits

- da344de66: docs(390-05): owner cards G1 to G3 (draft, not sealed). One file.
- The final commit holds the sealed card and this SUMMARY (two files). Its sha is in the hand-back message, because a file cannot hold the sha of the commit that contains it.

## NEEDS_HUMAN line (Task 3, exact)

NEEDS_HUMAN: Answer the six group lines in 390-DECISION.md. For each of G1 to G6 reply KEEP-ALL, RECOMMENDED, or CUSTOM with one OD-x=OPTION pair per item. Recommended: G1 RECOMMENDED, G2 RECOMMENDED, G3 KEEP-ALL, G4 RECOMMENDED, G5 RECOMMENDED, G6 RECOMMENDED.

## Deviations from Plan

None. One note: the worktree HEAD guard of the executor protocol expects a worktree-agent-* branch. The task said to work on branch main in this tree, so the guard was not applied; the staged set was empty before each commit and each commit used `git commit --only` on exact paths.

## Known Stubs

None.

## Threat Flags

None. The card holds names, counts and line numbers only (Canon Part 8). No user room was read.

## Self-Check: PASSED (card and summary exist; commit da344de66 exists; the sealed commit is checked in the hand-back message)
