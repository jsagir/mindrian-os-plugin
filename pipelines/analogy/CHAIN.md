---
name: analogy
display_name: Design-by-Analogy Pipeline
description: From venture problem to cross-domain analogies -- decompose, abstract, search, transfer, validate
stages: 5
estimated_time: 90-180min
venture_stages: [Discovery, Design, Investment]
problem_types: [ill-defined-complex, well-defined-complex, well-defined-complicated]
---

# Design-by-Analogy Pipeline

## When to Use

User has a venture problem, contradiction, or design challenge that could benefit from solutions discovered in other domains. The pipeline formalizes cross-domain analogy discovery -- finding structural isomorphisms between the venture's problem and solutions from biology, engineering, other industries, or academic research.

Typical starting points:
- "I'm stuck on a design problem and need fresh approaches"
- "What can we learn from how other industries solved this?"
- "We have a contradiction -- improving X worsens Y"
- "Find me analogies from nature or other fields"

## Stage Sequence

1. **decompose** -- Extract SAPPhIRE function-behavior-structure triples from room artifacts
2. **abstract** -- Strip domain language, map to TRIZ parameter space, produce functional keywords
3. **search** -- Dual-mode retrieval: internal (KuzuDB + Brain) and external (Tavily for AskNature, patents, academic)
4. **transfer** -- Build correspondence tables mapping source domain solutions to venture domain
5. **validate** -- Stress-test structural mappings via Devil's Advocate challenge

## What It Produces

After all 5 stages, the Room will have:
- **problem-definition:** SAPPhIRE decomposition with function-behavior-structure triples (Stage 1)
- **problem-definition:** Domain-independent abstract encoding with TRIZ contradiction mapping (Stage 2)
- **competitive-analysis:** Ranked cross-domain analogies with source domains and structural fitness scores (Stage 3)
- **solution-design:** Correspondence tables with concrete design proposals transferred from analogous domains (Stage 4)
- **competitive-analysis:** Validated analogy survival map with stress-test results and refined proposals (Stage 5)

## Chain Provenance

Each artifact includes `pipeline: analogy` and `pipeline_stage: N` in frontmatter, creating an inspectable provenance chain. This allows Larry to detect existing pipeline progress and offer resumption.

## Relationship to Existing Infrastructure

This pipeline FORMALIZES what HSI already discovers implicitly:
- HSI `structural_transfer` = Stage 2 (ABSTRACT) + Stage 4 (TRANSFER)
- HSI `semantic_implementation` = Stage 4 (TRANSFER) applied
- KuzuDB `CONTRADICTS` edges = Stage 1 (DECOMPOSE) contradiction detection
- Brain `brain_cross_domain` = Stage 3 (SEARCH) internal mode

The pipeline adds: SAPPhIRE encoding, TRIZ parameter mapping, external research orchestration, explicit correspondence tables, and Devil's Advocate validation of structural mappings.

## Quick Access

For on-demand analogy discovery without the full pipeline, use `/mos:find-analogies` which runs a compressed version of Stages 1-3.
