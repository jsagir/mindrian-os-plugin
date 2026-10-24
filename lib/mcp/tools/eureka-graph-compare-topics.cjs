'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Compare two explicitly selected text corpora from the MindrianOS room graph.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.compare_bidirectional_topics';

async function compare(args, ctx, extra, deps = {}) {
  if (args.node_ids_a.some((id) => args.node_ids_b.includes(id))) {
    return { ok: false, reason: 'corpora_overlap', message: 'The two topic-comparison corpora must use distinct MindrianOS node IDs.' };
  }
  const nodeIds = [...args.node_ids_a, ...args.node_ids_b];
  const hostProjection = (deps.project || project)({ node_ids: nodeIds }, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const nodes = new Map(hostProjection.snapshot.nodes.map((node) => [node.id, node]));
  const resolveCorpus = (ids, corpus) => {
    const texts = [];
    for (const id of ids) {
      const node = nodes.get(id);
      if (!node) return { ok: false, reason: 'corpus_node_missing', ...projectionDisclosure(hostProjection.snapshot.meta),
        message: `A selected ${corpus} node is missing or excluded from the MindrianOS projection.` };
      if (!node.text || node.text_truncated) return { ok: false, reason: 'corpus_text_unavailable', ...projectionDisclosure(hostProjection.snapshot.meta),
        message: `Every ${corpus} corpus node needs non-empty, untruncated text in the MindrianOS projection.` };
      texts.push(node.text);
    }
    return { ok: true, texts };
  };
  const corpusA = resolveCorpus(args.node_ids_a, 'A');
  if (!corpusA.ok) return corpusA;
  const corpusB = resolveCorpus(args.node_ids_b, 'B');
  if (!corpusB.ok) return corpusB;
  const request = {
    texts_a: corpusA.texts,
    texts_b: corpusB.texts,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
  };
  for (const key of ['k', 'tau', 'seeds']) if (args[key] !== undefined) request[key] = args[key];
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== CAPABILITY_ID || result.scope_id !== hostProjection.scope_id ||
      result.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned topic results with mismatched capability, room scope, or graph snapshot identity.' };
  }
  return {
    ok: true,
    capability_id: CAPABILITY_ID,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
    projection: hostProjection.snapshot.meta,
    ...projectionDisclosure(hostProjection.snapshot.meta),
    room_binding: hostProjection.room_binding,
    corpus_refs: { texts_a: args.node_ids_a, texts_b: args.node_ids_b },
    analysis: result,
    persistence: 'none',
    review_required: true,
    acceptance_requires_review: true,
    interpretation: 'corpus-relative topic outliers; not validated opportunities or evidence of novelty',
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_compare_topics', {
    title: 'Compare Topics Across MindrianOS Graph Corpora',
    description: 'Build two text corpora from distinct, explicitly selected MindrianOS graph node IDs and run Eureka bidirectional topic comparison. Results include corpus index-to-node mappings and scope/snapshot lineage; they are exploratory outliers, not validated opportunities. No graph write or external research occurs.',
    inputSchema: z.object({
      node_ids_a: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      node_ids_b: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      k: z.number().int().min(1).max(100).optional(),
      tau: z.number().min(0).max(1).optional(),
      seeds: z.array(z.number().int()).min(1).max(50).optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await compare(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_compare_topics',
  surface: 'eureka_graph_compare_topics',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only comparison of host-selected corpora; topic outliers remain exploratory and are not filed or treated as novel.',
  layer: 'harness',
  layer_why: 'Composes bounded MindrianOS text selections with Eureka bidirectional topic analysis and source index lineage.',
}];

module.exports = { CAPABILITY_ID, compare, register, connectors };
