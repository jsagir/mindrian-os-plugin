# RESEARCH 17: Pipeline Integration Architecture — HSI × Causal × Reverse Salient × Analogy

> **Date:** 2026-04-02
> **Version:** v1.7.0+
> **Context:** How the causal reasoning layer integrates with existing intelligence pipelines
> **Principle:** Each pipeline amplifies the others. Isolation is waste.

---

## The Integration Thesis

MindrianOS has four intelligence pipelines that currently operate in partial isolation:

| Pipeline | Finds | Misses |
|----------|-------|--------|
| **HSI** | WHAT is connected (similarity surprise) | WHY it's connected (mechanism) |
| **Reverse Salient** | WHERE the bottleneck is (cross-section gap) | WHAT it blocks downstream (cascade) |
| **Analogy** | HOW another domain solved it (structural mapping) | WHETHER the causal structure transfers (not just surface) |
| **Causal** | WHY A causes B (mechanism + prediction) | WHERE to look (needs HSI/RS as seeds) |

**The integration insight:** Each pipeline's output is the next pipeline's input seed.

```
HSI finds connection → Causal asks WHY → RS finds bottleneck → Causal traces CASCADE
    → Analogy finds cross-domain solution → Causal verifies TRANSFER → Novel insight
```

---

## Integration 1: HSI → Causal ("Why Are These Similar?")

### Current State
HSI finds artifact pairs with high innovation differential (|semantic_sim - lsa_sim|). It reports:
- `surprise_type`: structural_transfer or semantic_implementation
- `breakthrough_potential`: combined novelty + feasibility + spectral quality
- `spectral_gap_avg`: thinking quality of both artifacts

### What's Missing
HSI says "these two artifacts are surprisingly connected." It never asks: **"What is the causal mechanism that connects them?"**

### Integration Design

**Trigger:** After `hsi-to-kuzu.cjs` writes HSI_CONNECTION edges.

**Process:**
1. Read `.hsi-results.json` — get top HSI pairs (score > 0.4)
2. For each pair, read both artifact texts
3. Run causal extraction on the PAIR (not individual artifacts):
   - What causal language connects their themes?
   - Does artifact A's conclusion depend on artifact B's assumptions?
   - Do they share cause-effect claims about the same entity?
4. Create CausalClaim nodes with `discovery_method: 'hsi'`
5. Link via CAUSES edge with mechanism explaining the HSI connection

**Confidence weighting from spectral data:**
```
causal_confidence = base_confidence × (1 + spectral_gap_avg)
```
High spectral gap = artifact was written with genuine integrative thinking = higher confidence that extracted causal claims are real (not just keyword co-occurrence).

**Example:**
```
HSI pair: problem-definition/market-trends ↔ financial-model/unit-economics
  hsi_score: 0.52, surprise_type: semantic_implementation
  spectral_gap_avg: 0.38 (both artifacts have diverse thinking modes)

CAUSAL EXTRACTION:
  Claim: "Market trend toward miniaturization (cause) drives unit cost reduction
         through yield improvement at smaller geometries (mechanism), enabling
         price points below $50/unit (effect)"
  Source: problem-definition/market-trends
  Cross-ref: financial-model/unit-economics
  Confidence: 0.65 (base 0.5 × spectral boost 1.38)
  Falsifiable prediction: "If miniaturization trend reverses, unit costs
                          increase >30% within 2 quarters"
```

### New Edge Pattern
```
(HSI_CONNECTION) ← discovers → (CausalClaim) -[:CAUSES]→ (CausalClaim)
                                     ↓
                              EXTRACTED_FROM
                                     ↓
                              (Artifact pair)
```

---

## Integration 2: Reverse Salient → Causal ("What Does the Bottleneck Block?")

### Current State
Reverse salient detection finds cross-section innovation opportunities. It reports:
- `source_section` / `target_section`: where the gap is
- `innovation_type`: structural_transfer or semantic_implementation
- `innovation_thesis`: text description of the opportunity
- `breakthrough_potential`: scored by novelty + feasibility + spectral quality

### What's Missing
RS says "section A has methods that could address a gap in section B." It never asks:
1. **WHY** is this a bottleneck? (What downstream progress does it block?)
2. **WHAT CASCADES** if the bottleneck persists? (Who else is stuck?)
3. **WHAT HAPPENS** if the bottleneck is resolved? (Forward prediction)

### Integration Design

**Trigger:** After `detect-reverse-salients.py` updates `.hsi-results.json`.

