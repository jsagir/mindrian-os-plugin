---
stage: 2
methodology: think-hats
chain: discovery
input_from: explore-domains
output_to: analyze-needs
room_section: solution-design
---

# Stage 2: Six Thinking Hats

## Input Extraction

Extract from Stage 1 artifact (scan `room/problem-definition/` for most recent artifact with `pipeline: discovery` and `pipeline_stage: 1` in frontmatter):

- **Domain Statement** -- use as the topic for Six Hats exploration
- **Top collision territory** -- use as the specific challenge to examine from 6 perspectives
- **IKA weak spots** -- feed into Black Hat (risk) analysis as known vulnerability areas

Present to the user: "From your Domain Explorer work, I'm bringing forward: [Domain Statement] with the collision territory [top collision] and your IKA weak spots [areas] for risk analysis."

## Stage Instructions

Run `/mos:think-hats` with the extracted domain as the topic.

The Six Hats session should be shaped by the Discovery context:
- **White Hat** (facts): What data exists about this collision territory?
- **Red Hat** (gut): How does this domain territory feel? What excites or worries you?
- **Black Hat** (risks): Focus especially on IKA weak spots from Stage 1 -- where are the real dangers?
- **Yellow Hat** (benefits): What opportunities does this collision create?
- **Green Hat** (alternatives): What other approaches exist in this territory?
- **Blue Hat** (synthesis): Pull together the multi-perspective view into a coherent assessment

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: discovery
pipeline_stage: 2
pipeline_input: "Domain Statement: '[extracted from stage 1]'"
```

## Output Contract

The following sections from the artifact feed into Stage 3 (analyze-needs):

- **Blue Hat synthesis** -- becomes the problem framing for Jobs to Be Done analysis
- **Yellow/Black Hat tension** -- becomes the customer segment hypothesis (who benefits vs who is at risk)
- **Red Hat gut reactions** -- become validation priorities (what needs evidence vs what is assumed)

Stage 3 will extract these by scanning `room/solution-design/` for the most recent artifact with `pipeline: discovery` and `pipeline_stage: 2` in frontmatter.
