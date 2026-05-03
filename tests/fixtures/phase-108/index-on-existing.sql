-- Fixture: CREATE INDEX on an existing table.
-- The hook MUST exit 0 because nodes + assumptions are in
-- ALLOWED_EXISTING_TABLES (sourced from lazygraph-ops.cjs + memory-ops.cjs).
CREATE INDEX IF NOT EXISTS idx_nodes_review_status ON nodes(review_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assumptions_section ON assumptions(section);
