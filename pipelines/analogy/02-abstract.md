---
stage: 2
methodology: reason
chain: analogy
input_from: decompose
output_to: search
room_section: problem-definition
---

# Stage 2: Abstract (Domain-Independent Encoding)

## Input Extraction

Extract from Stage 1 artifact (scan `room/problem-definition/` for most recent artifact with `pipeline: analogy` and `pipeline_stage: 1` in frontmatter):

- **SAPPhIRE triples** -- the function-behavior-structure decomposition per room section
- **Core contradiction** -- the improving-vs-worsening tension
- **Function-behavior-structure** -- the domain-specific encoding to be abstracted

Present to the user: "From the decomposition, I'm abstracting: [function] as the core function, with [contradiction] as the key tension to resolve."

## Stage Instructions

The goal is to strip ALL domain-specific language and produce a purely functional description that could apply to any field. This is what enables cross-domain search -- you cannot find analogies in biology if you keep using business terminology.

### Step 1: Functional Verb Replacement

Replace every domain-specific term with a standardized functional verb. Read `references/methodology/sapphire-encoding.md` for the functional verb vocabulary.

Standard functional verbs: deliver, protect, transform, connect, filter, amplify, regulate, separate, convert, store, distribute, stabilize, absorb, channel, detect, signal, adapt, repair, recycle, generate.

Examples:
- "Customer acquisition funnel" becomes "filter population by fit criteria, convert interest to commitment"
- "Tumor drug resistance" becomes "adaptive barrier blocks delivery system"
- "Supply chain optimization" becomes "minimize transfer distance while maintaining flow capacity"
- "Competitive moat" becomes "structural barrier that increases with usage"

Larry should challenge domain-locked thinking aggressively: "You keep saying 'market penetration' -- but functionally, what is penetration? It's overcoming a barrier to reach a target. Where else do systems overcome barriers to reach targets? Everywhere -- cell membranes, firewalls, military logistics, root systems in soil."

### Step 2: TRIZ Parameter Mapping

Read `references/methodology/triz-principles.md` for the 39 TRIZ parameters and 40 inventive principles.

Map the core contradiction to TRIZ parameter space:
1. Identify which of the 39 parameters the venture is trying to IMPROVE
2. Identify which of the 39 parameters WORSENS as a result
3. Look up the TRIZ Contradiction Matrix intersection for suggested inventive principles

Read `references/methodology/triz-matrix.json` for the contradiction matrix data.

Format:
```
TRIZ Contradiction:
  Improving: Parameter [N] - [name]
  Worsening: Parameter [M] - [name]
  Suggested Principles: [P1], [P2], [P3], [P4]
  Principle descriptions: [from triz-principles.md]
```

### Step 3: Functional Keywords for Search

Produce 5-10 domain-independent keywords that capture the venture's core functions. These become the search queries for Stage 3.

Format: `[verb] + [abstract object]`
Examples: "filter population", "overcome adaptive barrier", "amplify weak signal", "distribute through network", "regulate bidirectional flow"

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: analogy
pipeline_stage: 2
abstract_function: "[domain-independent function description]"
triz_improving: "[parameter number and name]"
triz_worsening: "[parameter number and name]"
triz_principles: [list of suggested principle numbers]
functional_keywords: [list of 5-10 search keywords]
```

## Output Contract

The following sections from the artifact feed into Stage 3 (search):

- **Abstract function description** -- becomes the primary search query for cross-domain analogy retrieval
- **TRIZ parameter mapping** -- guides search toward domains that resolved the same contradiction type
- **Functional keywords** -- become specific search terms for AskNature, patents, and academic databases

Stage 3 will extract these by scanning `room/problem-definition/` for the most recent artifact with `pipeline: analogy` and `pipeline_stage: 2` in frontmatter.
