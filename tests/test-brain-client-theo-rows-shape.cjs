#!/usr/bin/env node
'use strict';

/**
 * Regression suite pinning every recognized AND unrecognized brain_query
 * response shape that lib/core/brain-client.cjs's query() must normalize.
 *
 * Root cause (2026-09-01, still the reason this file exists): the Brain's
 * `brain_query` tool is flipping to Theo's contract, which serializes a
 * successful answer as `{ rows: [...], diagnostics: {...} }` instead of
 * the incumbent bare array. Before the Theo branch landed, that shape
 * matched none of query()'s recognized branches and silently fell through
 * to the unexpected-shape safety net, which used to be a blind
 * `{ records: [] }`. See
 * docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md
 * finding #1, and Theo's own
 * .planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md.
 *
 * Extended (2026-09-03, quick/260903-eit): the safety net itself was the
 * next hole. `{ records: [] }` on ANY unrecognized shape read byte-for-byte
 * identical to a legitimate no-match, so a future contract drift would
 * repeat the exact 2026-09-01 Theo incident with no signal at all -- a
 * human would have to read the code again to notice. This suite now also
 * pins the typed-error contract for that fallback: it still returns
 * `records: []` so no caller crashes, but it now ALSO carries
 * `error: 'brain_query_unrecognized_shape'` plus `shape_type` and
 * `shape_keys`, and emits one warn-once stderr line naming the offending
 * key names (never values, per Canon Part 8). See this task directory's
 * `260903-eit-PLAN.md` alongside the 2026-09-01 sources above.
 *
 * Modeled structurally on tests/test-brain-client-params.cjs: same
 * record(name, fn) pass/fail reporter, same process.exit(failed === 0 ? 0
 * : 1) ending, node:assert/strict, Node built-ins only, no new deps.
 *
 * Reuses tests/helpers/brain-capture-server.cjs (Canon Part 7, reuse
 * before build) rather than standing up a second mock HTTP server.
 *
 * Cases:
 *   1. Theo populated {rows, diagnostics} -> records populated (must keep
 *      passing)
 *   2. Theo genuinely empty {rows: [], diagnostics} -> records empty,
 *      diagnostics survives, AND no `error` key -- the discriminator that
 *      separates "Theo answered, nothing matched" from a shape mismatch
 *      (must keep passing; the no-`error` assertion is the negative
 *      control for the new contract below)
 *   3. Incumbent bare array -> records passthrough (must keep passing)
 *   4. Already-normalized {records} -> passthrough (must keep passing)
 *   5. Error passthrough {text: 'CODE: detail'} -> unchanged (must keep
 *      passing)
 *   6. Unrecognized object {foo: 'bar'} -> typed
 *      `brain_query_unrecognized_shape` error, `shape_type: 'object'`,
 *      `shape_keys: ['foo']`, `records: []` (FAILS before Task 2)
 *   7. Malformed {rows: 'not-an-array'} -> same typed error contract, with
 *      `shape_keys: ['rows']`, pinning that the Theo branch guards on
 *      Array.isArray(result.rows), never mere key presence (FAILS before
 *      Task 2)
 *   8. The warn-once line fires exactly once on the first unrecognized
 *      shape, naming the shape and the offending key (FAILS before Task 2)
 *   9. The warn-once line does NOT fire again on a second unrecognized
 *      shape, while the typed error is still returned on every call
 *      (FAILS before Task 2)
 *   10. Part 8 no-value-leakage: a `{secret_field: 'CANARY7F3A2B'}` shape's
 *       warning contains the key name `secret_field` but never the value
 *       `CANARY7F3A2B` (FAILS before Task 2)
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

/**
 * Swap console.warn for a collector for the duration of `fn`, and restore
 * the original in a finally so a failing assertion inside `fn` can never
 * leave the global patched for a later case.
 * @param {() => Promise<void>} fn
 * @returns {Promise<string[]>} one captured warn-call text per call
 */
