---
phase: 370
kind: planning-input
recorded: 2026-10-02
promotes: [SEED-102]
sources:
  - .planning/seeds/SEED-102-review-contract-grade-deep-grade.md (the verdict, the contract, notes for planning)
  - commands/grade.md, commands/deep-grade.md, agents/grading.md (the surfaces; untouched since 2026-10-01, zero commits)
  - lib/core/tone-filter.cjs (Phase 205-05 tone gate: audience-gated, sweeps em-dashes; the closest existing output lint)
  - lib/core/part8-egress-guard.cjs (the deny-pattern guard shape to mirror, never to duplicate)
  - memory rule 2026-10-01 (feedback_lawrence_review_standard): writing for the paper author or students is short, exec summary first, only taught terms, no tool or agent names, no tool-analysis section
status: input only; /gsd-plan-phase 370 turns this into plans
---

# Phase 370 planning input: the review contract

## Why (verbatim verdict, June 2025, relayed 2026-10-01 by the Theo session jsagi-f1)

"Still too long. Too much jargon, including things none of us had any idea what they were talking about. 1-5 were
good. 6 (tool analysis) is not necessary. 7 was incomprehensible, talking about tools that we did not understand.
8 was helpful. 9 was helpful, but too much of it."

The jargon was OUR internal machinery leaking into student-facing text: agent class names (SystemArchetypeAgent,
LeveragePointAgent, IntersectionOpportunityFinderAgent), "Network Analysis MCP", "INTERSECTIONAL SYSTEMS ANALYSIS
FROM NEO4J DATABASE". This is Larry's existing chat rule (never mention databases or architecture unprompted)
failing on WRITTEN deliverables.

## The contract (any student- or faculty-facing review)

1. Fixed shape, in this order, from the sections the paper author kept: Executive Summary; Reality Check; Faculty
   Questions (challenge questions); Expert Conversations (practitioner pushback); Research Validation + Reframe;
   Strategic Challenge (one consolidated big question plus reflection questions). Cross-domain ideas: at most 2;
   extras under an optional "For advanced students" note.
2. Never a tool-analysis or methodology-score-by-tool section; never an "improvement recommendations mapped to
   agents" section.
3. No internal names in reader-facing text: no agent, MCP, tool, command, database, graph, Neo4j or Brain names.
   Methods are named only as taught in the course (Meadows' leverage points, causal loops, stocks and flows); any
   other term is defined in-line in plain words or cut.
4. Length: executive summary first, then 3 to 5 key revision points; bullets and bold for takeaways.
5. An automated check FAILS the output if a denylist term appears in the student-facing body: agent class names
   and any `*Agent`, MCP, Neo4j, Brain, `/mos:`, Theo.

## Notes for planning

- Reuse before build (Canon Part 7): the check belongs beside the existing output lints. Measured candidates
  2026-10-02: `lib/core/tone-filter.cjs` is already an audience-gated output filter (professor/researcher or a
  sensitive domain) that sweeps em-dashes to hyphens and never strips a hedge; its gating and its sweep are the
  shape to extend. `lib/core/part8-egress-guard.cjs` is the deny-pattern precedent. Do not mint a second linter
  framework.
- The denylist applies to the reader-facing BODY only; frontmatter and provenance may keep handles. It is a code
  check, never a model judgment.
- Tri-Polar: the contract and the check hold on CLI, Desktop and Cowork outputs alike.
- The plugin repo carries no real student names (existing hard rule); fixtures use pseudonyms.
- Acceptance rubric is the Lawrence review standard; one pre-fix fixture review fails the check and one post-fix
  review passes both the check and the rubric.
- Trigger status at planting: no release has shipped a grade change since 2026-10-01 (zero commits to
  `commands/grade.md`, `commands/deep-grade.md`, `agents/grading.md`), so the contract lands before the next
  grade change, as the seed's trigger requires.
- Separate tracks, not this phase: Academy feedback (MindrianV2) and the Theo MOS-LEARNING docs.
