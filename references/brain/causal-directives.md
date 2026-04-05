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
- GOOD: "Gradient architecture eliminates CTE mismatch at metal-ceramic interfaces (mechanism: graded transition absorbs differential thermal expansion), which prevents thermal shock fracture in etch chamber liners (failure mode), enabling higher plasma temperatures (performance)"

### Gap 2: Reasoning Gap
**Problem:** Pattern completion is not causal inference.
**Directive:** Larry MUST distinguish correlation from causation. Use the dual-process approach:
1. THINKING mode: Generate causal hypotheses (divergent)
2. REASONING mode: Test each hypothesis for causal coherence (convergent)

**Causal Coherence Tests:**
- Does a physical/economic mechanism exist?
- Does the direction make sense? (A causes B, not B causes A)
- Are there confounders? (C causes both A and B, creating false A->B)
- Is this correlation masquerading as causation?

### Gap 3: Reality Gap
**Problem:** Internal models diverge from external reality.
**Directive:** Every causal claim MUST include a falsifiable prediction -- something testable that would DISPROVE the claim if the test fails.

**Example:**
- Claim: "Qualification timeline is the real moat, not material properties"
- Prediction: "If true, we should see customers willing to pay 30%+ premium for pre-qualified suppliers, even with comparable material specs. Interview 5 procurement leads -- if <3 confirm, the claim is wrong."

## Causal Claim Structure

Every causal claim Larry generates or validates must have these 7 fields:

| Field | Required | Description |
|-------|----------|-------------|
| cause | YES | What produces the effect |
| effect | YES | What happens as a result |
| mechanism | YES | HOW the cause produces the effect |
| confidence | YES | 0-1 scale based on evidence strength |
| evidence | YES | Which room artifacts support this claim |
| falsifiable_prediction | YES | What would disprove this claim |
| domain | YES | materials, business, competitive, financial, team, legal, general |

**Confidence Calibration:**
- 0.7+: observed (multiple artifacts + external validation + mechanism confirmed)
- 0.5-0.69: asserted (clear mechanism + some artifact support, untested prediction)
- 0.3-0.49: inferred (plausible mechanism, single artifact, no external validation)
- 0.0-0.29: speculative (interesting hypothesis, no supporting evidence)

## Causal Analysis by Problem Type

### Un-Defined Problems
**Directive:** Don't assert causation yet. Map POSSIBLE causal pathways. Use "might cause" language.

### Ill-Defined Problems
**Directive:** Identify competing causal explanations. Present contradictions explicitly. Use contradiction detection.

### Well-Defined Problems
**Directive:** Trace complete causal chains. Validate mechanisms. Generate falsifiable predictions.

### Wicked Problems
**Directive:** Map causal loops (feedback). Surface where intervention has leverage. Accept that causation is circular.

## Integration with Pipeline

Larry should reference these directives when:
1. Running /mos:causal extract -- enforce Three Gaps on every claim
2. Running /mos:causal trace -- narrate chains with mechanisms
3. Running /mos:causal predict -- generate predictions grounded in Gap 3
4. During regular conversation -- when assumptions stack up, suggest causal analysis
