'use strict';
// Phase 200-02 Wave 2 -- RS Tier-0 writes route through the navigation Part-9 chokepoint.
//
// Contract: rs-sqlite-mirror.writeDiscovery keeps NODE writes on lazygraph (the shared
// room.db layer), but routes EDGE writes through navigation.writeEdge and emits a
// reverse_salient_detected memory_event -- mirroring lib/core/breakthrough/schema.cjs
// (nodes via lazygraph, edges via the chokepoint). Before the reroute the edges landed
// via a direct INSERT and NO memory_event was emitted; the memory_event assertion is the
// RED signal.
//
// The room.db is created via room-db.cjs::openRoomDb (the migrated 9-column provenance
// schema) so logMemoryEvent's node insert has its columns -- the production RS scenario
// (RS runs in established, migrated rooms). node:sqlite is experimental -> the warning is
// expected and harmless.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const mirror = require(path.join(REPO, 'lib', 'core', 'rs-sqlite-mirror.cjs'));

const PAIR = {
  query_concept: 'multi-user collaboration',
  doc_concept: 'shared workspace sync',
  classification: 'reverse_salient',
  thesis: 'A shared-state sync layer closes the collaboration salient.',
  breakthrough: { score: 0.7, dominant_dimension: 'market', breakdown: {} },
};

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-chokepoint-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });

  // Create + migrate room.db to the 9-column provenance schema (the production shape).
  const rdb = openRoomDb(tmp);
  closeRoomDb(rdb);

  const res = await mirror.writeDiscovery(PAIR, { roomDir: tmp, context: { room_id: 'testroom', domain: 'collab' } });
  assert.equal(res.wrote_node_count >= 3, true, 'wrote >= 3 RS nodes');
  assert.equal(res.wrote_edge_count >= 3, true, 'wrote >= 3 RS edges');

  const h = await lazygraph.openGraph(tmp);
  const db = h.conn;

  const nodeTypes = db.prepare(
    "SELECT DISTINCT type FROM nodes WHERE type IN ('RSDiscovery','ReverseSalient','Innovation')"
  ).all().map((r) => r.type);
  assert.equal(nodeTypes.includes('RSDiscovery'), true, 'RSDiscovery node present');
  assert.equal(nodeTypes.includes('Innovation'), true, 'Innovation node present');

  const edgeTypes = db.prepare(
    "SELECT DISTINCT type FROM edges WHERE type IN ('DISCOVERED','DERIVED_FROM','ENABLES')"
  ).all().map((r) => r.type);
  assert.equal(edgeTypes.includes('DISCOVERED'), true, 'DISCOVERED edge present (via writeEdge)');
  assert.equal(edgeTypes.includes('ENABLES'), true, 'ENABLES edge present (via writeEdge)');

  // THE chokepoint proof: a reverse_salient_detected memory_event was emitted.
  const ev = db.prepare(
    "SELECT COUNT(*) AS n FROM nodes WHERE type='memory_event' " +
    "AND json_extract(properties, '$.event_type') = 'reverse_salient_detected'"
  ).get().n;
  assert.equal(ev >= 1, true, 'a reverse_salient_detected memory_event was emitted through the chokepoint');

  await lazygraph.closeGraph(h.db);

  // Idempotency: re-run writes zero NEW edges (writeEdge ON CONFLICT DO UPDATE).
  const res2 = await mirror.writeDiscovery(PAIR, { roomDir: tmp, context: { room_id: 'testroom', domain: 'collab' } });
  assert.equal(res2.wrote_edge_count, 0, 're-run is idempotent (0 new edges)');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nPASS test-200-graph-chokepoint');
}

main().catch((e) => { console.error('FAIL test-200-graph-chokepoint:', e && e.message ? e.message : e); process.exit(1); });
