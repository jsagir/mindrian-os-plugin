'use strict';

const assert = require('node:assert/strict');
const { TOOLS, runDiscoverySignal, register } = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');

const base = {
  ok: true,
  scope_id: 'room-test',
  snapshot_id: 'snapshot-test',
  room_binding: { room_id: 'room-test', source: 'session', registry_fallback: false },
  snapshot: { nodes: [{ id: 'n1' }], edges: [], meta: { complete: true, omissions: {} } },
};

async function main() {
  assert.equal(TOOLS.length, 5);
  for (const spec of TOOLS) {
    let seen;
    const result = await runDiscoverySignal(spec, { node_ids: ['n1'], top: 3 }, {}, {}, {
      project: () => base,
      callEurekaWorkflow: async (capabilityId, request, _env, signal) => {
        seen = { capabilityId, request, signal };
        return { ok: true, result: { capability_id: capabilityId, scope_id: 'room-test', snapshot_id: 'snapshot-test' } };
      },
    });
    assert.equal(result.ok, true, spec.capability_id);
    assert.equal(result.review_required, true);
    assert.equal(result.persistence, 'none');
    assert.equal(seen.capabilityId, spec.capability_id);
    assert.deepEqual(seen.request.snapshot, base.snapshot);
    assert.equal(seen.request.top, 3);
    assert.equal('node_ids' in seen.request, false);
  }

  const partialProjection = { ...base, snapshot: { ...base.snapshot, meta: { complete: false, omissions: { missing_node_ids: ['absent'] } } } };
  const partial = await runDiscoverySignal(TOOLS[0], { node_ids: ['n1'] }, {}, {}, {
    project: () => partialProjection,
    callEurekaWorkflow: async (capabilityId) => ({ ok: true, result: { capability_id: capabilityId, scope_id: 'room-test', snapshot_id: 'snapshot-test' } }),
  });
  assert.equal(partial.ok, true);
  assert.equal(partial.partial, true);
  assert.equal(partial.projection_complete, false);
  assert.deepEqual(partial.projection_omissions, { missing_node_ids: ['absent'] });

  const network = TOOLS.find((x) => x.capability_id === 'graph.find_network_holes');
  let called = false;
  const oversized = { ...base, snapshot: { ...base.snapshot, nodes: Array(1201).fill({ id: 'n' }) } };
  const sizeResult = await runDiscoverySignal(network, { node_ids: ['n1'] }, {}, {}, {
    project: () => oversized,
    callEurekaWorkflow: async () => { called = true; return { ok: true, result: {} }; },
  });
  assert.equal(sizeResult.reason, 'network_hole_projection_too_large');
  assert.equal(called, false);

  const mismatch = await runDiscoverySignal(TOOLS[0], { node_ids: ['n1'] }, {}, {}, {
    project: () => base,
    callEurekaWorkflow: async () => ({ ok: true, result: { capability_id: TOOLS[0].capability_id, scope_id: 'wrong', snapshot_id: 'snapshot-test' } }),
  });
  assert.equal(mismatch.reason, 'engine_lineage_mismatch');

  const handlers = new Map();
  register({ registerTool: (name, config, handler) => handlers.set(name, { config, handler }) }, {});
  assert.deepEqual([...handlers.keys()].sort(), TOOLS.map((x) => x.tool).sort());
  for (const item of handlers.values()) {
    assert.ok(item.config.outputSchema);
    assert.ok(item.config.annotations.readOnlyHint);
    assert.ok(item.config.annotations.openWorldHint === false);
  }
  console.log(`PASS (${TOOLS.length} graph discovery adapters, lineage, partial disclosure, network limits, MCP contracts)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
