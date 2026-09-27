---
phase: quick/260927-vfu
plan: 01
subsystem: seeds
tags: [scientific-roadmapping, theo, seed, mos-canvas]
requires: []
provides: [SEED-098]
affects: [SEED-097]
key-files:
  modified:
    - .planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md
  created:
    - .planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md
decisions:
  - "D1 fixed: SEED-097 now says twelve techniques (live Theo check, 2026-09-27), not eleven"
  - "D2 and D3 recorded as open sub-decisions under SEED-097 open decision 6, not resolved"
  - "SEED-098 planted (dormant, high priority): a /mos: command binding find-bottlenecks, dominant-designs, explore-futures, enterable mid-journey, consistent with Theo's Hypothesis-Driven Problem Solving edges"
metrics:
  duration: "~40 minutes"
  completed: 2026-09-27
---

# Phase quick/260927-vfu Plan 01: SEED-097 live Theo check + SEED-098 roadmapping command Summary

Recorded the 2026-09-27 live Theo check of Scientific Roadmapping in SEED-097 (fixing
the stale "eleven techniques" claim to twelve, and naming D1-D6 discrepancies), added a
Theo-side authoring requirement for the Theo companion phase, and planted SEED-098: a
dormant, high-priority seed for a /mos: command that runs Scientific Roadmapping through
Theo, binds find-bottlenecks/dominant-designs/explore-futures as inputs, and is
enterable mid-journey from local room state.

## What Was Built

**Task 1 - SEED-097 edits.** Eight targeted `Edit` passes on
`.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md`:
- Brief "First slice" paragraph: appended a checked-2026-09-27 parenthetical on the
  Scientific Roadmapping Theo seam.
- Open decision 6: appended the check result (data present in production, typed seam
  unreadable) and named D2 (FEEDS_INTO direction) and D3 (WellDefined coverage) as
  sub-decisions to resolve.
- Fixed "eleven techniques" to "twelve techniques (live Theo check, 2026-09-27; an
  earlier count of eleven is superseded)" - the only occurrence of the stale count in
  the file.
- Seven-operations table: added a D2 pointer beside "a detector nominates a path" and a
  D3 pointer on the Rung Placement row.
- Inserted two new subsections before "### Open-source and public-data incorporation
  review": `#### Live Theo check (2026-09-27)` (a Path A / Path B measured-fact table
  plus a D1-D6 discrepancy list) and `#### Theo-side authoring requirement (Theo
  companion phase, alongside Theo SEED-015)` (a proposed legacy-to-typed mapping table,
  six numbered requirement items, and a hosted-endpoint acceptance check).
- Breadcrumbs: appended the SEED-098 pointer.
- "Opportunity portfolio to test" paragraph and the acceptance-gates last bullet: both
  appended checked-2026-09-27 parentheticals/sentences.

**Task 2 - SEED-098 planted.** New file
`.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md` with the
SEED-096/SEED-097 frontmatter convention (id, status: dormant, priority: high, planted/
updated 2026-09-27, trigger_when, scope, depends_on, feeds, canon_parts,
navigator_ruling). Sections: Why This Matters; The flow (constraint-first); Locked
navigator ruling (NR-1 binding table, NR-2 mid-journey entry table plus the
no-collision-with-explore-opportunity and Hypothesis-Driven-Problem-Solving-consistency
subsections, NR-3); Born WIRED (proposed `hitl_stages` yaml, connector frontmatter
fields, the Part 3 gate, proposed-only navigation writes, Part 8 egress, tri-polar
behavior, honest refusal, output/filing); Dependencies and cross-links; Open decisions
for discuss-phase (NR-1 removes "new command vs extension" from the list); When to
Surface; Scope Estimate; Breadcrumbs; Notes.

## IP Protection Applied (orchestrator override)

Per the orchestrator's Brain-IP instruction, the 12 Scientific Roadmapping technique
names were NOT listed in either seed. SEED-097's Live Theo check table records only the
count (twelve) and states the list is served live by Theo's `framework_techniques` tool;
"Rung Placement" is named only because it already appears in the file as a pre-existing
ProcessStep name (step 3 of the seven operations), not as a technique name. Verified by
grep that none of the other 11 technique names ([withheld technique], [withheld technique],
[withheld technique], [withheld technique], [withheld technique], [withheld technique],
[withheld technique], [withheld technique], [withheld technique], Trading Zone
Construction, [withheld technique]) appear anywhere in either file.

**Deviation from the plan's literal verify script:** Task 1's `<automated>` verify block,
as written in the plan, `grep -qF`-checks for all 12 technique name strings (a
requirement copied from before the orchestrator override was issued). Per the explicit
orchestrator instruction ("Adjust the plan's verify check ... accordingly"), I ran an
adjusted verification instead: confirmed "twelve techniques" is present, confirmed
"eleven techniques" is absent, and confirmed none of the 11 withheld technique names
appear in the file, in place of the original all-12-names check. All other clauses of the
plan's Task 1 and Task 2 verify blocks ran unmodified and passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D1 discrepancy line initially reintroduced the forbidden string**
- **Found during:** Task 1, drafting the Live Theo check discrepancy list
- **Issue:** The first draft of the D1 bullet quoted the old text as `"eleven
  techniques"`, which is itself the exact string the verify check requires to be absent
  from the file (it does not distinguish quoted-as-history from live-claim usage).
- **Fix:** Reworded to "the prior count of eleven (superseded above)" so the literal
  substring "eleven techniques" no longer appears anywhere in the file, while still
  describing what D1 was.
- **Files modified:** `.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md`
- **Commit:** c626a5160 (folded into the single task-2 commit per the plan's single-commit
  constraint; not a separate commit)

No other deviations. No architectural decisions needed (Rule 4 did not trigger).

## Self-Check

- `.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md`: FOUND, modified (6 deletions, well under the 15-line budget).
- `.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md`: FOUND, newly created.
- Commit `c626a5160`: FOUND in `git log --oneline`.
- Working tree clean for both seed paths after commit.
- Zero em-dash characters in either file (verified with `grep -cP '\x{2014}'`).
- No personal names added; "navigator" and "the article's author" used throughout new text.

## Self-Check: PASSED

## Commit

- `c626a5160` - docs: SEED-097 live Theo roadmapping check + Theo authoring requirement; plant SEED-098 roadmapping command (Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>)
  - `.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md` (106 insertions, 6 deletions)
  - `.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md` (235 insertions, new file)

No other files were touched. STATE.md, ROADMAP.md, PLAN.md and this SUMMARY.md were
deliberately excluded from the commit per this quick task's constraints.
