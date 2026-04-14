---
title: Feynman-MINTO as Taxonomy-Constrained SCN Extraction Engine - Evaluation Protocol
author: Jonathan Sagir
project: MindrianOS
phase: 81 (engine), 84 (application context), v1.11.x (first deployment)
date: 2026-04-14
status: protocol draft, awaiting v1.11.x implementation
type: novel MindrianOS development, not literature review
related:
  - docs/research/2026-04-14-stakeholder-graph-deep-research.md
  - docs/superpowers/specs/2026-04-14-phase-84-smart-notebook-co-pilot-design.md
  - skills/feynman-engine/ (Phase 81 deliverable)
  - lib/memory/aaak-compress.cjs (Phase 81 deliverable)
---

# Feynman-MINTO as Taxonomy-Constrained SCN Extraction Engine

## Evaluation Protocol

**Author**: Jonathan Sagir
**Project**: MindrianOS
**Date**: 2026-04-14
**Status**: Protocol draft. Awaiting v1.11.x implementation and execution on a held-out corpus.

---

## Positioning

This document is a **novel MindrianOS development**, not a literature survey. It specifies an evaluation protocol for the **Feynman-MINTO engine** (shipped in MindrianOS v1.10.2 as the Phase 81 deliverable) when repurposed as a taxonomy-constrained extraction system for **Stakeholder-Centric Networks (SCNs)**. The evaluation protocol below is the formal benchmark by which the engine's SCN-extraction capability will be measured against standard NER baselines, structured relation extraction baselines, and ablations of its own components.

The Feynman-MINTO engine was originally built as a reasoning engine for section-level content in Data Rooms: Feynman first-principles reduction combined with Minto pyramid structuring, shipped as `/mos:mos-reason` and surfaced via `skills/feynman-engine/`. Its repositioning as an **SCN extraction engine** is the novel move recorded here. The mathematical framework, the 3-way ablation design, the four-metric scoring, and the MDL-anchored compression ratio metric are all MindrianOS contributions authored for this evaluation, developed during a brainstorming session on 2026-04-14 in conversation with Claude acting as a thinking partner, with Jonathan Sagir as the author of record for all design decisions.

The engine's first deployment as an SCN extractor will happen in the **v1.11.x Stakeholder Intelligence milestone**, where the full `Stakeholder x Predicate x {Claim, Initiative, Stakeholder}` codomain becomes available. This protocol will run at that point.

---

## 1. Theoretical Foundation

### 1.1 The Feynman-MINTO formalism

The Feynman-MINTO engine is formalized as the joint minimization:

$$
T^* = \arg\min_T \sum_{i=1}^{k} |n_i| + \lambda \cdot \text{struct\_cost}(T)
$$

subject to four constraints:

1. **Feynman comprehensibility floor** (per-node):
$$
\pi(n_i) \geq \theta_{\text{comprehend}} \quad \forall i \in T
$$

2. **MECE on sibling sets** (Mutually Exclusive, Collectively Exhaustive):
$$
I(\text{siblings}(n_i)) \leq \theta_{\text{MECE}} \quad \forall i \in T
$$

3. **Bounded depth**:
$$
\text{depth}(T) \leq d_{\max}
$$

4. **Answer-first root** (maximum posterior surprise relative to naive reader prior `P_0`):
$$
\text{root}(T) = \arg\max_a D_{KL}(P_0 \,\|\, P_0(\cdot \mid a))
$$

The engine's behavior is a fixed-point iteration of two alternating operators:

$$
T_{t+1} = \text{Minto\_decompose}(\text{Feynman\_reduce}(T_t))
$$

Convergence is measured as stable description length: `|T_{t+1}| - |T_t| < epsilon`.

### 1.2 Specialization to SCN extraction

For taxonomy-constrained SCN extraction, the node codomain of `reduce()` is restricted to the product space:

$$
\text{reduce}: \text{sentence} \to \{(s, p, o) \in \mathcal{S} \times \mathcal{P} \times \mathcal{O}\}
$$

where:

- `S` (subject types) = `{person, org, coalition, role}`
- `P` (predicates) = `{INFLUENCES, FUNDS, REGULATES, PARTNERS_WITH, OPPOSES, IS_MEMBER_OF, COMMUNICATES_WITH, IS_STAKEHOLDER_IN}`
- `O` (object types) = `{Stakeholder, Initiative, Claim}`

The reducer cannot emit prose. It can only emit valid triples from `S x P x O`, each tagged with confidence and evidence (the quoted source sentence). The Minto layer then organizes the emitted triples into a MECE tree rooted at "Who are the stakeholders in this document?" with children grouped by type, influence tier, and stance.

Per-edge properties (power, interest, stance) are derived from the reducer's confidence score on each emitted triple, which is the joint probability:

