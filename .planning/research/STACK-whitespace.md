# Technology Stack: Whitespace Mapping Power Tool

**Project:** MindrianOS v1.9.0 - Whitespace Mapping
**Researched:** 2026-04-08
**Overall confidence:** MEDIUM-HIGH (paper methods verified via PubMed/ScienceDirect abstracts; exact code not available)

## Recommended Stack

### Embedding Model (SemNovel-aligned)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `BAAI/llm-embedder` | latest (HF) | Primary embedding for novelty scoring | This is the exact model used in SemNovel (Peng et al. JBI 2025). 768-dim embeddings, sentence-transformers compatible, fine-tuned on BGE-base for retrieval tasks. Captures richer semantic content than MiniLM (384-dim). [HIGH confidence - verified via PubMed abstract and HuggingFace model card] |
| `all-MiniLM-L6-v2` | (existing) | Fallback/compatibility layer | Already installed for HSI pipeline. 384-dim, 22.7M params, 14.7ms/1K tokens. Keep as Tier 0 fallback when llm-embedder unavailable. [HIGH confidence - already in production] |

**Critical decision: Dual-model strategy.** Use llm-embedder for whitespace/novelty scoring (paper-faithful, higher accuracy), keep MiniLM for HSI pipeline (speed, existing cache). Do NOT replace MiniLM in HSI - different purpose, different tradeoffs.

**Embedding dimensions matter:** llm-embedder produces 768-dim vectors vs MiniLM's 384-dim. The whitespace pipeline must handle 768-dim throughout. When comparing room artifacts (MiniLM) against Brain baseline (llm-embedder), project MiniLM embeddings to 768-dim via a learned linear projection, or re-embed room artifacts with llm-embedder for the whitespace pass.

**Recommendation:** Re-embed room artifacts with llm-embedder during whitespace computation. The HSI cache already detects content changes - the whitespace pass is a separate computation with its own cache. This avoids dimension mismatch entirely.

### Novelty Scoring Algorithm (SemNovel Method)

| Component | Implementation | Source |
|-----------|---------------|--------|
| Semantic Universe | Embed ALL prior/baseline documents (Brain descriptions) into a single embedding matrix | SemNovel paper: "projects the entire PubMed library into a semantic universe" |
| Novelty Score | For each artifact, compute `1 - max(cosine_similarity(artifact_embedding, all_baseline_embeddings))` | SemNovel: "distance from prior publications"; verified pattern from semantic novelty literature |
| Distance Metric | Cosine distance (1 - cosine_similarity) | Standard for embedding spaces; SemNovel uses cosine-based distance |
| Baseline Construction | Brain methodology/framework descriptions (~21K nodes) as "consensus" | Adapted from SemNovel's PubMed-as-universe to Brain-as-universe |
| Validation | Novelty score correlates with citation impact (rho=0.1782, p<0.001 Spearman) | SemNovel paper validation |

**SemNovel Score Formula (adapted for MindrianOS):**
```python
# For each room artifact:
novelty_score = 1 - max(cosine_similarity(artifact_emb, brain_baseline_embs))

# Higher score = more novel (further from any known concept in Brain)
# Lower score = well-covered territory (close to existing Brain knowledge)
```

### Hierarchical Clustering (TopicForest Method)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `umap-learn` | >=0.5.6 | Manifold learning / dimensionality reduction | TopicForest uses UMAP and t-SNE for manifold learning. UMAP preferred: preserves global structure better, faster than t-SNE, scikit-learn compatible API. [HIGH confidence - verified TopicForest paper and UMAP docs] |
| `hdbscan` | >=0.8.38 | Density-based clustering (comparison baseline) | TopicForest compares against HDBSCAN (via BERTopic). Useful for flat clustering baseline. Already scikit-learn compatible. [HIGH confidence - standard library] |
| `scipy.cluster.hierarchy` | (via scipy) | Agglomerative hierarchical clustering + dendrogram | TopicForest uses "binary partitioning and multi-level dendrogram cutting". scipy's linkage + dendrogram is the standard implementation. Already a numpy/sklearn transitive dependency. [HIGH confidence] |

**TopicForest Algorithm Steps (adapted for MindrianOS):**