**Process:**
1. Read `.hsi-results.json` reverse_salients array
2. For each reverse salient:
   a. **Trace the blockage:** Find all artifacts in `target_section` that depend on assumptions from `source_section` → these are the blocked claims
   b. **Build cascade tree:** For each blocked claim, find what downstream claims depend on it (CASCADES_TO edges)
   c. **Generate causal bottleneck claim:**
      - Cause: "Gap in [target_section] — specifically [innovation_thesis]"
      - Effect: "Blocks [N] downstream claims across [M] sections"
      - Mechanism: "Because [source_section] methods haven't been applied to [target_section] yet"
   d. **Predict resolution impact:**
      - "If resolved, unblocks [specific claims] in [specific sections]"
      - This becomes the falsifiable prediction

**Severity scoring from cascade depth:**
```
bottleneck_severity = cascade_depth × avg_downstream_confidence
```
A bottleneck that blocks 5 high-confidence claims is more critical than one that blocks 2 low-confidence claims.

**Example:**
```
Reverse Salient: RS-0003
  source_section: solution-design
  target_section: market-analysis
  innovation_thesis: "Methods in solution-design could address gap in market analysis"
  breakthrough_potential: 0.62

CAUSAL BOTTLENECK ANALYSIS:
  Blocked claims:
    1. market-analysis/pricing → depends on solution-design/cost-structure
    2. financial-model/projections → depends on market-analysis/pricing
    3. business-model/unit-economics → depends on financial-model/projections

  CASCADE TREE:
    solution-design gap
      └─ BLOCKS → market-analysis/pricing (confidence: 0.7)
          └─ CASCADES_TO → financial-model/projections (confidence: 0.6)
              └─ CASCADES_TO → business-model/unit-economics (confidence: 0.5)

  Bottleneck severity: 3 claims × 0.6 avg confidence = 1.8 (HIGH)

  RECOMMENDATION: "Resolve the solution-design → market-analysis gap FIRST.
                   It unblocks 3 downstream claims across 3 sections.
                   Run /mos:act on solution-design to fill the gap."
```

### New Edge Pattern
```
(REVERSE_SALIENT) ← contextualizes → (CausalClaim: bottleneck)
                                            ↓ CASCADES_TO
                                      (CausalClaim: blocked)
                                            ↓ CASCADES_TO
                                      (CausalClaim: downstream)
```

---

## Integration 3: Analogy → Causal ("Does the Causal Structure Transfer?")

### Current State
The analogy engine (SAPPhIRE + TRIZ) finds cross-domain structural mappings. It reports:
- `analogy_distance`: near/far/cross-domain
- `structural_fitness`: 0-1 how well elements map
- `transfer_map`: JSON mapping source → target elements
- TRIZ principles when contradictions are involved

### What's Missing
The analogy engine maps STRUCTURE but not CAUSATION. Two domains can look structurally similar but have different causal mechanisms. The key question: **"Does the causal mechanism that makes the analogy work in the source domain also apply in the target domain?"**

### Integration Design

**Trigger:** After `/mos:find-analogies` completes and user is reviewing candidates.

**Process:** For each analogy candidate:

1. **Extract causal mechanism from source domain:**
   - What causes the desired effect in the source domain?
   - What is the specific physical/economic/strategic mechanism?
   - Under what conditions does it work?

2. **Test causal transfer:**
   - Does the MECHANISM exist in the target domain? (not just the structure)
   - Are the CONDITIONS present in the target domain?
   - What would PREVENT the mechanism from working?

3. **Generate causal transfer claim:**
   - Cause: "Applying [mechanism] from [source domain]"
   - Effect: "Produces [analogous effect] in [target domain]"
   - Mechanism: "Through [specific process] — works because [condition] is present in both domains"
   - Falsifiable prediction: "If the mechanism transfers, we should observe [specific outcome]. If NOT, the failure mode will be [specific failure]."

4. **Score causal fitness** (distinct from structural fitness):
   ```
   causal_fitness = mechanism_match × condition_match × (1 - blocker_severity)
   ```

**Example:**
```
ANALOGY: Coral reef formation → Ceramic AM gradient architecture
  structural_fitness: 0.72 (good structural mapping)
  analogy_distance: cross-domain

CAUSAL TRANSFER ANALYSIS:
  Source mechanism (coral):
    Cause: Incremental mineral deposition
    Effect: Complex 3D geometry optimized for flow
    Mechanism: Biological growth follows stress gradients
    Condition: Continuous material supply + directional force

  Target mechanism (ceramic AM):
    Cause: Layer-by-layer deposition with gradient control
    Effect: Complex 3D geometry optimized for thermal/mechanical loads
    Mechanism: AM process follows digital stress optimization
    Condition: Printable material library + FEA-driven toolpath

  CAUSAL TRANSFER VERDICT:
    mechanism_match: 0.6 (both use incremental deposition following gradients)
    condition_match: 0.7 (material supply = yes; gradient driver differs: biological vs digital)
    blocker_severity: 0.2 (coral is self-healing; ceramic is not — limits lifetime analogy)

    causal_fitness: 0.6 × 0.7 × 0.8 = 0.34 (MODERATE)

  FALSIFIABLE PREDICTION:
    "If the gradient-following principle transfers, AM ceramics with stress-optimized
     toolpaths should show 25%+ improvement in fatigue life vs uniform deposition.
     Test with a single specimen pair — gradient vs uniform — under cyclic loading."

  WHAT DOES NOT TRANSFER:
    "Coral self-heals; ceramic does not. The analogy fails for applications
     requiring damage tolerance over time. Limit to initial performance, not lifetime."
```