$$
w(s, p, o) = P(\text{triple valid} \mid \text{sentence, taxonomy})
$$

---

## 2. The 3-Way Ablation

The protocol is structured as a three-condition ablation designed to isolate the contribution of each engine component. Each condition receives the same input corpus and produces the same output shape (SCN triples). The differences are in what generative mechanism produces them.

### Condition 1: Unconstrained LLM (Baseline)

- **Input**: raw document corpus
- **Method**: direct LLM prompt ("Extract all stakeholders, organizations, and their relationships from the text below.")
- **Output**: freeform JSON triples with no taxonomy constraint
- **Purpose**: establishes the floor. Tests what a general-purpose LLM produces without any structural discipline.

### Condition 2: LLM + Taxonomy (Isolation of taxonomy contribution)

- **Input**: raw document corpus
- **Method**: LLM prompt with explicit taxonomy constraint. The prompt enumerates valid `S`, `P`, `O` values and instructs the model to reject any triple outside the codomain.
- **Output**: JSON triples constrained to `S x P x O`
- **Purpose**: isolates the contribution of the taxonomy constraint alone. Measures the lift from schema-free to schema-constrained extraction, independent of any structural (MECE or Minto) discipline.

### Condition 3: Full Feynman-MINTO (Target engine)

- **Input**: raw document corpus
- **Method**: the full engine as formalized in Section 1.1, with the SCN codomain restriction from Section 1.2. Feynman reduction applied per-node with `theta_comprehend >= 0.9`; Minto decomposition enforcing MECE sibling sets; fixed-point iteration to description-length stability.
- **Output**: SCN triples organized in a Minto pyramid, with per-node comprehensibility scores and per-sibling MECE scores.
- **Purpose**: measures the full engine's lift over Condition 2. The delta between Condition 2 and Condition 3 isolates the contribution of the MECE tree structure and the Feynman compression discipline, separately from the taxonomy contribution already measured in Condition 2.

The 3-way ablation design is deliberate. A 2-way comparison (unconstrained vs. full) would conflate taxonomy and structure. A 4-way or larger ablation would require isolating MECE from compression, which is not testable independently because they are jointly optimized. Three conditions is the minimum sufficient decomposition.

---

## 3. Evaluation Metrics

Four metrics, each measuring a distinct property of the extracted SCN. All metrics are scored on a held-out corpus with manual gold standard labels for relation precision and category coverage.

### 3.1 Category coverage

$$
\text{Coverage} = \frac{|\{\tau \in \mathcal{P} : \exists \text{ extracted triple with predicate } \tau\}|}{|\mathcal{P}|}
$$

Measures the fraction of the taxonomy's predicate set actually populated by the extraction. The research literature cited in the companion document (`2026-04-14-stakeholder-graph-deep-research.md`) claims 93%+ for taxonomy-guided extraction. This metric tests whether that claim holds for Feynman-MINTO specifically.

**Expected ordering**: Condition 3 >= Condition 2 >> Condition 1.

### 3.2 Relation precision

$$
\text{Precision} = \frac{|\text{extracted triples judged correct by human review}|}{|\text{extracted triples}|}
$$

Measures the fraction of emitted triples that are semantically correct given the source sentence. Judged by manual review against a gold standard on a held-out set of at least 100 stakeholder sentences.

**Expected ordering**: Condition 3 > Condition 2 > Condition 1. The MECE constraint in Condition 3 is expected to prune edge cases and ambiguous extractions that slip through in Condition 2.

### 3.3 Graph quality downstream

$$
Q_{\text{graph}} = \text{modularity}(\text{Louvain}(G_{\text{extracted}}))
$$

Runs Louvain community detection on the extracted SCN and measures the modularity of the resulting community partition. High modularity indicates the graph has coherent, dense subcommunities (the signal the research framework is meant to surface). Low modularity indicates the extraction is noisy and lacks structural signal.

Measured as the difference from a null-model graph with the same degree sequence but randomized edges. A Condition 3 graph that produces strong communities that a Condition 1 graph does not is the empirical validation of the MECE contribution: MECE sibling sets in the extraction mirror as dense subcommunities in the resulting graph.

**Expected ordering**: Condition 3 > Condition 2 >= Condition 1.

### 3.4 Compression ratio (MDL anchor)

$$
R_{\text{compress}} = \frac{|\text{extracted nodes}|}{|\text{raw entity mentions}|}
$$

This metric is directly anchored to the MDL floor formalization in Section 1.1:

$$
\text{reduce}(X) = \arg\min_L |L| \quad \text{subject to} \quad \pi(L) \geq \theta
$$

Compression ratio measures whether the engine is actually compressing the input, or just passing raw entity mentions through to the output. A ratio near 1.0 means no compression (Condition 1 baseline). A ratio near 0.0 would mean collapsing to a single summary node, which the comprehensibility floor `theta` is designed to prevent.

