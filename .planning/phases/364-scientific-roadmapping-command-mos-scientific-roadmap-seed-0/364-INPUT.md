---
phase: 364
kind: planning-input
recorded: 2026-09-30
sources:
  - .planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md (navigator rulings NR-1..NR-3, 2026-09-27)
  - Theo commit f101031, .planning/phases/25-scientific-roadmapping-adoption-and-research-plan-route-seed/25-PLUGIN-CONTRACT.md
  - Theo phase 25 dir, 25-INPUT-command-draft.md (navigator's draft spec, adopt as starting spec)
  - Navigator requirements relayed by the Theo session (jsagi-f1), 2026-09-30
status: input only; /gsd-plan-phase 364 turns this into CONTEXT and plans
---

# Phase 364 planning input: /mos:scientific-roadmap

Working slug: `/mos:scientific-roadmap` (SEED-098 recommendation; `/mos:roadmap` is the
alternative). The navigator picks the slug.

## Sequencing (hard)

1. Phase 363 closes first. 363-22 writes the engine reuse contract into SEED-098 (D-18).
2. Step walking starts only after Theo Phase 25 authors the 7 steps. Today `framework_step("Scientific Roadmapping")`
   returns 7 steps with label, runIt, stepKind, thinkingMode, researchDirective, artifactRubric and source span
   all NULL: a property-schema mismatch in the out-of-GSD sr-v1 batch. Theo will send the commit when fixed.
3. Theo's USES_FRAMEWORK sync edge lands after this phase ships in a release.

## Requirements (navigator)

1. Problem-type rooting: enter from the room's problem-type classification (Undefined, Ill-Defined,
   Well-Defined, Wicked). The plan names its rung. Step 3 places the rung: Landscape or Vision for Un-Defined,
   Manifesto or Technical for Ill-Defined, Pipeline or Opportunity for Well-Defined.
2. Researcher starting point: reachable from the researcher persona (role_blend researcher,
   persona_variants.researcher), from /mos:ignite Researcher or Door 3 Hypothesis (hypothesis_text as goal seed),
   direct, or `--from-hypothesis`. Mid-journey entry from room state (NR-2), never colliding with explore-opportunity.
3. Systems-thinking layer: a Systems Thinking pass (/mos:systems-thinking, /mos:analyze-systems, ch06) over the
   field BEFORE Path Enumeration and Constraint Interrogation.
4. Hypothesis-driven link: Stage B turns each ranked bottleneck into a falsifiable hypothesis via
   Hypothesis-Driven Problem Solving, hands HDPS steps 2 and 3 to /mos:research on the 363 engine; a refuted
   bottleneck drops in the ranking.
5. Inputs (NR-1): find-bottlenecks, dominant-designs, explore-futures bound as inputs, not duplicated.
   find_bottlenecks now refuses `not_scored` (Theo 20.2): map it to `not_ready`, never `unreachable`.

## Contract rules (Theo 25-PLUGIN-CONTRACT)

- Walk steps from framework_step in list order; never sort by sourceOrder; never write step text from memory;
  skip DEFINITION and ASIDE steps; a null label or runIt is refused honestly ("Theo has not authored this step yet").
- Stage A: the 7 steps (Tension Qualification, Goal Quantification, Rung Placement and Type Selection, Forum
  Construction, Path Enumeration, Constraint Interrogation, Catalytic Ranking), a human gate each, claims filed
  as proposed.
