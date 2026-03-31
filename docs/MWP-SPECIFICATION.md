# Mindrian Workspace Protocol (MWP) - Formal Specification

**Version:** 1.0
**Date:** 2026-03-31
**Status:** Active
**Authors:** Jonathan Sagir, Prof. Lawrence Aronhime (methodology calibration)

---

## Abstract

The Mindrian Workspace Protocol (MWP) is a 7-layer folder-as-architecture system for managing ventures as wicked problems inside AI coding environments. MWP synthesizes Herbert Simon's near-decomposable hierarchies (1962), Rittel and Webber's wicked problem theory (1973), Van Clief and McDermott's Interpretable Context Methodology (2026), Minto's Pyramid Principle (1987), Hughes' reverse salient theory (1983), and Ashby's Law of Requisite Variety (1956) into a unified protocol that treats the folder structure as both the data model and the orchestration engine.

MWP is the formal name for MindrianOS's integrated architecture. It specifies how folders, artifacts, edges, pipelines, reasoning structures, innovation discovery, and knowledge enrichment compose into a system where each layer amplifies every other layer. The protocol's moat is not any individual layer but the integration of all seven operating simultaneously on every user action.

---

## 1. Design Principles

### 1.1 Folder Structure IS the Code

Following ICM (Van Clief & McDermott 2026, arxiv 2603.16021), MWP treats the folder hierarchy as the orchestration layer. There is no multi-agent framework code. The folder structure determines routing, context, and agent behavior. "Configure the factory, not the product" - Layer 3 (reference/factory) is IP, Layer 4 (working artifacts) is user's work.

### 1.2 Near-Decomposable Hierarchy

Following Simon (1962), the venture is organized as a hierarchy of near-decomposable subsystems. Room sections have strong internal cohesion and weak external coupling. Innovation concentrates at boundaries between subsystems - the cross-section edges where INFORMS, CONTRADICTS, and CONVERGES relationships reveal hidden connections.

### 1.3 Wicked Problem Management

Following Rittel and Webber (1973), every venture exhibits all 10 characteristics of wicked problems: no definitive formulation, no stopping rule, solutions are not true-or-false, no ultimate test, every trial counts, no enumerable set of solutions, every problem is essentially unique, every problem is a symptom of another problem, discrepancies can be explained numerous ways, and the planner has no right to be wrong. MWP manages wickedness through structured decomposition and continuous edge detection.

### 1.4 Requisite Variety

Following Ashby (1956), the tools must match the system's complexity. MWP provides 26 methodology commands, 9 edge types, 7 layers, and a teaching graph calibrated from 100+ real projects. This variety matches the complexity of venture innovation as a wicked problem.

### 1.5 Core Job

Following Christensen and Ulwick (JTBD), MWP's core job is: "Reduce the time between insight and validated decision across every dimension of the venture simultaneously." Every feature is evaluated against this job. If it does not compress time-to-decision, it does not belong.

---

## 2. The Seven MWP Layers

### Layer 1: Folder Hierarchy

**Purpose:** Decompose the venture into near-independent subsystems aligned to due diligence standards.

**Structure:**

```
room/
  problem-definition/      # Core problem formulation
  market-analysis/          # Market size, trends, segments
  solution-design/          # Technology and architecture
  business-model/           # Revenue, unit economics, GTM
  competitive-analysis/     # Competition and positioning
  team-execution/           # Team, advisors, execution plan
  legal-ip/                 # Legal structure, IP protection
  financial-model/          # Projections and metrics
  team/                     # People layer (members/, mentors/, advisors/)
  meetings/                 # Conversation layer (YYYY-MM-DD-*/)
  personas/                 # De Bono hat perspectives
  opportunity-bank/         # Discovered opportunities
  funding/                  # Grant and funding pipeline
  assets/                   # Binary files (PDFs, images, videos)
  .context/                 # Session memory (KAIROS-compatible)
  .reasoning/               # MINTO reasoning per section
  .lazygraph/               # KuzuDB graph database
  .config.json              # Room configuration
  STATE.md                  # Computed state (filesystem truth)
  USER.md                   # User context and preferences
```

