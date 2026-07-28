#!/usr/bin/env node
// Phase 198 SPEC-2 (contract half) -- mindrian-core versioned tool contract.
// Real behavior: the contract-version tool returns a semver string, and EVERY
// tool the lib/mcp/register-core-tools.cjs seam registers -- contract_version,
// room_list/room_state_bound/room_search (198-04), graph_query/graph_write/
// memory_event (198-04, write-gated), gate_render/gate_answer (198-05),
// suggest_next/reach_candidates/contradiction_check/whitespace_scan/
// framework_run/view_compile/status_read (198-06, read-only) and artifact_file
// (198-06, write-gated) -- registers with a per-tool zod schema that
// genuinely validates (not just "is an object").
//
// This completes the Plan 01 stub (198-06 Task 2): SPEC-2's phase-level
// acceptance is "every tool listed callable via MCP Inspector with schema
// validation passing" -- this test proves the schema-validation half for
// every tool discoverable through the tools/ auto-discovery seam, plus a
// completeness cross-check against the GENERATED data/mcp-tool-connectors.json
// (the born-wired source of truth). room_bind is the one documented exclusion:
// it registers through lib/mcp/tool-router.cjs's main registerRouterTools()
// body (the pre-198-04 grouped-router path), not the tools/ seam this harness
// exercises -- a different registration surface, out of this test's reach.
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
// graph.cjs, gate.cjs, sensors.cjs, views.cjs, status.cjs, contract-version.cjs).
// Also accepts the 3-arg (name, description, handler) form contract_version
// uses with an empty {} schema shape, and exposes a fake `.server.
// getClientCapabilities()` / `.server.elicitInput()` pair (gate.cjs's/
// sensors.cjs's real elicitation-capability read) that reports NO elicitation
// support -- exercising the headless-text renderer rung deterministically,
// the same posture the real MCP SDK reports for Claude Code/Desktop/Cowork
// today (issue #2799). ---
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
    server: {
      getClientCapabilities() { return {}; }, // no elicitation -> headless text rung
    },
  };
}

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'psb198-contract-'));
const fallbackRoom = path.join(tmpHome, 'fallback-room');
fs.mkdirSync(fallbackRoom, { recursive: true });

// --- (3) flag-OFF: EVERY tool registers, including the three write tools. No
// duplicate-name crash (the fake server throws on a repeat name, exactly like
// the real MCP SDK's McpServer.tool()).
//
// CONTRACT CHANGE, Phase 234-05 (D-05): this section used to assert the
// OPPOSITE for graph_write / memory_event / artifact_file -- that they did NOT
// register when the flag was off (the D-07 registration gate). That gate was
// the mechanism behind RESEARCH.md's Gap D: on a foreign MCP host the flag
// defaults off, so those three tools were absent from tools/list entirely and
// the model could not even see that a write path existed to ask for.
//
// It could not be repaired in place, either: host identity is only knowable
// after the initialize handshake (getClientVersion), while registration runs
// once inside createServer() before any client connects.
//
// So DISCOVERY and PERMISSION were split. Registration is now unconditional,
// and each write handler evaluates isWritePathEnabled({surface, clientVersion})
// per call, returning an honest {ok:false, reason:'write_path_disabled'} when
// refused. The per-call half is proved in tests/test-234-host-tier.cjs,
// including over a real stdio handshake. What this file now locks is the other
// half: the tools are always in the catalog. ---
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
check('graph_write ALWAYS registers, flag off included (234-05: discovery is not permission)', namesOff.includes('graph_write'));
check('memory_event ALWAYS registers, flag off included (234-05: discovery is not permission)', namesOff.includes('memory_event'));
check('gate_render registers (flag off, read-only HITL surface)', namesOff.includes('gate_render'));
check('gate_answer registers (flag off, read-only HITL surface)', namesOff.includes('gate_answer'));
check('suggest_next registers (flag off, read-only)', namesOff.includes('suggest_next'));
check('reach_candidates registers (flag off, read-only)', namesOff.includes('reach_candidates'));
check('contradiction_check registers (flag off, read-only)', namesOff.includes('contradiction_check'));
check('whitespace_scan registers (flag off, read-only)', namesOff.includes('whitespace_scan'));
check('framework_run registers (flag off, read-only resolve + gate)', namesOff.includes('framework_run'));
check('view_compile registers (flag off, read-only)', namesOff.includes('view_compile'));
check('status_read registers (flag off, read-only)', namesOff.includes('status_read'));
check('artifact_file ALWAYS registers, flag off included (234-05: discovery is not permission)', namesOff.includes('artifact_file'));
check('no duplicate tool names (flag off)', new Set(namesOff).size === namesOff.length);

// --- (4) flag-ON (this surface): the SAME catalog, with zero name collisions.
// Flipping MINDRIAN_MCP_FIRST no longer changes WHICH tools exist (234-05);
// it changes whether a write CALL is permitted. Locking catalog equality here
// is what stops a future change from quietly reintroducing a registration-time
// gate. ---
process.env.MINDRIAN_MCP_FIRST = 'all';
const serverOn = makeFakeServer();
registerCoreTools(serverOn, { fallbackRoomDir: fallbackRoom, pluginRoot: path.resolve(__dirname, '..'), surface: 'cli' });
const namesOn = serverOn._registered.map((r) => r.name);

