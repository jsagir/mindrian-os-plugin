'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// MindrianOS-owned HSI input plus a bounded local graph projection -> Eureka.
// Classification is derived only from selected graph relations; coordinates
// and whitespace zones are supplied by the upstream HSI stage.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'portfolio.interpret_whitespace';
const PROBLEM_TYPES = new Set(['Un-Defined', 'Ill-Defined', 'Well-Defined', 'Wicked']);

function isFramework(node) {
  return Array.isArray(node.labels) && node.labels.some((label) => String(label).toLowerCase() === 'framework');
}

function isProblemType(node) {
  return Array.isArray(node.labels) && node.labels.some((label) => String(label).toLowerCase() === 'problemtype');
}

function deriveFrameworkRelations(snapshot) {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const problemTypeEdges = [];
  const feedsIntoEdges = [];
  for (const edge of snapshot.edges) {
    const source = nodes.get(edge.s);
    const target = nodes.get(edge.t);
    if (!source || !target) continue;
    if (edge.type === 'ADDRESSES_PROBLEM_TYPE' && isFramework(source) && isProblemType(target) && PROBLEM_TYPES.has(target.name)) {
      const mapping = {
        framework_id: source.id,
        framework: source.name,
        problem_type: target.name,
      };
      if (typeof edge.attrs?.effectiveness === 'number') mapping.effectiveness = edge.attrs.effectiveness;
      problemTypeEdges.push(mapping);
    }
    if (edge.type === 'FEEDS_INTO' && isFramework(source) && isFramework(target)) {
      const relation = { source_id: source.id, target_id: target.id, source: source.name, target: target.name };
      if (typeof edge.attrs?.confidence === 'number') relation.confidence = edge.attrs.confidence;
      if (typeof edge.attrs?.transform === 'string') relation.transform = edge.attrs.transform;
      feedsIntoEdges.push(relation);
    }
  }
  return { problemTypeEdges, feedsIntoEdges };
}

function referenceIds(gap) {
  return (gap.nearest_room_artifacts || []).map((item) => typeof item === 'string' ? item : item?.id || item?.artifact_id).filter(Boolean);
}

async function interpret(args, ctx, extra, deps = {}) {
  const selected = new Set(args.node_ids);
  for (const gap of args.gaps) {
    if (typeof gap.brain_framework_id !== 'string' || !selected.has(gap.brain_framework_id)) {
      return { ok: false, reason: 'framework_outside_projection', message: 'Each HSI gap must reference a brain_framework_id included in the explicit MindrianOS node_ids projection.' };
    }
    if (referenceIds(gap).some((id) => !selected.has(id))) {
      return { ok: false, reason: 'artifact_outside_projection', message: 'Each nearest room artifact must be included in the explicit MindrianOS node_ids projection.' };
    }
  }
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const selectedNodes = new Set(hostProjection.snapshot.nodes.map((node) => node.id));
  if (args.gaps.some((gap) => !selectedNodes.has(gap.brain_framework_id) || referenceIds(gap).some((id) => !selectedNodes.has(id)))) {
    return { ok: false, reason: 'projection_incomplete', ...projectionDisclosure(hostProjection.snapshot.meta),
      message: 'A MindrianOS graph reference required by an HSI zone is missing or excluded from the selected projection.' };
  }
  const projectedNodes = new Map(hostProjection.snapshot.nodes.map((node) => [node.id, node]));
  if (args.gaps.some((gap) => gap.brain_framework.trim() !== projectedNodes.get(gap.brain_framework_id)?.name)) {
    return { ok: false, reason: 'framework_name_mismatch', message: 'HSI framework names must match the selected MindrianOS Framework node names.' };
  }
  const projectedUmapIds = (args.umap_2d.room_artifacts || []).map((point) => point.id).filter((id) => id !== undefined && id !== null).map(String);
  if (projectedUmapIds.some((id) => !selectedNodes.has(id))) {
    return { ok: false, reason: 'umap_artifact_outside_projection', message: 'Every identified HSI UMAP artifact must be included in the explicit MindrianOS node_ids projection.' };
  }
  const { problemTypeEdges, feedsIntoEdges } = deriveFrameworkRelations(hostProjection.snapshot);
  const request = {
    gaps: args.gaps,
    problem_type_edges: problemTypeEdges,
    feeds_into_edges: feedsIntoEdges,
    umap_2d: args.umap_2d,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
  };
  for (const key of ['spread_mode', 'spread_percentile', 'offline_validate', 'hypothesis_top']) {
    if (args[key] !== undefined) request[key] = args[key];
  }
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== CAPABILITY_ID || result.scope?.scope_id !== hostProjection.scope_id ||
      result.scope?.snapshot_id !== hostProjection.snapshot_id) {
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
  registerEurekaTool(server, 'eureka_hsi_interpret_whitespace', {
    title: 'Interpret HSI Whitespace Using the MindrianOS Framework Graph',
    description: 'Accept HSI zones and their 2D projection, then derive problem-type and FEEDS_INTO mappings exclusively from explicitly selected MindrianOS graph nodes and edges. Calls Eureka portfolio.interpret_whitespace and returns a scope/snapshot-bound interpretation for Theo. Does not infer problem type from text, expand graph scope, or write graph state.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      gaps: z.array(z.object({
        id: z.string().min(1).max(512),
        brain_framework_id: z.string().min(1).max(512),
        brain_framework: z.string().min(1).max(500),
        gap_percentile: z.number().min(0).max(1).optional(),
        density_score: z.number().optional(),
        zone_id: z.string().max(512).optional(),
        nearest_room_artifacts: z.array(z.union([
          z.string().min(1).max(512),
          z.object({ id: z.string().min(1).max(512).optional(), artifact_id: z.string().min(1).max(512).optional(), title: z.string().max(500).optional(), section: z.string().max(500).optional() }).strict().refine((item) => Boolean(item.id || item.artifact_id)),
        ])).max(100),
      }).strict()).min(1).max(500),
      umap_2d: z.object({
        room_artifacts: z.array(z.object({ id: z.union([z.string(), z.number(), z.null()]).optional(), title: z.string().max(500).nullable().optional(), x: z.number(), y: z.number(), cluster: z.union([z.string(), z.number(), z.null()]).optional() }).strict()).max(2500).optional(),
        room: z.array(z.tuple([z.number(), z.number()])).max(2500).optional(),
        labels_room: z.array(z.union([z.string(), z.number(), z.null()])).max(2500).optional(),
      }).strict(),
      spread_mode: z.enum(['percentile', 'fixed']).optional(),
      spread_percentile: z.number().min(0).max(1).optional(),
      offline_validate: z.boolean().optional(),
      hypothesis_top: z.number().int().min(0).max(50).optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await interpret(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_hsi_interpret_whitespace',
  surface: 'eureka_hsi_interpret_whitespace',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only interpretation; zone classifications inherit explicit graph mappings and proposed questions remain unfiled for Theo review.',
  layer: 'harness',
  layer_why: 'Composes MindrianOS-owned HSI outputs and an explicitly scoped framework graph projection with Eureka interpretation.',
}];

module.exports = { CAPABILITY_ID, deriveFrameworkRelations, interpret, register, connectors };
