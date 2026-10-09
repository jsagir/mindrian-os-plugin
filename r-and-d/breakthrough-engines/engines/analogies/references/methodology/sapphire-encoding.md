# SAPPhIRE Functional Encoding Guide

*A systematic method for extracting function-behavior-structure descriptions from room artifacts, enabling cross-domain analogy discovery.*

---

## What Is SAPPhIRE?

SAPPhIRE is a 7-layer ontology developed by Chakrabarti et al. for encoding ANY system in terms of its functional architecture. The acronym stands for:

- **S**tate change
- **A**ction
- **P**art
- **Ph**enomenon
- **I**nput
- **R**eal effect (physical/logical law)
- **E**ffect (intended outcome)

**Terminology note (read before comparing with the literature).** In Chakrabarti's published model the seven constructs are State change, Action, Part, Phenomenon, Input, oRgan and Effect, where the final "Effect" is the physical effect (the natural law or principle applied) and "oRgan" is the set of properties and conditions that enable it. This guide adapts the model for business and venture artifacts: layer 6 is named `real_effect` (the governing law or mechanism, closest to the published "Effect") and layer 7 is named `effect` (the intended outcome or value, a function-level statement that the published model does not carry as a layer). The layer names below are frozen because the scoring code (`lib/core/semantic-index/analogy-fitness.cjs`) and the JSON handed to `scripts/analogy-fitness-report.cjs` use them: `state_change, action, parts, phenomenon, input, real_effect, effect`. Citations to Chakrabarti et al. support the method, not this exact layer naming.

The model captures how a system transforms inputs into outcomes through its structural parts, the phenomena they create, and the physical/logical effects that govern the transformation. By encoding artifacts at this level, two systems that look nothing alike on the surface can be recognized as structurally identical -- enabling analogy transfer.

---

## The 7 SAPPhIRE Layers

### Layer 1: State Change

**Definition:** The observable change in condition, position, or configuration that occurs when the system operates.

**Question:** What changes? What is different before vs after?

**Room mapping (a starting heuristic for where to look, not a rule):** `problem-definition/` -- the gap between current state and desired state.

### Layer 2: Action

**Definition:** The interaction or operation that causes the state change. What the system DOES, in functional terms.

**Question:** What does the system do to cause the state change?

**Room mapping:** `solution-design/` -- the product/service action, the user interaction mechanism.

### Layer 3: Part

**Definition:** The structural components, agents, or resources involved in performing the action.

**Question:** What structural elements are involved? Who/what performs the action?

**Room mapping:** `team-execution/` -- team composition, partnerships, technology stack, resources.

### Layer 4: Phenomenon

**Definition:** The observable behaviors, signals, or patterns that emerge from the parts performing the action.

**Question:** What can you observe happening? What patterns emerge?

**Room mapping:** `market-analysis/` -- market trends, user behaviors, demand signals, adoption patterns.

### Layer 5: Input

**Definition:** The energy, information, material, or resources consumed or required for the phenomenon to occur.

**Question:** What goes in? What is consumed, spent, or required?

**Room mapping:** `business-model/` -- revenue streams, funding sources, customer acquisition cost, operational inputs.

### Layer 6: Real Effect

**Definition:** The physical, economic, or logical law/principle that governs why the phenomenon produces the intended effect. The underlying mechanism.

**Question:** WHY does it work? What law or principle makes this possible?

**Room mapping:** `competitive-analysis/` -- moat, structural advantage, network effects, economic logic.

### Layer 7: Effect

**Definition:** The intended outcome, the value delivered, the purpose fulfilled.

**Question:** What value is created? What job is done?

**Room mapping:** `financial-model/` -- unit economics, growth mechanism, value creation, return on investment.

---

## Flattening an encoding for scoring

The YAML template below is the human-readable extraction form. The fitness engine compares ONE string per layer, so before writing `<slug>-fitness-input.json` flatten each layer to a single plain-language sentence or phrase:

