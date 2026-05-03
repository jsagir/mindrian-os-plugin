-- Fixture: out-of-alias CREATE TABLE.
-- The hook MUST exit 1 with SCHEMA DRIFT GUARD message because
-- parallel_opportunities is not in any alias resolution.
CREATE TABLE parallel_opportunities (
  id TEXT PRIMARY KEY,
  score REAL
);
