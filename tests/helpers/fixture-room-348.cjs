'use strict';
/*
 * tests/helpers/fixture-room-348.cjs -- Phase 348-02 Task 1: the two-schema-
 * variant supersession fixture room builder.
 *
 * A NEW fixture helper is minted here rather than extending
 * tests/helpers/fixture-room-347.cjs, mirroring WD-347-5
 * (docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md, Section 7): 347's builder
 * seeds a single `Section` subject node for chain-state anchoring and its own
 * gate forbids edits that change that shape, while this phase needs confirmed
 * `claim` pairs and a real `CONTRADICTS` edge. Extending 347's helper would
 * break 347's own tests, so a sibling helper is minted instead.
 *
 * Two schema variants (SCHEMA_VARIANTS), not three -- this phase's two claims
 * (the bitemporal close needs invalidated_at/valid_to; findContradictions
 * needs review_status) both partition cleanly on wide-versus-legacy, and a
 * third "mid" variant (347's own device) would be surface area with no
 * assertion behind it here:
 *
 *   wide   -- the REAL fully migrated production shape: the Phase 109
 *             tightened nodes table (lib/core/migrations/
 *             phase-109-nodes-provenance.cjs::tightenSchemaWithCheckConstraints,
 *             12 columns with NOT NULL + CHECK constraints including the
 *             8-value review_status CHECK) PLUS the four Phase 160 bitemporal
 *             columns (valid_from / valid_to / invalidated_at /
 *             last_modified_at) = 16 columns. edges carries the Phase 224
 *             review_status column. node-insert.cjs::isMigratedSchema reads
 *             this variant as migrated.
 *
 *   legacy -- the bare 3-column nodes table (id, type, properties) plus the
 *             base 4-column edges table, exactly
 *             lib/core/lazygraph-ops.cjs::initSchema's own DDL. No
 *             review_status, no invalidated_at, no valid_to column at all --
 *             this is what makes SUPER-13 provable.
 *
 * Seeds through the chokepoints only:
 *   1. A USER.md in the room directory carrying a non-agent user_id (default
 *      'navigator-fixture', or the caller's opts.userId), so resolveByUser
 *      has something real to resolve. opts.poisonedIdentity (when true)
 *      writes user_id: larry instead, so the SUPER-03 defense-in-depth
 *      coercion (resolveByUser NEVER returns an agent identity) is testable
 *      end to end: the fixture still confirms both claims successfully,
 *      because resolveByUser coerces 'larry' to 'navigator' before
 *      confirmNode ever sees it -- a poisoned USER.md cannot smuggle an agent
 *      identity into this fixture's own setup either.
 *   2. Claim A and claim B, both through
 *      lib/core/navigation/typed-claim.cjs::writeClaimNode on the wide
 *      variant (lands them at review_status: 'proposed', the real production
 *      state), then promoted to confirmed through navigation.confirmNode
 *      with the roomDir's OWN resolved human identity. On the legacy
 *      variant, seeded through lib/core/node-insert.cjs::insertNode directly
 *      and left unconfirmed: review_status does not exist as a column there,
 *      so promoteNodeStatus's own SELECT would throw against this schema,
 *      and "confirmed" is not a legal concept on a bare 3-column table.
 *   3. A CONTRADICTS edge A->B written through navigation.writeEdge on BOTH
 *      variants. Never a raw INSERT INTO edges: a fixture that bypassed the
 *      edge door would be testing a shape this phase has explicitly scoped
 *      out (D-08).
 *   4. Optionally (opts.reified: true, wide variant only -- writeContradictionEvent's
 *      own participant-type gate requires type='claim' rows, which only the
 *      wide/confirmed path produces meaningfully here) a ContradictionEvent
 *      node plus its two edges written through
 *      lib/core/navigation/reified-claim.cjs::writeContradictionEvent, so the
 *      D-04 guard has a real reified shape to skip rather than a hand-built
 *      imitation.
 *
 * Caller-owned handle contract: this helper OPENS the handle (it is a test
 * fixture, that is its job) and hands it to the caller, exactly as a
 * production caller would after openRoomDb. The modules under test
 * (supersession.cjs, supersession-gate.cjs, point-in-time.cjs, insights.cjs)
 * never open anything themselves -- they only ever receive db.
 *
 * tests/ is on scripts/check-substrate.cjs's ALLOWED_DIRECT_IMPORT list, so a
 * raw built-in-SQLite handle here is sanctioned (mirrors
 * tests/helpers/fixture-room-347.cjs's own precedent, and
 * tests/test-343-room-graph-integrity.cjs before it).
 *
 * Zero npm dependencies: node:fs, node:os, node:path, and the one built-in
 * node:sqlite require below, plus the in-repo navigation modules.
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { insertNode } = require('../../lib/core/node-insert.cjs');
const { writeClaimNode } = require('../../lib/core/navigation/typed-claim.cjs');
const { confirmNode, resolveByUser } = require('../../lib/core/navigation/confirm-node.cjs');
const { writeEdge } = require('../../lib/core/navigation/edges.cjs');
const { writeContradictionEvent } = require('../../lib/core/navigation/reified-claim.cjs');

// Frozen; iteration order is the fixture's own canonical variant order.
const SCHEMA_VARIANTS = Object.freeze(['wide', 'legacy']);

// -- DDL per variant, verbatim from lib/core/migrations/phase-109-nodes-
// provenance.cjs::tightenSchemaWithCheckConstraints and
// lib/core/migrations/phase-160-nodes-bitemporal.cjs::NEW_COLUMNS (wide), and
// lib/core/lazygraph-ops.cjs::initSchema (legacy) -- same DDL fixture-room-347
// already carries for its own 'wide' and 'legacy' members, reused here rather
// than re-derived, per Canon Part 7 (reuse before build).

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

// legacy: the bare 3-column nodes table, verbatim lazygraph-ops.cjs::initSchema.
const NODES_DDL_LEGACY =
  'CREATE TABLE nodes (' +
  '  id TEXT PRIMARY KEY, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}'" +
  ')';

// legacy shares the base 4-column edges shape (no review_status).
const EDGES_DDL_BASE =
  'CREATE TABLE edges (' +
  '  source TEXT NOT NULL, ' +
  '  target TEXT NOT NULL, ' +
  '  type TEXT NOT NULL, ' +
  "  properties TEXT DEFAULT '{}', " +
  '  PRIMARY KEY (source, target, type)' +
  ')';

function ddlForVariant(variant) {
  if (variant === 'wide') return { nodes: NODES_DDL_WIDE, edges: EDGES_DDL_WIDE };
  if (variant === 'legacy') return { nodes: NODES_DDL_LEGACY, edges: EDGES_DDL_BASE };
  throw new Error('fixture-room-348: unknown schema variant ' + JSON.stringify(variant));
}

function writeUserMd(roomDir, userId) {
  const body = '---\nuser_id: ' + userId + '\n---\n# USER\n\nFixture-generated for tests/helpers/fixture-room-348.cjs.\n';
  fs.writeFileSync(path.join(roomDir, 'USER.md'), body, 'utf8');
}

/**
 * buildSupersessionFixtureRoom(opts) -> { roomDir, dbPath, db, variant,
 *   claimAId, claimBId, eventId, byUser }
 *
 * opts.variant            -- one of SCHEMA_VARIANTS ('wide' default).
 * opts.userId              -- non-agent USER.md user_id (default
 *                              'navigator-fixture'). Ignored when
 *                              opts.poisonedIdentity is true.
 * opts.poisonedIdentity     -- when true, USER.md carries user_id: larry
 *                              (an AGENT_IDENTITIES member), so
 *                              resolveByUser's own coercion back to
 *                              'navigator' (SUPER-03 defense-in-depth) is
 *                              exercised by this fixture's own setup.
 * opts.reified              -- when true (wide variant only), also mints a
 *                              ContradictionEvent node via
 *                              writeContradictionEvent.
 *
 * The caller owns the returned db handle: close it (and remove the temp
 * tree) via closeSupersessionFixtureRoom, never by hand.
 */
