-- Fixture: in-alias CREATE TABLE.
-- The hook MUST exit 0 because banked_by_audit derives from BANKED_BY in
-- node_aliases (resolution NEW; canonical edge name lowercased + _audit suffix
-- is allowed by buildAllowedTableSet).
CREATE TABLE IF NOT EXISTS banked_by_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id TEXT NOT NULL,
  banked_at INTEGER NOT NULL
);
