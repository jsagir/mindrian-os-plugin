---
stage: 1
methodology: reason
chain: analogy
input_from: null
output_to: abstract
room_section: problem-definition
---

# Stage 1: Decompose (SAPPhIRE Extraction)

## Input Extraction

First stage -- uses room artifacts across all sections. No prior pipeline artifact needed.

Scan `room/STATE.md` for venture context: problem type, venture stage, filled sections. Then read key artifacts from the most populated sections (problem-definition, solution-design, market-analysis) to understand the venture's core challenge.

If the user provided a specific problem or contradiction when starting the pipeline, use that as the focal point. Otherwise, identify the venture's primary challenge from room state.

## Stage Instructions

Run `/mos:reason` with the venture's core problem, framing the decomposition around SAPPhIRE layers.

Read `references/methodology/sapphire-encoding.md` for the SAPPhIRE ontology reference.

For each major room artifact, extract:

### SAPPhIRE Triples

| Layer | Question | Extract From |
|-------|----------|-------------|
| **State** | What is the current situation/condition? | problem-definition/ |
| **Action** | What action does the system perform? | solution-design/ |
| **Part** | What structural components exist? | team-execution/ |
| **Phenomenon** | What observable behaviors/trends drive this? | market-analysis/ |
| **Input** | What resources/inputs does the system consume? | business-model/ |
| **Real effect** | What underlying principle/mechanism operates? | competitive-analysis/ |
| **Effect** | What measurable outcome results? | financial-model/ |

### Core Contradiction Identification

Identify the venture's CORE CONTRADICTION -- the tension where improving one dimension worsens another:
- "Increasing [X] degrades [Y]"
- "We need [A] but [A] prevents [B]"
- "Our strength in [domain] becomes a weakness when [condition]"

Check existing KuzuDB `CONTRADICTS` edges if available:
```
Scan room/.lazygraph/ for existing contradiction edges
```

### Function-Behavior-Structure Encoding

For the core problem, produce:
- **Function:** What the system DOES (verb + object, domain-independent)
- **Behavior:** HOW it achieves the function (mechanism)
- **Structure:** WHAT components enable the behavior (parts and relationships)

Larry should push the user past domain-specific language: "You say 'customer acquisition' -- but functionally, what are you doing? You're FILTERING a population by fit criteria and CONVERTING interest to commitment. Those are functions that exist everywhere."

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: analogy
pipeline_stage: 1
sapphire_function: "[extracted function]"
sapphire_behavior: "[extracted behavior]"
sapphire_structure: "[extracted structure]"
core_contradiction: "[improving X] vs [worsening Y]"
```

## Output Contract

The following sections from the artifact feed into Stage 2 (abstract):

- **SAPPhIRE triples** -- become the input for domain-independent encoding
- **Core contradiction** -- becomes the target for TRIZ parameter mapping
- **Function-behavior-structure** -- becomes the basis for cross-domain search queries

Stage 2 will extract these by scanning `room/problem-definition/` for the most recent artifact with `pipeline: analogy` and `pipeline_stage: 1` in frontmatter.
