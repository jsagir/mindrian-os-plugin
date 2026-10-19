'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Translate an explicit MindrianOS graph projection into Eureka's shared
// source-linked artifact contract for text and portfolio engines.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.prepare_artifact_bundle';

async function prepare(args, ctx, extra, deps = {}) {
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const request = {
    snapshot: hostProjection.snapshot,
    objective: args.objective,
    scope_id: hostProjection.scope_id,
  };
  if (args.max_artifacts !== undefined) request.max_artifacts = args.max_artifacts;
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const bundle = engine.result;
  if (!bundle || bundle.capability_id !== CAPABILITY_ID || bundle.status !== 'completed_projection' ||
      bundle.scope_id !== hostProjection.scope_id || bundle.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned an artifact bundle with mismatched capability, scope, snapshot, or projection status.' };
  }
  return {
    ok: true,
    capability_id: CAPABILITY_ID,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
    projection: hostProjection.snapshot.meta,
    ...projectionDisclosure(hostProjection.snapshot.meta),
    room_binding: hostProjection.room_binding,
    bundle,
    persistence: 'none',
    review_required: true,
    acceptance_requires_review: true,
    next_step: 'Route this exact source-linked bundle to a capability whose catalog contract accepts artifacts; keep its scope_id and snapshot_id unchanged.',
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_prepare_artifacts', {
    title: 'Prepare Source-Linked Eureka Artifacts from MindrianOS Graph',
    description: 'Project explicit node IDs from the bound MindrianOS room and call Eureka graph.prepare_artifact_bundle. Returns the versioned artifact contract for compatible text engines, preserving source refs, hashes, scope, and snapshot identity. This prepares input; it does not run the downstream analysis or write graph state.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      objective: z.string().min(1).max(5000),
      max_artifacts: z.number().int().min(2).max(2500).optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await prepare(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_prepare_artifacts',
  surface: 'eureka_graph_prepare_artifacts',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only projection and transformation into a typed source-linked bundle; no downstream analysis or graph write.',
  layer: 'harness',
  layer_why: 'Prepares the MindrianOS-authorized local graph view for source-bounded Eureka text engines.',
}];

module.exports = { CAPABILITY_ID, prepare, register, connectors };
