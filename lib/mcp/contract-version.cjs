'use strict';
// Phase 198-04 (SPEC-2) -- the mindrian-core contract_version tool.
//
// CONTRACT_VERSION is the semver of the TOOL CONTRACT SHAPE (the room/graph/
// chain/gate/... zod schemas this server exposes), pinned INDEPENDENTLY of the
// plugin release version in package.json. The plugin can ship many patch
// releases (1.15.3-beta.N...) while the contract itself stays 1.0.0, and the
// contract only bumps when a tool's schema shape actually changes -- the whole
// point of a versioned contract (198-SPEC.md requirement 2).
//
// Canon Part 8: trust_boundaries are GENERIC enum handles only, never room
// content. Canon Part 11: this tool is a pure read (hitl_shape 'none') --
// declared below in `connectors`, the born-wired SOURCE of truth
// scripts/build-connector-registry.cjs discovers.

// quick task 260903-h27: minor bump, 1.0.0 -> 1.1.0. Additive, backward-
// compatible optional zod params (subject_node_id / evidence_node_ids) added
// to three tool schemas: gate_render, chain_run, framework_run.
const CONTRACT_VERSION = '1.1.0';

// The trust boundaries this server's tool surface spans (198-SPEC.md
// Background: "two MCP servers ship today... split by trust boundary").
// Generic handles only -- never a room-specific string.
const TRUST_BOUNDARIES = Object.freeze(['local', 'brain-proxy']);

function getContractVersion() {
  return CONTRACT_VERSION;
}

function registerContractVersion(server) {
  server.tool(
    'contract_version',
    'Return the mindrian-core tool contract version (semver) and the trust boundaries its tool surface spans. Pure read, no side effects, no fork.',
    {},
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ version: CONTRACT_VERSION, trust_boundaries: TRUST_BOUNDARIES }, null, 2),
        }],
      };
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). scripts/build-connector-registry.cjs
// discovers this export and folds it into data/mcp-tool-connectors.json +
// data/connector-registry.json. Never hand-edit either generated file.
const connectors = [
  {
    tool: 'contract_version',
    surface: 'contract_version',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read of a pinned version constant and a static trust-boundary enum; no fork, no side effects.',
  },
];

module.exports = { CONTRACT_VERSION, getContractVersion, registerContractVersion, connectors };
