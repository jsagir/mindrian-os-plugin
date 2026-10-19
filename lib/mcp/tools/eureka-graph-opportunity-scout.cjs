'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Run Eureka's durable RS+HSI opportunity scout over a MindrianOS-authorized
// local graph projection. The scout returns review leads; MindrianOS retains
// source resolution, review, and all graph/portfolio writes.

const { z } = require('zod');
const { prepare } = require('./eureka-graph-prepare-artifacts.cjs');
const { callEurekaOpportunityScout, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'opportunity.synthesize_discovery_signals';

async function run(args, ctx, extra, deps = {}) {
  const projected = await (deps.prepare || prepare)(args, ctx, extra, deps);
  if (!projected.ok) return projected;
  const bundle = projected.bundle;
  const request = {
    objective: args.objective,
    scope_id: projected.scope_id,
    snapshot_id: projected.snapshot_id,
    artifacts: bundle.artifacts,
    top_k: args.top_k,
    scoring: args.scoring,
    lex_weight: args.lex_weight,
    min_percentile: args.min_percentile,
  };
  const engine = await (deps.callEurekaOpportunityScout || callEurekaOpportunityScout)(request, deps.env || process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const analysis = engine.result;
  const resultScope = analysis && analysis.scope;
  if (!analysis || analysis.capability_id !== CAPABILITY_ID ||
      (resultScope && (resultScope.scope_id !== projected.scope_id || resultScope.snapshot_id !== projected.snapshot_id))) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned an opportunity scout result with mismatched capability, room scope, or graph snapshot identity.' };
  }
  if (['completed', 'completed_empty'].includes(analysis.status) &&
      (!resultScope || resultScope.scope_id !== projected.scope_id || resultScope.snapshot_id !== projected.snapshot_id)) {
    return { ok: false, reason: 'engine_lineage_missing', message: 'Eureka completed the opportunity scout without preserving MindrianOS scope and snapshot lineage.' };
  }
  return {
    ok: true,
    capability_id: CAPABILITY_ID,
    job_id: engine.job_id || analysis.job_id,
    status: analysis.status,
    scope_id: projected.scope_id,
    snapshot_id: projected.snapshot_id,
    projection: projected.projection,
    ...projectionDisclosure(projected.projection),
    room_binding: projected.room_binding,
    analysis,
    persistence: 'none',
    accepted_knowledge_persistence: 'none',
    engine_state_persistence: 'durable_local_job_store',
    derived_cache_persistence: 'local_embedding_cache_may_be_written',
    review_required: true,
    acceptance_requires_review: true,
    next_step: 'Resolve candidate source references in MindrianOS, inspect supporting and contradicting evidence, then use the established review flow before filing anything.',
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_opportunity_scout', {
    title: 'Screen Local Graph for Candidate Pair Leads',
    description: 'Screen explicitly selected nodes from the bound MindrianOS room for candidate relationship leads using Eureka RS+HSI. This compatibility tool waits for the job and can block; for non-blocking use, prepare artifacts and call eureka_capability_start with opportunity.synthesize_discovery_signals, then use the job status/result/cancel tools. Results are candidate pair signals, not validated or comprehensive opportunities. Requires MINDRIAN_EUREKA_ROOT and uv; it does not fetch external research or write accepted MindrianOS graph/portfolio state. Eureka persists a local job record and result for up to 30 days and may write derived vectors to its local embedding cache.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(2).max(2500),
      objective: z.string().min(1).max(5000),
      max_artifacts: z.number().int().min(2).max(2500).optional(),
      top_k: z.number().int().min(1).max(100).optional(),
      scoring: z.enum(['hybrid_2026', 'legacy']).optional(),
      lex_weight: z.number().min(0).max(1).optional(),
      min_percentile: z.number().min(0).max(1).optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await run(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_opportunity_scout',
  surface: 'eureka_graph_opportunity_scout',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Runs RS+HSI analysis over a bounded room projection and persists local operational job state; returned leads remain unvalidated and unfiled, with no accepted MindrianOS knowledge write.',
  layer: 'harness',
  layer_why: 'Composes MindrianOS graph authorization and source-linked projection with Eureka opportunity engines while preserving host review and persistence authority.',
}];

module.exports = { CAPABILITY_ID, run, register, connectors };
