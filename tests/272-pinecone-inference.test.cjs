#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/272-pinecone-inference.test.cjs
 *
 * Phase 272, PYPORT-07, D-01. RED BY DESIGN TODAY, and stays RED until
 * lib/core/pinecone-inference.cjs (plan 272-04) exists. Ports
 * scripts/rs-engine.py:1098-1130 (_embed_topic_via_pinecone) to a ~40-line
 * CJS fetch module (D-01's code example, 272-PATTERNS.md file #9) -- the
 * ENTIRE in-scope Pinecone surface for this phase. Mode B/C's external
 * corpus control/data-plane SDK surface (lib/core/rs_cache.py:130-461:
 * create_index_for_model, has_index, describe_index, upsert_records, list(),
 * query) is explicitly DESCOPED per D-10 and is NOT covered by this test.
 *
 * Mocked fetch throughout via an injected fetchFn seam (matching
 * embedTexts's own encodeFn injection-seam convention,
 * lib/core/eureka/embedding-spine.cjs). No live PINECONE_API_KEY needed,
 * zero network egress from this test file itself.
 *
 * Part 8 (Canon Graph Boundary, the load-bearing requirement here): the
 * module MUST call auditQueryString on every input text BEFORE fetch, and
 * auditQueryObject on the parsed response BEFORE returning it -- matching
 * lib/core/rs-pinecone-bridge.cjs's existing dual-layer defense
 * (rs-pinecone-bridge.cjs:61 the require, :160-165 the pre-egress call,
 * :249 the post-receive call). Assert 2 and Assert 3 use CALL-ORDER
 * TRACKING (a shared array both the audit hook and the fetch mock push
 * labeled entries to), not a simple "was it called" boolean, since ordering
 * -- not mere presence -- is what Part 8 actually requires.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PINECONE_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'pinecone-inference.cjs');

let pineconeModule;
try {
  // eslint-disable-next-line global-require
  pineconeModule = require(PINECONE_MODULE_PATH);
} catch (_e) {
  pineconeModule = null;
}

// Known-forbidden fixture string, reused from
// tests/test-domain-insight-egress-tripwire.cjs (Section 1's email-pattern
// assertion, "auditQueryString throws on email address") rather than
// inventing a new one -- matches the email regex in FORBIDDEN_PATTERNS
// (lib/core/cross-room-aggregator.cjs:89).
const FORBIDDEN_FIXTURE_STRING = 'john.smith@harvard.edu';

const OLD_PINECONE_API_KEY = process.env.PINECONE_API_KEY;

function restoreEnv() {
  if (OLD_PINECONE_API_KEY === undefined) {
    delete process.env.PINECONE_API_KEY;
  } else {
    process.env.PINECONE_API_KEY = OLD_PINECONE_API_KEY;
  }
}

// A valid 2025-01 /embed response shape (RESEARCH.md Finding F-12):
// { model, vector_type, data: [{values, vector_type}], usage: {total_tokens} }
function makeValidResponse(count, dim) {
  const data = [];
  for (let i = 0; i < count; i += 1) {
    const values = new Array(dim).fill(0).map(function makeValue(_v, j) {
      return (i + 1) / (j + 1);
    });
    data.push({ values: values, vector_type: 'dense' });
  }
  return {
    model: 'multilingual-e5-large',
    vector_type: 'dense',
    data: data,
    usage: { total_tokens: 42 },
  };
}

