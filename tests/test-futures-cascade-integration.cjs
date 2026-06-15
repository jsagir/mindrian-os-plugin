'use strict';
/**
 * Phase 156 gap fix -- integration test for the NATURAL generate->register->cascade flow (FW-05/FW-06).
 *
 * Regression guard for the live-UAT bug found on the `formation` room (2026-06-15):
 * generateRing assigned short ids (slug-rN) but registerConsequenceArtifacts
 * registered the Artifact node under a PATH-derived id (consequenceArtifactId).
 * writeCascadeEdges then wrote ROOT_CAUSES against the short id -> target node
 * absent -> edge_write_failed (0 edges). The unit test (test-futures-edges.cjs)
 * missed this because it hand-inserts nodes with matching short ids.
 *
 * Fix: registerConsequenceArtifacts stamps the registered id back onto each
 * consequence object (c.id = artifactId), so the cascade uses the id that exists.
 *
 * This test drives the REAL flow (no hand-inserted nodes) and asserts ROOT_CAUSES
 * edges actually write between registered ring-1 parents and ring-2 children.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const orch = require('../lib/core/futures/orchestrator.cjs');
const lazygraph = require('../lib/core/lazygraph-ops.cjs');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-cascade-'));
  try {
    const SEED = 'cross domain cascade integration seed';

    // RING 1 -- generate + register. After the fix, each consequence object's
    // .id is stamped to its registered (path-derived) Artifact-node id.
    const r1raw = [
      { label: 'First order cause alpha', body: 'A ring-1 consequence in the social domain that leads to downstream effects.', horizon: 'near', confidence: 0.7, domain: 'Social' },
      { label: 'First order cause beta', body: 'A ring-1 consequence in the economic domain that drives later structural change.', horizon: 'near', confidence: 0.6, domain: 'Economic' },
    ];
    const r1 = orch.generateRing(SEED, 1, [], { children: r1raw });
    assert.strictEqual(r1.length, 2, 'ring 1 has 2 consequences');
    const reg1 = await orch.registerConsequenceArtifacts(tmp, r1, { seed: SEED });
    assert.strictEqual(reg1.filed.length, 2, 'ring 1 filed 2 artifacts');

    // THE FIX ASSERTION: the consequence object id now equals the registered id.
    assert.strictEqual(r1[0].id, reg1.filed[0].id, 'registerConsequenceArtifacts stamps the registered id back onto the consequence object (ring 1)');

    // RING 2 -- expand the registered ring-1 parents. parent.id is the registered id.
    const parents = [
      { id: r1[0].id, children: [
        { label: 'Second order effect gamma', body: 'A ring-2 consequence caused by alpha, in the political domain.', horizon: 'mid', confidence: 0.5, domain: 'Political' },
      ]},
      { id: r1[1].id, children: [
        { label: 'Second order effect delta', body: 'A ring-2 consequence caused by beta, in the technological domain.', horizon: 'mid', confidence: 0.5, domain: 'Technological' },
      ]},
    ];
    const r2 = orch.generateRing(SEED, 2, parents, {});
    assert.strictEqual(r2.length, 2, 'ring 2 has 2 consequences');
    const reg2 = await orch.registerConsequenceArtifacts(tmp, r2, { seed: SEED });
    assert.strictEqual(reg2.filed.length, 2, 'ring 2 filed 2 artifacts');
    assert.strictEqual(r2[0].id, reg2.filed[0].id, 'ring-2 consequence id stamped to registered id');
    assert.ok(r2[0].parent_id === r1[0].id || r2[0].parent_id === r1[1].id, 'ring-2 parent_id is a registered ring-1 id');

    // CASCADE -- ROOT_CAUSES must now actually write (both endpoints exist).
    const graph = await lazygraph.openGraph(tmp);
    try {
      const casc = orch.writeCascadeEdges(graph.db, r2);
      assert.strictEqual(casc.failures.length, 0, 'no cascade failures in the natural flow (the bug was 4 failures)');
      assert.strictEqual(casc.written, 2, 'two ROOT_CAUSES edges wrote against REGISTERED ids (the bug wrote 0)');
      // confirm the rows exist in room.db
      const rows = graph.conn.prepare("SELECT source, target, type FROM edges WHERE type='ROOT_CAUSES'").all();
      assert.strictEqual(rows.length, 2, 'two ROOT_CAUSES rows persisted');
      for (const row of rows) {
        assert.ok(row.source === r1[0].id || row.source === r1[1].id, 'ROOT_CAUSES source is a registered ring-1 parent');
      }
    } finally { await lazygraph.closeGraph(graph.db); }

    console.log('test-futures-cascade-integration: PASS');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(e => { console.error('test-futures-cascade-integration: FAIL', e.message); process.exit(1); });
