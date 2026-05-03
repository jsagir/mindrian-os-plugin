-- Fixture: CREATE INDEX on a missing table.
-- The hook MUST exit 1 because nonexistent_table is not in any alias set.
CREATE INDEX idx_x ON nonexistent_table(some_column);
