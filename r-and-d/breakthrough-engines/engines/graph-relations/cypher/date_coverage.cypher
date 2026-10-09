// Read-only. How many semantic relationships carry created_at (decides whether a backtest is possible).
MATCH ()-[r]->()
WHERE type(r) IN $types
RETURN type(r) AS type, count(r) AS total, count(r.created_at) AS dated, min(toString(r.created_at)) AS first, max(toString(r.created_at)) AS last
ORDER BY total DESC
