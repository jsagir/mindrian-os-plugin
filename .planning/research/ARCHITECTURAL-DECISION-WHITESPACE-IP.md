# Architectural Decision: MindrianOS Whitespace IP Independence

**Date:** 2026-04-08
**Status:** MANDATORY CONSTRAINT
**Decision maker:** Jonathan Sagir

## The Constraint

MindrianOS MUST have its OWN way of doing whitespace mapping that is:
1. Potentially patentable
2. NOT reliant on other patents
3. NOT a derivative implementation of SemNovel, RND, TopicForest, or any commercial tool

## What Is Public Domain (Free to Use)

- Cosine similarity between embeddings (mathematical operation, not patentable)
- k-NN density estimation (textbook algorithm)
- UMAP dimensionality reduction (open source, BSD license)
- Agglomerative clustering (scikit-learn, BSD license)
- Sentence-transformers / BAAI models (open source, MIT/Apache license)
- KDE on reduced-dimension embeddings (standard statistics)

These are building blocks. Nobody owns embedding math.

## What Others Have Done (Cannot Copy)

| Who | What They Did | Their IP |
|-----|-------------|----------|
| Huan He (SemNovel) | Distance from PubMed universe = novelty | Published academic method, citable but not MindrianOS's |
| RND (arXiv 2503.01508) | Relative neighbor density across domains | Published academic method |
| Cypris | R&D ontology + 500M multi-source data | Proprietary ontology and data pipeline |
| PatSnap | 140M patent semantic clustering + PatsnapGPT | Proprietary platform and models |

## What MindrianOS Uniquely Has (The Differentiator)

1. **Teaching methodology knowledge graph** (Brain: 21K nodes, 65K rels) -- no one else has a structured graph of HOW frameworks chain, WHEN to use which, calibrated from 30+ years of real classroom teaching
2. **Problem type classification** (Ill-Defined / Well-Defined / Wicked / Un-Defined) -- mapped to framework chains with effectiveness scores
3. **Framework chaining intelligence** (FEEDS_INTO edges, TYPICAL_AT stages) -- knows JTBD -> Process Mapping -> RS -> Causal Loops
4. **Spectral OM-HMM** -- Markov chain analysis of thinking patterns (already unique to MindrianOS)
5. **HSI Semantic Surprise** -- |semantic_sim - structural_sim| as innovation signal (already unique)
6. **The Discovery Cycle** -- HSI -> Whitespace -> RS -> Analogy feeding each other

## The Potentially Patentable Claim

**A method for detecting innovation opportunity whitespace comprising:**

(a) Embedding venture artifacts and a structured teaching methodology graph into a shared semantic space;

(b) Computing density estimation in the shared space to identify regions covered by the methodology graph but absent from the venture artifacts (whitespace zones);

(c) Classifying each whitespace zone by problem type using the methodology graph's problem taxonomy;

(d) Selecting and chaining innovation frameworks from the methodology graph based on the classified problem type and framework effectiveness scores;

(e) Generating actionable hypotheses for each whitespace zone by applying the selected framework chain through an AI agent grounded in the methodology graph's teaching intelligence;

(f) Optionally extending the shared semantic space with external corpora (patents, research papers, market data) to detect cross-domain whitespace.

**Key novel elements:**
- Teaching methodology graph as semantic baseline (not generic corpus)
- Problem-type-aware gap classification (not just "this area is empty")
- Framework chain selection for hypothesis generation (not generic LLM prompting)
- Discovery Cycle integration (HSI + Whitespace + RS + Analogy as unified pipeline)

## What This Means for Implementation

- Use open-source building blocks (embeddings, density estimation, clustering) -- these are the engine
- The IP is in the METHODOLOGY LAYER on top -- how Brain directs the analysis
- Never claim novelty in the math -- claim novelty in the application of teaching intelligence to embedding-space gap detection
- The Brain + framework chaining + problem classification IS the moat
- External corpus integration is an additive feature, not the core claim

## Items from Lawrence Conversation (MAYBES, Not Decisions)

- Dormant patent application -- maybe
- Drug discovery vertical -- maybe
- Innovation Authority national program -- maybe
- University license model -- maybe
- Paid MCP server add-on -- maybe

These are explored possibilities, not committed scope. They inform the architecture (must be domain-agnostic enough to support these IF pursued) but are not requirements.

---
*Filed: 2026-04-08*
*This decision constrains all implementation phases of v1.9.0*