async function main() {
  // Assert 0: the module exists. RED today -- lib/core/pinecone-inference.cjs
  // does not exist until plan 272-04 lands.
  assert.ok(
    pineconeModule !== null,
    'lib/core/pinecone-inference.cjs does not exist yet (expected until plan 272-04 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );

  const embedFn = pineconeModule.embedViaPineconeInference || pineconeModule.embed;
  assert.ok(
    typeof embedFn === 'function',
    'lib/core/pinecone-inference.cjs must export an async function named ' +
      'embedViaPineconeInference (or embed) -- see RESEARCH.md Code Examples / ' +
      '272-PATTERNS.md file #9 for the exact vetted shape'
  );

  try {
    // --- Assert 1: PINECONE_API_KEY unset -> pinecone_api_key_missing WITHOUT ---
    // --- ever calling fetch (the env-var gate short-circuits before any network). ---
    delete process.env.PINECONE_API_KEY;
    let fetchCallCountNoKey = 0;
    const fetchFnNoKey = async function fetchFnNoKey() {
      fetchCallCountNoKey += 1;
      return { ok: true, status: 200, json: async function json() { return makeValidResponse(1, 4); } };
    };
    const noKeyResult = await embedFn(['some text'], { fetchFn: fetchFnNoKey });
    assert.deepEqual(
      noKeyResult,
      { success: false, error: 'pinecone_api_key_missing' },
      'with PINECONE_API_KEY unset, the module must return ' +
        '{success:false, error:"pinecone_api_key_missing"} and never call fetch'
    );
    assert.equal(
      fetchCallCountNoKey,
      0,
      'the mock fetchFn must never be called when PINECONE_API_KEY is unset'
    );

    // --- Set a throwaway test key for the remaining asserts. ---
    process.env.PINECONE_API_KEY = 'test-throwaway-key-not-a-real-secret';

    // --- Assert 2 (Part 8 ordering, the load-bearing one): auditQueryString ---
    // --- must run on every input string BEFORE fetchFn is invoked. Call-order ---
    // --- tracking, not a boolean "was it called" check. ---
    const callOrder = [];
    const auditQueryStringFn = function auditQueryStringFn(s) {
      callOrder.push({ label: 'auditQueryString', value: s });
      return s;
    };
    const auditQueryObjectFn = function auditQueryObjectFn(o) {
      callOrder.push({ label: 'auditQueryObject', value: o });
      return o;
    };
    const inputTexts = ['first probe text', 'second probe text'];
    const fetchFnOrdered = async function fetchFnOrdered() {
      callOrder.push({ label: 'fetch', value: inputTexts.length });
      return {
        ok: true,
        status: 200,
        json: async function json() { return makeValidResponse(inputTexts.length, 4); },
      };
    };
    const orderedResult = await embedFn(inputTexts, {
      fetchFn: fetchFnOrdered,
      auditQueryStringFn: auditQueryStringFn,
      auditQueryObjectFn: auditQueryObjectFn,
    });
    const firstAuditIndex = callOrder.findIndex(function findAudit(e) {
      return e.label === 'auditQueryString';
    });
    const fetchIndex = callOrder.findIndex(function findFetch(e) {
      return e.label === 'fetch';
    });
    assert.ok(
      firstAuditIndex >= 0,
      'auditQueryString must be called at least once (once per input text) before returning'
    );
    assert.ok(fetchIndex >= 0, 'the injected fetchFn must have been called');
    assert.ok(
      firstAuditIndex < fetchIndex,
      'auditQueryString must run on every input string BEFORE fetch is invoked (Part 8 ordering) -- ' +
        'call order was: ' + JSON.stringify(callOrder.map(function label(e) { return e.label; }))
    );
    // Every input text must be audited, not just the first.
    const auditedValues = callOrder
      .filter(function isAuditString(e) { return e.label === 'auditQueryString'; })
      .map(function value(e) { return e.value; });
    for (const text of inputTexts) {
      assert.ok(
        auditedValues.includes(text),
        'auditQueryString must be called on every element of the input texts array, missing: ' + text
      );
    }

    // --- Assert 3: auditQueryObject must be called on the PARSED response ---
    // --- object BEFORE the function returns it to the caller (call-order ---
    // --- tracking against the response-processing side). ---
    const auditObjectIndices = [];
    callOrder.forEach(function collect(e, idx) {
      if (e.label === 'auditQueryObject') auditObjectIndices.push(idx);
    });
    const lastAuditObjectIndex = auditObjectIndices.length > 0
      ? auditObjectIndices[auditObjectIndices.length - 1]
      : -1;
    assert.ok(
      lastAuditObjectIndex >= 0,
      'auditQueryObject must be called on the parsed response before returning'
    );
    assert.ok(
      lastAuditObjectIndex > fetchIndex,
      'auditQueryObject must run on the parsed response AFTER fetch but BEFORE the function returns ' +
        '(Part 8 post-receive ordering) -- call order was: ' +
        JSON.stringify(callOrder.map(function label(e) { return e.label; }))
    );
    assert.ok(orderedResult && orderedResult.success === true, 'a valid mocked response must succeed');

    // --- Assert 4: the REAL auditQueryString/auditQueryObject throw ---
    // --- ExternalEgressViolation when a forbidden pattern is present, ---
    // --- matching rs-pinecone-bridge.cjs's existing contract (the stronger ---
    // --- claim, per the plan's instruction to prefer it when the ---
    // --- integration style is uncertain at RED-writing time). ---
    const fetchFnShouldNotBeCalled = async function fetchFnShouldNotBeCalled() {
      throw new Error('fetch must not be called when a forbidden pattern is present in the input');
    };
    await assert.rejects(
      async function attempt() {
        return embedFn([FORBIDDEN_FIXTURE_STRING], { fetchFn: fetchFnShouldNotBeCalled });
      },
      function isExternalEgressViolation(err) {
        return Boolean(err) && err.name === 'ExternalEgressViolation';
      },
      'the module must throw ExternalEgressViolation (Canon Part 8, the ONE intentional escape ' +
        'route, per rs-pinecone-bridge.cjs:162) when an input text matches FORBIDDEN_PATTERNS -- ' +
        'reused the known-forbidden fixture string from ' +
        'tests/test-domain-insight-egress-tripwire.cjs (' + FORBIDDEN_FIXTURE_STRING + ')'
    );

    // --- Assert 5: request/response shape. vectors.length must equal the ---
    // --- input count; a data-array-length mismatch returns ---
    // --- {success:false, error:'shape_mismatch'}. ---
    const shapeResult = await embedFn(['a', 'b', 'c'], {
      fetchFn: async function fetchFnShape() {
        return { ok: true, status: 200, json: async function json() { return makeValidResponse(3, 4); } };
      },
    });
    assert.equal(shapeResult.success, true, 'a matching-count response must succeed');
    assert.equal(shapeResult.vectors.length, 3, 'vectors.length must equal the input text count');
    assert.ok(shapeResult.provenance && shapeResult.provenance.model, 'provenance.model must be set');
    assert.ok(typeof shapeResult.provenance.dim === 'number', 'provenance.dim must be a number');

    const mismatchResult = await embedFn(['a', 'b', 'c'], {
      fetchFn: async function fetchFnMismatch() {
        return { ok: true, status: 200, json: async function json() { return makeValidResponse(2, 4); } };
      },
    });
    assert.deepEqual(
      mismatchResult,
      { success: false, error: 'shape_mismatch' },
      'a response whose data array length does not match the input count must return ' +
        '{success:false, error:"shape_mismatch"}'
    );

    // --- Assert 6: a mocked non-2xx HTTP response returns a structured ---
    // --- envelope, never throws. ---
    const http401Result = await embedFn(['a'], {
      fetchFn: async function fetchFn401() {
        return { ok: false, status: 401, json: async function json() { return {}; } };
      },
    });
    assert.deepEqual(
      http401Result,
      { success: false, error: 'pinecone_http_401' },
      'a mocked 401 response must return {success:false, error:"pinecone_http_401"}, never throw'
    );

    // --- Assert 7 (secret hygiene, Security Domain finding, T-272-09): a ---
    // --- fetchFn rejection whose message contains the fake API key must NOT ---
    // --- leak that key substring into the returned envelope's detail field. ---
    const fakeKey = process.env.PINECONE_API_KEY;
    const leakyFetchFn = async function leakyFetchFn() {
      throw new Error('network failure while using key ' + fakeKey);
    };
    const leakResult = await embedFn(['a'], { fetchFn: leakyFetchFn });
    assert.equal(
      leakResult.success,
      false,
      'a fetchFn rejection must return a structured failure envelope, never throw across the module boundary'
    );
    const detailString = JSON.stringify(leakResult.detail || '');
    assert.ok(
      !detailString.includes(fakeKey),
      'the returned envelope detail field must NOT contain the raw PINECONE_API_KEY value even when ' +
        'the underlying fetch error message contains it -- secret leakage in error paths (Security ' +
        'Domain finding, T-272-09)'
    );

    console.log('PASS test-272-pinecone-inference');
  } finally {
    restoreEnv();
  }
}

main().catch(function onError(e) {
  restoreEnv();
  console.error(e);
  process.exit(1);
});
