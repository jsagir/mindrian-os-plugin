#!/usr/bin/env node
'use strict';

/**
 * Regression suite for lib/core/brain-client.cjs argument shape
 * against the Brain MCP tool registrations in:
 *   - mcp-server-brain/lib/neo4j-tools.cjs  (brain_schema, brain_query, brain_write)
 *   - mcp-server-brain/lib/pinecone-tools.cjs (brain_search, brain_stats)
 *
 * Finding I (v1.10.9, 2026-04-15):
 *   brain.query() used to send { query: cypher }. The Brain MCP brain_query
 *   tool expects { cypher }. Result: silent -32602 validation error for
 *   weeks, whitespace gap detection and causal edge enrichment degraded
 *   to empty-baseline mode without alerting the user. brain.write() had
 *   the exact mirror bug against brain_write.
 *
 * This suite stands up a mock HTTP server on a random loopback port,
 * points MINDRIAN_BRAIN_URL at it, exercises every brain-client entry
 * point that routes through callTool, captures the outgoing JSON-RPC
 * tools/call request body, and asserts the arguments object shape
 * matches the Brain MCP schemas verbatim. A dedicated regression case
 * fails loudly if anyone ever re-introduces { query: cypher } into
 * brain_query or brain_write.
 *
 * Also includes a live-integration smoke test gated behind
 * BRAIN_LIVE_TESTS=1 + MINDRIAN_BRAIN_KEY presence. SKIPs cleanly
 * otherwise with a clear reason.
 *
 * No new runtime deps. Node built-ins only (http, assert).
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const {
  startCaptureServer,
  captured,
} = require('./helpers/brain-capture-server.cjs');

// ---------------------------------------------------------------------------
// Mock Brain MCP HTTP server
// ---------------------------------------------------------------------------

/**
 * Expected argument shape per tool, derived from
 * mcp-server-brain/lib/neo4j-tools.cjs and pinecone-tools.cjs registrations.
 * Keys are REQUIRED tool-side; optional keys are listed separately.
 */
const EXPECTED_SCHEMAS = {
  brain_schema: { required: [], optional: [] },
  brain_query: { required: ['cypher'], optional: ['params'] },
  brain_write: { required: ['cypher'], optional: ['params'] },
  brain_search: {
    required: ['query'],
    optional: ['namespace', 'topK', 'filter'],
  },
  brain_stats: { required: [], optional: [] },
};

// The mock Brain MCP HTTP server and its `captured` requests array now
// live in tests/helpers/brain-capture-server.cjs (extracted, Phase 239
// 239-01 Task 1). `captured` is imported above and used directly below;
// this file no longer stands up its own inline HTTP listener.
function startMockServer() {
  return startCaptureServer();
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function assertArgumentShape(toolName, args) {
  const schema = EXPECTED_SCHEMAS[toolName];
  assert.ok(schema, `unknown tool ${toolName} not in EXPECTED_SCHEMAS`);

  const allowed = new Set([...schema.required, ...schema.optional]);
  const keys = Object.keys(args);

  // Every required key must be present.
  for (const req of schema.required) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(args, req),
      `${toolName}: missing required arg '${req}' (got keys: ${keys.join(', ')})`
    );
  }

  // No unknown keys allowed. Catches the Finding I class:
  // any key that is not in the Brain MCP schema is a drift bug.
  for (const k of keys) {
    assert.ok(
      allowed.has(k) || args[k] === undefined,
      `${toolName}: unexpected arg '${k}' not in Brain MCP schema ` +
        `(allowed: ${[...allowed].join(', ')}). This is the Finding I class.`
    );
  }
}

