---
phase: quick-260725-vvc
plan: 01
subsystem: project-instructions
tags: [claude-md, rule-density, context-engineering, canon]
requires: []
provides: ["CLAUDE.md rule-density markers in strong-default-plus-why-clause register"]
affects: [CLAUDE.md]
tech-stack:
  added: []
  patterns: ["strong-default-plus-why-clause phrasing mirroring Part 11 advisory-lint tone"]
key-files:
  created: []
  modified: [CLAUDE.md]
decisions:
  - "Softened 4 rule-density markers (Tri-Polar, Part 6, Part 7, Part 12, QA/RCA) from MANDATORY/MUST/NEVER to strong-default-plus-why-clause language"
  - "Left the 5 genuine invariants untouched (Part 8, workspace guard, version lockstep, Part 9, langtalks corpus-gap honesty) since they guard real legal/business/governance/epistemic boundaries, not model limitations"
  - "Did NOT add the optional 5th framing-sentence edit floated in CONTEXT.md; the task-level 'touch ONLY these 4 markers' constraint takes precedence"
metrics:
  duration: "~4 min"
  completed: "2026-07-25"
  tasks: 2
  files: 1
---

# Quick Task 260725-vvc: Soften 4 rule-density markers in CLAUDE.md Summary

Reworded 4 rule-density markers in `CLAUDE.md` from absolute enforcement language (MANDATORY/MUST/NEVER) to strong-default-plus-why-clause language, mirroring this file's own already-shipped Part 11 advisory-lint tone, per the "give rules, then trust judgment" shift from the Anthropic context-engineering article. One atomic commit, the 5 genuine invariants untouched.

## What Changed

Four marker regions edited, one line/bullet-group each (6 lines total, diff confined to lines 29, 31, 47-48, 51, 172):

| Marker | Location | Before (absolute) | After (strong-default + why) |
|--------|----------|-------------------|------------------------------|
| 1. Tri-Polar Design Rule | line 29 heading + 31 body | `(MANDATORY)` / "Every feature MUST be evaluated" | `(STRONG DEFAULT)` / "Evaluate every feature ... treat a skip as a deliberate, stated call, not an oversight" |
| 2a. Part 6 Dog-Fooding | line 47 | "must honor its own canon" | "honoring its own canon here is the strong default, since a real violation surfaces as a CONTRADICTS edge" |
| 2b. Part 7 Reuse Before Build | line 48 | "the plan must justify any net-new surface" | "justify any net-new surface ... since duplicating an existing command is the more common failure mode than missing a genuine gap" |
| 3. Part 12 Pedagogy | line 51 | "never grade, never compliment" | "default to withholding grades and compliments, since praise and scores pull attention onto Larry instead of the insight" |
| 4. QA/RCA Classify | line 172 | "Classify, never just report" | "Classify before reporting: default every finding to ... since an unclassified finding leaves the reader guessing" |

Bold Part labels, trailing "Deep dive:" links, invisibility/De Stijl clauses, and backtick command formatting were all preserved.

## Verification

- Old-phrase grep ("MUST be evaluated", "never grade, never compliment", "Classify, never just report"): **zero hits**.
- `git diff -U0` `@@` hunks: exactly lines 29, 31, 47-48, 51, 172 - nothing else. 6 insertions / 6 deletions.
- Em-dash sweep on full file: **zero hits** (repo HARD RULE clean).
- 5 named invariants confirmed present and untouched (all outside the diff hunks): Part 8 Graph Boundary (line 44), WORKSPACE GUARD section, `release-process.md` version-lockstep include reference, Part 9 Memory Locality (line 50), and the langtalks corpus-gap-honesty section heading at line 194 (which correctly retains its own `(MANDATORY)`).
- One atomic commit; working tree clean of any CLAUDE.md residue.

## Deviations from Plan

None to the edit itself - plan executed exactly as written.

**Plan artifact note (flagged per constraint):** The PLAN.md read complete and coherent, no truncation or malformed content detected despite the planner's warning about Write-tool truncation during authoring. One minor imprecision found in the plan's Task 1 automated-verify command:

```
! grep -n "MUST be evaluated\|(MANDATORY)$\|never grade, never compliment\|Classify, never just report" CLAUDE.md
```

The `(MANDATORY)$` alternative is over-broad: it also matches line 194 (`## Consult langtalks-graph-expert During Dev Work (MANDATORY)`), which is one of the 5 genuine invariants that MUST retain its `(MANDATORY)` marker and is explicitly out of scope. So the plan's own Task 1 verify would report a false "failure" against a line the plan intends to keep. I verified the actual intent instead (Tri-Polar heading's `(MANDATORY)` removed, langtalks heading's `(MANDATORY)` preserved), which is what the must_haves and objective specify. The edit is correct; only the plan's verify regex was imprecise.

## Files

- `/home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md` (modified) - 4 markers reworded

## Commits

- `dd48eab3`: docs(claude-md): soften 4 rule-density markers toward trusted judgment

## Self-Check: PASSED

- CLAUDE.md exists and contains the 4 reworded markers (verified via grep).
- Commit `dd48eab3` exists in history (verified via git rev-parse / git show --stat: 1 file changed).
