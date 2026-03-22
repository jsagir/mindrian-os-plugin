---
stage: 3
methodology: build-thesis
chain: thesis
input_from: challenge-assumptions
output_to: null
room_section: financial-model
---

# Stage 3: Build Investment Thesis

## Input Extraction

Extract from Stage 2 artifact (scan `room/competitive-analysis/` for most recent artifact with `pipeline: thesis` and `pipeline_stage: 2` in frontmatter):

- **Surviving assumptions** -- use as thesis pillars (these withstood Devil's Advocate scrutiny)
- **Killed assumptions** -- use as acknowledged risks (honest about what did not survive)
- **New questions raised** -- use as thesis qualifications (conditions and limitations)

Present to the user: "From your Devil's Advocate session, I'm bringing forward: [N] surviving assumptions as thesis pillars, [N] killed assumptions as risks to address, and [N] new questions as areas for qualification."

## Stage Instructions

Run `/mindrian-os:build-thesis` with the extracted surviving assumptions and risk areas.

The thesis-building session should be shaped by the pipeline context:
- Thesis pillars come directly from stress-tested surviving assumptions -- these carry weight because they were challenged
- Risk section incorporates killed assumptions honestly -- investors respect candor about weaknesses
- Qualifications section addresses the new questions raised during challenge
- The thesis narrative should reference the interrogation: "We stress-tested N assumptions. M survived..."

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: thesis
pipeline_stage: 3
pipeline_input: "Surviving Assumptions: '[extracted from stage 2]'"
```

## Output Contract

Final stage -- no output_to. This completes the Thesis Pipeline.

### What the Full Thesis Pipeline Produced

Across all 3 stages, the Room now contains:

| Room Section | Artifact | From Stage |
|-------------|----------|------------|
| problem-definition | Minto Pyramid -- structured argument with pillars and evidence | Stage 1 |
| competitive-analysis | Devil's Advocate -- assumption survival map, killed claims, new questions | Stage 2 |
| financial-model | Investment Thesis -- stress-tested thesis with pillars, risks, qualifications | Stage 3 |

The provenance chain (`pipeline: thesis`, `pipeline_stage: 1/2/3`) connects all three artifacts, showing how a raw argument became a stress-tested investment thesis through structured interrogation.
