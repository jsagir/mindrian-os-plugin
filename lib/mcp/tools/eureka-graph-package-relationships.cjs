'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Package host-proposed relationships against source/evidence nodes selected
// from the MindrianOS room. Eureka validates and formats; MindrianOS reviews.

const { z } = require('zod');
const { project } = require('./eureka-graph-projection.cjs');
const { callEurekaWorkflow, textResponse, projectionDisclosure } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.package_relationship_proposals';

function isEvidenceNode(node) {
  return Array.isArray(node.labels) && node.labels.some((label) => String(label).toLowerCase() === 'evidence');
}

async function packageRelationships(args, ctx, extra, deps = {}) {
  const selected = new Set(args.node_ids);
  for (const [index, relationship] of args.relationships.entries()) {
    if (!selected.has(relationship.source_id) || !selected.has(relationship.target_id)) {
      return { ok: false, reason: 'relationship_endpoint_outside_projection', message: `Relationship ${index + 1} endpoints must be in the explicit MindrianOS node_ids projection.` };
    }
    if (relationship.evidence_ids.some((id) => !selected.has(id))) {
      return { ok: false, reason: 'evidence_outside_projection', message: `Relationship ${index + 1} evidence IDs must be in the explicit MindrianOS node_ids projection.` };
    }
  }
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const nodes = new Map(hostProjection.snapshot.nodes.map((node) => [node.id, node]));
  if (Array.from(selected).some((id) => !nodes.has(id))) {
    return { ok: false, reason: 'projection_incomplete', ...projectionDisclosure(hostProjection.snapshot.meta),
      message: 'A required node is missing or excluded from the MindrianOS graph projection.' };
  }
  const evidenceIds = new Set(args.relationships.flatMap((relationship) => relationship.evidence_ids));
  const evidence = [];
  for (const id of evidenceIds) {
    const node = nodes.get(id);
    if (!isEvidenceNode(node)) {
      return { ok: false, reason: 'evidence_node_type_invalid', message: `Evidence reference ${id} must resolve to a MindrianOS Evidence node.` };
    }
    if (!node.text || node.text_truncated) {
      return { ok: false, reason: 'evidence_text_unavailable', ...projectionDisclosure(hostProjection.snapshot.meta),
        message: `Evidence node ${id} needs non-empty, untruncated text in the MindrianOS projection.` };
    }
    evidence.push({ id, source_ref: node.source_ref, sha256: node.text_sha256 });
  }
  const request = {
    nodes: Array.from(selected, (id) => {
      const node = nodes.get(id);
      return { id, title: node.name, source_ref: node.source_ref, sha256: node.text_sha256 };
    }),
    evidence,
    relationships: args.relationships,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
  };
  const engine = await (deps.callEurekaWorkflow || callEurekaWorkflow)(CAPABILITY_ID, request, process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== CAPABILITY_ID || result.scope_id !== hostProjection.scope_id ||
      result.snapshot_id !== hostProjection.snapshot_id || !Array.isArray(result.proposals) ||
      result.proposals.some((proposal) => proposal.status !== 'proposed_for_human_review')) {
    return { ok: false, reason: 'engine_lineage_or_state_mismatch', message: 'Eureka returned proposals with mismatched scope/snapshot or unexpected review state.' };
  }
  return {
    ok: true,
    capability_id: CAPABILITY_ID,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
    projection: hostProjection.snapshot.meta,
    ...projectionDisclosure(hostProjection.snapshot.meta),
    room_binding: hostProjection.room_binding,
    proposals: result,
    persistence: 'none',
    review_required: true,
    acceptance_requires_review: true,
  };
}

function register(server, ctx) {
  registerEurekaTool(server, 'eureka_graph_package_relationships', {
    title: 'Package MindrianOS Graph Relationship Proposals',
    description: 'Validate caller-proposed links against selected MindrianOS node IDs and selected Evidence nodes, then ask Eureka to package them with stable graph refs and snapshot lineage. This does not discover, rank, approve, or write relationships; all proposals require MindrianOS review.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      relationships: z.array(z.object({
        source_id: z.string().min(1).max(200),
        target_id: z.string().min(1).max(200),
        relation: z.string().min(1).max(100),
        rationale: z.string().min(1).max(5000),
        evidence_ids: z.array(z.string().min(1).max(200)).min(1),
      }).strict()).min(1).max(1000),
    }).strict(),
  }, async (args, extra) => {
    const result = await packageRelationships(args, ctx, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_graph_package_relationships',
  surface: 'eureka_graph_package_relationships',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Packages already-proposed links for human review; no acceptance, discovery, or graph mutation occurs.',
  layer: 'harness',
  layer_why: 'Binds caller-proposed relations and evidence references to the authorized MindrianOS graph projection before packaging.',
}];

module.exports = { CAPABILITY_ID, packageRelationships, register, connectors };
