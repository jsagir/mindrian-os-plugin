---
title: Causal Layer Schema Reference
description: >
  KuzuDB node and edge schema for the causal reasoning layer.
  Use this document as context when generating Cypher queries for causal analysis.
version: 1.7.0
---

# Causal Layer Schema Reference

> Extension to LazyGraph schema for causal reasoning.
> CausalClaim nodes and causal edges store extracted causal intelligence.

## Node Types

### CausalClaim

Represents a single cause-effect assertion extracted from a room artifact.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| id | STRING (PK) | -- | Unique claim ID, e.g. causal-0001 |
| cause | STRING | -- | What produces the effect (max 200 chars) |
| mechanism | STRING | -- | HOW the cause produces the effect (max 300 chars) |
| effect | STRING | -- | What happens as a result (max 200 chars) |
| confidence | DOUBLE | 0.5 | Dynamic: observed=0.7, asserted=0.5, inferred=0.3 initial |
| evidence | STRING | '[]' | JSON array of supporting artifact IDs |
| source_artifact | STRING | '' | Primary artifact ID this was extracted from |
| domain | STRING | 'general' | materials, business, competitive, financial, team, legal, general |
| falsifiable_prediction | STRING | '' | Testable prediction that would disprove this claim |
| novelty_score | DOUBLE | 0.0 | Graph neighborhood uniqueness (0-1) |
| extraction_method | STRING | 'inferred' | observed, asserted, inferred |
| created | STRING | '' | Date extracted (YYYY-MM-DD) |

## Edge Types

### CAUSES (Artifact -> Artifact)
Direct causal relationship between artifacts.

| Property | Type | Default |
|----------|------|---------|
| mechanism | STRING | '' |
| confidence | DOUBLE | 0.0 |
| framework | STRING | '' |
| direction | STRING | 'forward' |

### ROOT_CAUSE_OF (Artifact -> Artifact)
Multi-hop root cause chain.

| Property | Type | Default |
|----------|------|---------|
| chain_length | INT64 | 1 |
| intermediate_causes | STRING | '[]' |
| confidence | DOUBLE | 0.0 |
| discovery_source | STRING | 'manual' |

### CASCADES_TO (CausalClaim -> CausalClaim)
Assumption failure propagation between claims.

| Property | Type | Default |
|----------|------|---------|
| cascade_type | STRING | 'invalidation' |
| severity | STRING | 'medium' |
| path_length | INT64 | 1 |

### EXTRACTED_FROM (CausalClaim -> Artifact)
Provenance link from claim to source artifact. Every CausalClaim MUST have at least one.

No additional properties.

## Query Patterns

### Chain Traversal (bounded, no ACYCLIC)
```cypher
MATCH path = (start:CausalClaim)-[:CASCADES_TO*1..6]->(end:CausalClaim)
WHERE start.id = $claim_id
RETURN [n IN nodes(path) | n.id] AS chain,
       [n IN nodes(path) | n.cause] AS causes,
       length(path) AS depth
```

### Cross-Reference: Causal + HSI
```cypher
MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)
      -[h:HSI_CONNECTION]->(a2:Artifact)<-[:EXTRACTED_FROM]-(c2:CausalClaim)
WHERE c1.id <> c2.id
RETURN c1.id, c2.id, h.hsi_score, h.surprise_type
```

### Cross-Reference: Causal + Reverse Salient
```cypher
MATCH (c:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[:BELONGS_TO]->(s1:Section)
      -[rs:REVERSE_SALIENT]->(s2:Section)
RETURN c.id, s1.name, s2.name, rs.innovation_thesis
```

### Cross-Reference: Causal + Analogy
```cypher
MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)
      -[an:ANALOGOUS_TO]->(a2:Artifact)<-[:EXTRACTED_FROM]-(c2:CausalClaim)
WHERE c1.id <> c2.id
RETURN c1.id, c2.id, an.analogy_distance, an.structural_fitness
```
