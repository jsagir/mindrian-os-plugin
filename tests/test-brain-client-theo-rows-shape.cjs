#!/usr/bin/env node
'use strict';

/**
 * Regression suite pinning all six recognized/unrecognized brain_query
 * response shapes that lib/core/brain-client.cjs's query() must normalize.
 *
 * Root cause (2026-09-01): the Brain's `brain_query` tool is flipping to
 * Theo's contract, which serializes a successful answer as
 * `{ rows: [...], diagnostics: {...} }` instead of the incumbent bare
 * array. Before the Theo branch lands, that shape matches none of
 * query()'s recognized branches and silently falls through to the
 * unexpected-shape safety net (`{ records: [] }`), so every caller reads
 * "zero results" with no error and no crash. See
 * docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md
 * finding #1, and Theo's own
 * .planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md.
 *
 * Modeled structurally on tests/test-brain-client-params.cjs: same
 * record(name, fn) pass/fail reporter, same process.exit(failed === 0 ? 0
 * : 1) ending, node:assert/strict, Node built-ins only, no new deps.
 *
 * Reuses tests/helpers/brain-capture-server.cjs (Canon Part 7, reuse
 * before build) rather than standing up a second mock HTTP server.
 *
 * Six cases:
 *   1. Theo populated {rows, diagnostics} -> records populated (FAILS
 *      before the fix)
 *   2. Theo genuinely empty {rows: [], diagnostics} -> records empty AND
 *      diagnostics survives, the discriminator that separates "Theo
 *      answered, nothing matched" from "shape mismatch, blind fallback"
 *      (FAILS before the fix)
 *   3. Incumbent bare array -> records passthrough (must keep passing)
 *   4. Already-normalized {records} -> passthrough (must keep passing)
 *   5. Error passthrough {text: 'CODE: detail'} -> unchanged (must keep
 *      passing)
 *   6. Unexpected shapes ({foo: 'bar'} and {rows: 'not-an-array'}) ->
 *      collapse to {records: []}, never crash (must keep passing)
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const {
  startCaptureServer,
  stopCaptureServer,
  setToolScript,
  resetToolScript,
  resetCaptured,
} = require('./helpers/brain-capture-server.cjs');

// A benign methodology cypher, per Canon Part 8: generic framework handles
// only, never room content, user text, or personal identifiers. An
// 'ambiguous' egress verdict on this template is expected policy and is
// not blocked; a CONTENT-SET hit would return null and break the suite,
// which is the correct signal.
const CYPHER = 'MATCH (f:Framework) RETURN f.name AS name LIMIT 2';

/**
 * Build a scripted SSE body from a JS value, mirroring the capture
 * server's own default body shape. For object payloads the text is
 * JSON.stringify(payload); for the error case the caller passes the raw
 * non-JSON string directly as `text`.
 * @param {string} text
 * @returns {string}
 */
function sseBody(text) {
  return (
    'data: ' +
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text }] },
    }) +
    '\n'
  );
}

function sseBodyForObject(payload) {
  return sseBody(JSON.stringify(payload));
}

async function main() {
  const { server, port } = await startCaptureServer();

  // ORDERING CONTRACT (load-bearing, do not skip): set env BEFORE
  // requiring brain-client.cjs, because MINDRIAN_BRAIN_URL is captured at
  // module load time.
  process.env.MINDRIAN_BRAIN_URL = `http://127.0.0.1:${port}`;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';

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

  process.stdout.write('brain-client Theo {rows, diagnostics} shape regression suite\n');

  await record('Theo populated {rows, diagnostics} normalizes into records', async () => {
    resetCaptured();
    resetToolScript();
    setToolScript([
      {
        body: sseBodyForObject({
          rows: [{ name: 'Jobs to be Done' }, { name: 'Five Whys' }],
          diagnostics: { elapsed_ms: 12, row_cap: 200 },
        }),
      },
    ]);
    const result = await brain.query(CYPHER);
    assert.ok(result, 'expected a non-null result');
    assert.equal(result.records.length, 2, 'expected 2 normalized records');
    assert.equal(result.records[0].name, 'Jobs to be Done');
  });

  await record(
    'Theo genuinely empty {rows: [], diagnostics} is distinguishable from the blind fallback',
    async () => {
      resetCaptured();
      resetToolScript();
      setToolScript([
        {
          body: sseBodyForObject({
            rows: [],
            diagnostics: { elapsed_ms: 3, row_cap: 200 },
          }),
        },
      ]);
      const result = await brain.query(CYPHER);
      assert.ok(result, 'expected a non-null result');
      assert.equal(result.records.length, 0, 'expected zero records');
      assert.equal(
        result.diagnostics && result.diagnostics.elapsed_ms,
        3,
        'diagnostics must survive normalization -- this is the discriminator ' +
          'between a genuine empty answer and the shape-mismatch blind fallback'
      );
    }
  );

  await record('incumbent bare array keeps behaving exactly as today', async () => {
    resetCaptured();
    resetToolScript();
    setToolScript([{ body: sseBodyForObject([{ n: 1 }]) }]);
    const result = await brain.query(CYPHER);
    assert.ok(result, 'expected a non-null result');
    assert.deepEqual(result, { records: [{ n: 1 }] });
  });

  await record('already-normalized {records} passes through unchanged', async () => {
    resetCaptured();
    resetToolScript();
    setToolScript([{ body: sseBodyForObject({ records: [{ n: 1 }] }) }]);
    const result = await brain.query(CYPHER);
    assert.ok(result, 'expected a non-null result');
    assert.equal(result.records.length, 1);
  });

  await record('Theo error envelope {text} still passes through unchanged', async () => {
    resetCaptured();
    resetToolScript();
    setToolScript([{ body: sseBody('CAP_EXCEEDED: row cap 200 exceeded') }]);
    const result = await brain.query(CYPHER);
    assert.ok(result, 'expected a non-null result');
    assert.equal(result.text, 'CAP_EXCEEDED: row cap 200 exceeded');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(result, 'records'),
      'error passthrough must not gain a records key'
    );
  });

  await record(
    'unexpected shapes retain the safety net: {foo} and malformed {rows} both collapse to {records: []}, never crash',
    async () => {
      resetCaptured();
      resetToolScript();
      setToolScript([{ body: sseBodyForObject({ foo: 'bar' }) }]);
      const fooResult = await brain.query(CYPHER);
      assert.deepEqual(fooResult, { records: [] });

      resetCaptured();
      resetToolScript();
      setToolScript([{ body: sseBodyForObject({ rows: 'not-an-array' }) }]);
      const badRowsResult = await brain.query(CYPHER);
      assert.deepEqual(
        badRowsResult,
        { records: [] },
        'the new branch must guard on Array.isArray(result.rows), not mere key presence'
      );
    }
  );

  resetToolScript();
  await stopCaptureServer(server);
  process.stdout.write(
    `\nbrain-client Theo rows-shape suite: ${failed === 0 ? 'PASS' : 'FAIL'} (${failed} failures)\n`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + err.stack + '\n');
  process.exit(1);
});
