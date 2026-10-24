'use strict';

// Stable capability alias for graph.propose_relationships. It shares the same
// read-only snapshot analysis implementation as graph exploration while
// preserving the catalogued capability identity in the request and result.

const { analyze, registerForCapability, textResponse } = require('./eureka-graph-analyze.cjs');

const CAPABILITY_ID = 'graph.propose_relationships';
const TOOL_NAME = 'eureka_graph_propose_relationships';

function propose(args, ctx, extra, deps = {}) {
  return analyze(args, ctx, extra, { ...deps, capabilityId: CAPABILITY_ID });
}

function register(server, ctx) {
  return registerForCapability(server, ctx, {
    toolName: TOOL_NAME,
    capabilityId: CAPABILITY_ID,
    title: 'Propose Relationship Leads from the MindrianOS Graph',
    description: 'Project explicit node IDs from the bound MindrianOS room and run Eureka graph.propose_relationships. Returns unevidenced candidate links bound to the room scope and graph snapshot for later evidence resolution and human review. Does not expand the graph, fetch sources, approve proposals, or write graph state.',
  });
}

const connectors = [{
  tool: TOOL_NAME,
  surface: TOOL_NAME,
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only proposal generation; candidates remain unevidenced and unfiled for MindrianOS review.',
  layer: 'harness',
  layer_why: 'Exposes the stable graph.propose_relationships alias over the authorized MindrianOS projection without creating another graph reader.',
}];

module.exports = { CAPABILITY_ID, TOOL_NAME, propose, register, connectors };