- `state_change`: `delta`, or "before -> after" in one phrase
- `action`: `verb` + `description`
- `parts`: the part names and roles joined with semicolons
- `phenomenon`: `observable` + `pattern`
- `input`: the non-empty ones of `energy`, `information`, `material`, joined
- `real_effect`: `principle` + `why_it_works`
- `effect`: `intended_outcome` (leave out `beneficiary`)

Rules: strip domain nouns where a functional term exists (the same word on both sides inflates the cosine without proving structure); leave a layer as an empty string when the source does not support it (an empty layer counts as "no correspondence", a guessed one counts as noise); never pad a layer with text copied from another layer. The encoding must come from the artifact or fetched source text, not from what the match is hoped to be.

## SAPPhIRE Extraction Template

Use this template when encoding a room artifact for analogy search. Strip all domain-specific language and express each layer in functional terms.

```yaml
sapphire_encoding:
  artifact_id: "{section}/{filename}"
  domain: "{venture domain}"

  state_change:
    before: "{current state in functional terms}"
    after: "{desired state in functional terms}"
    delta: "{what specifically changes}"

  action:
    verb: "{functional verb: deliver, protect, transform, connect, filter, amplify, regulate, separate, convert}"
    description: "{domain-independent description of what the system does}"

  parts:
    - name: "{component name}"
      role: "{functional role}"
    - name: "{component name}"
      role: "{functional role}"

  phenomenon:
    observable: "{what you can measure or observe}"
    pattern: "{temporal or spatial pattern}"

  input:
    energy: "{what energy/effort is consumed}"
    information: "{what information is required}"
    material: "{what material/resource is consumed}"

  real_effect:
    principle: "{underlying law or mechanism}"
    why_it_works: "{causal explanation}"

  effect:
    intended_outcome: "{value delivered}"
    beneficiary: "{who benefits}"

  functional_keywords:
    - "{keyword1}"
    - "{keyword2}"
    - "{keyword3}"

  triz_parameters:
    improving: "{TRIZ parameter being improved}"
    worsening: "{TRIZ parameter being worsened, if any}"
```

---

## Worked Examples

The three examples are illustrative constructions. Their figures (pass rates, fraud reductions) are placeholders to show the encoding shape, not sourced facts; do not quote them.

### Example 1: EdTech Platform (Education Domain)

**Original artifact:** "Our AI tutoring platform uses spaced repetition algorithms to personalize study schedules for medical students, improving board exam pass rates from 72% to 91%."

```yaml
sapphire_encoding:
  artifact_id: "solution-design/ai-tutoring-platform"
  domain: "education-technology"

  state_change:
    before: "Knowledge retention decays rapidly after initial exposure"
    after: "Knowledge retention maintained at high levels over extended period"
    delta: "Retention curve flattened through optimized review timing"

  action:
    verb: "regulate"
    description: "System regulates timing of information re-exposure based on individual decay rates"

  parts:
    - name: "decay-rate estimator"
      role: "measures individual knowledge degradation per concept"
    - name: "schedule optimizer"
      role: "computes optimal re-exposure intervals"
    - name: "content delivery mechanism"
      role: "presents appropriate material at computed time"

  phenomenon:
    observable: "Review intervals lengthen as retention strengthens"
    pattern: "Exponentially increasing gaps between reviews for mastered material"

  input:
    energy: "Learner time and attention per review session"
    information: "Performance data from each review attempt"
    material: "Structured knowledge content with assessable components"

  real_effect:
    principle: "Ebbinghaus forgetting curve - memory strength follows exponential decay, counteracted by timed retrieval practice"
    why_it_works: "Each successful retrieval strengthens the memory trace, shifting the decay curve"

  effect:
    intended_outcome: "Sustained knowledge mastery with minimal total study time"
    beneficiary: "Learner seeking long-term retention"

  functional_keywords:
    - "regulate"
    - "decay-counteraction"
    - "adaptive-timing"
    - "retention-optimization"

  triz_parameters:
    improving: "Duration of action of moving object"
    worsening: "Loss of energy"
```

