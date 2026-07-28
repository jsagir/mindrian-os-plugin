'use strict';
/*
 * Phase 236-01 Task 1 -- buildFixtureRoom236: the shared phase fixture every
 * Phase 236 survival test consumes.
 *
 * WHAT IT SEEDS, AND WHY EACH ROW IS THERE. Phase 236 exists because two
 * unscoped `DELETE FROM edges; DELETE FROM nodes;` statements erase populations
 * that nothing in the codebase can regenerate. So the fixture seeds exactly the
 * three IRREPLACEABLE populations named in the RCA
 * (.planning/debug/graph-rebuild-truncates-memory-journal.md), plus the
 * REGENERABLE population the indexer owns, so a test can tell the difference
 * between "the fix works" and "the fix just stopped deleting anything":
 *
 *   IRREPLACEABLE (must survive a rebuild):
 *     - a `memory_event` node        (the append-only audit journal, Canon Part 9)
 *     - a `claim` node promoted to review_status='confirmed' (Canon Part 9 role 5:
 *       only a human confirms a truth-claim, so the fixture confirms it explicitly)
 *     - an `opportunity` node carrying a D-17 append-only `stage_history[]` of
 *       length >= 2 (the mint entry plus one real transition)
 *
 *   REGENERABLE (the indexer must still rebuild it):
 *     - real .md artifact files on disk, pre-indexed so `Artifact` / `Section`
 *       nodes and `BELONGS_TO` edges already exist before a rebuild runs. This is
 *       what lets a test prove stale-artifact reclamation still works: delete a
 *       file from disk, rebuild, and its Artifact node must be GONE.
 *
 * SEEDED THROUGH PRODUCTION WRITERS ONLY, NEVER HAND-ROLLED INSERTS. Two reasons.
 * First, a hand-rolled fixture is an invented shape, not the real damaged-room
 * shape (the tests/test-233-graph-derive-health.cjs seedRoomWithEdges convention).
 * Second, `nodes.source_path` is NOT NULL and `nodes.created_by` carries
 * CHECK (created_by IN ('user','larry','import','brain','system')) after the
 * Phase-109 provenance migration, so a naive 3-column INSERT fails with SQLite
 * errcode 1299. Routing through navigation.* sidesteps the trap by construction.
 *
 * NAMING CORRECTION (overrides 236-PATTERNS.md and the RCA): both documents name
 * the memory-event writer with a `record`-prefixed name that DOES NOT EXIST
 * anywhere in this tree. The real writer is lib/core/navigation/memory-events.cjs
 * `logEvent`, re-exported at lib/core/navigation.cjs:111 as `logMemoryEvent`.
 * Verified against the current tree; do not chase the RCA's name.
 *
 * NAMING CORRECTION 2 (overrides 236-01-PLAN.md Task 1): advanceOpportunityStage
 * takes axis 'lifecycle' | 'stage' | 'outcome', NOT 'opportunity_stage' /
 * 'opportunity_outcome'. Those are the PROPS FIELD names the axes write to
 * (typed-opportunity.cjs AXIS_FIELDS at :98-102). Passing 'opportunity_stage'
 * returns {ok:false, reason:'invalid_axis'}. The fixture uses axis:'stage'.
 *
 * Every seed call asserts ok === true and quotes the writer's own `reason` in the
 * assertion message, so a broken fixture reports as a FIXTURE failure and can
 * never present as a false green.
 *
 * tests/ is on the scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so
 * requiring room-db.cjs here is sanctioned.
 *
 * DETERMINISTIC: fixed content, no randomness in any asserted value, no network,
 * no LLM. NO em-dashes anywhere (CLAUDE.md HARD RULE). CJS only, zero new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));

// The one section directory the fixture's artifacts live in. A real directory
// (not the room root) so discoverSections walks it exactly as production does.
const FIXTURE_SECTION = 'business-model';

// Fixed identifiers so tests can assert on stable values.
const FIXTURE_SESSION_ID = 'fixture-236';
const FIXTURE_CLAIM_SEGMENT = 'segment-01';
const FIXTURE_CLAIM_TEXT =
  'The weekly-commitment rigidity of a fixed subscription cadence is the dominant '
  + 'churn driver for meal-kit ventures, so pause-any-week flexibility is the '
  + 'retention lever worth building first.';
const FIXTURE_OPPORTUNITY_NAME = 'Corporate wellness subsidy wedge';
const FIXTURE_MEMORY_EVENT_TYPE = 'node_created';

/**
 * Deterministic artifact body for index N. Long enough to be a realistic
 * artifact, fixed so the content hash is stable across runs.
 * @param {number} n
 * @returns {string}
 */
