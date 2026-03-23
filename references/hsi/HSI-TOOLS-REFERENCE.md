# HSI & Reverse Salient Discovery — Tool Reference

*Computational engines for auto-relationship building in the Data Room knowledge graph.*

---

## What These Tools Do for MindrianOS

The HSI (Hybrid Similarity Index) and Reverse Salient Discovery framework provide the **computational backbone for auto-discovering cross-relationships** in the Data Room. Instead of relying only on keyword matching or explicit cross-references, these tools find HIDDEN connections between room artifacts using dual similarity analysis.

### The Core Insight

When two room artifacts share **structural similarity** (same methods/terms) but LOW **semantic similarity** (different meanings/applications), OR vice versa — that GAP is where hidden innovation connections live.

```
HSI(artifact_i, artifact_j) = |BERT_similarity - LSA_similarity| × Integrative_Factor

High HSI = "These two artifacts are connected in ways nobody sees"
```

### Application to Data Room

| Source Tool | Data Room Application |
|-------------|----------------------|
| LSA (TF-IDF + SVD) | Structural similarity between room artifacts (shared terminology) |
| BERT embeddings | Semantic similarity between room artifacts (shared meaning) |
| HSI differential | Hidden connections: artifacts that share structure but not meaning, or meaning but not structure |
| Reverse Salient detection | Cross-subsystem innovation opportunities — where a solution in one room section addresses a problem in another |
| Top pairs extraction | The most surprising connections to surface to the user |

### Integration with Meeting Filing

After meeting segments are filed to room sections, the HSI pipeline runs:
1. Compute LSA similarity between ALL room artifacts (including new meeting segments)
2. Compute BERT/embedding similarity between all artifacts
3. Find high-differential pairs (|BERT - LSA| > threshold)
4. Surface as ENABLES/INFORMS/CONTRADICTS edges in the knowledge graph
5. Larry says: "I found a hidden connection between your mentor's advice and your market analysis that nobody mentioned in the meeting."

---

## Tool 1: HSI Computational Pipeline

### Architecture

```
Room artifacts (text) → TF-IDF vectorization → TruncatedSVD (80 components) → LSA similarity matrix
Room artifacts (text) → BERT tokenization → segment embeddings → BERT similarity matrix
|BERT - LSA| = differential matrix → HSI score × integrative factor → top pairs = hidden connections
```

### Key Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| max_features | 2000 | TF-IDF vocabulary size |
| n_components | 80 | SVD dimensions (topic space) |
| max_df | 0.5 | Ignore terms in >50% of docs |
| BERT model | bert-large-cased | Semantic embeddings |
| max_tokens | 512 | BERT segment size |
| threshold | 0.3 | Minimum differential for reverse salient |

### Adaptation for Plugin

**Problem:** BERT-large requires ~1.3GB memory + GPU. Plugin must work on CPU with low memory.

**Solution (already proven):** Gemini-Native HSI — replace BERT with Claude/Gemini embedding API:
- `text-embedding-004` or Claude's native embeddings
- API-based, no local GPU needed
- Minutes instead of hours
- Fits within plugin constraints

**Alternative:** Use Pinecone (already integrated as Brain MCP) for embedding similarity. Room artifacts get embedded at filing time. Cross-similarity is a Pinecone query.

### LSA Component (lsa.py adapted)

```python
# Adapted for room artifacts instead of papers
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD

def compute_lsa_similarity(artifacts: list[str]) -> np.ndarray:
    vectorizer = TfidfVectorizer(stop_words='english', max_features=2000, max_df=0.5)
    X = vectorizer.fit_transform(artifacts)
    svd = TruncatedSVD(n_components=min(80, len(artifacts)-1), random_state=256)
    Z = svd.fit_transform(X)
    sim = cosine_similarity(Z)
    # Normalize to [0,1]
    sim = (sim - sim.min()) / (sim.max() - sim.min() + 1e-12)
    return sim
```

### Semantic Component (adapted for plugin)

```python
# Option A: Pinecone embeddings (if Brain connected)
def compute_semantic_similarity_pinecone(artifact_ids: list[str]) -> np.ndarray:
    # Query Pinecone for existing embeddings
    # Compute pairwise cosine similarity
    pass

# Option B: Local lightweight embeddings (Tier 0)
def compute_semantic_similarity_local(artifacts: list[str]) -> np.ndarray:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer('all-MiniLM-L6-v2')  # 80MB, CPU-friendly
    embeddings = model.encode(artifacts)
    sim = cosine_similarity(embeddings)
    sim = (sim - sim.min()) / (sim.max() - sim.min() + 1e-12)
    return sim
```

