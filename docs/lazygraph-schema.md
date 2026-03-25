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

ENABLES and INVALIDATES require explicit frontmatter markers in Tier 1. Full automatic detection is a Tier 2 capability requiring Pinecone semantic analysis.

---

*Schema version: 1.0 (Phase 15)*
*Engine: KuzuDB 0.11.3 (embedded, Apache 2.0)*
