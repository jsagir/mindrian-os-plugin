---
stage: 1
methodology: structure-argument
chain: thesis
input_from: null
output_to: challenge-assumptions
room_section: problem-definition
---

# Stage 1: Structure Argument (Minto Pyramid)

## Input Extraction

First stage -- uses user's thesis, argument, or claim directly. No prior pipeline artifact needed.

If the user provided a thesis statement when starting the pipeline, use that as the starting point. If not, the structure-argument methodology will elicit one through conversation.

## Stage Instructions

Run `/mos:structure-argument` with the user's thesis or claim.

Focus the session on producing:
- **Core argument** (Minto answer-first statement)
- **Supporting arguments** (the pillars holding up the core argument)
- **Evidence for each pillar** (what data or reasoning supports each supporting argument)
- **Evidence gaps** (where the argument lacks support)

Larry should push for structural clarity -- each level of the pyramid must genuinely support the level above it. Weak pillars get flagged, not ignored.

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: thesis
pipeline_stage: 1
```

## Output Contract

The following sections from the artifact feed into Stage 2 (challenge-assumptions):

- **Core argument** (Minto answer-first) -- becomes the target for Devil's Advocate interrogation
- **Supporting arguments** -- become specific assumptions to challenge (each pillar is an assumption)
- **Evidence gaps** -- become areas for deeper interrogation (where the argument is weakest)

Stage 2 will extract these by scanning `room/problem-definition/` for the most recent artifact with `pipeline: thesis` and `pipeline_stage: 1` in frontmatter.
