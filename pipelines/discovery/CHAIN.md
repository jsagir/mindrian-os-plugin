---
name: discovery
display_name: Discovery Pipeline
description: From domain territory to customer needs -- explore, challenge, validate
stages: 3
estimated_time: 45-90min
venture_stages: [Pre-Opportunity, Discovery]
problem_types: [undefined-complex, undefined-complicated, ill-defined-complex]
---

# Discovery Pipeline

## When to Use

User has a vague idea or domain interest and needs to move from "I think this is interesting" to "here's who has the problem and what they need." Best for early-stage ventures where the territory is still undefined -- the user knows something is there but hasn't mapped it yet.

Typical starting points:
- "I'm interested in X but don't know where to start"
- "I see an opportunity in this space but can't articulate it"
- "I have domain expertise but no venture thesis yet"

## Stage Sequence

1. **explore-domains** -- Map the territory, find intersections, score IKA
2. **think-hats** -- Examine the top domain from 6 perspectives
3. **analyze-needs** -- Identify specific jobs-to-be-done for the customer segment

## What It Produces

After all 3 stages, the Room will have:
- **problem-definition:** Domain Explorer artifact with territory map, intersectional collisions, IKA scores
- **solution-design:** Six Hats analysis with perspective tensions, risk assessment, gut reactions
- **market-analysis:** JTBD artifact with customer job priorities, hiring criteria, competitive alternatives

## Chain Provenance

Each artifact includes `pipeline: discovery` and `pipeline_stage: N` in frontmatter, creating an inspectable provenance chain. This allows Larry to detect existing pipeline progress and offer resumption.
