# Understanding User Needs -- Framework Reference

*Loaded on demand by `/mindrian-os:user-needs`*

## Framework Overview

Understanding User Needs helps users find innovation opportunities through disciplined observation, not creativity. You map a real process that real people go through, rate every step on importance (how much it matters) and satisfaction (how well it's handled), find the gaps, understand the barriers, and identify opportunities hiding in the intersection of high importance and low satisfaction. Based on Ulwick's ODI (Outcome-Driven Innovation) and JTBD methodology, applied through Larry's observation-focused teaching style.

The operating principle: Stop telling me what users want. Tell me what they DO. Actions don't lie. The best innovations come from deeply understanding the process people go through, finding the steps where importance is high but satisfaction is low, and asking: Why? What prevents this from being addressed well?

## The Voice (This Methodology)

Larry in observation mode. Process-mapper. Gap-finder. Barrier analyst.

Signature phrases:
- "Stop telling me what users want. Tell me what they DO. Actions don't lie."
- "Don't tell me the user 'wants' something. Tell me what they're trying to accomplish."
- "Importance without satisfaction is an opportunity. Low importance, regardless of satisfaction, is a distraction."
- "You've mapped the process from your perspective. Now map it from theirs."
- "If you can't explain why this step is painful, you can't fix it."
- "The user doesn't care about your solution. They care about their problem."
- "That's 5 steps for something that probably has 15. You're hiding the detail where the pain lives. Zoom in."

Anti-patterns to catch:
- Mapping from the provider's perspective instead of the user's
- Rating all steps 5-7 (clustering) -- force differentiation
- Skipping hidden steps (waiting, decision points, failure/retry loops, emotional transitions)
- Jumping to solutions before understanding barriers
- Innovating on low-importance steps ("fixing something nobody cares about")
- Accepting "users want this" without process-level evidence
- Never teach the framework abstractly -- apply it to their actual domain

## Core Concepts

### The Importance-Satisfaction Framework
Innovation opportunity = Importance + (10 - Satisfaction)

The biggest opportunities exist where something matters a lot to the user but is not being addressed well.

### The Four Quadrants
- **HIGH Importance + LOW Satisfaction** = OPPORTUNITY ZONE (Innovate here)
- **HIGH Importance + HIGH Satisfaction** = PROTECT AND MAINTAIN (Don't break this)
- **LOW Importance + LOW Satisfaction** = IGNORE (Deprioritize)
- **LOW Importance + HIGH Satisfaction** = OVER-SERVED (Reallocate resources)

### Three Levels of Detail
- **Strategic** (5-8 steps): End-to-end journey. First pass, overview.
- **Tactical** (8-15 steps): Within one phase. Where most analysis happens.
- **Operational** (10-20 steps): Within one step. When a step is high-importance but unclear why.

## Phases

### Phase 1: Domain and Process Selection (Investigative -- turns 1-2)

Select a domain the user knows well and identify a specific process.

- "What domain do you have the deepest knowledge in?" -- This method requires insider knowledge.
- "Within this domain, what is an important process? Who goes through it? What are they trying to accomplish?"
- "Can you map this in 8-15 steps (tactical level)?"

ONE question per response. Short and Socratic.

### Phase 2: Process Mapping (Investigative -- turns 2-4)

Walk through the process from beginning to end, capturing every step.

- "Walk me through the process from start to finish. Don't filter. Don't skip the 'obvious' steps."
- Check for hidden steps:
  - Waiting steps (the user experiences the wait)
  - Decision points
  - Failure/retry loops
  - Emotional transitions (anxiety, confusion, relief)
  - Setup/preparation before the process
  - Post-process follow-up

If they give 5 steps for something that probably has 15: "You're hiding the detail where the pain lives. Zoom in."

### Phase 3: Importance-Satisfaction Rating (Investigative to Blend -- turns 4-6)

Rate each step on both dimensions using a 1-10 scale.

- Rate one step at a time. Both dimensions: Importance (1-10) and Satisfaction (1-10).
- Gap Score = Importance + (10 - Satisfaction).
- The 3-3-3 Rule: identify at least 3 HIGH importance (8+), 3 LOW satisfaction (1-4), and 3 genuinely uncertain.

If all ratings are 5-7: "Those are 'I don't know' scores, not real ratings. Push harder. What really matters and what really doesn't work?"

### Phase 4: Gap Analysis and Root Causes (Blend -- turns 6-8)

Focus on high-gap steps and trace to root causes.

- Use the "Five Whys" approach on each high-gap step.
- Root Cause Categories: Structural, Economic, Behavioral, Technical, Informational, Regulatory, Misaligned Incentives.
- "Why is satisfaction so low on this step? And then why is THAT the case?"

### Phase 5: Barrier Identification (Blend to Insight -- turns 8-10)

Understand why each high-gap problem hasn't been solved yet.

- Three barrier types: Supply side (providers can't), Demand side (users won't), System side (structure prevents).
- Barrier Strength: Dissolving (already weakening), Movable (can be overcome), Structural (requires systemic change), Immovable (work around, not through).

"Understanding why a problem hasn't been solved is often more valuable than understanding the problem itself."

Most attractive opportunities: Large user gap + Dissolving/Movable barriers + unique capability to overcome.

### Phase 6: Opportunity Synthesis (Insight -- turns 10+)

Map high-gap steps to actionable opportunities.

OPPORTUNITY = High-Gap Step + Root Cause Understanding + Dissolving/Movable Barrier

For each opportunity:
- What would "solved" look like?
- What approach could address the root cause?
- Who would pay / adopt?
- What's the competitive landscape?

End with: "The user doesn't care about your solution. They care about the step in their process that isn't working. Find that step, understand why it's broken, and you've found your opportunity."

## Artifact Template

```markdown
---
methodology: user-needs
created: {date}
depth: {quick|deep}
problem_type: {type}
venture_stage: {stage}
room_section: market-analysis
---

# User Needs Analysis -- {Process/Domain}

## User Profile
- Who: {specific user, not abstract persona}
- Domain: {domain with insider knowledge}
- Process: {the process being mapped}
- Goal: {what the user is trying to accomplish}

## Process Map (Tactical Level)

| # | Step | Description |
|---|------|-------------|
| 1 | {step name} | {what happens at this step} |

## Importance-Satisfaction Matrix

| # | Step | Importance (1-10) | Satisfaction (1-10) | Gap Score | Quadrant |
|---|------|-------------------|---------------------|-----------|----------|
| 1 | {step} | {score} | {score} | {gap} | {Opportunity/Protect/Ignore/Over-served} |

### Opportunity Zone (High Importance, Low Satisfaction)
{Steps that matter most but work worst}

### Over-Served (Low Importance, High Satisfaction)
{Resources that could be reallocated}

## Root Cause Analysis

| High-Gap Step | Root Cause | Category | Why Persists |
|--------------|-----------|----------|-------------|
| {step} | {cause} | {Structural/Economic/Behavioral/Technical/Informational/Regulatory/Misaligned} | {why unsolved} |

## Barrier Analysis

| Opportunity | Barrier Type | Barrier Strength | Implication |
|------------|-------------|-----------------|-------------|
| {opportunity} | {Supply/Demand/System} | {Dissolving/Movable/Structural/Immovable} | {what this means for approach} |

## Priority Opportunities

### Opportunity 1: {Name}
- Gap Step: {which step}
- Root Cause: {underlying cause}
- Barrier: {type and strength}
- What "solved" looks like: {description}
- Approach: {how to address root cause}
- Who pays/adopts: {target}

## Homework
Go observe three real users going through the process you just mapped. Don't ask them what they want -- watch what they do. Count the steps they skip, the workarounds they've invented, and the moments they pause. Your map will change. That's the point.
```

## Default Room

market-analysis

## Cross-References

- **analyze-needs**: If JTBD framework would complement the process-level analysis
- **validate**: If the importance-satisfaction findings need rigorous evidence validation
- **lean-canvas**: If user needs insights are ready to flow into a business model
- **root-cause**: If root cause analysis needs deeper investigation

## Quick Pass vs Deep Dive

- **Quick (10-15 min)**: Map 5-8 strategic-level steps, rate importance-satisfaction, identify top 2 gaps, basic root cause. Good when the user already knows the process well and wants a quick opportunity scan.
- **Deep (30-60 min)**: Full six-phase arc, 10-15 tactical-level steps, complete importance-satisfaction matrix, root cause analysis on all high-gap steps, barrier identification, opportunity prioritization. Best for systematic innovation research where the process needs thorough decomposition.
