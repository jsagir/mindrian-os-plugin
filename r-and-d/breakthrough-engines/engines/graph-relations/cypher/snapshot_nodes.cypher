// Read-only. Node snapshot for the relationship agent. Parameters: $labels (list of labels).
MATCH (n)
WHERE any(l IN labels(n) WHERE l IN $labels)
RETURN elementId(n) AS id,
       labels(n) AS labels,
       coalesce(n.name, n.label, n.term, n.id) AS name,
       n.problem_type AS problem_type,
       n.discipline AS discipline,
       n.domain AS domain,
       n.jtbd_anchor AS jtbd_anchor,
       left(coalesce(n.definition, n.description, n.core_principles, n.key_insight, n.lesson, n.pws_definition, ''), 600) AS text
