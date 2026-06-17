'use strict';
// SEED-026 graph-export tests. Proves the no-orphan invariant, cold-start
// scaffold, bookkeeping exclusion, unknown-type loud-but-graceful handling, the
// Canon Part 8 whitelist payload, and real-room integration (no dangling edges).
//
// Run: node tests/test-graph-export.cjs

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const lgOps = require('../lib/core/lazygraph-ops.cjs');
const { getGraphExport, KNOWLEDGE_TYPE_COLOR } = require('../lib/core/navigation/graph-export.cjs');

let pass = 0;
let fail = 0;
function ok(name) { pass += 1; console.log('  PASS ' + name); }
function bad(name, e) { fail += 1; console.log('  FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); }
async function test(name, fn) { try { await fn(); ok(name); } catch (e) { bad(name, e); } }

function tmpRoom(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'ge-'));
}

async function seedDb(roomDir, nodes, edges) {
  const { db, conn } = await lgOps.openGraph(roomDir);
  for (const n of nodes) {
    conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run(n.id, n.type, JSON.stringify(n.properties || {}));
  }
  for (const e of edges) {
    conn.prepare('INSERT INTO edges (source, target, type) VALUES (?, ?, ?)').run(e.source, e.target, e.type);
  }
  await lgOps.closeGraph(db);
}

// Invariant helper: NO edge endpoint may be absent from the node set.
function assertNoDangling(result) {
  const ids = new Set(result.elements.nodes.map((n) => n.data.id));
  for (const e of result.elements.edges) {
    assert.ok(ids.has(e.data.source), 'edge source ' + e.data.source + ' missing from node set');
    assert.ok(ids.has(e.data.target), 'edge target ' + e.data.target + ' missing from node set');
  }
}

