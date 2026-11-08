---
phase: 390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table
plan: 01
subsystem: planning
tags: [audit, keep-recalibrate-cut, part-11, read-only-checks]
requires: []
provides:
  - verified keep / recalibrate / cut table (390-TABLE.md) with corrections C1 to C5
  - read-only check script 390-table-check.cjs (10 FACT checks, 5 DOC checks)
affects: [390-02, 390-03, 390-04, 390-05]
tech-stack:
  added: []
  patterns: [RED/GREEN document check, git-ls-files reader]
key-files:
  created:
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-table-check.cjs
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-TABLE.md
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-01-SUMMARY.md
  modified:
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-PRD.md
    - .planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md
key-decisions:
  - "No product file changed. The table decides nothing; the owner decides on the 390-DECISION.md cards."
  - "C4 production counts are 7 to 15 per agent in the scope measured here, not the 5 to 10 in the plan text."
requirements-completed: [R390-TABLE]
duration: about 40 min
completed: 2026-11-08
---

# Phase 390 Plan 01: Verified keep / recalibrate / cut table Summary

The verified table is filed in 390-TABLE.md (sections A to F plus a Corrections table C1 to C5), proved by 15 read-only checks in 390-table-check.cjs. No product file changed.

## Commit

One commit holds the five files of this plan. Its sha is the one printed by `git log -1 --format=%h -- .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-TABLE.md`. The sha is reported in the hand-back message because a file cannot hold the sha of the commit that contains it.

## RED output (before the table, the addendum and the notes existed)

```
ok   FACT-01 commands/present.md has no deprecated key
ok   FACT-02 commands/visualize.md has deprecated: true and deprecated_removal
ok   FACT-03 check-render-coverage exits 0 and reports 0 unwired
ok   FACT-04 mullins-scaffold is in the connector registry and the skill exists
ok   FACT-05 egress guard has no require naming grill-engine and defines METHODOLOGY_TECHNIQUE_WORDS
ok   FACT-06 tests/test-213-part8-boundary.cjs requires grill-engine.cjs
ok   FACT-07 each parent command names its agent
ok   FACT-08 larry-extended and agent-operations name none of the seven helper agents
ok   FACT-09 exactly investor, grading and opportunity-scanner carry PROACTIVELY
ok   FACT-10 exactly 6 production files require rs-pinecone-bridge
FAIL DOC-01 390-TABLE.md has ## Corrections and exactly rows C1 to C5: missing file 390-TABLE.md
FAIL DOC-02 correction rows carry the verified key words: missing file 390-TABLE.md
FAIL DOC-03 390-PRD.md has Addendum 4 and the inline pointer: no "## Addendum 4" heading
FAIL DOC-04 audit file has 4 CORRECTED notes and keeps the old claims: only 0 lines with CORRECTED (390-01)
ok   DOC-05 no en dash or em dash in the table, the PRD or the audit file
```

Exit code 1. 10 FACT ok, 4 DOC FAIL (DOC-05 passes because no file held a dash).

## GREEN output (after the edits)

All 15 lines print `ok`, exit code 0 (FACT-01 to FACT-10, DOC-01 to DOC-05).

## Facts that moved since the planner proof

- HEAD is 3002cf611 (the plan context said dcbe73eee; research said ce3886f73). Repo version 2.0.0-beta.82. All 10 FACT checks pass unchanged, so no correction is affected.
- The mullins-scaffold entry in data/connector-registry.json is now at line 2258 (research: 2253). The comment about the 3 skills stamped at merge time in scripts/build-render-coverage.cjs spans lines 368 to 371.

## C4 exact production file counts

Measured with git grep -l -F over commands, skills, lib, scripts, hooks, pipelines, data, teams, references and agents, test files and docs excluded. Counts include the agent file itself.

| Agent | Production files | Test files | Parent commands |
|---|---|---|---|
| analogy-query-fetcher | 12 | 0 | find-analogies, scout |
| competitor-watch-fetcher | 8 | 0 | scout |
| dominant-design-researcher | 7 | 4 | dominant-designs |
| research-lane-analyst | 7 | 2 | research (prose sentence at commands/research.md:494) |
| vault-section-reviewer | 9 | 0 | vault |
| meeting-perspective-extractor | 15 | 0 | file-meeting, scout |
| chain-step-reviewer | 4 | 4 | none |

## Deviations from Plan

**1. [Rule 1 - Bug in check] DOC-04 old-claim match ignored backticks**
- Found during: Task 2, step 4.
- Issue: the audit file writes the old claim as "`render-coverage` already counts it as an unwired declaration" with backticks. The plan wording of DOC-04 has no backticks, so the check failed on text that was present.
- Fix: DOC-04 strips backticks from the audit text before it looks for the two old claims. The check still fails when the old text is gone. No check was weakened.
- Files: 390-table-check.cjs.

**2. [Measurement difference] C4 counts are 7 to 15, not 5 to 10**
- The plan text says "5 to 10 production files". The scope stated above gives 7 to 15. 390-TABLE.md and the PRD addendum record the measured range and the scope. The logical conclusion (reachable only through parent commands) holds.

## Known Stubs

None.

## Threat Flags

None. The files hold names, counts and line numbers only (Canon Part 8).

## Files not touched

No STATE.md, ROADMAP.md or REQUIREMENTS.md edit was made by this plan's commit. Peer files in the tree were not staged.
