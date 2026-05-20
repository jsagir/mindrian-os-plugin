#!/usr/bin/env node
// tests/127.1-query-embedder.test.cjs
//
// Phase 127.1 Plan 03 -- harness for the server-side query-embedder.
//
// Contract (per 127.1-03-PLAN.md <behavior> + 127.1-CONTEXT.md Lock 2):
//   The Brain server must be able to convert a query string into a
//   1024-dim multilingual-e5-large vector server-side. Pinecone did this
//   for free via integrated inference; Neo4j has no integrated inference,
//   so the rewired brain_search path needs this real new step.
//
//   embedQuery(text):
//     - resolves to a numeric array of length exactly 1024
//     - prepends the e5 `query: ` prefix to the input before embedding
//       (the migrated corpus was `passage: `-prefixed; a prefix mismatch
//       silently degrades recall -- the single most likely correctness
//       bug in this plan)
//     - rejects a non-string or empty-string input with a clear error
//     - rejects a backend response whose vector length is not 1024 with a
//       clear error naming the observed length
//     - rejects with `embedding backend unavailable` when the backend is
//       unreachable (so the cutover path can fall back deterministically)
//
// This harness is HERMETIC: it injects a fake embedding transport via the
// `_setTransport` test seam (module.exports._test._setTransport) so it
// runs with NO live network call. It never calls the live embedding
// backend.
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - No live embedding-backend call; mock transport only.
//   - No writes outside this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const embedderPath = require.resolve('../mcp-server-brain/lib/query-embedder.cjs');
const embedder = require(embedderPath);
const { embedQuery, MODEL, EMBEDDING_DIMS, QUERY_PREFIX } = embedder;
const seam = embedder._test;

// A 1024-element numeric vector for the happy path. Values are arbitrary;
// only the length and numeric type matter to the embedder contract.
function fakeVector(len) {
  const v = new Array(len);
  for (let i = 0; i < len; i += 1) v[i] = (i % 7) * 0.001;
  return v;
}

// Reset the transport seam after each test so one test cannot leak a mock
// into the next.
test.afterEach(() => {
  if (seam && typeof seam._resetTransport === 'function') seam._resetTransport();
});

test('127.1 query-embedder -- module constants are locked', () => {
  assert.equal(MODEL, 'multilingual-e5-large', 'MODEL must be the e5-large lock (Lock 2)');
  assert.equal(EMBEDDING_DIMS, 1024, 'EMBEDDING_DIMS must be 1024 (Lock 2)');
  assert.equal(QUERY_PREFIX, 'query: ', 'QUERY_PREFIX must be the e5 query convention');
});

test('127.1 query-embedder -- embedQuery returns a 1024-length numeric array', async () => {
  seam._setTransport(async () => fakeVector(1024));
  const out = await embedQuery('frameworks for wicked problems');
  assert.ok(Array.isArray(out), 'embedQuery must resolve to an array');
  assert.equal(out.length, 1024, 'vector length must be exactly 1024');
  assert.ok(
    out.every((n) => typeof n === 'number' && Number.isFinite(n)),
    'every element must be a finite number'
  );
});

test('127.1 query-embedder -- embedQuery applies the e5 `query: ` prefix', async () => {
  let sentPayload = null;
  seam._setTransport(async (text) => {
    sentPayload = text;
    return fakeVector(1024);
  });
  await embedQuery('frameworks for wicked problems');
  assert.equal(typeof sentPayload, 'string', 'the transport must receive a string');
  assert.ok(
    sentPayload.startsWith('query: '),
    'the embedded text must begin with the e5 `query: ` prefix; observed: ' +
      JSON.stringify(sentPayload.slice(0, 20))
  );
  assert.equal(
    sentPayload,
    'query: frameworks for wicked problems',
    'the prefix must be prepended to the verbatim input text'
  );
});

test('127.1 query-embedder -- rejects a non-string input', async () => {
  seam._setTransport(async () => fakeVector(1024));
  await assert.rejects(
    () => embedQuery(42),
    /non-empty string/i,
    'a numeric input must be rejected with a clear error'
  );
  await assert.rejects(
    () => embedQuery(null),
    /non-empty string/i,
    'a null input must be rejected with a clear error'
  );
  await assert.rejects(
    () => embedQuery(undefined),
    /non-empty string/i,
    'an undefined input must be rejected with a clear error'
  );
});

test('127.1 query-embedder -- rejects an empty-string input', async () => {
  seam._setTransport(async () => fakeVector(1024));
  await assert.rejects(
    () => embedQuery(''),
    /non-empty string/i,
    'an empty string must be rejected with a clear error'
  );
  await assert.rejects(
    () => embedQuery('   '),
    /non-empty string/i,
    'a whitespace-only string must be rejected with a clear error'
  );
});

test('127.1 query-embedder -- rejects a wrong-length backend vector, naming the observed length', async () => {
  seam._setTransport(async () => fakeVector(384));
  await assert.rejects(
    () => embedQuery('a query'),
    (err) => {
      assert.ok(/1024/.test(err.message), 'error must name the expected 1024 dimension');
      assert.ok(/384/.test(err.message), 'error must name the observed length 384');
      return true;
    },
    'a 384-length backend vector must be rejected with an error naming both lengths'
  );
});

test('127.1 query-embedder -- rejects a non-numeric backend vector', async () => {
  seam._setTransport(async () => {
    const v = fakeVector(1024);
    v[10] = 'not-a-number';
    return v;
  });
  await assert.rejects(
    () => embedQuery('a query'),
    /numeric|number/i,
    'a vector with a non-numeric element must be rejected'
  );
});

test('127.1 query-embedder -- backend unreachable rejects with `embedding backend unavailable`', async () => {
  seam._setTransport(async () => {
    throw new Error('ECONNREFUSED 127.0.0.1:443');
  });
  await assert.rejects(
    () => embedQuery('a query'),
    /embedding backend unavailable/,
    'a transport failure must surface as `embedding backend unavailable` for deterministic fallback'
  );
});

test('127.1 query-embedder -- backend non-2xx rejects with `embedding backend unavailable`', async () => {
  seam._setTransport(async () => {
    const e = new Error('HTTP 503 from embedding endpoint');
    e.isHttpError = true;
    throw e;
  });
  await assert.rejects(
    () => embedQuery('a query'),
    /embedding backend unavailable/,
    'a non-2xx response must surface as `embedding backend unavailable`'
  );
});

process.on('exit', (code) => {
  if (code === 0) {
    process.stdout.write('OK 127.1-query-embedder 1024-dim e5-large verified\n');
  }
});
