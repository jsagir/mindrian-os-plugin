# HSI & Reverse Salient Discovery - Tool Reference

*Computational engines for auto-relationship building in the Data Room knowledge graph.*

This reference describes what the shipped code does (scripts/compute-hsi.py, lib/core/hsi-engine.cjs,
lib/core/hsi-lsa.cjs, lib/core/hsi-spectral.cjs and the whitespace scripts). Where an earlier version
of this page described a different design (BERT-large, a Gemini embedding API, a 2000-feature
vocabulary), that text has been removed; none of it was ever in the code path.

---

## What These Tools Do for MindrianOS

The HSI (Hybrid Similarity Index) and Reverse Salient Discovery framework give the Data Room a way to
propose cross-relationships that keyword matching and explicit cross-references miss. Each pair of room
artifacts is read through two lenses that should agree and sometimes do not.

### The Core Insight

When two artifacts use the same words and methods (high lexical similarity) but mean different things,
or mean the same thing in different words (high dense similarity, low lexical similarity), the
disagreement is where a hidden connection is most likely to sit.

```
surprise   = | dense_similarity - lexical_similarity |
integrative = sqrt(omhmm_i * omhmm_j) / 100          (thinking-mode and feature signal, 0..1)
hsi_score  = 0.6 * surprise + 0.4 * integrative
breakthrough_potential = 0.7 * hsi_score + 0.3 * min(lexical_similarity, dense_similarity)
```

A high HSI score is a lead to check, not a finding. The pair carries a second-signal check, a source
trail and a note that the novelty check covered the room only (external literature is "not_run").

### Application to Data Room

| Source Tool | Data Room Application |
|-------------|----------------------|
| LSA (TF-IDF + truncated SVD) | Lexical/structural similarity between artifacts (shared terminology) |
| BM25 | A second lexical leg that is robust to document length; the default lexical value is the mean of LSA and BM25 |
| Dense embeddings (sentence-transformers) | Semantic similarity (shared meaning) |
| HSI differential | Pairs whose lexical and semantic similarity disagree |
| Reverse Salient detection | Cross-subsystem opportunities: a solution in one section that addresses a problem in another |
| Spectral OM-HMM (hsi-spectral.cjs) | Thinking-mode dynamics of an artifact: transition matrix, spectral gap, stationary distribution |

### Integration with Meeting Filing

After meeting segments are filed to room sections, the HSI pipeline can run:
1. Compute lexical similarity (LSA and BM25) between all room artifacts, including new meeting segments.
2. Compute dense embedding similarity between the same artifacts.
3. Rank pairs by hsi_score and keep the top of the room's own distribution.
4. Surface the pairs as HSI_CONNECTION edges (and REVERSE_SALIENT edges between sections) in the graph.
5. Larry names the pair and what to check next; the user decides.

---

## Tool 1: HSI Computational Pipeline (scripts/compute-hsi.py)

### Architecture

```
artifacts -> TF-IDF -> truncated SVD (<= 80 components) -> LSA similarity
artifacts -> BM25                                       -> BM25 similarity
lexical   = mean(LSA, BM25)                              (--lexical hybrid, default)
artifacts -> dense encoder (chunked, mean-pooled)        -> semantic similarity
|semantic - lexical| -> hsi_score -> percentile rank over all pairs -> top-k pairs
```

### Key Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| TF-IDF max_features | 500 | Vocabulary size (room artifacts are small) |
| SVD components | min(80, n_artifacts - 1, vocabulary) | Topic space dimensions |
| SVD seed | 42 (--seed) | Makes repeated runs identical |
| BM25 | k1 = 1.5, b = 0.75 | Lexical leg 2 |
| Dense model | all-MiniLM-L6-v2 (--model) | Tier 1 semantic leg, CPU friendly |
| Chunking | on (--no-chunking turns it off) | Long artifacts are embedded in windows and mean-pooled |
| Ranking | percentile (--ranking legacy for the old rule) | No fixed cutoff; top-k by hsi_score |
| top-k | 20 (--top-k) | Pairs reported |
| Second signal | BM25-vs-dense surprise percentile >= 0.75 (--confirm-percentile) | Marks a pair as confirmed or not |
| Legacy threshold | 0.30 (--ranking legacy or --threshold) | Fixed cutoff, only on request |

