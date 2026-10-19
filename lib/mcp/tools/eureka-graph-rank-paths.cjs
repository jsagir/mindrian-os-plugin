'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Rank host-specified graph paths only after verifying their IDs and directed
// relations exist in the same authorized MindrianOS snapshot.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.rank_evidence_paths';

async function rank(args, ctx, extra, deps = {}) {
  const selected = new Set(args.node_ids);
  for (const path of args.paths) {
    if (path.node_ids.some((id) => !selected.has(id))) {
      return { ok: false, reason: 'path_node_outside_projection', message: 'Every path node must be included in the explicit MindrianOS node_ids projection.' };
    }
  }
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const nodes = new Map(hostProjection.snapshot.nodes.map((node) => [node.id, node]));
  const edges = new Map(hostProjection.snapshot.edges.map((edge) => [`${edge.s}\u0000${edge.t}\u0000${edge.type}`, edge]));
  const paths = [];
  for (const [index, path] of args.paths.entries()) {
    const pathNodes = path.node_ids.map((id) => nodes.get(id));
    if (pathNodes.some((node) => !node)) {
      return { ok: false, reason: 'path_node_missing', message: `Path ${index + 1} contains a missing or excluded MindrianOS graph node.` };
    }
    const pathEdges = [];
    for (let hop = 0; hop < path.node_ids.length - 1; hop += 1) {
      const sourceId = path.node_ids[hop];
      const targetId = path.node_ids[hop + 1];
      const edge = edges.get(`${sourceId}\u0000${targetId}\u0000${path.edge_types[hop]}`);
      if (!edge) return { ok: false, reason: 'path_relation_not_in_graph', message: `Path ${index + 1} includes a directed relation not present in the selected MindrianOS graph snapshot.` };
      const row = { from: sourceId, to: targetId, type: edge.type };
      for (const key of ['confidence', 'pws_confidence', 'evidence', 'quarantine_source']) {
        if (edge.attrs && edge.attrs[key] !== undefined) row[key] = edge.attrs[key];
      }
      pathEdges.push(row);
    }
    paths.push({
      hops: pathEdges.length,
      nodes: pathNodes.map((node) => ({ id: node.id, name: node.name })),
      edges: pathEdges,
    });
  }
  const request = { paths, scope_id: hostProjection.scope_id, snapshot_id: hostProjection.snapshot_id };
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== CAPABILITY_ID || result.scope_id !== hostProjection.scope_id ||
      result.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned path rankings with mismatched capability, room scope, or graph snapshot identity.' };
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
    interpretation: 'ranking of host-selected, graph-verified paths; not a graph search or a claim that the path proves its conclusion',
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_rank_paths', {
    title: 'Rank MindrianOS Graph Evidence Paths',
    description: 'Accept ordered candidate paths from the host, verify every node and directed typed edge against an explicit MindrianOS room projection, then rank by hops, unknown confidence, and attached evidence. Returns stable IDs and snapshot lineage. Does not search paths or write the graph.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      paths: z.array(z.object({
        node_ids: z.array(z.string().min(1).max(200)).min(2).max(50),
        edge_types: z.array(z.string().min(1).max(128)).min(1).max(49),
      }).strict().refine((path) => path.edge_types.length === path.node_ids.length - 1)).max(5000),
    }).strict(),
  }, async (args, extra) => {
    const result = await rank(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_rank_paths',
  surface: 'eureka_graph_rank_paths',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only ranking of host-selected paths already verified against the authorized graph snapshot; no path discovery or graph mutation occurs.',
  layer: 'harness',
  layer_why: 'Composes host-retrieved path candidates with MindrianOS identity/edge verification and Eureka ranking while preserving lineage.',
}];

module.exports = { CAPABILITY_ID, rank, register, connectors };