async function captureWarnings(fn) {
  const original = console.warn;
  const captured = [];
  console.warn = (...args) => { captured.push(args.join(' ')); };
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return captured;
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
      assert.ok(
        !Object.prototype.hasOwnProperty.call(result, 'error'),
        'negative control: a RECOGNIZED empty answer must carry no error key, ' +
          'so error presence -- not an empty records array -- is the reliable ' +
          'discriminator for an unrecognized shape'
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
    'unrecognized object {foo} returns the typed brain_query_unrecognized_shape error, never a bare empty',
    async () => {
      resetCaptured();
      resetToolScript();
      setToolScript([{ body: sseBodyForObject({ foo: 'bar' }) }]);
      const result = await brain.query(CYPHER);
      assert.ok(
        Array.isArray(result.records) && result.records.length === 0,
        'records must stay a length-0 array so no unguarded caller crashes'
      );
      assert.equal(result.error, 'brain_query_unrecognized_shape');
      assert.equal(result.shape_type, 'object');
      assert.deepEqual(result.shape_keys, ['foo']);
    }
  );

  await record(
    'malformed {rows: not-an-array} is NOT the Theo branch and also returns the typed error',
    async () => {
      resetCaptured();
      resetToolScript();
      setToolScript([{ body: sseBodyForObject({ rows: 'not-an-array' }) }]);
      const result = await brain.query(CYPHER);
      assert.ok(
        Array.isArray(result.records) && result.records.length === 0,
        'records must stay a length-0 array so no unguarded caller crashes'
      );
      assert.equal(result.error, 'brain_query_unrecognized_shape');
      assert.deepEqual(
        result.shape_keys,
        ['rows'],
        'the Theo branch guards on Array.isArray(result.rows), not mere key ' +
          'presence, so a malformed rows value must still land on the typed ' +
          'error path, not the Theo branch'
      );
    }
  );

  await record(
    'the unrecognized-shape warning fires exactly once on the first occurrence',
    async () => {
      resetCaptured();
      resetToolScript();
      if (brain._test && typeof brain._test._setQueryShapeWarned === 'function') {
        brain._test._setQueryShapeWarned(false);
      }
      setToolScript([{ body: sseBodyForObject({ foo: 'bar' }) }]);
      const captured = await captureWarnings(async () => {
        await brain.query(CYPHER);
      });
      assert.equal(captured.length, 1, 'expected exactly one console.warn call');
      assert.ok(
        captured[0].includes('brain_query_unrecognized_shape'),
        'the warning must name the token brain_query_unrecognized_shape'
      );
      assert.ok(captured[0].includes('foo'), 'the warning must name the offending key');
    }
  );

  await record(
    'the unrecognized-shape warning is once-per-process, not once-per-call',
    async () => {
      resetCaptured();
      resetToolScript();
      // Deliberately do NOT reset the warn-once flag here: the prior case
      // already fired it. A second unrecognized-shape query in the SAME
      // process must produce zero additional console lines, while the
      // return value stays per-call (the typed error every time).
      setToolScript([{ body: sseBodyForObject({ foo: 'bar' }) }]);
      let result;
      const captured = await captureWarnings(async () => {
        result = await brain.query(CYPHER);
      });
      assert.equal(
        captured.length,
        0,
        'expected zero additional warn calls once the flag is already set'
      );
      assert.equal(
        result.error,
        'brain_query_unrecognized_shape',
        'the return value is per-call; only the console line is deduped'
      );
    }
  );

  await record(
    'Part 8: the warning names response KEY NAMES only, never a response VALUE',
    async () => {
      resetCaptured();
      resetToolScript();
      if (brain._test && typeof brain._test._setQueryShapeWarned === 'function') {
        brain._test._setQueryShapeWarned(false);
      }
      setToolScript([{ body: sseBodyForObject({ secret_field: 'CANARY7F3A2B' }) }]);
      const captured = await captureWarnings(async () => {
        await brain.query(CYPHER);
      });
      assert.equal(captured.length, 1, 'expected exactly one console.warn call');
      assert.ok(
        !captured[0].includes('CANARY7F3A2B'),
        'the response VALUE must never reach the log line'
      );
      assert.ok(
        captured[0].includes('secret_field'),
        'the response KEY NAME is fine to log'
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
