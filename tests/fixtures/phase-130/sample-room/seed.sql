-- tests/fixtures/phase-130/sample-room/seed.sql
-- Phase 130-04 minimal seeded room for the instrumented lens-engine E2E suite
-- (the phase release gate). Idempotent via INSERT OR IGNORE. Re-applying yields
-- an identical room. Schema assumptions: applies AFTER openRoomDb has bootstrapped
-- the lazygraph + memory schema (nodes/edges tables present, foreign_keys ON).
--
-- The 8 E2E tests drive lib/core/lens-engine.cjs rotate() through navigation.cjs:
-- the engine writes lens_finding nodes, then the onAccept / onReject hooks write
-- INFORMS / REJECTED_BECAUSE edges FROM those lens_finding nodes TO a target node.
-- The edges table carries a FOREIGN KEY to nodes(id) with PRAGMA foreign_keys ON,
-- so the edge target MUST already exist as a node or the INSERT fails (the
-- recurring Phase 129 FK incident). This seed provides those FK anchor nodes:
--   decision:ship-mcp-first  -- the INFORMS edge target (an accept routes to it)
--   assumption:market-ready  -- the REJECTED_BECAUSE edge target (a reject routes to it)
--
-- The lens_finding source nodes are written at runtime by the engine via
-- navigation.writeLensFinding; they are NOT seeded here. The persona-aware framing
-- E2E reads role_blend from a USER.md the test writes in setupRoom (not in this
-- SQL file -- role_blend lives in USER.md frontmatter per Phase 115, LOCAL only).
--
-- Counts: 1 room + 2 sections + 2 artifacts + 1 decision + 1 assumption = 7 nodes.
-- NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

BEGIN;

-- 1 room node.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('room:phase-130-fixture', 'room', '{"name":"phase-130-fixture","stage":"discovery"}', 'fixture:sample-room', 'system', 1.0, 'confirmed', 1714694400000, 1714694400000, NULL);

-- 2 section nodes.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES
  ('section:problem-definition', 'section', '{}', 'sample-room/problem-definition', 'system', 1.0, 'confirmed', 1714694401000, 1714694401000, 'problem-definition'),
  ('section:solution-design', 'section', '{}', 'sample-room/solution-design', 'system', 1.0, 'confirmed', 1714694402000, 1714694402000, 'solution-design');

-- 2 artifact nodes (one per section) the decision references.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES
  ('artifact:001', 'artifact', '{"title":"Artifact 001","section":"problem-definition"}', 'sample-room/problem-definition/artifact-001.md', 'user', 0.7, 'confirmed', 1714694501000, 1714694501000, 'problem-definition'),
  ('artifact:002', 'artifact', '{"title":"Artifact 002","section":"solution-design"}', 'sample-room/solution-design/artifact-002.md', 'user', 0.7, 'confirmed', 1714694502000, 1714694502000, 'solution-design');

-- 1 decision node -- the FK anchor the onAccept INFORMS edge points TO.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('decision:ship-mcp-first', 'decision', '{"text":"Ship the MCP app first"}', 'sample-room/solution-design/decision-001.md', 'user', 0.8, 'confirmed', 1714694601000, 1714694601000, 'solution-design');

-- 1 assumption node -- the FK anchor the onReject REJECTED_BECAUSE edge points TO.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('assumption:market-ready', 'assumption', '{"text":"The market is ready today"}', 'sample-room/problem-definition/assumption-001.md', 'user', 0.5, 'proposed', 1714694701000, 1714694701000, 'problem-definition');

COMMIT;
