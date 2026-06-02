-- tests/fixtures/phase-131/sample-room/seed.sql
-- Phase 131-06 minimal seeded room for the instrumented E2E suite (the phase
-- release gate). Trimmed from tests/fixtures/phase-130/sample-room/seed.sql.
-- Idempotent via INSERT OR IGNORE: re-applying yields an identical room. Schema
-- assumptions: applies AFTER openRoomDb has bootstrapped the lazygraph + memory
-- schema (nodes/edges tables present, foreign_keys ON).
--
-- The 5 E2E tests drive the FULL Phase 131 source-lens pipeline
--   research-context-extractor.extractContext (Stage 1+2+3)
--     -> source-lens-driver.runSourceLens (Stage 4, fetchCorpus stubbed)
--       -> research-filing-selector.buildFilingSelector (Stage 6)
--         -> findings-wirer.wireAccept / wireReject / wireDefer (Stage 7)
-- end to end ONLY through lib/core/navigation.cjs. The wirer writes an
-- EvidenceClaim node then a cascade edge FROM that EvidenceClaim node TO a target
-- node. The edges table carries a FOREIGN KEY to nodes(id) with PRAGMA
-- foreign_keys ON, so the edge target MUST already exist as a node or the INSERT
-- fails (the recurring Phase 129 / 130 FK incident). This seed pre-empts that
-- incident BY CONSTRUCTION on BOTH target kinds:
--
--   LOCAL section/claim targets (the local-node-id edge target convention
--   'section:' + section + the local claim nodes):
--     section:financial-model     -- the build-thesis filing destination (test 1, 2)
--     section:problem-definition  -- the user-needs filing destination (test 3)
--     section:market-analysis     -- a secondary / contrast destination
--     claim:cost-curve-stale      -- a CONTRADICTS / SUPERSEDES local target
--     EvidenceClaim:prior-cost    -- a prior EvidenceClaim (the dedup seed, test 5)
--
--   TEACHING-GRAPH target (the canonical correlation_id-keyed target node the
--   user-needs flow (test 3) lands an INFORMS edge on, resolved REAL via
--   lib/lens-engine/correlation-resolver.cjs over the correlation_labels index
--   below; the id is computeCorrelationId('SWOT Analysis','Framework') from the
--   REAL 130.7 hash -- seeded as a node so the FK holds). See the test header for
--   why the id is computed at runtime and the node is seeded by the test, NOT
--   here (the correlation_id is a runtime hash, not a static literal in SQL).
--
-- The correlation_labels index BODY (the REAL resolver's data source) is NOT a
-- room.db row -- it is a section body the test supplies to the resolver via
-- buildFilingSelector/wireAccept opts.correlationLabelsSection, serialized at
-- runtime via 130.7's serializeLabelIndex (a teaching-graph target name +
-- a cross-label duplicate). The room.db seed only carries the FK anchor nodes.
--
-- Counts: 1 room + 3 sections + 1 claim + 1 prior EvidenceClaim = 6 nodes.
-- NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

BEGIN;

-- 1 room node.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('room:phase-131-fixture', 'room', '{"name":"phase-131-fixture","stage":"discovery"}', 'fixture:sample-room', 'system', 1.0, 'confirmed', 1714694400000, 1714694400000, NULL);

-- 3 section nodes -- the LOCAL filing destinations (the 'section:' + section
-- node-id convention the findings-wirer resolves a local target to). financial-model
-- is the build-thesis destination; problem-definition is the user-needs destination;
-- market-analysis is a contrast / secondary destination.
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES
  ('section:financial-model', 'section', '{}', 'sample-room/financial-model', 'system', 1.0, 'confirmed', 1714694401000, 1714694401000, 'financial-model'),
  ('section:problem-definition', 'section', '{}', 'sample-room/problem-definition', 'system', 1.0, 'confirmed', 1714694402000, 1714694402000, 'problem-definition'),
  ('section:market-analysis', 'section', '{}', 'sample-room/market-analysis', 'system', 1.0, 'confirmed', 1714694403000, 1714694403000, 'market-analysis');

-- 1 claim node tagged needs_evidence so evidence_gaps is non-empty (the pre-flight
-- Stage 1 input 6 surfaces it; it is ALSO the CONTRADICTS / SUPERSEDES local target
-- a finding can kill / supersede).
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('claim:cost-curve-stale', 'claim', '{"text":"Per-dose COGS is flat through 2025"}', 'sample-room/financial-model/claim-001.md', 'user', 0.4, 'needs_evidence', 1714694501000, 1714694501000, 'financial-model');

-- 1 prior EvidenceClaim node -- the dedup seed (test 5). Its url matches a stubbed
-- fetched item so the Stage 4 dedup suppresses the re-file. review_status proposed
-- (an EvidenceClaim is a TRUTH-CLAIM node, never auto-confirmed per Canon Part 9).
INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section)
VALUES ('EvidenceClaim:prior-cost', 'EvidenceClaim', '{"source":"OpenAlex","url":"https://openalex.org/W-DEDUP","retrieved_at":"2026-05-01T00:00:00Z","evidence_tier":"Academic","topic":"CAR-T cost curve","summary":"Prior filed cost-curve finding"}', 'research:OpenAlex:prior', 'system', NULL, 'proposed', 1714694601000, 1714694601000, 'financial-model');

COMMIT;
