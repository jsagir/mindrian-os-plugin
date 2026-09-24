'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 Plan 20 Task 1 (HIPS-06, D-43) -- the filing fixture room builder
 * tests/test-355-filing.cjs drives.
 *
 * buildFilingRoom(label) -> Promise<{ root, roomDir, dbPath, statements,
 *   stampsByKey, ids, cleanup }>
 *
 * Seeds, through navigation writers + lazygraph-ops.indexArtifact ONLY --
 * never raw SQL (grep-gated, the run-all-219/run-all-355 precedent):
 *
 *   - Two real .md artifact files under roomDir, each carrying frontmatter
 *     `framework:` naming a real canon Framework name from
 *     data/framework-names.json that ALSO has a strong, 1-hop, all-Framework,
 *     lateral-edge entry in tests/fixtures/355/theo-stub-responses.json
 *     ('Reverse Salient Analysis' -> 'Six Thinking Hats', edge EXTENDS).
 *     lazygraph-ops.indexArtifact mints the two 'Artifact' nodes from those
 *     real files -- the same indexer path a live room's whitespace/hsi/rs
 *     pipeline uses, never a hand-built node (D-16).
 *   - Two entity nodes (navigation.writeEntityNode) DESCRIBES-linked to their
 *     own artifact (navigation.writeEdge) -- mirroring scripts/entity-
 *     extract.cjs's own entity -> artifact provenance link (D-38: "the way
 *     extraction links them").
 *   - A second, unrelated entity pair with NO DESCRIBES artifact and NO
 *     stamp, so the statement set below has a real discriminator: exactly
 *     ONE of its two entries passes the default 'critic' bank predicate.
 *   - A two-entry statement set [{pair, statement, tailFlag}]: the banked
 *     entry (statement.banked === true, critic 'transferable') pairs the two
 *     DESCRIBES-linked entities; the second entry (critic 'pending', banked
 *     false) never passes the default predicate.
 *   - stampsByKey: a Map keyed on the banked entry's own pair key
 *     (idA + '|' + idB) -> a REAL, verified Stamp computed via
 *     lib/core/verification-stamp.cjs's stampFinding over the offline replay
 *     fixture (tests/helpers/theo-replay-355.cjs +
 *     tests/fixtures/355/theo-stub-responses.json) -- never hand-built, so a
 *     malformed Stamp shape fails here first, not inside bankStatements.
 *
 * ROOM.md frontmatter carries `pws_stage: ill_defined` (D-40) so the filing
 * test can assert the banked node's stamped props carry it verbatim.
 *
 * cleanup() removes ONLY the mkdtemp root this call created (never a
 * caller-supplied path -- the fixture-room-354.cjs precedent).
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../../lib/core/room-db.cjs');
const navigation = require('../../lib/core/navigation.cjs');
const lazygraphOps = require('../../lib/core/lazygraph-ops.cjs');
const verificationStamp = require('../../lib/core/verification-stamp.cjs');
const { makeReplayCallTool } = require('./theo-replay-355.cjs');

// The fixed session id every entity/opportunity node mints under in this
// fixture (idempotent UPSERT keying, mirroring fixture-room-219.cjs).
const FIXTURE_SESSION = 'fixture-355-filing';

// The one strong, all-Framework, single-lateral-edge (EXTENDS) pairing this
// fixture relies on -- theo-stub-responses.json's own recorded entry.
const FROM_FRAMEWORK = 'Reverse Salient Analysis';
const TO_FRAMEWORK = 'Six Thinking Hats';

function must(result, what) {
  if (!result || result.ok !== true) {
    throw new Error('fixture-room-355: ' + what + ' failed: ' + JSON.stringify(result));
  }
  return result;
}

