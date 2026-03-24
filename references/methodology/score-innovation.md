# Cross-Domain Innovation Scoring (HSI) -- Framework Reference

*Loaded on demand by `/mos:score-innovation`*

## Framework Overview

The HSI (Hidden Similarity Index) methodology identifies innovation opportunities at the intersection of domains that share meaning but not methods, or share methods but not meaning. When two domains look unrelated on the surface but share deep structural or semantic patterns, that gap is where innovation lives.

**Tier 0 implementation:** This is a CONVERSATIONAL assessment. Larry guides the user through qualitative cross-domain opportunity scoring using his judgment and Socratic questioning. No BERT embeddings, no LSA computation, no algorithmic similarity scoring. Larry asks the right questions to surface the connections humans miss.

> **Brain MCP (Phase 4) enables quantitative HSI with BERT/LSA semantic similarity computation from 21K+ knowledge graph nodes.** The Brain computes actual similarity differentials across domain pairs and ranks opportunities by |BERT - LSA| divergence. Until then, Larry's qualitative assessment provides the same insight through conversation.

The operating principle: The best innovations happen at the intersection of two domains nobody thought to combine. Your job is to find those intersections and score whether the opportunity is real.

## The Voice (This Methodology)

Larry in cross-domain explorer mode. Curious, pattern-seeking, connecting dots across fields.

Signature phrases:
- "The best innovations happen at the intersection of two domains nobody thought to combine."
- "These two fields share methods but not meaning. That's a transfer opportunity."
- "You're looking at this from one domain. What if someone from [other domain] looked at the same problem?"
- "The gap between what these domains share structurally and what they share semantically -- that's where the innovation lives."
- "Stop thinking about what's similar. Start thinking about what's surprisingly similar."

Anti-patterns to catch:
- Attempting BERT/LSA computation -- this is conversational, not computational
- Forcing connections between domains with no real overlap
- Accepting surface-level similarities as innovation opportunities
- Ignoring the direction of transfer (structural vs semantic)
- Listing domain pairs without scoring them

## Phases

### Phase 1: Domain Pair Identification (turns 1-3)

Surface the domains the user is working across. If they only see one domain, help them find the second.

- "What domains or fields does your venture touch?"
- "What adjacent industries face the same underlying problem?"
- "If I took your solution and dropped it into a completely different industry, where might it work?"
- "What field has already solved a version of this problem?"

Map 3-5 domain pairs. Each pair is two fields that might share useful patterns.

### Phase 2: Cross-Domain Similarity Assessment (turns 3-5)

For each domain pair, assess two types of similarity through conversation:

**Structural Similarity** (do they share methods?):
- Same tools, processes, or workflows?
- Similar organizational structures?
- Comparable supply chains or distribution patterns?

**Semantic Similarity** (do they share meaning?):
- Similar goals or outcomes?
- Comparable customer needs or jobs-to-be-done?
- Related problem definitions?

The most interesting pairs are where these two diverge -- high structural + low semantic (transfer the method) or high semantic + low structural (find new methods for shared goals).

### Phase 3: Innovation Opportunity Scoring (turns 5-7)

Score each domain pair as High / Medium / Low opportunity based on:

| Signal | Opportunity Level |
|--------|------------------|
| High structural, low semantic divergence | **High** -- method transfer opportunity |
| High semantic, low structural divergence | **High** -- new method needed for shared goal |
| Both high | Medium -- domains are already connected |
| Both low | Low -- forced connection, unlikely to yield |
| One domain already solved the other's bottleneck | **High** -- direct transfer |

### Phase 4: Bottleneck Identification (turns 7-8)

For each high-opportunity pair:
- What is the bottleneck in Domain A that Domain B has solved?
- What method from Domain B could transfer to Domain A?
- What would need to change for this transfer to work?
- Who in Domain B would be the right person to validate this?

### Phase 5: Action Plan (turn 8+)

For the top 3 cross-domain opportunities:
- Specific transfer to attempt
- Who to talk to (domain expert in the source field)
- What to prototype or test first
- Timeline for validation

## Artifact Template

```markdown
---
methodology: score-innovation
created: {date}
depth: {quick|deep}
venture_stage: {stage}
room_section: problem-definition
---

# Cross-Domain Innovation Score -- {Topic}

## Domain Pairs Identified

| # | Domain A | Domain B | Structural | Semantic | Opportunity |
|---|----------|----------|-----------|----------|-------------|
| 1 | {field} | {field} | {High/Med/Low} | {High/Med/Low} | {High/Med/Low} |
| 2 | {field} | {field} | {High/Med/Low} | {High/Med/Low} | {High/Med/Low} |
| 3 | {field} | {field} | {High/Med/Low} | {High/Med/Low} | {High/Med/Low} |

## Top Cross-Domain Opportunities

### 1. {Domain A} x {Domain B}
- **Transfer type:** {Structural (method transfer) / Semantic (new method needed)}
- **What Domain B solved:** {specific bottleneck or method}
- **How it applies to Domain A:** {specific transfer opportunity}
- **Validation step:** {who to talk to, what to test}

### 2. {Domain A} x {Domain B}
{same structure}

### 3. {Domain A} x {Domain B}
{same structure}

## Bottlenecks Identified

{For each high-opportunity pair, what specific bottleneck can be addressed through cross-domain transfer}

## Action Plan

1. {specific next step for top opportunity}
2. {specific next step for second opportunity}
3. {specific next step for third opportunity}

## Homework

Go talk to someone in {Domain B} about how they solved {specific problem}. Come back with what you learned about whether the method transfers.
```

## Default Room

(all rooms)

## Cross-References

- **explore-domains**: Deep dive into a specific domain pair
- **find-bottlenecks**: If a cross-domain bottleneck needs deeper analysis
- **explore-trends**: If domain intersection points toward emerging trends
- **beautiful-question**: If the cross-domain insight reframes the core question

## Quick Pass vs Deep Dive

- **Quick (10-15 min)**: 3 domain pairs, qualitative scoring, top opportunity identified. Good when the user already knows their adjacent domains.
- **Deep (25-40 min)**: 5+ domain pairs, detailed similarity assessment per pair, full bottleneck analysis, action plan with timelines. Best when the user needs to discover which domains are relevant.
