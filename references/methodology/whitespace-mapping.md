# Whitespace Mapping -- Framework Reference

*Loaded on demand by `/mos:whitespace`*

## Framework Overview

Whitespace mapping identifies **where understanding is absent** -- the gaps between what you know, what your domain knows, and what exists but hasn't been connected. Unlike other frameworks that analyze what IS in the room, whitespace mapping analyzes what ISN'T.

The operating principle: **Novelty lives in the empty spaces.** The most valuable insights are not better versions of existing knowledge -- they are connections, claims, and opportunities that occupy regions nobody has explored. Whitespace is the intellectual territory between known positions where genuine discovery happens.

### Three Types of Whitespace

| Type | Strategy Name | What's Missing | Where to Look |
|------|--------------|---------------|---------------|
| **Demand Whitespace** | Blue ocean / unmet need | Customer job nobody serves | Between existing market segments |
| **Knowledge Whitespace** | Blind spot / unknown unknown | Understanding gap nobody notices | Between room sections with no cross-references |
| **Causal Whitespace** | Missing mechanism / untested assumption | Causal chain nobody has traced | Between cause-effect claims that should connect but don't |

### Theoretical Grounding

| Source | Contribution |
|--------|-------------|
| Kim & Mauborgne (2005) Blue Ocean Strategy | Whitespace as uncontested market space |
| Hughes (1983) Reverse Salients | Whitespace as lagging component in expanding system |
| Simon (1962) Near-Decomposability | Whitespace as weak interactions between subsystems nobody examines |
| He et al. (2025) SemNovel | Whitespace as low-density regions in semantic embedding space -- distance from consensus predicts genuine novelty (identified Nobel Prize papers, p < 0.001) |
| Mikolov et al. (2013) word2vec | Whitespace as vector arithmetic gaps -- "king - man + woman = queen" reveals relationships occupying previously empty semantic positions |
| Goodfellow et al. (2014) GANs | Whitespace as generatable latent space -- low-density regions in learned spaces contain meaningful, novel outputs |
| Higgins et al. (2017) β-VAE | Whitespace as unused disentangled factors -- dimensions the model learned but nobody explored |

### The SemNovel Connection

He, Peng et al. (2025) proved that **distance from consensus in embedding space predicts genuine novelty**:

- Project all existing knowledge (publications, artifacts, claims) into a semantic universe using LLM embeddings
- Compute a novelty score for each item based on distance from prior knowledge
- **Result: SemNovel score positively correlates with future research impact (ρ = 0.1782, p < 0.001) and successfully identifies Nobel Prize-winning studies (p < 0.001)**

This transforms whitespace mapping from a qualitative brainstorming exercise into a **quantitative novelty detection system**. The math IS the strategy.

---

## The Voice (This Methodology)

Larry in explorer mode. The voice of someone who sees what's NOT on the map.

Signature phrases:
- "Everyone is fighting over the same territory. I'm looking at the land between the territories."
- "You've mapped 8 sections of your venture. What lives in the space BETWEEN them?"
- "The most valuable real estate in innovation is the space nobody's built on yet."
- "Your competitors are optimizing inside the box. The whitespace is outside it."
- "The gap between what you know structurally and what you know semantically -- THAT is where the opportunity hides."
- "If I embed everything in this room into a map, the dense clusters are where you're confident. The empty spaces are where the discoveries are."

