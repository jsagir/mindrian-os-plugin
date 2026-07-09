#!/usr/bin/env node
// Phase 198 SPEC-2 (contract half) -- mindrian-core versioned tool contract.
// Real behavior: the contract-version tool returns a semver string, and every
// tool THIS PLAN (198-04) ships -- contract_version, room_list,
// room_state_bound, room_search, graph_query (always) plus graph_write /
// memory_event (flag-gated) -- registers with a per-tool zod schema that
// genuinely validates (not just "is an object").
//
// The full 198-SPEC.md tool list (chain_resolve/chain_run/framework_run,
// gate_render/gate_answer, suggest_next/reach_candidates/contradiction_check/
// whitespace_scan, artifact_file/view_compile, status_read) is a PHASE-level
// target shipped across later plans, not this plan's obligation -- this test
// covers the tools 198-04 actually registers.
//
// SKIP-safe until lib/mcp/contract-version.cjs exists. Node built-in assert
// only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

let registerCoreTools;
try {
  ({ registerCoreTools } = require('../lib/mcp/register-core-tools.cjs'));
} catch (e) {
  console.log('SKIP: test-198-contract-schema -- lib/mcp/register-core-tools.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const { z } = require('zod');

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
  console.log('  ok - ' + label);
}

// --- (1) semver ---
assert.ok(/^[0-9]+\.[0-9]+\.[0-9]+/.test(contractVersion.CONTRACT_VERSION), 'CONTRACT_VERSION is semver-shaped');
assert.strictEqual(contractVersion.getContractVersion(), contractVersion.CONTRACT_VERSION, 'getContractVersion() matches CONTRACT_VERSION');
passed += 2;
console.log('  ok - CONTRACT_VERSION is semver-shaped (' + contractVersion.CONTRACT_VERSION + ')');
console.log('  ok - getContractVersion() matches CONTRACT_VERSION');

// --- (2) a minimal fake MCP server that captures every server.tool() call,
// mirroring the real McpServer.tool(name, description, schemaShape, handler)
// 4-arg shape used throughout this codebase (tool-router.cjs, room.cjs,
// graph.cjs, contract-version.cjs). Also accepts the 3-arg
// (name, description, handler) form contract_version uses with an empty {}
// schema shape. ---
function makeFakeServer() {
  const registered = [];
  return {
    tool(name, description, schemaOrHandler, maybeHandler) {
      let schema = {};
      let handler = schemaOrHandler;
      if (typeof maybeHandler === 'function') {
        schema = schemaOrHandler || {};
        handler = maybeHandler;
      }
      if (registered.some((r) => r.name === name)) {
        throw new Error('DUPLICATE_TOOL_NAME: ' + name);
      }
      registered.push({ name, description, schema, handler });
    },
    _registered: registered,
  };
}

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'psb198-contract-'));
const fallbackRoom = path.join(tmpHome, 'fallback-room');
fs.mkdirSync(fallbackRoom, { recursive: true });

// --- (3) flag-OFF: read-only tools register; write tools do not. No
// duplicate-name crash (the fake server throws on a repeat name, exactly like
// the real MCP SDK's McpServer.tool()). ---
const previousFlag = process.env.MINDRIAN_MCP_FIRST;
delete process.env.MINDRIAN_MCP_FIRST;

const serverOff = makeFakeServer();
registerCoreTools(serverOff, { fallbackRoomDir: fallbackRoom, pluginRoot: path.resolve(__dirname, '..'), surface: 'cli' });
const namesOff = serverOff._registered.map((r) => r.name);

check('contract_version registers (flag off)', namesOff.includes('contract_version'));
check('room_list registers (flag off, read-only)', namesOff.includes('room_list'));
check('room_state_bound registers (flag off, read-only)', namesOff.includes('room_state_bound'));
check('room_search registers (flag off, read-only)', namesOff.includes('room_search'));
check('graph_query registers (flag off, read-only)', namesOff.includes('graph_query'));
check('graph_write does NOT register (flag off -- D-07 registration gate)', !namesOff.includes('graph_write'));
check('memory_event does NOT register (flag off -- D-07 registration gate)', !namesOff.includes('memory_event'));
check('no duplicate tool names (flag off)', new Set(namesOff).size === namesOff.length);

// --- (4) flag-ON (this surface): graph_write / memory_event ALSO register,
// with zero name collisions. ---
process.env.MINDRIAN_MCP_FIRST = 'all';
const serverOn = makeFakeServer();
registerCoreTools(serverOn, { fallbackRoomDir: fallbackRoom, pluginRoot: path.resolve(__dirname, '..'), surface: 'cli' });
const namesOn = serverOn._registered.map((r) => r.name);

check('graph_write registers (flag on)', namesOn.includes('graph_write'));
check('memory_event registers (flag on)', namesOn.includes('memory_event'));
check('no duplicate tool names (flag on)', new Set(namesOn).size === namesOn.length);

if (typeof previousFlag === 'string') process.env.MINDRIAN_MCP_FIRST = previousFlag;
else delete process.env.MINDRIAN_MCP_FIRST;

// --- (5) every registered tool's schema shape is genuinely zod: each field
// value exposes .safeParse (a duck-typed zod schema check, since z.ZodType
// instances all expose it). ---
for (const r of serverOn._registered) {
  for (const [key, val] of Object.entries(r.schema)) {
    check(`${r.name}.${key} is a zod schema`, val && typeof val.safeParse === 'function');
  }
}

// --- (6) real validation round-trip on two representative schemas: a required
// field REJECTS an empty/missing value; a valid payload PARSES. ---
const roomSearchTool = serverOn._registered.find((r) => r.name === 'room_search');
assert.ok(roomSearchTool, 'room_search tool found for schema round-trip');
const roomSearchShape = z.object(roomSearchTool.schema);
check('room_search schema REJECTS a missing query', roomSearchShape.safeParse({}).success === false);
check('room_search schema PARSES a valid query', roomSearchShape.safeParse({ query: 'hello' }).success === true);

const graphWriteTool = serverOn._registered.find((r) => r.name === 'graph_write');
assert.ok(graphWriteTool, 'graph_write tool found for schema round-trip');
const graphWriteShape = z.object(graphWriteTool.schema);
check('graph_write schema REJECTS a missing target_id', graphWriteShape.safeParse({ source_id: 'a', edge_type: 'INFORMS' }).success === false);
check('graph_write schema PARSES a valid edge write payload', graphWriteShape.safeParse({ source_id: 'a', target_id: 'b', edge_type: 'INFORMS' }).success === true);

console.log(`PASS: test-198-contract-schema (${passed} assertions -- contract_version semver + register-core-tools seam + per-tool zod schema validity, flag-gated write registration)`);
process.exit(0);