**Analogy discovery:** This SAPPhIRE encoding matches systems in agriculture (drip irrigation timing), medicine (drug dosing schedules), and infrastructure maintenance (predictive maintenance intervals) -- all regulate timing of intervention to counteract a decay process.

---

### Example 2: Supply Chain Transparency (Logistics Domain)

**Original artifact:** "Blockchain-based provenance tracking for coffee from farm to cup. Each handler scans and records, creating immutable chain of custody. Reduces fraud claims by 85%."

```yaml
sapphire_encoding:
  artifact_id: "solution-design/blockchain-provenance"
  domain: "supply-chain-logistics"

  state_change:
    before: "Chain of custody has unverifiable gaps between handlers"
    after: "Complete, tamper-evident record of every custody transfer"
    delta: "Trust gap eliminated through distributed verification"

  action:
    verb: "connect"
    description: "System connects sequential custody events into a tamper-evident chain"

  parts:
    - name: "distributed ledger"
      role: "stores immutable sequence of custody records"
    - name: "identity verifier"
      role: "authenticates each handler at transfer point"
    - name: "event recorder"
      role: "captures transfer metadata at each handoff"

  phenomenon:
    observable: "Monotonically growing chain of signed transfer events"
    pattern: "Each new event references the previous, forming directed acyclic graph"

  input:
    energy: "Handler effort to scan/record at each transfer"
    information: "Identity credentials, location, timestamp, condition metadata"
    material: "Physical good being tracked"

  real_effect:
    principle: "Hash chain integrity - each record cryptographically references its predecessor, making retrospective alteration computationally infeasible"
    why_it_works: "Tamper detection is automatic because any modification breaks the hash chain"

  effect:
    intended_outcome: "Trustworthy provenance without requiring trust in any single party"
    beneficiary: "End consumer and brand owner seeking authenticity assurance"

  functional_keywords:
    - "connect"
    - "tamper-evident-chain"
    - "distributed-verification"
    - "custody-tracking"

  triz_parameters:
    improving: "Reliability"
    worsening: "Device complexity"
```

**Analogy discovery:** This matches DNA chain of evidence in forensics, academic citation chains (each paper references predecessors), and version control systems (Git commits form hash chains). The structural isomorphism is the tamper-evident linked sequence.

---

### Example 3: Cancer Drug Delivery (Biomedical Domain)

**Original artifact:** "Nanoparticle drug carriers with pH-sensitive coating. Coating remains stable in normal blood pH (7.4) but dissolves in tumor microenvironment (pH 6.5-6.8), releasing drug payload only at target site."

```yaml
sapphire_encoding:
  artifact_id: "solution-design/ph-sensitive-nanocarrier"
  domain: "biomedical-drug-delivery"

  state_change:
    before: "Therapeutic agent distributed systemically causing off-target effects"
    after: "Therapeutic agent concentrated at target site with minimal off-target exposure"
    delta: "Spatial specificity of delivery achieved through environmental sensing"

  action:
    verb: "filter"
    description: "System filters delivery location based on environmental condition at destination"

  parts:
    - name: "payload container"
      role: "carries therapeutic agent in protected state"
    - name: "environment-sensitive barrier"
      role: "remains intact in normal conditions, degrades in target conditions"
    - name: "targeting ligand"
      role: "guides carrier toward target tissue"

  phenomenon:
    observable: "Barrier integrity changes as environmental parameter crosses threshold"
    pattern: "Binary switch: stable above threshold, degrades below threshold"

  input:
    energy: "Chemical energy of pH-driven dissolution"
    information: "Environmental pH as binary location signal"
    material: "Carrier material consumed during dissolution"

  real_effect:
    principle: "pH-dependent solubility - protonation state of polymer changes with pH, altering hydrophilicity and structural integrity"
    why_it_works: "The environmental difference between target and non-target creates a natural binary classifier"

  effect:
    intended_outcome: "Maximum therapeutic effect with minimum side effects"
    beneficiary: "Patient receiving targeted therapy"

  functional_keywords:
    - "filter"
    - "environment-triggered-release"
    - "binary-threshold"
    - "targeted-delivery"

  triz_parameters:
    improving: "Harmful side effects"
    worsening: "Device complexity"
```

