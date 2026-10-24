'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Compose a room-authorized graph projection, Eureka's artifact projector,
// and its local Genesis planner. Search remains MindrianOS-brokered.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const BUNDLE_CAPABILITY = 'graph.prepare_artifact_bundle';
const GENESIS_CAPABILITY = 'research.run_genesis_local_plan';

async function plan(args, ctx, extra, deps = {}) {
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const runWorkflow = deps.callEurekaWorkflow || callEurekaWorkflow;
  const bundleResponse = await runWorkflow(BUNDLE_CAPABILITY, {
    snapshot: hostProjection.snapshot,
    objective: args.objective,
    scope_id: hostProjection.scope_id,
  }, process.env, signalFromExtra(extra));
  if (!bundleResponse.ok) return bundleResponse;
  const bundle = bundleResponse.result;
  if (!bundle || bundle.capability_id !== BUNDLE_CAPABILITY || bundle.status !== 'completed_projection' ||
      bundle.scope_id !== hostProjection.scope_id || bundle.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'bundle_lineage_mismatch', message: 'Eureka returned graph artifacts with mismatched scope or snapshot identity.' };
  }

  const researchYear = args.research_year === undefined ? new Date().getUTCFullYear() : args.research_year;
  const planResponse = await runWorkflow(GENESIS_CAPABILITY, {
    ...bundle,
    research_year: researchYear,
  }, process.env, signalFromExtra(extra));
  if (!planResponse.ok) return planResponse;
  const result = planResponse.result;
  const manifest = result && result.source_manifest;
  if (!result || result.capability_id !== GENESIS_CAPABILITY || !manifest ||
      manifest.scope_id !== hostProjection.scope_id || manifest.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'genesis_lineage_mismatch', message: 'Genesis returned a plan with mismatched capability, room scope, or graph snapshot identity.' };
  }
  return {
    ok: true,
    capability_id: GENESIS_CAPABILITY,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
    projection: hostProjection.snapshot.meta,
    ...projectionDisclosure(hostProjection.snapshot.meta),
    room_binding: hostProjection.room_binding,
    artifact_bundle: { capability_id: bundle.capability_id, artifact_count: bundle.artifacts.length },
    plan: result,
    persistence: 'none',
    external_research_executed: false,
    review_required: true,
    acceptance_requires_review: true,
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_genesis_plan', {
    title: 'Plan Future Research from MindrianOS Graph Context',
    description: 'Project explicit nodes from the bound MindrianOS room, convert them into Eureka source-linked artifacts, then run the local Genesis multidomain planner. Returns a lexical, heuristic plan for Theo/MindrianOS review. It performs no model call, external search, or graph write; all research execution remains behind MindrianOS approval.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      objective: z.string().min(1).max(5000),
      research_year: z.number().int().min(2000).max(2100).optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await plan(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_genesis_plan',
  surface: 'eureka_graph_genesis_plan',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Local planning only; the result requires Theo/MindrianOS review and approved broker execution before any external research.',
  layer: 'harness',
  layer_why: 'Composes the authorized MindrianOS projection, typed artifact conversion, and local Genesis planner without graph writes or network access.',
}];

module.exports = { BUNDLE_CAPABILITY, GENESIS_CAPABILITY, plan, register, connectors };