Why percentiles: a fixed 0.30 cutoff means something different for every embedding model and every room
size. The percentile of a pair among all pairs in the same room does not.

### Tiers

| Tier | Needs | Dense leg |
|------|-------|-----------|
| 0 (no ML deps) | python3 and numpy | None. Pass --allow-lexical-only to use BM25 as the comparison leg; the result says so in metadata.semantic_leg |
| 1 | + sentence-transformers | Local MiniLM (or --model), or precomputed vectors with --dense-vectors file.json |
| 2 | + pinecone package, PINECONE_API_KEY and PINECONE_INDEX | Existing Brain embeddings; falls back to Tier 1 per artifact when a vector is missing |

scikit-learn is optional: without it the script uses a numpy TF-IDF/SVD with the same shape of output.
scripts/check-hsi-deps prints `tier:N` on stdout and a one-line `detail:` diagnostic on stderr.
HSI_NO_AUTO_INSTALL=1 stops the scripts from pip-installing anything.

### Claim-level evidence (optional)

`--claim-level` picks the most problem-like sentence of one artifact and the most method-like sentence
of the other (by cue-word rules) and embeds them, so a pair carries a sentence-sized reason next to the
document-sized score. It needs a local sentence encoder.

### Output (.hsi-results.json, schema_version 2.0)

Existing keys are unchanged. Each pair keeps left_id, right_id, hsi_score, lsa_sim, semantic_sim,
surprise_type, breakthrough_potential and adds rank, lexical_sim, bm25_sim, hsi_percentile, hsi_z,
second_signal, novelty_check, source_trail (artifact id, path, content hash, retrieved_at, extracted
sentence) and, with --claim-level, claim_level. metadata gains schema_version, ranking and provenance
(versions, seed, model, semantic leg, parameters). The cache is keyed on artifact content hashes plus a
parameter fingerprint, and is ignored when the output file is missing.

### LSA component (as implemented)

```python
vectorizer = TfidfVectorizer(stop_words='english', max_features=500)
X = vectorizer.fit_transform(artifacts)
svd = TruncatedSVD(n_components=min(80, len(artifacts) - 1, X.shape[1]), random_state=42)
Z = svd.fit_transform(X)
sim = cosine_similarity(Z)        # clipped to [0, 1]; no min-max stretching
```

The earlier text of this page showed min-max normalisation of the similarity matrix and
random_state=256; neither is what the code does.

### Semantic component

```python
# Tier 1
model = SentenceTransformer('all-MiniLM-L6-v2')
vectors = mean_of_unit_chunk_vectors(model.encode(chunks))   # one vector per artifact
sim = cosine_similarity(vectors)                              # clipped to [0, 1]
```

Tier 2 reads the vectors already stored in the Pinecone index named by PINECONE_INDEX.

### JavaScript twin (lib/core/hsi-engine.cjs)

runTier1 mirrors the pipeline in Node using lib/core/hsi-lsa.cjs (TF-IDF + SVD via lib/core/numeric,
BM25, hybrid lexical, percentile and z-score helpers). Its defaults are `{ lexical: 'hybrid',
ranking: 'percentile' }`; pass `{ lexical: 'lsa', ranking: 'legacy' }` for the original behaviour. If no
embedder is available it records `metadata.provenance.semantic_leg = 'unavailable-identity'` with a
warning (or refuses when `requireEmbedder` is set) instead of silently scoring against an identity
matrix.

---

## Tool 2: Reverse Salient Discovery Framework

### The 4-Phase Pipeline

```
Phase 1: ACQUIRE     - gather all room artifacts as "documents"
Phase 2: ANALYZE     - compute dual similarity (lexical + semantic)
Phase 3: DETECT      - find high-differential pairs (reverse salients)
Phase 4: SYNTHESIZE  - generate an innovation thesis for each pair
```

### Adaptation for Data Room Auto-Relationships

| Framework Concept | Data Room Equivalent |
|-------------------|---------------------|
| Domain A papers | Artifacts in section A (e.g., market-analysis) |
| Domain B papers | Artifacts in section B (e.g., solution-design) |
| Cross-domain reverse salient | Hidden connection between sections |
| Innovation thesis | Larry's insight: "This market trend enables that technical approach" |