function buildSupersessionFixtureRoom(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const variant = typeof options.variant === 'string' ? options.variant : 'wide';
  if (SCHEMA_VARIANTS.indexOf(variant) === -1) {
    throw new Error('fixture-room-348: unknown schema variant ' + JSON.stringify(variant));
  }
  const rawUserId = options.poisonedIdentity === true
    ? 'larry'
    : (typeof options.userId === 'string' && options.userId.length > 0 ? options.userId : 'navigator-fixture');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-room-348-'));
  const roomDir = path.join(tmpDir, 'room');
  const dbDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'room.db');

  writeUserMd(roomDir, rawUserId);

  const db = new DatabaseSync(dbPath);
  const ddl = ddlForVariant(variant);
  db.exec(ddl.nodes);
  db.exec(ddl.edges);

  // Resolved ONCE, through the real door (never a raw caller string). On the
  // poisoned-identity fixture this is ALREADY 'navigator' -- the coercion
  // happens here, at the point of resolution, not at some later gate.
  const byUser = resolveByUser(roomDir);

  let claimAId;
  let claimBId;

  if (variant === 'wide') {
    // Claim B first (the elder fact), claim A second (the fact that
    // contradicts and later supersedes it) -- the chronological order a real
    // room would carry: a later, better-evidenced claim supersedes an
    // earlier one, never the reverse.
    const bRes = writeClaimNode(db, {
      knowledge_type: 'fact',
      text: 'Claim B: the elder fact this fixture contradicts.',
      sessionId: 'fixture-348',
      sourceSegment: 'claim-b',
    });
    if (!bRes.ok) throw new Error('fixture-room-348: writeClaimNode B failed: ' + bRes.reason);
    claimBId = bRes.node_id;

    const aRes = writeClaimNode(db, {
      knowledge_type: 'fact',
      text: 'Claim A: the newer fact that contradicts and supersedes B.',
      sessionId: 'fixture-348',
      sourceSegment: 'claim-a',
    });
    if (!aRes.ok) throw new Error('fixture-room-348: writeClaimNode A failed: ' + aRes.reason);
    claimAId = aRes.node_id;

    // Promote both to confirmed through the real chokepoint, attributed to
    // the roomDir's own resolved human identity.
    const confB = confirmNode(db, claimBId, byUser);
    if (!confB.ok) throw new Error('fixture-room-348: confirmNode B failed: ' + confB.reason);
    const confA = confirmNode(db, claimAId, byUser);
    if (!confA.ok) throw new Error('fixture-room-348: confirmNode A failed: ' + confA.reason);
  } else {
    // legacy: no review_status column exists at all, so promoteNodeStatus's
    // own SELECT would throw against this schema (it names the column
    // explicitly). Seed through insertNode directly (Task 1's own
    // instruction) and skip confirmation entirely -- "confirmed" is not a
    // legal concept on a bare 3-column table.
    claimBId = 'claim:fixture-348-legacy:b';
    claimAId = 'claim:fixture-348-legacy:a';
    insertNode(db, claimBId, 'claim', JSON.stringify({ knowledge_type: 'fact', text: 'Claim B (legacy).' }), {
      epistemic_type: 'extracted_fact',
    });
    insertNode(db, claimAId, 'claim', JSON.stringify({ knowledge_type: 'fact', text: 'Claim A (legacy).' }), {
      epistemic_type: 'extracted_fact',
    });
  }

  // The CONTRADICTS edge A->B, through the one validated edge door (D-08):
  // never a raw INSERT INTO edges.
  const edgeRes = writeEdge(db, {
    source_id: claimAId,
    target_id: claimBId,
    edge_type: 'CONTRADICTS',
    properties: { relation: 'contradicts' },
  });
  if (!edgeRes.ok) throw new Error('fixture-room-348: CONTRADICTS writeEdge failed: ' + edgeRes.reason);

  let eventId = null;
  if (options.reified === true && variant === 'wide') {
    const evRes = writeContradictionEvent(db, {
      claim: claimAId,
      rivalClaim: claimBId,
      evidence: 'fixture-348-reified-evidence',
    });
    if (!evRes.ok) throw new Error('fixture-room-348: writeContradictionEvent failed: ' + evRes.reason);
    eventId = evRes.node_id;
  }

  return {
    roomDir: roomDir,
    dbPath: dbPath,
    db: db,
    variant: variant,
    claimAId: claimAId,
    claimBId: claimBId,
    eventId: eventId,
    byUser: byUser,
  };
}

/**
 * closeSupersessionFixtureRoom(fixture) -- closes the open handle and removes
 * the temp directory tree the fixture was built under. Best-effort on the
 * filesystem remove, and NEVER throws on a partially built fixture (a
 * failure mid-build must still be cleanable by a caller's finally block).
 */
function closeSupersessionFixtureRoom(fixture) {
  if (!fixture || typeof fixture !== 'object') return;
  if (fixture.db && typeof fixture.db.close === 'function') {
    try { fixture.db.close(); } catch (_e) { /* best-effort */ }
  }
  const tmpDir = fixture.roomDir ? path.dirname(fixture.roomDir) : null;
  if (tmpDir && tmpDir !== '.' && tmpDir !== path.sep && fs.existsSync(tmpDir)) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

module.exports = {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
  SCHEMA_VARIANTS,
};
