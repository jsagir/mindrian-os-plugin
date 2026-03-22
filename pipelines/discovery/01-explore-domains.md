---
stage: 1
methodology: explore-domains
chain: discovery
input_from: null
output_to: think-hats
room_section: problem-definition
---

# Stage 1: Domain Explorer

## Input Extraction

First stage -- uses user's topic/problem description directly. No prior pipeline artifact needed.

If the user provided a topic when starting the pipeline, use that as the starting point. If not, the explore-domains methodology will elicit one through conversation.

## Stage Instructions

Run `/mindrian-os:explore-domains` with the user's topic.

Focus the session on producing:
- **Domain Statement** (1 clear sentence defining the territory)
- **Top 3 intersectional collisions** ranked by surprise level
- **IKA scores** (Interest, Knowledge, Access) with evidence for each score

Larry should push for specificity in the Domain Statement -- this becomes the core input for Stage 2. Vague domains produce vague downstream analysis.

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: discovery
pipeline_stage: 1
```

## Output Contract

The following sections from the artifact feed into Stage 2 (think-hats):

- **Domain Statement** -- becomes the topic for Six Thinking Hats exploration
- **Top collision territory** -- becomes the specific challenge to examine from 6 perspectives
- **IKA weak spots** -- become specific areas for Black Hat (risk) analysis

Stage 2 will extract these by scanning `room/problem-definition/` for the most recent artifact with `pipeline: discovery` and `pipeline_stage: 1` in frontmatter.
