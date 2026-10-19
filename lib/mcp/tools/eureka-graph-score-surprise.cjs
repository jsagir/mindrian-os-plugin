'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Read claim text from an explicit MindrianOS snapshot and attach caller-owned
// probability judgments for Eureka's deterministic surprise/entropy triage.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.score_bayesian_surprise';
const probabilityArray = z.array(z.number().min(0).max(1)).min(1).max(100);

async function score(args, ctx, extra, deps = {}) {
  const selected = new Set(args.node_ids);
  if (args.claims.some((row) => !selected.has(row.id))) {
    return { ok: false, reason: 'claim_outside_projection', message: 'Every probability record ID must be included in the explicit MindrianOS node_ids projection.' };
  }
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const nodes = new Map(hostProjection.snapshot.nodes.map((node) => [node.id, node]));
  const claims = [];
  for (const row of args.claims) {
    const node = nodes.get(row.id);
    if (!node) return { ok: false, reason: 'claim_missing_from_projection', ...projectionDisclosure(hostProjection.snapshot.meta),
      message: 'A selected probability record has no node in the MindrianOS projection.' };
    if (!node.text || node.text_truncated) {
      return { ok: false, reason: 'claim_text_unavailable', ...projectionDisclosure(hostProjection.snapshot.meta),
        message: 'Bayesian surprise requires non-empty, untruncated claim text from each selected MindrianOS graph node.' };
    }
    if (row.prior.length !== row.posterior.length) {
      return { ok: false, reason: 'probability_dimension_mismatch', message: 'Each prior and posterior must use the same number of categories.' };
    }
    claims.push({ id: row.id, claim: node.text, prior: row.prior, posterior: row.posterior });
  }
  const request = { claims, scope_id: hostProjection.scope_id, snapshot_id: hostProjection.snapshot_id };
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== CAPABILITY_ID || result.scope_id !== hostProjection.scope_id ||
      result.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned surprise scores with mismatched capability, room scope, or graph snapshot identity.' };
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
    interpretation: 'caller-supplied probability judgments; surprise is review triage, not a truth score',
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_score_surprise', {
    title: 'Score Bayesian Surprise for MindrianOS Claims',
    description: 'Read claim text from explicitly selected MindrianOS graph nodes and combine it with caller-supplied prior/posterior probability vectors. Returns scope/snapshot-bound entropy and surprise triage. Eureka does not infer probabilities, retrieve evidence, or write the graph.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      claims: z.array(z.object({
        id: z.string().min(1).max(256),
        prior: probabilityArray,
        posterior: probabilityArray,
      }).strict()).min(1).max(1000),
    }).strict(),
  }, async (args, extra) => {
    const result = await score(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_score_surprise',
  surface: 'eureka_graph_score_surprise',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only triage over graph claims and caller probability judgments; the output neither assesses claim truth nor writes graph state.',
  layer: 'harness',
  layer_why: 'Composes MindrianOS graph authorization and caller-owned priors/posteriors with Eureka deterministic Bayesian surprise scoring.',
}];

module.exports = { CAPABILITY_ID, score, register, connectors };