1. **Embed** all room artifacts + Brain framework descriptions with llm-embedder (768-dim)
2. **Reduce** to 2D/3D via UMAP (for visualization) and to ~50D (for clustering)
3. **Build dendrogram** via agglomerative clustering (Ward's linkage on UMAP-reduced embeddings)
4. **Binary partition** the dendrogram at multiple levels to create topic trees
5. **Label clusters** using Claude (recursive summarization from leaf clusters upward) - replaces TopicForest's LLM labeling with Claude as the LLM
6. **Identify empty branches** - topic tree branches with Brain framework nodes but zero room artifact nodes = whitespace zones

### Density Estimation (Gap Detection)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `sklearn.neighbors.KernelDensity` | (via sklearn) | Kernel Density Estimation in reduced embedding space | Already a dependency. Gaussian kernel KDE on UMAP-reduced embeddings (NOT raw 768-dim - curse of dimensionality). Bandwidth via Scott's rule. [HIGH confidence - verified sklearn docs] |
| `sklearn.neighbors.NearestNeighbors` | (via sklearn) | k-NN density estimation (local density) | k-NN density = 1/distance_to_kth_neighbor. More robust in moderate dimensions than KDE. Use k=5 or k=sqrt(n). [HIGH confidence] |

**Why KDE on UMAP-reduced space, not raw embeddings:**
KDE degrades severely above ~10 dimensions (curse of dimensionality). UMAP reduces 768-dim to 10-20 dims while preserving local structure. KDE on UMAP output gives meaningful density estimates.

**Gap Detection Algorithm:**
```python
# 1. Embed all room artifacts + Brain baselines with llm-embedder
# 2. UMAP reduce to ~15 dimensions (for density) and 2D (for visualization)
# 3. Fit KDE on room artifact embeddings only (the "explored" space)
# 4. Evaluate KDE density at Brain baseline positions
# 5. Brain positions with LOW density in room-artifact space = whitespace zones
#    (topics the Brain knows about but the room hasn't explored)
# 6. Rank whitespace zones by strategic importance (RS bottleneck score)
```

### Visualization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Cytoscape.js | (existing, via CDN) | Knowledge graph with whitespace overlay | Already in De Stijl dashboard. Add whitespace nodes as translucent/dashed nodes in graph. [HIGH confidence - already deployed] |
| D3.js | (via CDN, new) | 2D scatter plot of embedding space with density contours | UMAP 2D projection + KDE contour overlay. D3 handles scatter + contour natively. Better for continuous density visualization than Cytoscape (which is graph-oriented). [MEDIUM confidence - standard choice] |
| SVG generation (Node.js) | No library needed | Static whitespace map for export/PDF | Generate SVG directly from UMAP coordinates. No runtime dependency. De Stijl color scheme applied. [HIGH confidence] |

**Visualization approach:** Two complementary views:
1. **Density map** (D3.js): UMAP 2D scatter with KDE density contours. Dense regions = explored, sparse regions = whitespace. Brain baseline points shown as reference markers.
2. **Topic tree** (Cytoscape.js): TopicForest hierarchy with coverage coloring. Green = room has artifacts, red/dashed = whitespace (Brain knows, room doesn't).

### Hypothesis Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude (native) | N/A | Generate hypotheses for whitespace zones | Claude IS the LLM. No external API needed. Pass whitespace zone context (nearest Brain frameworks + room artifacts) as prompt. [HIGH confidence] |

**Hypothesis generation is a prompt engineering problem, not a library problem.** For each whitespace zone:
1. Identify nearest Brain framework descriptions (the "what should be here")
2. Identify nearest room artifacts (the "what IS here, nearby")
3. Prompt Claude: "Given these frameworks exist in the knowledge base but have no coverage in this venture's room, and given these nearby artifacts, what specific questions or investigations would fill this gap?"

## Supporting Libraries (New Python Dependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `umap-learn` | >=0.5.6 | UMAP dimensionality reduction | Always - core to TopicForest pipeline |
| `hdbscan` | >=0.8.38 | Density-based flat clustering | Baseline comparison + cluster quality validation |

**Not adding as dependencies (already available):**
- `scikit-learn` - already in requirements-hsi.txt
- `numpy` - already in requirements-hsi.txt  
- `sentence-transformers` - already in requirements-hsi.txt (loads llm-embedder too)
- `scipy` - transitive dependency of scikit-learn

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Embedding model | `BAAI/llm-embedder` (768d) | `all-MiniLM-L6-v2` (384d) | MiniLM is fast but less accurate. SemNovel specifically validated llm-embedder. Novelty scoring needs the higher fidelity. Keep MiniLM for HSI only. |
| Embedding model | `BAAI/llm-embedder` (768d) | `BAAI/bge-large-en-v1.5` (1024d) | Larger, slower, not the model validated in SemNovel. llm-embedder IS bge-base fine-tuned for retrieval. |
| Embedding model | `BAAI/llm-embedder` (768d) | `text-embedding-3-small` (OpenAI) | External API dependency. Plugin runs offline. Violates "no server infrastructure" constraint. |
| Dim reduction | UMAP | t-SNE | TopicForest tested both; UMAP preserves global structure better, is faster, and supports transform on new data (t-SNE doesn't). |
| Dim reduction | UMAP | PCA | PCA is linear - misses manifold structure. UMAP captures non-linear relationships critical for topic clustering. |
| Clustering | scipy agglomerative + HDBSCAN | BERTopic | BERTopic is a full framework (c-TF-IDF + UMAP + HDBSCAN). We only need the clustering pieces, not the topic modeling wrapper. Adds unnecessary dependencies. |
| Density estimation | KDE on UMAP space | KDE on raw 768-dim | Curse of dimensionality makes raw-space KDE meaningless above ~10 dims. UMAP reduction required. |
| Density estimation | KDE + k-NN density | GMM (Gaussian Mixture Model) | GMM assumes Gaussian clusters - embedding spaces often have non-Gaussian structure. KDE is non-parametric, safer. |
| Visualization | D3.js + Cytoscape.js | Plotly | Plotly adds a heavy JS dependency. D3 is lighter, more customizable, and we already serve Cytoscape via CDN. |
| Visualization | D3.js + Cytoscape.js | matplotlib (Python-side) | Need client-side interactive visualization in dashboard HTML. matplotlib generates static images. |
| Hypothesis gen | Claude (native) | GPT-4 API | Claude IS the runtime. No external API needed. |
| Topic labeling | Claude recursive summarization | c-TF-IDF | TopicForest proved LLM recursive labeling beats c-TF-IDF on diversity and hierarchical affinity. Claude is already available. |

## Installation

```bash
# Add to requirements-hsi.txt (or new requirements-whitespace.txt):
pip install umap-learn>=0.5.6 hdbscan>=0.8.38

# Existing deps (already installed):
# scikit-learn>=1.3.0
# numpy>=1.24.0
# sentence-transformers>=2.2.0

# The llm-embedder model downloads automatically on first use:
# SentenceTransformer('BAAI/llm-embedder')  # ~440MB download, cached
```

### Recommended: Separate requirements file

```bash
# requirements-whitespace.txt
scikit-learn>=1.3.0
numpy>=1.24.0
sentence-transformers>=2.2.0
umap-learn>=0.5.6
hdbscan>=0.8.38
scipy>=1.10.0
```

## Integration Points with Existing Pipeline

| Existing Component | How Whitespace Integrates |
|-------------------|--------------------------|
| `compute-hsi.py` (MiniLM embeddings) | Whitespace runs AFTER HSI. Can reuse artifact discovery (`discover_artifacts()`). Does NOT reuse MiniLM embeddings - uses llm-embedder instead for higher fidelity. |
| `compute-hsi.py` (spectral OM-HMM) | Whitespace zones can be cross-referenced with OM-HMM dominant modes. A whitespace zone in "integrative" mode territory suggests missing cross-domain synthesis. |
| `detect-reverse-salients.py` | RS finds lagging components. Whitespace maps DOWNSTREAM of each RS - "given this bottleneck, what territory beyond it is unexplored?" |
| Brain MCP (21K nodes) | Brain framework/methodology descriptions become the "semantic universe" baseline. Fetch via MCP `brain_query` tool, cache locally as JSON. |
| KuzuDB (local graph) | Whitespace zones become new node type in KuzuDB: `WhitespaceZone` with properties (density_score, nearest_frameworks, hypothesis, strategic_rank). |
| HSI pipeline trigger (session-start hook) | Whitespace computation is expensive (~30-60s). Run on `/mos:whitespace` command, NOT on session-start. Cache results in `.whitespace-results.json`. |
| De Stijl dashboard | Add whitespace map as new dashboard view panel. UMAP scatter + density contours + topic tree. |
| Presentation system (6 views) | Whitespace map becomes 7th view or sub-view of Insights. |

## Model Download & Caching Strategy

| Model | Size | First Download | Cached Location |
|-------|------|----------------|-----------------|
| `BAAI/llm-embedder` | ~440MB | First `/mos:whitespace` run | `~/.cache/huggingface/hub/` (default) |
| `all-MiniLM-L6-v2` | ~80MB | Already cached from HSI | Same location |

**Important:** The 440MB download happens ONCE. Subsequent runs use the cached model. The whitespace command should warn the user on first run: "Downloading embedding model (440MB, one-time)..."

## Computational Profile

| Step | Time Estimate (50 artifacts) | Time Estimate (200 artifacts) |
|------|------------------------------|-------------------------------|
| Embed with llm-embedder | ~5s | ~15s |
| UMAP reduction (768d -> 15d + 2d) | ~2s | ~8s |
| Agglomerative clustering | <1s | ~3s |
| KDE density estimation | <1s | ~2s |
| Gap detection + ranking | <1s | ~1s |
| **Total** | **~10s** | **~30s** |

These estimates assume CPU-only (no GPU). The llm-embedder model runs on CPU via sentence-transformers. GPU would be 3-5x faster but is not required.

## Key Algorithm Details from Papers

### SemNovel (Peng et al. JBI 2025, DOI: 10.1016/j.jbi.2025.104952)

- **Model:** BAAI/llm-embedder (BGE-base fine-tuned, 768-dim)
- **Method:** Embed documents, compute cosine distance from "semantic universe" of prior work
- **Score:** Distance from nearest prior document = novelty score
- **Validation:** Spearman rho=0.1782, p<0.001 with future citation counts
- **Key insight:** Distance from consensus predicts genuine novelty better than keyword-based or Jaccard-based approaches
- **Application to MindrianOS:** Room artifact distance from Brain consensus = innovation novelty score

### TopicForest (Chang et al. JBI 2025, DOI: 10.1016/j.jbi.2025.104958)

- **Pipeline:** Embed -> UMAP/t-SNE manifold learning -> binary partition dendrogram -> multi-level cut -> recursive LLM labeling
- **Clustering:** Agglomerative with binary partitioning (not HDBSCAN - that's the BERTopic baseline they beat)
- **Evaluation:** AMI (Adjusted Mutual Information) + Dasgupta's cost
- **Labeling:** Recursive LLM summarization from leaf clusters upward (beats c-TF-IDF and HyperMiner)
- **Key insight:** Creates a "forest of topic trees" - each tree starts broad, drills to narrow specialties
- **Application to MindrianOS:** Build topic forest from room + Brain, find branches with Brain nodes but no room coverage = whitespace

### AMIA 2025 Information Extraction Novelty (Peng, He et al.)

- **Method:** Transformer-based NER + relation extraction on paper conclusions
- **Categories:** No Novelty, Entity-only Novelty, Relation-only Novelty, Entity-Relation Novelty
- **Finding:** Entity-Relation Novelty correlates highest with citation impact
- **Application to MindrianOS:** Could enhance whitespace scoring by extracting entity-relation pairs from room artifacts and measuring novelty of RELATIONSHIPS, not just individual concepts. Deferred to future phase.

## Sources

- [SemNovel - PubMed](https://pubmed.ncbi.nlm.nih.gov/41242670/) - Paper abstract, model choice (BAAI/llm-embedder), validation statistics [HIGH confidence]
- [TopicForest - ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S153204642500187X) - Paper abstract, algorithm pipeline, evaluation metrics [HIGH confidence]
- [TopicForest - LifeScience.net](https://www.lifescience.net/publications/1731202/topicforest-embedding-driven-hierarchical-clusteri/) - Additional method details [HIGH confidence]
- [BAAI/llm-embedder - HuggingFace](https://huggingface.co/BAAI/llm-embedder) - Model card, 768-dim, sentence-transformers compatible [HIGH confidence]
- [umap-learn - PyPI](https://pypi.org/project/umap-learn/) - Current version, scikit-learn compatible [HIGH confidence]
- [scikit-learn KernelDensity docs](https://scikit-learn.org/stable/modules/density.html) - KDE implementation, curse of dimensionality warning [HIGH confidence]
- [a published researcher - Yale profile](https://medicine.yale.edu/profile/huan-he/) - Research group, related publications [HIGH confidence]
- [AMIA 2025 TopicForest poster](https://amia.secure-platform.com/symposium/gallery/rounds/82021/details/20256) - Conference presentation [MEDIUM confidence]
