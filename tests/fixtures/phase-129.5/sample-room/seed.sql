-- tests/fixtures/phase-129.5/sample-room/seed.sql
-- Phase 129.5-03 minimal seeded room for the instrumented truth-machine
-- acceptance test. Idempotent via INSERT OR IGNORE. Re-applying yields an
-- identical room. Schema assumptions: applies AFTER openRoomDb has bootstrapped
-- the lazygraph + memory schema (nodes/edges tables present, foreign_keys ON).
--
-- The truth-machine flow (a human APPROVE at a Decision Gate promotes a PROPOSED
-- truth-claim node to confirmed) needs at least one proposed truth-claim node to
-- promote, plus a second proposed truth-claim node the agent-confirm path can be
-- REJECTED against. The acceptance test confirms a `decision` node (cleanest:
-- the getRiskyAssumptions disjointness invariant is untouched because no
-- assumption node is promoted).
--
-- Counts: 1 room + 1 section + 1 proposed decision + 1 proposed claim = 4 nodes.
-- Both truth-claim nodes start at review_status='proposed' so the confirm flow
-- has real promotion work to do.
-- NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

BEGIN;

-- 1 room node.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('room:phase-129.5-fixture', 'room', '{"name":"phase-129.5-fixture","stage":"discovery"}', 'fixture:sample-room', 'system', 1.0, 'confirmed', 1714694400000, 1714694400000, NULL);

-- 1 section node.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('section:solution-design', 'section', '{}', 'sample-room/solution-design', 'system', 1.0, 'confirmed', 1714694402000, 1714694402000, 'solution-design');

-- 1 PROPOSED decision node: the truth-claim the human APPROVE promotes to confirmed.
-- created_by='larry' so it reads as an agent proposal awaiting human confirmation.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('decision:ship-mcp-first', 'decision', '{"summary":"Ship the MCP app first","text":"Ship the MCP app first"}', 'sample-room/solution-design/decision-001.md', 'larry', 0.8, 'proposed', 1714694601000, 1714694601000, 'solution-design');

-- 1 PROPOSED claim node: the truth-claim the agent-attributed confirm is REJECTED against.
-- It stays proposed because no human ever APPROVEs it.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('claim:market-ready', 'claim', '{"summary":"The market is ready for the MCP app","claim":"The market is ready for the MCP app"}', 'sample-room/solution-design/claim-001.md', 'larry', 0.6, 'proposed', 1714694602000, 1714694602000, 'solution-design');

COMMIT;
