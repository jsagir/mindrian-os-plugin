---
title: Brain Causal Reasoning Directives
description: >
  Tells Larry HOW to reason causally when analyzing room artifacts.
  Brain DIRECTS causal reasoning. KuzuDB STORES causal claims.
  Brain is READ-ONLY from the causal layer -- no user data written to Brain.
tier: 0
version: 1.7.0
used_by:
  - commands/causal.md
  - skills/larry-personality/SKILL.md
  - scripts/compute-causal.py
---

# Causal Reasoning Directives

Brain directs Larry's causal reasoning. These are the RULES for how Larry identifies, structures, and communicates causal claims. All causal data is stored in local KuzuDB -- never written to Brain.

## The Three Gaps Larry Must Close

From Duraisamy (2025) "Active Inference AI Systems for Scientific Discovery":

### Gap 1: Abstraction Gap
**Problem:** Larry sees text tokens. Users need mechanistic understanding.
**Directive:** For every causal claim, Larry MUST identify the MECHANISM -- not just "A causes B" but HOW A produces B through a specific physical, economic, or strategic process.

**Example:**
- BAD: "Ceramic AM enables new markets"
- GOOD: "Gradient architecture eliminates CTE mismatch at metal-ceramic interfaces (mechanism: graded transition absorbs differential thermal expansion), which prevents thermal shock fracture in etch chamber liners (failure mode), enabling higher plasma temperatures (performance), increasing etch rate by 15-25% (economic value)"

### Gap 2: Reasoning Gap
**Problem:** Pattern completion is not causal inference.
**Directive:** Larry MUST distinguish correlation from causation. Use the dual-process approach:
1. THINKING mode: Generate causal hypotheses (divergent)
2. REASONING mode: Test each hypothesis for causal coherence (convergent)

**Causal Coherence Tests:**
- Does a physical/economic mechanism exist?
- Does the direction make sense? (A causes B, not B causes A)
- Are there confounders? (C causes both A and B, creating false A→B)
- Is this correlation masquerading as causation?

### Gap 3: Reality Gap
**Problem:** Internal models diverge from external reality.
**Directive:** Every causal claim MUST include a falsifiable prediction -- something testable that would DISPROVE the claim if the test fails.

**Example:**
- Claim: "Qualification timeline is the real moat, not material properties"
- Prediction: "If true, we should see customers willing to pay 30%+ premium for pre-qualified suppliers, even with comparable material specs. Interview 5 procurement leads -- if <3 confirm, the claim is wrong."

---

## Causal Claim Structure

Every causal claim Larry generates or validates must have these 7 fields:

| Field | Required | Description |
|-------|----------|-------------|
| `cause` | YES | What produces the effect |
| `effect` | YES | What happens as a result |
| `mechanism` | YES | HOW the cause produces the effect |
| `confidence` | YES | 0-1 scale based on evidence strength |
| `evidence` | YES | Which room artifacts support this claim |
| `falsifiable_prediction` | YES | What would disprove this claim |
| `domain` | YES | materials, business, competitive, financial, team, legal, general |

**Confidence Calibration:**
- 0.8-1.0: Multiple artifacts + external validation + mechanism confirmed
- 0.5-0.7: Clear mechanism + some artifact support, untested prediction
- 0.3-0.4: Plausible mechanism, single artifact, no external validation
- 0.0-0.2: Speculative -- interesting hypothesis, no supporting evidence

---

## Causal Analysis by Problem Type

Brain directs which causal reasoning pattern to use based on the venture's problem type:

### Un-Defined Problems
**Causal directive:** Don't assert causation yet. Map POSSIBLE causal pathways.
- Use "might cause" language, not "causes"
- Generate 3-5 competing causal hypotheses
- Identify what evidence would distinguish between them
- **Framework affinity:** Explore Trends, Scenario Plan, Map Unknowns

### Ill-Defined Problems
**Causal directive:** Focus on ROOT CAUSE diagnosis. The problem is known but the cause is not.
- Use 5 Whys chain (each "why" is a causal link)
- Use Fishbone/Ishikawa to map multi-factor causation
- Look for hidden mediators (A→B→C where B is invisible)
- **Framework affinity:** Root Cause, Diagnose, Analyze Systems

### Well-Defined Problems
**Causal directive:** Focus on INTERVENTION design. Cause is known, need to change the effect.
- Map the causal chain from root cause to visible problem
- Identify leverage points (where small intervention has large effect)
- Predict cascade effects of proposed interventions
- **Framework affinity:** Systems Thinking, Challenge Assumptions, Validate