function artifactBody(n) {
  const label = String(n).padStart(2, '0');
  return [
    '# Fixture Artifact ' + label,
    '',
    'This artifact exists so the Phase 236 rebuild has real filesystem-derived',
    'work to regenerate. It is deliberately plain prose with no wikilinks, so the',
    'indexer mints exactly one Artifact node, one Section node, and one BELONGS_TO',
    'edge from it and nothing else.',
    '',
    'Artifact index ' + label + ' of the deterministic fixture set.',
  ].join('\n');
}

function writeFileUnder(roomDir, rel, body) {
  const abs = path.join(roomDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body + '\n', 'utf8');
  return abs;
}

/**
 * countPopulations(db) -> an object KEYED BY NODE TYPE with the row count for
 * each, so a test can diff before/after in one call. The parallel edges rollup
 * rides on the reserved `_edges` key (underscore-prefixed so it can never
 * collide with a real node type string), with `_nodesTotal` / `_edgesTotal`
 * convenience scalars beside it.
 *
 * @param {import('node:sqlite').DatabaseSync} db - an OPEN room.db handle
 * @returns {Object} e.g. { memory_event: 1, claim: 1, opportunity: 1,
 *                          Artifact: 3, Section: 1,
 *                          _edges: { BELONGS_TO: 3 },
 *                          _nodesTotal: 6, _edgesTotal: 3 }
 */
function countPopulations(db) {
  const out = {};
  const edges = {};
  let nodesTotal = 0;
  let edgesTotal = 0;

  for (const row of db.prepare('SELECT type, COUNT(*) AS cnt FROM nodes GROUP BY type').all()) {
    out[row.type] = row.cnt;
    nodesTotal += row.cnt;
  }
  for (const row of db.prepare('SELECT type, COUNT(*) AS cnt FROM edges GROUP BY type').all()) {
    edges[row.type] = row.cnt;
    edgesTotal += row.cnt;
  }

  out._edges = edges;
  out._nodesTotal = nodesTotal;
  out._edgesTotal = edgesTotal;
  return out;
}

/**
 * readStageHistory(db, nodeId) -> the PARSED D-17 append-only stage_history
 * array for an opportunity node, or null when the node is gone / unparseable.
 *
 * Criterion 1 requires asserting the array LENGTH is unchanged, not merely that
 * the row still exists, so this reader is load-bearing rather than convenience:
 * a fix that preserved the row but clobbered its history would still be a D-17
 * contract violation and this is what catches it.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} nodeId
 * @returns {Array|null}
 */
function readStageHistory(db, nodeId) {
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
  if (!row) return null;
  let props;
  try {
    props = JSON.parse(row.properties);
  } catch (_e) {
    return null;
  }
  return Array.isArray(props.stage_history) ? props.stage_history : null;
}

/**
 * readNodeRow(db, nodeId) -> the raw { id, type, properties, review_status }
 * row, or null. Scenario assertions compare the `properties` blob BYTE-FOR-BYTE
 * before and after a rebuild, so this returns the raw string, never a re-parse.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} nodeId
 * @returns {{id: string, type: string, properties: string, review_status: string}|null}
 */
function readNodeRow(db, nodeId) {
  const row = db.prepare(
    'SELECT id, type, properties, review_status FROM nodes WHERE id = ?'
  ).get(nodeId);
  return row || null;
}