(async () => {
  console.log('SEED-026 graph-export');

  // ---- 1. Synthetic graph: no-orphan, exclusion, degree, color, gloss ----
  await test('synthetic: nodes/edges sourced from room.db in one id space', async () => {
    const room = tmpRoom('ge-syn-');
    await seedDb(room,
      [
        { id: 'c1', type: 'claim', properties: { knowledge_type: 'fact' } },
        { id: 'c2', type: 'claim', properties: { knowledge_type: 'mental_model' } },
        { id: 'gt', type: 'governing_thought', properties: {} },
        { id: 'me', type: 'memory_event', properties: {} },
        { id: 'orphan', type: 'claim', properties: { knowledge_type: 'heuristic' } },
      ],
      [
        { source: 'gt', target: 'c1', type: 'STATES' },
        { source: 'c1', target: 'c2', type: 'INFORMS' },
        { source: 'c1', target: 'me', type: 'INFORMS' }, // endpoint excluded -> dropped
      ]
    );
    const r = await getGraphExport(room);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.cold_start, false);
    assertNoDangling(r);

    const ids = r.elements.nodes.map((n) => n.data.id).sort();
    assert.deepStrictEqual(ids, ['c1', 'c2', 'gt', 'orphan'], 'memory_event must be excluded from node set');
    assert.ok(r.counts.excluded >= 1, 'memory_event counted as excluded');
    assert.strictEqual(r.elements.edges.length, 2, 'only edges with both endpoints included');
    assert.ok(r.counts.dropped_edges >= 1, 'the c1->memory_event edge is dropped');

    const byId = Object.fromEntries(r.elements.nodes.map((n) => [n.data.id, n.data]));
    assert.strictEqual(byId.c1.degree, 2, 'c1 has STATES-in + INFORMS-out');
    assert.strictEqual(byId.c2.degree, 1);
    assert.strictEqual(byId.orphan.degree, 0, 'orphan has no edges');
    assert.strictEqual(r.counts.orphans, 1);
    assert.strictEqual(byId.c1.color, KNOWLEDGE_TYPE_COLOR.fact, 'claim colored by knowledge_type');
    assert.strictEqual(byId.gt.color, '#ffffff', 'governing_thought is white');

    const informs = r.elements.edges.find((e) => e.data.type === 'INFORMS');
    assert.ok(informs.data.gloss && informs.data.gloss.length > 10, 'edge carries a plain-English gloss');
    assert.strictEqual(r.unmapped_types.length, 0, 'all fixture types are mapped');
    fs.rmSync(room, { recursive: true, force: true });
  });

  // ---- 2. Cold-start: no room.db -> section anchors, never blank ----
  await test('cold-start: no room.db returns section anchors (never blank canvas)', async () => {
    const room = tmpRoom('ge-cold-');
    const r = await getGraphExport(room);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.cold_start, true);
    assert.ok(r.elements.nodes.length > 0, 'cold-start emits section anchors');
    assert.strictEqual(r.elements.edges.length, 0);
    assert.ok(r.elements.nodes.every((n) => n.classes === 'section-group'));
    // and no room.db was created as a side effect of the read
    assert.ok(!fs.existsSync(path.join(room, '.mindrian', 'room.db')), 'cold-start read must not create room.db');
    fs.rmSync(room, { recursive: true, force: true });
  });

  // ---- 3. Unknown node type: rendered loud, never dropped, never thrown ----
  await test('unknown node type: rendered with default + flagged, not dropped', async () => {
    const room = tmpRoom('ge-unk-');
    await seedDb(room,
      [
        { id: 'c1', type: 'claim', properties: { knowledge_type: 'fact' } },
        { id: 'x1', type: 'FancyNewType', properties: {} },
      ],
      [{ source: 'c1', target: 'x1', type: 'INFORMS' }]
    );
    const r = await getGraphExport(room);
    assert.strictEqual(r.ok, true);
    assert.ok(r.unmapped_types.includes('FancyNewType'), 'unknown type flagged');
    const x = r.elements.nodes.find((n) => n.data.id === 'x1');
    assert.ok(x, 'unknown-type node is still rendered, not dropped');
    assert.strictEqual(x.classes, 'unknown');
    assert.strictEqual(r.elements.edges.length, 1, 'edge to unknown-but-included node is kept');
    assertNoDangling(r);
    fs.rmSync(room, { recursive: true, force: true });
  });

  // ---- 4. Canon Part 8: payload is a strict whitelist (no raw blobs / no Brain bytes) ----
  await test('Part 8: payload whitelist (no properties blob, no correlation_id, no source_path)', async () => {
    const room = tmpRoom('ge-p8-');
    await seedDb(room,
      [{ id: 'c1', type: 'claim', properties: { knowledge_type: 'fact', correlation_id: 'LEAK-123', secret: 'do-not-egress' } }],
      []
    );
    const r = await getGraphExport(room);
    const serialized = JSON.stringify(r);
    assert.ok(!serialized.includes('LEAK-123'), 'correlation_id must not appear in the export');
    assert.ok(!serialized.includes('do-not-egress'), 'raw property values must not appear');
    for (const n of r.elements.nodes) {
      assert.ok(!('properties' in n.data), 'node.data never carries the raw properties blob');
      assert.ok(!('source_path' in n.data), 'node.data never carries source_path');
      assert.ok(!('correlation_id' in n.data), 'node.data never carries correlation_id');
    }
    fs.rmSync(room, { recursive: true, force: true });
  });

  // ---- 5. Real-room integration (AION) if present: no dangling, memory_event excluded ----
  await test('integration: real AION room has no dangling edges and excludes memory_event', async () => {
    const aion = path.join(os.homedir(), 'MindrianRooms', 'aion-eureka-synergy');
    if (!fs.existsSync(path.join(aion, '.mindrian', 'room.db'))) {
      console.log('    (skip: AION room.db not present on this machine)');
      return;
    }
    const r = await getGraphExport(aion);
    assert.strictEqual(r.ok, true);
    assert.ok(r.counts.nodes > 0, 'real room renders nodes');
    assertNoDangling(r);
    assert.ok(r.elements.nodes.every((n) => n.data.type !== 'memory_event'), 'memory_event excluded from viz');
    assert.ok(r.counts.excluded > 0, 'bookkeeping nodes counted as excluded');
    console.log('    AION export: ' + r.counts.nodes + ' nodes, ' + r.counts.edges + ' edges, '
      + r.counts.excluded + ' excluded, ' + r.counts.orphans + ' orphans, '
      + r.counts.dropped_edges + ' dropped edges, unmapped=[' + r.unmapped_types.join(',') + ']');
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
