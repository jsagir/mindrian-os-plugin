'use strict';

const { registerEurekaTool, signalFromExtra } = require('../eureka-tool-contract.cjs');
const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { ATTRIBUTE_KEYS } = require('../../core/navigation/engine-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const NODE_IDS = z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500);

const TOOLS = [
  {
    capability_id: 'graph.find_structural_gaps',
    tool: 'eureka_graph_find_shared_neighbor_gaps',
    title: 'Find Unlinked MindrianOS Concepts with Shared Neighbors',
    jtbd: 'Use when you want candidate links between unconnected graph nodes that share several neighbors. Review each candidate against source evidence; shared structure does not prove a relationship.',
    options: z.object({ min_common: z.number().int().min(1).max(100).optional(), hub_cap: z.number().int().min(1).max(10000).optional(), top: z.number().int().min(1).max(1000).optional() }).strict(),
    why: 'Read-only ranking of open-triad structural candidates; no relationships are asserted or persisted.',
  },
  {
    capability_id: 'graph.find_network_holes',
    tool: 'eureka_graph_find_network_holes',
    title: 'Find Missing Diagonals in MindrianOS Graph Cycles',
    jtbd: 'Use when you want to find induced four-cycles and their missing diagonals, compared with degree-preserving rewiring. This is a structural lead, not evidence of a meaningful connection. Limit the selection to 1,200 nodes and 6,000 edges.',
    options: z.object({ rounds: z.number().int().min(1).max(10).optional(), seed: z.number().int().optional(), hub_cap: z.number().int().min(1).max(2500).optional(), cycle_limit: z.number().int().min(1).max(20000).optional(), top: z.number().int().min(1).max(1000).optional(), include_persistence: z.boolean().optional() }).strict(),
    why: 'Read-only four-cycle and rewiring analysis; missing diagonals remain candidate leads.',
  },
  {
    capability_id: 'graph.find_bridge_pairs',
    tool: 'eureka_graph_find_community_bridge_pairs',
    title: 'Find Candidate Links Across MindrianOS Graph Communities',
    jtbd: 'Use when you want to identify unconnected node pairs whose neighborhoods meet at a structurally important bridge node across detected communities. Community structure does not establish a useful transfer.',
    options: z.object({ seed: z.number().int().optional(), top: z.number().int().min(1).max(1000).optional(), per_node: z.number().int().min(1).max(100).optional(), min_betweenness: z.number().min(0).optional() }).strict(),
    why: 'Read-only community and bridge analysis; candidates are not accepted relationships.',
  },
  {
    capability_id: 'graph.assess_edge_atypicality',
    tool: 'eureka_graph_assess_category_edge_patterns',
    title: 'Assess Unusual Existing Category Links in MindrianOS',
    jtbd: 'Use when you want to compare category combinations among existing graph edges with degree-preserving rewired graphs. This describes current links; it does not find missing opportunities or measure value.',
    options: z.object({ category_attribute: z.string().min(1).max(128).optional(), shuffles: z.number().int().min(1).max(50).optional(), seed: z.number().int().optional(), use_label: z.boolean().optional() }).strict(),
    why: 'Read-only assessment of existing category-edge patterns; it does not propose or score missing links.',
  },
  {
    capability_id: 'graph.find_semantic_gaps',
    tool: 'eureka_graph_find_similar_unlinked_items',
    title: 'Find Similar MindrianOS Items without a Graph Link',
    jtbd: 'Use when you want to surface text-bearing nodes with similar wording but no graph edge. Similarity is a source-research lead, not proof of a relationship. Choose explicit node IDs and, where useful, a text label.',
    options: z.object({ text_label: z.string().min(1).max(256).nullable().optional(), min_similarity: z.number().min(0).max(1).optional(), top: z.number().int().min(1).max(1000).optional() }).strict(),
    why: 'Read-only lexical similarity search over selected graph text; candidates need evidence review.',
  },
];

// Engine statuses that carry no lineage-bound analysis. They map to a typed,
// fixed-text refusal; engine free text is never forwarded (it can name paths).
// Node attribute keys the projection can carry (review_status is added per node
// by the projection). The engine default for category_attribute is problem_type.
const PROJECTED_ATTRIBUTE_KEYS = new Set([...ATTRIBUTE_KEYS, 'review_status']);
const DEFAULT_CATEGORY_ATTRIBUTE = 'problem_type';
const BRIDGE_MAX_NODES = 2500;
const BRIDGE_MAX_EDGES = 12000;

const ENGINE_FAILURE_STATUSES = new Set(['invalid_input', 'failed', 'blocked', 'cancelled', 'expired']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

async function runDiscoverySignalUnlabeled(spec, args, ctx, extra, deps = {}) {
  const host = (deps.project || project)(args, ctx, extra);
  if (!host.ok) return host;
  // Fail closed before launching an engine when the host holds no usable identity.
  if (!nonEmptyString(host.scope_id) || !nonEmptyString(host.snapshot_id)) {
    return { ok: false, reason: 'projection_lineage_unavailable', capability_id: spec.capability_id,
      message: 'The room projection carries no scope or snapshot identity; no engine was started.' };
  }
  if (spec.capability_id === 'graph.find_network_holes' &&
      (host.snapshot.nodes.length > 1200 || host.snapshot.edges.length > 6000)) {
    return { ok: false, reason: 'network_hole_projection_too_large', capability_id: spec.capability_id,
      scope_id: host.scope_id, snapshot_id: host.snapshot_id, ...projectionDisclosure(host.snapshot.meta),
      message: 'Network-hole analysis is limited to 1,200 nodes and 6,000 edges. Select a smaller authorized set of IDs.' };
  }
  if (spec.capability_id === 'graph.find_bridge_pairs' &&
      (host.snapshot.nodes.length > BRIDGE_MAX_NODES || host.snapshot.edges.length > BRIDGE_MAX_EDGES)) {
    return { ok: false, reason: 'bridge_projection_too_large', capability_id: spec.capability_id,
      scope_id: host.scope_id, snapshot_id: host.snapshot_id, ...projectionDisclosure(host.snapshot.meta),
      message: 'Bridge-pair analysis is limited to 2,500 nodes and 12,000 edges. Select a smaller authorized set of IDs.' };
  }
  if (spec.capability_id === 'graph.assess_edge_atypicality') {
    const attribute = args.category_attribute === undefined ? DEFAULT_CATEGORY_ATTRIBUTE : args.category_attribute;
    if (!PROJECTED_ATTRIBUTE_KEYS.has(attribute)) {
      return { ok: false, reason: 'unsupported_category_attribute', capability_id: spec.capability_id,
        scope_id: host.scope_id, snapshot_id: host.snapshot_id, ...projectionDisclosure(host.snapshot.meta),
        supported_attributes: [...PROJECTED_ATTRIBUTE_KEYS],
        message: 'category_attribute must be one of the node attributes the projection carries (see supported_attributes). No engine was started.' };
    }
  }
  const request = { snapshot: host.snapshot };
  for (const [key, value] of Object.entries(args)) if (key !== 'node_ids' && value !== undefined) request[key] = value;
  const call = deps.callEurekaWorkflow || callEurekaWorkflow;
  const engine = await call(spec.capability_id, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (result && ENGINE_FAILURE_STATUSES.has(result.status)) {
    return { ok: false, reason: `engine_${result.status}`, capability_id: spec.capability_id,
      scope_id: host.scope_id, snapshot_id: host.snapshot_id, engine_status: result.status,
      ...projectionDisclosure(host.snapshot.meta), persistence: 'none', review_required: true,
      message: 'Eureka did not complete this analysis for the selected snapshot, so no lineage-bound result exists. Check the selected node IDs and the algorithm options, then retry.' };
  }
  if (!result || result.capability_id !== spec.capability_id || !nonEmptyString(result.scope_id) || !nonEmptyString(result.snapshot_id) ||
      result.scope_id !== host.scope_id || result.snapshot_id !== host.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', capability_id: spec.capability_id,
      message: 'Eureka returned a result with mismatched capability, room scope, or graph snapshot identity.' };
  }
  return {
    ok: true, capability_id: spec.capability_id, scope_id: host.scope_id, snapshot_id: host.snapshot_id,
    projection: host.snapshot.meta, ...projectionDisclosure(host.snapshot.meta), room_binding: host.room_binding,
    analysis: result, persistence: 'none', review_required: true, acceptance_requires_review: true,
    interpretation: 'algorithmic discovery signal only; inspect source evidence and alternatives before proposing a knowledge change',
  };
}

// Every result, success or refusal, carries the readiness label. The five
// services are experimental: the label is set last so no inner value overrides it.
async function runDiscoverySignal(spec, args, ctx, extra, deps = {}) {
  const result = await runDiscoverySignalUnlabeled(spec, args, ctx, extra, deps);
  return { ...result, readiness: 'experimental' };
}

function register(server, ctx) {
  for (const spec of TOOLS) {
    registerEurekaTool(server, spec.tool, {
      title: spec.title,
      description: `${spec.jtbd} The tool analyzes only explicit node IDs projected from the verified, bound MindrianOS room. It does not expand scope, fetch sources, accept findings, or write the graph. Partial projections are disclosed in the result. Requires MINDRIAN_EUREKA_ROOT and uv.`,
      inputSchema: z.object({ node_ids: NODE_IDS, ...spec.options.shape }).strict(),
    }, async (args, extra) => {
      const result = await runDiscoverySignal(spec, args, ctx, extra);
      return textResponse(result, !result.ok);
    });
  }
}

const connectors = TOOLS.map((spec) => ({
  tool: spec.tool,
  surface: spec.tool,
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: spec.why,
  layer: 'harness',
  layer_why: 'Composes the authorized MindrianOS room projection with a local Eureka discovery algorithm and preserves scope and snapshot lineage.',
}));

module.exports = { TOOLS, runDiscoverySignal, register, connectors };
