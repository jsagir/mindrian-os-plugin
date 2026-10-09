// Read-only. Is there already a relationship (any type, any direction) between two nodes? Parameters: $a, $b.
MATCH (a)-[r]-(b) WHERE elementId(a) = $a AND elementId(b) = $b
RETURN type(r) AS type, startNode(r) = a AS a_to_b
