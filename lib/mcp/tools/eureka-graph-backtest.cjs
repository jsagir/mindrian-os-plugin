'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Temporally evaluate relationship methods over one explicit, authorized
// MindrianOS room projection. This is historical evaluation, not graph truth.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.backtest_relationship_methods';

async function backtest(args, ctx, extra, deps = {}) {
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const snapshot = {
    ...hostProjection.snapshot,
    edges: hostProjection.snapshot.edges.map((edge) => ({
      s: edge.s, t: edge.t, type: edge.type,
      ...(typeof edge.attrs?.created_at === 'string' ? { created_at: edge.attrs.created_at } : {}),
    })),
  };
  // This capability takes scope and snapshot identity from snapshot.meta;
  // its published input schema rejects duplicate top-level lineage fields.
  const request = { snapshot };
  if (args.cutoff !== undefined) request.cutoff = args.cutoff;
  if (args.seed !== undefined) request.seed = args.seed;
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== CAPABILITY_ID || result.scope_id !== hostProjection.scope_id ||
      result.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned an evaluation with mismatched capability, room scope, or graph snapshot identity.' };
  }
  return {
    ok: true,
    capability_id: CAPABILITY_ID,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
    projection: hostProjection.snapshot.meta,
    ...projectionDisclosure(hostProjection.snapshot.meta),
    room_binding: hostProjection.room_binding,
    evaluation: result,
    persistence: 'none',
    review_required: true,
    acceptance_requires_review: true,
    interpretation: 'historical method evaluation only; not evidence that a candidate relationship is true',
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_backtest', {
    title: 'Backtest Relationship Methods on MindrianOS Graph History',
    description: 'Project explicit IDs from the bound MindrianOS room and evaluate relationship methods against dated edges in that snapshot. Reads only allowlisted edge created_at metadata. Returns a scope/snapshot-bound evaluation or insufficient-data result; it does not propose accepted facts or write the graph.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      cutoff: z.string().min(1).max(64).optional(),
      seed: z.number().int().optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await backtest(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_backtest',
  surface: 'eureka_graph_backtest',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only evaluation of historical graph relationships; output is method performance evidence, not a relation proposal or graph write.',
  layer: 'harness',
  layer_why: 'Composes the MindrianOS-authorized graph projection with Eureka temporal evaluation and preserves source snapshot lineage.',
}];

module.exports = { CAPABILITY_ID, backtest, register, connectors };
