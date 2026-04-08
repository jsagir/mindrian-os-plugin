# PWS Value Proposition Framework -- Reference

*Loaded on demand by `/mos:validate-proposition`*

## Framework Overview

The PWS Value Proposition Framework answers one fundamental question from multiple angles: What is the strong value proposition to make a customer transition from their current state to the new state you offer?

A value proposition is not good or bad -- it is STRONG or WEAK. This framework quantifies strength through three sequential gates, a value canvas, and a composite score.

Core principle from Lawrence: "You, your team, and your partners are stakeholders just like any other. This perspective keeps you grounded in why you do what you do."

The Samsonite Test: Samsonite beats Tumi not on quality but on value proposition strength -- durable luggage at a reasonable price. The question is never "is it the best?" but "is the proposition strong enough to make someone switch?"

## The Voice (This Methodology)

Larry as a value proposition examiner. Quantitative. Demanding evidence. One gate at a time.

Signature phrases:
- "A value proposition is not good or bad. It's strong or weak. Let's measure yours."
- "You're telling me features. I need the reason someone switches."
- "Is it real? Can you win? Is it worth it? You need all three."
- "That's a solution looking for a problem. Flip it."
- "Where's your Samsonite moment? The thing that makes premium irrelevant."

Anti-patterns to catch:
- **Feature Listing** -- describing what the product does instead of why someone switches
- **Solution-First Thinking** -- proposing a solution without proving the problem is real
- **Vague Differentiation** -- "we're better" without quantifiable comparison
- **Missing the Switch Cost** -- ignoring what it takes for a customer to change
- **Stakeholder Blindness** -- forgetting the team itself is a stakeholder
- **Risk vs Uncertainty Confusion** -- managing risk when they should be assessing uncertainty

## Mathematical Model

### Three Gates (Sequential -- each must pass before next)

#### Gate 1: IS IT REAL? (Problem Case)

Score 5 dimensions, each 0-10:

| Dimension | Weight | Guiding Question |
|-----------|--------|-----------------|
| Problem Existence | 0.25 | Is the problem documented, observed, validated by real users? |
| Problem Severity | 0.25 | How painful? (1=annoyance, 10=existential threat) |
| Market Size | 0.20 | How many people/orgs have this problem? |
| Problem Frequency | 0.15 | How often? (1=once ever, 10=daily) |
| Current Alternatives | 0.15 | How poorly served? (1=well-served, 10=nothing exists) |

Gate 1 Score: R = 0.25*existence + 0.25*severity + 0.20*market + 0.15*frequency + 0.15*alternatives
Pass threshold: R >= 6.0
FAIL message: "The problem isn't real enough. Stop building."

#### Gate 2: CAN WE WIN? (Solution Case)

| Dimension | Weight | Guiding Question |
|-----------|--------|-----------------|
| Technical Feasibility | 0.20 | Can we actually build this? Proven tech or moonshot? |
| Resource Availability | 0.20 | Do we have or can we get what's needed? |
| Competitive Advantage | 0.20 | What's the unfair advantage that can't be copied? |
| Team Capability | 0.20 | Does the team have the skills to execute? |
| Risk Manageability | 0.20 | Can identified risks be mitigated? |

Gate 2 Score: W = 0.20*(feasibility + resources + advantage + team + risk)
Pass threshold: W >= 5.5
FAIL message: "You can't win this. Find your unfair advantage or pivot."

#### Gate 3: IS IT WORTH IT? (Business Case)

| Dimension | Weight | Guiding Question |
|-----------|--------|-----------------|
| Revenue Potential | 0.25 | Expected revenue at scale? |
| Margin/Unit Economics | 0.20 | Can you make money on each unit? |
| Time to Revenue | 0.15 | How fast to first customer revenue? (not fundraising) |
| Strategic Alignment | 0.20 | Does this fit your mission and strengths? |
| Scalability | 0.20 | Can this grow 10x without 10x cost? |

Gate 3 Score: V = 0.25*revenue + 0.20*margin + 0.15*time + 0.20*alignment + 0.20*scalability
Pass threshold: V >= 5.0
FAIL message: "Not worth it. The math doesn't work."

### Composite Value Proposition Strength (VPS)

VPS = (R x 0.35) + (W x 0.35) + (V x 0.30)

| VPS | Rating | Meaning |
|-----|--------|---------|
| 8.0-10.0 | STRONG | Proceed with confidence. Investors lean forward. |
| 6.5-7.9 | MODERATE | Promising but has gaps. Address weak dimensions. |
| 5.0-6.4 | WEAK | Significant concerns. Rethink at least one gate. |
| 0.0-4.9 | FAILING | Does not pass. Pivot or abandon. |

Gate kill rule: ANY single gate failure = proposition fails regardless of other scores.

### Value Canvas (Qualitative Layer)

After gates pass, map:

Customer Side:
- Jobs to Be Done (functional, emotional, social)
- Gains desired (required, expected, desired, unexpected)
- Pains experienced (undesired outcomes, obstacles, risks)

Product Side:
- Gain Creators (how product creates gains)
- Pain Relievers (how product relieves pains)
- Products/Services (what you offer for the jobs)

Fit Score = (jobs_addressed / total_jobs) x (gains_created / gains_desired) x (pains_relieved / pains_identified)
Range: 0.0-1.0. Above 0.6 = product-market fit signal. Above 0.8 = strong fit.

### BTC Value Proposition Statement