**Invariants:**
- The 8 base sections (problem-definition through financial-model) are created at room initialization
- Extended sections (team, meetings, personas, opportunity-bank, funding) grow organically on demand
- STATE.md is always computed from filesystem truth, never written directly
- Every section has a ROOM.md file declaring purpose, stage relevance, and default methodologies

**ICM Mapping:**
- ICM Layer 0 (Identity) = venture's current problem formulation
- ICM Layer 1 (Routing) = problem type x wickedness determines agent/skill response
- ICM Layer 2 (Contracts) = pipeline stage contracts encode cascade rules
- ICM Layer 3 (Reference) = Brain graph + methodology references + assumption registry
- ICM Layer 4 (Artifacts) = room entries as claims with validity status and cross-references

### Layer 2: Artifact Provenance

**Purpose:** Every artifact carries metadata enabling resumption, audit, cascade detection, and command reprising.

**YAML Frontmatter Schema:**

```yaml
---
methodology: structure-argument    # Command that generated this artifact
date: 2026-03-31                   # Creation date
depth: deep                        # shallow | medium | deep
problem_type: market-validation    # Classified problem type
venture_stage: Discovery           # Pre-Opportunity | Discovery | Validation | Design | Investment
room_section: market-analysis      # Target section
pipeline: minto                    # Pipeline name (if part of pipeline run)
pipeline_stage: synthesis          # Stage within pipeline
source: methodology-session        # methodology-session | meeting-filing | manual | import
artifact_id: ART-20260331-001      # Unique artifact identifier (stamped by cascade)
---
```

**Invariants:**
- Every artifact filed through the cascade receives an artifact_id
- The `methodology` field enables reprising (re-running the same framework on the same section)
- The `source` field distinguishes human-authored vs. system-generated content
- Provenance is immutable after filing; updates create new artifacts

### Layer 3: The Cascade Pipeline

**Purpose:** Automate the intelligence nervous system - every filing triggers an 8-step pipeline.

**The 8 Steps:**

| Step | Model | Action | Output |
|------|-------|--------|--------|
| 1. Classify | haiku | Determine artifact type, problem type, and target section | Classification metadata in frontmatter |
| 2. Stamp ID | none | Assign unique artifact_id (ART-YYYYMMDD-NNN) | artifact_id field in frontmatter |
| 3. KuzuDB Index | haiku | Create Artifact node, detect and create edges (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES) | KuzuDB nodes and edges |
| 4. Refresh STATE | none | Recompute room state from filesystem truth | Updated STATE.md |
| 5. Map Graph | none | Rebuild graph visualization data from KuzuDB | Updated graph JSON |
| 6. Discover HSI | sonnet | Run HSI innovation discovery (TF-IDF/SVD + embeddings + spectral OM-HMM) | .hsi-results.json, HSI_CONNECTION and REVERSE_SALIENT edges |
| 7. Version | none | Git commit if room has version control enabled | Git commit hash |
| 8. Publish | none | Update presentation views (dashboard, wiki, deck) if export configured | Updated HTML exports |

**Model Assignment:**
- haiku: classify (fast, cheap, routing decisions)
- sonnet: detect-edges, proactive-analysis (reasoning required)
- none/null: compute-state, stamp-id, map-graph, version, publish (pure computation)

**Invariants:**
- Steps execute sequentially; failure at any step logs but does not block subsequent steps
- The cascade runs on every artifact filing regardless of source (methodology, meeting, manual)
- KuzuDB index changed from background to synchronous so build-graph sees fresh data
- Post-write hook has a 3-second budget; git commit runs in background after classify

### Layer 4: MINTO Reasoning Per Section

**Purpose:** Apply Minto's Pyramid Principle as a reasoning dependency graph across room sections.

**Structure:**

```
room/.reasoning/{section}/REASONING.md
```

**REASONING.md Schema:**

