---
title: Causal Layer Schema Reference
description: >
  KuzuDB node and edge schema for the causal reasoning layer.
  Use this document as context when generating Cypher queries for causal analysis.
version: 1.7.0
---

# Causal Layer Schema Reference

> Extension to LazyGraph schema for causal reasoning.
> CausalClaim nodes and CAUSES/CASCADES_TO edges store extracted causal intelligence.

---

## Node Types

### CausalClaim

Represents a single cause-effect assertion extracted from a room artifact.

| Property | Type | Description |
|----------|------|-------------|
| `id` | STRING (PK) | Unique claim ID, e.g. `causal-0001` |
| `cause` | STRING | What produces the effect (max 200 chars) |
| `effect` | STRING | What happens as a result (max 200 chars) |
| `mechanism` | STRING | HOW the cause produces the effect (max 300 chars) |
| `confidence` | DOUBLE | 0-1 scale based on evidence strength |
| `evidence` | STRING | JSON array of supporting artifact IDs |
| `source_artifact` | STRING | Artifact ID this was extracted from |
| `domain` | STRING | materials, business, competitive, financial, team, legal, general |
| `falsifiable_prediction` | STRING | Testable prediction that would disprove this claim |
| `novelty_score` | DOUBLE | 0-1 how surprising vs consensus (Jaccard distance) |
| `created` | STRING | Date extracted (YYYY-MM-DD) |

---

## Relationship Types

### CAUSES (CausalClaim -> CausalClaim)

Links claims into causal chains. A causes B causes C.

| Property | Type | Description |
|----------|------|-------------|
| `strength` | DOUBLE | 0-1 causal strength |
| `mechanism` | STRING | How source causes target |
| `direction` | STRING | forward, feedback, bidirectional |
| `discovery_method` | STRING | heuristic, llm, user, brain |

### CASCADES_TO (CausalClaim -> CausalClaim)

Tracks assumption failure propagation. If source claim is invalidated, target claim is at risk.

| Property | Type | Description |
|----------|------|-------------|
| `cascade_type` | STRING | invalidation, weakening, reversal |
| `severity` | STRING | low, medium, high, critical |
| `path_length` | INT64 | Hops from original failure point |

### EXTRACTED_FROM (CausalClaim -> Artifact)

Provenance link from causal claim back to source room artifact.

| Property | Type | Description |
|----------|------|-------------|
| *(none)* | | Presence indicates provenance |

---

## Example Cypher Queries

### All causal claims in a section

```cypher
MATCH (c:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[:BELONGS_TO]->(s:Section {name: 'market-analysis'})
RETURN c.id, c.cause, c.effect, c.mechanism, c.confidence
ORDER BY c.confidence DESC
```

### Causal chain traversal (forward, max 5 hops)

```cypher
MATCH (start:CausalClaim {id: 'causal-0001'})-[:CAUSES*1..5]->(downstream:CausalClaim)
RETURN start.cause, start.effect, downstream.cause, downstream.effect
```

### Cascade risk assessment

```cypher
MATCH (root:CausalClaim {id: 'causal-0003'})-[c:CASCADES_TO*1..3]->(at_risk:CausalClaim)
RETURN at_risk.id, at_risk.cause, at_risk.effect, at_risk.confidence
ORDER BY at_risk.confidence DESC
```

### Cross-section causal bridges

```cypher
MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)-[:BELONGS_TO]->(s1:Section),
      (c1)-[:CAUSES]->(c2:CausalClaim)-[:EXTRACTED_FROM]->(a2:Artifact)-[:BELONGS_TO]->(s2:Section)
WHERE s1.name <> s2.name
RETURN s1.name AS from_section, c1.effect AS bridge_effect, s2.name AS to_section, c2.cause AS triggered_cause
```

### Highest novelty claims

```cypher
MATCH (c:CausalClaim)
WHERE c.novelty_score > 0.6
RETURN c.id, c.cause, c.effect, c.mechanism, c.novelty_score
ORDER BY c.novelty_score DESC
LIMIT 10
```

### Graph overview

```cypher
MATCH (c:CausalClaim) RETURN count(c) AS total_claims
```

```cypher
MATCH ()-[r:CAUSES]->() RETURN count(r) AS causal_edges
```

```cypher
MATCH ()-[r:CASCADES_TO]->() RETURN count(r) AS cascade_edges
```

### Domain distribution

```cypher
MATCH (c:CausalClaim)
RETURN c.domain AS domain, count(c) AS claim_count
ORDER BY claim_count DESC
```

---

## KuzuDB Cypher Notes

Same dialect constraints as LazyGraph schema:
- No APOC
- Walk semantics for variable-length paths (always add upper bounds)
- Use `SHORTEST` for shortest path queries
- Use `list_` prefix functions
- No OPTIONAL MATCH

---

*Causal Layer Schema v1.7.0 — extension to LazyGraph Phase 15*
*Engine: KuzuDB 0.11.3 (embedded, Apache 2.0)*
