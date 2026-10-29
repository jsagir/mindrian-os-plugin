'use strict';

// Plan 373-02 item 2: size and attribute pre-checks run on the host, before
// any engine starts. network_holes (1,200 nodes, 6,000 edges) is covered here
// again as a boundary control. bridge_pairs has 2,500 nodes and 12,000 edges.
// edge_atypicality needs a category attribute the projection can carry.

const assert = require('node:assert/strict');
const { TOOLS, runDiscoverySignal } = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');

const byId = (id) => TOOLS.find((spec) => spec.capability_id === id);
const sized = (nodes, edges) => ({
  ok: true, scope_id: 'room-test', snapshot_id: 'snapshot-test',
  room_binding: { room_id: 'room-test', source: 'session.primary', registry_fallback: false },
  snapshot: {
    nodes: Array.from({ length: nodes }, (_v, i) => ({ id: 'n' + i })),
    edges: Array.from({ length: edges }, (_v, i) => ({ s: 'n0', t: 'n1', type: 't' + i })),
    meta: { complete: true, omissions: {} },
  },
});

async function attempt(spec, host, args = {}) {
  let launches = 0;
  const out = await runDiscoverySignal(spec, { node_ids: ['n0'], ...args }, {}, {}, {
    project: () => host,
    callEurekaWorkflow: async () => {
      launches += 1;
      return { ok: true, result: { capability_id: spec.capability_id, scope_id: 'room-test', snapshot_id: 'snapshot-test', status: 'completed_analysis' } };
    },
  });
  return { out, launches };
}

async function main() {
  // bridge_pairs
  const bridge = byId('graph.find_bridge_pairs');
  for (const [nodes, edges] of [[2501, 10], [10, 12001]]) {
    const { out, launches } = await attempt(bridge, sized(nodes, edges));
    assert.equal(out.ok, false, `bridge ${nodes}/${edges} refused`);
    assert.equal(out.reason, 'bridge_projection_too_large');
    assert.equal(launches, 0, 'no engine launch above the bridge limit');
    assert.equal(out.scope_id, 'room-test');
    assert.equal(typeof out.partial, 'boolean', 'projection disclosure stays at the top level');
  }
  for (const [nodes, edges] of [[2500, 12000], [10, 10]]) {
    const { out, launches } = await attempt(bridge, sized(nodes, edges));
    assert.equal(out.ok, true, `bridge ${nodes}/${edges} at the limit still runs`);
    assert.equal(launches, 1);
  }

  // network_holes boundary control (limits already existed)
  const holes = byId('graph.find_network_holes');
  for (const [nodes, edges, ok] of [[1201, 1, false], [1, 6001, false], [1200, 6000, true]]) {
    const { out } = await attempt(holes, sized(nodes, edges));
    assert.equal(out.ok, ok, `network holes ${nodes}/${edges}`);
    if (!ok) assert.equal(out.reason, 'network_hole_projection_too_large');
  }

  // edge_atypicality: category_attribute must be a key the projection carries
  const atypical = byId('graph.assess_edge_atypicality');
  for (const attr of ['not_a_projected_key', 'properties', 'secret', 'Domain']) {
    const { out, launches } = await attempt(atypical, sized(5, 2), { category_attribute: attr });
    assert.equal(out.ok, false, `attribute ${attr} refused`);
    assert.equal(out.reason, 'unsupported_category_attribute');
    assert.equal(launches, 0, 'no engine launch for an unprojected attribute');
    assert.equal(JSON.stringify(out).includes(attr), false, 'caller text is not echoed');
  }
  for (const attr of [undefined, 'problem_type', 'domain', 'status', 'review_status']) {
    const args = attr === undefined ? {} : { category_attribute: attr };
    const { out, launches } = await attempt(atypical, sized(5, 2), args);
    assert.equal(out.ok, true, `attribute ${attr} accepted: ${JSON.stringify(out)}`);
    assert.equal(launches, 1);
  }

  // The size checks do not touch the other services.
  for (const id of ['graph.find_structural_gaps', 'graph.find_semantic_gaps']) {
    const { out } = await attempt(byId(id), sized(2500, 12000));
    assert.equal(out.ok, true, `${id} is not subject to the bridge limit`);
  }

  console.log('eureka 373-02 prechecks: PASS (bridge 2,500/12,000, network holes 1,200/6,000, atypicality attribute)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