```yaml
---
section: problem-definition
governing_thought: "The core problem is X because Y"
confidence:
  high: [claim-1, claim-2]
  medium: [claim-3]
  low: [claim-4]
requires:
  - section: market-analysis
    claim: "Market size validates problem scale"
provides:
  - section: solution-design
    insight: "Problem constraints define solution space"
affects:
  - section: business-model
    impact: "Problem urgency drives pricing model"
verification:
  must_be_true:
    - statement: "Target users experience this problem weekly"
      status: unverified
    - statement: "No existing solution addresses root cause"
      status: confirmed
---

# Governing Thought

{The single sentence that summarizes this section's conclusion}

## Argument 1: {MECE category}

{Supporting evidence and reasoning}

## Argument 2: {MECE category}

{Supporting evidence and reasoning}

## Argument 3: {MECE category}

{Supporting evidence and reasoning}
```

**KuzuDB Integration:**
- REASONING_INFORMS edges connect sections based on requires/provides/affects declarations
- Creates a reasoning dependency graph queryable via KuzuDB
- Staleness detection: when an artifact changes a section's evidence base, REASONING.md is flagged for review

**Invariants:**
- Governing thought must be a single sentence
- Arguments must be MECE (Mutually Exclusive, Collectively Exhaustive)
- Confidence levels must reference specific claims from the section
- Verification statements have three statuses: unverified, confirmed, invalidated

### Layer 5: HSI Innovation Discovery

**Purpose:** Find hidden connections between artifacts that humans miss - the "weak interactions between subsystems" that Simon identified as the source of innovation.

**Three-Tier Architecture:**

| Tier | Dependencies | Method |
|------|-------------|--------|
| Tier 0 | None | Keyword co-occurrence, simple heuristics |
| Tier 1 | Python (numpy, scikit-learn) | TF-IDF/SVD + MiniLM sentence embeddings + spectral OM-HMM |
| Tier 2 | Pinecone | All of Tier 1 + cross-room semantic search via Pinecone embeddings |

**Innovation Differential Formula:**

```
differential = 0.6 * semantic_surprise + 0.4 * integrative_factor
```

Where:
- `semantic_surprise` = 1.0 - cosine_similarity (high surprise = dissimilar artifacts that connect)
- `integrative_factor` = spectral OM-HMM score measuring thinking-mode diversity

**Breakthrough Potential Formula:**

```
breakthrough = 0.7 * differential + 0.3 * min(lsa_sim, semantic_sim)
```

Where the minimum similarity ensures both text-level and semantic-level connection exist.

**Spectral OM-HMM (v1.6.0):**

Based on Seabrook and Wiskott (2022, arxiv 2207.02296), each artifact's text is classified into 5 thinking modes:
- **Analytical:** examining, measuring, comparing
- **Integrative:** connecting, combining, synthesizing
- **Descriptive:** stating, defining, listing
- **Evaluative:** judging, assessing, critiquing
- **Creative:** imagining, proposing, speculating

The mode sequence forms a Markov chain. Eigenvalue decomposition of the transition matrix yields the spectral gap (1 - |lambda_2|). Larger spectral gap = faster mixing = more diverse thinking mode transitions.

**Four-Component OM-HMM Score:**
- Spectral gap (40%): Fast mixing across thinking modes
- Integrative weight (25%): Stationary distribution weight on integrative mode
- Mode diversity (20%): Shannon entropy of stationary distribution
- Anti-absorption (15%): Penalty for getting stuck in single modes

**Output:** `.hsi-results.json` with per-artifact spectral profiles. Results feed KuzuDB as:
- HSI_CONNECTION edges (hsi_score, lsa_sim, semantic_sim, surprise_type, breakthrough_potential, spectral_gap_avg, dominant_modes)
- REVERSE_SALIENT edges (differential_score, innovation_type, innovation_thesis, spectral metadata)

### Layer 6: Proactive Intelligence Loop

**Purpose:** Every change triggers a scan for cross-section relationships. The loop learns from every user decision.

**5 Edge Detection Types:**

| Type | Detection Method | Meaning |
|------|-----------------|---------|
| INFORMS | Wikilink [[reference]] between artifacts | Artifact references another section |
| CONTRADICTS | Contradiction terms near wikilinks; proximity analysis | Artifact conflicts with existing claim |
| CONVERGES | Theme appears in 3+ artifacts across sections | Cross-section convergence signal |
| ENABLES | Explicit frontmatter declaration | Artifact unblocks something in another section |
| INVALIDATES | Explicit frontmatter declaration | Artifact makes existing assumption stale |

