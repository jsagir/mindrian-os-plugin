---
id: SEED-102
status: promoted
promoted_to: "Phase 370 (2026-10-02)"
priority: high
planted: 2026-10-01
updated: 2026-10-01
planted_during: "navigator requirement relayed by the Theo session (jsagi-f1), 2026-10-01, from the paper author's June 2025 verdict on an AI-generated 9-section student systems review"
trigger_when: "before the next release that ships /mos:grade or /mos:deep-grade changes, or before any student- or faculty-facing review is generated for a course cohort, whichever comes first"
scope: "medium (a fixed review shape, a reader-facing term denylist check that fails the output, section removals in grade/deep-grade; no new engine)"
depends_on: []
feeds: [/mos:grade, /mos:deep-grade, grading agent, Academy feedback (separate track), Theo MOS-LEARNING docs (separate track)]
canon_parts: [8, 12]
navigator_ruling: "2026-10-01: build a review contract into /mos:grade and /mos:deep-grade; seed it through plugin GSD."
---

# SEED-102: Review contract for /mos:grade and /mos:deep-grade

## Why

The paper author's verdict on an AI-generated 9-section student systems review, verbatim:
"Still too long. Too much jargon, including things none of us had any idea what they were
talking about. 1-5 were good. 6 (tool analysis) is not necessary. 7 was incomprehensible,
talking about tools that we did not understand. 8 was helpful. 9 was helpful, but too much of it."

The jargon was OUR internal machinery leaking into student-facing text: agent class names
(SystemArchetypeAgent, LeveragePointAgent, IntersectionOpportunityFinderAgent), "Network Analysis
MCP", "INTERSECTIONAL SYSTEMS ANALYSIS FROM NEO4J DATABASE". This is Larry's existing rule
(never mention databases or architecture unprompted) failing on WRITTEN deliverables, not chat.

## The contract (any student- or faculty-facing review)

1. Fixed shape, in this order, from the sections the paper author kept: Executive Summary;
   Reality Check; Faculty Questions (challenge questions); Expert Conversations (practitioner
   pushback); Research Validation + Reframe; Strategic Challenge (one consolidated big question
   plus reflection questions). Cross-domain ideas: at most 2, extras under an optional
   "For advanced students" note.
2. Never a tool-analysis or methodology-score-by-tool section; never an "improvement
   recommendations mapped to agents" section.
3. No internal names in reader-facing text: no agent, MCP, tool, command, database, graph,
   Neo4j or Brain names. Methods are named only as taught in the course (Meadows' leverage
   points, causal loops, stocks and flows, ...); any other term is defined in-line in plain words
   or cut.
4. Length: executive summary first, then 3 to 5 key revision points; bullets and bold for
   takeaways.
5. An automated check FAILS the output if a denylist term appears in the student-facing body:
   agent class names and any `*Agent`, MCP, Neo4j, Brain, `/mos:`, Theo.

## Notes for planning

- Reuse before build (Canon Part 7): the denylist check belongs next to existing output lints
  (look for the em-dash guard and the Part 8 egress guard patterns); do not mint a second
  linter framework.
- The denylist must apply to the reader-facing BODY only (frontmatter/provenance may keep
  handles), and must be a code check, not a model judgment.
- Tri-Polar: the contract and check apply on CLI, Desktop and Cowork outputs alike.
- Plugin repo carries no real student names (existing hard rule).

## Disposition (2026-10-02)

Promoted to Phase 370 (its own phase by navigator choice on the fold card: "Approve, and give SEED-102 its own
phase too"). No existing open phase owns the grade surface; zero commits touched `commands/grade.md`,
`commands/deep-grade.md` or `agents/grading.md` since planting, so the trigger has not fired. Planning input:
`.planning/phases/370-*/370-INPUT.md`. Fold map: `rethinking-mindrianos/research/2026-10-02-seeds-101-107-fold-map.md`.