/**
 * buildFixtureRoom236(tmpDir, opts) -> Promise<{
 *   roomDir, dbPath, memoryEventId, claimId, opportunityId, artifactFiles
 * }>
 *
 * tmpDir: an existing writable directory (the CALLER owns cleanup).
 *         The room is created at tmpDir/room so the caller's dir stays inspectable.
 * opts.artifactCount: how many .md artifacts to write into the section directory
 *         (default 3, minimum 1). Plan 236-02's WAL-concurrency test passes a much
 *         larger count to widen the rebuild's time window, so this option is
 *         load-bearing, not decorative.
 * opts.indexArtifacts: default true. Pre-index the artifacts so Artifact/Section
 *         nodes and BELONGS_TO edges exist BEFORE a rebuild runs. Required by the
 *         stale-reclamation scenario, which deletes a file from disk and asserts
 *         its already-existing Artifact node is gone after the rebuild.
 */
async function buildFixtureRoom236(tmpDir, opts) {
  if (typeof tmpDir !== 'string' || tmpDir.length === 0) {
    throw new Error('fixture-room-236: tmpDir is required');
  }
  const options = (opts && typeof opts === 'object') ? opts : {};
  const artifactCount = Math.max(
    1,
    Number.isInteger(options.artifactCount) ? options.artifactCount : 3
  );
  const indexArtifacts = options.indexArtifacts !== false;

  const roomDir = path.join(tmpDir, 'room');
  fs.mkdirSync(roomDir, { recursive: true });

  // .room-root sentinel + ROOM.md so resolvers treat this as a real room root.
  // ROOM.md is on the indexer's skip list, so it never becomes an Artifact.
  fs.writeFileSync(
    path.join(roomDir, '.room-root'),
    JSON.stringify({ slug: 'fixture-236' }) + '\n',
    'utf8'
  );
  writeFileUnder(roomDir, 'ROOM.md', '# Fixture Room 236\n\nPhase 236 data-loss survival fixture.');

  // The regenerable population: real .md files on disk in a real section dir.
  const artifactFiles = [];
  for (let i = 0; i < artifactCount; i += 1) {
    const rel = path.join(FIXTURE_SECTION, 'artifact-' + String(i).padStart(2, '0') + '.md');
    artifactFiles.push(writeFileUnder(roomDir, rel, artifactBody(i)));
  }

  // openRoomDb builds/migrates the REAL schema (Phase-109 wide provenance
  // columns + every later migration), which is exactly the schema the defect
  // lives on. Closed in the finally so no handle leaks into the caller's test.
  const db = roomDb.openRoomDb(roomDir);
  let memoryEventId;
  let claimId;
  let opportunityId;
  try {
    // --- Irreplaceable population 1: the append-only memory_event journal ---
    // eventType MUST be a member of memory-events.cjs's frozen EVENT_TYPES Set;
    // a non-member returns {ok:false, reason:'invalid_event_type'} rather than
    // throwing. DELIBERATELY no payload.dedupe_key: a set dedupe_key activates
    // the 60s idempotency path, which can return {ok:true, deduped:true} WITHOUT
    // an INSERT and would silently seed fewer rows than the test expects.
    const evtRes = navigation.logMemoryEvent(db, FIXTURE_MEMORY_EVENT_TYPE, {
      target_node_id: 'fixture:236:seeded-target',
      note: 'Phase 236 fixture seeded audit-journal row',
      source_path: 'fixture:236:memory-event',
      created_by: 'system',
    });
    assert.equal(
      evtRes.ok, true,
      'fixture seed logMemoryEvent must succeed: ' + JSON.stringify(evtRes)
    );
    assert.notEqual(
      evtRes.deduped, true,
      'fixture seed logMemoryEvent must INSERT, not dedupe: ' + JSON.stringify(evtRes)
    );
    memoryEventId = evtRes.eventId;

    // --- Irreplaceable population 2: a HUMAN-CONFIRMED truth-claim ---
    // writeClaimNode mints review_status='proposed', NEVER 'confirmed' (Canon
    // Part 9 role 5: only a human confirms). The confirmNode call is what
    // reaches the actual confirmed state the RCA describes.
    const claimRes = navigation.writeClaimNode(db, {
      knowledge_type: 'fact',
      text: FIXTURE_CLAIM_TEXT,
      sessionId: FIXTURE_SESSION_ID,
      sourceSegment: FIXTURE_CLAIM_SEGMENT,
    });
    assert.equal(
      claimRes.ok, true,
      'fixture seed writeClaimNode must succeed: ' + JSON.stringify(claimRes)
    );
    claimId = claimRes.node_id;

    const confirmRes = navigation.confirmNode(
      db,
      claimId,
      navigation.NAVIGATOR_DEFAULT,
      'fixture-236 seeded human confirmation'
    );
    assert.equal(
      confirmRes.ok, true,
      'fixture seed confirmNode must succeed: ' + JSON.stringify(confirmRes)
    );

    // --- Irreplaceable population 3: an opportunity with real stage_history ---
    // The mint writes stage_history[0]; advanceOpportunityStage APPENDS entry 1,
    // so the seeded array has length 2 and a test can assert the D-17
    // append-only contract on LENGTH, not merely on row existence.
    const oppRes = navigation.writeOpportunityNode(db, {
      name: FIXTURE_OPPORTUNITY_NAME,
      sessionId: FIXTURE_SESSION_ID,
      lifecycle: 'candidate',
      section: FIXTURE_SECTION,
      actor: 'navigator',
      reason: 'fixture-236 minted',
    });
    assert.equal(
      oppRes.ok, true,
      'fixture seed writeOpportunityNode must succeed: ' + JSON.stringify(oppRes)
    );
    opportunityId = oppRes.node_id;

    // axis 'stage' maps to the opportunity_stage props field (AXIS_FIELDS);
    // OPPORTUNITY_STAGES accepts only 'banked' or 'explored'.
    const advRes = navigation.advanceOpportunityStage(db, {
      node_id: opportunityId,
      axis: 'stage',
      to: 'explored',
      actor: 'navigator',
      reason: 'fixture-236 advanced to explored',
      evidence_ids: [],
      formula_version: 'fixture-236',
    });
    assert.equal(
      advRes.ok, true,
      'fixture seed advanceOpportunityStage must succeed: ' + JSON.stringify(advRes)
    );

    const seededHistory = readStageHistory(db, opportunityId);
    assert.ok(
      Array.isArray(seededHistory) && seededHistory.length >= 2,
      'fixture seed stage_history must have length >= 2, got '
        + JSON.stringify(seededHistory)
    );

    // --- Regenerable population: pre-index the artifacts on disk ---
    // indexArtifact runs its own BEGIN/COMMIT per file, which is fine here: the
    // fixture is setup, not the code under test.
    if (indexArtifacts) {
      for (const abs of artifactFiles) {
        // eslint-disable-next-line no-await-in-loop
        await lazygraph.indexArtifact(db, roomDir, abs);
      }
      const seeded = countPopulations(db);
      assert.ok(
        seeded.Artifact >= artifactCount,
        'fixture seed must pre-index ' + artifactCount + ' Artifact nodes, got '
          + JSON.stringify(seeded)
      );
    }
  } finally {
    roomDb.closeRoomDb(db);
  }

  return {
    roomDir: roomDir,
    dbPath: path.join(roomDir, '.mindrian', 'room.db'),
    memoryEventId: memoryEventId,
    claimId: claimId,
    opportunityId: opportunityId,
    artifactFiles: artifactFiles,
    section: FIXTURE_SECTION,
  };
}

module.exports = {
  buildFixtureRoom236,
  countPopulations,
  readStageHistory,
  readNodeRow,
  FIXTURE_SECTION,
  FIXTURE_SESSION_ID,
};
