---
stage: 2
methodology: challenge-assumptions
chain: thesis
input_from: structure-argument
output_to: build-thesis
room_section: competitive-analysis
---

# Stage 2: Challenge Assumptions (Devil's Advocate)

## Input Extraction

Extract from Stage 1 artifact (scan `room/problem-definition/` for most recent artifact with `pipeline: thesis` and `pipeline_stage: 1` in frontmatter):

- **Core argument** -- the top-level claim that everything else supports
- **Supporting arguments** -- each pillar becomes an assumption to challenge
- **Evidence gaps** -- areas where the argument is weakest, deserving deepest interrogation

Present to the user: "From your Minto Pyramid, I'm bringing forward: [core argument] as the claim under examination, with [N] supporting assumptions to stress-test and [evidence gaps] as the weakest points."

## Stage Instructions

Run `/mindrian-os:challenge-assumptions` with the extracted core argument and supporting claims.

The Devil's Advocate session should be shaped by the Thesis context:
- Each supporting argument from Stage 1 is treated as an assumption to challenge
- Evidence gaps from Stage 1 get the hardest interrogation -- these are where the thesis is most vulnerable
- For each assumption: attempt to disprove it, find counter-evidence, identify conditions under which it fails
- Classify each assumption after stress-testing: SURVIVED (strong evidence), WOUNDED (partial evidence), KILLED (disproven or unfounded)

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: thesis
pipeline_stage: 2
pipeline_input: "Core Argument: '[extracted from stage 1]'"
```

## Output Contract

The following sections from the artifact feed into Stage 3 (build-thesis):

- **Surviving assumptions** -- become thesis pillars (these held up under interrogation)
- **Killed assumptions** -- become risks to address (acknowledged weaknesses in the thesis)
- **New questions raised** -- become areas for thesis qualification (what the thesis needs to acknowledge)

Stage 3 will extract these by scanning `room/competitive-analysis/` for the most recent artifact with `pipeline: thesis` and `pipeline_stage: 2` in frontmatter.
