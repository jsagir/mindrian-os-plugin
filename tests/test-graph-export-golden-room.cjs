'use strict';
// SEED-026 W3 (Phase 162-03 Task 2): golden-room snapshot test +
// node-type-map completeness gate verification.
//
// WHY THIS EXISTS: the committed fixture
// tests/fixtures/graph-export-golden-room/.mindrian/room.db seeds one node of
// EVERY type in NODE_TYPE_RENDER (claim once per knowledge_type) plus one of
// EVERY type in EXCLUDE_TYPES plus a representative typed-edge set. Running
// getGraphExport over it MUST return unmapped_types === [] -- proving every live
// type is classified -- and MUST return the stable golden node/edge/excluded
// counts (a count change requires an INTENTIONAL fixture + snapshot update via
// build-golden-room.cjs, never a silent drift). It also exercises the
// check-graph-export-typemap.cjs gate: PASS on the clean fixture, FAIL on a
// throwaway copy with an injected unmapped type.
//
// Reads the committed fixture READ-ONLY (no test ever rewrites the committed db).
// The golden numbers are derived from the builder's seed set so the snapshot and
// the fixture can never silently diverge. Canon Part 8: LOCAL only, no Brain.
//
// Run: node tests/test-graph-export-golden-room.cjs

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getGraphExport, NODE_TYPE_RENDER, EXCLUDE_TYPES } = require('../lib/core/navigation/graph-export.cjs');
const { checkTypeMap } = require('../scripts/check-graph-export-typemap.cjs');
const builder = require('./fixtures/graph-export-golden-room/build-golden-room.cjs');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'graph-export-golden-room');
const FIXTURE_DB = path.join(FIXTURE_DIR, '.mindrian', 'room.db');

let pass = 0;
let fail = 0;
function ok(name) { pass += 1; console.log('  PASS ' + name); }
function bad(name, e) { fail += 1; console.log('  FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); }
async function test(name, fn) { try { await fn(); ok(name); } catch (e) { bad(name, e); } }

// Golden snapshot numbers, DERIVED from the builder's seed set (so a builder
// change moves these in lockstep; a drift without a builder change fails loud).
const includedNodes = builder.buildIncludedNodes();
const excludedNodes = builder.buildExcludedNodes();
const edges = builder.buildEdges();

const GOLDEN = {
  nodes: includedNodes.length,   // every NODE_TYPE_RENDER type (claim x knowledge_types)
  edges: edges.length,           // all edges have both endpoints included -> zero dropped
  excluded: excludedNodes.length, // every EXCLUDE_TYPES bookkeeping node
  dropped_edges: 0,
};

(async () => {
  console.log('SEED-026 graph-export golden-room snapshot + type-map completeness gate');

  // ---- 0. The fixture is committed and self-contained ----
  await test('fixture room.db is committed and present (self-contained, no machine-specific path)', async () => {
    assert.ok(fs.existsSync(FIXTURE_DB), 'committed fixture room.db must exist at ' + FIXTURE_DB);
  });

  // ---- 1. unmapped_types is EMPTY (every live type is mapped) ----
  await test('golden room: unmapped_types is empty (every live node type is classified)', async () => {
    const r = await getGraphExport(FIXTURE_DIR);
    assert.strictEqual(r.ok, true, 'export ok');
    assert.strictEqual(r.cold_start, false, 'fixture is a real room, not cold-start');
    assert.strictEqual(r.unmapped_types.length, 0,
      'unmapped_types must be empty (found: ' + r.unmapped_types.join(', ') + ')');
  });

  // ---- 2. Stable golden node/edge/excluded counts + zero dangling ----
  await test('golden room: node/edge/excluded counts match the committed snapshot', async () => {
    const r = await getGraphExport(FIXTURE_DIR);
    assert.strictEqual(r.counts.nodes, GOLDEN.nodes, 'node count snapshot');
    assert.strictEqual(r.counts.edges, GOLDEN.edges, 'edge count snapshot');
    assert.strictEqual(r.counts.excluded, GOLDEN.excluded, 'excluded count snapshot');
    assert.strictEqual(r.counts.dropped_edges, GOLDEN.dropped_edges, 'zero dropped edges (all endpoints included)');

    // Zero dangling: every edge endpoint is in the node set.
    const ids = new Set(r.elements.nodes.map((n) => n.data.id));
    for (const e of r.elements.edges) {
      assert.ok(ids.has(e.data.source), 'edge source ' + e.data.source + ' in node set');
      assert.ok(ids.has(e.data.target), 'edge target ' + e.data.target + ' in node set');
    }
  });

  // ---- 3. Coverage: the fixture exercises EVERY render + exclude type ----
  await test('golden room: fixture covers every NODE_TYPE_RENDER and EXCLUDE_TYPES entry', async () => {
    const r = await getGraphExport(FIXTURE_DIR);
    const renderedTypes = new Set(r.elements.nodes.map((n) => n.data.type));
    for (const t of Object.keys(NODE_TYPE_RENDER)) {
      assert.ok(renderedTypes.has(t), 'render type "' + t + '" is present in the fixture export');
    }
    // The completeness gate sees every excluded type (counted, not rendered).
    const gate = checkTypeMap(FIXTURE_DIR);
    assert.strictEqual(gate.ok, true, 'type-map gate passes on the clean fixture');
    assert.strictEqual(gate.unmapped.length, 0, 'gate finds zero unmapped types');
    for (const t of EXCLUDE_TYPES) {
      assert.ok(gate.excluded.includes(t), 'exclude type "' + t + '" seen by the gate');
    }
  });

  // ---- 4. The completeness gate FAILS LOUD on an injected unmapped type ----
  // Mirror the fixture into a throwaway temp dir, inject a node with a type that
  // is in NEITHER set, and assert checkTypeMap reports ok=false naming the type.
  await test('type-map gate: injecting an unmapped type into a throwaway copy makes the gate fail', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ge-golden-neg-'));
    const lgOps = require('../lib/core/lazygraph-ops.cjs');
    // Build a minimal valid room then inject the offender.
    const { db, conn } = await lgOps.openGraph(tmp);
    conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run('c1', 'claim', JSON.stringify({ knowledge_type: 'fact', title: 'ok' }));
    conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run('x1', 'TotallyUnmappedFutureType', JSON.stringify({ title: 'offender' }));
    await lgOps.closeGraph(db);

    const gate = checkTypeMap(tmp);
    assert.strictEqual(gate.ok, false, 'gate must FAIL when an unmapped type is present');
    assert.ok(gate.unmapped.includes('TotallyUnmappedFutureType'),
      'gate names the offending unmapped type');
    // And the clean type (claim) is still classified as mapped.
    assert.ok(gate.mapped.includes('claim'), 'mapped types still classified');

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
