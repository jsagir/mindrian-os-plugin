---
stage: 3
methodology: analyze-needs
chain: discovery
input_from: think-hats
output_to: null
room_section: market-analysis
---

# Stage 3: Jobs to Be Done

## Input Extraction

Extract from Stage 2 artifact (scan `room/solution-design/` for most recent artifact with `pipeline: discovery` and `pipeline_stage: 2` in frontmatter):

- **Blue Hat synthesis** -- use as the problem framing for JTBD analysis
- **Yellow/Black Hat tension** -- use as the customer segment hypothesis (who benefits most, who faces highest risk)
- **Red Hat gut reactions** -- use as validation priorities (what the user feels strongly about but lacks evidence for)

Present to the user: "From your Six Hats analysis, I'm bringing forward: [Blue Hat synthesis] as the problem frame, with [customer segment hypothesis] as our target customer and [validation priorities] as areas where we need evidence."

## Stage Instructions

Run `/mos:analyze-needs` with the extracted customer segment and problem framing.

The JTBD session should be shaped by the Discovery context:
- Customer segment comes from Yellow/Black Hat tension (who has the most to gain and the most to lose)
- Problem framing comes from Blue Hat synthesis (the structured view of the territory)
- Push for specific jobs, not abstract needs -- what progress is the customer trying to make?
- Validation priorities from Red Hat become the "gut check" areas where JTBD evidence either confirms or challenges intuition

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: discovery
pipeline_stage: 3
pipeline_input: "Blue Hat Synthesis: '[extracted from stage 2]'"
```

## Output Contract

Final stage -- no output_to. This completes the Discovery Pipeline.

### What the Full Discovery Pipeline Produced

Across all 3 stages, the Room now contains:

| Room Section | Artifact | From Stage |
|-------------|----------|------------|
| problem-definition | Domain Explorer -- territory map, collisions, IKA scores | Stage 1 |
| solution-design | Six Hats -- multi-perspective analysis, risk/benefit tensions | Stage 2 |
| market-analysis | JTBD -- customer jobs, hiring criteria, competitive alternatives | Stage 3 |

The provenance chain (`pipeline: discovery`, `pipeline_stage: 1/2/3`) connects all three artifacts, showing how domain territory became customer needs through structured multi-lens analysis.