**User Decision Loop:**

```
Artifact filed
  -> Cross-relationship scan
  -> New edges found
  -> Larry surfaces: "This changes your financial model assumption"
  -> User: APPROVE (cascade update) / REJECT (reason captured) / DEFER (postpone)
  -> Decision becomes graph data
  -> Next scan is smarter
```

**Persistence:**
- Signals stored in `.proactive-intelligence.json`
- Repeat suppression threshold: 3 showings before signal is muted
- User decisions (APPROVE/REJECT/DEFER) are persisted and inform future edge detection
- Rejection reasons become graph nodes (Key Decision #13: "Rejection is data")

**Invariants:**
- The loop runs after every artifact filing regardless of source
- Signals are never automatically acted upon - user always decides
- DEFER does not suppress; only APPROVE or REJECT resolve a signal
- Repeat suppression prevents alert fatigue without losing information

### Layer 7: Brain Enrichment

**Purpose:** Remote Neo4j knowledge graph with 21K+ nodes and 65K+ relationships providing teaching intelligence. Never required. Always amplifying.

**The Teaching Graph:**
- Framework-to-framework chaining rules
- Framework-to-problem-type mappings
- Phase progressions per framework
- CO_OCCURS and ADDRESSES_PROBLEM_TYPE relationships
- Cross-domain connection patterns
- 59 books + 59 tools + 1,427 Pinecone embeddings

**8 Named Query Patterns:**

| Pattern | Purpose | Use Case |
|---------|---------|----------|
| framework_chain | Find framework sequences for a problem type | /mos:act selects next framework |
| cross_domain | Find frameworks from different domains that address similar patterns | Cross-pollination discovery |
| find_patterns | Identify recurring patterns in the graph | Meta-analysis of methodology effectiveness |
| concept_connect | Connect two concepts through the graph | Bridge-building between sections |
| contradiction_check | Verify if a claim contradicts known patterns | CONTRADICTS edge validation |
| gap_assess | Assess completeness of a section against the full framework | Grading intelligence |
| search_semantic | Semantic search via Pinecone embeddings | Natural language queries against the Brain |
| analogy_search | Cross-domain structural isomorphism search | Design-by-Analogy pipeline |

**Grading Intelligence:**
- Calibrated from 100+ real student projects (Prof. Lawrence Aronhime, 30 years)
- Component weights, grade distributions, feedback patterns
- Vision-to-Execution Gap detection
- Framework mastery tracking across revisions

**Mode Engine Calibration:**
- 40:30:20:10 distribution (conceptual:storytelling:problem-solving:assessment)
- Voice modulation patterns mapped to mode shifts
- Context-aware variations by audience and content type

**Invariants:**
- Brain is NEVER required; Tier 0 works without any external dependency
- Brain data is never distributed; users get intelligence, not data
- Every Brain query has a local fallback (local scoring when Brain unavailable)
- Brain API keys are managed through Supabase with approve/revoke/extend lifecycle

---

## 3. The 9 KuzuDB Edge Types

KuzuDB serves as the local graph backbone for every room. Edges are the primary carriers of intelligence - the "weak interactions between subsystems" that Simon identified.

| # | Edge Type | Source | Target | Properties | Created By |
|---|-----------|--------|--------|------------|------------|
| 1 | INFORMS | Artifact | Artifact | via (wikilink text) | Cascade Step 3 |
| 2 | CONTRADICTS | Artifact | Artifact | contradiction_terms, proximity_score | Cascade Step 3 |
| 3 | CONVERGES | Artifact | Artifact | theme, section_count, confidence | Cascade Step 3 |
| 4 | ENABLES | Artifact | Artifact | condition, declared_by | Frontmatter declaration |
| 5 | INVALIDATES | Artifact | Artifact | reason, declared_by | Frontmatter declaration |
| 6 | BELONGS_TO | Artifact | Section | role (primary, supporting) | Cascade Step 3 |
| 7 | REASONING_INFORMS | Section | Section | claim, insight, impact | REASONING.md parsing |
| 8 | HSI_CONNECTION | Artifact | Artifact | hsi_score, lsa_sim, semantic_sim, surprise_type, breakthrough_potential, spectral_gap_avg, dominant_modes | HSI pipeline (Step 6) |
| 9 | REVERSE_SALIENT | Section | Section | differential_score, innovation_type, innovation_thesis, spectral metadata | HSI pipeline (Step 6) |

**Edge Properties:**

```
INFORMS {
  via: string           // wikilink text that created the reference
}

CONTRADICTS {
  contradiction_terms: string[]   // terms that triggered detection
  proximity_score: float          // how close the contradicting content is
}

CONVERGES {
  theme: string         // the converging theme
  section_count: int    // number of sections where theme appears
  confidence: float     // convergence confidence score
}

ENABLES {
  condition: string     // what condition this artifact enables
  declared_by: string   // artifact that declared the relationship
}

INVALIDATES {
  reason: string        // why the target is invalidated
  declared_by: string   // artifact that declared the relationship
}

BELONGS_TO {
  role: string          // primary | supporting
}

REASONING_INFORMS {
  claim: string         // the reasoning claim connecting sections
  insight: string       // what insight flows between sections
  impact: string        // how the target section is affected
}

HSI_CONNECTION {
  hsi_score: float              // composite innovation score
  lsa_sim: float                // LSA/SVD text similarity
  semantic_sim: float           // embedding-based similarity
  surprise_type: string         // high-surprise | moderate-surprise
  breakthrough_potential: float // combined score
  spectral_gap_avg: float       // average spectral gap of connected artifacts
  dominant_modes: string[]      // most frequent thinking modes
}

REVERSE_SALIENT {
  differential_score: float     // innovation differential
  innovation_type: string       // gap-driven | convergence-driven
  innovation_thesis: string     // natural language description
  spectral_metadata: object     // spectral analysis details
}
```

**Query via KuzuDB:**
- Node types: Artifact, Section, Speaker
- coalesce(a.id, a.name) handles Section/Speaker nodes using name as primary key
- label(r) retrieves edge type (not type(r) - KuzuDB 0.11.3 constraint)
- Open-use-close pattern for all lazygraph wrappers (try/finally ensures DB close)

---

## 4. Resolution Orders

### 4.1 Model Resolution (5-step cascade)

```
1. Per-agent override     (room/.config.json model_overrides.{agent})
2. Venture-stage hint     (STAGE_HINTS[stage][agent])
3. Inherit profile        (model_profile === 'inherit')
4. Profile lookup         (MODEL_PROFILES[agent][profile])
5. Default                ('sonnet')
```

When stage hint returns `null`, the agent is skipped entirely (not appropriate for current venture stage).

### 4.2 Room Resolution (walk-up search)

```
1. Current directory      (check for room/ markers)
2. Parent directory       (walk up looking for STATE.md)
3. Registry lookup        (.rooms/registry.json active room)
4. Fail gracefully        (return empty, never error)
```

### 4.3 State Resolution (filesystem truth)

```
1. Count artifacts per section
2. Parse frontmatter for dates, methodologies, stages
3. Compute section health (grade, staleness, coverage)
4. Aggregate to room-level metrics
5. Write STATE.md as computed output (never edited manually)
```

---

## 5. Token Efficiency Claims

MWP achieves significant token efficiency by decomposing the venture into near-independent subsystems:

| Approach | Tokens per Stage | Context Window Usage |
|----------|-----------------|---------------------|
| Monolithic prompt | 30K-50K | Single massive context with all venture data |
| MWP decomposed | 2K-8K per section | Section-specific context loaded on demand |

**Why this works (Simon's argument):**
- Near-decomposable systems allow each subsystem to be processed independently
- Cross-section interactions (weak interactions) are captured as edges, not inline text
- The cascade pipeline operates on one artifact at a time, not the entire room
- State is computed from filesystem truth, never carried in context
- Brain queries are targeted (single Cypher pattern), not bulk retrievals

**Prompt cache optimization (v1.6.0):**
- Stable sections (personality, methodology references) separated from dynamic room context
- MCP tool ordering arranged for cache stability
- CLAUDE.md modularized with @include for on-demand loading

---

## 6. Research References

1. **Simon, H. A. (1962).** "The Architecture of Complexity." _Proceedings of the American Philosophical Society_, 106(6), 467-482. -- Near-decomposable hierarchies as the universal form of complex systems. The basis theorem for MWP's folder structure.

2. **Rittel, H. W. J., & Webber, M. M. (1973).** "Dilemmas in a General Theory of Planning." _Policy Sciences_, 4(2), 155-169. -- The 10 characteristics of wicked problems. Every venture exhibits all 10. MWP manages wickedness through structured decomposition.

3. **Van Clief, J., & McDermott, D. (2026).** "Interpretable Context Methodology: Folder Structure as Agentic Architecture." _arxiv 2603.16021_. -- ICM proves folder structure replaces multi-agent framework code. MWP is ICM applied to venture innovation.

4. **Minto, B. (1987).** _The Pyramid Principle: Logic in Writing and Thinking_. Pearson. -- MECE reasoning structure. MWP applies per-section REASONING.md with governing thoughts and MECE arguments.

5. **Hughes, T. P. (1983).** _Networks of Power: Electrification in Western Society, 1880-1930_. Johns Hopkins University Press. -- Reverse salient theory: in expanding systems, lagging components create innovation opportunities. MWP's HSI pipeline detects reverse salients across room sections.

6. **Seabrook, E., & Wiskott, L. (2022).** "A Tutorial on the Spectral Theory of Markov Chains." _arxiv 2207.02296_. -- Spectral gap analysis of Markov chains. MWP uses this for thinking-mode transition analysis in the OM-HMM scorer.

7. **Ashby, W. R. (1956).** _An Introduction to Cybernetics_. Chapman & Hall. -- Law of Requisite Variety: a controller must have as much variety as the system it controls. MWP's 26 methodologies + 9 edge types provide requisite variety for wicked problems.

8. **Christensen, C. M. (1997).** _The Innovator's Dilemma_. Harvard Business Review Press. -- Disruption theory. Combined with Ulwick's Jobs-to-Be-Done framework, defines MWP's core job: time compression between insight and validated decision.

9. **Knight, F. H. (1921).** _Risk, Uncertainty and Profit_. Houghton Mifflin. -- Risk (measurable) vs. Uncertainty (unmeasurable). MWP navigates uncertainty through Simon's hierarchical structure rather than trying to measure it.

10. **Tetlock, P. (2015).** _Superforecasting: The Art and Science of Prediction_. Crown. -- Bayesian updating, decomposition, probabilistic triage. MWP's intelligence layer is disciplined belief revision across the hierarchy.

11. **Nonaka, I., & Takeuchi, H. (1995).** _The Knowledge-Creating Company_. Oxford University Press. -- SECI model of knowledge conversion. Meeting filing converts tacit knowledge (conversation) to explicit knowledge (artifacts).

12. **De Bono, E. (1985).** _Six Thinking Hats_. Little, Brown. -- Parallel thinking via perspective lenses. MWP's persona-analyst generates hat-specific perspectives grounded in room artifacts.

13. **Aronhime, L. (1994-2026).** 30 years of classroom teaching at IDC Herzliya / Reichman University. -- Teaching graph calibrated from 100+ real student projects. Grading intelligence, mode engine calibration, framework chaining rules. The Brain's moat.

---

## 7. Conformance

A system conforms to MWP if:

1. It implements all 7 layers operating simultaneously
2. The folder hierarchy decomposes the venture into near-independent subsystems
3. Every artifact carries YAML frontmatter provenance
4. A cascade pipeline runs on every artifact filing
5. MINTO reasoning structures create a dependency graph between sections
6. HSI innovation discovery detects hidden cross-section connections
7. A proactive intelligence loop surfaces signals for user decision
8. Cross-section edges are the primary carriers of intelligence

A system that implements only individual layers (e.g., folder structure without edges, or edges without reasoning) is NOT MWP-conformant. The protocol's value is in the integration, not the parts.

---

_MWP Specification v1.0 - MindrianOS Plugin_