### HSI Computation

```python
def compute_hsi(artifacts: list[str]) -> dict:
    lsa = compute_lsa_similarity(artifacts)
    semantic = compute_semantic_similarity_local(artifacts)  # or Pinecone

    # Differential = hidden connections
    gap = np.abs(semantic - lsa)
    gap = (gap - gap.min()) / (gap.max() - gap.min() + 1e-12)

    return {"lsa": lsa, "semantic": semantic, "hsi": gap}

def top_hidden_connections(hsi: np.ndarray, artifacts: list, k=10):
    n = hsi.shape[0]
    pairs = []
    for i in range(n):
        for j in range(i+1, n):
            if hsi[i,j] > 0.3:  # threshold
                pairs.append((i, j, float(hsi[i,j])))
    pairs.sort(key=lambda x: x[2], reverse=True)
    return pairs[:k]
```

---

## Tool 2: Reverse Salient Discovery Framework

### The 4-Phase Pipeline

```
Phase 1: ACQUIRE     — gather all room artifacts as "documents"
Phase 2: ANALYZE     — compute dual similarity (LSA + semantic)
Phase 3: DETECT      — find high-differential pairs (reverse salients)
Phase 4: SYNTHESIZE  — generate innovation thesis for each pair
```

### Adaptation for Data Room Auto-Relationships

Instead of analyzing academic papers across domains, we analyze ROOM ARTIFACTS across sections:

| Framework Concept | Data Room Equivalent |
|-------------------|---------------------|
| Domain A papers | Artifacts in section A (e.g., market-analysis) |
| Domain B papers | Artifacts in section B (e.g., solution-design) |
| Cross-domain reverse salient | Hidden connection between sections |
| Innovation thesis | Larry's insight: "This market trend enables that technical approach" |

### Edge Types Generated

| HSI Pattern | Edge Type | Example |
|-------------|-----------|---------|
| High structural, low semantic | ENABLES | "Same method, different application — this technique in solution-design could address the gap in market-analysis" |
| Low structural, high semantic | INFORMS | "Different words, same concept — the mentor's advice about timing maps to the S-curve analysis" |
| High differential + contradiction | CONTRADICTS | "These two artifacts say opposite things using different language" |
| Multiple artifacts → same concept | CONVERGES | "Three meetings, three speakers, all pointing to the same insight from different angles" |
| Change in one → invalidates other | INVALIDATES | "This new finding makes the assumption in financial-model stale" |

### Neo4j Storage (when Brain connected)

```cypher
// Store discovered relationships
MERGE (a1:RoomArtifact {id: $artifact1_id})
MERGE (a2:RoomArtifact {id: $artifact2_id})
CREATE (a1)-[:HSI_CONNECTION {
  hsi_score: $score,
  lsa_sim: $lsa,
  semantic_sim: $semantic,
  connection_type: $type,
  discovered: datetime(),
  human_approved: null
}]->(a2)
```

---

## Integration with Phase 6 (Cross-Relationship Discovery Loop)

Plan 06-03 builds the cross-relationship discovery loop. The HSI tools integrate as:

```
Artifact filed (from meeting or methodology session)
    ↓
Step 6: Cross-relationship scan
    ↓
Option A (Tier 0, no deps): Keyword-based (existing analyze-room)
Option B (Tier 1, lightweight): LSA + MiniLM embeddings (this reference)
Option C (Tier 2, Brain): LSA + Pinecone + Neo4j storage
    ↓
Hidden connections surfaced → Larry presents → User APPROVE/REJECT/DEFER
    ↓
Graph edges created → Dashboard updated → Knowledge compounds
```

---

## Source Files

Original HSI codebase (Jonathan's research):
- `lsa.py` — LSA similarity computation (TF-IDF + TruncatedSVD)
- `sts_bert.py` — BERT semantic similarity (segment-aware cosine)
- `comparison.py` — Differential analysis + reverse salient extraction
- `paper_gathering.py` — Scopus API document acquisition
- `paper_cleaning.py` — Text preprocessing
- `lsa_bert_similarity.py` — Combined LSA + BERT pipeline
- `hybrid_index.py` — HSI computation with integrative scoring

Enhanced framework:
- Reverse Salient Discovery Agent (4-phase pipeline)
- Neo4j integration schema for storing/querying discoveries
- Dynamic threshold adjustment based on domain characteristics
