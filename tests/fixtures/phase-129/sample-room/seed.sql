-- tests/fixtures/phase-129/sample-room/seed.sql
-- Phase 129-05 minimal seeded room for the instrumented proactive-loop
-- acceptance test. Idempotent via INSERT OR IGNORE. Re-applying yields an
-- identical room. Schema assumptions: applies AFTER openRoomDb has bootstrapped
-- the lazygraph + memory schema (nodes/edges tables present, foreign_keys ON).
--
-- The proactive loop (status -> suggest-next -> act -> completion) drives the
-- spine helpers (logSpineRead / logSuggestionSurfaced / logWorkflowStage), which
-- open room.db internally and write memory_event rows. The loop does not need a
-- 500-node corpus; it needs just enough graph to resolve a real focus decision
-- node plus the two sections/artifacts it references. Trimmed from the phase-109
-- 500-node seed to the minimum the loop touches.
--
-- Counts: 1 room + 2 sections + 2 artifacts + 1 decision = 6 nodes.
-- NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

BEGIN;

-- 1 room node.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('room:phase-129-fixture', 'room', '{"name":"phase-129-fixture","stage":"discovery"}', 'fixture:sample-room', 'system', 1.0, 'confirmed', 1714694400000, 1714694400000, NULL);

-- 2 section nodes.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES
  ('section:problem-definition', 'section', '{}', 'sample-room/problem-definition', 'system', 1.0, 'confirmed', 1714694401000, 1714694401000, 'problem-definition'),
  ('section:solution-design', 'section', '{}', 'sample-room/solution-design', 'system', 1.0, 'confirmed', 1714694402000, 1714694402000, 'solution-design');

-- 2 artifact nodes (one per section) the decision references.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES
  ('artifact:001', 'artifact', '{"title":"Artifact 001","section":"problem-definition"}', 'sample-room/problem-definition/artifact-001.md', 'user', 0.7, 'confirmed', 1714694501000, 1714694501000, 'problem-definition'),
  ('artifact:002', 'artifact', '{"title":"Artifact 002","section":"solution-design"}', 'sample-room/solution-design/artifact-002.md', 'user', 0.7, 'confirmed', 1714694502000, 1714694502000, 'solution-design');

-- 1 decision node the loop resolves as its focus.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('decision:mcp-app-first', 'decision', '{"text":"Ship the MCP app first"}', 'sample-room/solution-design/decision-001.md', 'user', 0.8, 'confirmed', 1714694601000, 1714694601000, 'solution-design');

COMMIT;
