-- Fixture: ALTER TABLE ADD COLUMN.
-- The hook MUST exit 0 because additive column changes are always allowed
-- (D-05 additive carve-out).
ALTER TABLE nodes ADD COLUMN review_status TEXT NOT NULL DEFAULT 'proposed';
ALTER TABLE nodes ADD COLUMN created_by TEXT;
