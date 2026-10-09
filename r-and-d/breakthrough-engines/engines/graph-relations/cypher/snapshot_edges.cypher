// Read-only. Semantic relationships between the snapshot nodes. Parameters: $labels, $types.
MATCH (a)-[r]->(b)
WHERE type(r) IN $types
  AND any(l IN labels(a) WHERE l IN $labels)
  AND any(l IN labels(b) WHERE l IN $labels)
RETURN elementId(a) AS s, elementId(b) AS t, type(r) AS type, toString(r.created_at) AS created_at
