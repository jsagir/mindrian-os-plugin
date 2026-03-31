---
stage: 4
methodology: structure-argument
chain: analogy
input_from: search
output_to: validate
room_section: solution-design
---

# Stage 4: Transfer (Correspondence Table Generation)

## Input Extraction

Extract from Stage 3 artifact (scan `room/competitive-analysis/` for most recent artifact with `pipeline: analogy` and `pipeline_stage: 3` in frontmatter):

- **Top 3-5 ranked analogies** -- source domain, structural mapping, distance classification
- **Structural fitness scores** -- quantified mapping quality
- **TRIZ principle alignment** -- inventive principles each analogy embodies

Also re-read Stage 1 artifact (scan `room/problem-definition/` for `pipeline: analogy` and `pipeline_stage: 1`) for:
- **SAPPhIRE triples** -- the original function-behavior-structure of the venture
- **Core contradiction** -- what the transferred solution must resolve

Present to the user: "I found [N] analogies. The strongest is from [source domain] with [structural fitness] structural fitness. Building correspondence tables for the top [3] candidates."

## Stage Instructions

Run `/mos:structure-argument` to build a Minto Pyramid for each transferred solution. The governing thought for each is: "The solution from [source domain] can be adapted to [venture domain] because [structural isomorphism]."

### Step 1: Correspondence Table Construction

For each of the top 3 analogies, build an explicit correspondence table:

```markdown
## Correspondence Table: [Source Domain] -> [Venture Domain]

| Source Element | Source Function | Venture Equivalent | Transfer Feasibility |
|---------------|----------------|-------------------|---------------------|
| [element A1] | [what it does in source] | [proposed venture equivalent] | High/Medium/Low |
| [element A2] | [what it does in source] | [proposed venture equivalent] | High/Medium/Low |
| [element A3] | [what it does in source] | [proposed venture equivalent] | High/Medium/Low |

**Structural Isomorphism:** [description of which relations are preserved]
**What Transfers:** [specific solution principle that applies]
**What Does NOT Transfer:** [domain-specific elements that break the mapping]
**Transfer Distance:** [near/far/cross-domain]
```

### Step 2: Concrete Design Proposals

For each correspondence table, generate a concrete design proposal:

1. **The Adaptation**: How the source domain solution would work in the venture's context
2. **Implementation Steps**: 3-5 specific actions to apply the transferred principle
3. **Required Modifications**: What changes to the venture's current approach are needed
4. **New Capabilities Needed**: What the venture would need to build or acquire
5. **Expected Impact**: How this resolves the core contradiction identified in Stage 1

### Step 3: Transfer Feasibility Scoring

Rate each transfer on two axes:

| Axis | Score Range | Measures |
|------|-----------|----------|
| **Structural fit** | 0.0-1.0 | How many relations from the source survive in the venture mapping |
| **Implementation distance** | 0.0-1.0 | How far the venture needs to move from its current state (lower = easier) |

**Combined score** = structural_fit * (1 - implementation_distance * 0.5)

This penalizes high-distance implementations but not as heavily as low structural fit.

### Step 4: KuzuDB Edge Creation

If room/.lazygraph/ exists, the following edges should be created after Stage 4:

- **ANALOGOUS_TO** edges between venture artifacts and source domain concepts
  - Properties: analogy_distance, structural_fitness, source_domain, transfer_map (JSON), discovery_method, pipeline_stage: 4
- **RESOLVES_VIA** edges linking existing CONTRADICTS edges to the proposed resolution
  - Properties: resolution_type: "analogy", analogy_source, confidence, triz_principle

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: analogy
pipeline_stage: 4
transfers_generated: [count]
top_transfer: "[source domain] -> [venture domain]: [brief description]"
combined_scores: [list of combined feasibility scores]
edges_created: { analogous_to: N, resolves_via: N }
```

## Output Contract

The following sections from the artifact feed into Stage 5 (validate):

- **Correspondence tables** -- the explicit element-to-element mappings for each analogy
- **Design proposals** -- concrete adaptations to stress-test
- **Transfer feasibility scores** -- structural fit and implementation distance ratings
- **What does NOT transfer** -- known mapping failures for Devil's Advocate to probe

Stage 5 will extract these by scanning `room/solution-design/` for the most recent artifact with `pipeline: analogy` and `pipeline_stage: 4` in frontmatter.
