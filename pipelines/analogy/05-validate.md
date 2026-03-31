---
stage: 5
methodology: challenge-assumptions
chain: analogy
input_from: transfer
output_to: null
room_section: competitive-analysis
---

# Stage 5: Validate (Structural Mapping Stress-Test)

## Input Extraction

Extract from Stage 4 artifact (scan `room/solution-design/` for most recent artifact with `pipeline: analogy` and `pipeline_stage: 4` in frontmatter):

- **Correspondence tables** -- element-to-element mappings for each analogy
- **Design proposals** -- concrete adaptations to stress-test
- **Transfer feasibility scores** -- structural fit and implementation distance
- **What does NOT transfer** -- known mapping failures to probe

Also re-read Stage 2 artifact (scan `room/problem-definition/` for `pipeline: analogy` and `pipeline_stage: 2`) for:
- **TRIZ contradiction mapping** -- does the transfer introduce NEW contradictions?
- **Abstract function description** -- does the transfer preserve the core function?

Present to the user: "I have [N] transferred solutions. Now the Devil's Advocate will stress-test each structural mapping to find where they break."

## Stage Instructions

Run `/mos:challenge-assumptions` with the correspondence tables and design proposals as the claims under examination.

### Challenge Framework

For each transferred analogy, the Devil's Advocate must probe:

#### 1. Structural Integrity Challenges

- **Mapping completeness**: "You mapped [source element] to [venture element], but what about [unmapped source element]? The source system needs ALL of these to work -- can you function without it?"
- **Relation preservation**: "In the source domain, [element A] directly causes [element B]. In your venture, that causal link doesn't exist. The analogy breaks here."
- **Scale mismatch**: "This works in [source domain] because the system operates at [scale]. Your venture operates at [different scale]. Does the principle survive the scale change?"

#### 2. New Contradiction Detection

For each design proposal, check whether the transferred solution introduces NEW contradictions:
- "By adopting [source approach], you improve [X] but now you worsen [Y]. This is a new TRIZ contradiction: Parameter [N] vs Parameter [M]."
- If new contradictions found, look up TRIZ matrix for resolution principles
- A transfer that resolves one contradiction but creates two new ones is a net negative

#### 3. Domain Assumption Challenges

- "The source domain assumes [condition]. Does that condition hold in your venture?"
- "This solution evolved in [source ecosystem]. Your ecosystem has [different property]. Will it survive the transplant?"
- "The analogy distance is [cross-domain]. At this distance, what domain-specific mechanisms are you implicitly importing?"

#### 4. Implementation Feasibility Challenges

- "The implementation distance is [score]. What are the 3 biggest obstacles to getting from here to there?"
- "This requires [capability] that your team/venture currently lacks. How do you acquire it?"
- "The source took [timeframe] to develop this. What makes you think you can transfer it in [venture timeframe]?"

### Classification

After stress-testing, classify each transferred analogy:

| Status | Meaning | Action |
|--------|---------|--------|
| **SURVIVED** | Structural mapping held under interrogation, no critical failures | Recommend for implementation |
| **WOUNDED** | Partial structural mapping, some relations broke but core principle transfers | Refine mapping, address broken relations |
| **KILLED** | Fundamental structural mismatch discovered, analogy is superficial | Document why it failed for learning |

### Survival Map

Produce a survival map showing:
```
Analogy 1: [Source Domain] -> [Status]
  Survived: [which structural mappings held]
  Failed: [which mappings broke and why]
  New contradictions: [any introduced by the transfer]
  Refined proposal: [if WOUNDED, what changes would save it]

Analogy 2: [Source Domain] -> [Status]
  ...
```

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: analogy
pipeline_stage: 5
analogies_tested: [count]
survived: [count]
wounded: [count]
killed: [count]
new_contradictions_found: [count]
recommended_transfer: "[best surviving analogy source domain]"
```

## Output Contract

Final stage -- no downstream pipeline stage. The artifact serves as:

- **Decision support** for which analogies to pursue in the venture
- **Risk documentation** showing where structural mappings are weakest
- **Learning record** for why certain cross-domain transfers fail (improves future searches)
- **Input to /mos:act** for subsequent framework selection based on validated analogies

If a transfer SURVIVED with high structural fitness (> 0.7), Larry should proactively suggest: "This analogy is strong enough to drive your next design iteration. Want me to run `/mos:act` to apply the transferred principle, or `/mos:build-thesis` to incorporate it into your investment argument?"