The Feynman-MINTO engine should produce a ratio in the range **0.2 to 0.5**: substantially compressed relative to raw mentions (entities are deduplicated and canonicalized, variant mentions of the same stakeholder collapse into one node) but not so compressed that comprehensibility breaks. The floor `theta` is what prevents collapse to a single summary node.

The Condition 3 compression ratio is expected to be meaningfully lower than Condition 2, because Feynman reduction deduplicates aggressively while the Minto MECE constraint prevents over-collapse.

**Expected ordering**: Condition 3 < Condition 2 < Condition 1 (lower ratio = more compression).

### 3.5 Joint scoring

A candidate composite metric combining the four:

$$
\text{SCN-score} = \alpha \cdot \text{Coverage} + \beta \cdot \text{Precision} + \gamma \cdot Q_{\text{graph}} + \delta \cdot (1 - R_{\text{compress}})
$$

where the weights `alpha + beta + gamma + delta = 1` are tuned to context. For a first-pass evaluation, equal weighting (`0.25` each) is appropriate. Subsequent runs can weight by downstream consumer priority (e.g., graph-quality-heavy for the v1.11.x `/mos:stakeholders` command use case).

---

## 4. Benchmark Targets

The protocol is executed against baselines from three categories.

### 4.1 Against standard NER baselines

| Benchmark target | What it tests | Why it matters |
|---|---|---|
| spaCy `en_core_web_trf` + rule-based RE | Raw entity + relation recall on the corpus | Proves taxonomy-constraint lifts quality over off-the-shelf NER |
| Stanford NLP CoreNLP (NER + OpenIE) | Open-IE relation extraction | Proves structured output beats open triples |
| GLiNER (generalist NER) | Zero-shot span extraction | Proves domain-constrained extraction beats zero-shot generalist |

These baselines establish the absolute floor: what a generic NER pipeline produces with no taxonomy and no structural discipline. The expected result is that all three conditions in the Feynman-MINTO ablation (even Condition 1, the unconstrained LLM) outperform these baselines on the four metrics, but the magnitude of the lift from each ablation condition is what validates the engine's design claims.

### 4.2 Against KG-construction pipelines

| Benchmark target | What it tests |
|---|---|
| Rebel (end-to-end RE from Hugging Face) | Relation extraction F1 on held-out stakeholder sentences |
| LLM-direct prompting (GPT-4 / Claude, no taxonomy) | Proves taxonomy-constrained prompt beats unconstrained LLM extraction |
| LLM + taxonomy prompt (ablation) | Isolates Minto tree contribution from taxonomy contribution |

The Rebel baseline is important because it is a purpose-built relation extraction model. If Feynman-MINTO Condition 3 fails to beat Rebel on relation precision, the engine needs rethinking. If Condition 3 beats Rebel, the combined taxonomy + MECE + compression design is validated against a strong baseline.

The LLM-direct baseline is the same as Condition 1 in the ablation (mentioned twice for completeness at both the baseline and ablation level). The LLM + taxonomy baseline is the same as Condition 2. Including them here makes the baseline/ablation correspondence explicit.

### 4.3 Against the Brain MCP (internal baseline)

When the v1.11.x milestone runs, the MindrianOS Brain MCP (Neo4j + GDS, 21K+ teaching nodes) is available as an alternative extraction surface. The Brain's stakeholder nodes are curated by hand or by an earlier extraction pipeline; they represent a high-quality internal benchmark. The evaluation should include a direct comparison between Feynman-MINTO extraction on a fresh corpus and the Brain's existing stakeholder graph for that same domain. Agreement measured as: triple overlap (same `(s, p, o)` triple present in both), near-match (same `s` and `p`, compatible `o`), and novel-triple rate (Feynman-MINTO finds triples the Brain does not, human-reviewed for validity).

---

## 5. Practical Recommendation for First Execution

The most defensible first execution is the **3-way ablation on a held-out set of stakeholder documents**:

1. **Condition 1: Unconstrained LLM** (no taxonomy, no MECE) -> baseline floor
2. **Condition 2: LLM + taxonomy only** (no MECE tree) -> isolates taxonomy contribution
3. **Condition 3: Full Feynman-MINTO** -> target engine

Measure all four metrics (category coverage, relation precision, graph quality downstream, compression ratio). Run on a corpus of at least 500 stakeholder sentences drawn from MindrianOS user Data Rooms with explicit consent, covering at least three distinct venture domains to test generalization.

**Manual gold standard**: at least 100 sentences hand-labeled by the project lead (Jonathan Sagir) or a trusted reviewer, producing canonical `(s, p, o)` triples for precision scoring.

**Compute budget**: Condition 1 and Condition 2 are single-pass LLM prompts, fast. Condition 3 runs the Feynman-MINTO fixed-point iteration, which converges in a few passes but is slower per-document. A 500-sentence corpus should execute in under an hour of total compute.

