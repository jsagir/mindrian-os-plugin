'use strict';
// Phase 162-02 Task 2 tests (R4). Proves the dashboard graph.json feed is
// SPINE-SOURCED: build-graph-from-sqlite.cjs writes node/edge counts equal to
// navigation.getGraphExport(roomDir).counts, and every edge endpoint is present
// in the node set (no dangling in the dashboard feed -- the F1 QA test).
//
// Run: node tests/test-dashboard-graph-feed.cjs

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('node:child_process');

const lgOps = require('../lib/core/lazygraph-ops.cjs');
const navigation = require('../lib/core/navigation.cjs');

const WRITER = path.resolve(__dirname, '..', 'scripts', 'build-graph-from-sqlite.cjs');

let pass = 0;
let fail = 0;
function ok(name) { pass += 1; console.log('  PASS ' + name); }
function bad(name, e) { fail += 1; console.log('  FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); }
async function test(name, fn) { try { await fn(); ok(name); } catch (e) { bad(name, e); } }

function tmpRoom(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'dgf-'));
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

(async () => {
  console.log('Phase 162-02 Task 2: dashboard graph.json feed is spine-sourced');

  // ---- Test 1: counts equal getGraphExport; no dangling ----
  await test('graph.json counts equal getGraphExport counts; no dangling endpoints', async () => {
    const room = tmpRoom('dgf-seed-');
    await seedDb(room,
      [
        { id: 'c1', type: 'claim', properties: { knowledge_type: 'fact', title: 'Claim One' } },
        { id: 'c2', type: 'claim', properties: { knowledge_type: 'mental_model', title: 'Claim Two' } },
        { id: 'gt', type: 'governing_thought', properties: { title: 'Governing' } },
        { id: 'me', type: 'memory_event', properties: {} }, // excluded by spine
      ],
      [
        { source: 'c1', target: 'gt', type: 'STATES' },
        { source: 'c2', target: 'c1', type: 'INFORMS' },
      ]
    );

    const outPath = path.join(room, 'graph.json');
    execFileSync('node', [WRITER, room, outPath], { stdio: 'pipe' });
    assert.ok(fs.existsSync(outPath), 'graph.json should be written');

    const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.ok(parsed.elements && Array.isArray(parsed.elements.nodes), 'elements.nodes is an array');
    assert.ok(parsed.elements && Array.isArray(parsed.elements.edges), 'elements.edges is an array');

    const exp = await navigation.getGraphExport(room);
    assert.strictEqual(parsed.elements.nodes.length, exp.counts.nodes,
      'node count must equal getGraphExport.counts.nodes');
    assert.strictEqual(parsed.elements.edges.length, exp.counts.edges,
      'edge count must equal getGraphExport.counts.edges');

    // No dangling: every edge endpoint is present in the node id set.
    const ids = new Set(parsed.elements.nodes.map((n) => n.data.id));
    for (const e of parsed.elements.edges) {
      assert.ok(ids.has(e.data.source), 'edge source ' + e.data.source + ' must be in node set');
      assert.ok(ids.has(e.data.target), 'edge target ' + e.data.target + ' must be in node set');
    }

    // The excluded memory_event must NOT appear in the feed.
    assert.ok(!ids.has('me'), 'memory_event node must be excluded from the dashboard feed');
  });

  // ---- Test 2: default output path + stderr "N nodes, M edges -> path" line ----
  await test('writer prints "N nodes, M edges -> path" and defaults output to .presentation/graph.json', async () => {
    const room = tmpRoom('dgf-default-');
    await seedDb(room,
      [
        { id: 'a', type: 'claim', properties: { knowledge_type: 'fact' } },
        { id: 'b', type: 'claim', properties: { knowledge_type: 'fact' } },
      ],
      [{ source: 'a', target: 'b', type: 'INFORMS' }]
    );

    // stderr carries the "N nodes, M edges -> path" line; capture it via spawnSync.
    const out = require('node:child_process').spawnSync('node', [WRITER, room], { encoding: 'utf8' });
    assert.ok(/\d+ nodes, \d+ edges -> /.test(out.stderr), 'stderr should carry the count line: ' + out.stderr);

    const defaultPath = path.join(room, '.presentation', 'graph.json');
    assert.ok(fs.existsSync(defaultPath), 'default output path .presentation/graph.json should exist');
  });

  // ---- Test 3: cold-start room (no room.db) still produces a parseable feed ----
  await test('cold-start room (no room.db) produces a parseable spine feed (Tier-0 anchors)', async () => {
    const room = tmpRoom('dgf-cold-');
    const outPath = path.join(room, 'graph.json');
    execFileSync('node', [WRITER, room, outPath], { stdio: 'pipe' });
    assert.ok(fs.existsSync(outPath), 'cold-start should still write graph.json');
    const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const exp = await navigation.getGraphExport(room);
    assert.strictEqual(parsed.elements.nodes.length, exp.counts.nodes,
      'cold-start node count must equal getGraphExport.counts.nodes');
    assert.strictEqual(parsed.meta.cold_start, true, 'meta.cold_start should be true for a room with no room.db');
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