### Wicked Problems
**Causal directive:** Map MULTI-STAKEHOLDER causal networks. No single cause, no single effect.
- Multiple causal chains interact and conflict
- Interventions in one chain cascade through others
- Focus on equilibrium shifts, not solutions
- Track causal claims PER STAKEHOLDER (they see different causes)
- **Framework affinity:** Think Hats, Structure Argument, Beautiful Question

---

## The "So What?" Chain

After every causal insight, Larry MUST push the chain 3 levels:

```
INSIGHT: [causal claim]
SO WHAT 1: [immediate implication for the venture]
SO WHAT 2: [strategic consequence]
SO WHAT 3: [non-obvious conclusion or contrarian prediction]
```

**Example:**
```
INSIGHT: "Safran is evaluating ceramic AM turbine cores"
SO WHAT 1: "That creates near-term pull for qualified suppliers"
SO WHAT 2: "Qualification takes 18 months, so whoever starts now leads"
SO WHAT 3: "The race isn't technical -- it's qualification timeline.
           Your advantage isn't your material, it's your ability to
           enter the qualification pipeline before competitors know
           it exists."
```

The third level is where novelty lives.

---

## Inversion Protocol

For every causal claim Larry generates, also generate its INVERSE:

1. State the consensus causal belief
2. Invert it: "What if the OPPOSITE is true?"
3. Search for evidence supporting the inversion
4. Score: is the inversion plausible? More novel?

**Example:**
- Consensus: "Ceramic AM succeeds by matching metal part properties"
- Inversion: "Ceramic AM succeeds by enabling geometries IMPOSSIBLE in metals"
- Evidence: Lattice structures, internal cooling channels, graded materials
- Verdict: Inversion has strong mechanistic support -- higher novelty score

Larry should present the inversion when its novelty score > 0.6.

---

## Cascade Analysis Protocol

When Larry identifies a high-confidence causal claim, trace the cascade:

1. **Forward cascade:** If this claim is TRUE, what else must be true?
2. **Backward cascade:** What must be true for this claim to hold?
3. **Failure cascade:** If this claim is WRONG, what else breaks?

Store cascade edges as CASCADES_TO in KuzuDB with severity ratings:
- **critical:** Invalidating this claim breaks 3+ other claims
- **high:** Invalidating this claim breaks 1-2 other claims
- **medium:** Invalidating this claim weakens but doesn't break others
- **low:** Isolated claim -- failure doesn't cascade

---

## KuzuDB Cypher Patterns for Causal Queries

### Find all causal claims in a section
```cypher
MATCH (c:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[:BELONGS_TO]->(s:Section {name: $section})
RETURN c.cause, c.effect, c.mechanism, c.confidence, c.domain
ORDER BY c.confidence DESC
```

### Find causal chains (multi-hop)
```cypher
MATCH (c1:CausalClaim)-[:CAUSES*1..5]->(c2:CausalClaim)
RETURN c1.cause, c1.effect, c2.cause, c2.effect
```

### Find cascade risks (what breaks if X fails?)
```cypher
MATCH (source:CausalClaim {id: $claim_id})-[:CASCADES_TO*1..3]->(target:CausalClaim)
RETURN target.cause, target.effect, target.confidence
ORDER BY target.confidence DESC
```

### Find highest-novelty claims
```cypher
MATCH (c:CausalClaim)
WHERE c.novelty_score > 0.6
RETURN c.cause, c.effect, c.mechanism, c.novelty_score
ORDER BY c.novelty_score DESC
LIMIT 10
```

### Cross-section causal connections
```cypher
MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)-[:BELONGS_TO]->(s1:Section),
      (c1)-[:CAUSES|CASCADES_TO]->(c2:CausalClaim)-[:EXTRACTED_FROM]->(a2:Artifact)-[:BELONGS_TO]->(s2:Section)
WHERE s1.name <> s2.name
RETURN s1.name, c1.effect, s2.name, c2.cause
```

---

## Graceful Degradation

| Tier | Available | Causal Capability |
|------|-----------|-------------------|
| **Brain + KuzuDB** | Full stack | Brain directs framework selection for causal analysis. KuzuDB stores claims. Calibrated from 100+ real projects. |
| **KuzuDB only** | No Brain | Heuristic extraction + local causal graph. Good quality, no cross-venture calibration. |
| **Neither** | No graph at all | Larry reasons causally in conversation only. No persistence, no cascade tracking. Still uses these directives for reasoning quality. |

Brain directives ENRICH causal reasoning. They never GATE it. Users without Brain still get causal analysis from the heuristic pipeline + Larry's reasoning.

---

*MindrianOS Causal Reasoning Directives v1.7.0*
*Brain directs. KuzuDB stores. Larry reasons.*
