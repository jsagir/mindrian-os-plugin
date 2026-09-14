'use strict';
/*
 * tests/helpers/fixture-room-347.cjs -- Phase 347-02 Task 1: the
 * three-schema-variant chain-state fixture room builder.
 *
 * WD-347-5 (docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md, Section 7): a
 * NEW fixture helper is minted here rather than extending
 * tests/helpers/fixture-room-219.cjs, because 219's own run-all-219 gate
 * forbids raw node and edge inserts inside it, and this phase's writer
 * contract requires a LEGACY 3-column `nodes` table, which is only
 * reachable by direct DDL. Extending 219 would break 219's own gate. This
 * is a deliberate departure from the research recommendation, recorded in
 * the contract's own working-decision ledger.
 *
 * Three schema variants, matching lib/core/navigation/CONTEXT.md's own
 * "Three schema variants, one rule" section verbatim ("Migrated
 * (16-column), partially migrated (12-column), and legacy (3-column)
 * databases all exist in the live fleet at once"):
 *
 *   wide   -- the REAL fully migrated production shape: the Phase 109
 *             tightened nodes table (lib/core/migrations/
 *             phase-109-nodes-provenance.cjs::tightenSchemaWithCheckConstraints,
 *             12 columns: id, type, properties, source_path, created_by,
 *             confidence, review_status, created_at, last_seen_at,
 *             source_section, confirmed_by, confirmed_at) PLUS the Phase 160
 *             bitemporal columns (phase-160-nodes-bitemporal.cjs::NEW_COLUMNS:
 *             valid_from, valid_to, invalidated_at, last_modified_at) = 16
 *             columns total. Carries the same NOT NULL + CHECK constraints
 *             tightenSchemaWithCheckConstraints creates, so a caller that
 *             violates them here fails exactly as it would on a live room.
 *             edges carries the Phase 224 review_status column
 *             (phase-224-edge-review-status.cjs: additive, TEXT DEFAULT NULL).
 *             node-insert.cjs::isMigratedSchema (MIGRATED_MARKER_COLUMN =
 *             'source_path') reads this variant as migrated (true).
 *
 *   mid    -- a DELIBERATELY CONSTRUCTED 12-column variant that omits the
 *             one marker column node-insert.cjs::isMigratedSchema actually
 *             probes for (source_path), so isMigratedSchema reads it as
 *             un-migrated (false) even though it is far wider than the
 *             legacy 3-column shape. Every column name here is a real
 *             column drawn from the same two migration files above (created_by,
 *             confidence, review_status, created_at, last_seen_at,
 *             source_section, confirmed_by, confirmed_at, valid_from), none
 *             invented; the fixture simply never adds source_path, so
 *             insertNode's schema probe falls through to its legacy 3-column
 *             INSERT branch even though 9 more columns exist. This proves
 *             the both-schema-safety contract (D-02a) degrades gracefully
 *             on a wider-than-legacy table, not only on a bare 3-column one.
 *             Every column beyond id/type/properties is nullable here (no
 *             NOT NULL, no CHECK), since the legacy 3-column INSERT this
 *             variant forces never supplies them.
 *
 *   legacy -- the bare 3-column nodes table (id, type, properties) plus the
 *             base 4-column edges table, exactly
 *             lib/core/lazygraph-ops.cjs::initSchema's own DDL.
 *
 * Seeds one subject node per fixture, id 'section:test-subject', type
 * 'Section', through require('../../lib/core/node-insert.cjs').insertNode
 * on every variant, so an anchor target exists on all three and the legacy
 * branch of the node chokepoint is exercised by the fixture itself.
 *
 * Opens the temp room database directly with the DatabaseSync class from
 * Node's built-in SQLite module (never through lib/core/room-db.cjs::openRoomDb,
 * which would run 13 table-creation statements and 5 migrations on every
 * open and immediately upgrade the mid and legacy variants away from the
 * very shape this fixture exists to hold). tests/ is on
 * scripts/check-substrate.cjs's ALLOWED_DIRECT_IMPORT list, so a raw
 * built-in-SQLite handle here is sanctioned (mirrors
 * tests/test-343-room-graph-integrity.cjs's own precedent).
 *
 * Zero npm dependencies: node:fs, node:path, and the one built-in SQLite
 * require below only.
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { insertNode } = require('../../lib/core/node-insert.cjs');

// Frozen; iteration order is the fixture's own canonical variant order.
const SCHEMA_VARIANTS = Object.freeze(['wide', 'mid', 'legacy']);

const SUBJECT_NODE_ID = 'section:test-subject';
const SUBJECT_NODE_TYPE = 'Section';

// -- DDL per variant ----------------------------------------------------

// wide: the real tightened (Phase 109) + bitemporal (Phase 160) shape, 16
// columns, NOT NULL / CHECK constraints copied verbatim from
// tightenSchemaWithCheckConstraints so a caller that violates them fails
// exactly as it would against a live migrated room.
const NODES_DDL_WIDE =
  'CREATE TABLE nodes (' +
  '  id TEXT PRIMARY KEY, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  source_path TEXT NOT NULL, ' +
  "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
  '  confidence REAL, ' +
  "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
  "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
  '  created_at INTEGER NOT NULL, ' +
  '  last_seen_at INTEGER NOT NULL, ' +
  '  source_section TEXT, ' +
  '  confirmed_by TEXT, ' +
  '  confirmed_at INTEGER, ' +
  '  valid_from INTEGER, ' +
  '  valid_to INTEGER, ' +
  '  invalidated_at INTEGER, ' +
  '  last_modified_at INTEGER' +
  ')';

const EDGES_DDL_WIDE =
  'CREATE TABLE edges (' +
  '  source TEXT NOT NULL, ' +
  '  target TEXT NOT NULL, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  review_status TEXT DEFAULT NULL, ' +
  '  PRIMARY KEY (source, target, type)' +
  ')';

// mid: 12 columns, deliberately omitting source_path (the marker column),
// every non-base column nullable so the legacy 3-column INSERT branch (the
// only branch isMigratedSchema will select once source_path is absent) can
// still land a row without a NOT NULL failure.
const NODES_DDL_MID =
  'CREATE TABLE nodes (' +
  '  id TEXT PRIMARY KEY, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  created_by TEXT, ' +
  '  confidence REAL, ' +
  '  review_status TEXT, ' +
  '  created_at INTEGER, ' +
  '  last_seen_at INTEGER, ' +
  '  source_section TEXT, ' +
  '  confirmed_by TEXT, ' +
  '  confirmed_at INTEGER, ' +
  '  valid_from INTEGER' +
  ')';

// mid and legacy share the base 4-column edges shape (no review_status).
const EDGES_DDL_BASE =
  'CREATE TABLE edges (' +
  '  source TEXT NOT NULL, ' +
  '  target TEXT NOT NULL, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  PRIMARY KEY (source, target, type)' +
  ')';

// legacy: the bare 3-column nodes table, verbatim lazygraph-ops.cjs::initSchema.
const NODES_DDL_LEGACY =
  'CREATE TABLE nodes (' +
  '  id TEXT PRIMARY KEY, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}'" +
  ')';

function ddlForVariant(variant) {
  if (variant === 'wide') return { nodes: NODES_DDL_WIDE, edges: EDGES_DDL_WIDE };
  if (variant === 'mid') return { nodes: NODES_DDL_MID, edges: EDGES_DDL_BASE };
  if (variant === 'legacy') return { nodes: NODES_DDL_LEGACY, edges: EDGES_DDL_BASE };
  throw new Error('fixture-room-347: unknown schema variant ' + JSON.stringify(variant));
}

/**
 * buildChainFixtureRoom(tmpDir, variant) -> { roomDir, dbPath, db, subjectNodeId, variant }
 *
 * tmpDir: an existing writable directory (the caller owns cleanup, normally
 *   via fs.mkdtempSync). The room is created at tmpDir/room so the caller's
 *   directory stays inspectable, mirroring fixture-room-219.cjs's own shape.
 * variant: one of SCHEMA_VARIANTS ('wide', 'mid', 'legacy').
 */