**Analogy discovery:** This matches smart contracts (execute only when conditions are met), geofenced notifications (trigger only in specific locations), and adaptive building materials (change properties based on temperature). The structural isomorphism is environment-triggered state change with binary threshold.

---

## How to Use in MindrianOS

### During /mos:find-analogies (Stage 1: DECOMPOSE)

1. Larry reads room artifacts across all sections
2. For each significant artifact, Larry extracts a SAPPhIRE encoding using this template
3. The functional_keywords become search terms for Stage 2 (ABSTRACT)
4. The triz_parameters feed the TRIZ contradiction matrix lookup

### During Pipeline Stage 2 (ABSTRACT)

1. Strip all domain-specific language from the SAPPhIRE encoding
2. Map to TRIZ parameter space using triz_parameters
3. Generate functional search queries: "What else [action verb]s to achieve [effect] by exploiting [real_effect]?"

### During Pipeline Stage 3 (SEARCH)

1. Use functional_keywords for Brain semantic search
2. Use action verb + real_effect for cross-domain pattern matching
3. SAPPhIRE encodings from different domains are compared layer-by-layer
4. Layer correspondence feeds the band table under "Scoring Structural Fitness" (not a simple proportion of layers)

### Scoring Structural Fitness

Compare two SAPPhIRE encodings layer by layer. A layer "corresponds" when both sides are non-empty and the embedding cosine of the two layer strings clears the layer threshold. The set of corresponding layers picks the band:

| Match Level | Layers corresponding | Score range |
|-------------|----------------------|-------------|
| None | State change does not correspond | 0.0 |
| Surface | State change, but not the behavioral set | 0.1-0.2 |
| Behavioral | State change + Action + Phenomenon | 0.3-0.5 |
| Structural | State change + Action + Phenomenon + Real effect | 0.6-0.8 |
| Deep | All 7 layers | 0.8-1.0 |

The score sits inside the band range, scaled by the mean cosine of the corresponding layers. The ranges leave gaps (0.2-0.3, 0.5-0.6) on purpose so bands are never confused, and Structural tops out at 0.8 only when every corresponding cosine is 1.0, which is the same value Deep starts at; ordering therefore uses the band first, then the score. Parts and Input are required only for Deep.

**Layer threshold.** The 2025 engine used one fixed cosine (0.5) for every layer. Cosines are encoder-specific, so the 2026 runner (`score`, default `--rank-mode percentile`) derives a threshold per layer from the candidate set itself: the 75th percentile of that layer's cosines, clamped to 0.3-0.9, with the fixed 0.5 used when fewer than 5 candidates are scored. `--rank-mode fixed` reproduces the 2025 behaviour. Report which mode ran.

**Restatement.** A candidate whose text reads almost identically (high text cosine) but whose band is None, Surface or Behavioral is flagged as a restatement and is never placed at Rank 1 while a non-restatement exists. In percentile mode "high" means at or above the 90th percentile of the run's text cosines and at least 0.5.

High structural fitness with different domains = far analogy = candidate for high innovation potential. A score is a triage signal for what to read and test first; it does not show that the mechanism transfers.

---

## Reference

Chakrabarti, A., Sarkar, P., Leelavathamma, B., & Nataraju, B.S. (2005). A functional representation for aiding biomimetic and artificial inspiration of new ideas. *Artificial Intelligence for Engineering Design, Analysis and Manufacturing*, 19(2), 113-132.

Srinivasan, V., & Chakrabarti, A. (2010). Investigating novelty-outcome relationships in engineering design. *Artificial Intelligence for Engineering Design, Analysis and Manufacturing*, 24(2), 161-178.

Gentner, D. (1983). Structure-mapping: A theoretical framework for analogy. *Cognitive Science*, 7(2), 155-170.
