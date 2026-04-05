# LazyGraph Schema Reference

> KuzuDB embedded graph schema for per-project knowledge graphs.
> Use this document as context when generating Cypher queries from natural language.

---

## Node Types

### Artifact

Represents a single markdown file (entry) in the Data Room.

| Property | Type | Description |
|----------|------|-------------|
| `id` | STRING (PK) | Relative path without .md extension, e.g. `problem-definition/market-trends` |
| `title` | STRING | Extracted from first `# Heading` in file |
| `section` | STRING | Top-level folder name, e.g. `market-analysis` |
| `methodology` | STRING | Frontmatter `methodology:` value (if present) |
| `created` | STRING | Frontmatter `date:` value (if present) |
| `content_hash` | STRING | MD5 first 8 hex chars -- for change detection |

### Section

Represents a top-level room folder (subsystem in Simon's hierarchy).

| Property | Type | Description |
|----------|------|-------------|
| `name` | STRING (PK) | Folder name, e.g. `market-analysis` |
| `label` | STRING | Human-readable label, e.g. `MARKET ANALYSIS` |

---

## Relationship Types

All relationships are directed. Source and target types noted.

### INFORMS (Artifact -> Artifact)

Created when an artifact contains a `[[wikilink]]` pointing to another section. Indicates that the source artifact references or builds upon the target.

| Property | Type | Description |
|----------|------|-------------|
| *(none)* | | Presence indicates the relationship |

### CONTRADICTS (Artifact -> Artifact)

Created when a `[[wikilink]]` appears near contradiction terms ("however", "contradicts", "unlike", "disagrees", "conflicts", "contrary", "opposes"). Indicates a conflict between claims.

| Property | Type | Description |
|----------|------|-------------|
| `confidence` | STRING | Detection confidence: `medium` (proximity-based, Tier 1) |

### CONVERGES (Artifact -> Artifact)

Created when themes from one artifact appear in 3+ other sections. Indicates convergent thinking across subsystems.

| Property | Type | Description |
|----------|------|-------------|
| `term` | STRING | The converging theme or term |

### ENABLES (Artifact -> Artifact)

Created from explicit `enables:` frontmatter marker. Indicates that the source artifact unblocks or makes possible the target.

| Property | Type | Description |
|----------|------|-------------|
| *(none)* | | Presence indicates the relationship |

### INVALIDATES (Artifact -> Artifact)

Created from explicit `invalidates:` frontmatter marker. Indicates that the source artifact makes the target's assumptions stale.

| Property | Type | Description |
|----------|------|-------------|
| *(none)* | | Presence indicates the relationship |

### BELONGS_TO (Artifact -> Section)

Every artifact belongs to exactly one section.

| Property | Type | Description |
|----------|------|-------------|
| *(none)* | | Structural membership |

### CAUSES (Artifact -> Artifact)

Created when one artifact directly causes or triggers effects described in another. Detected via explicit `causes:` frontmatter, Brain enrichment causal chains, or proximity terms near causal language ("causes", "triggers", "leads to", "results in").

| Property | Type | Description |
|----------|------|-------------|
| `mechanism` | STRING | How the cause produces the effect |
| `confidence` | DOUBLE | Detection confidence (0.0-1.0) |
| `framework` | STRING | Framework or methodology that identified the relationship |
| `direction` | STRING | `forward` (default) or `backward` for reverse tracing |

### ROOT_CAUSE_OF (Artifact -> Artifact)

Traces backward through a causal chain to identify the root cause of a problem or symptom. Created by Brain enrichment or explicit multi-hop causal analysis.

| Property | Type | Description |
|----------|------|-------------|
| `chain_length` | INT64 | Number of intermediate causes in the chain |
| `intermediate_causes` | STRING | JSON array of artifact IDs in the causal chain |
| `confidence` | DOUBLE | Confidence decreases with chain length (1/(depth+1)) |
| `discovery_source` | STRING | `manual`, `brain_enrichment`, or `cascade_analysis` |

---

## Example Cypher Queries

Use these patterns when translating natural language questions to Cypher.

### What artifacts are in a specific section?

```cypher
MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section {name: 'market-analysis'})
RETURN a.title, a.id
```

### What contradicts my pricing model?

```cypher
MATCH (a:Artifact)-[:CONTRADICTS]->(b:Artifact)
WHERE b.title CONTAINS 'pricing'
RETURN a.title, a.section
```

### What informs the solution design?

```cypher
MATCH (a:Artifact)-[:INFORMS]->(b:Artifact)
WHERE b.section = 'solution-design'
RETURN a.title, a.section
```

### Show all cross-section relationships

```cypher
MATCH (a:Artifact)-[r]->(b:Artifact)
WHERE a.section <> b.section
RETURN a.title, type(r), b.title
```

### Which sections are most connected?

```cypher
MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section)
WITH s, count(a) AS artifacts
RETURN s.name, artifacts
ORDER BY artifacts DESC
```

### Find all contradictions in the room

```cypher
MATCH (a:Artifact)-[c:CONTRADICTS]->(b:Artifact)
RETURN a.title, a.section, b.title, b.section, c.confidence
```

### What does a specific artifact inform?

```cypher
MATCH (a:Artifact {id: 'problem-definition/market-trends'})-[:INFORMS]->(b:Artifact)
RETURN b.title, b.section
```

### What causes problems in this room?

```cypher
MATCH (a:Artifact)-[r:CAUSES]->(b:Artifact)
RETURN a.title AS cause, b.title AS effect, r.mechanism, r.confidence
ORDER BY r.confidence DESC
```

### Trace root causes of a specific issue

```cypher
MATCH (root:Artifact)-[r:ROOT_CAUSE_OF]->(symptom:Artifact)
WHERE symptom.title CONTAINS 'churn'
RETURN root.title, r.chain_length, r.intermediate_causes, r.confidence
```

### Find all causal chains across sections

```cypher
MATCH (a:Artifact)-[r:CAUSES]->(b:Artifact)
WHERE a.section <> b.section
RETURN a.title, a.section, b.title, b.section, r.mechanism
```

### Graph overview statistics

```cypher
MATCH (a:Artifact) RETURN count(a) AS total_artifacts
```

```cypher
MATCH ()-[r]->() RETURN type(r) AS relationship, count(r) AS count
```

---

## KuzuDB Cypher Dialect Notes

KuzuDB implements a subset of Cypher with some differences from Neo4j. Keep these in mind when generating queries.

### No APOC

KuzuDB does not support APOC procedures. All queries must use built-in Cypher.

### Walk Semantics for Variable-Length Paths

KuzuDB uses walk semantics (may revisit nodes/edges). Always add upper bounds to variable-length paths to avoid infinite traversal:

```cypher
-- Good: bounded path
MATCH (a:Artifact)-[:INFORMS*1..5]->(b:Artifact) RETURN a.title, b.title

-- Bad: unbounded (may not terminate)
MATCH (a:Artifact)-[:INFORMS*]->(b:Artifact) RETURN a.title, b.title
```

### SHORTEST Keyword

Use `SHORTEST` for shortest path queries:

```cypher
MATCH p = SHORTEST 1 (a:Artifact)-[:INFORMS* 1..10]->(b:Artifact)
WHERE a.id = 'problem-definition/core-problem' AND b.section = 'financial-model'
RETURN nodes(p), length(p)
```

### List Functions Use list_ Prefix

KuzuDB list functions use `list_` prefix instead of Neo4j syntax:

```cypher
-- KuzuDB: list_contains, list_extract, list_len
-- Neo4j equivalent: IN, [], size()
```

### Schema-First Requirement

All node and relationship tables must be created before data insertion. The LazyGraph uses `CREATE ... IF NOT EXISTS` for idempotent schema initialization.

### No OPTIONAL MATCH

KuzuDB does not support `OPTIONAL MATCH`. Use `MATCH` and handle empty results in application code.

---

## Edge Detection Tiers

| Edge Type | Tier 1 (Current) | Tier 2 (Pinecone) |
|-----------|-------------------|---------------------|
| INFORMS | `[[wikilink]]` detection | + semantic similarity |
| CONTRADICTS | Proximity terms near wikilinks | + embedding contradiction detection |
| CONVERGES | Theme frequency (3+ sections) | + semantic clustering |
| ENABLES | Explicit `enables:` frontmatter only | + causal inference |
| INVALIDATES | Explicit `invalidates:` frontmatter only | + temporal staleness detection |
| BELONGS_TO | File location (automatic) | Same |
| CAUSES | Explicit `causes:` frontmatter + proximity causal terms | + Brain enrichment causal chains |
| ROOT_CAUSE_OF | Brain enrichment multi-hop chains only | + automated chain discovery |

ENABLES and INVALIDATES require explicit frontmatter markers in Tier 1. CAUSES supports both frontmatter and proximity detection. ROOT_CAUSE_OF primarily comes from Brain enrichment. Full automatic detection is a Tier 2 capability requiring Pinecone semantic analysis or Brain causal graph queries.

---

---

## Causal Reasoning Layer (v1.7.0)

### CausalClaim (Node Type)

Represents a single cause-effect assertion extracted from a room artifact by Larry.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | STRING (PK) | -- | Unique claim ID, e.g. `causal-0001` |
| `cause` | STRING | -- | What produces the effect (max 200 chars) |
| `mechanism` | STRING | -- | HOW the cause produces the effect (max 300 chars) |
| `effect` | STRING | -- | What happens as a result (max 200 chars) |
| `confidence` | DOUBLE | 0.5 | Dynamic confidence: observed=0.7, asserted=0.5, inferred=0.3 initial; updated by predictions, contradictions, age decay, cross-refs |
| `evidence` | STRING | '[]' | JSON array of supporting artifact IDs |
| `source_artifact` | STRING | '' | Primary artifact ID this was extracted from |
| `domain` | STRING | 'general' | materials, business, competitive, financial, team, legal, general |
| `falsifiable_prediction` | STRING | '' | Testable prediction that would disprove this claim |
| `novelty_score` | DOUBLE | 0.0 | How surprising vs consensus (graph neighborhood uniqueness) |
| `extraction_method` | STRING | 'inferred' | observed, asserted, inferred -- affects initial confidence |
| `created` | STRING | '' | Date extracted (YYYY-MM-DD) |

### CASCADES_TO (CausalClaim -> CausalClaim)

Tracks assumption failure propagation. If source claim is invalidated, target claim is at risk.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cascade_type` | STRING | 'invalidation' | invalidation, weakening, reversal |
| `severity` | STRING | 'medium' | low, medium, high, critical |
| `path_length` | INT64 | 1 | Hops from original failure point |

### EXTRACTED_FROM (CausalClaim -> Artifact)

Links a causal claim back to the artifact it was extracted from. Every CausalClaim MUST have at least one EXTRACTED_FROM edge for provenance.

No additional properties -- the edge itself is the provenance link.

### Relationship to Existing Edges

CausalClaim operates as a **semantic layer ON TOP of the Artifact graph**:

```
Artifact Graph (structural):
  [market-pain.md] --HSI_CONNECTION--> [coating-mechanism.md]

Causal Layer (semantic):
  [downtime-cost-claim] --CASCADES_TO--> [coating-adoption-claim]
        |                                        |
  EXTRACTED_FROM                           EXTRACTED_FROM
        |                                        |
  [market-pain.md]                       [coating-mechanism.md]
```

The existing CAUSES and ROOT_CAUSE_OF edges (Artifact -> Artifact) capture direct causal relationships at the artifact level. CausalClaim nodes provide finer-grained claim-level causal reasoning with mechanisms and falsifiable predictions.

---

*Schema version: 1.2 (Phase 52 - CausalClaim node + CASCADES_TO + EXTRACTED_FROM added)*
*Engine: KuzuDB 0.11.3 (embedded, Apache 2.0)*