function buildChainFixtureRoom(tmpDir, variant) {
  if (typeof tmpDir !== 'string' || tmpDir.length === 0) {
    throw new Error('fixture-room-347: tmpDir is required');
  }
  if (SCHEMA_VARIANTS.indexOf(variant) === -1) {
    throw new Error('fixture-room-347: unknown schema variant ' + JSON.stringify(variant));
  }
  const roomDir = path.join(tmpDir, 'room');
  const dbDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'room.db');

  const db = new DatabaseSync(dbPath);
  const ddl = ddlForVariant(variant);
  db.exec(ddl.nodes);
  db.exec(ddl.edges);

  // Seed the one subject node through the real node chokepoint, so an
  // anchor target exists on every variant and the legacy insert branch is
  // exercised by the fixture itself on mid and legacy.
  insertNode(db, SUBJECT_NODE_ID, SUBJECT_NODE_TYPE, JSON.stringify({}), {
    epistemic_type: 'observation',
  });

  return {
    roomDir: roomDir,
    dbPath: dbPath,
    db: db,
    subjectNodeId: SUBJECT_NODE_ID,
    variant: variant,
  };
}

/**
 * closeChainFixtureRoom(fixture) -- closes the open handle and removes the
 * temp directory tree the fixture was built under (tmpDir, the parent of
 * fixture.roomDir). Best-effort on the filesystem remove, mirroring the
 * repo's own rmrf idiom (tests/test-343-room-graph-integrity.cjs).
 */
function closeChainFixtureRoom(fixture) {
  if (!fixture || typeof fixture !== 'object') return;
  if (fixture.db && typeof fixture.db.close === 'function') {
    try { fixture.db.close(); } catch (_e) { /* best-effort */ }
  }
  const tmpDir = path.dirname(fixture.roomDir || '');
  if (tmpDir && tmpDir !== '.' && tmpDir !== path.sep && fs.existsSync(tmpDir)) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

module.exports = {
  buildChainFixtureRoom,
  closeChainFixtureRoom,
  SCHEMA_VARIANTS,
};