### Edge types the graph writer produces

scripts/hsi-to-graph.cjs writes two edge types to the local SQLite graph:

| Edge | Between | Key properties |
|------|---------|----------------|
| HSI_CONNECTION | two Artifact nodes | hsi_score, lsa_sim, semantic_sim, surprise_type (re-derived through direction-convention), breakthrough_potential, tier, plus hsi_percentile, hsi_z, lexical_sim, bm25_sim, rank when present |
| REVERSE_SALIENT | two Section nodes | differential_score, innovation_type, source_artifact, target_artifact, innovation_thesis |

Relationship words such as ENABLES, INFORMS, CONTRADICTS, CONVERGES and INVALIDATES are interpretive
labels Larry may propose in conversation after reading the pair. The scripts do not assign them, and a
high score does not by itself justify one.

### Pair selection when writing edges

A results file ranked by percentile is written as-is (compute-hsi already kept the top of the room's
distribution). A legacy file keeps pairs with hsi_score >= 0.30. `--min-score x` forces
hsi_score >= x for either.

### Neo4j storage (when Brain connected)

Brain writes are anonymised: scripts/whitespace-to-brain.cjs stores problem type, framework chain,
density, rank and a scrubbed hypothesis, never room names, paths or bracketed artifact titles.

---

## Whitespace Tools (the other half of this package)

| Script | Reads | Writes |
|--------|-------|--------|
| compute-whitespace-embeddings.py | room artifacts | .mindrian/whitespace-embeddings.json (content-hash cache, chunked, optional claim vectors) |
| compute-whitespace-gaps.py | embeddings + brain-baseline.json (+ .hsi-results.json) | .mindrian/whitespace-results.json: gaps ranked by the mean percentile of KDE, k-NN, dense-cosine and lexical sparsity (--gap-method legacy restores the 10th-percentile-of-room-density rule), novelty scores with percentile and band, umap_2d |
| interpret-whitespace.cjs | whitespace-results.json | .mindrian/interpretation-results.json: problem type, framework chain, three-gate validation |
| compute-external-whitespace.py | external-papers.json + embeddings | .mindrian/external-whitespace-results.json (percentile selection, source trail per paper) |
| discover-hsi-whitespace.py | .hsi-results.json + embeddings | discovery-hsi-whitespace.json: the region between each surprising pair |
| discover-rs-whitespace.py | .hsi-results.json reverse_salients + embeddings | discovery-rs-whitespace.json: what lies downstream of each bottleneck |
| whitespace-to-graph.cjs / whitespace-to-brain.cjs | results files | WhitespaceZone nodes and edges (local graph) / anonymised Brain nodes |
| write-whitespace-sections.cjs | results files | one WHITESPACE.md per section folder |

All of them record in their output what was compared (provenance), where each claim came from
(source_trail) and that the novelty check ran against the room only.

---

## Integration with the Cross-Relationship Discovery Loop

```
Artifact filed (from meeting or methodology session)
    |
Cross-relationship scan
    |
Tier 0 (numpy only): BM25 + LSA lexical leg, --allow-lexical-only
Tier 1 (sentence-transformers): LSA + BM25 + dense embeddings
Tier 2 (Pinecone Brain): LSA + BM25 + stored embeddings
    |
Hidden connections surfaced -> Larry presents -> user APPROVE / REJECT / DEFER
    |
Graph edges created -> Dashboard updated -> knowledge compounds
```

---

## Source Files

Original HSI codebase (Jonathan's research):
- `lsa.py` - LSA similarity computation (TF-IDF + TruncatedSVD)
- `sts_bert.py` - BERT semantic similarity (segment-aware cosine)
- `comparison.py` - Differential analysis + reverse salient extraction
- `paper_gathering.py` - Scopus API document acquisition
- `paper_cleaning.py` - Text preprocessing
- `lsa_bert_similarity.py` - Combined LSA + BERT pipeline
- `hybrid_index.py` - HSI computation with integrative scoring

The research code used BERT-large for the semantic leg. The plugin replaces it with a small
sentence-transformers model so that it runs on CPU without a GPU; scores from the two are not
interchangeable, which is one reason the plugin ranks by percentile within the room.
