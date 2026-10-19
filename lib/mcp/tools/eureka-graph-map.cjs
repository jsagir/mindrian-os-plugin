'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Local structure-mapping engine over two caller-selected neighborhoods from
// the MindrianOS-authorized graph snapshot. Result proposals remain pending.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.map_neighbourhoods';

async function map(args, ctx, extra, deps = {}) {
  if (args.base_node_id === args.target_node_id) {
    return { ok: false, reason: 'invalid_focus_pair', message: 'base_node_id and target_node_id must differ.' };
  }
  if (!args.node_ids.includes(args.base_node_id) || !args.node_ids.includes(args.target_node_id)) {
    return { ok: false, reason: 'focus_nodes_not_selected', message: 'Both focus node IDs must be included in the explicit node_ids projection.' };
  }
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const request = {
    snapshot: hostProjection.snapshot,
    base_node_id: args.base_node_id,
    target_node_id: args.target_node_id,
    hops: args.hops,
    rules: args.rules,
    attr: args.attr,
  };
  for (const key of Object.keys(request)) if (request[key] === undefined) delete request[key];
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== CAPABILITY_ID || result.scope_id !== hostProjection.scope_id ||
      result.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned a result with mismatched capability, room scope, or graph snapshot identity.' };
  }
  return {
    ok: true,
    capability_id: CAPABILITY_ID,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
    projection: hostProjection.snapshot.meta,
    ...projectionDisclosure(hostProjection.snapshot.meta),
    room_binding: hostProjection.room_binding,
    analysis: result,
    persistence: 'none',
    review_required: true,
    acceptance_requires_review: true,
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_map_neighbourhoods', {
    title: 'Map Structural Analogy Between MindrianOS Graph Neighborhoods',
    description: 'Project explicit MindrianOS graph node IDs, then call Eureka graph.map_neighbourhoods over the selected snapshot. Requires distinct base and target IDs in the selection. Returns structural correspondences as unevidenced proposals; it does not expand the host projection or write graph state.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      base_node_id: z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/),
      target_node_id: z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/),
      hops: z.number().int().min(0).max(4).optional(),
      rules: z.enum(['AN', 'LS', 'MA']).optional(),
      attr: z.string().max(128).optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await map(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_map_neighbourhoods',
  surface: 'eureka_graph_map_neighbourhoods',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only structural comparison; candidate inferences remain proposed, unevidenced, and unfiled.',
  layer: 'harness',
  layer_why: "Composes MindrianOS graph authorization with Eureka's local SME mapping method and preserves snapshot lineage.",
}];

module.exports = { CAPABILITY_ID, map, register, connectors };