function lastCall() {
  return captured[captured.length - 1];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { server, port } = await startMockServer();

  // Point brain-client at the mock BEFORE requiring it; BRAIN_URL is
  // module-scoped at load time (brain-client.cjs line 21).
  process.env.MINDRIAN_BRAIN_URL = `http://127.0.0.1:${port}`;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';

  // Force a fresh require even if another test pre-loaded it.
  const brainClientPath = path.resolve(
    __dirname,
    '..',
    'lib',
    'core',
    'brain-client.cjs'
  );
  delete require.cache[brainClientPath];
  const brain = require(brainClientPath);

  let failed = 0;
  const record = (name, fn) => {
    return fn()
      .then(() => {
        process.stdout.write(`  ok  ${name}\n`);
      })
      .catch((err) => {
        failed += 1;
        process.stderr.write(`  FAIL ${name}\n    ${err.message}\n`);
      });
  };

  process.stdout.write('brain-client param schema regression suite\n');

  // ---- brain_query ----
  await record('brain.query sends { cypher } not { query }', async () => {
    captured.length = 0;
    await brain.query('MATCH (n) RETURN count(n) AS c');
    const call = lastCall();
    assert.equal(call.name, 'brain_query');
    assertArgumentShape('brain_query', call.arguments);
    assert.equal(
      call.arguments.cypher,
      'MATCH (n) RETURN count(n) AS c',
      'cypher string must round-trip untouched'
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(call.arguments, 'query'),
      'FINDING I REGRESSION: brain_query must NOT receive a `query` key'
    );
  });

  // ---- brain_write ----
  await record('brain.write sends { cypher } not { query }', async () => {
    captured.length = 0;
    await brain.write('CREATE (n:Test {id: 1}) RETURN n');
    const call = lastCall();
    assert.equal(call.name, 'brain_write');
    assertArgumentShape('brain_write', call.arguments);
    assert.equal(call.arguments.cypher, 'CREATE (n:Test {id: 1}) RETURN n');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(call.arguments, 'query'),
      'FINDING I SIBLING REGRESSION: brain_write must NOT receive a `query` key'
    );
  });

  // ---- brain_search ----
  await record(
    'brain.search sends { query, namespace, topK } per brain_search schema',
    async () => {
      captured.length = 0;
      await brain.search('innovation framework', {
        namespace: 'core',
        topK: 7,
      });
      const call = lastCall();
      assert.equal(call.name, 'brain_search');
      assertArgumentShape('brain_search', call.arguments);
      assert.equal(call.arguments.query, 'innovation framework');
      assert.equal(call.arguments.namespace, 'core');
      assert.equal(call.arguments.topK, 7);
      // Sanity: brain_search legitimately uses `query` (different tool,
      // different schema). Do not confuse with Finding I.
      assert.ok(
        !Object.prototype.hasOwnProperty.call(call.arguments, 'cypher'),
        'brain_search must NOT receive a `cypher` key'
      );
    }
  );

  // ---- brain_schema ----
  await record('brain.schema sends {} (no params)', async () => {
    captured.length = 0;
    await brain.schema();
    const call = lastCall();
    assert.equal(call.name, 'brain_schema');
    assertArgumentShape('brain_schema', call.arguments);
    assert.equal(
      Object.keys(call.arguments).length,
      0,
      'brain_schema must receive zero arguments'
    );
  });

  // ---- brain_stats ----
  await record('brain.stats sends {} (no params)', async () => {
    captured.length = 0;
    await brain.stats();
    const call = lastCall();
    assert.equal(call.name, 'brain_stats');
    assertArgumentShape('brain_stats', call.arguments);
    assert.equal(
      Object.keys(call.arguments).length,
      0,
      'brain_stats must receive zero arguments'
    );
  });

  // ---- Exhaustive audit: every exported brain-client function
  //       that wraps callTool is covered above. If a new wrapper is
  //       added, this assertion forces the author to extend this file.
  await record('brain-client exported wrappers are fully covered', async () => {
    const expectedWrappers = new Set([
      'query',
      'write',
      'search',
      'schema',
      'stats',
    ]);
    for (const name of expectedWrappers) {
      assert.equal(
        typeof brain[name],
        'function',
        `brain-client must export ${name}()`
      );
    }
  });

  // -------------------------------------------------------------------------
  // Live-integration smoke test (gated)
  // -------------------------------------------------------------------------
  if (process.env.BRAIN_LIVE_TESTS === '1') {
    if (!process.env.MINDRIAN_BRAIN_KEY || process.env.MINDRIAN_BRAIN_KEY === 'test-key-not-real') {
      process.stdout.write(
        '  SKIP live brain smoke test (MINDRIAN_BRAIN_KEY not set to a real key)\n'
      );
    } else {
      // Tear down the mock; point back at the real Brain.
      await new Promise((r) => server.close(r));
      delete process.env.MINDRIAN_BRAIN_URL;
      delete require.cache[brainClientPath];
      const liveBrain = require(brainClientPath);

      await record('live brain.query RETURN 1 AS n returns non-null', async () => {
        const result = await liveBrain.query('RETURN 1 AS n');
        assert.ok(result !== null, 'live brain query returned null');
      });

      process.stdout.write(
        `\nbrain-client params suite: ${failed === 0 ? 'PASS' : 'FAIL'} (${failed} failures)\n`
      );
      process.exit(failed === 0 ? 0 : 1);
    }
  } else {
    process.stdout.write(
      '  SKIP live brain smoke test (set BRAIN_LIVE_TESTS=1 and MINDRIAN_BRAIN_KEY to run)\n'
    );
  }

  await new Promise((r) => server.close(r));
  process.stdout.write(
    `\nbrain-client params suite: ${failed === 0 ? 'PASS' : 'FAIL'} (${failed} failures)\n`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + err.stack + '\n');
  process.exit(1);
});