**Success criteria for the v1.11.x launch**:

- Condition 3 beats Condition 2 on relation precision by at least 5 percentage points
- Condition 3 beats Condition 2 on graph quality by at least 10 percentage points of modularity
- Condition 3 compression ratio is in the range `[0.2, 0.5]` (not so high it is a pass-through, not so low it over-collapses)
- Condition 3 matches or exceeds the 93% category coverage claim from the literature

Failure on any of these does not kill the engine, it redirects tuning: a low category coverage score probably means the prompt taxonomy enumeration is incomplete; a low modularity score probably means the MECE sibling threshold `theta_MECE` needs tightening; a compression ratio below 0.2 means the comprehensibility floor `theta_comprehend` is too low and the engine is over-collapsing.

---

## 6. Implementation Notes for v1.11.x

When this protocol is executed in the v1.11.x Stakeholder Intelligence milestone, the implementation path is:

1. **Corpus assembly**: export from consenting MindrianOS user rooms via `/mos:vault` into a sanitized, privacy-safe benchmark corpus. Target 500+ sentences across 3+ venture domains.

2. **Gold standard labeling**: manual review of 100 sentences by the project lead, producing a canonical triple set. Store at `docs/research/benchmarks/feynman-minto-scn/gold-standard-v1.json`.

3. **Baseline runners**: Condition 1 and Condition 2 as CJS scripts under `scripts/benchmarks/`, each producing standardized JSON output conforming to a shared schema.

4. **Condition 3 runner**: wires into `skills/feynman-engine/` with the SCN codomain restriction active. Also CJS, same output schema.

5. **Scoring pipeline**: a single CJS script that reads all three condition outputs and the gold standard, computes all four metrics, and writes a scored report to `docs/research/benchmarks/feynman-minto-scn/results-YYYY-MM-DD.md`.

6. **Human review stage**: for relation precision specifically, a markdown diff between extracted triples and gold standard triples, with reviewer comments folded back into the scored report.

7. **Publication**: the scored report is committed to the repo as the first empirical validation of Feynman-MINTO as an SCN extraction engine. If results meet the success criteria in Section 5, the engine is promoted from "Phase 81 reasoning engine" to "MindrianOS primary SCN extraction surface" and the v1.11.x milestone proceeds with high confidence.

---

## 7. Intellectual Property Position

This evaluation protocol, the 3-way ablation design, the four-metric scoring framework, the MDL-anchored compression ratio metric, and the positioning of Feynman-MINTO as a taxonomy-constrained SCN extraction engine are all **novel MindrianOS contributions authored by Jonathan Sagir**. The underlying Feynman reduction discipline is drawn from Richard Feynman's teaching methodology; the Minto pyramid structure is drawn from Barbara Minto's consulting practice. The combination as a reasoning engine is the MindrianOS Phase 81 deliverable. The specialization of that engine to SCN extraction via codomain restriction, the benchmark design to validate it, and the mathematical formalization linking per-node MDL compression to per-edge extraction confidence are the novel research contributions recorded here.

This document and the companion research brief at `docs/research/2026-04-14-stakeholder-graph-deep-research.md` are the authority for the v1.11.x Stakeholder Intelligence milestone. Any public write-up of the engine's SCN extraction capability (conference paper, blog post, marketing material) should cite these two documents as the source and credit MindrianOS / Jonathan Sagir as the origin of the benchmark framework.

---

## 8. Status and Next Steps

**Status as of 2026-04-14**: protocol draft, ready for v1.11.x implementation. Not yet executed. No empirical data.

**v1.10.8 impact**: none directly. v1.10.8 ships the Stakeholder node type in local lazygraph-ops as infrastructure; extraction stays filesystem-and-bash-scan based. This protocol does not execute until v1.11.x adds Initiative and Claim node types and wires Feynman-MINTO as the extraction path.

**v1.11.x dependencies to unblock execution**:

1. Initiative node type in lazygraph-ops
2. Claim node type in lazygraph-ops
3. Extended edge vocabulary (the 8 relationship types from the companion research doc)
4. Feynman-MINTO engine wired with SCN codomain restriction
5. Corpus assembly from consenting user rooms
6. Gold standard labeling by project lead
7. Baseline runners for Conditions 1 and 2
8. Scoring pipeline
9. Human review stage

Items 1-4 are engine-side. Items 5-9 are evaluation-side. Both tracks can run in parallel during the v1.11.x milestone.

**First deployment target**: v1.11.0 shipping with at least Conditions 1 and 3 executed on a 500-sentence corpus, published results committed to the repo, and the engine promoted to primary SCN extraction surface on successful validation.

---

*End of protocol. Comments, challenges, and refinements welcome as issues or PRs against this file.*