### New Edge Pattern
```
(ANALOGOUS_TO) ← validates → (CausalClaim: mechanism transfer)
                                    ↓
                            EXTRACTED_FROM
                                    ↓
                     (source artifact) + (target artifact)
```

---

## Integration 4: The Full Loop — Discovery Cycle

When all three integrations work together, the discovery cycle becomes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE DISCOVERY CYCLE                           │
│                                                                  │
│  1. HSI finds surprising connection between artifacts           │
│     → "These two things are unexpectedly related"               │
│                                                                  │
│  2. Causal asks WHY                                             │
│     → "They're related because [mechanism]"                     │
│     → CausalClaim created with confidence + prediction          │
│                                                                  │
│  3. Reverse Salient finds this connection spans a bottleneck    │
│     → "This mechanism is blocked in section Y"                  │
│     → Cascade analysis shows 4 downstream claims at risk        │
│                                                                  │
│  4. Analogy engine searches for domains that resolved this      │
│     → "Domain X solved this with [approach]"                    │
│     → Structural mapping created                                │
│                                                                  │
│  5. Causal VERIFIES the analogy transfer                        │
│     → "The mechanism DOES/DOESN'T transfer because [reason]"    │
│     → Falsifiable prediction generated                          │
│     → If DOES transfer: RESOLVES_VIA edge created               │
│     → If DOESN'T: why-not captured as graph data                │
│                                                                  │
│  6. Larry surfaces to user:                                     │
│     → "I found a non-obvious connection between [A] and [B].   │
│        The mechanism is [C]. It's blocked by [D].               │
│        [Domain X] solved this with [approach].                  │
│        Test this by [prediction]."                              │
│                                                                  │
│  THAT is Level 3 discovery.                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hook Integration: Post-Write Chain Update

### Current chain (v1.6.3):
```
post-write → graph index → HSI compute → RS detect → hsi-to-kuzu → presentation → classify
```

### Updated chain (v1.7.0+):
```
post-write → graph index → HSI compute → RS detect → hsi-to-kuzu
                                                         ↓
                                              causal compute (NEW)
                                                         ↓
                                              causal-to-kuzu (NEW)
                                                         ↓
                                              presentation → classify
```

The causal step runs AFTER `hsi-to-kuzu.cjs` because it needs:
- HSI_CONNECTION edges (to know which pairs to analyze causally)
- REVERSE_SALIENT edges (to know which bottlenecks to trace)
- Fresh artifact data in KuzuDB (from graph index step)

All causal steps are non-blocking (background), fault-tolerant (`|| true`).

---

## Edge Type Summary (Post-Integration)

| Edge | From → To | Created By | Integration |
|------|-----------|-----------|-------------|
| HSI_CONNECTION | Artifact → Artifact | HSI pipeline | Seeds causal extraction |
| REVERSE_SALIENT | Section → Section | RS detection | Seeds cascade analysis |
| ANALOGOUS_TO | Artifact → Artifact | Analogy engine | Seeds causal transfer verification |
| CAUSES | CausalClaim → CausalClaim | Causal pipeline | Links cause-effect chains |
| CASCADES_TO | CausalClaim → CausalClaim | Causal pipeline | Tracks assumption failure propagation |
| EXTRACTED_FROM | CausalClaim → Artifact | Causal pipeline | Provenance link |
| RESOLVES_VIA | Artifact → Artifact | Analogy + Causal | Verified resolution path |

---

## Confidence Propagation Rules

Causal claims inherit and modify confidence from their source pipelines:

| Source | Base Confidence | Modifier | Rationale |
|--------|----------------|----------|-----------|
| Heuristic extraction | 0.3-0.6 | × spectral_gap_avg | High-quality thinking = more reliable claims |
| HSI-seeded extraction | 0.4-0.7 | × hsi_score | Stronger HSI connection = more plausible mechanism |
| RS-seeded extraction | 0.5-0.8 | × breakthrough_potential | Higher potential = more consequential cascade |
| Analogy-seeded transfer | 0.3-0.6 | × causal_fitness | Mechanism transfer quality determines confidence |
| User-validated | 0.7-0.9 | + 0.2 for explicit approval | User confirms the claim is real |
| Brain-calibrated | +0.1 | If Pattern 12 finds similar pattern in successful projects | Cross-venture validation |

---

*Research document 17 — Pipeline integration architecture*
*HSI × Causal × Reverse Salient × Analogy = The Discovery Cycle*