Anti-patterns to catch:
- Treating whitespace as simply "what we haven't done yet" (that's a to-do list, not whitespace)
- Identifying gaps that are empty for good reason (no demand, physically impossible)
- Confusing whitespace with ignorance -- whitespace is STRUCTURALLY IMPLIED missing knowledge
- Listing gaps without scoring them for opportunity value

---

## Phases

### Phase 1: Map the Known Territory (turns 1-2)

Before finding whitespace, map what IS present. Larry surveys the room:

1. **Read STATE.md** -- which sections are populated, which are thin?
2. **Read graph edges** -- which sections cross-reference each other? Which DON'T?
3. **Read causal claims** -- which cause-effect chains are articulated? Which domains have no causal claims?
4. **Read HSI connections** -- which artifacts are surprisingly connected? Which sections have NO HSI connections?

Display the territory map:

```
[TERRITORY] Known Knowledge Map

  DENSE (well-understood):
    problem-definition ████████ 12 artifacts, 8 cross-refs
    market-analysis    ██████   9 artifacts, 6 cross-refs

  SPARSE (surface-level):
    financial-model    ██       3 artifacts, 1 cross-ref
    team-execution     █        1 artifact, 0 cross-refs

  CROSS-SECTION CONNECTIONS:
    problem ↔ market: 4 edges (strong)
    market ↔ solution: 2 edges (moderate)
    solution ↔ financial: 0 edges ← WHITESPACE
    team ↔ anything: 0 edges ← WHITESPACE
```

### Phase 2: Identify Structural Whitespace (turns 2-4)

Three detection methods, from cheapest to most powerful:

**Method A: Cross-Section Gap Detection (Tier 0, always available)**

Look for section pairs with NO cross-references. In a well-connected venture, every section should inform at least 2 others. Missing connections are structural whitespace.

```
EXPECTED connections (Simon's near-decomposable hierarchy):
  problem-definition ↔ market-analysis (problem shapes market search)
  market-analysis ↔ financial-model (market size shapes revenue)
  solution-design ↔ competitive-analysis (solution differentiates)
  team-execution ↔ solution-design (team capability constrains solution)

MISSING connections = WHITESPACE:
  [List section pairs with expected but absent cross-references]
```

**Method B: Causal Chain Gap Detection (Tier 0+, requires causal layer)**

Look for causal chains that START but don't COMPLETE. If the room has "market trend → adoption increase" and "adoption increase → revenue growth" but NOT "revenue growth → [anything]" -- that's causal whitespace. The chain implies a downstream effect that nobody has articulated.

```cypher
-- Find causal claims with no downstream CAUSES edge
MATCH (c:CausalClaim)
WHERE NOT (c)-[:CAUSES]->(:CausalClaim)
AND c.confidence > 0.4
RETURN c.cause, c.effect, c.domain
```

**Method C: Embedding Density Detection (Tier 1+, requires MiniLM embeddings)**

Embed all room artifacts. Compute density map. Low-density regions between high-density clusters are embedding whitespace -- places where the semantic space suggests knowledge SHOULD exist but doesn't.

```
HIGH-DENSITY CLUSTERS:         LOW-DENSITY GAPS:
  ● problem understanding        ○ problem → solution bridge
  ● market sizing                ○ market → team capability link
  ● competitive landscape        ○ competitive → financial model
                                 ○ [any region where topology
                                    implies content should exist]
```

### Phase 3: Score the Whitespace (turns 4-6)

Not all whitespace is valuable. Score each gap on 4 dimensions:

| Dimension | Question | Score |
|-----------|----------|-------|
| **Structural Implication** | Does the room's topology predict something should be here? | 0-1 |
| **Causal Consequence** | If this gap remains, what downstream claims are unsupported? | 0-1 (cascade severity) |
| **Domain Relevance** | Is this gap in a domain critical to the venture's stage? | 0-1 |
| **Consensus Distance** | How far from domain consensus is this gap? (SemNovel-inspired) | 0-1 (farther = more novel if filled) |

**Whitespace Opportunity Score = Structural × 0.30 + Causal × 0.30 + Relevance × 0.20 + Distance × 0.20**

Display ranked:

```
[WHITESPACE] Ranked Opportunities

  #1 (0.82): solution-design ↔ financial-model bridge
     Why: 4 causal claims in solution terminate without financial consequence
     If filled: Unlocks unit economics validation (3 downstream claims)
     Novelty: HIGH -- no existing artifact addresses this bridge

  #2 (0.71): competitive-analysis → team-execution link
     Why: Competitive moat depends on team capability, but no artifact connects them
     If filled: Validates whether team CAN execute the differentiation strategy
     Novelty: MEDIUM -- standard connection but missing in this room

  #3 (0.65): market-analysis internal gap
     Why: B2B and B2C market segments analyzed separately, no comparison
     If filled: Resolves the pricing contradiction (RS-0003)
     Novelty: LOW -- obvious gap, but blocking downstream decisions
```

### Phase 4: Generate Whitespace Hypotheses (turns 6-8)

For the top 3 whitespace opportunities, Larry generates **hypotheses about what should fill the gap**. This is the novel content generation step.

For each gap:

1. **Read the artifacts on both sides** of the whitespace
2. **Trace causal chains** that approach the gap from each side
3. **Generate 1-2 hypotheses** about what claim or insight would bridge the gap
4. **Score each hypothesis** for novelty (SemNovel-style: distance from existing claims)
5. **Generate a falsifiable prediction** for each hypothesis

```
HYPOTHESIS for whitespace #1 (solution ↔ financial bridge):

  "If the gradient architecture reduces etch chamber replacement cycles from
   quarterly to annual (solution claim), then maintenance cost per wafer
   drops by ~$0.12 (financial implication), making the total cost of ownership
   competitive at volumes above 50K wafers/year."

  Novelty: 0.74 (this specific unit economics chain is not in any room artifact)
  Prediction: "Interview 3 fab procurement leads. If 2+ confirm replacement
              cycle matters more than unit price, this hypothesis holds."
  Next step: /mos:validate or /mos:research to test this
```

### Phase 5: Act on the Whitespace (turn 8+)

For each scored whitespace opportunity, recommend the specific MindrianOS command that fills it:

| Whitespace Type | Recommended Command | Why |
|----------------|--------------------|----|
| Cross-section gap | `/mos:act [framework] --section [target]` | Fill the missing section content |
| Causal chain gap | `/mos:causal chain [endpoint]` | Trace and extend the incomplete chain |
| Assumption gap | `/mos:challenge-assumptions` | Stress-test assumptions around the gap |
| Analogy gap | `/mos:find-analogies` | Find cross-domain solutions for the gap |
| Knowledge gap | `/mos:research [topic]` | External research to fill the knowledge hole |
| Contradiction gap | `/mos:causal contradict` | Resolve competing explanations |

---

## Tier System

| Tier | Capability | Dependencies |
|------|-----------|-------------|
| **Tier 0** | Cross-section gap detection + causal chain gaps + qualitative scoring | KuzuDB (local graph) |
| **Tier 1** | + Embedding density detection + SemNovel-style novelty scoring | MiniLM embeddings (HSI pipeline) |
| **Tier 2** | + Brain consensus baseline + cross-venture whitespace patterns | Brain MCP (Neo4j) |

Graceful degradation: Tier 0 always works. Higher tiers add quantitative precision but never gate the analysis.

---

## Connection to Other Pipelines

| Pipeline | How Whitespace Uses It | How It Uses Whitespace |
|----------|----------------------|----------------------|
| **HSI** | Reads embedding similarity matrix + spectral profiles for density detection | HSI pairs in whitespace regions get higher novelty scores |
| **Causal** | Reads causal chains to find incomplete chains (causal whitespace) | New causal claims generated to fill whitespace gaps |
| **Reverse Salient** | RS bottlenecks ARE one type of whitespace (blocked progress) | Whitespace scoring prioritizes RS-identified bottlenecks |
| **Analogy** | Cross-domain analogies found in whitespace regions are highest-value | Whitespace gaps seed analogy search queries |
| **Reasoning** | REASONING.md `requires` fields identify expected but missing dependencies | Whitespace-filling artifacts update reasoning frontmatter |

---

## Brain Enhancement (Optional)

If Brain is connected:

1. Run `brain_causal_framework_select` (Pattern 11) with whitespace domain to get calibrated frameworks for gap-filling
2. Run `brain_causal_pattern_match` (Pattern 12) to find what whitespace gaps were common in similar ventures
3. Use Brain's 21K+ nodes as the **consensus baseline** for SemNovel-style novelty scoring -- distance from Brain centroid = novelty of the gap-filling hypothesis

Brain transforms whitespace mapping from "what's missing in THIS room" to "what's missing in THIS room that successful ventures DID have."

---

## Output Format

Each whitespace opportunity produces:

```yaml
whitespace_id: WS-001
type: cross-section | causal-chain | embedding-gap | assumption-gap
sections: [solution-design, financial-model]
score: 0.82
structural_implication: 0.9
causal_consequence: 0.8
domain_relevance: 0.7
consensus_distance: 0.8
hypothesis: "Gradient architecture reduces replacement cycles..."
novelty_score: 0.74
falsifiable_prediction: "Interview 3 fab procurement leads..."
recommended_command: /mos:validate
cascade_if_unfilled: [causal-0003, causal-0007, causal-0012]
```

---

## Academic References

- He, Peng et al. (2025) "SemNovel -- A new approach to detecting semantic novelty of biomedical publications using embeddings of LLMs." J Biomed Inform. PMID: 41242670.
- Chang, He et al. (2025) "TopicForest: embedding-driven hierarchical clustering and labeling for biomedical literature." J Biomed Inform. PMID: 41242669.
- He et al. (2026) "MedViz: An Agent-based, Visual-guided Research Assistant for Navigating Biomedical Literature." arXiv:2601.20709.
- Kim & Mauborgne (2005) Blue Ocean Strategy. Harvard Business Review Press.
- Hughes (1983) Networks of Power. Johns Hopkins University Press.
- Simon (1962) "The Architecture of Complexity." Proc. APS.
- Mikolov et al. (2013) "Efficient estimation of word representations in vector space." arXiv:1301.3781.

---

*MindrianOS Whitespace Mapping v1.7.0*
*Novelty lives in the empty spaces.*