function writeFileUnder(roomDir, rel, body) {
  const abs = path.join(roomDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
  return abs;
}

/*
 * buildFilingRoom(label) -> Promise<{...}>. label is a short, filesystem-safe
 * string identifying the caller (used only in the mkdtemp prefix).
 */
async function buildFilingRoom(label) {
  const safeLabel = (typeof label === 'string' && label.length > 0) ? label : 'anon';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-filing-' + safeLabel + '-'));
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });

  writeFileUnder(roomDir, 'ROOM.md',
    '---\npws_stage: ill_defined\n---\n# Fixture Room 355 Filing\n\nD-43 filing fixture (Phase 355 Plan 20).\n');

  const artifactARel = path.join('findings', 'reverse-salient-note.md');
  const artifactBRel = path.join('findings', 'six-thinking-hats-note.md');
  writeFileUnder(roomDir, artifactARel,
    '---\nframework: ' + FROM_FRAMEWORK + '\n---\n# ' + FROM_FRAMEWORK + ' note\n\nA bottleneck worth naming across the room.\n');
  writeFileUnder(roomDir, artifactBRel,
    '---\nframework: ' + TO_FRAMEWORK + '\n---\n# ' + TO_FRAMEWORK + ' note\n\nSix angles on the same bottleneck.\n');

  // ---- (a) index the two real artifacts (lazygraph-ops, D-16: never
  // navigation.cjs directly for the Artifact node itself). Own db lifecycle,
  // opened and closed BEFORE the room-db.cjs handle below opens the same
  // file (sequential, never concurrent -- the whitespace-to-graph precedent). ----
  const graphHandle = await lazygraphOps.openGraph(roomDir);
  let artifactAId;
  let artifactBId;
  try {
    const idxA = await lazygraphOps.indexArtifact(graphHandle.conn, roomDir, path.join(roomDir, artifactARel));
    const idxB = await lazygraphOps.indexArtifact(graphHandle.conn, roomDir, path.join(roomDir, artifactBRel));
    artifactAId = idxA.id;
    artifactBId = idxB.id;
  } finally {
    await lazygraphOps.closeGraph(graphHandle.db);
  }

  // ---- (b) two entity nodes DESCRIBES-linked to their own artifact
  // (navigation.writeEntityNode + navigation.writeEdge ONLY). ----
  const db = openRoomDb(roomDir, { allowExtension: true });
  const ids = {
    session: FIXTURE_SESSION,
    entityA: null,
    entityB: null,
    entityC: null,
    entityD: null,
    artifactA: artifactAId,
    artifactB: artifactBId,
  };
  try {
    const entA = must(navigation.writeEntityNode(db, {
      entityType: 'technology', name: 'Reverse Salient Finding', sessionId: FIXTURE_SESSION,
    }), 'entity A write');
    const entB = must(navigation.writeEntityNode(db, {
      entityType: 'technology', name: 'Six Thinking Hats Finding', sessionId: FIXTURE_SESSION,
    }), 'entity B write');
    must(navigation.writeEdge(db, {
      source_id: entA.node_id, target_id: artifactAId, edge_type: 'DESCRIBES',
      properties: { relation: 'describes', entity_node: entA.node_id },
    }), 'entity A DESCRIBES artifact A');
    must(navigation.writeEdge(db, {
      source_id: entB.node_id, target_id: artifactBId, edge_type: 'DESCRIBES',
      properties: { relation: 'describes', entity_node: entB.node_id },
    }), 'entity B DESCRIBES artifact B');
    ids.entityA = entA.node_id;
    ids.entityB = entB.node_id;

    // A second, UNRELATED entity pair with NO DESCRIBES artifact and no
    // stamp -- the statement set's real discriminator (D-43: "exactly 1 row"
    // must be a genuine selection, not a vacuous single-candidate set).
    const entC = must(navigation.writeEntityNode(db, {
      entityType: 'market', name: 'Unrelated Signal', sessionId: FIXTURE_SESSION,
    }), 'entity C write');
    const entD = must(navigation.writeEntityNode(db, {
      entityType: 'company', name: 'Unrelated Company', sessionId: FIXTURE_SESSION,
    }), 'entity D write');
    ids.entityC = entC.node_id;
    ids.entityD = entD.node_id;
  } finally {
    closeRoomDb(db);
  }

  // ---- (c) the statement set: exactly one banked entry. ----
  const bankedPair = {
    idA: ids.entityA, idB: ids.entityB,
    techA: { title: 'Reverse Salient Finding', section: 'findings' },
    techB: { title: 'Six Thinking Hats Finding', section: 'findings' },
    rank: 1, score: 0.71,
    rs: { direction: 'structural_transfer', abs_diff: 0.42, passes: true },
  };
  const bankedStatement = {
    banked: true, critic: 'transferable',
    text: 'A cross-domain bridge worth exploring.',
    weak_dimensions: [],
    fields: { audience: 'operator', potential_tier: 'high' },
  };
  const skippedPair = {
    idA: ids.entityC, idB: ids.entityD,
    techA: { title: 'Unrelated Signal', section: 'findings' },
    techB: { title: 'Unrelated Company', section: 'findings' },
    rank: 2, score: 0.10,
    rs: { direction: 'semantic_implementation', abs_diff: 0.05, passes: false },
  };
  const skippedStatement = {
    banked: false, critic: 'pending',
    text: 'Not yet resolved.',
    weak_dimensions: [],
    fields: { audience: '', potential_tier: '' },
  };
  const statements = [
    { pair: bankedPair, statement: bankedStatement, tailFlag: false },
    { pair: skippedPair, statement: skippedStatement, tailFlag: false },
  ];

  // ---- (d) stampsByKey: a REAL, verified Stamp over the offline replay
  // fixture (never hand-built). ----
  const stubFixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8',
  ));
  const callTool = makeReplayCallTool(stubFixture);
  const stamp = await verificationStamp.stampFinding({
    fromHandle: FROM_FRAMEWORK, toHandle: TO_FRAMEWORK, direction: 'structural_transfer',
  }, { callTool: callTool });
  const stampsByKey = new Map();
  stampsByKey.set(bankedPair.idA + '|' + bankedPair.idB, stamp);

  return {
    root: root,
    roomDir: roomDir,
    dbPath: path.join(roomDir, '.mindrian', 'room.db'),
    statements: statements,
    stampsByKey: stampsByKey,
    ids: ids,
    cleanup: function cleanup() {
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    },
  };
}

module.exports = { buildFilingRoom, FROM_FRAMEWORK, TO_FRAMEWORK };