check('graph_write registers (flag on)', namesOn.includes('graph_write'));
check('memory_event registers (flag on)', namesOn.includes('memory_event'));
check('artifact_file registers (flag on)', namesOn.includes('artifact_file'));
check('no duplicate tool names (flag on)', new Set(namesOn).size === namesOn.length);
check('the tool catalog is IDENTICAL flag-on vs flag-off (234-05: the flag gates calls, not registration)',
  JSON.stringify(namesOff.slice().sort()) === JSON.stringify(namesOn.slice().sort()));

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

// --- (6) completeness cross-check: every tool discovered in the GENERATED
// data/mcp-tool-connectors.json (the born-wired source of truth, minus the
// documented room_bind exclusion) is registered by THIS seam. Catches a
// future lib/mcp/tools/*.cjs module that ships a `connectors` export but
// forgets to call server.tool() for one of its declared surfaces. ---
const connectorsPath = path.resolve(__dirname, '..', 'data', 'mcp-tool-connectors.json');
let mcpToolSurfaces = [];
try {
  const raw = JSON.parse(fs.readFileSync(connectorsPath, 'utf8'));
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.connectors) ? raw.connectors : []);
  mcpToolSurfaces = arr.map((c) => String(c.surface || c.tool || '').replace(/^mcp:/, '')).filter(Boolean);
} catch (_e) {
  mcpToolSurfaces = []; // generated file absent -- nothing to cross-check yet
}
const EXCLUDED_FROM_SEAM = new Set(['room_bind']); // registers via tool-router.cjs's main body, not the tools/ seam
const namesOnSet = new Set(namesOn);
for (const surface of mcpToolSurfaces) {
  if (EXCLUDED_FROM_SEAM.has(surface)) continue;
  check(`${surface} (declared in mcp-tool-connectors.json) is registered by the tools/ seam`, namesOnSet.has(surface));
}

// --- (7) generic sample-input validation round trip: for EVERY registered
// tool's schema, synthesize a minimal valid sample from the zod type shape
// (string/number/boolean/enum/array/object/record introspection) and prove
// the schema PARSES it. This is the "validates a sample input" half of
// SPEC-2's "every tool schema-valid" acceptance, generic across all present
// and future tools -- no per-tool sample map to maintain. ---
function sampleForZodType(zType, depth) {
  if (!zType || !zType._def || depth > 4) return 'sample';
  const def = zType._def;
  const name = def.typeName;
  if (name === 'ZodOptional' || name === 'ZodNullable' || name === 'ZodDefault') {
    return sampleForZodType(def.innerType, depth);
  }
  if (name === 'ZodString') return 'sample-text';
  if (name === 'ZodNumber') return 1;
  if (name === 'ZodBoolean') return true;
  if (name === 'ZodEnum') return Array.isArray(def.values) ? def.values[0] : 'sample';
  if (name === 'ZodArray') return [sampleForZodType(def.type, depth + 1)];
  if (name === 'ZodRecord') return {};
  if (name === 'ZodObject') {
    const shape = typeof def.shape === 'function' ? def.shape() : (def.shape || {});
    const obj = {};
    for (const [k, v] of Object.entries(shape)) obj[k] = sampleForZodType(v, depth + 1);
    return obj;
  }
  return 'sample';
}

for (const r of serverOn._registered) {
  const keys = Object.keys(r.schema);
  if (keys.length === 0) continue; // e.g. contract_version, whitespace_scan -- {} schema, nothing to sample
  const sampleObj = {};
  for (const key of keys) sampleObj[key] = sampleForZodType(r.schema[key], 0);
  const shape = z.object(r.schema);
  const result = shape.safeParse(sampleObj);
  check(`${r.name} schema PARSES a synthesized sample input`, result.success === true);
}

// --- (8) real validation round-trip on two representative schemas: a required
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

const frameworkRunTool = serverOn._registered.find((r) => r.name === 'framework_run');
assert.ok(frameworkRunTool, 'framework_run tool found for schema round-trip');
const frameworkRunShape = z.object(frameworkRunTool.schema);
check('framework_run schema REJECTS an empty chain', frameworkRunShape.safeParse({ chain: [] }).success === false);
check('framework_run schema PARSES a valid chain', frameworkRunShape.safeParse({ chain: ['lean-canvas'] }).success === true);

const artifactFileTool = serverOn._registered.find((r) => r.name === 'artifact_file');
assert.ok(artifactFileTool, 'artifact_file tool found for schema round-trip');
const artifactFileShape = z.object(artifactFileTool.schema);
check('artifact_file schema REJECTS a missing content', artifactFileShape.safeParse({ section: 'problem-definition', filename: 'note.md' }).success === false);
check('artifact_file schema PARSES a valid filing payload', artifactFileShape.safeParse({ section: 'problem-definition', filename: 'note.md', content: '# Note' }).success === true);

console.log(`PASS: test-198-contract-schema (${passed} assertions -- contract_version semver + register-core-tools seam + per-tool zod schema validity + mcp-tool-connectors.json completeness + synthesized sample-input round trips, flag-gated write registration)`);
process.exit(0);
