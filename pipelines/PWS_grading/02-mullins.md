---
stage: 2
methodology: mullins
chain: PWS_grading
input_from: deep-grade
output_to: build-thesis
room_section: mullins
---

# Stage 2: Mullins 7-Domains (Market and Venture Read)

## Input Extraction

Extract from the Stage 1 artifact (scan `room/deep-grades/` for the most recent
artifact with `pipeline: PWS_grading` and `pipeline_stage: 1` in frontmatter):

- **Calibrated grade + rationale** -- the quality baseline that frames how much
  weight each domain read can carry
- **Evidence-anchored strengths and gaps** -- carry forward as the domains to
  examine, each still tied to its transcript quote/timestamp

mullins runs BEFORE build-thesis (navigator-locked order): the 7-Domains read
grounds the market/industry picture the scored thesis then interrogates.

## Stage Instructions

Run `/mos:mullins` against the scratch room with the extracted baseline.

Tier the 7-Domains analysis to course depth: read market/industry/team domains
at the level the assignment teaches (problem -> value -> prototype ->
risks+mitigation -> critical path -> team -> gaps). Do NOT demand unit economics,
moat defensibility, or term-sheet-grade market sizing the assignment never asked
for. Credit self-identified gaps already captured in the evidence JSON; never
re-list them as discovered deficiencies.

When the methodology produces its artifact, add pipeline provenance to
frontmatter:

```yaml
pipeline: PWS_grading
pipeline_stage: 2
pipeline_input: "Calibrated grade baseline from stage 1"
```

## Output Contract

Writes a 7-Domains artifact to the `mullins` room section.

`output_to: build-thesis` -- Stage 3 consumes the domains read as the evidence
context for the scored (non-gating) Ten-Questions thesis.
