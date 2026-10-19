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

// Phase 267-06: registerTool's config object needs a zod object for
// inputSchema (z.object({}) here -- this tool takes no arguments). This is
// an MCP registrar, inside the CTX zod boundary (external-input surface).
const { z } = require('zod');

// quick task 260903-h27: minor bump, 1.0.0 -> 1.1.0. Additive, backward-
// compatible optional zod params (subject_node_id / evidence_node_ids) added
// to three tool schemas: gate_render, chain_run, framework_run.
// 1.2.0 added read-only graph projection; 1.3.0 composed graph analysis;
// 1.4.0 composed SME mapping; 1.5.0 added artifact preparation;
// 1.6.0 added graph-scoped RS+HSI opportunity scouting;
// 1.7.0 adds graph-derived HSI interpretation; 1.8.0 adds temporal backtest;
// 1.9.0 adds Bayesian surprise; 1.10.0 adds topic/verified-path adapters;
// 1.11.0 adds evidence-bound relationship packaging; 1.12.0 exposes the
// graph.propose_relationships capability alias over the authorized snapshot;
// 1.13.0 adds catalogued Eureka dispatch and specialized local graph bridges;
// 1.14.0 adds retained-process asynchronous Eureka job lifecycle tools;
// 1.15.0 types engine-side persistence separately from accepted-knowledge state.
const CONTRACT_VERSION = '1.15.0';

// The trust boundaries this server's tool surface spans (198-SPEC.md
// Background: "two MCP servers ship today... split by trust boundary").
// Generic handles only -- never a room-specific string.
const TRUST_BOUNDARIES = Object.freeze(['local', 'brain-proxy']);

function getContractVersion() {
  return CONTRACT_VERSION;
}

function registerContractVersion(server) {
  server.registerTool(
    'contract_version',
    {
      title: 'Contract Version',
      description: 'Return the mindrian-core tool contract version (semver) and the trust boundaries its tool surface spans. Pure read, no side effects, no fork.',
      inputSchema: z.object({}),
    },
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
    layer: 'none',
    layer_why: 'A pure read of a pinned version constant and a static trust-boundary enum; no rung engineered, the honest none.',
  },
];

module.exports = { CONTRACT_VERSION, getContractVersion, registerContractVersion, connectors };
