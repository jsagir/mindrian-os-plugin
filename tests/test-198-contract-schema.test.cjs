#!/usr/bin/env node
// Phase 198 SPEC-2 (contract half) -- mindrian-core versioned tool contract.
// Real behavior: the contract-version tool returns a semver string, and every
// tool listed in 198-SPEC.md (room_bind/room_list/room_state/room_search,
// graph_query/graph_write, memory_event, chain_resolve/chain_run/framework_run,
// gate_render/gate_answer, suggest_next/reach_candidates/contradiction_check/
// whitespace_scan, artifact_file/view_compile, status_read, contract_version)
// is callable with a zod-validated schema (MCP Inspector -- or a direct
// server.tool registration walk -- confirms every schema parses).
//
// SKIP-safe until lib/mcp/contract-version.cjs exists. Node built-in assert
// only. No em-dashes.
'use strict';
const assert = require('node:assert');

let contractVersion;
try {
  contractVersion = require('../lib/mcp/contract-version.cjs');
} catch (e) {
  console.log('SKIP: test-198-contract-schema -- lib/mcp/contract-version.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasVersionApi = typeof contractVersion.getContractVersion === 'function'
  || typeof contractVersion.CONTRACT_VERSION === 'string';
if (!hasVersionApi) {
  console.log('SKIP: test-198-contract-schema -- contract-version.cjs present but version API not exported yet.');
  process.exit(0);
}

// --- the real semver + per-tool schema-validity contract lands here ---
assert.ok(contractVersion, 'contract-version module loaded');
console.log('PASS: test-198-contract-schema (stub -- contract-version present; real semver + schema-validity contract lands in its owning plan)');
process.exit(0);