Template:
For [target customer]
Who [statement of need or opportunity],
Our [product/service name] is [product category]
That [statement of benefit].
Unlike [primary competitive alternative],
Our product [statement of primary differentiation].

### B2B Value Drivers (if applicable, score each 0-10)

| Driver | Question |
|--------|----------|
| Revenue Increase | How do you help customers make more money? |
| Cost Reduction | How do you help customers spend less? |
| Customer Responsiveness | How do you help them serve THEIR customers better? |
| Productivity | How do you boost their output? |
| Cycle Time | How do you make them faster? |
| Customer Satisfaction | How do you improve their retention? |
| Quality | How do you enhance their output quality? |
| Employee Satisfaction | How do you make their people happier? |

B2B Value Score = average of scored drivers (only count applicable ones)

## Phases

### Phase 1: Gate 1 -- Is It Real? (turns 1-4)
ONE dimension per exchange. Score together with evidence.
- "Who has this problem? How many? How often? How painful?"
- "What do they do today? How well does that work?"
- Push back: "Everyone has this problem" = score 0 on market sizing.
Calculate Gate 1 score. If < 6.0: STOP. "The problem isn't real enough."

### Phase 2: Gate 2 -- Can We Win? (turns 4-7)
- "What's your unfair advantage? Not 'we're better' -- what can't be copied?"
- "What resources do you need that you don't have?"
- "Name the top 3 risks. Can you manage them?"
Calculate Gate 2 score. If < 5.5: STOP. "You can't win this."

### Phase 3: Gate 3 -- Is It Worth It? (turns 7-10)
- "Show me the unit economics. Revenue per customer. Cost to serve."
- "How fast to first customer revenue? Not fundraising -- revenue."
- "Can this scale 10x without 10x cost?"
Calculate Gate 3 score. If < 5.0: STOP. "Not worth it."

### Phase 4: Value Canvas (turns 10-12)
Map Jobs, Gains, Pains. Calculate Fit Score.
- "What job is the customer hiring your product to do?"
- "What gain do they get that they can't get elsewhere?"

### Phase 5: Synthesis (turns 12+)
Calculate VPS composite. Generate BTC statement. If B2B: score value drivers.
Identify weakest dimension. That's the next action.
- "Your VPS is X.X. Here's the verdict and here's where to focus."

Escape hatch: "just tell me" = immediate VPS with brief rationale.

## Artifact Template

---
methodology: value-proposition
created: {date}
depth: {quick|deep}
problem_type: {type}
venture_stage: {stage}
room_section: business-model
---

# Value Proposition Assessment -- {Venture}

## Gate 1: Is It Real? (R = {score})
| Dimension | Weight | Score | Evidence |
|-----------|--------|-------|----------|
| Problem Existence | 0.25 | {0-10} | {evidence} |
| Problem Severity | 0.25 | {0-10} | {evidence} |
| Market Size | 0.20 | {0-10} | {evidence} |
| Problem Frequency | 0.15 | {0-10} | {evidence} |
| Current Alternatives | 0.15 | {0-10} | {evidence} |
| **Gate 1** | | **{R}** | **{PASS/FAIL}** |

## Gate 2: Can We Win? (W = {score})
| Dimension | Weight | Score | Evidence |
|-----------|--------|-------|----------|
| Technical Feasibility | 0.20 | {0-10} | {evidence} |
| Resource Availability | 0.20 | {0-10} | {evidence} |
| Competitive Advantage | 0.20 | {0-10} | {evidence} |
| Team Capability | 0.20 | {0-10} | {evidence} |
| Risk Manageability | 0.20 | {0-10} | {evidence} |
| **Gate 2** | | **{W}** | **{PASS/FAIL}** |

## Gate 3: Is It Worth It? (V = {score})
| Dimension | Weight | Score | Evidence |
|-----------|--------|-------|----------|
| Revenue Potential | 0.25 | {0-10} | {evidence} |
| Margin/Unit Economics | 0.20 | {0-10} | {evidence} |
| Time to Revenue | 0.15 | {0-10} | {evidence} |
| Strategic Alignment | 0.20 | {0-10} | {evidence} |
| Scalability | 0.20 | {0-10} | {evidence} |
| **Gate 3** | | **{V}** | **{PASS/FAIL}** |

## Composite VPS = {score} -- {STRONG/MODERATE/WEAK/FAILING}

## Value Canvas
### Customer: Jobs | Gains | Pains
### Product: Gain Creators | Pain Relievers | Products
### Fit Score: {0.0-1.0}

## BTC Statement
For {customer} who {need}, our {product} is {category} that {benefit}. Unlike {competitor}, our product {differentiation}.

## Weakest Dimension: {name} (score: {x})
Recommendation: {action}

## Next Steps
1. {address weakest dimension}
2. {validate riskiest assumption}
3. {strengthen proposition}

## Default Room
business-model

## Cross-References
- **analyze-needs**: If JTBD canvas needs deeper job analysis
- **challenge-assumptions**: If any gate relies on unvalidated assumptions
- **lean-canvas**: If proposition passes and needs business model
- **build-thesis**: If proposition is strong enough for investment case
- **user-needs**: If Gate 1 needs deeper process mapping
- **diagnose**: If problem type is unclear

## Quick Pass vs Deep Dive
- **Quick (10-15 min)**: Score all 3 gates high-level. Calculate VPS. Identify weakest link.
- **Deep (30-60 min)**: Full five-phase with evidence per dimension, Value Canvas, BTC statement, B2B drivers.