- Output: room/research-plan/PLAN.md, filed through the 363 F.8 basket; the plan names its rung and the steps run.
- No second engine (D-18): a door on the `scientific-roadmapping` template, plans handed to /mos:research.
- Wiring via /mos:new-surface then the registry sync (data/command-registry.json, recipe-maps), never a hand MERGE.
- Draft frontmatter: kind methodology, autonomous_safe false, reach context_block,
  frameworks [Scientific Roadmapping, Hypothesis-Driven Problem Solving], produces room/research-plan/*.
- Canon Part 8: only generic handles reach Theo. Theo decides nothing. No skill writes canon.

## Open items for discuss-phase

- hierarchy_rank from connector-registry.json.
- How a two-framework command is stored in the registry (one primary plus a recipe edge, or two).
- Slug: /mos:scientific-roadmap vs /mos:roadmap.
- find-analogies as an optional NEXT_IN_RECIPE (in the draft).
- Verify NR-3's Hypothesis-Driven Problem Solving edges against canon (the sr-v1 batch was unaudited; Theo 25 verifies).

## Navigator ruling: where Scientific Roadmapping is rooted (2026-10-01)

Navigator's words: "is related to innovation throw meanining, innovation throe needed solution
statment criterea. if a problem has a shape and or a solution statemnt knows what there to be
delivered not how, then a scintific process can begone to unlock the how"

Reading: Scientific Roadmapping starts where the WHAT is known and the HOW is not. Its entry
condition is a problem with a shape, or a solution statement that says what must be delivered
(the needs or solution-criteria statement), and it runs the scientific process that unlocks how.

Supreme-source grounding (PWS course text, PWS-Book/notes/notion-export/reference-library/
ppt-lecture-notes-text-only-docx-converted-2024-05-14-01-59.md):
- l.2254: "A needs statement can be used to formulate a well-defined problem, thus making the criteria for a successful solution clear"
- l.2256: "Even if the solution is hard to devise and requires magical thinking"
- l.2259: "Critical: any solution must be falsifiable"
- l.4161-4162: "Being well-defined says nothing about the particular solution, which may be easy to come by or hard; think about radar and sonar ... Only what the solution needs to deliver"
- l.4168: "For these well-defined problems, the solution criteria were clear from the start, but incredibly difficult to find"
- Innovation of meaning (l.1815 "Give People a New Reason to Buy", the Ill-Defined meaning lens): a new meaning defines a new WHAT, which then hands Scientific Roadmapping its delivery criteria.

Consequences for planning:
- Primary rooting: Well-Defined, with the solution criteria known and the how unknown. A secondary bridge comes from Ill-Defined innovation of meaning, where meaning produces the what.
- Entry check: the room has a needs or solution-criteria statement (what to deliver). If not, route back to define it first, never improvise the what.
- This replaces the generic "enter from the room's problem-type classification" with a precise rung, and gives Theo Phase 25 a supreme-source citation for the type link.

## SEED-106 inputs (added 2026-10-02, fold of seeds 101-107)

Source: `.planning/seeds/SEED-106-mindrian-theo-relationship-insights-2026-10-02.md` items 3, 4, 5, measured
live in one CLI session on beta.53 and re-measured 2026-10-02 through `theo_health` and `brain_stats`
(generic handles only; no room content crossed). Theo-side work (cross-repo, `/home/jsagi/Theo`); this phase
is the plugin-side consumer, so the command must be designed knowing these three facts are true today.

1. **Theo answers science questions with business-terminated chains.** For a discovery question, nearly every
   FEEDS_INTO chain walked from Beautiful Question, Trending to the Absurd or Dominant Design ended at PWS
   Value Proposition, Lean Canvas or JTBD. Edges that point at discovery exist but are few: Beautiful Question
   to Bias Detection 0.85, Red Teaming to Problem Definition Transformation 0.85, Scenario Planning to Knowns
   and Unknowns 0.7, Cross-Disciplinary Thinking to Opportunity Recognition. A researcher persona needs a
   discovery-terminated lane; that is the job SEED-098 (this phase) promoted. Design consequence: the command
   must not accept a business-terminated chain as its spine; it walks `framework_step` content only (D-18).
2. **The graph has no scientific-method content.** No falsifiability, controls, priors, or mechanism-vs-property
   guidance; the session had to supply it. Candidate for Theo ingest under the PWS-sources-supreme rule (the
   navigator's course text outranks Theo canon), never invented by the plugin. Until ingested, the command
   carries these as its own step rubric, labelled as plugin-side, not as Theo content.
3. **Problem-type coverage is thin and must be said out loud.** `theo_health.watcher_coverage` 2026-10-02:
   `frameworks_total 460`, `frameworks_with_problem_type 109`, `frameworks_with_watcher 5`. A thin
   `recommend_chain` answer reads like a fit verdict when it is a coverage gap; the command (and the Theo tools
   it calls) say "uncovered" explicitly. `brain_stats` the same day: 28,137 nodes, 53,311 relationships,
   460 Framework, 315 Technique, 735 ProcessStep, 35 Chapter, 113 MindrianCommand, 0 Concept, 0 Stage.

Related measured zero (item 6, Phase 366 deliverable 5, not this phase): a fresh room's Eureka recall reported
`canon_resolved: 0`, so `find_connections` could not be asked across the room/Theo boundary.
