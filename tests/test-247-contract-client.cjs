#!/usr/bin/env node
'use strict';

/**
 * Phase 247-02 (CONTRACT-01) -- conformance leg 2: the client fixture test.
 * ==========================================================================
 * Loads data/brain-surface-contract.json and DERIVES every per-tool
 * expectation from it -- no hardcoded tool list. For every entry in
 * loop_tools this suite:
 *   - asserts a brain-client wrapper function exists (via a small tool-name
 *     -> wrapper-name map, the one hardcode this file is allowed per the
 *     plan: JS wrapper names are camelCase, contract tool names are
 *     snake_case, and the map itself is the thing a future contract edit
 *     would need to extend -- if it doesn't, the checker below reports it
 *     as a mismatch, which IS the drift-detection red proof).
 *   - calls that wrapper through a real loopback capture server (the
 *     brain-capture-server.cjs helper, reused per Canon Part 7) and asserts
 *     the captured tools/call request carries EXACTLY the contracted tool
 *     name and EXACTLY the contracted arg keys -- no more, no fewer.
 *
 * Also asserts contract_version === 1 and retired_remote contains both
 * server-side-LLM tools (CONTRACT-02), and runs the SAME checker against an
 * in-memory MUTATED copy of the contract (one tool renamed) to prove the
 * checker itself can fail -- eval-honesty per the plan's must_haves.
 *
 * node --test, CJS. No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { test, before, after } = require('node:test');
const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
} = require('./helpers/brain-capture-server.cjs');

const CONTRACT_PATH = path.resolve(__dirname, '..', 'data', 'brain-surface-contract.json');
const BRAIN_CLIENT_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'brain-client.cjs');

// The one sanctioned hardcode (see file header): contract tool name (snake_case)
// -> brain-client export name (camelCase). If the vendored contract ever grows
// a 7th loop tool without a matching entry here, checkContractConformance()
// below reports it as a mismatch instead of silently skipping it.
const WRAPPER_MAP = {
  normalize_framework_name: 'normalizeFrameworkName',
  search: 'loopSearch',
  discover_structure: 'discoverStructure',
  orchestration_readiness: 'orchestrationReadiness',
  feeds_into_chains: 'feedsIntoChains',
  brain_stats: 'stats',
};

// Call adapters: how to invoke each wrapper with representative, valid
// arguments (positional -- the wrapper signatures are positional functions,
// not keyed objects, so SOME adapter is unavoidable). The arg KEYS asserted
// below come from the contract JSON, not from this table.
const CALL_ADAPTERS = {
  normalize_framework_name: (brain) => brain.normalizeFrameworkName('SWOT Analysis'),
  search: (brain) => brain.loopSearch('jobs to be done', 5),
  discover_structure: (brain) => brain.discoverStructure('SWOT Analysis'),
  orchestration_readiness: (brain) => brain.orchestrationReadiness('SWOT Analysis'),
  feeds_into_chains: (brain) => brain.feedsIntoChains(['SWOT Analysis'], 2),
  brain_stats: (brain) => brain.stats(),
};

function freshBrainClient(url) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
  delete require.cache[BRAIN_CLIENT_PATH];
  return require(BRAIN_CLIENT_PATH);
}

/**
 * Runs the full conformance check against a (possibly mutated) contract
 * object and a live brain-client instance. Returns an array of issue
 * strings -- empty means fully conformant. Never throws; every failure
 * mode is collected so a mutation test can inspect what broke.
 *
 * @param {object} contract - a contract object shaped like the vendored JSON
 * @param {object} brain - a fresh require()'d brain-client instance
 * @returns {Promise<string[]>}
 */
async function checkContractConformance(contract, brain) {
  const issues = [];

  if (contract.contract_version !== 1) {
    issues.push('contract_version is not 1 (got ' + JSON.stringify(contract.contract_version) + ')');
  }

  const toolNames = Object.keys(contract.loop_tools || {});
  if (toolNames.length === 0) {
    issues.push('loop_tools is empty or missing');
    return issues;
  }

  for (const toolName of toolNames) {
    const wrapperName = WRAPPER_MAP[toolName];
    if (!wrapperName) {
      issues.push('no wrapper-map entry known for contract tool "' + toolName + '"');
      continue;
    }
    if (typeof brain[wrapperName] !== 'function') {
      issues.push('brain-client does not export a function "' + wrapperName + '" for tool "' + toolName + '"');
      continue;
    }
    const adapter = CALL_ADAPTERS[toolName];
    if (!adapter) {
      issues.push('no call adapter known for contract tool "' + toolName + '"');
      continue;
    }

    resetCaptured();
    await adapter(brain);
    const call = captured[captured.length - 1];
    if (!call) {
      issues.push('wrapper "' + wrapperName + '" for tool "' + toolName + '" made no transport call');
      continue;
    }
    if (call.name !== toolName) {
      issues.push(
        'wrapper "' + wrapperName + '" emitted tool name "' + call.name + '", contract requires "' + toolName + '"'
      );
    }
    const expectedKeys = Object.keys((contract.loop_tools[toolName] || {}).args || {}).sort();
    const actualKeys = Object.keys(call.arguments || {}).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      issues.push(
        'tool "' +
          toolName +
          '" arg keys mismatch: contract requires ' +
          JSON.stringify(expectedKeys) +
          ', wrapper emitted ' +
          JSON.stringify(actualKeys)
      );
    }
  }

  return issues;
}

let server;
let url;

before(async () => {
  const started = await startCaptureServer();
  server = started.server;
  url = started.url;
});

after(async () => {
  await stopCaptureServer(server);
});

test('the real vendored contract is fully conformant (zero issues)', async () => {
  delete require.cache[CONTRACT_PATH];
  const contract = require(CONTRACT_PATH);
  const brain = freshBrainClient(url);

  const issues = await checkContractConformance(contract, brain);
  assert.deepStrictEqual(issues, [], 'the vendored contract must be fully conformant: ' + JSON.stringify(issues));
});

test('contract_version is 1 and loop_tools has exactly the 6 loop tools', () => {
  delete require.cache[CONTRACT_PATH];
  const contract = require(CONTRACT_PATH);
  assert.strictEqual(contract.contract_version, 1);
  assert.strictEqual(Object.keys(contract.loop_tools).length, 6);
});

test('retired_remote contains both server-side-LLM tools (CONTRACT-02)', () => {
  delete require.cache[CONTRACT_PATH];
  const contract = require(CONTRACT_PATH);
  assert.deepStrictEqual(
    contract.retired_remote.slice().sort(),
    ['brain_ask_anything', 'text2cypher'].sort(),
    'retired_remote must list exactly the two server-side-LLM tools'
  );
});

test('drift-detection red proof: a mutated contract (one tool renamed) is reported non-conformant', async () => {
  delete require.cache[CONTRACT_PATH];
  const realContract = require(CONTRACT_PATH);
  const brain = freshBrainClient(url);

  // In-memory mutation only -- never written to disk. Rename `search` to a
  // tool name with no wrapper-map entry and no call adapter, simulating a
  // contract edit that outran the client.
  const mutated = JSON.parse(JSON.stringify(realContract));
  mutated.loop_tools.search_v2_renamed = mutated.loop_tools.search;
  delete mutated.loop_tools.search;

  const issues = await checkContractConformance(mutated, brain);
  assert.ok(issues.length > 0, 'the checker must report at least one issue against a mutated contract');
  assert.ok(
    issues.some((i) => i.includes('search_v2_renamed')),
    'the reported issue must name the renamed tool: ' + JSON.stringify(issues)
  );
});
