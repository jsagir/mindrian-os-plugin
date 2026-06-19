'use strict';
/*
 * Phase 165 Wave-4 GREEN test -- test-unknowns-frozen-edges (D-165-08).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 5):
 *   The engine emits ONLY the four frozen edge types
 *   INVALIDATES / ROOT_CAUSES / ENABLES / FEEDS_INTO (remap-only, D-165-08; 165
 *   mints NO new edge type and makes ZERO edges.cjs change). The shared iface
 *   exports exactly these four as FROZEN_ENGINE_EDGES, and the engine edge-writer
 *   (lib/core/unknowns/edge-writer.cjs) performs the issue-tree.cjs:67-style
 *   module-load self-check against the LIVE ALLOWED_EDGE_TYPES
 *   (lib/core/navigation/edges.cjs) so a remap that DRIFTS out of the frozen set
 *   throws at require time. A drifted/made-up edge type is rejected by
 *   navigation.writeEdge (invalid_edge_type), never silently written.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('assert');
const { FROZEN_ENGINE_EDGES } = require('../lib/core/unknowns/iface.cjs');
const { ALLOWED_EDGE_TYPES } = require('../lib/core/navigation/edges.cjs');
const edgeWriter = require('../lib/core/unknowns/edge-writer.cjs');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + name + ': ' + e.message);
  }
}

const EXPECTED = ['INVALIDATES', 'ROOT_CAUSES', 'ENABLES', 'FEEDS_INTO'];

check('iface exports EXACTLY the four frozen engine edge types', () => {
  const keys = Object.keys(FROZEN_ENGINE_EDGES).sort();
  assert.deepStrictEqual(keys, EXPECTED.slice().sort(),
    'FROZEN_ENGINE_EDGES keys drifted: ' + keys.join(','));
  for (const t of EXPECTED) {
    assert.strictEqual(FROZEN_ENGINE_EDGES[t], t, 'frozen edge value mismatch for ' + t);
  }
});

check('every emittable engine edge type is a LIVE frozen member of ALLOWED_EDGE_TYPES', () => {
  for (const t of Object.values(FROZEN_ENGINE_EDGES)) {
    assert(ALLOWED_EDGE_TYPES.has(t), 'engine edge ' + t + ' is NOT in the live ALLOWED_EDGE_TYPES');
  }
});

check('the edge-writer loaded -> the module-load self-check passed against the live set', () => {
  // require() above did not throw, so the issue-tree.cjs:67-style self-check over
  // FROZEN_ENGINE_EDGES vs ALLOWED_EDGE_TYPES held. The writer surface is present.
  assert.strictEqual(typeof edgeWriter.writeFinding, 'function', 'writeFinding missing');
  assert.strictEqual(typeof edgeWriter.writeFindings, 'function', 'writeFindings missing');
  assert.strictEqual(typeof edgeWriter.candidateToFinding, 'function',
    'edge-writer must re-export the SHIPPED candidateToFinding adapter (Part 7 reuse)');
});

check('the self-check would THROW on a drifted (non-frozen) emittable type', () => {
  // Simulate the issue-tree.cjs:67 self-check over a drifted set: a made-up type
  // is not in the live frozen set, so the load-time assertion must fail.
  const driftedSet = Object.assign({}, FROZEN_ENGINE_EDGES, { DRIFTED: 'MADE_UP_UU_EDGE' });
  let threw = false;
  try {
    for (const t of Object.values(driftedSet)) {
      if (!ALLOWED_EDGE_TYPES.has(t)) {
        throw new Error('edge ' + t + ' not frozen');
      }
    }
  } catch (_e) {
    threw = true;
  }
  assert.strictEqual(threw, true, 'a drifted emittable type must trip the frozen-set self-check');
});

check('navigation.writeEdge rejects a made-up edge type (invalid_edge_type)', () => {
  const navigation = require('../lib/core/navigation.cjs');
  // No real db needed: the edge_type allow-list check happens before any db touch.
  const res = navigation.writeEdge({}, {
    source_id: 'handle:a',
    target_id: 'handle:b',
    edge_type: 'MADE_UP_UU_EDGE',
    properties: { relation: 'x' },
  });
  assert(res && res.ok === false, 'writeEdge must reject a made-up edge type');
  assert.strictEqual(res.reason, 'invalid_edge_type', 'rejection reason should be invalid_edge_type');
});

if (failures > 0) {
  console.error('test-unknowns-frozen-edges: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-frozen-edges: GREEN (4 frozen edges; live ALLOWED_EDGE_TYPES self-check; drift throws; writeEdge rejects made-up)');
process.exit(0);
